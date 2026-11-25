import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { StorageWriteFailureBanner } from '@/shared/ui/StorageWriteFailureBanner'
import { RoadmapProvider } from '@/features/synchronization/components/RoadmapProvider'
import {
  HOME_DESCRIPTION,
  HOME_TITLE,
  SITE_NAME,
  SITE_URL,
  SOCIAL_PREVIEW_IMAGE,
} from '@/shared/lib/seo'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: HOME_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: HOME_DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: [
      {
        url: '/brand/roadforge/social-preview.png',
        width: SOCIAL_PREVIEW_IMAGE.width,
        height: SOCIAL_PREVIEW_IMAGE.height,
        alt: SOCIAL_PREVIEW_IMAGE.alt,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: ['/brand/roadforge/social-preview.png'],
  },
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/brand/anvilary-tools/favicon.ico', sizes: 'any' },
      { url: '/brand/anvilary-tools/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/anvilary-tools/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/brand/anvilary-tools/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce-based CSP requires request-time rendering so Next.js can read the
  // middleware CSP header and attach the per-response nonce to framework and
  // hydration scripts. This intentionally opts document routes out of static
  // HTML caching; middleware also marks those responses private/no-store.
  await headers()

  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <StorageWriteFailureBanner />
        <RoadmapProvider>{children}</RoadmapProvider>
      </body>
    </html>
  )
}
