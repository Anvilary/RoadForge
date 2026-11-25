'use client'

import { useRouter } from 'next/navigation'
import { Workspace } from '@/features/workspace/components/Workspace'

export function SharedPageClient() {
  const router = useRouter()

  return (
    <Workspace
      mode="viewer"
      onCreateOwn={() => router.push('/')}
    />
  )
}
