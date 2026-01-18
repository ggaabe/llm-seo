import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const cliPath = path.resolve('dist/cli/index.js')

const runCli = (args, cwd) => {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    stdio: 'inherit',
  })
  assert.equal(result.status, 0)
}

const exists = async (filePath) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

test('cli init creates config file', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-seo-cli-'))
  runCli(['init', '--dir', tempDir, '--force'], process.cwd())
  assert.equal(await exists(path.join(tempDir, 'llm-seo.config.mjs')), true)
})

test('cli scaffold creates express template', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-seo-express-'))
  runCli(['scaffold', '--dir', tempDir, '--platform', 'express', '--force'], process.cwd())
  assert.equal(await exists(path.join(tempDir, 'package.json')), true)
  assert.equal(await exists(path.join(tempDir, 'server.mjs')), true)
  assert.equal(await exists(path.join(tempDir, 'scripts', 'build.mjs')), true)
  assert.equal(await exists(path.join(tempDir, 'content', 'pages', 'index.md')), true)
})

test('cli scaffold creates cloudflare template', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-seo-cf-'))
  runCli(['scaffold', '--dir', tempDir, '--platform', 'cloudflare', '--force'], process.cwd())
  assert.equal(await exists(path.join(tempDir, 'functions', '_middleware.js')), true)
  assert.equal(await exists(path.join(tempDir, 'content', 'pages', 'developers.md')), true)
})

test('cli scaffold creates adonis template', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-seo-adonis-'))
  runCli(['scaffold', '--dir', tempDir, '--platform', 'adonis', '--force'], process.cwd())
  assert.equal(await exists(path.join(tempDir, 'app', 'middleware', 'markdown_middleware.ts')), true)
  assert.equal(await exists(path.join(tempDir, 'start', 'routes.ts')), true)
  assert.equal(await exists(path.join(tempDir, 'inertia', 'pages', 'home.tsx')), true)
})

test('cli cloudflare setup supports dry-run', async () => {
  runCli(
    ['cloudflare:setup', '--dry-run', '--zone-id', 'zone-test', '--token', 'token-test'],
    process.cwd()
  )
})

test('cli scaffold creates astro template', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-seo-astro-'))
  runCli(['scaffold', '--dir', tempDir, '--platform', 'astro', '--force'], process.cwd())
  assert.equal(await exists(path.join(tempDir, 'astro.config.mjs')), true)
  assert.equal(await exists(path.join(tempDir, 'src', 'middleware.ts')), true)
  assert.equal(await exists(path.join(tempDir, 'src', 'pages', 'index.astro')), true)
  assert.equal(await exists(path.join(tempDir, 'functions', '_middleware.js')), true)
})
