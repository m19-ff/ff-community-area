import { NextRequest } from 'next/server'
import { db } from '@/db'
import { users, wallets, settings, transactions, teamMembers, teams } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError } from '@/lib/api'
import {
  getTeamWallet,
  increaseTeamBalance,
  addTeamTransaction,
} from '@/lib/teamWallet'

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const [user] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1)
  if (!user) return apiError('User not found', 404)

  const today = new Date().toISOString().split('T')[0]
  const watched = user.adWatchedDate === today ? (user.adWatchedToday || 0) : 0

  if (watched >= 3) {
    return apiError('Maximum 3 ads per day reached. Come back tomorrow!', 400)
  }

  // Get ad reward amount from settings
  const [setting] = await db.select().from(settings).where(eq(settings.key, 'ad_reward_points')).limit(1)
  const rewardPoints = setting ? parseInt(setting.value) : 1

  // Update ad watch count first
  await db.update(users).set({
    adWatchedToday: watched + 1,
    adWatchedDate: today,
  }).where(eq(users.id, auth.userId))

  // Check if player belongs to a team
  const [membership] = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, auth.userId))
    .limit(1)

  let newBalance: number

  if (membership) {
    // ── Player is in a team: reward goes into the team wallet ──────────────
    const teamId = membership.teamId

    const teamWallet = await getTeamWallet(teamId)
    if (!teamWallet) return apiError('Team wallet not found', 500)

    const balanceBefore = teamWallet.balance
    const updatedTeamWallet = await increaseTeamBalance(teamId, rewardPoints)
    newBalance = updatedTeamWallet.balance

    // Personal wallet transaction (zero-balance change; recorded for audit)
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, auth.userId)).limit(1)
    if (wallet) {
      await db.insert(transactions).values({
        userId: auth.userId,
        type: 'earn_ad',
        amount: rewardPoints,
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance,
        description: `Ad reward #${watched + 1} — credited to team wallet`,
        meta: { teamId },
      })
    }

    // Team transaction
    await addTeamTransaction({
      teamId,
      userId: auth.userId,
      type: 'earn_manual',
      amount: rewardPoints,
      balanceBefore,
      balanceAfter: newBalance,
      description: `Ad reward #${watched + 1} of the day by player ${auth.userId}`,
    })
  } else {
    // ── No team: reward goes into personal wallet ───────────────────────────
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, auth.userId)).limit(1)
    if (!wallet) return apiError('Wallet not found', 404)

    newBalance = wallet.balance + rewardPoints
    await db.update(wallets).set({
      balance: newBalance,
      totalEarned: wallet.totalEarned + rewardPoints,
    }).where(eq(wallets.userId, auth.userId))

    await db.insert(transactions).values({
      userId: auth.userId,
      type: 'earn_ad',
      amount: rewardPoints,
      balanceBefore: wallet.balance,
      balanceAfter: newBalance,
      description: `Ad reward #${watched + 1} of the day`,
    })

  }

  return apiSuccess({
    pointsEarned: rewardPoints,
    newBalance,
    adsWatchedToday: watched + 1,
    adsRemaining: 3 - (watched + 1),
    rewardedTo: membership ? 'team_wallet' : 'personal_wallet',
  })
}
