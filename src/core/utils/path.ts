const TITLE_CASE_UPPER = new Set(['pdf', 'usps', 'usa', 'ai', 'api', 'mcp', 'llm', 'llms', 'id'])

export const toPosixPath = (value: string) => value.split(/\\/g).join('/')

export const stripExtension = (value: string) => value.replace(/\.[^.]+$/, '')

export const isIgnoredSegment = (segment: string) => segment.startsWith('_') || segment.startsWith('.')

export const isMarkdownFile = (fileName: string) =>
  fileName.endsWith('.md') && fileName.toLowerCase() !== 'readme.md'

export const slugifySegment = (segment: string) =>
  segment.replace(/_/g, '-').replace(/\s+/g, '-').toLowerCase()

export const normalizePath = (value: string) => {
  if (!value) return '/'
  const withoutQuery = value.split('?')[0] || ''
  let normalized = withoutQuery.trim()
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`
  }
  normalized = normalized.replace(/\/+/g, '/')
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.replace(/\/+$/, '')
  }
  return normalized || '/'
}

export const titleCase = (value: string) => {
  const cleaned = value.replace(/[-_]+/g, ' ').trim()
  if (!cleaned) return ''
  return cleaned
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase()
      if (TITLE_CASE_UPPER.has(lower)) {
        return lower.toUpperCase()
      }
      return `${lower.slice(0, 1).toUpperCase()}${lower.slice(1)}`
    })
    .join(' ')
}

export const buildMarkdownPath = (pathValue: string) => (pathValue === '/' ? '/index.md' : `${pathValue}.md`)
