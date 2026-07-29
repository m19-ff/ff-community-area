import { NextRequest } from 'next/server'
import { db } from '@/db'
import { teams, teamWallets, teamMembers, users, wallets, tournamentTeams, transactions } from '@/db/schema'
import { eq, desc, sql, and, gte } from 'drizzle-orm'
import { apiSuccess, apiError } from '@/lib/api'

function getPeriodStart(period: string): Date | null {
  const now = new Date()
  if (period === 'daily') {
    const d = new Date(now); d.setHours(0, 0, 0, 0); return d
  }
  if (period === 'weekly') {
    const d = new Date(now); d.setDate(d.getDate() - 7); return d
  }
  if (period === 'monthly') {
    const d = new Date(now); d.setDate(d.getDate() - 30); return d
  }
  return null // all_time
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') || 'top_teams'
  const period   = searchParams.get('period')   || 'all_time'
  const limit    = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

  const since = getPeriodStart(period)

  switch (category) {
    case 'top_teams': {
      // Teams ranked by tournament wins
      const rows = await db
        .select({
          id:          teams.id,
          name:        teams.name,
          logo:        teams.logo,
          totalWins:   teams.totalWins,
          totalTournaments: teams.totalTournaments,
          points:      teams.points,
        })
        .from(teams)
        .where(eq(teams.isActive, true))
        .orderBy(desc(teams.totalWins), desc(teams.points))
        .limit(limit)
      return apiSuccess({ leaderboard: rows.map((r, i) => ({ rank: i + 1, ...r })) })
    }

    case 'top_players': {
      // Players ranked by tournament wins
      const rows = await db
        .select({
          id:       users.id,
          gameName: users.gameName,
          gameUid:  users.gameUid,
          profilePicture: users.profilePicture,
          wins: sql<number>`COUNT(*) FILTER (WHERE ${tournamentTeams.placement} = 1)`,
          totalMatches: sql<number>`COUNT(DISTINCT ${tournamentTeams.tournamentId})`,
        })
        .from(users)
        .leftJoin(teamMembers, eq(teamMembers.userId, users.id))
        .leftJoin(tournamentTeams, eq(tournamentTeams.teamId, teamMembers.teamId))
        .where(eq(users.isBanned, false))
        .groupBy(users.id)
        .orderBy(desc(sql<number>`COUNT(*) FILTER (WHERE ${tournamentTeams.placement} = 1)`))
        .limit(limit)
      return apiSuccess({ leaderboard: rows.map((r, i) => ({ rank: i + 1, ...r })) })
    }

    case 'top_wallets': {
      // Teams ranked by wallet balance
      const rows = await db
        .select({
          id:      teams.id,
          name:    teams.name,
          logo:    teams.logo,
          balance: teamWallets.balance,
          totalEarned: teamWallets.totalEarned,
        })
        .from(teams)
        .innerJoin(teamWallets, eq(teamWallets.teamId, teams.id))
        .where(eq(teams.isActive, true))
        .orderBy(desc(teamWallets.balance))
        .limit(limit)
      return apiSuccess({ leaderboard: rows.map((r, i) => ({ rank: i + 1, ...r })) })
    }

    case 'top_winners': {
      // Teams ranked by prize earned
      const rows = await db
        .select({
          id:      teams.id,
          name:    teams.name,
          logo:    teams.logo,
          totalWins: teams.totalWins,
          prizeEarned: sql<number>`COALESCE(SUM(${tournamentTeams.prizeAwarded}), 0)`,
        })
        .from(teams)
        .leftJoin(tournamentTeams, eq(tournamentTeams.teamId, teams.id))
        .where(eq(teams.isActive, true))
        .groupBy(teams.id)
        .orderBy(desc(sql<number>`COALESCE(SUM(${tournamentTeams.prizeAwarded}), 0)`))
        .limit(limit)
      return apiSuccess({ leaderboard: rows.map((r, i) => ({ rank: i + 1, ...r })) })
    }

    case 'top_mvp': {
      // Players ranked by kills (from transactions, proxy by ad earnings)
      // We use wallet totalEarned as a proxy for activity until match stats exist
      const rows = await db
        .select({
          id:       users.id,
          gameName: users.gameName,
          gameUid:  users.gameUid,
          profilePicture: users.profilePicture,
          totalEarned: wallets.totalEarned,
          wins: sql<number>`COUNT(*) FILTER (WHERE ${tournamentTeams.placement} = 1)`,
        })
        .from(users)
        .leftJoin(wallets, eq(wallets.userId, users.id))
        .leftJoin(teamMembers, eq(teamMembers.userId, users.id))
        .leftJoin(tournamentTeams, eq(tournamentTeams.teamId, teamMembers.teamId))
        .where(eq(users.isBanned, false))
        .groupBy(users.id, wallets.totalEarned)
        .orderBy(desc(sql<number>`COUNT(*) FILTER (WHERE ${tournamentTeams.placement} = 1)`), desc(wallets.totalEarned))
        .limit(limit)
      return apiSuccess({ leaderboard: rows.map((r, i) => ({ rank: i + 1, ...r })) })
    }

    case 'top_earners': {
      // Players ranked by total ad earnings
      const baseQuery = db
        .select({
          id:       users.id,
          gameName: users.gameName,
          gameUid:  users.gameUid,
          profilePicture: users.profilePicture,
          adEarnings: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
        })
        .from(users)
        .leftJoin(transactions, and(
          eq(transactions.userId, users.id),
          eq(transactions.type, 'earn_ad'),
          since ? gte(transactions.createdAt, since) : sql`1=1`,
        ))
        .where(eq(users.isBanned, false))
        .groupBy(users.id)
        .orderBy(desc(sql<number>`COALESCE(SUM(${transactions.amount}), 0)`))
        .limit(limit)
      const rows = await baseQuery
      return apiSuccess({ leaderboard: rows.map((r, i) => ({ rank: i + 1, ...r })) })
    }

    default:
      return apiSuccess({ leaderboard: [] })
  }
}
