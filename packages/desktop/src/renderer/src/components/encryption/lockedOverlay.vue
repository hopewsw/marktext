<template>
  <div class="locked-overlay">
    <div class="locked-card">
      <div class="lock-icon">
        🔒
      </div>
      <p>{{ t('encryption.documentLocked') }}</p>
      <el-button
        type="primary"
        @click="requestUnlock"
      >
        {{ t('encryption.unlock') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import bus from '@/bus'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '@/store/editor'
import { storeToRefs } from 'pinia'

const { t } = useI18n()
const editorStore = useEditorStore()
const { currentFile } = storeToRefs(editorStore)

const requestUnlock = () => {
  const file = currentFile.value
  if (!file?.pathname) return
  bus.emit('mde::show-unlock', {
    tabId: file.id,
    pathname: file.pathname,
    filename: file.filename
  })
}
</script>

<style scoped>
.locked-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--editorBgColor) 82%, transparent);
  backdrop-filter: blur(4px);
}
.locked-card {
  text-align: center;
  padding: 24px;
}
.lock-icon {
  font-size: 48px;
  margin-bottom: 12px;
}
</style>
