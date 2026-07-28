'use client'
import { useEffect, useState } from 'react'
import { useAppStore, apiCall } from '@/store/useAppStore'
import { Zap, TrendingUp, TrendingDown, DollarSign, Plus, MessageCircle, CheckCircle, AlertTriangle, Info, Smartphone, CreditCard, Send, Clock } from 'lucide-react'
import { PageLoader } from '../ui/LoadingSpinner'
import Modal from '../ui/Modal'

type Transaction = { id: number; type: string; amount: number; description: string; createdAt: string; balanceAfter: number }
type RechargeReq = { id: number; amountPoints: number; amountUsd: string; status: string; createdAt: string }
type WithdrawReq = { id: number; amountPoints: number; amountUsd: string; method: string; status: string; createdAt: string; message: string | null }

const PACKAGES = [
  { points: 100,  usd: '$1.00',  label: 'Starter' },
  { points: 500,  usd: '$5.00',  label: 'Player'  },
  { points: 1000, usd: '$10.00', label: 'Pro'      },
  { points: 5000, usd: '$50.00', label: 'Elite'    },
]

const MIN_WITHDRAW  = 5000   // points
const COMMISSION    = 0.20   // 20 %
const PTS_PER_USD   = 100

const ADMIN_WHATSAPP = '+213657692398'

function calcWithdraw(pts: number) {
  const commission = Math.floor(pts * COMMISSION)
  const net        = pts - commission
  return {
    gross:      pts,
    grossUsd:   (pts        / PTS_PER_USD).toFixed(2),
    commission,
    commUsd:    (commission / PTS_PER_USD).toFixed(2),
    net,
    netUsd:     (net        / PTS_PER_USD).toFixed(2),
  }
}

const STATUS_COLOR: Record<string, string> = {
  pending:  '#f59e0b',
  approved: '#3b82f6',
  rejected: '#ef4444',
  paid:     '#22c55e',
}

export default function WalletPage() {
  const { token, wallet, myTeam, setWallet, showToast, user } = useAppStore()

  const [txList,          setTxList]          = useState<Transaction[]>([])
  const [rechargeHistory, setRechargeHistory] = useState<RechargeReq[]>([])
  const [withdrawHistory, setWithdrawHistory] = useState<WithdrawReq[]>([])
  const [loading,         setLoading]         = useState(true)
  const [tab,             setTab]             = useState<'transactions' | 'recharge' | 'withdraw'>('transactions')

  // ── Recharge modal state ───────────────────────────────────
  const [showRechargeModal,   setShowRechargeModal]   = useState(false)
  const [rechargeConfirmed,   setRechargeConfirmed]   = useState(false)
  const [pendingPoints,       setPendingPoints]       = useState(0)
  const [selectedPackage,     setSelectedPackage]     = useState(0)
  const [customRecharge,      setCustomRecharge]      = useState('')
  const [submittingRecharge,  setSubmittingRecharge]  = useState(false)

  // ── Withdraw modal state ───────────────────────────────────
  const [showWithdrawModal,   setShowWithdrawModal]   = useState(false)
  const [withdrawConfirmed,   setWithdrawConfirmed]   = useState(false)
  const [withdrawPts,         setWithdrawPts]         = useState('')
  const [withdrawMethod,      setWithdrawMethod]      = useState('baridimob')
  const [withdrawAddress,     setWithdrawAddress]     = useState('')
  const [withdrawNote,        setWithdrawNote]        = useState('')
  const [submittingWithdraw,  setSubmittingWithdraw]  = useState(false)
  const [withdrawSummary,     setWithdrawSummary]     = useState<ReturnType<typeof calcWithdraw> | null>(null)

  // ── Load data ──────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const [wRes, rRes, wdRes] = await Promise.all([
        apiCall('/wallet',   {}, token),
        apiCall('/recharge', {}, token),
        apiCall('/withdraw', {}, token),
      ])
      if (wRes.success && wRes.data) {
        const d = wRes.data as { wallet: typeof wallet; transactions: Transaction[] }
        if (d.wallet) setWallet(d.wallet)
        setTxList(d.transactions || [])
      }
      if (rRes.success  && rRes.data)  setRechargeHistory((rRes.data  as { requests:   RechargeReq[] }).requests   || [])
      if (wdRes.success && wdRes.data) setWithdrawHistory((wdRes.data as { withdrawals: WithdrawReq[] }).withdrawals || [])
      setLoading(false)
    }
    load()
  }, [token])

  // ── Live commission preview ────────────────────────────────
  const pts  = parseInt(withdrawPts) || 0
  const calc = pts >= MIN_WITHDRAW ? calcWithdraw(pts) : null

  // ── WhatsApp helpers ───────────────────────────────────────
  const rechargeWaLink = (points: number) => {
    const usd = (points / PTS_PER_USD).toFixed(2)
    const msg = encodeURIComponent(
      `Hello Admin, I want to top up my FF Community Arena wallet with ${points} points ($${usd} USD). Please confirm my recharge request. Username: ${user?.gameName || user?.email}`
    )
    return `https://wa.me/${ADMIN_WHATSAPP.replace(/\D/g, '')}?text=${msg}`
  }

  // ── Submit recharge ────────────────────────────────────────
  const submitRecharge = async () => {
    const points = selectedPackage > 0 ? selectedPackage : parseInt(customRecharge)
    if (!points || points < 100) { showToast('Minimum recharge is 100 points', 'error'); return }
    setSubmittingRecharge(true)
    const res = await apiCall('/recharge', { method: 'POST', body: JSON.stringify({ amountPoints: points }) }, token)
    setSubmittingRecharge(false)
    if (res.success) {
      setPendingPoints(points)
      setRechargeConfirmed(true)
    } else {
      showToast(res.message || 'Failed', 'error')
    }
  }

  const closeRechargeModal = () => {
    setShowRechargeModal(false)
    setRechargeConfirmed(false)
    setPendingPoints(0)
    setSelectedPackage(0)
    setCustomRecharge('')
  }

  // ── Submit withdraw ────────────────────────────────────────
  const submitWithdraw = async () => {
    const points = parseInt(withdrawPts)
    if (!points || points < MIN_WITHDRAW) {
      showToast(`Minimum withdrawal is ${MIN_WITHDRAW.toLocaleString()} points`, 'error'); return
    }
    if (!withdrawAddress.trim()) { showToast('Payment address is required', 'error'); return }
    if ((wallet?.balance || 0) < points) {
      showToast('Insufficient balance', 'error'); return
    }
    setSubmittingWithdraw(true)
    const res = await apiCall('/withdraw', {
      method: 'POST',
      body: JSON.stringify({
        amountPoints: points,
        method: withdrawMethod,
        paymentAddress: withdrawAddress.trim(),
        message: withdrawNote.trim(),
      }),
    }, token)
    setSubmittingWithdraw(false)
    if (res.success) {
      const data = res.data as { summary: ReturnType<typeof calcWithdraw> }
      setWithdrawSummary(data?.summary || calcWithdraw(points))
      // Update local wallet balance
      if (wallet) setWallet({ ...wallet, balance: wallet.balance - points })
      setWithdrawConfirmed(true)
      // Refresh withdraw history
      apiCall('/withdraw', {}, token).then(r => {
        if (r.success && r.data) setWithdrawHistory((r.data as { withdrawals: WithdrawReq[] }).withdrawals || [])
      })
    } else {
      showToast(res.message || 'Failed', 'error')
    }
  }

  const closeWithdrawModal = () => {
    setShowWithdrawModal(false)
    setWithdrawConfirmed(false)
    setWithdrawSummary(null)
    setWithdrawPts('')
    setWithdrawAddress('')
    setWithdrawNote('')
    setWithdrawMethod('baridimob')
  }

  // ── Helpers ────────────────────────────────────────────────
  const txColor = (type: string) =>
    type.includes('earn') || ['recharge', 'admin_award', 'team_split'].includes(type) ? '#22c55e' : '#ef4444'
  const txIcon  = (type: string) =>
    type.includes('earn') || ['recharge', 'admin_award', 'team_split'].includes(type) ? TrendingUp : TrendingDown

  if (loading) return <PageLoader />

  return (
    <div style={{ padding: '1.5rem', paddingBottom: '5rem' }}>

      {/* ── Balance cards ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div
          className="card p-6 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg,rgba(227,28,28,0.1) 0%,var(--bg-card) 100%)', border: '1px solid var(--border-accent)' }}
        >
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--accent-red)' }}>My Balance</div>
          <div className="text-3xl font-black mb-1">{wallet?.balance?.toLocaleString() || 0}</div>
          <div className="text-small" style={{ color: 'var(--text-muted)' }}>points · ${wallet?.usdValue || '0.00'} USD</div>
          <Zap size={80} className="absolute right-4 bottom-4 opacity-5" style={{ color: 'var(--accent-red)' }} />
        </div>
        <div className="stat-card">
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Total Earned</div>
          <div className="text-2xl font-bold text-green-400">{wallet?.totalEarned?.toLocaleString() || 0}</div>
          <div className="text-small mt-1" style={{ color: 'var(--text-muted)' }}>lifetime points</div>
        </div>
        <div className="stat-card">
          <div className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Team Points</div>
          <div className="text-2xl font-bold" style={{ color: '#8b5cf6' }}>{myTeam?.points?.toLocaleString() || 0}</div>
          <div className="text-small mt-1" style={{ color: 'var(--text-muted)' }}>{myTeam?.name || 'No team'}</div>
        </div>
      </div>

      {/* ── Action buttons ────────────────────────────────── */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <button onClick={() => setShowRechargeModal(true)} className="btn btn-primary">
          <Plus size={16} /> Recharge Points
        </button>
        <button onClick={() => setShowWithdrawModal(true)} className="btn btn-secondary">
          <DollarSign size={16} /> Withdraw
        </button>
      </div>

      {/* ── Withdraw eligibility notice ───────────────────── */}
      {(wallet?.balance || 0) < MIN_WITHDRAW && (
        <div
          className="flex items-start gap-3 rounded-xl p-4 mb-6"
          style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
          <p className="text-small" style={{ color: 'rgba(245,158,11,0.9)' }}>
            You need at least <strong>{MIN_WITHDRAW.toLocaleString()} points</strong> to withdraw.
            You currently have <strong>{(wallet?.balance || 0).toLocaleString()} pts</strong> — need{' '}
            <strong>{Math.max(0, MIN_WITHDRAW - (wallet?.balance || 0)).toLocaleString()} more pts</strong>.
          </p>
        </div>
      )}

      {/* ── Tabs ──────────────────────────────────────────── */}
      <div className="flex gap-2 mb-6" style={{ borderBottom: '1px solid var(--border)' }}>
        {(['transactions', 'recharge', 'withdraw'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="btn btn-sm"
            style={{
              borderRadius: '8px 8px 0 0',
              color:        tab === t ? 'var(--accent-red)' : 'var(--text-secondary)',
              borderBottom: tab === t ? '2px solid var(--accent-red)' : '2px solid transparent',
              background:   'transparent',
            }}
          >
            {t === 'transactions' ? 'Transactions' : t === 'recharge' ? 'Recharge History' : 'Withdrawals'}
          </button>
        ))}
      </div>

      {/* ── Transactions ──────────────────────────────────── */}
      {tab === 'transactions' && (
        <div className="card">
          {txList.length === 0 && (
            <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>No transactions yet</div>
          )}
          {txList.map(tx => {
            const Icon  = txIcon(tx.type)
            const color = txColor(tx.type)
            return (
              <div key={tx.id} className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center justify-center rounded-lg shrink-0" style={{ width: 36, height: 36, background: `${color}18` }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <div className="flex-1">
                  <div className="text-small font-medium">{tx.description}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(tx.createdAt).toLocaleString()}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold" style={{ color }}>{tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} pts</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Balance: {tx.balanceAfter.toLocaleString()}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Recharge history ──────────────────────────────── */}
      {tab === 'recharge' && (
        <>
          {/* BaridiMob / CCP Guide Card */}
          <div
            className="rounded-2xl mb-5 overflow-hidden"
            style={{ border: '1px solid rgba(0,183,255,0.22)', background: 'linear-gradient(135deg, rgba(0,100,200,0.10) 0%, rgba(0,30,80,0.18) 100%)' }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ background: 'rgba(0,100,200,0.15)', borderBottom: '1px solid rgba(0,183,255,0.15)' }}
            >
              <div style={{ fontSize: '1.4rem', lineHeight: 1 }}>🇩🇿</div>
              <div>
                <div className="font-black text-sm" style={{ color: '#60b4ff', letterSpacing: '0.03em' }}>
                  كيفية الشحن عبر BaridiMob / CCP
                </div>
                <div className="text-xs" style={{ color: 'rgba(96,180,255,0.65)' }}>How to recharge via BaridiMob / CCP</div>
              </div>
            </div>

            {/* Steps */}
            <div className="px-4 py-4 grid gap-3">
              {[
                {
                  icon: <Smartphone size={16} />,
                  step: '1',
                  title: 'افتح تطبيق BaridiMob',
                  sub: 'Open the BaridiMob app on your phone',
                  color: '#60b4ff',
                },
                {
                  icon: <Send size={16} />,
                  step: '2',
                  title: `أرسل المبلغ إلى رقم CCP الخاص بالمشرف`,
                  sub: `Send the exact amount to admin CCP — then contact admin on WhatsApp: ${ADMIN_WHATSAPP}`,
                  color: '#60b4ff',
                },
                {
                  icon: <CreditCard size={16} />,
                  step: '3',
                  title: 'احفظ لقطة شاشة للتحويل',
                  sub: 'Screenshot the transfer confirmation to send to admin',
                  color: '#60b4ff',
                },
                {
                  icon: <MessageCircle size={16} />,
                  step: '4',
                  title: 'أرسل طلب الشحن هنا + أرسل اللقطة عبر واتساب',
                  sub: 'Submit a recharge request on this page, then send the screenshot to admin via WhatsApp',
                  color: '#25d366',
                },
                {
                  icon: <Clock size={16} />,
                  step: '5',
                  title: 'انتظر التأكيد — خلال 24 ساعة',
                  sub: 'Admin will verify and credit your points within 24 hours',
                  color: '#f59e0b',
                },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-3">
                  <div
                    className="flex items-center justify-center shrink-0 font-black text-xs"
                    style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: `${s.color}22`, border: `1.5px solid ${s.color}55`,
                      color: s.color,
                    }}
                  >
                    {s.step}
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: '#e2eeff' }}>{s.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(180,210,255,0.65)' }}>{s.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="px-4 pb-4 flex gap-2 flex-wrap">
              <a
                href={`https://wa.me/${ADMIN_WHATSAPP.replace(/\D/g, '')}?text=${encodeURIComponent('السلام عليكم، أريد شحن نقاط عبر BaridiMob/CCP — FF Community Arena')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#25d366', color: '#fff', fontWeight: 700, fontSize: '0.8rem',
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  borderRadius: '0.6rem', padding: '0.5rem 1rem', textDecoration: 'none',
                }}
              >
                <MessageCircle size={14} /> تواصل مع المشرف عبر واتساب
              </a>
              <button
                onClick={() => setShowRechargeModal(true)}
                style={{
                  background: 'rgba(0,100,200,0.18)', color: '#60b4ff', fontWeight: 700, fontSize: '0.8rem',
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  borderRadius: '0.6rem', padding: '0.5rem 1rem', border: '1px solid rgba(0,183,255,0.25)',
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} /> طلب شحن جديد
              </button>
            </div>
          </div>

          <div className="card">
          {rechargeHistory.length === 0 && (
            <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>No recharge requests</div>
          )}
          {rechargeHistory.map(r => (
            <div key={r.id} className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex-1">
                <div className="font-medium">{r.amountPoints.toLocaleString()} pts</div>
                <div className="text-small" style={{ color: 'var(--text-muted)' }}>${r.amountUsd} · {new Date(r.createdAt).toLocaleDateString()}</div>
              </div>
              <span className={`badge ${r.status === 'approved' ? 'badge-green' : r.status === 'rejected' ? 'badge-red' : 'badge-yellow'}`}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
        </>
      )}

      {/* ── Withdrawal history ────────────────────────────── */}
      {tab === 'withdraw' && (
        <div className="card">
          {/* Commission info banner */}
          <div
            className="flex items-start gap-3 p-4"
            style={{ borderBottom: '1px solid var(--border)', background: 'rgba(139,92,246,0.05)' }}
          >
            <Info size={16} style={{ color: '#8b5cf6', flexShrink: 0, marginTop: 2 }} />
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              A <strong style={{ color: '#8b5cf6' }}>20% commission</strong> is deducted from every withdrawal.
              Minimum: <strong>{MIN_WITHDRAW.toLocaleString()} pts</strong> · Rate: 100 pts = $1.00
            </p>
          </div>
          {withdrawHistory.length === 0 && (
            <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>No withdrawal requests yet</div>
          )}
          {withdrawHistory.map(w => (
            <div key={w.id} className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="flex-1">
                <div className="font-medium">${w.amountUsd} net</div>
                <div className="text-small" style={{ color: 'var(--text-muted)' }}>
                  {w.method === 'baridimob' ? 'BaridiMob 🇩🇿' : w.method === 'binance' ? 'Binance' : 'PayPal'} · {new Date(w.createdAt).toLocaleDateString()}
                </div>
              </div>
              <span
                className="badge"
                style={{
                  background: `${STATUS_COLOR[w.status]}18`,
                  color:      STATUS_COLOR[w.status],
                  border:     `1px solid ${STATUS_COLOR[w.status]}30`,
                }}
              >
                {w.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          RECHARGE MODAL
      ════════════════════════════════════════════════════ */}
      {showRechargeModal && (
        <Modal title="Recharge Points" onClose={closeRechargeModal}>
          {!rechargeConfirmed ? (
            <>
              {/* BaridiMob inline reminder */}
              <div
                className="flex items-start gap-3 rounded-xl p-3 mb-4"
                style={{ background: 'rgba(0,100,200,0.10)', border: '1px solid rgba(0,183,255,0.20)' }}
              >
                <div style={{ fontSize: '1.1rem', lineHeight: 1, flexShrink: 0, marginTop: 2 }}>🇩🇿</div>
                <div className="text-xs" style={{ color: 'rgba(180,210,255,0.85)', lineHeight: 1.6 }}>
                  <span className="font-bold" style={{ color: '#60b4ff' }}>BaridiMob / CCP: </span>
                  حوّل المبلغ إلى حساب المشرف، ثم أرسل لقطة الشاشة عبر واتساب{' '}
                  <a
                    href={`https://wa.me/${ADMIN_WHATSAPP.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#25d366', fontWeight: 700 }}
                  >
                    {ADMIN_WHATSAPP}
                  </a>
                  {' '}مع طلب الشحن أدناه.
                  <br />
                  <span style={{ color: 'rgba(180,210,255,0.55)' }}>Transfer the amount to admin CCP, send screenshot to admin on WhatsApp along with your recharge request below.</span>
                </div>
              </div>
              <p className="text-small mb-4" style={{ color: 'var(--text-secondary)' }}>
                Choose a package or enter a custom amount. Minimum 100 points.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {PACKAGES.map(pkg => (
                  <button
                    key={pkg.points}
                    onClick={() => { setSelectedPackage(pkg.points); setCustomRecharge('') }}
                    className="card p-3 text-left"
                    style={{
                      border:     selectedPackage === pkg.points ? '2px solid var(--accent-red)' : '1px solid var(--border)',
                      background: selectedPackage === pkg.points ? 'var(--accent-red-dim)' : 'var(--bg-card)',
                      cursor:     'pointer',
                    }}
                  >
                    <div className="font-bold">{pkg.points.toLocaleString()} pts</div>
                    <div className="text-small" style={{ color: 'var(--text-muted)' }}>{pkg.usd} · {pkg.label}</div>
                  </button>
                ))}
              </div>
              <div className="form-group">
                <label className="label">Custom Amount (min 100 pts)</label>
                <input
                  className="input"
                  type="number"
                  value={customRecharge}
                  onChange={e => { setCustomRecharge(e.target.value); setSelectedPackage(0) }}
                  placeholder="Enter custom points"
                  min={100}
                />
              </div>
              <div className="flex gap-3">
                <button onClick={submitRecharge} disabled={submittingRecharge} className="btn btn-primary flex-1">
                  {submittingRecharge ? 'Submitting...' : 'Submit Request'}
                </button>
                <button onClick={closeRechargeModal} className="btn btn-secondary">Cancel</button>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <CheckCircle size={32} style={{ color: '#22c55e' }} />
              </div>
              <h3 className="text-heading mb-2">Request Submitted!</h3>
              <p className="text-small mb-6" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Your top-up request for{' '}
                <span className="font-bold" style={{ color: '#22c55e' }}>{pendingPoints.toLocaleString()} pts</span>{' '}
                (${(pendingPoints / PTS_PER_USD).toFixed(2)} USD) has been recorded.
              </p>
              <div style={{ background: 'rgba(37,211,102,0.07)', border: '1px solid rgba(37,211,102,0.25)', borderRadius: '0.875rem', padding: '1.25rem', marginBottom: '1.25rem', textAlign: 'left' }}>
                <div className="flex items-start gap-3">
                  <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: 'rgba(37,211,102,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageCircle size={20} style={{ color: '#25d366' }} />
                  </div>
                  <div>
                    <div className="font-bold text-sm mb-1" style={{ color: '#fff' }}>Confirm with Admin on WhatsApp</div>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      To activate your recharge, contact the admin on WhatsApp:
                    </p>
                    <div className="font-bold mt-2" style={{ color: '#25d366', fontSize: '1rem' }}>{ADMIN_WHATSAPP}</div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <a
                  href={rechargeWaLink(pendingPoints)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeRechargeModal}
                  style={{ background: '#25d366', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', borderRadius: '0.625rem', padding: '0.75rem 1rem', textDecoration: 'none' }}
                >
                  <MessageCircle size={18} /> Open WhatsApp
                </a>
                <button onClick={closeRechargeModal} className="btn btn-secondary">I'll contact later</button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ════════════════════════════════════════════════════
          WITHDRAW MODAL
      ════════════════════════════════════════════════════ */}
      {showWithdrawModal && (
        <Modal title="Withdraw Funds" onClose={closeWithdrawModal} width="520px">
          {!withdrawConfirmed ? (
            <>
              {/* ── Commission notice ── */}
              <div
                className="flex items-start gap-3 rounded-xl p-4 mb-5"
                style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)' }}
              >
                <Info size={18} style={{ color: '#8b5cf6', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div className="font-bold text-sm mb-1" style={{ color: '#8b5cf6' }}>
                    20% Commission on every withdrawal
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    The platform deducts a <strong>20% service commission</strong> from every withdrawal.
                    For example: withdrawing <strong>5,000 pts</strong> → you receive <strong>$40.00</strong> (4,000 pts net).
                  </p>
                  <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>Min: <strong style={{ color: '#fff' }}>{MIN_WITHDRAW.toLocaleString()} pts</strong></span>
                    <span>Rate: <strong style={{ color: '#fff' }}>100 pts = $1.00</strong></span>
                    <span>Balance: <strong style={{ color: '#22c55e' }}>{(wallet?.balance || 0).toLocaleString()} pts</strong></span>
                  </div>
                </div>
              </div>

              {/* ── Amount input ── */}
              <div className="form-group">
                <label className="label">Amount to Withdraw (points) *</label>
                <input
                  className="input"
                  type="number"
                  value={withdrawPts}
                  onChange={e => setWithdrawPts(e.target.value)}
                  placeholder={`Min ${MIN_WITHDRAW.toLocaleString()} pts`}
                  min={MIN_WITHDRAW}
                  max={wallet?.balance || 0}
                />
              </div>

              {/* ── Live commission breakdown ── */}
              {pts > 0 && pts < MIN_WITHDRAW && (
                <div className="rounded-lg p-3 mb-4 text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                  ⚠ Minimum is {MIN_WITHDRAW.toLocaleString()} pts. You need {(MIN_WITHDRAW - pts).toLocaleString()} more pts.
                </div>
              )}
              {calc && (
                <div
                  className="rounded-xl p-4 mb-4"
                  style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)' }}
                >
                  <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                    Breakdown
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-small">
                      <span style={{ color: 'var(--text-secondary)' }}>Gross withdrawal</span>
                      <span className="font-bold">{calc.gross.toLocaleString()} pts = <span style={{ color: '#fff' }}>${calc.grossUsd}</span></span>
                    </div>
                    <div className="flex justify-between text-small">
                      <span style={{ color: 'var(--text-secondary)' }}>Commission (20%)</span>
                      <span className="font-bold" style={{ color: '#ef4444' }}>− {calc.commission.toLocaleString()} pts = ${calc.commUsd}</span>
                    </div>
                    <div
                      className="flex justify-between text-small pt-2 mt-1"
                      style={{ borderTop: '1px solid rgba(34,197,94,0.2)' }}
                    >
                      <span className="font-bold" style={{ color: '#22c55e' }}>You receive</span>
                      <span className="font-black" style={{ color: '#22c55e', fontSize: '1rem' }}>
                        {calc.net.toLocaleString()} pts = ${calc.netUsd}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Method & address ── */}
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="label">Payment Method</label>
                  <select className="input" value={withdrawMethod} onChange={e => setWithdrawMethod(e.target.value)}>
                    <option value="baridimob">BaridiMob 🇩🇿</option>
                    <option value="paypal">PayPal</option>
                    <option value="binance">Binance</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="label">
                    {withdrawMethod === 'paypal' ? 'PayPal Email'
                      : withdrawMethod === 'binance' ? 'Binance UID'
                      : 'CCP / RIP Account Number'}
                  </label>
                  <input
                    className="input"
                    value={withdrawAddress}
                    onChange={e => setWithdrawAddress(e.target.value)}
                    placeholder={
                      withdrawMethod === 'paypal' ? 'paypal@email.com'
                      : withdrawMethod === 'binance' ? 'Binance UID'
                      : 'e.g. 00799999 00 (CCP)'
                    }
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="label">Note (optional)</label>
                <textarea className="input" rows={2} value={withdrawNote} onChange={e => setWithdrawNote(e.target.value)} style={{ resize: 'vertical' }} />
              </div>

              <div className="flex gap-3 mt-1">
                <button
                  onClick={submitWithdraw}
                  disabled={submittingWithdraw || !calc || (wallet?.balance || 0) < pts}
                  className="btn btn-primary flex-1"
                >
                  {submittingWithdraw ? 'Submitting...' : 'Submit Withdrawal'}
                </button>
                <button onClick={closeWithdrawModal} className="btn btn-secondary">Cancel</button>
              </div>
            </>
          ) : (
            /* ── Success screen ── */
            <div className="text-center">
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <CheckCircle size={32} style={{ color: '#22c55e' }} />
              </div>
              <h3 className="text-heading mb-2">Withdrawal Submitted!</h3>
              <p className="text-small mb-5" style={{ color: 'var(--text-secondary)' }}>
                Your request is pending admin approval.
              </p>
              {withdrawSummary && (
                <div className="rounded-xl p-4 mb-5 text-left" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <div className="flex justify-between text-small mb-2">
                    <span style={{ color: 'var(--text-secondary)' }}>Gross</span>
                    <span>{withdrawSummary.gross.toLocaleString()} pts = ${withdrawSummary.grossUsd}</span>
                  </div>
                  <div className="flex justify-between text-small mb-2">
                    <span style={{ color: 'var(--text-secondary)' }}>Commission (20%)</span>
                    <span style={{ color: '#ef4444' }}>− {withdrawSummary.commission.toLocaleString()} pts</span>
                  </div>
                  <div className="flex justify-between font-black" style={{ color: '#22c55e', fontSize: '1.05rem', borderTop: '1px solid rgba(34,197,94,0.2)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                    <span>Net payout</span>
                    <span>${withdrawSummary.netUsd}</span>
                  </div>
                </div>
              )}
              <button onClick={closeWithdrawModal} className="btn btn-primary w-full">Done</button>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
