import { NextRequest } from 'next/server'
import { db } from '@/db'
import {
  tournaments, tournamentGroups, tournamentGroupTeams,
  tournamentMatches, matchRoomLogs, teamMembers,
} from '@/db/schema'
import { eq, and, inArray, desc } from 'drizzle-orm'
import { requireAuth, requireAdmin, apiSuccess, apiError } from '@/lib/api'
import { sendPushToUsers } from '@/lib/fcm'

// ── GET /api/tournaments/[id]/matches ─────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const tournId = parseInt(id)
    if (isNaN(tournId)) return apiError('Invalid tournament ID', 400)

    const [tournament] = await db
      .select({ id: tournaments.id, name: tournaments.name })
      .from(tournaments)
      .where(eq(tournaments.id, tournId))
      .limit(1)
    if (!tournament) return apiError('Tournament not found', 404)

    const auth    = await requireAuth(request)
    const isAdmin = auth && ['admin', 'superadmin', 'assistant'].includes(auth.role)

    const matches = await db
      .select({
        id:             tournamentMatches.id,
        tournamentId:   tournamentMatches.tournamentId,
        groupId:        tournamentMatches.groupId,
        name:           tournamentMatches.name,
        roomId:         tournamentMatches.roomId,
        roomPassword:   tournamentMatches.roomPassword,
        matchStartTime: tournamentMatches.matchStartTime,
        roomRevealAt:   tournamentMatches.roomRevealAt,
        status:         tournamentMatches.status,
        roomNotifiedAt: tournamentMatches.roomNotifiedAt,
        createdAt:      tournamentMatches.createdAt,
        groupName:      tournamentGroups.name,
      })
      .from(tournamentMatches)
      .leftJoin(tournamentGroups, eq(tournamentMatches.groupId, tournamentGroups.id))
      .where(eq(tournamentMatches.tournamentId, tournId))
      .orderBy(desc(tournamentMatches.matchStartTime))

    if (isAdmin) {
      return apiSuccess({ matches })
    }

    if (!auth) return apiSuccess({ matches: [] })

    const [membership] = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, auth.userId))
      .limit(1)

    if (!membership) return apiSuccess({ matches: [] })

    const [groupAssignment] = await db
      .select({ groupId: tournamentGroupTeams.groupId })
      .from(tournamentGroupTeams)
      .where(and(
        eq(tournamentGroupTeams.tournamentId, tournId),
        eq(tournamentGroupTeams.teamId, membership.teamId),
      ))
      .limit(1)

    if (!groupAssignment) return apiSuccess({ matches: [], myGroup: null })

    const now = new Date()
    const myMatches = matches
      .filter(m => m.groupId === groupAssignment.groupId)
      .map(m => {
        const revealed = m.roomRevealAt ? new Date(m.roomRevealAt) <= now : false
        return {
          ...m,
          roomId:       revealed ? m.roomId       : null,
          roomPassword: revealed ? m.roomPassword : null,
          revealed,
        }
      })

    const [myGroup] = await db
      .select({ id: tournamentGroups.id, name: tournamentGroups.name })
      .from(tournamentGroups)
      .where(eq(tournamentGroups.id, groupAssignment.groupId))
      .limit(1)

    return apiSuccess({ matches: myMatches, myGroup: myGroup ?? null })
  } catch (error) {
    console.error('[GET /tournaments/[id]/matches]', error)
    return apiError('Failed to load matches', 500)
  }
}

// ── POST /api/tournaments/[id]/matches ───────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const { id } = await params
  const tournId = parseInt(id)
  if (isNaN(tournId)) return apiError('Invalid tournament ID', 400)

  try {
    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournId))
      .limit(1)
    if (!tournament) return apiError('Tournament not found', 404)

    const body = await request.json()
    const { name, groupId, roomId, roomPassword, matchStartTime, roomRevealAt, status } = body

    let resolvedGroupId: number | null = null
    if (groupId) {
      resolvedGroupId = parseInt(groupId)
      if (isNaN(resolvedGroupId)) return apiError('Invalid groupId', 400)
      const [g] = await db
        .select()
        .from(tournamentGroups)
        .where(and(eq(tournamentGroups.id, resolvedGroupId), eq(tournamentGroups.tournamentId, tournId)))
        .limit(1)
      if (!g) return apiError('Group not found in this tournament', 404)
    }

    const [match] = await db.insert(tournamentMatches).values({
      tournamentId:   tournId,
      groupId:        resolvedGroupId,
      name:           name || null,
      roomId:         roomId || null,
      roomPassword:   roomPassword || null,
      matchStartTime: matchStartTime ? new Date(matchStartTime) : null,
      roomRevealAt:   roomRevealAt   ? new Date(roomRevealAt)   : null,
      status:         status || 'upcoming',
      createdBy:      admin.userId,
    }).returning()

    return apiSuccess({ match }, 201)
  } catch (error) {
    console.error('[POST /tournaments/[id]/matches]', error)
    return apiError('Failed to create match', 500)
  }
}

// ── Helper: send room reveal for a single match ───────────────────────────────
export async function sendMatchRoomNotification({
  match,
  tournamentName,
  sentByUserId,
  sentByName,
}: {
  match: typeof tournamentMatches.$inferSelect & { groupName?: string | null }
  tournamentName: string
  sentByUserId: number | null
  sentByName: string
}): Promise<number> {
  if (!match.groupId) return 0

  // Get all teams in this group
  const groupTeams = await db
    .select({ teamId: tournamentGroupTeams.teamId })
    .from(tournamentGroupTeams)
    .where(and(
      eq(tournamentGroupTeams.tournamentId, match.tournamentId),
      eq(tournamentGroupTeams.groupId, match.groupId),
    ))

  if (groupTeams.length === 0) return 0

  const teamIds = groupTeams.map(gt => gt.teamId)

  // Fetch all member IDs for all teams in one query
  const allMembers = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(inArray(teamMembers.teamId, teamIds))

  const uniqueIds = [...new Set(allMembers.map(m => m.userId))]
  if (uniqueIds.length === 0) return 0

  const groupName = match.groupName ?? `Group ${match.groupId}`

  await sendPushToUsers({
    userIds: uniqueIds,
    payload: {
      title: `🎮 Room Revealed — Group ${groupName}`,
      body:  `Tournament: ${tournamentName}\nRoom ID: ${match.roomId ?? '—'}${match.roomPassword ? ` | Pass: ${match.roomPassword}` : ''}`,
      data:  {
        deepLink:     'tournament-detail',
        tournamentId: String(match.tournamentId),
        matchId:      String(match.id),
        roomId:       match.roomId ?? '',
        roomPassword: match.roomPassword ?? '',
        groupName,
      },
    },
    notifType: 'tournament_reminder',
    notifData: {
      tournamentId: match.tournamentId,
      matchId:      match.id,
      roomId:       match.roomId,
      roomPassword: match.roomPassword,
      groupName,
      deepLink: 'tournament-detail',
    },
  })

  await db.insert(matchRoomLogs).values({
    matchId:        match.id,
    tournamentId:   match.tournamentId,
    groupId:        match.groupId,
    groupName,
    sentBy:         sentByUserId ?? null,
    sentByName,
    roomId:         match.roomId,
    roomPassword:   match.roomPassword,
    recipientCount: uniqueIds.length,
    sentAt:         new Date(),
  })

  await db
    .update(tournamentMatches)
    .set({ roomNotifiedAt: new Date(), status: 'room_revealed', updatedAt: new Date() })
    .where(eq(tournamentMatches.id, match.id))

  return uniqueIds.length
}
