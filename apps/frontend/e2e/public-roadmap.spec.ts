import { expect, test, type Page } from '@playwright/test'
import http from 'node:http'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRoadmap } from './helpers'

const ARTIFACTS = 'test-results/public-viewer'
const VIEWPORTS = [
  { width: 320, height: 700 },
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
]

async function shot(page: Page, name: string, fullPage = true) {
  await mkdir(ARTIFACTS, { recursive: true })
  await page.screenshot({ path: `${ARTIFACTS}/${name}.png`, fullPage })
}

test('owner publishes, embeds, updates, and unpublishes a roadmap', async ({ page }) => {
  test.setTimeout(90_000)
  const health = await page.request.get('http://127.0.0.1:7896/api/health/live')
  expect(health.ok()).toBeTruthy()

  await page.setViewportSize({ width: 1280, height: 800 })
  await createRoadmap(page, {
    title: 'Public Launch Roadmap',
    startingPoint: 'template',
  })

  await page.locator('.header-save-btn', { hasText: 'Share' }).click()
  const saveModal = page.getByRole('dialog', { name: 'Enable sharing' })
  await expect(saveModal).toBeVisible()
  await expect(saveModal).toContainText('Saving does not publish')
  await saveModal.getByRole('button', { name: /Enable sharing/i }).click()
  await page.waitForURL(/\/workspace\?roadmap=rm_/, { timeout: 20_000 })
  await expect(page.locator('.sync-status-indicator')).toHaveClass(/is-live/, { timeout: 15_000 })

  await page.locator('.header-end button', { hasText: 'Share' }).click()
  const shareModal = page.getByRole('dialog', { name: /Share this roadmap/i })
  await expect(shareModal.getByTestId('public-publish-toggle')).toHaveAttribute('aria-expanded', 'false')
  await expect(shareModal).toContainText('not public publishing links')
  await shot(shareModal.page(), 'share-collapsed-1280x800', false)

  await shareModal.getByTestId('public-publish-toggle').click()
  await expect(shareModal).toContainText('Anyone with the public link can view the published roadmap')
  await shot(page, 'publish-confirmation-ready-1280x800', false)
  await shareModal.getByTestId('publish-roadmap').click()
  await expect(shareModal).toContainText('Publish this roadmap now?')
  await shot(page, 'publish-confirm-1280x800', false)

  const publishedResponse = page.waitForResponse((response) => (
    response.url().includes('/publication') && response.request().method() === 'POST'
  ))
  await shareModal.getByTestId('confirm-publish').click()
  const published = await (await publishedResponse).json()
  await expect(shareModal.getByText('Published · Public')).toBeVisible()
  const markdown = await shareModal.locator('textarea').nth(0).inputValue()
  const embedHtml = await shareModal.locator('textarea').nth(1).inputValue()
  expect(markdown).toBe(published.markdown)
  expect(embedHtml).toBe(published.embed_html)
  expect(markdown).toMatch(/^\[!\[[^\n\]]*\]\(https?:\/\/[^)\s]+\)\]\(https?:\/\/[^)\s]+\)$/)
  expect(embedHtml).toContain('<iframe')
  expect(embedHtml).toContain(`src="${published.embed_url}"`)
  expect(embedHtml).toContain('loading="lazy"')
  await shot(page, 'published-state-1280x800', false)

  await page.setViewportSize({ width: 375, height: 812 })
  await shot(page, 'published-state-375x812', false)
  await page.setViewportSize({ width: 320, height: 700 })
  await shot(page, 'published-state-320x700', false)
  await shareModal.getByTestId('copy-viewer-link').scrollIntoViewIfNeeded()
  await expect(shareModal.getByTestId('copy-viewer-link')).toBeVisible()
  await expect(shareModal.getByTestId('copy-markdown')).toBeVisible()
  await expect(shareModal.getByTestId('copy-embed')).toBeVisible()
  await shot(page, 'published-actions-320x700', false)
  await page.setViewportSize({ width: 1280, height: 800 })

  const viewer = await page.context().newPage()
  await viewer.setViewportSize({ width: 1280, height: 800 })
  await viewer.goto(published.viewer_url)
  await expect(viewer.getByTestId('public-roadmap-title')).toHaveText('Public Launch Roadmap')
  await expect(viewer.getByRole('link', { name: /Built with RoadForge by Anvilary\.Tools/ })).toBeVisible()
  await expect(viewer.getByRole('button', { name: /Import \/ Export/ })).toHaveCount(0)
  const phase = viewer.getByTestId('phase-toggle').first()
  await expect(phase).toHaveAttribute('aria-expanded', 'true')
  await phase.focus()
  await phase.press('Enter')
  await expect(phase).toHaveAttribute('aria-expanded', 'false')
  await phase.press('Enter')
  await expect(phase).toHaveAttribute('aria-expanded', 'true')
  await shot(viewer, 'viewer-expanded-1280x800')

  for (const viewport of VIEWPORTS) {
    await viewer.setViewportSize(viewport)
    await shot(viewer, `viewer-${viewport.width}x${viewport.height}`)
  }

  const imageUrl = published.image_url as string
  expect(imageUrl).toContain('/api/public/roadmaps/')
  const image = await viewer.request.get(imageUrl)
  expect(image.status()).toBe(200)
  expect(image.headers()['content-type']).toContain('image/png')
  expect(image.headers()['cache-control']).toContain('max-age=60')
  const bytes = Buffer.from(await image.body())
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(bytes.readUInt32BE(16)).toBe(1200)
  expect(bytes.readUInt32BE(20)).toBe(630)
  await mkdir(ARTIFACTS, { recursive: true })
  await writeFile(`${ARTIFACTS}/github-preview.png`, bytes)

  const embedDoc = await viewer.request.get(published.embed_url as string)
  expect(embedDoc.ok()).toBeTruthy()
  expect(embedDoc.headers()['x-frame-options']).toBeUndefined()
  expect(embedDoc.headers()['x-robots-tag']).toBe('noindex, nofollow')
  const embedPolicy = embedDoc.headers()['content-security-policy-report-only']
    || embedDoc.headers()['content-security-policy']
    || ''
  expect(embedPolicy).toContain('frame-ancestors *')
  const viewerDoc = await viewer.request.get(published.viewer_url as string)
  expect(viewerDoc.headers()['x-frame-options']).toBe('DENY')
  expect(viewerDoc.headers()['x-robots-tag']).toBe('noindex, nofollow')

  // True cross-origin host page (http://localhost:<port> embedding http://127.0.0.1:<port>)
  const crossOriginServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    if (req.url === '/deny-check') {
      res.end(`<!doctype html><title>Deny host</title><body><iframe src="${published.viewer_url}"></iframe></body>`)
      return
    }
    res.end(`<!doctype html><title>Embed host</title><body style="margin:0">${embedHtml}</body>`)
  })
  await new Promise<void>((resolve) => crossOriginServer.listen(0, 'localhost', resolve))
  const hostAddr = crossOriginServer.address() as { port: number }
  const crossOriginBase = `http://localhost:${hostAddr.port}`

  const embedContext = await page.context().browser()!.newContext({ viewport: { width: 1280, height: 800 } })
  const embedPage = await embedContext.newPage()
  try {
    await embedPage.goto(`${crossOriginBase}/`, { waitUntil: 'domcontentloaded' })
    const frame = embedPage.frameLocator('iframe')
    await expect(frame.getByTestId('public-roadmap-title')).toHaveText('Public Launch Roadmap', { timeout: 15_000 })
    await expect(frame.getByRole('link', { name: /Built with RoadForge by Anvilary\.Tools/ })).toBeVisible()
    await shot(embedPage, 'website-iframe-1280x800')
    await embedPage.setViewportSize({ width: 375, height: 812 })
    await shot(embedPage, 'website-iframe-375x812')

    // Confirm standalone /p/ route is blocked from cross-origin framing
    const blockedHost = await embedContext.newPage()
    await blockedHost.goto(`${crossOriginBase}/deny-check`, { waitUntil: 'load' })
    await expect(blockedHost.frameLocator('iframe').getByTestId('public-roadmap-title')).toHaveCount(0)
    await blockedHost.close()
  } finally {
    await embedContext.close()
    await new Promise<void>((resolve) => crossOriginServer.close(() => resolve()))
  }

  await viewer.setViewportSize({ width: 375, height: 812 })
  await shot(viewer, 'mobile-viewer-375x812')

  await shareModal.getByRole('button', { name: 'Close' }).click()
  await expect(shareModal).toBeHidden()
  const savedUpdate = page.waitForResponse((response) => (
    response.request().method() === 'PATCH'
    && /\/api\/roadmaps\/rm_.*\/tasks\/.*\/done$/.test(response.url())
    && response.ok()
  ))
  await page.getByRole('checkbox', { name: /Choose the first audience/ }).click()
  await savedUpdate
  await viewer.setViewportSize({ width: 1280, height: 800 })
  await viewer.reload()
  await expect(viewer.getByText('2 of 9 tasks')).toBeVisible()
  await shot(viewer, 'viewer-after-save-1280x800')

  await page.locator('.header-end button', { hasText: 'Share' }).click()
  const shareAgain = page.getByRole('dialog', { name: /Share this roadmap/i })
  await shareAgain.getByTestId('public-publish-toggle').click()
  await shareAgain.getByTestId('unpublish-roadmap').click()
  await shareAgain.getByTestId('confirm-unpublish').click()
  await expect(shareAgain.getByTestId('publish-roadmap')).toBeVisible()
  await shot(page, 'unpublished-share-1280x800', false)

  await viewer.goto(published.viewer_url)
  await expect(viewer.getByRole('heading', { name: 'This roadmap is not available' })).toBeVisible()
  await expect(viewer.getByRole('link', { name: /Built with RoadForge by Anvilary\.Tools/ })).toBeVisible()
  await shot(viewer, 'unpublished-viewer-1280x800')
  const hiddenImage = await viewer.request.get(imageUrl)
  expect(hiddenImage.status()).toBe(404)

  // Republish issues a new identifier while old identifier remains invalid
  await shareAgain.getByTestId('publish-roadmap').click()
  const republishResponse = page.waitForResponse((response) => (
    response.url().includes('/publication') && response.request().method() === 'POST'
  ))
  await shareAgain.getByTestId('confirm-publish').click()
  const republished = await (await republishResponse).json()
  expect(republished.public_id).not.toBe(published.public_id)

  await viewer.goto(published.viewer_url)
  await expect(viewer.getByRole('heading', { name: 'This roadmap is not available' })).toBeVisible()

  await viewer.goto(republished.viewer_url)
  await expect(viewer.getByTestId('public-roadmap-title')).toHaveText('Public Launch Roadmap')

  await viewer.close()
})
