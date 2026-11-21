import type { Metadata } from 'next'
import { PublicRoadmapLoader } from '@/features/publication/components/PublicRoadmapLoader'

export const metadata: Metadata = {
  title: 'Published roadmap · RoadForge',
  robots: { index: false, follow: false },
}

export default async function PublishedRoadmapPage({
  params,
}: {
  params: Promise<{ publicId: string }>
}) {
  const { publicId } = await params
  return <PublicRoadmapLoader publicId={publicId} mode="page" />
}
