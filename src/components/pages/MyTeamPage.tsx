'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Plus, Search, UserPlus, Crown, Trash2, UserX, Check, X, Shield, LogOut, Wallet, History } from 'lucide-react'
import { PageLoader } from '../ui/LoadingSpinner'
import Avatar from '../ui/Avatar'
import Modal from '../ui/Modal'

type Member = { id: number; gameName: string; gameUid: string; profilePicture: string | null; role: string; joinedAt: string }
type TeamDetail = {
  id: number; name: string; logo: string | null; walletBalance: number; captainId: number; members: Member[]
}
type JoinRequest = { id: number; status: string; message: string; createdAt: string; user: { id: number; gameName: string; gameUid: string; profilePicture: string | null } }
type Invitation = { id: number; status: string; team: { id: number; name: string; logo: string | null; walletBalance: number }; createdAt: string }

export default function MyTeamPage() {
  const { token, user, myTeam, setMyTeam, navigate, showToast } = useAppStore()
  const [team, setTeam] = useState<TeamDetail | null>(null)
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [inviteUid, setInviteUid] = useState('')
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [tab, setTab] = useState<'members' | 'requests' | 'invitations'>('members')

  const isCaptain = user?.role === 'captain' || user?.id === team?.captainId

  const load = async () => {
    setLoading(true)
    // Always fetch fresh team data from the API — do not rely on cached myTeam
    const profileRes = await apiCall<{ team: typeof myTeam }>('/auth/profile', {}, token)
    const freshTeam = profileRes.success && profileRes.data ? profileRes.data.team ?? null : null
    if (freshTeam !== undefined) setMyTeam(freshTeam)

    if (freshTeam) {
      const [tRes, rRes, iRes] = await Promise.all([
        apiCall(`/teams/${freshTeam.id}`, {}, token),
        isCaptain ? apiCall('/teams/join-request', {}, token) : Promise.resolve({ success: false, data: null, message: '' }),
        apiCall('/teams/invitations', {}, token),
      ])
      if (tRes.success && tRes.data) setTeam((tRes.data as { team: TeamDetail }).team)
      if (rRes.success && rRes.data) setRequests((rRes.data as { requests: JoinRequest[] }).requests || [])
      if (iRes.success && iRes.data) setInvitations((iRes.data as { invitations: Invitation[] }).invitations || [])
    } else {
      setTeam(null)
      const iRes = await apiCall('/teams/invitations', {}, token)
      if (iRes.success && iRes.data) setInvitations((iRes.data as { invitations: Invitation[] }).invitations || [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [token])

  const createTeam = async () => {
    if (!newTeamName.trim() || newTeamName.trim().length < 3) { showToast('Team name must be at least 3 characters', 'error'); return }
    setCreating(true)
    const res = await apiCall('/teams', { method: 'POST', body: JSON.stringify({ name: newTeamName }) }, token)
    setCreating(false)
    if (res.success && res.data) {
      const d = res.data as { team: typeof myTeam }
      setMyTeam(d.team)
      showToast('Team created!')
      setShowCreateModal(false)
      load()
    } else {
      showToast(res.message || 'Failed to create team', 'error')
    }
  }

  const invitePlayer = async () => {
    if (!inviteUid.trim()) return
    setInviting(true)
    const res = await apiCall(`/teams/${myTeam!.id}/invite`, { method: 'POST', body: JSON.stringify({ gameUid: inviteUid }) }, token)
    setInviting(false)
    if (res.success) {
      showToast(res.message as string || 'Invitation sent!')
      setInviteUid('')
    } else {
      showToast(res.message || 'Failed to invite player', 'error')
    }
  }

  const respondToRequest = async (requestId: number, action: 'accept' | 'reject') => {
    const res = await apiCall('/teams/join-request', { method: 'PATCH', body: JSON.stringify({ requestId, action }) }, token)
    if (res.success) {
      showToast(action === 'accept' ? 'Player added to team!' : 'Request rejected')
      setRequests(prev => prev.filter(r => r.id !== requestId))
      if (action === 'accept') load()
    } else {
      showToast(res.message || 'Failed', 'error')
    }
  }

  const respondToInvitation = async (invitationId: number, action: 'accept' | 'decline') => {
    const res = await apiCall('/teams/invitations', { method: 'PATCH', body: JSON.stringify({ invitationId, action }) }, token)
    if (res.success) {
      showToast(action === 'accept' ? 'Joined team!' : 'Invitation declined')
      setInvitations(prev => prev.filter(i => i.id !== invitationId))
      if (action === 'accept') {
        apiCall('/auth/profile', {}, token).then(r => {
          if (r.success && r.data) {
            const d = r.data as { team: typeof myTeam }
            if (d.team) useAppStore.getState().setMyTeam(d.team)
          }
        })
        load()
      }
    } else {
      showToast(res.message || 'Failed', 'error')
    }
  }

  const leaveTeam = async () => {
    if (!team) return
    if (!confirm(`Leave ${team.name}? Your equal share of the team wallet will be returned to your personal wallet.`)) return
    setLeaving(true)
    const res = await apiCall(`/teams/${team.id}/leave`, { method: 'POST' }, token)
    setLeaving(false)
    if (res.success) {
      const d = res.data as { shareReceived?: number }
      showToast(d?.shareReceived ? `Left team — ${d.shareReceived.toLocaleString()} pts returned to your wallet` : 'Left team')
      setMyTeam(null)
      setTeam(null)
      load()
    } else {
      showToast(res.message || 'Failed to leave team', 'error')
    }
  }

  const deleteTeam = async () => {
    if (!team) return
    if (!confirm(`Delete ${team.name}? The team wallet balance will be equally distributed among all members.`)) return
    setDeleting(true)
    const res = await apiCall(`/teams/${team.id}`, { method: 'DELETE' }, token)
    setDeleting(false)
    if (res.success) {
      showToast('Team deleted and funds distributed')
      setMyTeam(null)
      setTeam(null)
      load()
    } else {
      showToast(res.message || 'Failed to delete team', 'error')
    }
  }

  if (loading) return <PageLoader />

  // No team
  if (!myTeam && !team) {
    return (
      <div style={{ padding: '1.5rem', paddingBottom: '5rem' }}>
        <div className="card p-12 text-center mb-6">
          <Shield size={64} style={{ margin: '0 auto 16px', color: 'var(--text-muted)', opacity: 0.4 }} />
          <h2 className="text-title mb-3">You're Not in a Team</h2>
          <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>
            Create your own team or browse and join an existing one.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary btn-lg">
              <Plus size={18} /> Create Team
            </button>
            <button onClick={() => navigate('teams')} className="btn btn-secondary btn-lg">
              <Search size={18} /> Browse Teams
            </button>
          </div>
        </div>

        {/* Pending invitations */}
        {invitations.length > 0 && (
          <div>
            <h3 className="text-heading mb-4">Pending Invitations ({invitations.length})</h3>
            <div className="flex flex-col gap-3">
              {invitations.map(inv => (
                <div key={inv.id} className="card p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar src={inv.team?.logo} name={inv.team?.name} size={40} />
                    <div>
                      <div className="font-semibold">{inv.team?.name}</div>
                      <div className="text-small" style={{ color: 'var(--text-muted)' }}>
                        {(inv.team?.walletBalance ?? 0).toLocaleString()} pts
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => respondToInvitation(inv.id, 'accept')} className="btn btn-success btn-sm">
                      <Check size={14} /> Accept
                    </button>
                    <button onClick={() => respondToInvitation(inv.id, 'decline')} className="btn btn-danger btn-sm">
                      <X size={14} /> Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showCreateModal && (
          <Modal title="Create Team" onClose={() => setShowCreateModal(false)}>
            <div className="form-group">
              <label className="label">Team Name</label>
              <input
                className="input"
                value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
                placeholder="Enter team name"
                maxLength={50}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Min 3 characters. Max 50.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={createTeam} disabled={creating} className="btn btn-primary flex-1">
                {creating ? 'Creating...' : 'Create Team'}
              </button>
              <button onClick={() => setShowCreateModal(false)} className="btn btn-secondary">Cancel</button>
            </div>
          </Modal>
        )}
      </div>
    )
  }

  const walletBalance = team?.walletBalance ?? 0

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '5rem' }}>
      {/* Team Header */}
      <div
        className="card p-6 mb-6 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(227,28,28,0.1) 0%, var(--bg-card) 100%)' }}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <Avatar src={team?.logo} name={team?.name} size={64} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-heading">{team?.name}</h2>
              {isCaptain && <Crown size={16} style={{ color: '#f59e0b' }} />}
            </div>
            <div className="text-small" style={{ color: 'var(--text-secondary)' }}>
              <span style={{ color: '#8b5cf6', fontWeight: 700 }}>
                <Wallet size={12} style={{ display: 'inline', marginRight: 4 }} />
                {walletBalance.toLocaleString()} team pts
              </span>
              {' '}· {team?.members?.length}/6 players
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => navigate('team-wallet-history')} className="btn btn-ghost btn-sm">
              <History size={14} /> Wallet History
            </button>
            {isCaptain && (
              <>
                <button onClick={() => setShowInviteModal(true)} className="btn btn-primary btn-sm">
                  <UserPlus size={14} /> Invite
                </button>
                <button onClick={deleteTeam} disabled={deleting} className="btn btn-danger btn-sm">
                  <Trash2 size={14} /> {deleting ? '...' : 'Delete Team'}
                </button>
              </>
            )}
            {!isCaptain && (
              <button onClick={leaveTeam} disabled={leaving} className="btn btn-secondary btn-sm">
                <LogOut size={14} /> {leaving ? '...' : 'Leave Team'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {([
          { key: 'members', label: `Members (${team?.members?.length || 0})` },
          ...(isCaptain ? [{ key: 'requests', label: `Requests (${requests.length})` }] : []),
          { key: 'invitations', label: `My Invitations (${invitations.length})` },
        ] as { key: string; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as typeof tab)}
            className="btn btn-sm"
            style={{
              borderRadius: '8px 8px 0 0',
              background: tab === t.key ? 'var(--bg-card)' : 'transparent',
              color: tab === t.key ? 'var(--accent-red)' : 'var(--text-secondary)',
              borderBottom: tab === t.key ? '2px solid var(--accent-red)' : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Members tab */}
      {tab === 'members' && (
        <div className="flex flex-col gap-3">
          {team?.members?.map(member => (
            <div key={member.id} className="card p-4 flex items-center gap-3">
              <Avatar src={member.profilePicture} name={member.gameName} size={44} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{member.gameName}</span>
                  {member.id === team.captainId && <Crown size={14} style={{ color: '#f59e0b' }} />}
                </div>
                <div className="text-small" style={{ color: 'var(--text-muted)' }}>UID: {member.gameUid}</div>
              </div>
              <span className="badge badge-gray">{member.role}</span>
            </div>
          ))}
        </div>
      )}

      {/* Requests tab */}
      {tab === 'requests' && (
        <div className="flex flex-col gap-3">
          {requests.length === 0 && <p className="text-small" style={{ color: 'var(--text-muted)' }}>No pending requests</p>}
          {requests.map(req => (
            <div key={req.id} className="card p-4 flex items-center gap-3">
              <Avatar src={req.user?.profilePicture} name={req.user?.gameName} size={44} />
              <div className="flex-1">
                <div className="font-semibold">{req.user?.gameName}</div>
                <div className="text-small" style={{ color: 'var(--text-muted)' }}>UID: {req.user?.gameUid}</div>
                {req.message && <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>"{req.message}"</div>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => respondToRequest(req.id, 'accept')} className="btn btn-success btn-sm">
                  <Check size={14} />
                </button>
                <button onClick={() => respondToRequest(req.id, 'reject')} className="btn btn-danger btn-sm">
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invitations tab */}
      {tab === 'invitations' && (
        <div className="flex flex-col gap-3">
          {invitations.length === 0 && <p className="text-small" style={{ color: 'var(--text-muted)' }}>No pending invitations</p>}
          {invitations.map(inv => (
            <div key={inv.id} className="card p-4 flex items-center gap-3">
              <Avatar src={inv.team?.logo} name={inv.team?.name} size={44} />
              <div className="flex-1">
                <div className="font-semibold">{inv.team?.name}</div>
                <div className="text-small" style={{ color: 'var(--text-muted)' }}>
                  {(inv.team?.walletBalance ?? 0).toLocaleString()} pts
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => respondToInvitation(inv.id, 'accept')} className="btn btn-success btn-sm">Accept</button>
                <button onClick={() => respondToInvitation(inv.id, 'decline')} className="btn btn-danger btn-sm">Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invite modal */}
      {showInviteModal && (
        <Modal title="Invite Player" onClose={() => setShowInviteModal(false)}>
          <p className="text-small mb-4" style={{ color: 'var(--text-secondary)' }}>
            Search by player's Game UID to send an invitation.
          </p>
          <div className="form-group">
            <label className="label">Player Game UID</label>
            <input
              className="input"
              value={inviteUid}
              onChange={e => setInviteUid(e.target.value)}
              placeholder="Enter Game UID"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={invitePlayer} disabled={inviting} className="btn btn-primary flex-1">
              {inviting ? 'Sending...' : 'Send Invitation'}
            </button>
            <button onClick={() => setShowInviteModal(false)} className="btn btn-secondary">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
