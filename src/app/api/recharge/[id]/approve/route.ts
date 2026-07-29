import { NextRequest } from 'next/server'
import { db } from '@/db'
import { rechargeRequests, wallets, transactions, teamMembers } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { requireAdmin, apiSuccess, apiError } from '@/lib/api'
import { getTeamWallet, increaseTeamBalance, addTeamTransaction, createTeamWallet } from '@/lib/teamWallet'
import { sendPushToUsers } from '@/lib/fcm'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const { id } = await params
  const reqId = parseInt(id)
  if (isNaN(reqId)) return apiError('Invalid ID', 400)

  const [req] = await db.select().from(rechargeRequests).where(eq(rechargeRequests.id, reqId)).limit(1)
  if (!req) return apiError('Recharge request not found', 404)
  if (req.status !== 'pending') return apiError('Request already processed', 400)

  const body = await request.json()
  const { action, adminNote } = body
  if (!['approve', 'reject'].includes(action)) return apiError('action must be approve or reject', 400)

  if (action === 'reject') {
    await db.update(rechargeRequests).set({
      status:      'rejected',
      adminNote:   adminNote || null,
      processedBy: admin.userId,
      processedAt: new Date(),
    }).where(eq(rechargeRequests.id, reqId))
    return apiSuccess({ message: 'Recharge request rejected' })
  }

  // Mark approved
  await db.update(rechargeRequests).set({
    status:      'approved',
    adminNote:   adminNote || null,
    processedBy: admin.userId,
    processedAt: new Date(),
  }).where(eq(rechargeRequests.id, reqId))

  // Check team membership
  const [membership] = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, req.userId))
    .limit(1)

  if (membership) {
    // Player is in a team → credit team wallet
    const teamId = membership.teamId

    let teamWallet = await getTeamWallet(teamId)
    if (!teamWallet) teamWallet = await createTeamWallet(teamId)

    const balanceBefore     = teamWallet.balance
    const updatedTeamWallet = await increaseTeamBalance(teamId, req.amountPoints)

    // Audit record on personal wallet (balance unchanged)
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, req.userId)).limit(1)
    if (wallet) {
      await db.insert(transactions).values({
        userId:        req.userId,
        type:          'recharge',
        amount:        req.amountPoints,
        balanceBefore: wallet.balance,
        balanceAfter:  wallet.balance,
        description:   `Recharge approved: ${req.amountPoints} pts — credited to team wallet`,
        meta:          { rechargeRequestId: reqId, teamId },
      })
    }

    await addTeamTransaction({
      teamId,
      userId:        req.userId,
      type:          'earn_manual',
      amount:        req.amountPoints,
      balanceBefore,
      balanceAfter:  updatedTeamWallet.balance,
      description:   `Recharge approved: ${req.amountPoints} pts ($${req.amountUsd})`,
      meta:          { rechargeRequestId: reqId },
    })

    void sendPushToUsers({
      userIds: [req.userId],
      payload: {
        title: '✅ Recharge Approved',
        body:  `Your recharge of ${req.amountPoints} pts ($${req.amountUsd}) has been approved and added to your team wallet!`,
        data:  { deepLink: '/wallet', rechargeId: String(reqId) },
      },
      notifType: 'general',
      notifData: { rechargeId: reqId, deepLink: '/wallet' },
    })

    return apiSuccess({ message: `Added ${req.amountPoints} points to team wallet` })
  }

  // No team → credit personal wallet (SQL arithmetic — race-safe)
  const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, req.userId)).limit(1)
  if (!wallet) return apiError('User wallet not found', 404)

  const [updated] = await db
    .update(wallets)
    .set({
      balance:     sql`${wallets.balance}     + ${req.amountPoints}`,
      totalEarned: sql`${wallets.totalEarned} + ${req.amountPoints}`,
      updatedAt:   new Date(),
    })
    .where(eq(wallets.userId, req.userId))
    .returning()

  await db.insert(transactions).values({
    userId:        req.userId,
    type:          'recharge',
    amount:        req.amountPoints,
    balanceBefore: wallet.balance,
    balanceAfter:  updated.balance,
    description:   `Recharge approved: ${req.amountPoints} pts ($${req.amountUsd})`,
    meta:          { rechargeRequestId: reqId },
  })

  void sendPushToUsers({
    userIds: [req.userId],
    payload: {
      title: '✅ Recharge Approved',
      body:  `Your recharge of ${req.amountPoints} pts ($${req.amountUsd}) has been approved!`,
      data:  { deepLink: '/wallet', rechargeId: String(reqId) },
    },
    notifType: 'general',
    notifData: { rechargeId: reqId, deepLink: '/wallet' },
  })

  return apiSuccess({ message: `Added ${req.amountPoints} points to user wallet` })
}
