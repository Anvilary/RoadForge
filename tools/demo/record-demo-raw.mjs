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
    ['scripts/serve-standalone.mjs'],
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

async function smoothMoveTo(page, targetX, targetY, steps = 15) {
  const currentPos = await page.evaluate(() => {
    const cur = document.getElementById('demo-cursor')
    if (cur && cur.style.display !== 'none') {
      return { x: parseFloat(cur.style.left) || 0, y: parseFloat(cur.style.top) || 0 }
    }
    return { x: 960, y: 540 }
  })
  const startX = currentPos.x
  const startY = currentPos.y
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    // Ease out cubic
    const ease = 1 - Math.pow(1 - t, 3)
    const x = startX + (targetX - startX) * ease
    const y = startY + (targetY - startY) * ease
    await page.mouse.move(x, y)
    await sleep(12)
  }
}

async function smoothClick(page, locator, waitAfter = 200) {
  await locator.scrollIntoViewIfNeeded()
  let box = await locator.boundingBox()
  if (box && box.y < 90) {
    await page.evaluate((delta) => window.scrollBy({ top: delta, behavior: 'instant' }), box.y - 120)
    await sleep(30)
    box = await locator.boundingBox()
  }
  if (!box) {
    await locator.click()
  } else {
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    await smoothMoveTo(page, cx, cy, 14)
    await sleep(50) // Crisp, natural hover pause
    await page.mouse.down()
    await sleep(45)
    await page.mouse.up()
  }
  await sleep(waitAfter)
}

async function smoothType(page, locator, text) {
  await smoothClick(page, locator, 100)
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    await page.keyboard.type(char)
    if (char === ' ') {
      await sleep(110 + Math.floor(Math.random() * 40))
    } else {
      await sleep(55 + Math.floor(Math.random() * 25))
    }
  }
  await sleep(220)
}

async function ensurePhaseOpen(page, phaseLocator) {
  await phaseLocator.scrollIntoViewIfNeeded()
  let box = await phaseLocator.boundingBox()
  if (box && box.y < 90) {
    await page.evaluate((delta) => window.scrollBy({ top: delta, behavior: 'instant' }), box.y - 120)
    await sleep(30)
  }
  const isExpanded = await phaseLocator.evaluate((el) => el.classList.contains('expanded'))
  if (!isExpanded) {
    const toggleBtn = phaseLocator.locator('.phase-toggle-btn')
    if (await toggleBtn.isVisible()) {
      await smoothClick(page, toggleBtn, 180)
    }
  }
}

async function ensurePhaseCollapsed(page, phaseLocator) {
  await phaseLocator.scrollIntoViewIfNeeded()
  let box = await phaseLocator.boundingBox()
  if (box && box.y < 90) {
    await page.evaluate((delta) => window.scrollBy({ top: delta, behavior: 'instant' }), box.y - 120)
    await sleep(30)
  }
  const isExpanded = await phaseLocator.evaluate((el) => el.classList.contains('expanded'))
  if (isExpanded) {
    const toggleBtn = phaseLocator.locator('.phase-toggle-btn')
    if (await toggleBtn.isVisible()) {
      await smoothClick(page, toggleBtn, 180)
    }
  }
}

async function toggleTask(page, taskRowLocator, shouldExpand = null) {
  await taskRowLocator.scrollIntoViewIfNeeded()
  let box = await taskRowLocator.boundingBox()
  if (box && box.y < 90) {
    await page.evaluate((delta) => window.scrollBy({ top: delta, behavior: 'instant' }), box.y - 120)
    await sleep(30)
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

  console.log('Launching browser to record balanced Full HD product demonstration...')
  const browser = await chromium.launch({
    headless: true,
  })

  // Viewport 1920x1080 with EXACTLY MATCHED 1920x1080 recording size
  // Full-bleed geometry, genuine 1080p source capture, zero gray padding
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
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

  // Inject crisp SVG cursor overlay and interactive ripple
  await page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      if (document.getElementById('demo-cursor')) return
      const cursor = document.createElement('div')
      cursor.id = 'demo-cursor'
      cursor.style.position = 'fixed'
      cursor.style.top = '0px'
      cursor.style.left = '0px'
      cursor.style.width = '20px'
      cursor.style.height = '20px'
      cursor.style.pointerEvents = 'none'
      cursor.style.zIndex = '9999999'
      cursor.style.transform = 'translate(-3px, -2px)'
      cursor.style.transition = 'transform 0.04s ease-out'
      cursor.style.display = 'none'

      cursor.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.7));">
          <path d="M3 2L18.5 12.5L11.5 14.5L8.5 21.5L3 2Z" fill="#FFFFFF" stroke="#0F172A" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        <div id="demo-cursor-ripple" style="
          position: absolute;
          top: 2px;
          left: 3px;
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

  // =========================================================================
  // ACT 1: CREATE THE PROJECT (0s - ~16s)
  // =========================================================================
  markScene('act1_start')
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })
  await sleep(1000) // Clear initial pause on hero

  // Move smoothly to CTA and click
  const ctaBtn = page.locator('.hero .btn.primary, button:has-text("Hosted demo"), button:has-text("Create roadmap")').first()
  await smoothClick(page, ctaBtn, 400)

  const wizard = page.getByRole('dialog', { name: 'Create your roadmap' })
  await wizard.waitFor({ state: 'visible' })
  await sleep(500) // Give viewer time to recognize the creation dialog

  const displayNameInput = wizard.getByLabel('Your display name', { exact: true })
  await smoothType(page, displayNameInput, 'Developer')
  await sleep(300)

  const roadmapTitleInput = wizard.getByLabel('Roadmap title', { exact: true })
  await smoothType(page, roadmapTitleInput, 'Launching a Developer Tool')
  await sleep(800) // Pause so viewer can clearly read the entered title

  const continueBtn = wizard.getByRole('button', { name: /Continue/ })
  await smoothClick(page, continueBtn, 400)

  const startingPointStep = page.getByRole('dialog', { name: 'Start simple' })
  await startingPointStep.waitFor({ state: 'visible' })
  await sleep(600)

  const createRoadmapSubmit = startingPointStep.getByRole('button', { name: 'Create roadmap', exact: true })
  await smoothClick(page, createRoadmapSubmit, 600)

  await page.waitForURL(/\/workspace\?roadmap=/, { timeout: 15000 })
  await sleep(600)

  // Cleanly dismiss the onboarding welcome banner to maximize workspace clarity and vertical space
  const welcomeDismissBtn = page.getByRole('button', { name: 'Dismiss welcome onboarding banner' })
  if (await welcomeDismissBtn.isVisible()) {
    await smoothClick(page, welcomeDismissBtn, 350)
  }

  // Hold on the clean initial workspace
  await sleep(1800)
  markScene('act1_end')

  // =========================================================================
  // ACT 2: STRUCTURE THE ROADMAP (16s - ~42s)
  // =========================================================================
  markScene('act2_start')
  const addPhaseBtn = page.getByRole('button', { name: 'Add another phase', exact: true })

  // RoadForge creates "Planning" by default. We add "Development", "Testing", "Release"
  const phaseNames = ['Development', 'Testing', 'Release']
  for (const name of phaseNames) {
    await smoothClick(page, addPhaseBtn, 300)
    const phaseInput = page.locator('.phase-name-input')
    await phaseInput.waitFor({ state: 'visible' })
    await smoothType(page, phaseInput, name)
    await page.keyboard.press('Enter')
    await sleep(1400) // Deliberate pause so viewer absorbs each new phase card and color accent

    // Strict validation: default placeholder must be completely replaced
    const createdPhaseHeader = page.locator('.phase-head').last()
    const phaseNameText = (await createdPhaseHeader.locator('.phase-summary-body .name').textContent())?.trim()
    if (phaseNameText !== name) {
      throw new Error(`Phase naming failure: expected "${name}", got "${phaseNameText}"`)
    }
  }

  // Strictly validate all 4 phases
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
    await smoothClick(page, expandAllBtn, 350)
  }
  // Hold to appreciate the 4-phase project architecture
  await sleep(2200)
  markScene('act2_end')

  // =========================================================================
  // ACT 3: ADD TASKS AND SUBTASKS (42s - ~95s)
  // =========================================================================
  markScene('act3_start')
  const phases = page.locator('.phase')

  async function addTasksToPhase(phaseIndex, taskTitles) {
    const targetPhase = phases.nth(phaseIndex)
    await ensurePhaseOpen(page, targetPhase)
    for (let i = 0; i < taskTitles.length; i++) {
      const taskTitle = taskTitles[i]
      if (i === 0) {
        const addFirstBtn = targetPhase.getByRole('button', { name: /Add first task/ })
        if (await addFirstBtn.isVisible()) {
          await smoothClick(page, addFirstBtn, 180)
        } else {
          await smoothClick(page, targetPhase.locator('.add-task-btn'), 180)
        }
      } else {
        await smoothClick(page, targetPhase.locator('.add-task-btn'), 180)
      }
      const draftInput = targetPhase.locator('.draft-task-input')
      await draftInput.waitFor({ state: 'visible' })
      await smoothType(page, draftInput, taskTitle)
      await page.keyboard.press('Enter')
      await sleep(250)
    }
  }

  // Step 1: Create tasks in Planning
  const planningPhase = phases.nth(0)
  await addTasksToPhase(0, [
    'Define product requirements',
    'Design core architecture',
    'Establish milestones',
  ])
  await sleep(600)

  // Step 2: Demonstrate Subtasks on Planning ("Define product requirements")
  await ensurePhaseOpen(page, planningPhase)
  const reqsHeader = planningPhase.locator('.task-row', { hasText: 'Define product requirements' }).first()
  await toggleTask(page, reqsHeader, true)
  await sleep(600)

  const addSubtaskBtn = page.getByRole('button', { name: 'Add subtask' })
  await addSubtaskBtn.waitFor({ state: 'visible' })

  // Add subtask 1
  await smoothClick(page, addSubtaskBtn, 180)
  const stInput1 = page.getByLabel('Subtask title')
  await smoothType(page, stInput1, 'Target developer personas')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await sleep(500)

  // Add subtask 2
  await smoothClick(page, addSubtaskBtn, 180)
  await smoothType(page, stInput1, 'Establish acceptance criteria')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await sleep(1500) // Pause to let viewer absorb subtask list and hierarchy

  // Mark first subtask complete
  const personaCheck = page.getByRole('checkbox', {
    name: 'Mark subtask "Target developer personas" as complete',
  })
  await smoothClick(page, personaCheck, 350)
  await sleep(1500) // Pause to see subtask completion and progress update
  await toggleTask(page, reqsHeader, false)
  await sleep(600)

  // Step 3: Create tasks in Development
  const devPhase = phases.nth(1)
  await addTasksToPhase(1, [
    'Implement frontend components',
    'Build local persistence',
    'Integrate core engine',
  ])
  await sleep(600)

  // Step 4: Demonstrate Subtasks on Development ("Implement frontend components")
  await ensurePhaseOpen(page, devPhase)
  const frontendTaskHeader = devPhase.locator('.task-row', { hasText: 'Implement frontend components' }).first()
  await toggleTask(page, frontendTaskHeader, true)
  await sleep(600)

  await smoothClick(page, addSubtaskBtn, 180)
  await smoothType(page, stInput1, 'Responsive hero layout')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await sleep(500)

  await smoothClick(page, addSubtaskBtn, 180)
  await smoothType(page, stInput1, 'Accessible navigation')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await sleep(1500)

  const heroCheck = page.getByRole('checkbox', {
    name: 'Mark subtask "Responsive hero layout" as complete',
  })
  await smoothClick(page, heroCheck, 350)
  await sleep(1500) // Pause to see subtask complete
  await toggleTask(page, frontendTaskHeader, false)
  await sleep(600)

  // Step 5: Populate Testing and Release deliverables briskly through real UI actions
  await addTasksToPhase(2, [
    'Write automated tests',
    'Validate accessibility',
    'Verify production builds',
  ])
  await sleep(500)

  await addTasksToPhase(3, [
    'Prepare documentation',
    'Finalize deployment',
    'Publish the release',
  ])
  await sleep(800)

  // Step 6: Reveal the populated roadmap
  await page.evaluate(() => window.scrollTo({ top: 120, behavior: 'smooth' }))
  await sleep(2500) // Hold to appreciate the fully populated 4-phase engineering roadmap
  markScene('act3_end')

  // =========================================================================
  // ACT 4: PLANNING INTELLIGENCE (95s - ~140s)
  // =========================================================================
  markScene('act4_start')
  // 1. Task: Design core architecture -> High Complexity, Tag: Core, Rich Markdown
  await ensurePhaseOpen(page, planningPhase)
  const archTaskHeader = planningPhase.locator('.task-row', { hasText: 'Design core architecture' }).first()
  await toggleTask(page, archTaskHeader, true)
  await sleep(500)

  const editDetailsBtn = page.getByRole('button', { name: 'Edit details' })
  await editDetailsBtn.waitFor({ state: 'visible' })
  await smoothClick(page, editDetailsBtn, 300)

  const complexityTrigger = page.locator('.complexity-select-trigger').first()
  await smoothClick(page, complexityTrigger, 300)
  await sleep(400) // Allow dropdown to expand cleanly
  const highOption = page.locator('.complexity-option-btn', { hasText: /^High/ }).first()
  await smoothClick(page, highOption, 300)
  await sleep(800) // Pause to show complexity selected as High

  const descTextarea = page.locator('textarea[id^="edit-desc-"]')
  await smoothType(
    page,
    descTextarea,
    '### Architecture\n- Local-first persistence\n- Realtime sync\n',
  )
  await sleep(350)

  const tagInput = page.locator('.tag-chip-input')
  if (await tagInput.isVisible()) {
    await smoothType(page, tagInput, 'Core')
    await page.keyboard.press('Enter')
    await sleep(500)
  }

  const saveBtn = page.getByRole('button', { name: 'Save', exact: true })
  await smoothClick(page, saveBtn, 350)
  await toggleTask(page, archTaskHeader, false)
  await sleep(1800) // Pause to clearly see red High complexity badge and Core tag chip

  // 2. Tag "Engine" on Persistence task
  await ensurePhaseOpen(page, devPhase)
  const engineTaskHeader = devPhase.locator('.task-row', { hasText: 'Build local persistence' }).first()
  await toggleTask(page, engineTaskHeader, true)
  await smoothClick(page, editDetailsBtn, 300)
  if (await tagInput.isVisible()) {
    await smoothType(page, tagInput, 'Engine')
    await page.keyboard.press('Enter')
    await sleep(500)
  }
  await smoothClick(page, saveBtn, 350)
  await toggleTask(page, engineTaskHeader, false)
  await sleep(1500) // Pause to clearly see Engine tag chip

  // 3. Dependency: "Publish the release" depends on "Verify production builds"
  const releasePhase = phases.nth(3)
  await ensurePhaseOpen(page, releasePhase)
  const publishTaskHeader = releasePhase.locator('.task-row', { hasText: 'Publish the release' }).first()
  await toggleTask(page, publishTaskHeader, true)
  await sleep(500)

  const linkDepBtn = page.getByRole('button', { name: 'Link dependency' })
  await linkDepBtn.waitFor({ state: 'visible' })
  await smoothClick(page, linkDepBtn, 300)

  markScene('act4_dep_link')
  const depSearchInput = page.getByLabel('Search tasks to link')
  await smoothType(page, depSearchInput, 'production builds')
  await sleep(350)

  const depOption = page.locator('.task-option', { hasText: 'Verify production builds' }).first()
  await smoothClick(page, depOption, 350)
  await toggleTask(page, publishTaskHeader, false)

  // Hold to showcase the amber Blocked indicator on "Publish the release"
  markScene('act4_blocked_hold')
  await sleep(2500) // Deliberate hold so viewer understands the blocked state

  // 4. Progress and Unblocking: Complete Testing tasks
  markScene('act4_unblock_start')
  const testPhase = phases.nth(2)
  await ensurePhaseOpen(page, testPhase)

  const unitCheck = page.getByRole('checkbox', {
    name: 'Mark task "Write automated tests" as complete',
  })
  await smoothClick(page, unitCheck, 400)
  await sleep(1200) // See Testing progress bar advance

  const a11yCheck = page.getByRole('checkbox', {
    name: 'Mark task "Validate accessibility" as complete',
  })
  await smoothClick(page, a11yCheck, 400)
  await sleep(1200) // See Testing progress bar advance further

  // Complete the prerequisite: "Verify production builds"
  const buildCheck = page.getByRole('checkbox', {
    name: 'Mark task "Verify production builds" as complete',
  })
  await smoothClick(page, buildCheck, 500)

  // Watch the amber Blocked status on "Publish the release" clear to ready!
  await sleep(2500) // Deliberate hold to watch blocker resolve and clear!

  // Complete "Publish the release" in Release phase -> Watch overall progress leap forward!
  await ensurePhaseOpen(page, releasePhase)
  const pubCheck = page.getByRole('checkbox', {
    name: 'Mark task "Publish the release" as complete',
  })
  await smoothClick(page, pubCheck, 500)

  // Pause to appreciate overall progress and completion
  await sleep(2200)
  markScene('act4_end')

  // =========================================================================
  // ACT 5: FINAL SHOWCASE & TOP-TO-BOTTOM OVERVIEW (140s - ~200s)
  // =========================================================================
  markScene('act5_start')
  // 1. Brief Export interaction demonstrating data portability
  const ioBtn = page.getByRole('button', { name: 'Import / Export' })
  await smoothClick(page, ioBtn, 400)
  const downloadJsonBtn = page.getByRole('button', { name: 'Download JSON' })
  await downloadJsonBtn.waitFor({ state: 'visible' })
  await sleep(2200) // Clear demonstration of export options

  // Close export modal cleanly
  const closeIoBtn = page.getByRole('button', { name: 'Close modal' }).or(page.locator('.modal-close')).first()
  if (await closeIoBtn.isVisible()) {
    await smoothClick(page, closeIoBtn, 300)
  } else {
    await page.keyboard.press('Escape')
    await sleep(300)
  }
  await sleep(1000) // Ensure modal is completely closed

  // 2. Continuous Top-to-Bottom Smooth Scroll Showcase (for README GIF and Showcase)
  // Ensure all 4 phases are expanded and tasks are clean
  for (let i = 0; i < 4; i++) {
    await ensurePhaseOpen(page, phases.nth(i))
    for (const tRow of await phases.nth(i).locator('.task-row').all()) {
      const btn = tRow.locator('.toggle-btn')
      if ((await btn.getAttribute('aria-expanded')) === 'true') {
        await smoothClick(page, btn, 120)
      }
    }
  }

  // Scroll to absolute top
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await sleep(500)

  // Park cursor off-screen / out of the way before scroll showcase starts
  const cursorHidden = await page.evaluate(() => {
    const cur = document.getElementById('demo-cursor')
    if (cur) cur.style.display = 'none'
    return true
  })

  // Mark start of dedicated README GIF scroll sequence
  markScene('scroll_showcase_start')
  await sleep(1500) // Initial hold at top: roadforge branding, title, progress, Planning visible

  // Smooth continuous downward scroll: 823px over ~10 seconds (~82px per second)
  const scrollTotalDistance = 825
  const scrollSteps = 200
  const stepDelay = 45 // 200 * 45ms = 9.0s smooth travel
  for (let s = 1; s <= scrollSteps; s++) {
    const fraction = s / scrollSteps
    // Linear / subtle ease-in-out scroll
    const currentY = scrollTotalDistance * fraction
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), currentY)
    await sleep(stepDelay)
  }

  // Hold at bottom: Release phase, completed deliverables, final structure
  await sleep(2000)
  markScene('scroll_showcase_end')

  // 3. Compose the balanced 4-phase beauty showcase
  // Restore cursor
  await page.evaluate(() => {
    const cur = document.getElementById('demo-cursor')
    if (cur) {
      cur.style.display = 'block'
      cur.style.left = '1800px'
      cur.style.top = '1000px'
    }
  })

  // Collapse Phase 0, 1, 2 headers so all four phases fit simultaneously in 1080p frame
  await ensurePhaseCollapsed(page, phases.nth(0))
  await sleep(200)
  await ensurePhaseCollapsed(page, phases.nth(1))
  await sleep(200)
  await ensurePhaseCollapsed(page, phases.nth(2))
  await sleep(200)

  // Ensure Release remains open and compact
  await ensurePhaseOpen(page, phases.nth(3))
  for (const tRow of await phases.nth(3).locator('.task-row').all()) {
    const btn = tRow.locator('.toggle-btn')
    if ((await btn.getAttribute('aria-expanded')) === 'true') {
      await smoothClick(page, btn, 120)
    }
  }

  // Smooth scroll back to top for beauty showcase
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await sleep(800)

  // Programmatically verify all 4 phases fit in the viewport
  for (let i = 0; i < 4; i++) {
    const box = await phases.nth(i).boundingBox()
    if (!box || box.y < 0 || (box.y + box.height) > 1080) {
      console.warn(`Phase ${i} bounding box warning: y=${box?.y}, h=${box?.height}, bottom=${(box?.y || 0) + (box?.height || 0)}`)
    } else {
      console.log(`Phase ${i} fits perfectly: top=${box.y.toFixed(1)}, bottom=${(box.y + box.height).toFixed(1)}`)
    }
  }

  // Final Beauty Hold (12.0 seconds steady hold)
  markScene('beauty_hold')
  await sleep(12000)
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
