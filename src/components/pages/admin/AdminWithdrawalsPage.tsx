'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { CheckCircle, XCircle, DollarSign } from 'lucide-react'
import { PageLoader } from '../../ui/LoadingSpinner'
import Modal from '../../ui/Modal'

type WithdrawalReq = {
  id: number; teamId: number; captainId: number; amountUsd: string; amountPoints: number;
  method: string; paymentAddress: string; message: string; status: string; createdAt: string; adminNote: string | null;
}

export default function AdminWithdrawalsPage() {
  const { token, showToast } = useAppStore()
  const [requests, setRequests] = useState<WithdrawalReq[]>([])
  const [loading, setLoading] = useState(true)
  const [actionModal, setActionModal] = useState<{ req: WithdrawalReq; action: string } | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    setLoading(true)
    apiCall('/withdraw?limit=50', {}, token).then(res => {
      if (res.success && res.data) setRequests((res.data as { withdrawals: WithdrawalReq[] }).withdrawals || [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const processAction = async () => {
    if (!actionModal) return
    setSubmitting(true)
    const res = await apiCall(`/withdraw/${actionModal.req.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: actionModal.action, adminNote: note }),
    }, token)
    setSubmitting(false)
    if (res.success) {
      showToast(`Withdrawal ${actionModal.action}`)
      setActionModal(null)
      setNote('')
      load()
    } else {
      showToast(res.message || 'Failed', 'error')
    }
  }

  const statusColor: Record<string, string> = { pending: '#f59e0b', approved: '#3b82f6', rejected: '#ef4444', paid: '#22c55e' }
  const methodLabel: Record<string, string> = { paypal: 'PayPal', binance: 'Binance', baridimob: 'BaridiMob 🇩🇿' }

  if (loading) return <PageLoader />

  const pending = requests.filter(r => r.status === 'pending')
  const others = requests.filter(r => r.status !== 'pending')

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '2rem' }}>
      {pending.length > 0 && (
        <div
          className="rounded-xl p-4 mb-6 flex items-center gap-3"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <DollarSign size={20} style={{ color: '#f59e0b' }} />
          <span className="font-semibold" style={{ color: '#f59e0b' }}>{pending.length} pending withdrawal{pending.length !== 1 ? 's' : ''} awaiting review</span>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Amount</th>
              <th>Method</th>
              <th className="hidden md:table-cell">Address</th>
              <th>Status</th>
              <th className="hidden sm:table-cell">Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(req => (
              <tr key={req.id}>
                <td>
                  <div className="font-bold" style={{ color: '#22c55e' }}>${req.amountUsd}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{req.amountPoints.toLocaleString()} pts</div>
                </td>
                <td><span className="badge badge-blue">{methodLabel[req.method] || req.method}</span></td>
                <td className="hidden md:table-cell text-small" style={{ fontFamily: 'monospace' }}>{req.paymentAddress}</td>
                <td>
                  <span
                    className="badge"
                    style={{
                      background: `${statusColor[req.status]}15`,
                      color: statusColor[req.status],
                      border: `1px solid ${statusColor[req.status]}30`,
                    }}
                  >
                    {req.status}
                  </span>
                </td>
                <td className="hidden sm:table-cell text-small">{new Date(req.createdAt).toLocaleDateString()}</td>
                <td>
                  {req.status === 'pending' && (
                    <div className="flex gap-1">
                      <button onClick={() => setActionModal({ req, action: 'approved' })} className="btn btn-success btn-icon btn-sm tooltip" data-tip="Approve">
                        <CheckCircle size={13} />
                      </button>
                      <button onClick={() => setActionModal({ req, action: 'rejected' })} className="btn btn-danger btn-icon btn-sm tooltip" data-tip="Reject">
                        <XCircle size={13} />
                      </button>
                      <button onClick={() => setActionModal({ req, action: 'paid' })} className="btn btn-secondary btn-sm">
                        Mark Paid
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No withdrawal requests</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {actionModal && (
        <Modal
          title={`${actionModal.action.charAt(0).toUpperCase() + actionModal.action.slice(1)} Withdrawal — $${actionModal.req.amountUsd}`}
          onClose={() => setActionModal(null)}
        >
          <div className="card p-4 mb-4">
            <div className="text-small"><strong>Method:</strong> {methodLabel[actionModal.req.method] || actionModal.req.method}</div>
            <div className="text-small"><strong>Address:</strong> {actionModal.req.paymentAddress}</div>
            {actionModal.req.message && <div className="text-small"><strong>Note:</strong> {actionModal.req.message}</div>}
          </div>
          <div className="form-group">
            <label className="label">Admin Note (optional)</label>
            <textarea className="input" rows={3} value={note} onChange={e => setNote(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
          <div className="flex gap-3">
            <button onClick={processAction} disabled={submitting} className={`btn flex-1 ${actionModal.action === 'rejected' ? 'btn-danger' : 'btn-success'}`}>
              {submitting ? 'Processing...' : `Confirm ${actionModal.action}`}
            </button>
            <button onClick={() => setActionModal(null)} className="btn btn-secondary">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
