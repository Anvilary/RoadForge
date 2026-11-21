// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePhaseNameEditor } from '../usePhaseNameEditor'

type Params = Parameters<typeof usePhaseNameEditor>[0]
type Result = ReturnType<typeof usePhaseNameEditor>

function Harness({
  params,
  onResult,
}: {
  params: Params
  onResult: (result: Result) => void
}) {
  onResult(usePhaseNameEditor(params))
  return null
}

describe('usePhaseNameEditor', () => {
  let container: HTMLDivElement
  let root: Root
  let result: Result
  let params: Params
  let input: HTMLInputElement

  const render = () => {
    act(() => {
      root.render(
        <Harness
          params={params}
          onResult={(nextResult) => {
            result = nextResult
          }}
        />,
      )
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    input = document.createElement('input')
    document.body.appendChild(input)

    params = {
      name: 'New phase',
      renameKey: 0,
      isNewPhase: true,
      onSave: vi.fn(),
    }
    render()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    input.remove()
    vi.useRealTimers()
  })

  it('selects the entire temporary name when editing starts for a new phase', () => {
    result.inputRef.current = input
    input.value = 'New phase'

    params = { ...params, renameKey: 1, isNewPhase: true }
    render()

    expect(result.editing).toBe(true)
    expect(result.draft).toBe('New phase')
    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(9)
  })

  it('places caret at the start without select-all for existing phase renaming', () => {
    params = { ...params, name: 'Planning', renameKey: 0, isNewPhase: false }
    render()

    result.inputRef.current = input
    input.value = 'Planning'

    params = { ...params, renameKey: 1, isNewPhase: false }
    render()

    expect(result.editing).toBe(true)
    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(0)
  })

  it('commits save on Enter and prevents duplicate save on subsequent blur', () => {
    const onSave = vi.fn()
    params = { ...params, renameKey: 1, isNewPhase: true, onSave }
    render()

    result.inputRef.current = input
    input.value = 'New phase'

    act(() => {
      result.setDraft('Development')
    })

    // Simulate Enter keydown
    act(() => {
      result.handleKeyDown({
        key: 'Enter',
        preventDefault: vi.fn(),
        nativeEvent: { isComposing: false },
      } as unknown as React.KeyboardEvent<HTMLInputElement>)
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith('Development')
    expect(result.editing).toBe(false)

    // Simulate subsequent blur event when input unmounts
    act(() => {
      result.handleBlur()
    })

    // Must NOT commit a second time
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('prevents saving an empty name on Enter and keeps input focused', () => {
    const onSave = vi.fn()
    params = { ...params, renameKey: 1, isNewPhase: true, onSave }
    render()

    result.inputRef.current = input
    input.value = 'New phase'

    act(() => {
      result.setDraft('   ')
    })

    act(() => {
      result.handleKeyDown({
        key: 'Enter',
        preventDefault: vi.fn(),
        nativeEvent: { isComposing: false },
      } as unknown as React.KeyboardEvent<HTMLInputElement>)
    })

    expect(onSave).not.toHaveBeenCalled()
    expect(result.editing).toBe(true)
  })

  it('reverts empty draft to original name on blur without trapping focus', () => {
    const onSave = vi.fn()
    params = { ...params, name: 'Planning', renameKey: 1, isNewPhase: false, onSave }
    render()

    result.inputRef.current = input
    input.value = 'Planning'

    act(() => {
      result.setDraft('   ')
    })

    act(() => {
      result.handleBlur()
    })

    expect(onSave).not.toHaveBeenCalled()
    expect(result.editing).toBe(false)
    expect(result.draft).toBe('Planning')
  })

  it('re-selects temporary name on mousedown if untouched to prevent caret collapse', () => {
    params = { ...params, renameKey: 1, isNewPhase: true }
    render()

    result.inputRef.current = input
    input.value = 'New phase'

    const preventDefault = vi.fn()

    act(() => {
      result.handleMouseDown({
        currentTarget: input,
        preventDefault,
      } as unknown as React.MouseEvent<HTMLInputElement>)
    })

    expect(preventDefault).toHaveBeenCalled()
    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe(9)
  })
})
