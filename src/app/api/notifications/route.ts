import { NextRequest } from 'next/server'
import { db } from '@/db'
import { notifications } from '@/db/schema'
import { eq, and, desc, count } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError, paginate } from '@/lib/api'

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const unreadOnly = searchParams.get('unread') === 'true'
  const { limit: take, offset, page: pg } = paginate(page, 20)

  const conditions = unreadOnly
    ? and(eq(notifications.userId, auth.userId), eq(notifications.isRead, false))
    : eq(notifications.userId, auth.userId)

  const list = await db.select().from(notifications)
    .where(conditions)
    .orderBy(desc(notifications.createdAt))
    .limit(take)
    .offset(offset)

  const [{ unreadCount }] = await db.select({ unreadCount: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, auth.userId), eq(notifications.isRead, false)))

  return apiSuccess({ notifications: list, unreadCount, pagination: { page: pg, limit: take } })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const body = await request.json()
  const { notificationId, markAllRead } = body

  if (markAllRead) {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, auth.userId))
    return apiSuccess({ message: 'All notifications marked as read' })
  }

  if (notificationId) {
    await db.update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, auth.userId)))
    return apiSuccess({ message: 'Notification marked as read' })
  }

  return apiError('notificationId or markAllRead required', 400)
}
