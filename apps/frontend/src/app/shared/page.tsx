import type { Metadata } from 'next'
import { createNoIndexMetadata } from '@/shared/lib/seo'
import { SharedPageClient } from './SharedPageClient'

export const metadata: Metadata = createNoIndexMetadata(
  'Shared Roadmap',
  'Read-only collaborative view for an invited RoadForge roadmap.',
)

export default function SharedPage() {
  return <SharedPageClient />
}
