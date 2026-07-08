import { randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv } from 'crypto'
import {
  MDE_DEFAULT_PBKDF2_ITERATIONS,
  MDE_GCM_TAG_SIZE,
  type MdeDecryptResult,
  type MdeEncryptOptions,
  type MdeErrorCode,
  type MdeHeader
} from '@shared/types/encryption'
import {
  parseMdeFile,
  serializeMdeFile,
  createDefaultHeaderFields,
  MdeFormatError
} from 'common/crypto/mdeFormat'

export class MdeCryptoError extends Error {
  constructor(
    public readonly code: MdeErrorCode,
    message?: string
  ) {
    super(message ?? code)
    this.name = 'MdeCryptoError'
  }
}

export const deriveKey = (password: string, salt: Buffer, iterations: number): Buffer => {
  return pbkdf2Sync(password, salt, iterations, 32, 'sha256')
}

export const secureZero = (buf: Buffer): void => {
  buf.fill(0)
}

const encryptWithDerivedKey = (
  plaintext: string,
  derivedKey: Buffer,
  headerFields: Omit<MdeHeader, 'formatVersion'>
): Buffer => {
  headerFields.iv = randomBytes(headerFields.iv.length)

  const cipher = createCipheriv('aes-256-gcm', derivedKey, headerFields.iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  if (authTag.length !== MDE_GCM_TAG_SIZE) {
    throw new MdeCryptoError('MDE_ENCRYPT_FAILED')
  }
  return serializeMdeFile({ header: headerFields, ciphertext, authTag })
}

export const encryptMarkdown = (
  plaintext: string,
  password: string,
  options: MdeEncryptOptions = {}
): Buffer => {
  const iterations = options.pbkdf2Iterations ?? MDE_DEFAULT_PBKDF2_ITERATIONS
  const headerFields = createDefaultHeaderFields(iterations)
  headerFields.salt = options.salt
    ? Buffer.from(options.salt)
    : randomBytes(headerFields.salt.length)
  if (options.flags != null) headerFields.flags = options.flags

  const key = deriveKey(password, headerFields.salt, iterations)
  try {
    return encryptWithDerivedKey(plaintext, key, headerFields)
  } catch (e) {
    if (e instanceof MdeFormatError || e instanceof MdeCryptoError) throw e
    throw new MdeCryptoError('MDE_ENCRYPT_FAILED', (e as Error).message)
  } finally {
    secureZero(key)
  }
}

/** Session save: reuse salt + derived key; rotate IV only. */
export const encryptMarkdownWithDerivedKey = (
  plaintext: string,
  derivedKey: Buffer,
  salt: Buffer,
  pbkdf2Iterations: number,
  options: MdeEncryptOptions = {}
): Buffer => {
  const headerFields = createDefaultHeaderFields(pbkdf2Iterations)
  headerFields.salt = Buffer.from(salt)
  if (options.flags != null) headerFields.flags = options.flags
  return encryptWithDerivedKey(plaintext, derivedKey, headerFields)
}

export const decryptMdeBuffer = (data: Buffer, password: string): MdeDecryptResult => {
  let key: Buffer | null = null
  try {
    const parsed = parseMdeFile(data)
    key = deriveKey(password, parsed.header.salt, parsed.header.pbkdf2Iterations)

    const decipher = createDecipheriv('aes-256-gcm', key, parsed.header.iv)
    decipher.setAuthTag(parsed.authTag)
    const plaintextBuf = Buffer.concat([decipher.update(parsed.ciphertext), decipher.final()])
    return {
      plaintext: plaintextBuf.toString('utf8'),
      header: parsed.header
    }
  } catch (e) {
    if (e instanceof MdeFormatError) throw e
    throw new MdeCryptoError('MDE_DECRYPT_FAILED')
  } finally {
    if (key) secureZero(key)
  }
}

export const decryptMdeBufferWithKey = (data: Buffer, derivedKey: Buffer): MdeDecryptResult => {
  try {
    const parsed = parseMdeFile(data)
    const decipher = createDecipheriv('aes-256-gcm', derivedKey, parsed.header.iv)
    decipher.setAuthTag(parsed.authTag)
    const plaintextBuf = Buffer.concat([decipher.update(parsed.ciphertext), decipher.final()])
    return { plaintext: plaintextBuf.toString('utf8'), header: parsed.header }
  } catch (e) {
    if (e instanceof MdeFormatError) throw e
    throw new MdeCryptoError('MDE_DECRYPT_FAILED')
  }
}
