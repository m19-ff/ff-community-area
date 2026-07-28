'use client'
import { useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { KeyRound, Mail } from 'lucide-react'
import LoadingSpinner from '../ui/LoadingSpinner'

export default function ForgotPasswordPage() {
  const { navigate, showToast } = useAppStore()
  const [step, setStep] = useState<'email' | 'reset'>('email')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const res = await apiCall('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
    setLoading(false)
    if (res.success) {
      showToast('Reset instructions sent. Check your email.', 'info')
      setStep('reset')
    } else {
      showToast(res.message || 'Failed', 'error')
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) { showToast('Password must be at least 8 characters', 'error'); return }
    setLoading(true)
    const res = await apiCall('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password: newPassword }) })
    setLoading(false)
    if (res.success) {
      showToast('Password reset successfully!')
      navigate('login')
    } else {
      showToast(res.message || 'Reset failed', 'error')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full" style={{ maxWidth: 420 }}>
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center rounded-full mb-4"
            style={{ width: 64, height: 64, background: 'var(--accent-red-dim)', border: '1px solid var(--border-accent)' }}
          >
            <KeyRound size={28} style={{ color: 'var(--accent-red)' }} />
          </div>
          <h1 className="text-title mb-2">{step === 'email' ? 'Forgot Password' : 'Reset Password'}</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {step === 'email' ? 'Enter your email to receive a reset token' : 'Enter your reset token and new password'}
          </p>
        </div>

        <div className="card p-6">
          {step === 'email' ? (
            <form onSubmit={handleForgot}>
              <div className="form-group">
                <label className="label">Email Address</label>
                <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required />
              </div>
              <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}>
                {loading ? <LoadingSpinner /> : <Mail size={18} />}
                {loading ? 'Sending...' : 'Send Reset Email'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset}>
              <div className="form-group">
                <label className="label">Reset Token</label>
                <input className="input" value={token} onChange={e => setToken(e.target.value)} placeholder="Token from email" required />
              </div>
              <div className="form-group">
                <label className="label">New Password</label>
                <input className="input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 8 characters" required />
              </div>
              <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}>
                {loading ? <LoadingSpinner /> : <KeyRound size={18} />}
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </form>
          )}
        </div>
        <p className="text-center mt-4">
          <button onClick={() => navigate('login')} className="text-xs" style={{ color: 'var(--text-muted)' }}>
            ← Back to Login
          </button>
        </p>
      </div>
    </div>
  )
}
