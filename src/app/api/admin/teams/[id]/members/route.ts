import { NextRequest } from 'next/server'
import { db } from '@/db'
import { teams, teamMembers, users } from '@/db/schema'
import { eq, and, count } from 'drizzle-orm'
import { requireAdmin, apiSuccess, apiError } from '@/lib/api'

/**
 * POST /api/admin/teams/[id]/members
 * Body: { userId: number }
 * Adds a user to the team. The user must not already be in another team.
 *
 * DELETE /api/admin/teams/[id]/members
 * Body: { userId: number }
 * Removes a user from the team. Captain cannot be removed — transfer first.
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const { id } = await params
  const teamId = parseInt(id)
  if (isNaN(teamId)) return apiError('Invalid team ID', 400)

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return apiError('Team not found', 404)

  const body   = await request.json()
  const userId = parseInt(body.userId)
  if (isNaN(userId)) return apiError('Invalid userId', 400)

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) return apiError('User not found', 404)

  // Check user is not already in a team
  const [existingMembership] = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
    .limit(1)
  if (existingMembership) return apiError('User is already in a team', 409)

  // Max 6 members
  const [{ memberCount }] = await db
    .select({ memberCount: count() })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId))
  if (Number(memberCount) >= 6) return apiError('Team is full (max 6 members)', 400)

  await db.insert(teamMembers).values({ teamId, userId })

  return apiSuccess({ message: `User added to team` })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const { id } = await params
  const teamId = parseInt(id)
  if (isNaN(teamId)) return apiError('Invalid team ID', 400)

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return apiError('Team not found', 404)

  const body   = await request.json()
  const userId = parseInt(body.userId)
  if (isNaN(userId)) return apiError('Invalid userId', 400)

  if (userId === team.captainId) {
    return apiError('Cannot remove captain. Transfer captaincy first.', 400)
  }

  const [membership] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1)
  if (!membership) return apiError('User is not in this team', 404)

  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))

  // Revert role to player if they had assistant
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (user && user.role === 'assistant') {
    await db.update(users).set({ role: 'player' }).where(eq(users.id, userId))
  }

  return apiSuccess({ message: 'Member removed from team' })
}
