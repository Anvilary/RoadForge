import type { Metadata } from 'next'

export const SITE_URL = 'https://roadforge.anvilary.tools'
export const SITE_NAME = 'RoadForge'
export const APP_VERSION = '0.2.0'
export const PUBLISHER_NAME = 'Anvilary Tools'
export const PUBLISHER_URL = 'https://anvilary.tools/'
export const REPO_URL = 'https://github.com/Anvilary/RoadForge'
export const LICENSE_URL = 'https://github.com/Anvilary/RoadForge/blob/main/LICENSE'

export const SOCIAL_PREVIEW_IMAGE = {
  url: '/brand/roadforge/social-preview.png',
  width: 1200,
  height: 630,
  alt: 'RoadForge by Anvilary Tools - Local-first roadmap planning with phases, dependencies, and optional collaboration',
} as const

export const HOME_TITLE = 'RoadForge | Local-First Roadmap Planning & Collaboration'
export const HOME_DESCRIPTION =
  'Plan engineering and product roadmaps locally in your browser with phases, tasks, dependencies, and progress tracking. Export portable JSON or Markdown, integrate via MCP, or enable optional accountless collaboration.'

export const HELP_TITLE = 'Help & User Guide'
export const HELP_FULL_TITLE = `${HELP_TITLE} | RoadForge`
export const HELP_DESCRIPTION =
  'Practical guide to RoadForge local-first roadmaps, phases and dependencies, JSON and Markdown backups, MCP integration, hosted demo sharing, self-hosting, and conflict recovery.'

export const NOINDEX_ROBOTS: NonNullable<Metadata['robots']> = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
  },
}

export function createNoIndexMetadata(title: string, description: string): Metadata {
  return {
    title,
    description,
    robots: NOINDEX_ROBOTS,
  }
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

export function buildHomeJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${PUBLISHER_URL}#organization`,
        name: PUBLISHER_NAME,
        url: PUBLISHER_URL,
        logo: {
          '@type': 'ImageObject',
          url: `${SITE_URL}/brand/anvilary-tools/logo.png`,
        },
        sameAs: ['https://github.com/Anvilary'],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: HOME_DESCRIPTION,
        inLanguage: 'en',
        publisher: {
          '@id': `${PUBLISHER_URL}#organization`,
        },
      },
      {
        '@type': ['SoftwareApplication', 'SoftwareSourceCode'],
        '@id': `${SITE_URL}/#software`,
        name: SITE_NAME,
        applicationCategory: 'ProductivityApplication',
        applicationSubCategory: 'Roadmap Planning',
        operatingSystem: 'Web browser; self-hostable with Docker on Linux, macOS, and Windows',
        softwareVersion: APP_VERSION,
        url: SITE_URL,
        description: HOME_DESCRIPTION,
        isAccessibleForFree: true,
        license: LICENSE_URL,
        codeRepository: REPO_URL,
        screenshot: `${SITE_URL}${SOCIAL_PREVIEW_IMAGE.url}`,
        featureList: [
          'Browser-local roadmap planning without an account',
          'Phases, tasks, subtasks, complexity levels, tags, and prerequisite dependencies',
          'Automatic blocked-status and phase progress updates',
          'Canonical JSON import/export and Markdown snapshots',
          'Optional accountless sharing with owner, editor, and viewer invite credentials',
          'Realtime collaboration, edit locks, and restore history',
          'Stdio MCP server (@anvilary/roadforge-mcp) for agent workflows',
          'Self-hostable architecture using Next.js, FastAPI, PostgreSQL, and Redis',
        ],
        publisher: {
          '@id': `${PUBLISHER_URL}#organization`,
        },
      },
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}/#webpage`,
        url: SITE_URL,
        name: HOME_TITLE,
        description: HOME_DESCRIPTION,
        inLanguage: 'en',
        isPartOf: {
          '@id': `${SITE_URL}/#website`,
        },
        about: {
          '@id': `${SITE_URL}/#software`,
        },
        primaryImageOfPage: `${SITE_URL}${SOCIAL_PREVIEW_IMAGE.url}`,
      },
    ],
  }
}

export function buildHelpJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${PUBLISHER_URL}#organization`,
        name: PUBLISHER_NAME,
        url: PUBLISHER_URL,
        sameAs: ['https://github.com/Anvilary'],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        publisher: {
          '@id': `${PUBLISHER_URL}#organization`,
        },
      },
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}/help#webpage`,
        url: `${SITE_URL}/help`,
        name: HELP_FULL_TITLE,
        description: HELP_DESCRIPTION,
        inLanguage: 'en',
        isPartOf: {
          '@id': `${SITE_URL}/#website`,
        },
        about: {
          '@id': `${SITE_URL}/#software`,
        },
        primaryImageOfPage: `${SITE_URL}${SOCIAL_PREVIEW_IMAGE.url}`,
      },
    ],
  }
}
