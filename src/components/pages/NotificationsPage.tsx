'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import type { Page } from '@/store/useAppStore'
import {
  Bell, CheckCheck, Trophy, Users, Zap, Newspaper, Swords,
  Search, Trash2, Filter, RefreshCw, X, ChevronDown,
} from 'lucide-react'
import { PageLoader } from '../ui/LoadingSpinner'

type NotifItem = {
  id: number
  type: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
  data?: {
    deepLink?: string
    tournamentId?: number
    scrimId?: number
    teamId?: number
    newsId?: number
    withdrawalId?: number
    rechargeId?: number
  } | null
}

const TYPE_ICONS: Record<string, { icon: typeof Bell; color: string; label: string }> = {
  invitation:           { icon: Users,     color: '#3b82f6', label: 'Invitations' },
  join_request:         { icon: Users,     color: '#8b5cf6', label: 'Team' },
  tournament_published: { icon: Trophy,    color: '#f59e0b', label: 'Tournaments' },
  scrim_created:        { icon: Swords,    color: '#06b6d4', label: 'Scrims' },
  registration_accepted:{ icon: CheckCheck,color: '#22c55e', label: 'Accepted' },
  tournament_reminder:  { icon: Trophy,    color: '#f59e0b', label: 'Tournaments' },
  withdrawal_approved:  { icon: Zap,       color: '#22c55e', label: 'Wallet' },
  news:                 { icon: Newspaper, color: '#3b82f6', label: 'News' },
  general:              { icon: Bell,      color: 'var(--text-secondary)', label: 'General' },
}

const CATEGORIES = [
  { value: 'all',                  label: 'All' },
  { value: 'tournament_published', label: 'Tournaments' },
  { value: 'scrim_created',        label: 'Scrims' },
  { value: 'invitation',           label: 'Team' },
  { value: 'withdrawal_approved',  label: 'Wallet' },
  { value: 'news',                 label: 'News' },
  { value: 'general',              label: 'General' },
]

function resolveDeepLink(notif: NotifItem): { page: Page; params?: Record<string, unknown> } | null {
  const d = notif.data
  if (d?.deepLink) {
    if (d.deepLink.startsWith('/tournaments/') && d.tournamentId) {
      return { page: 'tournament-detail', params: { id: d.tournamentId } }
    }
    if (d.deepLink === '/my-team') return { page: 'my-team' }
    if (d.deepLink === '/wallet')  return { page: 'wallet' }
    if (d.deepLink === '/scrims')  return { page: 'scrims' }
    if (d.deepLink === '/news')    return { page: 'news' }
  }
  switch (notif.type) {
    case 'tournament_published':
    case 'tournament_reminder':
    case 'registration_accepted':
      if (d?.tournamentId) return { page: 'tournament-detail', params: { id: d.tournamentId } }
      return { page: 'tournaments' }
    case 'scrim_created':        return { page: 'scrims' }
    case 'invitation':
    case 'join_request':         return { page: 'my-team' }
    case 'withdrawal_approved':  return { page: 'wallet' }
    case 'news':                 return { page: 'news' }
    default:                     return null
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NotificationsPage() {
  const { token, unreadCount, setUnreadCount, showToast, navigate } = useAppStore()

  const [items, setItems]         = useState<NotifItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch]       = useState('')
  const [category, setCategory]   = useState('all')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage]           = useState(1)
  const [hasMore, setHasMore]     = useState(false)
  const [total, setTotal]         = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [deleting, setDeleting]   = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (pg = 1, append = false) => {
    if (pg === 1) setLoading(true); else setLoadingMore(true)

    const params = new URLSearchParams({
      page:     String(pg),
      ...(unreadOnly ? { unread: 'true' } : {}),
      ...(category && category !== 'all' ? { category } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
    })

    const res = await apiCall(`/notifications?${params}`, {}, token)
    if (res.success && res.data) {
      const d = res.data as {
        notifications: NotifItem[]
        unreadCount: number
        pagination: { total: number; pages: number; page: number }
      }
      const list = d.notifications || []
      setItems(prev => append ? [...prev, ...list] : list)
      setUnreadCount(d.unreadCount || 0)
      setTotal(d.pagination.total || 0)
      setHasMore(pg < d.pagination.pages)
    }
    if (pg === 1) setLoading(false); else setLoadingMore(false)
  }, [token, unreadOnly, category, search, setUnreadCount])

  // Initial load + filter changes
  useEffect(() => {
    setPage(1)
    load(1, false)
  }, [unreadOnly, category])

  // Debounced search
  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => {
      setPage(1)
      load(1, false)
    }, 350)
    return () => { if (searchRef.current) clearTimeout(searchRef.current) }
  }, [search])

  // Infinite scroll
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        const next = page + 1
        setPage(next)
        load(next, true)
      }
    }, { threshold: 0.1 })
    if (bottomRef.current) obs.observe(bottomRef.current)
    return () => obs.disconnect()
  }, [hasMore, loadingMore, page, load])

  const markRead = async (id: number) => {
    await apiCall('/notifications', { method: 'PATCH', body: JSON.stringify({ notificationId: id }) }, token)
    setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    setUnreadCount(Math.max(0, unreadCount - 1))
  }

  const markAllRead = async () => {
    await apiCall('/notifications', { method: 'PATCH', body: JSON.stringify({ markAllRead: true }) }, token)
    setItems(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
    showToast('All marked as read')
  }

  const deleteNotif = async (id: number) => {
    setDeleting(id)
    await apiCall(`/notifications?id=${id}`, { method: 'DELETE' }, token)
    setItems(prev => prev.filter(n => n.id !== id))
    setTotal(prev => prev - 1)
    setDeleting(null)
  }

  const deleteAll = async () => {
    if (!confirm('Delete all notifications?')) return
    await apiCall('/notifications?all=true', { method: 'DELETE' }, token)
    setItems([])
    setTotal(0)
    setUnreadCount(0)
    showToast('All notifications deleted')
  }

  const handleClick = async (notif: NotifItem) => {
    if (!notif.isRead) await markRead(notif.id)
    const dest = resolveDeepLink(notif)
    if (dest) navigate(dest.page, dest.params)
  }

  if (loading) return <PageLoader />

  const localUnread = items.filter(n => !n.isRead).length

  return (
    <div style={{ padding: '1rem', paddingBottom: '5rem', maxWidth: 680, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Notifications</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {total} total{localUnread > 0 ? `, ${localUnread} unread` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {localUnread > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--accent-green)' }}
            >
              <CheckCheck size={14} />
              <span>Read All</span>
            </button>
          )}
          {items.length > 0 && (
            <button
              onClick={deleteAll}
              className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--accent-red)' }}
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={() => load(1, false)}
            className="p-2 rounded-lg"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search notifications…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X size={14} style={{ color: 'var(--text-muted)' }} />
          </button>
        )}
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {/* Unread toggle */}
        <button
          onClick={() => setUnreadOnly(!unreadOnly)}
          className="flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
          style={{
            background: unreadOnly ? '#3b82f6' : 'var(--bg-card)',
            color:      unreadOnly ? '#fff' : 'var(--text-secondary)',
            border:     '1px solid var(--border)',
          }}
        >
          Unread
        </button>
        {/* Category pills */}
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
            style={{
              background: category === cat.value ? '#8b5cf6' : 'var(--bg-card)',
              color:      category === cat.value ? '#fff' : 'var(--text-secondary)',
              border:     '1px solid var(--border)',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {items.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
          <Bell size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No notifications</p>
          <p className="text-sm mt-1">
            {search || unreadOnly || category !== 'all'
              ? 'Try changing filters'
              : 'You\'re all caught up!'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(notif => {
            const meta = TYPE_ICONS[notif.type] || TYPE_ICONS.general
            const Icon = meta.icon
            return (
              <div
                key={notif.id}
                onClick={() => handleClick(notif)}
                className="rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.01]"
                style={{
                  background:  notif.isRead ? 'var(--bg-card)' : 'var(--bg-elevated)',
                  border:      `1px solid ${notif.isRead ? 'var(--border)' : meta.color + '44'}`,
                  opacity:     deleting === notif.id ? 0.4 : 1,
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
                    style={{ background: meta.color + '22' }}
                  >
                    <Icon size={16} style={{ color: meta.color }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm leading-snug" style={{ color: 'var(--text-primary)' }}>
                        {notif.title}
                      </p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); deleteNotif(notif.id) }}
                          className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: 'var(--text-muted)' }}
                          aria-label="Delete"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm mt-0.5 leading-snug" style={{ color: 'var(--text-secondary)' }}>
                      {notif.body}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {timeAgo(notif.createdAt)}
                      </span>
                      {!notif.isRead && (
                        <button
                          onClick={e => { e.stopPropagation(); markRead(notif.id) }}
                          className="text-xs font-medium"
                          style={{ color: meta.color }}
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Load more sentinel */}
      <div ref={bottomRef} className="py-4 text-center">
        {loadingMore && (
          <div className="flex items-center justify-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <RefreshCw size={14} className="animate-spin" />
            <span className="text-sm">Loading more…</span>
          </div>
        )}
        {!hasMore && items.length > 0 && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>All notifications loaded</p>
        )}
      </div>
    </div>
  )
}
