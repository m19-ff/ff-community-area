'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Send, MessageCircle, Image, ChevronDown } from 'lucide-react'
import Avatar from '../ui/Avatar'
import { PageLoader } from '../ui/LoadingSpinner'

type ChatMessage = {
  id: number; type: string; content: string; imageUrl?: string | null
  createdAt: string; userId: number | null; gameName: string | null
  profilePicture: string | null; readBy: number[]
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(date).toLocaleDateString()
}

export default function TeamChatPage() {
  const { token, user, myTeam } = useAppStore()
  const [messages,    setMessages]    = useState<ChatMessage[]>([])
  const [loading,     setLoading]     = useState(true)
  const [sending,     setSending]     = useState(false)
  const [text,        setText]        = useState('')
  const [hasMore,     setHasMore]     = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [unread,      setUnread]      = useState(0)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const teamId     = myTeam?.id

  const load = useCallback(async (before?: number) => {
    if (!teamId) return
    const url = `/chat?teamId=${teamId}${before ? `&before=${before}` : ''}&limit=30`
    const res  = await apiCall(url, {}, token)
    if (res.success && res.data) {
      const d = res.data as { messages: ChatMessage[]; hasMore: boolean; unread: number }
      if (before) {
        setMessages(prev => [...(d.messages || []), ...prev])
      } else {
        setMessages(d.messages || [])
        setUnread(d.unread || 0)
      }
      setHasMore(d.hasMore || false)
    }
  }, [teamId, token])

  // Initial load
  useEffect(() => {
    if (!teamId) { setLoading(false); return }
    load().then(() => setLoading(false))
  }, [teamId, load])

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loading) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }), 50)
    }
  }, [loading])

  // Poll for new messages every 5s
  useEffect(() => {
    if (!teamId) return
    pollRef.current = setInterval(async () => {
      const res = await apiCall(`/chat?teamId=${teamId}&limit=10`, {}, token)
      if (res.success && res.data) {
        const d = res.data as { messages: ChatMessage[] }
        const newMsgs = d.messages || []
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id))
          const added = newMsgs.filter(m => !ids.has(m.id))
          if (added.length === 0) return prev
          // Scroll to bottom for new messages
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          return [...prev, ...added]
        })
      }
    }, 5000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [teamId, token])

  const send = async () => {
    if (!text.trim() || !teamId || sending) return
    const content = text.trim()
    setText('')
    setSending(true)

    // Optimistic
    const optimistic: ChatMessage = {
      id: Date.now(), type: 'message', content, createdAt: new Date().toISOString(),
      userId: user?.id ?? null, gameName: user?.gameName ?? null, profilePicture: user?.profilePicture ?? null, readBy: [user?.id ?? 0],
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    const res = await apiCall('/chat', { method: 'POST', body: JSON.stringify({ teamId, content }) }, token)
    if (res.success && res.data) {
      const d = res.data as { message: ChatMessage }
      setMessages(prev => prev.map(m => m.id === optimistic.id ? d.message : m))
    }
    setSending(false)
  }

  const loadMore = async () => {
    if (!hasMore || loadingMore || messages.length === 0) return
    setLoadingMore(true)
    await load(messages[0]?.id)
    setLoadingMore(false)
  }

  if (!myTeam) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-10 text-center">
        <MessageCircle size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
        <h3 className="text-heading mb-2">Join a Team First</h3>
        <p className="text-small" style={{ color: 'var(--text-muted)' }}>
          Team Chat is only available to team members.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
      {/* Chat header */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}
      >
        <Avatar src={myTeam.logo} name={myTeam.name} size={36} />
        <div>
          <div className="font-bold text-sm">{myTeam.name}</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Team Chat</div>
        </div>
        {unread > 0 && (
          <span
            className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: 'var(--accent-red)', color: '#fff' }}
          >
            {unread} new
          </span>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 no-scrollbar" style={{ paddingBottom: '1rem' }}>
        {loading ? (
          <div className="flex justify-center mt-10"><PageLoader /></div>
        ) : (
          <>
            {hasMore && (
              <div className="flex justify-center mb-4">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="btn btn-secondary btn-sm"
                >
                  {loadingMore ? 'Loading…' : <><ChevronDown size={14} /> Load earlier</>}
                </button>
              </div>
            )}

            {messages.length === 0 && (
              <div className="text-center mt-16" style={{ color: 'var(--text-muted)' }}>
                <MessageCircle size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No messages yet. Say hello!</p>
              </div>
            )}

            {messages.map((msg) => {
              const isMe     = msg.userId === user?.id
              const isSystem = msg.type === 'system'

              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center my-2">
                    <div
                      className="px-3 py-1 rounded-full text-xs"
                      style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}
                    >
                      {msg.content}
                    </div>
                  </div>
                )
              }

              return (
                <div key={msg.id} className={`flex gap-2.5 mb-4 ${isMe ? 'flex-row-reverse' : ''}`}>
                  {!isMe && (
                    <Avatar src={msg.profilePicture} name={msg.gameName || '?'} size={32} className="shrink-0 mt-1" />
                  )}
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
                    {!isMe && (
                      <span className="text-xs mb-1 font-semibold" style={{ color: 'var(--text-muted)' }}>
                        {msg.gameName || 'Unknown'}
                      </span>
                    )}
                    <div
                      className="px-3.5 py-2.5 rounded-2xl text-sm break-words"
                      style={{
                        background: isMe ? 'var(--accent-red)' : 'var(--bg-card)',
                        color: isMe ? '#fff' : 'var(--text-primary)',
                        borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        border: isMe ? 'none' : '1px solid var(--border)',
                      }}
                    >
                      {msg.imageUrl && (
                        <img
                          src={msg.imageUrl}
                          alt="Image"
                          className="rounded-lg mb-2 max-w-full"
                          style={{ maxHeight: 200 }}
                        />
                      )}
                      {msg.content}
                    </div>
                    <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      {timeAgo(msg.createdAt)}
                    </span>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div
        className="px-4 py-3 shrink-0 flex items-center gap-3"
        style={{
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border)',
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.75rem)',
        }}
      >
        <div
          className="flex-1 flex items-center gap-2 rounded-2xl px-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', minHeight: 44 }}
        >
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="Type a message…"
            className="flex-1 bg-transparent outline-none text-sm py-2.5"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className="btn btn-primary btn-icon rounded-full shrink-0"
          style={{ width: 44, height: 44, borderRadius: '50%' }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}
