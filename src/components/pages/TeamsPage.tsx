'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Users, Search, Zap, Trophy, UserPlus } from 'lucide-react'
import { PageLoader } from '../ui/LoadingSpinner'
import Avatar from '../ui/Avatar'
import Modal from '../ui/Modal'

type Team = {
  id: number; name: string; logo: string | null; walletBalance: number;
  captainId: number; totalTournaments: number; memberCount: number;
}

export default function TeamsPage() {
  const { token, myTeam, showToast } = useAppStore()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [joiningId, setJoiningId] = useState<number | null>(null)
  const [sentRequests, setSentRequests] = useState<Set<number>>(new Set())
  const [requestModal, setRequestModal] = useState<Team | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setLoading(true)
    apiCall(`/teams?search=${search}&limit=20`, {}, token).then(res => {
      if (res.success && res.data) setTeams((res.data as { teams: Team[] }).teams || [])
      setLoading(false)
    })
  }, [search])

  const sendRequest = async () => {
    if (!requestModal) return
    setJoiningId(requestModal.id)
    const res = await apiCall('/teams/join-request', {
      method: 'POST',
      body: JSON.stringify({ teamId: requestModal.id, message }),
    }, token)
    setJoiningId(null)
    setRequestModal(null)
    if (res.success) {
      showToast('Join request sent!')
      setSentRequests(prev => new Set([...prev, requestModal.id]))
    } else {
      showToast(res.message || 'Failed to send request', 'error')
    }
  }

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '5rem' }}>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="Search teams..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {teams.length === 0 && (
        <div className="text-center py-20">
          <Users size={48} style={{ margin: '0 auto 12px', color: 'var(--text-muted)', opacity: 0.4 }} />
          <p style={{ color: 'var(--text-muted)' }}>No teams found</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {teams.map(team => {
          const requested = sentRequests.has(team.id)
          const isMyTeam = myTeam?.id === team.id
          const isFull = team.memberCount >= 6

          return (
            <div key={team.id} className="card p-5">
              <div className="flex items-center gap-3 mb-4">
                <Avatar src={team.logo} name={team.name} size={48} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold truncate">{team.name}</h3>
                  <div className="text-small" style={{ color: 'var(--text-muted)' }}>
                    {team.memberCount}/6 players
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-4 text-small" style={{ color: 'var(--text-secondary)' }}>
                <span className="flex items-center gap-1">
                  <Zap size={13} style={{ color: 'var(--accent-red)' }} />
                  {team.walletBalance.toLocaleString()} pts
                </span>
                <span className="flex items-center gap-1">
                  <Trophy size={13} style={{ color: '#f59e0b' }} />
                  {team.totalTournaments} tournaments
                </span>
              </div>

              {/* Members indicator */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-sm"
                    style={{
                      height: 4, flex: 1,
                      background: i < team.memberCount ? 'var(--accent-red)' : 'var(--bg-input)',
                    }}
                  />
                ))}
              </div>

              {!isMyTeam && !myTeam && (
                <button
                  onClick={() => setRequestModal(team)}
                  disabled={requested || isFull || joiningId === team.id}
                  className={`btn w-full ${requested ? 'btn-success' : 'btn-primary'} btn-sm`}
                >
                  <UserPlus size={14} />
                  {requested ? 'Request Sent' : isFull ? 'Team Full' : 'Request to Join'}
                </button>
              )}
              {isMyTeam && (
                <div className="badge badge-green w-full justify-center">My Team</div>
              )}
            </div>
          )
        })}
      </div>

      {requestModal && (
        <Modal title={`Join ${requestModal.name}`} onClose={() => setRequestModal(null)}>
          <p className="text-small mb-4" style={{ color: 'var(--text-secondary)' }}>
            Send a join request to <strong style={{ color: 'white' }}>{requestModal.name}</strong>.
            The captain will review and respond.
          </p>
          <div className="form-group">
            <label className="label">Message (optional)</label>
            <textarea
              className="input"
              rows={3}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Introduce yourself..."
              style={{ resize: 'vertical' }}
            />
          </div>
          <div className="flex gap-3">
            <button onClick={sendRequest} disabled={joiningId !== null} className="btn btn-primary flex-1">
              Send Request
            </button>
            <button onClick={() => setRequestModal(null)} className="btn btn-secondary">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
