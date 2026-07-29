'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
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
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import TeamWalletHistoryPage from './pages/TeamWalletHistoryPage'
import PlayerProfilePage from './pages/PlayerProfilePage'
import TeamProfilePage from './pages/TeamProfilePage'
import LeaderboardPage from './pages/LeaderboardPage'
import SeasonPage from './pages/SeasonPage'
import AchievementsPage from './pages/AchievementsPage'
import TeamChatPage from './pages/TeamChatPage'
import AdminSeasonsPage from './pages/admin/AdminSeasonsPage'

// ── Semver comparison ─────────────────────────────────────────────────────────
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
  'team-wallet-history', 'player-profile', 'team-profile',
  'leaderboard', 'seasons', 'achievements', 'team-chat',
  'admin', 'admin-users', 'admin-teams', 'admin-tournaments',
  'admin-scrims', 'admin-news', 'admin-withdrawals', 'admin-recharge',
  'admin-settings', 'admin-app', 'admin-analytics', 'admin-seasons',
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
    case 'player-profile':     return <PlayerProfilePage />
    case 'team-profile':       return <TeamProfilePage />
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
    case 'admin-analytics':    return <AdminAnalyticsPage />
    case 'leaderboard':        return <LeaderboardPage />
    case 'seasons':            return <SeasonPage />
    case 'achievements':       return <AchievementsPage />
    case 'team-chat':          return <TeamChatPage />
    case 'admin-seasons':      return <AdminSeasonsPage />
    default:                   return <HomePage />
  }
}

// ── FCM token registration via Capacitor PushNotifications ───────────────────
function useFcmRegistration(token: string | null) {
  useEffect(() => {
    if (!token || typeof window === 'undefined') return

    // Dynamically import Capacitor modules — avoids SSR errors
    const register = async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')
        const { Capacitor }         = await import('@capacitor/core')

        if (!Capacitor.isNativePlatform()) return

        const permStatus = await PushNotifications.checkPermissions()
        if (permStatus.receive === 'prompt') {
          await PushNotifications.requestPermissions()
        }
        if (permStatus.receive !== 'granted') return

        await PushNotifications.register()

        PushNotifications.addListener('registration', ({ value: fcmToken }) => {
          apiCall('/fcm', {
            method: 'POST',
            body: JSON.stringify({ token: fcmToken, platform: 'android' }),
          }, token).catch(() => {})
        })

        PushNotifications.addListener('registrationError', (_err) => {
          // Silently ignore — in-app notifications still work
        })
      } catch {
        // Not a Capacitor environment or module not available
      }
    }

    register()
  }, [token])
}

export default function App() {
  const { currentPage, user, token } = useAppStore()
  const [forceRelease, setForceRelease] = useState<AppRelease | null>(null)

  // Register FCM token
  useFcmRegistration(token)

  // Check for force update on mount and whenever user changes
  useEffect(() => {
    const check = async () => {
      if (user && ['admin', 'superadmin', 'assistant'].includes(user.role)) {
        setForceRelease(null)
        return
      }
      try {
        const res  = await fetch('/api/app-release')
        const json = await res.json()
        const rel  = json?.data?.release as AppRelease | null
        if (!rel || !rel.forceUpdate) { setForceRelease(null); return }

        const installedVersion = localStorage.getItem('app_version') || '0.0.0'
        if (isOlderVersion(installedVersion, rel.version)) {
          setForceRelease(rel)
        } else {
          setForceRelease(null)
        }
      } catch {
        setForceRelease(null)
      }
    }
    check()
  }, [user])

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
