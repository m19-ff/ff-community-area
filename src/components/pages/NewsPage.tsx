'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Newspaper, Trophy, Megaphone, Users, Calendar } from 'lucide-react'
import { PageLoader } from '../ui/LoadingSpinner'

type NewsItem = { id: number; type: string; title: string; content: string; image: string | null; publishedAt: string; videoUrl: string | null }

const TYPE_CONFIG: Record<string, { icon: typeof Newspaper; color: string; label: string }> = {
  news: { icon: Newspaper, color: '#3b82f6', label: 'News' },
  announcement: { icon: Megaphone, color: '#f59e0b', label: 'Announcement' },
  tournament_result: { icon: Trophy, color: '#22c55e', label: 'Results' },
  qualified_teams: { icon: Users, color: '#8b5cf6', label: 'Qualified Teams' },
}

export default function NewsPage() {
  const { token } = useAppStore()
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeType, setActiveType] = useState<string>('all')
  const [selected, setSelected] = useState<NewsItem | null>(null)

  useEffect(() => {
    const q = activeType !== 'all' ? `&type=${activeType}` : ''
    apiCall(`/news?limit=20${q}`, {}, token).then(res => {
      if (res.success && res.data) setItems((res.data as { news: NewsItem[] }).news || [])
      setLoading(false)
    })
  }, [activeType])

  if (loading) return <PageLoader />

  if (selected) {
    const cfg = TYPE_CONFIG[selected.type] || TYPE_CONFIG.news
    const Icon = cfg.icon
    return (
      <div style={{ padding: '1.5rem', paddingBottom: '5rem', maxWidth: 800 }}>
        <button onClick={() => setSelected(null)} className="btn btn-ghost btn-sm mb-4">
          ← Back to News
        </button>
        {selected.image && (
          <img src={selected.image} alt={selected.title} className="w-full rounded-xl mb-6 object-cover" style={{ maxHeight: 300 }} />
        )}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="badge"
            style={{ background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}30` }}
          >
            <Icon size={11} /> {cfg.label}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {new Date(selected.publishedAt).toLocaleString()}
          </span>
        </div>
        <h1 className="text-title mb-4">{selected.title}</h1>
        <div
          className="text-body whitespace-pre-wrap"
          style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}
        >
          {selected.content}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '5rem' }}>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { key: 'all', label: 'All', icon: Newspaper },
          ...Object.entries(TYPE_CONFIG).map(([key, cfg]) => ({ key, label: cfg.label, icon: cfg.icon })),
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveType(key)}
            className={`btn btn-sm ${activeType === key ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {items.length === 0 && (
        <div className="text-center py-20">
          <Newspaper size={48} style={{ margin: '0 auto 12px', color: 'var(--text-muted)', opacity: 0.4 }} />
          <p style={{ color: 'var(--text-muted)' }}>No news yet</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map(item => {
          const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.news
          const Icon = cfg.icon
          return (
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className="card p-0 text-left overflow-hidden hover:scale-[1.02] transition-transform"
            >
              {item.image && (
                <img src={item.image} alt={item.title} className="w-full object-cover" style={{ height: 140 }} />
              )}
              {!item.image && (
                <div
                  className="flex items-center justify-center"
                  style={{ height: 80, background: `${cfg.color}10` }}
                >
                  <Icon size={32} style={{ color: cfg.color, opacity: 0.5 }} />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="badge"
                    style={{ background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}30`, fontSize: '0.7rem' }}
                  >
                    {cfg.label}
                  </span>
                </div>
                <h3 className="font-bold mb-2 leading-snug">{item.title}</h3>
                <p className="text-small line-clamp-2" style={{ color: 'var(--text-secondary)', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', display: '-webkit-box' }}>
                  {item.content}
                </p>
                <div className="flex items-center gap-1 mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <Calendar size={11} />
                  {new Date(item.publishedAt).toLocaleDateString()}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
