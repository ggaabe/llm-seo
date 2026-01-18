#!/usr/bin/env node
import path from 'node:path'
import fs from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { stdin, stdout } from 'node:process'
import readline from 'node:readline/promises'
import { generateSeoArtifacts } from '../core/generation/generate.js'
import type { LlmSeoConfig } from '../core/config.js'

const args = process.argv.slice(2)
const command = args[0] || 'generate'

const hasFlag = (flag: string) => args.includes(flag)

const getArgValue = (flag: string) => {
  const idx = args.indexOf(flag)
  if (idx === -1) return null
  return args[idx + 1] || null
}

const getFlagValue = (flags: string[]) => {
  for (const flag of flags) {
    const value = getArgValue(flag)
    if (value) return value
  }
  return null
}

const resolveTargetDir = () => {
  const dirFlag = getArgValue('--dir')
  if (!dirFlag) return process.cwd()
  return path.isAbsolute(dirFlag) ? dirFlag : path.join(process.cwd(), dirFlag)
}

const loadConfig = async (): Promise<LlmSeoConfig> => {
  const configPath = getArgValue('--config')
  if (!configPath) return {}
  const fullPath = path.isAbsolute(configPath)
    ? configPath
    : path.join(process.cwd(), configPath)
  const mod = await import(pathToFileURL(fullPath).href)
  return (mod.default || mod.config || {}) as LlmSeoConfig
}

const promptPlatform = async () => {
  const flag = getArgValue('--platform')
  if (flag) return flag
  if (!stdout.isTTY || hasFlag('--yes')) return 'express'
  const rl = readline.createInterface({ input: stdin, output: stdout })
  const answer = await rl.question('Platform (express/cloudflare/adonis/astro) [express]: ')
  rl.close()
  const normalized = answer.trim().toLowerCase()
  if (!normalized) return 'express'
  if (['express', 'cloudflare', 'adonis', 'astro'].includes(normalized)) return normalized
  return 'express'
}

const ensureEmptyDir = async (dir: string, force: boolean) => {
  try {
    const entries = await fs.readdir(dir)
    if (entries.length && !force) {
      throw new Error(`Target directory is not empty: ${dir}`)
    }
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      await fs.mkdir(dir, { recursive: true })
      return
    }
    throw error
  }
}

const writeFile = async (root: string, relativePath: string, contents: string) => {
  const targetPath = path.join(root, relativePath)
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, contents, 'utf8')
}

const configTemplate = (projectName: string) => `export default {
  rootDir: process.cwd(),
  baseUrl: 'https://example.com',
  siteName: '${projectName}',
  siteSummary: 'Describe your product in one or two sentences.',
  routes: {
    staticRoutes: [
      { path: '/', label: 'Home', group: 'company', indexable: true, nav: true },
      { path: '/developers', label: 'Developers', group: 'resources', indexable: true },
    ],
  },
  llms: {
    sections: [
      {
        heading: 'Docs',
        links: [{ label: 'Developers', href: 'https://example.com/developers.md' }],
      },
      {
        heading: 'Company',
        links: [{ label: 'About', href: 'https://example.com/about.md' }],
      },
    ],
    articlesPlacement: 'after-docs',
  },
}
`

const packageTemplate = (projectName: string, platform: string) => {
  const scripts: Record<string, string> = {
    build: platform === 'astro' ? 'node scripts/seo.mjs && astro build' : 'node scripts/build.mjs',
  }
  if (platform === 'express') {
    scripts.dev = 'node server.mjs'
    scripts.start = 'node server.mjs'
  }
  if (platform === 'cloudflare') {
    scripts.dev = 'wrangler pages dev public'
  }
  if (platform === 'astro') {
    scripts.dev = 'astro dev'
    scripts.preview = 'astro preview'
  }

  const pkg = {
    name: projectName.toLowerCase().replace(/\s+/g, '-'),
    private: true,
    type: 'module',
    scripts,
    dependencies: {
      'llm-seo': '^0.1.0',
      react: '^18.3.1',
      'react-dom': '^18.3.1',
      ...(platform === 'express' ? { express: '^4.19.2' } : {}),
      ...(platform === 'astro'
        ? {
            astro: '^4.16.0',
            '@astrojs/react': '^3.5.2',
          }
        : {}),
    },
  }

  return `${JSON.stringify(pkg, null, 2)}\n`
}

const buildScriptTemplate = () => `import fs from 'node:fs/promises'
import path from 'node:path'
import React from 'react'
import ReactDOMServer from 'react-dom/server'
import {
  generateSeoArtifacts,
  resolveConfig,
  getMarketingContentIndex,
  getSeoContentIndex,
  renderSeoHtml,
} from 'llm-seo'
import customPages from '../site/custom_pages.mjs'
import { wrapHtml } from '../site/layout.mjs'

const configModule = await import(path.resolve('llm-seo.config.mjs'))
const config = { ...configModule.default, rootDir: process.cwd() }
const resolved = resolveConfig(config)

await generateSeoArtifacts(config)

const marketing = getMarketingContentIndex(resolved, { source: 'filesystem' })
const staticPages = getSeoContentIndex(resolved)

const contentMap = new Map()
marketing.forEach((entry) => contentMap.set(entry.path, entry))
staticPages.forEach((entry) => {
  if (!contentMap.has(entry.path)) contentMap.set(entry.path, entry)
})

const outputDir = resolved.generation.outputDir

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true })
}

const toHtmlPath = (routePath) => {
  if (routePath === '/') return path.join(outputDir, 'index.html')
  return path.join(outputDir, routePath.slice(1), 'index.html')
}

for (const content of contentMap.values()) {
  if (!content.indexable) continue

  const Component = customPages[content.path]
  let body = ''

  if (Component) {
    body = ReactDOMServer.renderToStaticMarkup(React.createElement(Component, { content }))
  } else {
    body = renderSeoHtml(content, { wrapHtml: false })
  }

  const html = wrapHtml({
    title: content.seoTitle || content.title,
    description: content.seoDescription || content.description,
    body,
    markdownPath: content.markdownPath,
  })

  const outputPath = toHtmlPath(content.path)
  await ensureDir(path.dirname(outputPath))
  await fs.writeFile(outputPath, html, 'utf8')
}
`

const serverTemplate = () => [
  "import express from 'express'",
  "import path from 'node:path'",
  "import fs from 'node:fs/promises'",
  "import {",
  "  createExpressMarkdownMiddleware,",
  "  resolveConfig,",
  "  getMarketingContentByPath,",
  "  getSeoContentByPath,",
  "  getProgrammaticPageByPath,",
  "} from 'llm-seo'",
  '',
  'const app = express()',
  "const configModule = await import(path.resolve('llm-seo.config.mjs'))",
  'const config = resolveConfig({ ...configModule.default, rootDir: process.cwd() })',
  '',
  'app.use(',
  '  createExpressMarkdownMiddleware({',
  '    config,',
  '    resolveContent: (pathValue) =>',
  '      getMarketingContentByPath(config, pathValue) ||',
  '      getProgrammaticPageByPath(config, pathValue)?.content ||',
  '      getSeoContentByPath(config, pathValue),',
  '    isIndexable: (pathValue) =>',
  '      Boolean(config.routes.staticRoutes.find((route) => route.path === pathValue && route.indexable)),',
  '  })',
  ')',
  '',
  "app.use(express.static('public'))",
  '',
  "app.get('*', async (req, res) => {",
  "  const reqPath = req.path === '/' ? '/index.html' : req.path + '/index.html'",
  "  const filePath = path.join(process.cwd(), 'public', reqPath)",
  '  try {',
  '    await fs.access(filePath)',
  '    res.sendFile(filePath)',
  '  } catch {',
  "    res.status(404).send('Not found')",
  '  }',
  '})',
  '',
  'const port = process.env.PORT || 3000',
  'app.listen(port, () => {',
  "  console.log('Server running on http://localhost:' + port)",
  '})',
  '',
].join('\\n')

const layoutTemplate = () => [
  'export const wrapHtml = ({ title, description, body, markdownPath }) => {',
  '  const descriptionTag = description',
  "    ? '<meta name=\"description\" content=\"' + description.replace(/\"/g, '&quot;') + '\" />'",
  "    : ''",
  '  const markdownTag = markdownPath',
  "    ? '<link rel=\"alternate\" type=\"text/markdown\" href=\"' + markdownPath + '\" />'",
  "    : ''",
  '',
  '  return [',
  "    '<!doctype html>',",
  "    '<html lang=\"en\">',",
  "    '  <head>',",
  "    '    <meta charset=\"utf-8\" />',",
  "    '    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />',",
  "    '    <title>' + title + '</title>',",
  '    descriptionTag,',
  '    markdownTag,',
  "    '    <link rel=\"stylesheet\" href=\"/styles.css\" />',",
  "    '  </head>',",
  "    '  <body>',",
  "    '    <div id=\"app\">' + body + '</div>',",
  "    '  </body>',",
  "    '</html>',",
  "  ].filter(Boolean).join('\\n')",
  '}',
  '',
].join('\\n')

const customPagesTemplate = () => `import { HomePage } from './pages/home.mjs'
import { DevelopersPage } from './pages/developers.mjs'

export default {
  '/': HomePage,
  '/developers': DevelopersPage,
}
`

const homePageTemplate = () => `import React from 'react'

export const HomePage = ({ content }) =>
  React.createElement(
    'main',
    null,
    React.createElement('h1', null, content.heading || content.title),
    React.createElement('p', null, content.description || 'Welcome to your new site.'),
    React.createElement('a', { href: '/developers' }, 'Developer docs')
  )
`

const developersPageTemplate = () => `import React from 'react'

export const DevelopersPage = ({ content }) =>
  React.createElement(
    'main',
    null,
    React.createElement('h1', null, content.heading || content.title),
    React.createElement('p', null, content.description || 'Add API docs here.'),
    React.createElement('a', { href: '/' }, 'Back home')
  )
`

const stylesTemplate = () => `body {
  font-family: system-ui, -apple-system, sans-serif;
  margin: 0;
  padding: 0;
  background: #f8f8f8;
  color: #1a1a1a;
}

#app {
  max-width: 760px;
  margin: 48px auto;
  background: #fff;
  padding: 32px;
  border-radius: 12px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08);
}

a {
  color: #2563eb;
}
`

const markdownHome = () => `---
title: Home
description: Welcome to your new site.
group: company
nav: true
nav-order: 1
---

# Home
Start editing this markdown file to update the homepage summary.
`

const markdownDevelopers = () => `---
title: Developers
description: API docs and SDKs.
group: resources
---

# Developers
Add integration guides and API docs here.
`

const markdownWelcome = () => `[meta]
seo-description: Mail documents online in minutes.
seotitle: Mail documents online | ExampleCo
cta-label: Send now
cta-href: /start

# Mail documents online
Send documents without a printer.
`

const astroConfigTemplate = () => `import { defineConfig } from 'astro/config'
import react from '@astrojs/react'

export default defineConfig({
  output: 'static',
  integrations: [react()],
})
`

const astroSeoScriptTemplate = () => `import path from 'node:path'
import { generateSeoArtifacts } from 'llm-seo'

const configModule = await import(path.resolve('llm-seo.config.mjs'))
const config = { ...configModule.default, rootDir: process.cwd() }

await generateSeoArtifacts(config)
`

const astroBaseLayoutTemplate = () => `---
const { title, description, markdownPath } = Astro.props
---
<!doctype html>
<html lang=\"en\">
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>{title}</title>
    {description ? <meta name=\"description\" content={description} /> : null}
    {markdownPath ? <link rel=\"alternate\" type=\"text/markdown\" href={markdownPath} /> : null}
    <link rel=\"stylesheet\" href=\"/styles.css\" />
  </head>
  <body>
    <main class=\"page\">
      <slot />
    </main>
  </body>
</html>
`

const astroIndexPageTemplate = () => `---
import Base from '../layouts/Base.astro'
import { SeoContentPage } from 'llm-seo/react'
import { resolveConfig, getSeoContentByPath } from 'llm-seo'

const configModule = await import(new URL('../../llm-seo.config.mjs', import.meta.url))
const config = resolveConfig({ ...configModule.default, rootDir: process.cwd() })
const content = getSeoContentByPath(config, '/')
---
<Base
  title={content?.seoTitle ?? content?.title ?? 'Home'}
  description={content?.seoDescription ?? content?.description}
  markdownPath={content?.markdownPath}
>
  {content ? <SeoContentPage content={content} /> : <p>Missing content.</p>}
</Base>
`

const astroDevelopersPageTemplate = () => `---
import Base from '../layouts/Base.astro'
import { SeoContentPage } from 'llm-seo/react'
import { resolveConfig, getSeoContentByPath } from 'llm-seo'

const configModule = await import(new URL('../../llm-seo.config.mjs', import.meta.url))
const config = resolveConfig({ ...configModule.default, rootDir: process.cwd() })
const content = getSeoContentByPath(config, '/developers')
---
<Base
  title={content?.seoTitle ?? content?.title ?? 'Developers'}
  description={content?.seoDescription ?? content?.description}
  markdownPath={content?.markdownPath}
>
  {content ? <SeoContentPage content={content} /> : <p>Missing content.</p>}
</Base>
`

const astroCatchAllTemplate = () => `---
import Base from '../layouts/Base.astro'
import { SeoContentPage } from 'llm-seo/react'
import {
  resolveConfig,
  getMarketingContentByPath,
  getSeoContentByPath,
  getProgrammaticPageByPath,
  getMarketingRoutes,
  getProgrammaticSeoRoutes,
} from 'llm-seo'

const configModule = await import(new URL('../../llm-seo.config.mjs', import.meta.url))
const config = resolveConfig({ ...configModule.default, rootDir: process.cwd() })

export async function getStaticPaths() {
  const routes = [
    ...config.routes.staticRoutes,
    ...getMarketingRoutes(config),
    ...getProgrammaticSeoRoutes(config),
  ]
  const unique = Array.from(new Set(routes.filter((route) => route.indexable).map((route) => route.path)))
  return unique
    .filter((path) => path !== '/' && path !== '/developers')
    .map((path) => ({
      params: { slug: path.slice(1).split('/') },
      props: { path },
    }))
}

const { path } = Astro.props
const content =
  getMarketingContentByPath(config, path) ||
  getProgrammaticPageByPath(config, path)?.content ||
  getSeoContentByPath(config, path)
---
<Base
  title={content?.seoTitle ?? content?.title ?? 'Page'}
  description={content?.seoDescription ?? content?.description}
  markdownPath={content?.markdownPath}
>
  {content ? <SeoContentPage content={content} /> : <p>Missing content.</p>}
</Base>
`

const astroMiddlewareTemplate = () => `import {
  createAstroMarkdownMiddleware,
  resolveConfig,
  getMarketingContentByPath,
  getSeoContentByPath,
  getProgrammaticPageByPath,
} from 'llm-seo'

const configModule = await import(new URL('../llm-seo.config.mjs', import.meta.url))
const config = resolveConfig({ ...configModule.default, rootDir: process.cwd() })

export const onRequest = createAstroMarkdownMiddleware({
  config,
  resolveContent: (pathValue) =>
    getMarketingContentByPath(config, pathValue) ||
    getProgrammaticPageByPath(config, pathValue)?.content ||
    getSeoContentByPath(config, pathValue),
  isIndexable: (pathValue) => {
    const marketing = getMarketingContentByPath(config, pathValue)
    if (marketing) return marketing.indexable
    const programmatic = getProgrammaticPageByPath(config, pathValue)?.content
    if (programmatic) return programmatic.indexable
    const staticPage = getSeoContentByPath(config, pathValue)
    return Boolean(staticPage?.indexable)
  },
})
`

const programmaticTemplate = () => JSON.stringify(
  {
    id: 'guide',
    route: '/guides/{slug}',
    group: 'content',
    indexable: true,
    llms: true,
    content: {
      title: 'Guide to {{topic}}',
      description: 'Learn {{topic}} with steps.',
      sections: [{ heading: 'Overview', markdown: 'All about {{topic}}.' }],
    },
  },
  null,
  2
)

const programmaticDataset = () => JSON.stringify(
  [
    {
      slug: 'getting-started',
      topic: 'Getting started',
      tags: ['docs'],
    },
  ],
  null,
  2
)

const gitignoreTemplate = () => `node_modules
public
.env
`

const readmeTemplate = (platform: string) => `# ${platform} scaffold

This project was generated by llm-seo.

## Quick start

1. Install dependencies

	npm install

2. Build SEO artifacts + HTML

	npm run build

${platform === 'express' ? '3. Start the server\n\n\tnpm run dev\n' : ''}

${platform.toLowerCase().includes('astro') ? '3. Start the dev server\n\n\tnpm run dev\n' : ''}

${platform.toLowerCase().includes('cloudflare') ? '3. (Optional) Configure Cloudflare cache rules for Accept: text/markdown\n\n\tllm-seo cloudflare:setup --zone-id <zone> --token <token>\n' : ''}

## Notes

- Edit markdown in content/ to update pages.
- Custom HTML pages live in site/pages and map via site/custom_pages.mjs.
- Markdown copies are served at /page.md (or via Accept: text/markdown).
`

const cloudflareMiddlewareTemplate = () => `import { createCloudflareMarkdownMiddleware } from 'llm-seo/adapters/cloudflare'

export const onRequest = createCloudflareMarkdownMiddleware({
  acceptMode: 'redirect',
})
`

const adonisMarkdownMiddlewareTemplate = () => [
  "import {",
  "  createAdonisMarkdownMiddleware,",
  "  resolveConfig,",
  "  getMarketingContentByPath,",
  "  getSeoContentByPath,",
  "  getProgrammaticPageByPath,",
  "} from 'llm-seo'",
  '',
  "const configModule = await import(new URL('../../llm-seo.config.mjs', import.meta.url))",
  'const config = resolveConfig({ ...configModule.default, rootDir: process.cwd() })',
  '',
  'const middleware = createAdonisMarkdownMiddleware({',
  '  config,',
  '  resolveContent: (pathValue) =>',
  '    getMarketingContentByPath(config, pathValue) ||',
  '    getProgrammaticPageByPath(config, pathValue)?.content ||',
  '    getSeoContentByPath(config, pathValue),',
  '  isIndexable: (pathValue) =>',
  '    Boolean(config.routes.staticRoutes.find((route) => route.path === pathValue && route.indexable)),',
  '})',
  '',
  'export default class MarkdownMiddleware {',
  '  async handle(ctx, next) {',
  '    return middleware(ctx, next)',
  '  }',
  '}',
  '',
].join('\\n')

const adonisRoutesTemplate = () => [
  "import router from '@adonisjs/core/services/router'",
  "import {",
  "  resolveConfig,",
  "  getSeoContentByPath,",
  "  getMarketingContentByPath,",
  "  getMarketingRoutes,",
  "  getProgrammaticRoutePatterns,",
  "  getProgrammaticPageByPath,",
  "} from 'llm-seo'",
  '',
  "const configModule = await import(new URL('../llm-seo.config.mjs', import.meta.url))",
  'const config = resolveConfig({ ...configModule.default, rootDir: process.cwd() })',
  '',
  "router.get('/', async ({ inertia, response }) => {",
  "  const content = getSeoContentByPath(config, '/')",
  '  if (!content) return response.notFound()',
  "  return inertia.render('home', { content })",
  '})',
  '',
  "router.get('/developers', async ({ inertia, response }) => {",
  "  const content = getSeoContentByPath(config, '/developers')",
  '  if (!content) return response.notFound()',
  "  return inertia.render('marketing/developers', { content })",
  '})',
  '',
  'getMarketingRoutes(config).forEach((route) => {',
  '  router.get(route.path, async ({ inertia, response }) => {',
  '    const content = getMarketingContentByPath(config, route.path)',
  '    if (!content) return response.notFound()',
  "    return inertia.render('marketing_markdown', { content })",
  '  })',
  '})',
  '',
  'getProgrammaticRoutePatterns(config).forEach((route) => {',
  '  router.get(route.pattern, async ({ inertia, request, response }) => {',
  '    const content = getProgrammaticPageByPath(config, request.url())',
  '    if (!content) return response.notFound()',
  "    return inertia.render('seo_content_page', { content: content.content })",
  '  })',
  '})',
  '',
].join('\\n')

const adonisHomePageTemplate = () => [
  "import { SeoContentPage } from 'llm-seo/react'",
  "import type { PageProps } from '@adonisjs/inertia/types'",
  '',
  'type Props = PageProps & { content: any }',
  '',
  'export default function Home({ content }: Props) {',
  '  return <SeoContentPage content={content} />',
  '}',
  '',
].join('\\n')

const adonisDevelopersPageTemplate = () => [
  "import { SeoContentPage } from 'llm-seo/react'",
  "import type { PageProps } from '@adonisjs/inertia/types'",
  '',
  'type Props = PageProps & { content: any }',
  '',
  'export default function Developers({ content }: Props) {',
  '  return <SeoContentPage content={content} />',
  '}',
  '',
].join('\\n')

const adonisMarketingMarkdownTemplate = () => [
  "import { SeoContentPage } from 'llm-seo/react'",
  "import type { PageProps } from '@adonisjs/inertia/types'",
  '',
  'type Props = PageProps & { content: any }',
  '',
  'export default function MarketingMarkdown({ content }: Props) {',
  '  return <SeoContentPage content={content} />',
  '}',
  '',
].join('\\n')

const adonisSeoContentPageTemplate = () => [
  "import { SeoContentPage } from 'llm-seo/react'",
  "import type { PageProps } from '@adonisjs/inertia/types'",
  '',
  'type Props = PageProps & { content: any }',
  '',
  'export default function SeoContentPageView({ content }: Props) {',
  '  return <SeoContentPage content={content} />',
  '}',
  '',
].join('\\n')

const scaffoldExpress = async (dir: string, projectName: string, force: boolean) => {
  await ensureEmptyDir(dir, force)

  await writeFile(dir, 'package.json', packageTemplate(projectName, 'express'))
  await writeFile(dir, 'llm-seo.config.mjs', configTemplate(projectName))
  await writeFile(dir, 'scripts/build.mjs', buildScriptTemplate())
  await writeFile(dir, 'server.mjs', serverTemplate())
  await writeFile(dir, 'site/layout.mjs', layoutTemplate())
  await writeFile(dir, 'site/custom_pages.mjs', customPagesTemplate())
  await writeFile(dir, 'site/pages/home.mjs', homePageTemplate())
  await writeFile(dir, 'site/pages/developers.mjs', developersPageTemplate())
  await writeFile(dir, 'public/styles.css', stylesTemplate())
  await writeFile(dir, 'content/pages/index.md', markdownHome())
  await writeFile(dir, 'content/pages/developers.md', markdownDevelopers())
  await writeFile(dir, 'content/marketing/welcome.md', markdownWelcome())
  await writeFile(dir, 'content/seo/templates/guide.json', programmaticTemplate())
  await writeFile(dir, 'content/seo/datasets/guide.json', programmaticDataset())
  await writeFile(dir, '.gitignore', gitignoreTemplate())
  await writeFile(dir, 'README.md', readmeTemplate('Express'))
}

const scaffoldCloudflare = async (dir: string, projectName: string, force: boolean) => {
  await ensureEmptyDir(dir, force)

  await writeFile(dir, 'package.json', packageTemplate(projectName, 'cloudflare'))
  await writeFile(dir, 'llm-seo.config.mjs', configTemplate(projectName))
  await writeFile(dir, 'scripts/build.mjs', buildScriptTemplate())
  await writeFile(dir, 'site/layout.mjs', layoutTemplate())
  await writeFile(dir, 'site/custom_pages.mjs', customPagesTemplate())
  await writeFile(dir, 'site/pages/home.mjs', homePageTemplate())
  await writeFile(dir, 'site/pages/developers.mjs', developersPageTemplate())
  await writeFile(dir, 'public/styles.css', stylesTemplate())
  await writeFile(dir, 'functions/_middleware.js', cloudflareMiddlewareTemplate())
  await writeFile(dir, 'content/pages/index.md', markdownHome())
  await writeFile(dir, 'content/pages/developers.md', markdownDevelopers())
  await writeFile(dir, 'content/marketing/welcome.md', markdownWelcome())
  await writeFile(dir, 'content/seo/templates/guide.json', programmaticTemplate())
  await writeFile(dir, 'content/seo/datasets/guide.json', programmaticDataset())
  await writeFile(dir, '.gitignore', gitignoreTemplate())
  await writeFile(dir, 'README.md', readmeTemplate('Cloudflare Pages'))
}

const scaffoldAdonis = async (dir: string, projectName: string, force: boolean) => {
  await ensureEmptyDir(dir, force)

  await writeFile(dir, 'llm-seo.config.mjs', configTemplate(projectName))
  await writeFile(dir, 'content/pages/index.md', markdownHome())
  await writeFile(dir, 'content/pages/developers.md', markdownDevelopers())
  await writeFile(dir, 'content/marketing/welcome.md', markdownWelcome())
  await writeFile(dir, 'content/seo/templates/guide.json', programmaticTemplate())
  await writeFile(dir, 'content/seo/datasets/guide.json', programmaticDataset())
  await writeFile(dir, 'app/middleware/markdown_middleware.ts', adonisMarkdownMiddlewareTemplate())
  await writeFile(dir, 'start/routes.ts', adonisRoutesTemplate())
  await writeFile(dir, 'inertia/pages/home.tsx', adonisHomePageTemplate())
  await writeFile(dir, 'inertia/pages/marketing/developers.tsx', adonisDevelopersPageTemplate())
  await writeFile(dir, 'inertia/pages/marketing_markdown.tsx', adonisMarketingMarkdownTemplate())
  await writeFile(dir, 'inertia/pages/seo_content_page.tsx', adonisSeoContentPageTemplate())
  await writeFile(
    dir,
    'README.md',
    [
      '# Adonis integration scaffold',
      '',
      'This scaffold includes content, routes, and middleware to integrate llm-seo.',
      '',
      'What you get:',
      '- content/ markdown sources (marketing + static + programmatic)',
      '- llm-seo.config.mjs starter config',
      '- start/routes.ts sample wired to llm-seo',
      '- app/middleware/markdown_middleware.ts for Accept: text/markdown',
      '- inertia/pages for home + developers + generic markdown pages',
      '',
      'Next steps:',
      '1. Bootstrap an Adonis app with `npm init adonisjs@latest`.',
      '2. Copy this scaffold into your Adonis project (merge folders).',
      '3. Register MarkdownMiddleware in start/kernel.ts if desired.',
      '4. Run `node ace serve --hmr` and `llm-seo generate` during builds.',
      '',
      'See llm-seo README for detailed Adonis integration.',
      '',
    ].join('\\n')
  )
}

const scaffoldAstro = async (dir: string, projectName: string, force: boolean) => {
  await ensureEmptyDir(dir, force)

  await writeFile(dir, 'package.json', packageTemplate(projectName, 'astro'))
  await writeFile(dir, 'llm-seo.config.mjs', configTemplate(projectName))
  await writeFile(dir, 'astro.config.mjs', astroConfigTemplate())
  await writeFile(dir, 'scripts/seo.mjs', astroSeoScriptTemplate())
  await writeFile(dir, 'functions/_middleware.js', cloudflareMiddlewareTemplate())
  await writeFile(dir, 'src/middleware.ts', astroMiddlewareTemplate())
  await writeFile(dir, 'src/layouts/Base.astro', astroBaseLayoutTemplate())
  await writeFile(dir, 'src/pages/index.astro', astroIndexPageTemplate())
  await writeFile(dir, 'src/pages/developers.astro', astroDevelopersPageTemplate())
  await writeFile(dir, 'src/pages/[...slug].astro', astroCatchAllTemplate())
  await writeFile(dir, 'public/styles.css', stylesTemplate())
  await writeFile(dir, 'content/pages/index.md', markdownHome())
  await writeFile(dir, 'content/pages/developers.md', markdownDevelopers())
  await writeFile(dir, 'content/marketing/welcome.md', markdownWelcome())
  await writeFile(dir, 'content/seo/templates/guide.json', programmaticTemplate())
  await writeFile(dir, 'content/seo/datasets/guide.json', programmaticDataset())
  await writeFile(dir, '.gitignore', gitignoreTemplate())
  await writeFile(dir, 'README.md', readmeTemplate('Astro'))
}

const run = async () => {
  if (command === 'cloudflare:setup' || command === 'cf:setup') {
    const dryRun = hasFlag('--dry-run')
    const token =
      getFlagValue(['--token', '--api-token']) ||
      process.env.CF_API_TOKEN ||
      process.env.CLOUDFLARE_API_TOKEN
    const zoneId =
      getFlagValue(['--zone-id', '--zone']) || process.env.CF_ZONE_ID
    const extension = getFlagValue(['--extension']) || '.md'
    const apiBase = process.env.CF_API_BASE || 'https://api.cloudflare.com/client/v4'
    const rulesetName = getFlagValue(['--name']) || 'llm-seo markdown rewrite'

    const rules = [
      {
        ref: 'llm-seo-markdown-root',
        description: 'Rewrite / to /index.md when Accept: text/markdown is present',
        enabled: true,
        action: 'rewrite',
        expression:
          'http.request.headers["accept"][*] contains "text/markdown" and http.request.uri.path == "/"',
        action_parameters: {
          uri: {
            path: { value: `/index${extension}` },
          },
        },
      },
      {
        ref: 'llm-seo-markdown-append',
        description: `Append ${extension} when Accept: text/markdown is present`,
        enabled: true,
        action: 'rewrite',
        expression:
          'http.request.headers["accept"][*] contains "text/markdown" and not ends_with(http.request.uri.path, ".md") and http.request.uri.path != "/"',
        action_parameters: {
          uri: {
            path: { expression: `concat(http.request.uri.path, "${extension}")` },
          },
        },
      },
    ]

    if (dryRun) {
      console.log(
        JSON.stringify(
          {
            apiBase,
            zoneId,
            rulesetName,
            rules,
          },
          null,
          2
        )
      )
      return
    }

    if (!token || !zoneId) {
      throw new Error(
        'Missing Cloudflare credentials. Provide --token and --zone-id (or set CF_API_TOKEN and CF_ZONE_ID).'
      )
    }

    type CloudflareApiResponse = {
      success?: boolean
      errors?: Array<{ message?: string; code?: number }>
      result?: any
    }

    const fetchJson = async (url: string, options: any): Promise<CloudflareApiResponse> => {
      const response = await fetch(url, options)
      const data = (await response.json().catch(() => ({}))) as CloudflareApiResponse
      if (!response.ok || data.success === false) {
        const errors = Array.isArray(data.errors) && data.errors.length
          ? `: ${JSON.stringify(data.errors)}`
          : ''
        throw new Error(`Cloudflare API error (${response.status})${errors}`)
      }
      return data
    }

    const entrypoint = await fetchJson(
      `${apiBase}/zones/${zoneId}/rulesets/phases/http_request_transform/entrypoint`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const ruleset = entrypoint.result as {
      id?: string
      kind?: string
      phase?: string
      rules?: any[]
    } | undefined
    if (!ruleset?.id) {
      throw new Error('Could not find Cloudflare transform ruleset entrypoint.')
    }

    const existingRules = Array.isArray(ruleset.rules) ? ruleset.rules : []
    const filteredRules = existingRules.filter(
      (rule: any) =>
        rule?.ref !== 'llm-seo-markdown-root' && rule?.ref !== 'llm-seo-markdown-append'
    )
    const updatedRules = [...filteredRules, ...rules]

    await fetchJson(`${apiBase}/zones/${zoneId}/rulesets/${ruleset.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: rulesetName,
        kind: ruleset.kind || 'zone',
        phase: ruleset.phase || 'http_request_transform',
        rules: updatedRules,
      }),
    })

    console.log('Cloudflare transform rules updated for markdown redirects.')
    return
  }

  if (command === 'generate') {
    const config = await loadConfig()
    const result = await generateSeoArtifacts(config)
    const strict = args.includes('--strict') || process.env.SEO_STRICT === 'true'

    result.programmaticIssues.forEach((issue) => {
      const prefix = issue.level === 'error' ? 'ERROR' : 'WARN'
      console.error(`[${prefix}] ${issue.message}`)
    })

    if (strict && result.programmaticIssues.some((issue) => issue.level === 'error')) {
      throw new Error('SEO validation failed; fix programmatic content issues.')
    }

    console.log(`Generated sitemap at ${result.sitemapPath}`)
    console.log(`Generated robots.txt at ${result.robotsPath}`)
    console.log(`Generated sitemap.md at ${result.sitemapMdPath}`)
    console.log(`Generated llms.txt at ${result.llmsPath}`)
    console.log(`Generated marketing content cache at ${result.marketingContentPath}`)
    console.log(`Generated SEO content cache at ${result.seoContentPath}`)
    console.log(`Generated programmatic markdown files: ${result.programmaticMarkdownCount}`)
    console.log(`Generated public markdown files: ${result.markdownOutputCount}`)
    return
  }

  if (command === 'init') {
    const targetDir = resolveTargetDir()
    const projectName = path.basename(targetDir)
    const configPath = path.join(targetDir, 'llm-seo.config.mjs')
    const force = hasFlag('--force')

    try {
      await fs.access(configPath)
      if (!force) {
        throw new Error('llm-seo.config.mjs already exists. Use --force to overwrite.')
      }
    } catch (error: any) {
      if (error?.code !== 'ENOENT' && !force) {
        throw error
      }
    }

    await writeFile(targetDir, 'llm-seo.config.mjs', configTemplate(projectName))
    console.log(`Created ${configPath}`)
    return
  }

  if (command === 'scaffold') {
    const targetDir = resolveTargetDir()
    const platform = await promptPlatform()
    const projectName = path.basename(targetDir)
    const force = hasFlag('--force')

    if (platform === 'cloudflare') {
      await scaffoldCloudflare(targetDir, projectName, force)
    } else if (platform === 'adonis') {
      await scaffoldAdonis(targetDir, projectName, force)
    } else if (platform === 'astro') {
      await scaffoldAstro(targetDir, projectName, force)
    } else {
      await scaffoldExpress(targetDir, projectName, force)
    }

    console.log(`Scaffolded ${platform} project at ${targetDir}`)
    return
  }

  console.error(
    'Usage: llm-seo generate|init|scaffold|cloudflare:setup [--config path] [--dir path] [--platform express|cloudflare|adonis|astro] [--force]'
  )
  process.exit(1)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
