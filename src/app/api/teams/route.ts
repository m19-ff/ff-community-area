import { NextRequest } from 'next/server'
import { db } from '@/db'
import { teams, teamMembers, users, teamWallets } from '@/db/schema'
import { eq, like, desc, count, sql, and } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError, paginate } from '@/lib/api'
import { createTeamWallet } from '@/lib/teamWallet'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const search = searchParams.get('search') || ''
  const { limit: take, offset } = paginate(page, limit)

  const conditions = search ? like(teams.name, `%${search}%`) : undefined

  const teamList = await db.select({
    id: teams.id,
    name: teams.name,
    logo: teams.logo,
    walletBalance: sql<number>`coalesce(${teamWallets.balance}, 0)`,
    captainId: teams.captainId,
    totalTournaments: teams.totalTournaments,
    createdAt: teams.createdAt,
    memberCount: count(teamMembers.id),
  })
    .from(teams)
    .leftJoin(teamMembers, eq(teams.id, teamMembers.teamId))
    .leftJoin(teamWallets, eq(teams.id, teamWallets.teamId))
    .where(conditions)
    .groupBy(teams.id, teamWallets.balance)
    .orderBy(desc(sql`coalesce(${teamWallets.balance}, 0)`))
    .limit(take)
    .offset(offset)

  const [{ total }] = await db.select({ total: count() }).from(teams).where(conditions)

  return apiSuccess({
    teams: teamList,
    pagination: { page, limit: take, total, pages: Math.ceil(total / take) },
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  try {
    // Admin/superadmin accounts are not permitted to create player teams
    if (['admin', 'superadmin'].includes(auth.role)) {
      return apiError('Admin accounts cannot create player teams', 403)
    }

    // Check if user already in a team
    const existing = await db.select().from(teamMembers).where(eq(teamMembers.userId, auth.userId)).limit(1)
    if (existing.length > 0) return apiError('You are already in a team', 400)

    const body = await request.json()
    const { name, logo } = body
    if (!name || name.trim().length < 3) return apiError('Team name must be at least 3 characters', 400)

    // Check name uniqueness
    const nameTaken = await db.select().from(teams).where(eq(teams.name, name.trim())).limit(1)
    if (nameTaken.length > 0) return apiError('Team name already taken', 409)

    const [team] = await db.insert(teams).values({
      name: name.trim(),
      logo: logo || null,
      captainId: auth.userId,
    }).returning()

    await db.insert(teamMembers).values({ teamId: team.id, userId: auth.userId })

    // Update user role to captain — but NEVER downgrade admin/superadmin accounts.
    // Admins can own a team for management purposes while keeping their admin role.
    if (!['admin', 'superadmin'].includes(auth.role)) {
      await db.update(users).set({ role: 'captain' }).where(eq(users.id, auth.userId))
    }

    // Create team wallet
    const wallet = await createTeamWallet(team.id)

    // Return team with walletBalance so the store shape matches Team interface
    return apiSuccess({
      team: {
        id:               team.id,
        name:             team.name,
        logo:             team.logo ?? null,
        captainId:        team.captainId,
        totalTournaments: team.totalTournaments,
        walletBalance:    wallet.balance,
      },
    }, 201)
  } catch (error) {
    console.error('[teams POST]', error)
    return apiError('Failed to create team', 500)
  }
}
