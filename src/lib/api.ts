import { NextRequest, NextResponse } from 'next/server'
import { getAuthUserFromHeader, getAuthUser, JWTPayload } from './auth'

export function apiSuccess(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

export function apiError(message: string, status = 400, errors?: unknown) {
  return NextResponse.json({ success: false, message, errors }, { status })
}

export async function requireAuth(request: NextRequest): Promise<JWTPayload | null> {
  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    return await getAuthUserFromHeader(authHeader)
  }
  return await getAuthUser()
}

export async function requireAdmin(request: NextRequest): Promise<JWTPayload | null> {
  const user = await requireAuth(request)
  if (!user) return null
  if (!['admin', 'superadmin', 'assistant'].includes(user.role)) return null
  return user
}

export function paginate(page: number, limit: number) {
  const safeLimit = Math.min(Math.max(limit, 1), 100)
  const safePage = Math.max(page, 1)
  return {
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
    page: safePage,
  }
}
