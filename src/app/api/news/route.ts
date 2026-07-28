import { NextRequest } from 'next/server'
import { db } from '@/db'
import { news } from '@/db/schema'
import { eq, and, desc, count } from 'drizzle-orm'
import { requireAuth, requireAdmin, apiSuccess, apiError, paginate } from '@/lib/api'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const type = searchParams.get('type')
  const { limit: take, offset, page: pg } = paginate(page, 20)

  const conditions: ReturnType<typeof eq>[] = [eq(news.isPublished, true)]
  if (type) conditions.push(eq(news.type, type as typeof news.type._.data))

  const list = await db.select().from(news)
    .where(and(...conditions))
    .orderBy(desc(news.publishedAt))
    .limit(take)
    .offset(offset)

  const [{ total }] = await db.select({ total: count() }).from(news).where(and(...conditions))

  return apiSuccess({
    news: list,
    pagination: { page: pg, limit: take, total, pages: Math.ceil(total / take) },
  })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Admin access required', 403)

  const body = await request.json()
  const { type, title, content, image, videoUrl, isPublished } = body

  if (!type || !title || !content) return apiError('type, title, and content required', 400)

  const [item] = await db.insert(news).values({
    type: type as typeof news.type._.data,
    title: title.trim(),
    content,
    image: image || null,
    videoUrl: videoUrl || null,
    isPublished: isPublished || false,
    publishedAt: isPublished ? new Date() : null,
    createdBy: admin.userId,
  }).returning()

  return apiSuccess({ news: item }, 201)
}
