import { expect, test } from '@playwright/test'
import { createRoadmap } from './helpers'

test.describe('Phase and Tag Color Picker Layout and Clipping Prevention', () => {
  test.beforeEach(async ({ page }) => {
    // Create a starter template roadmap for testing
    await createRoadmap(page, {
      title: 'Color Picker Clipping Test',
      startingPoint: 'template',
    })
  })

  test('phase color picker in manual mode fits entirely within popover bounds without clipping', async ({ page }) => {
    // Open the first phase settings menu
    const phaseSettingsTrigger = page.locator('.phase-settings-trigger').first()
    await expect(phaseSettingsTrigger).toBeVisible()
    await phaseSettingsTrigger.click()

    // Click Change color
    const changeColorBtn = page.getByRole('menuitem', { name: /Change color/i })
    await expect(changeColorBtn).toBeVisible()
    await changeColorBtn.click()

    const popover = page.locator('.color-picker-popover')
    await expect(popover).toBeVisible()

    // Initially in Auto mode: verify no overflow
    let popoverBox = await popover.boundingBox()
    expect(popoverBox).not.toBeNull()

    const autoMetrics = await popover.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }))
    expect(autoMetrics.scrollWidth).toBeLessThanOrEqual(autoMetrics.clientWidth)

    // Switch to Manual mode
    const manualBtn = popover.getByRole('button', { name: 'Manual' })
    await expect(manualBtn).toBeVisible()
    await manualBtn.click()

    // Re-verify dimensions in Manual mode
    popoverBox = await popover.boundingBox()
    expect(popoverBox).not.toBeNull()

    const manualMetrics = await popover.evaluate((el) => {
      const rect = el.getBoundingClientRect()
      const modes = el.querySelector('.phase-color-modes')
      const autoButton = modes?.children[0]?.getBoundingClientRect()
      const manualButton = modes?.children[1]?.getBoundingClientRect()
      const presets = el.querySelector('.color-picker-presets')
      const presetButtons = Array.from(presets?.children || []).map((b) => b.getBoundingClientRect())
      const custom = el.querySelector('.color-picker-custom')
      const hexInput = custom?.querySelector('input')?.getBoundingClientRect()
      const applyButton = custom?.querySelector('button')?.getBoundingClientRect()

      return {
        popover: {
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          left: rect.left,
          right: rect.right,
          width: rect.width,
        },
        modes: {
          left: modes?.getBoundingClientRect().left ?? 0,
          right: modes?.getBoundingClientRect().right ?? 0,
          autoButton,
          manualButton,
        },
        presetButtons,
        hexInput,
        applyButton,
      }
    })

    // 1. Popover has no internal horizontal overflow
    expect(manualMetrics.popover.scrollWidth).toBeLessThanOrEqual(manualMetrics.popover.clientWidth)

    // 2. Auto and Manual mode buttons are fully within popover bounds
    expect(manualMetrics.modes.autoButton!.left).toBeGreaterThanOrEqual(manualMetrics.popover.left)
    expect(manualMetrics.modes.autoButton!.right).toBeLessThanOrEqual(manualMetrics.popover.right)
    expect(manualMetrics.modes.manualButton!.left).toBeGreaterThanOrEqual(manualMetrics.popover.left)
    expect(manualMetrics.modes.manualButton!.right).toBeLessThanOrEqual(manualMetrics.popover.right)

    // Both mode buttons have equal predictable width (+/- 1px subpixel rounding)
    expect(
      Math.abs(manualMetrics.modes.autoButton!.width - manualMetrics.modes.manualButton!.width),
    ).toBeLessThanOrEqual(1)

    // 3. All preset buttons are fully within popover bounds
    expect(manualMetrics.presetButtons.length).toBe(9)
    for (const preset of manualMetrics.presetButtons) {
      expect(preset.left).toBeGreaterThanOrEqual(manualMetrics.popover.left)
      expect(preset.right).toBeLessThanOrEqual(manualMetrics.popover.right)
    }

    // 4. Hex input and Apply button fit inside popover
    expect(manualMetrics.hexInput!.left).toBeGreaterThanOrEqual(manualMetrics.popover.left)
    expect(manualMetrics.applyButton!.right).toBeLessThanOrEqual(manualMetrics.popover.right)

    // 5. Apply button is visible, clickable, and functions properly
    const applyBtn = popover.getByRole('button', { name: 'Apply' })
    await expect(applyBtn).toBeVisible()
    const hexInput = popover.getByRole('textbox', { name: 'Custom phase hex color' })
    await hexInput.fill('#10b981')
    await expect(applyBtn).toBeEnabled()
    await applyBtn.click()

    // Popover closes on select
    await expect(popover).not.toBeVisible()
  })

  test('tag color picker fits within popover bounds without clipping', async ({ page }) => {
    // Open Tags panel
    const tagsTab = page.getByRole('tab', { name: /Tags/i })
    await expect(tagsTab).toBeVisible()
    await tagsTab.click()

    // Click "New tag" button to open tag form
    const newTagBtn = page.getByRole('button', { name: /New tag/i })
    await expect(newTagBtn).toBeVisible()
    await newTagBtn.click()

    // Click color swatch button in tag form
    const colorSwatch = page.locator('.tag-registry-form .color-swatch-button')
    await expect(colorSwatch).toBeVisible()
    await colorSwatch.click()

    const popover = page.locator('.color-picker-popover')
    await expect(popover).toBeVisible()

    const metrics = await popover.evaluate((el) => {
      const rect = el.getBoundingClientRect()
      const presets = el.querySelector('.color-picker-presets')
      const presetButtons = Array.from(presets?.children || []).map((b) => b.getBoundingClientRect())
      const custom = el.querySelector('.color-picker-custom')
      const hexInput = custom?.querySelector('input')?.getBoundingClientRect()
      const applyButton = custom?.querySelector('button')?.getBoundingClientRect()

      return {
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        left: rect.left,
        right: rect.right,
        presetButtons,
        hexInput,
        applyButton,
      }
    })

    // No overflow
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth)

    // All presets fit
    for (const preset of metrics.presetButtons) {
      expect(preset.left).toBeGreaterThanOrEqual(metrics.left)
      expect(preset.right).toBeLessThanOrEqual(metrics.right)
    }

    // Hex input and Apply button fit
    expect(metrics.hexInput!.left).toBeGreaterThanOrEqual(metrics.left)
    expect(metrics.applyButton!.right).toBeLessThanOrEqual(metrics.right)
  })

  test('popover remains within viewport across different screen dimensions', async ({ page }) => {
    const viewports = [
      { width: 320, height: 700 },
      { width: 375, height: 812 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 },
    ]

    for (const vp of viewports) {
      await page.setViewportSize(vp)

      const phaseSettingsTrigger = page.locator('.phase-settings-trigger').first()
      await expect(phaseSettingsTrigger).toBeVisible()
      await phaseSettingsTrigger.click()

      const changeColorBtn = page.getByRole('menuitem', { name: /Change color/i })
      await expect(changeColorBtn).toBeVisible()
      await changeColorBtn.click()

      const popover = page.locator('.color-picker-popover')
      await expect(popover).toBeVisible()

      // Switch to Manual mode
      const manualBtn = popover.getByRole('button', { name: 'Manual' })
      await manualBtn.click()

      const bounds = await popover.evaluate((el) => {
        const rect = el.getBoundingClientRect()
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        }
      })

      // Popover stays within viewport bounds
      expect(bounds.left).toBeGreaterThanOrEqual(0)
      expect(bounds.right).toBeLessThanOrEqual(vp.width)
      expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth)

      // Close popover
      await page.keyboard.press('Escape')
      await expect(popover).not.toBeVisible()
    }
  })
})
