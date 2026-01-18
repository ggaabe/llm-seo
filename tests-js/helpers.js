import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

export const createTempDir = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-seo-'))
  return root
}

export const writeFile = async (root, relativePath, contents) => {
  const targetPath = path.join(root, relativePath)
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, contents, 'utf8')
}

export const readFile = async (root, relativePath) => {
  return fs.readFile(path.join(root, relativePath), 'utf8')
}

export const cleanupDir = async (root) => {
  await fs.rm(root, { recursive: true, force: true })
}
