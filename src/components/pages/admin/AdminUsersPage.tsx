'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Search, Ban, CheckCircle, Zap, Minus, UserCog } from 'lucide-react'
import { PageLoader } from '../../ui/LoadingSpinner'
import Avatar from '../../ui/Avatar'
import Modal from '../../ui/Modal'

type User = {
  id: number; email: string; role: string; gameName: string; gameUid: string;
  profilePicture: string | null; firstName: string; lastName: string;
  isBanned: boolean; emailVerified: boolean; createdAt: string; lastLoginAt: string;
}

export default function AdminUsersPage() {
  const { token, showToast } = useAppStore()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionModal, setActionModal] = useState<{ user: User; action: string } | null>(null)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const load = async (p = 1) => {
    setLoading(true)
    const res = await apiCall(`/admin/users?page=${p}&search=${search}`, {}, token)
    if (res.success && res.data) {
      const d = res.data as { users: User[]; pagination: { total: number } }
      setUsers(d.users || [])
      setTotal(d.pagination?.total || 0)
    }
    setLoading(false)
  }

  useEffect(() => { load(1) }, [search])

  const performAction = async () => {
    if (!actionModal) return
    const body: Record<string, unknown> = { action: actionModal.action, reason }
    if (['award_points', 'deduct_points'].includes(actionModal.action)) {
      if (!amount || parseInt(amount) <= 0) { showToast('Enter valid amount', 'error'); return }
      body.points = parseInt(amount)
    }

    setSubmitting(true)
    const res = await apiCall(`/admin/users/${actionModal.user.id}`, { method: 'PATCH', body: JSON.stringify(body) }, token)
    setSubmitting(false)

    if (res.success) {
      showToast((res.message || 'Action performed') as string)
      setActionModal(null)
      setAmount('')
      setReason('')
      load(page)
    } else {
      showToast(res.message || 'Failed', 'error')
    }
  }

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '2rem' }}>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1" style={{ minWidth: 200, maxWidth: 320 }}>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="Search by game name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <span className="text-small" style={{ color: 'var(--text-muted)' }}>{total} users total</span>
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Player</th>
              <th className="hidden md:table-cell">Email</th>
              <th className="hidden sm:table-cell">Role</th>
              <th className="hidden md:table-cell">Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <Avatar src={user.profilePicture} name={user.gameName || user.email} size={32} />
                    <div>
                      <div className="font-medium text-small">{user.gameName || 'No Game Name'}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>UID: {user.gameUid || '—'}</div>
                    </div>
                  </div>
                </td>
                <td className="hidden md:table-cell text-small">{user.email}</td>
                <td className="hidden sm:table-cell">
                  <span className={`badge ${user.role === 'admin' || user.role === 'superadmin' ? 'badge-red' : user.role === 'captain' ? 'badge-yellow' : 'badge-gray'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="hidden md:table-cell">
                  {user.isBanned
                    ? <span className="badge badge-red">Banned</span>
                    : <span className="badge badge-green">Active</span>}
                </td>
                <td>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setActionModal({ user, action: 'award_points' })}
                      className="btn btn-success btn-icon btn-sm tooltip"
                      data-tip="Award Points"
                    >
                      <Zap size={13} />
                    </button>
                    <button
                      onClick={() => setActionModal({ user, action: 'deduct_points' })}
                      className="btn btn-danger btn-icon btn-sm tooltip"
                      data-tip="Deduct Points"
                    >
                      <Minus size={13} />
                    </button>
                    <button
                      onClick={() => setActionModal({ user, action: user.isBanned ? 'unban' : 'ban' })}
                      className={`btn btn-icon btn-sm tooltip ${user.isBanned ? 'btn-success' : 'btn-danger'}`}
                      data-tip={user.isBanned ? 'Unban' : 'Ban'}
                    >
                      {user.isBanned ? <CheckCircle size={13} /> : <Ban size={13} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {actionModal && (
        <Modal
          title={`${actionModal.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} — ${actionModal.user.gameName || actionModal.user.email}`}
          onClose={() => setActionModal(null)}
        >
          {['award_points', 'deduct_points'].includes(actionModal.action) && (
            <div className="form-group">
              <label className="label">Points Amount</label>
              <input className="input" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 500" min={1} />
            </div>
          )}
          <div className="form-group">
            <label className="label">Reason</label>
            <input className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="Optional reason..." />
          </div>
          <div className="flex gap-3">
            <button onClick={performAction} disabled={submitting} className="btn btn-primary flex-1">
              {submitting ? 'Processing...' : 'Confirm'}
            </button>
            <button onClick={() => setActionModal(null)} className="btn btn-secondary">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
