'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { PageLoader } from '../../ui/LoadingSpinner'
import Modal from '../../ui/Modal'

type Scrim = {
  id: number; name: string; scheduledAt: string; mode: string
  maxTeams: number; status: string; teamsRegistered: number
  roomId: string | null; roomPassword: string | null; roomRevealAt: string | null
}

const EMPTY_FORM = {
  name: '', scheduledAt: '', mode: 'Battle Royale', maxTeams: 16,
  status: 'upcoming', roomId: '', roomPassword: '', roomRevealAt: '',
}

const STATUS_OPTIONS = ['upcoming', 'live', 'finished', 'cancelled']
const STATUS_COLOR: Record<string, string> = {
  upcoming: '#22c55e', live: '#e11d48', finished: '#6b7280', cancelled: '#f59e0b',
}

export default function AdminScrimsPage() {
  const { token, showToast } = useAppStore()
  const [scrims, setScrims] = useState<Scrim[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    setLoading(true)
    apiCall('/scrims?limit=50', {}, token).then(res => {
      if (res.success && res.data) setScrims((res.data as { scrims: Scrim[] }).scrims || [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setEditing(null)
    setShowModal(true)
  }

  const openEdit = (s: Scrim) => {
    setForm({
      name: s.name,
      scheduledAt: s.scheduledAt ? new Date(s.scheduledAt).toISOString().slice(0, 16) : '',
      mode: s.mode,
      maxTeams: s.maxTeams,
      status: s.status,
      roomId: s.roomId || '',
      roomPassword: s.roomPassword || '',
      roomRevealAt: s.roomRevealAt ? new Date(s.roomRevealAt).toISOString().slice(0, 16) : '',
    })
    setEditing(s.id)
    setShowModal(true)
  }

  const submit = async () => {
    if (!form.name.trim() || !form.scheduledAt) { showToast('Name and date are required', 'error'); return }
    setSubmitting(true)
    const body = {
      ...form,
      maxTeams: Number(form.maxTeams),
      roomId: form.roomId || null,
      roomPassword: form.roomPassword || null,
      roomRevealAt: form.roomRevealAt || null,
    }
    const res = editing
      ? await apiCall(`/scrims/${editing}`, { method: 'PATCH', body: JSON.stringify(body) }, token)
      : await apiCall('/scrims', { method: 'POST', body: JSON.stringify(body) }, token)
    setSubmitting(false)
    if (res.success) {
      showToast(editing ? 'Scrim updated!' : 'Scrim created!')
      setShowModal(false)
      load()
    } else {
      showToast(res.message || 'Failed', 'error')
    }
  }

  const deleteScrim = async (id: number, name: string) => {
    if (!confirm(`Delete scrim "${name}"? All registrations will also be removed.`)) return
    const res = await apiCall(`/scrims/${id}`, { method: 'DELETE' }, token)
    if (res.success) { showToast('Scrim deleted'); load() }
    else showToast(res.message || 'Failed', 'error')
  }

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '2rem' }}>
      <div className="flex justify-end mb-6">
        <button onClick={openCreate} className="btn btn-primary">
          <Plus size={16} /> Create Scrim
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Date & Time</th>
              <th>Mode</th>
              <th>Teams</th>
              <th className="hidden md:table-cell">Room ID</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {scrims.map(s => (
              <tr key={s.id}>
                <td className="font-medium text-small">{s.name}</td>
                <td className="text-small">{new Date(s.scheduledAt).toLocaleString()}</td>
                <td><span className="badge badge-blue">{s.mode}</span></td>
                <td className="text-small">{s.teamsRegistered}/{s.maxTeams}</td>
                <td className="hidden md:table-cell text-small" style={{ fontFamily: 'monospace' }}>
                  {s.roomId || '—'}
                </td>
                <td>
                  <span
                    className="badge"
                    style={{
                      background: `${STATUS_COLOR[s.status]}18`,
                      color: STATUS_COLOR[s.status],
                      border: `1px solid ${STATUS_COLOR[s.status]}30`,
                    }}
                  >
                    {s.status}
                  </span>
                </td>
                <td>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(s)}
                      className="btn btn-secondary btn-icon btn-sm"
                      title="Edit"
                    >
                      <Edit size={13} />
                    </button>
                    <button
                      onClick={() => deleteScrim(s.id, s.name)}
                      className="btn btn-danger btn-icon btn-sm"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {scrims.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  No scrims yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal
          title={editing ? 'Edit Scrim' : 'Create Scrim'}
          onClose={() => setShowModal(false)}
          width="560px"
        >
          <div className="grid grid-cols-2 gap-3">
            {/* Name — full width */}
            <div className="col-span-2 form-group">
              <label className="label">Scrim Name *</label>
              <input
                className="input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Friday Night Scrim"
              />
            </div>

            {/* Date */}
            <div className="form-group">
              <label className="label">Date & Time *</label>
              <input
                className="input"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
              />
            </div>

            {/* Mode */}
            <div className="form-group">
              <label className="label">Game Mode</label>
              <input
                className="input"
                value={form.mode}
                onChange={e => setForm(f => ({ ...f, mode: e.target.value }))}
                placeholder="e.g. Battle Royale"
              />
            </div>

            {/* Max Teams */}
            <div className="form-group">
              <label className="label">Max Teams</label>
              <input
                className="input"
                type="number"
                value={form.maxTeams}
                onChange={e => setForm(f => ({ ...f, maxTeams: parseInt(e.target.value) || 16 }))}
                min={2}
                max={100}
              />
            </div>

            {/* Status */}
            <div className="form-group">
              <label className="label">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Room ID */}
            <div className="form-group">
              <label className="label">Room ID</label>
              <input
                className="input"
                value={form.roomId}
                onChange={e => setForm(f => ({ ...f, roomId: e.target.value }))}
                placeholder="In-game room ID"
              />
            </div>

            {/* Room Password */}
            <div className="form-group">
              <label className="label">Room Password</label>
              <input
                className="input"
                value={form.roomPassword}
                onChange={e => setForm(f => ({ ...f, roomPassword: e.target.value }))}
                placeholder="Room password"
              />
            </div>

            {/* Reveal time — full width */}
            <div className="col-span-2 form-group">
              <label className="label">Reveal Room Credentials At (optional)</label>
              <input
                className="input"
                type="datetime-local"
                value={form.roomRevealAt}
                onChange={e => setForm(f => ({ ...f, roomRevealAt: e.target.value }))}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                If set, room ID and password are hidden from players until this time.
              </p>
            </div>
          </div>

          <div className="flex gap-3 mt-2">
            <button onClick={submit} disabled={submitting} className="btn btn-primary flex-1">
              {submitting ? 'Saving...' : editing ? 'Save Changes' : 'Create Scrim'}
            </button>
            <button onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
