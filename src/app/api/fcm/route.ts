import { NextRequest } from 'next/server'
import { db } from '@/db'
import { fcmTokens } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError } from '@/lib/api'
import { registerFcmToken } from '@/lib/fcm'
import { rateLimit, getClientIp, sanitizeString } from '@/lib/security'

// POST /api/fcm — register or refresh FCM token
export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { max: 20, windowSeconds: 60 })
  if (limited) return limited

  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const body = await request.json()
  const token    = sanitizeString(body.token, 500)
  const platform = sanitizeString(body.platform || 'android', 20)
  const deviceId = body.deviceId ? sanitizeString(body.deviceId, 255) : undefined

  if (!token) return apiError('FCM token is required', 400)
  if (!['android', 'web', 'ios'].includes(platform)) return apiError('Invalid platform', 400)

  await registerFcmToken(auth.userId, token, platform, deviceId)

  return apiSuccess({ message: 'FCM token registered' })
}

// DELETE /api/fcm — unregister FCM token on logout
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const body = await request.json().catch(() => ({}))
  const token = sanitizeString(body.token || '', 500)

  if (token) {
    await db.update(fcmTokens)
      .set({ isActive: false })
      .where(and(eq(fcmTokens.token, token), eq(fcmTokens.userId, auth.userId)))
  } else {
    // Deactivate all tokens for this user (logout all devices)
    await db.update(fcmTokens)
      .set({ isActive: false })
      .where(eq(fcmTokens.userId, auth.userId))
  }

  return apiSuccess({ message: 'FCM token deregistered' })
}
