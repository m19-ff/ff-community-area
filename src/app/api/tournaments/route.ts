import { NextRequest } from 'next/server'
import { db } from '@/db'
import { tournaments, tournamentTeams, teams } from '@/db/schema'
import { eq, desc, count, and, like } from 'drizzle-orm'
import { requireAuth, requireAdmin, apiSuccess, apiError, paginate } from '@/lib/api'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const status = searchParams.get('status')
  const search = searchParams.get('search') || ''
  const { limit: take, offset, page: pg } = paginate(page, limit)

  const conditions: ReturnType<typeof eq>[] = []
  if (status) conditions.push(eq(tournaments.status, status as typeof tournaments.status._.data))
  // For non-admin, only show published
  const auth = await requireAuth(request)
  if (!auth || !['admin', 'superadmin', 'assistant'].includes(auth.role)) {
    conditions.push(eq(tournaments.status, 'published'))
  }

  const list = await db.select({
    id: tournaments.id,
    name: tournaments.name,
    type: tournaments.type,
    banner: tournaments.banner,
    registrationCost: tournaments.registrationCost,
    prizePool: tournaments.prizePool,
    maxTeams: tournaments.maxTeams,
    registrationDeadline: tournaments.registrationDeadline,
    startDate: tournaments.startDate,
    endDate: tournaments.endDate,
    status: tournaments.status,
    createdAt: tournaments.createdAt,
    teamsRegistered: count(tournamentTeams.id),
  })
    .from(tournaments)
    .leftJoin(tournamentTeams, eq(tournaments.id, tournamentTeams.tournamentId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(tournaments.id)
    .orderBy(desc(tournaments.createdAt))
    .limit(take)
    .offset(offset)

  const [{ total }] = await db.select({ total: count() }).from(tournaments)
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  return apiSuccess({
    tournaments: list,
    pagination: { page: pg, limit: take, total, pages: Math.ceil(total / take) },
  })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  try {
    const body = await request.json()
    const { name, type, banner, registrationCost, prizePool, prizeDistribution,
      description, rules, maxTeams, registrationDeadline, startDate, endDate, status } = body

    if (!name || !type) return apiError('Name and type required', 400)

    const [tournament] = await db.insert(tournaments).values({
      name: name.trim(),
      type,
      banner: banner || null,
      registrationCost: registrationCost || 0,
      prizePool: prizePool || 0,
      prizeDistribution: prizeDistribution || null,
      description: description || null,
      rules: rules || null,
      maxTeams: maxTeams || 16,
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      status: status || 'draft',
      createdBy: admin.userId,
    }).returning()

    return apiSuccess({ tournament }, 201)
  } catch (error) {
    console.error('[tournaments POST]', error)
    return apiError('Failed to create tournament', 500)
  }
}
