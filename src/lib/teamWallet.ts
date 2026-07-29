import 'server-only'
import { db } from '@/db'
import { teamWallets, teamTransactions, wallets, transactions } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TeamTxType =
  | 'earn_tournament'
  | 'earn_manual'
  | 'deduct_tournament'
  | 'deduct_manual'
  | 'admin_award'
  | 'admin_deduct'
  | 'team_split'
  | 'withdraw'

export interface AddTeamTransactionParams {
  teamId: number
  userId?: number | null
  type: TeamTxType
  amount: number
  balanceBefore: number
  balanceAfter: number
  description?: string | null
  meta?: Record<string, unknown> | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns the team wallet row, or null if none exists. */
export async function getTeamWallet(teamId: number) {
  const [wallet] = await db
    .select()
    .from(teamWallets)
    .where(eq(teamWallets.teamId, teamId))
    .limit(1)
  return wallet ?? null
}

/**
 * Returns the existing wallet or creates a new one with zero balances.
 * Idempotent — safe to call multiple times.
 */
export async function createTeamWallet(teamId: number) {
  const existing = await getTeamWallet(teamId)
  if (existing) return existing

  const [wallet] = await db
    .insert(teamWallets)
    .values({ teamId, balance: 0, lockedBalance: 0, totalEarned: 0, totalSpent: 0 })
    .returning()
  return wallet
}

/**
 * Increases team wallet balance and totalEarned by `amount`.
 * Uses SQL arithmetic to avoid stale-read races.
 * Returns the updated wallet row.
 */
export async function increaseTeamBalance(teamId: number, amount: number) {
  if (amount <= 0) throw new Error('amount must be positive')

  const [wallet] = await db
    .update(teamWallets)
    .set({
      balance:     sql`${teamWallets.balance}     + ${amount}`,
      totalEarned: sql`${teamWallets.totalEarned} + ${amount}`,
      updatedAt:   new Date(),
    })
    .where(eq(teamWallets.teamId, teamId))
    .returning()

  if (!wallet) throw new Error(`Team wallet not found for teamId=${teamId}`)
  return wallet
}

/**
 * Decreases team wallet balance atomically using a conditional SQL update.
 * The UPDATE only executes when balance >= amount, preventing overdrafts
 * without a separate SELECT read.
 * Throws if the team wallet does not exist or balance is insufficient.
 */
export async function decreaseTeamBalance(teamId: number, amount: number) {
  if (amount <= 0) throw new Error('amount must be positive')

  // Atomic conditional decrement — no separate SELECT needed
  const [wallet] = await db
    .update(teamWallets)
    .set({
      balance:    sql`${teamWallets.balance}    - ${amount}`,
      totalSpent: sql`${teamWallets.totalSpent} + ${amount}`,
      updatedAt:  new Date(),
    })
    .where(
      sql`${teamWallets.teamId} = ${teamId} AND ${teamWallets.balance} >= ${amount}`,
    )
    .returning()

  if (!wallet) {
    // Distinguish "not found" from "insufficient balance"
    const current = await getTeamWallet(teamId)
    if (!current) throw new Error(`Team wallet not found for teamId=${teamId}`)
    throw new Error(
      `Insufficient team balance: has ${current.balance}, needs ${amount}`,
    )
  }

  return wallet
}

/** Appends a transaction record and returns the inserted row. */
export async function addTeamTransaction(params: AddTeamTransactionParams) {
  const [tx] = await db
    .insert(teamTransactions)
    .values({
      teamId:        params.teamId,
      userId:        params.userId ?? null,
      type:          params.type,
      amount:        params.amount,
      balanceBefore: params.balanceBefore,
      balanceAfter:  params.balanceAfter,
      description:   params.description ?? null,
      meta:          params.meta ?? null,
    })
    .returning()
  return tx
}

/**
 * Transfers a player's entire personal wallet balance into the team wallet.
 * Runs inside a database transaction to guarantee atomicity.
 * No-op when the player's personal balance is 0.
 */
export async function transferPlayerBalanceToTeam(
  userId: number,
  teamId: number,
  teamName: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [playerWallet] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.userId, userId))
      .limit(1)

    if (!playerWallet || playerWallet.balance <= 0) return

    const amount = playerWallet.balance

    // Zero out the player's personal wallet
    await tx.update(wallets)
      .set({
        balance:    0,
        totalSpent: sql`${wallets.totalSpent} + ${amount}`,
        updatedAt:  new Date(),
      })
      .where(eq(wallets.userId, userId))

    // Personal wallet debit transaction
    await tx.insert(transactions).values({
      userId,
      type:          'team_split',
      amount:        -amount,
      balanceBefore: amount,
      balanceAfter:  0,
      description:   `Balance transferred to team wallet on joining ${teamName}`,
      meta:          { teamId },
    })

    // Credit the team wallet
    const [teamWallet] = await tx
      .select()
      .from(teamWallets)
      .where(eq(teamWallets.teamId, teamId))
      .limit(1)

    if (!teamWallet) throw new Error(`Team wallet not found for teamId=${teamId}`)

    const teamBalanceBefore = teamWallet.balance
    const teamBalanceAfter  = teamBalanceBefore + amount

    await tx.update(teamWallets)
      .set({
        balance:     sql`${teamWallets.balance}     + ${amount}`,
        totalEarned: sql`${teamWallets.totalEarned} + ${amount}`,
        updatedAt:   new Date(),
      })
      .where(eq(teamWallets.teamId, teamId))

    // Team credit transaction
    await tx.insert(teamTransactions).values({
      teamId,
      userId,
      type:          'team_split',
      amount,
      balanceBefore: teamBalanceBefore,
      balanceAfter:  teamBalanceAfter,
      description:   `Player balance transferred in on team join`,
      meta:          { userId },
    })
  })
}
