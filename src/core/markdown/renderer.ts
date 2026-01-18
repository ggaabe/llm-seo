import type { SeoPageContent, SeoSection, SeoLink } from '../types.js'

const buildFrontMatterLine = (key: string, value: string) => `${key}: ${value}`

const formatList = (items: string[]) => items.map((item) => `- ${item}`).join('\n')

const formatLinks = (items: SeoLink[]) =>
  items.map((item) => `- [${item.label}](${item.href})`).join('\n')

const escapeFrontMatterValue = (value: string) => {
  if (!value) return '""'
  if (/[:\n]/.test(value)) {
    return `"${value.replace(/"/g, '\\"')}"`
  }
  return value
}

const buildFrontMatter = (content: SeoPageContent) => {
  const lines: string[] = []

  lines.push(buildFrontMatterLine('title', escapeFrontMatterValue(content.title)))
  if (content.description) {
    lines.push(buildFrontMatterLine('description', escapeFrontMatterValue(content.description)))
  }
  if (content.seoTitle) {
    lines.push(buildFrontMatterLine('seotitle', escapeFrontMatterValue(content.seoTitle)))
  }
  if (content.seoDescription) {
    lines.push(buildFrontMatterLine('seo-description', escapeFrontMatterValue(content.seoDescription)))
  }
  if (content.group) {
    lines.push(buildFrontMatterLine('group', content.group))
  }
  if (typeof content.indexable === 'boolean') {
    lines.push(buildFrontMatterLine('indexable', content.indexable ? 'true' : 'false'))
  }
  if (typeof content.llms === 'boolean') {
    lines.push(buildFrontMatterLine('llms', content.llms ? 'true' : 'false'))
  }
  if (typeof content.nav === 'boolean') {
    lines.push(buildFrontMatterLine('nav', content.nav ? 'true' : 'false'))
  }
  if (typeof content.navOrder === 'number') {
    lines.push(buildFrontMatterLine('nav-order', String(content.navOrder)))
  }
  if (content.schemaType) {
    lines.push(buildFrontMatterLine('schema', content.schemaType))
  }
  if (content.ogType) {
    lines.push(buildFrontMatterLine('og-type', content.ogType))
  }
  if (content.ogImage) {
    lines.push(buildFrontMatterLine('og-image', escapeFrontMatterValue(content.ogImage)))
  }
  if (content.eyebrow) {
    lines.push(buildFrontMatterLine('eyebrow', escapeFrontMatterValue(content.eyebrow)))
  }
  if (content.publishedAt) {
    lines.push(buildFrontMatterLine('published', content.publishedAt))
  }
  if (content.updatedAt) {
    lines.push(buildFrontMatterLine('updated', content.updatedAt))
  }
  if (content.tags && content.tags.length) {
    lines.push('tags:')
    content.tags.forEach((tag) => {
      lines.push(`  - ${escapeFrontMatterValue(tag)}`)
    })
  }
  if (content.path) {
    lines.push(buildFrontMatterLine('path', escapeFrontMatterValue(content.path)))
  }

  if (!lines.length) return ''
  return ['---', ...lines, '---', ''].join('\n')
}

const buildSection = (heading: string, markdown: string) => {
  if (!markdown.trim()) return ''
  return `## ${heading}\n${markdown.trim()}\n`
}

const buildFeatureList = (items: string[]) => {
  if (!items.length) return ''
  return buildSection('Feature list', formatList(items))
}

const buildFaqs = (faqs: { question: string; answer: string }[]) => {
  if (!faqs.length) return ''
  const items = faqs.map((faq) => `- **${faq.question}** ${faq.answer}`).join('\n')
  return buildSection('FAQs', items)
}

const buildSteps = (steps: { title: string; description: string }[]) => {
  if (!steps.length) return ''
  const items = steps
    .map((step, index) => `${index + 1}. **${step.title}** - ${step.description}`)
    .join('\n')
  return buildSection('How it works', items)
}

const buildPricing = (pricing: { headline: string; detail: string }) => {
  const lines = [pricing.headline, pricing.detail].filter(Boolean).join('\n\n')
  return buildSection('Pricing', lines)
}

const buildTrust = (trust: { title: string; items: { title: string; description: string }[] }) => {
  if (!trust.items?.length) return ''
  const items = trust.items.map((item) => `- **${item.title}** - ${item.description}`).join('\n')
  return buildSection(trust.title, items)
}

const buildSections = (sections: SeoSection[]) =>
  sections.map((section) => buildSection(section.heading, section.markdown)).join('\n')

const buildLinkSection = (heading: string, links?: SeoLink[]) => {
  if (!links?.length) return ''
  return buildSection(heading, formatLinks(links))
}

const buildCta = (cta?: { label: string; href: string; note?: string }) => {
  if (!cta) return ''
  const note = cta.note ? `${cta.note}\n\n` : ''
  return buildSection('Ready to send it?', `${note}[${cta.label}](${cta.href})`)
}

export const renderSeoMarkdown = (content: SeoPageContent) => {
  const frontMatter = buildFrontMatter(content)
  const blocks: string[] = []

  blocks.push(`# ${content.title}`)
  if (content.description) {
    blocks.push(content.description)
  }

  if (content.steps?.length) {
    blocks.push(buildSteps(content.steps))
  }
  if (content.featureList?.length) {
    blocks.push(buildFeatureList(content.featureList))
  }
  if (content.pricing) {
    blocks.push(buildPricing(content.pricing))
  }
  if (content.trust) {
    blocks.push(buildTrust(content.trust))
  }
  if (content.sections?.length) {
    blocks.push(buildSections(content.sections))
  }
  if (content.faqs?.length) {
    blocks.push(buildFaqs(content.faqs))
  }
  if (content.resourceLinks?.length) {
    blocks.push(buildLinkSection('Resources', content.resourceLinks))
  }
  if (content.relatedLinks?.length) {
    blocks.push(buildLinkSection('Related', content.relatedLinks))
  }
  if (content.cta) {
    blocks.push(buildCta(content.cta))
  }

  const body = blocks.filter(Boolean).join('\n\n').trim()
  return `${frontMatter}${body}\n`
}
