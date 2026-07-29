import { NextRequest } from 'next/server'
import { db } from '@/db'
import { teamTransactions, teamMembers, teams, users } from '@/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError, paginate } from '@/lib/api'

/**
 * GET /api/teams/wallet-history
 *
 * Returns team_transactions for the authenticated user's team.
 * Captains and members can both view their team's wallet history.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  // Find the user's team
  const [membership] = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, auth.userId))
    .limit(1)

  if (!membership) return apiError('You are not in a team', 400)

  const teamId = membership.teamId

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const { limit: take, offset } = paginate(page, 30)

  // Fetch transactions joined with user name
  const rows = await db
    .select({
      id: teamTransactions.id,
      teamId: teamTransactions.teamId,
      userId: teamTransactions.userId,
      type: teamTransactions.type,
      amount: teamTransactions.amount,
      balanceBefore: teamTransactions.balanceBefore,
      balanceAfter: teamTransactions.balanceAfter,
      description: teamTransactions.description,
      meta: teamTransactions.meta,
      createdAt: teamTransactions.createdAt,
      userName: users.gameName,
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
