/**
 * Rate limiting helpers using the `rate_limits` DB table.
 * Designed to work in both Node and edge runtimes (no in-memory state).
 */

import { db } from '@/db'
import { rateLimits } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

export interface RateLimitConfig {
  /** Max requests per window */
  max: number
  /** Window duration in seconds */
  windowSeconds: number
}

const DEFAULTS: RateLimitConfig = { max: 60, windowSeconds: 60 }

/**
 * Check & increment rate limit for a key.
 * Returns `{ allowed: boolean; remaining: number; resetAt: Date }`.
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULTS,
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const now       = new Date()
  const windowMs  = config.windowSeconds * 1000
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs)
  const resetAt     = new Date(windowStart.getTime() + windowMs)

  try {
    // Upsert: if key exists within the same window, increment; otherwise reset
    const [row] = await db
      .insert(rateLimits)
      .values({ key, count: 1, windowStart, updatedAt: now })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`CASE
            WHEN ${rateLimits.windowStart} < ${windowStart.toISOString()}
            THEN 1
            ELSE ${rateLimits.count} + 1
          END`,
          windowStart: sql`CASE
            WHEN ${rateLimits.windowStart} < ${windowStart.toISOString()}
            THEN ${windowStart.toISOString()}
            ELSE ${rateLimits.windowStart}
          END`,
          updatedAt: now,
        },
      })
      .returning()

    const count     = row?.count ?? 1
    const remaining = Math.max(0, config.max - count)
    const allowed   = count <= config.max

    return { allowed, remaining, resetAt }
  } catch {
    // Fail open on DB error — don't block legitimate traffic
    return { allowed: true, remaining: config.max, resetAt }
  }
}

/**
 * Get IP address from request (handles proxies).
 */
export function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  )
}

/**
 * Rate limit middleware for API routes.
 * Returns a 429 Response if rate limited, null otherwise.
 */
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig = DEFAULTS,
  keyOverride?: string,
): Promise<NextResponse | null> {
  const ip  = getClientIp(request)
  const key = keyOverride ?? `ip:${ip}:${new URL(request.url).pathname}`

  const { allowed, remaining, resetAt } = await checkRateLimit(key, config)

  if (!allowed) {
    return new NextResponse(
      JSON.stringify({ success: false, message: 'Too many requests. Please try again later.' }),
      {
        status:  429,
        headers: {
          'Content-Type':    'application/json',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset':     String(Math.floor(resetAt.getTime() / 1000)),
          'Retry-After':           String(Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
        },
      },
    )
  }

  return null
}

// ── Input sanitisation helpers ────────────────────────────────────────────────

/** Strip tags and trim. */
export function sanitizeString(s: unknown, maxLen = 500): string {
  if (typeof s !== 'string') return ''
  return s.replace(/<[^>]*>/g, '').trim().slice(0, maxLen)
}

/** Cast to safe integer within bounds. */
export function sanitizeInt(v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const n = typeof v === 'string' ? parseInt(v, 10) : Number(v)
  if (!Number.isFinite(n)) return min
  return Math.min(Math.max(n, min), max)
}

/** Validate email format. */
export function isValidEmail(email: unknown): email is string {
  if (typeof email !== 'string') return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

// ── Security headers helper ───────────────────────────────────────────────────

export function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  return response
}

// ── Audit log helper ──────────────────────────────────────────────────────────

import { auditLogs } from '@/db/schema'

export async function writeAuditLog(opts: {
  userId?: number
  action: string
  target?: string
  targetId?: number
  details?: Record<string, unknown>
  ipAddress?: string
}): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId:    opts.userId,
      action:    opts.action,
      target:    opts.target,
      targetId:  opts.targetId,
      details:   opts.details || null,
      ipAddress: opts.ipAddress,
    })
  } catch {
    // Never let audit logging fail the main request
  }
}
