import fs from 'node:fs'
import path from 'node:path'
import { parseMarkdownContent, normalizePathTitle, type ParsedMarkdown } from './markdown/parser.js'
import type { SeoPageContent } from './types.js'
import { buildMarkdownPath, isIgnoredSegment, isMarkdownFile, slugifySegment, stripExtension, toPosixPath, titleCase } from './utils/path.js'
import { normalizeBoolean, normalizeGroup, normalizeNumber, normalizeSchemaType } from './utils/normalize.js'
import type { ResolvedLlmSeoConfig } from './config.js'

const buildBreadcrumbs = (pathValue: string) => {
  const segments = pathValue.split('/').filter(Boolean)
  const breadcrumbs = [{ name: 'Home', path: '/' }]
  let currentPath = ''
  for (const segment of segments) {
    currentPath += `/${segment}`
    breadcrumbs.push({ name: titleCase(segment), path: currentPath })
  }
  return breadcrumbs
}

const scanMarkdown = (dir: string, baseDir: string) => {
  if (!fs.existsSync(dir)) return []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const results: string[] = []

  for (const entry of entries) {
    if (isIgnoredSegment(entry.name)) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...scanMarkdown(fullPath, baseDir))
      continue
    }
    if (!entry.isFile() || !isMarkdownFile(entry.name)) {
      continue
    }
    results.push(path.relative(baseDir, fullPath))
  }
  return results
}

const buildRoutePathFromFile = (relativePath: string) => {
  const normalized = toPosixPath(relativePath)
  const withoutExt = stripExtension(normalized)
  if (!withoutExt) return null
  const segments = withoutExt.split('/').filter(Boolean)
  if (!segments.length) return null
  if (segments.some((segment) => isIgnoredSegment(segment))) return null

  const baseName = segments[segments.length - 1] || ''
  if (isIgnoredSegment(baseName)) return null

  const isIndex = baseName.toLowerCase() === 'index'
  const routeSegments = isIndex ? segments.slice(0, -1) : segments
  if (!routeSegments.length) return '/'

  const slugSegments = routeSegments.map((segment) => slugifySegment(segment))
  return `/${slugSegments.join('/')}`
}

const buildContentRecord = (options: { pathValue: string; parsed: ParsedMarkdown }) => {
  const { pathValue, parsed } = options
  const meta = parsed.meta
  const pathOverride = typeof meta.path === 'string' ? meta.path.trim() : ''
  const finalPath = pathOverride || pathValue

  const tags = Array.isArray(meta.tags)
    ? meta.tags
    : typeof meta.tags === 'string'
      ? meta.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      : undefined

  const group = normalizeGroup(meta.group as string | undefined)
  const indexable = normalizeBoolean(meta.indexable as string | undefined) ?? true
  const llms = normalizeBoolean(meta.llms as string | undefined)
  const nav = normalizeBoolean(meta.nav as string | undefined)
  const navOrder = normalizeNumber(meta['nav-order'] as string | undefined)
  const schemaType = normalizeSchemaType(meta.schema as string | undefined || meta['schema-type'] as string | undefined)
  const ogImage = typeof meta['og-image'] === 'string' ? meta['og-image'].trim() : undefined
  const ogType = typeof meta['og-type'] === 'string' ? meta['og-type'].trim() : undefined
  const eyebrow = typeof meta.eyebrow === 'string' ? meta.eyebrow.trim() : undefined
  const publishedAt = typeof meta.published === 'string' ? meta.published.trim() : undefined
  const updatedAt = typeof meta.updated === 'string' ? meta.updated.trim() : undefined

  const label = parsed.title || normalizePathTitle(finalPath)

  const record: SeoPageContent = {
    path: finalPath,
    group,
    indexable,
    llms,
    nav,
    navOrder,
    tags,
    markdownPath: buildMarkdownPath(finalPath),
    eyebrow,
    title: parsed.title || label,
    heading: parsed.heading || parsed.title || label,
    description: parsed.description || undefined,
    seoTitle: parsed.seoTitle,
    seoDescription: parsed.seoDescription,
    ogImage,
    ogType,
    schemaType,
    steps: parsed.steps,
    pricing: parsed.pricing,
    trust: parsed.trust,
    faqs: parsed.faqs,
    cta: parsed.cta,
    featureList: parsed.featureList,
    sections: parsed.extraSections,
    relatedLinks: parsed.relatedLinks,
    resourceLinks: parsed.resourceLinks,
    publishedAt,
    updatedAt,
    breadcrumbs: buildBreadcrumbs(finalPath),
  }

  return record
}

const buildIndexFromDir = (dir: string, options: { skipMarketingPrefix?: string }) => {
  const files = scanMarkdown(dir, dir)
  const results: SeoPageContent[] = []

  for (const file of files) {
    const relativePath = toPosixPath(file)
    const pathValue = buildRoutePathFromFile(relativePath)
    if (!pathValue) continue

    const markdown = fs.readFileSync(path.join(dir, file), 'utf8')
    const parsed = parseMarkdownContent(markdown)
    const record = buildContentRecord({ pathValue, parsed })

    if (options.skipMarketingPrefix && record.path.startsWith(options.skipMarketingPrefix)) {
      continue
    }

    results.push(record)
  }

  return results
}

export const buildSeoContentIndexFromFilesystem = (config: ResolvedLlmSeoConfig) => {
  const staticPages = buildIndexFromDir(config.content.pagesDir, {
    skipMarketingPrefix: config.routes.marketingRoutePrefix,
  })
  const programmaticPages = buildIndexFromDir(config.content.generatedDir, { skipMarketingPrefix: undefined })
  return [...staticPages, ...programmaticPages]
}

export const buildSeoStaticContentIndexFromFilesystem = (config: ResolvedLlmSeoConfig) =>
  buildIndexFromDir(config.content.pagesDir, { skipMarketingPrefix: config.routes.marketingRoutePrefix })

let cachedIndex: SeoPageContent[] | null = null

const readCache = (config: ResolvedLlmSeoConfig) => {
  const cachePath = path.join(config.generation.contentCacheDir, 'seo_content.json')
  if (!fs.existsSync(cachePath)) return null
  try {
    const raw = fs.readFileSync(cachePath, 'utf8')
    const parsed = JSON.parse(raw) as SeoPageContent[]
    if (!Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export const getSeoContentIndex = (config: ResolvedLlmSeoConfig, options?: { refresh?: boolean }) => {
  if (cachedIndex && !options?.refresh) return cachedIndex
  const isProd = process.env.NODE_ENV === 'production'
  const cached = isProd ? readCache(config) : null
  cachedIndex = cached || buildSeoContentIndexFromFilesystem(config)
  return cachedIndex
}

export const getSeoContentByPath = (config: ResolvedLlmSeoConfig, pathValue: string) => {
  const normalized = pathValue.endsWith('/') && pathValue !== '/' ? pathValue.slice(0, -1) : pathValue
  const content = getSeoContentIndex(config)
  return content.find((entry) => entry.path === normalized) ?? null
}
