import { NextRequest } from 'next/server'
import { db } from '@/db'
import {
  teams, teamMembers, users, teamWallets, teamTransactions,
  tournamentTeams, tournaments,
} from '@/db/schema'
import { eq, desc, count, sum, sql, and, ne } from 'drizzle-orm'
import { requireAdmin, apiSuccess, apiError } from '@/lib/api'
import { getTeamWallet, createTeamWallet } from '@/lib/teamWallet'

// ── GET /api/admin/teams/[id] ─────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const { id } = await params
  const teamId = parseInt(id)
  if (isNaN(teamId)) return apiError('Invalid team ID', 400)

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return apiError('Team not found', 404)

  // Members
  const members = await db
    .select({
      id:             users.id,
      gameName:       users.gameName,
      gameUid:        users.gameUid,
      profilePicture: users.profilePicture,
      email:          users.email,
      role:           users.role,
      joinedAt:       teamMembers.joinedAt,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId))

  // Captain
  const [captain] = await db
    .select({
      id:             users.id,
      gameName:       users.gameName,
      email:          users.email,
      profilePicture: users.profilePicture,
      gameUid:        users.gameUid,
    })
    .from(users)
    .where(eq(users.id, team.captainId))
    .limit(1)

  // Wallet
  let wallet = await getTeamWallet(teamId)
  if (!wallet) wallet = await createTeamWallet(teamId)

  // Tournament history (last 20)
  const tournamentHistory = await db
    .select({
      id:           tournaments.id,
      name:         tournaments.name,
      type:         tournaments.type,
      placement:    tournamentTeams.placement,
      prizeAwarded: tournamentTeams.prizeAwarded,
      status:       tournaments.status,
      startDate:    tournaments.startDate,
    })
    .from(tournamentTeams)
    .innerJoin(tournaments, eq(tournamentTeams.tournamentId, tournaments.id))
    .where(eq(tournamentTeams.teamId, teamId))
    .orderBy(desc(tournaments.startDate))
    .limit(20)

  // Stats
  const [tStats] = await db
    .select({
      total:      count(),
      wins:       sql<number>`COUNT(*) FILTER (WHERE ${tournamentTeams.placement} = 1)`,
      top3:       sql<number>`COUNT(*) FILTER (WHERE ${tournamentTeams.placement} <= 3)`,
      totalPrize: sum(tournamentTeams.prizeAwarded),
    })
    .from(tournamentTeams)
    .where(eq(tournamentTeams.teamId, teamId))

  // Wallet history (last 30)
  const walletHistory = await db
    .select({
      id:            teamTransactions.id,
      type:          teamTransactions.type,
      amount:        teamTransactions.amount,
      balanceBefore: teamTransactions.balanceBefore,
      balanceAfter:  teamTransactions.balanceAfter,
      description:   teamTransactions.description,
      meta:          teamTransactions.meta,
      createdAt:     teamTransactions.createdAt,
      userId:        teamTransactions.userId,
      adminName:     users.gameName,
      adminEmail:    users.email,
    })
    .from(teamTransactions)
    .leftJoin(users, eq(teamTransactions.userId, users.id))
    .where(eq(teamTransactions.teamId, teamId))
    .orderBy(desc(teamTransactions.createdAt))
    .limit(30)

  return apiSuccess({
    team: {
      ...team,
      walletBalance:   wallet.balance,
      lockedBalance:   wallet.lockedBalance,
      totalEarned:     wallet.totalEarned,
      totalSpent:      wallet.totalSpent,
    },
    captain:          captain ?? null,
    members,
    stats: {
      tournaments:  Number(tStats?.total      ?? 0),
      wins:         Number(tStats?.wins       ?? 0),
      top3:         Number(tStats?.top3       ?? 0),
      totalPrize:   Number(tStats?.totalPrize ?? 0),
      memberCount:  members.length,
      winRate:
        Number(tStats?.total ?? 0) > 0
          ? Math.round((Number(tStats?.wins ?? 0) / Number(tStats?.total ?? 0)) * 100)
          : 0,
    },
    tournamentHistory,
    walletHistory,
  })
}

// ── PATCH /api/admin/teams/[id] ───────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const { id } = await params
  const teamId = parseInt(id)
  if (isNaN(teamId)) return apiError('Invalid team ID', 400)

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return apiError('Team not found', 404)

  const body = await request.json()
  const { action } = body

  // ── Edit team name / logo ─────────────────────────────────────────────────
  if (action === 'edit') {
    const updates: Partial<typeof teams.$inferInsert> = {}

    if (body.name && body.name.trim() !== team.name) {
      const trimmed = body.name.trim()
      if (trimmed.length < 3) return apiError('Team name must be at least 3 characters', 400)
      const [nameTaken] = await db
        .select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.name, trimmed), ne(teams.id, teamId)))
        .limit(1)
      if (nameTaken) return apiError('Team name already taken', 409)
      updates.name = trimmed
    }

    if (body.logo !== undefined) updates.logo = body.logo || null
    if (body.isActive !== undefined) updates.isActive = body.isActive

    updates.updatedAt = new Date()
    const [updated] = await db.update(teams).set(updates).where(eq(teams.id, teamId)).returning()
    return apiSuccess({ team: updated })
  }

  // ── Transfer captain ──────────────────────────────────────────────────────
  if (action === 'transfer_captain') {
    const newCaptainId = parseInt(body.newCaptainId)
    if (isNaN(newCaptainId)) return apiError('Invalid new captain ID', 400)

    // New captain must be a member
    const [membership] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, newCaptainId)))
      .limit(1)
    if (!membership) return apiError('New captain must be a team member', 400)

    // Guard: cannot transfer captaincy to or from an admin/superadmin account
    const [oldCaptainUser] = await db.select({ role: users.role }).from(users).where(eq(users.id, team.captainId)).limit(1)
    const [newCaptainUser] = await db.select({ role: users.role }).from(users).where(eq(users.id, newCaptainId)).limit(1)

    if (oldCaptainUser && ['admin', 'superadmin'].includes(oldCaptainUser.role)) {
      return apiError('Cannot transfer captaincy from an admin account', 403)
    }
    if (newCaptainUser && ['admin', 'superadmin'].includes(newCaptainUser.role)) {
      return apiError('Cannot assign captaincy to an admin account', 403)
    }

    await db.transaction(async (tx) => {
      // Demote old captain to player (safe — already confirmed not admin)
      await tx
        .update(users)
        .set({ role: 'player' })
        .where(eq(users.id, team.captainId))

      // Promote new captain (safe — already confirmed not admin)
      await tx
        .update(users)
        .set({ role: 'captain' })
        .where(eq(users.id, newCaptainId))

      // Update team
      await tx
        .update(teams)
        .set({ captainId: newCaptainId, updatedAt: new Date() })
        .where(eq(teams.id, teamId))
    })

    return apiSuccess({ message: 'Captain transferred successfully' })
  }

  return apiError('Invalid action', 400)
}

// ── DELETE /api/admin/teams/[id] ──────────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const { id } = await params
  const teamId = parseInt(id)
  if (isNaN(teamId)) return apiError('Invalid team ID', 400)

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return apiError('Team not found', 404)

  // Re-use the existing delete + fund-distribution logic via the user-facing route
  const baseUrl = new URL(request.url)
  const target  = `${baseUrl.protocol}//${baseUrl.host}/api/teams/${teamId}`

  const deleteRes = await fetch(target, {
    method:  'DELETE',
    headers: { authorization: request.headers.get('authorization') || '' },
  })

  if (!deleteRes.ok) {
    const body = await deleteRes.json().catch(() => ({}))
    return apiError((body as { message?: string }).message || 'Failed to delete team', deleteRes.status)
  }

  return apiSuccess({ message: 'Team deleted and funds distributed' })
}
