'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Plus, Edit, Trash2, Eye } from 'lucide-react'
import { PageLoader } from '../../ui/LoadingSpinner'
import Modal from '../../ui/Modal'

type Tournament = { id: number; name: string; type: string; status: string; registrationCost: number; prizePool: number; maxTeams: number; startDate: string | null; teamsRegistered: number }

const EMPTY_FORM = {
  name: '', type: 'battle_royale', registrationCost: 0, prizePool: 0,
  description: '', rules: '', maxTeams: 16,
  registrationDeadline: '', startDate: '', endDate: '', status: 'draft',
}

export default function AdminTournamentsPage() {
  const { token, showToast } = useAppStore()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editing, setEditing] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    setLoading(true)
    apiCall('/tournaments?limit=50', {}, token).then(res => {
      if (res.success && res.data) setTournaments((res.data as { tournaments: Tournament[] }).tournaments || [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setForm(EMPTY_FORM); setEditing(null); setShowModal(true) }

  const submit = async () => {
    if (!form.name.trim()) { showToast('Name required', 'error'); return }
    setSubmitting(true)
    const body = { ...form, registrationCost: Number(form.registrationCost), prizePool: Number(form.prizePool), maxTeams: Number(form.maxTeams) }
    const res = editing
      ? await apiCall(`/tournaments/${editing}`, { method: 'PATCH', body: JSON.stringify(body) }, token)
      : await apiCall('/tournaments', { method: 'POST', body: JSON.stringify(body) }, token)
    setSubmitting(false)
    if (res.success) {
      showToast(editing ? 'Tournament updated!' : 'Tournament created!')
      setShowModal(false)
      load()
    } else {
      showToast(res.message || 'Failed', 'error')
    }
  }

  const deleteTournament = async (id: number) => {
    if (!confirm('Delete this tournament?')) return
    const res = await apiCall(`/tournaments/${id}`, { method: 'DELETE' }, token)
    if (res.success) { showToast('Deleted'); load() }
    else showToast(res.message || 'Failed', 'error')
  }

  const statusColor: Record<string, string> = { draft: '#8b5cf6', published: '#22c55e', closed: '#f59e0b', finished: '#6b7280' }

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '2rem' }}>
      <div className="flex justify-end mb-6">
        <button onClick={openCreate} className="btn btn-primary">
          <Plus size={16} /> Create Tournament
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th className="hidden md:table-cell">Teams</th>
              <th className="hidden md:table-cell">Prize</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tournaments.map(t => (
              <tr key={t.id}>
                <td className="font-medium text-small">{t.name}</td>
                <td>
                  <span className="badge badge-blue">{t.type === 'battle_royale' ? 'BR' : 'CS'}</span>
                </td>
                <td>
                  <span className="badge" style={{ background: `${statusColor[t.status]}18`, color: statusColor[t.status], border: `1px solid ${statusColor[t.status]}30` }}>
                    {t.status}
                  </span>
                </td>
                <td className="hidden md:table-cell text-small">{t.teamsRegistered}/{t.maxTeams}</td>
                <td className="hidden md:table-cell text-small">{t.prizePool.toLocaleString()} pts</td>
                <td>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setForm({ name: t.name, type: t.type, registrationCost: t.registrationCost, prizePool: t.prizePool, description: '', rules: '', maxTeams: t.maxTeams, registrationDeadline: '', startDate: t.startDate || '', endDate: '', status: t.status })
                        setEditing(t.id)
                        setShowModal(true)
                      }}
                      className="btn btn-secondary btn-icon btn-sm"
                    >
                      <Edit size={13} />
                    </button>
                    <button onClick={() => deleteTournament(t.id)} className="btn btn-danger btn-icon btn-sm">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title={editing ? 'Edit Tournament' : 'Create Tournament'} onClose={() => setShowModal(false)} width="600px">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 form-group">
              <label className="label">Tournament Name</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Tournament name" />
            </div>
            <div className="form-group">
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="battle_royale">Battle Royale</option>
                <option value="clash_squad">Clash Squad</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="closed">Closed</option>
                <option value="finished">Finished</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Registration Cost (pts)</label>
              <input className="input" type="number" value={form.registrationCost} onChange={e => setForm(f => ({ ...f, registrationCost: parseInt(e.target.value) || 0 }))} min={0} />
            </div>
            <div className="form-group">
              <label className="label">Prize Pool (pts)</label>
              <input className="input" type="number" value={form.prizePool} onChange={e => setForm(f => ({ ...f, prizePool: parseInt(e.target.value) || 0 }))} min={0} />
            </div>
            <div className="form-group">
              <label className="label">Max Teams</label>
              <input className="input" type="number" value={form.maxTeams} onChange={e => setForm(f => ({ ...f, maxTeams: parseInt(e.target.value) || 16 }))} min={2} />
            </div>
            <div className="form-group">
              <label className="label">Start Date</label>
              <input className="input" type="datetime-local" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className="col-span-2 form-group">
              <label className="label">Registration Deadline</label>
              <input className="input" type="datetime-local" value={form.registrationDeadline} onChange={e => setForm(f => ({ ...f, registrationDeadline: e.target.value }))} />
            </div>
            <div className="col-span-2 form-group">
              <label className="label">Description</label>
              <textarea className="input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'vertical' }} />
            </div>
            <div className="col-span-2 form-group">
              <label className="label">Rules</label>
              <textarea className="input" rows={3} value={form.rules} onChange={e => setForm(f => ({ ...f, rules: e.target.value }))} style={{ resize: 'vertical' }} />
            </div>
          </div>
          <div className="flex gap-3 mt-2">
            <button onClick={submit} disabled={submitting} className="btn btn-primary flex-1">
              {submitting ? 'Saving...' : editing ? 'Save Changes' : 'Create Tournament'}
            </button>
            <button onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
