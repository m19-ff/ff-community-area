import { NextRequest } from 'next/server'
import { db } from '@/db'
import { users, wallets, settings, transactions, teamMembers } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError } from '@/lib/api'
import { getTeamWallet, increaseTeamBalance, addTeamTransaction, createTeamWallet } from '@/lib/teamWallet'

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const [user] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1)
  if (!user) return apiError('User not found', 404)

  const today   = new Date().toISOString().split('T')[0]
  const watched = user.adWatchedDate === today ? (user.adWatchedToday || 0) : 0

  if (watched >= 3) {
    return apiError('Maximum 3 ads per day reached. Come back tomorrow!', 400)
  }

  // Read reward amount from settings (default 1 if not configured)
  const [setting] = await db.select().from(settings).where(eq(settings.key, 'ad_reward_points')).limit(1)
  const rewardPoints = setting ? Math.max(1, parseInt(setting.value) || 1) : 1

  // Increment ad counter first
  await db.update(users)
    .set({ adWatchedToday: watched + 1, adWatchedDate: today })
    .where(eq(users.id, auth.userId))

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
        description:   `Ad reward #${watched + 1} — credited to team wallet`,
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
      description:   `Ad reward #${watched + 1} of the day`,
    })
  } else {
    // No team → credit personal wallet using SQL arithmetic (race-safe)
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, auth.userId)).limit(1)
    if (!wallet) return apiError('Wallet not found', 404)

    const [updated] = await db
      .update(wallets)
      .set({
        balance:     sql`${wallets.balance}     + ${rewardPoints}`,
        totalEarned: sql`${wallets.totalEarned} + ${rewardPoints}`,
        updatedAt:   new Date(),
      })
      .where(eq(wallets.userId, auth.userId))
      .returning()

    newBalance = updated.balance

    await db.insert(transactions).values({
      userId:        auth.userId,
      type:          'earn_ad',
      amount:        rewardPoints,
      balanceBefore: wallet.balance,
      balanceAfter:  newBalance,
      description:   `Ad reward #${watched + 1} of the day`,
    })
  }

  return apiSuccess({
    pointsEarned:    rewardPoints,
    newBalance,
    adsWatchedToday: watched + 1,
    adsRemaining:    3 - (watched + 1),
    rewardedTo:      membership ? 'team_wallet' : 'personal_wallet',
  })
}
