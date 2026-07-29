import { NextRequest } from 'next/server'
import { db } from '@/db'
import { users, wallets, settings, transactions, teamMembers, playerStats } from '@/db/schema'
import { eq, sql, and, lt } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError } from '@/lib/api'
import { getTeamWallet, increaseTeamBalance, addTeamTransaction, createTeamWallet } from '@/lib/teamWallet'
import { checkAndUnlockAchievements } from '@/lib/achievements'

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  // Read reward amount from settings
  const [setting] = await db.select().from(settings).where(eq(settings.key, 'ad_reward_points')).limit(1)
  const rewardPoints = setting ? Math.max(1, parseInt(setting.value) || 1) : 1

  const today = new Date().toISOString().split('T')[0]

  // Atomic conditional increment — only succeeds if today's count < 3.
  // If adWatchedDate is a different day, reset to 1; otherwise increment by 1.
  const [updated] = await db
    .update(users)
    .set({
      adWatchedToday: sql`CASE WHEN ${users.adWatchedDate} = ${today} THEN ${users.adWatchedToday} + 1 ELSE 1 END`,
      adWatchedDate:  today,
    })
    .where(and(
      eq(users.id, auth.userId),
      sql`(${users.adWatchedDate} != ${today} OR ${users.adWatchedToday} < 3)`,
    ))
    .returning({ adWatchedToday: users.adWatchedToday })

  if (!updated) {
    return apiError('Maximum 3 ads per day reached. Come back tomorrow!', 400)
  }

  const watched = updated.adWatchedToday // value after increment (1, 2, or 3)

  // Also increment the cumulative total used for achievements
  await db
    .update(playerStats)
    .set({ adWatchedTotal: sql`${playerStats.adWatchedTotal} + 1` })
    .where(eq(playerStats.userId, auth.userId))

  // Check team membership
  const [membership] = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, auth.userId))
    .limit(1)

  let newBalance: number

  if (membership) {
    // Player is in a team → credit team wallet
    const teamId = membership.teamId

    let teamWallet = await getTeamWallet(teamId)
    if (!teamWallet) teamWallet = await createTeamWallet(teamId)

    const balanceBefore      = teamWallet.balance
    const updatedTeamWallet  = await increaseTeamBalance(teamId, rewardPoints)
    newBalance               = updatedTeamWallet.balance

    // Audit record on personal wallet (balance unchanged)
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, auth.userId)).limit(1)
    if (wallet) {
      await db.insert(transactions).values({
        userId:        auth.userId,
        type:          'earn_ad',
        amount:        rewardPoints,
        balanceBefore: wallet.balance,
        balanceAfter:  wallet.balance,
        description:   `Ad reward #${watched} — credited to team wallet`,
        meta:          { teamId },
      })
    }

    await addTeamTransaction({
      teamId,
      userId:        auth.userId,
      type:          'earn_manual',
      amount:        rewardPoints,
      balanceBefore,
      balanceAfter:  newBalance,
      description:   `Ad reward #${watched} of the day`,
    })
  } else {
    // No team → credit personal wallet
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, auth.userId)).limit(1)
    if (!wallet) return apiError('Wallet not found', 404)

    const [bal] = await db
      .update(wallets)
      .set({
        balance:     sql`${wallets.balance}     + ${rewardPoints}`,
        totalEarned: sql`${wallets.totalEarned} + ${rewardPoints}`,
        updatedAt:   new Date(),
      })
      .where(eq(wallets.userId, auth.userId))
      .returning()

    newBalance = bal.balance

    await db.insert(transactions).values({
      userId:        auth.userId,
      type:          'earn_ad',
      amount:        rewardPoints,
      balanceBefore: wallet.balance,
      balanceAfter:  newBalance,
      description:   `Ad reward #${watched} of the day`,
    })
  }

  void checkAndUnlockAchievements(auth.userId)

  return apiSuccess({
    pointsEarned:    rewardPoints,
    newBalance,
    adsWatchedToday: watched,
    adsRemaining:    3 - watched,
    rewardedTo:      membership ? 'team_wallet' : 'personal_wallet',
  })
}

