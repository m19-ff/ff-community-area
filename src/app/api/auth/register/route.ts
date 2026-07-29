import { NextRequest } from 'next/server'
import { db } from '@/db'
import { users, wallets } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { hashPassword } from '@/lib/password'
import { signJWT, generateVerifyToken } from '@/lib/auth'
import { apiSuccess, apiError } from '@/lib/api'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return apiError('Email and password are required', 400)
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return apiError('Invalid email format', 400)
    }
    if (password.length < 8) {
      return apiError('Password must be at least 8 characters', 400)
    }

    const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
    if (existing.length > 0) {
      return apiError('Email already registered', 409)
    }

    const hashed = await hashPassword(password)
    const verifyToken = generateVerifyToken()
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const [user] = await db.insert(users).values({
      email: email.toLowerCase(),
      password: hashed,
      emailVerifyToken: verifyToken,
      emailVerifyExpiry: expiry,
    }).returning()

    await db.insert(wallets).values({ userId: user.id })

    const token = await signJWT({ userId: user.id, email: user.email, role: user.role })

    return apiSuccess({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profileCompleted: user.profileCompleted,
        emailVerified: user.emailVerified,
      },
    }, 201)
  } catch (error) {
    console.error('[register]', error)
    return apiError('Registration failed', 500)
  }
}
