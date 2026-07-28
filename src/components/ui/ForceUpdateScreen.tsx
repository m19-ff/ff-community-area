'use client'
import { Download, Smartphone, AlertTriangle, Star } from 'lucide-react'

type Props = {
  version: string
  apkUrl: string
  apkSize: string | null
  releaseNotes: string | null
}

export default function ForceUpdateScreen({ version, apkUrl, apkSize, releaseNotes }: Props) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{
        background: 'var(--bg-primary)',
        zIndex: 9999,
        backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(227,28,28,0.10) 0%, transparent 70%)',
      }}
    >
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          pointerEvents: 'none',
        }}
      />

      <div className="relative z-10 w-full" style={{ maxWidth: 440 }}>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div
            className="relative flex items-center justify-center rounded-3xl"
            style={{
              width: 96, height: 96,
              background: 'linear-gradient(135deg, rgba(227,28,28,0.18) 0%, rgba(30,10,10,0.6) 100%)',
              border: '2px solid rgba(227,28,28,0.40)',
              boxShadow: '0 0 40px rgba(227,28,28,0.20)',
            }}
          >
            <Smartphone size={44} style={{ color: 'var(--accent-red)' }} />
            {/* Badge */}
            <div
              className="absolute -top-2 -right-2 flex items-center justify-center rounded-full"
              style={{ width: 28, height: 28, background: '#ef4444', border: '2px solid var(--bg-primary)' }}
            >
              <AlertTriangle size={14} color="#fff" />
            </div>
          </div>
        </div>

        {/* Heading */}
        <div className="text-center mb-6">
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-4 text-xs font-bold uppercase tracking-widest"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}
          >
            <AlertTriangle size={12} /> Update Required
          </div>
          <h1
            className="font-black mb-3"
            style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', lineHeight: 1.15, color: '#fff' }}
          >
            A new version is available
          </h1>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>
            FF Community Arena{' '}
            <span className="font-bold" style={{ color: '#f87171' }}>
              v{version}
            </span>{' '}
            is required to continue. Please download and install the update.
          </p>
        </div>

        {/* Release card */}
        <div
          className="rounded-2xl p-4 mb-6"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className="font-black text-sm"
                style={{ color: 'var(--accent-red)' }}
              >
                v{version}
              </span>
              <span
                className="badge text-xs"
                style={{ background: 'rgba(227,28,28,0.15)', color: '#f87171', border: '1px solid rgba(227,28,28,0.3)' }}
              >
                Latest
              </span>
            </div>
            {apkSize && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{apkSize}</span>
            )}
          </div>

          {releaseNotes && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Star size={11} style={{ color: '#f59e0b' }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  What&apos;s new
                </span>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.65, whiteSpace: 'pre-line' }}>
                {releaseNotes}
              </p>
            </div>
          )}
        </div>

        {/* CTA */}
        <a
          href={apkUrl}
          download
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            width: '100%',
            padding: '1rem',
            borderRadius: '0.875rem',
            background: 'linear-gradient(135deg, #e31c1c 0%, #b91c1c 100%)',
            color: '#fff',
            fontWeight: 800,
            fontSize: '1.05rem',
            letterSpacing: '0.02em',
            textDecoration: 'none',
            boxShadow: '0 4px 24px rgba(227,28,28,0.35)',
            border: 'none',
          }}
        >
          <Download size={20} />
          Download Update  v{version}
        </a>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
          After downloading, open the file to install.
          <br />
          Enable{' '}
          <span style={{ color: 'var(--text-secondary)' }}>
            &quot;Install from unknown sources&quot;
          </span>{' '}
          in Android Settings if prompted.
        </p>
      </div>
    </div>
  )
}
