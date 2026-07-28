'use client'
import { useAppStore } from '@/store/useAppStore'
import Toast from './ui/Toast'
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

const DASHBOARD_PAGES = [
  'home', 'tournaments', 'tournament-detail', 'scrims',
  'teams', 'team-detail', 'my-team', 'wallet', 'news',
  'news-detail', 'notifications', 'settings',
  'admin', 'admin-users', 'admin-teams', 'admin-tournaments',
  'admin-scrims', 'admin-news', 'admin-withdrawals', 'admin-recharge',
  'admin-settings', 'admin-app',
]

function PageContent() {
  const { currentPage } = useAppStore()

  switch (currentPage) {
    case 'home': return <HomePage />
    case 'tournaments': return <TournamentsPage />
    case 'tournament-detail': return <TournamentDetailPage />
    case 'scrims': return <ScrimsPage />
    case 'teams': return <TeamsPage />
    case 'my-team': return <MyTeamPage />
    case 'wallet': return <WalletPage />
    case 'news': return <NewsPage />
    case 'notifications': return <NotificationsPage />
    case 'admin': return <AdminPage />
    case 'admin-users': return <AdminUsersPage />
    case 'admin-teams': return <AdminTeamsPage />
    case 'admin-tournaments': return <AdminTournamentsPage />
    case 'admin-scrims': return <AdminScrimsPage />
    case 'admin-news': return <AdminNewsPage />
    case 'admin-withdrawals': return <AdminWithdrawalsPage />
    case 'admin-recharge': return <AdminRechargePage />
    case 'admin-settings': return <AdminSettingsPage />
    case 'admin-app': return <AdminAppPage />
    default: return <HomePage />
  }
}

export default function App() {
  const { currentPage } = useAppStore()

  return (
    <>
      {currentPage === 'landing' && <LandingPage />}
      {currentPage === 'login' && <LoginPage />}
      {currentPage === 'register' && <RegisterPage />}
      {currentPage === 'verify-email' && <VerifyEmailPage />}
      {currentPage === 'forgot-password' && <ForgotPasswordPage />}
      {currentPage === 'complete-profile' && <CompleteProfilePage />}
      {DASHBOARD_PAGES.includes(currentPage) && (
        <DashboardLayout>
          <PageContent />
        </DashboardLayout>
      )}
      <Toast />
    </>
  )
}
