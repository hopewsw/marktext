import {
  MDE_FORMAT_VERSION,
  MDE_HEADER_SIZE,
  MDE_SALT_SIZE,
  MDE_IV_SIZE,
  MDE_GCM_TAG_SIZE,
  MDE_MIN_FILE_SIZE,
  MDE_KDF_PBKDF2_SHA256,
  MDE_CIPHER_AES_256_GCM,
  MDE_DEFAULT_PBKDF2_ITERATIONS,
  MDE_FLAG_UTF8,
  type MdeHeader,
  type MdeParsedFile,
  type MdeErrorCode
} from '@shared/types/encryption'

/** Magic bytes: "MDE\x01" */
export const MDE_MAGIC = Buffer.from([0x4d, 0x44, 0x45, 0x01])

export class MdeFormatError extends Error {
  constructor(
    public readonly code: MdeErrorCode,
    message?: string
  ) {
    super(message ?? code)
    this.name = 'MdeFormatError'
  }
}

export const isMdeBuffer = (buf: Buffer): boolean => {
  return buf.length >= MDE_MAGIC.length && buf.subarray(0, 4).equals(MDE_MAGIC)
}

export const parseMdeFile = (data: Buffer): MdeParsedFile => {
  if (data.length < MDE_MIN_FILE_SIZE) {
    throw new MdeFormatError('MDE_TOO_SMALL', `Expected >= ${MDE_MIN_FILE_SIZE} bytes`)
  }
  if (!isMdeBuffer(data)) {
    throw new MdeFormatError('MDE_BAD_MAGIC')
  }

  const formatVersion = data.readUInt16LE(4)
  const headerLength = data.readUInt16LE(6)
  if (formatVersion !== MDE_FORMAT_VERSION || headerLength !== MDE_HEADER_SIZE) {
    throw new MdeFormatError('MDE_UNSUPPORTED_VERSION')
  }

  const flags = data.readUInt32LE(8)
  const kdfId = data.readUInt8(12)
  const cipherId = data.readUInt8(13)
  if (kdfId !== MDE_KDF_PBKDF2_SHA256) {
    throw new MdeFormatError('MDE_UNSUPPORTED_KDF')
  }
  if (cipherId !== MDE_CIPHER_AES_256_GCM) {
    throw new MdeFormatError('MDE_UNSUPPORTED_CIPHER')
  }

  const pbkdf2Iterations = data.readUInt32LE(16)
  const salt = Buffer.from(data.subarray(20, 20 + MDE_SALT_SIZE))
  const iv = Buffer.from(data.subarray(52, 52 + MDE_IV_SIZE))

  const payloadStart = MDE_HEADER_SIZE
  const payloadEnd = data.length - MDE_GCM_TAG_SIZE
  if (payloadEnd < payloadStart) {
    throw new MdeFormatError('MDE_TOO_SMALL')
  }

  const ciphertext = data.subarray(payloadStart, payloadEnd)
  const authTag = data.subarray(payloadEnd)

  return {
    header: { formatVersion, flags, kdfId, cipherId, pbkdf2Iterations, salt, iv },
    ciphertext,
    authTag
  }
}

export interface SerializeMdeParams {
  header: Omit<MdeHeader, 'formatVersion'>
  ciphertext: Buffer
  authTag: Buffer
}

export const serializeMdeFile = ({ header, ciphertext, authTag }: SerializeMdeParams): Buffer => {
  if (authTag.length !== MDE_GCM_TAG_SIZE) {
    throw new MdeFormatError('MDE_ENCRYPT_FAILED', 'Invalid GCM tag length')
  }

  const buf = Buffer.alloc(MDE_HEADER_SIZE + ciphertext.length + MDE_GCM_TAG_SIZE)
  MDE_MAGIC.copy(buf, 0)
  buf.writeUInt16LE(MDE_FORMAT_VERSION, 4)
  buf.writeUInt16LE(MDE_HEADER_SIZE, 6)
  buf.writeUInt32LE(header.flags, 8)
  buf.writeUInt8(header.kdfId, 12)
  buf.writeUInt8(header.cipherId, 13)
  buf.writeUInt16LE(0, 14)
  buf.writeUInt32LE(header.pbkdf2Iterations, 16)
  header.salt.copy(buf, 20)
  header.iv.copy(buf, 52)
  ciphertext.copy(buf, MDE_HEADER_SIZE)
  authTag.copy(buf, MDE_HEADER_SIZE + ciphertext.length)
  return buf
}

export const createDefaultHeaderFields = (
  pbkdf2Iterations = MDE_DEFAULT_PBKDF2_ITERATIONS
): Omit<MdeHeader, 'formatVersion'> => ({
  flags: MDE_FLAG_UTF8,
  kdfId: MDE_KDF_PBKDF2_SHA256,
  cipherId: MDE_CIPHER_AES_256_GCM,
  pbkdf2Iterations,
  salt: Buffer.alloc(MDE_SALT_SIZE),
  iv: Buffer.alloc(MDE_IV_SIZE)
})
