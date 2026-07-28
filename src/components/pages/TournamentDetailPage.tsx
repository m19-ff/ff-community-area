'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Trophy, Users, Zap, Calendar, ChevronLeft, Shield, CheckCircle } from 'lucide-react'
import { PageLoader } from '../ui/LoadingSpinner'
import Avatar from '../ui/Avatar'

type Tournament = {
  id: number; name: string; type: string; banner: string | null;
  registrationCost: number; prizePool: number; prizeDistribution: unknown;
  description: string | null; rules: string | null; maxTeams: number;
  teamsRegistered: number; registrationDeadline: string | null;
  startDate: string | null; endDate: string | null; status: string;
  registeredTeams: Array<{ team: { id: number; name: string; logo: string | null }; status: string; placement: number | null }>
}

export default function TournamentDetailPage() {
  const { token, pageParams, navigate, myTeam, showToast } = useAppStore()
  const [t, setT] = useState<Tournament | null>(null)
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [registered, setRegistered] = useState(false)

  const id = pageParams.id as number

  useEffect(() => {
    if (!id) { navigate('tournaments'); return }
    apiCall(`/tournaments/${id}`, {}, token).then(res => {
      if (res.success && res.data) {
        const d = res.data as { tournament: Tournament }
        setT(d.tournament)
        if (myTeam && d.tournament.registeredTeams?.some(r => r.team?.id === myTeam.id)) {
          setRegistered(true)
        }
      }
      setLoading(false)
    })
  }, [id])

  const handleRegister = async () => {
    setRegistering(true)
    const res = await apiCall(`/tournaments/${id}/register`, { method: 'POST' }, token)
    setRegistering(false)
    if (res.success) {
      showToast('Team registered successfully!')
      setRegistered(true)
      setT(prev => prev ? { ...prev, teamsRegistered: prev.teamsRegistered + 1 } : prev)
    } else {
      showToast(res.message || 'Registration failed', 'error')
    }
  }

  if (loading) return <PageLoader />
  if (!t) return <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Tournament not found</div>

  const isCaptain = myTeam && useAppStore.getState().user?.role === 'captain'
  const canRegister = t.status === 'published' && !registered && isCaptain
  const deadlinePassed = t.registrationDeadline && new Date(t.registrationDeadline) < new Date()

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '5rem' }}>
      <button onClick={() => navigate('tournaments')} className="btn btn-ghost btn-sm mb-4">
        <ChevronLeft size={16} /> Back to Tournaments
      </button>

      {/* Hero */}
      <div
        className="rounded-2xl overflow-hidden mb-6"
        style={{
          background: t.banner
            ? `url(${t.banner}) center/cover`
            : 'linear-gradient(135deg, rgba(227,28,28,0.2) 0%, var(--bg-card) 100%)',
          minHeight: 200,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(10,10,15,0.95))',
          }}
        />
        <div className="relative z-10 p-6 flex flex-col justify-end" style={{ minHeight: 200 }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="badge badge-red">{t.type === 'battle_royale' ? '⚔ Battle Royale' : '🎯 Clash Squad'}</span>
                <span className={`badge ${t.status === 'published' ? 'badge-green' : t.status === 'closed' ? 'badge-yellow' : 'badge-gray'}`}>
                  {t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                </span>
              </div>
              <h1 className="text-title">{t.name}</h1>
            </div>
            {canRegister && !deadlinePassed && (
              <button
                onClick={handleRegister}
                disabled={registering}
                className="btn btn-primary btn-lg shrink-0"
              >
                {registering ? 'Registering...' : 'Register Team'}
              </button>
            )}
            {registered && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
                <CheckCircle size={16} style={{ color: '#22c55e' }} />
                <span className="text-small font-semibold" style={{ color: '#22c55e' }}>Registered</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Prize Pool', value: `${t.prizePool.toLocaleString()} pts`, icon: Trophy, color: '#f59e0b' },
              { label: 'Entry Cost', value: t.registrationCost > 0 ? `${t.registrationCost} pts` : 'Free', icon: Zap, color: '#e31c1c' },
              { label: 'Teams', value: `${t.teamsRegistered}/${t.maxTeams}`, icon: Users, color: '#3b82f6' },
              { label: 'Start Date', value: t.startDate ? new Date(t.startDate).toLocaleDateString() : 'TBD', icon: Calendar, color: '#22c55e' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="stat-card">
                <Icon size={18} style={{ color, marginBottom: 8 }} />
                <div className="font-bold">{value}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          {t.description && (
            <div className="card p-5 mb-4">
              <h3 className="text-heading mb-3">About This Tournament</h3>
              <p className="text-body" style={{ color: 'var(--text-secondary)' }}>{t.description}</p>
            </div>
          )}

          {/* Rules */}
          {t.rules && (
            <div className="card p-5">
              <h3 className="text-heading mb-3">Rules & Format</h3>
              <p className="text-body whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{t.rules}</p>
            </div>
          )}
        </div>

        {/* Registered Teams */}
        <div>
          <div className="card p-5">
            <h3 className="text-heading mb-4">Registered Teams ({t.registeredTeams?.length || 0})</h3>
            <div className="flex flex-col gap-3">
              {t.registeredTeams?.length === 0 && (
                <p className="text-small" style={{ color: 'var(--text-muted)' }}>No teams registered yet</p>
              )}
              {t.registeredTeams?.map((rt, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'var(--bg-input)' }}>
                  <Avatar src={rt.team?.logo} name={rt.team?.name} size={32} />
                  <span className="text-small font-medium flex-1">{rt.team?.name}</span>
                  {rt.placement && (
                    <span className="badge badge-yellow">#{rt.placement}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
