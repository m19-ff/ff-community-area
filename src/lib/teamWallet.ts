import 'server-only'
import { db } from '@/db'
import { teamWallets, teamTransactions } from '@/db/schema'
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

/**
 * Returns the team wallet row for the given team, or null if it doesn't exist.
 */
export async function getTeamWallet(teamId: number) {
  const [wallet] = await db
    .select()
    .from(teamWallets)
    .where(eq(teamWallets.teamId, teamId))
    .limit(1)
  return wallet ?? null
}

/**
 * Creates a new team wallet with zero balances. Returns the created row.
 * If a wallet already exists for the team, returns the existing one.
 */
export async function createTeamWallet(teamId: number) {
  const existing = await getTeamWallet(teamId)
  if (existing) return existing

  const [wallet] = await db
    .insert(teamWallets)
    .values({
      teamId,
      balance: 0,
      lockedBalance: 0,
      totalEarned: 0,
      totalSpent: 0,
    })
    .returning()
  return wallet
}

/**
 * Increases team wallet balance and totalEarned by `amount`.
 * Returns the updated wallet row.
 */
export async function increaseTeamBalance(teamId: number, amount: number) {
  if (amount <= 0) throw new Error('amount must be positive')

  const [wallet] = await db
    .update(teamWallets)
    .set({
      balance: sql`${teamWallets.balance} + ${amount}`,
      totalEarned: sql`${teamWallets.totalEarned} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(teamWallets.teamId, teamId))
    .returning()

  if (!wallet) throw new Error(`Team wallet not found for teamId=${teamId}`)
  return wallet
}

/**
 * Decreases team wallet balance and increases totalSpent by `amount`.
 * Throws if the resulting balance would go negative.
 * Returns the updated wallet row.
 */
export async function decreaseTeamBalance(teamId: number, amount: number) {
  if (amount <= 0) throw new Error('amount must be positive')

  const current = await getTeamWallet(teamId)
  if (!current) throw new Error(`Team wallet not found for teamId=${teamId}`)
  if (current.balance < amount) {
    throw new Error(
      `Insufficient team balance: has ${current.balance}, needs ${amount}`,
    )
  }

  const [wallet] = await db
    .update(teamWallets)
    .set({
      balance: sql`${teamWallets.balance} - ${amount}`,
      totalSpent: sql`${teamWallets.totalSpent} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(teamWallets.teamId, teamId))
    .returning()

  if (!wallet) throw new Error(`Team wallet not found for teamId=${teamId}`)
  return wallet
}

/**
 * Appends a transaction record for the team wallet.
 * Returns the inserted transaction row.
 */
export async function addTeamTransaction(params: AddTeamTransactionParams) {
  const [tx] = await db
    .insert(teamTransactions)
    .values({
      teamId: params.teamId,
      userId: params.userId ?? null,
      type: params.type,
      amount: params.amount,
      balanceBefore: params.balanceBefore,
      balanceAfter: params.balanceAfter,
      description: params.description ?? null,
      meta: params.meta ?? null,
    })
    .returning()
  return tx
}
