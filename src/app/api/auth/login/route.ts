import { NextRequest } from 'next/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { verifyPassword } from '@/lib/password'
import { signJWT } from '@/lib/auth'
import { apiSuccess, apiError } from '@/lib/api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return apiError('Email and password are required', 400)
    }

    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
    if (!user) {
      return apiError('Invalid email or password', 401)
    }
    if (user.isBanned) {
      return apiError(`Account banned: ${user.banReason || 'Contact support'}`, 403)
    }

    const valid = await verifyPassword(password, user.password)
    if (!valid) {
      return apiError('Invalid email or password', 401)
    }

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))

    const token = await signJWT({ userId: user.id, email: user.email, role: user.role })

    return apiSuccess({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        gameName: user.gameName,
        gameUid: user.gameUid,
        profilePicture: user.profilePicture,
        profileCompleted: user.profileCompleted,
        emailVerified: user.emailVerified,
      },
    })
  } catch (error) {
    console.error('[login]', error)
    return apiError('Login failed', 500)
  }
}
