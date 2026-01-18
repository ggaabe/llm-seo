export type ContentStyleConfig = {
  page?: string
  header?: string
  eyebrow?: string
  title?: string
  description?: string
  meta?: string
  section?: string
  sectionHeading?: string
  sectionBody?: string
  list?: string
  listItem?: string
  orderedList?: string
  orderedListItem?: string
  link?: string
  ctaSection?: string
  ctaLink?: string
  ctaNote?: string
  markdown?: string
}

export const defaultContentStyles: Required<ContentStyleConfig> = {
  page: 'llmseo-page',
  header: 'llmseo-header',
  eyebrow: 'llmseo-eyebrow',
  title: 'llmseo-title',
  description: 'llmseo-description',
  meta: 'llmseo-meta',
  section: 'llmseo-section',
  sectionHeading: 'llmseo-section-heading',
  sectionBody: 'llmseo-section-body',
  list: 'llmseo-list',
  listItem: 'llmseo-list-item',
  orderedList: 'llmseo-ordered-list',
  orderedListItem: 'llmseo-ordered-list-item',
  link: 'llmseo-link',
  ctaSection: 'llmseo-cta',
  ctaLink: 'llmseo-cta-link',
  ctaNote: 'llmseo-cta-note',
  markdown: 'llmseo-markdown',
}

export const mergeContentStyles = (overrides?: ContentStyleConfig) => ({
  ...defaultContentStyles,
  ...(overrides || {}),
})
