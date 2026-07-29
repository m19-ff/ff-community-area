import { NextRequest } from 'next/server'
import { db } from '@/db'
import { joinRequests, teams, teamMembers, users } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError } from '@/lib/api'
import { transferPlayerBalanceToTeam, getTeamWallet, createTeamWallet } from '@/lib/teamWallet'
import { sendPushToUsers } from '@/lib/fcm'

// Send join request
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const inTeam = await db.select().from(teamMembers).where(eq(teamMembers.userId, auth.userId)).limit(1)
  if (inTeam.length > 0) return apiError('You are already in a team', 400)

  const body = await request.json()
  const { teamId, message } = body
  if (!teamId) return apiError('teamId required', 400)

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return apiError('Team not found', 404)

  const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId))
  if (members.length >= 6) return apiError('Team is full', 400)

  const pending = await db.select().from(joinRequests).where(
    and(eq(joinRequests.teamId, teamId), eq(joinRequests.userId, auth.userId), eq(joinRequests.status, 'pending'))
  ).limit(1)
  if (pending.length > 0) return apiError('Already sent a join request to this team', 400)

  const [req] = await db.insert(joinRequests).values({
    teamId,
    userId: auth.userId,
    message: message || '',
  }).returning()

  const [player] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1)

  // Push + in-app notification for captain
  void sendPushToUsers({
    userIds: [team.captainId],
    payload: {
      title: '📩 New Join Request',
      body:  `${player.gameName || 'A player'} wants to join your team ${team.name}`,
      data:  { deepLink: '/my-team', requestId: String(req.id), teamId: String(teamId) },
    },
    notifType: 'join_request',
    notifData: { requestId: req.id, teamId, userId: auth.userId, deepLink: '/my-team' },
  })

  return apiSuccess({ request: req, message: 'Join request sent' }, 201)
}

// Get join requests for captain's team
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const [myTeam] = await db.select().from(teams).where(eq(teams.captainId, auth.userId)).limit(1)
  if (!myTeam) return apiError('You are not a captain', 403)

  const requests = await db.select({
    id: joinRequests.id,
    status: joinRequests.status,
    message: joinRequests.message,
    createdAt: joinRequests.createdAt,
    user: {
      id: users.id,
      gameName: users.gameName,
      gameUid: users.gameUid,
      profilePicture: users.profilePicture,
    },
  })
    .from(joinRequests)
    .leftJoin(users, eq(joinRequests.userId, users.id))
    .where(and(eq(joinRequests.teamId, myTeam.id), eq(joinRequests.status, 'pending')))

  return apiSuccess({ requests })
}

// Accept or reject join request
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const body = await request.json()
  const { requestId, action } = body
  if (!requestId || !['accept', 'reject'].includes(action)) {
    return apiError('requestId and action required', 400)
  }

  const [jr] = await db.select().from(joinRequests).where(eq(joinRequests.id, requestId)).limit(1)
  if (!jr) return apiError('Request not found', 404)

  const [team] = await db.select().from(teams).where(eq(teams.id, jr.teamId)).limit(1)
  if (team.captainId !== auth.userId) return apiError('Only captain can respond to requests', 403)

  if (action === 'reject') {
    await db.update(joinRequests).set({ status: 'rejected' }).where(eq(joinRequests.id, requestId))
    return apiSuccess({ message: 'Request rejected' })
  }

  const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, jr.teamId))
  if (members.length >= 6) return apiError('Team is full', 400)

  const inTeam = await db.select().from(teamMembers).where(eq(teamMembers.userId, jr.userId)).limit(1)
  if (inTeam.length > 0) return apiError('Player already in a team', 400)

  await db.update(joinRequests).set({ status: 'accepted' }).where(eq(joinRequests.id, requestId))
  await db.insert(teamMembers).values({ teamId: jr.teamId, userId: jr.userId })

  // Push + in-app notification for accepted player
  void sendPushToUsers({
    userIds: [jr.userId],
    payload: {
      title: '✅ Join Request Accepted!',
      body:  `Your request to join ${team.name} has been accepted!`,
      data:  { deepLink: '/my-team', teamId: String(jr.teamId) },
    },
    notifType: 'registration_accepted',
    notifData: { teamId: jr.teamId, deepLink: '/my-team' },
  })

  // Auto-create team wallet if missing
  const tw = await getTeamWallet(jr.teamId)
  if (!tw) await createTeamWallet(jr.teamId)

  // Transfer player's personal wallet balance into the team wallet
  await transferPlayerBalanceToTeam(jr.userId, jr.teamId, team.name)

  return apiSuccess({ message: 'Player added to team' })
}
