import { NextRequest } from 'next/server'
import { db } from '@/db'
import { rechargeRequests, wallets, transactions } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAuth, requireAdmin, apiSuccess, apiError, paginate } from '@/lib/api'

const PACKAGES = [
  { points: 100, usd: 1.00 },
  { points: 500, usd: 5.00 },
  { points: 1000, usd: 10.00 },
  { points: 5000, usd: 50.00 },
]

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const isAdmin = ['admin', 'superadmin'].includes(auth.role)
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const { limit: take, offset, page: pg } = paginate(page, 20)

  const conditions = isAdmin ? undefined : eq(rechargeRequests.userId, auth.userId)
  const list = await db.select().from(rechargeRequests)
    .where(conditions)
    .orderBy(desc(rechargeRequests.createdAt))
    .limit(take)
    .offset(offset)

  return apiSuccess({ packages: PACKAGES, requests: list, pagination: { page: pg, limit: take } })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const body = await request.json()
  const { amountPoints, paymentProof } = body

  if (!amountPoints || amountPoints < 100) return apiError('Minimum recharge is 100 points', 400)

  const amountUsd = (amountPoints / 100).toFixed(2)

  const [req] = await db.insert(rechargeRequests).values({
    userId: auth.userId,
    amountPoints,
    amountUsd,
    paymentProof: paymentProof || null,
    status: 'pending',
  }).returning()

  return apiSuccess({ request: req, message: 'Recharge request submitted. Admin will verify payment.' }, 201)
}
