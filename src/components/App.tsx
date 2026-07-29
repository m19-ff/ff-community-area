'use client'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import Toast from './ui/Toast'
import ForceUpdateScreen from './ui/ForceUpdateScreen'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import CompleteProfilePage from './pages/CompleteProfilePage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import DashboardLayout from './layout/DashboardLayout'
import HomePage from './pages/HomePage'
import TournamentsPage from './pages/TournamentsPage'
import TournamentDetailPage from './pages/TournamentDetailPage'
import ScrimsPage from './pages/ScrimsPage'
import TeamsPage from './pages/TeamsPage'
import MyTeamPage from './pages/MyTeamPage'
import WalletPage from './pages/WalletPage'
import NewsPage from './pages/NewsPage'
import NotificationsPage from './pages/NotificationsPage'
import AdminPage from './pages/admin/AdminPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminTeamsPage from './pages/admin/AdminTeamsPage'
import AdminTournamentsPage from './pages/admin/AdminTournamentsPage'
import AdminScrimsPage from './pages/admin/AdminScrimsPage'
import AdminNewsPage from './pages/admin/AdminNewsPage'
import AdminWithdrawalsPage from './pages/admin/AdminWithdrawalsPage'
import AdminRechargePage from './pages/admin/AdminRechargePage'
import AdminSettingsPage from './pages/admin/AdminSettingsPage'
import AdminAppPage from './pages/admin/AdminAppPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import TeamWalletHistoryPage from './pages/TeamWalletHistoryPage'

// ── Semver comparison: returns true if `a` is strictly older than `b` ────────
function isOlderVersion(a: string, b: string): boolean {
  const parse = (v: string) =>
    v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0)
  const [aMaj, aMin, aPat] = parse(a)
  const [bMaj, bMin, bPat] = parse(b)
  if (aMaj !== bMaj) return aMaj < bMaj
  if (aMin !== bMin) return aMin < bMin
  return aPat < bPat
}

type AppRelease = {
  version: string; apkUrl: string; apkSize: string | null
  releaseNotes: string | null; forceUpdate: boolean
}

const DASHBOARD_PAGES = [
  'home', 'tournaments', 'tournament-detail', 'scrims',
  'teams', 'team-detail', 'my-team', 'wallet', 'news',
  'news-detail', 'notifications', 'settings',
  'team-wallet-history',
  'admin', 'admin-users', 'admin-teams', 'admin-tournaments',
  'admin-scrims', 'admin-news', 'admin-withdrawals', 'admin-recharge',
  'admin-settings', 'admin-app',
]

function PageContent() {
  const { currentPage } = useAppStore()

  switch (currentPage) {
    case 'home':               return <HomePage />
    case 'tournaments':        return <TournamentsPage />
    case 'tournament-detail':  return <TournamentDetailPage />
    case 'scrims':             return <ScrimsPage />
    case 'teams':              return <TeamsPage />
    case 'my-team':            return <MyTeamPage />
    case 'wallet':             return <WalletPage />
    case 'news':               return <NewsPage />
    case 'notifications':      return <NotificationsPage />
    case 'team-wallet-history': return <TeamWalletHistoryPage />
    case 'admin':              return <AdminPage />
    case 'admin-users':        return <AdminUsersPage />
    case 'admin-teams':        return <AdminTeamsPage />
    case 'admin-tournaments':  return <AdminTournamentsPage />
    case 'admin-scrims':       return <AdminScrimsPage />
    case 'admin-news':         return <AdminNewsPage />
    case 'admin-withdrawals':  return <AdminWithdrawalsPage />
    case 'admin-recharge':     return <AdminRechargePage />
    case 'admin-settings':     return <AdminSettingsPage />
    case 'admin-app':          return <AdminAppPage />
    default:                   return <HomePage />
  }
}

export default function App() {
  const { currentPage, user } = useAppStore()
  const [forceRelease, setForceRelease] = useState<AppRelease | null>(null)

  // Check for force update on mount and whenever user changes
  useEffect(() => {
    const check = async () => {
      // Admins are never blocked
      if (user && ['admin', 'superadmin', 'assistant'].includes(user.role)) {
        setForceRelease(null)
        return
      }
      try {
        const res  = await fetch('/api/app-release')
        const json = await res.json()
        const rel  = json?.data?.release as AppRelease | null
        if (!rel || !rel.forceUpdate) { setForceRelease(null); return }

        // Read the version the user is currently running from localStorage
        // (set to the latest version automatically when they download the app)
        const installedVersion = localStorage.getItem('app_version') || '0.0.0'
        if (isOlderVersion(installedVersion, rel.version)) {
          setForceRelease(rel)
        } else {
          setForceRelease(null)
        }
      } catch {
        // Network error — don't block the user
        setForceRelease(null)
      }
    }
    check()
  }, [user])

  // Show the full-screen gate if a force update is needed
  if (forceRelease) {
    return (
      <ForceUpdateScreen
        version={forceRelease.version}
        apkUrl={forceRelease.apkUrl}
        apkSize={forceRelease.apkSize}
        releaseNotes={forceRelease.releaseNotes}
      />
    )
  }

  return (
    <>
      {currentPage === 'landing'           && <LandingPage />}
      {currentPage === 'login'             && <LoginPage />}
      {currentPage === 'register'          && <RegisterPage />}
      {currentPage === 'verify-email'      && <VerifyEmailPage />}
      {currentPage === 'forgot-password'   && <ForgotPasswordPage />}
      {currentPage === 'complete-profile'  && <CompleteProfilePage />}
      {DASHBOARD_PAGES.includes(currentPage) && (
        <DashboardLayout>
          <PageContent />
        </DashboardLayout>
      )}
      <Toast />
    </>
  )
}
