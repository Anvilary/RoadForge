// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, Root } from 'react-dom/client'
import { ComplexitySelect } from '../ComplexitySelect'

describe('ComplexitySelect', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('renders trigger button with initial value and correct attributes', () => {
    const onChange = vi.fn()
    act(() => {
      root.render(
        <ComplexitySelect
          id="test-complexity"
          value="medium"
          onChange={onChange}
        />
      )
    })

    const trigger = container.querySelector('#test-complexity') as HTMLButtonElement
    expect(trigger).not.toBeNull()
    expect(trigger.getAttribute('role')).toBe('combobox')
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('data-value')).toBe('medium')
    expect(trigger.textContent).toContain('Medium')
  })

  it('opens overlay on trigger click and displays all complexity options', () => {
    const onChange = vi.fn()
    act(() => {
      root.render(
        <ComplexitySelect
          id="test-complexity"
          value="low"
          onChange={onChange}
        />
      )
    })

    const trigger = container.querySelector('#test-complexity') as HTMLButtonElement
    act(() => {
      trigger.click()
    })

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const overlay = document.querySelector('.complexity-dropdown-overlay')
    expect(overlay).not.toBeNull()

    const options = document.querySelectorAll('.complexity-option-btn')
    expect(options.length).toBe(5)
    expect(options[0]?.textContent).toContain('Very low')
    expect(options[1]?.textContent).toContain('Low')
    expect(options[2]?.textContent).toContain('Medium')
    expect(options[3]?.textContent).toContain('High')
    expect(options[4]?.textContent).toContain('Very high')
  })

  it('calls onChange with selected value when an option is clicked and closes dropdown', () => {
    const onChange = vi.fn()
    act(() => {
      root.render(
        <ComplexitySelect
          id="test-complexity"
          value="low"
          onChange={onChange}
        />
      )
    })

    const trigger = container.querySelector('#test-complexity') as HTMLButtonElement
    act(() => {
      trigger.click()
    })

    const highOption = Array.from(document.querySelectorAll('.complexity-option-btn')).find(
      (opt) => opt.textContent?.includes('High') && !opt.textContent?.includes('Very high')
    ) as HTMLElement
    expect(highOption).not.toBeNull()

    act(() => {
      highOption.click()
    })

    expect(onChange).toHaveBeenCalledWith('high')
    expect(document.querySelector('.complexity-dropdown-overlay')).toBeNull()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('disables Very High option when restricted and prevents selection', () => {
    const onChange = vi.fn()
    act(() => {
      root.render(
        <ComplexitySelect
          id="test-complexity"
          value="medium"
          onChange={onChange}
          isNested={true}
        />
      )
    })

    const trigger = container.querySelector('#test-complexity') as HTMLButtonElement
    act(() => {
      trigger.click()
    })

    const veryHighOption = Array.from(document.querySelectorAll('.complexity-option-btn')).find(
      (opt) => opt.textContent?.includes('Very high')
    ) as HTMLButtonElement
    expect(veryHighOption).not.toBeNull()
    expect(veryHighOption.disabled).toBe(true)
    expect(veryHighOption.getAttribute('aria-disabled')).toBe('true')

    act(() => {
      veryHighOption.click()
    })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('closes overlay when Escape key is pressed on trigger', () => {
    const onChange = vi.fn()
    act(() => {
      root.render(
        <ComplexitySelect
          id="test-complexity"
          value="medium"
          onChange={onChange}
        />
      )
    })

    const trigger = container.querySelector('#test-complexity') as HTMLButtonElement
    act(() => {
      trigger.click()
    })
    expect(document.querySelector('.complexity-dropdown-overlay')).not.toBeNull()

    act(() => {
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })

    expect(document.querySelector('.complexity-dropdown-overlay')).toBeNull()
  })
})
