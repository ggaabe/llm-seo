import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseMarketingMarkdown } from '../dist/index.js'

const sample = `[meta]
seo-description: A short description.
seotitle: Custom SEO Title
cta-label: Get started
cta-href: /start

# Mail documents online
Send documents without a printer.

## How it works
1. Upload - Add your PDF
2. Review - Confirm addresses

## FAQs
- **What is this?** A test.

## Related
- [Pricing](/pricing)

## Ready to send it?
Get started now. [Get started](/start)
`

test('parseMarketingMarkdown extracts structured data', () => {
  const parsed = parseMarketingMarkdown(sample)
  assert.equal(parsed.title, 'Mail documents online')
  assert.equal(parsed.seoTitle, 'Custom SEO Title')
  assert.equal(parsed.seoDescription, 'A short description.')
  assert.equal(parsed.description, 'Send documents without a printer.')
  assert.ok(parsed.steps && parsed.steps.length === 2)
  assert.equal(parsed.steps?.[0].title, 'Upload')
  assert.equal(parsed.steps?.[0].description, 'Add your PDF')
  assert.ok(parsed.faqs && parsed.faqs.length === 1)
  assert.equal(parsed.relatedLinks?.[0]?.label, 'Pricing')
  assert.equal(parsed.cta?.label, 'Get started')
  assert.equal(parsed.cta?.href, '/start')
})
