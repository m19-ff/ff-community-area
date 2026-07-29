import { NextRequest } from 'next/server'
import { db } from '@/db'
import { matchHistory, tournaments, scrims } from '@/db/schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import { apiSuccess, apiError, requireAuth, requireAdmin } from '@/lib/api'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const teamId = parseInt(searchParams.get('teamId') || '0')
  const type   = searchParams.get('type') // tournament | scrim | null (all)
  const limit  = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'))

  if (!teamId) return apiError('teamId required')

  const conditions = [eq(matchHistory.teamId, teamId)]
  if (type) conditions.push(eq(matchHistory.type, type))

  const rows = await db
    .select({
      id:          matchHistory.id,
      type:        matchHistory.type,
      teamId:      matchHistory.teamId,
      placement:   matchHistory.placement,
      kills:       matchHistory.kills,
      points:      matchHistory.points,
      prizeEarned: matchHistory.prizeEarned,
      playerStats: matchHistory.playerStats,
      playedAt:    matchHistory.playedAt,
      tournamentId: matchHistory.tournamentId,
      scrimId:     matchHistory.scrimId,
      tournamentName: tournaments.name,
      scrimName:   scrims.name,
    })
    .from(matchHistory)
    .leftJoin(tournaments, eq(tournaments.id, matchHistory.tournamentId))
    .leftJoin(scrims, eq(scrims.id, matchHistory.scrimId))
    .where(and(...conditions))
    .orderBy(desc(matchHistory.playedAt))
    .limit(limit)
    .offset(offset)

  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(matchHistory)
    .where(and(...conditions))

  return apiSuccess({ matches: rows, total: Number(total) })
}

export async function POST(request: NextRequest) {
  const authUser = await requireAdmin(request)
  if (!authUser) return apiError('Unauthorized', 401)

  const body = await request.json() as {
    type: string; teamId: number; tournamentId?: number; scrimId?: number
    placement?: number; kills?: number; points?: number; prizeEarned?: number
    playerStats?: unknown[]; playedAt?: string
  }

  if (!body.type || !body.teamId) return apiError('type and teamId required')

  const [match] = await db.insert(matchHistory).values({
    type:         body.type,
    teamId:       body.teamId,
    tournamentId: body.tournamentId,
    scrimId:      body.scrimId,
    placement:    body.placement,
    kills:        body.kills || 0,
    points:       body.points || 0,
    prizeEarned:  body.prizeEarned || 0,
    playerStats:  body.playerStats,
    playedAt:     body.playedAt ? new Date(body.playedAt) : new Date(),
  }).returning()

  return apiSuccess({ match })
}
