export type SeoRouteGroup = 'use-cases' | 'company' | 'resources' | 'content'

export type SeoSchemaType = 'software' | 'article' | 'product' | 'webpage'

export type SeoRoute = {
  path: string
  label: string
  group: SeoRouteGroup
  indexable: boolean
  publishedAt?: string
  updatedAt?: string
  nav?: boolean
  navOrder?: number
  llms?: boolean
}

export type SeoLink = {
  label: string
  href: string
}

export type SeoBreadcrumb = {
  name: string
  path: string
}

export type SeoCta = {
  label: string
  href: string
  note?: string
}

export type SeoFaq = {
  question: string
  answer: string
}

export type SeoSection = {
  heading: string
  markdown: string
}

export type SeoStep = {
  title: string
  description: string
}

export type SeoPricing = {
  headline: string
  detail: string
}

export type SeoTrustItem = {
  title: string
  description: string
}

export type SeoTrust = {
  title: string
  items: SeoTrustItem[]
}

export type SeoPageContent = {
  path: string
  group: SeoRouteGroup
  indexable: boolean
  publishedAt?: string
  updatedAt?: string
  llms?: boolean
  nav?: boolean
  navOrder?: number
  tags?: string[]
  markdownPath?: string
  eyebrow?: string
  title: string
  heading: string
  description?: string
  seoTitle?: string
  seoDescription?: string
  ogImage?: string
  ogType?: string
  schemaType?: SeoSchemaType
  cta?: SeoCta
  steps?: SeoStep[]
  pricing?: SeoPricing
  trust?: SeoTrust
  faqs?: SeoFaq[]
  featureList?: string[]
  sections?: SeoSection[]
  relatedLinks?: SeoLink[]
  resourceLinks?: SeoLink[]
  breadcrumbs?: SeoBreadcrumb[]
}

export type MarketingGroup = SeoRouteGroup

export type MarketingStep = SeoStep

export type MarketingPricing = SeoPricing

export type MarketingTrustItem = SeoTrustItem

export type MarketingTrust = SeoTrust

export type MarketingFaqItem = SeoFaq

export type MarketingLink = SeoLink

export type MarketingCta = SeoCta

export type MarketingExtraSection = SeoSection

export type MarketingContent = SeoPageContent & {
  label: string
  sourceFile: string
  markdown?: string
}

export type MarketingRoute = {
  path: string
  component: string
  label: string
  group: MarketingGroup
  indexable: boolean
  publishedAt?: string
  updatedAt?: string
  nav?: boolean
  navOrder?: number
}
