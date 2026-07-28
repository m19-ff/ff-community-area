import { NextRequest } from 'next/server'
import { db } from '@/db'
import { teams, teamMembers, users } from '@/db/schema'
import { eq, like, desc, sql, count } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError, paginate } from '@/lib/api'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const search = searchParams.get('search') || ''
  const { limit: take, offset, page: pg } = paginate(page, limit)

  const conditions = search ? like(teams.name, `%${search}%`) : undefined

  const teamList = await db.select({
    id: teams.id,
    name: teams.name,
    logo: teams.logo,
    points: teams.points,
    captainId: teams.captainId,
    totalTournaments: teams.totalTournaments,
    createdAt: teams.createdAt,
    memberCount: count(teamMembers.id),
  })
    .from(teams)
    .leftJoin(teamMembers, eq(teams.id, teamMembers.teamId))
    .where(conditions)
    .groupBy(teams.id)
    .orderBy(desc(teams.points))
    .limit(take)
    .offset(offset)

  const [{ total }] = await db.select({ total: count() }).from(teams).where(conditions)

  return apiSuccess({
    teams: teamList,
    pagination: { page: pg, limit: take, total, pages: Math.ceil(total / take) },
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  try {
    // Check if user already in a team
    const existing = await db.select().from(teamMembers).where(eq(teamMembers.userId, auth.userId)).limit(1)
    if (existing.length > 0) return apiError('You are already in a team', 400)

    const body = await request.json()
    const { name, logo } = body
    if (!name || name.trim().length < 3) return apiError('Team name must be at least 3 characters', 400)

    // Check name uniqueness
    const nameTaken = await db.select().from(teams).where(eq(teams.name, name.trim())).limit(1)
    if (nameTaken.length > 0) return apiError('Team name already taken', 409)

    const [team] = await db.insert(teams).values({
      name: name.trim(),
      logo: logo || null,
      captainId: auth.userId,
    }).returning()

    await db.insert(teamMembers).values({ teamId: team.id, userId: auth.userId })

    // Update user role to captain
    await db.update(users).set({ role: 'captain' }).where(eq(users.id, auth.userId))

    return apiSuccess({ team }, 201)
  } catch (error) {
    console.error('[teams POST]', error)
    return apiError('Failed to create team', 500)
  }
}
