import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { users, wallets, settings } from './schema'

async function main() {
  const client = postgres(process.env.DATABASE_URL!)
  const db = drizzle(client)

  await db.insert(settings).values({ key: 'ad_reward_points', value: '10' }).onConflictDoNothing()

  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode('admin123!'), 'PBKDF2', false, ['deriveBits'])
  const derived = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256)
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  const hashHex = Array.from(new Uint8Array(derived)).map(b => b.toString(16).padStart(2, '0')).join('')
  const hash = `pbkdf2:${saltHex}:${hashHex}`

  const existing = await db.select({ id: users.id }).from(users).limit(1)
  if (existing.length === 0) {
    const [admin] = await db.insert(users).values({
      email: 'admin@esports.gg',
      password: hash,
      username: 'admin',
      firstName: 'System',
      lastName: 'Admin',
      role: 'admin' as const,
      isEmailVerified: true,
      profileCompleted: true,
    }).returning()
    if (admin) {
      await db.insert(wallets).values({ userId: admin.id })
      console.log('Admin created:', admin.email)
    }
  } else {
    console.log('Users already exist, skipping admin creation')
  }
  console.log('Seed complete!')
  await client.end()
}

main().catch(e => { console.error(e); process.exit(1) })
