import { NextRequest } from 'next/server'
import { db } from '@/db'
import { tournaments, tournamentTeams, teams, teamMembers, users, wallets, transactions, notifications } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, requireAdmin, apiSuccess, apiError } from '@/lib/api'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tournId = parseInt(id)

  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tournId)).limit(1)
  if (!t) return apiError('Tournament not found', 404)

  const registeredTeams = await db.select({
    id: tournamentTeams.id,
    status: tournamentTeams.status,
    placement: tournamentTeams.placement,
    registeredAt: tournamentTeams.registeredAt,
    team: {
      id: teams.id,
      name: teams.name,
      logo: teams.logo,
      points: teams.points,
    },
  })
    .from(tournamentTeams)
    .leftJoin(teams, eq(tournamentTeams.teamId, teams.id))
    .where(eq(tournamentTeams.tournamentId, tournId))

  return apiSuccess({ tournament: { ...t, registeredTeams } })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)
  const { id } = await params
  const tournId = parseInt(id)

  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tournId)).limit(1)
  if (!t) return apiError('Tournament not found', 404)

  const body = await request.json()
  const updates: Partial<typeof tournaments.$inferInsert> = {}

  if (body.name) updates.name = body.name.trim()
  if (body.type) updates.type = body.type
  if (body.banner !== undefined) updates.banner = body.banner
  if (body.registrationCost !== undefined) updates.registrationCost = body.registrationCost
  if (body.prizePool !== undefined) updates.prizePool = body.prizePool
  if (body.prizeDistribution !== undefined) updates.prizeDistribution = body.prizeDistribution
  if (body.description !== undefined) updates.description = body.description
  if (body.rules !== undefined) updates.rules = body.rules
  if (body.maxTeams !== undefined) updates.maxTeams = body.maxTeams
  if (body.registrationDeadline) updates.registrationDeadline = new Date(body.registrationDeadline)
  if (body.startDate) updates.startDate = new Date(body.startDate)
  if (body.endDate) updates.endDate = new Date(body.endDate)
  if (body.status) updates.status = body.status
  updates.updatedAt = new Date()

  const [updated] = await db.update(tournaments).set(updates).where(eq(tournaments.id, tournId)).returning()

  // If publishing, notify all users
  if (body.status === 'published' && t.status !== 'published') {
    // Could batch-notify here; omitted for brevity
  }

  return apiSuccess({ tournament: updated })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)
  const { id } = await params
  const tournId = parseInt(id)

  await db.delete(tournaments).where(eq(tournaments.id, tournId))
  return apiSuccess({ message: 'Tournament deleted' })
}
