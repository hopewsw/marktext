// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { isMdeBuffer } from 'common/crypto/mdeFormat'
import {
  encryptMarkdown,
  decryptMdeBuffer,
  MdeCryptoError
} from '../../../src/main/crypto/mdeCrypto'
import { MDE_MIN_FILE_SIZE } from '@shared/types/encryption'

describe('mde crypto', () => {
  it('round-trips plaintext', () => {
    const plain = '# Hello\n\nencrypted **world**'
    const password = 'correct horse 1'
    const blob = encryptMarkdown(plain, password)
    expect(isMdeBuffer(blob)).toBe(true)
    expect(blob.length).toBeGreaterThanOrEqual(MDE_MIN_FILE_SIZE)

    const { plaintext } = decryptMdeBuffer(blob, password)
    expect(plaintext).toBe(plain)
  })

  it('rejects wrong password', () => {
    const blob = encryptMarkdown('secret', 'password-a')
    expect(() => decryptMdeBuffer(blob, 'password-b')).toThrow(MdeCryptoError)
  })

  it('handles empty document', () => {
    const blob = encryptMarkdown('', 'pass1234')
    expect(decryptMdeBuffer(blob, 'pass1234').plaintext).toBe('')
  })
})
