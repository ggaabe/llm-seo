import fs from 'node:fs'
import path from 'node:path'
import {
  type SeoBreadcrumb,
  type SeoCta,
  type SeoFaq,
  type SeoLink,
  type SeoPageContent,
  type SeoRoute,
  type SeoRouteGroup,
  type SeoSchemaType,
  type SeoSection,
} from '../types.js'
import { parseMarkdownContent, normalizePathTitle } from '../markdown/parser.js'
import { renderSeoMarkdown } from '../markdown/renderer.js'
import { buildMarkdownPath, normalizePath, titleCase } from '../utils/path.js'
import { normalizeBoolean, normalizeGroup, normalizeSchemaType } from '../utils/normalize.js'
import type { ResolvedLlmSeoConfig } from '../config.js'

export type ProgrammaticTemplate = {
  id: string
  route: string
  group?: SeoRouteGroup
  indexable?: boolean
  llms?: boolean
  schemaType?: SeoSchemaType
  ogType?: string
  ogImage?: string
  eyebrow?: string
  cta?: SeoCta
  content: {
    title: string
    heading?: string
    description?: string
    seoTitle?: string
    seoDescription?: string
    sections?: SeoSection[]
    faqs?: SeoFaq[]
    featureList?: string[]
  }
  linking?: {
    hub?: SeoLink
    relatedBy?: 'tag' | 'hub'
    relatedLimit?: number
    includeHubInResources?: boolean
  }
  dataset?: string
}

export type ProgrammaticRecord = {
  slug: string
  label?: string
  title?: string
  heading?: string
  description?: string
  seoTitle?: string
  seoDescription?: string
  eyebrow?: string
  ogImage?: string
  ogType?: string
  schemaType?: SeoSchemaType
  cta?: SeoCta
  sections?: SeoSection[]
  faqs?: SeoFaq[]
  featureList?: string[]
  tags?: string[]
  relatedSlugs?: string[]
  hub?: SeoLink
  tokens?: Record<string, string>
  publishedAt?: string
  updatedAt?: string
  indexable?: boolean
  llms?: boolean
}

export type ProgrammaticPageRecord = {
  path: string
  label: string
  group: SeoRouteGroup
  indexable: boolean
  publishedAt?: string
  updatedAt?: string
  llms?: boolean
  templateId: string
  slug: string
  tags?: string[]
  relatedSlugs?: string[]
  hub?: SeoLink
  content: SeoPageContent
}

export type ProgrammaticIndex = {
  templates: ProgrammaticTemplate[]
  pages: ProgrammaticPageRecord[]
  pageMap: Map<string, ProgrammaticPageRecord>
}

const RESERVED_TOKEN_KEYS = new Set([
  'slug',
  'label',
  'title',
  'heading',
  'description',
  'seoTitle',
  'seoDescription',
  'eyebrow',
  'sections',
  'faqs',
  'featureList',
  'tags',
  'relatedSlugs',
  'hub',
  'tokens',
  'indexable',
  'llms',
  'publishedAt',
  'updatedAt',
  'ogImage',
  'ogType',
  'schemaType',
  'cta',
])

const buildBreadcrumbs = (pathValue: string): SeoBreadcrumb[] => {
  const segments = pathValue.split('/').filter(Boolean)
  const breadcrumbs: SeoBreadcrumb[] = [{ name: 'Home', path: '/' }]
  let currentPath = ''
  for (const segment of segments) {
    currentPath += `/${segment}`
    breadcrumbs.push({ name: titleCase(segment), path: currentPath })
  }
  return breadcrumbs
}

const loadJsonFile = <T>(filePath: string): T | null => {
  if (!fs.existsSync(filePath)) return null
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

const renderTemplateString = (value: string, tokens: Record<string, string>) =>
  value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, key) => tokens[key] ?? '')

const renderCta = (cta: SeoCta | undefined, tokens: Record<string, string>) => {
  if (!cta) return undefined
  return {
    label: renderTemplateString(cta.label, tokens),
    href: renderTemplateString(cta.href, tokens),
    note: cta.note ? renderTemplateString(cta.note, tokens) : undefined,
  }
}

const renderSections = (sections: SeoSection[] | undefined, tokens: Record<string, string>) => {
  if (!sections?.length) return undefined
  return sections
    .map((section) => ({
      heading: renderTemplateString(section.heading, tokens).trim(),
      markdown: renderTemplateString(section.markdown, tokens).trim(),
    }))
    .filter((section) => section.heading || section.markdown)
}

const renderFaqs = (faqs: SeoFaq[] | undefined, tokens: Record<string, string>) => {
  if (!faqs?.length) return undefined
  return faqs
    .map((faq) => ({
      question: renderTemplateString(faq.question, tokens).trim(),
      answer: renderTemplateString(faq.answer, tokens).trim(),
    }))
    .filter((faq) => faq.question && faq.answer)
}

const renderList = (items: string[] | undefined, tokens: Record<string, string>) => {
  if (!items?.length) return undefined
  return items
    .map((item) => renderTemplateString(item, tokens).trim())
    .filter(Boolean)
}

const resolveRoute = (route: string, tokens: Record<string, string>) => {
  let resolved = route
    .replace(/\{([A-Za-z0-9_-]+)\}/g, (_match, key) => tokens[key] ?? '')
    .replace(/:([A-Za-z0-9_-]+)/g, (_match, key) => tokens[key] ?? '')

  resolved = normalizePath(resolved)

  if (resolved.includes(':/') || /\{.+?\}/.test(resolved) || /:[A-Za-z0-9_-]+/.test(resolved)) {
    return null
  }

  if (resolved.includes('//')) {
    return null
  }

  return resolved
}

const buildTokenMap = (record: ProgrammaticRecord) => {
  const tokens: Record<string, string> = { ...(record.tokens || {}) }
  Object.entries(record).forEach(([key, value]) => {
    if (RESERVED_TOKEN_KEYS.has(key)) return
    if (typeof value === 'string') {
      tokens[key] = value
    }
  })
  tokens.slug = record.slug
  return tokens
}

const resolveLabel = (record: ProgrammaticRecord, title: string, slug: string) =>
  record.label || title || titleCase(slug)

const readGeneratedMarkdownFiles = (generatedDir: string) => {
  if (!fs.existsSync(generatedDir)) return []
  const entries: string[] = []
  const stack = [generatedDir]
  while (stack.length) {
    const current = stack.pop()
    if (!current) continue
    const dirEntries = fs.readdirSync(current, { withFileTypes: true })
    for (const entry of dirEntries) {
      if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
        continue
      }
      if (entry.isFile() && entry.name.endsWith('.md')) {
        entries.push(fullPath)
      }
    }
  }
  return entries
}

const buildProgrammaticPagesFromMarkdown = (config: ResolvedLlmSeoConfig) => {
  const pages: ProgrammaticPageRecord[] = []
  const pageMap = new Map<string, ProgrammaticPageRecord>()
  const files = readGeneratedMarkdownFiles(config.content.generatedDir)

  for (const filePath of files) {
    const markdown = fs.readFileSync(filePath, 'utf8')
    const parsed = parseMarkdownContent(markdown)
    const meta = parsed.meta
    const pathValue = typeof meta.path === 'string' ? meta.path.trim() : ''
    const relative = path
      .relative(config.content.generatedDir, filePath)
      .split(path.sep)
      .join('/')
    const withoutExt = relative.replace(/\.[^.]+$/, '')
    const fallbackPath = withoutExt
      ? `/${withoutExt.split('/').map((segment) => segment.replace(/_/g, '-').toLowerCase()).join('/')}`
      : '/'
    const routePath = pathValue ? normalizePath(pathValue) : normalizePath(fallbackPath)
    const group = normalizeGroup(meta.group as string | undefined)
    const indexable = normalizeBoolean(meta.indexable as string | undefined) ?? true
    const llms = normalizeBoolean(meta.llms as string | undefined)
    const schemaType = normalizeSchemaType(meta.schema as string | undefined || meta['schema-type'] as string | undefined)
    const ogImage = typeof meta['og-image'] === 'string' ? meta['og-image'].trim() : undefined
    const ogType = typeof meta['og-type'] === 'string' ? meta['og-type'].trim() : undefined
    const eyebrow = typeof meta.eyebrow === 'string' ? meta.eyebrow.trim() : undefined
    const publishedAt = typeof meta.published === 'string' ? meta.published.trim() : undefined
    const updatedAt = typeof meta.updated === 'string' ? meta.updated.trim() : undefined
    const tags = Array.isArray(meta.tags)
      ? meta.tags
      : typeof meta.tags === 'string'
        ? meta.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
        : undefined

    const label = parsed.title || normalizePathTitle(routePath)

    const content: SeoPageContent = {
      path: routePath,
      group,
      indexable,
      llms,
      tags,
      markdownPath: buildMarkdownPath(routePath),
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
      breadcrumbs: buildBreadcrumbs(routePath),
    }

    const page: ProgrammaticPageRecord = {
      path: routePath,
      label,
      group,
      indexable,
      publishedAt,
      updatedAt,
      llms,
      templateId: 'generated',
      slug: routePath.split('/').filter(Boolean).pop() || routePath,
      tags,
      content,
    }

    if (!pageMap.has(routePath)) {
      pageMap.set(routePath, page)
      pages.push(page)
    }
  }

  return { pages, pageMap }
}

const readTemplates = (templateDir: string): ProgrammaticTemplate[] => {
  if (!fs.existsSync(templateDir)) return []
  const files = fs
    .readdirSync(templateDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(templateDir, entry.name))

  return files
    .map((filePath) => loadJsonFile<ProgrammaticTemplate>(filePath))
    .filter((template): template is ProgrammaticTemplate => Boolean(template && template.id))
}

const readDataset = (datasetDir: string, template: ProgrammaticTemplate): ProgrammaticRecord[] => {
  const datasetFile = template.dataset || `${template.id}.json`
  const datasetPath = path.join(datasetDir, datasetFile)
  const data = loadJsonFile<ProgrammaticRecord[]>(datasetPath)
  if (!Array.isArray(data)) return []
  return data.filter((record) => record && typeof record.slug === 'string')
}

const buildProgrammaticIndex = (config: ResolvedLlmSeoConfig): ProgrammaticIndex => {
  const templateDir = path.join(config.content.programmaticDir, 'templates')
  const datasetDir = path.join(config.content.programmaticDir, 'datasets')
  const templates = readTemplates(templateDir)
  const pages: ProgrammaticPageRecord[] = []
  const pageMap = new Map<string, ProgrammaticPageRecord>()
  const pagesByTemplate = new Map<string, ProgrammaticPageRecord[]>()

  for (const template of templates) {
    const dataset = readDataset(datasetDir, template)
    const templatePages: ProgrammaticPageRecord[] = []

    for (const record of dataset) {
      const tokens = buildTokenMap(record)
      const routePath = resolveRoute(template.route, tokens)
      if (!routePath) continue

      const title = record.title || renderTemplateString(template.content.title, tokens).trim()
      const heading =
        record.heading ||
        renderTemplateString(template.content.heading || template.content.title, tokens).trim()
      const description = record.description
        ? record.description.trim()
        : renderTemplateString(template.content.description || '', tokens).trim()
      const seoTitle = record.seoTitle
        ? record.seoTitle.trim()
        : renderTemplateString(template.content.seoTitle || '', tokens).trim()
      const seoDescription = record.seoDescription
        ? record.seoDescription.trim()
        : renderTemplateString(template.content.seoDescription || '', tokens).trim()

      const sections = record.sections?.length
        ? record.sections
        : renderSections(template.content.sections, tokens)
      const faqs = record.faqs?.length ? record.faqs : renderFaqs(template.content.faqs, tokens)
      const featureList = record.featureList?.length
        ? record.featureList
        : renderList(template.content.featureList, tokens)

      const page: ProgrammaticPageRecord = {
        path: routePath,
        label: resolveLabel(record, title, record.slug),
        group: template.group || 'content',
        indexable: record.indexable ?? template.indexable ?? true,
        llms: record.llms ?? template.llms,
        publishedAt: record.publishedAt,
        updatedAt: record.updatedAt,
        templateId: template.id,
        slug: record.slug,
        tags: record.tags,
        relatedSlugs: record.relatedSlugs,
        hub: record.hub || template.linking?.hub,
        content: {
          path: routePath,
          group: template.group || 'content',
          indexable: record.indexable ?? template.indexable ?? true,
          llms: record.llms ?? template.llms,
          tags: record.tags,
          markdownPath: buildMarkdownPath(routePath),
          publishedAt: record.publishedAt,
          updatedAt: record.updatedAt,
          eyebrow: record.eyebrow || template.eyebrow,
          title,
          heading: heading || title,
          description: description || undefined,
          seoTitle: seoTitle || undefined,
          seoDescription: seoDescription || undefined,
          ogImage: record.ogImage || template.ogImage,
          ogType: record.ogType || template.ogType,
          schemaType: record.schemaType || template.schemaType,
          cta: record.cta || renderCta(template.cta, tokens),
          faqs: faqs || undefined,
          featureList: featureList || undefined,
          sections,
          breadcrumbs: buildBreadcrumbs(routePath),
        },
      }

      if (pageMap.has(routePath)) {
        throw new Error(`Duplicate programmatic SEO path detected: ${routePath}`)
      }

      pageMap.set(routePath, page)
      pages.push(page)
      templatePages.push(page)
    }

    pagesByTemplate.set(template.id, templatePages)
  }

  for (const template of templates) {
    const templatePages = pagesByTemplate.get(template.id) || []
    const relatedLimit = template.linking?.relatedLimit ?? 6
    const includeHub = template.linking?.includeHubInResources ?? true

    const tagIndex = new Map<string, ProgrammaticPageRecord[]>()
    if (template.linking?.relatedBy === 'tag') {
      for (const page of templatePages) {
        for (const tag of page.tags || []) {
          const list = tagIndex.get(tag) || []
          list.push(page)
          tagIndex.set(tag, list)
        }
      }
    }

    for (const page of templatePages) {
      const relatedLinks: SeoLink[] = []

      if (page.relatedSlugs?.length) {
        for (const slug of page.relatedSlugs) {
          const pathKey = slug.startsWith('/') ? normalizePath(slug) : null
          const related = pathKey
            ? pageMap.get(pathKey)
            : templatePages.find((candidate) => candidate.slug === slug)
          if (related) {
            relatedLinks.push({ label: related.label, href: related.path })
          }
        }
      } else if (template.linking?.relatedBy === 'tag' && page.tags?.length) {
        const scores = new Map<string, number>()
        for (const tag of page.tags) {
          for (const candidate of tagIndex.get(tag) || []) {
            if (candidate.path === page.path) continue
            scores.set(candidate.path, (scores.get(candidate.path) || 0) + 1)
          }
        }
        const sorted = [...scores.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([pathKey]) => pageMap.get(pathKey))
          .filter((candidate): candidate is ProgrammaticPageRecord => Boolean(candidate))
        for (const candidate of sorted.slice(0, relatedLimit)) {
          relatedLinks.push({ label: candidate.label, href: candidate.path })
        }
      }

      if (relatedLinks.length) {
        page.content.relatedLinks = relatedLinks
      }

      if (includeHub && page.hub) {
        page.content.resourceLinks = [page.hub]
      }
    }
  }

  return { templates, pages, pageMap }
}

let cachedIndex: ProgrammaticIndex | null = null

const buildGeneratedIndex = (config: ResolvedLlmSeoConfig) => {
  const templateDir = path.join(config.content.programmaticDir, 'templates')
  const templates = readTemplates(templateDir)
  const generated = buildProgrammaticPagesFromMarkdown(config)
  return {
    templates,
    pages: generated.pages,
    pageMap: generated.pageMap,
  }
}

const getIndex = (config: ResolvedLlmSeoConfig, options?: { refresh?: boolean }) => {
  if (cachedIndex && !options?.refresh) return cachedIndex
  const generated = buildGeneratedIndex(config)
  cachedIndex = generated.pages.length ? generated : buildProgrammaticIndex(config)
  return cachedIndex
}

export const getProgrammaticPageByPath = (config: ResolvedLlmSeoConfig, pathValue: string) => {
  const { pageMap } = getIndex(config)
  const normalized = normalizePath(pathValue)
  return pageMap.get(normalized) || null
}

export const getProgrammaticPagesIndex = (config: ResolvedLlmSeoConfig) => getIndex(config).pages

export const getProgrammaticSeoRoutes = (config: ResolvedLlmSeoConfig): SeoRoute[] =>
  getProgrammaticPagesIndex(config).map((page) => ({
    path: page.path,
    label: page.label,
    group: page.group,
    indexable: page.indexable,
    publishedAt: page.publishedAt,
    updatedAt: page.updatedAt,
    nav: false,
    llms: page.llms,
  }))

export const getProgrammaticRoutePatterns = (config: ResolvedLlmSeoConfig) =>
  getIndex(config).templates.map((template) => ({
    templateId: template.id,
    pattern: normalizePath(template.route).replace(/\{([A-Za-z0-9_-]+)\}/g, ':$1'),
  }))

export type SeoValidationIssue = {
  level: 'warning' | 'error'
  message: string
  path?: string
}

export const validateProgrammaticPages = (config: ResolvedLlmSeoConfig) => {
  const issues: SeoValidationIssue[] = []
  const pages = getProgrammaticPagesIndex(config)
  const titleIndex = new Map<string, string>()
  const descIndex = new Map<string, string>()

  for (const page of pages) {
    const title = (page.content.seoTitle || page.content.title || '').trim().toLowerCase()
    const description = (page.content.seoDescription || page.content.description || '')
      .trim()
      .toLowerCase()

    if (title) {
      const existing = titleIndex.get(title)
      if (existing && existing !== page.path) {
        issues.push({
          level: 'warning',
          message: `Duplicate SEO title between ${existing} and ${page.path}`,
          path: page.path,
        })
      } else {
        titleIndex.set(title, page.path)
      }
    }

    if (description) {
      const existing = descIndex.get(description)
      if (existing && existing !== page.path) {
        issues.push({
          level: 'warning',
          message: `Duplicate SEO description between ${existing} and ${page.path}`,
          path: page.path,
        })
      } else {
        descIndex.set(description, page.path)
      }

      if (description.length < 80) {
        issues.push({
          level: 'warning',
          message: `Short description (${description.length} chars) for ${page.path}`,
          path: page.path,
        })
      }
    } else {
      issues.push({
        level: 'warning',
        message: `Missing description for ${page.path}`,
        path: page.path,
      })
    }

    if (!page.content.title.trim()) {
      issues.push({
        level: 'warning',
        message: `Missing title for ${page.path}`,
        path: page.path,
      })
    }

    if (!page.content.heading.trim()) {
      issues.push({
        level: 'warning',
        message: `Missing heading for ${page.path}`,
        path: page.path,
      })
    }

    if (!page.content.sections?.length && !page.content.featureList?.length && !page.content.faqs) {
      issues.push({
        level: 'warning',
        message: `Thin content risk for ${page.path} (no sections, features, or FAQs)`,
        path: page.path,
      })
    }
  }

  return issues
}

export const buildProgrammaticPagesFromTemplates = (config: ResolvedLlmSeoConfig) =>
  buildProgrammaticIndex(config).pages

export const writeProgrammaticMarkdownFiles = async (config: ResolvedLlmSeoConfig) => {
  const pages = buildProgrammaticPagesFromTemplates(config)
  if (!fs.existsSync(config.content.generatedDir)) {
    fs.mkdirSync(config.content.generatedDir, { recursive: true })
  }

  for (const page of pages) {
    const content = page.content
    const markdown = renderSeoMarkdown(content)
    const outputPath = path.join(
      config.content.generatedDir,
      content.path === '/' ? 'index.md' : `${content.path.slice(1)}.md`
    )
    const outputDir = path.dirname(outputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    fs.writeFileSync(outputPath, markdown, 'utf8')
  }

  return pages.length
}
