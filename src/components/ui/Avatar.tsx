interface AvatarProps {
  src?: string | null
  name?: string | null
  size?: number
  className?: string
}

export default function Avatar({ src, name, size = 40, className = '' }: AvatarProps) {
  const initials = name
    ? name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        className={`rounded-full object-cover shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  const colors = ['#e31c1c', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b']
  const colorIndex = (name || '').charCodeAt(0) % colors.length
  const bg = colors[colorIndex]

  return (
    <div
      className={`rounded-full flex items-center justify-center shrink-0 font-bold ${className}`}
      style={{
        width: size, height: size,
        background: `${bg}22`,
        color: bg,
        fontSize: size * 0.38,
        border: `1px solid ${bg}44`,
      }}
    >
      {initials}
    </div>
  )
}
