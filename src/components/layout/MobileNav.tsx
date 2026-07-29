'use client'
import { useAppStore } from '@/store/useAppStore'
import { Home, Trophy, Swords, Shield, BarChart2, MessageCircle } from 'lucide-react'

const NAV_ITEMS = [
  { icon: Home,          label: 'Home',        page: 'home' },
  { icon: Trophy,        label: 'Tournaments', page: 'tournaments' },
  { icon: Swords,        label: 'Scrims',      page: 'scrims' },
  { icon: Shield,        label: 'My Team',     page: 'my-team' },
  { icon: BarChart2,     label: 'Leaderboard', page: 'leaderboard' },
  { icon: MessageCircle, label: 'Chat',        page: 'team-chat' },
]

export default function MobileNav() {
  const { currentPage, navigate } = useAppStore()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 md:hidden z-30 flex"
      style={{
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {NAV_ITEMS.map(({ icon: Icon, label, page }) => {
        const isActive = currentPage === page
        return (
          <button
            key={page}
            onClick={() => navigate(page as Parameters<typeof navigate>[0])}
            className="flex-1 flex flex-col items-center justify-center py-2 gap-1 transition-colors"
            style={{ color: isActive ? 'var(--accent-red)' : 'var(--text-muted)' }}
          >
            <Icon size={20} />
            <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500 }}>{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
