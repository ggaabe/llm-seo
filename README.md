# llm-seo

Reusable SEO + markdown delivery tooling extracted from the PostalForm workflow. This package keeps markdown as the source of truth, produces SEO artifacts (`sitemap.xml`, `robots.txt`, `llms.txt`), and supports markdown content negotiation (`.md`, `Accept: text/markdown`, `?format=md`).

It also ships React components for pre-built HTML rendering so you can statically render content the same way the app does.

## What’s included

- **Parsers** for marketing `[meta]` markdown and YAML front matter pages.
- **Programmatic SEO** templates + datasets -> generated markdown pages.
- **Content registry** for static + programmatic pages.
- **Artifact generation** (`sitemap.xml`, `robots.txt`, `sitemap.md`, `llms.txt`, public `.md` files).
- **Runtime adapters** (Express, Adonis) for markdown negotiation.
- **Cloudflare Pages middleware** for `Accept: text/markdown` support.
- **Astro middleware + scaffold** for static sites.
- **React pre-build renderer** for static HTML output with configurable styling.

## Content structure

### Marketing content
`content/marketing/**/*.md` using a `[meta]` block at the top:

```md
[meta]
seo-description: Mail documents online in minutes.
seotitle: Mail documents online | ExampleCo
cta-label: Send now
cta-href: /start
published: 2024-01-01
updated: 2024-01-05

# Mail documents online
Send documents without a printer.
```

### Static pages
`content/pages/**/*.md` using YAML front matter:

```md
---
title: Developers
description: API docs and SDKs.
group: resources
---

# Developers
Build with our API.
```

### Programmatic SEO
- Templates: `content/seo/templates/*.json`
- Datasets: `content/seo/datasets/*.json`
- Generated: `content/seo/generated/**/*.md`

## Build-time generation

```ts
import { generateSeoArtifacts } from 'llm-seo'

await generateSeoArtifacts({
  rootDir: process.cwd(),
  baseUrl: 'https://example.com',
  siteName: 'ExampleCo',
  siteSummary: 'Example summary',
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
    ],
    articlesPlacement: 'after-docs',
  },
})
```

Artifacts produced under `public/`:
- `sitemap.xml`, `robots.txt`, `sitemap.md`
- `llms.txt`
- `**/*.md` public markdown copies

Caches produced under `config/`:
- `marketing_routes.json`
- `marketing_content.json`
- `seo_content.json`

## CLI usage

Create a config file (example `llm-seo.config.mjs`):

```js
export default {
  rootDir: process.cwd(),
  baseUrl: 'https://example.com',
  siteName: 'ExampleCo',
  siteSummary: 'Example summary',
  routes: {
    staticRoutes: [
      { path: '/', label: 'Home', group: 'company', indexable: true, nav: true },
      { path: '/developers', label: 'Developers', group: 'resources', indexable: true },
    ],
  },
}
```

Run:

```bash
llm-seo generate --config llm-seo.config.mjs
```

Use `--strict` to fail on programmatic SEO validation errors.

### CLI init

Create a starter config file in the current directory:

```bash
llm-seo init
```

Options:
- `--dir path` write config into a different directory.
- `--force` overwrite if the file already exists.

### CLI scaffold

Scaffold a full site structure with content, build scripts, and optional server/runtime:

```bash
llm-seo scaffold --platform express --dir ./my-site
```

Supported platforms:
- `express` (static HTML + Express server + markdown middleware)
- `cloudflare` (static HTML + Pages Functions middleware)
- `adonis` (content + config scaffold with integration notes)
- `astro` (Astro + React + markdown middleware)

Options:
- `--dir path` target directory
- `--platform express|cloudflare|adonis`
- `--force` overwrite files in a non-empty directory
- `--yes` skip prompts (defaults to express)

### CLI cloudflare:setup

Create Cloudflare Transform Rules that rewrite `Accept: text/markdown` requests to `/page.md`:

```bash
llm-seo cloudflare:setup --zone-id <ZONE_ID> --token <API_TOKEN>
```

Options:
- `--zone-id` Cloudflare Zone ID (or `CF_ZONE_ID` env var)
- `--token` API token with Rulesets write access (or `CF_API_TOKEN`)
- `--extension` override the markdown extension (default `.md`)
- `--dry-run` print the payload instead of applying

## AdonisJS integration

### 1) Generate artifacts in your build step

```ts
import { generateSeoArtifacts } from 'llm-seo'

await generateSeoArtifacts({
  rootDir: process.cwd(),
  baseUrl: process.env.APP_URL,
  routes: {
    staticRoutes: [
      { path: '/', label: 'Home', group: 'company', indexable: true, nav: true },
      { path: '/developers', label: 'Developers', group: 'resources', indexable: true },
    ],
  },
})
```

### 2) Serve markdown when requested

Use the Adonis adapter to intercept markdown requests:

```ts
import { createAdonisMarkdownMiddleware } from 'llm-seo/adapters/adonis'
import { resolveConfig, getMarketingContentByPath, getSeoContentByPath, getProgrammaticPageByPath } from 'llm-seo'

const config = resolveConfig({
  routes: { staticRoutes: [/* ... */] },
})

const middleware = createAdonisMarkdownMiddleware({
  config,
  resolveContent: (pathValue) =>
    getMarketingContentByPath(config, pathValue) ||
    getProgrammaticPageByPath(config, pathValue)?.content ||
    getSeoContentByPath(config, pathValue),
  isIndexable: (pathValue) =>
    Boolean(
      config.routes.staticRoutes.find((route) => route.path === pathValue && route.indexable)
    ),
})
```

In Adonis, register this middleware for GET/HEAD routes where you want markdown negotiation.

### 3) Custom HTML pages with markdown versions

If you have custom HTML pages (home, developers), keep a matching markdown file in `content/pages/`:

- `/` HTML route uses `content/pages/index.md` for markdown and SEO metadata.
- `/developers` HTML route uses `content/pages/developers.md`.

Then expose the markdown alternate link in your head:

```tsx
<link rel="alternate" type="text/markdown" href="/developers.md" />
```

## Express integration

### 1) Generate artifacts in your build step

```ts
import { generateSeoArtifacts } from 'llm-seo'

await generateSeoArtifacts({
  rootDir: process.cwd(),
  baseUrl: 'https://example.com',
  routes: {
    staticRoutes: [{ path: '/', label: 'Home', group: 'company', indexable: true }],
  },
})
```

### 2) Serve markdown when requested

```ts
import express from 'express'
import { createExpressMarkdownMiddleware } from 'llm-seo/adapters/express'
import {
  resolveConfig,
  getMarketingContentByPath,
  getSeoContentByPath,
  getProgrammaticPageByPath,
} from 'llm-seo'

const app = express()
const config = resolveConfig({
  routes: { staticRoutes: [/* ... */] },
})

app.use(
  createExpressMarkdownMiddleware({
    config,
    resolveContent: (pathValue) =>
      getMarketingContentByPath(config, pathValue) ||
      getProgrammaticPageByPath(config, pathValue)?.content ||
      getSeoContentByPath(config, pathValue),
    isIndexable: (pathValue) =>
      Boolean(config.routes.staticRoutes.find((route) => route.path === pathValue && route.indexable)),
  })
)
```

## Cloudflare Pages integration

### 1) Generate artifacts in CI

Run the generator before deploy to ensure `public/` contains markdown, `llms.txt`, `sitemap.xml`:

```bash
llm-seo generate --config llm-seo.config.mjs
```

### 2) Serve markdown via Pages Functions

```ts
import { createCloudflareMarkdownMiddleware } from 'llm-seo/adapters/cloudflare'

export const onRequest = createCloudflareMarkdownMiddleware({
  acceptMode: 'redirect',
})
```

### 3) Cache key safety

Cloudflare does not reliably vary cache entries on `Accept`. The middleware defaults to **redirecting** header-based markdown requests to `/page.md`, which avoids cache collisions and keeps markdown on distinct URLs.

If you prefer to keep `Accept` negotiation on the same URL, set `acceptMode: 'serve'` and configure cache separation with Transform Rules or Custom Cache Key.

Automated setup for Transform Rules:

```bash
llm-seo cloudflare:setup --zone-id <ZONE_ID> --token <API_TOKEN>
```

See: `src/adapters/cloudflare/cache-key.md`.

## React pre-build rendering

If you want to render static HTML pages ahead of time (e.g., Cloudflare Pages), use the React renderer:

```ts
import { renderSeoHtml } from 'llm-seo/react'

const html = renderSeoHtml(content, {
  styles: {
    title: 'text-4xl font-semibold',
    sectionHeading: 'text-xl mt-6',
  },
  wrapHtml: true,
})
```

### Content styling configuration

Styling is configured via `ContentStyleConfig` class names:

```ts
{
  page,
  header,
  eyebrow,
  title,
  description,
  meta,
  section,
  sectionHeading,
  sectionBody,
  list,
  listItem,
  orderedList,
  orderedListItem,
  link,
  ctaSection,
  ctaLink,
  ctaNote,
  markdown,
}
```

## llms.txt Articles placement

Control where the `## Articles` block appears via:

```ts
llms: {
  articlesPlacement: 'after-docs' | 'after-product' | 'after-company' | 'before-legal' | 'end' | 'omit'
}
```

## Astro integration

### 1) Generate artifacts before `astro build`

```bash
llm-seo generate --config llm-seo.config.mjs
```

### 2) Serve markdown via Astro middleware (server/hybrid)

```ts
import {
  createAstroMarkdownMiddleware,
  resolveConfig,
  getMarketingContentByPath,
  getSeoContentByPath,
  getProgrammaticPageByPath,
} from 'llm-seo'

const configModule = await import('../llm-seo.config.mjs')
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
```

### 3) Static Astro on Cloudflare Pages

If you deploy Astro as **static output**, use Cloudflare Pages Functions to serve markdown. The Astro scaffold includes `functions/_middleware.js` for this.

```js
import { createCloudflareMarkdownMiddleware } from 'llm-seo/adapters/cloudflare'

export const onRequest = createCloudflareMarkdownMiddleware({
  acceptMode: 'redirect',
})
```

### 4) Custom pages + catch‑all

The scaffold includes `src/pages/index.astro`, `src/pages/developers.astro`, and a catch‑all `src/pages/[...slug].astro` that renders markdown content through `SeoContentPage`.

## Tests

```bash
npm --prefix llm-seo test
```
