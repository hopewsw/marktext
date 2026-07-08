// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { decryptMdeBuffer } from '../../../src/main/crypto/mdeCrypto'
import { sessionVault } from '../../../src/main/crypto/sessionVault'
import { writeMdeFile, loadMdeFile, storeSessionFromHeader } from '../../../src/main/filesystem/mde'
import { encryptMarkdown } from '../../../src/main/crypto/mdeCrypto'

describe('mde filesystem', () => {
  let tmpDir: string

  beforeEach(async() => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'marktext-mde-'))
    sessionVault.clear()
  })

  afterEach(async() => {
    sessionVault.clear()
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('writes and reads via password', async() => {
    const filePath = path.join(tmpDir, 'note.mde')
    await writeMdeFile({ pathname: filePath, plaintext: '# Secret', password: 'pass1234' })

    const { plaintext } = await loadMdeFile(filePath, 'pass1234')
    expect(plaintext).toBe('# Secret')
  })

  it('writes atomically with session key reuse', async() => {
    const filePath = path.join(tmpDir, 'note.mde')
    const initial = encryptMarkdown('v1', 'pass1234')
    await fs.writeFile(filePath, initial)

    storeSessionFromHeader(filePath, 'pass1234', true, initial)
    await writeMdeFile({
      pathname: filePath,
      plaintext: 'v2',
      useSessionKey: true
    })

    const { plaintext } = await loadMdeFile(filePath, 'pass1234')
    expect(plaintext).toBe('v2')
  })

  it('creates bak on overwrite', async() => {
    const filePath = path.join(tmpDir, 'note.mde')
    await writeMdeFile({ pathname: filePath, plaintext: 'first', password: 'pass1234' })
    await writeMdeFile({ pathname: filePath, plaintext: 'second', password: 'pass1234' })

    const bakPath = `${filePath}.bak`
    const bak = await fs.readFile(bakPath)
    expect(decryptMdeBuffer(bak, 'pass1234').plaintext).toBe('first')
  })
})
