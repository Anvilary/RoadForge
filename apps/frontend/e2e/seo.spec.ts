import { expect, test } from '@playwright/test'

test.describe('SEO, metadata, structured data, and crawler directives', () => {
  test('homepage exposes canonical URL, metadata, Open Graph, and factual JSON-LD without CSP errors', async ({ page }) => {
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

    // Verify internal navigation links
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

    // Ensure headings are not nested inside buttons
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

  test('private and application routes enforce noindex via both meta tags and HTTP headers', async ({ request }) => {
    for (const route of ['/workspace', '/shared', '/join']) {
      const response = await request.get(route)
      expect(response.status()).toBe(200)
      expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow')

      const html = await response.text()
      expect(html).toContain('content="noindex, nofollow"')
      expect(html).not.toContain('rel="canonical"')
    }
  })

  test('robots.txt, sitemap.xml, and social Open Graph image respond accurately', async ({ request }) => {
    const robotsRes = await request.get('/robots.txt')
    expect(robotsRes.status()).toBe(200)
    expect(robotsRes.headers()['content-type']).toContain('text/plain')
    const robotsText = await robotsRes.text()
    expect(robotsText).toContain('User-Agent: Googlebot')
    expect(robotsText).toContain('User-Agent: Bingbot')
    expect(robotsText).toContain('User-Agent: OAI-SearchBot')
    expect(robotsText).toContain('Allow: /')
    expect(robotsText).toContain('Allow: /help')
    expect(robotsText).toContain('Disallow: /workspace')
    expect(robotsText).toContain('Disallow: /shared')
    expect(robotsText).toContain('Disallow: /join')
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

  test('public pages are accessible to search and AI crawler user agents', async ({ request }) => {
    for (const userAgent of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
    ]) {
      for (const route of ['/', '/help']) {
        const res = await request.get(route, { headers: { 'User-Agent': userAgent } })
        expect(res.status()).toBe(200)
        const html = await res.text()
        expect(html).toContain('application/ld+json')
        expect(html).toContain('<link rel="canonical"')
      }

      const workspaceRes = await request.get('/workspace', { headers: { 'User-Agent': userAgent } })
      expect(workspaceRes.status()).toBe(200)
      expect(workspaceRes.headers()['x-robots-tag']).toBe('noindex, nofollow')
      const workspaceHtml = await workspaceRes.text()
      expect(workspaceHtml).toContain('content="noindex, nofollow"')
    }
  })
})
