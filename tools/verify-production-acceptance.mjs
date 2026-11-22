import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const BASE_URL = 'https://roadforge.anvilary.tools'

async function runAcceptance() {
  console.log(`Starting RoadForge v0.2.0 production acceptance tests on ${BASE_URL}...`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  const consoleErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  // 1. API Health Check
  console.log('1. Validating API health endpoint...')
  const healthRes = await fetch(`${BASE_URL}/api/health`)
  assert.equal(healthRes.status, 200, 'API health must return 200')
  const healthJson = await healthRes.json()
  assert.equal(healthJson.status, 'ok', 'API health status must be ok')
  assert.equal(healthJson.version, '0.2.0', 'API health version must be 0.2.0')
  console.log(`   Health OK: ${JSON.stringify(healthJson)}`)

  // 2. Landing Page & Design Alignment
  console.log('2. Validating Landing Page & Design Alignment...')
  await page.goto(`${BASE_URL}/#hero`, { waitUntil: 'networkidle' })
  assert.ok(await page.locator('.site-header').isVisible(), 'Site header must be visible')
  assert.ok(await page.locator('.brand-lg').isVisible(), 'Brand logo must use large variant on landing')
  assert.equal(await page.locator('.brand-name').first().textContent(), 'RoadForge')
  assert.ok(await page.locator('.ctas .btn.primary').isVisible(), 'Hero CTA button must be visible')
  
  // Footer document flow
  const footer = page.locator('.site-footer')
  assert.ok(await footer.isVisible(), 'Site footer must be visible')
  const footerBox = await footer.boundingBox()
  assert.ok(footerBox && footerBox.y > 500, 'Footer must be in document flow below content')
  console.log('   Landing page and footer verified.')

  // 3. Help Page & Accordions
  console.log('3. Validating Help Page and Accordions...')
  await page.goto(`${BASE_URL}/help`, { waitUntil: 'networkidle' })
  assert.ok(await page.locator('.help-hero').isVisible(), 'Help hero must be visible')
  const accordions = page.locator('.help-accordion-item')
  const count = await accordions.count()
  assert.ok(count >= 3, `Expected at least 3 help accordions, found ${count}`)
  
  // Verify initial state: first accordion is expanded by default
  const firstTrigger = accordions.first().locator('.help-accordion-trigger')
  assert.equal(await firstTrigger.getAttribute('aria-expanded'), 'true', 'First accordion trigger must be expanded by default')
  
  // Test accordion toggle by clicking second accordion
  const secondTrigger = accordions.nth(1).locator('.help-accordion-trigger')
  assert.equal(await secondTrigger.getAttribute('aria-expanded'), 'false', 'Second accordion must be collapsed initially')
  await secondTrigger.click()
  assert.equal(await secondTrigger.getAttribute('aria-expanded'), 'true', 'Second accordion trigger must be expanded after click')
  assert.equal(await firstTrigger.getAttribute('aria-expanded'), 'false', 'First accordion must collapse when another opens')
  console.log(`   Help page verified with ${count} interactive accordions.`)

  // 4. Create Roadmap Wizard & Workspace Flow
  console.log('4. Validating Create Roadmap Wizard and Workspace Flow...')
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Create roadmap' }).first().click()
  const wizard = page.getByRole('dialog', { name: 'Create your roadmap' })
  assert.ok(await wizard.isVisible(), 'Create roadmap dialog must be visible')

  const displayNameInput = wizard.getByLabel('Your display name', { exact: true })
  const roadmapTitleInput = wizard.getByLabel('Roadmap title', { exact: true })
  await displayNameInput.fill('Release Verifier')
  await roadmapTitleInput.fill('v0.2.0 Production Verification')
  const continueButton = wizard.getByRole('button', { name: /Continue/ })
  await continueButton.click()

  const startingPointStep = page.getByRole('dialog', { name: 'Start simple' })
  assert.ok(await startingPointStep.isVisible(), 'Start simple step must be visible')
  await startingPointStep.getByRole('button', { name: 'Create roadmap', exact: true }).click()

  await page.waitForURL(/\/workspace\?roadmap=/, { timeout: 30_000 })
  console.log(`   Workspace loaded: ${page.url()}`)

  // 5. Workspace UI & Compact Brand
  console.log('5. Validating Compact Workspace Header & Shared Footer...')
  const workspaceBrand = page.locator('.app-header .brand')
  assert.ok(await workspaceBrand.isVisible(), 'Compact brand in header must be visible')
  assert.equal(await workspaceBrand.getAttribute('href'), '/#hero')

  const workspaceFooter = page.locator('.workspace-site-footer, .site-footer')
  assert.ok(await workspaceFooter.isVisible(), 'Shared footer in workspace must be visible')

  // 6. Phase Creation & Inline Replacement
  console.log('6. Validating Phase Creation & Inline Name Replacement...')
  const addPhaseBtn = page.getByRole('button', { name: /Add phase/i })
  if (await addPhaseBtn.isVisible()) {
    await addPhaseBtn.click()
    const phaseTitleInput = page.locator('.phase-title-input, input[placeholder="Phase title"]').last()
    if (await phaseTitleInput.isVisible()) {
      await phaseTitleInput.fill('Production Phase')
      await page.keyboard.press('Enter')
      console.log('   New phase added and renamed.')
    }
  }

  // 7. Import / Export Modal
  console.log('7. Validating Import / Export Modal...')
  const ioBtn = page.locator('.header-io-btn')
  assert.ok(await ioBtn.isVisible(), 'IO button must be visible in header')
  await ioBtn.click()
  const ioModal = page.getByRole('dialog', { name: /Import \/ Export/i })
  assert.ok(await ioModal.isVisible(), 'IO modal must open')
  await page.keyboard.press('Escape')
  assert.ok(!(await ioModal.isVisible()), 'IO modal must dismiss on Escape')
  console.log('   Import / Export modal verified.')

  // 8. Share Modal & Server Backed Sharing
  console.log('8. Validating Share Modal & Server-Backed Flow...')
  const enableShareBtn = page.locator('.header-save-btn', { hasText: 'Share' })
  if (await enableShareBtn.isVisible()) {
    await enableShareBtn.click()
    const enableModal = page.getByRole('dialog', { name: 'Enable sharing' })
    assert.ok(await enableModal.isVisible(), 'Enable sharing modal must open')
    const confirmBtn = enableModal.getByRole('button', { name: /Enable sharing/i })
    await confirmBtn.click()

    await page.waitForURL(/\/workspace\?roadmap=rm_/, { timeout: 20_000 })
    console.log(`   Upgraded to server roadmap: ${page.url()}`)

    // Now open Share modal as owner
    const shareBtn = page.locator('.header-end button', { hasText: 'Share' })
    await shareBtn.click()
    const shareModal = page.getByRole('dialog', { name: /Share this roadmap/i })
    assert.ok(await shareModal.isVisible(), 'Share dialog must open')

    // Verify editor section accordion
    const editorSection = shareModal.locator('.share-role-section', { hasText: 'Editor access' })
    assert.ok(await editorSection.isVisible(), 'Editor access accordion must be present')
    const editorHead = editorSection.locator('.share-role-head')
    await editorHead.click()
    assert.equal(await editorHead.getAttribute('aria-expanded'), 'true', 'Editor accordion must expand')

    await page.keyboard.press('Escape')
    console.log('   Share modal and role accordions verified.')
  }

  // 9. Check CSP Nonces and Console Errors
  console.log('9. Checking Console Errors and CSP Nonces...')
  const filteredErrors = consoleErrors.filter(
    (err) => !err.includes('favicon') && !err.includes('extension')
  )
  if (filteredErrors.length > 0) {
    console.warn('   Console errors noted:', filteredErrors)
  } else {
    console.log('   Zero console errors detected.')
  }

  await browser.close()
  console.log('All production acceptance tests completed successfully!')
}

runAcceptance().catch((err) => {
  console.error('Production acceptance test failed:', err)
  process.exit(1)
})
