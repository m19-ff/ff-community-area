'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Trophy, ArrowLeft, Shield, Users, Zap, TrendingUp, Calendar, Star, Swords } from 'lucide-react'
import Avatar from '../ui/Avatar'
import { PageLoader } from '../ui/LoadingSpinner'

type Member = {
  id: number; gameName: string | null; gameUid: string | null
  profilePicture: string | null; role: string; joinedAt: string
}

type TournamentEntry = {
  id: number; name: string; type: string; banner: string | null
  placement: number | null; prizeAwarded: number | null
  status: string; scheduledAt: string
}

type ScrimEntry = {
  id: number; name: string; mode: string; scheduledAt: string; status: string
}

type TeamStats = {
  team: { id: number; name: string; logo: string | null; captainId: number; createdAt: string; totalTournaments: number }
  wallet: { balance: number; totalEarned: number; totalSpent: number }
  members: Member[]
  stats: { tournaments: number; wins: number; top3: number; winRate: number; totalPrize: number; memberCount: number }
  tournamentHistory: TournamentEntry[]
  scrimHistory: ScrimEntry[]
}

function placementBadge(p: number | null) {
  if (!p) return null
  if (p === 1) return { label: '🥇 1st', color: '#f59e0b' }
  if (p === 2) return { label: '🥈 2nd', color: '#9ca3af' }
  if (p === 3) return { label: '🥉 3rd', color: '#92400e' }
  return { label: `#${p}`, color: 'var(--text-muted)' }
}

export default function TeamProfilePage() {
  const { token, navigate, pageParams } = useAppStore()
  const [data, setData] = useState<TeamStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'members' | 'history'>('overview')

  const teamId = pageParams?.teamId as number | undefined

  useEffect(() => {
    if (!teamId) { navigate('teams'); return }
    setLoading(true)
    apiCall(`/teams/${teamId}/stats`, {}, token).then(res => {
      if (res.success && res.data) setData(res.data as TeamStats)
      setLoading(false)
    })
  }, [teamId, token])

  if (loading) return <PageLoader />
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
        <p>Team not found</p>
        <button onClick={() => navigate('teams')} className="mt-4 text-sm" style={{ color: 'var(--accent-blue)' }}>
          Back to teams
        </button>
      </div>
    )
  }

  const { team, wallet, members, stats, tournamentHistory, scrimHistory } = data
  const captain = members.find(m => m.id === team.captainId)

  return (
    <div style={{ padding: '1rem', paddingBottom: '5rem', maxWidth: 680, margin: '0 auto' }}>
      {/* Back */}
      <button
        onClick={() => navigate('teams')}
        className="flex items-center gap-2 mb-4 text-sm"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* Hero */}
      <div
        className="rounded-2xl p-6 mb-4 relative overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="absolute inset-0 opacity-10" style={{
          background: 'radial-gradient(ellipse at top left, #8b5cf6, transparent 60%)',
          pointerEvents: 'none',
        }} />
        <div className="relative flex items-center gap-4">
          <Avatar src={team.logo} name={team.name} size={72} />
          <div className="flex-1">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{team.name}</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {stats.memberCount} member{stats.memberCount !== 1 ? 's' : ''}
              {captain ? ` · Captain: ${captain.gameName || 'Unknown'}` : ''}
            </p>
            <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <Calendar size={11} />
              Created {new Date(team.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Wallet summary */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: 'Balance',  value: wallet.balance.toLocaleString(),     color: '#8b5cf6' },
            { label: 'Earned',   value: wallet.totalEarned.toLocaleString(), color: '#22c55e' },
            { label: 'Spent',    value: wallet.totalSpent.toLocaleString(),  color: '#e31c1c' },
          ].map(item => (
            <div key={item.label} className="text-center p-2 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
              <p className="text-base font-bold" style={{ color: item.color }} translate="no">{item.value}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label} pts</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Tournaments', value: stats.tournaments, icon: Trophy,      color: '#f59e0b' },
          { label: 'Wins',        value: stats.wins,        icon: Star,        color: '#22c55e' },
          { label: 'Win Rate',    value: `${stats.winRate}%`, icon: TrendingUp, color: '#3b82f6' },
          { label: 'Top 3',       value: stats.top3,        icon: Shield,      color: '#8b5cf6' },
          { label: 'Prize Pts',   value: stats.totalPrize.toLocaleString(), icon: Zap, color: '#f59e0b' },
          { label: 'Members',     value: stats.memberCount, icon: Users,       color: '#06b6d4' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <Icon size={18} className="mx-auto mb-1" style={{ color: s.color }} />
              <p className="text-base font-bold" style={{ color: s.color }} translate="no">{s.value}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(['overview', 'members', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: tab === t ? '#8b5cf6' : 'var(--bg-card)',
              color:      tab === t ? '#fff' : 'var(--text-secondary)',
              border:     '1px solid var(--border)',
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'members' && (
        <div className="flex flex-col gap-2">
          {members.map(member => (
            <div
              key={member.id}
              className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:opacity-90"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              onClick={() => navigate('player-profile', { userId: member.id })}
            >
              <Avatar src={member.profilePicture} name={member.gameName || 'P'} size={44} />
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {member.gameName || 'Unknown'}
                  {member.id === team.captainId && (
                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ background: '#f59e0b22', color: '#f59e0b' }}>
                      Captain
                    </span>
                  )}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  UID: <span translate="no">{member.gameUid || '—'}</span>
                  {' · '}Joined {new Date(member.joinedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div>
          {tournamentHistory.length > 0 && (
            <>
              <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Trophy size={15} style={{ color: '#f59e0b' }} /> Tournaments
              </h3>
              <div className="flex flex-col gap-2 mb-4">
                {tournamentHistory.map(t => {
                  const badge = placementBadge(t.placement)
                  return (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                      <div className="flex-1">
                        <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{t.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {new Date(t.scheduledAt).toLocaleDateString()} · {t.type}
                        </p>
                      </div>
                      <div className="text-right">
                        {badge && <p className="text-sm font-bold" style={{ color: badge.color }}>{badge.label}</p>}
                        {t.prizeAwarded ? (
                          <p className="text-xs" style={{ color: '#22c55e' }}>+<span translate="no">{t.prizeAwarded.toLocaleString()}</span> pts</p>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
          {scrimHistory.length > 0 && (
            <>
              <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Swords size={15} style={{ color: '#06b6d4' }} /> Recent Scrims
              </h3>
              <div className="flex flex-col gap-2">
                {scrimHistory.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <div className="flex-1">
                      <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{s.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {new Date(s.scheduledAt).toLocaleDateString()} · {s.mode}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          {tournamentHistory.length === 0 && scrimHistory.length === 0 && (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>No history yet</p>
          )}
        </div>
      )}

      {tab === 'overview' && (
        <div className="flex flex-col gap-3">
          <div className="p-4 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Performance</h3>
            <div className="flex items-center gap-3 mb-2">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Win Rate</p>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                <div className="h-full rounded-full" style={{ width: `${stats.winRate}%`, background: '#22c55e' }} />
              </div>
              <p className="text-sm font-bold" style={{ color: '#22c55e' }} translate="no">{stats.winRate}%</p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Top 3 Rate</p>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                <div className="h-full rounded-full" style={{
                  width: `${stats.tournaments > 0 ? Math.round((stats.top3 / stats.tournaments) * 100) : 0}%`,
                  background: '#8b5cf6',
                }} />
              </div>
              <p className="text-sm font-bold" style={{ color: '#8b5cf6' }} translate="no">
                {stats.tournaments > 0 ? Math.round((stats.top3 / stats.tournaments) * 100) : 0}%
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Recent Tournaments</h3>
            {tournamentHistory.slice(0, 5).map(t => {
              const badge = placementBadge(t.placement)
              return (
                <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t.name}</span>
                  {badge && <span className="text-sm font-bold" style={{ color: badge.color }}>{badge.label}</span>}
                </div>
              )
            })}
            {tournamentHistory.length === 0 && (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No tournaments yet</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
