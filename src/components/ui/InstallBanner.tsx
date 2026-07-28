'use client'
import { useEffect, useState } from 'react'
import { Download, X, Smartphone } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Don't show if already running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // Don't show if dismissed before
    if (localStorage.getItem('pwa_dismissed')) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      // Show banner after 3 seconds
      setTimeout(() => setVisible(true), 3000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setInstalled(true))
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setVisible(false)
  }

  const dismiss = () => {
    setVisible(false)
    localStorage.setItem('pwa_dismissed', '1')
  }

  if (!visible || installed) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '5rem',
        left: '1rem',
        right: '1rem',
        zIndex: 9999,
        background: 'linear-gradient(135deg, #1a0a0f 0%, #0f0f1a 100%)',
        border: '1px solid rgba(225,29,72,0.4)',
        borderRadius: '1rem',
        padding: '1rem 1.25rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(225,29,72,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        maxWidth: 480,
        margin: '0 auto',
        backdropFilter: 'blur(12px)',
        animation: 'slideUp 0.3s ease',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '0.625rem',
          background: 'rgba(225,29,72,0.15)',
          border: '1px solid rgba(225,29,72,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Smartphone size={22} style={{ color: '#e11d48' }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#fff', lineHeight: 1.2 }}>
          Install FF Community Arena
        </div>
        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
          Add to home screen for the full app experience
        </div>
      </div>

      <button
        onClick={handleInstall}
        style={{
          background: '#e11d48',
          color: '#fff',
          border: 'none',
          borderRadius: '0.5rem',
          padding: '0.4rem 0.875rem',
          fontWeight: 700,
          fontSize: '0.8rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        <Download size={13} /> Install
      </button>

      <button
        onClick={dismiss}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.4)',
          cursor: 'pointer',
          padding: '0.25rem',
          flexShrink: 0,
          display: 'flex',
        }}
      >
        <X size={16} />
      </button>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(16px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
      `}</style>
    </div>
  )
}
