import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createExpressMarkdownMiddleware } from '../dist/adapters/express/index.js'

const content = {
  path: '/pricing',
  group: 'resources',
  indexable: true,
  title: 'Pricing',
  heading: 'Pricing',
  description: 'Pricing details.',
}

test('express middleware responds with markdown when Accept: text/markdown', () => {
  let sentBody = ''
  let statusCode = 0
  const headers = {}
  let nextCalled = false

  const middleware = createExpressMarkdownMiddleware({
    config: {
      routes: {
        staticRoutes: [{ path: '/pricing', label: 'Pricing', group: 'resources', indexable: true }],
      },
    },
    resolveContent: (pathValue) => (pathValue === '/pricing' ? content : null),
    isIndexable: (pathValue) => pathValue === '/pricing',
  })

  middleware(
    {
      method: 'GET',
      url: '/pricing',
      headers: { accept: 'text/markdown' },
      query: {},
    },
    {
      status(code) {
        statusCode = code
        return this
      },
      setHeader(name, value) {
        headers[name] = value
      },
      send(body) {
        sentBody = body
      },
    },
    () => {
      nextCalled = true
    }
  )

  assert.equal(nextCalled, false)
  assert.equal(statusCode, 200)
  assert.equal(headers['Content-Type'], 'text/markdown; charset=utf-8')
  assert.ok(sentBody.includes('# Pricing'))
})

test('express middleware falls through when request not markdown', () => {
  let nextCalled = false

  const middleware = createExpressMarkdownMiddleware({
    config: {},
    resolveContent: () => content,
    isIndexable: () => true,
  })

  middleware(
    {
      method: 'GET',
      url: '/pricing',
      headers: { accept: 'text/html' },
      query: {},
    },
    {
      status() {
        return this
      },
      setHeader() {},
      send() {},
    },
    () => {
      nextCalled = true
    }
  )

  assert.equal(nextCalled, true)
})

test('express middleware falls through when path not indexable', () => {
  let nextCalled = false

  const middleware = createExpressMarkdownMiddleware({
    config: {},
    resolveContent: () => content,
    isIndexable: () => false,
  })

  middleware(
    {
      method: 'GET',
      url: '/pricing',
      headers: { accept: 'text/markdown' },
      query: {},
    },
    {
      status() {
        return this
      },
      setHeader() {},
      send() {},
    },
    () => {
      nextCalled = true
    }
  )

  assert.equal(nextCalled, true)
})
