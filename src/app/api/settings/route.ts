import { NextRequest } from 'next/server'
import { db } from '@/db'
import { settings, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { apiSuccess, apiError, requireAuth, requireAdmin } from '@/lib/api'
import { hashPassword } from '@/lib/password'
import { verifyPassword } from '@/lib/password'

export async function GET(request: NextRequest) {
  // Public settings (non-sensitive)
  const all = await db.select().from(settings)
  const map = Object.fromEntries(all.map(s => [s.key, s.value]))
  return apiSuccess({
    settings: {
      ad_reward_points:  map.ad_reward_points  || '50',
      max_ads_per_day:   map.max_ads_per_day   || '3',
      points_per_usd:    map.points_per_usd    || '100',
      min_withdrawal:    map.min_withdrawal    || '500',
      platform_name:     map.platform_name     || 'FF Community Arena',
    }
  })
}

export async function POST(request: NextRequest) {
  const authUser = await requireAuth(request)
  if (!authUser) return apiError('Unauthorized', 401)

  const body = await request.json() as {
    action: string
    // change_password
    currentPassword?: string; newPassword?: string
    // delete_account
    password?: string
    // admin settings
    key?: string; value?: string
  }

  if (body.action === 'change_password') {
    const [user] = await db.select().from(users).where(eq(users.id, authUser.userId))
    if (!user) return apiError('User not found', 404)

    const valid = await verifyPassword(body.currentPassword || '', user.password)
    if (!valid) return apiError('Current password is incorrect', 400)

    if (!body.newPassword || body.newPassword.length < 6) {
      return apiError('New password must be at least 6 characters', 400)
    }

    const hashed = await hashPassword(body.newPassword)
    await db.update(users).set({ password: hashed, updatedAt: new Date() }).where(eq(users.id, authUser.userId))
    return apiSuccess({ message: 'Password changed successfully' })
  }

  if (body.action === 'delete_account') {
    const [user] = await db.select().from(users).where(eq(users.id, authUser.userId))
    if (!user) return apiError('User not found', 404)
    const valid = await verifyPassword(body.password || '', user.password)
    if (!valid) return apiError('Incorrect password', 400)

    // Soft delete: ban and anonymize
    await db.update(users).set({
      isBanned: true,
      banReason: 'Account deleted by user',
      email: `deleted_${authUser.userId}_${Date.now()}@deleted.local`,
      gameName: null,
      gameUid: null,
      profilePicture: null,
    }).where(eq(users.id, authUser.userId))

    return apiSuccess({ message: 'Account deleted' })
  }

  // Admin: update a setting key
  if (body.action === 'set_setting') {
    const adminUser = await requireAdmin(request)
    if (!adminUser) return apiError('Admin required', 403)
    if (!body.key || body.value === undefined) return apiError('key and value required')

    await db.insert(settings).values({ key: body.key, value: body.value })
      .onConflictDoUpdate({ target: [settings.key], set: { value: body.value, updatedAt: new Date() } })

    return apiSuccess({ message: 'Setting updated' })
  }

  return apiError('Unknown action', 400)
}
