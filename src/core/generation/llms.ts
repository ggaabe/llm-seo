import type { ResolvedLlmSeoConfig } from '../config.js'
import type { SeoPageContent } from '../types.js'

export type LlmsArticleLink = { label: string; href: string }

const buildMarkdownLink = (label: string, href: string) => `- [${label}](${href})`

const defaultFooter = 'Human-friendly pages are the same paths without .md.'

const buildSectionLines = (heading: string, lines: string[]) => {
  if (!lines.length) return []
  return [`## ${heading}`, ...lines, '']
}

const findSectionIndex = (sections: { heading: string }[], keyword: string) =>
  sections.findIndex((section) => section.heading.toLowerCase().includes(keyword))

const resolveArticlesInsertIndex = (
  sections: { heading: string }[],
  placement: string
) => {
  if (!sections.length) return 0

  switch (placement) {
    case 'after-docs': {
      const idx = findSectionIndex(sections, 'doc')
      return idx === -1 ? sections.length : idx + 1
    }
    case 'after-product': {
      const idx = findSectionIndex(sections, 'product')
      return idx === -1 ? sections.length : idx + 1
    }
    case 'after-company': {
      const idx = findSectionIndex(sections, 'company')
      return idx === -1 ? sections.length : idx + 1
    }
    case 'before-legal': {
      const idx = findSectionIndex(sections, 'legal')
      return idx === -1 ? sections.length : idx
    }
    case 'end':
    default:
      return sections.length
  }
}

export const buildLlmsTxt = (options: {
  config: ResolvedLlmSeoConfig
  baseUrl: string
  articleLinks: LlmsArticleLink[]
  pages?: SeoPageContent[]
}) => {
  const { config, baseUrl, articleLinks } = options
  const llms = config.llms
  const title = llms.title || config.siteName || 'Site'
  const summary = llms.summary || config.siteSummary
  const contact = llms.contact || config.contact
  const capabilities = llms.capabilities || config.capabilities
  const sections = llms.sections || []
  const articlesPlacement = llms.articlesPlacement || 'after-company'

  const lines: string[] = []

  lines.push(`# ${title}`)
  if (summary) {
    lines.push(`> ${summary}`)
  }
  lines.push('')

  if (contact) {
    lines.push(`Contact: ${contact}.`)
    lines.push('')
  }

  if (capabilities?.length) {
    lines.push('## Capabilities')
    capabilities.forEach((capability) => {
      lines.push(`- ${capability}`)
    })
    lines.push('')
  }

  const sectionBlocks = sections.map((section) => {
    const blockLines: string[] = []
    if (section.description?.length) {
      blockLines.push(...section.description)
    }
    section.links.forEach((link) => {
      blockLines.push(buildMarkdownLink(link.label, link.href))
    })
    return {
      heading: section.heading,
      lines: buildSectionLines(section.heading, blockLines),
    }
  })

  const articlesLines = buildSectionLines(
    'Articles',
    articleLinks.length
      ? articleLinks.map((link) => buildMarkdownLink(link.label, link.href))
      : ['- (No articles listed)']
  )

  const orderedSections: string[] = []

  if (articlesPlacement !== 'omit') {
    const insertIndex = resolveArticlesInsertIndex(sectionBlocks, articlesPlacement)
    sectionBlocks.forEach((section, index) => {
      if (index === insertIndex) {
        orderedSections.push(...articlesLines)
      }
      orderedSections.push(...section.lines)
    })
    if (insertIndex >= sectionBlocks.length) {
      orderedSections.push(...articlesLines)
    }
  } else {
    sectionBlocks.forEach((section) => {
      orderedSections.push(...section.lines)
    })
  }

  lines.push(...orderedSections)

  if (llms.template) {
    const template = llms.template
    return template
      .replace(/\{\{\s*siteName\s*\}\}/g, title)
      .replace(/\{\{\s*summary\s*\}\}/g, summary || '')
      .replace(/\{\{\s*contact\s*\}\}/g, contact || '')
      .replace(/\{\{\s*articles\s*\}\}/g, articlesLines.join('\n'))
      .replace(/\{\{\s*sections\s*\}\}/g, orderedSections.join('\n'))
      .replace(/\{\{\s*baseUrl\s*\}\}/g, baseUrl)
      .trim()
      .concat('\n')
  }

  if (llms.sections?.length || articlesPlacement !== 'omit') {
    lines.push(defaultFooter)
  }

  return `${lines.join('\n').trim()}\n`
}
