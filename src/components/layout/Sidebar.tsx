'use client'
import { useAppStore } from '@/store/useAppStore'
import Avatar from '../ui/Avatar'
import {
  Home, Trophy, Swords, Users, Shield, Wallet, Newspaper,
  Bell, Settings, LogOut, ChevronLeft, ChevronRight,
  LayoutDashboard, UserCog, Building, FileText, DollarSign, RefreshCw, SlidersHorizontal
} from 'lucide-react'

const PLAYER_NAV = [
  { icon: Home, label: 'Home', page: 'home' },
  { icon: Trophy, label: 'Tournaments', page: 'tournaments' },
  { icon: Swords, label: 'Scrims', page: 'scrims' },
  { icon: Users, label: 'Teams', page: 'teams' },
  { icon: Shield, label: 'My Team', page: 'my-team' },
  { icon: Wallet, label: 'Wallet', page: 'wallet' },
  { icon: Newspaper, label: 'News', page: 'news' },
  { icon: Bell, label: 'Notifications', page: 'notifications' },
]

const ADMIN_NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', page: 'admin' },
  { icon: UserCog, label: 'Users', page: 'admin-users' },
  { icon: Building, label: 'Teams', page: 'admin-teams' },
  { icon: Trophy, label: 'Tournaments', page: 'admin-tournaments' },
  { icon: Swords, label: 'Scrims', page: 'admin-scrims' },
  { icon: FileText, label: 'News', page: 'admin-news' },
  { icon: DollarSign, label: 'Withdrawals', page: 'admin-withdrawals' },
  { icon: RefreshCw, label: 'Recharge', page: 'admin-recharge' },
  { icon: SlidersHorizontal, label: 'Settings', page: 'admin-settings' },
]

export default function Sidebar() {
  const { user, currentPage, navigate, logout, sidebarOpen, setSidebarOpen, setMobileNavOpen, unreadCount } = useAppStore()

  const isAdmin = user && ['admin', 'superadmin', 'assistant'].includes(user.role)
  const navItems = isAdmin
    ? [...PLAYER_NAV.slice(0, 1), ...ADMIN_NAV]
    : PLAYER_NAV

  const handleNav = (page: string) => {
    navigate(page as Parameters<typeof navigate>[0])
    setMobileNavOpen(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 py-5 border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        {/* Logo icon — always visible */}
        <img
          src="/logo.png"
          alt="FF Community Arena"
          style={{ width: 36, height: 36, borderRadius: 6, flexShrink: 0, objectFit: 'contain' }}
        />
        {sidebarOpen && (
          <img
            src="/logo.png"
            alt="FF Community Arena"
            style={{ height: 32, width: 'auto', objectFit: 'contain' }}
          />
        )}
        {sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto btn btn-ghost btn-icon hidden md:flex"
            style={{ color: 'var(--text-muted)' }}
          >
            <ChevronLeft size={16} />
          </button>
        )}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="btn btn-ghost btn-icon"
            style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 no-scrollbar">
        {sidebarOpen && (
          <div
            className="text-xs font-bold mb-2 px-2"
            style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}
          >
            {isAdmin ? 'Admin Panel' : 'Platform'}
          </div>
        )}
        <div className="flex flex-col gap-1">
          {navItems.map(({ icon: Icon, label, page }) => (
            <button
              key={page}
              onClick={() => handleNav(page)}
              className={`nav-item w-full text-left ${currentPage === page ? 'active' : ''} ${!sidebarOpen ? 'justify-center' : ''}`}
              title={!sidebarOpen ? label : undefined}
            >
              <div className="relative">
                <Icon size={18} className="shrink-0" />
                {label === 'Notifications' && unreadCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white font-bold"
                    style={{
                      width: 14, height: 14, fontSize: 9,
                      background: 'var(--accent-red)',
                      boxShadow: '0 0 6px var(--accent-red-glow)',
                    }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              {sidebarOpen && <span>{label}</span>}
            </button>
          ))}
        </div>

        {isAdmin && sidebarOpen && (
          <>
            <div className="divider my-3" />
            <div
              className="text-xs font-bold mb-2 px-2"
              style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}
            >
              Player View
            </div>
            <div className="flex flex-col gap-1">
              {PLAYER_NAV.slice(1).map(({ icon: Icon, label, page }) => (
                <button
                  key={page}
                  onClick={() => handleNav(page)}
                  className={`nav-item w-full text-left ${currentPage === page ? 'active' : ''}`}
                >
                  <Icon size={18} className="shrink-0" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </nav>

      {/* User area */}
      <div className="border-t p-3 shrink-0" style={{ borderColor: 'var(--border)' }}>
        {sidebarOpen ? (
          <div className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'var(--bg-card)' }}>
            <Avatar src={user?.profilePicture} name={user?.gameName || user?.email} size={36} />
            <div className="flex-1 min-w-0">
              <div className="text-small font-semibold truncate">{user?.gameName || user?.email}</div>
              <div className="text-xs capitalize" style={{ color: 'var(--accent-red)' }}>{user?.role}</div>
            </div>
            <button onClick={logout} className="btn btn-ghost btn-icon shrink-0" title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Avatar src={user?.profilePicture} name={user?.gameName || user?.email} size={36} />
            <button onClick={logout} className="btn btn-ghost btn-icon" title="Logout" style={{ width: 36, height: 36 }}>
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
