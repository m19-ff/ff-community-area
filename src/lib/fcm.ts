/**
 * FCM Push Notification Service
 *
 * Uses Firebase Admin SDK via HTTP v1 API.
 * Firebase credentials are read from FIREBASE_SERVICE_ACCOUNT_JSON env var
 * (a JSON string of the service account key).
 *
 * Gracefully degrades if credentials are absent — push simply won't fire but
 * in-app notifications still work.
 */

import { db } from '@/db'
import { fcmTokens, notifications } from '@/db/schema'
import { eq, and, inArray } from 'drizzle-orm'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string
  body: string
  data?: Record<string, string>
  imageUrl?: string
}

export interface SendToUsersOptions {
  userIds: number[]
  payload: PushPayload
  // Also persist an in-app notification row for each user
  notifType?: typeof notifications.$inferInsert['type']
  notifData?: Record<string, unknown>
}

// ── Firebase HTTP v1 helpers ──────────────────────────────────────────────────

let _accessToken: { token: string; expiresAt: number } | null = null

async function getFirebaseAccessToken(): Promise<string | null> {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) return null

  // Reuse cached token if valid for another 5 minutes
  if (_accessToken && _accessToken.expiresAt > Date.now() + 300_000) {
    return _accessToken.token
  }

  try {
    const sa = JSON.parse(raw) as {
      client_email: string
      private_key: string
    }

    // Build JWT for service account
    const header  = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const now     = Math.floor(Date.now() / 1000)
    const claims  = base64url(JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
    }))

    const sigInput  = `${header}.${claims}`
    const signature = await signRS256(sigInput, sa.private_key)
    const jwt       = `${sigInput}.${signature}`

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    })
    const json = await res.json() as { access_token?: string; expires_in?: number }
    if (!json.access_token) return null

    _accessToken = {
      token:     json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    }
    return _accessToken.token
  } catch {
    return null
  }
}

function base64url(input: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input).toString('base64url')
  }
  // Web/Edge fallback
  return btoa(unescape(encodeURIComponent(input)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function signRS256(data: string, pemKey: string): Promise<string> {
  // Node.js environment
  if (typeof process !== 'undefined' && process.versions?.node) {
    const { createSign } = await import('crypto')
    const sign = createSign('RSA-SHA256')
    sign.update(data)
    return sign.sign(pemKey, 'base64url')
  }
  // Web Crypto fallback
  const keyData = pemToArrayBuffer(pemKey)
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(data))
  return base64url(String.fromCharCode(...new Uint8Array(sig)))
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '')
  const bin = atob(b64)
  const buf = new ArrayBuffer(bin.length)
  const arr = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return buf
}

// ── Core send function ────────────────────────────────────────────────────────

async function sendFcmMessage(token: string, payload: PushPayload, projectId: string): Promise<boolean> {
  const accessToken = await getFirebaseAccessToken()
  if (!accessToken) return false

  const message: Record<string, unknown> = {
    token,
    notification: {
      title: payload.title,
      body:  payload.body,
      ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        channel_id: 'ff_community_high',
      },
    },
    webpush: {
      notification: {
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
      },
      fcm_options: { link: '/' },
    },
    data: Object.fromEntries(
      Object.entries(payload.data || {}).map(([k, v]) => [k, String(v)])
    ),
  }

  try {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ message }),
      },
    )
    return res.ok
  } catch {
    return false
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Send push + in-app notification to one or more users.
 * Silently no-ops if Firebase is not configured.
 */
export async function sendPushToUsers(opts: SendToUsersOptions): Promise<void> {
  const { userIds, payload, notifType, notifData } = opts
  if (userIds.length === 0) return

  const projectId = process.env.FIREBASE_PROJECT_ID
  const doFcm     = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !!projectId

  // 1. Persist in-app notifications
  if (notifType) {
    await Promise.all(userIds.map(uid =>
      db.insert(notifications).values({
        userId: uid,
        type:   notifType,
        title:  payload.title,
        body:   payload.body,
        data:   notifData || (payload.data as Record<string, unknown>) || null,
        isRead: false,
      }).onConflictDoNothing()
    ))
  }

  if (!doFcm) return

  // 2. Fetch active FCM tokens for these users
  const rows = await db
    .select({ token: fcmTokens.token, userId: fcmTokens.userId })
    .from(fcmTokens)
    .where(and(inArray(fcmTokens.userId, userIds), eq(fcmTokens.isActive, true)))

  if (rows.length === 0) return

  // 3. Send push; deactivate stale tokens
  const staleTokens: string[] = []
  await Promise.allSettled(
    rows.map(async ({ token }) => {
      const ok = await sendFcmMessage(token, payload, projectId!)
      if (!ok) staleTokens.push(token)
    })
  )

  if (staleTokens.length > 0) {
    await db.update(fcmTokens)
      .set({ isActive: false })
      .where(inArray(fcmTokens.token, staleTokens))
  }
}

/**
 * Register / refresh an FCM token for a user.
 */
export async function registerFcmToken(
  userId: number,
  token: string,
  platform: string = 'android',
  deviceId?: string,
): Promise<void> {
  await db.insert(fcmTokens)
    .values({ userId, token, platform, deviceId, isActive: true, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: fcmTokens.token,
      set: { userId, platform, deviceId, isActive: true, updatedAt: new Date() },
    })
}
