import { NextRequest } from 'next/server'
import { db } from '@/db'
import { tournaments, tournamentTeams, teams, teamMembers, users, wallets, transactions, notifications, teamWallets } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, requireAdmin, apiSuccess, apiError } from '@/lib/api'
import {
  getTeamWallet,
  increaseTeamBalance,
  addTeamTransaction,
  createTeamWallet,
} from '@/lib/teamWallet'
import { sendPushToUsers } from '@/lib/fcm'
import { trackEvent, incrementDailyMetric } from '@/lib/analytics'

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
      walletBalance: teamWallets.balance,
    },
  })
    .from(tournamentTeams)
    .leftJoin(teams, eq(tournamentTeams.teamId, teams.id))
    .leftJoin(teamWallets, eq(teams.id, teamWallets.teamId))
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

  // If publishing, push-notify all active users
  if (body.status === 'published' && t.status !== 'published') {
    const allUsers = await db.select({ id: users.id }).from(users)
      .where(eq(users.isBanned, false))
    const userIds = allUsers.map(u => u.id)
    void sendPushToUsers({
      userIds,
      payload: {
        title: '🏆 New Tournament!',
        body:  `${updated.name} is now open for registration!`,
        data:  { deepLink: `/tournaments/${updated.id}`, tournamentId: String(updated.id) },
      },
      notifType: 'tournament_published',
      notifData: { tournamentId: updated.id, deepLink: `/tournaments/${updated.id}` },
    })
    void incrementDailyMetric('tournaments_published')
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

      // Credit team wallet — auto-create if missing
      let teamWallet = await getTeamWallet(prize.teamId)
      if (!teamWallet) teamWallet = await createTeamWallet(prize.teamId)

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

      // Push-notify all team members about prize
      const members = await db
        .select({ userId: teamMembers.userId })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, prize.teamId))

      const memberIds = members.map(m => m.userId)
      void sendPushToUsers({
        userIds:   memberIds,
        payload: {
          title: '🎉 Prize Awarded!',
          body:  `Your team finished #${prize.placement} in ${t.name} and received ${prize.prizePoints} points!`,
          data:  { deepLink: `/tournaments/${tournId}`, tournamentId: String(tournId) },
        },
        notifType: 'general',
        notifData: { tournamentId: tournId, teamId: prize.teamId, prizePoints: prize.prizePoints, deepLink: `/tournaments/${tournId}` },
      })
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
