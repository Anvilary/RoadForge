import type { Metadata } from 'next'
import { PublicRoadmapLoader } from '@/features/publication/components/PublicRoadmapLoader'
import { createNoIndexMetadata } from '@/shared/lib/seo'

export const metadata: Metadata = createNoIndexMetadata(
  'Published Roadmap',
  'Read-only published roadmap view on RoadForge.',
)

export default async function PublishedRoadmapPage({
  params,
}: {
  params: Promise<{ publicId: string }>
}) {
  const { publicId } = await params
  return <PublicRoadmapLoader publicId={publicId} mode="page" />
}
