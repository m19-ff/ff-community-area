import { NextRequest } from 'next/server'
import { db } from '@/db'
import { teams, teamMembers, users, invitations, notifications } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError } from '@/lib/api'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)
  const { id } = await params
  const teamId = parseInt(id)

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return apiError('Team not found', 404)
  if (team.captainId !== auth.userId) return apiError('Only captain can invite players', 403)

  const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId))
  if (members.length >= 6) return apiError('Team is full (maximum 6 players)', 400)

  const body = await request.json()
  const { gameUid } = body
  if (!gameUid) return apiError('Game UID required', 400)

  const [target] = await db.select().from(users).where(eq(users.gameUid, gameUid)).limit(1)
  if (!target) return apiError('Player with that Game UID not found', 404)
  if (target.id === auth.userId) return apiError('Cannot invite yourself', 400)

  // Check if already in a team
  const inTeam = await db.select().from(teamMembers).where(eq(teamMembers.userId, target.id)).limit(1)
  if (inTeam.length > 0) return apiError('Player is already in a team', 400)

  // Check existing pending invitation
  const pending = await db.select().from(invitations).where(
    and(eq(invitations.teamId, teamId), eq(invitations.invitedUserId, target.id), eq(invitations.status, 'pending'))
  ).limit(1)
  if (pending.length > 0) return apiError('Invitation already sent to this player', 400)

  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const [inv] = await db.insert(invitations).values({
    teamId,
    invitedUserId: target.id,
    invitedByUserId: auth.userId,
    expiresAt: expiry,
  }).returning()

  // Create notification
  await db.insert(notifications).values({
    userId: target.id,
    type: 'invitation',
    title: 'Team Invitation',
    body: `You have been invited to join team ${team.name}`,
    data: { invitationId: inv.id, teamId, teamName: team.name },
  })

  return apiSuccess({ invitation: inv, message: `Invitation sent to ${target.gameName}` })
}
