/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add any specific nextjs config here if needed
  reactStrictMode: false, // Often better for games during development
  transpilePackages: ['phaser'],
  allowedDevOrigins: ['**.*.*'],
  env: {
    PROJECT_ID: process.env.HAPPYSEEDS_PROJECT_ID ?? '',
    REACTUS_BASE_URL: process.env.REACTUS_BASE_URL ?? '',
  },
};

export default nextConfig;
