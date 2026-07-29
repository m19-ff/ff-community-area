import { NextRequest } from 'next/server'
import { db } from '@/db'
import { users, wallets, teamMembers, teams, teamWallets } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, apiSuccess, apiError } from '@/lib/api'

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  const [user] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1)
  if (!user) return apiError('User not found', 404)

  const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, auth.userId)).limit(1)

  // Join team + teamWallet in one query so walletBalance is always present
  const [membership] = await db
    .select({
      team: {
        id: teams.id,
        name: teams.name,
        logo: teams.logo,
        captainId: teams.captainId,
        totalTournaments: teams.totalTournaments,
        walletBalance: teamWallets.balance,
      },
    })
    .from(teamMembers)
    .leftJoin(teams, eq(teamMembers.teamId, teams.id))
    .leftJoin(teamWallets, eq(teams.id, teamWallets.teamId))
    .where(eq(teamMembers.userId, auth.userId))
    .limit(1)

  // Normalise: if team exists but wallet row is missing, show 0
  const team = membership?.team
    ? { ...membership.team, walletBalance: membership.team.walletBalance ?? 0 }
    : null

  return apiSuccess({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      gameName: user.gameName,
      gameUid: user.gameUid,
      profilePicture: user.profilePicture,
      profileCompleted: user.profileCompleted,
      emailVerified: user.emailVerified,
      firstName: (user.role === 'admin' || user.role === 'superadmin') ? user.firstName : undefined,
      lastName:  (user.role === 'admin' || user.role === 'superadmin') ? user.lastName  : undefined,
    },
    wallet: wallet ? {
      balance: wallet.balance,
      totalEarned: wallet.totalEarned,
      usdValue: (wallet.balance / 100).toFixed(2),
    } : null,
    team,
  })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request)
  if (!auth) return apiError('Unauthorized', 401)

  try {
    const body = await request.json()
    const [current] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1)
    if (!current) return apiError('User not found', 404)

    const updates: Partial<typeof users.$inferInsert> = {}

    // Real name can only be set once (before profileCompleted)
    if (!current.profileCompleted && body.firstName && body.lastName) {
      updates.firstName = body.firstName.trim()
      updates.lastName  = body.lastName.trim()
    }

    if (body.gameName   !== undefined) updates.gameName        = body.gameName.trim()
    if (body.gameUid    !== undefined) updates.gameUid         = body.gameUid.trim()
    if (body.profilePicture !== undefined) updates.profilePicture = body.profilePicture

    // Mark profile completed when all required fields are present
    const firstName = updates.firstName || current.firstName
    const lastName  = updates.lastName  || current.lastName
    const gameName  = updates.gameName  || current.gameName
    const gameUid   = updates.gameUid   || current.gameUid
    if (firstName && lastName && gameName && gameUid) {
      updates.profileCompleted = true
    }

    updates.updatedAt = new Date()
    const [updated] = await db.update(users).set(updates).where(eq(users.id, auth.userId)).returning()

    return apiSuccess({
      user: {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        gameName: updated.gameName,
        gameUid: updated.gameUid,
        profilePicture: updated.profilePicture,
        profileCompleted: updated.profileCompleted,
        emailVerified: updated.emailVerified,
      },
    })
  } catch (error) {
    console.error('[profile PATCH]', error)
    return apiError('Update failed', 500)
  }
}
