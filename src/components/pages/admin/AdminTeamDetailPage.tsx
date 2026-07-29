'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import {
  ArrowLeft, Edit2, UserX, UserPlus, Crown, Wallet,
  Lock, Unlock, Minus, Plus, Trash2, Trophy, Clock,
  CheckCircle, AlertCircle,
} from 'lucide-react'
import { PageLoader } from '../../ui/LoadingSpinner'
import Avatar from '../../ui/Avatar'
import Modal from '../../ui/Modal'

// ── Types ─────────────────────────────────────────────────────────────────────

type Member = {
  id: number
  gameName: string | null
  email: string
  gameUid: string | null
  profilePicture: string | null
  role: string
  joinedAt: string
}

type Captain = {
  id: number
  gameName: string | null
  email: string
  gameUid: string | null
  profilePicture: string | null
}

type TeamDetail = {
  id: number
  name: string
  logo: string | null
  captainId: number
  isActive: boolean
  createdAt: string
  totalWins: number
  totalTournaments: number
  walletBalance: number
  lockedBalance: number
  totalEarned: number
  totalSpent: number
}

type Stats = {
  tournaments: number
  wins: number
  top3: number
  winRate: number
  totalPrize: number
  memberCount: number
}

type TournamentEntry = {
  id: number
  name: string
  type: string
  placement: number | null
  prizeAwarded: number | null
  status: string
  startDate: string | null
}

type WalletTx = {
  id: number
  type: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  description: string | null
  createdAt: string
  adminName: string | null
  adminEmail: string | null
}

type ModalType =
  | 'edit'
  | 'transfer_captain'
  | 'add_member'
  | 'remove_member'
  | 'wallet'
  | null

// ── Component ─────────────────────────────────────────────────────────────────

export default function AdminTeamDetailPage() {
  const { token, navigate, pageParams, showToast } = useAppStore()
  const teamId = pageParams.teamId as number

  const [team,        setTeam]        = useState<TeamDetail | null>(null)
  const [captain,     setCaptain]     = useState<Captain | null>(null)
  const [members,     setMembers]     = useState<Member[]>([])
  const [stats,       setStats]       = useState<Stats | null>(null)
  const [history,     setHistory]     = useState<TournamentEntry[]>([])
  const [walletTxs,   setWalletTxs]   = useState<WalletTx[]>([])
  const [loading,     setLoading]     = useState(true)
  const [activeTab,   setActiveTab]   = useState<'info' | 'members' | 'wallet' | 'tournaments'>('info')
  const [modal,       setModal]       = useState<ModalType>(null)
  const [targetMember, setTargetMember] = useState<Member | null>(null)
  const [submitting,  setSubmitting]  = useState(false)

  // Form state
  const [editName,      setEditName]      = useState('')
  const [editLogo,      setEditLogo]      = useState('')
  const [editActive,    setEditActive]    = useState(true)
  const [newCaptainId,  setNewCaptainId]  = useState('')
  const [addUserId,     setAddUserId]     = useState('')
  const [walletAction,  setWalletAction]  = useState<'add_points' | 'deduct_points' | 'lock_balance' | 'unlock_balance'>('add_points')
  const [walletAmount,  setWalletAmount]  = useState('')
  const [walletDesc,    setWalletDesc]    = useState('')

  const load = useCallback(async () => {
    if (!teamId) return
    setLoading(true)
    const res = await apiCall<{
      team: TeamDetail
      captain: Captain | null
      members: Member[]
      stats: Stats
      tournamentHistory: TournamentEntry[]
      walletHistory: WalletTx[]
    }>(`/admin/teams/${teamId}`, {}, token)
    if (res.success && res.data) {
      setTeam(res.data.team)
      setCaptain(res.data.captain)
      setMembers(res.data.members)
      setStats(res.data.stats)
      setHistory(res.data.tournamentHistory)
      setWalletTxs(res.data.walletHistory)
      setEditName(res.data.team.name)
      setEditLogo(res.data.team.logo || '')
      setEditActive(res.data.team.isActive)
    }
    setLoading(false)
  }, [teamId, token])

  useEffect(() => { load() }, [load])

  // ── Submit helpers ─────────────────────────────────────────────────────────

  const submitEdit = async () => {
    setSubmitting(true)
    const res = await apiCall(
      `/admin/teams/${teamId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ action: 'edit', name: editName, logo: editLogo, isActive: editActive }),
      },
      token,
    )
    setSubmitting(false)
    if (res.success) { showToast('Team updated'); setModal(null); load() }
    else showToast(res.message || 'Failed', 'error')
  }

  const submitTransferCaptain = async () => {
    const nid = parseInt(newCaptainId)
    if (isNaN(nid)) { showToast('Enter a valid member ID', 'error'); return }
    setSubmitting(true)
    const res = await apiCall(
      `/admin/teams/${teamId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ action: 'transfer_captain', newCaptainId: nid }),
      },
      token,
    )
    setSubmitting(false)
    if (res.success) { showToast('Captain transferred'); setModal(null); setNewCaptainId(''); load() }
    else showToast(res.message || 'Failed', 'error')
  }

  const submitAddMember = async () => {
    const uid = parseInt(addUserId)
    if (isNaN(uid)) { showToast('Enter a valid user ID', 'error'); return }
    setSubmitting(true)
    const res = await apiCall(
      `/admin/teams/${teamId}/members`,
      { method: 'POST', body: JSON.stringify({ userId: uid }) },
      token,
    )
    setSubmitting(false)
    if (res.success) { showToast('Member added'); setModal(null); setAddUserId(''); load() }
    else showToast(res.message || 'Failed', 'error')
  }

  const submitRemoveMember = async () => {
    if (!targetMember) return
    setSubmitting(true)
    const res = await apiCall(
      `/admin/teams/${teamId}/members`,
      { method: 'DELETE', body: JSON.stringify({ userId: targetMember.id }) },
      token,
    )
    setSubmitting(false)
    if (res.success) { showToast('Member removed'); setModal(null); setTargetMember(null); load() }
    else showToast(res.message || 'Failed', 'error')
  }

  const submitWalletAction = async () => {
    const amt = parseInt(walletAmount)
    if (isNaN(amt) || amt <= 0) { showToast('Enter a valid positive amount', 'error'); return }
    setSubmitting(true)
    const res = await apiCall(
      `/admin/teams/${teamId}/wallet`,
      {
        method: 'POST',
        body: JSON.stringify({ action: walletAction, amount: amt, description: walletDesc || undefined }),
      },
      token,
    )
    setSubmitting(false)
    if (res.success) {
      showToast('Wallet updated')
      setModal(null)
      setWalletAmount('')
      setWalletDesc('')
      load()
    } else {
      showToast(res.message || 'Failed', 'error')
    }
  }

  if (loading) return <PageLoader />
  if (!team) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
      Team not found.{' '}
      <button onClick={() => navigate('admin-teams')} className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }}>
        Back
      </button>
    </div>
  )

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'info',        label: 'Info & Stats' },
    { key: 'members',     label: `Members (${members.length})` },
    { key: 'wallet',      label: 'Wallet History' },
    { key: 'tournaments', label: 'Tournaments' },
  ]

  const txTypeLabel: Record<string, string> = {
    earn_tournament:  'Tournament Earn',
    earn_manual:      'Manual Earn',
    deduct_tournament:'Tournament Deduct',
    deduct_manual:    'Manual Deduct',
    admin_award:      'Admin Award',
    admin_deduct:     'Admin Deduct',
    team_split:       'Team Split',
    withdraw:         'Withdraw',
  }

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '3rem' }}>
      {/* Back */}
      <button
        onClick={() => navigate('admin-teams')}
        className="flex items-center gap-2 mb-5 text-small"
        style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <ArrowLeft size={15} />
        Back to Teams
      </button>

      {/* Hero card */}
      <div
        className="card p-6 mb-5 flex flex-wrap gap-5 items-start"
        style={{ borderColor: 'var(--border-accent)' }}
      >
        <Avatar src={team.logo} name={team.name} size={72} />
        <div className="flex-1" style={{ minWidth: 200 }}>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-heading">{team.name}</h2>
            <span className={`badge ${team.isActive ? 'badge-green' : 'badge-gray'}`}>
              {team.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-small mt-1" style={{ color: 'var(--text-muted)' }}>
            ID #{team.id} · Created {new Date(team.createdAt).toLocaleDateString()}
          </p>
          {captain && (
            <div className="flex items-center gap-2 mt-2">
              <Crown size={13} style={{ color: '#f59e0b' }} />
              <span className="text-small">Captain: </span>
              <Avatar src={captain.profilePicture} name={captain.gameName || captain.email} size={20} />
              <span className="text-small font-medium">{captain.gameName || captain.email}</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>#{captain.id}</span>
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div className="flex flex-wrap gap-4">
          {[
            { label: 'Wallet',       value: team.walletBalance.toLocaleString() + ' pts', color: '#f59e0b' },
            { label: 'Locked',       value: team.lockedBalance.toLocaleString() + ' pts', color: '#8b5cf6' },
            { label: 'Wins',         value: String(team.totalWins),                        color: '#22c55e' },
            { label: 'Tournaments',  value: String(team.totalTournaments),                  color: '#3b82f6' },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ minWidth: 100, padding: '0.75rem 1rem' }}>
              <div className="font-black text-xl" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Admin action buttons */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setModal('edit')} className="btn btn-secondary btn-sm flex items-center gap-1">
            <Edit2 size={13} /> Edit
          </button>
          <button onClick={() => setModal('transfer_captain')} className="btn btn-secondary btn-sm flex items-center gap-1">
            <Crown size={13} /> Captain
          </button>
          <button onClick={() => setModal('add_member')} className="btn btn-success btn-sm flex items-center gap-1">
            <UserPlus size={13} /> Add Member
          </button>
          <button onClick={() => { setWalletAction('add_points'); setModal('wallet') }} className="btn btn-success btn-sm flex items-center gap-1">
            <Plus size={13} /> Add Pts
          </button>
          <button onClick={() => { setWalletAction('deduct_points'); setModal('wallet') }} className="btn btn-danger btn-sm flex items-center gap-1">
            <Minus size={13} /> Deduct Pts
          </button>
          <button onClick={() => { setWalletAction('lock_balance'); setModal('wallet') }} className="btn btn-secondary btn-sm flex items-center gap-1">
            <Lock size={13} /> Lock
          </button>
          <button onClick={() => { setWalletAction('unlock_balance'); setModal('wallet') }} className="btn btn-secondary btn-sm flex items-center gap-1">
            <Unlock size={13} /> Unlock
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b" style={{ borderColor: 'var(--border)' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className="btn btn-ghost btn-sm"
            style={{
              borderBottom: activeTab === t.key ? '2px solid var(--accent-red)' : '2px solid transparent',
              borderRadius: 0,
              color: activeTab === t.key ? 'var(--accent-red)' : 'var(--text-secondary)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Info & Stats ──────────────────────────────────────────────────────── */}
      {activeTab === 'info' && stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Total Tournaments', value: stats.tournaments, icon: Trophy,       color: '#3b82f6' },
            { label: 'Wins',              value: stats.wins,        icon: CheckCircle,   color: '#22c55e' },
            { label: 'Top 3 Finishes',    value: stats.top3,        icon: Trophy,        color: '#f59e0b' },
            { label: 'Win Rate',          value: `${stats.winRate}%`, icon: Trophy,      color: '#8b5cf6' },
            { label: 'Total Prize',       value: `${stats.totalPrize.toLocaleString()} pts`, icon: Wallet, color: '#f59e0b' },
            { label: 'Members',           value: stats.memberCount, icon: Crown,         color: '#06b6d4' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <div
                  className="flex items-center justify-center rounded-lg"
                  style={{ width: 34, height: 34, background: `${s.color}18`, border: `1px solid ${s.color}30` }}
                >
                  <s.icon size={16} style={{ color: s.color }} />
                </div>
              </div>
              <div className="font-black text-2xl" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs mt-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
            </div>
          ))}

          {/* Wallet breakdown */}
          <div className="card p-4 md:col-span-3">
            <h3 className="text-heading mb-4" style={{ fontSize: '1rem' }}>Wallet Breakdown</h3>
            <div className="flex flex-wrap gap-6">
              {[
                { label: 'Available Balance', value: team.walletBalance,  color: '#f59e0b' },
                { label: 'Locked Balance',    value: team.lockedBalance,  color: '#8b5cf6' },
                { label: 'Total Earned',      value: team.totalEarned,    color: '#22c55e' },
                { label: 'Total Spent',       value: team.totalSpent,     color: '#ef4444' },
              ].map(w => (
                <div key={w.label}>
                  <div className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>{w.label}</div>
                  <div className="font-bold text-lg" style={{ color: w.color }}>
                    {w.value.toLocaleString()} pts
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Members ───────────────────────────────────────────────────────────── */}
      {activeTab === 'members' && (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Player</th>
                <th className="hidden sm:table-cell">UID</th>
                <th>Role</th>
                <th className="hidden sm:table-cell">Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar src={m.profilePicture} name={m.gameName || m.email} size={32} />
                      <div>
                        <div className="font-medium text-small">{m.gameName || '—'}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell text-small" style={{ color: 'var(--text-muted)' }}>
                    {m.gameUid || '—'}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        m.role === 'captain'
                          ? 'badge-yellow'
                          : m.role === 'admin' || m.role === 'superadmin'
                          ? 'badge-red'
                          : 'badge-gray'
                      }`}
                    >
                      {m.role}
                    </span>
                  </td>
                  <td className="hidden sm:table-cell text-small" style={{ color: 'var(--text-muted)' }}>
                    {new Date(m.joinedAt).toLocaleDateString()}
                  </td>
                  <td>
                    {m.id !== team.captainId ? (
                      <button
                        onClick={() => { setTargetMember(m); setModal('remove_member') }}
                        className="btn btn-danger btn-icon btn-sm tooltip"
                        data-tip="Remove Member"
                      >
                        <UserX size={13} />
                      </button>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Captain</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Wallet History ────────────────────────────────────────────────────── */}
      {activeTab === 'wallet' && (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Admin</th>
                <th>Type</th>
                <th>Amount</th>
                <th className="hidden sm:table-cell">Before</th>
                <th className="hidden sm:table-cell">After</th>
                <th className="hidden md:table-cell">Description</th>
              </tr>
            </thead>
            <tbody>
              {walletTxs.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No transactions yet
                  </td>
                </tr>
              )}
              {walletTxs.map(tx => (
                <tr key={tx.id}>
                  <td className="text-small" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(tx.createdAt).toLocaleString()}
                  </td>
                  <td className="text-small">{tx.adminName || tx.adminEmail || '—'}</td>
                  <td>
                    <span className={`badge ${tx.amount >= 0 ? 'badge-green' : 'badge-red'}`}>
                      {txTypeLabel[tx.type] || tx.type}
                    </span>
                  </td>
                  <td>
                    <span
                      className="font-semibold"
                      style={{ color: tx.amount >= 0 ? '#22c55e' : '#ef4444' }}
                    >
                      {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="hidden sm:table-cell text-small" style={{ color: 'var(--text-muted)' }}>
                    {tx.balanceBefore.toLocaleString()}
                  </td>
                  <td className="hidden sm:table-cell text-small" style={{ color: 'var(--text-muted)' }}>
                    {tx.balanceAfter.toLocaleString()}
                  </td>
                  <td className="hidden md:table-cell text-small" style={{ color: 'var(--text-muted)' }}>
                    {tx.description || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tournament History ────────────────────────────────────────────────── */}
      {activeTab === 'tournaments' && (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Tournament</th>
                <th>Type</th>
                <th>Placement</th>
                <th>Prize</th>
                <th className="hidden sm:table-cell">Status</th>
                <th className="hidden sm:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No tournament history
                  </td>
                </tr>
              )}
              {history.map(t => (
                <tr key={t.id}>
                  <td className="font-medium text-small">{t.name}</td>
                  <td>
                    <span className="badge badge-blue">{t.type.replace('_', ' ')}</span>
                  </td>
                  <td>
                    {t.placement ? (
                      <span
                        className="font-bold"
                        style={{
                          color: t.placement === 1 ? '#f59e0b'
                            : t.placement <= 3    ? '#22c55e'
                            : 'var(--text-secondary)',
                        }}
                      >
                        #{t.placement}
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    {t.prizeAwarded ? (
                      <span style={{ color: '#f59e0b' }} className="font-semibold">
                        {t.prizeAwarded.toLocaleString()} pts
                      </span>
                    ) : '—'}
                  </td>
                  <td className="hidden sm:table-cell">
                    <span className={`badge ${t.status === 'finished' ? 'badge-green' : t.status === 'published' ? 'badge-blue' : 'badge-gray'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="hidden sm:table-cell text-small" style={{ color: 'var(--text-muted)' }}>
                    {t.startDate ? new Date(t.startDate).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ══ Modals ══════════════════════════════════════════════════════════════ */}

      {/* Edit */}
      {modal === 'edit' && (
        <Modal title="Edit Team" onClose={() => setModal(null)}>
          <div className="form-group">
            <label className="label">Team Name</label>
            <input className="input" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Team name" />
          </div>
          <div className="form-group">
            <label className="label">Logo URL</label>
            <input className="input" value={editLogo} onChange={e => setEditLogo(e.target.value)} placeholder="https://…" />
          </div>
          <div className="form-group">
            <label className="label">Status</label>
            <div className="flex gap-2">
              <button
                onClick={() => setEditActive(true)}
                className={`btn btn-sm ${editActive ? 'btn-success' : 'btn-secondary'}`}
              >
                Active
              </button>
              <button
                onClick={() => setEditActive(false)}
                className={`btn btn-sm ${!editActive ? 'btn-danger' : 'btn-secondary'}`}
              >
                Inactive
              </button>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={submitEdit} disabled={submitting} className="btn btn-primary flex-1">
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
            <button onClick={() => setModal(null)} className="btn btn-secondary">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Transfer Captain */}
      {modal === 'transfer_captain' && (
        <Modal title="Transfer Captaincy" onClose={() => setModal(null)}>
          <p className="text-small mb-4" style={{ color: 'var(--text-secondary)' }}>
            Select a member from the list below to become the new captain.
            The current captain will be demoted to player.
          </p>
          <div className="form-group">
            <label className="label">New Captain (select member)</label>
            {members.filter(m => m.id !== team.captainId).length === 0 ? (
              <p className="text-small" style={{ color: 'var(--text-muted)' }}>No other members available.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {members.filter(m => m.id !== team.captainId).map(m => (
                  <div
                    key={m.id}
                    onClick={() => setNewCaptainId(String(m.id))}
                    className="flex items-center gap-3 p-3 rounded-lg cursor-pointer"
                    style={{
                      background: newCaptainId === String(m.id) ? 'var(--accent-red-dim)' : 'var(--bg-card-hover)',
                      border: `1px solid ${newCaptainId === String(m.id) ? 'var(--border-accent)' : 'var(--border)'}`,
                    }}
                  >
                    <Avatar src={m.profilePicture} name={m.gameName || m.email} size={28} />
                    <div className="flex-1">
                      <div className="text-small font-medium">{m.gameName || '—'}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>#{m.id} · {m.email}</div>
                    </div>
                    {newCaptainId === String(m.id) && <CheckCircle size={16} style={{ color: 'var(--accent-red)' }} />}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-2">
            <button
              onClick={submitTransferCaptain}
              disabled={submitting || !newCaptainId}
              className="btn btn-primary flex-1"
            >
              {submitting ? 'Transferring…' : 'Transfer Captain'}
            </button>
            <button onClick={() => setModal(null)} className="btn btn-secondary">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Add Member */}
      {modal === 'add_member' && (
        <Modal title="Add Member" onClose={() => setModal(null)}>
          <p className="text-small mb-4" style={{ color: 'var(--text-secondary)' }}>
            Enter the user ID of a player who is not currently on any team.
          </p>
          <div className="form-group">
            <label className="label">User ID</label>
            <input
              className="input"
              type="number"
              value={addUserId}
              onChange={e => setAddUserId(e.target.value)}
              placeholder="e.g. 42"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={submitAddMember} disabled={submitting} className="btn btn-success flex-1">
              {submitting ? 'Adding…' : 'Add Member'}
            </button>
            <button onClick={() => setModal(null)} className="btn btn-secondary">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Remove Member */}
      {modal === 'remove_member' && targetMember && (
        <Modal title="Remove Member" onClose={() => { setModal(null); setTargetMember(null) }}>
          <p className="text-body mb-4">
            Remove{' '}
            <strong style={{ color: 'var(--accent-red)' }}>
              {targetMember.gameName || targetMember.email}
            </strong>{' '}
            from the team?
          </p>
          <p className="text-small mb-6" style={{ color: 'var(--text-muted)' }}>
            Their personal wallet balance will not be affected.
          </p>
          <div className="flex gap-3">
            <button onClick={submitRemoveMember} disabled={submitting} className="btn btn-danger flex-1">
              {submitting ? 'Removing…' : 'Remove Member'}
            </button>
            <button onClick={() => { setModal(null); setTargetMember(null) }} className="btn btn-secondary">Cancel</button>
          </div>
        </Modal>
      )}

      {/* Wallet Action */}
      {modal === 'wallet' && (
        <Modal
          title={
            walletAction === 'add_points'      ? 'Add Points to Team Wallet'
            : walletAction === 'deduct_points' ? 'Deduct Points from Team Wallet'
            : walletAction === 'lock_balance'  ? 'Lock Balance'
            : 'Unlock Balance'
          }
          onClose={() => setModal(null)}
        >
          {/* Action selector */}
          <div className="form-group">
            <label className="label">Action</label>
            <div className="flex flex-wrap gap-2">
              {([
                { v: 'add_points',      label: 'Add Points',    cls: 'btn-success' },
                { v: 'deduct_points',   label: 'Deduct Points', cls: 'btn-danger'  },
                { v: 'lock_balance',    label: 'Lock',          cls: 'btn-secondary' },
                { v: 'unlock_balance',  label: 'Unlock',        cls: 'btn-secondary' },
              ] as const).map(a => (
                <button
                  key={a.v}
                  onClick={() => setWalletAction(a.v)}
                  className={`btn btn-sm ${walletAction === a.v ? a.cls : 'btn-secondary'}`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Balance info */}
          <div className="flex gap-4 mb-4 p-3 rounded-lg" style={{ background: 'var(--bg-card-hover)' }}>
            <div>
              <div className="text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Available</div>
              <div className="font-bold" style={{ color: '#f59e0b' }}>{team.walletBalance.toLocaleString()} pts</div>
            </div>
            <div>
              <div className="text-xs uppercase" style={{ color: 'var(--text-muted)' }}>Locked</div>
              <div className="font-bold" style={{ color: '#8b5cf6' }}>{team.lockedBalance.toLocaleString()} pts</div>
            </div>
          </div>

          <div className="form-group">
            <label className="label">Amount (pts)</label>
            <input
              className="input"
              type="number"
              min={1}
              value={walletAmount}
              onChange={e => setWalletAmount(e.target.value)}
              placeholder="e.g. 500"
            />
          </div>
          <div className="form-group">
            <label className="label">Description (optional)</label>
            <input
              className="input"
              value={walletDesc}
              onChange={e => setWalletDesc(e.target.value)}
              placeholder="Reason for this operation…"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={submitWalletAction} disabled={submitting} className="btn btn-primary flex-1">
              {submitting ? 'Processing…' : 'Confirm'}
            </button>
            <button onClick={() => setModal(null)} className="btn btn-secondary">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
