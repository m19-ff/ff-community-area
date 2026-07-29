import { NextRequest } from 'next/server'
import { db } from '@/db'
import { users, wallets, transactions, notifications } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { requireAdmin, apiSuccess, apiError } from '@/lib/api'
import { adminSetRole } from '@/lib/roleGuard'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const { id } = await params
  const userId = parseInt(id)
  if (isNaN(userId)) return apiError('Invalid user ID', 400)

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) return apiError('User not found', 404)

  const body = await request.json()
  const { action, points, reason, role } = body

  if (action === 'ban') {
    await db.update(users)
      .set({ isBanned: true, banReason: reason || 'Banned by admin' })
      .where(eq(users.id, userId))
    return apiSuccess({ message: 'User banned' })
  }

  if (action === 'unban') {
    await db.update(users)
      .set({ isBanned: false, banReason: null })
      .where(eq(users.id, userId))
    return apiSuccess({ message: 'User unbanned' })
  }

  if (action === 'award_points' && points > 0) {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1)
    if (!wallet) return apiError('User wallet not found', 404)

    // Use SQL arithmetic to avoid stale-read race condition
    const [updated] = await db
      .update(wallets)
      .set({
        balance:      sql`${wallets.balance}      + ${points}`,
        totalEarned:  sql`${wallets.totalEarned}  + ${points}`,
        updatedAt:    new Date(),
      })
      .where(eq(wallets.userId, userId))
      .returning()

    await db.insert(transactions).values({
      userId,
      type: 'admin_award',
      amount: points,
      balanceBefore: wallet.balance,
      balanceAfter: updated.balance,
      description: `Admin awarded ${points} points${reason ? ': ' + reason : ''}`,
      meta: { adminId: admin.userId },
    })

    await db.insert(notifications).values({
      userId,
      type: 'general',
      title: 'Points Awarded',
      body: `${points} points have been added to your wallet by admin.`,
    })

    return apiSuccess({ message: `Awarded ${points} points`, newBalance: updated.balance })
  }

  if (action === 'deduct_points' && points > 0) {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1)
    if (!wallet) return apiError('User wallet not found', 404)

    const actualDeduction = Math.min(points, wallet.balance)
    if (actualDeduction === 0) return apiSuccess({ message: 'Nothing to deduct', newBalance: 0 })

    const [updated] = await db
      .update(wallets)
      .set({
        balance:   sql`GREATEST(${wallets.balance} - ${actualDeduction}, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.userId, userId))
      .returning()

    await db.insert(transactions).values({
      userId,
      type: 'admin_deduct',
      amount: -actualDeduction,
      balanceBefore: wallet.balance,
      balanceAfter: updated.balance,
      description: `Admin deducted ${actualDeduction} points${reason ? ': ' + reason : ''}`,
      meta: { adminId: admin.userId },
    })

    return apiSuccess({ message: `Deducted ${actualDeduction} points`, newBalance: updated.balance })
  }

  if (action === 'set_role' && role) {
    // All role-change logic (validation, privilege checks, superadmin protection,
    // audit logging) is centralized in adminSetRole().
    const err = await adminSetRole({
      targetUserId:      userId,
      targetCurrentRole: user.role,
      newRole:           role,
      performerUserId:   admin.userId,
      performerRole:     admin.role,
      route:             'PATCH /api/admin/users/[id]',
    })
    if (err) return apiError(err, 403)
    return apiSuccess({ message: `Role updated to ${role}` })
  }

  return apiError('Invalid action', 400)
}
