import { db } from '@/db'
import { teams, teamMembers, wallets } from '@/db/schema'
import { eq, inArray, sql, sum } from 'drizzle-orm'

/**
 * Recalculates team.points = SUM(wallet.balance) for all current members.
 * Use after any membership change (join / leave / dissolve).
 */
export async function syncTeamPoints(teamId: number): Promise<void> {
  const members = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId))

  if (members.length === 0) {
    await db.update(teams)
      .set({ points: 0, updatedAt: new Date() })
      .where(eq(teams.id, teamId))
    return
  }

  const userIds = members.map((m) => m.userId)

  const [{ total }] = await db
    .select({ total: sum(wallets.balance) })
    .from(wallets)
    .where(inArray(wallets.userId, userIds))

  await db.update(teams)
    .set({ points: Number(total ?? 0), updatedAt: new Date() })
    .where(eq(teams.id, teamId))
}

/**
 * Adjusts team.points by `delta` for whichever team `userId` currently belongs to.
 * Use after any wallet balance change (earn ad, recharge, withdraw, admin award/deduct).
 * No-op if the user is not a member of any team.
 */
export async function adjustTeamPointsForUser(
  userId: number,
  delta: number,
): Promise<void> {
  if (delta === 0) return

  const [membership] = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
    .limit(1)

  if (!membership) return

  await db.update(teams)
    .set({
      points: sql`${teams.points} + ${delta}`,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, membership.teamId))
}
