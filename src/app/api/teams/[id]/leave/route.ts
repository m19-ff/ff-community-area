import { NextRequest } from 'next/server'
import { db } from '@/db'
import { teams, teamMembers, users, wallets, transactions, notifications, teamWallets, teamTransactions } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError } from '@/lib/api'
import {
  getTeamWallet,
  addTeamTransaction,
} from '@/lib/teamWallet'

/**
 * POST /api/teams/[id]/leave
 *
 * Allows a non-captain member to leave their team.
 * Their equal share of the team wallet balance is returned to their personal wallet.
 * Captains cannot leave — they must delete the team instead.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const { id } = await params
  const teamId = parseInt(id)

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return apiError('Team not found', 404)

  if (team.captainId === auth.userId) {
    return apiError('Captains cannot leave their own team. Delete the team instead.', 403)
  }

  const [membership] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, auth.userId)))
    .limit(1)

  if (!membership) return apiError('You are not a member of this team', 400)

  // Count members BEFORE removal
  const allMembers = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId))

  const memberCount = allMembers.length

  // Calculate equal share from team wallet
  const teamWallet = await getTeamWallet(teamId)
  const teamBalance = teamWallet?.balance ?? 0
  const share = memberCount > 0 ? Math.floor(teamBalance / memberCount) : 0

  // Deduct share from team wallet
  if (share > 0 && teamWallet) {
    const teamBalBefore = teamWallet.balance
    const teamBalAfter = teamBalBefore - share

    await db.update(teamWallets)
      .set({
        balance: sql`${teamWallets.balance} - ${share}`,
        totalSpent: sql`${teamWallets.totalSpent} + ${share}`,
        updatedAt: new Date(),
      })
      .where(eq(teamWallets.teamId, teamId))

    await addTeamTransaction({
      teamId,
      userId: auth.userId,
      type: 'team_split',
      amount: -share,
      balanceBefore: teamBalBefore,
      balanceAfter: teamBalAfter,
      description: `Equal share paid out to player on leaving team`,
      meta: { userId: auth.userId },
    })

    // Credit player's personal wallet
    const [playerWallet] = await db.select().from(wallets).where(eq(wallets.userId, auth.userId)).limit(1)
    if (playerWallet) {
      const pBalBefore = playerWallet.balance
      const pBalAfter = pBalBefore + share

      await db.update(wallets)
        .set({
          balance: sql`${wallets.balance} + ${share}`,
          totalEarned: sql`${wallets.totalEarned} + ${share}`,
          updatedAt: new Date(),
        })
        .where(eq(wallets.userId, auth.userId))

      await db.insert(transactions).values({
        userId: auth.userId,
        type: 'team_split',
        amount: share,
        balanceBefore: pBalBefore,
        balanceAfter: pBalAfter,
        description: `Equal share received from team wallet on leaving ${team.name}`,
        meta: { teamId },
      })
    }
  }

  // Remove from team
  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, auth.userId)))

  // Reset role back to player
  await db.update(users).set({ role: 'player' }).where(eq(users.id, auth.userId))

  // Notify captain
  const [leavingUser] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1)
  await db.insert(notifications).values({
    userId: team.captainId,
    type: 'general',
    title: 'Player Left',
    body: `${leavingUser?.gameName || 'A player'} has left your team ${team.name}.`,
    data: { teamId, userId: auth.userId },
  })

  return apiSuccess({
    message: `You have left ${team.name}`,
    shareReceived: share,
  })
}
