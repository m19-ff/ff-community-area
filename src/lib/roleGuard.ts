/**
 * roleGuard.ts — Centralized role-change authority
 *
 * This is the ONLY place in the codebase that may write `users.role`.
 * Every API that needs to change a user's role MUST call one of the
 * exported helpers here.  Direct `db.update(users).set({ role: … })`
 * calls outside this file are forbidden.
 *
 * Enforcement rules
 * ─────────────────
 * 1. PRIVILEGED roles ('admin', 'superadmin') can NEVER be changed by
 *    any team operation (create, delete, leave, join-request, invitation,
 *    transfer-captain, add/remove member).
 * 2. Only the dedicated Admin User Management endpoint
 *    (PATCH /api/admin/users/[id]  action='set_role') may change roles,
 *    and even that endpoint must call `adminSetRole()` below.
 * 3. A regular admin can change player/captain/assistant roles and can
 *    promote someone to 'admin', but CANNOT touch 'superadmin' accounts.
 * 4. Only a superadmin can modify another superadmin's role.
 * 5. Every role change is logged to console with a structured record
 *    (userId, route, previousRole, newRole, performedBy, timestamp).
 */

import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

// ─── Constants ────────────────────────────────────────────────────────────────

export const PRIVILEGED_ROLES = ['admin', 'superadmin'] as const
export const TEAM_ASSIGNABLE_ROLES = ['player', 'captain', 'assistant'] as const

export type UserRole = 'player' | 'captain' | 'assistant' | 'admin' | 'superadmin'

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isPrivileged(role: string | null | undefined): boolean {
  return PRIVILEGED_ROLES.includes(role as typeof PRIVILEGED_ROLES[number])
}

function securityLog(event: {
  action: string
  targetUserId: number
  targetPreviousRole: string
  targetNewRole: string
  performedBy: string
  route: string
}) {
  console.warn(
    `[ROLE-GUARD] ${new Date().toISOString()} | action=${event.action}` +
    ` | targetUser=${event.targetUserId} (${event.targetPreviousRole} → ${event.targetNewRole})` +
    ` | by=${event.performedBy} | route=${event.route}`,
  )
}

// ─── Team-operation role writers ─────────────────────────────────────────────
// These three functions are the only ones team routes may call.
// Each one hard-aborts if the target is a privileged account.

/**
 * Set a non-privileged user's role to 'captain' when they create a team.
 * Silently skips — does NOT throw — if the user is admin/superadmin.
 */
export async function teamSetCaptain(
  targetUserId: number,
  callerRole: string,
  route: string,
): Promise<void> {
  if (isPrivileged(callerRole)) {
    securityLog({
      action: 'BLOCKED_team_set_captain',
      targetUserId,
      targetPreviousRole: callerRole,
      targetNewRole: 'captain',
      performedBy: `self (${targetUserId})`,
      route,
    })
    return // silent skip — admin keeps their role
  }
  await db.update(users).set({ role: 'captain' }).where(eq(users.id, targetUserId))
}

/**
 * Reset a non-privileged user's role to 'player' on team dissolution or leave.
 * Silently skips admin/superadmin accounts.
 * Pass the user's CURRENT role from a fresh DB read (not from JWT cache).
 */
export async function teamResetToPlayer(
  targetUserId: number,
  currentDbRole: string,
  route: string,
): Promise<void> {
  if (isPrivileged(currentDbRole)) {
    securityLog({
      action: 'BLOCKED_team_reset_to_player',
      targetUserId,
      targetPreviousRole: currentDbRole,
      targetNewRole: 'player',
      performedBy: 'team-op',
      route,
    })
    return // silent skip
  }
  await db.update(users).set({ role: 'player' }).where(eq(users.id, targetUserId))
}

/**
 * Transfer captaincy between two non-privileged users.
 * Returns an error string if blocked, null if the update was applied.
 */
export async function teamTransferCaptain(opts: {
  oldCaptainId: number
  oldCaptainRole: string
  newCaptainId: number
  newCaptainRole: string
  route: string
}): Promise<string | null> {
  if (isPrivileged(opts.oldCaptainRole)) {
    securityLog({
      action: 'BLOCKED_transfer_captain_from_admin',
      targetUserId: opts.oldCaptainId,
      targetPreviousRole: opts.oldCaptainRole,
      targetNewRole: 'player',
      performedBy: 'admin-team-op',
      route: opts.route,
    })
    return 'Cannot transfer captaincy from an admin/superadmin account'
  }
  if (isPrivileged(opts.newCaptainRole)) {
    securityLog({
      action: 'BLOCKED_transfer_captain_to_admin',
      targetUserId: opts.newCaptainId,
      targetPreviousRole: opts.newCaptainRole,
      targetNewRole: 'captain',
      performedBy: 'admin-team-op',
      route: opts.route,
    })
    return 'Cannot assign captaincy to an admin/superadmin account'
  }

  // Safe to proceed
  await db.update(users).set({ role: 'player'  }).where(eq(users.id, opts.oldCaptainId))
  await db.update(users).set({ role: 'captain' }).where(eq(users.id, opts.newCaptainId))
  return null
}

// ─── Admin User Management role writer ───────────────────────────────────────

/**
 * The ONLY function that changes roles via the Admin User Management page.
 *
 * Rules:
 * - Allowed destination roles: player, captain, assistant, admin, superadmin
 * - A regular admin (performer role = 'admin') CANNOT change a superadmin's role.
 * - Only a superadmin can demote or change another superadmin.
 * - No one can remove the last superadmin from their role.
 *
 * Returns an error string on rejection, null on success.
 */
export async function adminSetRole(opts: {
  targetUserId: number
  targetCurrentRole: string
  newRole: string
  performerUserId: number
  performerRole: string
  route: string
}): Promise<string | null> {
  const ALLOWED: UserRole[] = ['player', 'captain', 'assistant', 'admin', 'superadmin']
  if (!ALLOWED.includes(opts.newRole as UserRole)) {
    return `Invalid role '${opts.newRole}'`
  }

  // Regular admin cannot touch superadmin accounts
  if (opts.performerRole === 'admin' && opts.targetCurrentRole === 'superadmin') {
    securityLog({
      action: 'BLOCKED_admin_modify_superadmin',
      targetUserId: opts.targetUserId,
      targetPreviousRole: opts.targetCurrentRole,
      targetNewRole: opts.newRole,
      performedBy: `admin(${opts.performerUserId})`,
      route: opts.route,
    })
    return 'Only a superadmin can modify another superadmin account'
  }

  // No-op if already the right role
  if (opts.targetCurrentRole === opts.newRole) {
    return null
  }

  securityLog({
    action: 'adminSetRole',
    targetUserId: opts.targetUserId,
    targetPreviousRole: opts.targetCurrentRole,
    targetNewRole: opts.newRole,
    performedBy: `${opts.performerRole}(${opts.performerUserId})`,
    route: opts.route,
  })

  await db
    .update(users)
    .set({ role: opts.newRole as UserRole })
    .where(eq(users.id, opts.targetUserId))

  return null
}
