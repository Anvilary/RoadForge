// @vitest-environment jsdom

import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicRoadmapSection } from '@/features/publication/components/PublicRoadmapSection'
import type { PublicationStatus } from '@/features/publication/services/publication.service'

const publicationMocks = vi.hoisted(() => ({
  getPublication: vi.fn(),
  publishRoadmap: vi.fn(),
  unpublishRoadmap: vi.fn(),
}))

vi.mock('@/features/publication/services/publication.service', () => publicationMocks)

const unpublished: PublicationStatus = {
  status: 'unpublished',
  publicId: null,
  viewerUrl: null,
  embedUrl: null,
  imageUrl: null,
  markdown: null,
  embedHtml: null,
  revision: null,
  publishedAt: null,
  publicFields: ['Roadmap title'],
  privateFields: ['Descriptions, estimates, and assignees'],
  warning: 'Anyone with the public link can view the published roadmap. New roadmap changes may also become publicly visible.',
  automaticUpdateNote: 'Saved changes to the published fields become public.',
  cacheNote: 'GitHub may cache the preview image.',
  revocationNote: 'Unpublishing stops new public access.',
}

const markdown = '[![Community roadmap](https://roadforge.example/api/public/roadmaps/pub_abcdefghijklmnopqrst/preview.png)](https://roadforge.example/p/pub_abcdefghijklmnopqrst)'
const embedHtml = '<iframe\n  src="https://roadforge.example/embed/pub_abcdefghijklmnopqrst"\n  title="Community roadmap"\n></iframe>'

const published: PublicationStatus = {
  ...unpublished,
  status: 'published',
  publicId: 'pub_abcdefghijklmnopqrst',
  viewerUrl: 'https://roadforge.example/p/pub_abcdefghijklmnopqrst',
  embedUrl: 'https://roadforge.example/embed/pub_abcdefghijklmnopqrst',
  imageUrl: 'https://roadforge.example/api/public/roadmaps/pub_abcdefghijklmnopqrst/preview.png',
  markdown,
  embedHtml,
  revision: '2026-11-21T00:00:00+00:00',
  publishedAt: '2026-11-21T00:00:00+00:00',
}

describe('PublicRoadmapSection', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    publicationMocks.getPublication.mockReset()
    publicationMocks.publishRoadmap.mockReset()
    publicationMocks.unpublishRoadmap.mockReset()
    publicationMocks.getPublication.mockResolvedValue(unpublished)
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
  })

  async function renderSection(props: Partial<ComponentProps<typeof PublicRoadmapSection>> = {}) {
    await act(async () => {
      root.render(
        <PublicRoadmapSection
          open
          serverRoadmapId="road-1"
          sessionToken="token-1"
          canManage
          hasUnsavedEdits={false}
          onToast={vi.fn()}
          {...props}
        />,
      )
    })
  }

  it('stays collapsed until the owner opens publication details', async () => {
    await renderSection()
    const toggle = document.querySelector('[data-testid="public-publish-toggle"]') as HTMLButtonElement
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.body.textContent).not.toContain('Anyone with the public link')
    act(() => toggle.click())
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(document.body.textContent).toContain('Anyone with the public link can view the published roadmap.')
    expect(document.querySelector('[data-testid="publish-roadmap"]')).not.toBeNull()
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('confirms publish and then offers the server snippets', async () => {
    publicationMocks.publishRoadmap.mockResolvedValue(published)
    const onToast = vi.fn()
    await renderSection({ onToast })
    act(() => {
      (document.querySelector('[data-testid="public-publish-toggle"]') as HTMLButtonElement).click()
    })
    act(() => {
      (document.querySelector('[data-testid="publish-roadmap"]') as HTMLButtonElement).click()
    })
    expect(document.body.textContent).toContain('Publish this roadmap now?')
    await act(async () => {
      (document.querySelector('[data-testid="confirm-publish"]') as HTMLButtonElement).click()
    })
    expect(publicationMocks.publishRoadmap).toHaveBeenCalledWith('road-1', 'token-1')
    expect(onToast).toHaveBeenCalledWith('Roadmap published.')
    const areas = Array.from(document.querySelectorAll('textarea')).map((node) => node.value)
    expect(areas).toContain(markdown)
    expect(areas).toContain(embedHtml)
    expect(document.body.textContent).toContain('Published · Public')
  })

  it('reports clipboard success and failure from the browser result', async () => {
    publicationMocks.getPublication.mockResolvedValue(published)
    const writeText = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('denied'))
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const onToast = vi.fn()
    await renderSection({ onToast })
    act(() => {
      (document.querySelector('[data-testid="public-publish-toggle"]') as HTMLButtonElement).click()
    })
    await act(async () => {
      (document.querySelector('[data-testid="copy-viewer-link"]') as HTMLButtonElement).click()
    })
    expect(writeText).toHaveBeenCalledWith(published.viewerUrl)
    expect(document.querySelector('[data-testid="copy-viewer-link"]')?.textContent).toBe('Copied')

    await act(async () => {
      (document.querySelector('[data-testid="copy-markdown"]') as HTMLButtonElement).click()
    })
    expect(onToast).toHaveBeenCalledWith('Could not copy to the clipboard.')
    expect(document.body.textContent).toContain('Clipboard unavailable')

    await act(async () => {
      (document.querySelector('[data-testid="copy-embed"]') as HTMLButtonElement).click()
    })
    expect(writeText).toHaveBeenLastCalledWith(embedHtml)
  })

  it('confirms unpublish and returns to the private state', async () => {
    publicationMocks.getPublication.mockResolvedValue(published)
    publicationMocks.unpublishRoadmap.mockResolvedValue(unpublished)
    await renderSection()
    act(() => {
      (document.querySelector('[data-testid="public-publish-toggle"]') as HTMLButtonElement).click()
    })
    act(() => {
      (document.querySelector('[data-testid="unpublish-roadmap"]') as HTMLButtonElement).click()
    })
    expect(document.body.textContent).toContain('current public link will stop working')
    await act(async () => {
      (document.querySelector('[data-testid="confirm-unpublish"]') as HTMLButtonElement).click()
    })
    expect(publicationMocks.unpublishRoadmap).toHaveBeenCalledWith('road-1', 'token-1')
    expect(document.querySelector('[data-testid="publish-roadmap"]')).not.toBeNull()
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('collapses again when the share dialog is reopened', async () => {
    await renderSection()
    act(() => {
      (document.querySelector('[data-testid="public-publish-toggle"]') as HTMLButtonElement).click()
    })
    expect(document.querySelector('[data-testid="public-publish-toggle"]')?.getAttribute('aria-expanded')).toBe('true')
    await renderSection({ open: false })
    await renderSection({ open: true })
    expect(document.querySelector('[data-testid="public-publish-toggle"]')?.getAttribute('aria-expanded')).toBe('false')
  })

  it('does not offer a live embed for a browser-only roadmap', async () => {
    const onEnableSharing = vi.fn()
    await renderSection({
      serverRoadmapId: null,
      sessionToken: null,
      onEnableSharing,
    })
    expect(publicationMocks.getPublication).not.toHaveBeenCalled()
    act(() => {
      (document.querySelector('[data-testid="public-publish-toggle"]') as HTMLButtonElement).click()
    })
    expect(document.body.textContent).toContain('server-backed roadmap')
    expect(document.querySelector('textarea')).toBeNull()
    const enable = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Enable sharing')
    act(() => enable?.click())
    expect(onEnableSharing).toHaveBeenCalledOnce()
  })

  it('hides publication controls from a viewer', async () => {
    await renderSection({ canManage: false })
    act(() => {
      (document.querySelector('[data-testid="public-publish-toggle"]') as HTMLButtonElement).click()
    })
    expect(document.body.textContent).toContain('Only the roadmap owner can publish or unpublish this roadmap.')
    expect(document.querySelector('[data-testid="publish-roadmap"]')).toBeNull()
  })

  it('warns when the owner still has unsaved edits', async () => {
    await renderSection({ hasUnsavedEdits: true })
    act(() => {
      (document.querySelector('[data-testid="public-publish-toggle"]') as HTMLButtonElement).click()
    })
    expect(document.body.textContent).toContain('unsaved edits')
  })
})
