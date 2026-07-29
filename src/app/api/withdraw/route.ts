import { NextRequest } from 'next/server'
import { db } from '@/db'
import { withdrawRequests, notifications, users, teamMembers, teams } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAuth, requireAdmin, apiSuccess, apiError, paginate } from '@/lib/api'
import {
  getTeamWallet,
  decreaseTeamBalance,
  addTeamTransaction,
} from '@/lib/teamWallet'

const MIN_POINTS = 5000           // 5000 pts = $50
const COMMISSION_RATE = 0.20      // 20%
const POINTS_PER_USD = 100

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  // Check user exists and is not banned
  const [user] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1)
  if (!user) return apiError('User not found', 404)
  if (user.isBanned) return apiError('Your account is banned', 403)

  // Must be a captain
  const [myTeam] = await db.select().from(teams).where(eq(teams.captainId, auth.userId)).limit(1)
  if (!myTeam) return apiError('Only team captains can withdraw from the team wallet', 403)

  // Get team wallet
  const teamWallet = await getTeamWallet(myTeam.id)
  if (!teamWallet) return apiError('Team wallet not found', 404)

  const body = await request.json()
  const { amountPoints, method, paymentAddress, message } = body

  if (!amountPoints || !method || !paymentAddress) {
    return apiError('Amount (points), method, and payment address are required', 400)
  }
  if (!['paypal', 'binance', 'baridimob'].includes(method)) return apiError('Invalid withdrawal method', 400)

  const points = parseInt(amountPoints)
  if (isNaN(points) || points < MIN_POINTS) {
    return apiError(`Minimum withdrawal is ${MIN_POINTS.toLocaleString()} points ($${MIN_POINTS / POINTS_PER_USD})`, 400)
  }
  if (teamWallet.balance < points) {
    return apiError(`Insufficient team balance. Team has ${teamWallet.balance.toLocaleString()} pts, need ${points.toLocaleString()} pts`, 400)
  }

  // Calculate commission and net payout
  const commissionPoints = Math.floor(points * COMMISSION_RATE)
  const netPoints = points - commissionPoints
  const grossUsd = (points / POINTS_PER_USD).toFixed(2)
  const commissionUsd = (commissionPoints / POINTS_PER_USD).toFixed(2)
  const netUsd = (netPoints / POINTS_PER_USD).toFixed(2)

  const balanceBefore = teamWallet.balance

  // Deduct full amount from team wallet
  const updatedWallet = await decreaseTeamBalance(myTeam.id, points)

  // Team transaction (gross deduction)
  await addTeamTransaction({
    teamId: myTeam.id,
    userId: auth.userId,
    type: 'withdraw',
    amount: -points,
    balanceBefore,
    balanceAfter: updatedWallet.balance,
    description: `Withdrawal: ${points.toLocaleString()} pts gross | 20% commission: ${commissionPoints} pts | Net payout: $${netUsd}`,
  })

  // Create withdraw request
  const [req] = await db.insert(withdrawRequests).values({
    teamId: myTeam.id,
    captainId: auth.userId,
    amountUsd: netUsd,
    amountPoints: netPoints,
    method: method as 'paypal' | 'binance' | 'baridimob',
    paymentAddress,
    message: `Gross: ${points} pts ($${grossUsd}) | Commission (20%): ${commissionPoints} pts ($${commissionUsd}) | Net payout: ${netPoints} pts ($${netUsd})${message ? ' | Note: ' + message : ''}`,
    status: 'pending',
  }).returning()

  // Notify captain
  await db.insert(notifications).values({
    userId: auth.userId,
    type: 'withdrawal_approved',
    title: 'Withdrawal Request Submitted',
    body: `Your team withdrawal of ${points.toLocaleString()} pts has been submitted. Net payout after 20% commission: $${netUsd}.`,
    data: { withdrawalId: req.id },
  })

  return apiSuccess({
    request: req,
    summary: {
      grossPoints: points,
      grossUsd,
      commissionPoints,
      commissionUsd,
      netPoints,
      netUsd,
    },
    message: 'Withdrawal request submitted successfully',
  }, 201)
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const isAdmin = ['admin', 'superadmin', 'assistant'].includes(auth.role)
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const { limit: take, offset, page: pg } = paginate(page, 20)

  const conditions = isAdmin ? undefined : eq(withdrawRequests.captainId, auth.userId)

  const list = await db.select().from(withdrawRequests)
    .where(conditions)
    .orderBy(desc(withdrawRequests.createdAt))
    .limit(take)
    .offset(offset)

  return apiSuccess({ withdrawals: list, pagination: { page: pg, limit: take } })
}
