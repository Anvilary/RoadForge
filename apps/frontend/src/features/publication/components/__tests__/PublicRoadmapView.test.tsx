// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PublicRoadmapMessage,
  PublicRoadmapView,
  type PublicRoadmap,
} from '@/features/publication/components/PublicRoadmapView'

const roadmap: PublicRoadmap = {
  title: 'Launch <script>alert(1)</script> roadmap',
  revision: '2026-11-21T00:00:00+00:00',
  progress: 50,
  task_count: 2,
  done_count: 1,
  truncated: false,
  phases: [
    {
      id: 'phase-1',
      number: '01',
      name: 'Foundation with a very long name that should wrap instead of forcing a wide page',
      color: 'blue',
      status: 'active',
      progress: 50,
      tasks: [
        {
          id: 'task-1',
          title: 'Ship the viewer',
          done: true,
          complexity: 'high',
          tags: ['public'],
          depends_on: [],
          parent_id: null,
        },
        {
          id: 'task-2',
          title: 'Write the embed',
          done: false,
          complexity: 'medium',
          tags: [],
          depends_on: ['task-1'],
          parent_id: 'task-1',
        },
      ],
    },
  ],
}

describe('PublicRoadmapView', () => {
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
  })

  function renderView(value: PublicRoadmap = roadmap) {
    act(() => {
      root.render(<PublicRoadmapView roadmap={value} mode="page" />)
    })
  }

  it('shows progress, hierarchy, and escaped text', () => {
    renderView()
    expect(document.querySelector('[data-testid="public-roadmap-title"]')?.textContent).toBe(roadmap.title)
    expect(document.querySelector('script')).toBeNull()
    expect(document.body.textContent).toContain('50% complete')
    expect(document.body.textContent).toContain('Write the embed')
    expect(document.querySelector('.is-subtask')).not.toBeNull()
    expect(document.querySelector('input, textarea, [contenteditable="true"]')).toBeNull()
    const swatch = document.querySelector('.public-phase-swatch') as HTMLElement
    expect(swatch.style.backgroundColor).toBe('rgb(217, 116, 66)')
  })

  it('expands and collapses a phase from the keyboard-reachable button', () => {
    renderView()
    const toggle = document.querySelector('[data-testid="phase-toggle"]') as HTMLButtonElement
    expect(toggle.tagName).toBe('BUTTON')
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    act(() => toggle.click())
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.body.textContent).not.toContain('Ship the viewer')
    toggle.focus()
    expect(document.activeElement).toBe(toggle)
    act(() => toggle.click())
    expect(document.body.textContent).toContain('Ship the viewer')
  })

  it('opens public task details without an editor', () => {
    renderView()
    const details = Array.from(document.querySelectorAll('button')).find((button) => button.textContent === 'Details')
    expect(details?.getAttribute('aria-expanded')).toBe('false')
    act(() => details?.click())
    expect(details?.getAttribute('aria-expanded')).toBe('true')
    expect(document.body.textContent).toContain('Complexity: High')
    expect(document.body.textContent).toContain('Tags: public')
  })

  it('shows an empty published roadmap and attribution', () => {
    renderView({ ...roadmap, phases: [], task_count: 0, done_count: 0, progress: 0 })
    expect(document.body.textContent).toContain('no phases yet')
    const credit = document.querySelector('.public-roadmap-attribution a') as HTMLAnchorElement
    expect(credit.href).toBe('https://anvilary.tools/')
    expect(credit.textContent).toContain('Built with RoadForge by Anvilary.Tools')
    expect(decodeURIComponent(credit.querySelector('img')?.getAttribute('src') || '')).toContain(
      '/brand/anvilary-tools/logo.png',
    )
  })

  it('keeps attribution on the unavailable state', () => {
    act(() => {
      root.render(
        <PublicRoadmapMessage
          title="This roadmap is not available"
          body="The owner unpublished it, or this public link is no longer valid."
        />,
      )
    })
    expect(document.body.textContent).toContain('not available')
    expect(document.querySelector('.public-roadmap-attribution a')).not.toBeNull()
  })

  it('notes a bounded summary', () => {
    renderView({ ...roadmap, truncated: true })
    expect(document.body.textContent).toContain('bounded summary')
  })
})
