<template>
  <div class="pref-security">
    <h4>{{ t('preferences.security.title') }}</h4>
    <p class="notes">
      {{ t('preferences.security.sessionNote') }}
    </p>

    <compound>
      <template #head>
        <h6 class="title">
          {{ t('preferences.security.autoLock.title') }}
        </h6>
      </template>
      <template #children>
        <bool
          :description="t('preferences.security.autoLock.enable')"
          :bool="encryptionAutoLock"
          :on-change="(value) => onSelectChange('encryptionAutoLock', value)"
        />
        <cur-select
          :description="t('preferences.security.autoLock.timeout')"
          :value="encryptionAutoLockTimeout"
          :options="getAutoLockTimeoutOptions()"
          :disable="!encryptionAutoLock"
          :on-change="(value) => onSelectChange('encryptionAutoLockTimeout', value)"
        />
        <bool
          :description="t('preferences.security.autoLock.saveBeforeLock')"
          :bool="encryptionAutoSaveBeforeLock"
          :disable="!encryptionAutoLock"
          :on-change="(value) => onSelectChange('encryptionAutoSaveBeforeLock', value)"
        />
        <bool
          :description="t('preferences.security.autoLock.lockOnBlur')"
          :bool="encryptionLockOnBlur"
          :on-change="(value) => onSelectChange('encryptionLockOnBlur', value)"
        />
        <bool
          :description="t('preferences.security.autoLock.lockOnTabClose')"
          :bool="encryptionLockOnTabClose"
          :on-change="(value) => onSelectChange('encryptionLockOnTabClose', value)"
        />
      </template>
    </compound>

    <compound>
      <template #head>
        <h6 class="title">
          {{ t('preferences.security.clipboard.title') }}
        </h6>
      </template>
      <template #children>
        <bool
          :description="t('preferences.security.clipboard.clearAfterCopy')"
          :bool="encryptionClearClipboardAfterCopy"
          :on-change="(value) => onSelectChange('encryptionClearClipboardAfterCopy', value)"
        />
        <cur-select
          :description="t('preferences.security.clipboard.clearDelay')"
          :value="encryptionClipboardClearDelay"
          :options="getClipboardClearDelayOptions()"
          :disable="!encryptionClearClipboardAfterCopy"
          :on-change="(value) => onSelectChange('encryptionClipboardClearDelay', value)"
        />
      </template>
    </compound>

    <compound>
      <template #head>
        <h6 class="title">
          {{ t('preferences.security.password.title') }}
        </h6>
      </template>
      <template #children>
        <cur-select
          :description="t('preferences.security.password.minimumStrength')"
          :value="encryptionPasswordStrength"
          :options="getPasswordStrengthOptions()"
          :on-change="(value) => onSelectChange('encryptionPasswordStrength', value)"
        />
        <cur-select
          :description="t('preferences.security.password.pbkdf2Iterations')"
          :value="encryptionPbkdf2Iterations"
          :options="getPbkdf2IterationsOptions()"
          :on-change="(value) => onSelectChange('encryptionPbkdf2Iterations', value)"
        />
      </template>
    </compound>

    <compound>
      <template #head>
        <h6 class="title">
          {{ t('preferences.security.storage.title') }}
        </h6>
      </template>
      <template #children>
        <bool
          :description="t('preferences.security.storage.keepBackup')"
          :bool="encryptionKeepBackup"
          :on-change="(value) => onSelectChange('encryptionKeepBackup', value)"
        />
        <bool
          :description="t('preferences.security.storage.showLockIcon')"
          :bool="encryptionShowLockIcon"
          :on-change="(value) => onSelectChange('encryptionShowLockIcon', value)"
        />
      </template>
    </compound>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { usePreferencesStore, type PreferencesState } from '@/store/preferences'
import { useI18n } from 'vue-i18n'
import Compound from '../common/compound/index.vue'
import Bool from '../common/bool/index.vue'
import CurSelect from '../common/select/index.vue'
import {
  getAutoLockTimeoutOptions,
  getClipboardClearDelayOptions,
  getPasswordStrengthOptions,
  getPbkdf2IterationsOptions
} from './config'

const { t } = useI18n()
const preferenceStore = usePreferencesStore()

const {
  encryptionAutoLock,
  encryptionAutoLockTimeout,
  encryptionAutoSaveBeforeLock,
  encryptionLockOnBlur,
  encryptionLockOnTabClose,
  encryptionClearClipboardAfterCopy,
  encryptionClipboardClearDelay,
  encryptionPasswordStrength,
  encryptionPbkdf2Iterations,
  encryptionKeepBackup,
  encryptionShowLockIcon
} = storeToRefs(preferenceStore)

const onSelectChange = (type: keyof PreferencesState, value: unknown): void => {
  preferenceStore.SET_SINGLE_PREFERENCE({ type, value })
}
</script>

<style scoped>
.pref-security .notes {
  margin: 8px 0 20px;
  font-size: 13px;
  color: var(--editorColor80);
}
</style>
