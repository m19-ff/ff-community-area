/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  transpilePackages: ['phaser'],
  allowedDevOrigins: ['**.*.*'],
  env: {
    PROJECT_ID: process.env.HAPPYSEEDS_PROJECT_ID ?? '',
    REACTUS_BASE_URL: process.env.REACTUS_BASE_URL ?? '',
  },
  // Allow large APK uploads through the Next.js App Router
  experimental: {
    serverActions: {
      bodySizeLimit: '200mb',
    },
  },
}

export default nextConfig
