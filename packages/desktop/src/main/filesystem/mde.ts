import fs from 'fs/promises'
import path from 'path'
import log from 'electron-log'
import { isMdeBuffer, parseMdeFile, MdeFormatError } from 'common/crypto/mdeFormat'
import {
  encryptMarkdown,
  encryptMarkdownWithDerivedKey,
  decryptMdeBuffer,
  decryptMdeBufferWithKey,
  deriveKey,
  secureZero,
  MdeCryptoError
} from '../crypto/mdeCrypto'
import { sessionVault } from '../crypto/sessionVault'
import type { MdeDecryptResult } from '@shared/types/encryption'

export interface WriteMdeOptions {
  pbkdf2Iterations?: number
  keepBackup?: boolean
}

export interface WriteMdeParams {
  pathname: string
  plaintext: string
  password?: string
  useSessionKey?: boolean
  options?: WriteMdeOptions
}

const readFileBuffer = async(pathname: string): Promise<Buffer> => {
  return fs.readFile(pathname)
}

const fsyncFile = async(filePath: string): Promise<void> => {
  const handle = await fs.open(filePath, 'r+')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

export const peekMdeHeader = async(pathname: string) => {
  const data = await readFileBuffer(pathname)
  return parseMdeFile(data).header
}

export const loadMdeFile = async(
  pathname: string,
  password?: string
): Promise<MdeDecryptResult & { filename: string }> => {
  const data = await readFileBuffer(pathname)
  if (!isMdeBuffer(data)) {
    throw new MdeFormatError('MDE_BAD_MAGIC')
  }

  const session = sessionVault.get(pathname)
  if (session) {
    const result = decryptMdeBufferWithKey(data, session.derivedKey)
    return { ...result, filename: path.basename(pathname) }
  }

  if (!password) {
    throw new MdeCryptoError('MDE_DECRYPT_FAILED', 'Password required')
  }

  const result = decryptMdeBuffer(data, password)
  return { ...result, filename: path.basename(pathname) }
}

/**
 * Atomic write: tmp → verify decrypt → bak → rename.
 * Salt is stable across session saves (IV rotates each write).
 */
export const writeMdeFile = async({
  pathname,
  plaintext,
  password,
  useSessionKey = false,
  options = {}
}: WriteMdeParams): Promise<void> => {
  const { keepBackup = true, pbkdf2Iterations } = options
  const tmpPath = `${pathname}.tmp`
  const bakPath = `${pathname}.bak`

  let payload: Buffer
  const session = useSessionKey ? sessionVault.get(pathname) : null

  if (session) {
    payload = encryptMarkdownWithDerivedKey(
      plaintext,
      session.derivedKey,
      session.salt,
      session.pbkdf2Iterations,
      { pbkdf2Iterations }
    )
  } else if (password) {
    payload = encryptMarkdown(plaintext, password, { pbkdf2Iterations })
  } else {
    throw new MdeCryptoError('MDE_ENCRYPT_FAILED', 'No key or password')
  }

  try {
    await fs.writeFile(tmpPath, payload)
    await fsyncFile(tmpPath)

    const verifyBuf = await readFileBuffer(tmpPath)
    if (session) {
      decryptMdeBufferWithKey(verifyBuf, session.derivedKey)
    } else if (password) {
      decryptMdeBuffer(verifyBuf, password)
    } else {
      throw new MdeCryptoError('MDE_VERIFY_FAILED')
    }

    if (keepBackup) {
      try {
        await fs.access(pathname)
        await fs.copyFile(pathname, bakPath)
      } catch {
        // First save — no original file.
      }
    }

    await fs.rename(tmpPath, pathname)
  } catch (e) {
    try {
      await fs.unlink(tmpPath)
    } catch {
      // ignore
    }
    log.error('[MDE] write failed:', e)
    if (e instanceof MdeCryptoError || e instanceof MdeFormatError) throw e
    throw new MdeCryptoError('MDE_WRITE_FAILED', (e as Error).message)
  }
}

export const storeSessionFromHeader = (
  pathname: string,
  password: string,
  rememberSession: boolean,
  data: Buffer
): void => {
  const parsed = parseMdeFile(data)
  const derivedKey = deriveKey(password, parsed.header.salt, parsed.header.pbkdf2Iterations)
  sessionVault.set(
    pathname,
    derivedKey,
    parsed.header.salt,
    parsed.header.pbkdf2Iterations,
    rememberSession
  )
  secureZero(derivedKey)
}

export const storeSessionAfterWrite = async(
  pathname: string,
  password: string,
  rememberSession: boolean
): Promise<void> => {
  const data = await readFileBuffer(pathname)
  storeSessionFromHeader(pathname, password, rememberSession, data)
}
