import { NextRequest } from 'next/server'
import { db } from '@/db'
import { users, teams, teamMembers, tournaments, scrims, wallets, withdrawRequests, transactions } from '@/db/schema'
import { eq, sum, count } from 'drizzle-orm'
import { requireAdmin, apiSuccess, apiError } from '@/lib/api'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const [usersStats] = await db.select({ total: count() }).from(users)
  const [teamsStats] = await db.select({ total: count() }).from(teams)
  const [playersStats] = await db.select({ total: count() }).from(teamMembers)
  const [tournamentsStats] = await db.select({ total: count() }).from(tournaments)
  const [scrimsStats] = await db.select({ total: count() }).from(scrims)
  const [pendingWithdrawals] = await db.select({ total: count() }).from(withdrawRequests)
    .where(eq(withdrawRequests.status, 'pending'))
  const [totalPoints] = await db.select({ total: sum(wallets.balance) }).from(wallets)

  return apiSuccess({
    stats: {
      users: usersStats.total,
      teams: teamsStats.total,
      players: playersStats.total,
      tournaments: tournamentsStats.total,
      scrims: scrimsStats.total,
      pendingWithdrawals: pendingWithdrawals.total,
      totalPointsInCirculation: totalPoints.total || 0,
      revenue: ((Number(totalPoints.total) || 0) / 100).toFixed(2),
    },
  })
}
