import { NextRequest } from 'next/server'
import { db } from '@/db'
import { scrims, scrimRegistrations } from '@/db/schema'
import { eq, count } from 'drizzle-orm'
import { requireAdmin, apiSuccess, apiError } from '@/lib/api'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const scrimId = parseInt(id)
  if (isNaN(scrimId)) return apiError('Invalid ID', 400)

  const [row] = await db.select({
    id: scrims.id,
    name: scrims.name,
    scheduledAt: scrims.scheduledAt,
    mode: scrims.mode,
    maxTeams: scrims.maxTeams,
    status: scrims.status,
    roomId: scrims.roomId,
    roomPassword: scrims.roomPassword,
    roomRevealAt: scrims.roomRevealAt,
    createdAt: scrims.createdAt,
    teamsRegistered: count(scrimRegistrations.id),
  })
    .from(scrims)
    .leftJoin(scrimRegistrations, eq(scrims.id, scrimRegistrations.scrimId))
    .where(eq(scrims.id, scrimId))
    .groupBy(scrims.id)
    .limit(1)

  if (!row) return apiError('Scrim not found', 404)
  return apiSuccess({ scrim: row })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const { id } = await params
  const scrimId = parseInt(id)
  if (isNaN(scrimId)) return apiError('Invalid ID', 400)

  const [existing] = await db.select().from(scrims).where(eq(scrims.id, scrimId)).limit(1)
  if (!existing) return apiError('Scrim not found', 404)

  try {
    const body = await request.json()
    const { name, scheduledAt, mode, maxTeams, status, roomId, roomPassword, roomRevealAt } = body

    const updates: Partial<typeof existing> = {}
    if (name !== undefined) updates.name = name.trim()
    if (scheduledAt !== undefined) updates.scheduledAt = new Date(scheduledAt)
    if (mode !== undefined) updates.mode = mode
    if (maxTeams !== undefined) updates.maxTeams = Number(maxTeams)
    if (status !== undefined) updates.status = status
    if (roomId !== undefined) updates.roomId = roomId || null
    if (roomPassword !== undefined) updates.roomPassword = roomPassword || null
    if (roomRevealAt !== undefined) updates.roomRevealAt = roomRevealAt ? new Date(roomRevealAt) : null

    const [updated] = await db.update(scrims).set(updates).where(eq(scrims.id, scrimId)).returning()
    return apiSuccess({ scrim: updated })
  } catch (error) {
    console.error('[scrim PATCH]', error)
    return apiError('Failed to update scrim', 500)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const { id } = await params
  const scrimId = parseInt(id)
  if (isNaN(scrimId)) return apiError('Invalid ID', 400)

  const [existing] = await db.select().from(scrims).where(eq(scrims.id, scrimId)).limit(1)
  if (!existing) return apiError('Scrim not found', 404)

  // FK cascade on scrimRegistrations handles child rows automatically
  await db.delete(scrims).where(eq(scrims.id, scrimId))

  return apiSuccess({ message: 'Scrim deleted' })
}
