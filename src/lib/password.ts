// Pure-JS password hashing compatible with Cloudflare Workers (no native addons)
// Using Web Crypto API (PBKDF2) instead of bcrypt

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  )
  const hashArray = Array.from(new Uint8Array(derived))
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return `pbkdf2:${saltHex}:${hashHex}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    if (stored.startsWith('pbkdf2:')) {
      const [, saltHex, hashHex] = stored.split(':')
      const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(b => parseInt(b, 16)))
      const encoder = new TextEncoder()
      const keyMaterial = await crypto.subtle.importKey(
        'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
      )
      const derived = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial, 256
      )
      const hashArray = Array.from(new Uint8Array(derived))
      const derivedHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      return derivedHex === hashHex
    }
    return false
  } catch {
    return false
  }
}
