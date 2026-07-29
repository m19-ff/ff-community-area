import { NextRequest } from 'next/server'
import { db } from '@/db'
import { seasons, seasonRankings, users, teams } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { apiSuccess, apiError, requireAuth, requireAdmin } from '@/lib/api'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (id) {
    const [season] = await db.select().from(seasons).where(eq(seasons.id, parseInt(id)))
    if (!season) return apiError('Season not found', 404)

    const rankings = await db
      .select({
        id:           seasonRankings.id,
        rank:         seasonRankings.rank,
        score:        seasonRankings.score,
        wins:         seasonRankings.wins,
        tournaments:  seasonRankings.tournaments,
        prizeEarned:  seasonRankings.prizeEarned,
        rewardClaimed: seasonRankings.rewardClaimed,
        userId:       seasonRankings.userId,
        teamId:       seasonRankings.teamId,
        gameName:     users.gameName,
        profilePicture: users.profilePicture,
        teamName:     teams.name,
        teamLogo:     teams.logo,
      })
      .from(seasonRankings)
      .leftJoin(users, eq(users.id, seasonRankings.userId))
      .leftJoin(teams, eq(teams.id, seasonRankings.teamId))
      .where(eq(seasonRankings.seasonId, parseInt(id)))
      .orderBy(seasonRankings.rank)
      .limit(100)

    return apiSuccess({ season, rankings })
  }

  // List all seasons
  const all = await db.select().from(seasons).orderBy(desc(seasons.startDate)).limit(20)

  // Current active season
  const [active] = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1)

  return apiSuccess({ seasons: all, activeSeason: active || null })
}

export async function POST(request: NextRequest) {
  const authUser = await requireAdmin(request)
  if (!authUser) return apiError('Unauthorized', 401)

  const body = await request.json() as {
    name: string; startDate: string; endDate: string
    rewards?: unknown[]; setActive?: boolean
  }

  if (!body.name || !body.startDate || !body.endDate) {
    return apiError('name, startDate, endDate required')
  }

  // If setting active, deactivate others
  if (body.setActive) {
    await db.update(seasons).set({ isActive: false })
  }

  const [season] = await db.insert(seasons).values({
    name:      body.name,
    startDate: new Date(body.startDate),
    endDate:   new Date(body.endDate),
    rewards:   body.rewards || [],
    isActive:  body.setActive || false,
    createdBy: authUser.userId,
  }).returning()

  return apiSuccess({ season })
}

export async function PATCH(request: NextRequest) {
  const authUser = await requireAdmin(request)
  if (!authUser) return apiError('Unauthorized', 401)

  const body = await request.json() as {
    id: number; name?: string; startDate?: string; endDate?: string
    rewards?: unknown[]; isActive?: boolean; isFinished?: boolean
  }

  if (!body.id) return apiError('id required')

  const updates: Partial<typeof seasons.$inferInsert> = {}
  if (body.name !== undefined)      updates.name = body.name
  if (body.startDate !== undefined) updates.startDate = new Date(body.startDate)
  if (body.endDate !== undefined)   updates.endDate = new Date(body.endDate)
  if (body.rewards !== undefined)   updates.rewards = body.rewards
  if (body.isFinished !== undefined) updates.isFinished = body.isFinished

  // Activate: deactivate others first
  if (body.isActive === true) {
    await db.update(seasons).set({ isActive: false })
    updates.isActive = true
  } else if (body.isActive === false) {
    updates.isActive = false
  }

  const [updated] = await db.update(seasons).set(updates).where(eq(seasons.id, body.id)).returning()
  return apiSuccess({ season: updated })
}
