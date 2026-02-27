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
  // Proxy /api/supabase/* → Supabase project URL so browser traffic never hits
  // Supabase directly (avoids ISP-level blocks like Jio in India).
  // Using a framework-level rewrite is more reliable than a custom route handler
  // because Next.js/Vercel stream the response transparently without any
  // content-encoding or body-forwarding bugs.
  async rewrites() {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')
    if (!supabaseUrl || supabaseUrl === 'your_supabase_project_url') return []
    return [
      {
        source: '/api/supabase/:path*',
        destination: `${supabaseUrl}/:path*`,
      },
    ]
  },
}

export default nextConfig
