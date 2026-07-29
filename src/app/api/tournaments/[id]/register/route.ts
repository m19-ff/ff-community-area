import { NextRequest } from 'next/server'
import { db } from '@/db'
import { tournaments, tournamentTeams, teams, teamMembers, notifications } from '@/db/schema'
import { eq, and, count, sql } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError } from '@/lib/api'
import {
  getTeamWallet,
  decreaseTeamBalance,
  addTeamTransaction,
} from '@/lib/teamWallet'

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

  // Deduct registration cost from team wallet (before transaction to keep it outside the slot-lock)
  if (tournament.registrationCost > 0) {
    const teamWallet = await getTeamWallet(myTeam.id)
    if (!teamWallet || teamWallet.balance < tournament.registrationCost) {
      return apiError("Your team wallet doesn't have enough points to register. Please recharge.", 400)
    }

    const balanceBefore = teamWallet.balance
    const updatedWallet = await decreaseTeamBalance(myTeam.id, tournament.registrationCost)

    await addTeamTransaction({
      teamId: myTeam.id,
      userId: auth.userId,
      type: 'deduct_tournament',
      amount: -tournament.registrationCost,
      balanceBefore,
      balanceAfter: updatedWallet.balance,
      description: `Tournament registration: ${tournament.name}`,
      meta: { tournamentId: tournId },
    })
  }

  // Wrap slot-check + insert in a transaction to prevent over-registration races
  try {
    await db.transaction(async (tx) => {
      // Check already registered
      const [alreadyReg] = await tx.select({ id: tournamentTeams.id })
        .from(tournamentTeams)
        .where(and(eq(tournamentTeams.tournamentId, tournId), eq(tournamentTeams.teamId, myTeam.id)))
        .limit(1)
      if (alreadyReg) throw new Error('ALREADY_REGISTERED')

      // Check max teams (re-read inside transaction for consistency)
      const [{ registeredCount }] = await tx.select({ registeredCount: count() })
        .from(tournamentTeams)
        .where(eq(tournamentTeams.tournamentId, tournId))
      if (registeredCount >= tournament.maxTeams) throw new Error('TOURNAMENT_FULL')

      await tx.insert(tournamentTeams).values({
        tournamentId: tournId,
        teamId: myTeam.id,
        status: 'registered',
      })
    })
  } catch (err) {
    const msg = (err as Error).message
    if (msg === 'ALREADY_REGISTERED') return apiError('Team already registered for this tournament', 400)
    if (msg === 'TOURNAMENT_FULL')     return apiError('Tournament is full', 400)
    throw err
  }

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

