// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  isMdeBuffer,
  parseMdeFile,
  serializeMdeFile,
  createDefaultHeaderFields,
  MdeFormatError,
  MDE_MAGIC
} from 'common/crypto/mdeFormat'
import { MDE_MIN_FILE_SIZE, MDE_GCM_TAG_SIZE } from '@shared/types/encryption'

describe('mde format', () => {
  it('detects magic bytes', () => {
    const buf = Buffer.alloc(MDE_MIN_FILE_SIZE)
    MDE_MAGIC.copy(buf, 0)
    expect(isMdeBuffer(buf)).toBe(true)
    expect(isMdeBuffer(Buffer.from('plain'))).toBe(false)
  })

  it('round-trips header and payload layout', () => {
    const header = createDefaultHeaderFields()
    header.salt.fill(1)
    header.iv.fill(2)
    const ciphertext = Buffer.from([1, 2, 3])
    const authTag = Buffer.alloc(MDE_GCM_TAG_SIZE, 9)

    const blob = serializeMdeFile({ header, ciphertext, authTag })
    expect(blob.length).toBe(MDE_MIN_FILE_SIZE + 3)

    const parsed = parseMdeFile(blob)
    expect(parsed.header.pbkdf2Iterations).toBe(header.pbkdf2Iterations)
    expect(parsed.ciphertext.equals(ciphertext)).toBe(true)
    expect(parsed.authTag.equals(authTag)).toBe(true)
  })

  it('rejects truncated files', () => {
    expect(() => parseMdeFile(Buffer.alloc(10))).toThrow(MdeFormatError)
  })
})
