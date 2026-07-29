import { NextRequest } from 'next/server'
import { db } from '@/db'
import { matchRoomLogs, tournaments } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAdmin, apiSuccess, apiError, paginate } from '@/lib/api'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  try {
    const { searchParams } = new URL(request.url)
    const page       = parseInt(searchParams.get('page') || '1')
    const tournIdStr = searchParams.get('tournamentId')

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
  } catch (error) {
    console.error('[GET /admin/match-logs]', error)
    return apiError('Failed to load match logs', 500)
  }
}
