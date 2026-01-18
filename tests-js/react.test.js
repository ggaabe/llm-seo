import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderSeoHtml } from '../dist/react/index.js'

const content = {
  path: '/example',
  group: 'content',
  indexable: true,
  title: 'Example Page',
  heading: 'Example Page',
  description: 'Example description.',
  cta: { label: 'Start', href: '/start', note: 'Ready when you are.' },
}

test('renderSeoHtml uses configurable styles', () => {
  const html = renderSeoHtml(content, {
    styles: { title: 'custom-title', ctaLink: 'custom-cta' },
  })
  assert.ok(html.includes('custom-title'))
  assert.ok(html.includes('custom-cta'))
})

test('renderSeoHtml can wrap full document', () => {
  const html = renderSeoHtml(content, { wrapHtml: true, title: 'Override Title' })
  assert.ok(html.startsWith('<!doctype html>'))
  assert.ok(html.includes('<title>Override Title</title>'))
})
