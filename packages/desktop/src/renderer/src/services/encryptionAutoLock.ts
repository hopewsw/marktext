import { usePreferencesStore } from '@/store/preferences'
import { useEditorStore } from '@/store/editor'

let idleTimer: ReturnType<typeof setTimeout> | null = null
let clipboardTimer: ReturnType<typeof setTimeout> | null = null
let initialized = false

export const resetEncryptionIdleTimer = (): void => {
  if (idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }

  const prefs = usePreferencesStore()
  if (!prefs.encryptionAutoLock) return

  const editor = useEditorStore()
  const tab = editor.currentFile
  if (!tab?.isEncrypted || tab.isLocked) return

  idleTimer = setTimeout(() => {
    const currentEditor = useEditorStore()
    const current = currentEditor.currentFile
    if (!current?.isEncrypted || current.isLocked) return

    const currentPrefs = usePreferencesStore()
    if (currentPrefs.encryptionAutoSaveBeforeLock && !current.isSaved) {
      currentEditor.FILE_SAVE()
    }
    currentEditor.LOCK_TAB(current.id)
  }, prefs.encryptionAutoLockTimeout)
}

const handleWindowBlur = (): void => {
  const prefs = usePreferencesStore()
  if (!prefs.encryptionLockOnBlur) return

  const editor = useEditorStore()
  const tab = editor.currentFile
  if (tab?.isEncrypted && !tab.isLocked) {
    if (prefs.encryptionAutoSaveBeforeLock && !tab.isSaved) {
      editor.FILE_SAVE()
    }
    editor.LOCK_TAB(tab.id)
  }
}

const handleCopy = (): void => {
  const prefs = usePreferencesStore()
  if (!prefs.encryptionClearClipboardAfterCopy) return

  const editor = useEditorStore()
  const tab = editor.currentFile
  if (!tab?.isEncrypted || tab.isLocked) return

  if (clipboardTimer) clearTimeout(clipboardTimer)
  clipboardTimer = setTimeout(() => {
    window.electron.clipboard.writeText('')
  }, prefs.encryptionClipboardClearDelay)
}

export const initEncryptionAutoLock = (): void => {
  if (initialized) return
  initialized = true

  const activityEvents: Array<keyof WindowEventMap> = [
    'keydown',
    'mousedown',
    'mousemove',
    'wheel',
    'scroll'
  ]
  for (const eventName of activityEvents) {
    window.addEventListener(eventName, resetEncryptionIdleTimer, { passive: true })
  }

  window.addEventListener('blur', handleWindowBlur)
  document.addEventListener('copy', handleCopy, true)
  resetEncryptionIdleTimer()
}
