<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="420px"
    :close-on-click-modal="false"
    @closed="resetForm"
  >
    <p
      v-if="filename"
      class="file-name"
    >
      {{ filename }}
    </p>
    <p
      v-if="mode === 'set-password' || mode === 'create-file'"
      class="warning"
    >
      {{ t('encryption.dataLossWarning') }}
    </p>
    <el-form @submit.prevent="submit">
      <el-form-item
        v-if="mode === 'change-password'"
        :label="t('encryption.currentPassword')"
      >
        <el-input
          v-model="currentPassword"
          type="password"
          show-password
          autocomplete="off"
        />
      </el-form-item>
      <el-form-item :label="passwordLabel">
        <el-input
          v-model="password"
          type="password"
          show-password
          autocomplete="off"
        />
      </el-form-item>
      <el-form-item
        v-if="mode !== 'unlock'"
        :label="t('encryption.confirmPassword')"
      >
        <el-input
          v-model="confirmPassword"
          type="password"
          show-password
          autocomplete="off"
        />
      </el-form-item>
      <el-form-item
        v-if="mode === 'unlock'"
        class="remember-session-item"
      >
        <el-checkbox v-model="rememberSession">
          {{ t('encryption.rememberSession') }}
        </el-checkbox>
      </el-form-item>
      <p
        v-if="errorMessage"
        class="error"
      >
        {{ errorMessage }}
      </p>
      <el-button
        v-if="showRestoreBackup"
        type="warning"
        link
        @click="restoreBackup"
      >
        {{ t('encryption.restoreFromBackup') }}
      </el-button>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">
        {{ t('encryption.cancel') }}
      </el-button>
      <el-button
        type="primary"
        :loading="loading"
        :disabled="!canSubmit"
        @click="submit"
      >
        {{ primaryLabel }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import bus from '@/bus'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '@/store/editor'
import { usePreferencesStore } from '@/store/preferences'
import { validatePassword, validatePasswordConfirmation } from 'common/crypto/passwordPolicy'
import type { SaveOptions } from '@shared/types/files'

const { t } = useI18n()
const editorStore = useEditorStore()
const preferencesStore = usePreferencesStore()

type DialogMode = 'unlock' | 'set-password' | 'change-password' | 'create-file'

interface UnlockPayload {
  tabId: string
  pathname: string
  filename: string
}

interface SavePasswordPayload {
  id: string
  filename: string
  pathname: string
  markdown: string
  options: SaveOptions
  defaultPath: string
}

interface CreateFilePayload {
  pathname: string
  filename: string
}

const visible = ref(false)
const loading = ref(false)
const mode = ref<DialogMode>('unlock')
const tabId = ref('')
const pathname = ref('')
const filename = ref('')
const currentPassword = ref('')
const password = ref('')
const confirmPassword = ref('')
const rememberSession = ref(false)
const errorMessage = ref('')
const showRestoreBackup = ref(false)
const pendingSave = ref<SavePasswordPayload | null>(null)
const pendingCreatePath = ref('')

const passwordStrength = computed(() =>
  preferencesStore.encryptionPasswordStrength === 'strong' ? 'strong' : 'basic'
)

const dialogTitle = computed(() => {
  switch (mode.value) {
    case 'unlock':
      return t('encryption.unlockTitle')
    case 'change-password':
      return t('encryption.changePasswordTitle')
    case 'create-file':
      return t('encryption.createEncryptedFileTitle')
    default:
      return t('encryption.setPasswordTitle')
  }
})

const passwordLabel = computed(() => {
  if (mode.value === 'change-password') return t('encryption.newPassword')
  return t('encryption.password')
})

const primaryLabel = computed(() => {
  switch (mode.value) {
    case 'unlock':
      return t('encryption.unlock')
    case 'change-password':
      return t('encryption.changePassword')
    case 'create-file':
      return t('encryption.createFile')
    default:
      return t('encryption.setPassword')
  }
})

const canSubmit = computed(() => {
  if (loading.value) return false
  if (mode.value === 'unlock') return password.value.length > 0
  if (mode.value === 'change-password') {
    return currentPassword.value.length > 0 && password.value.length > 0 && confirmPassword.value.length > 0
  }
  return password.value.length > 0 && confirmPassword.value.length > 0
})

const resetForm = () => {
  currentPassword.value = ''
  password.value = ''
  confirmPassword.value = ''
  rememberSession.value = false
  errorMessage.value = ''
  showRestoreBackup.value = false
  pendingSave.value = null
  pendingCreatePath.value = ''
}

const showUnlock = async(payload: UnlockPayload) => {
  mode.value = 'unlock'
  tabId.value = payload.tabId
  pathname.value = payload.pathname
  filename.value = payload.filename
  showRestoreBackup.value = await window.mdeUtils.hasBackup(payload.pathname)
  visible.value = true
}

const showSavePassword = (payload: SavePasswordPayload) => {
  mode.value = 'set-password'
  tabId.value = payload.id
  pathname.value = payload.pathname
  filename.value = payload.filename
  pendingSave.value = payload
  visible.value = true
}

const showChangePassword = (payload: UnlockPayload) => {
  mode.value = 'change-password'
  tabId.value = payload.tabId
  pathname.value = payload.pathname
  filename.value = payload.filename
  visible.value = true
}

const showCreateFile = (payload: CreateFilePayload) => {
  mode.value = 'create-file'
  pathname.value = payload.pathname
  filename.value = payload.filename
  pendingCreatePath.value = payload.pathname
  visible.value = true
}

const validateNewPassword = (): boolean => {
  const validation = validatePassword(password.value, passwordStrength.value)
  if (!validation.valid) {
    errorMessage.value = t('encryption.weakPassword')
    return false
  }
  if (!validatePasswordConfirmation(password.value, confirmPassword.value)) {
    errorMessage.value = t('encryption.passwordMismatch')
    return false
  }
  return true
}

const restoreBackup = async() => {
  if (!pathname.value) return
  loading.value = true
  try {
    await window.mdeUtils.restoreFromBackup(pathname.value)
    showRestoreBackup.value = false
    errorMessage.value = ''
    visible.value = false
    window.electron.ipcRenderer.send('mt::open-file', pathname.value, {})
  } catch {
    errorMessage.value = t('encryption.restoreFailed')
  } finally {
    loading.value = false
  }
}

const submit = async() => {
  errorMessage.value = ''
  loading.value = true
  try {
    if (mode.value === 'unlock') {
      const ok = await editorStore.UNLOCK_TAB(tabId.value, password.value, rememberSession.value)
      if (!ok) {
        errorMessage.value = t('encryption.incorrectPassword')
        showRestoreBackup.value = await window.mdeUtils.hasBackup(pathname.value)
        return
      }
      visible.value = false
      return
    }

    if (mode.value === 'change-password') {
      try {
        await window.mdeUtils.changePassword({
          pathname: pathname.value,
          oldPassword: currentPassword.value,
          newPassword: password.value
        })
        visible.value = false
      } catch {
        errorMessage.value = t('encryption.changePasswordFailed')
      }
      return
    }

    if (!validateNewPassword()) return

    if (mode.value === 'create-file' && pendingCreatePath.value) {
      await window.mdeUtils.createEmpty({
        pathname: pendingCreatePath.value,
        password: password.value
      })
      visible.value = false
      window.electron.ipcRenderer.send('mt::open-file', pendingCreatePath.value, {})
      return
    }

    if (pendingSave.value) {
      const savePayload = pendingSave.value
      editorStore.SEND_FILE_SAVE({
        id: savePayload.id,
        filename: savePayload.filename,
        pathname: savePayload.pathname,
        markdown: savePayload.markdown,
        defaultPath: savePayload.defaultPath,
        options: {
          ...savePayload.options,
          isEncrypted: true,
          encryptionPassword: password.value,
          encryptionKeepBackup: preferencesStore.encryptionKeepBackup,
          encryptionPbkdf2Iterations: preferencesStore.encryptionPbkdf2Iterations
        } as Parameters<typeof editorStore.SEND_FILE_SAVE>[0]['options']
      })
    }
    visible.value = false
  } finally {
    loading.value = false
    currentPassword.value = ''
    password.value = ''
    confirmPassword.value = ''
  }
}

onMounted(() => {
  bus.on('mde::show-unlock', (payload: unknown) => {
    void showUnlock(payload as UnlockPayload)
  })
  bus.on('mde::prompt-save-password', (payload: unknown) => {
    showSavePassword(payload as SavePasswordPayload)
  })
  bus.on('mde::show-change-password', (payload: unknown) => {
    showChangePassword(payload as UnlockPayload)
  })
  bus.on('mde::create-encrypted-file', (payload: unknown) => {
    showCreateFile(payload as CreateFilePayload)
  })
})

onBeforeUnmount(() => {
  bus.off('mde::show-unlock')
  bus.off('mde::prompt-save-password')
  bus.off('mde::show-change-password')
  bus.off('mde::create-encrypted-file')
})
</script>

<style scoped>
.file-name {
  margin: 0 0 12px;
  color: var(--editorColor);
  word-break: break-all;
}
.warning {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--warningColor, #e6a23c);
}
.error {
  margin: 0;
  color: #f56c6c;
  font-size: 13px;
}
.remember-session-item :deep(.el-form-item__content) {
  line-height: 1.45;
}
.remember-session-item :deep(.el-checkbox) {
  align-items: flex-start;
  height: auto;
  max-width: 100%;
  white-space: normal;
}
.remember-session-item :deep(.el-checkbox__input) {
  margin-top: 2px;
}
.remember-session-item :deep(.el-checkbox__label) {
  white-space: normal;
  word-break: break-word;
  overflow-wrap: break-word;
  line-height: 1.45;
}
</style>
