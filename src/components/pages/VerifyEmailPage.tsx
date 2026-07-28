'use client'
import { useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Mail, CheckCircle } from 'lucide-react'
import LoadingSpinner from '../ui/LoadingSpinner'

export default function VerifyEmailPage() {
  const { navigate, token, showToast } = useAppStore()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(false)

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const res = await apiCall('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token: code }) })
    setLoading(false)
    if (res.success) {
      setVerified(true)
      showToast('Email verified successfully!')
      setTimeout(() => navigate('home'), 2000)
    } else {
      showToast(res.message || 'Verification failed', 'error')
    }
  }

  if (verified) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
          <CheckCircle size={64} style={{ color: '#22c55e', margin: '0 auto 16px' }} />
          <h2 className="text-title mb-2">Email Verified!</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Redirecting to dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full" style={{ maxWidth: 420 }}>
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center rounded-full mb-4"
            style={{ width: 64, height: 64, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}
          >
            <Mail size={28} style={{ color: '#60a5fa' }} />
          </div>
          <h1 className="text-title mb-2">Verify Your Email</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Enter the verification token from your email</p>
        </div>
        <div className="card p-6">
          <form onSubmit={handleVerify}>
            <div className="form-group">
              <label className="label">Verification Token</label>
              <input
                className="input"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="Paste your verification token"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}>
              {loading ? <LoadingSpinner /> : null}
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>
          </form>
        </div>
        <p className="text-center mt-4">
          <button onClick={() => navigate('home')} className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Skip for now →
          </button>
        </p>
      </div>
    </div>
  )
}
