# Esports Tournament Management Platform
- One-line positioning: Full-featured esports platform for teams, tournaments, scrims, and rewards
- Target users: Gamers, team captains, tournament organizers, platform admins
- Core features:
  1. User auth (email/password, JWT, email verification, forgot password)
  2. Team system (create, invite, join requests, captain controls)
  3. Tournament module (admin-created, registration, prize pools, brackets)
  4. Scrim system (daily admin-created matches with room IDs)
  5. Point/wallet system (earn via ads, tournaments, recharge, withdraw)
  6. News & announcements with push notifications
  7. Admin dashboard (stats, manage users/teams/tournaments/withdrawals)
- Important features (P1):
  1. Role management (Admin, Assistant, Captain, Player)
  2. Withdrawal system (captain-only, PayPal/Binance, min 50 USD)
  3. Ad reward system (3/day, configurable points)
  4. Firebase push notifications
- Device strategy: adaptive
- Design style: Dark esports theme — black/red/white, professional gaming UI (FACEIT-inspired)
- Technical constraints: Next.js 16 + Drizzle ORM + PostgreSQL + Tailwind v4, Cloudflare Workers
- Nova Agent: not needed
- Completed: brief.md
- Current iteration: Full platform build — auth, teams, tournaments, scrims, points, admin dashboard
