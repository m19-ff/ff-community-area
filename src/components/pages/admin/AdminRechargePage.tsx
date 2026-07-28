'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { CheckCircle, XCircle } from 'lucide-react'
import { PageLoader } from '../../ui/LoadingSpinner'
import Modal from '../../ui/Modal'

type RechargeReq = { id: number; userId: number; amountPoints: number; amountUsd: string; paymentProof: string | null; status: string; createdAt: string }

export default function AdminRechargePage() {
  const { token, showToast } = useAppStore()
  const [requests, setRequests] = useState<RechargeReq[]>([])
  const [loading, setLoading] = useState(true)
  const [actionModal, setActionModal] = useState<{ req: RechargeReq; action: string } | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    setLoading(true)
    apiCall('/recharge?limit=50', {}, token).then(res => {
      if (res.success && res.data) setRequests((res.data as { requests: RechargeReq[] }).requests || [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const processAction = async () => {
    if (!actionModal) return
    setSubmitting(true)
    const res = await apiCall(`/recharge/${actionModal.req.id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ action: actionModal.action, adminNote: note }),
    }, token)
    setSubmitting(false)
    if (res.success) {
      showToast(`Recharge ${actionModal.action}d`)
      setActionModal(null)
      setNote('')
      load()
    } else {
      showToast(res.message || 'Failed', 'error')
    }
  }

  const statusColor: Record<string, string> = { pending: '#f59e0b', approved: '#22c55e', rejected: '#ef4444' }

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '2rem' }}>
      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Amount</th>
              <th>USD</th>
              <th>Status</th>
              <th className="hidden md:table-cell">Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(req => (
              <tr key={req.id}>
                <td className="text-small">#{req.userId}</td>
                <td>
                  <span className="font-bold" style={{ color: '#22c55e' }}>{req.amountPoints.toLocaleString()} pts</span>
                </td>
                <td className="text-small">${req.amountUsd}</td>
                <td>
                  <span className="badge" style={{ background: `${statusColor[req.status]}15`, color: statusColor[req.status], border: `1px solid ${statusColor[req.status]}30` }}>
                    {req.status}
                  </span>
                </td>
                <td className="hidden md:table-cell text-small">{new Date(req.createdAt).toLocaleDateString()}</td>
                <td>
                  {req.status === 'pending' && (
                    <div className="flex gap-1">
                      <button onClick={() => setActionModal({ req, action: 'approve' })} className="btn btn-success btn-sm btn-icon tooltip" data-tip="Approve">
                        <CheckCircle size={13} />
                      </button>
                      <button onClick={() => setActionModal({ req, action: 'reject' })} className="btn btn-danger btn-sm btn-icon tooltip" data-tip="Reject">
                        <XCircle size={13} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No recharge requests</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {actionModal && (
        <Modal
          title={`${actionModal.action === 'approve' ? 'Approve' : 'Reject'} Recharge — ${actionModal.req.amountPoints.toLocaleString()} pts`}
          onClose={() => setActionModal(null)}
        >
          <div className="form-group">
            <label className="label">Admin Note (optional)</label>
            <textarea className="input" rows={3} value={note} onChange={e => setNote(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
          <div className="flex gap-3">
            <button onClick={processAction} disabled={submitting} className={`btn flex-1 ${actionModal.action === 'reject' ? 'btn-danger' : 'btn-success'}`}>
              {submitting ? 'Processing...' : `Confirm ${actionModal.action}`}
            </button>
            <button onClick={() => setActionModal(null)} className="btn btn-secondary">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
