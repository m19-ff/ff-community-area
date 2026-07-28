'use client'
import { useAppStore } from '@/store/useAppStore'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

export default function Toast() {
  const { toast, clearToast } = useAppStore()
  if (!toast) return null

  const icons = {
    success: <CheckCircle size={18} className="shrink-0" />,
    error: <XCircle size={18} className="shrink-0" />,
    info: <Info size={18} className="shrink-0" />,
  }

  const styles = {
    success: 'border-green-500/30 bg-green-500/10 text-green-400',
    error: 'border-red-500/30 bg-red-500/10 text-red-400',
    info: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 fade-in" style={{ maxWidth: 380 }}>
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl shadow-2xl ${styles[toast.type]}`}
        style={{ background: 'rgba(10,10,15,0.95)' }}
      >
        {icons[toast.type]}
        <span className="text-sm font-medium flex-1" style={{ color: 'var(--text-primary)' }}>
          {toast.message}
        </span>
        <button onClick={clearToast} className="opacity-60 hover:opacity-100 transition-opacity ml-2">
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
