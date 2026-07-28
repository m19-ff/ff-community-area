'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Trophy, Swords, Users, Zap, ArrowRight, Plus, Shield, Play, Download, Smartphone, Star } from 'lucide-react'
import Avatar from '../ui/Avatar'
import { PageLoader } from '../ui/LoadingSpinner'

type AppRelease = {
  id: number; version: string; apkUrl: string; apkSize: string | null
  releaseNotes: string | null; publishedAt: string | null
}

export default function HomePage() {
  const { user, wallet, myTeam, token, navigate, showToast } = useAppStore()
  const [tournaments,   setTournaments]   = useState<unknown[]>([])
  const [scrims,        setScrims]        = useState<unknown[]>([])
  const [news,          setNews]          = useState<unknown[]>([])
  const [loading,       setLoading]       = useState(true)
  const [adLoading,     setAdLoading]     = useState(false)
  const [adsToday,      setAdsToday]      = useState(0)
  const [appRelease,    setAppRelease]    = useState<AppRelease | null>(null)

  useEffect(() => {
    const load = async () => {
      const [tRes, sRes, nRes, apkRes] = await Promise.all([
        apiCall('/tournaments?status=published&limit=3', {}, token),
        apiCall('/scrims?upcoming=true&limit=3', {}, token),
        apiCall('/news?limit=3', {}, token),
        apiCall('/app-release', {}, token),
      ])
      if (tRes.success) setTournaments((tRes.data as { tournaments: unknown[] }).tournaments || [])
      if (sRes.success) setScrims((sRes.data as { scrims: unknown[] }).scrims || [])
      if (nRes.success) setNews((nRes.data as { news: unknown[] }).news || [])
      if (apkRes.success && (apkRes.data as { release: AppRelease | null }).release) {
        setAppRelease((apkRes.data as { release: AppRelease }).release)
      }
      setLoading(false)
    }
    load()
  }, [token])

  const watchAd = async () => {
    setAdLoading(true)
    const res = await apiCall('/ads/watch', { method: 'POST' }, token)
    setAdLoading(false)
    if (res.success && res.data) {
      const d = res.data as { pointsEarned: number; adsWatchedToday: number; adsRemaining: number }
      setAdsToday(d.adsWatchedToday)
      showToast(`+${d.pointsEarned} points earned! ${d.adsRemaining} ads remaining today.`)
      // Refresh wallet
      apiCall('/auth/profile', {}, token).then(r => {
        if (r.success && r.data) {
          const d2 = r.data as { wallet: { balance: number; totalEarned: number; usdValue: string } }
          if (d2.wallet) useAppStore.getState().setWallet(d2.wallet)
        }
      })
    } else {
      showToast(res.message || 'Failed to watch ad', 'error')
    }
  }

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '5rem' }}>
      {/* Welcome Banner */}
      <div
        className="rounded-2xl p-6 mb-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(227,28,28,0.12) 0%, var(--bg-card) 60%)',
          border: '1px solid var(--border-accent)',
        }}
      >
        <div
          className="absolute right-6 top-1/2 -translate-y-1/2 opacity-10 text-9xl font-black"
          style={{ color: 'var(--accent-red)', userSelect: 'none' }}
        >
          NX
        </div>
        <div className="flex items-center gap-4 relative z-10">
          <Avatar src={user?.profilePicture} name={user?.gameName || user?.email} size={52} />
          <div>
            <h2 className="text-heading">Welcome back, <span style={{ color: 'var(--accent-red)' }}>{user?.gameName || 'Warrior'}</span>!</h2>
            <p className="text-small mt-1" style={{ color: 'var(--text-secondary)' }}>
              {myTeam ? `${myTeam.name} · ${myTeam.points.toLocaleString()} team pts` : 'No team yet — create or join one'}
            </p>
          </div>
        </div>
        {!myTeam && (
          <div className="flex gap-3 mt-4 relative z-10">
            <button onClick={() => navigate('my-team')} className="btn btn-primary btn-sm">
              <Plus size={14} /> Create Team
            </button>
            <button onClick={() => navigate('teams')} className="btn btn-secondary btn-sm">
              <Users size={14} /> Browse Teams
            </button>
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'My Balance', value: `${wallet?.balance?.toLocaleString() || 0} pts`, sub: `$${wallet?.usdValue || '0.00'} USD`, icon: Zap, color: '#e31c1c' },
          { label: 'Team Points', value: `${myTeam?.points?.toLocaleString() || 0} pts`, sub: myTeam?.name || 'No team', icon: Shield, color: '#8b5cf6' },
          { label: 'Tournaments', value: `${myTeam?.totalTournaments || 0}`, sub: 'Played', icon: Trophy, color: '#f59e0b' },
          { label: 'Ads Today', value: `${adsToday}/3`, sub: 'Watch & Earn', icon: Play, color: '#22c55e' },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
              <div
                className="flex items-center justify-center rounded-lg"
                style={{ width: 32, height: 32, background: `${color}18`, border: `1px solid ${color}30` }}
              >
                <Icon size={16} style={{ color }} />
              </div>
            </div>
            <div className="font-bold text-xl" style={{ color }}>{value}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Download App Banner ────────────────────────────── */}
      {appRelease && (
        <div
          className="rounded-2xl p-4 mb-6 flex items-center gap-4"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(139,92,246,0.08) 100%)',
            border: '1px solid rgba(99,102,241,0.30)',
          }}
        >
          <div
            className="flex items-center justify-center rounded-xl shrink-0"
            style={{ width: 48, height: 48, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)' }}
          >
            <Smartphone size={24} style={{ color: '#818cf8' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm" style={{ color: '#c7d2fe' }}>
                FF Community Arena App
              </span>
              <span
                className="badge text-xs"
                style={{ background: 'rgba(99,102,241,0.18)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.35)' }}
              >
                v{appRelease.version}
              </span>
              {appRelease.apkSize && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{appRelease.apkSize}</span>
              )}
            </div>
            {appRelease.releaseNotes && (
              <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-muted)' }}>
                {appRelease.releaseNotes}
              </p>
            )}
          </div>
          <a
            href={appRelease.apkUrl}
            download
            className="btn btn-sm shrink-0"
            style={{
              background: 'rgba(99,102,241,0.85)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Download size={14} /> Download App
          </a>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Tournaments', icon: Trophy, page: 'tournaments', color: '#f59e0b' },
          { label: 'Join Scrim', icon: Swords, page: 'scrims', color: '#3b82f6' },
          { label: 'Browse Teams', icon: Users, page: 'teams', color: '#22c55e' },
          { label: 'My Wallet', icon: Zap, page: 'wallet', color: '#e31c1c' },
        ].map(({ label, icon: Icon, page, color }) => (
          <button
            key={page}
            onClick={() => navigate(page as Parameters<typeof navigate>[0])}
            className="card p-4 text-left hover:scale-[1.02] transition-transform"
            style={{ cursor: 'pointer' }}
          >
            <div
              className="flex items-center justify-center rounded-xl mb-3"
              style={{ width: 44, height: 44, background: `${color}18`, border: `1px solid ${color}30` }}
            >
              <Icon size={20} style={{ color }} />
            </div>
            <div className="font-semibold text-sm">{label}</div>
          </button>
        ))}
      </div>

      {/* Earn Points - Watch Ad */}
      <div
        className="rounded-xl p-4 mb-6 flex items-center justify-between gap-4"
        style={{
          background: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, var(--bg-card) 100%)',
          border: '1px solid rgba(34,197,94,0.2)',
        }}
      >
        <div>
          <div className="font-semibold mb-1 flex items-center gap-2">
            <Play size={16} style={{ color: '#22c55e' }} />
            Watch Ad & Earn Points
          </div>
          <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
            Watch up to 3 ads per day. Earn points instantly.
          </p>
        </div>
        <button
          onClick={watchAd}
          disabled={adLoading || adsToday >= 3}
          className="btn btn-success shrink-0"
        >
          {adLoading ? 'Loading...' : adsToday >= 3 ? 'Done Today' : 'Watch Ad'}
        </button>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tournaments */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-heading">Active Tournaments</h3>
            <button onClick={() => navigate('tournaments')} className="btn btn-ghost btn-sm">
              View All <ArrowRight size={14} />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {tournaments.length === 0 && (
              <div className="card p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                No tournaments right now. Check back soon!
              </div>
            )}
            {(tournaments as Array<{
              id: number; name: string; type: string; prizePool: number; maxTeams: number;
              teamsRegistered: number; registrationDeadline: string; status: string;
            }>).map(t => (
              <button
                key={t.id}
                onClick={() => navigate('tournament-detail', { id: t.id })}
                className="card p-4 text-left hover:scale-[1.01] transition-transform"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{t.name}</span>
                  <span
                    className="badge"
                    style={{
                      background: t.type === 'battle_royale' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)',
                      color: t.type === 'battle_royale' ? '#f59e0b' : '#60a5fa',
                      border: `1px solid ${t.type === 'battle_royale' ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)'}`,
                    }}
                  >
                    {t.type === 'battle_royale' ? 'Battle Royale' : 'Clash Squad'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-small" style={{ color: 'var(--text-secondary)' }}>
                  <span>🏆 {t.prizePool.toLocaleString()} pts prize</span>
                  <span>👥 {t.teamsRegistered}/{t.maxTeams} teams</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Upcoming Scrims */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-heading">Upcoming Scrims</h3>
            <button onClick={() => navigate('scrims')} className="btn btn-ghost btn-sm">
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {scrims.length === 0 && (
              <div className="card p-6 text-center text-small" style={{ color: 'var(--text-muted)' }}>No scrims scheduled</div>
            )}
            {(scrims as Array<{
              id: number; name: string; scheduledAt: string; mode: string; maxTeams: number; teamsRegistered: number;
            }>).map(s => (
              <div key={s.id} className="card p-4">
                <div className="font-semibold text-small mb-1">{s.name}</div>
                <div className="text-xs" style={{ color: 'var(--accent-red)' }}>
                  {new Date(s.scheduledAt).toLocaleString()}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="badge badge-blue">{s.mode}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {s.teamsRegistered}/{s.maxTeams}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* News */}
          <div className="flex items-center justify-between mt-6 mb-4">
            <h3 className="text-heading">Latest News</h3>
            <button onClick={() => navigate('news')} className="btn btn-ghost btn-sm">
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {(news as Array<{ id: number; title: string; type: string; publishedAt: string }>).map(n => (
              <button key={n.id} onClick={() => navigate('news')} className="card p-3 text-left">
                <div className="text-small font-medium leading-snug">{n.title}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {new Date(n.publishedAt).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
