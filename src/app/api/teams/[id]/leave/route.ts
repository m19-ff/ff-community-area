import { NextRequest } from 'next/server'
import { db } from '@/db'
import { teams, teamMembers, users, wallets, transactions, notifications, teamWallets, teamTransactions } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError } from '@/lib/api'
import { getTeamWallet, addTeamTransaction } from '@/lib/teamWallet'

/**
 * POST /api/teams/[id]/leave
 *
 * Non-captain member leaves their team.
 * Their equal share of the team wallet balance is returned to their personal wallet.
 * Captains cannot leave — they must delete the team.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const { id } = await params
  const teamId = parseInt(id)
  if (isNaN(teamId)) return apiError('Invalid team ID', 400)

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return apiError('Team not found', 404)

  if (team.captainId === auth.userId) {
    return apiError('Captains cannot leave their own team — delete the team instead.', 403)
  }

  const [membership] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, auth.userId)))
    .limit(1)

  if (!membership) return apiError('You are not a member of this team', 400)

  // Count members before removal
  const allMembers = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId))

  const memberCount = allMembers.length
  const teamWallet  = await getTeamWallet(teamId)
  const teamBalance = teamWallet?.balance ?? 0
  const share       = memberCount > 0 ? Math.floor(teamBalance / memberCount) : 0

  let shareReceived = 0

  await db.transaction(async (tx) => {
    if (share > 0 && teamWallet) {
      const teamBalBefore = teamWallet.balance
      const teamBalAfter  = teamBalBefore - share

      // Deduct from team wallet
      await tx.update(teamWallets)
        .set({
          balance:    sql`${teamWallets.balance}    - ${share}`,
          totalSpent: sql`${teamWallets.totalSpent} + ${share}`,
          updatedAt:  new Date(),
        })
        .where(eq(teamWallets.teamId, teamId))

      await tx.insert(teamTransactions).values({
        teamId,
        userId:        auth.userId,
        type:          'team_split',
        amount:        -share,
        balanceBefore: teamBalBefore,
        balanceAfter:  teamBalAfter,
        description:   `Equal share paid out to player on leaving team`,
        meta:          { userId: auth.userId },
      })

      // Credit player's personal wallet
      const [playerWallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, auth.userId))
        .limit(1)

      if (playerWallet) {
        const pBalBefore = playerWallet.balance
        const pBalAfter  = pBalBefore + share

        await tx.update(wallets)
          .set({
            balance:     sql`${wallets.balance}     + ${share}`,
            totalEarned: sql`${wallets.totalEarned} + ${share}`,
            updatedAt:   new Date(),
          })
          .where(eq(wallets.userId, auth.userId))

        await tx.insert(transactions).values({
          userId:        auth.userId,
          type:          'team_split',
          amount:        share,
          balanceBefore: pBalBefore,
          balanceAfter:  pBalAfter,
          description:   `Equal share received from team wallet on leaving ${team.name}`,
          meta:          { teamId },
        })

        shareReceived = share
      }
    }

    // Remove from team
    await tx.delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, auth.userId)))

    // Reset role to player — but NEVER downgrade admin/superadmin accounts.
    if (!['admin', 'superadmin'].includes(auth.role)) {
      await tx.update(users).set({ role: 'player' }).where(eq(users.id, auth.userId))
    }
  })

  // Notify captain (outside transaction — non-critical)
  const [leavingUser] = await db.select({ gameName: users.gameName }).from(users).where(eq(users.id, auth.userId)).limit(1)
  await db.insert(notifications).values({
    userId: team.captainId,
    type:   'general',
    title:  'Player Left',
    body:   `${leavingUser?.gameName || 'A player'} has left your team ${team.name}.`,
    data:   { teamId, userId: auth.userId },
  })

  return apiSuccess({
    message:       `You have left ${team.name}`,
    shareReceived,
  })
}
