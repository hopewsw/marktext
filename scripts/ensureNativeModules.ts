#!/usr/bin/env node
/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-require-imports */
// @ts-nocheck
/**
 * Stage prebuilt native-module binaries and rebuild only when still missing.
 *
 * electron-rebuild needs a C++ toolchain (Visual Studio on Windows). ced and
 * native-keymap ship ABI-matched prebuilds under bin/{platform}-{arch}-{abi}/,
 * and keytar ships NAPI prebuilds via prebuild-install. When those artifacts
 * are already present we copy or fetch them into the build/Release paths the
 * runtime loaders expect, skipping a full rebuild.
 */

const { execSync, spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const repoRoot = path.join(__dirname, '..')
const desktopRoot = path.join(repoRoot, 'packages', 'desktop')
const nodeModules = path.join(desktopRoot, 'node_modules')
const ext = process.platform === 'win32' ? '.cmd' : ''
const electronRebuildBin = path.join(nodeModules, '.bin', `electron-rebuild${ext}`)

function run(cmd, opts = {}) {
  const { cwd = desktopRoot, env = {} } = opts
  execSync(cmd, { stdio: 'inherit', cwd, env: { ...process.env, ...env } })
}

function exists(filePath) {
  try {
    fs.accessSync(filePath)
    return true
  } catch {
    return false
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function copyIfMissing(source, target) {
  if (!exists(source)) {
    return false
  }
  if (exists(target)) {
    return true
  }
  ensureDir(path.dirname(target))
  fs.copyFileSync(source, target)
  console.log(`Staged native module: ${path.relative(desktopRoot, target)}`)
  return true
}

function getElectronBinary() {
  const electronRoot = path.join(nodeModules, 'electron')
  const candidates = []

  const pathTxt = path.join(electronRoot, 'path.txt')
  if (exists(pathTxt)) {
    const rel = fs.readFileSync(pathTxt, 'utf8').trim()
    candidates.push(path.join(electronRoot, rel))
    candidates.push(path.join(electronRoot, 'dist', path.basename(rel)))
  }

  if (process.platform === 'win32') {
    candidates.push(path.join(electronRoot, 'dist', 'electron.exe'))
  } else if (process.platform === 'darwin') {
    candidates.push(
      path.join(electronRoot, 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron')
    )
  } else {
    candidates.push(path.join(electronRoot, 'dist', 'electron'))
  }

  const electronBinary = candidates.find(exists)
  if (!electronBinary) {
    return candidates[0] || path.join(electronRoot, 'dist', 'electron')
  }
  return electronBinary
}

function getElectronAbi() {
  const electronBinary = getElectronBinary()
  if (!exists(electronBinary)) {
    throw new Error(
      'Electron binary not found. Run pnpm install (or scripts/postinstall.ts) first.'
    )
  }
  const result = spawnSync(electronBinary, ['-e', 'console.log(process.versions.modules)'], {
    encoding: 'utf8',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  })
  if (result.status !== 0) {
    throw new Error(
      `Failed to query Electron ABI: ${result.stderr || result.stdout || result.status}`
    )
  }
  return result.stdout.trim()
}

function stagePrebuiltModules(abi) {
  const platformArch = `${process.platform}-${process.arch}-${abi}`

  copyIfMissing(
    path.join(nodeModules, 'ced', 'bin', platformArch, 'ced.node'),
    path.join(nodeModules, 'ced', 'build', 'Release', 'ced.node')
  )

  copyIfMissing(
    path.join(nodeModules, 'native-keymap', 'bin', platformArch, 'native-keymap.node'),
    path.join(nodeModules, 'native-keymap', 'build', 'Release', 'keymapping.node')
  )
}

function ensureKeytarPrebuild() {
  const target = path.join(nodeModules, 'keytar', 'build', 'Release', 'keytar.node')
  if (exists(target)) {
    return
  }
  const prebuildInstall = path.join(nodeModules, '.bin', `prebuild-install${ext}`)
  if (!exists(prebuildInstall)) {
    return
  }
  console.log('Fetching keytar prebuild via prebuild-install...')
  run(`"${prebuildInstall}"`, { cwd: path.join(nodeModules, 'keytar') })
}

const requiredModules = [
  ['ced', path.join('ced', 'build', 'Release', 'ced.node')],
  ['keytar', path.join('keytar', 'build', 'Release', 'keytar.node')],
  ['native-keymap', path.join('native-keymap', 'build', 'Release', 'keymapping.node')]
]

function missingModules() {
  return requiredModules
    .filter(([, relPath]) => !exists(path.join(nodeModules, relPath)))
    .map(([name]) => name)
}

const forceRebuild = process.argv.includes('--force')
const abi = getElectronAbi()
console.log(`Electron ABI: ${abi}`)

stagePrebuiltModules(abi)
ensureKeytarPrebuild()

const missing = missingModules()
if (!forceRebuild && missing.length === 0) {
  console.log('Native modules ready; skipping electron-rebuild.')
  process.exit(0)
}

if (missing.length > 0) {
  console.log(`Missing native modules: ${missing.join(', ')}`)
}

console.log('Running electron-rebuild...')
try {
  run(`"${electronRebuildBin}"${forceRebuild ? ' -f' : ''}`)
} catch {
  const stillMissing = missingModules()
  if (stillMissing.length === 0) {
    console.log('electron-rebuild failed, but all required native modules are present.')
    process.exit(0)
  }
  console.error(
    '\nNative module rebuild failed and required binaries are still missing.\n' +
      `Still missing: ${stillMissing.join(', ')}\n\n` +
      'Windows: install "Desktop development with C++" from Visual Studio 2022 Build Tools.\n' +
      'See packages/website/content/docs/dev/BUILD.md for full prerequisites.\n'
  )
  process.exit(1)
}
