// @vitest-environment jsdom
import React, { act } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HelpPage from '@/app/help/page'
import { SiteHeader } from '@/features/marketing/components/SiteHeader'

const mockPush = vi.fn()
const mockReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/features/roadmaps/components/RoadmapSwitcher', () => ({
  RoadmapSwitcher: ({ onCreate }: { onCreate?: () => void }) => (
    <div data-testid="roadmap-switcher">
      <button data-testid="switcher-create-btn" onClick={onCreate}>
        Switcher Create
      </button>
    </div>
  ),
}))

vi.mock('@/features/roadmaps/components/CreateWizard', () => ({
  CreateWizard: ({
    onComplete,
    onClose,
  }: {
    onComplete: (id?: string) => void
    onClose: () => void
  }) => (
    <div role="dialog" aria-label="Create roadmap wizard">
      <button data-testid="wizard-complete-btn" onClick={() => onComplete('new-roadmap-123')}>
        Create Blank
      </button>
      <button data-testid="wizard-close-btn" onClick={onClose}>
        Cancel
      </button>
    </div>
  ),
}))

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  window.location.hash = ''
  mockPush.mockClear()
  mockReplace.mockClear()
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  window.location.hash = ''
})

describe('Help Page Unified Header', () => {
  it('renders the unified marketing header with 80px logo and active Help styling', () => {
    act(() => {
      root.render(<SiteHeader onCreate={vi.fn()} activeNav="help" />)
    })

    const header = container.querySelector('header.site-header')
    expect(header).not.toBeNull()

    // 80px RoadForge brand logo
    const brand = header?.querySelector('.brand.brand-lg')
    expect(brand).not.toBeNull()
    const logoImg = brand?.querySelector('img.brand-logo-img')
    expect(logoImg).not.toBeNull()
    expect(decodeURIComponent(logoImg?.getAttribute('src') || '')).toContain('/brand/roadforge/logo.png')
    expect(logoImg?.getAttribute('width')).toBe('80')
    expect(logoImg?.getAttribute('height')).toBe('80')

    // Navigation links point to home anchors from /help
    const howLink = header?.querySelector('a[href="/#how"]')
    expect(howLink).not.toBeNull()
    expect(howLink?.textContent).toContain('How it works')

    const featuresLink = header?.querySelector('a[href="/#features"]')
    expect(featuresLink).not.toBeNull()
    expect(featuresLink?.textContent).toContain('Features')

    // Help link has active class and aria-current="page"
    const helpLink = header?.querySelector('a[href="/help"]')
    expect(helpLink).not.toBeNull()
    expect(helpLink?.classList.contains('active')).toBe(true)
    expect(helpLink?.getAttribute('aria-current')).toBe('page')
  })

  it('triggers the creation wizard from Help header actions', () => {
    act(() => {
      root.render(<HelpPage />)
    })

    // Wizard is initially closed
    expect(container.querySelector('[role="dialog"][aria-label="Create roadmap wizard"]')).toBeNull()

    // Click "Create roadmap" in header
    const createBtn = container.querySelector('header.site-header button.btn.primary')
    expect(createBtn).not.toBeNull()
    act(() => {
      createBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Wizard is now open
    const dialog = container.querySelector('[role="dialog"][aria-label="Create roadmap wizard"]')
    expect(dialog).not.toBeNull()

    // Complete wizard routes to workspace
    const completeBtn = container.querySelector('[data-testid="wizard-complete-btn"]')
    act(() => {
      completeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(mockPush).toHaveBeenCalledWith('/workspace?roadmap=new-roadmap-123')
  })
})

describe('Help Page Accordions', () => {
  it('starts with section 1 expanded and all other 8 sections collapsed', () => {
    act(() => {
      root.render(<HelpPage />)
    })

    const sections = container.querySelectorAll('.help-accordion-item')
    expect(sections).toHaveLength(9)

    // Section 1 (start) is expanded
    const startSection = container.querySelector('#start')
    expect(startSection?.classList.contains('expanded')).toBe(true)
    const startTrigger = startSection?.querySelector('.help-accordion-trigger')
    expect(startTrigger?.getAttribute('aria-expanded')).toBe('true')
    const startPanel = startSection?.querySelector('.help-accordion-panel')
    expect(startPanel?.classList.contains('expanded')).toBe(true)
    expect(startPanel?.hasAttribute('inert')).toBe(false)

    // Sections 2-9 are collapsed
    const otherIds = [
      'plan',
      'portable',
      'collaborate',
      'deployment',
      'recover',
      'history',
      'troubleshoot',
      'limits',
    ]

    for (const id of otherIds) {
      const sec = container.querySelector(`#${id}`)
      expect(sec?.classList.contains('collapsed')).toBe(true)
      const trigger = sec?.querySelector('.help-accordion-trigger')
      expect(trigger?.getAttribute('aria-expanded')).toBe('false')
      const panel = sec?.querySelector('.help-accordion-panel')
      expect(panel?.classList.contains('collapsed')).toBe(true)
      expect(panel?.hasAttribute('inert')).toBe(true)
    }
  })

  it('clicking another accordion header expands it and closes the previous one', () => {
    act(() => {
      root.render(<HelpPage />)
    })

    const planTrigger = container.querySelector('#help-header-plan')
    expect(planTrigger).not.toBeNull()

    // Click "Create phases and tasks"
    act(() => {
      planTrigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Plan is now expanded
    expect(container.querySelector('#plan')?.classList.contains('expanded')).toBe(true)
    expect(planTrigger?.getAttribute('aria-expanded')).toBe('true')

    // Start is now collapsed
    expect(container.querySelector('#start')?.classList.contains('collapsed')).toBe(true)
    expect(container.querySelector('#help-header-start')?.getAttribute('aria-expanded')).toBe('false')
  })

  it('clicking the currently open accordion header toggles it collapsed', () => {
    act(() => {
      root.render(<HelpPage />)
    })

    const startTrigger = container.querySelector('#help-header-start')

    // Start was open; click it to close
    act(() => {
      startTrigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.querySelector('#start')?.classList.contains('collapsed')).toBe(true)
    expect(startTrigger?.getAttribute('aria-expanded')).toBe('false')
  })

  it('supports keyboard activation via Enter/Space', () => {
    act(() => {
      root.render(<HelpPage />)
    })

    const portableTrigger = container.querySelector('#help-header-portable') as HTMLButtonElement
    expect(portableTrigger).not.toBeNull()

    act(() => {
      portableTrigger.click()
    })

    expect(container.querySelector('#portable')?.classList.contains('expanded')).toBe(true)
  })
})

describe('Help Page Topic Navigation and Hash Routing', () => {
  it('clicking a topic navigation item expands the section and sets active styling', () => {
    act(() => {
      root.render(<HelpPage />)
    })

    const portableTopic = container.querySelector('.help-toc a[href="#portable"]') as HTMLAnchorElement
    expect(portableTopic).not.toBeNull()

    act(() => {
      portableTopic.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    // Topic is active
    expect(portableTopic.classList.contains('active')).toBe(true)
    expect(portableTopic.getAttribute('aria-current')).toBe('true')

    // Section is expanded
    expect(container.querySelector('#portable')?.classList.contains('expanded')).toBe(true)
    expect(container.querySelector('#start')?.classList.contains('collapsed')).toBe(true)
  })

  it('honors direct hash link on mount', () => {
    window.location.hash = '#deployment'

    act(() => {
      root.render(<HelpPage />)
    })

    // Deployment is expanded
    expect(container.querySelector('#deployment')?.classList.contains('expanded')).toBe(true)
    expect(container.querySelector('#start')?.classList.contains('collapsed')).toBe(true)

    // Deployment TOC item is active
    const depTopic = container.querySelector('.help-toc a[href="#deployment"]')
    expect(depTopic?.classList.contains('active')).toBe(true)
  })

  it('updates expanded section on popstate/hashchange event', () => {
    act(() => {
      root.render(<HelpPage />)
    })

    // Change hash to #limits
    window.location.hash = '#limits'
    act(() => {
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })

    expect(container.querySelector('#limits')?.classList.contains('expanded')).toBe(true)
    expect(container.querySelector('#start')?.classList.contains('collapsed')).toBe(true)
  })

  it('verifies stylesheet rules for scroll-margin-top header offset and animations', () => {
    const helpCss = readFileSync(resolve(process.cwd(), 'src/app/help/help.css'), 'utf8')

    // Header offset prevents occlusion
    expect(helpCss).toContain('scroll-margin-top: calc(var(--site-header-height, 118px) + 24px);')

    // CSS Grid transition for fluid height
    expect(helpCss).toContain('grid-template-rows: 0fr;')
    expect(helpCss).toContain('grid-template-rows: 1fr;')
    expect(helpCss).toContain('transition: grid-template-rows 220ms ease')

    // Reduced motion media query disables transitions
    expect(helpCss).toContain('@media (prefers-reduced-motion: reduce)')
    expect(helpCss).toContain('transition: none !important;')
  })
})
