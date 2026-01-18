import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import type { MarketingRoute } from '../types.js'
import { buildMarketingContentIndexFromFilesystem } from './marketing.js'
import type { ResolvedLlmSeoConfig } from '../config.js'

export type MarketingRouteRecord = MarketingRoute & { sourceFile: string }

export const buildMarketingRoutesFromFilesystem = (
  config: ResolvedLlmSeoConfig
): MarketingRouteRecord[] => {
  const contentEntries = buildMarketingContentIndexFromFilesystem(config, { includeMarkdown: false })
  return contentEntries.map((entry) => ({
    path: entry.path,
    component: 'marketing_markdown',
    label: entry.label,
    group: entry.group,
    indexable: entry.indexable,
    publishedAt: entry.publishedAt,
    updatedAt: entry.updatedAt,
    nav: entry.nav,
    navOrder: entry.navOrder,
    sourceFile: entry.sourceFile,
  }))
}

export const readMarketingRoutesFile = (config: ResolvedLlmSeoConfig): MarketingRoute[] | null => {
  const generatedPath = path.join(config.generation.contentCacheDir, 'marketing_routes.json')
  if (!fs.existsSync(generatedPath)) return null
  try {
    const raw = fs.readFileSync(generatedPath, 'utf8')
    const parsed = JSON.parse(raw) as MarketingRoute[]
    if (!Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export const writeMarketingRoutesFile = (config: ResolvedLlmSeoConfig, routes: MarketingRoute[]) => {
  const payload = JSON.stringify(
    routes.map((route) => ({
      path: route.path,
      component: route.component,
      label: route.label,
      group: route.group,
      indexable: route.indexable,
      publishedAt: route.publishedAt,
      updatedAt: route.updatedAt,
      nav: route.nav,
      navOrder: route.navOrder,
    })),
    null,
    2
  )
  const outputPath = path.join(config.generation.contentCacheDir, 'marketing_routes.json')
  fs.writeFileSync(outputPath, `${payload}\n`, 'utf8')
}

const canReadGit = (rootDir: string) => {
  try {
    return fs.existsSync(path.join(rootDir, '.git'))
  } catch {
    return false
  }
}

const getGitDatesForFiles = (rootDir: string, targetDir: string) => {
  if (!canReadGit(rootDir)) {
    return null
  }

  try {
    const relativeDir = path.relative(rootDir, targetDir) || targetDir
    const output = execSync(`git log --format=%cI --name-only -- "${relativeDir}"`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      cwd: rootDir,
    })
      .toString()
      .trim()

    if (!output) {
      return null
    }

    const lines = output.split('\n')
    const results = new Map<string, { publishedAt?: string; updatedAt?: string }>()
    let currentDate: string | null = null

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
        currentDate = trimmed
        continue
      }
      if (!currentDate) continue

      const filePath = trimmed.replace(/\\/g, '/')
      const existing = results.get(filePath)
      if (!existing) {
        results.set(filePath, { updatedAt: currentDate, publishedAt: currentDate })
      } else {
        existing.publishedAt = currentDate
      }
    }

    return results
  } catch {
    return null
  }
}

export const addMarketingRouteGitDates = (
  config: ResolvedLlmSeoConfig,
  routes: MarketingRouteRecord[],
  fallbackDates?: Map<string, { publishedAt?: string; updatedAt?: string }>
): MarketingRoute[] => {
  const datesIndex = getGitDatesForFiles(config.rootDir, config.content.marketingDir)

  return routes.map((route) => {
    const dates = datesIndex?.get(route.sourceFile)
    const fallback = fallbackDates?.get(route.path)

    if (!dates && !fallback) {
      return {
        path: route.path,
        component: route.component,
        label: route.label,
        group: route.group,
        indexable: route.indexable,
        nav: route.nav,
        navOrder: route.navOrder,
      }
    }

    return {
      path: route.path,
      component: route.component,
      label: route.label,
      group: route.group,
      indexable: route.indexable,
      publishedAt: dates?.publishedAt ?? fallback?.publishedAt ?? route.publishedAt,
      updatedAt: dates?.updatedAt ?? fallback?.updatedAt ?? route.updatedAt,
      nav: route.nav,
      navOrder: route.navOrder,
    }
  })
}

let cachedRoutes: MarketingRoute[] | null = null

export const getMarketingRoutes = (
  config: ResolvedLlmSeoConfig,
  options?: { source?: 'auto' | 'filesystem' | 'file'; refresh?: boolean }
) => {
  const isProduction = process.env.NODE_ENV === 'production'
  const source = options?.source ?? (isProduction ? 'auto' : 'filesystem')
  if (cachedRoutes && !options?.refresh) {
    return cachedRoutes
  }

  let routes: MarketingRoute[] | null = null

  if (source === 'file' || source === 'auto') {
    routes = readMarketingRoutesFile(config)
  }

  if (!routes && (source === 'filesystem' || source === 'auto')) {
    routes = buildMarketingRoutesFromFilesystem(config).map((route) => ({
      path: route.path,
      component: route.component,
      label: route.label,
      group: route.group,
      indexable: route.indexable,
      publishedAt: route.publishedAt,
      updatedAt: route.updatedAt,
      nav: route.nav,
      navOrder: route.navOrder,
    }))
  }

  cachedRoutes = routes || []
  return cachedRoutes
}
