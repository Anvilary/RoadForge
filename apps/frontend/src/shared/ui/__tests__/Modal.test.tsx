// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Modal } from '@/shared/ui/Modal'

describe('Modal backdrop dismissal and interaction safety', () => {
  let container: HTMLElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('does not dismiss on backdrop click when dismissible is false (default)', () => {
    const handleClose = vi.fn()
    act(() => {
      root.render(
        <Modal open onClose={handleClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>,
      )
    })

    const scrim = document.querySelector('.modal-scrim') as HTMLElement
    expect(scrim).not.toBeNull()

    act(() => {
      scrim.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      scrim.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(handleClose).not.toHaveBeenCalled()
  })

  it('dismisses on backdrop click when dismissible is true', () => {
    const handleClose = vi.fn()
    act(() => {
      root.render(
        <Modal open onClose={handleClose} dismissible title="Dismissible Modal">
          <p>Modal content</p>
        </Modal>,
      )
    })

    const scrim = document.querySelector('.modal-scrim') as HTMLElement
    expect(scrim).not.toBeNull()

    act(() => {
      scrim.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      scrim.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('does not dismiss when pointerdown starts inside the dialog and mouseup/click ends on scrim', () => {
    const handleClose = vi.fn()
    act(() => {
      root.render(
        <Modal open onClose={handleClose} dismissible title="Dismissible Modal">
          <p className="content">Modal content</p>
        </Modal>,
      )
    })

    const scrim = document.querySelector('.modal-scrim') as HTMLElement
    const content = document.querySelector('.content') as HTMLElement

    act(() => {
      // User started selection or drag inside content
      content.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      // Mouse dragged and released on scrim
      scrim.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(handleClose).not.toHaveBeenCalled()
  })

  it('does not dismiss when clicking inside the modal dialog', () => {
    const handleClose = vi.fn()
    act(() => {
      root.render(
        <Modal open onClose={handleClose} dismissible title="Dismissible Modal">
          <button className="inner-btn">Action</button>
        </Modal>,
      )
    })

    const button = document.querySelector('.inner-btn') as HTMLElement

    act(() => {
      button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(handleClose).not.toHaveBeenCalled()
  })

  it('respects canDismiss guard callback', () => {
    const handleClose = vi.fn()
    let allowDismiss = false

    act(() => {
      root.render(
        <Modal
          open
          onClose={handleClose}
          dismissible
          canDismiss={() => allowDismiss}
          title="Guarded Modal"
        >
          <p>Guarded content</p>
        </Modal>,
      )
    })

    const scrim = document.querySelector('.modal-scrim') as HTMLElement

    act(() => {
      scrim.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      scrim.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(handleClose).not.toHaveBeenCalled()

    allowDismiss = true
    act(() => {
      scrim.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      scrim.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('allows escape key to dismiss when safe', () => {
    const handleClose = vi.fn()
    act(() => {
      root.render(
        <Modal open onClose={handleClose} title="Escape Test">
          <p>Content</p>
        </Modal>,
      )
    })

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})
