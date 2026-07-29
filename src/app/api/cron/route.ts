/**
 * GET /api/cron
 * Lightweight cron endpoint — call every minute from an external scheduler.
 *
 * Runs:
 *   1. Room reveal notifications for scrims whose roomRevealAt has passed
 *   2. Season expiry checks
 *   3. Tournament match room reveals
 */
import { NextRequest } from 'next/server'
import { db } from '@/db'
import { scrims, scrimRegistrations, teamMembers, seasons, tournamentMatches, tournamentGroups, tournaments } from '@/db/schema'
import { eq, lte, and, isNotNull, lt } from 'drizzle-orm'
import { sendPushToUsers } from '@/lib/fcm'
import { sendMatchRoomNotification } from '../tournaments/[id]/matches/route'
import { apiSuccess, apiError } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('x-cron-secret') !== secret) {
    return apiError('Unauthorized', 401)
  }
  const results: Record<string, unknown> = {}
  const now = new Date()

  // ── 1. Scrim Room Reveals ────────────────────────────────────────────────────
  try {
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
      try {
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
      } catch (err) {
        console.error(`[cron] Failed to reveal scrim #${scrim.id}:`, err)
      }
    }
    results.roomReveals = { scrims: dueScims.length, notificationsSent: totalSent }
  } catch (err) {
    console.error('[cron] scrim reveal error:', err)
    results.roomReveals = { error: String(err) }
  }

  // ── 2. Season expiry ─────────────────────────────────────────────────────────
  try {
    const expiredSeasons = await db
      .select({ id: seasons.id })
      .from(seasons)
      .where(and(eq(seasons.isActive, true), lt(seasons.endDate, now)))

    for (const s of expiredSeasons) {
      await db.update(seasons).set({ isActive: false, isFinished: true }).where(eq(seasons.id, s.id))
    }
    results.expiredSeasons = expiredSeasons.length
  } catch (err) {
    console.error('[cron] season expiry error:', err)
    results.expiredSeasons = { error: String(err) }
  }

  // ── 3. Tournament Match Room Reveals ─────────────────────────────────────────
  try {
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
      try {
        const [tournament] = await db
          .select({ name: tournaments.name })
          .from(tournaments)
          .where(eq(tournaments.id, match.tournamentId))
          .limit(1)

        await sendMatchRoomNotification({
          match,
          tournamentName: tournament?.name ?? `Tournament ${match.tournamentId}`,
          sentByUserId:   null,
          sentByName:     'System (Auto)',
        })
        matchNotifCount++
      } catch (err) {
        console.error(`[cron] Failed to reveal match #${match.id}:`, err)
      }
    }
    results.tournamentMatchReveals = matchNotifCount
  } catch (err) {
    console.error('[cron] tournament match reveal error:', err)
    results.tournamentMatchReveals = { error: String(err) }
  }

  return apiSuccess(results)
}

// Allow POST as well (for cron services that POST)
export const POST = GET
