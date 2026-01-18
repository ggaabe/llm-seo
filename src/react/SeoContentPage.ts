import React from 'react'
import { marked } from 'marked'
import type { SeoPageContent } from '../core/types.js'
import { mergeContentStyles, type ContentStyleConfig } from './styles.js'

marked.setOptions({
  gfm: true,
  breaks: true,
  mangle: false,
  headerIds: false,
} as any)

export type SeoContentPageProps = {
  content: SeoPageContent
  styles?: ContentStyleConfig
  renderMarkdown?: (markdown: string) => string
}

const defaultRenderMarkdown = (markdown: string) => marked.parse(markdown)

const Section = ({
  heading,
  children,
  styles,
}: {
  heading: string
  children?: React.ReactNode
  styles: Required<ContentStyleConfig>
}) =>
  React.createElement(
    'section',
    { className: styles.section },
    React.createElement('h2', { className: styles.sectionHeading }, heading),
    React.createElement('div', { className: styles.sectionBody }, children)
  )

export const SeoContentPage = ({ content, styles, renderMarkdown }: SeoContentPageProps) => {
  const classes = mergeContentStyles(styles)
  const markdownRenderer = renderMarkdown || defaultRenderMarkdown

  const publishedLabel = content.publishedAt ? `Published ${content.publishedAt}` : ''
  const updatedLabel =
    content.updatedAt && content.updatedAt !== content.publishedAt
      ? `Updated ${content.updatedAt}`
      : ''
  const metaLabel = [publishedLabel, updatedLabel].filter(Boolean).join(' • ')

  const elements: React.ReactNode[] = []

  const headerChildren: React.ReactNode[] = []
  if (content.eyebrow) {
    headerChildren.push(
      React.createElement('p', { key: 'eyebrow', className: classes.eyebrow }, content.eyebrow)
    )
  }
  headerChildren.push(
    React.createElement('h1', { key: 'title', className: classes.title }, content.heading || content.title)
  )
  if (content.description) {
    headerChildren.push(
      React.createElement('p', { key: 'description', className: classes.description }, content.description)
    )
  }
  if (metaLabel) {
    headerChildren.push(
      React.createElement('p', { key: 'meta', className: classes.meta }, metaLabel)
    )
  }
  elements.push(
    React.createElement('header', { key: 'header', className: classes.header }, headerChildren)
  )

  if (content.steps?.length) {
    elements.push(
      React.createElement(
        Section,
        { key: 'steps', heading: 'How it works', styles: classes },
        React.createElement(
          'ol',
          { className: classes.orderedList },
          content.steps.map((step) =>
            React.createElement(
              'li',
              { key: step.title, className: classes.orderedListItem },
              React.createElement('strong', null, step.title),
              ` ${step.description}`
            )
          )
        )
      )
    )
  }

  if (content.featureList?.length) {
    elements.push(
      React.createElement(
        Section,
        { key: 'features', heading: 'Feature list', styles: classes },
        React.createElement(
          'ul',
          { className: classes.list },
          content.featureList.map((item) =>
            React.createElement('li', { key: item, className: classes.listItem }, item)
          )
        )
      )
    )
  }

  if (content.pricing) {
    elements.push(
      React.createElement(
        Section,
        { key: 'pricing', heading: 'Pricing', styles: classes },
        React.createElement('p', null, content.pricing.headline),
        React.createElement('p', null, content.pricing.detail)
      )
    )
  }

  if (content.trust?.items?.length) {
    elements.push(
      React.createElement(
        Section,
        { key: 'trust', heading: content.trust.title, styles: classes },
        React.createElement(
          'ul',
          { className: classes.list },
          content.trust.items.map((item) =>
            React.createElement(
              'li',
              { key: item.title, className: classes.listItem },
              React.createElement('strong', null, item.title),
              ` - ${item.description}`
            )
          )
        )
      )
    )
  }

  if (content.sections?.length) {
    content.sections.forEach((section) => {
      elements.push(
        React.createElement(
          Section,
          { key: section.heading, heading: section.heading, styles: classes },
          React.createElement('div', {
            className: classes.markdown,
            dangerouslySetInnerHTML: {
              __html: markdownRenderer(section.markdown),
            },
          })
        )
      )
    })
  }

  if (content.faqs?.length) {
    elements.push(
      React.createElement(
        Section,
        { key: 'faqs', heading: 'FAQs', styles: classes },
        React.createElement(
          'ul',
          { className: classes.list },
          content.faqs.map((faq) =>
            React.createElement(
              'li',
              { key: faq.question, className: classes.listItem },
              React.createElement('strong', null, faq.question),
              ` ${faq.answer}`
            )
          )
        )
      )
    )
  }

  if (content.resourceLinks?.length) {
    elements.push(
      React.createElement(
        Section,
        { key: 'resources', heading: 'Resources', styles: classes },
        React.createElement(
          'ul',
          { className: classes.list },
          content.resourceLinks.map((link) =>
            React.createElement(
              'li',
              { key: link.href, className: classes.listItem },
              React.createElement(
                'a',
                { className: classes.link, href: link.href },
                link.label
              )
            )
          )
        )
      )
    )
  }

  if (content.relatedLinks?.length) {
    elements.push(
      React.createElement(
        Section,
        { key: 'related', heading: 'Related', styles: classes },
        React.createElement(
          'ul',
          { className: classes.list },
          content.relatedLinks.map((link) =>
            React.createElement(
              'li',
              { key: link.href, className: classes.listItem },
              React.createElement(
                'a',
                { className: classes.link, href: link.href },
                link.label
              )
            )
          )
        )
      )
    )
  }

  if (content.cta) {
    elements.push(
      React.createElement(
        'section',
        { key: 'cta', className: classes.ctaSection },
        React.createElement('h2', { className: classes.sectionHeading }, 'Ready to send it?'),
        React.createElement(
          'div',
          { className: classes.sectionBody },
          content.cta.note
            ? React.createElement('p', { className: classes.ctaNote }, content.cta.note)
            : null,
          React.createElement(
            'a',
            { className: classes.ctaLink, href: content.cta.href },
            content.cta.label
          )
        )
      )
    )
  }

  return React.createElement('article', { className: classes.page }, elements)
}
