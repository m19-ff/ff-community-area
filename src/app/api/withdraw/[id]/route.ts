import { NextRequest } from 'next/server'
import { db } from '@/db'
import { withdrawRequests, teams, notifications } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin, apiSuccess, apiError } from '@/lib/api'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const { id } = await params
  const reqId = parseInt(id)

  const [wr] = await db.select().from(withdrawRequests).where(eq(withdrawRequests.id, reqId)).limit(1)
  if (!wr) return apiError('Withdrawal request not found', 404)

  const body = await request.json()
  const { status, adminNote } = body
  if (!['approved', 'rejected', 'paid'].includes(status)) return apiError('Invalid status', 400)

  // If rejecting, refund points to team
  if (status === 'rejected' && wr.status === 'pending') {
    const [team] = await db.select().from(teams).where(eq(teams.id, wr.teamId)).limit(1)
    if (team) {
      await db.update(teams).set({ points: team.points + wr.amountPoints }).where(eq(teams.id, team.id))
    }
  }

  await db.update(withdrawRequests).set({
    status: status as typeof wr.status,
    adminNote: adminNote || null,
    processedAt: new Date(),
  }).where(eq(withdrawRequests.id, reqId))

  // Notify captain
  await db.insert(notifications).values({
    userId: wr.captainId,
    type: 'withdrawal_approved',
    title: `Withdrawal ${status.charAt(0).toUpperCase() + status.slice(1)}`,
    body: `Your withdrawal request of $${wr.amountUsd} has been ${status}.`,
    data: { withdrawalId: reqId, status },
  })

  return apiSuccess({ message: `Withdrawal ${status}` })
}
