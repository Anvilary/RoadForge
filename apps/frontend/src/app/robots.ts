import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/shared/lib/seo'

const ALLOW_ROUTES = '/'
const DISALLOW_API_ROUTES = ['/api/']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ALLOW_ROUTES,
        disallow: DISALLOW_API_ROUTES,
      },
      {
        userAgent: 'Googlebot',
        allow: ALLOW_ROUTES,
        disallow: DISALLOW_API_ROUTES,
      },
      {
        userAgent: 'Bingbot',
        allow: ALLOW_ROUTES,
        disallow: DISALLOW_API_ROUTES,
      },
      {
        userAgent: 'OAI-SearchBot',
        allow: ALLOW_ROUTES,
        disallow: DISALLOW_API_ROUTES,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
