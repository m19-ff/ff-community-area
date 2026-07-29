import { NextRequest } from 'next/server'
import { db } from '@/db'
import { playerStats, users, teamMembers, tournamentTeams, transactions } from '@/db/schema'
import { eq, sql, count, and } from 'drizzle-orm'
import { apiSuccess, apiError, requireAdmin } from '@/lib/api'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = parseInt(searchParams.get('userId') || '0')
  if (!userId) return apiError('userId required')

  // Live computed stats
  const memberOf = await db.select({ teamId: teamMembers.teamId }).from(teamMembers).where(eq(teamMembers.userId, userId))
  const teamIds = memberOf.map(m => m.teamId)

  let totalMatches = 0, totalWins = 0, top3 = 0

  if (teamIds.length > 0) {
    const tStats = await db
      .select({
        total: count(),
        wins:  sql<number>`COUNT(*) FILTER (WHERE ${tournamentTeams.placement} = 1)`,
        top3:  sql<number>`COUNT(*) FILTER (WHERE ${tournamentTeams.placement} <= 3)`,
      })
      .from(tournamentTeams)
      .where(sql`${tournamentTeams.teamId} = ANY(ARRAY[${sql.raw(teamIds.join(','))}])`)

    totalMatches = Number(tStats[0]?.total) || 0
    totalWins    = Number(tStats[0]?.wins)  || 0
    top3         = Number(tStats[0]?.top3)  || 0
  }

  const [wallet] = await db
    .select({ totalEarned: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
    .from(transactions)
    .where(eq(transactions.userId, userId))

  const totalEarned = Number(wallet?.totalEarned) || 0

  // Ad count from transactions
  const [adsRow] = await db
    .select({ ads: count() })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.type, 'earn_ad')))

  const avgPlacement = totalMatches > 0 ? Math.round((totalMatches + 1) / 2) : 0
  const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0

  return apiSuccess({
    stats: {
      totalMatches,
      totalWins,
      top3Finishes: top3,
      avgPlacement,
      winRate,
      totalEarned,
      adsWatched: Number(adsRow?.ads) || 0,
      kills: 0, // Will be populated when match_history has kill data
      deaths: 0,
    }
  })
}

export async function PUT(request: NextRequest) {
  const authUser = await requireAdmin(request)
  if (!authUser) return apiError('Unauthorized', 401)

  const body = await request.json() as { userId: number; kills?: number; deaths?: number }
  if (!body.userId) return apiError('userId required')

  // Upsert player stats record
  await db.insert(playerStats).values({
    userId:     body.userId,
    totalKills: body.kills || 0,
    totalDeaths: body.deaths || 0,
  }).onConflictDoUpdate({
    target: [playerStats.userId],
    set: {
      totalKills:  sql`EXCLUDED.total_kills`,
      totalDeaths: sql`EXCLUDED.total_deaths`,
      updatedAt:   new Date(),
    }
  })

  return apiSuccess({ message: 'Stats updated' })
}
