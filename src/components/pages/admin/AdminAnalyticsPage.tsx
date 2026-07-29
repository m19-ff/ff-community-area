'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { PageLoader } from '../../ui/LoadingSpinner'
import {
  Users, TrendingUp, Trophy, Zap, RefreshCw,
  Monitor, Smartphone, Star,
} from 'lucide-react'
import Avatar from '../../ui/Avatar'

type DailyPoint = { date: string; count: number }
type DailyRecharge = { date: string; count: number; totalPoints: string | null }
type DailyWithdrawal = { date: string; count: number; totalPoints: string | null }
type TopPlayer = {
  userId: number; events: number
  user: { id: number; gameName: string | null; profilePicture: string | null } | null
}
type Analytics = {
  mau: number
  dau: number
  days: number
  dailyRegistrations: DailyPoint[]
  dailyActiveUsers: DailyPoint[]
  topPages: { page: string | null; count: number }[]
  tournamentParticipation: DailyPoint[]
  dailyUserGrowth?: DailyPoint[]
  dailyTeamGrowth?: DailyPoint[]
  dailyRecharges?: DailyRecharge[]
  dailyWithdrawals?: DailyWithdrawal[]
  mostActivePlayers?: TopPlayer[]
}

// Tiny SVG sparkline
function Sparkline({ data, color = '#8b5cf6', height = 40 }: { data: number[]; color?: string; height?: number }) {
  if (data.length < 2) return <div style={{ height }} />
  const max = Math.max(...data, 1)
  const w = 200
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = height - (v / max) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" style={{ display: 'block', height }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points={`0,${height} ${points} ${w},${height}`}
        fill={color + '22'}
        stroke="none"
      />
    </svg>
  )
}

function StatCard({
  label, value, sub, icon: Icon, color, data,
}: {
  label: string; value: string | number; sub?: string
  icon: typeof Users; color: string; data?: number[]
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
          <p className="text-2xl font-bold mt-0.5" style={{ color }} translate="no">{value}</p>
          {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
        </div>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: color + '22' }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      {data && data.length > 1 && <Sparkline data={data} color={color} height={36} />}
    </div>
  )
}

function BarChart({ data, color, label }: { data: { date: string; value: number }[]; color: string; label: string }) {
  if (data.length === 0) return <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>No data</p>
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div>
      <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <div className="flex items-end gap-1 h-24 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {data.slice(-30).map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5 flex-shrink-0" style={{ minWidth: 6 }}>
            <div
              title={`${d.date}: ${d.value}`}
              style={{
                width: '100%',
                height: `${Math.max(2, (d.value / max) * 80)}px`,
                background: color,
                borderRadius: '2px 2px 0 0',
                opacity: 0.85,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{data[0]?.date?.slice(5) || ''}</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{data[data.length - 1]?.date?.slice(5) || ''}</span>
      </div>
    </div>
  )
}

export default function AdminAnalyticsPage() {
  const { token } = useAppStore()
  const [data, setData]       = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays]       = useState(30)

  const load = async (d = days) => {
    setLoading(true)
    const [analyticsRes, statsRes] = await Promise.all([
      apiCall(`/analytics?days=${d}`, {}, token),
      apiCall('/admin/stats', {}, token),
    ])

    if (analyticsRes.success && analyticsRes.data) {
      const a = analyticsRes.data as Analytics
      const s = statsRes.success && statsRes.data
        ? (statsRes.data as { charts: { dailyUserGrowth: DailyPoint[]; dailyTeamGrowth: DailyPoint[]; dailyRecharges: DailyRecharge[]; dailyWithdrawals: DailyWithdrawal[] } }).charts
        : null

      setData({
        ...a,
        dailyUserGrowth:  s?.dailyUserGrowth  || [],
        dailyTeamGrowth:  s?.dailyTeamGrowth  || [],
        dailyRecharges:   s?.dailyRecharges   || [],
        dailyWithdrawals: s?.dailyWithdrawals || [],
      })
    }
    setLoading(false)
  }

  useEffect(() => { load(days) }, [days, token])

  if (loading) return <PageLoader />

  const regValues  = (data?.dailyRegistrations || []).map(d => d.count)
  const dauValues  = (data?.dailyActiveUsers   || []).map(d => d.count)
  const tourValues = (data?.tournamentParticipation || []).map(d => d.count)
  const ugValues   = (data?.dailyUserGrowth    || []).map(d => d.count)

  const rechargeData   = (data?.dailyRecharges   || []).map(d => ({ date: d.date, value: d.count }))
  const withdrawalData = (data?.dailyWithdrawals || []).map(d => ({ date: d.date, value: d.count }))
  const userGrowthData = (data?.dailyUserGrowth  || []).map(d => ({ date: d.date, value: d.count }))
  const teamGrowthData = (data?.dailyTeamGrowth  || []).map(d => ({ date: d.date, value: d.count }))
  const dauChartData   = (data?.dailyActiveUsers || []).map(d => ({ date: d.date, value: d.count }))

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '2rem' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Analytics</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Platform insights & growth</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{
                background: days === d ? '#8b5cf6' : 'var(--bg-card)',
                color:      days === d ? '#fff' : 'var(--text-secondary)',
                border:     '1px solid var(--border)',
              }}
            >
              {d}d
            </button>
          ))}
          <button
            onClick={() => load(days)}
            className="p-2 rounded-lg"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        <StatCard label="Daily Active Users"   value={data?.dau  || 0} icon={Monitor}    color="#3b82f6"  data={dauValues} />
        <StatCard label="Monthly Active Users" value={data?.mau  || 0} icon={TrendingUp}  color="#8b5cf6"  data={dauValues} />
        <StatCard label={`New Registrations (${days}d)`} value={regValues.reduce((a, b) => a + b, 0)} icon={Users} color="#22c55e" data={regValues} />
        <StatCard label={`Tournament Participations (${days}d)`} value={tourValues.reduce((a, b) => a + b, 0)} icon={Trophy} color="#f59e0b" data={tourValues} />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <BarChart data={userGrowthData}  color="#3b82f6" label={`User Growth (${days}d)`} />
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <BarChart data={dauChartData}    color="#8b5cf6" label={`Daily Active Users (${days}d)`} />
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <BarChart data={teamGrowthData}  color="#22c55e" label={`New Teams (${days}d)`} />
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <BarChart data={rechargeData}    color="#f59e0b" label={`Recharges (${days}d)`} />
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <BarChart data={withdrawalData}  color="#e31c1c" label={`Withdrawals (${days}d)`} />
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>Top Pages</p>
          {(data?.topPages || []).slice(0, 8).map((p, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{p.page || 'unknown'}</span>
              <span className="text-xs font-bold" style={{ color: '#8b5cf6' }} translate="no">{p.count}</span>
            </div>
          ))}
          {(data?.topPages || []).length === 0 && <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>No data yet</p>}
        </div>
      </div>

      {/* Most active players */}
      {(data?.mostActivePlayers || []).length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Star size={15} style={{ color: '#f59e0b' }} /> Most Active Players ({days}d)
          </h3>
          <div className="flex flex-col gap-2">
            {(data?.mostActivePlayers || []).slice(0, 10).map((p, i) => (
              <div key={p.userId || i} className="flex items-center gap-3 py-2 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                <span className="text-sm font-bold w-5" style={{ color: 'var(--text-muted)' }} translate="no">{i + 1}</span>
                <Avatar src={p.user?.profilePicture} name={p.user?.gameName || 'P'} size={32} />
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {p.user?.gameName || `User #${p.userId}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Zap size={12} style={{ color: '#f59e0b' }} />
                  <span className="text-sm font-bold" style={{ color: '#f59e0b' }} translate="no">{p.events}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Retention note */}
      <div className="rounded-xl p-4 mt-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Tracking Info</h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Analytics track page views, app opens, tournament views, and registrations.
          DAU/MAU counts unique users with at least one tracked event.
          Page tracking requires the client to call <code style={{ color: 'var(--accent-blue)' }}>POST /api/analytics</code> with event=page_view.
        </p>
      </div>
    </div>
  )
}
