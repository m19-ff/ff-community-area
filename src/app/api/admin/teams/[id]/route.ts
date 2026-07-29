import { NextRequest } from 'next/server'
import { db } from '@/db'
import {
  teams, teamMembers, users, teamWallets, teamTransactions,
  tournamentTeams, tournaments, wallets, transactions,
} from '@/db/schema'
import { eq, desc, count, sum, sql, and, ne } from 'drizzle-orm'
import { requireAdmin, apiSuccess, apiError } from '@/lib/api'
import { getTeamWallet, createTeamWallet } from '@/lib/teamWallet'
import { teamTransferCaptain, teamResetToPlayer } from '@/lib/roleGuard'

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

    // Guard: cannot transfer captaincy to or from an admin/superadmin account.
    // Uses centralized roleGuard which also logs blocked attempts.
    const [oldCaptainUser] = await db.select({ role: users.role }).from(users).where(eq(users.id, team.captainId)).limit(1)
    const [newCaptainUser] = await db.select({ role: users.role }).from(users).where(eq(users.id, newCaptainId)).limit(1)

    const transferErr = await teamTransferCaptain({
      oldCaptainId:   team.captainId,
      oldCaptainRole: oldCaptainUser?.role ?? 'player',
      newCaptainId,
      newCaptainRole: newCaptainUser?.role ?? 'player',
      route: 'PATCH /api/admin/teams/[id] transfer_captain',
    })
    if (transferErr) return apiError(transferErr, 403)

    // Update team captainId (role updates were done inside teamTransferCaptain)
    await db.update(teams)
      .set({ captainId: newCaptainId, updatedAt: new Date() })
      .where(eq(teams.id, teamId))

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

  const members    = await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId))
  const teamWallet = await getTeamWallet(teamId)
  const teamBalance  = teamWallet?.balance ?? 0
  const memberCount  = members.length

  // Snapshot member roles before the transaction removes rows
  const memberRoles = new Map<number, string>()
  for (const m of members) {
    const [u] = await db.select({ role: users.role }).from(users).where(eq(users.id, m.userId)).limit(1)
    if (u) memberRoles.set(m.userId, u.role)
  }

  await db.transaction(async (tx) => {
    // Distribute wallet balance equally among all members
    if (teamBalance > 0 && memberCount > 0) {
      const share = Math.floor(teamBalance / memberCount)
      let distributed = 0

      for (const m of members) {
        const memberShare = distributed + share <= teamBalance
          ? share
          : Math.max(0, teamBalance - distributed)
        if (memberShare <= 0) continue

        const [playerWallet] = await tx
          .select()
          .from(wallets)
          .where(eq(wallets.userId, m.userId))
          .limit(1)

        if (playerWallet) {
          const pBalBefore = playerWallet.balance
          const pBalAfter  = pBalBefore + memberShare

          await tx.update(wallets)
            .set({
              balance:     sql`${wallets.balance}     + ${memberShare}`,
              totalEarned: sql`${wallets.totalEarned} + ${memberShare}`,
              updatedAt:   new Date(),
            })
            .where(eq(wallets.userId, m.userId))

          await tx.insert(transactions).values({
            userId:        m.userId,
            type:          'team_split',
            amount:        memberShare,
            balanceBefore: pBalBefore,
            balanceAfter:  pBalAfter,
            description:   `Team ${team.name} dissolved by admin — equal share distributed`,
            meta:          { teamId },
          })

          if (teamWallet) {
            await tx.insert(teamTransactions).values({
              teamId,
              userId:        m.userId,
              type:          'team_split',
              amount:        -memberShare,
              balanceBefore: teamBalance - distributed,
              balanceAfter:  teamBalance - distributed - memberShare,
              description:   `Share paid out to member on team dissolution`,
              meta:          { userId: m.userId },
            })
          }

          distributed += memberShare
        }
      }
    }

    // Delete the team (cascades teamMembers, teamWallets, teamTransactions via FK)
    await tx.delete(teams).where(eq(teams.id, teamId))
  })

  // Reset member roles AFTER the transaction
  for (const m of members) {
    const currentRole = memberRoles.get(m.userId) ?? 'player'
    await teamResetToPlayer(m.userId, currentRole, 'DELETE /api/admin/teams/[id]')
  }

  return apiSuccess({ message: 'Team deleted and funds distributed' })
}
