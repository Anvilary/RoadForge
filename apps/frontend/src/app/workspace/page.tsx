import type { Metadata } from 'next'
import { Workspace } from '@/features/workspace/components/Workspace'
import { createNoIndexMetadata } from '@/shared/lib/seo'

export const metadata: Metadata = createNoIndexMetadata(
  'Workspace',
  'Private browser-local and collaborative roadmap workspace.',
)

export default function WorkspacePage() {
  return <Workspace mode="owner" />
}
