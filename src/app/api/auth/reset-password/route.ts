import { NextRequest } from 'next/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { hashPassword } from '@/lib/password'
import { apiSuccess, apiError } from '@/lib/api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = body
    if (!token || !password) return apiError('Token and new password required', 400)
    if (password.length < 8) return apiError('Password must be at least 8 characters', 400)

    const [user] = await db.select().from(users).where(
      and(eq(users.resetToken, token), gt(users.resetTokenExpiry, new Date()))
    ).limit(1)

    if (!user) return apiError('Invalid or expired reset token', 400)

    const hashed = await hashPassword(password)
    await db.update(users).set({
      password: hashed,
      resetToken: null,
      resetTokenExpiry: null,
    }).where(eq(users.id, user.id))

    return apiSuccess({ message: 'Password reset successfully' })
  } catch (error) {
    console.error('[reset-password]', error)
    return apiError('Reset failed', 500)
  }
}
