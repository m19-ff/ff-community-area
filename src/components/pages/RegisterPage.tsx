'use client'
import { useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Eye, EyeOff, UserPlus } from 'lucide-react'
import LoadingSpinner from '../ui/LoadingSpinner'

export default function RegisterPage() {
  const { navigate, setToken, setUser, showToast } = useAppStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { showToast('Passwords do not match', 'error'); return }
    if (password.length < 8) { showToast('Password must be at least 8 characters', 'error'); return }

    setLoading(true)
    const res = await apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setLoading(false)

    if (res.success && res.data) {
      const d = res.data as { token: string; user: Parameters<typeof setUser>[0] }
      setToken(d.token)
      setUser(d.user)
      showToast('Account created! Complete your profile to get started.')
      navigate('complete-profile')
    } else {
      showToast(res.message || 'Registration failed', 'error')
    }
  }

  const strength = password.length === 0 ? 0 : password.length < 8 ? 1 : password.length < 12 ? 2 : 3
  const strengthColors = ['', '#ef4444', '#f59e0b', '#22c55e']
  const strengthLabels = ['', 'Weak', 'Fair', 'Strong']

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'var(--bg-primary)',
        backgroundImage: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(227,28,28,0.08) 0%, transparent 70%)',
      }}
    >
      <div className="w-full" style={{ maxWidth: 420 }}>
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="FF Community Arena"
            style={{ width: 100, height: 100, objectFit: 'contain', margin: '0 auto 1rem' }}
          />
          <h1 className="text-title mb-1">Join FF Community Arena</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Create your account and start competing</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="label">Email Address</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="gamer@example.com"
                required
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label className="label">Password</label>
              <div className="relative">
                <input
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {password && (
                <div className="mt-2">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${(strength / 3) * 100}%`, background: strengthColors[strength] }}
                    />
                  </div>
                  <p className="text-xs mt-1" style={{ color: strengthColors[strength] }}>
                    {strengthLabels[strength]}
                  </p>
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="label">Confirm Password</label>
              <input
                className="input"
                type={showPass ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat your password"
                required
                style={{ borderColor: confirm && confirm !== password ? '#ef4444' : undefined }}
              />
              {confirm && confirm !== password && (
                <p className="text-xs mt-1" style={{ color: '#ef4444' }}>Passwords do not match</p>
              )}
            </div>

            <button type="submit" className="btn btn-primary w-full btn-lg" disabled={loading}>
              {loading ? <LoadingSpinner /> : <UserPlus size={18} />}
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>

            <p className="text-xs text-center mt-4" style={{ color: 'var(--text-muted)' }}>
              By creating an account you agree to our Terms of Service and Privacy Policy.
            </p>
          </form>
        </div>

        <p className="text-center mt-6 text-small" style={{ color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <button onClick={() => navigate('login')} style={{ color: 'var(--accent-red)', fontWeight: 600 }}>
            Sign In
          </button>
        </p>
        <p className="text-center mt-2">
          <button onClick={() => navigate('landing')} className="text-xs" style={{ color: 'var(--text-muted)' }}>
            ← Back to Home
          </button>
        </p>
      </div>
    </div>
  )
}
