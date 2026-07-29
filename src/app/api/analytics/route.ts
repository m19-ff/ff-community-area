import { NextRequest } from 'next/server'
import { requireAdmin, requireAuth, apiSuccess, apiError } from '@/lib/api'
import { getDashboardAnalytics, getMostActivePlayers, trackEvent } from '@/lib/analytics'
import { rateLimit, getClientIp } from '@/lib/security'
import { db } from '@/db'
import { users, analyticsEvents } from '@/db/schema'
import { eq, desc, gte, inArray } from 'drizzle-orm'

// GET /api/analytics — admin dashboard analytics
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const { searchParams } = new URL(request.url)
  const days = Math.min(parseInt(searchParams.get('days') || '30'), 90)

  const [analytics, activePlayers] = await Promise.all([
    getDashboardAnalytics(days),
    getMostActivePlayers(10),
  ])

  // Enrich active players with user info
  const playerIds = activePlayers
    .map(p => p.userId)
    .filter((id): id is number => id !== null)

  let playerDetails: { id: number; gameName: string | null; gameUid: string | null; profilePicture: string | null }[] = []
  if (playerIds.length > 0) {
    playerDetails = await db
      .select({ id: users.id, gameName: users.gameName, gameUid: users.gameUid, profilePicture: users.profilePicture })
      .from(users)
      .where(inArray(users.id, playerIds))
  }

  const playerMap = Object.fromEntries(playerDetails.map(p => [p.id, p]))
  const enrichedPlayers = activePlayers.map(p => ({
    ...p,
    user: p.userId ? (playerMap[p.userId] || null) : null,
  }))

  return apiSuccess({ ...analytics, mostActivePlayers: enrichedPlayers, days })
}

// POST /api/analytics — track event (client-side)
export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { max: 120, windowSeconds: 60 })
  if (limited) return limited

  const auth      = await requireAuth(request)
  const body      = await request.json().catch(() => ({}))
  const event     = typeof body.event === 'string' ? body.event.slice(0, 100) : null
  const page      = typeof body.page  === 'string' ? body.page.slice(0, 100)  : undefined
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.slice(0, 64) : undefined

  if (!event) return apiError('event is required', 400)

  // Only allow safe event names (whitelist)
  const ALLOWED_EVENTS = [
    'page_view', 'app_open', 'tournament_view', 'scrim_view',
    'team_view', 'news_view', 'wallet_view', 'profile_view',
  ]
  if (!ALLOWED_EVENTS.includes(event)) {
    return apiSuccess({ tracked: false })
  }

  const ip        = getClientIp(request)
  const userAgent = request.headers.get('user-agent') || undefined

  await trackEvent({
    event,
    userId:    auth?.userId,
    page,
    ipAddress: ip,
    userAgent,
    sessionId,
    meta:      typeof body.meta === 'object' ? body.meta : undefined,
  })

  return apiSuccess({ tracked: true })
}
