import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Download — FF Community Arena',
  description: 'Download the FF Community Arena Android app',
}

export default function DownloadPage() {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0a0a0a', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(227,28,28,0.12) 0%, transparent 70%)',
        }}>

          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="FF Community Arena" style={{ width: 88, height: 88, borderRadius: 20, marginBottom: '1.5rem', border: '2px solid rgba(227,28,28,0.4)' }} />

          <h1 style={{ fontSize: '1.8rem', fontWeight: 900, margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
            FF Community Arena
          </h1>
          <p style={{ color: '#9ca3af', margin: '0 0 2.5rem', fontSize: '0.95rem' }}>
            Android App — Version 1.0.1
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: 400 }}>

            {/* APK download */}
            <a
              href="/apk/FFCommunityArena-v1.0.1-release.apk"
              download="FFCommunityArena-v1.0.1-release.apk"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1.25rem 1.5rem',
                borderRadius: '1rem',
                background: 'linear-gradient(135deg, #e31c1c 0%, #b91c1c 100%)',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '1rem',
                boxShadow: '0 4px 24px rgba(227,28,28,0.35)',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
                <polyline points="8 12 12 16 16 12"/>
              </svg>
              <div>
                <div>Download APK</div>
                <div style={{ fontWeight: 400, fontSize: '0.78rem', opacity: 0.85, marginTop: 2 }}>
                  FFCommunityArena-v1.0.1-release.apk · 6.5 MB
                </div>
              </div>
            </a>

            {/* AAB download */}
            <a
              href="/apk/FFCommunityArena-v1.0.1-release.aab"
              download="FFCommunityArena-v1.0.1-release.aab"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1.25rem 1.5rem',
                borderRadius: '1rem',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '1rem',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
              <div>
                <div style={{ color: '#a78bfa' }}>Download AAB</div>
                <div style={{ fontWeight: 400, fontSize: '0.78rem', color: '#9ca3af', marginTop: 2 }}>
                  FFCommunityArena-v1.0.1-release.aab · 8.4 MB · Google Play upload
                </div>
              </div>
            </a>
          </div>

          {/* Install instructions */}
          <div style={{
            marginTop: '2.5rem',
            padding: '1.25rem 1.5rem',
            borderRadius: '1rem',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            maxWidth: 400,
            width: '100%',
          }}>
            <p style={{ margin: '0 0 0.75rem', fontWeight: 700, fontSize: '0.85rem', color: '#f59e0b' }}>
              📲 How to install the APK
            </p>
            <ol style={{ margin: 0, paddingLeft: '1.25rem', color: '#9ca3af', fontSize: '0.85rem', lineHeight: 1.8 }}>
              <li>Download the APK file above</li>
              <li>Open <strong style={{ color: '#e5e7eb' }}>Settings → Security</strong></li>
              <li>Enable <strong style={{ color: '#e5e7eb' }}>Install unknown sources</strong></li>
              <li>Open the downloaded APK and tap <strong style={{ color: '#e5e7eb' }}>Install</strong></li>
            </ol>
          </div>

          <p style={{ marginTop: '2rem', color: '#4b5563', fontSize: '0.78rem' }}>
            Signed release build · Min Android 7.0 (API 24) · v1.0.1
          </p>
        </div>
      </body>
    </html>
  )
}
