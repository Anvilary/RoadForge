// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteHeader } from '@/features/marketing/components/SiteHeader'

vi.mock('@/features/roadmaps/components/RoadmapSwitcher', () => ({
  RoadmapSwitcher: ({
    label,
    showLabel,
    onCreate,
  }: {
    label?: string
    showLabel?: boolean
    onCreate?: () => void
  }) => (
    <div data-testid="roadmap-switcher" data-show-label={String(Boolean(showLabel))}>
      <button type="button" onClick={onCreate}>
        {label ?? 'Saved'}
      </button>
    </div>
  ),
}))

function createMatchMediaController(initialWidth: number) {
  let width = initialWidth
  const listeners = new Map<string, Set<(event: MediaQueryListEvent) => void>>()

  const evaluate = (query: string) => {
    const match = /\(max-width:\s*(\d+)px\)/.exec(query)
    if (!match) return false
    return width <= Number(match[1])
  }

  const impl = vi.fn((query: string) => {
    if (!listeners.has(query)) listeners.set(query, new Set())
    return {
      media: query,
      get matches() {
        return evaluate(query)
      },
      onchange: null,
      addEventListener: (_type: string, cb: (event: MediaQueryListEvent) => void) => {
        listeners.get(query)?.add(cb)
      },
      removeEventListener: (_type: string, cb: (event: MediaQueryListEvent) => void) => {
        listeners.get(query)?.delete(cb)
      },
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList
  })

  return {
    impl,
    setWidth(nextWidth: number) {
      width = nextWidth
      for (const [query, cbs] of listeners.entries()) {
        const matches = evaluate(query)
        cbs.forEach((cb) => cb({ matches, media: query } as MediaQueryListEvent))
      }
    },
  }
}

describe('SiteHeader responsive navigation', () => {
  let container: HTMLDivElement
  let root: Root
  let mqlController: ReturnType<typeof createMatchMediaController>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mqlController = createMatchMediaController(960)
    vi.stubGlobal('matchMedia', mqlController.impl)
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 1
    })
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('toggles drawer menu, closes on outside click and link click, and restores focus on Escape', () => {
    act(() => {
      root.render(<SiteHeader onCreate={vi.fn()} />)
    })

    const toggle = container.querySelector<HTMLButtonElement>('button.site-menu-toggle')
    expect(toggle).not.toBeNull()
    expect(toggle?.type).toBe('button')
    expect(toggle?.getAttribute('aria-expanded')).toBe('false')
    expect(toggle?.getAttribute('aria-controls')).toBe('site-navigation-menu')
    expect(container.querySelector('#site-navigation-menu')).toBeNull()

    // Open menu
    act(() => {
      toggle?.click()
    })
    expect(toggle?.getAttribute('aria-expanded')).toBe('true')
    const panel = container.querySelector('#site-navigation-menu')
    expect(panel).not.toBeNull()
    const drawerLinks = panel?.querySelectorAll<HTMLAnchorElement>('nav a')
    expect(drawerLinks).toHaveLength(3)
    expect(drawerLinks?.[0]?.getAttribute('href')).toBe('#how')
    expect(drawerLinks?.[1]?.getAttribute('href')).toBe('#features')
    expect(drawerLinks?.[2]?.getAttribute('href')).toBe('/help')

    // At 960px (tablet), Source and Saved roadmaps stay in .actions, not duplicated in drawer
    expect(container.querySelector('.actions a.gh-pill')).not.toBeNull()
    expect(panel?.querySelector('.site-nav-secondary')).toBeNull()

    // Escape closes menu and returns focus to toggle
    act(() => {
      drawerLinks?.[0]?.focus()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(container.querySelector('#site-navigation-menu')).toBeNull()
    expect(toggle?.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toggle)

    // Click outside closes menu
    act(() => {
      toggle?.click()
    })
    expect(container.querySelector('#site-navigation-menu')).not.toBeNull()
    act(() => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(container.querySelector('#site-navigation-menu')).toBeNull()

    // Clicking a drawer link closes menu
    act(() => {
      toggle?.click()
    })
    act(() => {
      container.querySelector<HTMLAnchorElement>('#site-navigation-menu nav a')?.click()
    })
    expect(container.querySelector('#site-navigation-menu')).toBeNull()
  })

  it('moves secondary actions into the drawer on narrow mobile viewports without duplication', () => {
    mqlController.setWidth(375)
    const onCreate = vi.fn()

    act(() => {
      root.render(<SiteHeader onCreate={onCreate} activeNav="help" />)
    })

    // On <= 640px, header .actions omits gh-pill and RoadmapSwitcher
    expect(container.querySelector('.actions a.gh-pill')).toBeNull()
    expect(container.querySelector('.actions [data-testid="roadmap-switcher"]')).toBeNull()

    const toggle = container.querySelector<HTMLButtonElement>('button.site-menu-toggle')
    act(() => {
      toggle?.click()
    })

    const panel = container.querySelector('#site-navigation-menu')
    expect(panel?.querySelector('a[href="/#how"]')).not.toBeNull()
    expect(panel?.querySelector('a[href="/#features"]')).not.toBeNull()
    const helpLink = panel?.querySelector('a[href="/help"]')
    expect(helpLink?.classList.contains('active')).toBe(true)
    expect(helpLink?.getAttribute('aria-current')).toBe('page')

    // Secondary actions appear in drawer
    const mobileSource = panel?.querySelector('.site-nav-secondary a.site-nav-ext-link')
    expect(mobileSource?.getAttribute('href')).toBe('https://github.com/Anvilary/RoadForge')
    const mobileSwitcher = panel?.querySelector('.site-nav-secondary [data-testid="roadmap-switcher"]')
    expect(mobileSwitcher?.getAttribute('data-show-label')).toBe('true')

    // Resizing from 375px to 1440px closes menu and moves focus cleanly to desktop nav
    act(() => {
      panel?.querySelector<HTMLAnchorElement>('nav a')?.focus()
      mqlController.setWidth(1440)
    })
    expect(container.querySelector('#site-navigation-menu')).toBeNull()
    expect(container.querySelector('.actions a.gh-pill')).not.toBeNull()
    expect(document.activeElement).toBe(container.querySelector('header > nav a'))
  })

  it('does not close menu when clicking inside a portalled overlay or Escape while overlay open', () => {
    act(() => {
      root.render(<SiteHeader onCreate={vi.fn()} />)
    })

    const toggle = container.querySelector<HTMLButtonElement>('button.site-menu-toggle')
    act(() => {
      toggle?.click()
    })

    const portal = document.createElement('div')
    portal.className = 'anchored-overlay'
    const inner = document.createElement('button')
    inner.textContent = 'Saved item'
    portal.appendChild(inner)
    document.body.appendChild(portal)

    act(() => {
      inner.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(container.querySelector('#site-navigation-menu')).not.toBeNull()

    portal.remove()
  })
})
