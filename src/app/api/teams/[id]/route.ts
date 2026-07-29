import { NextRequest } from 'next/server'
import { db } from '@/db'
import { teams, teamMembers, users, wallets, transactions, teamWallets, teamTransactions } from '@/db/schema'
import { eq, and, ne, sql } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError } from '@/lib/api'
import { getTeamWallet, createTeamWallet } from '@/lib/teamWallet'
import { teamResetToPlayer } from '@/lib/roleGuard'

// ─── GET /api/teams/[id] ─────────────────────────────────────────────────────
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const teamId = parseInt(id)
  if (isNaN(teamId)) return apiError('Invalid team ID', 400)

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return apiError('Team not found', 404)

  const members = await db
    .select({
      id:             users.id,
      gameName:       users.gameName,
      gameUid:        users.gameUid,
      profilePicture: users.profilePicture,
      role:           users.role,
      joinedAt:       teamMembers.joinedAt,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId))

  // Auto-create wallet if missing (handles legacy teams)
  let teamWallet = await getTeamWallet(teamId)
  if (!teamWallet) teamWallet = await createTeamWallet(teamId)

  return apiSuccess({
    team: {
      ...team,
      walletBalance: teamWallet.balance,
      members,
    },
  })
}

// ─── PATCH /api/teams/[id] ───────────────────────────────────────────────────
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const { id } = await params
  const teamId = parseInt(id)
  if (isNaN(teamId)) return apiError('Invalid team ID', 400)

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return apiError('Team not found', 404)

  if (team.captainId !== auth.userId && !['admin', 'superadmin'].includes(auth.role)) {
    return apiError('Only captain can edit team', 403)
  }

  const body = await request.json()
  const updates: Partial<typeof teams.$inferInsert> = {}

  if (body.name) {
    const nameTaken = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.name, body.name.trim()), ne(teams.id, teamId)))
      .limit(1)
    if (nameTaken.length > 0) return apiError('Team name already taken', 409)
    updates.name = body.name.trim()
  }
  if (body.logo !== undefined) updates.logo = body.logo
  updates.updatedAt = new Date()

  const [updated] = await db.update(teams).set(updates).where(eq(teams.id, teamId)).returning()
  return apiSuccess({ team: updated })
}

// ─── DELETE /api/teams/[id] ──────────────────────────────────────────────────
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const { id } = await params
  const teamId = parseInt(id)
  if (isNaN(teamId)) return apiError('Invalid team ID', 400)

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return apiError('Team not found', 404)

  if (team.captainId !== auth.userId && !['admin', 'superadmin'].includes(auth.role)) {
    return apiError('Only captain can delete team', 403)
  }

  const members    = await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId))
  const teamWallet = await getTeamWallet(teamId)
  const teamBalance  = teamWallet?.balance ?? 0
  const memberCount  = members.length

  // Fetch each member's current role from DB before the transaction deletes the team.
  // Role resets are done after the transaction so we work from a snapshot.
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
            description:   `Team ${team.name} dissolved — equal share distributed`,
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

  // Reset member roles AFTER the transaction — centralized guard silently skips
  // admin/superadmin accounts and logs any blocked attempt.
  for (const m of members) {
    const currentRole = memberRoles.get(m.userId) ?? 'player'
    await teamResetToPlayer(m.userId, currentRole, 'DELETE /api/teams/[id]')
  }

  return apiSuccess({ message: 'Team deleted and funds distributed to members' })
}
