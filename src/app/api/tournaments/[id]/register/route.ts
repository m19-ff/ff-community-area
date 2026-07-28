import { NextRequest } from 'next/server'
import { db } from '@/db'
import { tournaments, tournamentTeams, teams, teamMembers, wallets, transactions, notifications, users } from '@/db/schema'
import { eq, and, count } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError } from '@/lib/api'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const { id } = await params
  const tournId = parseInt(id)

  // Get tournament
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournId)).limit(1)
  if (!tournament) return apiError('Tournament not found', 404)
  if (tournament.status !== 'published') return apiError('Tournament is not open for registration', 400)
  if (tournament.registrationDeadline && new Date(tournament.registrationDeadline) < new Date()) {
    return apiError('Registration deadline has passed', 400)
  }

  // Get captain's team
  const [myTeam] = await db.select().from(teams).where(eq(teams.captainId, auth.userId)).limit(1)
  if (!myTeam) return apiError('Only team captains can register for tournaments', 403)

  // Check team has min 4 players
  const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, myTeam.id))
  if (members.length < 4) return apiError('Your team needs at least 4 players to register', 400)

  // Check already registered
  const alreadyReg = await db.select().from(tournamentTeams).where(
    and(eq(tournamentTeams.tournamentId, tournId), eq(tournamentTeams.teamId, myTeam.id))
  ).limit(1)
  if (alreadyReg.length > 0) return apiError('Team already registered for this tournament', 400)

  // Check max teams
  const [{ registeredCount }] = await db.select({ registeredCount: count() })
    .from(tournamentTeams).where(eq(tournamentTeams.tournamentId, tournId))
  if (registeredCount >= tournament.maxTeams) return apiError('Tournament is full', 400)

  // Check team points
  if (tournament.registrationCost > 0) {
    if (myTeam.points < tournament.registrationCost) {
      return apiError("Your team doesn't have enough points. Please recharge.", 400)
    }
    // Deduct points
    await db.update(teams).set({ points: myTeam.points - tournament.registrationCost }).where(eq(teams.id, myTeam.id))

    // Record transaction for captain
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, auth.userId)).limit(1)
    if (wallet) {
      await db.insert(transactions).values({
        userId: auth.userId,
        type: 'deduct_tournament',
        amount: -tournament.registrationCost,
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance,
        description: `Tournament registration: ${tournament.name}`,
        meta: { tournamentId: tournId },
      })
    }
  }

  // Register team
  await db.insert(tournamentTeams).values({
    tournamentId: tournId,
    teamId: myTeam.id,
    status: 'registered',
  })

  // Notify all team members
  for (const member of members) {
    await db.insert(notifications).values({
      userId: member.userId,
      type: 'registration_accepted',
      title: 'Tournament Registration',
      body: `Your team ${myTeam.name} has been registered for ${tournament.name}!`,
      data: { tournamentId: tournId, teamId: myTeam.id },
    })
  }

  return apiSuccess({ message: `Team ${myTeam.name} registered for ${tournament.name}` }, 201)
}
