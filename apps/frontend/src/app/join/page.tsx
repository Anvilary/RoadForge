import type { Metadata } from 'next'
import { Suspense } from 'react'
import { JoinPage } from '@/features/sharing/components/JoinPage'
import { createNoIndexMetadata } from '@/shared/lib/seo'

export const metadata: Metadata = createNoIndexMetadata(
  'Join Roadmap',
  'Join a collaborative RoadForge roadmap using a private invite link.',
)

export default function JoinRoute() {
  return (
    <Suspense>
      <JoinPage />
    </Suspense>
  )
}
