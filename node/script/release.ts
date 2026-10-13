import { PACKAGE_ROOT, REPO_ROOT, VERSION_MODULE, fail, isSemanticVersion, readSchemaVersion, readText, renderVersionModule } from './utils'

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'

type Manifest = {
  version: string
  main?: string
  module?: string
  types?: string
  exports?: unknown
}

const TAG_PREFIX = 'node/v'

const MANIFEST = resolve(PACKAGE_ROOT, 'package.json')

const CHANGE_LOG = resolve(PACKAGE_ROOT, 'CHANGELOG.md')

const CHANGE_LOG_BUILDER = resolve(REPO_ROOT, 'script', 'build-change-log.py')

const run = (command: string, args: string[], cwd = PACKAGE_ROOT) => {
  try {
    execFileSync(command, args, { cwd, stdio: 'inherit' })
  } catch (error) {
    fail(`\`${[command, ...args].join(' ')}\` failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const runNpm = (args: string[]) => {
  const execpath = process.env.npm_execpath ?? fail('run this through `npm run`, which tells the script where npm lives')
  run(process.execPath, [execpath, ...args])
}

const runGit = (args: string[]): string => {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim()
}

/**
 * Publishing from a dirty tree ships files no commit records, leaving a tarball nobody can reproduce.
 */
const checkWorktree = () => {
  const status = runGit(['status', '--porcelain'])
  if (status !== '') {
    fail(`the worktree has uncommitted changes:\n${status}`)
  }
}

/**
 * The module the bindings read the schema version from must be the one the declared version renders to.
 * Comparing the rendered text rather than importing it keeps this script off the source tree it publishes.
 */
const checkSchemaVersion = () => {
  const declared = readSchemaVersion()
  if (readText(VERSION_MODULE) !== renderVersionModule(declared).trim()) {
    fail(`src/version.ts does not carry the declared schema version ${declared}; run \`npm run generate:version\``)
  }
}

/**
 * A placeholder or malformed version would publish under something no consumer can depend on.
 */
const checkPackageVersion = (version: string) => {
  if (!isSemanticVersion(version)) {
    fail(`the package version ${JSON.stringify(version)} is not a semantic version`)
  }
  if (version === '0.0.0') {
    fail('the package version is still the 0.0.0 placeholder')
  }
}

/**
 * Writes the package's copy of the licence from the repository root, which is the only place it is tracked.
 */
const copyLicense = () => {
  const source = resolve(REPO_ROOT, 'LICENSE')
  if (!existsSync(source)) {
    fail('the repository root has no LICENSE to copy')
  }
  copyFileSync(source, resolve(PACKAGE_ROOT, 'LICENSE'))
}

/**
 * Collects the paths an exports map points at, reached through however many condition objects nest around them.
 */
const collectTargets = (node: unknown, targets: Set<string>) => {
  if (typeof node === 'string') {
    if (node.startsWith('./')) {
      targets.add(node)
    }
    return
  }
  if (node !== null && typeof node === 'object') {
    for (const value of Object.values(node)) {
      collectTargets(value, targets)
    }
  }
}

/**
 * Every path the manifest points consumers at has to exist, since `dist` is generated and never committed.
 */
const checkArtifacts = (manifest: Manifest) => {
  const targets = new Set<string>()
  collectTargets(manifest.exports, targets)
  for (const entry of [manifest.main, manifest.module, manifest.types]) {
    if (entry !== undefined) {
      targets.add(entry)
    }
  }
  const missing = [...targets].filter((target) => !existsSync(resolve(PACKAGE_ROOT, target)))
  if (missing.length > 0) {
    fail(`the build left these paths missing: ${missing.join(', ')}`)
  }
}

/**
 * Rebuilds from the proto definitions and hands the package to npm. Meant to run in CI.
 * The CI guard keeps a stray local run from publishing; `--skip-check-ci` is the deliberate override.
 * `--only-check` runs every check and the build, then stops before publishing.
 */
const commandPublish = (onlyCheck: boolean, skipCheckCi: boolean) => {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest

  checkSchemaVersion()
  checkPackageVersion(manifest.version)
  checkWorktree()

  copyLicense()
  runNpm(['run', 'generate:proto'])
  runNpm(['run', 'build'])
  checkArtifacts(manifest)

  if (onlyCheck) {
    console.log(`release: ${manifest.version} is ready; stopped before publishing`)
    return
  }
  if (!skipCheckCi && !process.env.CI) {
    fail('publish runs in CI; pass --skip-check-ci to publish from a local machine')
  }
  runNpm(['publish'])
  console.log(`release: published ${manifest.version}`)
}

/**
 * Sets the package version and records the release in the changelog, then cuts the release commit and tag together so the tag and the published version never drift.
 * Meant to run locally; it does not push, leaving that to the author.
 */
const commandBump = (version: string | undefined) => {
  if (version === undefined) {
    return fail('usage: release bump <version>')
  }
  if (!isSemanticVersion(version)) {
    fail(`${JSON.stringify(version)} is not a semantic version`)
  }
  if (version === '0.0.0') {
    fail('0.0.0 is the placeholder, not a release version')
  }
  const tag = `${TAG_PREFIX}${version}`
  if (runGit(['tag', '--list', tag]) !== '') {
    fail(`tag ${tag} already exists`)
  }
  // The builder refuses to write a version twice, so its section is checked here to leave nothing half written.
  if (existsSync(CHANGE_LOG) && readFileSync(CHANGE_LOG, 'utf8').includes(`## v${version} (`)) {
    fail(`CHANGELOG.md already has a section for ${version}`)
  }
  checkWorktree()

  const text = readFileSync(MANIFEST, 'utf8')
  if ((JSON.parse(text) as Manifest).version === version) {
    fail(`package.json is already ${version}`)
  }
  writeFileSync(MANIFEST, text.replace(/("version":\s*)"[^"]*"/, `$1"${version}"`))
  run('python3', [CHANGE_LOG_BUILDER, 'node', version])

  run('git', ['add', 'package.json', 'CHANGELOG.md'])
  run('git', ['commit', '-m', `release(node): v${version}`])
  run('git', ['tag', tag])
  console.log(`release: tagged ${tag}; push the commit and the tag to publish`)
}

/**
 * Dispatches the two release modes and surfaces a usage line for anything else.
 */
const main = () => {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      'only-check': { type: 'boolean', default: false },
      'skip-check-ci': { type: 'boolean', default: false },
    },
  })
  const [command, version] = positionals
  switch (command) {
    case 'bump':
      return commandBump(version)
    case 'publish':
      return commandPublish(values['only-check'], values['skip-check-ci'])
    default:
      fail('usage: release <bump <version> | publish [--only-check] [--skip-check-ci]>')
  }
}

main()
