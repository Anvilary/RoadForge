import type { Metadata } from 'next'
import { PublicRoadmapLoader } from '@/features/publication/components/PublicRoadmapLoader'

export const metadata: Metadata = {
  title: 'Embedded roadmap · RoadForge',
  robots: { index: false, follow: false },
}

export default async function EmbeddedRoadmapPage({
  params,
}: {
  params: Promise<{ publicId: string }>
}) {
  const { publicId } = await params
  return <PublicRoadmapLoader publicId={publicId} mode="embed" />
}
