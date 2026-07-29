import { NextRequest } from 'next/server'
import { db } from '@/db'
import { matchRoomLogs, tournaments } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAdmin, apiSuccess, apiError, paginate } from '@/lib/api'

/**
 * GET /api/admin/match-logs
 * Returns paginated match room notification history across all tournaments,
 * or filtered by tournamentId query param.
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const { searchParams } = new URL(request.url)
  const page        = parseInt(searchParams.get('page')         || '1')
  const tournIdStr  = searchParams.get('tournamentId')

  const { limit: take, offset } = paginate(page, 50)

  const rows = await db
    .select({
      id:             matchRoomLogs.id,
      matchId:        matchRoomLogs.matchId,
      tournamentId:   matchRoomLogs.tournamentId,
      groupId:        matchRoomLogs.groupId,
      groupName:      matchRoomLogs.groupName,
      sentBy:         matchRoomLogs.sentBy,
      sentByName:     matchRoomLogs.sentByName,
      roomId:         matchRoomLogs.roomId,
      roomPassword:   matchRoomLogs.roomPassword,
      recipientCount: matchRoomLogs.recipientCount,
      sentAt:         matchRoomLogs.sentAt,
      tournamentName: tournaments.name,
    })
    .from(matchRoomLogs)
    .leftJoin(tournaments, eq(matchRoomLogs.tournamentId, tournaments.id))
    .where(tournIdStr ? eq(matchRoomLogs.tournamentId, parseInt(tournIdStr)) : undefined)
    .orderBy(desc(matchRoomLogs.sentAt))
    .limit(take)
    .offset(offset)

  return apiSuccess({ logs: rows, pagination: { page, limit: take } })
}
