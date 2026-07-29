import { NextRequest } from 'next/server'
import { db } from '@/db'
import { achievements, userAchievements } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { apiSuccess, requireAuth } from '@/lib/api'

// Default achievement definitions
export const DEFAULT_ACHIEVEMENTS = [
  { key: 'first_tournament',  name: 'First Battle',       description: 'Participate in your first tournament',      icon: '🎮', condition: { type: 'tournaments', value: 1 },     points: 50,   rarity: 'common' },
  { key: 'first_victory',     name: 'First Victory',      description: 'Win your first tournament',                 icon: '🥇', condition: { type: 'wins', value: 1 },            points: 200,  rarity: 'rare' },
  { key: '10_wins',           name: 'Veteran',            description: 'Win 10 tournaments',                        icon: '⚔️', condition: { type: 'wins', value: 10 },           points: 500,  rarity: 'epic' },
  { key: '50_wins',           name: 'Champion',           description: 'Win 50 tournaments',                        icon: '👑', condition: { type: 'wins', value: 50 },           points: 2000, rarity: 'legendary' },
  { key: '100_ads',           name: 'Ad Watcher',         description: 'Watch 100 ads total',                       icon: '📺', condition: { type: 'ads', value: 100 },           points: 100,  rarity: 'common' },
  { key: '1000_pts',          name: 'Point Collector',    description: 'Earn 1,000 points in total',                icon: '💰', condition: { type: 'points_earned', value: 1000 }, points: 100,  rarity: 'common' },
  { key: '10000_pts',         name: 'Point Master',       description: 'Earn 10,000 points in total',               icon: '💎', condition: { type: 'points_earned', value: 10000 },points: 500,  rarity: 'rare' },
  { key: 'collector',         name: 'Collector',          description: 'Unlock 5 achievements',                     icon: '🎯', condition: { type: 'achievements', value: 5 },    points: 300,  rarity: 'rare' },
  { key: 'elite_captain',     name: 'Elite Captain',      description: 'Captain a team that wins 5 tournaments',    icon: '🛡️', condition: { type: 'captain_wins', value: 5 },    points: 1000, rarity: 'epic' },
  { key: '5_tournaments',     name: 'Battle-Hardened',    description: 'Participate in 5 tournaments',              icon: '🏟️', condition: { type: 'tournaments', value: 5 },     points: 150,  rarity: 'common' },
  { key: '25_tournaments',    name: 'Warrior',            description: 'Participate in 25 tournaments',             icon: '⚡', condition: { type: 'tournaments', value: 25 },    points: 400,  rarity: 'rare' },
  { key: 'top3_finish',       name: 'Podium',             description: 'Finish in the top 3',                       icon: '🥉', condition: { type: 'top3', value: 1 },            points: 100,  rarity: 'common' },
] as const

export async function GET(request: NextRequest) {
  const authUser = await requireAuth(request)
  const { searchParams } = new URL(request.url)
  const userId = parseInt(searchParams.get('userId') || String(authUser?.userId || 0))

  const all = await db.select().from(achievements).orderBy(achievements.points)
  const unlocked = userId ? await db
    .select({ achievementId: userAchievements.achievementId, unlockedAt: userAchievements.unlockedAt })
    .from(userAchievements)
    .where(eq(userAchievements.userId, userId))
  : []

  const unlockedSet = new Set(unlocked.map(u => u.achievementId))
  const unlockedMap = Object.fromEntries(unlocked.map(u => [u.achievementId, u.unlockedAt]))

  return apiSuccess({
    achievements: all.map(a => ({
      ...a,
      unlocked: unlockedSet.has(a.id),
      unlockedAt: unlockedMap[a.id] || null,
    }))
  })
}

/** Seed default achievements if table is empty */
export async function PUT(_request: NextRequest) {
  const existing = await db.select({ key: achievements.key }).from(achievements)
  const existingKeys = new Set(existing.map(e => e.key))

  const toInsert = DEFAULT_ACHIEVEMENTS.filter(a => !existingKeys.has(a.key))
  if (toInsert.length > 0) {
    await db.insert(achievements).values(toInsert)
  }
  return apiSuccess({ seeded: toInsert.length, message: `Seeded ${toInsert.length} achievements` })
}
