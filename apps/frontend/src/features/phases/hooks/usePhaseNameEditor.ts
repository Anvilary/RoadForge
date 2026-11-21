'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'

interface UsePhaseNameEditorParams {
  name: string
  renameKey?: number
  isNewPhase?: boolean
  onSave: (name: string) => void
  onEditingChange?: (editing: boolean) => void
}

export function usePhaseNameEditor({
  name,
  renameKey,
  isNewPhase = false,
  onSave,
  onEditingChange,
}: UsePhaseNameEditorParams) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const suppressBlurRef = useRef(false)
  const isSavingRef = useRef(false)
  const hasUserEditedRef = useRef(false)

  const isDirty = draft.trim() !== name

  const prevRenameKeyRef = useRef(renameKey ?? 0)
  // Triggered programmatically (e.g. menu rename or new phase creation). Lock has already been acquired by caller.
  useEffect(() => {
    if (!renameKey || renameKey === prevRenameKeyRef.current) return
    prevRenameKeyRef.current = renameKey
    setDraft(name)
    hasUserEditedRef.current = false
    setEditing(true)
    onEditingChange?.(true)
  }, [renameKey, name, onEditingChange])

  const exitEditing = useCallback(() => {
    setEditing(false)
    hasUserEditedRef.current = false
    onEditingChange?.(false)
  }, [onEditingChange])

  const focusInput = useCallback(() => {
    suppressBlurRef.current = false
    const input = inputRef.current
    if (!input) return
    // Never hijack focus or selection after the user has begun editing
    if (hasUserEditedRef.current) return

    input.focus()
    if (isNewPhase) {
      input.select()
    } else {
      input.setSelectionRange(0, 0)
      input.scrollLeft = 0
    }
  }, [isNewPhase])

  useEffect(() => {
    if (!editing) return
    hasUserEditedRef.current = false
    focusInput()
    const timer = window.setTimeout(() => {
      if (!hasUserEditedRef.current && inputRef.current && document.activeElement !== inputRef.current) {
        focusInput()
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [editing, focusInput])

  const commitSave = useCallback(() => {
    if (isSavingRef.current) return
    const trimmed = draft.trim()
    if (!trimmed) {
      focusInput()
      return
    }
    isSavingRef.current = true
    suppressBlurRef.current = true
    try {
      onSave(trimmed)
      exitEditing()
    } finally {
      queueMicrotask(() => {
        isSavingRef.current = false
      })
    }
  }, [draft, exitEditing, focusInput, onSave])

  const requestCancel = useCallback(() => {
    if (isDirty) {
      suppressBlurRef.current = true
      setConfirmDiscard(true)
      return
    }
    exitEditing()
  }, [exitEditing, isDirty])

  const handleBlur = useCallback(() => {
    if (confirmDiscard || isSavingRef.current) return
    if (suppressBlurRef.current) {
      suppressBlurRef.current = false
      return
    }
    const trimmed = draft.trim()
    if (!trimmed) {
      setDraft(name)
      exitEditing()
      return
    }
    commitSave()
  }, [commitSave, confirmDiscard, draft, exitEditing, name])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter') {
      e.preventDefault()
      commitSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      requestCancel()
    } else if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      // User is deliberately navigating within the input, so do not force select-all
      hasUserEditedRef.current = true
    }
  }, [commitSave, requestCancel])

  const handleDraftChange = useCallback((value: string) => {
    hasUserEditedRef.current = true
    setDraft(value)
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    if (isNewPhase && !hasUserEditedRef.current) {
      e.preventDefault()
      e.currentTarget.focus()
      e.currentTarget.select()
    }
  }, [isNewPhase])

  const handleClick = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation()
  }, [])

  return {
    editing,
    draft,
    setDraft: handleDraftChange,
    confirmDiscard,
    setConfirmDiscard,
    inputRef,
    focusInputAtStart: focusInput,
    focusInput,
    exitEditing,
    commitSave,
    requestCancel,
    handleKeyDown,
    handleBlur,
    handleMouseDown,
    handleClick,
  }
}
