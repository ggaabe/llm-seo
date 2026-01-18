import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateSeoArtifacts } from '../dist/index.js'
import { createTempDir, writeFile, readFile, cleanupDir } from './helpers.js'

const buildFixtures = async (root) => {
  await writeFile(
    root,
    'content/marketing/mail_documents_online.md',
    `[meta]
seo-description: Mail documents online in minutes.
seotitle: Mail documents online | ExampleCo
cta-label: Send now
cta-href: /start
published: 2024-01-01
updated: 2024-01-05

# Mail documents online
Send documents without a printer.

## How it works
1. Upload - Add your PDF
2. Review - Confirm addresses

## FAQs
- **How fast?** Usually 2-5 days.

## Ready to send it?
Send now. [Send now](/start)
`
  )

  await writeFile(
    root,
    'content/pages/index.md',
    `---
title: Home
description: Welcome to ExampleCo.
group: company
nav: true
nav-order: 1
---

# Home
Welcome to ExampleCo.
`
  )

  await writeFile(
    root,
    'content/pages/developers.md',
    `---
title: Developers
description: API docs and SDKs.
group: resources
---

# Developers
Build with our API.
`
  )

  await writeFile(
    root,
    'content/seo/templates/guide.json',
    JSON.stringify(
      {
        id: 'guide',
        route: '/guides/{slug}',
        group: 'content',
        indexable: true,
        llms: true,
        content: {
          title: 'Guide to {{topic}}',
          description: 'Learn {{topic}} with steps.',
          sections: [{ heading: 'Overview', markdown: 'All about {{topic}}.' }],
        },
      },
      null,
      2
    )
  )

  await writeFile(
    root,
    'content/seo/datasets/guide.json',
    JSON.stringify(
      [
        {
          slug: 'testing',
          topic: 'Testing',
          tags: ['qa'],
        },
      ],
      null,
      2
    )
  )
}

test('generateSeoArtifacts creates expected outputs', async () => {
  const root = await createTempDir()
  try {
    await buildFixtures(root)

    const result = await generateSeoArtifacts({
      rootDir: root,
      baseUrl: 'https://example.com',
      siteName: 'ExampleCo',
      siteSummary: 'Example summary',
      routes: {
        staticRoutes: [
          { path: '/', label: 'Home', group: 'company', indexable: true, nav: true, navOrder: 1 },
          { path: '/developers', label: 'Developers', group: 'resources', indexable: true },
        ],
      },
      llms: {
        sections: [
          {
            heading: 'Docs',
            links: [{ label: 'Developers', href: 'https://example.com/developers.md' }],
          },
          {
            heading: 'Company',
            links: [{ label: 'About', href: 'https://example.com/about.md' }],
          },
        ],
        articlesPlacement: 'after-docs',
      },
      generation: {
        useGitDates: false,
      },
    })

    const sitemap = await readFile(root, 'public/sitemap.xml')
    assert.ok(sitemap.includes('<loc>https://example.com/</loc>'))
    assert.ok(sitemap.includes('<loc>https://example.com/developers</loc>'))
    assert.ok(sitemap.includes('<loc>https://example.com/mail-documents-online</loc>'))
    assert.ok(sitemap.includes('<loc>https://example.com/guides/testing</loc>'))

    const llms = await readFile(root, 'public/llms.txt')
    assert.ok(llms.includes('## Articles'))
    assert.ok(llms.includes('mail-documents-online.md'))
    assert.ok(llms.includes('guides/testing.md'))

    const indexMd = await readFile(root, 'public/index.md')
    assert.ok(indexMd.includes('title: Home'))
    assert.ok(indexMd.includes('# Home'))

    const marketingContentRaw = await readFile(root, 'config/marketing_content.json')
    assert.ok(!marketingContentRaw.includes('"markdown"'))

    const seoContentRaw = await readFile(root, 'config/seo_content.json')
    assert.ok(seoContentRaw.includes('"/developers"'))

    assert.equal(result.programmaticMarkdownCount, 1)
  } finally {
    await cleanupDir(root)
  }
})
