import { NextRequest } from 'next/server'
import { db } from '@/db'
import { notifications } from '@/db/schema'
import { eq, and, desc, count, like, or, ilike } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError, paginate } from '@/lib/api'
import { rateLimit } from '@/lib/security'

// ── GET /api/notifications ─────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const { searchParams } = new URL(request.url)
  const page      = parseInt(searchParams.get('page') || '1')
  const unreadOnly = searchParams.get('unread') === 'true'
  const category   = searchParams.get('category') || ''  // notification type filter
  const search     = searchParams.get('search') || ''
  const { limit: take, offset, page: pg } = paginate(page, 20)

  // Build conditions
  const conditions = [eq(notifications.userId, auth.userId)]
  if (unreadOnly) conditions.push(eq(notifications.isRead, false))
  if (category && category !== 'all') {
    conditions.push(eq(notifications.type, category as typeof notifications.type._.data))
  }
  if (search.trim()) {
    conditions.push(
      or(
        ilike(notifications.title, `%${search.trim()}%`),
        ilike(notifications.body,  `%${search.trim()}%`),
      )!
    )
  }

  const where = and(...conditions)

  const [list, [{ unreadCount }, { total }]] = await Promise.all([
    db.select().from(notifications)
      .where(where)
      .orderBy(desc(notifications.createdAt))
      .limit(take)
      .offset(offset),
    Promise.all([
      db.select({ unreadCount: count() }).from(notifications)
        .where(and(eq(notifications.userId, auth.userId), eq(notifications.isRead, false)))
        .then(r => r[0]),
      db.select({ total: count() }).from(notifications)
        .where(where)
        .then(r => r[0]),
    ]),
  ])

  return apiSuccess({
    notifications: list,
    unreadCount,
    pagination: { page: pg, limit: take, total, pages: Math.ceil(total / take) },
  })
}

// ── PATCH /api/notifications — mark read ──────────────────────────────────────
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

// ── DELETE /api/notifications — delete one or all ─────────────────────────────
export async function DELETE(request: NextRequest) {
  const limited = await rateLimit(request, { max: 30, windowSeconds: 60 })
  if (limited) return limited

  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const all = searchParams.get('all') === 'true'

  if (all) {
    await db.delete(notifications).where(eq(notifications.userId, auth.userId))
    return apiSuccess({ message: 'All notifications deleted' })
  }

  if (id) {
    const nid = parseInt(id)
    if (isNaN(nid)) return apiError('Invalid notification ID', 400)
    await db.delete(notifications)
      .where(and(eq(notifications.id, nid), eq(notifications.userId, auth.userId)))
    return apiSuccess({ message: 'Notification deleted' })
  }

  return apiError('id or all=true required', 400)
}
