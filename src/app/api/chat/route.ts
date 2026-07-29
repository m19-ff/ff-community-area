import { NextRequest } from 'next/server'
import { db } from '@/db'
import { chatMessages, teamMembers, users } from '@/db/schema'
import { eq, desc, and, sql, lt } from 'drizzle-orm'
import { apiSuccess, apiError, requireAuth } from '@/lib/api'

export async function GET(request: NextRequest) {
  const authUser = await requireAuth(request)
  if (!authUser) return apiError('Unauthorized', 401)

  const { searchParams } = new URL(request.url)
  const teamId = parseInt(searchParams.get('teamId') || '0')
  const before = searchParams.get('before') // cursor: message id for infinite scroll
  const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100)

  if (!teamId) return apiError('teamId required')

  // Verify user is a team member
  const [membership] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, authUser.userId)))
  if (!membership) return apiError('Not a member of this team', 403)

  const conditions = [eq(chatMessages.teamId, teamId)]
  if (before) conditions.push(lt(chatMessages.id, parseInt(before)))

  const msgs = await db
    .select({
      id:        chatMessages.id,
      type:      chatMessages.type,
      content:   chatMessages.content,
      imageUrl:  chatMessages.imageUrl,
      readBy:    chatMessages.readBy,
      createdAt: chatMessages.createdAt,
      userId:    chatMessages.userId,
      gameName:  users.gameName,
      profilePicture: users.profilePicture,
    })
    .from(chatMessages)
    .leftJoin(users, eq(users.id, chatMessages.userId))
    .where(and(...conditions))
    .orderBy(desc(chatMessages.id))
    .limit(limit)

  // Mark messages as read by this user
  const unreadIds = msgs
    .filter(m => {
      const rb = (m.readBy as number[]) || []
      return !rb.includes(authUser.userId)
    })
    .map(m => m.id)

  if (unreadIds.length > 0) {
    // Update readBy for each message (append userId)
    for (const msgId of unreadIds) {
      await db.update(chatMessages)
        .set({ readBy: sql`jsonb_insert(COALESCE(read_by, '[]'::jsonb), '{-1}', to_jsonb(${authUser.userId}::int), true)` })
        .where(eq(chatMessages.id, msgId))
    }
  }

  // Unread count for this user
  const [{ unread }] = await db
    .select({ unread: sql<number>`COUNT(*) FILTER (WHERE NOT (read_by @> to_jsonb(${authUser.userId}::int)))` })
    .from(chatMessages)
    .where(eq(chatMessages.teamId, teamId))

  return apiSuccess({
    messages: msgs.reverse(), // oldest first
    hasMore: msgs.length === limit,
    unread: Number(unread) || 0,
  })
}

export async function POST(request: NextRequest) {
  const authUser = await requireAuth(request)
  if (!authUser) return apiError('Unauthorized', 401)

  const body = await request.json() as {
    teamId: number; content: string; type?: string; imageUrl?: string
  }

  if (!body.teamId || !body.content?.trim()) return apiError('teamId and content required')

  // Verify membership
  const [membership] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, body.teamId), eq(teamMembers.userId, authUser.userId)))
  if (!membership) return apiError('Not a member of this team', 403)

  const [msg] = await db.insert(chatMessages).values({
    teamId:   body.teamId,
    userId:   authUser.userId,
    type:     (body.type || 'message') as 'message' | 'system' | 'image',
    content:  body.content.trim(),
    imageUrl: body.imageUrl || null,
    readBy:   [authUser.userId],
  }).returning()

  // Fetch sender info from users table
  const [sender] = await db
    .select({ gameName: users.gameName, profilePicture: users.profilePicture })
    .from(users)
    .where(eq(users.id, authUser.userId))

  return apiSuccess({ message: { ...msg, gameName: sender?.gameName ?? null, profilePicture: sender?.profilePicture ?? null } })
}

export async function PATCH(request: NextRequest) {
  const authUser = await requireAuth(request)
  if (!authUser) return apiError('Unauthorized', 401)

  // Mark team chat as read
  const body = await request.json() as { teamId: number }
  if (!body.teamId) return apiError('teamId required')

  const [membership] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, body.teamId), eq(teamMembers.userId, authUser.userId)))
  if (!membership) return apiError('Not a member', 403)

  await db.update(chatMessages)
    .set({ readBy: sql`jsonb_set(COALESCE(read_by, '[]'::jsonb), '{-1}', to_jsonb(${authUser.userId}::int), true)` })
    .where(and(
      eq(chatMessages.teamId, body.teamId),
      sql`NOT (read_by @> to_jsonb(${authUser.userId}::int))`,
    ))

  return apiSuccess({ message: 'Marked as read' })
}
