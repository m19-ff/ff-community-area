import { NextRequest } from 'next/server'
import { db } from '@/db'
import { invitations, teams, teamMembers, notifications, teamWallets } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError } from '@/lib/api'
import { transferPlayerBalanceToTeam, getTeamWallet, createTeamWallet } from '@/lib/teamWallet'
import { isPrivileged } from '@/lib/roleGuard'

// Get my invitations
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const rows = await db.select({
    id: invitations.id,
    status: invitations.status,
    createdAt: invitations.createdAt,
    expiresAt: invitations.expiresAt,
    team: {
      id: teams.id,
      name: teams.name,
      logo: teams.logo,
      walletBalance: teamWallets.balance,
    },
  })
    .from(invitations)
    .leftJoin(teams, eq(invitations.teamId, teams.id))
    .leftJoin(teamWallets, eq(teams.id, teamWallets.teamId))
    .where(and(eq(invitations.invitedUserId, auth.userId), eq(invitations.status, 'pending')))

  return apiSuccess({ invitations: rows })
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

  // Admin/superadmin accounts cannot accept team invitations
  if (isPrivileged(auth.role)) {
    return apiError('Admin accounts cannot join player teams', 403)
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

  // Auto-create team wallet if missing
  const tw = await getTeamWallet(inv.teamId)
  if (!tw) await createTeamWallet(inv.teamId)

  // Transfer player's personal wallet balance into the team wallet
  await transferPlayerBalanceToTeam(auth.userId, inv.teamId, team.name)

  return apiSuccess({ message: 'Joined team successfully', teamId: inv.teamId })
}
