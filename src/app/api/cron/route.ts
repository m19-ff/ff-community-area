/**
 * GET /api/cron
 * Lightweight cron endpoint — call every minute from an external scheduler or
 * from the client using a polling useEffect.
 * 
 * Runs:
 *   1. Room reveal notifications for scrims whose roomRevealAt has passed
 *   2. Season expiry checks
 */
import { NextRequest } from 'next/server'
import { db } from '@/db'
import { scrims, scrimRegistrations, teamMembers, seasons, tournamentMatches, tournamentGroups, tournaments } from '@/db/schema'
import { eq, lte, and, isNotNull, lt } from 'drizzle-orm'
import { sendPushToUsers } from '@/lib/fcm'
import { sendMatchRoomNotification } from '../tournaments/[id]/matches/route'
import { apiSuccess } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  const results: Record<string, unknown> = {}

  // ── 1. Room Reveal ───────────────────────────────────────────────────────────
  const now = new Date()
  const dueScims = await db
    .select()
    .from(scrims)
    .where(and(
      lte(scrims.roomRevealAt, now),
      isNotNull(scrims.roomId),
      eq(scrims.status, 'upcoming'),
    ))

  let totalSent = 0
  for (const scrim of dueScims) {
    await db.update(scrims).set({ status: 'room_revealed' }).where(eq(scrims.id, scrim.id))

    const registrations = await db
      .select({ teamId: scrimRegistrations.teamId })
      .from(scrimRegistrations)
      .where(eq(scrimRegistrations.scrimId, scrim.id))

    const allMemberIds: number[] = []
    for (const reg of registrations) {
      const members = await db
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, reg.teamId))
      allMemberIds.push(...members.map(m => m.userId))
    }

    if (allMemberIds.length > 0) {
      await sendPushToUsers({
        userIds: allMemberIds,
        payload: {
          title: `🎮 Room Revealed: ${scrim.name}`,
          body:  `Room ID: ${scrim.roomId}${scrim.roomPassword ? ` | Pass: ${scrim.roomPassword}` : ''}`,
          data:  {
            deepLink:     'scrims',
            scrimId:      String(scrim.id),
            roomId:       scrim.roomId ?? '',
            roomPassword: scrim.roomPassword ?? '',
          },
        },
        notifType: 'scrim_created',
        notifData: {
          scrimId:      scrim.id,
          roomId:       scrim.roomId,
          roomPassword: scrim.roomPassword,
          deepLink:     'scrims',
        },
      })
      totalSent += allMemberIds.length
    }
  }
  results.roomReveals = { scrims: dueScims.length, notificationsSent: totalSent }

  // ── 2. Season expiry ─────────────────────────────────────────────────────────
  const expiredSeasons = await db
    .select({ id: seasons.id })
    .from(seasons)
    .where(and(eq(seasons.isActive, true), lt(seasons.endDate, now)))

  for (const s of expiredSeasons) {
    await db.update(seasons).set({ isActive: false, isFinished: true }).where(eq(seasons.id, s.id))
  }
  results.expiredSeasons = expiredSeasons.length

  // ── 3. Tournament Match Room Reveals ─────────────────────────────────────────
  const dueMatches = await db
    .select({
      id:             tournamentMatches.id,
      tournamentId:   tournamentMatches.tournamentId,
      groupId:        tournamentMatches.groupId,
      name:           tournamentMatches.name,
      roomId:         tournamentMatches.roomId,
      roomPassword:   tournamentMatches.roomPassword,
      matchStartTime: tournamentMatches.matchStartTime,
      roomRevealAt:   tournamentMatches.roomRevealAt,
      status:         tournamentMatches.status,
      roomNotifiedAt: tournamentMatches.roomNotifiedAt,
      createdAt:      tournamentMatches.createdAt,
      updatedAt:      tournamentMatches.updatedAt,
      createdBy:      tournamentMatches.createdBy,
      groupName:      tournamentGroups.name,
    })
    .from(tournamentMatches)
    .leftJoin(tournamentGroups, eq(tournamentMatches.groupId, tournamentGroups.id))
    .where(and(
      lte(tournamentMatches.roomRevealAt, now),
      isNotNull(tournamentMatches.roomId),
      eq(tournamentMatches.status, 'upcoming'),
    ))

  let matchNotifCount = 0
  for (const match of dueMatches) {
    const [tournament] = await db
      .select({ name: tournaments.name })
      .from(tournaments)
      .where(eq(tournaments.id, match.tournamentId))
      .limit(1)

    await sendMatchRoomNotification({
      match,
      tournamentName: tournament?.name || `Tournament ${match.tournamentId}`,
      sentByUserId:   0,
      sentByName:     'System (Auto)',
    })
    matchNotifCount++
  }
  results.tournamentMatchReveals = matchNotifCount

  return apiSuccess(results)
}

// Allow POST as well (for cron services that POST)
export const POST = GET
