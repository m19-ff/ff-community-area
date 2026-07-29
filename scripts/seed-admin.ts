/**
 * scripts/seed-admin.ts
 *
 * Upserts the default admin account.
 * Run with:  DATABASE_URL=... JWT_SECRET=... npx tsx scripts/seed-admin.ts
 *
 * - Creates admin@esports.gg with role=admin if it doesn't exist.
 * - If the account already exists, promotes it to admin and unblocks it.
 * - Also ensures matching wallet and player_stats rows exist.
 *
 * The password is hashed with the same PBKDF2-SHA256 algorithm used by
 * src/lib/password.ts so the login route accepts it without any changes.
 */

import postgres from 'postgres'

const EMAIL    = 'admin@esports.gg'
const PASSWORD = 'admin123!'

async function hashPassword(password: string): Promise<string> {
  const encoder      = new TextEncoder()
  const salt         = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial  = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'],
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial, 256,
  )
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  const hashHex = Array.from(new Uint8Array(derived)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `pbkdf2:${saltHex}:${hashHex}`
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')

  const sql = postgres(process.env.DATABASE_URL, { ssl: false })

  try {
    const hash = await hashPassword(PASSWORD)

    const [user] = await sql`
      INSERT INTO users (email, password, role, email_verified, profile_completed, game_name, created_at, updated_at)
      VALUES (
        ${EMAIL},
        ${hash},
        'admin',
        true,
        true,
        'Admin',
        NOW(),
        NOW()
      )
      ON CONFLICT (email) DO UPDATE SET
        role            = 'admin',
        password        = EXCLUDED.password,
        email_verified  = true,
        is_banned       = false,
        updated_at      = NOW()
      RETURNING id, email, role
    `
    console.log(`✓ Admin account upserted — id=${user.id} email=${user.email} role=${user.role}`)

    await sql`
      INSERT INTO wallets (user_id, balance, total_earned, total_spent, created_at, updated_at)
      VALUES (${user.id}, 0, 0, 0, NOW(), NOW())
      ON CONFLICT (user_id) DO NOTHING
    `
    console.log(`✓ Wallet ensured for user id=${user.id}`)

    await sql`
      INSERT INTO player_stats (user_id, updated_at)
      VALUES (${user.id}, NOW())
      ON CONFLICT (user_id) DO NOTHING
    `
    console.log(`✓ player_stats ensured for user id=${user.id}`)

    console.log('\nAdmin account is ready:')
    console.log(`  Email:    ${EMAIL}`)
    console.log(`  Password: ${PASSWORD}`)
    console.log(`  Role:     admin`)
  } finally {
    await sql.end()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
