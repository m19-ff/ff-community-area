import { NextRequest } from 'next/server'
import { db } from '@/db'
import { users, wallets, transactions, notifications } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin, apiSuccess, apiError } from '@/lib/api'
import { teamMembers } from '@/db/schema'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const { id } = await params
  const userId = parseInt(id)

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) return apiError('User not found', 404)

  const body = await request.json()
  const { action, points, reason, role } = body

  if (action === 'ban') {
    await db.update(users).set({ isBanned: true, banReason: reason || 'Banned by admin' }).where(eq(users.id, userId))
    return apiSuccess({ message: 'User banned' })
  }

  if (action === 'unban') {
    await db.update(users).set({ isBanned: false, banReason: null }).where(eq(users.id, userId))
    return apiSuccess({ message: 'User unbanned' })
  }

  if (action === 'award_points' && points > 0) {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1)
    if (!wallet) return apiError('User wallet not found', 404)

    const newBalance = wallet.balance + points
    await db.update(wallets).set({
      balance: newBalance,
      totalEarned: wallet.totalEarned + points,
    }).where(eq(wallets.userId, userId))

    await db.insert(transactions).values({
      userId,
      type: 'admin_award',
      amount: points,
      balanceBefore: wallet.balance,
      balanceAfter: newBalance,
      description: `Admin awarded ${points} points${reason ? ': ' + reason : ''}`,
      meta: { adminId: admin.userId },
    })

    await db.insert(notifications).values({
      userId,
      type: 'general',
      title: 'Points Awarded',
      body: `${points} points have been added to your wallet by admin.`,
    })

    return apiSuccess({ message: `Awarded ${points} points`, newBalance })
  }

  if (action === 'deduct_points' && points > 0) {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1)
    if (!wallet) return apiError('User wallet not found', 404)

    const actualDeduction = Math.min(points, wallet.balance)
    const newBalance = wallet.balance - actualDeduction

    await db.update(wallets).set({ balance: newBalance }).where(eq(wallets.userId, userId))

    await db.insert(transactions).values({
      userId,
      type: 'admin_deduct',
      amount: -actualDeduction,
      balanceBefore: wallet.balance,
      balanceAfter: newBalance,
      description: `Admin deducted ${actualDeduction} points${reason ? ': ' + reason : ''}`,
    })

    return apiSuccess({ message: `Deducted ${actualDeduction} points`, newBalance })
  }

  if (action === 'set_role' && role) {
    if (!['player', 'assistant', 'admin'].includes(role)) return apiError('Invalid role', 400)
    await db.update(users).set({ role: role as typeof user.role }).where(eq(users.id, userId))
    return apiSuccess({ message: `Role updated to ${role}` })
  }

  return apiError('Invalid action', 400)
}
