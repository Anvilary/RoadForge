import { expect, test } from '@playwright/test'
import { createRoadmap } from './helpers'

test.describe('Phase creation and naming interaction', () => {
  test('replaces default name automatically when typing immediately on newly created phases', async ({ page }) => {
    await createRoadmap(page, { title: 'Phase Creation Test Roadmap', startingPoint: 'blank' })

    // 1. Initial blank roadmap has "Planning"
    await expect(page.locator('.phase-summary-body .name').first()).toHaveText('Planning')

    // 2. Add second phase: "Development"
    await page.getByRole('button', { name: 'Add another phase', exact: true }).click()
    const phaseInput = page.locator('.phase-name-input')
    await expect(phaseInput).toBeVisible()
    await expect(phaseInput).toBeFocused()

    // Verify full selection of temporary name
    const selection = await phaseInput.evaluate((el: HTMLInputElement) => ({
      value: el.value,
      start: el.selectionStart,
      end: el.selectionEnd,
    }))
    expect(selection.value).toBe('New phase')
    expect(selection.start).toBe(0)
    expect(selection.end).toBe(9)

    // Type actual keystrokes into the focused input without using .fill()
    await page.keyboard.type('Development')
    await expect(phaseInput).toHaveValue('Development')
    await page.keyboard.press('Enter')

    // Assert exact replacement: must be "Development", never "New phaseDevelopment"
    const phases = page.locator('.phase .phase-summary-body .name')
    await expect(phases.nth(1)).toHaveText('Development')

    // 3. Add third phase: "Testing"
    await page.getByRole('button', { name: 'Add another phase', exact: true }).click()
    await expect(phaseInput).toBeVisible()
    await expect(phaseInput).toBeFocused()
    await page.keyboard.type('Testing')
    await expect(phaseInput).toHaveValue('Testing')
    await page.keyboard.press('Enter')
    await expect(phases.nth(2)).toHaveText('Testing')

    // 4. Add fourth phase: "Release" (exercising mouse-click on input before typing)
    await page.getByRole('button', { name: 'Add another phase', exact: true }).click()
    await expect(phaseInput).toBeVisible()
    // Click inside the input
    await phaseInput.click()
    // Keystrokes must still replace the untouched temporary name
    await page.keyboard.type('Release')
    await expect(phaseInput).toHaveValue('Release')
    await page.keyboard.press('Enter')
    await expect(phases.nth(3)).toHaveText('Release')

    // 5. Verify all 4 phase names strictly
    const expectedPhases = ['Planning', 'Development', 'Testing', 'Release']
    await expect(phases).toHaveText(expectedPhases)

    // 6. Persistence across page reload
    await page.reload()
    await expect(page.locator('.phase .phase-summary-body .name')).toHaveText(expectedPhases)

    // 7. Existing phase renaming preserves normal keyboard editing
    await page.getByRole('button', { name: 'Phase settings for Planning' }).click()
    await page.getByRole('menuitem', { name: 'Rename' }).click()
    await expect(phaseInput).toBeVisible()
    await expect(phaseInput).toBeFocused()

    // Caret for existing phase is at start without select-all
    const existingSelection = await phaseInput.evaluate((el: HTMLInputElement) => ({
      start: el.selectionStart,
      end: el.selectionEnd,
    }))
    expect(existingSelection.start).toBe(0)
    expect(existingSelection.end).toBe(0)

    // Append to existing name
    await page.keyboard.press('End')
    await page.keyboard.type(' & Inception')
    await page.keyboard.press('Enter')
    await expect(page.locator('.phase-summary-body .name').first()).toHaveText('Planning & Inception')
  })

  test('prevents saving empty name and recovers cleanly', async ({ page }) => {
    await createRoadmap(page, { title: 'Empty Name Test Roadmap', startingPoint: 'blank' })

    await page.getByRole('button', { name: 'Add another phase', exact: true }).click()
    const phaseInput = page.locator('.phase-name-input')
    await expect(phaseInput).toBeVisible()

    // Backspace deletes the selected placeholder
    await page.keyboard.press('Backspace')
    await expect(phaseInput).toHaveValue('')

    // Enter does not save empty name; input remains visible and focused
    await page.keyboard.press('Enter')
    await expect(phaseInput).toBeVisible()
    await expect(phaseInput).toBeFocused()

    // Click outside to blur; cleanly reverts to valid name
    await page.getByRole('heading', { name: 'Empty Name Test Roadmap' }).click()
    await expect(phaseInput).not.toBeVisible()
    await expect(page.locator('.phase .phase-summary-body .name').nth(1)).toHaveText('New phase')
  })

  const viewports = [
    { width: 375, height: 812, name: '375x812' },
    { width: 768, height: 1024, name: '768x1024' },
    { width: 1280, height: 800, name: '1280x800' },
    { width: 1440, height: 900, name: '1440x900' },
    { width: 1920, height: 1080, name: '1920x1080' },
  ]

  for (const vp of viewports) {
    test(`creates 4 phases and captures screenshots at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      const consoleErrors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text())
      })

      await createRoadmap(page, { title: `Viewport ${vp.name} Roadmap`, startingPoint: 'blank' })
      const phaseInput = page.locator('.phase-name-input')

      // Add Development
      await page.getByRole('button', { name: 'Add another phase', exact: true }).click()
      await expect(phaseInput).toBeVisible()
      await page.screenshot({ path: `../../docs/agent-handoffs/screenshots/phase-creation-interaction-${vp.name}.png` })
      await page.keyboard.type('Development')
      await page.keyboard.press('Enter')

      // Add Testing
      await page.getByRole('button', { name: 'Add another phase', exact: true }).click()
      await expect(phaseInput).toBeVisible()
      await page.keyboard.type('Testing')
      await page.keyboard.press('Enter')

      // Add Release
      await page.getByRole('button', { name: 'Add another phase', exact: true }).click()
      await expect(phaseInput).toBeVisible()
      await page.keyboard.type('Release')
      await page.keyboard.press('Enter')

      // Verify all 4 phase names strictly
      const phases = page.locator('.phase .phase-summary-body .name')
      await expect(phases).toHaveText(['Planning', 'Development', 'Testing', 'Release'])

      await page.screenshot({ path: `../../docs/agent-handoffs/screenshots/phase-creation-completed-${vp.name}.png` })
      expect(consoleErrors).toEqual([])
    })
  }
})
