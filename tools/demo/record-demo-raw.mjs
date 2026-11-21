import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const mediaDir = path.join(projectRoot, 'docs', 'media')
const tempVideoDir = path.join(mediaDir, '.tmp-demo-raw')

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function availablePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const { port } = server.address()
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  return port
}

function checkServerReady(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 304)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(1000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function startServer(port) {
  const url = `http://127.0.0.1:${port}`
  console.log(`Starting isolated production server on port ${port}...`)
  const serverProcess = spawn(
    process.execPath,
    [path.join(projectRoot, 'apps/frontend/scripts/serve-standalone.mjs')],
    {
      cwd: path.join(projectRoot, 'apps/frontend'),
      env: {
        ...process.env,
        PORT: String(port),
        HOSTNAME: '127.0.0.1',
      },
      stdio: 'pipe',
    },
  )

  const deadline = Date.now() + 30000
  while (Date.now() < deadline) {
    await sleep(200)
    if (await checkServerReady(url)) {
      console.log(`Server successfully started at ${url}`)
      return { serverProcess, url }
    }
  }

  serverProcess.kill('SIGTERM')
  throw new Error(`Timed out waiting for server at ${url}`)
}

async function smoothMoveTo(page, targetX, targetY, steps = 10) {
  await page.mouse.move(targetX, targetY, { steps })
}

async function smoothClick(page, locator, waitAfter = 200) {
  await locator.scrollIntoViewIfNeeded()
  let box = await locator.boundingBox()
  if (box && box.y < 100) {
    await page.evaluate((delta) => window.scrollBy({ top: delta, behavior: 'instant' }), box.y - 120)
    await sleep(40)
    box = await locator.boundingBox()
  }
  if (!box) {
    await locator.click()
  } else {
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    await smoothMoveTo(page, cx, cy, 9)
    await sleep(40)
    await page.mouse.down()
    await sleep(40)
    await page.mouse.up()
  }
  await sleep(waitAfter)
}

async function smoothType(page, locator, text, delay = 12) {
  await smoothClick(page, locator, 60)
  for (const char of text) {
    await page.keyboard.type(char)
    await sleep(delay)
  }
  await sleep(100)
}

async function ensurePhaseOpen(page, phaseLocator) {
  await phaseLocator.scrollIntoViewIfNeeded()
  let box = await phaseLocator.boundingBox()
  if (box && box.y < 100) {
    await page.evaluate((delta) => window.scrollBy({ top: delta, behavior: 'instant' }), box.y - 120)
    await sleep(40)
  }
  const isExpanded = await phaseLocator.evaluate((el) => el.classList.contains('expanded'))
  if (!isExpanded) {
    const toggleBtn = phaseLocator.locator('.phase-toggle-btn')
    if (await toggleBtn.isVisible()) {
      await smoothClick(page, toggleBtn, 150)
    }
  }
}

async function toggleTask(page, taskRowLocator, shouldExpand = null) {
  await taskRowLocator.scrollIntoViewIfNeeded()
  let box = await taskRowLocator.boundingBox()
  if (box && box.y < 100) {
    await page.evaluate((delta) => window.scrollBy({ top: delta, behavior: 'instant' }), box.y - 120)
    await sleep(40)
  }
  const toggleBtn = taskRowLocator.locator('.toggle-btn')
  const isExpanded = (await toggleBtn.getAttribute('aria-expanded')) === 'true'
  const target = shouldExpand !== null ? shouldExpand : !isExpanded
  if (isExpanded !== target) {
    await smoothClick(page, toggleBtn, 180)
  }
}

export async function recordDemoRaw() {
  if (existsSync(tempVideoDir)) rmSync(tempVideoDir, { recursive: true, force: true })
  mkdirSync(tempVideoDir, { recursive: true })
  if (!existsSync(mediaDir)) mkdirSync(mediaDir, { recursive: true })

  const port = await availablePort()
  const { serverProcess, url: BASE_URL } = await startServer(port)

  console.log('Launching browser to record raw demonstration...')
  const browser = await chromium.launch({
    headless: true,
  })

  // Logical viewport 1440x810 with DPR 1.33333333 produces native 1920x1080 canvas
  // where workspace takes ~71% of screen width with ideal text readability
  const context = await browser.newContext({
    viewport: { width: 1440, height: 810 },
    deviceScaleFactor: 1.33333333,
    recordVideo: {
      dir: tempVideoDir,
      size: { width: 1920, height: 1080 },
    },
    acceptDownloads: true,
  })

  const page = await context.newPage()

  // Track console errors
  const consoleErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  // Inject sleek SVG cursor with subtle click ripple
  await page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      const cursor = document.createElement('div')
      cursor.id = 'demo-cursor'
      cursor.style.position = 'fixed'
      cursor.style.top = '0px'
      cursor.style.left = '0px'
      cursor.style.pointerEvents = 'none'
      cursor.style.zIndex = '9999999'
      cursor.style.transform = 'translate(0, 0)'
      cursor.style.transition = 'transform 0.04s ease-out'
      cursor.style.display = 'none'

      cursor.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.6));">
          <path d="M3 2L18.5 12.5L11.5 14.5L8.5 21.5L3 2Z" fill="#F8FAFC" stroke="#0F172A" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        <div id="demo-cursor-ripple" style="
          position: absolute;
          top: 0px;
          left: 0px;
          width: 0px;
          height: 0px;
          border-radius: 50%;
          border: 2px solid rgba(249, 115, 22, 0.75);
          transform: translate(-50%, -50%);
          opacity: 0;
          pointer-events: none;
        "></div>
      `
      document.body.appendChild(cursor)

      window.addEventListener('mousemove', (e) => {
        cursor.style.display = 'block'
        cursor.style.left = `${e.clientX}px`
        cursor.style.top = `${e.clientY}px`
      })

      window.addEventListener('mousedown', () => {
        const ripple = document.getElementById('demo-cursor-ripple')
        if (ripple) {
          ripple.style.transition = 'none'
          ripple.style.width = '0px'
          ripple.style.height = '0px'
          ripple.style.opacity = '0.9'
          ripple.offsetHeight // force reflow
          ripple.style.transition = 'width 0.28s cubic-bezier(0.1, 0.8, 0.3, 1), height 0.28s cubic-bezier(0.1, 0.8, 0.3, 1), opacity 0.28s ease-out'
          ripple.style.width = '24px'
          ripple.style.height = '24px'
          ripple.style.opacity = '0'
        }
      })
    })
  })

  const sceneManifest = {
    startedAt: Date.now(),
    scenes: {},
  }

  function markScene(name) {
    const elapsed = (Date.now() - sceneManifest.startedAt) / 1000
    sceneManifest.scenes[name] = elapsed
    console.log(`[${elapsed.toFixed(2)}s] ${name}`)
  }

  // --- ACT 1: THE IDEA (0s - 8.5s) ---
  markScene('act1_start')
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })
  await sleep(500)

  // Move to CTA and click
  const ctaBtn = page.locator('.hero .btn.primary, button:has-text("Hosted demo"), button:has-text("Create roadmap")').first()
  await smoothClick(page, ctaBtn, 400)

  const wizard = page.getByRole('dialog', { name: 'Create your roadmap' })
  await wizard.waitFor({ state: 'visible' })
  await sleep(250)

  const displayNameInput = wizard.getByLabel('Your display name', { exact: true })
  await smoothType(page, displayNameInput, 'Developer', 20)
  await sleep(180)

  const roadmapTitleInput = wizard.getByLabel('Roadmap title', { exact: true })
  await smoothType(page, roadmapTitleInput, 'Launching a Developer Tool', 16)
  await sleep(250)

  const continueBtn = wizard.getByRole('button', { name: /Continue/ })
  await smoothClick(page, continueBtn, 350)

  const startingPointStep = page.getByRole('dialog', { name: 'Start simple' })
  await startingPointStep.waitFor({ state: 'visible' })
  await sleep(300)

  const createRoadmapSubmit = startingPointStep.getByRole('button', { name: 'Create roadmap', exact: true })
  await smoothClick(page, createRoadmapSubmit, 500)

  await page.waitForURL(/\/workspace\?roadmap=/, { timeout: 15000 })
  await sleep(500)
  markScene('act1_end')

  // --- ACT 2: STRUCTURE (8.5s - 14.5s) ---
  markScene('act2_start')
  const addPhaseBtn = page.getByRole('button', { name: 'Add another phase', exact: true })

  const phaseNames = ['Development', 'Testing', 'Release']
  for (const name of phaseNames) {
    await smoothClick(page, addPhaseBtn, 200)
    const phaseInput = page.locator('.phase-name-input')
    await phaseInput.waitFor({ state: 'visible' })
    await smoothType(page, phaseInput, name, 16)
    await page.keyboard.press('Enter')
    await sleep(250)

    // Verify exact phase title replacement
    const createdPhaseHeader = page.locator('.phase-head').last()
    const phaseNameText = (await createdPhaseHeader.locator('.phase-summary-body .name').textContent())?.trim()
    if (phaseNameText !== name) {
      throw new Error(`Phase naming failure: expected "${name}", got "${phaseNameText}"`)
    }
  }

  // Validate all 4 phases strictly
  const expectedAllPhases = ['Planning', 'Development', 'Testing', 'Release']
  const renderedPhaseNames = (await page.locator('.phase .phase-summary-body .name').allTextContents()).map((s) => s.trim())
  for (let i = 0; i < expectedAllPhases.length; i++) {
    if (renderedPhaseNames[i] !== expectedAllPhases[i]) {
      throw new Error(`Roadmap phase mismatch at ${i}: expected "${expectedAllPhases[i]}", got "${renderedPhaseNames[i]}"`)
    }
  }

  // Expand all phases
  const expandAllBtn = page.getByRole('button', { name: /Expand all/ })
  if (await expandAllBtn.isVisible()) {
    await smoothClick(page, expandAllBtn, 300)
  }
  await sleep(250)
  markScene('act2_end')

  // --- ACT 3: TASKS AND SUBTASKS (14.5s - 32.0s) ---
  markScene('act3_start')
  const phases = page.locator('.phase')

  async function addTasks(phaseIndex, taskTitles) {
    const targetPhase = phases.nth(phaseIndex)
    await ensurePhaseOpen(page, targetPhase)
    for (let i = 0; i < taskTitles.length; i++) {
      const taskTitle = taskTitles[i]
      if (i === 0) {
        const addFirstBtn = targetPhase.getByRole('button', { name: /Add first task/ })
        if (await addFirstBtn.isVisible()) {
          await smoothClick(page, addFirstBtn, 120)
        } else {
          await smoothClick(page, targetPhase.locator('.add-task-btn'), 120)
        }
      } else {
        await smoothClick(page, targetPhase.locator('.add-task-btn'), 120)
      }
      const draftInput = targetPhase.locator('.draft-task-input')
      await draftInput.waitFor({ state: 'visible' })
      await smoothType(page, draftInput, taskTitle, 10)
      await page.keyboard.press('Enter')
      await sleep(150)
    }
  }

  // 1. Planning phase
  await addTasks(0, [
    'Define product requirements',
    'Design core architecture',
  ])

  // 2. Development phase
  await addTasks(1, [
    'Implement frontend components',
    'Build local persistence engine',
  ])

  // 3. Testing phase
  await addTasks(2, [
    'Write automated unit test suites',
    'Run Playwright end-to-end tests',
  ])

  // 4. Release phase
  await addTasks(3, [
    'Prepare user documentation',
    'Publish initial release candidate',
  ])

  // Subtasks on Planning: "Define product requirements"
  const planningPhase = phases.nth(0)
  await ensurePhaseOpen(page, planningPhase)
  const reqsHeader = planningPhase.locator('.task-row', { hasText: 'Define product requirements' }).first()
  await toggleTask(page, reqsHeader, true)

  const addSubtaskBtn = page.getByRole('button', { name: 'Add subtask' })
  await addSubtaskBtn.waitFor({ state: 'visible' })

  const reqsSubtasks = [
    'Target developer personas',
    'Establish acceptance criteria',
  ]
  for (const st of reqsSubtasks) {
    await smoothClick(page, addSubtaskBtn, 120)
    const input = page.getByLabel('Subtask title')
    await smoothType(page, input, st, 10)
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await sleep(150)
  }

  // Mark first subtask complete
  const personaCheck = page.getByRole('checkbox', {
    name: 'Mark subtask "Target developer personas" as complete',
  })
  await smoothClick(page, personaCheck, 250)
  await toggleTask(page, reqsHeader, false)

  // Subtasks on Development: "Implement frontend components"
  const devPhase = phases.nth(1)
  await ensurePhaseOpen(page, devPhase)
  const frontendTaskHeader = devPhase.locator('.task-row', { hasText: 'Implement frontend components' }).first()
  await toggleTask(page, frontendTaskHeader, true)
  await addSubtaskBtn.waitFor({ state: 'visible' })

  const devSubtasks = [
    'Responsive hero layout',
    'Accessible navigation',
  ]
  for (const st of devSubtasks) {
    await smoothClick(page, addSubtaskBtn, 120)
    const input = page.getByLabel('Subtask title')
    await smoothType(page, input, st, 10)
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await sleep(150)
  }

  // Mark first subtask complete
  const heroCheck = page.getByRole('checkbox', {
    name: 'Mark subtask "Responsive hero layout" as complete',
  })
  await smoothClick(page, heroCheck, 250)
  await toggleTask(page, frontendTaskHeader, false)
  await sleep(250)
  markScene('act3_end')

  // --- ACT 4: INTELLIGENCE AND PROGRESS (32.0s - 45.0s) ---
  markScene('act4_start')
  // 1. Task: Design core architecture -> High Complexity, Tag: Core, Rich Markdown
  await ensurePhaseOpen(page, planningPhase)
  const archTaskHeader = planningPhase.locator('.task-row', { hasText: 'Design core architecture' }).first()
  await toggleTask(page, archTaskHeader, true)

  const editDetailsBtn = page.getByRole('button', { name: 'Edit details' })
  await editDetailsBtn.waitFor({ state: 'visible' })
  await smoothClick(page, editDetailsBtn, 200)

  const complexitySelect = page.locator('select[id^="edit-complexity-"]')
  await smoothClick(page, complexitySelect, 150)
  await complexitySelect.selectOption('high')
  await sleep(150)

  const descTextarea = page.locator('textarea[id^="edit-desc-"]')
  await smoothType(
    page,
    descTextarea,
    '### Architecture\n- Local-first persistence\n- Realtime sync\n',
    10,
  )
  await sleep(150)

  const tagInput = page.locator('.tag-chip-input')
  if (await tagInput.isVisible()) {
    await smoothType(page, tagInput, 'Core', 12)
    await page.keyboard.press('Enter')
    await sleep(150)
  }

  const saveBtn = page.getByRole('button', { name: 'Save', exact: true })
  await smoothClick(page, saveBtn, 250)
  await toggleTask(page, archTaskHeader, false)

  // 2. Tag "Engine" on Persistence task
  await ensurePhaseOpen(page, devPhase)
  const engineTaskHeader = devPhase.locator('.task-row', { hasText: 'Build local persistence engine' }).first()
  await toggleTask(page, engineTaskHeader, true)
  await smoothClick(page, editDetailsBtn, 200)
  if (await tagInput.isVisible()) {
    await smoothType(page, tagInput, 'Engine', 12)
    await page.keyboard.press('Enter')
    await sleep(150)
  }
  await smoothClick(page, saveBtn, 250)
  await toggleTask(page, engineTaskHeader, false)

  // 3. Dependency: "Publish initial release candidate" depends on "Run Playwright end-to-end tests"
  const releasePhase = phases.nth(3)
  await ensurePhaseOpen(page, releasePhase)
  const publishTaskHeader = releasePhase.locator('.task-row', { hasText: 'Publish initial release candidate' }).first()
  await toggleTask(page, publishTaskHeader, true)

  const linkDepBtn = page.getByRole('button', { name: 'Link dependency' })
  await linkDepBtn.waitFor({ state: 'visible' })
  await smoothClick(page, linkDepBtn, 200)

  const depSearchInput = page.getByLabel('Search tasks to link')
  await smoothType(page, depSearchInput, 'Playwright', 12)
  await sleep(200)

  const depOption = page.locator('.task-option', { hasText: 'Run Playwright end-to-end tests' }).first()
  await smoothClick(page, depOption, 250)
  await toggleTask(page, publishTaskHeader, false)
  await sleep(500) // Show amber Blocked status badge clearly

  // 4. Progress and Unblocking: Complete prerequisites
  const testPhase = phases.nth(2)
  await ensurePhaseOpen(page, testPhase)
  const unitCheck = page.getByRole('checkbox', {
    name: 'Mark task "Write automated unit test suites" as complete',
  })
  await smoothClick(page, unitCheck, 300)

  const playwrightCheck = page.getByRole('checkbox', {
    name: 'Mark task "Run Playwright end-to-end tests" as complete',
  })
  await smoothClick(page, playwrightCheck, 500)
  // Watch "Publish initial release candidate" clear its blocker status!
  await sleep(400)
  markScene('act4_end')

  // --- ACT 5: THE RESULT (45.0s - 59.0s) ---
  markScene('act5_start')
  // Brief Export interaction
  const ioBtn = page.getByRole('button', { name: 'Import / Export' })
  await smoothClick(page, ioBtn, 250)
  const downloadJsonBtn = page.getByRole('button', { name: 'Download JSON' })
  await downloadJsonBtn.waitFor({ state: 'visible' })
  await sleep(500)
  // Close export modal cleanly
  const closeIoBtn = page.getByRole('button', { name: 'Close modal' }).or(page.locator('.modal-close')).first()
  if (await closeIoBtn.isVisible()) {
    await smoothClick(page, closeIoBtn, 200)
  } else {
    await page.keyboard.press('Escape')
    await sleep(200)
  }

  // Ensure all phases are expanded for clear beauty overview
  if (await expandAllBtn.isVisible()) {
    await smoothClick(page, expandAllBtn, 250)
  }

  // Smooth gentle scroll to showcase the full 4-phase roadmap
  for (let y = 0; y <= 220; y += 15) {
    await page.evaluate((top) => window.scrollTo({ top }), y)
    await sleep(25)
  }
  await sleep(600)

  for (let y = 220; y >= 0; y -= 15) {
    await page.evaluate((top) => window.scrollTo({ top }), y)
    await sleep(25)
  }

  // Final hold on the completed roadmap
  markScene('beauty_hold')
  await sleep(4500)
  markScene('act5_end')

  const totalRawDuration = (Date.now() - sceneManifest.startedAt) / 1000
  sceneManifest.totalRawDuration = totalRawDuration
  console.log(`Raw demonstration recording finished in ${totalRawDuration.toFixed(2)}s`)

  // Verify console errors
  if (consoleErrors.length > 0) {
    console.warn(`Encountered ${consoleErrors.length} console errors:`, consoleErrors)
  }

  const video = page.video()
  await page.close()
  await context.close()
  await browser.close()
  serverProcess.kill('SIGTERM')

  const rawVideoPath = await video.path()
  sceneManifest.rawVideoPath = rawVideoPath
  writeFileSync(path.join(tempVideoDir, 'scene-manifest.json'), JSON.stringify(sceneManifest, null, 2))
  console.log(`Saved scene manifest and raw video at ${rawVideoPath}`)

  return { rawVideoPath, sceneManifest }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  recordDemoRaw().catch((err) => {
    console.error('Recording failed:', err)
    process.exit(1)
  })
}
