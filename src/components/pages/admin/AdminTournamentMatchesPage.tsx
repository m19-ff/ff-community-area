'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import {
  ArrowLeft, Plus, Edit2, Trash2, Send, Users,
  Clock, CheckCircle, AlertCircle, ChevronDown, ChevronUp,
  Shuffle, History,
} from 'lucide-react'
import { PageLoader } from '../../ui/LoadingSpinner'
import Modal from '../../ui/Modal'
import MatchFormModal from './match-mgmt/MatchFormModal'
import GroupPanel from './match-mgmt/GroupPanel'
import MatchRoomLogsPanel from './match-mgmt/MatchRoomLogsPanel'

export type TournamentGroup = {
  id: number
  name: string
  tournamentId: number
  teams: Array<{ id: number; groupId: number; teamId: number; teamName: string | null; teamLogo: string | null; assignedAt: string }>
}

export type UnassignedTeam = {
  teamId: number
  teamName: string | null
  teamLogo: string | null
}

export type TournamentMatch = {
  id: number
  tournamentId: number
  groupId: number | null
  groupName: string | null
  name: string | null
  roomId: string | null
  roomPassword: string | null
  matchStartTime: string | null
  roomRevealAt: string | null
  status: string
  roomNotifiedAt: string | null
  createdAt: string
}

type TabKey = 'matches' | 'groups' | 'logs'

export default function AdminTournamentMatchesPage() {
  const { token, pageParams, navigate, showToast } = useAppStore()
  const tournId   = pageParams.tournamentId as number
  const tournName = pageParams.tournamentName as string | undefined

  const [matches,    setMatches]    = useState<TournamentMatch[]>([])
  const [groups,     setGroups]     = useState<TournamentGroup[]>([])
  const [unassigned, setUnassigned] = useState<UnassignedTeam[]>([])
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState<TabKey>('matches')

  // Modals
  const [matchModal,  setMatchModal]  = useState<{ open: boolean; editing: TournamentMatch | null }>({ open: false, editing: null })
  const [deleteModal, setDeleteModal] = useState<TournamentMatch | null>(null)
  const [deleting,    setDeleting]    = useState(false)
  const [sending,     setSending]     = useState<number | null>(null)

  // Groups modal
  const [groupModal, setGroupModal] = useState(false)
  const [groupCount, setGroupCount] = useState('4')
  const [autoAssign, setAutoAssign] = useState(true)
  const [creatingGroups, setCreatingGroups] = useState(false)

  const loadAll = useCallback(async () => {
    if (!tournId) return
    setLoading(true)
    const [matchRes, groupRes] = await Promise.all([
      apiCall<{ matches: TournamentMatch[] }>(`/tournaments/${tournId}/matches`, {}, token),
      apiCall<{ groups: TournamentGroup[]; unassigned: UnassignedTeam[] }>(`/tournaments/${tournId}/groups`, {}, token),
    ])
    if (matchRes.success && matchRes.data) setMatches(matchRes.data.matches ?? [])
    if (groupRes.success && groupRes.data) {
      setGroups(groupRes.data.groups ?? [])
      setUnassigned(groupRes.data.unassigned ?? [])
    }
    setLoading(false)
  }, [tournId, token])

  useEffect(() => { loadAll() }, [loadAll])

  const handleDeleteMatch = async () => {
    if (!deleteModal) return
    setDeleting(true)
    const res = await apiCall(
      `/tournaments/${tournId}/matches/${deleteModal.id}`,
      { method: 'DELETE' },
      token,
    )
    setDeleting(false)
    if (res.success) { showToast('Match deleted'); setDeleteModal(null); loadAll() }
    else showToast(res.message || 'Failed', 'error')
  }

  const handleSendRoom = async (match: TournamentMatch) => {
    setSending(match.id)
    const res = await apiCall(
      `/tournaments/${tournId}/matches/${match.id}`,
      { method: 'PATCH', body: JSON.stringify({ action: 'send_room' }) },
      token,
    )
    setSending(null)
    if (res.success) { showToast(res.data ? (res.data as { message?: string }).message || 'Sent!' : 'Sent!'); loadAll() }
    else showToast(res.message || 'Failed', 'error')
  }

  const handleCreateGroups = async () => {
    const n = parseInt(groupCount)
    if (isNaN(n) || n < 1 || n > 26) { showToast('Enter 1–26', 'error'); return }
    setCreatingGroups(true)
    const res = await apiCall(
      `/tournaments/${tournId}/groups`,
      { method: 'POST', body: JSON.stringify({ action: 'create_groups', count: n, autoAssign }) },
      token,
    )
    setCreatingGroups(false)
    if (res.success) { showToast('Groups created'); setGroupModal(false); loadAll() }
    else showToast(res.message || 'Failed', 'error')
  }

  const statusBadge = (m: TournamentMatch) => {
    const map: Record<string, string> = {
      upcoming:       'badge-gray',
      room_revealed:  'badge-green',
      in_progress:    'badge-yellow',
      finished:       'badge-blue',
    }
    return (
      <span className={`badge ${map[m.status] || 'badge-gray'}`}>{m.status.replace('_', ' ')}</span>
    )
  }

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '3rem' }}>
      {/* Header */}
      <button
        onClick={() => navigate('admin-tournaments')}
        className="flex items-center gap-2 mb-4 text-small"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={15} /> Back to Tournaments
      </button>

      <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
        <div>
          <h2 className="text-heading">Match Management</h2>
          <p className="text-small mt-1" style={{ color: 'var(--text-muted)' }}>
            {tournName || `Tournament #${tournId}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setGroupModal(true)} className="btn btn-secondary btn-sm flex items-center gap-1">
            <Shuffle size={13} /> Setup Groups
          </button>
          <button
            onClick={() => setMatchModal({ open: true, editing: null })}
            className="btn btn-primary btn-sm flex items-center gap-1"
          >
            <Plus size={13} /> Create Match
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b" style={{ borderColor: 'var(--border)' }}>
        {([
          { key: 'matches', label: `Matches (${matches.length})` },
          { key: 'groups',  label: `Groups (${groups.length})` },
          { key: 'logs',    label: 'Room Logs' },
        ] as { key: TabKey; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="btn btn-ghost btn-sm"
            style={{
              borderBottom: tab === t.key ? '2px solid var(--accent-red)' : '2px solid transparent',
              borderRadius: 0,
              color: tab === t.key ? 'var(--accent-red)' : 'var(--text-secondary)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Matches Tab ── */}
      {tab === 'matches' && (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Match</th>
                <th>Group</th>
                <th className="hidden md:table-cell">Start Time</th>
                <th className="hidden md:table-cell">Reveal At</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {matches.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No matches yet — create one above
                  </td>
                </tr>
              )}
              {matches.map(m => (
                <tr key={m.id}>
                  <td>
                    <div>
                      <div className="font-medium text-small">{m.name || `Match #${m.id}`}</div>
                      {m.roomId && (
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Room: {m.roomId} {m.roomPassword ? `/ ${m.roomPassword}` : ''}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    {m.groupName
                      ? <span className="badge badge-blue">Group {m.groupName}</span>
                      : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                    }
                  </td>
                  <td className="hidden md:table-cell text-small" style={{ color: 'var(--text-muted)' }}>
                    {m.matchStartTime ? new Date(m.matchStartTime).toLocaleString() : '—'}
                  </td>
                  <td className="hidden md:table-cell text-small" style={{ color: 'var(--text-muted)' }}>
                    {m.roomRevealAt ? new Date(m.roomRevealAt).toLocaleString() : '—'}
                  </td>
                  <td>{statusBadge(m)}</td>
                  <td>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setMatchModal({ open: true, editing: m })}
                        className="btn btn-secondary btn-icon btn-sm tooltip"
                        data-tip="Edit"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleSendRoom(m)}
                        disabled={sending === m.id || !m.roomId || !m.groupId}
                        className="btn btn-success btn-icon btn-sm tooltip"
                        data-tip="Send Room Now"
                      >
                        {sending === m.id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Send size={12} />}
                      </button>
                      <button
                        onClick={() => setDeleteModal(m)}
                        className="btn btn-danger btn-icon btn-sm tooltip"
                        data-tip="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Groups Tab ── */}
      {tab === 'groups' && (
        <GroupPanel
          tournId={tournId}
          groups={groups}
          unassigned={unassigned}
          token={token}
          onReload={loadAll}
          showToast={showToast}
        />
      )}

      {/* ── Logs Tab ── */}
      {tab === 'logs' && (
        <MatchRoomLogsPanel tournId={tournId} token={token} />
      )}

      {/* ── Match Form Modal ── */}
      {matchModal.open && (
        <MatchFormModal
          tournId={tournId}
          groups={groups}
          editing={matchModal.editing}
          token={token}
          onClose={() => setMatchModal({ open: false, editing: null })}
          onSaved={loadAll}
          showToast={showToast}
        />
      )}

      {/* ── Delete Confirm ── */}
      {deleteModal && (
        <Modal title="Delete Match" onClose={() => setDeleteModal(null)}>
          <p className="text-body mb-4">
            Delete <strong style={{ color: 'var(--accent-red)' }}>{deleteModal.name || `Match #${deleteModal.id}`}</strong>?
          </p>
          <p className="text-small mb-6" style={{ color: 'var(--text-muted)' }}>
            All room notification logs for this match will also be removed.
          </p>
          <div className="flex gap-3">
            <button onClick={handleDeleteMatch} disabled={deleting} className="btn btn-danger flex-1">
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            <button onClick={() => setDeleteModal(null)} className="btn btn-secondary">Cancel</button>
          </div>
        </Modal>
      )}

      {/* ── Setup Groups Modal ── */}
      {groupModal && (
        <Modal title="Setup Groups" onClose={() => setGroupModal(false)}>
          <p className="text-small mb-4" style={{ color: 'var(--text-secondary)' }}>
            Create lettered groups (A, B, C…) for this tournament. Existing groups are preserved.
          </p>
          <div className="form-group">
            <label className="label">Number of Groups</label>
            <input
              className="input"
              type="number"
              min={1}
              max={26}
              value={groupCount}
              onChange={e => setGroupCount(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="label">Auto-assign registered teams?</label>
            <div className="flex gap-2">
              <button
                onClick={() => setAutoAssign(true)}
                className={`btn btn-sm ${autoAssign ? 'btn-success' : 'btn-secondary'}`}
              >
                Yes
              </button>
              <button
                onClick={() => setAutoAssign(false)}
                className={`btn btn-sm ${!autoAssign ? 'btn-danger' : 'btn-secondary'}`}
              >
                No — I'll assign manually
              </button>
            </div>
          </div>
          <div className="flex gap-3 mt-2">
            <button onClick={handleCreateGroups} disabled={creatingGroups} className="btn btn-primary flex-1">
              {creatingGroups ? 'Creating…' : 'Create Groups'}
            </button>
            <button onClick={() => setGroupModal(false)} className="btn btn-secondary">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
