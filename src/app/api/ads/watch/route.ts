import { NextRequest } from 'next/server'
import { db } from '@/db'
import { users, wallets, settings, transactions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError } from '@/lib/api'

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
  const rewardPoints = setting ? parseInt(setting.value) : 10

  const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, auth.userId)).limit(1)
  if (!wallet) return apiError('Wallet not found', 404)

  const newBalance = wallet.balance + rewardPoints
  await db.update(wallets).set({
    balance: newBalance,
    totalEarned: wallet.totalEarned + rewardPoints,
  }).where(eq(wallets.userId, auth.userId))

  await db.update(users).set({
    adWatchedToday: watched + 1,
    adWatchedDate: today,
  }).where(eq(users.id, auth.userId))

  await db.insert(transactions).values({
    userId: auth.userId,
    type: 'earn_ad',
    amount: rewardPoints,
    balanceBefore: wallet.balance,
    balanceAfter: newBalance,
    description: `Ad reward #${watched + 1} of the day`,
  })

  return apiSuccess({
    pointsEarned: rewardPoints,
    newBalance,
    adsWatchedToday: watched + 1,
    adsRemaining: 3 - (watched + 1),
  })
}
