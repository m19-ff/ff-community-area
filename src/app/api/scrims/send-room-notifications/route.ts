import { NextRequest } from 'next/server'
import { db } from '@/db'
import { scrims, scrimRegistrations, teamMembers } from '@/db/schema'
import { eq, lte, and, isNotNull } from 'drizzle-orm'
import { apiSuccess } from '@/lib/api'
import { sendPushToUsers } from '@/lib/fcm'

/**
 * POST /api/scrims/send-room-notifications
 *
 * Finds all scrims whose roomRevealAt has passed AND roomId is set
 * but have not yet had their room notification sent (status = 'upcoming').
 * Transitions to 'room_revealed' to prevent double-send.
 *
 * Call from a cron job or health-endpoint polling every minute.
 * Optionally protect with X-Cron-Secret header.
 */
export async function POST(_request: NextRequest) {
  const now = new Date()

  const dueScims = await db
    .select()
    .from(scrims)
    .where(and(
      lte(scrims.roomRevealAt, now),
      isNotNull(scrims.roomId),
      eq(scrims.status, 'upcoming'),
    ))

  if (dueScims.length === 0) {
    return apiSuccess({ message: 'No scrims due for room reveal', sent: 0 })
  }

  let totalSent = 0

  for (const scrim of dueScims) {
    // Atomically mark as revealed to prevent double-send
    await db.update(scrims)
      .set({ status: 'room_revealed' })
      .where(eq(scrims.id, scrim.id))

    // Collect all member IDs across all registered teams
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
            deepLink:     `/scrims`,
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
          deepLink:     `/scrims`,
        },
      })
      totalSent += allMemberIds.length
    }
  }

  return apiSuccess({ message: 'Room notifications sent', sent: totalSent, scrims: dueScims.length })
}
