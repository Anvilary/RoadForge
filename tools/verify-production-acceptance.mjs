import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const BASE_URL = 'https://roadforge.anvilary.tools'

async function runAcceptance() {
  console.log(`Starting RoadForge v0.2.0 production reconciliation tests on ${BASE_URL}...`)

  // 1. API Readiness & Health
  console.log('1. Validating API health and readiness endpoints...')
  const endpoints = ['/api/health', '/api/health/ready', '/api/health/live']
  for (const ep of endpoints) {
    const res = await fetch(`${BASE_URL}${ep}`)
    assert.equal(res.status, 200, `${ep} must return HTTP 200`)
    const json = await res.json()
    assert.equal(json.status, 'ok', `${ep} status must be ok`)
    assert.equal(json.version, '0.2.0', `${ep} version must be 0.2.0`)
    console.log(`   ${ep}: status=${json.status}, version=${json.version}`)
  }

  const browser = await chromium.launch({ headless: true })
  const ownerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const ownerPage = await ownerContext.newPage()

  const consoleErrors = []
  const recordConsoleError = (msg) => {
    const text = typeof msg === 'string' ? msg : msg.text()
    if (!text.includes('favicon') && !text.includes('extension')) {
      consoleErrors.push(text)
    }
  }

  ownerPage.on('console', (msg) => {
    if (msg.type() === 'error') recordConsoleError(msg)
  })
  ownerPage.on('pageerror', (err) => recordConsoleError(err.message))

  let serverRoadmapIdToCleanup = null

  try {
    // 2. Marketing Landing Page & Design Parity
    console.log('2. Validating Landing Page, Header, and Footer...')
    await ownerPage.goto(`${BASE_URL}/#hero`, { waitUntil: 'networkidle' })

    const siteHeader = ownerPage.locator('.site-header')
    await siteHeader.waitFor({ state: 'visible', timeout: 5000 })

    const brandLg = ownerPage.locator('.brand-lg')
    await brandLg.waitFor({ state: 'visible', timeout: 5000 })
    assert.equal(await ownerPage.locator('.brand-name').first().textContent(), 'RoadForge')

    const ctaBtn = ownerPage.locator('.ctas .btn.primary')
    await ctaBtn.waitFor({ state: 'visible', timeout: 5000 })

    const siteFooter = ownerPage.locator('.site-footer')
    await siteFooter.waitFor({ state: 'visible', timeout: 5000 })
    const footerBox = await siteFooter.boundingBox()
    assert.ok(footerBox && footerBox.y > 500, 'Site footer must sit in document flow below content')
    console.log('   Landing page visual alignment verified.')

    // 3. Help Page & Accordions
    console.log('3. Validating Help Page and Topic Accordions...')
    await ownerPage.goto(`${BASE_URL}/help`, { waitUntil: 'networkidle' })

    const helpHero = ownerPage.locator('.help-hero')
    await helpHero.waitFor({ state: 'visible', timeout: 5000 })

    const accordions = ownerPage.locator('.help-accordion-item')
    const accordionCount = await accordions.count()
    assert.ok(accordionCount >= 3, `Expected at least 3 accordions, found ${accordionCount}`)

    const firstTrigger = accordions.first().locator('.help-accordion-trigger')
    assert.equal(await firstTrigger.getAttribute('aria-expanded'), 'true', 'First accordion trigger must be expanded initially')

    const secondTrigger = accordions.nth(1).locator('.help-accordion-trigger')
    assert.equal(await secondTrigger.getAttribute('aria-expanded'), 'false', 'Second accordion trigger must be collapsed initially')
    await secondTrigger.click()
    assert.equal(await secondTrigger.getAttribute('aria-expanded'), 'true', 'Second accordion trigger must expand on click')
    assert.equal(await firstTrigger.getAttribute('aria-expanded'), 'false', 'First accordion trigger must collapse')
    console.log(`   Help page verified with ${accordionCount} accordions.`)

    // 4. Create Roadmap Wizard & Local Persistence
    console.log('4. Validating Roadmap Wizard and Browser-Local Persistence...')
    await ownerPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })
    const createBtn = ownerPage.getByRole('button', { name: 'Create roadmap' }).first()
    await createBtn.click()

    const wizardDialog = ownerPage.getByRole('dialog', { name: 'Create your roadmap' })
    await wizardDialog.waitFor({ state: 'visible', timeout: 5000 })

    const displayNameInput = wizardDialog.getByLabel('Your display name', { exact: true })
    const roadmapTitleInput = wizardDialog.getByLabel('Roadmap title', { exact: true })
    await displayNameInput.fill('Release Verifier')
    await roadmapTitleInput.fill('Production Audit Roadmap')

    const continueBtn = wizardDialog.getByRole('button', { name: /Continue/ })
    await continueBtn.click()

    const startingPointStep = ownerPage.getByRole('dialog', { name: 'Start simple' })
    await startingPointStep.waitFor({ state: 'visible', timeout: 5000 })
    await startingPointStep.getByRole('button', { name: 'Create roadmap', exact: true }).click()

    await ownerPage.waitForURL(/\/workspace\?roadmap=local_/, { timeout: 20000 })
    const localRoadmapUrl = ownerPage.url()
    console.log(`   Local roadmap initialized: ${localRoadmapUrl}`)

    // Header and Brand in workspace
    const workspaceBrand = ownerPage.locator('.app-header .brand')
    await workspaceBrand.waitFor({ state: 'visible', timeout: 5000 })
    assert.equal(await workspaceBrand.getAttribute('href'), '/#hero')

    // 5. Phase Creation & Name Assertion
    console.log('5. Validating Phase Creation and Exact Name Assertion...')
    const addPhaseBtn = ownerPage.getByRole('button', { name: 'Add another phase', exact: true })
    await addPhaseBtn.waitFor({ state: 'visible', timeout: 5000 })
    await addPhaseBtn.click()

    const phaseInput = ownerPage.locator('.phase-name-input')
    await phaseInput.waitFor({ state: 'visible', timeout: 5000 })
    const targetPhaseName = 'Audit Verification Phase'
    await ownerPage.keyboard.type(targetPhaseName)
    await ownerPage.keyboard.press('Enter')

    const createdPhaseHeading = ownerPage.locator('.phase .phase-summary-body .name').nth(1)
    await createdPhaseHeading.waitFor({ state: 'visible', timeout: 5000 })
    assert.equal(await createdPhaseHeading.textContent(), targetPhaseName, 'Phase title must match target name exactly')
    console.log('   Phase created and renamed with exact title match verified.')

    // Verify Local Persistence across reload
    console.log('   Testing reload persistence of local roadmap...')
    await ownerPage.reload({ waitUntil: 'networkidle' })
    const persistedHeading = ownerPage.locator('.phase .phase-summary-body .name').nth(1)
    await persistedHeading.waitFor({ state: 'visible', timeout: 5000 })
    assert.equal(await persistedHeading.textContent(), targetPhaseName)
    console.log('   Local persistence verified after full page reload.')

    // 6. Import / Export Functional Validation
    console.log('6. Validating Functional Import / Export Flow...')
    const ioBtn = ownerPage.locator('.header-io-btn')
    await ioBtn.waitFor({ state: 'visible', timeout: 5000 })
    await ioBtn.click()

    const ioModal = ownerPage.getByRole('dialog', { name: /Import \/ Export/i })
    await ioModal.waitFor({ state: 'visible', timeout: 5000 })

    // Test JSON Export
    const downloadPromise = ownerPage.waitForEvent('download', { timeout: 10000 })
    const downloadJsonBtn = ioModal.getByRole('button', { name: /Download JSON/i })
    await downloadJsonBtn.click()
    const download = await downloadPromise
    const downloadStream = await download.createReadStream()
    const chunks = []
    for await (const chunk of downloadStream) {
      chunks.push(chunk)
    }
    const exportedRaw = Buffer.concat(chunks).toString('utf-8')
    const exportedJson = JSON.parse(exportedRaw)
    assert.equal(exportedJson.schema, 'roadforge.roadmap.export', 'Export schema must match')
    assert.equal(exportedJson.roadmap.name, 'Production Audit Roadmap', 'Export roadmap title must match')
    assert.ok(Array.isArray(exportedJson.phases), 'Export phases must be an array')
    console.log(`   Export JSON verified: ${exportedJson.phases.length} phases exported.`)

    // Test JSON Import
    await ioBtn.click()
    await ioModal.waitFor({ state: 'visible', timeout: 5000 })

    const disposablePhase = {
      id: 'phase-imported-disposable',
      name: 'Disposable Imported Phase',
      color: '#e0682b',
      tasks: [
        {
          id: 'task-imported-disposable-1',
          title: 'Imported Verification Task',
          status: 'pending',
          priority: 'medium',
        },
      ],
    }
    const importPayload = {
      ...exportedJson,
      phases: [...exportedJson.phases, disposablePhase],
    }

    const fileChooserPromise = ownerPage.waitForEvent('filechooser', { timeout: 5000 })
    await ioModal.getByRole('button', { name: /Choose JSON file/i }).click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles({
      name: 'disposable-audit-import.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(importPayload, null, 2)),
    })

    const confirmImportBtn = ioModal.locator('.import-notice-actions button.btn.primary')
    await confirmImportBtn.waitFor({ state: 'visible', timeout: 5000 })
    await confirmImportBtn.click()

    const importedHeading = ownerPage.locator('.phase .phase-summary-body .name').filter({ hasText: 'Disposable Imported Phase' }).first()
    await importedHeading.waitFor({ state: 'visible', timeout: 8000 })
    console.log('   Import flow, file parsing, and merge verified.')

    // 7. Server Upgrade, Share, Two-Session Collaboration, and Revocation
    console.log('7. Validating Server Upgrade, Share Links, and Two-Session Collaboration...')
    const enableShareBtn = ownerPage.locator('.header-save-btn', { hasText: 'Share' })
    await enableShareBtn.waitFor({ state: 'visible', timeout: 5000 })
    await enableShareBtn.click()

    const enableModal = ownerPage.getByRole('dialog', { name: 'Enable sharing' })
    await enableModal.waitFor({ state: 'visible', timeout: 5000 })
    const confirmSaveBtn = enableModal.getByRole('button', { name: /Enable sharing/i })
    await confirmSaveBtn.click()

    await ownerPage.waitForURL(/\/workspace\?roadmap=rm_/, { timeout: 20000 })
    const serverUrl = new URL(ownerPage.url())
    serverRoadmapIdToCleanup = serverUrl.searchParams.get('roadmap')
    assert.ok(serverRoadmapIdToCleanup && serverRoadmapIdToCleanup.startsWith('rm_'), 'Server roadmap ID must start with rm_')
    console.log(`   Upgraded to server roadmap: ${serverRoadmapIdToCleanup}`)

    // Open Share modal and generate Editor invite link
    const shareBtn = ownerPage.locator('.header-end button', { hasText: 'Share' })
    await shareBtn.waitFor({ state: 'visible', timeout: 5000 })
    await shareBtn.click()

    const shareModal = ownerPage.getByRole('dialog', { name: /Share this roadmap/i })
    await shareModal.waitFor({ state: 'visible', timeout: 5000 })

    const editorSection = shareModal.locator('.share-role-section', { hasText: 'Editor access' })
    await editorSection.waitFor({ state: 'visible', timeout: 5000 })
    const editorHead = editorSection.locator('.share-role-head')
    if ((await editorHead.getAttribute('aria-expanded')) !== 'true') {
      await editorHead.click()
    }

    const rotateOrGenerateBtn = editorSection.getByRole('button', { name: /Rotate link|Generate invite/i })
    await rotateOrGenerateBtn.waitFor({ state: 'visible', timeout: 5000 })
    await rotateOrGenerateBtn.click()

    const inviteCodeEl = editorSection.locator('code')
    await inviteCodeEl.waitFor({ state: 'visible', timeout: 5000 })
    const inviteUrl = await inviteCodeEl.textContent()
    assert.ok(inviteUrl && inviteUrl.includes('/join#token='), 'Invite URL must contain token fragment')
    console.log('   Editor invite generated successfully.')

    await shareModal.getByRole('button', { name: 'Done' }).click()
    await shareModal.waitFor({ state: 'hidden', timeout: 5000 })

    // Second session: Collaborator joins via invite link
    console.log('   Launching collaborator browser session...')
    const collaboratorContext = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const collaboratorPage = await collaboratorContext.newPage()
    collaboratorPage.on('console', (msg) => {
      if (msg.type() === 'error') recordConsoleError(msg)
    })
    collaboratorPage.on('pageerror', (err) => recordConsoleError(err.message))

    await collaboratorPage.goto(inviteUrl, { waitUntil: 'networkidle' })
    const joinInput = collaboratorPage.getByRole('textbox')
    await joinInput.waitFor({ state: 'visible', timeout: 5000 })
    await joinInput.fill('Collaborator Audit')

    const joinBtn = collaboratorPage.getByRole('button', { name: /Open roadmap/i })
    await joinBtn.click()

    await collaboratorPage.waitForURL(/\/workspace\?roadmap=rm_/, { timeout: 20000 })
    const collabStatus = collaboratorPage.locator('.sync-status-indicator')
    await collabStatus.waitFor({ state: 'visible', timeout: 10000 })
    console.log('   Collaborator joined and live session established.')

    // Revocation: Owner revokes collaborator via Team panel
    console.log('   Testing participant revocation...')
    const teamTab = ownerPage.getByRole('tab', { name: /Team/i })
    await teamTab.waitFor({ state: 'visible', timeout: 5000 })
    await teamTab.click()

    const collaboratorRow = ownerPage.locator('.team-group', { hasText: 'Collaborator Audit' })
    await collaboratorRow.waitFor({ state: 'visible', timeout: 10000 })
    const revokeUserBtn = collaboratorRow.getByRole('button', { name: /Revoke user/i })
    await revokeUserBtn.click()

    const confirmRevokeDialog = ownerPage.getByRole('alertdialog', { name: /Revoke participant/i })
    await confirmRevokeDialog.waitFor({ state: 'visible', timeout: 5000 })
    await confirmRevokeDialog.getByRole('button', { name: 'Revoke participant' }).click()

    const revocationNotice = collaboratorPage.locator('.toast.is-error, .toast', { hasText: /revoked/i })
    await revocationNotice.waitFor({ state: 'visible', timeout: 10000 })
    console.log('   Participant revocation successfully propagated to collaborator.')

    await collaboratorContext.close()
  } finally {
    // 8. Safe Data Cleanup Strategy
    if (serverRoadmapIdToCleanup && ownerPage) {
      console.log(`8. Executing safe cleanup for production test roadmap ${serverRoadmapIdToCleanup}...`)
      try {
        const deleteResult = await ownerPage.evaluate(async (rid) => {
          const res = await fetch(`/api/roadmaps/${rid}`, {
            method: 'DELETE',
            credentials: 'include',
          })
          const body = await res.json().catch(() => null)
          return { status: res.status, body }
        }, serverRoadmapIdToCleanup)
        console.log(`   Deletion API response: status=${deleteResult.status}, body=${JSON.stringify(deleteResult.body)}`)
        assert.equal(deleteResult.status, 200, 'Roadmap deletion API must return HTTP 200')
        assert.ok(deleteResult.body?.ok, 'Roadmap deletion body must have ok: true')
        console.log(`   Production test roadmap ${serverRoadmapIdToCleanup} cleaned up successfully with ok: true.`)
      } catch (cleanupErr) {
        console.error('   Cleanup warning:', cleanupErr)
      }
    }

    await ownerContext.close()
    await browser.close()
  }

  // 9. Strict Console Errors Check
  console.log('9. Checking for unexpected JavaScript console errors...')
  assert.equal(consoleErrors.length, 0, `Unexpected JavaScript console errors encountered: ${consoleErrors.join(', ')}`)
  console.log('   Zero console errors detected across all acceptance flows.')

  console.log('\nAll production reconciliation tests PASSED with full coverage!')
}

runAcceptance().catch((err) => {
  console.error('\nProduction reconciliation test FAILED:', err)
  process.exit(1)
})
