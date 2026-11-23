'use client'

import { useRef, useState } from 'react'
import { AnchoredOverlay } from '@/shared/ui/AnchoredOverlay'
import { Icon } from '@/shared/ui/Icon'
import {
  TASK_COMPLEXITY_LEVELS,
  getTaskComplexityOption,
} from '@/shared/domain/task-complexity'
import type { TaskComplexity } from '@/shared/types/roadmap'

interface ComplexitySelectProps {
  id?: string
  value: TaskComplexity
  isNested?: boolean
  directSubtaskCount?: number
  onChange: (value: TaskComplexity) => void
  disabled?: boolean
  ariaLabel?: string
  ariaLabelledby?: string
}

export function ComplexitySelect({
  id,
  value,
  isNested = false,
  directSubtaskCount = 0,
  onChange,
  disabled = false,
  ariaLabel,
  ariaLabelledby,
}: ComplexitySelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const listboxId = id ? `${id}-listbox` : undefined

  const currentOption = getTaskComplexityOption(value)

  const isOptionDisabled = (val: TaskComplexity) => {
    if (val === 'very_high') {
      return isNested || directSubtaskCount < 2
    }
    return false
  }

  const handleSelect = (val: TaskComplexity) => {
    if (isOptionDisabled(val)) return
    onChange(val)
    setIsOpen(false)
    triggerRef.current?.focus({ preventScroll: true })
  }

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!disabled) setIsOpen(true)
    }
  }

  return (
    <div className="complexity-select-wrap">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        className={`complexity-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleTriggerKeyDown}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || 'Task complexity'}
        aria-labelledby={ariaLabelledby}
        data-value={value}
        disabled={disabled}
      >
        <span className="complexity-select-value">{currentOption.label}</span>
        <span className={`complexity-select-chevron ${isOpen ? 'open' : ''}`}>
          <Icon
            name="chevron-down"
            size={14}
          />
        </span>
      </button>

      <AnchoredOverlay
        id={listboxId}
        open={isOpen}
        anchorRef={triggerRef}
        role="listbox"
        ariaLabel="Complexity levels"
        className="complexity-dropdown-overlay"
        onClose={() => setIsOpen(false)}
        alignment="end"
      >
        {TASK_COMPLEXITY_LEVELS.map((option) => {
          const isSelected = option.value === value
          const optionDisabled = isOptionDisabled(option.value)

          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={isSelected}
              aria-disabled={optionDisabled}
              disabled={optionDisabled}
              className={`complexity-option-btn ${isSelected ? 'selected' : ''} ${optionDisabled ? 'disabled' : ''}`}
              onClick={() => handleSelect(option.value)}
            >
              <span className="complexity-option-label">{option.label}</span>
              {isSelected && (
                <span className="complexity-option-check">
                  <Icon
                    name="check"
                    size={14}
                  />
                </span>
              )}
            </button>
          )
        })}
      </AnchoredOverlay>
    </div>
  )
}
