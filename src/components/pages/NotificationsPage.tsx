'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Bell, CheckCheck, Trophy, Users, Zap, Newspaper, Swords } from 'lucide-react'
import { PageLoader } from '../ui/LoadingSpinner'

type NotifItem = { id: number; type: string; title: string; body: string; isRead: boolean; createdAt: string }

const TYPE_ICONS: Record<string, { icon: typeof Bell; color: string }> = {
  invitation: { icon: Users, color: '#3b82f6' },
  join_request: { icon: Users, color: '#8b5cf6' },
  tournament_published: { icon: Trophy, color: '#f59e0b' },
  scrim_created: { icon: Swords, color: '#3b82f6' },
  registration_accepted: { icon: CheckCheck, color: '#22c55e' },
  tournament_reminder: { icon: Trophy, color: '#f59e0b' },
  withdrawal_approved: { icon: Zap, color: '#22c55e' },
  news: { icon: Newspaper, color: '#3b82f6' },
  general: { icon: Bell, color: 'var(--text-secondary)' },
}

export default function NotificationsPage() {
  const { token, setUnreadCount, showToast } = useAppStore()
  const [items, setItems] = useState<NotifItem[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    apiCall('/notifications?limit=50', {}, token).then(res => {
      if (res.success && res.data) {
        const d = res.data as { notifications: NotifItem[]; unreadCount: number }
        setItems(d.notifications || [])
        setUnreadCount(d.unreadCount || 0)
      }
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [token])

  const markRead = async (id?: number) => {
    const body = id ? { notificationId: id } : { markAllRead: true }
    const res = await apiCall('/notifications', { method: 'PATCH', body: JSON.stringify(body) }, token)
    if (res.success) {
      if (id) {
        setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
        setUnreadCount(Math.max(0, useAppStore.getState().unreadCount - 1))
      } else {
        setItems(prev => prev.map(n => ({ ...n, isRead: true })))
        setUnreadCount(0)
        showToast('All notifications marked as read')
      }
    }
  }

  if (loading) return <PageLoader />

  const unread = items.filter(n => !n.isRead).length

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '5rem' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-heading">Notifications</h2>
          {unread > 0 && (
            <p className="text-small mt-1" style={{ color: 'var(--text-muted)' }}>{unread} unread</p>
          )}
        </div>
        {unread > 0 && (
          <button onClick={() => markRead()} className="btn btn-secondary btn-sm">
            <CheckCheck size={14} /> Mark All Read
          </button>
        )}
      </div>

      {items.length === 0 && (
        <div className="text-center py-20">
          <Bell size={48} style={{ margin: '0 auto 12px', color: 'var(--text-muted)', opacity: 0.4 }} />
          <p style={{ color: 'var(--text-muted)' }}>No notifications yet</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {items.map(notif => {
          const cfg = TYPE_ICONS[notif.type] || TYPE_ICONS.general
          const Icon = cfg.icon
          return (
            <div
              key={notif.id}
              onClick={() => !notif.isRead && markRead(notif.id)}
              className="card p-4 flex items-start gap-3 cursor-pointer transition-colors"
              style={{
                background: notif.isRead ? 'var(--bg-card)' : 'rgba(227,28,28,0.05)',
                borderColor: notif.isRead ? 'var(--border)' : 'var(--border-accent)',
              }}
            >
              <div
                className="flex items-center justify-center rounded-lg shrink-0"
                style={{ width: 40, height: 40, background: `${cfg.color}18` }}
              >
                <Icon size={18} style={{ color: cfg.color }} />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-small">{notif.title}</div>
                  {!notif.isRead && (
                    <div
                      className="shrink-0 rounded-full"
                      style={{ width: 8, height: 8, background: 'var(--accent-red)', marginTop: 4 }}
                    />
                  )}
                </div>
                <p className="text-small mt-0.5" style={{ color: 'var(--text-secondary)' }}>{notif.body}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {new Date(notif.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
