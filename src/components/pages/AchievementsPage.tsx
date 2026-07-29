'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Star, Lock, CheckCircle, Trophy, Zap } from 'lucide-react'
import { PageLoader } from '../ui/LoadingSpinner'

type Achievement = {
  id: number; key: string; name: string; description: string
  category: string; rarity: string; pointReward: number
  iconUrl: string | null; unlockedAt: string | null; isUnlocked: boolean
  progress?: number; maxProgress?: number
}

const RARITY_COLORS: Record<string, string> = {
  common:    '#9ca3af',
  uncommon:  '#22c55e',
  rare:      '#3b82f6',
  epic:      '#a855f7',
  legendary: '#f59e0b',
}

const CATEGORY_LABELS: Record<string, string> = {
  tournament: 'Tournaments',
  scrims:     'Scrims',
  wallet:     'Wallet',
  social:     'Social',
  general:    'General',
}

export default function AchievementsPage() {
  const { token } = useAppStore()
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState<'all'|'unlocked'|'locked'>('all')
  const [category,     setCategory]     = useState<string>('all')
  const [selected,     setSelected]     = useState<Achievement | null>(null)

  useEffect(() => {
    apiCall('/achievements', {}, token).then(res => {
      if (res.success && res.data) {
        const d = res.data as { achievements: Achievement[] }
        setAchievements(d.achievements || [])
      }
      setLoading(false)
    })
  }, [token])

  const categories = ['all', ...Array.from(new Set(achievements.map(a => a.category)))]

  const filtered = achievements.filter(a => {
    if (filter === 'unlocked' && !a.isUnlocked) return false
    if (filter === 'locked'   &&  a.isUnlocked) return false
    if (category !== 'all'   && a.category !== category) return false
    return true
  })

  const unlockedCount = achievements.filter(a => a.isUnlocked).length
  const totalPoints   = achievements.filter(a => a.isUnlocked).reduce((s, a) => s + (a.pointReward || 0), 0)

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '5rem', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-black mb-1 flex items-center gap-2">
          <Star size={22} style={{ color: '#f59e0b' }} />
          Achievements
        </h1>
        <p className="text-small" style={{ color: 'var(--text-muted)' }}>
          Complete challenges to earn points and badges
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Unlocked',  value: `${unlockedCount} / ${achievements.length}`, icon: <CheckCircle size={16} style={{ color: '#22c55e' }} /> },
          { label: 'Total',     value: `${achievements.length}`,                     icon: <Trophy size={16} style={{ color: '#f59e0b' }} /> },
          { label: 'Pts Earned',value: totalPoints.toLocaleString(),                  icon: <Zap size={16} style={{ color: 'var(--accent-red)' }} /> },
        ].map(s => (
          <div key={s.label} className="card p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">{s.icon}</div>
            <div className="font-black text-base">{s.value}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="card p-4 mb-5">
        <div className="flex items-center justify-between mb-2 text-sm">
          <span className="font-semibold">Overall Progress</span>
          <span style={{ color: 'var(--text-muted)' }}>
            {achievements.length > 0 ? Math.round((unlockedCount / achievements.length) * 100) : 0}%
          </span>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 8, background: 'rgba(255,255,255,0.08)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${achievements.length > 0 ? (unlockedCount / achievements.length) * 100 : 0}%`,
              background: 'linear-gradient(90deg, var(--accent-red), #f59e0b)',
            }}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'unlocked', 'locked'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background: filter === f ? 'var(--accent-red)' : 'var(--bg-card)',
              border: `1px solid ${filter === f ? 'var(--accent-red)' : 'var(--border)'}`,
              color: filter === f ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <div className="w-px" style={{ background: 'var(--border)', margin: '0 4px' }} />
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background: category === c ? 'rgba(168,85,247,0.2)' : 'var(--bg-card)',
              border: `1px solid ${category === c ? '#a855f7' : 'var(--border)'}`,
              color: category === c ? '#a855f7' : 'var(--text-secondary)',
            }}
          >
            {CATEGORY_LABELS[c] || (c.charAt(0).toUpperCase() + c.slice(1))}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="card p-10 text-center" style={{ color: 'var(--text-muted)' }}>
          No achievements match your filter.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filtered.map(a => (
            <button
              key={a.id}
              onClick={() => setSelected(selected?.id === a.id ? null : a)}
              className="card p-4 text-center flex flex-col items-center gap-2 relative transition-transform hover:scale-[1.02]"
              style={{
                opacity: a.isUnlocked ? 1 : 0.55,
                border: selected?.id === a.id ? '1px solid var(--accent-red)' : '1px solid var(--border)',
              }}
            >
              {/* Rarity dot */}
              <div
                className="absolute top-2 right-2 w-2 h-2 rounded-full"
                style={{ background: RARITY_COLORS[a.rarity] || '#9ca3af' }}
                title={a.rarity}
              />

              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl relative"
                style={{
                  background: a.isUnlocked
                    ? `linear-gradient(135deg, ${RARITY_COLORS[a.rarity] || '#9ca3af'}22, ${RARITY_COLORS[a.rarity] || '#9ca3af'}11)`
                    : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${a.isUnlocked ? (RARITY_COLORS[a.rarity] || '#9ca3af') + '44' : 'var(--border)'}`,
                }}
              >
                {a.isUnlocked ? (a.iconUrl || '🏆') : <Lock size={20} style={{ color: 'var(--text-muted)' }} />}
              </div>

              <div className="text-xs font-bold leading-tight" style={{ color: a.isUnlocked ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {a.name}
              </div>

              {a.isUnlocked && (
                <div className="flex items-center gap-1 text-xs" style={{ color: '#f59e0b' }}>
                  <Zap size={10} />
                  +{a.pointReward}
                </div>
              )}

              {!a.isUnlocked && a.progress !== undefined && a.maxProgress !== undefined && (
                <div className="w-full mt-1">
                  <div className="rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.08)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (a.progress / a.maxProgress) * 100)}%`,
                        background: RARITY_COLORS[a.rarity] || '#9ca3af',
                      }}
                    />
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontSize: 9 }}>
                    {a.progress}/{a.maxProgress}
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div
          className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-80 rounded-2xl p-5 z-40 shadow-2xl"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl shrink-0"
              style={{
                background: `linear-gradient(135deg, ${RARITY_COLORS[selected.rarity] || '#9ca3af'}22, ${RARITY_COLORS[selected.rarity] || '#9ca3af'}11)`,
                border: `1px solid ${(RARITY_COLORS[selected.rarity] || '#9ca3af') + '44'}`,
              }}
            >
              {selected.isUnlocked ? (selected.iconUrl || '🏆') : <Lock size={24} style={{ color: 'var(--text-muted)' }} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-black text-sm mb-0.5">{selected.name}</div>
              <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{selected.description}</div>
              <div className="flex flex-wrap gap-2">
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: (RARITY_COLORS[selected.rarity] || '#9ca3af') + '22', color: RARITY_COLORS[selected.rarity] || '#9ca3af' }}
                >
                  {selected.rarity}
                </span>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
                >
                  +{selected.pointReward} pts
                </span>
                {selected.isUnlocked && selected.unlockedAt && (
                  <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                    Unlocked {new Date(selected.unlockedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
