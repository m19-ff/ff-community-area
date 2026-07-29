import { NextRequest } from 'next/server'
import { db } from '@/db'
import { teams, teamMembers, users, teamWallets } from '@/db/schema'
import { eq, ilike, or, desc, asc, count, sql } from 'drizzle-orm'
import { requireAdmin, apiSuccess, apiError, paginate } from '@/lib/api'
import type { SQL } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const { searchParams } = new URL(request.url)
  const page    = parseInt(searchParams.get('page')   || '1')
  const limit   = parseInt(searchParams.get('limit')  || '20')
  const search  = searchParams.get('search')  || ''
  const filter  = searchParams.get('filter')  || 'all'   // all | active | inactive
  const sortBy  = searchParams.get('sortBy')  || 'createdAt' // createdAt | walletBalance | wins
  const sortDir = searchParams.get('sortDir') || 'desc'

  const { limit: take, offset } = paginate(page, limit)

  // ── Build WHERE clause ─────────────────────────────────────────────────────
  const whereParts: SQL[] = []

  if (filter === 'active') {
    whereParts.push(sql`${teams.isActive} = true`)
  } else if (filter === 'inactive') {
    whereParts.push(sql`${teams.isActive} = false`)
  }

  if (search) {
    // Find captain IDs matching the search term
    const matchedCaptains = await db
      .select({ id: users.id })
      .from(users)
      .where(
        or(
          ilike(users.gameName, `%${search}%`),
          ilike(users.email,    `%${search}%`),
        ),
      )
    const captainIdList = matchedCaptains.map(u => u.id)

    if (captainIdList.length > 0) {
      whereParts.push(
        sql`(${teams.name} ILIKE ${'%' + search + '%'} OR ${teams.captainId} = ANY(ARRAY[${sql.join(
          captainIdList.map(cid => sql`${cid}::int`),
          sql`, `,
        )}]))`,
      )
    } else {
      whereParts.push(sql`${teams.name} ILIKE ${'%' + search + '%'}`)
    }
  }

  const whereClause = whereParts.length > 0
    ? sql.join(whereParts, sql` AND `)
    : undefined

  // ── Sorting ────────────────────────────────────────────────────────────────
  let orderExpr: SQL
  if (sortBy === 'walletBalance') {
    orderExpr = sortDir === 'asc'
      ? sql`coalesce(${teamWallets.balance}, 0) ASC`
      : sql`coalesce(${teamWallets.balance}, 0) DESC`
  } else if (sortBy === 'wins') {
    orderExpr = sortDir === 'asc'
      ? sql`${teams.totalWins} ASC`
      : sql`${teams.totalWins} DESC`
  } else {
    orderExpr = sortDir === 'asc'
      ? sql`${teams.createdAt} ASC`
      : sql`${teams.createdAt} DESC`
  }

  // ── Main query ─────────────────────────────────────────────────────────────
  const teamList = await db
    .select({
      id:               teams.id,
      name:             teams.name,
      logo:             teams.logo,
      captainId:        teams.captainId,
      points:           teams.points,
      totalWins:        teams.totalWins,
      totalTournaments: teams.totalTournaments,
      isActive:         teams.isActive,
      createdAt:        teams.createdAt,
      updatedAt:        teams.updatedAt,
      walletBalance:    sql<number>`coalesce(${teamWallets.balance}, 0)`,
      memberCount:      count(teamMembers.id),
      captainName:      users.gameName,
      captainEmail:     users.email,
      captainPicture:   users.profilePicture,
    })
    .from(teams)
    .leftJoin(teamMembers, eq(teams.id,        teamMembers.teamId))
    .leftJoin(teamWallets, eq(teams.id,        teamWallets.teamId))
    .leftJoin(users,       eq(teams.captainId, users.id))
    .where(whereClause)
    .groupBy(
      teams.id,
      teamWallets.balance,
      users.gameName,
      users.email,
      users.profilePicture,
    )
    .orderBy(orderExpr)
    .limit(take)
    .offset(offset)

  const [{ total }] = await db
    .select({ total: count() })
    .from(teams)
    .where(whereClause)

  return apiSuccess({
    teams: teamList,
    pagination: { page, limit: take, total, pages: Math.ceil(total / take) },
  })
}
