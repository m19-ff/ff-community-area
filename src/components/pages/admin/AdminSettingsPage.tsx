'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Save, Settings } from 'lucide-react'
import { PageLoader } from '../../ui/LoadingSpinner'

export default function AdminSettingsPage() {
  const { token, showToast } = useAppStore()
  const [adReward, setAdReward] = useState('10')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  // In a real app, load settings from DB
  const saveSettings = async () => {
    setSaving(true)
    // Settings API would be here
    await new Promise(r => setTimeout(r, 500))
    setSaving(false)
    showToast('Settings saved!')
  }

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '2rem', maxWidth: 600 }}>
      <div className="card p-6 mb-4">
        <h3 className="text-heading mb-4 flex items-center gap-2">
          <Settings size={18} style={{ color: 'var(--accent-red)' }} /> Reward Settings
        </h3>
        <div className="form-group">
          <label className="label">Ad Reward Points (per ad)</label>
          <input
            className="input"
            type="number"
            value={adReward}
            onChange={e => setAdReward(e.target.value)}
            min={1}
            max={1000}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Points awarded to users for each ad watched. Current: {adReward} pts/ad
          </p>
        </div>
        <button onClick={saveSettings} disabled={saving} className="btn btn-primary">
          <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="card p-6 mb-4">
        <h3 className="text-heading mb-4">Platform Info</h3>
        <div className="grid grid-cols-2 gap-4 text-small">
          <div>
            <div className="label">Points Per USD</div>
            <div className="font-bold text-lg">100</div>
          </div>
          <div>
            <div className="label">Min Withdrawal</div>
            <div className="font-bold text-lg">$50</div>
          </div>
          <div>
            <div className="label">Max Ads/Day</div>
            <div className="font-bold text-lg">3</div>
          </div>
          <div>
            <div className="label">Min Team Size</div>
            <div className="font-bold text-lg">4</div>
          </div>
          <div>
            <div className="label">Max Team Size</div>
            <div className="font-bold text-lg">6</div>
          </div>
          <div>
            <div className="label">Withdrawal Methods</div>
            <div className="font-bold">PayPal, Binance</div>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-heading mb-4">API Documentation</h3>
        <p className="text-small mb-4" style={{ color: 'var(--text-secondary)' }}>
          All REST API endpoints available:
        </p>
        <div className="flex flex-col gap-2">
          {[
            'POST /api/auth/register',
            'POST /api/auth/login',
            'POST /api/auth/verify-email',
            'POST /api/auth/forgot-password',
            'POST /api/auth/reset-password',
            'GET/PATCH /api/auth/profile',
            'GET/POST /api/teams',
            'GET/PATCH/DELETE /api/teams/:id',
            'POST /api/teams/:id/invite',
            'GET/PATCH /api/teams/invitations',
            'GET/POST/PATCH /api/teams/join-request',
            'GET/POST /api/tournaments',
            'GET/PATCH/DELETE /api/tournaments/:id',
            'POST /api/tournaments/:id/register',
            'GET/POST /api/scrims',
            'POST /api/scrims/:id/register',
            'GET /api/wallet',
            'POST /api/ads/watch',
            'GET/POST /api/withdraw',
            'PATCH /api/withdraw/:id',
            'GET/POST /api/recharge',
            'POST /api/recharge/:id/approve',
            'GET/POST /api/news',
            'GET/PATCH /api/notifications',
            'GET /api/admin/stats',
            'GET /api/admin/users',
            'PATCH /api/admin/users/:id',
          ].map(endpoint => (
            <div key={endpoint} className="flex items-center gap-2 text-xs" style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
              <span
                style={{
                  color: endpoint.startsWith('GET') ? '#22c55e' :
                    endpoint.startsWith('POST') ? '#3b82f6' :
                    endpoint.startsWith('PATCH') ? '#f59e0b' :
                    '#ef4444',
                  minWidth: 90,
                }}
              >
                {endpoint.split(' ')[0]}
              </span>
              <span style={{ color: 'var(--text-primary)' }}>{endpoint.split(' ')[1]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
