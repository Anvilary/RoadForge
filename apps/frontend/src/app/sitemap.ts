import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/shared/lib/seo'

const LAST_MODIFIED = '2026-11-25'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/help`,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ]
}
