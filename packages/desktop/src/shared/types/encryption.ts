/** .mde format constants and cross-process encryption types. */

export const MDE_FORMAT_VERSION = 1
export const MDE_HEADER_SIZE = 64
export const MDE_SALT_SIZE = 32
export const MDE_IV_SIZE = 12
export const MDE_GCM_TAG_SIZE = 16
export const MDE_MIN_FILE_SIZE = MDE_HEADER_SIZE + MDE_GCM_TAG_SIZE

export const MDE_KDF_PBKDF2_SHA256 = 1
export const MDE_CIPHER_AES_256_GCM = 1

export const MDE_DEFAULT_PBKDF2_ITERATIONS = 600_000

export const MDE_FLAG_UTF8 = 1 << 0

export type MdeErrorCode =
  | 'MDE_TOO_SMALL'
  | 'MDE_BAD_MAGIC'
  | 'MDE_UNSUPPORTED_VERSION'
  | 'MDE_UNSUPPORTED_KDF'
  | 'MDE_UNSUPPORTED_CIPHER'
  | 'MDE_DECRYPT_FAILED'
  | 'MDE_ENCRYPT_FAILED'
  | 'MDE_VERIFY_FAILED'
  | 'MDE_WRITE_FAILED'

export interface MdeHeader {
  formatVersion: number
  flags: number
  kdfId: number
  cipherId: number
  pbkdf2Iterations: number
  salt: Buffer
  iv: Buffer
}

export interface MdeParsedFile {
  header: MdeHeader
  ciphertext: Buffer
  authTag: Buffer
}

export interface MdeEncryptOptions {
  pbkdf2Iterations?: number
  flags?: number
  /** Reuse salt from an existing file (session save). IV is always rotated. */
  salt?: Buffer
}

export interface MdeDecryptResult {
  plaintext: string
  header: MdeHeader
}

export type PasswordStrengthLevel = 'basic' | 'strong'

export interface PasswordValidationResult {
  valid: boolean
  score: 0 | 1 | 2 | 3
  errors: string[]
}

export interface MdeUnlockRequest {
  pathname: string
  password: string
  rememberSession: boolean
}

export interface MdeUnlockResponse {
  markdown: string
  filename: string
}

export interface MdeChangePasswordRequest {
  pathname: string
  oldPassword: string
  newPassword: string
}

export interface MdeCreateEmptyRequest {
  pathname: string
  password: string
}

export interface MdeLockPayload {
  tabId: string
  pathname: string
}

export interface MdePromptUnlockPayload {
  tabId: string
  pathname: string
  filename: string
}

export interface EncryptionTabMeta {
  pbkdf2Iterations: number
  formatVersion: number
}
