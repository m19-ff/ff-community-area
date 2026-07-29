'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import {
  Search, Filter, ArrowUpDown, Eye, Trash2,
  ChevronUp, ChevronDown, Users, Trophy, Wallet, Calendar,
} from 'lucide-react'
import { PageLoader } from '../../ui/LoadingSpinner'
import Avatar from '../../ui/Avatar'
import Modal from '../../ui/Modal'

type AdminTeam = {
  id: number
  name: string
  logo: string | null
  captainId: number
  captainName: string | null
  captainEmail: string | null
  captainPicture: string | null
  memberCount: number
  walletBalance: number
  totalWins: number
  totalTournaments: number
  isActive: boolean
  createdAt: string
}

type SortField = 'createdAt' | 'walletBalance' | 'wins'
type FilterType = 'all' | 'active' | 'inactive'

export default function AdminTeamsPage() {
  const { token, navigate, showToast } = useAppStore()

  const [teams,       setTeams]       = useState<AdminTeam[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [filter,      setFilter]      = useState<FilterType>('all')
  const [sortBy,      setSortBy]      = useState<SortField>('createdAt')
  const [sortDir,     setSortDir]     = useState<'asc' | 'desc'>('desc')
  const [page,        setPage]        = useState(1)
  const [total,       setTotal]       = useState(0)
  const [pages,       setPages]       = useState(1)
  const [deleteModal, setDeleteModal] = useState<AdminTeam | null>(null)
  const [deleting,    setDeleting]    = useState(false)

  const load = useCallback(async (p = 1) => {
    setLoading(true)
    const qs = new URLSearchParams({
      page:    String(p),
      limit:   '20',
      search,
      filter,
      sortBy,
      sortDir,
    })
    const res = await apiCall<{
      teams: AdminTeam[]
      pagination: { total: number; pages: number }
    }>(`/admin/teams?${qs}`, {}, token)
    if (res.success && res.data) {
      setTeams(res.data.teams ?? [])
      setTotal(res.data.pagination?.total ?? 0)
      setPages(res.data.pagination?.pages ?? 1)
    }
    setLoading(false)
  }, [search, filter, sortBy, sortDir, token])

  useEffect(() => { setPage(1); load(1) }, [search, filter, sortBy, sortDir])
  useEffect(() => { load(page) }, [page])

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
  }

  const handleDelete = async () => {
    if (!deleteModal) return
    setDeleting(true)
    const res = await apiCall(`/admin/teams/${deleteModal.id}`, { method: 'DELETE' }, token)
    setDeleting(false)
    if (res.success) {
      showToast('Team deleted and funds distributed')
      setDeleteModal(null)
      load(page)
    } else {
      showToast(res.message || 'Failed to delete team', 'error')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ArrowUpDown size={13} style={{ color: 'var(--text-muted)', marginLeft: 4 }} />
    return sortDir === 'asc'
      ? <ChevronUp size={13} style={{ color: 'var(--accent-red)', marginLeft: 4 }} />
      : <ChevronDown size={13} style={{ color: 'var(--accent-red)', marginLeft: 4 }} />
  }

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '2rem' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-heading">Teams Management</h2>
          <p className="text-small" style={{ color: 'var(--text-muted)', marginTop: 2 }}>
            {total} team{total !== 1 ? 's' : ''} total
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 mb-5">
        {/* Search */}
        <div className="relative" style={{ flex: '1 1 220px', maxWidth: 340 }}>
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder="Search by team name or captain…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filter */}
        <div className="flex gap-2 items-center">
          <Filter size={14} style={{ color: 'var(--text-muted)' }} />
          {(['all', 'active', 'inactive'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? <PageLoader /> : (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Team</th>
                <th className="hidden sm:table-cell">Captain</th>
                <th className="hidden sm:table-cell">Members</th>
                <th
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort('walletBalance')}
                >
                  <span className="flex items-center">
                    <Wallet size={12} style={{ marginRight: 4 }} />
                    Wallet
                    <SortIcon field="walletBalance" />
                  </span>
                </th>
                <th
                  className="hidden md:table-cell cursor-pointer select-none"
                  onClick={() => toggleSort('wins')}
                >
                  <span className="flex items-center">
                    <Trophy size={12} style={{ marginRight: 4 }} />
                    Wins
                    <SortIcon field="wins" />
                  </span>
                </th>
                <th className="hidden md:table-cell">Tournaments</th>
                <th
                  className="hidden lg:table-cell cursor-pointer select-none"
                  onClick={() => toggleSort('createdAt')}
                >
                  <span className="flex items-center">
                    <Calendar size={12} style={{ marginRight: 4 }} />
                    Created
                    <SortIcon field="createdAt" />
                  </span>
                </th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No teams found
                  </td>
                </tr>
              )}
              {teams.map(team => (
                <tr key={team.id}>
                  {/* Team */}
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar src={team.logo} name={team.name} size={34} />
                      <div>
                        <div className="font-semibold text-small">{team.name}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>ID #{team.id}</div>
                      </div>
                    </div>
                  </td>
                  {/* Captain */}
                  <td className="hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      <Avatar src={team.captainPicture} name={team.captainName || team.captainEmail || '?'} size={24} />
                      <span className="text-small">{team.captainName || team.captainEmail || '—'}</span>
                    </div>
                  </td>
                  {/* Members */}
                  <td className="hidden sm:table-cell">
                    <span className="flex items-center gap-1 text-small">
                      <Users size={12} style={{ color: 'var(--text-muted)' }} />
                      {team.memberCount}/6
                    </span>
                  </td>
                  {/* Wallet */}
                  <td>
                    <span className="font-semibold" style={{ color: '#f59e0b' }}>
                      {team.walletBalance.toLocaleString()}
                    </span>
                  </td>
                  {/* Wins */}
                  <td className="hidden md:table-cell">
                    <span className="font-semibold" style={{ color: '#22c55e' }}>{team.totalWins}</span>
                  </td>
                  {/* Tournaments */}
                  <td className="hidden md:table-cell text-small">{team.totalTournaments}</td>
                  {/* Created */}
                  <td className="hidden lg:table-cell text-small" style={{ color: 'var(--text-muted)' }}>
                    {new Date(team.createdAt).toLocaleDateString()}
                  </td>
                  {/* Status */}
                  <td>
                    <span className={`badge ${team.isActive ? 'badge-green' : 'badge-gray'}`}>
                      {team.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {/* Actions */}
                  <td>
                    <div className="flex gap-1">
                      <button
                        onClick={() => navigate('admin-team-detail', { teamId: team.id })}
                        className="btn btn-secondary btn-icon btn-sm tooltip"
                        data-tip="View Details"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteModal(team)}
                        className="btn btn-danger btn-icon btn-sm tooltip"
                        data-tip="Delete Team"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-5">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn btn-secondary btn-sm"
          >
            Prev
          </button>
          <span className="flex items-center text-small" style={{ color: 'var(--text-muted)' }}>
            {page} / {pages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="btn btn-secondary btn-sm"
          >
            Next
          </button>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteModal && (
        <Modal title="Delete Team" onClose={() => setDeleteModal(null)}>
          <p className="text-body mb-4">
            Are you sure you want to delete{' '}
            <strong style={{ color: 'var(--accent-red)' }}>{deleteModal.name}</strong>?
          </p>
          <p className="text-small mb-6" style={{ color: 'var(--text-muted)' }}>
            All wallet balance ({deleteModal.walletBalance.toLocaleString()} pts) will be
            distributed equally among {deleteModal.memberCount} member(s). This action cannot be
            undone.
          </p>
          <div className="flex gap-3">
            <button onClick={handleDelete} disabled={deleting} className="btn btn-danger flex-1">
              {deleting ? 'Deleting…' : 'Delete Team'}
            </button>
            <button onClick={() => setDeleteModal(null)} className="btn btn-secondary">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
