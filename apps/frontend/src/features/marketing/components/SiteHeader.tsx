'use client'

import { useCallback, useState, useEffect, useLayoutEffect, useRef } from 'react'
import { Brand } from '@/shared/ui/Brand'
import { Icon } from '@/shared/ui/Icon'
import { RoadmapSwitcher } from '@/features/roadmaps/components/RoadmapSwitcher'

interface SiteHeaderProps {
  onCreate: () => void
  activeNav?: 'home' | 'help'
}

const COMPACT_NAV_MEDIA = '(max-width: 1100px)'
const MOBILE_ACTIONS_MEDIA = '(max-width: 640px)'
const MENU_PANEL_ID = 'site-navigation-menu'

const SECTION_LINKS = [
  { id: 'how', label: 'How it works', homeHref: '#how', helpHref: '/#how' },
  { id: 'features', label: 'Features', homeHref: '#features', helpHref: '/#features' },
] as const

export function SiteHeader({ onCreate, activeNav = 'home' }: SiteHeaderProps) {
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isMobileActions, setIsMobileActions] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const desktopNavRef = useRef<HTMLElement>(null)
  const menuToggleRef = useRef<HTMLButtonElement>(null)
  const menuPanelRef = useRef<HTMLDivElement>(null)

  const closeMenu = useCallback(({ restoreFocus = false }: { restoreFocus?: boolean } = {}) => {
    setMenuOpen(false)
    if (restoreFocus) {
      requestAnimationFrame(() => {
        menuToggleRef.current?.focus({ preventScroll: true })
      })
    }
  }, [])

  useLayoutEffect(() => {
    const header = headerRef.current
    if (!header) return

    const updateHeaderHeight = () => {
      document.documentElement.style.setProperty(
        '--site-header-height',
        `${header.getBoundingClientRect().height}px`,
      )
    }

    updateHeaderHeight()
    const observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(updateHeaderHeight)
    observer?.observe(header)
    window.addEventListener('resize', updateHeaderHeight)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateHeaderHeight)
      document.documentElement.style.removeProperty('--site-header-height')
    }
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return

    const navMql = window.matchMedia(COMPACT_NAV_MEDIA)
    const actionsMql = window.matchMedia(MOBILE_ACTIONS_MEDIA)

    const syncBreakpoints = () => {
      setIsMobileActions(actionsMql.matches)
      if (!navMql.matches) {
        const focusWasInMenu = Boolean(
          menuPanelRef.current?.contains(document.activeElement)
          || document.activeElement === menuToggleRef.current,
        )
        setMenuOpen(false)
        if (focusWasInMenu) {
          requestAnimationFrame(() => {
            desktopNavRef.current
              ?.querySelector<HTMLElement>('a')
              ?.focus({ preventScroll: true })
          })
        }
      }
    }

    syncBreakpoints()
    navMql.addEventListener('change', syncBreakpoints)
    actionsMql.addEventListener('change', syncBreakpoints)
    return () => {
      navMql.removeEventListener('change', syncBreakpoints)
      actionsMql.removeEventListener('change', syncBreakpoints)
    }
  }, [])

  useEffect(() => {
    if (!menuOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (headerRef.current?.contains(target)) return
      // AnchoredOverlay and Modal render via portals into document.body;
      // interacting inside Saved roadmaps must not tear down the open menu.
      if (target instanceof Element && target.closest('.anchored-overlay, .modal-backdrop')) return
      closeMenu()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (document.querySelector('[aria-modal="true"], .anchored-overlay')) return
      event.preventDefault()
      closeMenu({ restoreFocus: true })
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeMenu, menuOpen])

  useEffect(() => {
    if (activeNav === 'help') return
    const sections = ['how', 'features']
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null)
    if (sections.length === 0 || !('IntersectionObserver' in window)) return

    const syncHash = () => {
      const section = sections.find(({ id }) => window.location.hash === `#${id}`)
      setActiveSection(section?.id ?? null)
    }
    syncHash()
    const directSection = sections.find(({ id }) => window.location.hash === `#${id}`)
    directSection?.scrollIntoView({ block: 'start' })
    const observer = new IntersectionObserver(
      (entries) => {
        const activeEntry = entries.find((entry) => entry.isIntersecting)
        if (activeEntry) setActiveSection(activeEntry.target.id)
      },
      { rootMargin: '-118px 0px -55% 0px', threshold: 0 },
    )
    sections.forEach((section) => observer.observe(section))
    window.addEventListener('hashchange', syncHash)
    window.addEventListener('popstate', syncHash)
    return () => {
      observer.disconnect()
      window.removeEventListener('hashchange', syncHash)
      window.removeEventListener('popstate', syncHash)
    }
  }, [activeNav])

  const handleCreateClick = () => {
    closeMenu()
    onCreate()
  }

  const renderNavLinks = (withUnderline: boolean, onNavigate?: () => void) => (
    <>
      {SECTION_LINKS.map((item) => {
        const active = activeNav === 'home' && activeSection === item.id
        const href = activeNav === 'help' ? item.helpHref : item.homeHref
        return (
          <a
            key={item.id}
            className={active ? 'active' : undefined}
            href={href}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
          >
            {withUnderline ? <span className="nav-label">{item.label}</span> : <span>{item.label}</span>}
          </a>
        )
      })}
      <a
        className={activeNav === 'help' ? 'active' : undefined}
        href="/help"
        aria-current={activeNav === 'help' ? 'page' : undefined}
        onClick={onNavigate}
      >
        {withUnderline ? <span className="nav-label">Help</span> : <span>Help</span>}
      </a>
    </>
  )

  return (
    <header
      ref={headerRef}
      className={`site-header ${scrolled ? 'scrolled' : ''}`}
    >
      <Brand href="/#hero" size="lg" />
      <nav ref={desktopNavRef} aria-label="Main">
        {renderNavLinks(true)}
      </nav>
      <span className="spacer" />
      <div className="actions">
        {!isMobileActions && (
          <a
            className="gh-pill"
            href="https://github.com/Anvilary/RoadForge"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="github" size={18} />
            <span>Source</span>
          </a>
        )}
        <button
          type="button"
          className="btn primary site-create-btn"
          aria-label="Create roadmap"
          onClick={handleCreateClick}
        >
          <span className="site-create-label-full">Create roadmap</span>
          <span className="site-create-label-short" aria-hidden="true">Create</span>
        </button>
        {!isMobileActions && (
          <RoadmapSwitcher
            variant="header"
            hideWhenEmpty
            label="Open saved roadmaps"
            onCreate={onCreate}
          />
        )}
        <button
          ref={menuToggleRef}
          type="button"
          className="site-menu-toggle"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          aria-controls={MENU_PANEL_ID}
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          <Icon name={menuOpen ? 'x' : 'menu'} size={20} />
        </button>
      </div>
      {menuOpen && (
        <div
          id={MENU_PANEL_ID}
          ref={menuPanelRef}
          className="site-nav-panel"
        >
          <nav className="site-nav-drawer" aria-label="Main">
            {renderNavLinks(false, () => closeMenu())}
          </nav>
          {isMobileActions && (
            <div className="site-nav-secondary">
              <a
                className="site-nav-ext-link"
                href="https://github.com/Anvilary/RoadForge"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => closeMenu()}
              >
                <Icon name="github" size={16} />
                <span>Source</span>
                <span className="site-nav-ext-indicator" aria-hidden="true">↗</span>
              </a>
              <RoadmapSwitcher
                variant="header"
                hideWhenEmpty
                showLabel
                label="Saved roadmaps"
                onCreate={handleCreateClick}
              />
            </div>
          )}
        </div>
      )}
    </header>
  )
}
