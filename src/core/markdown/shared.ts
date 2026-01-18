import { marked, type Token, type TokensList } from 'marked'
import type { SeoCta, SeoFaq, SeoLink, SeoPricing, SeoStep, SeoTrust, SeoTrustItem } from '../types.js'
import { titleCase } from '../utils/path.js'

marked.setOptions({
  gfm: true,
  breaks: true,
  mangle: false,
  headerIds: false,
} as any)

export type MetaBlock = Record<string, string | string[]>

export type MarkdownSection = {
  heading: string
  tokens: Token[]
  raw: string
}

export const stripMarkdown = (value: string) =>
  value
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

export const parseTitleDescription = (value: string) => {
  const cleaned = stripMarkdown(value)
  const match = cleaned.match(/^(.+?)\s*(?:-|:)\s+(.+)$/)
  if (match) {
    return { title: match[1].trim(), description: match[2].trim() }
  }
  return { title: cleaned, description: '' }
}

export const parseQuestionAnswer = (value: string) => {
  const cleaned = stripMarkdown(value)
  const boldMatch = value.match(/^\s*\*\*([^*]+)\*\*\s*(.+)$/)
  if (boldMatch) {
    return { question: stripMarkdown(boldMatch[1]), answer: stripMarkdown(boldMatch[2]) }
  }
  const idx = cleaned.indexOf('?')
  if (idx !== -1 && idx < cleaned.length - 1) {
    const question = cleaned.slice(0, idx + 1).trim()
    const answer = cleaned.slice(idx + 1).trim()
    if (question && answer) {
      return { question, answer }
    }
  }
  return null
}

export const extractLinks = (value: string): SeoLink[] => {
  const links: SeoLink[] = []
  const regex = /\[(.+?)\]\((.+?)\)/g
  let match: RegExpExecArray | null = null
  while ((match = regex.exec(value))) {
    links.push({ label: stripMarkdown(match[1]), href: match[2].trim() })
  }
  return links
}

export const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const isHeadingToken = (token: Token): token is Token & { depth: number; text?: string } =>
  token.type === 'heading'

const isParagraphToken = (token: Token): token is Token & { text?: string } =>
  token.type === 'paragraph'

const isListToken = (token: Token): token is Token & { items?: Array<{ text?: string }> } =>
  token.type === 'list'

export const buildSectionsFromTokens = (tokens: TokensList) => {
  const sections: MarkdownSection[] = []
  let current: MarkdownSection | null = null
  for (const token of tokens) {
    if (isHeadingToken(token) && token.depth === 2) {
      if (current) {
        sections.push(current)
      }
      current = {
        heading: token.text ?? '',
        tokens: [],
        raw: '',
      }
      continue
    }
    if (current) {
      current.tokens.push(token)
      current.raw += token.raw ?? ''
    }
  }
  if (current) {
    sections.push(current)
  }
  return sections
}

export const extractParagraphText = (tokens: Token[]) => {
  for (const token of tokens) {
    if (isParagraphToken(token)) {
      return stripMarkdown(token.text ?? '')
    }
  }
  return ''
}

export const extractParagraphs = (tokens: Token[]) =>
  tokens
    .filter((token) => isParagraphToken(token))
    .map((token) => stripMarkdown(token.text ?? ''))
    .filter(Boolean)

export const extractListItems = (tokens: Token[]) => {
  const items: string[] = []
  for (const token of tokens) {
    if (isListToken(token)) {
      for (const item of token.items ?? []) {
        if (item.text) {
          items.push(item.text)
        }
      }
    }
  }
  return items
}

export const parseSteps = (section: MarkdownSection): SeoStep[] =>
  extractListItems(section.tokens)
    .map((item) => parseTitleDescription(item))
    .filter((item) => item.title)
    .map((item) => ({ title: item.title, description: item.description }))

export const parseTrust = (section: MarkdownSection): SeoTrust => {
  const items: SeoTrustItem[] = extractListItems(section.tokens)
    .map((item) => parseTitleDescription(item))
    .filter((item) => item.title)
    .map((item) => ({ title: item.title, description: item.description }))
  return {
    title: section.heading,
    items,
  }
}

export const parseFaqs = (section: MarkdownSection): SeoFaq[] =>
  extractListItems(section.tokens)
    .map((item) => parseQuestionAnswer(item))
    .filter((item): item is SeoFaq => Boolean(item))

export const parseLinks = (section: MarkdownSection): SeoLink[] => extractLinks(section.raw)

export const parseCta = (section: MarkdownSection): SeoCta | null => {
  const links = extractLinks(section.raw)
  if (!links.length) {
    return null
  }
  let note = extractParagraphText(section.tokens)
  if (note && links[0]?.label) {
    const labelPattern = new RegExp(`\\s*${escapeRegExp(links[0].label)}\\s*$`)
    note = note.replace(labelPattern, '').trim()
  }
  return {
    label: links[0].label,
    href: links[0].href,
    note: note || undefined,
  }
}

export const parsePricing = (section: MarkdownSection): SeoPricing | null => {
  const paragraphs = extractParagraphs(section.tokens)
  if (!paragraphs.length) {
    return null
  }
  if (paragraphs.length === 1) {
    return {
      headline: 'Pricing',
      detail: paragraphs[0],
    }
  }
  return {
    headline: paragraphs[0],
    detail: paragraphs[1],
  }
}

export const parseFeatureList = (section: MarkdownSection): string[] =>
  extractListItems(section.tokens).map((item) => stripMarkdown(item))

export const normalizeHeading = (value: string) => value.trim().toLowerCase()

export const parseFrontMatter = (markdown: string) => {
  const lines = markdown.split(/\r?\n/)
  let index = 0
  while (index < lines.length && !lines[index].trim()) {
    index += 1
  }
  if (index >= lines.length || lines[index].trim() !== '---') {
    return { meta: {}, body: markdown }
  }

  index += 1
  const meta: MetaBlock = {}
  let currentListKey: string | null = null

  for (; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim() === '---') {
      index += 1
      break
    }

    const trimmed = line.trim()
    if (!trimmed) {
      currentListKey = null
      continue
    }

    if (currentListKey && trimmed.startsWith('-')) {
      const value = trimmed.replace(/^[-\s]+/, '').trim()
      if (value) {
        const list = (meta[currentListKey] as string[]) || []
        list.push(value)
        meta[currentListKey] = list
      }
      continue
    }

    const match = trimmed.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/)
    if (!match) {
      continue
    }

    const key = match[1].trim().toLowerCase()
    let value = match[2].trim()

    if (!value) {
      currentListKey = key
      meta[key] = []
      continue
    }

    if (value.startsWith('[') && value.endsWith(']')) {
      const items = value
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
      meta[key] = items
      currentListKey = null
      continue
    }

    meta[key] = value
    currentListKey = null
  }

  const body = lines.slice(index).join('\n')
  return { meta, body }
}

export const parseMetaBlock = (markdown: string): { meta: MetaBlock; body: string } => {
  const lines = markdown.split(/\r?\n/)
  let index = 0
  while (index < lines.length && !lines[index].trim()) {
    index += 1
  }
  if (index >= lines.length || lines[index].trim().toLowerCase() !== '[meta]') {
    return { meta: {}, body: markdown }
  }
  index += 1
  const meta: MetaBlock = {}
  let bodyStart = index
  for (; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line.trim()) {
      bodyStart = index + 1
      break
    }
    const match = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.+)\s*$/)
    if (!match) {
      bodyStart = index
      break
    }
    meta[match[1].trim().toLowerCase()] = match[2].trim()
    bodyStart = index + 1
  }
  const body = lines.slice(bodyStart).join('\n')
  return { meta, body }
}

export const normalizeMeta = (meta: MetaBlock) => {
  const normalized: MetaBlock = {}
  Object.entries(meta).forEach(([key, value]) => {
    normalized[key.trim().toLowerCase()] = value
  })
  return normalized
}

export const defaultSectionHeading = (heading: string) => heading || titleCase(heading)

export const parseTokensForSummary = (body: string) => {
  const tokens = marked.lexer(body)
  let title = ''
  let heading = ''
  let description = ''
  let seenH1 = false

  for (const token of tokens) {
    if (token.type === 'heading' && token.depth === 1) {
      if (!title) {
        title = stripMarkdown(token.text ?? '')
        heading = title
        seenH1 = true
      }
      continue
    }
    if (seenH1 && !description && token.type === 'paragraph') {
      description = stripMarkdown(token.text ?? '')
    }
  }

  return { tokens, title, heading, description }
}
