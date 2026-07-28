import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { appReleases, users, notifications } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { requireAdmin, apiSuccess, apiError } from '@/lib/api'

// Raise body size limit to 200 MB for APK uploads
// (Vercel default is 4.5 MB which silently truncates large files)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '200mb',
    },
    responseLimit: '200mb',
  },
}

// Safe release shape — no binary apkData
type ReleaseRow = {
  id: number
  version: string
  apkUrl: string
  apkSize: string | null
  releaseNotes: string | null
  isPublished: boolean
  forceUpdate: boolean
  publishedAt: Date | null
  createdAt: Date
}

// ── GET — public: latest published release ───────────────────────────────────
export async function GET() {
  try {
    const [latest] = await db
      .select({
        id:           appReleases.id,
        version:      appReleases.version,
        apkUrl:       appReleases.apkUrl,
        apkSize:      appReleases.apkSize,
        releaseNotes: appReleases.releaseNotes,
        isPublished:  appReleases.isPublished,
        forceUpdate:  appReleases.forceUpdate,
        publishedAt:  appReleases.publishedAt,
        createdAt:    appReleases.createdAt,
        // apkData intentionally excluded — never send binary to clients
      })
      .from(appReleases)
      .where(eq(appReleases.isPublished, true))
      .orderBy(desc(appReleases.publishedAt))
      .limit(1)

    return apiSuccess({ release: latest || null })
  } catch (err) {
    console.error('[GET /api/app-release]', err)
    return apiError('Failed to fetch release', 500)
  }
}

// ── POST — admin: upload APK — stores binary in DB, no filesystem writes ─────
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Forbidden', 403)

  let formData: FormData
  try {
    formData = await request.formData()
  } catch (err) {
    console.error('[POST /api/app-release] formData parse error', err)
    return apiError('Could not parse upload — request may have timed out or been truncated', 400)
  }

  const version      = (formData.get('version')      as string | null)?.trim()
  const releaseNotes = (formData.get('releaseNotes')  as string | null)?.trim() || null
  const publish      = formData.get('publish')        === 'true'
  const forceUpdate  = formData.get('forceUpdate')    === 'true'
  const apkFile      = formData.get('apk') as File | null

  if (!version)                          return apiError('Version is required', 400)
  if (!apkFile || apkFile.size === 0)    return apiError('APK file is required', 400)
  if (!apkFile.name.endsWith('.apk'))    return apiError('Only .apk files are allowed', 400)
  if (apkFile.size > 200 * 1024 * 1024) return apiError('APK must be under 200 MB', 400)

  // Read file bytes into a Buffer — no filesystem access
  let apkBuffer: Buffer
  try {
    const bytes = await apkFile.arrayBuffer()
    apkBuffer = Buffer.from(bytes)
  } catch (err) {
    console.error('[POST /api/app-release] buffer read error', err)
    return apiError('Failed to read APK file data', 500)
  }

  const apkSize = `${(apkFile.size / (1024 * 1024)).toFixed(1)} MB`
  const now     = new Date()

  let release: ReleaseRow
  try {
    // Insert with placeholder URL first to get the ID, then set real download URL
    const safeName = `FFCommunityArena-v${version.replace(/[^a-zA-Z0-9._-]/g, '')}-release.apk`
    const [inserted] = await db.insert(appReleases).values({
      version,
      apkUrl:       `/api/app-release/download/0`, // temp — updated below
      apkSize,
      apkData:      apkBuffer,
      releaseNotes,
      isPublished:  publish,
      forceUpdate:  publish ? forceUpdate : false,
      publishedAt:  publish ? now : null,
      uploadedBy:   admin.userId,
    }).returning()

    // Update apkUrl to use the real ID-based download route
    const apkUrl = `/api/app-release/download/${inserted.id}?name=${encodeURIComponent(safeName)}`
    const [updated] = await db
      .update(appReleases)
      .set({ apkUrl })
      .where(eq(appReleases.id, inserted.id))
      .returning({
        id:           appReleases.id,
        version:      appReleases.version,
        apkUrl:       appReleases.apkUrl,
        apkSize:      appReleases.apkSize,
        releaseNotes: appReleases.releaseNotes,
        isPublished:  appReleases.isPublished,
        forceUpdate:  appReleases.forceUpdate,
        publishedAt:  appReleases.publishedAt,
        createdAt:    appReleases.createdAt,
      })
    release = updated
  } catch (err) {
    console.error('[POST /api/app-release] DB insert error', err)
    return apiError('Database error while saving release', 500)
  }

  // Broadcast notification when publishing
  if (publish) {
    try {
      const allUsers = await db.select({ id: users.id }).from(users)
      if (allUsers.length > 0) {
        const forceMsg = forceUpdate ? ' ⚠️ Update required — you must update to continue.' : ''
        await db.insert(notifications).values(
          allUsers.map(u => ({
            userId: u.id,
            type:   'general' as const,
            title:  `📱 New App Version ${version} Available!`,
            body: (releaseNotes
              ? `FF Community Arena v${version} is out. What's new: ${releaseNotes.slice(0, 100)}${releaseNotes.length > 100 ? '…' : ''}`
              : `FF Community Arena v${version} is now available. Download the latest APK from the Home screen.`
            ) + forceMsg,
            data: { apkUrl: release.apkUrl, version, forceUpdate },
          }))
        )
      }
    } catch (err) {
      // Non-fatal — release was saved, notifications failed
      console.error('[POST /api/app-release] notification error', err)
    }
  }

  return apiSuccess({
    release,
    message: publish
      ? `v${version} published${forceUpdate ? ' with Force Update' : ''} — all users notified!`
      : `v${version} saved as draft`,
  }, 201)
}

// ── PATCH — admin: toggle publish / forceUpdate ───────────────────────────────
export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Forbidden', 403)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON body', 400)
  }

  const { id, isPublished, forceUpdate, releaseNotes, version } = body
  if (!id) return apiError('Release ID required', 400)

  const updates: Record<string, unknown> = {}
  if (typeof isPublished === 'boolean') {
    updates.isPublished = isPublished
    updates.publishedAt = isPublished ? new Date() : null
    if (!isPublished) updates.forceUpdate = false
  }
  if (typeof forceUpdate  === 'boolean') updates.forceUpdate  = forceUpdate
  if (releaseNotes !== undefined)        updates.releaseNotes = releaseNotes
  if (version      !== undefined)        updates.version      = version

  let updated: ReleaseRow
  try {
    const [row] = await db
      .update(appReleases)
      .set(updates)
      .where(eq(appReleases.id, id as number))
      .returning({
        id:           appReleases.id,
        version:      appReleases.version,
        apkUrl:       appReleases.apkUrl,
        apkSize:      appReleases.apkSize,
        releaseNotes: appReleases.releaseNotes,
        isPublished:  appReleases.isPublished,
        forceUpdate:  appReleases.forceUpdate,
        publishedAt:  appReleases.publishedAt,
        createdAt:    appReleases.createdAt,
      })
    if (!row) return apiError('Release not found', 404)
    updated = row
  } catch (err) {
    console.error('[PATCH /api/app-release]', err)
    return apiError('Database error', 500)
  }

  // Notify when newly published
  if (updates.isPublished === true) {
    try {
      const allUsers = await db.select({ id: users.id }).from(users)
      const ver     = updated.version
      const fUpdate = updated.forceUpdate
      if (allUsers.length > 0) {
        const forceMsg = fUpdate ? ' ⚠️ Update required — you must update to continue.' : ''
        await db.insert(notifications).values(
          allUsers.map(u => ({
            userId: u.id,
            type:   'general' as const,
            title:  `📱 New App Version ${ver} Available!`,
            body: (updated.releaseNotes
              ? `FF Community Arena v${ver} is out. What's new: ${updated.releaseNotes.slice(0, 100)}`
              : `FF Community Arena v${ver} is now available. Download the latest APK from the Home screen.`
            ) + forceMsg,
            data: { apkUrl: updated.apkUrl, version: ver, forceUpdate: fUpdate },
          }))
        )
      }
    } catch (err) {
      console.error('[PATCH /api/app-release] notification error', err)
    }
  }

  // Strip apkData from response (not selected, but satisfy strict typing)
  return apiSuccess({ release: updated })
}

// ── PUT — admin: list all releases (no binary data) ──────────────────────────
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return apiError('Forbidden', 403)

  try {
    const releases = await db
      .select({
        id:           appReleases.id,
        version:      appReleases.version,
        apkUrl:       appReleases.apkUrl,
        apkSize:      appReleases.apkSize,
        releaseNotes: appReleases.releaseNotes,
        isPublished:  appReleases.isPublished,
        forceUpdate:  appReleases.forceUpdate,
        publishedAt:  appReleases.publishedAt,
        createdAt:    appReleases.createdAt,
        // apkData excluded — never return binary via list
      })
      .from(appReleases)
      .orderBy(desc(appReleases.createdAt))

    return apiSuccess({ releases })
  } catch (err) {
    console.error('[PUT /api/app-release]', err)
    return apiError('Failed to fetch releases', 500)
  }
}
