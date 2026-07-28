import { NextRequest } from 'next/server'
import { db } from '@/db'
import { appReleases, users, notifications } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAdmin, apiSuccess, apiError } from '@/lib/api'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

// ── GET — public: latest published release (includes forceUpdate flag) ───────
export async function GET() {
  const [latest] = await db
    .select()
    .from(appReleases)
    .where(eq(appReleases.isPublished, true))
    .orderBy(desc(appReleases.publishedAt))
    .limit(1)

  return apiSuccess({ release: latest || null })
}

// ── POST — admin: upload APK + metadata ──────────────────────────────────────
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Forbidden', 403)

  const formData    = await request.formData()
  const version     = (formData.get('version')     as string | null)?.trim()
  const releaseNotes = (formData.get('releaseNotes') as string | null)?.trim() || null
  const publish     = formData.get('publish')      === 'true'
  const forceUpdate = formData.get('forceUpdate')  === 'true'
  const apkFile     = formData.get('apk') as File | null

  if (!version) return apiError('Version is required', 400)
  if (!apkFile || apkFile.size === 0) return apiError('APK file is required', 400)
  if (!apkFile.name.endsWith('.apk')) return apiError('Only .apk files are allowed', 400)

  // Save to public/apk/
  const safeName = `ff-arena-v${version.replace(/[^a-zA-Z0-9._-]/g, '')}.apk`
  const apkDir   = join(process.cwd(), 'public', 'apk')
  await mkdir(apkDir, { recursive: true })
  const bytes = await apkFile.arrayBuffer()
  await writeFile(join(apkDir, safeName), Buffer.from(bytes))

  const apkSize = `${(apkFile.size / (1024 * 1024)).toFixed(1)} MB`
  const apkUrl  = `/apk/${safeName}`
  const now     = new Date()

  const [release] = await db.insert(appReleases).values({
    version,
    apkUrl,
    apkSize,
    releaseNotes,
    isPublished:  publish,
    forceUpdate:  publish ? forceUpdate : false,   // force only makes sense when published
    publishedAt:  publish ? now : null,
    uploadedBy:   admin.userId,
  }).returning()

  // Broadcast notification to all users when publishing
  if (publish) {
    const allUsers = await db.select({ id: users.id }).from(users)
    if (allUsers.length > 0) {
      const forceMsg = forceUpdate ? ' ⚠️ Update required — you must update to continue.' : ''
      await db.insert(notifications).values(
        allUsers.map(u => ({
          userId: u.id,
          type:   'general' as const,
          title:  `📱 New App Version ${version} Available!`,
          body:   (releaseNotes
            ? `FF Community Arena v${version} is out. What's new: ${releaseNotes.slice(0, 100)}${releaseNotes.length > 100 ? '…' : ''}`
            : `FF Community Arena v${version} is now available. Download the latest APK from the Home screen.`
          ) + forceMsg,
          data:   { apkUrl, version, forceUpdate },
        }))
      )
    }
  }

  return apiSuccess({
    release,
    message: publish
      ? `Published${forceUpdate ? ' with Force Update' : ''} — all users notified!`
      : 'Saved as draft',
  }, 201)
}

// ── PATCH — admin: toggle publish / forceUpdate / edit fields ────────────────
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Forbidden', 403)

  const body = await request.json()
  const { id, isPublished, forceUpdate, releaseNotes, version } = body
  if (!id) return apiError('Release ID required', 400)

  const updates: Record<string, unknown> = {}
  if (typeof isPublished  === 'boolean') {
    updates.isPublished = isPublished
    updates.publishedAt = isPublished ? new Date() : null
    // Unpublishing clears force update too
    if (!isPublished) updates.forceUpdate = false
  }
  if (typeof forceUpdate  === 'boolean') updates.forceUpdate  = forceUpdate
  if (releaseNotes !== undefined)        updates.releaseNotes = releaseNotes
  if (version      !== undefined)        updates.version      = version

  const [updated] = await db
    .update(appReleases)
    .set(updates)
    .where(eq(appReleases.id, id))
    .returning()

  if (!updated) return apiError('Release not found', 404)

  // Notify users when newly published
  if (updates.isPublished === true) {
    const allUsers = await db.select({ id: users.id }).from(users)
    const ver      = updated.version
    const fUpdate  = updated.forceUpdate
    if (allUsers.length > 0) {
      const forceMsg = fUpdate ? ' ⚠️ Update required — you must update to continue.' : ''
      await db.insert(notifications).values(
        allUsers.map(u => ({
          userId: u.id,
          type:   'general' as const,
          title:  `📱 New App Version ${ver} Available!`,
          body:   (updated.releaseNotes
            ? `FF Community Arena v${ver} is out. What's new: ${updated.releaseNotes.slice(0, 100)}`
            : `FF Community Arena v${ver} is now available. Download the latest APK from the Home screen.`
          ) + forceMsg,
          data:   { apkUrl: updated.apkUrl, version: ver, forceUpdate: fUpdate },
        }))
      )
    }
  }

  return apiSuccess({ release: updated })
}

// ── PUT — admin: list all releases ───────────────────────────────────────────
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Forbidden', 403)

  const releases = await db
    .select()
    .from(appReleases)
    .orderBy(desc(appReleases.createdAt))

  return apiSuccess({ releases })
}
