import { expect, test } from '@playwright/test'

test.describe('SEO, metadata, structured data, and crawler directives', () => {
  test('homepage exposes canonical URL, metadata, Open Graph, and factual JSON-LD for ordinary Chromium requests without CSP errors', async ({ page }) => {
    const cspErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /content security policy|refused to/i.test(msg.text())) {
        cspErrors.push(msg.text())
      }
    })

    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    expect(response?.headers()['x-robots-tag']).toBeUndefined()

    await expect(page).toHaveTitle('RoadForge | Local-First Roadmap Planning & Collaboration')

    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
    expect(canonical).toBe('https://roadforge.anvilary.tools')

    const robotsMeta = await page.locator('meta[name="robots"]').getAttribute('content')
    expect(robotsMeta).toBe('index, follow')

    const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content')
    expect(ogUrl).toBe('https://roadforge.anvilary.tools')

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
    expect(ogImage).toBe('https://roadforge.anvilary.tools/brand/roadforge/social-preview.png')

    const ogImageAlt = await page.locator('meta[property="og:image:alt"]').getAttribute('content')
    expect(ogImageAlt).toContain('RoadForge by Anvilary Tools')

    const jsonLdScripts = await page.locator('script[type="application/ld+json"]').allTextContents()
    expect(jsonLdScripts.length).toBeGreaterThanOrEqual(1)
    const parsed = JSON.parse(jsonLdScripts[0]!)
    const graphTypes = parsed['@graph'].flatMap((node: { '@type': string | string[] }) =>
      Array.isArray(node['@type']) ? node['@type'] : [node['@type']],
    )
    expect(graphTypes).toContain('Organization')
    expect(graphTypes).toContain('WebSite')
    expect(graphTypes).toContain('WebPage')
    expect(graphTypes).toContain('SoftwareApplication')
    expect(graphTypes).toContain('SoftwareSourceCode')

    await expect(page.locator('header.site-header nav a[href="/help"]')).toBeVisible()
    await expect(page.locator('footer.site-footer a[href="/help"]')).toBeVisible()
    expect(cspErrors).toEqual([])
  })

  test('help page has distinct canonical, metadata, valid heading structure, and JSON-LD', async ({ page }) => {
    const response = await page.goto('/help')
    expect(response?.status()).toBe(200)
    expect(response?.headers()['x-robots-tag']).toBeUndefined()

    await expect(page).toHaveTitle('Help & User Guide | RoadForge')

    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
    expect(canonical).toBe('https://roadforge.anvilary.tools/help')

    const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content')
    expect(ogUrl).toBe('https://roadforge.anvilary.tools/help')

    const robotsMeta = await page.locator('meta[name="robots"]').getAttribute('content')
    expect(robotsMeta).toBe('index, follow')

    const nestedHeadings = await page.locator('button h1, button h2, button h3').count()
    expect(nestedHeadings).toBe(0)
    const h2Count = await page.locator('h2.help-accordion-heading').count()
    expect(h2Count).toBe(9)

    const jsonLdScripts = await page.locator('script[type="application/ld+json"]').allTextContents()
    expect(jsonLdScripts.length).toBeGreaterThanOrEqual(1)
    const parsed = JSON.parse(jsonLdScripts[0]!)
    const webPage = parsed['@graph'].find((n: { '@type': string }) => n['@type'] === 'WebPage')
    expect(webPage.url).toBe('https://roadforge.anvilary.tools/help')
  })

  test('ordinary browser visits to /workspace, /shared, /join, /p/*, and /embed/* expose noindex and enforce route-specific framing policies', async ({ page }) => {
    for (const route of [
      '/workspace',
      '/shared',
      '/join',
      '/p/pub_abcdefghijklmnopqrstuv',
      '/embed/invalid-public-id',
    ]) {
      const response = await page.goto(route)
      expect(response?.status()).toBe(200)
      expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow')
      expect(response?.headers()['x-frame-options']).toBe('DENY')
      const policy =
        response?.headers()['content-security-policy'] ??
        response?.headers()['content-security-policy-report-only']
      expect(policy).toContain("frame-ancestors 'none'")

      const robotsMeta = await page.locator('meta[name="robots"]').getAttribute('content')
      expect(robotsMeta).toBe('noindex, nofollow')
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
    }

    const embedResponse = await page.goto('/embed/pub_abcdefghijklmnopqrstuv')
    expect(embedResponse?.status()).toBe(200)
    expect(embedResponse?.headers()['x-robots-tag']).toBe('noindex, nofollow')
    expect(embedResponse?.headers()['x-frame-options']).toBeUndefined()
    const embedPolicy =
      embedResponse?.headers()['content-security-policy'] ??
      embedResponse?.headers()['content-security-policy-report-only']
    expect(embedPolicy).toContain('frame-ancestors *')
    await expect(page).toHaveTitle('Embedded Roadmap | RoadForge')
    const embedRobotsMeta = await page.locator('meta[name="robots"]').getAttribute('content')
    expect(embedRobotsMeta).toBe('noindex, nofollow')
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
  })

  test('robots.txt allows crawling application HTML to observe noindex while restricting API endpoints, and sitemap.xml lists only indexable pages', async ({ request }) => {
    const robotsRes = await request.get('/robots.txt')
    expect(robotsRes.status()).toBe(200)
    expect(robotsRes.headers()['content-type']).toContain('text/plain')
    const robotsText = await robotsRes.text()
    expect(robotsText).toContain('User-Agent: *')
    expect(robotsText).toContain('User-Agent: Googlebot')
    expect(robotsText).toContain('User-Agent: Bingbot')
    expect(robotsText).toContain('User-Agent: OAI-SearchBot')
    expect(robotsText).toContain('Allow: /')
    expect(robotsText).toContain('Disallow: /api/')
    expect(robotsText).not.toContain('Disallow: /workspace')
    expect(robotsText).not.toContain('Disallow: /shared')
    expect(robotsText).not.toContain('Disallow: /join')
    expect(robotsText).toContain('Sitemap: https://roadforge.anvilary.tools/sitemap.xml')

    const sitemapRes = await request.get('/sitemap.xml')
    expect(sitemapRes.status()).toBe(200)
    expect(sitemapRes.headers()['content-type']).toContain('xml')
    const sitemapText = await sitemapRes.text()
    expect(sitemapText).toContain('<loc>https://roadforge.anvilary.tools</loc>')
    expect(sitemapText).toContain('<loc>https://roadforge.anvilary.tools/help</loc>')
    expect(sitemapText).not.toContain('/workspace')
    expect(sitemapText).not.toContain('/shared')
    expect(sitemapText).not.toContain('/join')

    const ogImageRes = await request.get('/brand/roadforge/social-preview.png')
    expect(ogImageRes.status()).toBe(200)
    expect(ogImageRes.headers()['content-type']).toContain('image/png')
  })

  test('Googlebot, Bingbot, OAI-SearchBot, and social preview crawlers receive metadata in initial <head> HTML', async ({ request }) => {
    for (const userAgent of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
      'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
    ]) {
      const homeRes = await request.get('/', { headers: { 'User-Agent': userAgent } })
      expect(homeRes.status()).toBe(200)
      const homeHtml = await homeRes.text()
      const homeHead = homeHtml.match(/<head>[\s\S]*<\/head>/)?.[0] ?? ''
      expect(homeHead).toContain('<link rel="canonical" href="https://roadforge.anvilary.tools"')
      expect(homeHead).toContain('property="og:title"')
      expect(homeHead).toContain('property="og:image" content="https://roadforge.anvilary.tools/brand/roadforge/social-preview.png"')
      expect(homeHead).toContain('content="index, follow"')
      expect(homeHtml).toContain('application/ld+json')

      const helpRes = await request.get('/help', { headers: { 'User-Agent': userAgent } })
      expect(helpRes.status()).toBe(200)
      const helpHtml = await helpRes.text()
      const helpHead = helpHtml.match(/<head>[\s\S]*<\/head>/)?.[0] ?? ''
      expect(helpHead).toContain('<link rel="canonical" href="https://roadforge.anvilary.tools/help"')
      expect(helpHead).toContain('property="og:url" content="https://roadforge.anvilary.tools/help"')
      expect(helpHtml).toContain('application/ld+json')

      for (const noindexRoute of [
        '/workspace',
        '/shared',
        '/join',
        '/p/pub_abcdefghijklmnopqrstuv',
        '/embed/pub_abcdefghijklmnopqrstuv',
      ]) {
        const res = await request.get(noindexRoute, { headers: { 'User-Agent': userAgent } })
        expect(res.status()).toBe(200)
        expect(res.headers()['x-robots-tag']).toBe('noindex, nofollow')
        const html = await res.text()
        const head = html.match(/<head>[\s\S]*<\/head>/)?.[0] ?? ''
        expect(head).toContain('content="noindex, nofollow"')
        expect(head).not.toContain('rel="canonical"')
      }
    }
  })
})
