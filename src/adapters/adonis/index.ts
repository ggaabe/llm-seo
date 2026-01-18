import { resolveConfig, type LlmSeoConfig } from '../../core/config.js'
import { maybeRenderMarkdown } from '../../core/markdown/delivery.js'
import type { SeoPageContent } from '../../core/types.js'

export type AdonisContextLike = {
  request: {
    method(): string
    url(): string
    header(name: string): string | null
    qs(): Record<string, string | undefined>
  }
  response: {
    header(name: string, value: string): void
    status(code: number): void
    send(body: string): void
  }
}

export const createAdonisMarkdownMiddleware = (options: {
  config: LlmSeoConfig
  resolveContent: (pathValue: string) => SeoPageContent | null
  isIndexable: (pathValue: string) => boolean
}) => {
  const resolvedConfig = resolveConfig(options.config)

  return async (ctx: AdonisContextLike, next: () => Promise<void>) => {
    const method = ctx.request.method()
    if (method !== 'GET' && method !== 'HEAD') {
      await next()
      return
    }

    const response = maybeRenderMarkdown(
      resolvedConfig,
      {
        url: ctx.request.url(),
        headers: { accept: ctx.request.header('accept') || undefined },
        query: ctx.request.qs(),
      },
      {
        isIndexable: options.isIndexable,
        resolveContent: options.resolveContent,
      }
    )

    if (!response) {
      await next()
      return
    }

    Object.entries(response.headers).forEach(([key, value]) => {
      ctx.response.header(key, value)
    })
    ctx.response.status(response.status)
    ctx.response.send(response.body)
  }
}
