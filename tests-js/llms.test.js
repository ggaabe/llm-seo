import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildLlmsTxt, resolveConfig } from '../dist/index.js'

const baseConfig = resolveConfig({
  siteName: 'ExampleCo',
  siteSummary: 'Example summary',
  llms: {
    sections: [
      {
        heading: 'Docs',
        links: [{ label: 'API', href: 'https://example.com/api.md' }],
      },
      {
        heading: 'Company',
        links: [{ label: 'About', href: 'https://example.com/about.md' }],
      },
      {
        heading: 'Legal',
        links: [{ label: 'Terms', href: 'https://example.com/terms.md' }],
      },
    ],
  },
})

const articleLinks = [
  { label: 'Post 1', href: 'https://example.com/post-1.md' },
  { label: 'Post 2', href: 'https://example.com/post-2.md' },
]

test('llms places Articles after Docs when configured', () => {
  const config = {
    ...baseConfig,
    llms: {
      ...baseConfig.llms,
      articlesPlacement: 'after-docs',
    },
  }
  const text = buildLlmsTxt({ config, baseUrl: 'https://example.com', articleLinks })
  const docsIndex = text.indexOf('## Docs')
  const articlesIndex = text.indexOf('## Articles')
  const companyIndex = text.indexOf('## Company')
  assert.ok(docsIndex !== -1)
  assert.ok(articlesIndex !== -1)
  assert.ok(companyIndex !== -1)
  assert.ok(docsIndex < articlesIndex, 'Articles should come after Docs')
  assert.ok(articlesIndex < companyIndex, 'Articles should come before Company')
})

test('llms omits Articles when configured', () => {
  const config = {
    ...baseConfig,
    llms: {
      ...baseConfig.llms,
      articlesPlacement: 'omit',
    },
  }
  const text = buildLlmsTxt({ config, baseUrl: 'https://example.com', articleLinks })
  assert.equal(text.includes('## Articles'), false)
})
