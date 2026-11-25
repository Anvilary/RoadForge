import type { NextConfig } from 'next'
import path from 'node:path'

// Preserve Next.js's built-in HTML-limited crawler list while adding Googlebot
// and AI search crawlers so metadata (canonical, Open Graph, noindex) renders
// directly inside <head> without disabling streaming metadata for browsers.
const NEXT_DEFAULT_HTML_LIMITED_BOTS =
  '[\\w-]+-Google|Google-[\\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight'

const ADDITIONAL_HTML_LIMITED_BOTS = [
  'Googlebot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'GPTBot',
  'PerplexityBot',
  'ClaudeBot',
  'Claude-SearchBot',
  'Anthropic-ai',
].join('|')

const HTML_LIMITED_BOTS = new RegExp(
  `${NEXT_DEFAULT_HTML_LIMITED_BOTS}|${ADDITIONAL_HTML_LIMITED_BOTS}`,
  'i',
)

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  htmlLimitedBots: HTML_LIMITED_BOTS,
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
            key: 'X-Frame-Options',
            value: 'DENY',
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
