import { NextRequest } from 'next/server'
import { db } from '@/db'
import { users, wallets, teamMembers, teams } from '@/db/schema'
import { eq, like, desc, and, count } from 'drizzle-orm'
import { requireAdmin, apiSuccess, apiError, paginate } from '@/lib/api'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const search = searchParams.get('search') || ''
  const { limit: take, offset, page: pg } = paginate(page, 20)

  const conditions = search ? like(users.gameName, `%${search}%`) : undefined

  const list = await db.select({
    id: users.id,
    email: users.email,
    role: users.role,
    gameName: users.gameName,
    gameUid: users.gameUid,
    profilePicture: users.profilePicture,
    profileCompleted: users.profileCompleted,
    emailVerified: users.emailVerified,
    isBanned: users.isBanned,
    firstName: users.firstName,
    lastName: users.lastName,
    createdAt: users.createdAt,
    lastLoginAt: users.lastLoginAt,
  })
    .from(users)
    .where(conditions)
    .orderBy(desc(users.createdAt))
    .limit(take)
    .offset(offset)

  const [{ total }] = await db.select({ total: count() }).from(users).where(conditions)

  return apiSuccess({ users: list, pagination: { page: pg, limit: take, total, pages: Math.ceil(total / take) } })
}
