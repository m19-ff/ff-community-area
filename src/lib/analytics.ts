/**
 * Analytics tracking helpers.
 * Fire-and-forget: never throw, never block the main request.
 */

import { db } from '@/db'
import { analyticsEvents, dailyAnalytics, users } from '@/db/schema'
import { eq, sql, and, gte, lt, count, countDistinct } from 'drizzle-orm'

// ── Event tracking ────────────────────────────────────────────────────────────

export async function trackEvent(opts: {
  event: string
  userId?: number
  page?: string
  meta?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  sessionId?: string
}): Promise<void> {
  try {
    await db.insert(analyticsEvents).values({
      event:     opts.event,
      userId:    opts.userId,
      page:      opts.page,
      meta:      opts.meta || null,
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
      sessionId: opts.sessionId,
    })
  } catch {
    // Fire-and-forget
  }
}

// ── Daily aggregate upsert ────────────────────────────────────────────────────

export async function incrementDailyMetric(metric: string, amount = 1): Promise<void> {
  const date = new Date().toISOString().split('T')[0]
  try {
    await db.insert(dailyAnalytics)
      .values({ date, metric, value: amount, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [dailyAnalytics.date, dailyAnalytics.metric],
        set: {
          value:     sql`${dailyAnalytics.value} + ${amount}`,
          updatedAt: new Date(),
        },
      })
  } catch {
    // Fire-and-forget
  }
}

// ── Dashboard analytics queries ───────────────────────────────────────────────

export async function getDashboardAnalytics(days = 30) {
  const since = new Date()
  since.setDate(since.getDate() - days)

  // Daily registrations (from analytics events)
  const dailyRegistrations = await db
    .select({
      date:  sql<string>`DATE(${analyticsEvents.createdAt})`,
      count: count(),
    })
    .from(analyticsEvents)
    .where(and(
      eq(analyticsEvents.event, 'user_registered'),
      gte(analyticsEvents.createdAt, since),
    ))
    .groupBy(sql`DATE(${analyticsEvents.createdAt})`)
    .orderBy(sql`DATE(${analyticsEvents.createdAt})`)

  // Daily active users
  const dailyActiveUsers = await db
    .select({
      date:  sql<string>`DATE(${analyticsEvents.createdAt})`,
      count: countDistinct(analyticsEvents.userId),
    })
    .from(analyticsEvents)
    .where(and(
      gte(analyticsEvents.createdAt, since),
      eq(analyticsEvents.event, 'page_view'),
    ))
    .groupBy(sql`DATE(${analyticsEvents.createdAt})`)
    .orderBy(sql`DATE(${analyticsEvents.createdAt})`)

  // Most visited pages
  const topPages = await db
    .select({
      page:  analyticsEvents.page,
      count: count(),
    })
    .from(analyticsEvents)
    .where(and(
      gte(analyticsEvents.createdAt, since),
      eq(analyticsEvents.event, 'page_view'),
    ))
    .groupBy(analyticsEvents.page)
    .orderBy(sql`count(*) DESC`)
    .limit(10)

  // Monthly active users (last 30 days)
  const [mauRow] = await db
    .select({ mau: countDistinct(analyticsEvents.userId) })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, since))

  // Daily active users today
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [dauRow] = await db
    .select({ dau: countDistinct(analyticsEvents.userId) })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, today))

  // Tournament participation last 30 days
  const tournamentParticipation = await db
    .select({
      date:  sql<string>`DATE(${analyticsEvents.createdAt})`,
      count: count(),
    })
    .from(analyticsEvents)
    .where(and(
      eq(analyticsEvents.event, 'tournament_registered'),
      gte(analyticsEvents.createdAt, since),
    ))
    .groupBy(sql`DATE(${analyticsEvents.createdAt})`)
    .orderBy(sql`DATE(${analyticsEvents.createdAt})`)

  return {
    dailyRegistrations,
    dailyActiveUsers,
    topPages,
    mau: mauRow?.mau ?? 0,
    dau: dauRow?.dau ?? 0,
    tournamentParticipation,
  }
}

// ── Most active players ───────────────────────────────────────────────────────

export async function getMostActivePlayers(limit = 10) {
  const since = new Date()
  since.setDate(since.getDate() - 30)

  return db
    .select({
      userId: analyticsEvents.userId,
      events: count(),
    })
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, since))
    .groupBy(analyticsEvents.userId)
    .orderBy(sql`count(*) DESC`)
    .limit(limit)
}
