import { NextRequest } from 'next/server'
import { db } from '@/db'
import { teams, teamMembers, users, wallets, transactions, teamWallets } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError } from '@/lib/api'
import { getTeamWallet, addTeamTransaction } from '@/lib/teamWallet'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const teamId = parseInt(id)

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return apiError('Team not found', 404)

  const members = await db.select({
    id: users.id,
    gameName: users.gameName,
    gameUid: users.gameUid,
    profilePicture: users.profilePicture,
    role: users.role,
    joinedAt: teamMembers.joinedAt,
  })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId))

  // Attach team wallet balance
  const teamWallet = await getTeamWallet(teamId)

  const captain = members.find(m => m.id === team.captainId)

  return apiSuccess({
    team: {
      ...team,
      walletBalance: teamWallet?.balance ?? 0,
      members,
      captain,
    },
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)
  const { id } = await params
  const teamId = parseInt(id)

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return apiError('Team not found', 404)
  if (team.captainId !== auth.userId && !['admin', 'superadmin'].includes(auth.role)) {
    return apiError('Only captain can edit team', 403)
  }

  const body = await request.json()
  const updates: Partial<typeof teams.$inferInsert> = {}
  if (body.name) {
    const nameTaken = await db.select().from(teams)
      .where(and(eq(teams.name, body.name.trim()), eq(teams.id, teamId))).limit(1)
    updates.name = body.name.trim()
  }
  if (body.logo !== undefined) updates.logo = body.logo
  updates.updatedAt = new Date()

  const [updated] = await db.update(teams).set(updates).where(eq(teams.id, teamId)).returning()
  return apiSuccess({ team: updated })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)
  const { id } = await params
  const teamId = parseInt(id)

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return apiError('Team not found', 404)
  if (team.captainId !== auth.userId && !['admin', 'superadmin'].includes(auth.role)) {
    return apiError('Only captain can delete team', 403)
  }

  // Fetch all members before deletion
  const members = await db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId))

  // Distribute team wallet balance equally among all members
  const teamWallet = await getTeamWallet(teamId)
  const teamBalance = teamWallet?.balance ?? 0
  const memberCount = members.length

  if (teamBalance > 0 && memberCount > 0) {
    const share = Math.floor(teamBalance / memberCount)
    let distributed = 0

    for (const m of members) {
      const memberShare = distributed + share <= teamBalance ? share : Math.max(0, teamBalance - distributed)
      if (memberShare <= 0) continue

      const [playerWallet] = await db.select().from(wallets).where(eq(wallets.userId, m.userId)).limit(1)
      if (playerWallet) {
        const pBalBefore = playerWallet.balance
        const pBalAfter = pBalBefore + memberShare

        await db.update(wallets)
          .set({
            balance: sql`${wallets.balance} + ${memberShare}`,
            totalEarned: sql`${wallets.totalEarned} + ${memberShare}`,
            updatedAt: new Date(),
          })
          .where(eq(wallets.userId, m.userId))

        await db.insert(transactions).values({
          userId: m.userId,
          type: 'team_split',
          amount: memberShare,
          balanceBefore: pBalBefore,
          balanceAfter: pBalAfter,
          description: `Team ${team.name} dissolved — equal share distributed`,
          meta: { teamId },
        })

        // Record team_transaction for each payout
        if (teamWallet) {
          await addTeamTransaction({
            teamId,
            userId: m.userId,
            type: 'team_split',
            amount: -memberShare,
            balanceBefore: teamBalance - distributed,
            balanceAfter: teamBalance - distributed - memberShare,
            description: `Share paid out to member on team dissolution`,
            meta: { userId: m.userId },
          })
        }

        distributed += memberShare
      }
    }
  }

  // Reset member roles to player
  for (const m of members) {
    await db.update(users).set({ role: 'player' }).where(eq(users.id, m.userId))
  }

  // Delete team (cascades teamMembers, teamWallets, teamTransactions)
  await db.delete(teams).where(eq(teams.id, teamId))

  return apiSuccess({ message: 'Team deleted and funds distributed to members' })
}
