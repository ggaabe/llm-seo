import type { SeoCta, SeoFaq, SeoLink, SeoPricing, SeoSection, SeoStep, SeoTrust } from '../types.js'
import {
  parseFrontMatter,
  parseMetaBlock,
  normalizeMeta,
  parseTokensForSummary,
  buildSectionsFromTokens,
  normalizeHeading,
  parseSteps,
  parsePricing,
  parseTrust,
  parseFaqs,
  parseLinks,
  parseFeatureList,
  parseCta,
  stripMarkdown,
  defaultSectionHeading,
} from './shared.js'
import { titleCase } from '../utils/path.js'

export type ParsedMarkdown = {
  meta: Record<string, string | string[]>
  body: string
  title: string
  heading: string
  description: string
  seoTitle?: string
  seoDescription?: string
  steps?: SeoStep[]
  pricing?: SeoPricing
  trust?: SeoTrust
  faqs?: SeoFaq[]
  cta?: SeoCta
  relatedLinks?: SeoLink[]
  resourceLinks?: SeoLink[]
  featureList?: string[]
  extraSections?: SeoSection[]
}

export const parseMarkdownContent = (markdown: string): ParsedMarkdown => {
  const frontMatter = parseFrontMatter(markdown)
  const metaSource = frontMatter.meta && Object.keys(frontMatter.meta).length ? frontMatter : parseMetaBlock(markdown)
  const meta = normalizeMeta(metaSource.meta)
  const body = metaSource.body

  const { tokens, title, heading, description } = parseTokensForSummary(body)

  const sections = buildSectionsFromTokens(tokens)
  const extraSections: SeoSection[] = []
  let steps: SeoStep[] | undefined
  let pricing: SeoPricing | undefined
  let trust: SeoTrust | undefined
  let faqs: SeoFaq[] | undefined
  let cta: SeoCta | undefined
  let relatedLinks: SeoLink[] | undefined
  let resourceLinks: SeoLink[] | undefined
  let featureList: string[] | undefined

  for (const section of sections) {
    const normalized = normalizeHeading(section.heading)
    if (['how it works', 'step-by-step', 'step by step', 'steps'].includes(normalized)) {
      steps = parseSteps(section)
      continue
    }
    if (['pricing'].includes(normalized)) {
      const parsed = parsePricing(section)
      if (parsed) pricing = parsed
      continue
    }
    if (['trust', 'what happens to your document'].includes(normalized)) {
      trust = parseTrust(section)
      continue
    }
    if (['faqs', 'faq', 'pricing faqs', 'delivery faqs'].includes(normalized)) {
      faqs = parseFaqs(section)
      continue
    }
    if (['resources'].includes(normalized)) {
      resourceLinks = parseLinks(section)
      continue
    }
    if (['related', 'related use cases', 'related links'].includes(normalized)) {
      relatedLinks = parseLinks(section)
      continue
    }
    if (['features', 'feature list', 'feature-list', 'what is included', 'what you get'].includes(normalized)) {
      featureList = parseFeatureList(section)
      continue
    }
    if (['ready to send it?', 'ready to send', 'next step', 'next steps', 'cta'].includes(normalized)) {
      const parsed = parseCta(section)
      if (parsed) cta = parsed
      continue
    }

    if (section.raw.trim()) {
      extraSections.push({ heading: defaultSectionHeading(section.heading), markdown: section.raw.trim() })
    }
  }

  const rawSeoTitle = (meta.seotitle as string) || (meta['seo-title'] as string)
  const metaTitle = typeof meta.title === 'string' ? stripMarkdown(meta.title) : ''
  const metaHeading = typeof meta.heading === 'string' ? stripMarkdown(meta.heading) : ''
  const metaDescription = typeof meta.description === 'string' ? stripMarkdown(meta.description) : ''
  const metaSeoTitle = rawSeoTitle ? stripMarkdown(rawSeoTitle) : ''
  const metaCtaLabel = typeof meta['cta-label'] === 'string' ? stripMarkdown(meta['cta-label']) : ''
  const metaCtaHref = typeof meta['cta-href'] === 'string' ? String(meta['cta-href']).trim() : ''
  const metaCtaNote = typeof meta['cta-note'] === 'string' ? stripMarkdown(meta['cta-note']) : ''

  if (!cta && metaCtaLabel && metaCtaHref) {
    cta = {
      label: metaCtaLabel,
      href: metaCtaHref,
      note: metaCtaNote || undefined,
    }
  }

  return {
    meta,
    body,
    title: metaTitle || title,
    heading: metaHeading || heading || metaTitle || title,
    description: metaDescription || description,
    seoTitle: metaSeoTitle || undefined,
    seoDescription: typeof meta['seo-description'] === 'string' ? stripMarkdown(meta['seo-description']) : undefined,
    steps,
    pricing,
    trust,
    faqs,
    cta,
    relatedLinks,
    resourceLinks,
    featureList,
    extraSections: extraSections.length ? extraSections : undefined,
  }
}

export const normalizePathTitle = (pathValue: string) => {
  const segments = pathValue.split('/').filter(Boolean)
  const last = segments[segments.length - 1] || ''
  return titleCase(last)
}
