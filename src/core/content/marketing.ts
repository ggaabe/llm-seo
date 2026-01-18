import fs from 'node:fs'
import path from 'node:path'
import type { MarketingContent, MarketingGroup } from '../types.js'
import { parseMarketingMarkdown } from '../markdown/marketing_parser.js'
import { buildMarkdownPath, isIgnoredSegment, isMarkdownFile, slugifySegment, stripExtension, toPosixPath, titleCase } from '../utils/path.js'
import { normalizeBoolean, normalizeNumber, normalizeSchemaType } from '../utils/normalize.js'
import type { ResolvedLlmSeoConfig } from '../config.js'

export type MarketingContentRecord = MarketingContent & { markdown?: string }

const MARKETING_GROUPS = new Set<MarketingGroup>(['use-cases', 'company', 'resources', 'content'])

const buildLabelFromPath = (pathValue: string) => {
  const segments = pathValue.split('/').filter(Boolean)
  const last = segments[segments.length - 1] || ''
  return titleCase(last)
}

const scanMarketingMarkdown = (dir: string, baseDir: string): string[] => {
  if (!fs.existsSync(dir)) return []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const results: string[] = []

  for (const entry of entries) {
    if (isIgnoredSegment(entry.name)) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...scanMarketingMarkdown(fullPath, baseDir))
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
  if (!routeSegments.length) return '/marketing'

  const slugSegments = routeSegments.map((segment) => slugifySegment(segment))
  return `/${slugSegments.join('/')}`
}

const normalizeGroupValue = (value?: string): MarketingGroup => {
  const normalized = value?.trim().toLowerCase() as MarketingGroup | undefined
  if (normalized && MARKETING_GROUPS.has(normalized)) {
    return normalized
  }
  return 'content'
}

export const buildMarketingContentIndexFromFilesystem = (
  config: ResolvedLlmSeoConfig,
  options?: { includeMarkdown?: boolean }
): MarketingContentRecord[] => {
  const includeMarkdown = options?.includeMarkdown ?? true
  const files = scanMarketingMarkdown(config.content.marketingDir, config.content.marketingDir)
  const results: MarketingContentRecord[] = []
  const seen = new Map<string, string>()

  for (const file of files) {
    const sourceFile = toPosixPath(path.join('content', 'marketing', file))
    const routePath = buildRoutePathFromFile(file)
    if (!routePath) continue

    const existing = seen.get(routePath)
    if (existing) {
      throw new Error(`Duplicate marketing route for path ${routePath}. Files: ${existing}, ${file}`)
    }

    const markdown = fs.readFileSync(path.join(config.content.marketingDir, file), 'utf8')
    const parsed = parseMarketingMarkdown(markdown)
    const meta = parsed.meta

    const label = parsed.title || buildLabelFromPath(routePath)
    const group = normalizeGroupValue(typeof meta.group === 'string' ? meta.group : undefined)
    const indexable = normalizeBoolean(meta.indexable as string | undefined) ?? true
    const llms = normalizeBoolean(meta.llms as string | undefined)

    const eyebrow = meta.eyebrow ? String(meta.eyebrow).trim() : undefined
    const nav = normalizeBoolean(meta.nav as string | undefined)
    const navOrder = normalizeNumber(meta['nav-order'] as string | undefined)
    const ogImage = meta['og-image'] ? String(meta['og-image']).trim() : undefined
    const schemaType = normalizeSchemaType((meta.schema as string | undefined) || (meta['schema-type'] as string | undefined))
    const ogType = meta['og-type'] ? String(meta['og-type']).trim() : undefined

    results.push({
      path: routePath,
      label,
      group,
      indexable,
      publishedAt: typeof meta.published === 'string' ? meta.published : undefined,
      updatedAt: typeof meta.updated === 'string' ? meta.updated : undefined,
      markdownPath: buildMarkdownPath(routePath),
      eyebrow,
      title: parsed.title || label,
      heading: parsed.heading || parsed.title || label,
      description: parsed.description,
      seoTitle: parsed.seoTitle,
      seoDescription: parsed.seoDescription,
      schemaType,
      ogType,
      nav,
      navOrder,
      steps: parsed.steps,
      pricing: parsed.pricing,
      trust: parsed.trust,
      faqs: parsed.faqs,
      cta: parsed.cta,
      relatedLinks: parsed.relatedLinks,
      resourceLinks: parsed.resourceLinks,
      featureList: parsed.featureList,
      ogImage,
      sections: parsed.extraSections,
      llms,
      sourceFile,
      markdown: includeMarkdown ? parsed.body : undefined,
    })
    seen.set(routePath, file)
  }

  return results.sort((a, b) => a.path.localeCompare(b.path))
}

const readMarketingContentFile = (config: ResolvedLlmSeoConfig): MarketingContentRecord[] | null => {
  const generatedPath = path.join(config.generation.contentCacheDir, 'marketing_content.json')
  if (!fs.existsSync(generatedPath)) return null
  try {
    const raw = fs.readFileSync(generatedPath, 'utf8')
    const parsed = JSON.parse(raw) as MarketingContentRecord[]
    if (!Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

let cachedContent: MarketingContentRecord[] | null = null

export const getMarketingContentIndex = (
  config: ResolvedLlmSeoConfig,
  options?: { refresh?: boolean; source?: 'auto' | 'filesystem' | 'file' }
) => {
  if (cachedContent && !options?.refresh) {
    return cachedContent
  }

  const source = options?.source ?? (process.env.NODE_ENV === 'production' ? 'auto' : 'filesystem')
  let content: MarketingContentRecord[] | null = null

  if (source === 'file' || source === 'auto') {
    content = readMarketingContentFile(config)
  }

  if (!content && (source === 'filesystem' || source === 'auto')) {
    content = buildMarketingContentIndexFromFilesystem(config, { includeMarkdown: false })
  }

  cachedContent = content || []
  return cachedContent
}

export const getMarketingContentByPath = (config: ResolvedLlmSeoConfig, pathValue: string) => {
  const content = getMarketingContentIndex(config)
  return content.find((entry) => entry.path === pathValue) ?? null
}
