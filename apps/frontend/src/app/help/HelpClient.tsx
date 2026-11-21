'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { SiteHeader } from '@/features/marketing/components/SiteHeader'
import { SiteFooter } from '@/shared/ui/SiteFooter'
import { CreateWizard } from '@/features/roadmaps/components/CreateWizard'
import { Icon } from '@/shared/ui/Icon'

export interface SectionData {
  id: string
  tocTitle: string
  title: string
  content: ReactNode
}

interface HelpClientProps {
  sections: SectionData[]
}

export function HelpClient({ sections }: HelpClientProps) {
  const router = useRouter()
  const [activeId, setActiveId] = useState<string | null>('start')
  const [showWizard, setShowWizard] = useState(false)

  const scrollToSection = useCallback((id: string) => {
    requestAnimationFrame(() => {
      const el = document.getElementById(id)
      if (el) {
        const prefersReduced =
          typeof window !== 'undefined' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
        el.scrollIntoView({
          behavior: prefersReduced ? 'auto' : 'smooth',
          block: 'start',
        })
      }
    })
  }, [])

  useEffect(() => {
    const validIds = sections.map((s) => s.id)
    const syncFromHash = (isInitial = false) => {
      if (typeof window === 'undefined') return
      const hash = window.location.hash.replace(/^#/, '')
      if (validIds.includes(hash)) {
        setActiveId(hash)
        scrollToSection(hash)
      } else if (!hash && isInitial) {
        setActiveId('start')
      }
    }

    syncFromHash(true)

    const onHashChange = () => syncFromHash(false)
    window.addEventListener('hashchange', onHashChange)
    window.addEventListener('popstate', onHashChange)
    return () => {
      window.removeEventListener('hashchange', onHashChange)
      window.removeEventListener('popstate', onHashChange)
    }
  }, [sections, scrollToSection])

  const handleTopicClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string,
  ) => {
    e.preventDefault()
    setActiveId(id)
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `#${id}`)
    }
    scrollToSection(id)
  }

  const handleToggle = (id: string) => {
    setActiveId((prev) => {
      const next = prev === id ? null : id
      if (typeof window !== 'undefined') {
        if (next) {
          window.history.replaceState(null, '', `#${next}`)
        } else {
          window.history.replaceState(null, '', window.location.pathname)
        }
      }
      return next
    })
  }

  const handleWizardComplete = (roadmapId?: string) => {
    setShowWizard(false)
    router.push(
      roadmapId
        ? `/workspace?roadmap=${encodeURIComponent(roadmapId)}`
        : '/workspace',
    )
  }

  return (
    <div className="help-shell">
      <SiteHeader
        onCreate={() => setShowWizard(true)}
        activeNav="help"
      />

      <main className="help-main">
        <div className="help-hero">
          <p className="help-eyebrow">RoadForge guide</p>
          <h1>Plan locally. Share only when you choose.</h1>
          <p className="help-lead">
            Start in this browser, export portable backups, and enable server
            sync only when you need collaboration. This public server is a hosted
            demo; sustained or larger-team use should run on infrastructure your
            team controls.
          </p>
        </div>

        <nav className="help-toc" aria-label="Guide topics">
          {sections.map((section) => {
            const isActive = activeId === section.id
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={isActive ? 'active' : undefined}
                aria-current={isActive ? 'true' : undefined}
                onClick={(e) => handleTopicClick(e, section.id)}
              >
                {section.tocTitle}
              </a>
            )
          })}
        </nav>

        <div className="help-accordion-list">
          {sections.map((section) => {
            const isOpen = activeId === section.id
            const headerId = `help-header-${section.id}`
            const panelId = `help-panel-${section.id}`

            return (
              <section
                key={section.id}
                id={section.id}
                className={`help-accordion-item ${isOpen ? 'expanded' : 'collapsed'}`}
              >
                <button
                  type="button"
                  id={headerId}
                  className="help-accordion-trigger"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => handleToggle(section.id)}
                >
                  <h2 className="help-accordion-title">{section.title}</h2>
                  <span className="help-accordion-chevron" aria-hidden="true">
                    <Icon name="chevron-down" size={18} />
                  </span>
                </button>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={headerId}
                  className={`help-accordion-panel ${isOpen ? 'expanded' : 'collapsed'}`}
                  inert={!isOpen ? true : undefined}
                >
                  <div className="help-accordion-body">
                    <div className="help-accordion-content">
                      {section.content}
                    </div>
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      </main>

      <SiteFooter />

      {showWizard && (
        <CreateWizard
          onComplete={handleWizardComplete}
          onClose={() => setShowWizard(false)}
        />
      )}
    </div>
  )
}
