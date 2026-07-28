'use client'
import { useAppStore } from '@/store/useAppStore'
import Avatar from '../ui/Avatar'
import { Menu, Bell, Zap, Search } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  home: 'Dashboard',
  tournaments: 'Tournaments',
  'tournament-detail': 'Tournament Details',
  scrims: 'Scrims',
  teams: 'Browse Teams',
  'my-team': 'My Team',
  wallet: 'Wallet',
  news: 'News & Updates',
  notifications: 'Notifications',
  admin: 'Admin Dashboard',
  'admin-users': 'Manage Users',
  'admin-teams': 'Manage Teams',
  'admin-tournaments': 'Manage Tournaments',
  'admin-scrims': 'Manage Scrims',
  'admin-news': 'Manage News',
  'admin-withdrawals': 'Withdrawal Requests',
  'admin-recharge': 'Recharge Requests',
  'admin-settings': 'Platform Settings',
  'admin-app': 'App Management',
}

export default function TopBar() {
  const { user, wallet, unreadCount, currentPage, navigate, setMobileNavOpen } = useAppStore()

  return (
    <header
      className="flex items-center gap-4 px-4 md:px-6 shrink-0"
      style={{
        height: 64,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Mobile menu */}
      <button
        className="btn btn-ghost btn-icon md:hidden"
        onClick={() => setMobileNavOpen(true)}
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      <div className="flex-1">
        <h1 className="font-bold text-base md:text-lg">{PAGE_TITLES[currentPage] || 'FF Community Arena'}</h1>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Points display */}
        {wallet && (
          <div
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--accent-red-dim)', border: '1px solid var(--border-accent)' }}
          >
            <Zap size={14} style={{ color: 'var(--accent-red)' }} />
            <span className="font-bold text-sm" style={{ color: 'var(--accent-red)' }}>
              {wallet.balance.toLocaleString()} pts
            </span>
          </div>
        )}

        {/* Notifications */}
        <button
          onClick={() => navigate('notifications')}
          className="btn btn-ghost btn-icon relative"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-white font-bold"
              style={{
                width: 16, height: 16, fontSize: 10,
                background: 'var(--accent-red)',
                boxShadow: '0 0 8px var(--accent-red-glow)',
              }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Avatar */}
        <button onClick={() => navigate('home')} className="flex items-center gap-2">
          <Avatar src={user?.profilePicture} name={user?.gameName || user?.email} size={34} />
        </button>
      </div>
    </header>
  )
}
