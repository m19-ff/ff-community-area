'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Search, Trash2, Eye } from 'lucide-react'
import { PageLoader } from '../../ui/LoadingSpinner'
import Avatar from '../../ui/Avatar'

type Team = { id: number; name: string; logo: string | null; points: number; walletBalance?: number; captainId: number; memberCount: number; totalTournaments: number }

export default function AdminTeamsPage() {
  const { token, showToast } = useAppStore()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = () => {
    setLoading(true)
    apiCall(`/teams?search=${search}&limit=50`, {}, token).then(res => {
      if (res.success && res.data) setTeams((res.data as { teams: Team[] }).teams || [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [search])

  const deleteTeam = async (id: number, name: string) => {
    if (!confirm(`Delete team "${name}"? Points will be distributed to members.`)) return
    const res = await apiCall(`/teams/${id}`, { method: 'DELETE' }, token)
    if (res.success) { showToast('Team deleted'); load() }
    else showToast(res.message || 'Failed', 'error')
  }

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '2rem' }}>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1" style={{ minWidth: 200, maxWidth: 320 }}>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input className="input" style={{ paddingLeft: 36 }} placeholder="Search teams..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Team</th>
              <th className="hidden sm:table-cell">Members</th>
              <th>Points</th>
              <th className="hidden md:table-cell">Tournaments</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {teams.map(team => (
              <tr key={team.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <Avatar src={team.logo} name={team.name} size={32} />
                    <span className="font-medium text-small">{team.name}</span>
                  </div>
                </td>
                <td className="hidden sm:table-cell text-small">{team.memberCount}/6</td>
                <td>
                  <span className="font-semibold" style={{ color: 'var(--accent-red)' }}>{(team.walletBalance ?? team.points ?? 0).toLocaleString()}</span>
                </td>
                <td className="hidden md:table-cell text-small">{team.totalTournaments}</td>
                <td>
                  <button onClick={() => deleteTeam(team.id, team.name)} className="btn btn-danger btn-icon btn-sm">
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
