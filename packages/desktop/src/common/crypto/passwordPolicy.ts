import type { PasswordStrengthLevel, PasswordValidationResult } from '@shared/types/encryption'

const hasLetter = (s: string): boolean => /[A-Za-z]/.test(s)
const hasDigit = (s: string): boolean => /\d/.test(s)
const hasLower = (s: string): boolean => /[a-z]/.test(s)
const hasUpper = (s: string): boolean => /[A-Z]/.test(s)
const hasSymbol = (s: string): boolean => /[^A-Za-z0-9]/.test(s)

export const validatePassword = (
  password: string,
  level: PasswordStrengthLevel = 'basic'
): PasswordValidationResult => {
  const errors: string[] = []

  if (level === 'basic') {
    if (password.length < 8) errors.push('min_length_8')
    if (!hasLetter(password)) errors.push('need_letter')
    if (!hasDigit(password)) errors.push('need_digit')
  } else {
    if (password.length < 12) errors.push('min_length_12')
    if (!hasLower(password)) errors.push('need_lower')
    if (!hasUpper(password)) errors.push('need_upper')
    if (!hasDigit(password)) errors.push('need_digit')
    if (!hasSymbol(password)) errors.push('need_symbol')
  }

  const valid = errors.length === 0
  let score: 0 | 1 | 2 | 3 = 0
  if (password.length >= 8) score = 1
  if (valid && level === 'basic') score = 2
  if (valid && level === 'strong') score = 3
  if (!valid && password.length >= 8 && hasLetter(password) && hasDigit(password)) score = 1

  return { valid, score, errors }
}

export const validatePasswordConfirmation = (password: string, confirm: string): boolean => {
  return password === confirm && password.length > 0
}
