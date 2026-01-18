import fs from 'node:fs/promises'
import path from 'node:path'
import type { LlmSeoConfig } from '../config.js'
import { resolveConfig } from '../config.js'
import type { SeoPageContent, SeoRoute } from '../types.js'
import { renderSeoMarkdown } from '../markdown/renderer.js'
import { buildMarketingContentIndexFromFilesystem } from '../content/marketing.js'
import {
  addMarketingRouteGitDates,
  buildMarketingRoutesFromFilesystem,
  readMarketingRoutesFile,
  writeMarketingRoutesFile,
} from '../content/marketing_routes.js'
import {
  buildSeoContentIndexFromFilesystem,
  buildSeoStaticContentIndexFromFilesystem,
} from '../registry.js'
import {
  getProgrammaticSeoRoutes,
  validateProgrammaticPages,
  writeProgrammaticMarkdownFiles,
} from '../programmatic/index.js'
import { buildLlmsTxt } from './llms.js'
import { buildRobotsTxt } from './robots.js'
import {
  buildSitemapEntries,
  buildSitemapIndexXml,
  buildSitemapMd,
  buildSitemapXml,
  chunk,
} from './sitemap.js'

const normalizeAppUrl = (value: string) => value.replace(/\/+$/, '')

const dedupeRoutes = (routes: SeoRoute[]) => {
  const seen = new Set<string>()
  return routes.filter((route) => {
    if (seen.has(route.path)) return false
    seen.add(route.path)
    return true
  })
}

const toMarkdownOutputPath = (outputDir: string, pathValue: string) =>
  path.join(outputDir, pathValue === '/' ? 'index.md' : `${pathValue.slice(1)}.md`)

const mapMarketingContentToSeo = (entry: any): SeoPageContent => ({
  path: entry.path,
  group: entry.group,
  indexable: entry.indexable,
  llms: entry.llms,
  nav: entry.nav,
  navOrder: entry.navOrder,
  markdownPath: entry.markdownPath,
  eyebrow: entry.eyebrow,
  title: entry.title,
  heading: entry.heading,
  description: entry.description,
  seoTitle: entry.seoTitle,
  seoDescription: entry.seoDescription,
  ogImage: entry.ogImage,
  ogType: entry.ogType,
  schemaType: entry.schemaType,
  cta: entry.cta,
  steps: entry.steps,
  pricing: entry.pricing,
  trust: entry.trust,
  faqs: entry.faqs,
  featureList: entry.featureList,
  sections: entry.sections,
  relatedLinks: entry.relatedLinks,
  resourceLinks: entry.resourceLinks,
  publishedAt: entry.publishedAt,
  updatedAt: entry.updatedAt,
})

export type GenerateSeoArtifactsResult = {
  sitemapPath: string
  robotsPath: string
  sitemapMdPath: string
  llmsPath: string
  marketingContentPath: string
  seoContentPath: string
  programmaticMarkdownCount: number
  markdownOutputCount: number
  routes: SeoRoute[]
  programmaticIssues: { level: 'warning' | 'error'; message: string; path?: string }[]
}

export const generateSeoArtifacts = async (configInput: LlmSeoConfig) => {
  const config = resolveConfig(configInput)

  const existingRoutes = readMarketingRoutesFile(config)
  const fallbackDates = existingRoutes
    ? new Map(
        existingRoutes.map((route) => [
          route.path,
          { publishedAt: route.publishedAt, updatedAt: route.updatedAt },
        ])
      )
    : undefined

  const marketingRoutes = buildMarketingRoutesFromFilesystem(config)
  const marketingRoutesWithDates = config.generation.useGitDates
    ? addMarketingRouteGitDates(config, marketingRoutes, fallbackDates)
    : marketingRoutes.map((route) => ({
        path: route.path,
        component: route.component,
        label: route.label,
        group: route.group,
        indexable: route.indexable,
        publishedAt: route.publishedAt,
        updatedAt: route.updatedAt,
        nav: route.nav,
        navOrder: route.navOrder,
      }))

  await fs.mkdir(config.generation.contentCacheDir, { recursive: true })
  writeMarketingRoutesFile(config, marketingRoutesWithDates)

  const appUrl = normalizeAppUrl(config.baseUrl || process.env.APP_URL || '')
  const baseUrl = appUrl || 'http://localhost:3333'

  const outputDir = config.generation.outputDir
  const sitemapPath = path.join(outputDir, 'sitemap.xml')
  const robotsPath = path.join(outputDir, 'robots.txt')
  const sitemapMdPath = path.join(outputDir, 'sitemap.md')
  const llmsPath = path.join(outputDir, 'llms.txt')
  const marketingContentPath = path.join(config.generation.contentCacheDir, 'marketing_content.json')
  const seoContentPath = path.join(config.generation.contentCacheDir, 'seo_content.json')

  const marketingContent = buildMarketingContentIndexFromFilesystem(config, { includeMarkdown: true })
  const marketingDates = new Map(
    marketingRoutesWithDates.map((route) => [
      route.path,
      { publishedAt: route.publishedAt, updatedAt: route.updatedAt },
    ])
  )
  const marketingContentWithDates = marketingContent.map((entry) => {
    const dates = marketingDates.get(entry.path)
    return {
      ...entry,
      publishedAt: dates?.publishedAt ?? entry.publishedAt,
      updatedAt: dates?.updatedAt ?? entry.updatedAt,
    }
  })
  const marketingContentConfig = marketingContentWithDates.map(({ markdown, ...rest }) => rest)
  await fs.writeFile(marketingContentPath, `${JSON.stringify(marketingContentConfig, null, 2)}\n`, 'utf8')

  let programmaticMarkdownCount = 0
  if (config.generation.generateProgrammaticMarkdown) {
    programmaticMarkdownCount = await writeProgrammaticMarkdownFiles(config)
  }

  const seoContentIndex = buildSeoContentIndexFromFilesystem(config)
  await fs.writeFile(seoContentPath, `${JSON.stringify(seoContentIndex, null, 2)}\n`, 'utf8')

  const routes = dedupeRoutes([
    ...config.routes.staticRoutes,
    ...marketingRoutesWithDates,
    ...getProgrammaticSeoRoutes(config),
  ])
  const indexableRoutes = routes.filter((route) => route.indexable)

  const urlEntries = buildSitemapEntries(baseUrl, indexableRoutes)
  const MAX_URLS_PER_SITEMAP = 45000
  const sitemapChunks = chunk(urlEntries, MAX_URLS_PER_SITEMAP)

  await fs.mkdir(outputDir, { recursive: true })

  if (sitemapChunks.length <= 1) {
    const sitemap = buildSitemapXml(sitemapChunks[0] || [])
    await fs.writeFile(sitemapPath, sitemap, 'utf8')
  } else {
    const sitemapIndexEntries: string[] = []
    for (let index = 0; index < sitemapChunks.length; index += 1) {
      const entries = sitemapChunks[index] || []
      const chunkName = `sitemap-${index + 1}.xml`
      const chunkPath = path.join(outputDir, chunkName)
      const xml = buildSitemapXml(entries)
      await fs.writeFile(chunkPath, xml, 'utf8')
      sitemapIndexEntries.push(
        ['  <sitemap>', `    <loc>${baseUrl}/${chunkName}</loc>`, '  </sitemap>'].join('\n')
      )
    }
    const sitemapIndex = buildSitemapIndexXml(sitemapIndexEntries)
    await fs.writeFile(sitemapPath, sitemapIndex, 'utf8')
  }

  const robots = buildRobotsTxt(baseUrl)
  await fs.writeFile(robotsPath, robots, 'utf8')

  const sitemapMd = buildSitemapMd(baseUrl, indexableRoutes)
  await fs.writeFile(sitemapMdPath, sitemapMd, 'utf8')

  const llmsInclude = config.llms.include
  const articleLinks = [...marketingContentWithDates, ...seoContentIndex]
    .filter((entry) => entry.indexable && entry.llms !== false)
    .filter((entry) => (llmsInclude ? llmsInclude(entry) : true))
    .map((entry) => {
      const labelValue =
        ('label' in entry && (entry as { label?: string }).label) || entry.title || entry.heading || entry.path
      return {
        label: String(labelValue ?? entry.path),
        href: `${baseUrl}${entry.path === '/' ? '/index.md' : `${entry.path}.md`}`,
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label))

  const llms = buildLlmsTxt({ config, baseUrl, articleLinks })
  await fs.writeFile(llmsPath, llms, 'utf8')

  const staticContent = buildSeoStaticContentIndexFromFilesystem(config)
  const markdownTargets = new Map<string, { content: SeoPageContent; allowEmpty?: boolean }>()

  marketingContentWithDates.forEach((entry) => {
    if (!entry.indexable || entry.llms === false) return
    if (!entry.markdown?.trim()) return
    markdownTargets.set(entry.path, {
      content: mapMarketingContentToSeo(entry),
      allowEmpty: false,
    })
  })

  staticContent.forEach((entry) => {
    if (!entry.indexable || entry.llms === false) return
    if (markdownTargets.has(entry.path)) return
    markdownTargets.set(entry.path, { content: entry })
  })

  if (config.generation.publicMarkdownFromProgrammatic) {
    seoContentIndex.forEach((entry) => {
      if (!entry.indexable || entry.llms === false) return
      if (markdownTargets.has(entry.path)) return
      markdownTargets.set(entry.path, { content: entry })
    })
  }

  let markdownOutputCount = 0

  if (config.generation.generatePublicMarkdown) {
    const results = await Promise.all(
      [...markdownTargets.values()].map(async ({ content, allowEmpty }) => {
        const outputPath = toMarkdownOutputPath(outputDir, content.path)
        const outputDirname = path.dirname(outputPath)
        await fs.mkdir(outputDirname, { recursive: true })
        if (allowEmpty === false && !content?.title) {
          return 0
        }
        const markdown = renderSeoMarkdown(content)
        await fs.writeFile(outputPath, markdown, 'utf8')
        return 1
      })
    )
    let count = 0
    for (const value of results) {
      count += value
    }
    markdownOutputCount = count
  }

  const programmaticIssues = validateProgrammaticPages(config)

  return {
    sitemapPath,
    robotsPath,
    sitemapMdPath,
    llmsPath,
    marketingContentPath,
    seoContentPath,
    programmaticMarkdownCount,
    markdownOutputCount,
    routes,
    programmaticIssues,
  }
}
