'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { acquireLock, releaseLock } from '@/features/collaboration/services/locks.service'
import { ApiError, isApiConnectionError } from '@/shared/http/roadmap-http'

export type EditLockErrorKind =
  | 'conflict'
  | 'connection'
  | 'session_expired'
  | 'refresh_failed'
  | null

interface UseEditLockParams {
  target: string
  active: boolean
  serverRoadmapId: string | null
  sessionToken: string | null
  /**
   * Called when tryAcquire fails.
   * `isConflict` is true when the server returns 409 (lock held by another participant).
   * `isConflict` is false for other errors.
   */
  onAcquireError?: (isConflict: boolean) => void
}

interface UseEditLockResult {
  ownsLock: boolean
  isAcquiring: boolean
  isReleasing: boolean
  lockError: EditLockErrorKind
  tryAcquire: () => Promise<boolean>
  release: () => Promise<void>
}

/**
 * Manages acquire / refresh / release lifecycle for an edit lock.
 *
 * - Calls acquireLock when tryAcquire() is invoked.
 * - While `active` is true and a server roadmap exists, refreshes the lock
 *   every 20s (server TTL is 30s).
 * - Releases the lock when `active` goes false, on explicit release(), or
 *   on unmount. Release is no-op if the lock was never acquired in this session.
 * - When no server roadmap is configured, tryAcquire() grants ownership locally.
 */
export function useEditLock({
  target,
  active,
  serverRoadmapId,
  sessionToken,
  onAcquireError,
}: UseEditLockParams): UseEditLockResult {
  const [ownsServerLock, setOwnsServerLock] = useState(false)
  const [ownsLocalLock, setOwnsLocalLock] = useState(() => !serverRoadmapId && active)
  const [isAcquiring, setIsAcquiring] = useState(false)
  const [isReleasing, setIsReleasing] = useState(false)
  const [lockError, setLockError] = useState<EditLockErrorKind>(null)
  const ownsLockRef = useRef(!serverRoadmapId && active)
  const releasePromiseRef = useRef<Promise<void> | null>(null)
  const lockGenerationRef = useRef(0)
  const releaseRef = useRef<() => Promise<void>>(async () => {})

  const ownsLock = !serverRoadmapId ? (active && ownsLocalLock) : ownsServerLock

  const release = useCallback((): Promise<void> => {
    lockGenerationRef.current += 1
    if (releasePromiseRef.current) return releasePromiseRef.current
    if (!ownsLockRef.current) return Promise.resolve()

    ownsLockRef.current = false
    setOwnsLocalLock(false)
    setOwnsServerLock(false)

    if (!serverRoadmapId || !sessionToken) return Promise.resolve()

    const pendingRelease = (async () => {
      setIsReleasing(true)
      try {
        await releaseLock(serverRoadmapId, target, sessionToken)
      } catch {
        // Server TTL handles any missed cleanup
      } finally {
        setIsReleasing(false)
        releasePromiseRef.current = null
      }
    })()
    releasePromiseRef.current = pendingRelease
    return pendingRelease
  }, [serverRoadmapId, sessionToken, target])

  // Keep fresh so the unmount-only effect below always calls the latest version
  releaseRef.current = release

  const tryAcquire = useCallback(async (): Promise<boolean> => {
    if (releasePromiseRef.current) await releasePromiseRef.current
    const lockGeneration = lockGenerationRef.current

    if (!serverRoadmapId) {
      ownsLockRef.current = true
      setOwnsLocalLock(true)
      setLockError(null)
      return true
    }

    if (!sessionToken) {
      ownsLockRef.current = false
      setOwnsServerLock(false)
      setLockError('session_expired')
      onAcquireError?.(false)
      return false
    }

    setIsAcquiring(true)
    try {
      await acquireLock(serverRoadmapId, target, sessionToken)
      if (lockGeneration !== lockGenerationRef.current) {
        try {
          await releaseLock(serverRoadmapId, target, sessionToken)
        } catch {
          // Server TTL handles cleanup if the cancelled acquire cannot release.
        }
        return false
      }
      ownsLockRef.current = true
      setOwnsServerLock(true)
      setLockError(null)
      return true
    } catch (err) {
      const isConflict = err instanceof ApiError && err.status === 409
      if (isConflict) {
        setLockError('conflict')
      } else if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setLockError('session_expired')
      } else if (isApiConnectionError(err)) {
        setLockError('connection')
      } else {
        setLockError('refresh_failed')
      }
      onAcquireError?.(isConflict)
      return false
    } finally {
      setIsAcquiring(false)
    }
  }, [serverRoadmapId, sessionToken, target, onAcquireError])

  // Refresh the lock every 20s while active (server TTL is 30s).
  // Release on cleanup when active goes false or on unmount.
  useEffect(() => {
    if (!serverRoadmapId) {
      setOwnsLocalLock(active)
      ownsLockRef.current = active
      setLockError(null)
      return
    }

    if (!active || !sessionToken) return

    const tryRefresh = async () => {
      if (!ownsLockRef.current) return
      try {
        await acquireLock(serverRoadmapId, target, sessionToken)
      } catch (err) {
        // Treat a failed refresh as lock loss. The editor keeps its local draft,
        // but must explicitly reacquire before committing.
        ownsLockRef.current = false
        setOwnsServerLock(false)
        if (isApiConnectionError(err)) {
          setLockError('connection')
        } else if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          setLockError('session_expired')
        } else {
          setLockError('refresh_failed')
        }
      }
    }

    const interval = setInterval(tryRefresh, 20_000)

    return () => {
      clearInterval(interval)
      void release()
    }
  }, [active, serverRoadmapId, sessionToken, target, release])

  // Covers the case where active is false at unmount - the refresh effect above
  // has an early return when inactive and so sets up no cleanup of its own.
  useEffect(() => {
    return () => { void releaseRef.current() }
  }, []) // intentionally empty - runs only on unmount

  return { ownsLock, isAcquiring, isReleasing, lockError, tryAcquire, release }
}
