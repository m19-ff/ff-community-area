'use client'
import { useAppStore } from '@/store/useAppStore'
import { Trophy, Users, Zap, Shield, ArrowRight, Play, Star, Swords } from 'lucide-react'

export default function LandingPage() {
  const { navigate } = useAppStore()

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)', overflowY: 'auto' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-6 md:px-12 py-4"
        style={{
          background: 'rgba(10,10,15,0.9)',
          borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="FF Community Arena" style={{ height: 42, width: 42, objectFit: 'contain' }} />
          <img src="/logo.png" alt="FF Community Arena" style={{ height: 28, width: 'auto', objectFit: 'contain' }} className="hidden sm:block" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('login')} className="btn btn-secondary btn-sm">
            Sign In
          </button>
          <button onClick={() => navigate('register')} className="btn btn-primary btn-sm">
            Get Started
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ minHeight: '85vh', display: 'flex', alignItems: 'center' }}>
        {/* Background effects */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(227,28,28,0.12) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: 600, height: 600,
            background: 'radial-gradient(circle, rgba(227,28,28,0.06) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Grid lines */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />

        <div className="container relative z-10 text-center mx-auto" style={{ maxWidth: 900 }}>
          {/* Hero logo */}
          <img
            src="/logo.png"
            alt="FF Community Arena"
            style={{ width: 160, height: 160, objectFit: 'contain', margin: '0 auto 1.5rem' }}
          />

          <div className="badge badge-red mb-6 mx-auto" style={{ display: 'inline-flex' }}>
            <Zap size={12} />
            The Ultimate Free Fire Esports Platform
          </div>

          <h1 className="text-display mb-6">
            Compete.
            <span style={{ color: 'var(--accent-red)' }}> Dominate.</span>
            <br />Win Rewards.
          </h1>

          <p className="text-body mb-10 mx-auto" style={{ maxWidth: 600, color: 'var(--text-secondary)' }}>
            Build your squad, enter tournaments, grind daily scrims, and earn real money.
            FF Community Arena is where Free Fire champions are made.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={() => navigate('register')}
              className="btn btn-primary btn-lg"
              style={{ minWidth: 180 }}
            >
              Start Competing
              <ArrowRight size={18} />
            </button>
            <button onClick={() => navigate('login')} className="btn btn-secondary btn-lg">
              Sign In
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-8 md:gap-16 mt-14 flex-wrap">
            {[
              { value: '10K+', label: 'Players' },
              { value: '$50K+', label: 'Prize Pool' },
              { value: '500+', label: 'Tournaments' },
              { value: '2K+', label: 'Teams' },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <div className="font-black text-2xl md:text-3xl" style={{ color: 'var(--accent-red)' }}>{value}</div>
                <div className="text-small mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="container mx-auto" style={{ maxWidth: 1100 }}>
          <div className="text-center mb-12">
            <h2 className="text-title mb-3">Everything You Need to Win</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Professional tools for serious competitors</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Trophy, title: 'Tournaments', desc: 'Battle Royale & Clash Squad formats with real prize pools', color: '#f59e0b' },
              { icon: Swords, title: 'Daily Scrims', desc: 'Practice rooms with room IDs — sharpen your skills daily', color: '#3b82f6' },
              { icon: Users, title: 'Team System', desc: 'Create or join teams, invite players, build your roster', color: '#22c55e' },
              { icon: Zap, title: 'Earn Rewards', desc: 'Points from tournaments, ads, and challenges. Withdraw to PayPal/Binance', color: '#e31c1c' },
            ].map(({ icon: Icon, title, desc, color }) => (
              <div
                key={title}
                className="card p-6"
                style={{ background: 'var(--bg-card)' }}
              >
                <div
                  className="flex items-center justify-center rounded-xl mb-4"
                  style={{ width: 48, height: 48, background: `${color}20`, border: `1px solid ${color}40` }}
                >
                  <Icon size={22} style={{ color }} />
                </div>
                <h3 className="font-bold mb-2">{title}</h3>
                <p className="text-small" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="section"
        style={{
          background: 'linear-gradient(135deg, rgba(227,28,28,0.08) 0%, transparent 60%)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div className="container text-center mx-auto" style={{ maxWidth: 600 }}>
          <h2 className="text-title mb-4">Ready to Play?</h2>
          <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>
            Join thousands of gamers competing on FF Community Arena. Free to start.
          </p>
          <button onClick={() => navigate('register')} className="btn btn-primary btn-lg glow-red">
            Create Free Account
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="py-6 text-center text-small"
        style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}
      >
        © 2025 FF Community Arena. All rights reserved. Powered by passion for Free Fire.
      </footer>
    </div>
  )
}
