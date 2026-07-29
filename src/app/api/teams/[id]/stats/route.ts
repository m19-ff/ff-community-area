import { NextRequest } from 'next/server'
import { db } from '@/db'
import { teams, teamMembers, users, teamWallets, tournamentTeams, tournaments, scrimRegistrations, scrims } from '@/db/schema'
import { eq, count, sum, sql, desc } from 'drizzle-orm'
import { apiSuccess, apiError } from '@/lib/api'
import { rateLimit } from '@/lib/security'

// GET /api/teams/[id]/stats — team profile + statistics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = await rateLimit(request, { max: 60, windowSeconds: 60 })
  if (limited) return limited

  const { id } = await params
  const teamId = parseInt(id)
  if (isNaN(teamId)) return apiError('Invalid team ID', 400)

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return apiError('Team not found', 404)

  // Members with roles
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

  // Wallet
  const [wallet] = await db
    .select()
    .from(teamWallets)
    .where(eq(teamWallets.teamId, teamId))
    .limit(1)

  // Tournament history (last 20)
  const tournamentHistory = await db
    .select({
      id:           tournaments.id,
      name:         tournaments.name,
      type:         tournaments.type,
      banner:       tournaments.banner,
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

  // Tournament stats
  const [tStats] = await db
    .select({
      total: count(),
      wins:  sql<number>`COUNT(*) FILTER (WHERE ${tournamentTeams.placement} = 1)`,
      top3:  sql<number>`COUNT(*) FILTER (WHERE ${tournamentTeams.placement} <= 3)`,
      totalPrize: sum(tournamentTeams.prizeAwarded),
    })
    .from(tournamentTeams)
    .where(eq(tournamentTeams.teamId, teamId))

  const totalTournaments = Number(tStats?.total ?? 0)
  const wins             = Number(tStats?.wins  ?? 0)
  const top3             = Number(tStats?.top3  ?? 0)
  const winRate          = totalTournaments > 0 ? Math.round((wins / totalTournaments) * 100) : 0

  // Scrim history (last 10)
  const scrimHistory = await db
    .select({
      id:          scrims.id,
      name:        scrims.name,
      mode:        scrims.mode,
      scheduledAt: scrims.scheduledAt,
      status:      scrims.status,
    })
    .from(scrimRegistrations)
    .innerJoin(scrims, eq(scrimRegistrations.scrimId, scrims.id))
    .where(eq(scrimRegistrations.teamId, teamId))
    .orderBy(desc(scrims.scheduledAt))
    .limit(10)

  return apiSuccess({
    team: {
      id:              team.id,
      name:            team.name,
      logo:            team.logo,
      captainId:       team.captainId,
      createdAt:       team.createdAt,
      totalTournaments: team.totalTournaments,
    },
    wallet: wallet
      ? { balance: wallet.balance, totalEarned: wallet.totalEarned, totalSpent: wallet.totalSpent }
      : { balance: 0, totalEarned: 0, totalSpent: 0 },
    members,
    stats: {
      tournaments: totalTournaments,
      wins,
      top3,
      winRate,
      totalPrize: Number(tStats?.totalPrize ?? 0),
      memberCount: members.length,
    },
    tournamentHistory,
    scrimHistory,
  })
}
