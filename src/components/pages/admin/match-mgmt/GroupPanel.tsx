'use client'
import { useState } from 'react'
import { apiCall } from '@/store/useAppStore'
import { UserPlus, UserMinus, Shuffle, Trash2 } from 'lucide-react'
import Avatar from '../../../ui/Avatar'
import Modal from '../../../ui/Modal'
import type { TournamentGroup, UnassignedTeam } from '../AdminTournamentMatchesPage'

interface Props {
  tournId: number
  groups: TournamentGroup[]
  unassigned: UnassignedTeam[]
  token: string | null
  onReload: () => void
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function GroupPanel({ tournId, groups, unassigned, token, onReload, showToast }: Props) {
  const [assignModal, setAssignModal] = useState<{
    team: UnassignedTeam | null
    currentGroupId: number | null
  } | null>(null)
  const [targetGroup, setTargetGroup] = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [autoModal,   setAutoModal]   = useState(false)
  const [autoLoading, setAutoLoading] = useState(false)

  const openAssign = (team: UnassignedTeam | null, currentGroupId: number | null = null) => {
    setAssignModal({ team, currentGroupId })
    setTargetGroup('')
  }

  const submitAssign = async () => {
    if (!assignModal?.team) return
    const gid = parseInt(targetGroup)
    if (isNaN(gid)) { showToast('Select a target group', 'error'); return }
    setSubmitting(true)
    const res = await apiCall(
      `/tournaments/${tournId}/groups`,
      { method: 'POST', body: JSON.stringify({ action: 'assign_team', groupId: gid, teamId: assignModal.team.teamId }) },
      token,
    )
    setSubmitting(false)
    if (res.success) { showToast('Team assigned'); setAssignModal(null); onReload() }
    else showToast(res.message || 'Failed', 'error')
  }

  const removeTeam = async (teamId: number) => {
    const res = await apiCall(
      `/tournaments/${tournId}/groups`,
      { method: 'POST', body: JSON.stringify({ action: 'remove_team', teamId }) },
      token,
    )
    if (res.success) { showToast('Team removed from group'); onReload() }
    else showToast(res.message || 'Failed', 'error')
  }

  const deleteGroup = async (groupId: number) => {
    if (!confirm('Delete this group? Teams become unassigned.')) return
    const res = await apiCall(
      `/tournaments/${tournId}/groups`,
      { method: 'POST', body: JSON.stringify({ action: 'delete_group', groupId }) },
      token,
    )
    if (res.success) { showToast('Group deleted'); onReload() }
    else showToast(res.message || 'Failed', 'error')
  }

  const autoAssignAll = async () => {
    setAutoLoading(true)
    const res = await apiCall(
      `/tournaments/${tournId}/groups`,
      { method: 'POST', body: JSON.stringify({ action: 'auto_assign' }) },
      token,
    )
    setAutoLoading(false)
    if (res.success) {
      const msg = res.data ? (res.data as { message?: string }).message || 'Done' : 'Done'
      showToast(msg)
      setAutoModal(false)
      onReload()
    } else {
      showToast(res.message || 'Failed', 'error')
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <p className="text-small" style={{ color: 'var(--text-muted)' }}>
          {unassigned.length} unassigned team{unassigned.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setAutoModal(true)}
          className="btn btn-secondary btn-sm flex items-center gap-1"
          disabled={groups.length === 0}
        >
          <Shuffle size={13} /> Re-Auto-Assign All
        </button>
      </div>

      {/* Groups grid */}
      {groups.length === 0 && (
        <div className="card p-6 text-center" style={{ color: 'var(--text-muted)' }}>
          No groups yet. Use "Setup Groups" above to create them.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {groups.map(g => (
          <div key={g.id} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-lg" style={{ color: 'var(--accent-red)' }}>Group {g.name}</span>
              <div className="flex gap-1">
                <span className="text-small" style={{ color: 'var(--text-muted)' }}>{g.teams.length} teams</span>
                <button
                  onClick={() => deleteGroup(g.id)}
                  className="btn btn-danger btn-icon btn-sm"
                  style={{ marginLeft: 6 }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {g.teams.map(t => (
                <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--bg-input)' }}>
                  <Avatar src={t.teamLogo} name={t.teamName || '?'} size={24} />
                  <span className="text-small flex-1">{t.teamName || `Team #${t.teamId}`}</span>
                  <button
                    onClick={() => openAssign({ teamId: t.teamId, teamName: t.teamName, teamLogo: t.teamLogo }, g.id)}
                    className="btn btn-secondary btn-icon btn-sm tooltip"
                    data-tip="Move to another group"
                  >
                    <UserPlus size={11} />
                  </button>
                  <button
                    onClick={() => removeTeam(t.teamId)}
                    className="btn btn-danger btn-icon btn-sm tooltip"
                    data-tip="Remove from group"
                  >
                    <UserMinus size={11} />
                  </button>
                </div>
              ))}
              {g.teams.length === 0 && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No teams in this group</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Unassigned teams */}
      {unassigned.length > 0 && (
        <div>
          <h3 className="text-heading mb-3" style={{ fontSize: '1rem' }}>
            Unassigned Teams ({unassigned.length})
          </h3>
          <div className="card overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {unassigned.map(t => (
                  <tr key={t.teamId}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Avatar src={t.teamLogo} name={t.teamName || '?'} size={28} />
                        <span className="text-small">{t.teamName || `Team #${t.teamId}`}</span>
                      </div>
                    </td>
                    <td>
                      <button
                        onClick={() => openAssign(t, null)}
                        className="btn btn-success btn-sm flex items-center gap-1"
                        disabled={groups.length === 0}
                      >
                        <UserPlus size={12} /> Assign Group
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assignModal && (
        <Modal
          title={assignModal.currentGroupId ? 'Move to Group' : 'Assign to Group'}
          onClose={() => setAssignModal(null)}
        >
          <div className="flex items-center gap-3 mb-4 p-3 rounded-lg" style={{ background: 'var(--bg-card-hover)' }}>
            <Avatar src={assignModal.team?.teamLogo} name={assignModal.team?.teamName || '?'} size={32} />
            <span className="font-medium">{assignModal.team?.teamName || `Team #${assignModal.team?.teamId}`}</span>
          </div>
          <div className="form-group">
            <label className="label">Target Group</label>
            <select className="input" value={targetGroup} onChange={e => setTargetGroup(e.target.value)}>
              <option value="">— Select group —</option>
              {groups
                .filter(g => g.id !== assignModal.currentGroupId)
                .map(g => (
                  <option key={g.id} value={g.id}>
                    Group {g.name} ({g.teams.length} teams)
                  </option>
                ))}
            </select>
          </div>
          <div className="flex gap-3 mt-2">
            <button onClick={submitAssign} disabled={submitting || !targetGroup} className="btn btn-primary flex-1">
              {submitting ? 'Assigning…' : 'Confirm'}
            </button>
            <button onClick={() => setAssignModal(null)} className="btn btn-secondary">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Auto-assign confirm */}
      {autoModal && (
        <Modal title="Re-Auto-Assign All Teams" onClose={() => setAutoModal(false)}>
          <p className="text-body mb-4">
            This will <strong>remove all current group assignments</strong> and redistribute all registered teams
            evenly across the {groups.length} groups.
          </p>
          <div className="flex gap-3">
            <button onClick={autoAssignAll} disabled={autoLoading} className="btn btn-primary flex-1">
              {autoLoading ? 'Assigning…' : 'Confirm Auto-Assign'}
            </button>
            <button onClick={() => setAutoModal(false)} className="btn btn-secondary">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
