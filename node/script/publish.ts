import { PACKAGE_ROOT, REPO_ROOT, VERSION_MODULE, fail, isSemanticVersion, readSchemaVersion, readText, renderVersionModule } from './utils'

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type Manifest = {
  version: string
  main?: string
  module?: string
  types?: string
  exports?: unknown
}

const run = (command: string, args: string[], cwd = PACKAGE_ROOT) => {
  try {
    execFileSync(command, args, { cwd, stdio: 'inherit' })
  } catch (error) {
    fail(`\`${[command, ...args].join(' ')}\` failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Runs an npm subcommand through the very executable that invoked this script.
 * Windows refuses to spawn `npm.cmd` without a shell, and the path npm exports avoids needing one.
 */
const runNpm = (args: string[]) => {
  const execpath = process.env.npm_execpath ?? fail('run this through `npm run release`, which tells the script where npm lives')
  run(process.execPath, [execpath, ...args])
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
 * Nothing else produces it, so publishing by hand would ship a package whose stated licence is missing.
 */
const copyLicense = () => {
  const source = resolve(REPO_ROOT, 'LICENSE')
  if (!existsSync(source)) {
    fail('the repository root has no LICENSE to copy')
  }
  copyFileSync(source, resolve(PACKAGE_ROOT, 'LICENSE'))
}

/**
 * Publishing from a dirty tree ships files no commit records, leaving a tarball nobody can reproduce.
 */
const checkWorktree = () => {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT, encoding: 'utf8' })
  if (status.trim() !== '') {
    fail(`the worktree has uncommitted changes:\n${status.trimEnd()}`)
  }
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
 * Checks what publishing cannot take back, rebuilds from the proto definitions, then hands the package to npm.
 * Releases must go through here: the licence beside the package is written by this script and tracked nowhere else.
 * `--check` stops after the rebuild and its checks; every other argument goes to `npm publish` as given.
 */
const main = () => {
  const args = process.argv.slice(2)
  const checkOnly = args.includes('--check')
  const manifest = JSON.parse(readFileSync(resolve(PACKAGE_ROOT, 'package.json'), 'utf8')) as Manifest

  checkSchemaVersion()
  checkPackageVersion(manifest.version)
  checkWorktree()

  copyLicense()
  runNpm(['run', 'generate:proto'])
  runNpm(['run', 'build'])
  checkArtifacts(manifest)

  if (checkOnly) {
    console.log(`publish: ${manifest.version} is ready; stopped before publishing`)
    return
  }
  runNpm(['publish', ...args])
}

main()
