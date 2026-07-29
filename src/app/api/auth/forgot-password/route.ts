import { NextRequest } from 'next/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { generateVerifyToken } from '@/lib/auth'
import { apiSuccess, apiError } from '@/lib/api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body
    if (!email) return apiError('Email required', 400)

    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
    // Always return success to prevent email enumeration
    if (!user) return apiSuccess({ message: 'If that email exists, a reset link has been sent.' })

    const token = generateVerifyToken()
    const expiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await db.update(users).set({
      resetToken: token,
      resetTokenExpiry: expiry,
    }).where(eq(users.id, user.id))

    return apiSuccess({ message: 'If that email exists, a reset link has been sent.' })
  } catch (error) {
    console.error('[forgot-password]', error)
    return apiError('Failed', 500)
  }
}
