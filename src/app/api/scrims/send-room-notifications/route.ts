import { NextRequest } from 'next/server'
import { db } from '@/db'
import { scrims, scrimRegistrations, teamMembers, notifications } from '@/db/schema'
import { eq, lte, and, isNotNull, isNull } from 'drizzle-orm'
import { apiSuccess, apiError } from '@/lib/api'

/**
 * POST /api/scrims/send-room-notifications
 *
 * Finds all scrims whose roomRevealAt has passed AND roomId is set
 * but have not yet had their room notification sent (tracked via a
 * lightweight in-table flag: status transitions to 'room_revealed').
 *
 * Call this endpoint from a cron job, the client's polling, or the
 * health endpoint at regular intervals (e.g. every minute).
 *
 * Does NOT require auth so a Cloudflare Cron Worker can hit it directly.
 * Protect it with a shared secret via the X-Cron-Secret header if needed.
 */
export async function POST(request: NextRequest) {
  const now = new Date()

  // Find scrims whose room reveal time has come, have a roomId, and status is still 'upcoming'
  const dueScims = await db
    .select()
    .from(scrims)
    .where(
      and(
        lte(scrims.roomRevealAt, now),
        isNotNull(scrims.roomId),
        eq(scrims.status, 'upcoming'),
      )
    )

  if (dueScims.length === 0) {
    return apiSuccess({ message: 'No scrims due for room reveal', sent: 0 })
  }

  let totalSent = 0

  for (const scrim of dueScims) {
    // Mark as room_revealed so we don't re-send
    await db.update(scrims)
      .set({ status: 'room_revealed' })
      .where(eq(scrims.id, scrim.id))

    // Get all registered teams
    const registrations = await db
      .select({ teamId: scrimRegistrations.teamId })
      .from(scrimRegistrations)
      .where(eq(scrimRegistrations.scrimId, scrim.id))

    for (const reg of registrations) {
      // Get all members of each team
      const members = await db
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, reg.teamId))

      for (const member of members) {
        await db.insert(notifications).values({
          userId: member.userId,
          type: 'scrim_created',
          title: `Room Details: ${scrim.name}`,
          body: `Room ID: ${scrim.roomId}${scrim.roomPassword ? ` | Password: ${scrim.roomPassword}` : ''}`,
          data: {
            scrimId: scrim.id,
            roomId: scrim.roomId,
            roomPassword: scrim.roomPassword,
            deepLink: `/scrims/${scrim.id}`,
          },
          isRead: false,
        })
        totalSent++
      }
    }
  }

  return apiSuccess({ message: `Room notifications sent`, sent: totalSent, scrims: dueScims.length })
}
