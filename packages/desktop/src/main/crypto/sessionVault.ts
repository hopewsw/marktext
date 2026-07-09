import path from 'path'
import type { App } from 'electron'
import { secureZero } from './mdeCrypto'

export interface SessionEntry {
  derivedKey: Buffer
  salt: Buffer
  pbkdf2Iterations: number
  rememberSession: boolean
  lastAccess: number
}

/**
 * In-memory session key vault (mode 1 only).
 * No disk, keytar, or electron-store usage.
 */
class SessionVault {
  private entries = new Map<string, SessionEntry>()
  private quitHookRegistered = false

  initAppQuitHook(app: App): void {
    if (this.quitHookRegistered) return
    app.on('will-quit', () => this.clear())
    this.quitHookRegistered = true
  }

  private normalizeKey(pathname: string): string {
    return path.resolve(pathname).toLowerCase()
  }

  get(pathname: string): SessionEntry | null {
    const key = this.normalizeKey(pathname)
    const entry = this.entries.get(key)
    if (!entry) return null
    entry.lastAccess = Date.now()
    return entry
  }

  has(pathname: string): boolean {
    return this.entries.has(this.normalizeKey(pathname))
  }

  set(
    pathname: string,
    derivedKey: Buffer,
    salt: Buffer,
    pbkdf2Iterations: number,
    rememberSession: boolean
  ): void {
    const key = this.normalizeKey(pathname)
    this.removeEntry(key)

    this.entries.set(key, {
      derivedKey: Buffer.from(derivedKey),
      salt: Buffer.from(salt),
      pbkdf2Iterations,
      rememberSession,
      lastAccess: Date.now()
    })
  }

  remove(pathname: string): void {
    this.removeEntry(this.normalizeKey(pathname))
  }

  /** Move a session entry when the file on disk is renamed. */
  rename(oldPathname: string, newPathname: string): void {
    const oldKey = this.normalizeKey(oldPathname)
    const entry = this.entries.get(oldKey)
    if (!entry) return
    this.entries.delete(oldKey)
    this.entries.set(this.normalizeKey(newPathname), entry)
  }

  clear(): void {
    for (const key of [...this.entries.keys()]) {
      this.removeEntry(key)
    }
  }

  private removeEntry(key: string): void {
    const entry = this.entries.get(key)
    if (!entry) return
    secureZero(entry.derivedKey)
    secureZero(entry.salt)
    this.entries.delete(key)
  }
}

export const sessionVault = new SessionVault()
