import { NextRequest } from 'next/server'
import { db } from '@/db'
import {
  users, teams, teamMembers, tournaments, scrims,
  wallets, withdrawRequests, rechargeRequests, transactions,
  teamWallets, tournamentTeams,
} from '@/db/schema'
import { eq, sum, count, gte, sql, desc, and } from 'drizzle-orm'
import { requireAdmin, apiSuccess, apiError } from '@/lib/api'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const now   = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const week  = new Date(today); week.setDate(week.getDate() - 7)
  const month = new Date(today); month.setDate(month.getDate() - 30)

  // ── Core counts ────────────────────────────────────────────────────────────
  const [
    [usersStats],
    [teamsStats],
    [playersStats],
    [tournamentsStats],
    [scrimsStats],
    [pendingWithdrawals],
    [pendingRecharges],
    [totalPoints],
    [teamWalletTotal],
    [transactionTotal],
    [usersToday],
    [usersWeek],
    [teamsWeek],
  ] = await Promise.all([
    db.select({ total: count() }).from(users),
    db.select({ total: count() }).from(teams),
    db.select({ total: count() }).from(teamMembers),
    db.select({ total: count() }).from(tournaments),
    db.select({ total: count() }).from(scrims),
    db.select({ total: count() }).from(withdrawRequests).where(eq(withdrawRequests.status, 'pending')),
    db.select({ total: count() }).from(rechargeRequests).where(eq(rechargeRequests.status, 'pending')),
    db.select({ total: sum(wallets.balance) }).from(wallets),
    db.select({ total: sum(teamWallets.balance) }).from(teamWallets),
    db.select({ total: sum(transactions.amount) }).from(transactions),
    db.select({ total: count() }).from(users).where(gte(users.createdAt, today)),
    db.select({ total: count() }).from(users).where(gte(users.createdAt, week)),
    db.select({ total: count() }).from(teams).where(gte(teams.createdAt, week)),
  ])

  // ── Daily growth (last 30 days) ────────────────────────────────────────────
  const dailyUserGrowth = await db
    .select({
      date:  sql<string>`DATE(${users.createdAt})`,
      count: count(),
    })
    .from(users)
    .where(gte(users.createdAt, month))
    .groupBy(sql`DATE(${users.createdAt})`)
    .orderBy(sql`DATE(${users.createdAt})`)

  const dailyTeamGrowth = await db
    .select({
      date:  sql<string>`DATE(${teams.createdAt})`,
      count: count(),
    })
    .from(teams)
    .where(gte(teams.createdAt, month))
    .groupBy(sql`DATE(${teams.createdAt})`)
    .orderBy(sql`DATE(${teams.createdAt})`)

  // ── Tournament registrations last 30 days ──────────────────────────────────
  const dailyTournamentRegs = await db
    .select({
      date:  sql<string>`DATE(${tournamentTeams.registeredAt})`,
      count: count(),
    })
    .from(tournamentTeams)
    .where(gte(tournamentTeams.registeredAt, month))
    .groupBy(sql`DATE(${tournamentTeams.registeredAt})`)
    .orderBy(sql`DATE(${tournamentTeams.registeredAt})`)

  // ── Recharge revenue last 30 days ─────────────────────────────────────────
  const dailyRecharges = await db
    .select({
      date:  sql<string>`DATE(${rechargeRequests.createdAt})`,
      count: count(),
      totalPoints: sum(rechargeRequests.amountPoints),
    })
    .from(rechargeRequests)
    .where(and(
      gte(rechargeRequests.createdAt, month),
      eq(rechargeRequests.status, 'approved'),
    ))
    .groupBy(sql`DATE(${rechargeRequests.createdAt})`)
    .orderBy(sql`DATE(${rechargeRequests.createdAt})`)

  // ── Withdrawal stats last 30 days ─────────────────────────────────────────
  const dailyWithdrawals = await db
    .select({
      date:   sql<string>`DATE(${withdrawRequests.createdAt})`,
      count:  count(),
      totalPoints: sum(withdrawRequests.amountPoints),
    })
    .from(withdrawRequests)
    .where(and(
      gte(withdrawRequests.createdAt, month),
      eq(withdrawRequests.status, 'approved'),
    ))
    .groupBy(sql`DATE(${withdrawRequests.createdAt})`)
    .orderBy(sql`DATE(${withdrawRequests.createdAt})`)

  // ── Most active players (by tournaments) ──────────────────────────────────
  const topPlayers = await db
    .select({
      userId:       users.id,
      gameName:     users.gameName,
      profilePicture: users.profilePicture,
      tournaments:  count(tournamentTeams.id),
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .leftJoin(tournamentTeams, eq(teamMembers.teamId, tournamentTeams.teamId))
    .groupBy(users.id)
    .orderBy(sql`count(${tournamentTeams.id}) DESC`)
    .limit(10)

  // ── Top teams by wallet balance ────────────────────────────────────────────
  const topTeams = await db
    .select({
      id:           teams.id,
      name:         teams.name,
      logo:         teams.logo,
      walletBalance: teamWallets.balance,
      memberCount:  count(teamMembers.id),
    })
    .from(teams)
    .leftJoin(teamWallets, eq(teams.id, teamWallets.teamId))
    .leftJoin(teamMembers, eq(teams.id, teamMembers.teamId))
    .groupBy(teams.id, teamWallets.balance)
    .orderBy(desc(sql`coalesce(${teamWallets.balance}, 0)`))
    .limit(10)

  const totalCirculation = Number(totalPoints.total ?? 0)
  const totalTeamWallets = Number(teamWalletTotal.total ?? 0)

  return apiSuccess({
    stats: {
      users:                   usersStats.total,
      teams:                   teamsStats.total,
      players:                 playersStats.total,
      tournaments:             tournamentsStats.total,
      scrims:                  scrimsStats.total,
      pendingWithdrawals:      pendingWithdrawals.total,
      pendingRecharges:        pendingRecharges.total,
      totalPointsInCirculation: totalCirculation,
      totalTeamWalletBalance:  totalTeamWallets,
      revenue:                 (totalCirculation / 100).toFixed(2),
      newUsersToday:           usersToday.total,
      newUsersThisWeek:        usersWeek.total,
      newTeamsThisWeek:        teamsWeek.total,
    },
    charts: {
      dailyUserGrowth,
      dailyTeamGrowth,
      dailyTournamentRegs,
      dailyRecharges,
      dailyWithdrawals,
    },
    topPlayers,
    topTeams,
  })
}
