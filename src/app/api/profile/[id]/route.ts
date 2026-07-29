import { NextRequest } from 'next/server'
import { db } from '@/db'
import { users, wallets, teamMembers, teams, teamWallets, tournamentTeams, tournaments, withdrawRequests, transactions } from '@/db/schema'
import { eq, and, count, sum, sql } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError } from '@/lib/api'
import { rateLimit, sanitizeString } from '@/lib/security'

// GET /api/profile/[id] — public player profile
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = await rateLimit(request, { max: 60, windowSeconds: 60 })
  if (limited) return limited

  const { id } = await params
  const userId = parseInt(id)
  if (isNaN(userId)) return apiError('Invalid user ID', 400)

  const [user] = await db
    .select({
      id:             users.id,
      gameName:       users.gameName,
      gameUid:        users.gameUid,
      profilePicture: users.profilePicture,
      role:           users.role,
      createdAt:      users.createdAt,
    })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.isBanned, false)))
    .limit(1)

  if (!user) return apiError('Player not found', 404)

  // Wallet stats
  const [wallet] = await db
    .select({
      balance:       wallets.balance,
      totalEarned:   wallets.totalEarned,
      totalSpent:    wallets.totalSpent,
    })
    .from(wallets)
    .where(eq(wallets.userId, userId))
    .limit(1)

  // Total withdrawn (approved only)
  const [withdrawnRow] = await db
    .select({ total: sum(withdrawRequests.amountPoints) })
    .from(withdrawRequests)
    .where(and(eq(withdrawRequests.captainId, userId), eq(withdrawRequests.status, 'approved')))

  // Team membership
  const [membership] = await db
    .select({
      teamId:       teams.id,
      teamName:     teams.name,
      teamLogo:     teams.logo,
      captainId:    teams.captainId,
      walletBalance: teamWallets.balance,
    })
    .from(teamMembers)
    .leftJoin(teams, eq(teamMembers.teamId, teams.id))
    .leftJoin(teamWallets, eq(teams.id, teamWallets.teamId))
    .where(eq(teamMembers.userId, userId))
    .limit(1)

  // Tournament stats: count, wins (placement=1), mvp
  const tournamentStats = membership?.teamId
    ? await db
        .select({
          total: count(),
          wins:  sql<number>`COUNT(*) FILTER (WHERE ${tournamentTeams.placement} = 1)`,
          top3:  sql<number>`COUNT(*) FILTER (WHERE ${tournamentTeams.placement} <= 3)`,
        })
        .from(tournamentTeams)
        .where(eq(tournamentTeams.teamId, membership.teamId))
        .then(r => r[0])
    : { total: 0, wins: 0, top3: 0 }

  const total    = Number(tournamentStats.total ?? 0)
  const wins     = Number(tournamentStats.wins  ?? 0)
  const winRate  = total > 0 ? Math.round((wins / total) * 100) : 0

  return apiSuccess({
    profile: {
      id:             user.id,
      gameName:       user.gameName,
      gameUid:        user.gameUid,
      profilePicture: user.profilePicture,
      role:           user.role,
      joinDate:       user.createdAt,
      wallet: wallet ? {
        balance:       wallet.balance,
        totalEarned:   wallet.totalEarned,
        totalSpent:    wallet.totalSpent,
        totalWithdrawn: Number(withdrawnRow?.total ?? 0),
      } : null,
      team: membership?.teamId ? {
        id:            membership.teamId,
        name:          membership.teamName,
        logo:          membership.teamLogo,
        captainId:     membership.captainId,
        walletBalance: membership.walletBalance ?? 0,
      } : null,
      stats: {
        tournaments: total,
        wins,
        top3: Number(tournamentStats.top3 ?? 0),
        winRate,
        mvp: wins, // MVP = 1st place finishes
      },
    },
  })
}
