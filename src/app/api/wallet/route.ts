import { NextRequest } from 'next/server'
import { db } from '@/db'
import { wallets, transactions } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError, paginate } from '@/lib/api'

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, auth.userId)).limit(1)
  if (!wallet) return apiError('Wallet not found', 404)

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const { limit: take, offset, page: pg } = paginate(page, 20)

  const txList = await db.select().from(transactions)
    .where(eq(transactions.userId, auth.userId))
    .orderBy(desc(transactions.createdAt))
    .limit(take)
    .offset(offset)

  return apiSuccess({
    wallet: {
      balance: wallet.balance,
      totalEarned: wallet.totalEarned,
      totalSpent: wallet.totalSpent,
      usdValue: (wallet.balance / 100).toFixed(2),
    },
    transactions: txList,
    pagination: { page: pg, limit: take },
  })
}
