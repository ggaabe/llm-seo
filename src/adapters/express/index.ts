import { resolveConfig, type LlmSeoConfig } from '../../core/config.js'
import { maybeRenderMarkdown } from '../../core/markdown/delivery.js'
import type { SeoPageContent } from '../../core/types.js'

export type ExpressRequestLike = {
  method: string
  url: string
  headers: Record<string, string | string[] | undefined>
  query?: Record<string, string | undefined>
}

export type ExpressResponseLike = {
  status(code: number): ExpressResponseLike
  setHeader(name: string, value: string): void
  send(body: string): void
}

export const createExpressMarkdownMiddleware = (options: {
  config: LlmSeoConfig
  resolveContent: (pathValue: string) => SeoPageContent | null
  isIndexable: (pathValue: string) => boolean
}) => {
  const resolvedConfig = resolveConfig(options.config)

  return (req: ExpressRequestLike, res: ExpressResponseLike, next: () => void) => {
    if (!['GET', 'HEAD'].includes(req.method.toUpperCase())) {
      next()
      return
    }

    const acceptHeader = Array.isArray(req.headers.accept) ? req.headers.accept.join(',') : req.headers.accept
    const response = maybeRenderMarkdown(
      resolvedConfig,
      {
        url: req.url,
        headers: { accept: typeof acceptHeader === 'string' ? acceptHeader : undefined },
        query: req.query,
      },
      {
        isIndexable: options.isIndexable,
        resolveContent: options.resolveContent,
      }
    )

    if (!response) {
      next()
      return
    }

    Object.entries(response.headers).forEach(([key, value]) => {
      res.setHeader(key, value)
    })
    res.status(response.status)
    res.send(response.body)
  }
}
