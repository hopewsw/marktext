import { t } from '../../i18n'
import type { PrefSelectOption } from '../common/types'

export const getAutoLockTimeoutOptions = (): PrefSelectOption<number>[] => [
  { label: t('preferences.security.autoLockTimeout.1min'), value: 60_000 },
  { label: t('preferences.security.autoLockTimeout.5min'), value: 300_000 },
  { label: t('preferences.security.autoLockTimeout.15min'), value: 900_000 },
  { label: t('preferences.security.autoLockTimeout.30min'), value: 1_800_000 },
  { label: t('preferences.security.autoLockTimeout.60min'), value: 3_600_000 }
]

export const getClipboardClearDelayOptions = (): PrefSelectOption<number>[] => [
  { label: t('preferences.security.clipboardClearDelay.10s'), value: 10_000 },
  { label: t('preferences.security.clipboardClearDelay.30s'), value: 30_000 },
  { label: t('preferences.security.clipboardClearDelay.60s'), value: 60_000 },
  { label: t('preferences.security.clipboardClearDelay.120s'), value: 120_000 }
]

export const getPasswordStrengthOptions = (): PrefSelectOption<string>[] => [
  { label: t('preferences.security.passwordStrength.basic'), value: 'basic' },
  { label: t('preferences.security.passwordStrength.strong'), value: 'strong' }
]

export const getPbkdf2IterationsOptions = (): PrefSelectOption<number>[] => [
  { label: t('preferences.security.pbkdf2Iterations.100k'), value: 100_000 },
  { label: t('preferences.security.pbkdf2Iterations.300k'), value: 300_000 },
  { label: t('preferences.security.pbkdf2Iterations.600k'), value: 600_000 },
  { label: t('preferences.security.pbkdf2Iterations.1m'), value: 1_000_000 }
]
