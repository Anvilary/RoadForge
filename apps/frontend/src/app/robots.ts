import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/shared/lib/seo'

const ALLOW_PUBLIC_ROUTES = ['/', '/help']
const DISALLOW_PRIVATE_ROUTES = ['/workspace', '/shared', '/join', '/api/']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ALLOW_PUBLIC_ROUTES,
        disallow: DISALLOW_PRIVATE_ROUTES,
      },
      {
        userAgent: 'Googlebot',
        allow: ALLOW_PUBLIC_ROUTES,
        disallow: DISALLOW_PRIVATE_ROUTES,
      },
      {
        userAgent: 'Bingbot',
        allow: ALLOW_PUBLIC_ROUTES,
        disallow: DISALLOW_PRIVATE_ROUTES,
      },
      {
        userAgent: 'OAI-SearchBot',
        allow: ALLOW_PUBLIC_ROUTES,
        disallow: DISALLOW_PRIVATE_ROUTES,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
