'use client'
import { useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { User, Gamepad2, ArrowRight } from 'lucide-react'
import LoadingSpinner from '../ui/LoadingSpinner'

export default function CompleteProfilePage() {
  const { token, user, setUser, navigate, showToast } = useAppStore()
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    gameName: '',
    gameUid: '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.firstName.trim() || !form.lastName.trim()) {
      showToast('First and last name are required', 'error')
      return
    }
    if (!form.gameName.trim() || !form.gameUid.trim()) {
      showToast('Game name and UID are required', 'error')
      return
    }

    setLoading(true)
    const res = await apiCall('/auth/profile', { method: 'PATCH', body: JSON.stringify(form) }, token)
    setLoading(false)

    if (res.success && res.data) {
      const d = res.data as { user: typeof user }
      setUser(d.user)
      showToast('Profile completed! Welcome to FF Community Arena!', 'success')
      if (['admin', 'superadmin', 'assistant'].includes(d.user?.role ?? '')) {
        navigate('admin')
      } else {
        navigate('home')
      }
    } else {
      showToast(res.message || 'Failed to save profile', 'error')
    }
  }

  const steps = [
    { label: 'Account', done: true },
    { label: 'Profile', done: false, active: true },
    { label: 'Play', done: false },
  ]

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'var(--bg-primary)',
        backgroundImage: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(227,28,28,0.08) 0%, transparent 70%)',
      }}
    >
      <div className="w-full" style={{ maxWidth: 520 }}>
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div
                  className="flex items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    width: 28, height: 28,
                    background: step.done || step.active ? 'var(--accent-red)' : 'var(--bg-card)',
                    color: step.done || step.active ? 'white' : 'var(--text-muted)',
                    border: step.done || step.active ? 'none' : '1px solid var(--border)',
                  }}
                >
                  {step.done ? '✓' : i + 1}
                </div>
                <span className="text-small hidden sm:block" style={{ color: step.active ? 'white' : 'var(--text-muted)' }}>
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ width: 32, height: 1, background: 'var(--border)', margin: '0 4px' }} />
              )}
            </div>
          ))}
        </div>

        <div className="text-center mb-8">
          <h1 className="text-title mb-2">Complete Your Profile</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Set up your gaming identity. Your real name is kept private.
          </p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit}>
            {/* Real name - private section */}
            <div
              className="rounded-xl p-4 mb-6"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <User size={16} style={{ color: 'var(--text-muted)' }} />
                <span className="text-small font-semibold" style={{ color: 'var(--text-muted)' }}>
                  PRIVATE IDENTITY (Admin & You Only)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">First Name</label>
                  <input
                    className="input"
                    value={form.firstName}
                    onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    placeholder="Your real first name"
                    required
                  />
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input
                    className="input"
                    value={form.lastName}
                    onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                    placeholder="Your real last name"
                    required
                  />
                </div>
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                ⚠ Cannot be changed after profile completion. Used for identity verification only.
              </p>
            </div>

            {/* Gaming identity - public */}
            <div
              className="rounded-xl p-4 mb-6"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-accent)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Gamepad2 size={16} style={{ color: 'var(--accent-red)' }} />
                <span className="text-small font-semibold" style={{ color: 'var(--accent-red)' }}>
                  GAMING IDENTITY (Public)
                </span>
              </div>
              <div className="form-group">
                <label className="label">Game Name / Username</label>
                <input
                  className="input"
                  value={form.gameName}
                  onChange={e => setForm(f => ({ ...f, gameName: e.target.value }))}
                  placeholder="Your in-game username"
                  required
                />
              </div>
              <div>
                <label className="label">Game UID</label>
                <input
                  className="input"
                  value={form.gameUid}
                  onChange={e => setForm(f => ({ ...f, gameUid: e.target.value }))}
                  placeholder="Your unique player ID"
                  required
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Used for team invitations. Can be changed later.
                </p>
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}>
              {loading ? <LoadingSpinner /> : <ArrowRight size={18} />}
              {loading ? 'Saving Profile...' : 'Complete Profile & Enter Arena'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
