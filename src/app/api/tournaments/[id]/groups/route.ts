import { NextRequest } from 'next/server'
import { db } from '@/db'
import {
  tournaments, tournamentTeams, teams,
  tournamentGroups, tournamentGroupTeams,
} from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAdmin, apiSuccess, apiError } from '@/lib/api'

const GROUP_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

// ── GET /api/tournaments/[id]/groups ─────────────────────────────────────────
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const tournId = parseInt(id)
    if (isNaN(tournId)) return apiError('Invalid tournament ID', 400)

    const [tournament] = await db
      .select({ id: tournaments.id })
      .from(tournaments)
      .where(eq(tournaments.id, tournId))
      .limit(1)
    if (!tournament) return apiError('Tournament not found', 404)

    const groups = await db
      .select()
      .from(tournamentGroups)
      .where(eq(tournamentGroups.tournamentId, tournId))
      .orderBy(tournamentGroups.name)

    const assignments = await db
      .select({
        id:         tournamentGroupTeams.id,
        groupId:    tournamentGroupTeams.groupId,
        teamId:     tournamentGroupTeams.teamId,
        assignedAt: tournamentGroupTeams.assignedAt,
        teamName:   teams.name,
        teamLogo:   teams.logo,
      })
      .from(tournamentGroupTeams)
      .leftJoin(teams, eq(tournamentGroupTeams.teamId, teams.id))
      .where(eq(tournamentGroupTeams.tournamentId, tournId))

    const registered = await db
      .select({
        teamId:   tournamentTeams.teamId,
        teamName: teams.name,
        teamLogo: teams.logo,
      })
      .from(tournamentTeams)
      .leftJoin(teams, eq(tournamentTeams.teamId, teams.id))
      .where(eq(tournamentTeams.tournamentId, tournId))

    const assignedTeamIds = new Set(assignments.map(a => a.teamId))
    const unassigned = registered.filter(r => !assignedTeamIds.has(r.teamId))

    return apiSuccess({
      groups: groups.map(g => ({
        ...g,
        teams: assignments.filter(a => a.groupId === g.id),
      })),
      unassigned,
    })
  } catch (error) {
    console.error('[GET /tournaments/[id]/groups]', error)
    return apiError('Failed to load groups', 500)
  }
}

// ── POST /api/tournaments/[id]/groups ────────────────────────────────────────
// Actions: create_groups | assign_team | remove_team | delete_group | auto_assign
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const { id } = await params
  const tournId = parseInt(id)
  if (isNaN(tournId)) return apiError('Invalid tournament ID', 400)

  try {
    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournId))
      .limit(1)
    if (!tournament) return apiError('Tournament not found', 404)

    const body = await request.json()
    const { action } = body

    // ── create_groups ─────────────────────────────────────────────────────────
    if (action === 'create_groups') {
      const count = parseInt(body.count)
      if (isNaN(count) || count < 1 || count > 26) {
        return apiError('count must be 1–26', 400)
      }

      const letters = GROUP_LETTERS.slice(0, count)
      const existing = await db
        .select({ name: tournamentGroups.name })
        .from(tournamentGroups)
        .where(eq(tournamentGroups.tournamentId, tournId))

      const existingNames = new Set(existing.map(g => g.name))
      const toCreate = letters.filter(l => !existingNames.has(l))

      if (toCreate.length > 0) {
        await db.insert(tournamentGroups).values(
          toCreate.map(name => ({ tournamentId: tournId, name })),
        )
      }

      if (body.autoAssign) {
        const allGroups = await db
          .select()
          .from(tournamentGroups)
          .where(eq(tournamentGroups.tournamentId, tournId))
          .orderBy(tournamentGroups.name)

        const assigned = await db
          .select({ teamId: tournamentGroupTeams.teamId })
          .from(tournamentGroupTeams)
          .where(eq(tournamentGroupTeams.tournamentId, tournId))

        const assignedIds = new Set(assigned.map(a => a.teamId))
        const registered = await db
          .select({ teamId: tournamentTeams.teamId })
          .from(tournamentTeams)
          .where(eq(tournamentTeams.tournamentId, tournId))

        const toAssign = registered.filter(r => !assignedIds.has(r.teamId))

        for (let i = 0; i < toAssign.length; i++) {
          const group = allGroups[i % allGroups.length]
          await db.insert(tournamentGroupTeams)
            .values({
              groupId:      group.id,
              tournamentId: tournId,
              teamId:       toAssign[i].teamId,
            })
            .onConflictDoNothing()
        }
      }

      return apiSuccess({ message: 'Groups created' })
    }

    // ── assign_team ───────────────────────────────────────────────────────────
    if (action === 'assign_team') {
      const groupId = parseInt(body.groupId)
      const teamId  = parseInt(body.teamId)
      if (isNaN(groupId) || isNaN(teamId)) return apiError('groupId and teamId required', 400)

      const [group] = await db
        .select()
        .from(tournamentGroups)
        .where(and(eq(tournamentGroups.id, groupId), eq(tournamentGroups.tournamentId, tournId)))
        .limit(1)
      if (!group) return apiError('Group not found in this tournament', 404)

      const [reg] = await db
        .select()
        .from(tournamentTeams)
        .where(and(eq(tournamentTeams.tournamentId, tournId), eq(tournamentTeams.teamId, teamId)))
        .limit(1)
      if (!reg) return apiError('Team is not registered in this tournament', 400)

      // Remove from any existing group first
      await db
        .delete(tournamentGroupTeams)
        .where(and(
          eq(tournamentGroupTeams.tournamentId, tournId),
          eq(tournamentGroupTeams.teamId, teamId),
        ))

      await db.insert(tournamentGroupTeams).values({
        groupId,
        tournamentId: tournId,
        teamId,
      })

      return apiSuccess({ message: 'Team assigned to group' })
    }

    // ── remove_team ───────────────────────────────────────────────────────────
    if (action === 'remove_team') {
      const teamId = parseInt(body.teamId)
      if (isNaN(teamId)) return apiError('teamId required', 400)

      await db
        .delete(tournamentGroupTeams)
        .where(and(
          eq(tournamentGroupTeams.tournamentId, tournId),
          eq(tournamentGroupTeams.teamId, teamId),
        ))

      return apiSuccess({ message: 'Team removed from group' })
    }

    // ── delete_group ──────────────────────────────────────────────────────────
    if (action === 'delete_group') {
      const groupId = parseInt(body.groupId)
      if (isNaN(groupId)) return apiError('groupId required', 400)

      await db
        .delete(tournamentGroups)
        .where(and(
          eq(tournamentGroups.id, groupId),
          eq(tournamentGroups.tournamentId, tournId),
        ))

      return apiSuccess({ message: 'Group deleted' })
    }

    // ── auto_assign ───────────────────────────────────────────────────────────
    if (action === 'auto_assign') {
      const allGroups = await db
        .select()
        .from(tournamentGroups)
        .where(eq(tournamentGroups.tournamentId, tournId))
        .orderBy(tournamentGroups.name)

      if (allGroups.length === 0) return apiError('Create groups first', 400)

      await db
        .delete(tournamentGroupTeams)
        .where(eq(tournamentGroupTeams.tournamentId, tournId))

      const registered = await db
        .select({ teamId: tournamentTeams.teamId })
        .from(tournamentTeams)
        .where(eq(tournamentTeams.tournamentId, tournId))

      for (let i = 0; i < registered.length; i++) {
        const group = allGroups[i % allGroups.length]
        await db.insert(tournamentGroupTeams)
          .values({
            groupId:      group.id,
            tournamentId: tournId,
            teamId:       registered[i].teamId,
          })
          .onConflictDoNothing()
      }

      return apiSuccess({ message: `${registered.length} teams distributed across ${allGroups.length} groups` })
    }

    return apiError('Invalid action', 400)
  } catch (error) {
    console.error('[POST /tournaments/[id]/groups]', error)
    return apiError('Failed to process group action', 500)
  }
}
