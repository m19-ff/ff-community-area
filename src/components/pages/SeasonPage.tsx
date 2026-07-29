'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Calendar, Trophy, Star, Gift, CheckCircle, Clock, ArrowRight } from 'lucide-react'
import Avatar from '../ui/Avatar'
import { PageLoader } from '../ui/LoadingSpinner'

type Season = {
  id: number; name: string; startDate: string; endDate: string
  isActive: boolean; isFinished: boolean
  rewards?: Array<{ rank: number; prize: number; badge: string }>
}

type SeasonRanking = {
  rank: number; score: number; wins: number; tournaments: number
  prizeEarned: number; rewardClaimed: boolean
  userId: number | null; teamId: number | null
  gameName: string | null; profilePicture: string | null
  teamName: string | null; teamLogo: string | null
}

function timeLeft(endDate: string): string {
  const diff = new Date(endDate).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const days  = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days}d ${hours}h left`
  return `${hours}h left`
}

export default function SeasonPage() {
  const { token, navigate } = useAppStore()
  const [seasons,  setSeasons]  = useState<Season[]>([])
  const [active,   setActive]   = useState<Season | null>(null)
  const [selected, setSelected] = useState<Season | null>(null)
  const [rankings, setRankings] = useState<SeasonRanking[]>([])
  const [loading,  setLoading]  = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    apiCall('/seasons', {}, token).then(res => {
      if (res.success && res.data) {
        const d = res.data as { seasons: Season[]; activeSeason: Season | null }
        setSeasons(d.seasons || [])
        setActive(d.activeSeason)
        if (d.activeSeason) loadDetail(d.activeSeason)
      }
      setLoading(false)
    })
  }, [token])

  const loadDetail = async (season: Season) => {
    setSelected(season)
    setDetailLoading(true)
    const res = await apiCall(`/seasons?id=${season.id}`, {}, token)
    if (res.success && res.data) {
      const d = res.data as { rankings: SeasonRanking[] }
      setRankings(d.rankings || [])
    }
    setDetailLoading(false)
  }

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '5rem', maxWidth: 800, margin: '0 auto' }}>
      <div className="mb-6">
        <h1 className="text-xl font-black mb-1 flex items-center gap-2">
          <Trophy size={22} style={{ color: 'var(--accent-red)' }} />
          Seasons
        </h1>
        <p className="text-small" style={{ color: 'var(--text-muted)' }}>
          Compete each season for exclusive rewards and rankings
        </p>
      </div>

      {/* Active Season Banner */}
      {active && (
        <div
          className="rounded-2xl p-5 mb-6 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(227,28,28,0.15) 0%, rgba(139,92,246,0.08) 100%)',
            border: '1px solid rgba(227,28,28,0.3)',
          }}
        >
          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-5 text-8xl font-black select-none"
            style={{ color: 'var(--accent-red)' }}>S</div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="badge badge-red">ACTIVE</span>
              <span className="text-xs font-semibold" style={{ color: '#f87171' }}>
                <Clock size={11} className="inline mr-1" />{timeLeft(active.endDate)}
              </span>
            </div>
            <h2 className="text-lg font-black mb-1">{active.name}</h2>
            <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span><Calendar size={11} className="inline mr-1" />
                {new Date(active.startDate).toLocaleDateString()} – {new Date(active.endDate).toLocaleDateString()}
              </span>
            </div>
            {(active.rewards || []).length > 0 && (
              <div className="mt-3 flex gap-2 flex-wrap">
                {(active.rewards || []).slice(0, 3).map(r => (
                  <div key={r.rank}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)' }}
                  >
                    <Gift size={11} style={{ color: '#f59e0b' }} />
                    #{r.rank}: {r.badge} + {r.prize?.toLocaleString()} pts
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!active && seasons.length === 0 && (
        <div className="card p-10 text-center" style={{ color: 'var(--text-muted)' }}>
          No seasons yet. Check back soon for the next competitive season!
        </div>
      )}

      {/* Seasons grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {seasons.map(s => (
          <button
            key={s.id}
            onClick={() => loadDetail(s)}
            className={`card p-4 text-left hover:scale-[1.01] transition-transform ${selected?.id === s.id ? 'ring-1 ring-red-500' : ''}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm truncate">{s.name}</span>
              {s.isActive
                ? <span className="badge badge-red text-xs">Active</span>
                : s.isFinished
                  ? <span className="badge text-xs" style={{ background: 'rgba(107,114,128,0.15)', color: '#9ca3af' }}>Finished</span>
                  : <span className="badge text-xs" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>Upcoming</span>
              }
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {new Date(s.startDate).toLocaleDateString()} – {new Date(s.endDate).toLocaleDateString()}
            </div>
            {s.isActive && (
              <div className="text-xs mt-1 font-semibold" style={{ color: '#f87171' }}>
                {timeLeft(s.endDate)}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Season Detail / Rankings */}
      {selected && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
            <h3 className="font-bold">{selected.name} — Rankings</h3>
          </div>

          {detailLoading ? (
            <div className="p-10 flex justify-center"><PageLoader /></div>
          ) : rankings.length === 0 ? (
            <div className="p-10 text-center" style={{ color: 'var(--text-muted)' }}>
              No rankings yet for this season. Keep competing!
            </div>
          ) : (
            <div>
              {rankings.map(r => {
                const name  = r.teamName || r.gameName || '—'
                const logo  = r.teamLogo || r.profilePicture || null
                const isTeam = !!r.teamId
                return (
                  <div
                    key={r.rank}
                    className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-white/[0.02]"
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onClick={() => isTeam
                      ? navigate('team-profile', { teamId: r.teamId! })
                      : navigate('player-profile', { userId: r.userId! })
                    }
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0"
                      style={{
                        background: r.rank <= 3 ? 'rgba(245,158,11,0.15)' : 'var(--bg-card)',
                        color: r.rank <= 3 ? '#f59e0b' : 'var(--text-muted)',
                      }}
                    >
                      {r.rank <= 3 ? ['🥇','🥈','🥉'][r.rank - 1] : `#${r.rank}`}
                    </div>
                    <Avatar src={logo} name={name} size={38} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{name}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {r.wins} wins · {r.tournaments} tournaments · {r.prizeEarned?.toLocaleString()} pts
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-bold text-sm" style={{ color: 'var(--accent-red)' }}>
                        {r.score?.toLocaleString()} pts
                      </div>
                      {r.rewardClaimed && <CheckCircle size={13} style={{ color: '#22c55e' }} className="ml-auto mt-0.5" />}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Rewards */}
          {(selected.rewards || []).length > 0 && (
            <div className="px-5 py-4" style={{ borderTop: '1px solid var(--border)', background: 'rgba(245,158,11,0.04)' }}>
              <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Gift size={14} style={{ color: '#f59e0b' }} /> Season Rewards
              </h4>
              <div className="flex flex-col gap-2">
                {(selected.rewards || []).map(r => (
                  <div key={r.rank} className="flex items-center gap-3 text-sm">
                    <span className="font-mono w-6 text-center">{['🥇','🥈','🥉'][r.rank - 1] || `#${r.rank}`}</span>
                    <span className="font-semibold">{r.badge}</span>
                    <span style={{ color: '#f59e0b' }}>+ {r.prize?.toLocaleString()} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
