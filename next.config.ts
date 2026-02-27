import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  // Explicitly expose NEXT_PUBLIC_ vars so they are always inlined at build time
  env: {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
  },
  // Proxy Supabase through Vercel so ISP blocks (e.g. Jio) don't affect browser clients.
  // Only active when SUPABASE_DIRECT_URL is set (i.e. on Vercel, not local dev).
  async rewrites() {
    if (!process.env.SUPABASE_DIRECT_URL) return []
    return [
      {
        source: '/supabase/:path*',
        destination: `${process.env.SUPABASE_DIRECT_URL}/:path*`,
      },
    ]
  },
}

export default nextConfig
