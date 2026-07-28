'use client'
import { useEffect, useRef, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import {
  Smartphone, Upload, CheckCircle, Eye, EyeOff,
  Trash2, Plus, RefreshCw, Download, Bell, AlertTriangle, Shield,
} from 'lucide-react'
import { PageLoader } from '../../ui/LoadingSpinner'
import Modal from '../../ui/Modal'

type Release = {
  id: number; version: string; apkUrl: string; apkSize: string | null
  releaseNotes: string | null; isPublished: boolean; forceUpdate: boolean
  publishedAt: string | null; createdAt: string
}

const EMPTY_FORM = { version: '', releaseNotes: '', publish: true, forceUpdate: false }

export default function AdminAppPage() {
  const { token, showToast } = useAppStore()
  const [releases,   setReleases]   = useState<Release[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showModal,  setShowModal]  = useState(false)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [apkFile,    setApkFile]    = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [toggling,   setToggling]   = useState<number | null>(null)
  const [forcingId,  setForcingId]  = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/app-release', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json()
    if (json.success) setReleases(json.data.releases || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setApkFile(null)
    setShowModal(true)
  }

  const submit = async () => {
    if (!form.version.trim()) { showToast('Version is required', 'error'); return }
    if (!apkFile) { showToast('Please select an APK file', 'error'); return }
    if (!apkFile.name.endsWith('.apk')) { showToast('File must be an .apk', 'error'); return }

    setSubmitting(true)
    const fd = new FormData()
    fd.append('version',      form.version.trim())
    fd.append('releaseNotes', form.releaseNotes.trim())
    fd.append('publish',      String(form.publish))
    fd.append('forceUpdate',  String(form.forceUpdate && form.publish))
    fd.append('apk',          apkFile)

    const res = await fetch('/api/app-release', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    })
    const json = await res.json()
    setSubmitting(false)

    if (json.success) {
      showToast(json.data.message || 'Release created!')
      setShowModal(false)
      load()
    } else {
      showToast(json.message || 'Failed', 'error')
    }
  }

  const togglePublish = async (r: Release) => {
    setToggling(r.id)
    const res = await fetch('/api/app-release', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, isPublished: !r.isPublished }),
    })
    const json = await res.json()
    setToggling(null)
    if (json.success) {
      showToast(r.isPublished ? 'Unpublished' : 'Published — users notified!')
      load()
    } else {
      showToast(json.message || 'Failed', 'error')
    }
  }

  const toggleForceUpdate = async (r: Release) => {
    if (!r.isPublished) { showToast('Publish the release first before enabling Force Update', 'error'); return }
    setForcingId(r.id)
    const next = !r.forceUpdate
    const res = await fetch('/api/app-release', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, forceUpdate: next }),
    })
    const json = await res.json()
    setForcingId(null)
    if (json.success) {
      showToast(next ? '⚠️ Force Update enabled — old APK users will be blocked' : 'Force Update disabled')
      load()
    } else {
      showToast(json.message || 'Failed', 'error')
    }
  }

  const publishedRelease = releases.find(r => r.isPublished)

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '2rem' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-heading flex items-center gap-2">
            <Smartphone size={20} style={{ color: 'var(--accent-red)' }} />
            App Management
          </h2>
          <p className="text-small mt-1" style={{ color: 'var(--text-muted)' }}>
            Upload APK releases, publish updates, and notify all users.
          </p>
        </div>
        <button onClick={openCreate} className="btn btn-primary">
          <Plus size={16} /> Upload New APK
        </button>
      </div>

      {/* Live release banner */}
      {publishedRelease ? (
        <div
          className="rounded-2xl p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
          style={{
            background: 'linear-gradient(135deg, rgba(34,197,94,0.10) 0%, rgba(0,0,0,0.0) 100%)',
            border: '1px solid rgba(34,197,94,0.28)',
          }}
        >
          <div
            className="flex items-center justify-center rounded-2xl shrink-0"
            style={{ width: 56, height: 56, background: 'rgba(34,197,94,0.12)', border: '1.5px solid rgba(34,197,94,0.3)' }}
          >
            <Smartphone size={28} style={{ color: '#22c55e' }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-black text-lg" style={{ color: '#22c55e' }}>
                v{publishedRelease.version}
              </span>
              <span className="badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                Live
              </span>
              {publishedRelease.forceUpdate && (
                <span className="badge flex items-center gap-1" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <AlertTriangle size={10} /> Force Update
                </span>
              )}
              {publishedRelease.apkSize && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{publishedRelease.apkSize}</span>
              )}
            </div>
            {publishedRelease.releaseNotes && (
              <p className="text-small mt-1" style={{ color: 'var(--text-secondary)' }}>
                {publishedRelease.releaseNotes}
              </p>
            )}
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Published {publishedRelease.publishedAt ? new Date(publishedRelease.publishedAt).toLocaleString() : '—'}
            </p>
          </div>
          <a
            href={publishedRelease.apkUrl}
            download
            className="btn btn-success btn-sm shrink-0"
          >
            <Download size={14} /> Test Download
          </a>
        </div>
      ) : (
        <div
          className="rounded-xl p-4 mb-6 flex items-center gap-3"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <Smartphone size={20} style={{ color: '#f59e0b' }} />
          <p className="text-small" style={{ color: '#f59e0b' }}>
            No published release yet. Upload an APK and publish it to show the Download button on the Home page.
          </p>
        </div>
      )}

      {/* Release list */}
      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Version</th>
              <th className="hidden sm:table-cell">Size</th>
              <th className="hidden md:table-cell">Release Notes</th>
              <th>Status</th>
              <th>Force Update</th>
              <th className="hidden sm:table-cell">Uploaded</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {releases.map(r => (
              <tr key={r.id}>
                <td>
                  <span className="font-bold">v{r.version}</span>
                </td>
                <td className="hidden sm:table-cell text-small" style={{ color: 'var(--text-muted)' }}>
                  {r.apkSize || '—'}
                </td>
                <td className="hidden md:table-cell text-small" style={{ color: 'var(--text-secondary)', maxWidth: 220 }}>
                  <span className="line-clamp-1">{r.releaseNotes || '—'}</span>
                </td>
                <td>
                  {r.isPublished ? (
                    <span className="badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                      Live
                    </span>
                  ) : (
                    <span className="badge" style={{ background: 'rgba(107,114,128,0.15)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.25)' }}>
                      Draft
                    </span>
                  )}
                </td>
                {/* Force Update column */}
                <td>
                  <button
                    onClick={() => toggleForceUpdate(r)}
                    disabled={forcingId === r.id || !r.isPublished}
                    title={
                      !r.isPublished
                        ? 'Publish the release first'
                        : r.forceUpdate
                          ? 'Disable Force Update'
                          : 'Enable Force Update — blocks users on older APK versions'
                    }
                    className="btn btn-sm"
                    style={{
                      background: r.forceUpdate
                        ? 'rgba(239,68,68,0.15)'
                        : 'rgba(255,255,255,0.04)',
                      border: r.forceUpdate
                        ? '1px solid rgba(239,68,68,0.4)'
                        : '1px solid var(--border)',
                      color: r.forceUpdate ? '#f87171' : 'var(--text-muted)',
                      cursor: !r.isPublished ? 'not-allowed' : 'pointer',
                      opacity: !r.isPublished ? 0.4 : 1,
                    }}
                  >
                    {forcingId === r.id ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : r.forceUpdate ? (
                      <><AlertTriangle size={12} /> On</>
                    ) : (
                      <><Shield size={12} /> Off</>
                    )}
                  </button>
                </td>
                <td className="hidden sm:table-cell text-small" style={{ color: 'var(--text-muted)' }}>
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
                <td>
                  <div className="flex gap-1 items-center">
                    <button
                      onClick={() => togglePublish(r)}
                      disabled={toggling === r.id}
                      className={`btn btn-sm ${r.isPublished ? 'btn-secondary' : 'btn-success'}`}
                      title={r.isPublished ? 'Unpublish' : 'Publish & Notify Users'}
                    >
                      {toggling === r.id ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : r.isPublished ? (
                        <><EyeOff size={13} /> Unpublish</>
                      ) : (
                        <><Bell size={13} /> Publish</>
                      )}
                    </button>
                    <a
                      href={r.apkUrl}
                      download
                      className="btn btn-secondary btn-icon btn-sm"
                      title="Download APK"
                    >
                      <Download size={13} />
                    </a>
                  </div>
                </td>
              </tr>
            ))}
            {releases.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                  No releases yet — upload your first APK
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Upload Modal */}
      {showModal && (
        <Modal title="Upload New APK Release" onClose={() => setShowModal(false)} width="520px">
          <div className="flex flex-col gap-4">

            {/* APK file picker */}
            <div className="form-group">
              <label className="label">APK File *</label>
              <div
                onClick={() => fileRef.current?.click()}
                className="rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                style={{
                  border: `2px dashed ${apkFile ? 'rgba(34,197,94,0.5)' : 'var(--border-accent)'}`,
                  background: apkFile ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.02)',
                  padding: '1.5rem',
                }}
              >
                {apkFile ? (
                  <>
                    <CheckCircle size={28} style={{ color: '#22c55e' }} />
                    <span className="font-semibold text-sm" style={{ color: '#22c55e' }}>{apkFile.name}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {(apkFile.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  </>
                ) : (
                  <>
                    <Upload size={28} style={{ color: 'var(--text-muted)' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      Click to select APK file
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Only .apk files accepted</span>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".apk,application/vnd.android.package-archive"
                className="hidden"
                onChange={e => setApkFile(e.target.files?.[0] || null)}
              />
            </div>

            {/* Version */}
            <div className="form-group">
              <label className="label">Version *</label>
              <input
                className="input"
                value={form.version}
                onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                placeholder="e.g. 1.0.0"
              />
            </div>

            {/* Release Notes */}
            <div className="form-group">
              <label className="label">Release Notes</label>
              <textarea
                className="input"
                rows={4}
                value={form.releaseNotes}
                onChange={e => setForm(f => ({ ...f, releaseNotes: e.target.value }))}
                placeholder="What's new in this version? Bug fixes, new features…"
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Publish toggle */}
            <label
              className="flex items-center gap-3 rounded-xl p-4 cursor-pointer"
              style={{
                background: form.publish ? 'rgba(34,197,94,0.07)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${form.publish ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
              }}
            >
              <input
                type="checkbox"
                checked={form.publish}
                onChange={e => setForm(f => ({ ...f, publish: e.target.checked, forceUpdate: e.target.checked ? f.forceUpdate : false }))}
                className="w-4 h-4 accent-green-500"
              />
              <div>
                <div className="font-semibold text-sm flex items-center gap-2">
                  <Bell size={14} style={{ color: form.publish ? '#22c55e' : 'var(--text-muted)' }} />
                  Publish immediately &amp; notify all users
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Unchecked = save as draft. You can publish later from the releases table.
                </p>
              </div>
            </label>

            {/* Force Update toggle — only relevant when publishing */}
            {form.publish && (
              <label
                className="flex items-center gap-3 rounded-xl p-4 cursor-pointer"
                style={{
                  background: form.forceUpdate ? 'rgba(239,68,68,0.07)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${form.forceUpdate ? 'rgba(239,68,68,0.35)' : 'var(--border)'}`,
                }}
              >
                <input
                  type="checkbox"
                  checked={form.forceUpdate}
                  onChange={e => setForm(f => ({ ...f, forceUpdate: e.target.checked }))}
                  className="w-4 h-4 accent-red-500"
                />
                <div>
                  <div className="font-semibold text-sm flex items-center gap-2">
                    <AlertTriangle size={14} style={{ color: form.forceUpdate ? '#f87171' : 'var(--text-muted)' }} />
                    Force Update
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Users running an older APK will be blocked with an &ldquo;Update Required&rdquo; screen until they install this version.
                  </p>
                </div>
              </label>
            )}

            <div className="flex gap-3">
              <button
                onClick={submit}
                disabled={submitting}
                className="btn btn-primary flex-1"
              >
                {submitting ? (
                  <><RefreshCw size={14} className="animate-spin" /> Uploading…</>
                ) : (
                  <><Upload size={14} /> {form.publish ? 'Upload & Publish' : 'Save as Draft'}</>
                )}
              </button>
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
