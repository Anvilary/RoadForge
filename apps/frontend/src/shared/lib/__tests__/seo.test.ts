import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { metadata as layoutMetadata } from '@/app/layout'
import { metadata as homeMetadata } from '@/app/page'
import { metadata as helpMetadata } from '@/app/help/page'
import { metadata as workspaceMetadata } from '@/app/workspace/page'
import { metadata as sharedMetadata } from '@/app/shared/page'
import { metadata as joinMetadata } from '@/app/join/page'
import robots from '@/app/robots'
import sitemap from '@/app/sitemap'
import { proxy } from '@/proxy'
import {
  APP_VERSION,
  HELP_FULL_TITLE,
  HOME_TITLE,
  LICENSE_URL,
  PUBLISHER_NAME,
  REPO_URL,
  SITE_URL,
  SOCIAL_PREVIEW_IMAGE,
  buildHelpJsonLd,
  buildHomeJsonLd,
  serializeJsonLd,
} from '@/shared/lib/seo'

describe('SEO and AI discoverability metadata', () => {
  it('avoids setting a root canonical or og:url in layout metadata so child routes cannot inherit /', () => {
    expect(layoutMetadata.metadataBase?.toString()).toBe(`${SITE_URL}/`)
    expect(layoutMetadata.alternates).toBeUndefined()
    expect((layoutMetadata.openGraph as { url?: unknown } | undefined)?.url).toBeUndefined()
  })

  it('defines distinct canonical, Open Graph, and indexable metadata for / and /help', () => {
    expect(homeMetadata.alternates?.canonical).toBe('/')
    expect(homeMetadata.robots).toEqual({ index: true, follow: true })
    expect(homeMetadata.openGraph?.url).toBe('/')
    expect(homeMetadata.openGraph?.title).toBe(HOME_TITLE)

    expect(helpMetadata.alternates?.canonical).toBe('/help')
    expect(helpMetadata.robots).toEqual({ index: true, follow: true })
    expect(helpMetadata.openGraph?.url).toBe('/help')
    expect(helpMetadata.openGraph?.title).toBe(HELP_FULL_TITLE)
    expect(helpMetadata.openGraph?.title).not.toBe(homeMetadata.openGraph?.title)
    expect(helpMetadata.description).not.toBe(homeMetadata.description)
  })

  it('configures Open Graph social preview metadata accurately', () => {
    expect(SOCIAL_PREVIEW_IMAGE.url).toBe('/brand/roadforge/social-preview.png')
    expect(SOCIAL_PREVIEW_IMAGE.width).toBe(1200)
    expect(SOCIAL_PREVIEW_IMAGE.height).toBe(630)
    expect(SOCIAL_PREVIEW_IMAGE.alt.length).toBeGreaterThan(20)
    expect(SOCIAL_PREVIEW_IMAGE.alt).toContain('RoadForge')
  })

  it('marks /workspace, /shared, and /join as noindex/nofollow in both Next metadata and proxy headers', () => {
    for (const routeMeta of [workspaceMetadata, sharedMetadata, joinMetadata]) {
      expect(routeMeta.alternates).toBeUndefined()
      expect(routeMeta.robots).toMatchObject({
        index: false,
        follow: false,
      })
    }

    for (const path of ['/workspace', '/workspace?roadmap=local_1', '/shared', '/join']) {
      const request = new NextRequest(new URL(`${SITE_URL}${path}`))
      const response = proxy(request)
      expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
      expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    }

    for (const publicPath of ['/', '/help']) {
      const request = new NextRequest(new URL(`${SITE_URL}${publicPath}`))
      const response = proxy(request)
      expect(response.headers.get('X-Robots-Tag')).toBeNull()
    }
  })

  it('emits valid robots.txt rules for standard and AI search crawlers without indexing private routes', () => {
    const config = robots()
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules]
    const agents = rules.map((r) => r.userAgent)

    expect(agents).toContain('*')
    expect(agents).toContain('Googlebot')
    expect(agents).toContain('Bingbot')
    expect(agents).toContain('OAI-SearchBot')

    for (const rule of rules) {
      expect(rule.allow).toEqual(['/', '/help'])
      expect(rule.disallow).toEqual(['/workspace', '/shared', '/join', '/api/'])
    }
    expect(config.sitemap).toBe(`${SITE_URL}/sitemap.xml`)
  })

  it('includes only legitimate indexable canonical pages in sitemap.xml', () => {
    const entries = sitemap()
    const urls = entries.map((entry) => entry.url)

    expect(urls).toEqual([SITE_URL, `${SITE_URL}/help`])
    for (const url of urls) {
      expect(url).not.toContain('/workspace')
      expect(url).not.toContain('/shared')
      expect(url).not.toContain('/join')
    }
  })

  it('builds factual, unfabricated JSON-LD structured data for / and /help', () => {
    const homeGraph = buildHomeJsonLd()['@graph']
    const org = homeGraph.find((item) => item['@type'] === 'Organization')
    const website = homeGraph.find((item) => item['@type'] === 'WebSite')
    const software = homeGraph.find(
      (item) => Array.isArray(item['@type']) && item['@type'].includes('SoftwareApplication'),
    )
    const webpage = homeGraph.find((item) => item['@type'] === 'WebPage')

    expect(org?.name).toBe(PUBLISHER_NAME)
    expect(website?.url).toBe(SITE_URL)
    expect(webpage?.url).toBe(SITE_URL)
    expect(software?.softwareVersion).toBe(APP_VERSION)
    expect(software?.codeRepository).toBe(REPO_URL)
    expect(software?.license).toBe(LICENSE_URL)
    expect(software?.isAccessibleForFree).toBe(true)
    expect(software).not.toHaveProperty('aggregateRating')
    expect(software).not.toHaveProperty('review')
    expect(software).not.toHaveProperty('offers')

    const serialized = serializeJsonLd({ test: '<script>' })
    expect(serialized).not.toContain('<script>')
    expect(serialized).toContain('\\u003cscript>')

    const helpGraph = buildHelpJsonLd()['@graph']
    const helpPage = helpGraph.find((item) => item['@type'] === 'WebPage')
    expect(helpPage?.url).toBe(`${SITE_URL}/help`)
  })

  it('keeps Help heading semantics valid without h2 nested inside button', () => {
    const helpClientSource = readFileSync(
      resolve(process.cwd(), 'src/app/help/HelpClient.tsx'),
      'utf8',
    )
    expect(helpClientSource).toContain('<h2 className="help-accordion-heading">')
    expect(helpClientSource).not.toContain('<h2 className="help-accordion-title">')
  })
})
