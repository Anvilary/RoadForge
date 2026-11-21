'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { isAuthError } from '@/shared/http/roadmap-http'
import {
  getPublication,
  publishRoadmap,
  unpublishRoadmap,
  type PublicationStatus,
} from '@/features/publication/services/publication.service'

const FIELD_FALLBACK = [
  'Roadmap title',
  'Phase names, numbers, order, status, and colors',
  'Task and subtask titles, order, completion, complexity, and tags',
  'Dependencies between published tasks',
  'Progress computed from task completion',
]

const PRIVATE_FALLBACK = [
  'Descriptions, estimates, and assignees',
  'Claims, participants, and the owner name',
  'External links, including GitHub links',
  'Activity history, version history, and invite credentials',
]

interface PublicRoadmapSectionProps {
  open: boolean
  serverRoadmapId: string | null
  sessionToken: string | null
  canManage: boolean
  hasUnsavedEdits: boolean
  onToast: (message: string) => void
  onEnableSharing?: () => void
}

export function PublicRoadmapSection({
  open,
  serverRoadmapId,
  sessionToken,
  canManage,
  hasUnsavedEdits,
  onToast,
  onEnableSharing,
}: PublicRoadmapSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<PublicationStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [working, setWorking] = useState(false)
  const [confirming, setConfirming] = useState<'publish' | 'unpublish' | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)
  const confirmRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!confirming) return
    const node = confirmRef.current
    if (!node || typeof node.scrollIntoView !== 'function') return
    node.scrollIntoView({ block: 'nearest' })
  }, [confirming])

  useEffect(() => {
    if (!open) return
    setExpanded(false)
    setConfirming(null)
    setCopied(null)
    setCopyError(null)
    if (!canManage || !serverRoadmapId || !sessionToken) {
      setStatus(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    getPublication(serverRoadmapId, sessionToken)
      .then((next) => {
        if (!cancelled) setStatus(next)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setStatus(null)
        onToast(
          isAuthError(error)
            ? 'Only the owner can publish this roadmap.'
            : 'Could not load publication status.',
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, canManage, serverRoadmapId, sessionToken, onToast])

  const published = status?.status === 'published'
  const publicFields = status?.publicFields ?? FIELD_FALLBACK
  const privateFields = status?.privateFields ?? PRIVATE_FALLBACK

  const copyText = async (kind: string, value: string | null) => {
    if (!value) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(value)
      setCopyError(null)
      setCopied(kind)
      window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 1600)
    } catch {
      setCopied(null)
      setCopyError(kind)
      onToast('Could not copy to the clipboard.')
    }
  }

  const publish = async () => {
    if (!serverRoadmapId || !sessionToken) return
    setWorking(true)
    try {
      const next = await publishRoadmap(serverRoadmapId, sessionToken)
      setStatus(next)
      setConfirming(null)
      onToast('Roadmap published.')
    } catch (error) {
      onToast(
        isAuthError(error)
          ? 'Only the owner can publish this roadmap.'
          : 'Could not publish this roadmap.',
      )
    } finally {
      setWorking(false)
    }
  }

  const unpublish = async () => {
    if (!serverRoadmapId || !sessionToken) return
    setWorking(true)
    try {
      const next = await unpublishRoadmap(serverRoadmapId, sessionToken)
      setStatus(next)
      setConfirming(null)
      onToast('Roadmap unpublished. New public visits stop here.')
    } catch (error) {
      onToast(
        isAuthError(error)
          ? 'Only the owner can unpublish this roadmap.'
          : 'Could not unpublish this roadmap.',
      )
    } finally {
      setWorking(false)
    }
  }

  return (
    <section className="share-role-section public-publish" data-testid="public-publish-section">
      <button
        type="button"
        className="share-role-head"
        aria-expanded={expanded}
        data-testid="public-publish-toggle"
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="ic" aria-hidden="true">
          <Icon name="share" size={16} />
        </span>
        <span className="share-role-title">
          <span className="share-role-title-row">
            <span className="share-role-heading">Publish roadmap</span>
            <span className={`link-state ${published ? 'active' : ''}`}>
              {published ? 'Published · Public' : 'Private'}
            </span>
          </span>
          <span className="share-role-summary-desc">
            Make a read-only version of this roadmap publicly accessible.
          </span>
        </span>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} />
      </button>

      {expanded && (
        <div className="share-role-body public-publish-body">
          {!canManage && (
            <p>Only the roadmap owner can publish or unpublish this roadmap.</p>
          )}

          {canManage && !serverRoadmapId && (
            <div className="public-publish-local">
              <p>
                Publishing needs a server-backed roadmap. A roadmap stored only in this
                browser has no public address that can update on its own.
              </p>
              <p>
                Enable sharing to save a server copy, then publish. RoadForge will not
                upload this roadmap until you confirm Enable sharing.
              </p>
              {onEnableSharing && (
                <button type="button" className="mini primary" onClick={onEnableSharing}>
                  Enable sharing
                </button>
              )}
            </div>
          )}

          {canManage && serverRoadmapId && (
            <>
              {loading && <p>Loading publication status.</p>}
              <p className="public-publish-warning" role="note">
                {status?.warning ??
                  'Anyone with the public link can view the published roadmap. New roadmap changes may also become publicly visible.'}
              </p>
              <div className="public-publish-fields">
                <p>Public visitors receive:</p>
                <ul>
                  {publicFields.map((field) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
                <p>These stay private:</p>
                <ul>
                  {privateFields.map((field) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
              </div>
              <p>{status?.automaticUpdateNote ?? 'Saved changes to the published fields become public. Unsaved edits stay private until they are saved.'}</p>
              {hasUnsavedEdits && (
                <p>This browser still has unsaved edits. They are not part of the published roadmap.</p>
              )}

              {!published && confirming !== 'publish' && (
                <button
                  type="button"
                  className="mini primary"
                  data-testid="publish-roadmap"
                  disabled={working || loading}
                  onClick={() => setConfirming('publish')}
                >
                  Publish roadmap
                </button>
              )}
              {confirming === 'publish' && (
                <div className="public-publish-confirm" ref={confirmRef}>
                  <p>Publish this roadmap now? The public link will show the saved roadmap.</p>
                  <button
                    type="button"
                    className="mini primary"
                    data-testid="confirm-publish"
                    disabled={working}
                    onClick={publish}
                  >
                    {working ? 'Publishing...' : 'Confirm publish'}
                  </button>
                  <button type="button" className="mini" disabled={working} onClick={() => setConfirming(null)}>
                    Cancel
                  </button>
                </div>
              )}

              {published && status && (
                <div className="public-publish-live">
                  <div className="public-publish-actions">
                    <button type="button" className="mini" data-testid="copy-viewer-link" onClick={() => copyText('viewer', status.viewerUrl)}>
                      {copied === 'viewer' ? 'Copied' : 'Copy viewer link'}
                    </button>
                    <button type="button" className="mini" data-testid="copy-markdown" onClick={() => copyText('markdown', status.markdown)}>
                      {copied === 'markdown' ? 'Copied' : 'Copy GitHub Markdown'}
                    </button>
                    <button type="button" className="mini" data-testid="copy-embed" onClick={() => copyText('embed', status.embedHtml)}>
                      {copied === 'embed' ? 'Copied' : 'Copy website embed'}
                    </button>
                    {status.viewerUrl && (
                      <a href={status.viewerUrl} target="_blank" rel="noopener noreferrer" data-testid="open-public-preview">
                        Open public preview
                      </a>
                    )}
                  </div>
                  <label className="public-publish-snippet">
                    GitHub Markdown
                    <textarea readOnly rows={3} value={status.markdown ?? ''} spellCheck={false} />
                  </label>
                  <label className="public-publish-snippet">
                    Website embed
                    <textarea readOnly rows={6} value={status.embedHtml ?? ''} spellCheck={false} />
                  </label>
                  {copyError && (
                    <p role="status">Clipboard unavailable. Select the snippet and copy it manually.</p>
                  )}
                  <p>{status.cacheNote}</p>
                  <p>{status.revocationNote}</p>
                  {confirming !== 'unpublish' ? (
                    <button
                      type="button"
                      className="mini danger"
                      data-testid="unpublish-roadmap"
                      disabled={working}
                      onClick={() => setConfirming('unpublish')}
                    >
                      Unpublish roadmap
                    </button>
                  ) : (
                    <div className="public-publish-confirm" ref={confirmRef}>
                      <p>Unpublish this roadmap? The current public link will stop working.</p>
                      <button
                        type="button"
                        className="mini danger"
                        data-testid="confirm-unpublish"
                        disabled={working}
                        onClick={unpublish}
                      >
                        {working ? 'Unpublishing...' : 'Confirm unpublish'}
                      </button>
                      <button type="button" className="mini" disabled={working} onClick={() => setConfirming(null)}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}
