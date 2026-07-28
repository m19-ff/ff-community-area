import { NextRequest } from 'next/server'
import { db } from '@/db'
import { scrims, scrimRegistrations, teams, teamMembers, notifications } from '@/db/schema'
import { eq, and, count } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError } from '@/lib/api'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const { id } = await params
  const scrimId = parseInt(id)

  const [scrim] = await db.select().from(scrims).where(eq(scrims.id, scrimId)).limit(1)
  if (!scrim) return apiError('Scrim not found', 404)
  if (scrim.status !== 'upcoming') return apiError('Scrim is not open for registration', 400)

  const [myTeam] = await db.select().from(teams).where(eq(teams.captainId, auth.userId)).limit(1)
  if (!myTeam) return apiError('Only captains can register for scrims', 403)

  const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, myTeam.id))
  if (members.length < 4) return apiError('Team needs at least 4 players', 400)

  const alreadyReg = await db.select().from(scrimRegistrations).where(
    and(eq(scrimRegistrations.scrimId, scrimId), eq(scrimRegistrations.teamId, myTeam.id))
  ).limit(1)
  if (alreadyReg.length > 0) return apiError('Team already registered for this scrim', 400)

  const [{ regCount }] = await db.select({ regCount: count() })
    .from(scrimRegistrations).where(eq(scrimRegistrations.scrimId, scrimId))
  if (regCount >= scrim.maxTeams) return apiError('Scrim is full', 400)

  await db.insert(scrimRegistrations).values({ scrimId, teamId: myTeam.id })

  // Notify team members with room details if reveal time has passed
  const now = new Date()
  const revealRoom = !scrim.roomRevealAt || new Date(scrim.roomRevealAt) <= now

  for (const member of members) {
    await db.insert(notifications).values({
      userId: member.userId,
      type: 'scrim_created',
      title: 'Scrim Registration Confirmed',
      body: revealRoom
        ? `Registered for ${scrim.name}. Room: ${scrim.roomId} | Pass: ${scrim.roomPassword}`
        : `Registered for ${scrim.name}. Room details will be shared before match.`,
      data: {
        scrimId,
        roomId: revealRoom ? scrim.roomId : null,
        roomPassword: revealRoom ? scrim.roomPassword : null,
      },
    })
  }

  return apiSuccess({ message: `Registered for scrim ${scrim.name}` })
}
