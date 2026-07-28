import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { appReleases } from '@/db/schema'
import { eq } from 'drizzle-orm'

// Public download endpoint — streams APK binary from database
// URL: /api/app-release/download/[id]?name=FFCommunityArena-v1.0.1-release.apk
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const releaseId = parseInt(id, 10)

  if (isNaN(releaseId) || releaseId < 1) {
    return NextResponse.json({ success: false, message: 'Invalid release ID' }, { status: 400 })
  }

  try {
    const [release] = await db
      .select({
        id:      appReleases.id,
        version: appReleases.version,
        apkData: appReleases.apkData,
        apkSize: appReleases.apkSize,
      })
      .from(appReleases)
      .where(eq(appReleases.id, releaseId))
      .limit(1)

    if (!release) {
      return NextResponse.json({ success: false, message: 'Release not found' }, { status: 404 })
    }

    if (!release.apkData) {
      return NextResponse.json({ success: false, message: 'APK file not stored in database' }, { status: 404 })
    }

    // Determine filename from query param or fallback
    const url      = new URL(request.url)
    const fileName = url.searchParams.get('name') ||
      `FFCommunityArena-v${release.version}-release.apk`

    const buffer = Buffer.isBuffer(release.apkData)
      ? release.apkData
      : Buffer.from(release.apkData as unknown as Uint8Array)

    // Stream binary — use Response directly to avoid NextResponse BodyInit TS strictness
    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.android.package-archive',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length':      String(buffer.length),
        'Cache-Control':       'public, max-age=86400',
      },
    })
  } catch (err) {
    console.error('[GET /api/app-release/download]', err)
    return NextResponse.json({ success: false, message: 'Failed to stream APK' }, { status: 500 })
  }
}
