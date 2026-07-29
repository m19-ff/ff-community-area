import { NextRequest } from 'next/server'
import { db } from '@/db'
import { tournaments, tournamentTeams, teams, teamMembers, users, wallets, transactions, notifications } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, requireAdmin, apiSuccess, apiError } from '@/lib/api'
import {
  getTeamWallet,
  increaseTeamBalance,
  addTeamTransaction,
} from '@/lib/teamWallet'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tournId = parseInt(id)

  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tournId)).limit(1)
  if (!t) return apiError('Tournament not found', 404)

  const registeredTeams = await db.select({
    id: tournamentTeams.id,
    status: tournamentTeams.status,
    placement: tournamentTeams.placement,
    registeredAt: tournamentTeams.registeredAt,
    team: {
      id: teams.id,
      name: teams.name,
      logo: teams.logo,
      points: teams.points,
    },
  })
    .from(tournamentTeams)
    .leftJoin(teams, eq(tournamentTeams.teamId, teams.id))
    .where(eq(tournamentTeams.tournamentId, tournId))

  return apiSuccess({ tournament: { ...t, registeredTeams } })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)
  const { id } = await params
  const tournId = parseInt(id)

  const [t] = await db.select().from(tournaments).where(eq(tournaments.id, tournId)).limit(1)
  if (!t) return apiError('Tournament not found', 404)

  const body = await request.json()
  const updates: Partial<typeof tournaments.$inferInsert> = {}

  if (body.name) updates.name = body.name.trim()
  if (body.type) updates.type = body.type
  if (body.banner !== undefined) updates.banner = body.banner
  if (body.registrationCost !== undefined) updates.registrationCost = body.registrationCost
  if (body.prizePool !== undefined) updates.prizePool = body.prizePool
  if (body.prizeDistribution !== undefined) updates.prizeDistribution = body.prizeDistribution
  if (body.description !== undefined) updates.description = body.description
  if (body.rules !== undefined) updates.rules = body.rules
  if (body.maxTeams !== undefined) updates.maxTeams = body.maxTeams
  if (body.registrationDeadline) updates.registrationDeadline = new Date(body.registrationDeadline)
  if (body.startDate) updates.startDate = new Date(body.startDate)
  if (body.endDate) updates.endDate = new Date(body.endDate)
  if (body.status) updates.status = body.status
  updates.updatedAt = new Date()

  const [updated] = await db.update(tournaments).set(updates).where(eq(tournaments.id, tournId)).returning()

  // If publishing, notify all users
  if (body.status === 'published' && t.status !== 'published') {
    // Could batch-notify here; omitted for brevity
  }

  // ── Award prizes to teams ──────────────────────────────────────────────────
  // Expected body.prizes: Array<{ teamId: number, placement: number, prizePoints: number }>
  if (Array.isArray(body.prizes) && body.prizes.length > 0) {
    for (const prize of body.prizes as { teamId: number; placement: number; prizePoints: number }[]) {
      if (!prize.teamId || !prize.placement || !prize.prizePoints || prize.prizePoints <= 0) continue

      // Update tournament_teams row
      await db.update(tournamentTeams).set({
        placement: prize.placement,
        prizeAwarded: prize.prizePoints,
        status: 'finished',
      }).where(and(
        eq(tournamentTeams.tournamentId, tournId),
        eq(tournamentTeams.teamId, prize.teamId),
      ))

      // Credit team wallet
      const teamWallet = await getTeamWallet(prize.teamId)
      if (!teamWallet) continue

      const balanceBefore = teamWallet.balance
      const updatedWallet = await increaseTeamBalance(prize.teamId, prize.prizePoints)

      await addTeamTransaction({
        teamId: prize.teamId,
        userId: admin.userId,
        type: 'earn_tournament',
        amount: prize.prizePoints,
        balanceBefore,
        balanceAfter: updatedWallet.balance,
        description: `Tournament prize: ${t.name} — placement #${prize.placement}`,
        meta: { tournamentId: tournId, placement: prize.placement },
      })

      // Notify all team members
      const members = await db
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, prize.teamId))

      for (const m of members) {
        await db.insert(notifications).values({
          userId: m.userId,
          type: 'general',
          title: 'Tournament Prize Awarded',
          body: `Your team finished #${prize.placement} in ${t.name} and received ${prize.prizePoints} points!`,
          data: { tournamentId: tournId, teamId: prize.teamId, prizePoints: prize.prizePoints },
        })
      }
    }
  }

  return apiSuccess({ tournament: updated })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)
  const { id } = await params
  const tournId = parseInt(id)

  await db.delete(tournaments).where(eq(tournaments.id, tournId))
  return apiSuccess({ message: 'Tournament deleted' })
}
