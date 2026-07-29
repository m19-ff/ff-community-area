'use client'
import { useState } from 'react'
import { apiCall } from '@/store/useAppStore'
import Modal from '../../../ui/Modal'
import type { TournamentGroup, TournamentMatch } from '../AdminTournamentMatchesPage'

interface Props {
  tournId: number
  groups: TournamentGroup[]
  editing: TournamentMatch | null
  token: string | null
  onClose: () => void
  onSaved: () => void
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const EMPTY_FORM = {
  name: '',
  groupId: '',
  roomId: '',
  roomPassword: '',
  matchStartTime: '',
  roomRevealAt: '',
  status: 'upcoming',
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  // Truncate to 'YYYY-MM-DDTHH:MM'
  return iso.slice(0, 16)
}

export default function MatchFormModal({ tournId, groups, editing, token, onClose, onSaved, showToast }: Props) {
  const [form, setForm] = useState({
    name:           editing?.name           || '',
    groupId:        editing?.groupId        ? String(editing.groupId) : '',
    roomId:         editing?.roomId         || '',
    roomPassword:   editing?.roomPassword   || '',
    matchStartTime: toDatetimeLocal(editing?.matchStartTime),
    roomRevealAt:   toDatetimeLocal(editing?.roomRevealAt),
    status:         editing?.status         || 'upcoming',
  })
  const [submitting, setSubmitting] = useState(false)

  const f = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const submit = async () => {
    setSubmitting(true)
    const body = {
      name:           form.name || null,
      groupId:        form.groupId ? parseInt(form.groupId) : null,
      roomId:         form.roomId || null,
      roomPassword:   form.roomPassword || null,
      matchStartTime: form.matchStartTime || null,
      roomRevealAt:   form.roomRevealAt   || null,
      status:         form.status,
    }

    const res = editing
      ? await apiCall(`/tournaments/${tournId}/matches/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) }, token)
      : await apiCall(`/tournaments/${tournId}/matches`, { method: 'POST', body: JSON.stringify(body) }, token)

    setSubmitting(false)
    if (res.success) {
      showToast(editing ? 'Match updated' : 'Match created')
      onSaved()
      onClose()
    } else {
      showToast(res.message || 'Failed', 'error')
    }
  }

  return (
    <Modal title={editing ? 'Edit Match' : 'Create Match'} onClose={onClose} width="560px">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 form-group">
          <label className="label">Match Name (optional)</label>
          <input className="input" value={form.name} onChange={f('name')} placeholder="e.g. Group A — Round 1" />
        </div>

        <div className="form-group">
          <label className="label">Group</label>
          <select className="input" value={form.groupId} onChange={f('groupId')}>
            <option value="">— No group —</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>Group {g.name} ({g.teams.length} teams)</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={f('status')}>
            <option value="upcoming">Upcoming</option>
            <option value="room_revealed">Room Revealed</option>
            <option value="in_progress">In Progress</option>
            <option value="finished">Finished</option>
          </select>
        </div>

        <div className="form-group">
          <label className="label">Room ID</label>
          <input className="input" value={form.roomId} onChange={f('roomId')} placeholder="e.g. 123456" />
        </div>

        <div className="form-group">
          <label className="label">Room Password</label>
          <input className="input" value={form.roomPassword} onChange={f('roomPassword')} placeholder="e.g. abc123" />
        </div>

        <div className="form-group">
          <label className="label">Match Start Time</label>
          <input className="input" type="datetime-local" value={form.matchStartTime} onChange={f('matchStartTime')} />
        </div>

        <div className="form-group">
          <label className="label">Room Reveal Time</label>
          <input className="input" type="datetime-local" value={form.roomRevealAt} onChange={f('roomRevealAt')} />
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Room ID/Pass are automatically sent to the group at this time.
          </p>
        </div>
      </div>

      <div className="flex gap-3 mt-2">
        <button onClick={submit} disabled={submitting} className="btn btn-primary flex-1">
          {submitting ? 'Saving…' : editing ? 'Save Changes' : 'Create Match'}
        </button>
        <button onClick={onClose} className="btn btn-secondary">Cancel</button>
      </div>
    </Modal>
  )
}
