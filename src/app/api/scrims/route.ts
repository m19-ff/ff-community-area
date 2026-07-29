import { NextRequest } from 'next/server'
import { db } from '@/db'
import { scrims, scrimRegistrations, users } from '@/db/schema'
import { eq, desc, count, gte } from 'drizzle-orm'
import { requireAdmin, apiSuccess, apiError, paginate } from '@/lib/api'
import { sendPushToUsers } from '@/lib/fcm'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const upcoming = searchParams.get('upcoming')
  const { limit: take, offset, page: pg } = paginate(page, limit)

  const conditions = upcoming ? gte(scrims.scheduledAt, new Date()) : undefined

  const list = await db.select({
    id: scrims.id,
    name: scrims.name,
    scheduledAt: scrims.scheduledAt,
    mode: scrims.mode,
    maxTeams: scrims.maxTeams,
    status: scrims.status,
    createdAt: scrims.createdAt,
    teamsRegistered: count(scrimRegistrations.id),
  })
    .from(scrims)
    .leftJoin(scrimRegistrations, eq(scrims.id, scrimRegistrations.scrimId))
    .where(conditions)
    .groupBy(scrims.id)
    .orderBy(desc(scrims.scheduledAt))
    .limit(take)
    .offset(offset)

  const [{ total }] = await db.select({ total: count() }).from(scrims).where(conditions)

  return apiSuccess({
    scrims: list,
    pagination: { page: pg, limit: take, total, pages: Math.ceil(total / take) },
  })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  try {
    const body = await request.json()
    const { name, scheduledAt, mode, maxTeams, roomId, roomPassword, roomRevealAt } = body

    if (!name || !scheduledAt || !mode) return apiError('Name, scheduledAt, and mode required', 400)

    const [scrim] = await db.insert(scrims).values({
      name: name.trim(),
      scheduledAt: new Date(scheduledAt),
      mode,
      maxTeams: maxTeams || 16,
      roomId: roomId || null,
      roomPassword: roomPassword || null,
      roomRevealAt: roomRevealAt ? new Date(roomRevealAt) : null,
      createdBy: admin.userId,
    }).returning()

    // Push notify all active users about new scrim
    const allUsers = await db.select({ id: users.id }).from(users).where(eq(users.isBanned, false))
    void sendPushToUsers({
      userIds: allUsers.map(u => u.id),
      payload: {
        title: '⚔️ New Scrim!',
        body:  `${scrim.name} — Register now!`,
        data:  { deepLink: '/scrims', scrimId: String(scrim.id) },
      },
      notifType: 'scrim_created',
      notifData: { scrimId: scrim.id, deepLink: '/scrims' },
    })

    return apiSuccess({ scrim }, 201)
  } catch (error) {
    console.error('[scrims POST]', error)
    return apiError('Failed to create scrim', 500)
  }
}
