'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Swords, Calendar, Users, Clock, ChevronRight } from 'lucide-react'
import { PageLoader } from '../ui/LoadingSpinner'

type Scrim = {
  id: number; name: string; scheduledAt: string; mode: string;
  maxTeams: number; teamsRegistered: number; status: string;
  roomId?: string | null; roomPassword?: string | null;
}

export default function ScrimsPage() {
  const { token, myTeam, showToast } = useAppStore()
  const [scrims, setScrims] = useState<Scrim[]>([])
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState<number | null>(null)
  const [registeredIds, setRegisteredIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    apiCall('/scrims?limit=20', {}, token).then(res => {
      if (res.success && res.data) {
        setScrims((res.data as { scrims: Scrim[] }).scrims || [])
      }
      setLoading(false)
    })
  }, [token])

  const handleRegister = async (scrimId: number) => {
    setRegistering(scrimId)
    const res = await apiCall(`/scrims/${scrimId}/register`, { method: 'POST' }, token)
    setRegistering(null)
    if (res.success) {
      showToast('Team registered for scrim!')
      setRegisteredIds(prev => new Set([...prev, scrimId]))
    } else {
      showToast(res.message || 'Registration failed', 'error')
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = { upcoming: 'badge-green', live: 'badge-red', completed: 'badge-gray' }
    return map[status] || 'badge-gray'
  }

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '5rem' }}>
      <div className="mb-6">
        <h2 className="text-heading mb-1">Daily Scrims</h2>
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
          Practice rooms with real opponents. Room credentials revealed before match time.
        </p>
      </div>

      {scrims.length === 0 && (
        <div className="text-center py-20">
          <Swords size={48} style={{ margin: '0 auto 12px', color: 'var(--text-muted)', opacity: 0.4 }} />
          <p style={{ color: 'var(--text-muted)' }}>No scrims scheduled right now</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {scrims.map(s => {
          const isRegistered = registeredIds.has(s.id)
          const isFull = s.teamsRegistered >= s.maxTeams
          const scheduled = new Date(s.scheduledAt)
          const isPast = scheduled < new Date()

          return (
            <div key={s.id} className="card p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold">{s.name}</h3>
                    <span className={`badge ${statusBadge(s.status)}`}>{s.status}</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-small" style={{ color: 'var(--text-secondary)' }}>
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} />
                      {scheduled.toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={13} />
                      {scheduled.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Swords size={13} />
                      {s.mode}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users size={13} />
                      {s.teamsRegistered}/{s.maxTeams} teams
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="progress-bar mt-3" style={{ maxWidth: 200 }}>
                    <div className="progress-fill" style={{ width: `${Math.min((s.teamsRegistered / s.maxTeams) * 100, 100)}%` }} />
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  {!isPast && s.status === 'upcoming' && (
                    <button
                      onClick={() => handleRegister(s.id)}
                      disabled={isRegistered || isFull || registering === s.id || !myTeam}
                      className={`btn ${isRegistered ? 'btn-success' : 'btn-primary'}`}
                    >
                      {registering === s.id ? 'Registering...' :
                       isRegistered ? '✓ Registered' :
                       isFull ? 'Full' :
                       !myTeam ? 'Need a Team' :
                       'Register'}
                    </button>
                  )}

                  {/* Show room credentials if registered */}
                  {isRegistered && s.roomId && (
                    <div
                      className="p-3 rounded-lg text-xs"
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border-accent)' }}
                    >
                      <div className="font-bold mb-1" style={{ color: 'var(--accent-red)' }}>Room Credentials</div>
                      <div style={{ color: 'var(--text-secondary)' }}>ID: <span style={{ color: 'white', fontFamily: 'monospace' }}>{s.roomId}</span></div>
                      {s.roomPassword && (
                        <div style={{ color: 'var(--text-secondary)' }}>Pass: <span style={{ color: 'white', fontFamily: 'monospace' }}>{s.roomPassword}</span></div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
