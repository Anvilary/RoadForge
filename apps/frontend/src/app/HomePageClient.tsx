'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Homepage } from '@/features/marketing/components/Homepage'
import { CreateWizard } from '@/features/roadmaps/components/CreateWizard'

function CreateQuerySync({ onOpen }: { onOpen: () => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('create') === '1') {
      onOpen()
      router.replace('/')
    }
  }, [onOpen, router, searchParams])

  return null
}

export function HomePageClient() {
  const router = useRouter()
  const [showWizard, setShowWizard] = useState(false)
  const handleOpenWizard = useCallback(() => setShowWizard(true), [])

  const handleWizardComplete = (roadmapId?: string) => {
    setShowWizard(false)
    router.push(roadmapId ? `/workspace?roadmap=${encodeURIComponent(roadmapId)}` : '/workspace')
  }

  return (
    <>
      <Suspense fallback={null}>
        <CreateQuerySync onOpen={handleOpenWizard} />
      </Suspense>
      <Homepage onCreate={handleOpenWizard} />
      {showWizard && (
        <CreateWizard
          onComplete={handleWizardComplete}
          onClose={() => setShowWizard(false)}
        />
      )}
    </>
  )
}
