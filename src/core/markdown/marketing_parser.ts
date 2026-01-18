import type { SeoCta, SeoFaq, SeoLink, SeoPricing, SeoSection, SeoStep, SeoTrust } from '../types.js'
import {
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
} from './shared.js'

export type ParsedMarketingMarkdown = {
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

export const parseMarketingMarkdown = (markdown: string): ParsedMarketingMarkdown => {
  const metaSource = parseMetaBlock(markdown)
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
    if (['faqs', 'faq'].includes(normalized)) {
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
    if (['features', 'feature list', 'feature-list'].includes(normalized)) {
      featureList = parseFeatureList(section)
      continue
    }
    if (['ready to send it?', 'ready to send', 'next step', 'next steps', 'cta'].includes(normalized)) {
      const parsed = parseCta(section)
      if (parsed) cta = parsed
      continue
    }

    if (section.raw.trim()) {
      extraSections.push({ heading: section.heading, markdown: section.raw.trim() })
    }
  }

  const metaTitle = meta.title ? stripMarkdown(String(meta.title)) : ''
  const metaHeading = meta.heading ? stripMarkdown(String(meta.heading)) : ''
  const metaDescription = meta.description ? stripMarkdown(String(meta.description)) : ''
  const rawSeoTitle = meta.seotitle || meta['seo-title']
  const metaSeoTitle = rawSeoTitle ? stripMarkdown(String(rawSeoTitle)) : ''
  const metaCtaLabel = meta['cta-label'] ? stripMarkdown(String(meta['cta-label'])) : ''
  const metaCtaHref = meta['cta-href'] ? String(meta['cta-href']).trim() : ''
  const metaCtaNote = meta['cta-note'] ? stripMarkdown(String(meta['cta-note'])) : ''

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
    seoDescription: meta['seo-description'] ? stripMarkdown(String(meta['seo-description'])) : undefined,
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
