import { NextRequest } from 'next/server'
import { db } from '@/db'
import { teams, teamWallets, teamTransactions } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { requireAdmin, apiSuccess, apiError } from '@/lib/api'
import { getTeamWallet, createTeamWallet, addTeamTransaction } from '@/lib/teamWallet'

/**
 * POST /api/admin/teams/[id]/wallet
 *
 * Actions:
 *  add_points    — add points to balance + totalEarned
 *  deduct_points — deduct points from balance + totalSpent
 *  lock_balance  — move points from balance to lockedBalance
 *  unlock_balance— move points from lockedBalance back to balance
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const { id } = await params
  const teamId = parseInt(id)
  if (isNaN(teamId)) return apiError('Invalid team ID', 400)

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1)
  if (!team) return apiError('Team not found', 404)

  const body   = await request.json()
  const { action, amount: rawAmount, description } = body

  const amount = parseInt(rawAmount)
  if (!amount || amount <= 0) return apiError('Amount must be a positive integer', 400)

  if (!['add_points', 'deduct_points', 'lock_balance', 'unlock_balance'].includes(action)) {
    return apiError('Invalid action. Use: add_points | deduct_points | lock_balance | unlock_balance', 400)
  }

  // Ensure wallet exists
  let wallet = await getTeamWallet(teamId)
  if (!wallet) wallet = await createTeamWallet(teamId)

  const balanceBefore = wallet.balance
  const lockedBefore  = wallet.lockedBalance

  let updatedWallet: typeof wallet

  // ── add_points ──────────────────────────────────────────────────────────────
  if (action === 'add_points') {
    const [w] = await db
      .update(teamWallets)
      .set({
        balance:     sql`${teamWallets.balance}     + ${amount}`,
        totalEarned: sql`${teamWallets.totalEarned} + ${amount}`,
        updatedAt:   new Date(),
      })
      .where(eq(teamWallets.teamId, teamId))
      .returning()
    updatedWallet = w

    await addTeamTransaction({
      teamId,
      userId:        admin.userId,
      type:          'admin_award',
      amount,
      balanceBefore,
      balanceAfter:  w.balance,
      description:   description || `Admin added ${amount} points`,
      meta:          { adminId: admin.userId, adminEmail: admin.email, action },
    })
  }

  // ── deduct_points ───────────────────────────────────────────────────────────
  else if (action === 'deduct_points') {
    if (wallet.balance < amount) {
      return apiError(`Insufficient balance. Current: ${wallet.balance}, requested: ${amount}`, 400)
    }

    const [w] = await db
      .update(teamWallets)
      .set({
        balance:    sql`${teamWallets.balance}    - ${amount}`,
        totalSpent: sql`${teamWallets.totalSpent} + ${amount}`,
        updatedAt:  new Date(),
      })
      .where(eq(teamWallets.teamId, teamId))
      .returning()
    updatedWallet = w

    await addTeamTransaction({
      teamId,
      userId:        admin.userId,
      type:          'admin_deduct',
      amount:        -amount,
      balanceBefore,
      balanceAfter:  w.balance,
      description:   description || `Admin deducted ${amount} points`,
      meta:          { adminId: admin.userId, adminEmail: admin.email, action },
    })
  }

  // ── lock_balance ────────────────────────────────────────────────────────────
  else if (action === 'lock_balance') {
    if (wallet.balance < amount) {
      return apiError(`Insufficient free balance to lock. Available: ${wallet.balance}`, 400)
    }

    const [w] = await db
      .update(teamWallets)
      .set({
        balance:       sql`${teamWallets.balance}        - ${amount}`,
        lockedBalance: sql`${teamWallets.lockedBalance}  + ${amount}`,
        updatedAt:     new Date(),
      })
      .where(eq(teamWallets.teamId, teamId))
      .returning()
    updatedWallet = w

    await addTeamTransaction({
      teamId,
      userId:        admin.userId,
      type:          'deduct_manual',
      amount:        -amount,
      balanceBefore,
      balanceAfter:  w.balance,
      description:   description || `Admin locked ${amount} points`,
      meta:          {
        adminId:    admin.userId,
        adminEmail: admin.email,
        action,
        lockedBefore,
        lockedAfter: w.lockedBalance,
      },
    })
  }

  // ── unlock_balance ──────────────────────────────────────────────────────────
  else {
    // unlock_balance
    if (wallet.lockedBalance < amount) {
      return apiError(`Insufficient locked balance to unlock. Locked: ${wallet.lockedBalance}`, 400)
    }

    const [w] = await db
      .update(teamWallets)
      .set({
        balance:       sql`${teamWallets.balance}        + ${amount}`,
        lockedBalance: sql`${teamWallets.lockedBalance}  - ${amount}`,
        updatedAt:     new Date(),
      })
      .where(eq(teamWallets.teamId, teamId))
      .returning()
    updatedWallet = w

    await addTeamTransaction({
      teamId,
      userId:        admin.userId,
      type:          'earn_manual',
      amount,
      balanceBefore,
      balanceAfter:  w.balance,
      description:   description || `Admin unlocked ${amount} points`,
      meta:          {
        adminId:    admin.userId,
        adminEmail: admin.email,
        action,
        lockedBefore,
        lockedAfter: w.lockedBalance,
      },
    })
  }

  return apiSuccess({
    message:       `Action '${action}' applied successfully`,
    wallet:        updatedWallet!,
  })
}
