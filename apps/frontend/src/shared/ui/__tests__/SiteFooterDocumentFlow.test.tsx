// @vitest-environment jsdom
import React, { act } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SiteFooter } from '@/shared/ui/SiteFooter'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('SiteFooter document flow and legal grouping', () => {
  it('renders in normal document flow without fixed positioning or overlays', () => {
    act(() => {
      root.render(<SiteFooter />)
    })

    const footer = container.querySelector('footer.site-footer')
    expect(footer).not.toBeNull()
    expect(footer?.getAttribute('style') || '').not.toContain('position: fixed')

    const siteCss = readFileSync(resolve(process.cwd(), 'src/styles/site.css'), 'utf8')
    expect(siteCss).not.toMatch(/footer\.site-footer[^{]*\{[^}]*position:\s*fixed/)
    expect(siteCss).toContain('position: relative;')
  })

  it('preserves official Anvilary Tools branding and required navigation links', () => {
    act(() => {
      root.render(<SiteFooter />)
    })

    const brand = container.querySelector('a.anvilary-brand')
    expect(brand).not.toBeNull()
    expect(brand?.getAttribute('href')).toBe('https://anvilary.tools/')
    expect(brand?.textContent).toContain('Anvilary')
    expect(brand?.textContent).toContain('.Tools')

    const github = container.querySelector('a[href="https://github.com/Anvilary/RoadForge"]')
    expect(github).not.toBeNull()
    expect(github?.textContent).toBe('GitHub')

    const problemReport = container.querySelector('a[href="https://github.com/Anvilary/RoadForge/issues/new/choose"]')
    expect(problemReport).not.toBeNull()
  })

  it('consolidates licensing and dynamic copyright into a single horizontal group', () => {
    const currentYear = new Date().getFullYear()

    act(() => {
      root.render(<SiteFooter />)
    })

    const legalGroup = container.querySelector('.footer-legal')
    expect(legalGroup).not.toBeNull()

    const licenseLink = legalGroup?.querySelector('a[href="https://github.com/Anvilary/RoadForge#license"]')
    expect(licenseLink).not.toBeNull()
    expect(licenseLink?.textContent?.trim()).toBe('Non-commercial source available')

    expect(legalGroup?.textContent).toContain(`© ${currentYear} Anvilary Tools`)
    expect(legalGroup?.textContent).toContain('·')
  })

  it('verifies stylesheet rules for legal grouping and mobile responsive behavior', () => {
    const siteCss = readFileSync(resolve(process.cwd(), 'src/styles/site.css'), 'utf8')

    expect(siteCss).toContain('.site-footer .footer-legal')
    expect(siteCss).toContain('display: inline-flex;')
    expect(siteCss).toContain('white-space: nowrap;')

    // Responsive rule avoids horizontal overflow
    expect(siteCss).toContain('white-space: normal;')
  })
})
