'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Plus, Edit2, Check, X, PlayCircle, Trophy, Calendar, Gift } from 'lucide-react'
import { PageLoader } from '../../ui/LoadingSpinner'
import Modal from '../../ui/Modal'

type Season = {
  id: number; name: string; startDate: string; endDate: string
  isActive: boolean; isFinished: boolean
  rewards?: Array<{ rank: number; prize: number; badge: string }>
}

type SeasonForm = {
  name: string; startDate: string; endDate: string
  rewards: Array<{ rank: number; prize: number; badge: string }>
}

const emptyForm = (): SeasonForm => ({
  name: '', startDate: '', endDate: '',
  rewards: [
    { rank: 1, prize: 5000, badge: 'Season Champion' },
    { rank: 2, prize: 3000, badge: 'Season Runner-Up' },
    { rank: 3, prize: 1500, badge: 'Season Bronze' },
  ],
})

export default function AdminSeasonsPage() {
  const { token, showToast } = useAppStore()
  const [seasons,  setSeasons]  = useState<Season[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing,  setEditing]  = useState<Season | null>(null)
  const [form,     setForm]     = useState<SeasonForm>(emptyForm())
  const [saving,   setSaving]   = useState(false)

  const load = async () => {
    const res = await apiCall('/seasons', {}, token)
    if (res.success && res.data) {
      const d = res.data as { seasons: Season[] }
      setSeasons(d.seasons || [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [token])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setShowModal(true)
  }

  const openEdit = (s: Season) => {
    setEditing(s)
    setForm({
      name: s.name,
      startDate: s.startDate ? s.startDate.slice(0, 10) : '',
      endDate:   s.endDate   ? s.endDate.slice(0, 10)   : '',
      rewards:   s.rewards || [],
    })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.name || !form.startDate || !form.endDate) {
      showToast('Name and dates are required', 'error'); return
    }
    setSaving(true)
    const body = {
      name:      form.name,
      startDate: form.startDate,
      endDate:   form.endDate,
      rewards:   form.rewards,
    }
    let res
    if (editing) {
      res = await apiCall('/seasons', { method: 'PATCH', body: JSON.stringify({ id: editing.id, ...body }) }, token)
    } else {
      res = await apiCall('/seasons', { method: 'POST', body: JSON.stringify(body) }, token)
    }
    setSaving(false)
    if (res.success) {
      showToast(editing ? 'Season updated' : 'Season created')
      setShowModal(false)
      load()
    } else {
      showToast(res.message || 'Failed to save', 'error')
    }
  }

  const activate = async (id: number) => {
    const res = await apiCall('/seasons', { method: 'PATCH', body: JSON.stringify({ id, isActive: true }) }, token)
    if (res.success) { showToast('Season activated'); load() }
    else showToast(res.message || 'Failed', 'error')
  }

  const finish = async (id: number) => {
    const res = await apiCall('/seasons', { method: 'PATCH', body: JSON.stringify({ id, isFinished: true, isActive: false }) }, token)
    if (res.success) { showToast('Season finished'); load() }
    else showToast(res.message || 'Failed', 'error')
  }

  const updateReward = (idx: number, field: keyof SeasonForm['rewards'][0], value: string | number) => {
    setForm(f => {
      const rewards = [...f.rewards]
      rewards[idx] = { ...rewards[idx], [field]: value }
      return { ...f, rewards }
    })
  }

  const addReward = () => {
    setForm(f => ({ ...f, rewards: [...f.rewards, { rank: f.rewards.length + 1, prize: 0, badge: '' }] }))
  }

  const removeReward = (idx: number) => {
    setForm(f => ({ ...f, rewards: f.rewards.filter((_, i) => i !== idx) }))
  }

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '5rem', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black mb-1 flex items-center gap-2">
            <Calendar size={22} style={{ color: 'var(--accent-red)' }} />
            Manage Seasons
          </h1>
          <p className="text-small" style={{ color: 'var(--text-muted)' }}>
            Create and manage competitive seasons
          </p>
        </div>
        <button onClick={openCreate} className="btn btn-primary">
          <Plus size={16} /> New Season
        </button>
      </div>

      {/* Active season banner */}
      {seasons.filter(s => s.isActive).map(s => (
        <div
          key={s.id}
          className="rounded-2xl p-4 mb-5 flex items-center gap-4"
          style={{ background: 'rgba(227,28,28,0.08)', border: '1px solid rgba(227,28,28,0.25)' }}
        >
          <Trophy size={20} style={{ color: 'var(--accent-red)' }} />
          <div className="flex-1">
            <div className="font-bold">{s.name}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {new Date(s.startDate).toLocaleDateString()} – {new Date(s.endDate).toLocaleDateString()}
            </div>
          </div>
          <span className="badge badge-red">ACTIVE</span>
          <button onClick={() => openEdit(s)} className="btn btn-secondary btn-sm">
            <Edit2 size={14} /> Edit
          </button>
          <button
            onClick={() => finish(s.id)}
            className="btn btn-sm"
            style={{ background: 'rgba(107,114,128,0.15)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.25)' }}
          >
            End Season
          </button>
        </div>
      ))}

      {/* Seasons table */}
      <div className="card overflow-hidden">
        {seasons.length === 0 ? (
          <div className="p-10 text-center" style={{ color: 'var(--text-muted)' }}>
            No seasons yet. Create the first season!
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                {['Season', 'Status', 'Start', 'End', 'Rewards', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {seasons.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-3 font-semibold text-sm">{s.name}</td>
                  <td className="px-4 py-3">
                    {s.isActive
                      ? <span className="badge badge-red text-xs">Active</span>
                      : s.isFinished
                        ? <span className="badge text-xs" style={{ background: 'rgba(107,114,128,0.15)', color: '#9ca3af' }}>Finished</span>
                        : <span className="badge text-xs" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>Upcoming</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {new Date(s.startDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {new Date(s.endDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {(s.rewards || []).length} tiers
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(s)} className="btn btn-ghost btn-icon" title="Edit">
                        <Edit2 size={14} />
                      </button>
                      {!s.isActive && !s.isFinished && (
                        <button
                          onClick={() => activate(s.id)}
                          className="btn btn-ghost btn-icon"
                          title="Activate"
                          style={{ color: '#22c55e' }}
                        >
                          <PlayCircle size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <Modal
          title={editing ? `Edit: ${editing.name}` : 'New Season'}
          onClose={() => setShowModal(false)}
          width="520px"
        >
          <div className="flex flex-col gap-4">
            <div className="form-group">
              <label className="label">Season Name</label>
              <input
                className="input"
                placeholder="e.g. Season 1 — Spring 2025"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Start Date</label>
                <input
                  type="date"
                  className="input"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="label">End Date</label>
                <input
                  type="date"
                  className="input"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>

            {/* Rewards */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label flex items-center gap-2 mb-0">
                  <Gift size={14} style={{ color: '#f59e0b' }} /> Rewards
                </label>
                <button onClick={addReward} className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
                  <Plus size={12} /> Add Tier
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {form.rewards.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
                    >
                      #{r.rank}
                    </div>
                    <input
                      className="input flex-1"
                      placeholder="Badge name"
                      value={r.badge}
                      onChange={e => updateReward(idx, 'badge', e.target.value)}
                    />
                    <input
                      type="number"
                      className="input w-24"
                      placeholder="Points"
                      value={r.prize}
                      onChange={e => updateReward(idx, 'prize', parseInt(e.target.value) || 0)}
                    />
                    <button
                      onClick={() => removeReward(idx)}
                      className="btn btn-ghost btn-icon shrink-0"
                      style={{ color: '#ef4444' }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={save} disabled={saving} className="btn btn-primary flex-1">
                {saving ? 'Saving…' : <><Check size={14} /> {editing ? 'Update Season' : 'Create Season'}</>}
              </button>
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
