'use client'
import { create } from 'zustand'

export interface User {
  id: number
  email: string
  role: string
  gameName?: string | null
  gameUid?: string | null
  profilePicture?: string | null
  profileCompleted: boolean
  emailVerified: boolean
}

export interface Wallet {
  balance: number
  totalEarned: number
  usdValue: string
}

export interface Team {
  id: number
  name: string
  logo?: string | null
  points: number
  walletBalance?: number
  captainId: number
  totalTournaments?: number
  memberCount?: number
}

export interface Notification {
  id: number
  type: string
  title: string
  body: string
  isRead: boolean
  createdAt: string
  data?: Record<string, unknown>
}

export type Page =
  | 'landing'
  | 'login'
  | 'register'
  | 'verify-email'
  | 'forgot-password'
  | 'complete-profile'
  | 'home'
  | 'tournaments'
  | 'tournament-detail'
  | 'scrims'
  | 'teams'
  | 'team-detail'
  | 'my-team'
  | 'wallet'
  | 'news'
  | 'news-detail'
  | 'notifications'
  | 'settings'
  | 'admin'
  | 'admin-users'
  | 'admin-teams'
  | 'admin-tournaments'
  | 'admin-scrims'
  | 'admin-news'
  | 'admin-withdrawals'
  | 'admin-recharge'
  | 'admin-settings'
  | 'admin-app'
  | 'team-wallet-history'

interface AppState {
  // Auth
  token: string | null
  user: User | null
  wallet: Wallet | null
  myTeam: Team | null
  isLoading: boolean

  // Navigation
  currentPage: Page
  pageParams: Record<string, unknown>

  // Notifications
  unreadCount: number
  notifications: Notification[]

  // UI
  sidebarOpen: boolean
  mobileNavOpen: boolean
  toast: { message: string; type: 'success' | 'error' | 'info' } | null

  // Actions
  setToken: (token: string | null) => void
  setUser: (user: User | null) => void
  setWallet: (wallet: Wallet | null) => void
  setMyTeam: (team: Team | null) => void
  setLoading: (loading: boolean) => void
  navigate: (page: Page, params?: Record<string, unknown>) => void
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
  clearToast: () => void
  setSidebarOpen: (open: boolean) => void
  setMobileNavOpen: (open: boolean) => void
  setUnreadCount: (count: number) => void
  setNotifications: (notifs: Notification[]) => void
  logout: () => void
  loadFromStorage: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  token: null,
  user: null,
  wallet: null,
  myTeam: null,
  isLoading: false,
  currentPage: 'landing',
  pageParams: {},
  unreadCount: 0,
  notifications: [],
  sidebarOpen: true,
  mobileNavOpen: false,
  toast: null,

  setToken: (token) => {
    set({ token })
    if (typeof window !== 'undefined') {
      if (token) localStorage.setItem('auth_token', token)
      else localStorage.removeItem('auth_token')
    }
  },
  setUser: (user) => {
    set({ user })
    if (typeof window !== 'undefined') {
      if (user) localStorage.setItem('auth_user', JSON.stringify(user))
      else localStorage.removeItem('auth_user')
    }
  },
  setWallet: (wallet) => set({ wallet }),
  setMyTeam: (team) => set({ myTeam: team }),
  setLoading: (isLoading) => set({ isLoading }),
  navigate: (currentPage, pageParams = {}) => set({ currentPage, pageParams }),
  showToast: (message, type = 'success') => {
    set({ toast: { message, type } })
    setTimeout(() => set({ toast: null }), 3500)
  },
  clearToast: () => set({ toast: null }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  setNotifications: (notifications) => set({ notifications }),
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
    }
    set({ token: null, user: null, wallet: null, myTeam: null, currentPage: 'landing', unreadCount: 0 })
  },
  loadFromStorage: () => {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem('auth_token')
    const userStr = localStorage.getItem('auth_user')
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr)
        set({ token, user, currentPage: user.profileCompleted ? 'home' : 'complete-profile' })
      } catch {}
    }
  },
}))

// API helper
export async function apiCall<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
): Promise<{ success: boolean; data?: T; message?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch(`/api${endpoint}`, { ...options, headers })
    const json = await res.json()
    return json
  } catch (err) {
    return { success: false, message: 'Network error' }
  }
}
