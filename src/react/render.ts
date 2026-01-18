import React from 'react'
import ReactDOMServer from 'react-dom/server'
import type { SeoPageContent } from '../core/types.js'
import { SeoContentPage } from './SeoContentPage.js'
import type { ContentStyleConfig } from './styles.js'

export type RenderSeoHtmlOptions = {
  styles?: ContentStyleConfig
  renderMarkdown?: (markdown: string) => string
  wrapHtml?: boolean
  title?: string
}

export const renderSeoHtml = (content: SeoPageContent, options: RenderSeoHtmlOptions = {}) => {
  const markup = ReactDOMServer.renderToStaticMarkup(
    React.createElement(SeoContentPage, {
      content,
      styles: options.styles,
      renderMarkdown: options.renderMarkdown,
    })
  )

  if (!options.wrapHtml) {
    return markup
  }

  const title = options.title || content.seoTitle || content.title
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>${title}</title></head><body>${markup}</body></html>`
}
