import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const ALL_VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 580, height: 800 },
  { width: 640, height: 800 },
  { width: 768, height: 1024 },
  { width: 820, height: 1180 },
  { width: 960, height: 800 },
  { width: 1024, height: 768 },
  { width: 1100, height: 800 },
  { width: 1101, height: 800 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]

async function seedSavedRoadmap(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'roadforge:index',
      JSON.stringify({
        roadmaps: {
          local_resp_check: {
            roadmapName: 'Responsive Check Roadmap',
            updatedAt: '2026-11-26T00:00:00Z',
          },
        },
        activeId: 'local_resp_check',
      }),
    )
    localStorage.setItem(
      'roadforge:roadmap:local_resp_check',
      JSON.stringify({
        roadmapName: 'Responsive Check Roadmap',
        phases: [],
        saved: false,
      }),
    )
  })
}

async function auditHeaderGeometry(page: Page) {
  return page.evaluate(() => {
    const header = document.querySelector<HTMLElement>('header.site-header')
    if (!header) throw new Error('Missing header.site-header')

    const headerRect = header.getBoundingClientRect()
    const isVisible = (el: Element | null): el is HTMLElement => {
      if (!(el instanceof HTMLElement)) return false
      const style = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    }

    const brand = header.querySelector('.brand')
    const desktopNavLinks = Array.from(header.querySelectorAll(':scope > nav a'))
    const actionsControls = Array.from(header.querySelectorAll(':scope > .actions > a, :scope > .actions > button, :scope > .actions > .roadmap-switcher button'))
    const topControls = [brand, ...desktopNavLinks, ...actionsControls].filter(isVisible)

    const boxes = topControls.map((el) => {
      const r = el.getBoundingClientRect()
      return {
        tag: el.tagName,
        className: el.className,
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
      }
    })

    const overlaps: string[] = []
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i]
        const b = boxes[j]
        const xOverlap = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const yOverlap = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (xOverlap > 1 && yOverlap > 1) {
          overlaps.push(`${a.className} vs ${b.className}`)
        }
      }
    }

    const panel = document.querySelector<HTMLElement>('#site-navigation-menu')
    const panelRect = panel && isVisible(panel) ? panel.getBoundingClientRect() : null

    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      headerHeight: headerRect.height,
      headerScrollWidth: header.scrollWidth,
      headerClientWidth: header.clientWidth,
      brandVisible: isVisible(brand),
      desktopNavVisible: desktopNavLinks.some(isVisible),
      hamburgerVisible: isVisible(header.querySelector('.site-menu-toggle')),
      createBtnVisible: isVisible(header.querySelector('.site-create-btn')),
      outOfViewport: boxes.filter((b) => b.left < -0.5 || b.right > window.innerWidth + 0.5),
      overlaps,
      panelRect: panelRect
        ? { left: panelRect.left, right: panelRect.right, top: panelRect.top, bottom: panelRect.bottom }
        : null,
    }
  })
}

async function expectNoA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(results.violations).toEqual([])
}

test.describe('responsive site header', () => {
  test('fits without horizontal overflow, wrapping, or overlapping across all viewports on / and /help', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    page.on('pageerror', (err) => errors.push(err.message))

    await seedSavedRoadmap(page)
    await page.goto('/')
    await page.evaluate(() => document.fonts.ready)

    for (const vp of ALL_VIEWPORTS) {
      await page.setViewportSize(vp)
      const metrics = await auditHeaderGeometry(page)

      expect(metrics.scrollWidth, `${vp.width}px doc overflow`).toBeLessThanOrEqual(metrics.innerWidth)
      expect(metrics.headerScrollWidth, `${vp.width}px header overflow`).toBeLessThanOrEqual(metrics.headerClientWidth + 1)
      expect(metrics.brandVisible, `${vp.width}px brand`).toBe(true)
      expect(metrics.createBtnVisible, `${vp.width}px create button`).toBe(true)
      expect(metrics.outOfViewport, `${vp.width}px clipped controls`).toEqual([])
      expect(metrics.overlaps, `${vp.width}px overlapping controls`).toEqual([])

      if (vp.width <= 1100) {
        expect(metrics.desktopNavVisible, `${vp.width}px desktop nav hidden`).toBe(false)
        expect(metrics.hamburgerVisible, `${vp.width}px hamburger visible`).toBe(true)
        expect(metrics.headerHeight, `${vp.width}px single-row compact header height`).toBeLessThanOrEqual(84)
      } else {
        expect(metrics.desktopNavVisible, `${vp.width}px desktop nav visible`).toBe(true)
        expect(metrics.hamburgerVisible, `${vp.width}px hamburger hidden`).toBe(false)
        expect(metrics.headerHeight, `${vp.width}px desktop header height`).toBe(118)
      }
    }

    await page.goto('/help')
    await page.evaluate(() => document.fonts.ready)
    for (const vp of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 960, height: 800 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(vp)
      const metrics = await auditHeaderGeometry(page)
      expect(metrics.scrollWidth, `/help ${vp.width}px overflow`).toBeLessThanOrEqual(metrics.innerWidth)
      expect(metrics.outOfViewport, `/help ${vp.width}px clipped controls`).toEqual([])
      expect(metrics.overlaps, `/help ${vp.width}px overlaps`).toEqual([])
    }

    expect(errors).toEqual([])
  })

  test('supports mouse, keyboard, outside click, resize reset, Create, and Saved roadmaps on mobile and tablet', async ({ page }) => {
    await seedSavedRoadmap(page)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.evaluate(() => document.fonts.ready)

    await page.waitForFunction(() => {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue('--site-header-height')
        .trim()
      return Number.parseFloat(value) <= 84
    })
    const initialHeaderHeight = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--site-header-height').trim(),
    )

    const toggle = page.locator('button.site-menu-toggle')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('#site-navigation-menu')).toHaveCount(0)

    // Keyboard open with Enter
    await toggle.focus()
    await page.keyboard.press('Enter')
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const panel = page.locator('#site-navigation-menu')
    await expect(panel).toBeVisible()

    // Expanding panel does not inflate sticky header height
    const openHeaderHeight = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--site-header-height').trim(),
    )
    expect(openHeaderHeight).toBe(initialHeaderHeight)

    const openMetrics = await auditHeaderGeometry(page)
    expect(openMetrics.scrollWidth).toBeLessThanOrEqual(375)
    expect(openMetrics.panelRect?.left).toBeGreaterThanOrEqual(0)
    expect(openMetrics.panelRect?.right).toBeLessThanOrEqual(375)

    // Mobile drawer includes 3 nav links + Source + Saved roadmaps
    await expect(panel.locator('nav a')).toHaveCount(3)
    await expect(panel.getByRole('link', { name: 'Source' })).toBeVisible()
    const savedBtn = panel.getByRole('button', { name: 'Saved roadmaps' })
    await expect(savedBtn).toBeVisible()

    // Opening Saved roadmaps dialog fits inside 375px viewport
    await savedBtn.click()
    const switcherDialog = page.locator('#roadmap-switcher-dialog')
    await expect(switcherDialog).toBeVisible()
    const swBox = await switcherDialog.boundingBox()
    expect(swBox).not.toBeNull()
    expect(swBox!.x).toBeGreaterThanOrEqual(0)
    expect(swBox!.x + swBox!.width).toBeLessThanOrEqual(375)

    // First Escape closes switcher dialog; second closes nav drawer and restores focus to hamburger
    await page.keyboard.press('Escape')
    await expect(switcherDialog).toHaveCount(0)
    await expect(panel).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await expect(toggle).toBeFocused()

    // Space opens menu; outside click below panel closes menu
    await page.keyboard.press('Space')
    await expect(panel).toBeVisible()
    const panelBox = await panel.boundingBox()
    expect(panelBox).not.toBeNull()
    await page.mouse.click(20, panelBox!.y + panelBox!.height + 40)
    await expect(panel).toHaveCount(0)

    // Navigate to #features from mobile menu without clipping heading below sticky header
    await toggle.click()
    await panel.getByRole('link', { name: 'Features' }).click()
    await expect(panel).toHaveCount(0)
    await expect(page).toHaveURL(/#features$/)

    // Resizing open mobile menu to desktop closes menu and shows desktop nav
    await page.setViewportSize({ width: 960, height: 800 })
    await toggle.click()
    await expect(panel).toBeVisible()
    await expect(panel.locator('.site-nav-secondary')).toHaveCount(0)
    await page.setViewportSize({ width: 1280, height: 800 })
    await expect(panel).toHaveCount(0)
    await expect(page.locator('header.site-header > nav')).toBeVisible()

    // Create roadmap opens wizard at 375px and 960px on /help
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/help')
    await expect(page.locator('.site-create-label-short')).toBeVisible()
    await toggle.click()
    await expect(panel.locator('a[href="/#how"]')).toBeVisible()
    await expect(panel.locator('a[href="/#features"]')).toBeVisible()
    await expect(panel.locator('a[href="/help"]')).toHaveAttribute('aria-current', 'page')
    await page.getByRole('button', { name: 'Create roadmap' }).click()
    await expect(page.getByRole('dialog', { name: 'Create your roadmap' })).toBeVisible()
  })

  test('passes automated WCAG A/AA checks on mobile and tablet menu states', async ({ page }) => {
    await seedSavedRoadmap(page)

    for (const url of ['/', '/help']) {
      for (const vp of [{ width: 375, height: 812 }, { width: 960, height: 800 }]) {
        await page.setViewportSize(vp)
        await page.goto(url)
        await expectNoA11yViolations(page)
        await page.locator('button.site-menu-toggle').click()
        await expect(page.locator('#site-navigation-menu')).toBeVisible()
        await expectNoA11yViolations(page)
      }
    }
  })
})
