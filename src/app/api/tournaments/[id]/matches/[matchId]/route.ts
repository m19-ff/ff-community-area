import { NextRequest } from 'next/server'
import { db } from '@/db'
import {
  tournaments, tournamentGroups, tournamentMatches,
} from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAdmin, apiSuccess, apiError } from '@/lib/api'
import { sendMatchRoomNotification } from '../route'

// ── GET /api/tournaments/[id]/matches/[matchId] ───────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const { id, matchId } = await params
  const tournId  = parseInt(id)
  const matchIdN = parseInt(matchId)
  if (isNaN(tournId) || isNaN(matchIdN)) return apiError('Invalid IDs', 400)

  const [match] = await db
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
    .where(and(
      eq(tournamentMatches.id, matchIdN),
      eq(tournamentMatches.tournamentId, tournId),
    ))
    .limit(1)

  if (!match) return apiError('Match not found', 404)
  return apiSuccess({ match })
}

// ── PATCH /api/tournaments/[id]/matches/[matchId] ────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const { id, matchId } = await params
  const tournId  = parseInt(id)
  const matchIdN = parseInt(matchId)
  if (isNaN(tournId) || isNaN(matchIdN)) return apiError('Invalid IDs', 400)

  const [match] = await db
    .select()
    .from(tournamentMatches)
    .where(and(
      eq(tournamentMatches.id, matchIdN),
      eq(tournamentMatches.tournamentId, tournId),
    ))
    .limit(1)
  if (!match) return apiError('Match not found', 404)

  const body    = await request.json()
  const { action } = body

  // ── send_room ──────────────────────────────────────────────────────────────
  if (action === 'send_room') {
    const [matchWithGroup] = await db
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
        updatedAt:      tournamentMatches.updatedAt,
        createdBy:      tournamentMatches.createdBy,
        groupName:      tournamentGroups.name,
      })
      .from(tournamentMatches)
      .leftJoin(tournamentGroups, eq(tournamentMatches.groupId, tournamentGroups.id))
      .where(eq(tournamentMatches.id, matchIdN))
      .limit(1)

    if (!matchWithGroup.roomId) return apiError('No Room ID set on this match', 400)
    if (!matchWithGroup.groupId) return apiError('No group assigned to this match', 400)

    const [tournament] = await db
      .select({ name: tournaments.name })
      .from(tournaments)
      .where(eq(tournaments.id, tournId))
      .limit(1)

    const count = await sendMatchRoomNotification({
      match:          matchWithGroup,
      tournamentName: tournament?.name || `Tournament ${tournId}`,
      sentByUserId:   admin.userId,
      sentByName:     String(admin.userId),
    })

    return apiSuccess({ message: `Room revealed to ${count} players` })
  }

  // ── edit match ─────────────────────────────────────────────────────────────
  const updates: Partial<typeof tournamentMatches.$inferInsert> = {}

  if (body.name           !== undefined) updates.name           = body.name || null
  if (body.roomId         !== undefined) updates.roomId         = body.roomId || null
  if (body.roomPassword   !== undefined) updates.roomPassword   = body.roomPassword || null
  if (body.matchStartTime !== undefined) updates.matchStartTime = body.matchStartTime ? new Date(body.matchStartTime) : null
  if (body.roomRevealAt   !== undefined) updates.roomRevealAt   = body.roomRevealAt   ? new Date(body.roomRevealAt)   : null
  if (body.status         !== undefined) updates.status         = body.status

  if (body.groupId !== undefined) {
    const gid = body.groupId ? parseInt(body.groupId) : null
    if (gid) {
      const [g] = await db
        .select()
        .from(tournamentGroups)
        .where(and(eq(tournamentGroups.id, gid), eq(tournamentGroups.tournamentId, tournId)))
        .limit(1)
      if (!g) return apiError('Group not found', 404)
    }
    updates.groupId = gid
  }

  updates.updatedAt = new Date()
  const [updated] = await db
    .update(tournamentMatches)
    .set(updates)
    .where(eq(tournamentMatches.id, matchIdN))
    .returning()

  return apiSuccess({ match: updated })
}

// ── DELETE /api/tournaments/[id]/matches/[matchId] ───────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; matchId: string }> },
) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const { id, matchId } = await params
  const tournId  = parseInt(id)
  const matchIdN = parseInt(matchId)
  if (isNaN(tournId) || isNaN(matchIdN)) return apiError('Invalid IDs', 400)

  await db
    .delete(tournamentMatches)
    .where(and(
      eq(tournamentMatches.id, matchIdN),
      eq(tournamentMatches.tournamentId, tournId),
    ))

  return apiSuccess({ message: 'Match deleted' })
}
