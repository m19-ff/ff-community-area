export default function LoadingSpinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        border: '2px solid var(--border)',
        borderTopColor: 'var(--accent-red)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }}
    />
  )
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size={40} />
        <p className="text-small" style={{ color: 'var(--text-muted)' }}>Loading...</p>
      </div>
    </div>
  )
}
