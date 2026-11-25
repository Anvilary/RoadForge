import type { Metadata } from 'next'
import { HomePageClient } from './HomePageClient'
import {
  HOME_DESCRIPTION,
  HOME_TITLE,
  SITE_NAME,
  SOCIAL_PREVIEW_IMAGE,
  buildHomeJsonLd,
  serializeJsonLd,
} from '@/shared/lib/seo'

export const metadata: Metadata = {
  title: {
    absolute: HOME_TITLE,
  },
  description: HOME_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: SITE_NAME,
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: [SOCIAL_PREVIEW_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: [SOCIAL_PREVIEW_IMAGE.url],
  },
}

export default function HomePage() {
  const homeJsonLd = buildHomeJsonLd()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(homeJsonLd),
        }}
      />
      <HomePageClient />
    </>
  )
}
