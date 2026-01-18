export type CloudflareMarkdownOptions = {
  extension?: string
  queryParam?: string | false
  acceptMode?: 'serve' | 'redirect' | 'ignore'
  redirectStatus?: 301 | 302 | 307 | 308
  redirectCacheControl?: string
}

const wantsMarkdown = (accept: string | null) => {
  if (!accept) return false
  return accept.includes('text/markdown')
}

const normalizePath = (pathname: string) =>
  pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname

const resolveMarkdownPath = (pathname: string, extension: string) => {
  const normalized = normalizePath(pathname)
  if (normalized === '/') return `/index${extension}`
  if (!normalized) return `/index${extension}`
  return `${normalized}${extension}`
}

export const createCloudflareMarkdownMiddleware = (options: CloudflareMarkdownOptions = {}) => {
  const extension = options.extension || '.md'
  const queryParam = options.queryParam === undefined ? false : options.queryParam
  const acceptMode = options.acceptMode || 'redirect'
  const redirectStatus = options.redirectStatus || 302
  const redirectCacheControl = options.redirectCacheControl || 'private, no-store'

  return async function onRequest(context: any) {
    const method = context.request.method || 'GET'
    if (method !== 'GET' && method !== 'HEAD') {
      return context.next()
    }

    const accept = context.request.headers.get('accept')
    const url = new URL(context.request.url)
    const hasExtension = url.pathname.endsWith(extension)
    const queryWantsMarkdown = queryParam
      ? url.searchParams.get(queryParam) === 'md'
      : false
    const acceptWantsMarkdown = wantsMarkdown(accept)

    if (hasExtension || acceptWantsMarkdown || queryWantsMarkdown) {
      const markdownPath = hasExtension
        ? url.pathname
        : resolveMarkdownPath(url.pathname, extension)

      if (acceptWantsMarkdown && !hasExtension && !queryWantsMarkdown) {
        if (acceptMode === 'ignore') {
          return context.next()
        }

        if (acceptMode === 'redirect') {
          const redirectUrl = new URL(context.request.url)
          redirectUrl.pathname = markdownPath
          const resp = Response.redirect(redirectUrl.toString(), redirectStatus)
          resp.headers.set('Cache-Control', redirectCacheControl)
          resp.headers.set('Vary', 'Accept')
          return resp
        }
      }

      const mdUrl = new URL(context.request.url)
      mdUrl.pathname = markdownPath
      const mdResp = await context.env.ASSETS.fetch(new Request(mdUrl.toString(), context.request))

      if (mdResp.status !== 404) {
        const resp = new Response(mdResp.body, mdResp)
        resp.headers.set('Content-Type', 'text/markdown; charset=utf-8')
        resp.headers.set('Vary', 'Accept')
        return resp
      }
    }

    return context.next()
  }
}
