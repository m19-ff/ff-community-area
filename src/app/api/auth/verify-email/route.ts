import { NextRequest } from 'next/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { apiSuccess, apiError } from '@/lib/api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) return apiError('Verification token required', 400)

    const [user] = await db.select().from(users).where(
      and(
        eq(users.emailVerifyToken, token),
        gt(users.emailVerifyExpiry, new Date())
      )
    ).limit(1)

    if (!user) return apiError('Invalid or expired verification token', 400)

    await db.update(users).set({
      emailVerified: true,
      emailVerifyToken: null,
      emailVerifyExpiry: null,
    }).where(eq(users.id, user.id))

    return apiSuccess({ message: 'Email verified successfully' })
  } catch (error) {
    console.error('[verify-email]', error)
    return apiError('Verification failed', 500)
  }
}
