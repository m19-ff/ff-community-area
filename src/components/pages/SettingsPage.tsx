'use client'
import { useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import {
  Moon, Sun, Globe, Bell, Lock, Trash2, Key, ChevronRight,
  Shield, Eye, EyeOff, Check, AlertTriangle
} from 'lucide-react'
import Modal from '../ui/Modal'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'fr', label: 'Français' },
]

export default function SettingsPage() {
  const { token, user, navigate, logout, showToast } = useAppStore()
  const [theme,    setTheme]    = useState<'dark'|'light'>(() =>
    typeof window !== 'undefined'
      ? (localStorage.getItem('theme') as 'dark'|'light') || 'dark'
      : 'dark'
  )
  const [lang,     setLang]     = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('lang') || 'en' : 'en'
  )
  const [notifSettings, setNotifSettings] = useState({
    tournaments: true, scrims: true, teamChat: true, achievements: true, news: true,
  })

  // Modals
  const [showPwModal,     setShowPwModal]     = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Change password form
  const [pwForm,     setPwForm]     = useState({ current: '', next: '', confirm: '' })
  const [showPw,     setShowPw]     = useState(false)
  const [pwLoading,  setPwLoading]  = useState(false)

  // Delete account form
  const [delPw,      setDelPw]      = useState('')
  const [delLoading, setDelLoading] = useState(false)

  const applyTheme = (t: 'dark'|'light') => {
    setTheme(t)
    localStorage.setItem('theme', t)
    // Apply immediately by toggling class on html element
    document.documentElement.classList.toggle('light-mode', t === 'light')
  }

  const applyLang = (l: string) => {
    setLang(l)
    localStorage.setItem('lang', l)
    showToast('Language preference saved')
  }

  const changePassword = async () => {
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) {
      showToast('All fields required', 'error'); return
    }
    if (pwForm.next !== pwForm.confirm) {
      showToast('Passwords do not match', 'error'); return
    }
    if (pwForm.next.length < 6) {
      showToast('Password must be at least 6 characters', 'error'); return
    }
    setPwLoading(true)
    const res = await apiCall('/settings', {
      method: 'POST',
      body: JSON.stringify({ action: 'change_password', currentPassword: pwForm.current, newPassword: pwForm.next }),
    }, token)
    setPwLoading(false)
    if (res.success) {
      showToast('Password changed successfully')
      setShowPwModal(false)
      setPwForm({ current: '', next: '', confirm: '' })
    } else {
      showToast(res.message || 'Failed to change password', 'error')
    }
  }

  const deleteAccount = async () => {
    if (!delPw) { showToast('Password required', 'error'); return }
    setDelLoading(true)
    const res = await apiCall('/settings', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete_account', password: delPw }),
    }, token)
    setDelLoading(false)
    if (res.success) {
      showToast('Account deleted')
      logout()
    } else {
      showToast(res.message || 'Failed to delete account', 'error')
    }
  }

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '5rem', maxWidth: 600, margin: '0 auto' }}>
      <div className="mb-6">
        <h1 className="text-xl font-black mb-1">Settings</h1>
        <p className="text-small" style={{ color: 'var(--text-muted)' }}>
          Customize your experience
        </p>
      </div>

      {/* Appearance */}
      <Section title="Appearance" icon={<Sun size={16} />}>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">Theme</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Dark or Light mode</div>
          </div>
          <div className="flex gap-2">
            {(['dark', 'light'] as const).map(t => (
              <button
                key={t}
                onClick={() => applyTheme(t)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: theme === t ? 'var(--accent-red)' : 'var(--bg-card)',
                  border: `1px solid ${theme === t ? 'var(--accent-red)' : 'var(--border)'}`,
                  color: theme === t ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {t === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
                {t === 'dark' ? 'Dark' : 'Light'}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Language */}
      <Section title="Language" icon={<Globe size={16} />}>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">App Language</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {LANGUAGES.find(l => l.code === lang)?.label}
            </div>
          </div>
          <div className="flex gap-2">
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => applyLang(l.code)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: lang === l.code ? 'var(--accent-red)' : 'var(--bg-card)',
                  border: `1px solid ${lang === l.code ? 'var(--accent-red)' : 'var(--border)'}`,
                  color: lang === l.code ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Notifications" icon={<Bell size={16} />}>
        {Object.entries(notifSettings).map(([key, enabled]) => (
          <div key={key} className="flex items-center justify-between py-2">
            <div className="font-semibold text-sm capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
            <button
              onClick={() => setNotifSettings(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))}
              className="relative w-10 h-5 rounded-full transition-all"
              style={{ background: enabled ? 'var(--accent-red)' : 'rgba(255,255,255,0.1)' }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                style={{ left: enabled ? '1.25rem' : '0.125rem' }}
              />
            </button>
          </div>
        ))}
      </Section>

      {/* Privacy */}
      <Section title="Privacy" icon={<Shield size={16} />}>
        <div className="flex items-center justify-between py-2">
          <div>
            <div className="font-semibold text-sm">Profile Visibility</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Your profile is public by default</div>
          </div>
          <span className="text-xs font-semibold" style={{ color: '#22c55e' }}>Public</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <div className="font-semibold text-sm">Game UID</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Shown on your profile</div>
          </div>
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            {user?.gameUid || 'Not set'}
          </span>
        </div>
      </Section>

      {/* Account Security */}
      <Section title="Account Security" icon={<Lock size={16} />}>
        <RowButton
          label="Change Password"
          sub="Update your login password"
          icon={<Key size={16} />}
          onClick={() => setShowPwModal(true)}
        />
        <RowButton
          label="Edit Profile"
          sub="Update name, avatar, game UID"
          icon={<ChevronRight size={16} />}
          onClick={() => navigate('player-profile')}
        />
      </Section>

      {/* Danger Zone */}
      <Section title="Danger Zone" icon={<AlertTriangle size={16} style={{ color: '#ef4444' }} />} danger>
        <RowButton
          label="Delete Account"
          sub="Permanently remove your account and all data"
          icon={<Trash2 size={16} style={{ color: '#ef4444' }} />}
          onClick={() => setShowDeleteModal(true)}
          danger
        />
      </Section>

      {/* Change Password Modal */}
      {showPwModal && (
        <Modal title="Change Password" onClose={() => setShowPwModal(false)} width="440px">
          <div className="flex flex-col gap-4">
            {(['current', 'next', 'confirm'] as const).map(field => (
              <div key={field} className="form-group">
                <label className="label">
                  {field === 'current' ? 'Current Password' : field === 'next' ? 'New Password' : 'Confirm New Password'}
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    className="input pr-10"
                    value={pwForm[field]}
                    onChange={e => setPwForm(f => ({ ...f, [field]: e.target.value }))}
                    placeholder={field === 'current' ? 'Current password' : 'New password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            ))}
            <div className="flex gap-3">
              <button onClick={changePassword} disabled={pwLoading} className="btn btn-primary flex-1">
                {pwLoading ? 'Saving…' : <><Check size={14} /> Save Password</>}
              </button>
              <button onClick={() => setShowPwModal(false)} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <Modal title="Delete Account" onClose={() => setShowDeleteModal(false)} width="440px">
          <div className="flex flex-col gap-4">
            <div
              className="rounded-xl p-4 flex items-start gap-3"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              <AlertTriangle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
              <p className="text-sm" style={{ color: '#fca5a5' }}>
                This action is <strong>irreversible</strong>. Your account, wallet, and all data will be permanently deleted.
              </p>
            </div>
            <div className="form-group">
              <label className="label">Enter your password to confirm</label>
              <input
                type="password"
                className="input"
                value={delPw}
                onChange={e => setDelPw(e.target.value)}
                placeholder="Your password"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={deleteAccount}
                disabled={delLoading}
                className="btn flex-1"
                style={{ background: 'rgba(239,68,68,0.85)', color: '#fff', border: 'none' }}
              >
                {delLoading ? 'Deleting…' : <><Trash2 size={14} /> Delete Forever</>}
              </button>
              <button onClick={() => setShowDeleteModal(false)} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Section({ title, icon, children, danger }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; danger?: boolean
}) {
  return (
    <div className="mb-4">
      <div
        className="flex items-center gap-2 px-1 mb-2"
        style={{ color: danger ? '#ef4444' : 'var(--text-muted)' }}
      >
        {icon}
        <span className="text-xs font-bold uppercase tracking-wider">{title}</span>
      </div>
      <div
        className="rounded-xl divide-y"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="px-4 py-3 flex flex-col gap-3">
          {children}
        </div>
      </div>
    </div>
  )
}

function RowButton({ label, sub, icon, onClick, danger }: {
  label: string; sub: string; icon: React.ReactNode; onClick: () => void; danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full py-1 text-left hover:opacity-80 transition-opacity"
    >
      <div style={{ color: danger ? '#ef4444' : 'var(--text-muted)' }}>{icon}</div>
      <div className="flex-1">
        <div className="font-semibold text-sm" style={{ color: danger ? '#ef4444' : 'var(--text-primary)' }}>{label}</div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</div>
      </div>
      <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
    </button>
  )
}
