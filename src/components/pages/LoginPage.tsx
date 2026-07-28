'use client'
import { useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Eye, EyeOff, LogIn, Zap } from 'lucide-react'
import LoadingSpinner from '../ui/LoadingSpinner'

export default function LoginPage() {
  const { navigate, setToken, setUser, showToast } = useAppStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const res = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setLoading(false)

    if (res.success && res.data) {
      const d = res.data as { token: string; user: Parameters<typeof setUser>[0] }
      setToken(d.token)
      setUser(d.user)
      showToast(`Welcome back, ${d.user?.gameName || d.user?.email}!`)
      navigate(d.user?.profileCompleted ? 'home' : 'complete-profile')
    } else {
      showToast(res.message || 'Login failed', 'error')
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'var(--bg-primary)',
        backgroundImage: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(227,28,28,0.08) 0%, transparent 70%)',
      }}
    >
      <div className="w-full" style={{ maxWidth: 420 }}>
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="FF Community Arena"
            style={{ width: 100, height: 100, objectFit: 'contain', margin: '0 auto 1rem' }}
          />
          <h1 className="text-title mb-1">Welcome Back</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Sign in to your FF Community Arena account</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleLogin}>
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="label" style={{ margin: 0 }}>Password</label>
                <button
                  type="button"
                  onClick={() => navigate('forgot-password')}
                  className="text-xs"
                  style={{ color: 'var(--accent-red)' }}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                  autoComplete="current-password"
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
            </div>

            <button type="submit" className="btn btn-primary w-full btn-lg mt-2" disabled={loading}>
              {loading ? <LoadingSpinner /> : <LogIn size={18} />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-small" style={{ color: 'var(--text-secondary)' }}>
          {"Don't have an account? "}
          <button onClick={() => navigate('register')} style={{ color: 'var(--accent-red)', fontWeight: 600 }}>
            Create Account
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
