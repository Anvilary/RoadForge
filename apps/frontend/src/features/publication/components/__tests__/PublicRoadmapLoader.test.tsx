// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicRoadmapLoader } from '@/features/publication/components/PublicRoadmapLoader'

vi.mock('@/shared/http/roadmap-http', () => ({
  getApiBaseUrl: () => 'http://127.0.0.1:7896',
}))

const payload = {
  title: 'Community roadmap',
  revision: 'rev-1',
  progress: 0,
  task_count: 0,
  done_count: 0,
  truncated: false,
  phases: [],
}

describe('PublicRoadmapLoader', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('does not fetch an invalid public identifier', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await act(async () => {
      root.render(<PublicRoadmapLoader publicId="not-public" mode="page" />)
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('not available')
  })

  it('reads a published roadmap without credentials and refreshes on the poll interval', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ETag: '"rev-1"', 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 304, headers: { ETag: '"rev-1"' } }))
    vi.stubGlobal('fetch', fetchMock)
    await act(async () => {
      root.render(<PublicRoadmapLoader publicId="pub_abcdefghijklmnopqrstuv" mode="embed" pollMs={15000} />)
    })
    expect(document.body.textContent).toContain('Community roadmap')
    const firstCall = fetchMock.mock.calls[0]
    expect(firstCall?.[0]).toBe('http://127.0.0.1:7896/api/public/roadmaps/pub_abcdefghijklmnopqrstuv')
    expect(firstCall?.[1]).toMatchObject({ credentials: 'omit', cache: 'no-store' })
    expect(document.querySelector('[data-mode="embed"]')).not.toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[1].headers['If-None-Match']).toBe('"rev-1"')
    expect(document.body.textContent).toContain('Community roadmap')
  })

  it('shows the unavailable state for an unpublished roadmap', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ detail: 'Published roadmap not found' }),
      { status: 404 },
    )))
    await act(async () => {
      root.render(<PublicRoadmapLoader publicId="pub_abcdefghijklmnopqrstuv" mode="page" pollMs={60000} />)
    })
    expect(document.body.textContent).toContain('This roadmap is not available')
    expect(document.body.textContent).not.toContain('Published roadmap not found')
  })
})
