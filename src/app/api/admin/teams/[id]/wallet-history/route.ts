import { NextRequest } from 'next/server'
import { db } from '@/db'
import { teams, teamTransactions, users } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAdmin, apiSuccess, apiError, paginate } from '@/lib/api'

/**
 * GET /api/admin/teams/[id]/wallet-history
 *
 * Returns paginated team_transactions for any team (admin only).
 * Includes the name + email of the user who triggered each transaction.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const { id } = await params
  const teamId = parseInt(id)
  if (isNaN(teamId)) return apiError('Invalid team ID', 400)

  const [team] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return apiError('Team not found', 404)

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const { limit: take, offset } = paginate(page, 30)

  const rows = await db
    .select({
      id:            teamTransactions.id,
      type:          teamTransactions.type,
      amount:        teamTransactions.amount,
      balanceBefore: teamTransactions.balanceBefore,
      balanceAfter:  teamTransactions.balanceAfter,
      description:   teamTransactions.description,
      meta:          teamTransactions.meta,
      createdAt:     teamTransactions.createdAt,
      userId:        teamTransactions.userId,
      adminName:     users.gameName,
      adminEmail:    users.email,
    })
    .from(teamTransactions)
    .leftJoin(users, eq(teamTransactions.userId, users.id))
    .where(eq(teamTransactions.teamId, teamId))
    .orderBy(desc(teamTransactions.createdAt))
    .limit(take)
    .offset(offset)

  return apiSuccess({
    teamId,
    history: rows,
    pagination: { page, limit: take },
  })
}
