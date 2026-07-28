'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import MobileNav from './MobileNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token, user, setUser, setWallet, setMyTeam, setUnreadCount, sidebarOpen, mobileNavOpen } = useAppStore()

  useEffect(() => {
    if (!token) return
    // Load profile
    apiCall('/auth/profile', {}, token).then(res => {
      if (res.success && res.data) {
        const d = res.data as { user: import('@/store/useAppStore').User | null; wallet: import('@/store/useAppStore').Wallet | null; team: import('@/store/useAppStore').Team | null }
        if (d.user) setUser(d.user)
        if (d.wallet) setWallet(d.wallet)
        if (d.team) setMyTeam(d.team)
      }
    })
    // Load unread count
    apiCall('/notifications?unread=true', {}, token).then(res => {
      if (res.success && res.data) {
        const d = res.data as { unreadCount: number }
        setUnreadCount(d.unreadCount || 0)
      }
    })
  }, [token])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Sidebar - desktop */}
      <div
        className="hidden md:flex flex-col shrink-0 transition-all duration-300"
        style={{
          width: sidebarOpen ? 260 : 72,
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border)',
        }}
      >
        <Sidebar />
      </div>

      {/* Mobile overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => useAppStore.getState().setMobileNavOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`fixed left-0 top-0 bottom-0 z-50 md:hidden flex flex-col transition-transform duration-300 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ width: 260, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
      >
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main
          className="flex-1 overflow-y-auto"
          style={{ background: 'var(--bg-primary)' }}
        >
          <div className="fade-in">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  )
}
