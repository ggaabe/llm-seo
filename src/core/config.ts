import path from 'node:path'
import type { SeoRoute, SeoPageContent } from './types.js'

export type ArticlesPlacement =
  | 'after-docs'
  | 'after-product'
  | 'after-company'
  | 'before-legal'
  | 'end'
  | 'omit'

export type LlmsSection = {
  heading: string
  links: Array<{ label: string; href: string }>
  description?: string[]
}

export type LlmsConfig = {
  title?: string
  summary?: string
  contact?: string
  capabilities?: string[]
  sections?: LlmsSection[]
  articlesPlacement?: ArticlesPlacement
  include?: (page: SeoPageContent) => boolean
  template?: string
}

export type LlmSeoConfig = {
  rootDir?: string
  baseUrl?: string
  siteName?: string
  siteSummary?: string
  contact?: string
  capabilities?: string[]
  content?: {
    marketingDir?: string
    pagesDir?: string
    programmaticDir?: string
    generatedDir?: string
  }
  routes?: {
    staticRoutes?: SeoRoute[]
    noindexPaths?: string[]
    marketingRoutePrefix?: string
  }
  llms?: LlmsConfig
  markdown?: {
    enableAcceptNegotiation?: boolean
    enableQueryParam?: boolean
    extension?: string
  }
  generation?: {
    outputDir?: string
    contentCacheDir?: string
    generatePublicMarkdown?: boolean
    generateProgrammaticMarkdown?: boolean
    publicMarkdownFromProgrammatic?: boolean
    useGitDates?: boolean
  }
}

export type ResolvedLlmSeoConfig = {
  rootDir: string
  baseUrl?: string
  siteName?: string
  siteSummary?: string
  contact?: string
  capabilities?: string[]
  content: {
    marketingDir: string
    pagesDir: string
    programmaticDir: string
    generatedDir: string
  }
  routes: {
    staticRoutes: SeoRoute[]
    noindexPaths: string[]
    marketingRoutePrefix: string
  }
  llms: LlmsConfig
  markdown: {
    enableAcceptNegotiation: boolean
    enableQueryParam: boolean
    extension: string
  }
  generation: {
    outputDir: string
    contentCacheDir: string
    generatePublicMarkdown: boolean
    generateProgrammaticMarkdown: boolean
    publicMarkdownFromProgrammatic: boolean
    useGitDates: boolean
  }
}

export const resolveConfig = (config: LlmSeoConfig = {}): ResolvedLlmSeoConfig => {
  const rootDir = config.rootDir || process.cwd()
  const contentDir = (dir: string) => path.isAbsolute(dir) ? dir : path.join(rootDir, dir)

  const marketingDir = contentDir(config.content?.marketingDir || path.join('content', 'marketing'))
  const pagesDir = contentDir(config.content?.pagesDir || path.join('content', 'pages'))
  const programmaticDir = contentDir(
    config.content?.programmaticDir || path.join('content', 'seo')
  )
  const generatedDir = contentDir(
    config.content?.generatedDir || path.join('content', 'seo', 'generated')
  )

  const outputDir = contentDir(config.generation?.outputDir || 'public')
  const contentCacheDir = contentDir(config.generation?.contentCacheDir || 'config')

  return {
    rootDir,
    baseUrl: config.baseUrl,
    siteName: config.siteName,
    siteSummary: config.siteSummary,
    contact: config.contact,
    capabilities: config.capabilities,
    content: {
      marketingDir,
      pagesDir,
      programmaticDir,
      generatedDir,
    },
    routes: {
      staticRoutes: config.routes?.staticRoutes || [],
      noindexPaths: config.routes?.noindexPaths || [],
      marketingRoutePrefix: config.routes?.marketingRoutePrefix || '/marketing',
    },
    llms: {
      ...(config.llms || {}),
    },
    markdown: {
      enableAcceptNegotiation: config.markdown?.enableAcceptNegotiation ?? true,
      enableQueryParam: config.markdown?.enableQueryParam ?? true,
      extension: config.markdown?.extension || '.md',
    },
    generation: {
      outputDir,
      contentCacheDir,
      generatePublicMarkdown: config.generation?.generatePublicMarkdown ?? true,
      generateProgrammaticMarkdown: config.generation?.generateProgrammaticMarkdown ?? true,
      publicMarkdownFromProgrammatic:
        config.generation?.publicMarkdownFromProgrammatic ?? false,
      useGitDates: config.generation?.useGitDates ?? true,
    },
  }
}
