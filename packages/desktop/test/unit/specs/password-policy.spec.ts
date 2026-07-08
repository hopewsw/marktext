import { describe, it, expect } from 'vitest'
import {
  validatePassword,
  validatePasswordConfirmation
} from 'common/crypto/passwordPolicy'

describe('password policy', () => {
  it('accepts basic passwords', () => {
    expect(validatePassword('hello123', 'basic').valid).toBe(true)
  })

  it('rejects short basic passwords', () => {
    expect(validatePassword('hi1', 'basic').valid).toBe(false)
  })

  it('requires strong password complexity', () => {
    expect(validatePassword('HelloWorld1!', 'strong').valid).toBe(true)
    expect(validatePassword('hello123', 'strong').valid).toBe(false)
  })

  it('validates confirmation', () => {
    expect(validatePasswordConfirmation('abc12345', 'abc12345')).toBe(true)
    expect(validatePasswordConfirmation('abc12345', 'different')).toBe(false)
  })
})
