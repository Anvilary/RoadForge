import type { NextConfig } from 'next'
import path from 'node:path'

function devApiProxyRewrites(): { source: string; destination: string }[] {
  // Local stand-in for the nginx `/api/` proxy. Production does not set this.
  // The value must be an origin so the rewrite cannot become an open proxy.
  const raw = process.env.ROADFORGE_DEV_API_PROXY?.trim()
  if (!raw) return []
  let origin: URL
  try {
    origin = new URL(raw)
  } catch {
    return []
  }
  if (origin.protocol !== 'http:' && origin.protocol !== 'https:') return []
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') {
    return []
  }
  return [{ source: '/api/:path*', destination: `${origin.origin}/api/:path*` }]
}

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  async rewrites() {
    return devApiProxyRewrites()
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'no-referrer',
          },
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
