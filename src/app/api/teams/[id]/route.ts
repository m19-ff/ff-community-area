import { NextRequest } from 'next/server'
import { db } from '@/db'
import { teams, teamMembers, users } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError } from '@/lib/api'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const teamId = parseInt(id)

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return apiError('Team not found', 404)

  const members = await db.select({
    id: users.id,
    gameName: users.gameName,
    gameUid: users.gameUid,
    profilePicture: users.profilePicture,
    role: users.role,
    joinedAt: teamMembers.joinedAt,
  })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId))

  const captain = members.find(m => m.id === team.captainId)

  return apiSuccess({ team: { ...team, members, captain } })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)
  const { id } = await params
  const teamId = parseInt(id)

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return apiError('Team not found', 404)
  if (team.captainId !== auth.userId && !['admin', 'superadmin'].includes(auth.role)) {
    return apiError('Only captain can edit team', 403)
  }

  const body = await request.json()
  const updates: Partial<typeof teams.$inferInsert> = {}
  if (body.name) {
    const nameTaken = await db.select().from(teams)
      .where(and(eq(teams.name, body.name.trim()), eq(teams.id, teamId))).limit(1)
    updates.name = body.name.trim()
  }
  if (body.logo !== undefined) updates.logo = body.logo
  updates.updatedAt = new Date()

  const [updated] = await db.update(teams).set(updates).where(eq(teams.id, teamId)).returning()
  return apiSuccess({ team: updated })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)
  const { id } = await params
  const teamId = parseInt(id)

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return apiError('Team not found', 404)
  if (team.captainId !== auth.userId && !['admin', 'superadmin'].includes(auth.role)) {
    return apiError('Only captain can delete team', 403)
  }

  // Fetch members before deletion so we can reset their roles
  const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId))

  // Reset member roles to player — each member keeps their own wallet balance
  // (team.points = sum of member wallets, so there is no separate treasury to split)
  for (const m of members) {
    await db.update(users).set({ role: 'player' }).where(eq(users.id, m.userId))
  }

  await db.delete(teams).where(eq(teams.id, teamId))
  return apiSuccess({ message: 'Team deleted' })
}
