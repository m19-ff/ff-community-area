import { NextRequest } from 'next/server'
import { db } from '@/db'
import { withdrawRequests } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin, apiSuccess, apiError } from '@/lib/api'
import { getTeamWallet, increaseTeamBalance, addTeamTransaction } from '@/lib/teamWallet'
import { sendPushToUsers } from '@/lib/fcm'

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

  // If rejecting a pending request, refund the gross amount back to the team wallet.
  // The gross deducted = netPoints / (1 - COMMISSION_RATE) but we stored netPoints.
  // Reconstruct gross: netPoints = gross * 0.8  =>  gross = netPoints / 0.8
  if (status === 'rejected' && wr.status === 'pending') {
    const grossPoints = Math.round(wr.amountPoints / 0.8)

    const teamWallet = await getTeamWallet(wr.teamId)
    if (teamWallet) {
      const balanceBefore = teamWallet.balance
      const updatedWallet = await increaseTeamBalance(wr.teamId, grossPoints)

      await addTeamTransaction({
        teamId: wr.teamId,
        userId: admin.userId,
        type: 'admin_award',
        amount: grossPoints,
        balanceBefore,
        balanceAfter: updatedWallet.balance,
        description: `Withdrawal rejected — ${grossPoints} pts refunded to team wallet`,
        meta: { withdrawRequestId: reqId },
      })
    }
  }

  await db.update(withdrawRequests).set({
    status: status as typeof wr.status,
    adminNote: adminNote || null,
    processedAt: new Date(),
  }).where(eq(withdrawRequests.id, reqId))

  // Push + in-app notification for captain
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1)
  void sendPushToUsers({
    userIds: [wr.captainId],
    payload: {
      title: `💸 Withdrawal ${statusLabel}`,
      body:  `Your withdrawal request of $${wr.amountUsd} has been ${status}.`,
      data:  { deepLink: '/wallet', withdrawalId: String(reqId), status },
    },
    notifType: 'withdrawal_approved',
    notifData: { withdrawalId: reqId, status, deepLink: '/wallet' },
  })

  return apiSuccess({ message: `Withdrawal ${status}` })
}
