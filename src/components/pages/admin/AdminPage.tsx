'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Users, Shield, Trophy, Swords, Zap, DollarSign, TrendingUp, RefreshCw } from 'lucide-react'
import { PageLoader } from '../../ui/LoadingSpinner'

type Stats = {
  users: number; teams: number; players: number; tournaments: number;
  scrims: number; pendingWithdrawals: number; totalPointsInCirculation: number; revenue: string;
}

export default function AdminPage() {
  const { token, navigate } = useAppStore()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiCall('/admin/stats', {}, token).then(res => {
      if (res.success && res.data) setStats((res.data as { stats: Stats }).stats)
      setLoading(false)
    })
  }, [token])

  if (loading) return <PageLoader />

  const statCards = [
    { label: 'Total Users', value: stats?.users || 0, icon: Users, color: '#3b82f6', page: 'admin-users' },
    { label: 'Active Teams', value: stats?.teams || 0, icon: Shield, color: '#8b5cf6', page: 'admin-teams' },
    { label: 'Players in Teams', value: stats?.players || 0, icon: Users, color: '#22c55e', page: 'admin-users' },
    { label: 'Tournaments', value: stats?.tournaments || 0, icon: Trophy, color: '#f59e0b', page: 'admin-tournaments' },
    { label: 'Scrims', value: stats?.scrims || 0, icon: Swords, color: '#06b6d4', page: 'admin-scrims' },
    { label: 'Pending Withdrawals', value: stats?.pendingWithdrawals || 0, icon: DollarSign, color: '#e31c1c', page: 'admin-withdrawals' },
    { label: 'Points in Circulation', value: (stats?.totalPointsInCirculation || 0).toLocaleString(), icon: Zap, color: '#f59e0b', page: null },
    { label: 'Platform Revenue', value: `$${stats?.revenue || '0.00'}`, icon: TrendingUp, color: '#22c55e', page: null },
  ]

  const quickActions = [
    { label: 'Create Tournament', action: () => navigate('admin-tournaments'), color: '#f59e0b' },
    { label: 'Create Scrim', action: () => navigate('admin-scrims'), color: '#3b82f6' },
    { label: 'Publish News', action: () => navigate('admin-news'), color: '#22c55e' },
    { label: 'Process Withdrawals', action: () => navigate('admin-withdrawals'), color: '#e31c1c' },
    { label: 'Approve Recharges', action: () => navigate('admin-recharge'), color: '#8b5cf6' },
    { label: 'Manage Users', action: () => navigate('admin-users'), color: '#06b6d4' },
  ]

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '2rem' }}>
      {/* Welcome */}
      <div
        className="rounded-2xl p-6 mb-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(227,28,28,0.15) 0%, var(--bg-card) 100%)',
          border: '1px solid var(--border-accent)',
        }}
      >
        <h2 className="text-title mb-1">Admin Dashboard</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Platform overview and management tools</p>
        <div
          className="absolute right-6 top-1/2 -translate-y-1/2 opacity-5 text-8xl font-black"
          style={{ color: 'var(--accent-red)' }}
        >
          ADM
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {statCards.map(({ label, value, icon: Icon, color, page }) => (
          <div
            key={label}
            className={`stat-card ${page ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''}`}
            onClick={page ? () => navigate(page as Parameters<typeof navigate>[0]) : undefined}
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className="flex items-center justify-center rounded-lg"
                style={{ width: 36, height: 36, background: `${color}18`, border: `1px solid ${color}30` }}
              >
                <Icon size={18} style={{ color }} />
              </div>
            </div>
            <div className="font-black text-2xl" style={{ color }}>{value}</div>
            <div className="text-xs mt-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <h3 className="text-heading mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {quickActions.map(({ label, action, color }) => (
          <button
            key={label}
            onClick={action}
            className="card p-4 text-left hover:scale-[1.01] transition-transform"
          >
            <div
              className="w-2 h-2 rounded-full mb-3"
              style={{ background: color }}
            />
            <div className="font-semibold text-small">{label}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
