import type { SeoRoute } from '../types.js'

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const normalizeLastmod = (value?: string | null) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

export const chunk = <T>(items: T[], size: number) => {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size))
  }
  return result
}

export const buildSitemapXml = (entries: string[]) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n')

export const buildSitemapIndexXml = (entries: string[]) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</sitemapindex>',
    '',
  ].join('\n')

export const buildSitemapEntries = (baseUrl: string, routes: SeoRoute[]) =>
  routes.map((route) => {
    const loc = `${baseUrl}${route.path}`
    const isHome = route.path === '/'
    const changefreq = isHome ? 'daily' : 'weekly'
    const priority = isHome ? '1.0' : '0.7'
    const lastmod = normalizeLastmod(route.updatedAt || route.publishedAt)
    return [
      '  <url>',
      `    <loc>${escapeXml(loc)}</loc>`,
      ...(lastmod ? [`    <lastmod>${escapeXml(lastmod)}</lastmod>`] : []),
      `    <changefreq>${changefreq}</changefreq>`,
      `    <priority>${priority}</priority>`,
      '  </url>',
    ].join('\n')
  })

export const buildSitemapMd = (baseUrl: string, routes: SeoRoute[]) => {
  if (routes.length > 5000) {
    return [
      '# Sitemap',
      '',
      `Total pages: ${routes.length}`,
      '',
      `Sitemap index: ${baseUrl}/sitemap.xml`,
      '',
    ].join('\n')
  }

  return [
    '# Sitemap',
    '',
    'A simple directory of public pages.',
    '',
    '## Pages',
    ...routes.map((route) => `${baseUrl}${route.path}`).map((url) => `- ${url}`),
    '',
  ].join('\n')
}
