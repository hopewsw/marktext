import fs from 'fs/promises'
import path from 'path'
import { ipcMain } from 'electron'
import { isMdeBuffer, parseMdeFile, MdeFormatError } from 'common/crypto/mdeFormat'
import { validatePassword } from 'common/crypto/passwordPolicy'
import {
  decryptMdeBuffer,
  deriveKey,
  secureZero,
  MdeCryptoError
} from '../crypto/mdeCrypto'
import { sessionVault } from '../crypto/sessionVault'
import {
  writeMdeFile,
  storeSessionFromHeader,
  storeSessionAfterWrite
} from '../filesystem/mde'
import type { PasswordStrengthLevel } from '@shared/types/encryption'
import {
  MDE_DEFAULT_PBKDF2_ITERATIONS,
  type MdeChangePasswordRequest,
  type MdeCreateEmptyRequest,
  type MdeLockPayload,
  type MdeUnlockRequest
} from '@shared/types/encryption'

type MdePreferencesReader = () => {
  encryptionPasswordStrength: PasswordStrengthLevel
  encryptionPbkdf2Iterations: number
}

let readMdePreferences: MdePreferencesReader | null = null

export const bindMdePreferences = (preferences: {
  getItem: (key: string) => unknown
}): void => {
  readMdePreferences = () => {
    const strength = preferences.getItem('encryptionPasswordStrength')
    return {
      encryptionPasswordStrength: strength === 'strong' ? 'strong' : 'basic',
      encryptionPbkdf2Iterations:
        Number(preferences.getItem('encryptionPbkdf2Iterations')) ||
        MDE_DEFAULT_PBKDF2_ITERATIONS
    }
  }
}

const getMdePreferences = (): ReturnType<MdePreferencesReader> =>
  readMdePreferences?.() ?? {
    encryptionPasswordStrength: 'basic',
    encryptionPbkdf2Iterations: MDE_DEFAULT_PBKDF2_ITERATIONS
  }

let appQuitHookReady = false

const ensureVaultQuitHook = (): void => {
  if (appQuitHookReady) return
  try {
    // Lazy import avoids loading electron app in unit tests.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as typeof import('electron')
    sessionVault.initAppQuitHook(app)
    appQuitHookReady = true
  } catch {
    // electron not available (tests)
  }
}

const assertPasswordStrength = (password: string): void => {
  const { encryptionPasswordStrength } = getMdePreferences()
  const result = validatePassword(password, encryptionPasswordStrength)
  if (!result.valid) {
    throw new Error('WEAK_PASSWORD')
  }
}

export const registerMdeHandlers = (): void => {
  ensureVaultQuitHook()

  ipcMain.handle('mt::mde::has-session-key', (_e, pathname: string) => {
    return sessionVault.has(pathname)
  })

  ipcMain.handle('mt::mde::is-encrypted-file', async(_e, pathname: string) => {
    try {
      const buf = await fs.readFile(pathname)
      return isMdeBuffer(buf)
    } catch {
      return false
    }
  })

  ipcMain.handle('mt::mde::unlock', async(_e, req: MdeUnlockRequest) => {
    const { pathname, password, rememberSession } = req
    const data = await fs.readFile(pathname)

    let result
    try {
      result = decryptMdeBuffer(data, password)
    } catch (e) {
      if (e instanceof MdeFormatError) throw e
      throw new MdeCryptoError('MDE_DECRYPT_FAILED')
    }

    storeSessionFromHeader(pathname, password, rememberSession, data)

    return {
      markdown: result.plaintext,
      filename: path.basename(pathname)
    }
  })

  ipcMain.handle('mt::mde::change-password', async(_e, req: MdeChangePasswordRequest) => {
    const { pathname, oldPassword, newPassword } = req
    assertPasswordStrength(newPassword)

    const data = await fs.readFile(pathname)
    const { plaintext } = decryptMdeBuffer(data, oldPassword)

    const { encryptionPbkdf2Iterations } = getMdePreferences()
    await writeMdeFile({
      pathname,
      plaintext,
      password: newPassword,
      options: { pbkdf2Iterations: encryptionPbkdf2Iterations }
    })

    const remember = sessionVault.has(pathname)
    await storeSessionAfterWrite(pathname, newPassword, remember)

    return { ok: true as const }
  })

  ipcMain.handle('mt::mde::create-empty', async(_e, req: MdeCreateEmptyRequest) => {
    const { pathname, password } = req
    assertPasswordStrength(password)

    const { encryptionPbkdf2Iterations } = getMdePreferences()
    await writeMdeFile({
      pathname,
      plaintext: '',
      password,
      options: { pbkdf2Iterations: encryptionPbkdf2Iterations }
    })

    await storeSessionAfterWrite(pathname, password, false)
    return { ok: true as const }
  })

  ipcMain.handle('mt::mde::has-backup', async(_e, pathname: string) => {
    try {
      await fs.access(`${pathname}.bak`)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('mt::mde::restore-from-backup', async(_e, pathname: string) => {
    const bakPath = `${pathname}.bak`
    await fs.copyFile(bakPath, pathname)
    return { ok: true as const }
  })

  ipcMain.on('mt::mde::lock', (_e, payload: MdeLockPayload) => {
    sessionVault.remove(payload.pathname)
  })
}

// Exported for tests — sync session store without IPC.
export const unlockForTest = (
  pathname: string,
  password: string,
  data: Buffer,
  rememberSession: boolean
): string => {
  const result = decryptMdeBuffer(data, password)
  storeSessionFromHeader(pathname, password, rememberSession, data)
  return result.plaintext
}

export const deriveKeyForTest = deriveKey

export { secureZero }
