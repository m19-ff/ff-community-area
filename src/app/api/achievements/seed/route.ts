import { NextRequest } from 'next/server'
import { db } from '@/db'
import { achievements } from '@/db/schema'
import { apiSuccess } from '@/lib/api'
import { DEFAULT_ACHIEVEMENTS } from '../route'

export async function GET(_request: NextRequest) {
  const existing = await db.select({ key: achievements.key }).from(achievements)
  const existingKeys = new Set(existing.map(e => e.key))
  const toInsert = DEFAULT_ACHIEVEMENTS.filter(a => !existingKeys.has(a.key))
  if (toInsert.length > 0) {
    await db.insert(achievements).values(toInsert as typeof achievements.$inferInsert[])
  }
  return apiSuccess({ seeded: toInsert.length, total: existing.length + toInsert.length })
}
