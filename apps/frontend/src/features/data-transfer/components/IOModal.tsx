'use client'

import { useCallback, useEffect } from 'react'
import { Modal } from '@/shared/ui/Modal'
import { Icon } from '@/shared/ui/Icon'
import { ImportNotice } from '@/features/data-transfer/components/ImportNotice'
import { useImportFlow } from '@/features/data-transfer/hooks/useImportFlow'
import { exportRoadmap } from '@/features/data-transfer/services/data-transfer.service'
import { useRoadmapData, useRoadmapLifecycle, useRoadmapSession } from '@/shared/context/roadmap-context'
import type { Phase } from '@/shared/types/roadmap'
import type { ImportMode } from '@/features/data-transfer/lib/import-merge/types'
import { ROADMAP_GENERATOR_TEMPLATE } from '@/features/data-transfer/lib/roadmap-generator-template'
import {
  createMarkdownExportFilename,
  formatRoadmapMarkdown,
} from '@/features/data-transfer/lib/roadmap-markdown'

interface IOModalProps {
  open: boolean
  onClose: () => void
  onToast: (msg: string) => void
  onRoadmapImported?: (
    roadmapName: string | undefined,
    phases: Phase[],
    mode: ImportMode,
  ) => void
}

export function IOModal({ open, onClose, onToast, onRoadmapImported }: IOModalProps) {
  const {
    roadmapName,
    phases,
    tagRegistry,
    setPhases,
    setRoadmapName,
    setSaved,
    setTagRegistry,
    saved,
    ownerDisplayName,
    updatedAt,
  } = useRoadmapData()
  const { createLocalRoadmap } = useRoadmapLifecycle()
  const { serverRoadmapId, sessionToken, role } = useRoadmapSession()
  const canReplaceCurrent = !serverRoadmapId || role === 'owner' || role === 'editor'
  const {
    fileInputRef,
    pendingImport,
    importError,
    isConfirming,
    selectImportFile,
    changeImportMode,
    handleImportFile,
    handleConfirm,
    handleCancelPendingImport,
  } = useImportFlow({
    roadmapName,
    phases,
    tagRegistry,
    canReplaceCurrent,
    serverRoadmapId,
    sessionToken,
    setPhases,
    setRoadmapName,
    setSaved,
    setTagRegistry,
    createLocalRoadmap,
    onRoadmapImported,
    onClose,
    onToast,
  })

  useEffect(() => {
    if (!open) return
    handleCancelPendingImport()
  }, [open, handleCancelPendingImport])

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const slug = (value: string) => value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'roadmap'

  const padDatePart = (value: number) => String(value).padStart(2, '0')

  const formatExportTimestamp = (date = new Date()) => {
    const year = date.getFullYear()
    const month = padDatePart(date.getMonth() + 1)
    const day = padDatePart(date.getDate())
    const hours = padDatePart(date.getHours())
    const minutes = padDatePart(date.getMinutes())
    return `${year}${month}${day}-${hours}${minutes}`
  }

  const jsonExportFilename = () =>
    `${slug(roadmapName)}.${formatExportTimestamp()}.roadforge.json`

  const exportMetadata = {
    roadmapName,
    saved,
    serverRoadmapId,
    role,
    ownerDisplayName,
    updatedAt,
    tagRegistry,
  }

  const handleJsonExport = async () => {
    try {
      onToast('Preparing JSON export...')
      const blob = await exportRoadmap(phases, 'json', exportMetadata)
      downloadBlob(blob, jsonExportFilename())
      onToast('JSON file downloaded')
      onClose()
    } catch {
      onToast('Export failed. Could not create JSON file.')
    }
  }

  const handleMarkdownExport = () => {
    try {
      onToast('Preparing Markdown export...')
      const markdown = formatRoadmapMarkdown({ roadmapName, phases, tagRegistry })
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
      downloadBlob(blob, createMarkdownExportFilename(roadmapName))
      onToast('Markdown file downloaded')
      onClose()
    } catch {
      onToast('Export failed. Could not create Markdown file.')
    }
  }

  const handleGeneratorTemplateExport = () => {
    try {
      onToast('Preparing roadmap generator template...')
      const blob = new Blob([ROADMAP_GENERATOR_TEMPLATE], { type: 'text/plain;charset=utf-8' })
      downloadBlob(blob, 'roadforge-roadmap-generator-template.txt')
      onToast('Roadmap generator template downloaded')
    } catch {
      onToast('Export failed. Could not create template file.')
    }
  }

  const handleClose = useCallback(() => {
    if (isConfirming) return
    handleCancelPendingImport()
    onClose()
  }, [handleCancelPendingImport, isConfirming, onClose])

  return (
    <Modal
      open={open}
      onClose={handleClose}
      dismissible
      canDismiss={() => !isConfirming}
      width={580}
      icon={{ name: 'import-export', plain: true }}
      title="Import / Export roadmap"
      sub="Download or import portable RoadForge JSON and Markdown files."
      footer={
        <>
          <span className="note">Exports and file previews stay on this device.</span>
          <span className="spacer" />
          <button className="btn sm ghost" onClick={handleClose} disabled={isConfirming}>
            Cancel
          </button>
        </>
      }
    >
      {pendingImport ? (
        <ImportNotice
          pendingImport={pendingImport}
          canReplaceCurrent={canReplaceCurrent}
          onModeChange={changeImportMode}
          onConfirm={handleConfirm}
          onCancel={handleCancelPendingImport}
          error={importError}
          isConfirming={isConfirming}
        />
      ) : (
        <div className="io-unified-layout">
          {/* Section 1: Export */}
          <section className="io-section io-export-section">
            <div className="io-section-header">
              <div className="io-section-title-row">
                <span className="ic">
                  <Icon name="export" size={16} />
                </span>
                <div>
                  <h3>Export your roadmap</h3>
                  <p>Download a copy of your roadmap.</p>
                </div>
              </div>
            </div>
            <div className="io-export-actions">
              <button
                type="button"
                className="btn sm primary io-btn"
                onClick={handleJsonExport}
              >
                <Icon name="export" size={14} />
                Download JSON
              </button>
              <button
                type="button"
                className="btn sm ghost io-btn"
                onClick={handleMarkdownExport}
              >
                <Icon name="export" size={14} />
                Download Markdown
              </button>
            </div>
            <div className="io-section-note">
              JSON is the supported backup and import format. Markdown is a readable export.
            </div>
          </section>

          {/* Section 2: Import */}
          <section className="io-section io-import-section">
            <div className="io-section-header">
              <div className="io-section-title-row">
                <span className="ic">
                  <Icon name="import" size={16} />
                </span>
                <div>
                  <h3>Import a roadmap</h3>
                  <p>Open a RoadForge JSON file.</p>
                </div>
              </div>
            </div>
            <div className="io-import-actions">
              <button
                type="button"
                className="btn sm primary io-btn"
                onClick={() => selectImportFile('new-local')}
              >
                <Icon name="import" size={14} />
                Choose JSON file
              </button>
            </div>
            <div className="io-section-reassurance">
              Your current roadmap remains unchanged unless you explicitly choose to modify it.
            </div>
          </section>

          {/* Section 3: Advanced */}
          <details className="io-advanced-details">
            <summary className="io-advanced-summary">Advanced</summary>
            <div className="io-advanced-content">
              <p>Download our prompt template for AI models to generate roadmaps in RoadForge JSON format.</p>
              <button
                type="button"
                className="btn sm ghost io-btn"
                onClick={handleGeneratorTemplateExport}
              >
                <Icon name="robot" size={14} />
                Download generator template
              </button>
            </div>
          </details>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />
    </Modal>
  )
}
