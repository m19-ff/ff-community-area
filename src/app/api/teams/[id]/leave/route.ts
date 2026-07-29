import { NextRequest } from 'next/server'
import { db } from '@/db'
import { teams, teamMembers, users, notifications } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError } from '@/lib/api'
import { syncTeamPoints } from '@/lib/teamPoints'

/**
 * POST /api/teams/[id]/leave
 *
 * Allows a non-captain member to leave their team.
 * Team points are re-synced automatically (the leaving member's wallet
 * balance is subtracted from the total).
 * Captains cannot leave — they must delete the team instead.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const { id } = await params
  const teamId = parseInt(id)

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return apiError('Team not found', 404)

  // Captain cannot leave — must delete the team
  if (team.captainId === auth.userId) {
    return apiError('Captains cannot leave their own team. Delete the team instead.', 403)
  }

  // Confirm the user is actually a member
  const [membership] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, auth.userId)))
    .limit(1)

  if (!membership) return apiError('You are not a member of this team', 400)

  // Remove from team
  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, auth.userId)))

  // Reset role back to player
  await db.update(users).set({ role: 'player' }).where(eq(users.id, auth.userId))

  // Re-sync team points: this member's wallet balance is no longer included
  await syncTeamPoints(teamId)

  // Notify captain
  const [leavingUser] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1)
  await db.insert(notifications).values({
    userId: team.captainId,
    type: 'general',
    title: 'Player Left',
    body: `${leavingUser?.gameName || 'A player'} has left your team ${team.name}.`,
    data: { teamId, userId: auth.userId },
  })

  return apiSuccess({ message: `You have left ${team.name}` })
}
