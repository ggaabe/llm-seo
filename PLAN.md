# LLM SEO Package Plan

## Goal
Turn the existing SEO + markdown delivery workflow into a reusable package/utility that:
- Preserves the current behavior in this Adonis/Inertia app.
- Can be lifted into a new repo and run on Cloudflare Pages.
- Supports markdown content negotiation (Accept: text/markdown, .md, ?format=md) alongside custom HTML pages.
- Generates SEO artifacts (sitemap.xml, robots.txt, sitemap.md, llms.txt, public markdown copies, content caches).

This plan is based on a deep read of the current implementation (see “Current System Inventory”).

## Current System Inventory (source of truth)
These are the components we must preserve and/or extract:

### Build-time generation
- `commands/seo_generate.ts`
  - Generates `public/sitemap.xml`, `public/robots.txt`, `public/sitemap.md`.
  - Generates `public/llms.txt` via `buildLlmsTxt()` (links to `.md` pages).
  - Writes caches: `config/marketing_routes.json`, `config/marketing_content.json`, `config/seo_content.json`.
  - Writes programmatic SEO markdown into `content/seo/generated/`.
  - Writes public markdown copies to `public/**.md` for indexable content.

### Content parsing
- `app/services/marketing_content.ts`
  - Parses `[meta]` blocks + markdown sections.
  - Extracts title/description, CTA, FAQs, pricing, trust, resources, related links, etc.
  - Produces `MarketingContent` entries with `indexable` + `llms` flags.
- `app/services/seo/markdown_parser.ts`
  - Parses YAML front matter or `[meta]` for static/programmatic pages.
  - Maps sections to `steps`, `pricing`, `trust`, `faqs`, `featureList`, `relatedLinks`, `resourceLinks`, etc.

### Programmatic SEO
- `app/services/seo/programmatic.ts`
  - Templates (`content/seo/templates/*.json`) + datasets (`content/seo/datasets/*.json`).
  - Token resolution, route building, section rendering, related links.
  - Generates markdown via `renderSeoMarkdown()` into `content/seo/generated`.
  - Exposes routes via `getProgrammaticRoutePatterns()`.

### Content registry
- `app/services/seo/content_registry.ts`
  - Aggregates `content/pages/**/*.md` + `content/seo/generated/**/*.md`.
  - Produces `config/seo_content.json` cache.
  - Resolves content by path for static and programmatic pages.

### Runtime markdown delivery
- `app/middleware/markdown_middleware.ts`
  - Intercepts GET/HEAD, delegates to markdown responder.
- `app/services/seo/markdown_delivery.ts`
  - Content negotiation for `.md`, `Accept: text/markdown`, `?format=md`.
  - Restricts to indexable paths (`config/seo.ts` + `NOINDEX_PATHS`).
  - Renders markdown via `renderSeoMarkdown()` and sets `Content-Type` + `Vary: Accept`.

### Custom HTML pages w/ markdown versions
- Home page: `/` is custom React (Inertia) but `content/pages/index.md` provides markdown + SEO data.
- Developers page: `inertia/pages/marketing/developers.tsx` is custom HTML; `content/pages/developers.md` provides markdown + SEO.
- `SeoHead` adds `<link rel="alternate" type="text/markdown">` for discovery.

## Package Vision
A small, framework-agnostic core + thin adapters:

- **Core package** (Node): parsing, indexing, programmatic generation, markdown rendering, llms/sitemap artifacts.
- **Runtime adapters**: content negotiation + response helpers for Adonis, Express, Next, etc.
- **Cloudflare Pages adapter**: Pages Functions middleware to serve `.md` or Accept-based markdown.
- **CLI**: `llm-seo generate` for build-time artifacts.

We will keep this code in `llm-seo/` for now, and evolve it side-by-side with the existing Adonis implementation.

## Proposed Folder Layout (inside `llm-seo/`)
```
llm-seo/
  PLAN.md
  README.md
  package.json
  src/
    core/
      types.ts
      markdown/parser.ts
      markdown/renderer.ts
      content/marketing.ts
      content/pages.ts
      programmatic/index.ts
      registry.ts
      llms.ts
      sitemap.ts
      robots.ts
      route-utils.ts
    cli/
      generate.ts
    adapters/
      adonis/
        markdown_middleware.ts
        markdown_delivery.ts
      cloudflare/
        middleware.ts
        cache-key.md
      express/
        middleware.ts
    templates/
      llms.txt
  examples/
    adonis/
    cloudflare-pages/
```

Notes:
- The `core/` directory contains pure functions; it should not import framework types.
- The `adapters/` implement framework-specific request/response wiring.
- The Cloudflare adapter will be a small `functions/_middleware.js` or `functions/_middleware.ts` template.

## Configuration Surface (core)
Define a single config object that powers build-time and runtime:

```ts
export type LlmSeoConfig = {
  siteName: string
  siteSummary: string
  contact?: string
  baseUrl?: string // required for absolute URLs in llms/sitemap

  content: {
    marketingDir?: string // default content/marketing
    pagesDir?: string // default content/pages
    programmaticDir?: string // default content/seo
    generatedDir?: string // default content/seo/generated
  }

  routes: {
    staticRoutes: SeoRoute[] // custom HTML pages (home, developers, etc.)
    noindexPaths?: string[]
  }

  llms: {
    include?: (page: SeoPageContent) => boolean
    template?: string // allow override of llms.txt template
  }

  markdown: {
    enableAcceptNegotiation?: boolean // default true
    enableQueryParam?: boolean // default true (?format=md)
    extension?: string // default .md
  }

  generation: {
    outputDir?: string // default public/
    contentCacheDir?: string // default config/
    generatePublicMarkdown?: boolean // default true
    generateProgrammaticMarkdown?: boolean // default true
    useGitDates?: boolean // default true
  }
}
```

## Core Modules (what to extract)
1. **Types**
   - Lift `app/services/seo/types.ts` into `core/types.ts`.

2. **Markdown parsing**
   - `core/markdown/parser.ts`: combine marketing `[meta]` parsing + YAML front matter.
   - Keep section extraction parity (steps, pricing, trust, FAQs, resources, related, feature list, CTA).

3. **Markdown rendering**
   - `core/markdown/renderer.ts`: move `renderSeoMarkdown()`.
   - Keep YAML front matter output compatible with current parser.

4. **Content registry**
   - `core/registry.ts`: merge logic from `content_registry.ts` and `marketing_content.ts`.
   - Must allow:
     - Marketing content index.
     - Static pages index.
     - Generated programmatic pages index.
     - Exclusion of marketing routes from static index (current behavior).

5. **Programmatic SEO**
   - `core/programmatic/index.ts`: move template + dataset handling.
   - Expose:
     - `buildProgrammaticPages()` (from templates)
     - `writeProgrammaticMarkdownFiles()`
     - `getProgrammaticRoutePatterns()`

6. **Artifact generation**
   - `core/llms.ts`: configurable `llms.txt` generation (use template or builder).
   - `core/sitemap.ts`: build sitemap + sitemap index.
   - `core/robots.ts`: build robots.txt with sitemap URL.

7. **Utility helpers**
   - Normalizers for paths, titles, front matter, booleans.
   - Shared `buildMarkdownPath()` (used by multiple modules).

## Runtime Adapters

### Adonis adapter
- Recreate `markdown_middleware.ts` + `markdown_delivery.ts` using core functions.
- Inputs: Adonis `HttpContext`, config, route registry.
- Outputs: `text/markdown; charset=utf-8` with `Vary: Accept`.

### Express adapter
- Provide a `createMarkdownMiddleware(config)` function.
- Use the same request-based logic: `.md`, `Accept: text/markdown`, `?format=md`.
- Keep indexable gating behavior consistent with `config.routes.staticRoutes` + generated routes.

### Cloudflare Pages adapter
- Provide a minimal Pages Functions middleware that:
  1. Checks `Accept` for `text/markdown` and/or `.md` extension.
  2. Maps `/` => `/index.md`, `/docs` => `/docs.md`, `/docs/` => `/docs.md`.
  3. Uses `context.env.ASSETS.fetch` to serve static markdown.
  4. Sets `Content-Type: text/markdown; charset=utf-8` and `Vary: Accept`.

Example (to be placed in `functions/_middleware.js`):
```js
export async function onRequest(context) {
  const accept = context.request.headers.get("accept") || ""
  const wantsMd = accept.includes("text/markdown")

  if (wantsMd) {
    const url = new URL(context.request.url)
    const path = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname
    url.pathname = path === "" ? "/index.md" : `${path}.md`

    const mdResp = await context.env.ASSETS.fetch(new Request(url.toString(), context.request))
    if (mdResp.status !== 404) {
      const resp = new Response(mdResp.body, mdResp)
      resp.headers.set("Content-Type", "text/markdown; charset=utf-8")
      resp.headers.set("Vary", "Accept")
      return resp
    }
  }

  return context.next()
}
```

## Cloudflare Caching Strategy (required)
Cloudflare can cache the wrong variant if HTML vs markdown share a URL. We must prevent that:

Preferred options:
1. **Separate URL for markdown**: `/page.md` or `/page?format=md`. This avoids cache poisoning entirely.
2. **If Accept negotiation is required**, enforce a cache key variant:
   - Transform Rule or Custom Cache Key including `Accept`.
   - Or rewrite markdown requests to a distinct URL (query param) before caching.

Plan: ship the Cloudflare adapter with a short `cache-key.md` guide describing these options.

## Handling Custom HTML Pages + Markdown Versions
We need an explicit registry for “HTML view + markdown source” pages:
- The HTML route is custom (e.g., Home, Developers page).
- The markdown content comes from `content/pages/*.md` (YAML front matter).
- The registry provides `markdownPath`, `seoTitle`, `seoDescription`, etc.

In config, this should be a simple list:
```ts
staticRoutes: [
  { path: "/", label: "Home", group: "company", indexable: true, nav: true },
  { path: "/developers", label: "Developers", group: "resources", indexable: true, nav: true },
  // ...
]
```
Then:
- HTML rendering can use the content from the registry if desired (for SEO meta).
- Markdown delivery uses the same registry to render markdown.

## CLI / Build-time Workflow
Create `llm-seo generate` to mirror `seo:generate`:

Artifacts:
- `public/sitemap.xml` (+ sitemap index if > 45k URLs)
- `public/robots.txt`
- `public/sitemap.md`
- `public/llms.txt`
- `public/**/*.md` for indexable pages
- `config/marketing_routes.json`
- `config/marketing_content.json`
- `config/seo_content.json`
- `content/seo/generated/**/*.md`

Also:
- Support git-based dates (optional, configurable).
- Provide an optional `SEO_STRICT` equivalent to fail on programmatic validation errors.

## Migration Plan (in this repo)
Phase 1 — Scaffold package in `llm-seo/`
- Create structure + README.
- Port types, parser, renderer, programmatic generator, registry.
- Create a local adapter for Adonis that proxies to existing code (initially).

Phase 2 — Swap existing code to use package
- Replace `app/services/seo/*`, `app/services/marketing_*` imports with `llm-seo` core.
- Update `commands/seo_generate.ts` to call the new CLI or core generation functions.
- Keep old files temporarily as wrappers until parity is verified.

Phase 3 — Cloudflare support
- Add `llm-seo/adapters/cloudflare/middleware.ts` + docs.
- Provide example Cloudflare Pages repo using static assets + middleware.

Phase 4 — Parity tests
- Snapshot tests comparing:
  - Generated `public/llms.txt`
  - `public/sitemap.md`
  - `renderSeoMarkdown()` output for a sample page
  - Programmatic markdown output from templates/datasets

Phase 5 — Cleanup
- Remove old duplicate implementations once parity is confirmed.

## Testing & Validation
- Unit tests for parser + renderer (fixtures under `llm-seo/__fixtures__`).
- Integration test: run `generate` on sample content and verify outputs.
- For Cloudflare: local `wrangler pages dev` smoke test (optional).

## Open Questions
- Do we want to keep the `[meta]` block syntax long-term, or normalize everything to YAML front matter?
- Should we allow per-site llms.txt templates (string or file path)?
- Do we need a JSON schema for programmatic templates/datasets?

## Definition of Done
- The Adonis app still builds and serves the same HTML + markdown outputs.
- `llm-seo generate` produces identical artifacts to the current `seo:generate`.
- A fresh Cloudflare Pages project can serve `text/markdown` with the middleware and static assets.
- Custom HTML pages (home, developers) keep markdown parity and `alternate` link support.
