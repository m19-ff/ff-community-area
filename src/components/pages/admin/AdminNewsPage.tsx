'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Plus, Edit, Trash2 } from 'lucide-react'
import { PageLoader } from '../../ui/LoadingSpinner'
import Modal from '../../ui/Modal'

type NewsItem = { id: number; type: string; title: string; isPublished: boolean; createdAt: string }

const EMPTY_FORM = { type: 'news', title: '', content: '', image: '', videoUrl: '', isPublished: false }

export default function AdminNewsPage() {
  const { token, showToast } = useAppStore()
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    // Fetch all news including unpublished — need admin endpoint
    apiCall('/news?limit=50', {}, token).then(res => {
      if (res.success && res.data) setItems((res.data as { news: NewsItem[] }).news || [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const submit = async () => {
    if (!form.title || !form.content) { showToast('Title and content required', 'error'); return }
    setSubmitting(true)
    const res = await apiCall('/news', { method: 'POST', body: JSON.stringify(form) }, token)
    setSubmitting(false)
    if (res.success) { showToast('News published!'); setShowModal(false); setForm(EMPTY_FORM); load() }
    else showToast(res.message || 'Failed', 'error')
  }

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '2rem' }}>
      <div className="flex justify-end mb-6">
        <button onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={16} /> Create Post
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th className="hidden md:table-cell">Created</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td className="font-medium text-small">{item.title}</td>
                <td><span className="badge badge-blue">{item.type.replace(/_/g, ' ')}</span></td>
                <td>
                  <span className={`badge ${item.isPublished ? 'badge-green' : 'badge-yellow'}`}>
                    {item.isPublished ? 'Published' : 'Draft'}
                  </span>
                </td>
                <td className="hidden md:table-cell text-small">{new Date(item.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={4} className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No news posts yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="Create News Post" onClose={() => setShowModal(false)} width="600px">
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group">
              <label className="label">Type</label>
              <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="news">News</option>
                <option value="announcement">Announcement</option>
                <option value="tournament_result">Tournament Result</option>
                <option value="qualified_teams">Qualified Teams</option>
              </select>
            </div>
            <div className="form-group flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="label" style={{ margin: 0 }}>Publish Now</span>
              </label>
            </div>
            <div className="col-span-2 form-group">
              <label className="label">Title</label>
              <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Post title" />
            </div>
            <div className="col-span-2 form-group">
              <label className="label">Content</label>
              <textarea className="input" rows={6} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} style={{ resize: 'vertical' }} />
            </div>
            <div className="col-span-2 form-group">
              <label className="label">Image URL (optional)</label>
              <input className="input" value={form.image} onChange={e => setForm(f => ({ ...f, image: e.target.value }))} placeholder="https://..." />
            </div>
          </div>
          <div className="flex gap-3 mt-2">
            <button onClick={submit} disabled={submitting} className="btn btn-primary flex-1">
              {submitting ? 'Saving...' : 'Create Post'}
            </button>
            <button onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
