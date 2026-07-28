import { NextRequest } from 'next/server'
import { db } from '@/db'
import { rechargeRequests, wallets, transactions, notifications } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin, apiSuccess, apiError } from '@/lib/api'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const { id } = await params
  const reqId = parseInt(id)

  const [req] = await db.select().from(rechargeRequests).where(eq(rechargeRequests.id, reqId)).limit(1)
  if (!req) return apiError('Recharge request not found', 404)
  if (req.status !== 'pending') return apiError('Request already processed', 400)

  const body = await request.json()
  const { action, adminNote } = body
  if (!['approve', 'reject'].includes(action)) return apiError('action must be approve or reject', 400)

  if (action === 'reject') {
    await db.update(rechargeRequests).set({
      status: 'rejected',
      adminNote: adminNote || null,
      processedBy: admin.userId,
      processedAt: new Date(),
    }).where(eq(rechargeRequests.id, reqId))
    return apiSuccess({ message: 'Recharge request rejected' })
  }

  // Approve: add points to wallet
  const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, req.userId)).limit(1)
  if (!wallet) return apiError('User wallet not found', 404)

  const newBalance = wallet.balance + req.amountPoints
  await db.update(wallets).set({
    balance: newBalance,
    totalEarned: wallet.totalEarned + req.amountPoints,
  }).where(eq(wallets.userId, req.userId))

  await db.update(rechargeRequests).set({
    status: 'approved',
    adminNote: adminNote || null,
    processedBy: admin.userId,
    processedAt: new Date(),
  }).where(eq(rechargeRequests.id, reqId))

  await db.insert(transactions).values({
    userId: req.userId,
    type: 'recharge',
    amount: req.amountPoints,
    balanceBefore: wallet.balance,
    balanceAfter: newBalance,
    description: `Recharge approved: ${req.amountPoints} points`,
    meta: { rechargeRequestId: reqId },
  })

  await db.insert(notifications).values({
    userId: req.userId,
    type: 'general',
    title: 'Recharge Approved',
    body: `Your recharge of ${req.amountPoints} points ($${req.amountUsd}) has been approved!`,
    data: { rechargeId: reqId },
  })

  return apiSuccess({ message: `Added ${req.amountPoints} points to user wallet` })
}
