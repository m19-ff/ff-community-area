'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { ArrowLeft, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { PageLoader } from '../ui/LoadingSpinner'

type TxRow = {
  id: number
  teamId: number
  userId: number | null
  userName: string | null
  type: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  description: string | null
  createdAt: string
}

const TYPE_LABELS: Record<string, string> = {
  earn_tournament:  'Tournament Prize',
  earn_manual:      'Manual Credit',
  deduct_tournament:'Tournament Fee',
  deduct_manual:    'Manual Deduct',
  admin_award:      'Admin Award',
  admin_deduct:     'Admin Deduct',
  team_split:       'Member Split',
  withdraw:         'Withdrawal',
}

function isCredit(type: string, amount: number) {
  return amount > 0
}

export default function TeamWalletHistoryPage() {
  const { token, myTeam, navigate } = useAppStore()
  const [rows, setRows]       = useState<TxRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage]       = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const load = async (p = 1) => {
    setLoading(true)
    const res = await apiCall(`/teams/wallet-history?page=${p}`, {}, token)
    if (res.success && res.data) {
      const d = res.data as { history: TxRow[]; pagination: { page: number; limit: number } }
      if (p === 1) setRows(d.history || [])
      else setRows(prev => [...prev, ...(d.history || [])])
      setHasMore((d.history?.length || 0) >= 30)
    }
    setLoading(false)
  }

  useEffect(() => { load(1) }, [token])

  if (loading && page === 1) return <PageLoader />

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '5rem' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('my-team')} className="btn btn-ghost btn-icon btn-sm">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-heading flex items-center gap-2">
            <Wallet size={20} style={{ color: '#8b5cf6' }} />
            Team Wallet History
          </h2>
          {myTeam && (
            <p className="text-small mt-0.5" style={{ color: 'var(--text-muted)' }}>{myTeam.name}</p>
          )}
        </div>
      </div>

      {rows.length === 0 && !loading && (
        <div className="text-center py-20">
          <Wallet size={48} style={{ margin: '0 auto 12px', color: 'var(--text-muted)', opacity: 0.4 }} />
          <p style={{ color: 'var(--text-muted)' }}>No team wallet transactions yet</p>
        </div>
      )}

      <div className="card overflow-hidden">
        {rows.map((tx, i) => {
          const credit = isCredit(tx.type, tx.amount)
          const color  = credit ? '#22c55e' : '#ef4444'
          const Icon   = credit ? TrendingUp : TrendingDown
          return (
            <div
              key={tx.id}
              className="flex items-center gap-3 p-4"
              style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}
            >
              <div
                className="flex items-center justify-center rounded-lg shrink-0"
                style={{ width: 36, height: 36, background: `${color}18` }}
              >
                <Icon size={16} style={{ color }} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-small">
                    {TYPE_LABELS[tx.type] ?? tx.type}
                  </span>
                  {tx.userName && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa' }}
                    >
                      {tx.userName}
                    </span>
                  )}
                </div>
                {tx.description && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)', maxWidth: '28ch' }}>
                    {tx.description}
                  </p>
                )}
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {new Date(tx.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="text-right shrink-0">
                <div className="font-bold" style={{ color }}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} pts
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  → {tx.balanceAfter.toLocaleString()}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => { const next = page + 1; setPage(next); load(next) }}
          disabled={loading}
          className="btn btn-secondary w-full mt-4"
        >
          {loading ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  )
}
