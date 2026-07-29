'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Trophy, Swords, Wallet, Crown, Zap, Star, RefreshCw } from 'lucide-react'
import Avatar from '../ui/Avatar'
import { PageLoader } from '../ui/LoadingSpinner'

type LeaderboardEntry = Record<string, unknown> & { rank: number }

const CATEGORIES = [
  { key: 'top_teams',   label: 'Top Teams',    icon: Trophy,  color: '#f59e0b' },
  { key: 'top_players', label: 'Top Players',  icon: Star,    color: '#8b5cf6' },
  { key: 'top_wallets', label: 'Top Wallets',  icon: Wallet,  color: '#22c55e' },
  { key: 'top_winners', label: 'Top Winners',  icon: Crown,   color: '#e31c1c' },
  { key: 'top_mvp',     label: 'Top MVPs',     icon: Swords,  color: '#06b6d4' },
  { key: 'top_earners', label: 'Top Earners',  icon: Zap,     color: '#f59e0b' },
]

const PERIODS = [
  { key: 'daily',    label: 'Today' },
  { key: 'weekly',   label: 'Week' },
  { key: 'monthly',  label: 'Month' },
  { key: 'all_time', label: 'All Time' },
]

const RANK_COLORS = ['#f59e0b', '#9ca3af', '#b45309', '#6b7280']
const RANK_ICONS  = ['🥇', '🥈', '🥉']

function getRankBadge(rank: number) {
  if (rank <= 3) return RANK_ICONS[rank - 1]
  return `#${rank}`
}

export default function LeaderboardPage() {
  const { token, navigate } = useAppStore()
  const [category,  setCategory]  = useState('top_teams')
  const [period,    setPeriod]    = useState('all_time')
  const [entries,   setEntries]   = useState<LeaderboardEntry[]>([])
  const [loading,   setLoading]   = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await apiCall(`/leaderboard?category=${category}&period=${period}`, {}, token)
    if (res.success && res.data) {
      setEntries((res.data as { leaderboard: LeaderboardEntry[] }).leaderboard || [])
    }
    setLoading(false)
  }, [category, period, token])

  useEffect(() => { load() }, [load])

  const catInfo = CATEGORIES.find(c => c.key === category)!

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '5rem', maxWidth: 700, margin: '0 auto' }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-black mb-1 flex items-center gap-2">
          <Trophy size={22} style={{ color: 'var(--accent-red)' }} />
          Leaderboards
        </h1>
        <p className="text-small" style={{ color: 'var(--text-muted)' }}>
          Rankings across all players and teams
        </p>
      </div>

      {/* Category selector */}
      <div className="flex gap-2 flex-wrap mb-4">
        {CATEGORIES.map(({ key, label, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setCategory(key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background: category === key ? `${color}22` : 'var(--bg-card)',
              border: `1px solid ${category === key ? color : 'var(--border)'}`,
              color: category === key ? color : 'var(--text-secondary)',
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Period selector */}
      <div className="flex gap-2 mb-6">
        {PERIODS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background: period === key ? 'var(--accent-red)' : 'var(--bg-card)',
              border: `1px solid ${period === key ? 'var(--accent-red)' : 'var(--border)'}`,
              color: period === key ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Rankings */}
      <div className="card overflow-hidden">
        {/* Category header */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ background: `${catInfo.color}10`, borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 font-bold">
            <catInfo.icon size={18} style={{ color: catInfo.color }} />
            {catInfo.label}
            <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
              · {PERIODS.find(p => p.key === period)?.label}
            </span>
          </div>
          <button onClick={load} className="btn btn-ghost btn-icon btn-sm">
            <RefreshCw size={14} />
          </button>
        </div>

        {loading ? (
          <div className="p-10 flex justify-center"><PageLoader /></div>
        ) : entries.length === 0 ? (
          <div className="p-10 text-center" style={{ color: 'var(--text-muted)' }}>
            No data yet for this period
          </div>
        ) : (
          <div>
            {entries.map((entry) => {
              const rank = entry.rank as number
              const isTeam  = 'name' in entry && !('gameName' in entry)
              const name    = (entry.gameName || entry.name || '—') as string
              const logo    = (entry.logo || entry.profilePicture || null) as string | null
              const sub1    = getSubtext1(category, entry)
              const sub2    = getSubtext2(category, entry)

              return (
                <div
                  key={rank}
                  className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: rank === 1 ? `${catInfo.color}06` : undefined,
                  }}
                  onClick={() => isTeam
                    ? navigate('team-profile', { teamId: entry.id })
                    : navigate('player-profile', { userId: entry.id })
                  }
                >
                  {/* Rank */}
                  <div
                    className="flex items-center justify-center font-black text-sm shrink-0"
                    style={{
                      width: 36, height: 36,
                      background: rank <= 3 ? `${RANK_COLORS[rank - 1]}18` : 'var(--bg-card)',
                      borderRadius: '50%',
                      color: rank <= 3 ? RANK_COLORS[rank - 1] : 'var(--text-muted)',
                      fontSize: rank <= 3 ? 18 : 12,
                    }}
                  >
                    {getRankBadge(rank)}
                  </div>

                  {/* Avatar */}
                  <Avatar src={logo} name={name} size={40} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate text-sm">{name}</div>
                    <div className="text-xs mt-0.5 flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
                      {sub1 && <span>{sub1}</span>}
                      {sub2 && <span>{sub2}</span>}
                    </div>
                  </div>

                  {/* Score badge */}
                  <div
                    className="shrink-0 px-2.5 py-1 rounded-lg font-bold text-sm"
                    style={{
                      background: `${catInfo.color}18`,
                      color: catInfo.color,
                      border: `1px solid ${catInfo.color}30`,
                    }}
                  >
                    {getScore(category, entry)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function getSubtext1(category: string, e: LeaderboardEntry): string {
  if (category === 'top_teams')    return `${e.totalTournaments ?? 0} tournaments`
  if (category === 'top_players')  return `${e.totalMatches ?? 0} matches`
  if (category === 'top_wallets')  return `${Number(e.totalEarned ?? 0).toLocaleString()} total earned`
  if (category === 'top_winners')  return `${e.totalWins ?? 0} wins`
  if (category === 'top_mvp')      return `${e.wins ?? 0} wins`
  if (category === 'top_earners')  return `Ad earnings`
  return ''
}

function getSubtext2(_category: string, _e: LeaderboardEntry): string {
  return ''
}

function getScore(category: string, e: LeaderboardEntry): string {
  if (category === 'top_teams')   return `${e.totalWins ?? 0} W`
  if (category === 'top_players') return `${e.wins ?? 0} W`
  if (category === 'top_wallets') return `${Number(e.balance ?? 0).toLocaleString()} pts`
  if (category === 'top_winners') return `${Number(e.prizeEarned ?? 0).toLocaleString()} pts`
  if (category === 'top_mvp')     return `${Number(e.totalEarned ?? 0).toLocaleString()} pts`
  if (category === 'top_earners') return `${Number(e.adEarnings ?? 0).toLocaleString()} pts`
  return ''
}
