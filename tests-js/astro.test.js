import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAstroMarkdownMiddleware } from '../dist/adapters/astro/index.js'

const content = {
  path: '/pricing',
  group: 'resources',
  indexable: true,
  title: 'Pricing',
  heading: 'Pricing',
  description: 'Pricing details.',
}

test('astro middleware responds with markdown when Accept: text/markdown', async () => {
  const middleware = createAstroMarkdownMiddleware({
    config: {},
    resolveContent: (pathValue) => (pathValue === '/pricing' ? content : null),
    isIndexable: (pathValue) => pathValue === '/pricing',
  })

  const response = await middleware(
    {
      request: new Request('http://example.com/pricing', {
        headers: { Accept: 'text/markdown' },
      }),
      url: new URL('http://example.com/pricing'),
    },
    async () => new Response('next')
  )

  const body = await response.text()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'text/markdown; charset=utf-8')
  assert.ok(body.includes('# Pricing'))
})

test('astro middleware falls through when request not markdown', async () => {
  const middleware = createAstroMarkdownMiddleware({
    config: {},
    resolveContent: () => content,
    isIndexable: () => true,
  })

  const response = await middleware(
    {
      request: new Request('http://example.com/pricing', {
        headers: { Accept: 'text/html' },
      }),
      url: new URL('http://example.com/pricing'),
    },
    async () => new Response('next')
  )

  const body = await response.text()
  assert.equal(body, 'next')
})
