import fs from 'fs'
import path from 'path'
import { isFile, isFile2, isSymbolicLink } from './index'
import { minimatch } from 'minimatch'

const isOsx = process.platform === 'darwin'

export const MARKDOWN_EXTENSIONS: readonly string[] = Object.freeze([
  'markdown',
  'mdown',
  'mkdn',
  'md',
  'mkd',
  'mdwn',
  'mdtxt',
  'mdtext',
  'mdx',
  'text',
  'txt'
])

export const MARKDOWN_INCLUSIONS: readonly string[] = Object.freeze(
  MARKDOWN_EXTENSIONS.map((x) => '*.' + x)
)

export const ENCRYPTED_MARKDOWN_EXTENSIONS: readonly string[] = Object.freeze(['mde'])

export const ENCRYPTED_MARKDOWN_INCLUSIONS: readonly string[] = Object.freeze(
  ENCRYPTED_MARKDOWN_EXTENSIONS.map((x) => '*.' + x)
)

export const IMAGE_EXTENSIONS: readonly string[] = Object.freeze([
  'jpeg',
  'jpg',
  'png',
  'gif',
  'svg',
  'webp'
])

// Extensions the OS shell will execute rather than open in an application.
// Opening one of these via shell.openPath runs code, so a markdown link
// pointing at a co-located script/executable must be confirmed first (#3575).
// The vulnerable path is cross-platform, so the list covers Windows, macOS and
// Linux launchers — not just Windows.
export const DANGEROUS_EXECUTABLE_EXTENSIONS: readonly string[] = Object.freeze([
  // Windows — native executables, installers and control-panel items
  'exe',
  'com',
  'scr',
  'pif',
  'cpl',
  'msi',
  'msp',
  'msc',
  'gadget',
  'application',
  // Windows — shell / batch
  'bat',
  'cmd',
  // Windows Script Host
  'js',
  'jse',
  'vbs',
  'vbe',
  'wsf',
  'wsh',
  'ws',
  'wsc',
  'hta',
  // PowerShell
  'ps1',
  'ps1xml',
  'ps2',
  'ps2xml',
  'psc1',
  'psc2',
  'psd1',
  'psm1',
  // Windows — shortcuts, registry and JVM launchers
  'lnk',
  'inf',
  'reg',
  'scf',
  'jar',
  'jnlp',
  // macOS — Terminal scripts and app bundles
  'command',
  'app',
  // Linux — desktop entries and self-contained executables
  'desktop',
  'appimage',
  'run'
])

/**
 * Returns true if the path's extension is one the OS will execute as code
 * (script or binary), so opening it warrants a confirmation prompt.
 */
export const isDangerousExecutableFile = (filepath: string): boolean => {
  if (!filepath || typeof filepath !== 'string') return false
  // Windows strips trailing dots/spaces during ShellExecute canonicalization,
  // so `update.js.` / `<./update.js >` still run `update.js` — strip them
  // before reading the extension or the guard is trivially bypassed.
  const ext = path.extname(filepath.replace(/[ .]+$/, '')).slice(1).toLowerCase()
  return !!ext && DANGEROUS_EXECUTABLE_EXTENSIONS.includes(ext)
}

/**
 * Returns true if the filename matches one of the markdown extensions.
 */
export const hasMarkdownExtension = (filename: string): boolean => {
  if (!filename || typeof filename !== 'string') return false
  return MARKDOWN_EXTENSIONS.some((ext) => filename.toLowerCase().endsWith(`.${ext}`))
}

export const hasEncryptedMarkdownExtension = (filename: string): boolean => {
  if (!filename || typeof filename !== 'string') return false
  return ENCRYPTED_MARKDOWN_EXTENSIONS.some((ext) =>
    filename.toLowerCase().endsWith(`.${ext}`)
  )
}

/** True for sidebar/editor openable document extensions (.md, .mde, …). */
export const hasOpenableDocumentExtension = (filename: string): boolean => {
  return hasMarkdownExtension(filename) || hasEncryptedMarkdownExtension(filename)
}

/**
 * Returns true if the path is an encrypted markdown file or symlink to one.
 */
export const isEncryptedMarkdownFile = (filepath: string): boolean => {
  if (!isFile2(filepath)) return false

  if (isSymbolicLink(filepath)) {
    const targetPath = path.resolve(path.dirname(filepath), fs.readlinkSync(filepath))
    return isFile(targetPath) && hasEncryptedMarkdownExtension(targetPath)
  }
  return hasEncryptedMarkdownExtension(filepath)
}

export const isOpenableDocumentFile = (filepath: string): boolean => {
  return isMarkdownFile(filepath) || isEncryptedMarkdownFile(filepath)
}

/**
 * Returns true if the path is an image file.
 */
export const isImageFile = (filepath: string): boolean => {
  const ext = path.extname(filepath).slice(1).toLowerCase()
  return !!ext && IMAGE_EXTENSIONS.includes(ext) && isFile(filepath)
}

/**
 * Returns true if the path is a markdown file or symbolic link to one.
 */
export const isMarkdownFile = (filepath: string): boolean => {
  if (!isFile2(filepath)) return false

  if (isSymbolicLink(filepath)) {
    const targetPath = path.resolve(path.dirname(filepath), fs.readlinkSync(filepath))
    return isFile(targetPath) && hasMarkdownExtension(targetPath)
  }
  return hasMarkdownExtension(filepath)
}

/**
 * Check if the both paths point to the same file.
 */
export const isSamePathSync = (
  pathA: string,
  pathB: string,
  isNormalized: boolean = false
): boolean => {
  if (!pathA || !pathB) return false
  const a = isNormalized ? pathA : path.normalize(pathA)
  const b = isNormalized ? pathB : path.normalize(pathB)
  if (a.length !== b.length) {
    return false
  } else if (a === b) {
    return true
  } else if (a.toLowerCase() === b.toLowerCase()) {
    try {
      const fiA = fs.statSync(a)
      const fiB = fs.statSync(b)
      return fiA.ino === fiB.ino
    } catch {
      // Ignore stat errors and fall through.
    }
  }
  return false
}

/**
 * Check whether a file or directory is a child of the given directory.
 */
export const isChildOfDirectory = (dir: string, child: string): boolean => {
  if (!dir || !child) return false
  const relative = path.relative(dir, child)
  return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative)
}

export const getResourcesPath = (): string => {
  let resPath = process.resourcesPath
  if (process.env.NODE_ENV === 'development') {
    // Default locations:
    //   Linux/Windows: node_modules/electron/dist/resources/
    //   macOS: node_modules/electron/dist/Electron.app/Contents/Resources
    if (isOsx) {
      resPath = path.join(resPath, '../..')
    }
    resPath = path.join(resPath, '../../../../resources')
  }
  return resPath
}

/**
 * Returns true if the pathname matches one of the exclude patterns.
 */
export const checkPathExcludePattern = (pathname: string, patterns: readonly string[]): boolean => {
  if (!pathname || typeof pathname !== 'string') return false
  for (const pattern of patterns) {
    if (minimatch(pathname, pattern, { matchBase: true })) {
      return true
    }
  }
  return false
}
