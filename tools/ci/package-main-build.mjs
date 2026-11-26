import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, lstatSync, mkdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const destination = process.argv[2] && resolve(process.argv[2])
if (!destination || existsSync(destination)) {
  throw new Error('Pass a new directory for the build package')
}
const git = (...args) => execFileSync('git', args, { cwd: root })
const sha = git('rev-parse', 'HEAD').toString('utf8').trim()
if (process.env.GITHUB_SHA && sha !== process.env.GITHUB_SHA) {
  throw new Error('The checked-out commit does not match GITHUB_SHA')
}

const assets = new Set(['.js', '.mjs', '.cjs', '.html', '.css', '.svg', '.ico', '.png', '.jpg', '.jpeg', '.webp', '.ttf', '.woff', '.woff2'])
const catalogFiles = new Set(['retail-pr13e.json', 'glass-off-verified-scenarios.json', 'completation-pr13e.json'])
const directories = [
  { path: 'apps/frontend/dist', entry: 'index.html' },
  { path: 'apps/backend/dist/apps/backend/src', entry: 'index.js' },
  { path: 'packages/shared/dist', entry: 'index.js' },
]
for (const { path, entry } of directories) {
  const source = join(root, path)
  if (!lstatSync(join(source, entry)).isFile()) throw new Error(`Build entry is missing in ${path}`)
  const target = join(destination, path)
  mkdirSync(dirname(target), { recursive: true })
  cpSync(source, target, {
    recursive: true,
    filter(file) {
      if (basename(file).startsWith('.')) return false
      const stat = lstatSync(file)
      const subpath = relative(source, file).split(sep).join('/')
      if (stat.isDirectory()) return path !== 'apps/backend/dist/apps/backend/src' || subpath !== 'prisma'
      if (!stat.isFile()) return false
      if (extname(file) === '.json') {
        return path === 'apps/backend/dist/apps/backend/src' &&
          dirname(subpath).split(sep).join('/') === 'domain/jv/catalogs' && catalogFiles.has(basename(file))
      }
      return file.endsWith('.d.ts') || assets.has(extname(file))
    },
  })
  if (!existsSync(join(target, entry))) throw new Error(`Build entry was excluded from ${path}`)
}

for (const file of catalogFiles) {
  if (!existsSync(join(destination, 'apps/backend/dist/apps/backend/src/domain/jv/catalogs', file))) {
    throw new Error(`Missing compiled public catalog ${file}`)
  }
}

const digest = path => createHash('sha256').update(git('show', `${sha}:${path}`)).digest('hex')
const migrationsPath = 'apps/backend/prisma/migrations'
const migrations = git('ls-tree', '-r', '--name-only', '-z', sha, '--', migrationsPath).toString('utf8').split('\0')
  .filter(path => path.endsWith('/migration.sql'))
  .sort()
  .map(path => ({ name: basename(dirname(path)), sha256: digest(path) }))
const info = JSON.stringify({
  sha, builtAt: new Date().toISOString(),
  ref: process.env.GITHUB_REF ?? null, runId: process.env.GITHUB_RUN_ID ?? null,
  lockfileSha256: digest('pnpm-lock.yaml'),
  prisma: { schemaSha256: digest('apps/backend/prisma/schema.prisma'), migrations },
}, null, 2) + '\n'
writeFileSync(join(destination, 'build-info.json'), info)
writeFileSync(join(destination, 'apps/frontend/dist/build-info.json'), info)
