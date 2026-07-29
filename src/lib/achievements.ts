/**
 * Achievement unlock engine.
 * Call checkAndUnlockAchievements(userId) after any significant event.
 */
import { db } from '@/db'
import { achievements, userAchievements, wallets, teamMembers, teams, tournamentTeams, users, playerStats } from '@/db/schema'
import { eq, sql, count, inArray } from 'drizzle-orm'
import { sendPushToUsers } from './fcm'

export async function checkAndUnlockAchievements(userId: number): Promise<void> {
  try {
    // Gather current stats for this user
    const [wallet]      = await db.select({ totalEarned: wallets.totalEarned }).from(wallets).where(eq(wallets.userId, userId))
    const [user]        = await db.select({ role: users.role }).from(users).where(eq(users.id, userId))
    const [pStats]      = await db.select({ adWatchedTotal: playerStats.adWatchedTotal }).from(playerStats).where(eq(playerStats.userId, userId))
    if (!user) return

    // Tournament participations & wins for this user's teams
    const memberOf = await db.select({ teamId: teamMembers.teamId }).from(teamMembers).where(eq(teamMembers.userId, userId))
    const teamIds = memberOf.map(m => m.teamId)

    let totalTournaments = 0
    let totalWins = 0
    let top3Count = 0

    if (teamIds.length > 0) {
      const tStats = await db
        .select({
          total: count(),
          wins:  sql<number>`COUNT(*) FILTER (WHERE ${tournamentTeams.placement} = 1)`,
          top3:  sql<number>`COUNT(*) FILTER (WHERE ${tournamentTeams.placement} <= 3)`,
        })
        .from(tournamentTeams)
        .where(inArray(tournamentTeams.teamId, teamIds))

      if (tStats[0]) {
        totalTournaments = Number(tStats[0].total) || 0
        totalWins        = Number(tStats[0].wins)  || 0
        top3Count        = Number(tStats[0].top3)  || 0
      }
    }

    // Captain wins
    const captainTeams = await db.select({ id: teams.id }).from(teams).where(eq(teams.captainId, userId))
    let captainWins = 0
    if (captainTeams.length > 0) {
      const cIds = captainTeams.map(t => t.id)
      const cStats = await db
        .select({ wins: sql<number>`COUNT(*) FILTER (WHERE ${tournamentTeams.placement} = 1)` })
        .from(tournamentTeams)
        .where(inArray(tournamentTeams.teamId, cIds))
      captainWins = Number(cStats[0]?.wins) || 0
    }

    // Unlocked achievement count
    const [{ unlocked }] = await db
      .select({ unlocked: count() })
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId))

    const stats = {
      tournaments:    totalTournaments,
      wins:           totalWins,
      top3:           top3Count,
      ads:            pStats?.adWatchedTotal ?? 0,
      points_earned:  wallet?.totalEarned || 0,
      achievements:   Number(unlocked) || 0,
      captain_wins:   captainWins,
    }

    // Load all achievements and already-unlocked ones
    const allAchievements = await db.select().from(achievements)
    const alreadyUnlocked = await db
      .select({ achievementId: userAchievements.achievementId })
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId))
    const unlockedSet = new Set(alreadyUnlocked.map(u => u.achievementId))

    const toUnlock: typeof allAchievements = []

    for (const ach of allAchievements) {
      if (unlockedSet.has(ach.id)) continue
      const cond = ach.condition as { type: string; value: number }
      if (!cond?.type) continue
      const stat = stats[cond.type as keyof typeof stats] ?? 0
      if (stat >= cond.value) {
        toUnlock.push(ach)
      }
    }

    if (toUnlock.length === 0) return

    // Insert new unlocks
    await db.insert(userAchievements).values(
      toUnlock.map(a => ({ userId, achievementId: a.id }))
    ).onConflictDoNothing()

    // Send push notifications for each new achievement
    for (const ach of toUnlock) {
      await sendPushToUsers({
        userIds: [userId],
        payload: {
          title: `🏆 Achievement Unlocked!`,
          body:  `${ach.icon} ${ach.name} — ${ach.description}`,
          data:  { deepLink: '/player-profile', achievementKey: ach.key },
        },
        notifType: 'general',
        notifData: { achievementKey: ach.key, achievementName: ach.name, deepLink: '/player-profile' },
      })
    }
  } catch (e) {
    // Non-critical — never block main request
    console.warn('Achievement check failed:', (e as Error).message)
  }
}
