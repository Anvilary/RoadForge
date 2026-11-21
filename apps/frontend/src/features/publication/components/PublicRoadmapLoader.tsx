'use client'

import { useEffect, useState } from 'react'
import { getApiBaseUrl } from '@/shared/http/roadmap-http'
import {
  PublicRoadmapMessage,
  PublicRoadmapView,
  type PublicRoadmap,
} from '@/features/publication/components/PublicRoadmapView'

const PUBLIC_ID = /^pub_[A-Za-z0-9_-]{16,80}$/

interface PublicRoadmapLoaderProps {
  publicId: string
  mode: 'page' | 'embed'
  pollMs?: number
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; roadmap: PublicRoadmap }
  | { kind: 'unavailable' }
  | { kind: 'error' }

export function PublicRoadmapLoader({
  publicId,
  mode,
  pollMs = 15_000,
}: PublicRoadmapLoaderProps) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    if (!PUBLIC_ID.test(publicId)) {
      setState({ kind: 'unavailable' })
      return
    }
    const url = `${getApiBaseUrl()}/api/public/roadmaps/${encodeURIComponent(publicId)}`
    let stopped = false
    let timer = 0
    let etag: string | null = null

    const load = async () => {
      try {
        const headers: HeadersInit = { Accept: 'application/json' }
        if (etag) headers['If-None-Match'] = etag
        const response = await fetch(url, { credentials: 'omit', cache: 'no-store', headers })
        if (stopped) return
        if (response.status === 304) return
        if (response.status === 404) {
          setState({ kind: 'unavailable' })
          return
        }
        if (!response.ok) {
          setState({ kind: 'error' })
          return
        }
        etag = response.headers.get('ETag')
        const roadmap = await response.json() as PublicRoadmap
        if (!stopped) {
          setState({ kind: 'ready', roadmap })
          document.title = `${roadmap.title} · RoadForge`
        }
      } catch {
        if (!stopped) setState({ kind: 'error' })
      }
    }

    const schedule = () => {
      timer = window.setTimeout(async () => {
        if (document.visibilityState === 'visible') await load()
        if (!stopped) schedule()
      }, pollMs)
    }

    void load().finally(() => {
      if (!stopped) schedule()
    })

    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [publicId, pollMs])

  return (
    <main className={`public-roadmap-shell ${mode}`} data-mode={mode}>
      {state.kind === 'loading' && (
        <PublicRoadmapMessage title="Loading published roadmap" body="Reading the latest saved public roadmap." />
      )}
      {state.kind === 'error' && (
        <PublicRoadmapMessage
          title="Could not load this roadmap"
          body="The public roadmap could not be loaded. Refresh the page to try again."
        />
      )}
      {state.kind === 'unavailable' && (
        <PublicRoadmapMessage
          title="This roadmap is not available"
          body="The owner unpublished it, or this public link is no longer valid."
        />
      )}
      {state.kind === 'ready' && <PublicRoadmapView roadmap={state.roadmap} mode={mode} />}
    </main>
  )
}
