'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import {
  Trophy, Zap, ArrowLeft, Shield, Star, Calendar,
  Edit3, Check, X, Camera, Target, TrendingUp, Award,
} from 'lucide-react'
import Avatar from '../ui/Avatar'
import { PageLoader } from '../ui/LoadingSpinner'

type Profile = {
  id: number
  gameName: string | null
  gameUid: string | null
  profilePicture: string | null
  role: string
  joinDate: string
  wallet: {
    balance: number
    totalEarned: number
    totalSpent: number
    totalWithdrawn: number
  } | null
  team: {
    id: number
    name: string
    logo: string | null
    captainId: number
    walletBalance: number
  } | null
  stats: {
    tournaments: number
    wins: number
    top3: number
    winRate: number
    mvp: number
  }
}

function Badge({ label, color, icon: Icon }: { label: string; color: string; icon: typeof Trophy }) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
      style={{ background: color + '22', color, border: `1px solid ${color}44` }}
    >
      <Icon size={12} />
      <span translate="no">{label}</span>
    </div>
  )
}

function computeBadges(profile: Profile) {
  const badges: { label: string; color: string; icon: typeof Trophy }[] = []
  if (profile.stats.wins >= 1)       badges.push({ label: 'Champion',    color: '#f59e0b', icon: Trophy })
  if (profile.stats.wins >= 5)       badges.push({ label: 'Legend',      color: '#8b5cf6', icon: Star })
  if (profile.stats.tournaments >= 10) badges.push({ label: 'Veteran',   color: '#06b6d4', icon: Shield })
  if (profile.stats.winRate >= 50)   badges.push({ label: 'Elite',       color: '#e31c1c', icon: Target })
  if (profile.stats.mvp >= 3)        badges.push({ label: 'MVP',         color: '#22c55e', icon: Award })
  if (profile.wallet?.totalEarned && profile.wallet.totalEarned >= 1000)
    badges.push({ label: 'High Earner', color: '#f59e0b', icon: Zap })
  return badges
}

export default function PlayerProfilePage() {
  const { token, user, showToast, navigate, pageParams } = useAppStore()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [form, setForm] = useState({ gameName: '', gameUid: '', profilePicture: '' })

  // View own profile or another user's
  const targetId = (pageParams?.userId as number) || user?.id

  useEffect(() => {
    if (!targetId) return
    setLoading(true)
    apiCall(`/profile/${targetId}`, {}, token).then(res => {
      if (res.success && res.data) {
        const p = (res.data as { profile: Profile }).profile
        setProfile(p)
        setForm({
          gameName:       p.gameName || '',
          gameUid:        p.gameUid || '',
          profilePicture: p.profilePicture || '',
        })
      }
      setLoading(false)
    })
  }, [targetId, token])

  const saveProfile = async () => {
    setSaving(true)
    const res = await apiCall('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(form),
    }, token)
    if (res.success) {
      showToast('Profile updated!')
      setProfile(prev => prev ? { ...prev, ...form } : prev)
      setEditing(false)
    } else {
      showToast(res.message || 'Failed to update', 'error')
    }
    setSaving(false)
  }

  const isOwnProfile = user?.id === targetId

  if (loading) return <PageLoader />
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
        <p>Player not found</p>
        <button onClick={() => navigate('home')} className="mt-4 text-sm" style={{ color: 'var(--accent-blue)' }}>
          Go home
        </button>
      </div>
    )
  }

  const badges = computeBadges(profile)

  const statCards = [
    { label: 'Tournaments', value: profile.stats.tournaments, icon: Trophy,    color: '#f59e0b' },
    { label: 'Wins',        value: profile.stats.wins,        icon: Star,      color: '#22c55e' },
    { label: 'Top 3',       value: profile.stats.top3,        icon: Award,     color: '#8b5cf6' },
    { label: 'Win Rate',    value: `${profile.stats.winRate}%`, icon: TrendingUp, color: '#3b82f6' },
    { label: 'MVP',         value: profile.stats.mvp,         icon: Target,    color: '#e31c1c' },
  ]

  return (
    <div style={{ padding: '1rem', paddingBottom: '5rem', maxWidth: 600, margin: '0 auto' }}>
      {/* Back */}
      <button
        onClick={() => navigate('home')}
        className="flex items-center gap-2 mb-4 text-sm"
        style={{ color: 'var(--text-muted)' }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* Hero card */}
      <div
        className="rounded-2xl p-6 mb-4 relative overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* Background accent */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            background: 'radial-gradient(ellipse at top right, #8b5cf6, transparent 60%)',
            pointerEvents: 'none',
          }}
        />

        <div className="relative flex items-start gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <Avatar
              src={editing ? form.profilePicture : profile.profilePicture}
              name={profile.gameName || 'P'}
              size={80}
            />
            {isOwnProfile && editing && (
              <button
                onClick={() => {
                  const url = prompt('Enter image URL:')
                  if (url) setForm(prev => ({ ...prev, profilePicture: url }))
                }}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: '#8b5cf6' }}
              >
                <Camera size={13} color="#fff" />
              </button>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex flex-col gap-2">
                <input
                  value={form.gameName}
                  onChange={e => setForm(prev => ({ ...prev, gameName: e.target.value }))}
                  placeholder="Game Name"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
                />
                <input
                  value={form.gameUid}
                  onChange={e => setForm(prev => ({ ...prev, gameUid: e.target.value }))}
                  placeholder="Game UID"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
                />
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={saveProfile}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
                    style={{ background: '#22c55e', color: '#fff' }}
                  >
                    <Check size={14} /> {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  >
                    <X size={14} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                    {profile.gameName || 'Unknown Player'}
                  </h2>
                  {isOwnProfile && (
                    <button
                      onClick={() => setEditing(true)}
                      className="p-1.5 rounded-lg flex-shrink-0"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                    >
                      <Edit3 size={13} />
                    </button>
                  )}
                </div>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  UID: <span translate="no" className="font-mono">{profile.gameUid || '—'}</span>
                </p>
                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  <Calendar size={11} />
                  Joined {new Date(profile.joinDate).toLocaleDateString()}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Badges */}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {badges.map(b => <Badge key={b.label} {...b} />)}
          </div>
        )}
      </div>

      {/* Current team */}
      {profile.team && (
        <div
          className="rounded-xl p-4 mb-4 flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          onClick={() => navigate('team-profile', { teamId: profile.team!.id })}
        >
          <Avatar src={profile.team.logo} name={profile.team.name} size={44} />
          <div className="flex-1">
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{profile.team.name}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {profile.team.captainId === profile.id ? 'Captain' : 'Member'}
              {' · '}<span translate="no">{profile.team.walletBalance.toLocaleString()}</span> pts team wallet
            </p>
          </div>
          <Shield size={16} style={{ color: '#8b5cf6' }} />
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))' }}>
        {statCards.map(s => {
          const Icon = s.icon
          return (
            <div
              key={s.label}
              className="rounded-xl p-3 text-center"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <Icon size={20} className="mx-auto mb-1" style={{ color: s.color }} />
              <p className="text-lg font-bold" style={{ color: s.color }} translate="no">{s.value}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Wallet stats */}
      {profile.wallet && (
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <h3 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Wallet</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total Earned',    value: (profile.wallet.totalEarned || 0).toLocaleString(),    color: '#22c55e' },
              { label: 'Total Spent',     value: (profile.wallet.totalSpent  || 0).toLocaleString(),    color: '#e31c1c' },
              { label: 'Total Withdrawn', value: (profile.wallet.totalWithdrawn || 0).toLocaleString(), color: '#f59e0b' },
              { label: 'Balance',         value: (profile.wallet.balance || 0).toLocaleString(),        color: '#8b5cf6' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                <span className="font-bold text-sm" style={{ color: item.color }} translate="no">
                  {item.value} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
