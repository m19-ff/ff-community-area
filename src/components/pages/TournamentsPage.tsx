'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Trophy, Search, Filter, Calendar, Users, Zap } from 'lucide-react'
import { PageLoader } from '../ui/LoadingSpinner'

type Tournament = {
  id: number; name: string; type: string; banner: string | null;
  registrationCost: number; prizePool: number; maxTeams: number;
  teamsRegistered: number; registrationDeadline: string | null;
  startDate: string | null; status: string;
}

export default function TournamentsPage() {
  const { token, navigate } = useAppStore()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filter, setFilter] = useState<'all' | 'battle_royale' | 'clash_squad'>('all')

  const load = async (p = 1) => {
    setLoading(true)
    const res = await apiCall(`/tournaments?page=${p}&search=${search}&limit=12`, {}, token)
    if (res.success && res.data) {
      const d = res.data as { tournaments: Tournament[]; pagination: { pages: number } }
      setTournaments(d.tournaments || [])
      setTotalPages(d.pagination?.pages || 1)
    }
    setLoading(false)
  }

  useEffect(() => { load(1) }, [search])

  const filtered = filter === 'all' ? tournaments : tournaments.filter(t => t.type === filter)

  const statusColor: Record<string, string> = {
    published: '#22c55e', closed: '#f59e0b', finished: '#6b7280', draft: '#8b5cf6'
  }

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '5rem' }}>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1" style={{ minWidth: 200, maxWidth: 320 }}>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="Search tournaments..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'battle_royale', 'clash_squad'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            >
              {f === 'all' ? 'All' : f === 'battle_royale' ? 'Battle Royale' : 'Clash Squad'}
            </button>
          ))}
        </div>
      </div>

      {loading ? <PageLoader /> : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-20" style={{ color: 'var(--text-muted)' }}>
                <Trophy size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                <p>No tournaments found</p>
              </div>
            )}
            {filtered.map(t => (
              <button
                key={t.id}
                onClick={() => navigate('tournament-detail', { id: t.id })}
                className="card p-0 text-left overflow-hidden hover:scale-[1.02] transition-transform"
              >
                {/* Banner */}
                <div
                  className="relative"
                  style={{
                    height: 120,
                    background: t.banner
                      ? `url(${t.banner}) center/cover`
                      : 'linear-gradient(135deg, rgba(227,28,28,0.2) 0%, rgba(0,0,0,0.8) 100%)',
                  }}
                >
                  <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(to bottom, transparent 50%, var(--bg-card) 100%)' }}
                  />
                  <div className="absolute top-3 left-3">
                    <span
                      className="badge"
                      style={{
                        background: t.type === 'battle_royale' ? 'rgba(245,158,11,0.85)' : 'rgba(59,130,246,0.85)',
                        color: 'white',
                        border: 'none',
                        fontSize: '0.7rem',
                      }}
                    >
                      {t.type === 'battle_royale' ? 'Battle Royale' : 'Clash Squad'}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3">
                    <span
                      className="badge"
                      style={{
                        background: `${statusColor[t.status]}20`,
                        color: statusColor[t.status],
                        border: `1px solid ${statusColor[t.status]}40`,
                        fontSize: '0.7rem',
                      }}
                    >
                      {t.status}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold mb-3 truncate">{t.name}</h3>
                  <div className="grid grid-cols-2 gap-2 text-small" style={{ color: 'var(--text-secondary)' }}>
                    <div className="flex items-center gap-1.5">
                      <Trophy size={13} style={{ color: '#f59e0b' }} />
                      <span>{t.prizePool.toLocaleString()} pts</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users size={13} style={{ color: '#3b82f6' }} />
                      <span>{t.teamsRegistered}/{t.maxTeams}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Zap size={13} style={{ color: '#e31c1c' }} />
                      <span>{t.registrationCost > 0 ? `${t.registrationCost} pts` : 'Free'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} />
                      {t.startDate
                        ? <span>{new Date(t.startDate).toLocaleDateString()}</span>
                        : <span>TBD</span>}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => { setPage(p); load(p) }}
                  className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ minWidth: 36 }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
