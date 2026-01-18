import type { SeoPageContent } from '../types.js'
import { buildMarkdownPath, normalizePath } from '../utils/path.js'
import { renderSeoMarkdown } from './renderer.js'
import type { ResolvedLlmSeoConfig } from '../config.js'

const stripMarkdownExtension = (value: string, extension: string) => {
  if (!value.endsWith(extension)) return value
  const stripped = value.slice(0, -extension.length)
  if (!stripped || stripped === '/index') return '/'
  return stripped
}

const isMarkdownAccept = (accept?: string | null) => {
  if (!accept) return false
  return accept.split(',').some((entry) => entry.trim().startsWith('text/markdown'))
}

export const isMarkdownRequest = (
  config: ResolvedLlmSeoConfig,
  request: { url: string; headers?: Record<string, string | undefined>; query?: Record<string, string | undefined> }
) => {
  const url = normalizePath(request.url)
  const accept = request.headers?.accept
  const qs = request.query || {}
  if (url.endsWith(config.markdown.extension)) return true
  if (config.markdown.enableAcceptNegotiation && isMarkdownAccept(accept)) return true
  if (config.markdown.enableQueryParam && qs.format === 'md') return true
  return false
}

export const resolveMarkdownAlternate = (pathValue: string) => buildMarkdownPath(pathValue)

export type MarkdownResponse = {
  status: number
  headers: Record<string, string>
  body: string
}

export type MarkdownResolver = (pathValue: string) => SeoPageContent | null

export const maybeRenderMarkdown = (
  config: ResolvedLlmSeoConfig,
  request: {
    url: string
    headers?: Record<string, string | undefined>
    query?: Record<string, string | undefined>
  },
  options: {
    isIndexable: (pathValue: string) => boolean
    resolveContent: MarkdownResolver
  }
): MarkdownResponse | null => {
  const requestPath = normalizePath(request.url)
  const isMd = requestPath.endsWith(config.markdown.extension)
  const isAccept = isMarkdownAccept(request.headers?.accept)
  const isQuery = request.query?.format === 'md'
  const targetPath = isMd ? stripMarkdownExtension(requestPath, config.markdown.extension) : requestPath

  if (!isMarkdownRequest(config, request)) {
    return null
  }
  if (!options.isIndexable(targetPath)) {
    return null
  }

  const content = options.resolveContent(targetPath)
  if (!content) {
    return null
  }
  const markdownPath = content.markdownPath || buildMarkdownPath(content.path)
  const markdown = renderSeoMarkdown({ ...content, markdownPath })
  const response: MarkdownResponse = {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Vary: 'Accept',
    },
    body: markdown,
  }

  void isAccept
  void isQuery
  return response
}
