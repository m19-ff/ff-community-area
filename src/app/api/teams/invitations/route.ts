import { NextRequest } from 'next/server'
import { db } from '@/db'
import { invitations, teams, users, teamMembers, notifications } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError } from '@/lib/api'
import { syncTeamPoints } from '@/lib/teamPoints'

// Get my invitations
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const myInvitations = await db.select({
    id: invitations.id,
    status: invitations.status,
    createdAt: invitations.createdAt,
    expiresAt: invitations.expiresAt,
    team: {
      id: teams.id,
      name: teams.name,
      logo: teams.logo,
      points: teams.points,
    },
  })
    .from(invitations)
    .leftJoin(teams, eq(invitations.teamId, teams.id))
    .where(and(eq(invitations.invitedUserId, auth.userId), eq(invitations.status, 'pending')))

  return apiSuccess({ invitations: myInvitations })
}

// Accept or decline invitation
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const body = await request.json()
  const { invitationId, action } = body
  if (!invitationId || !['accept', 'decline'].includes(action)) {
    return apiError('invitationId and action (accept/decline) required', 400)
  }

  const [inv] = await db.select().from(invitations)
    .where(and(eq(invitations.id, invitationId), eq(invitations.invitedUserId, auth.userId)))
    .limit(1)

  if (!inv) return apiError('Invitation not found', 404)
  if (inv.status !== 'pending') return apiError('Invitation already responded', 400)
  if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) {
    await db.update(invitations).set({ status: 'expired' }).where(eq(invitations.id, inv.id))
    return apiError('Invitation has expired', 400)
  }

  if (action === 'decline') {
    await db.update(invitations).set({ status: 'declined' }).where(eq(invitations.id, inv.id))
    return apiSuccess({ message: 'Invitation declined' })
  }

  // Accept
  const inTeam = await db.select().from(teamMembers).where(eq(teamMembers.userId, auth.userId)).limit(1)
  if (inTeam.length > 0) return apiError('You are already in a team', 400)

  const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, inv.teamId))
  if (members.length >= 6) return apiError('Team is full', 400)

  await db.update(invitations).set({ status: 'accepted' }).where(eq(invitations.id, inv.id))
  await db.insert(teamMembers).values({ teamId: inv.teamId, userId: auth.userId })

  const [team] = await db.select().from(teams).where(eq(teams.id, inv.teamId)).limit(1)

  // Notify captain
  await db.insert(notifications).values({
    userId: team.captainId,
    type: 'join_request',
    title: 'Player Joined',
    body: `A player accepted your invitation to join ${team.name}`,
    data: { teamId: inv.teamId, userId: auth.userId },
  })

  // Sync team points: add the new member's wallet balance to the total
  await syncTeamPoints(inv.teamId)

  return apiSuccess({ message: 'Joined team successfully', teamId: inv.teamId })
}
