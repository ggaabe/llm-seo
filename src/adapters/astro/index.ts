import { resolveConfig, type LlmSeoConfig } from '../../core/config.js'
import { maybeRenderMarkdown } from '../../core/markdown/delivery.js'
import type { SeoPageContent } from '../../core/types.js'

export type AstroContextLike = {
  request: Request
  url?: URL
}

export const createAstroMarkdownMiddleware = (options: {
  config: LlmSeoConfig
  resolveContent: (pathValue: string) => SeoPageContent | null
  isIndexable: (pathValue: string) => boolean
}) => {
  const resolvedConfig = resolveConfig(options.config)

  return async (context: AstroContextLike, next: () => Promise<Response>) => {
    const method = context.request.method || 'GET'
    if (method !== 'GET' && method !== 'HEAD') {
      return next()
    }

    const url = context.url || new URL(context.request.url)
    const requestUrl = `${url.pathname}${url.search}`

    const response = maybeRenderMarkdown(
      resolvedConfig,
      {
        url: requestUrl,
        headers: { accept: context.request.headers.get('accept') || undefined },
        query: Object.fromEntries(url.searchParams.entries()),
      },
      {
        isIndexable: options.isIndexable,
        resolveContent: options.resolveContent,
      }
    )

    if (!response) {
      return next()
    }

    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    })
  }
}
