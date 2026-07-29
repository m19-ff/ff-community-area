'use client'
import { useEffect, useState } from 'react'
import { apiCall } from '@/store/useAppStore'

type Log = {
  id: number
  matchId: number
  tournamentId: number
  groupName: string | null
  sentByName: string | null
  roomId: string | null
  roomPassword: string | null
  recipientCount: number
  sentAt: string
  tournamentName: string | null
}

interface Props {
  tournId: number
  token: string | null
}

export default function MatchRoomLogsPanel({ tournId, token }: Props) {
  const [logs,    setLogs]    = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const load = async (p: number) => {
    setLoading(true)
    const res = await apiCall<{ logs: Log[]; pagination: { limit: number } }>(
      `/admin/match-logs?tournamentId=${tournId}&page=${p}`,
      {},
      token,
    )
    if (res.success && res.data) {
      const newLogs = res.data.logs ?? []
      setLogs(prev => p === 1 ? newLogs : [...prev, ...newLogs])
      setHasMore(newLogs.length === (res.data?.pagination?.limit ?? 50))
    }
    setLoading(false)
  }

  useEffect(() => { load(1) }, [tournId])

  return (
    <div>
      <p className="text-small mb-4" style={{ color: 'var(--text-muted)' }}>
        Every time a room was sent (automatically or manually) for this tournament.
      </p>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Sent At</th>
              <th>Group</th>
              <th>Room ID</th>
              <th className="hidden sm:table-cell">Password</th>
              <th>Recipients</th>
              <th className="hidden md:table-cell">Sent By</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && !loading && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  No room notifications sent yet
                </td>
              </tr>
            )}
            {logs.map(log => (
              <tr key={log.id}>
                <td className="text-small" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {new Date(log.sentAt).toLocaleString()}
                </td>
                <td>
                  {log.groupName
                    ? <span className="badge badge-blue">Group {log.groupName}</span>
                    : '—'}
                </td>
                <td className="font-mono text-small">{log.roomId || '—'}</td>
                <td className="hidden sm:table-cell font-mono text-small">{log.roomPassword || '—'}</td>
                <td>
                  <span className="font-semibold" style={{ color: '#22c55e' }}>{log.recipientCount}</span>
                </td>
                <td className="hidden md:table-cell text-small" style={{ color: 'var(--text-muted)' }}>
                  {log.sentByName || 'System'}
                </td>
              </tr>
            ))}
            {loading && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '1rem' }}>
                  <span className="spinner" style={{ display: 'inline-block' }} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hasMore && !loading && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => { const next = page + 1; setPage(next); load(next) }}
            className="btn btn-secondary btn-sm"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  )
}
