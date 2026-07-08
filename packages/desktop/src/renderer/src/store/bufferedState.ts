import debounce from 'lodash/debounce'
import { useEditorStore } from './editor'
import { useProjectStore } from './project'
import { useLayoutStore } from './layout'

const BUFFERED_STATE_DEBOUNCE_MS = 1000
const BUFFERED_STATE_VERSION = 1

interface StoreCache {
  editorStore: ReturnType<typeof useEditorStore> | null
  projectStore: ReturnType<typeof useProjectStore> | null
  layoutStore: ReturnType<typeof useLayoutStore> | null
}

const stores: StoreCache = {
  editorStore: null,
  projectStore: null,
  layoutStore: null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createBufferedState = (): Record<string, any> | null => {
  if (!stores.editorStore) {
    stores.editorStore = useEditorStore()
  }
  if (!stores.projectStore) {
    stores.projectStore = useProjectStore()
  }
  if (!stores.layoutStore) {
    stores.layoutStore = useLayoutStore()
  }

  const editorState = stores.editorStore.CREATE_BUFFERED_STATE()
  if (!editorState) return null

  return {
    version: BUFFERED_STATE_VERSION,
    ...editorState,
    project: stores.projectStore?.CREATE_BUFFERED_STATE?.() || null,
    layout: stores.layoutStore?.CREATE_BUFFERED_STATE?.() || null
  }
}

/** Strip Vue proxies and non-cloneable values before IPC structured clone. */
const serializeBufferedSnapshot = (snapshot: Record<string, unknown>): Record<string, unknown> | null => {
  try {
    return JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>
  } catch (err) {
    console.warn('Failed to serialize buffered state for IPC:', err)
    return null
  }
}

export const sendBufferedState = (): Promise<unknown> => {
  try {
    const snapshot = createBufferedState()
    if (!snapshot) return Promise.resolve(false)

    const serializable = serializeBufferedSnapshot(snapshot)
    if (!serializable) return Promise.resolve(false)

    return window.electron.ipcRenderer.invoke('update-buffer-state', serializable)
  } catch (err) {
    console.error('Failed to update buffered state', err)
    return Promise.resolve(false)
  }
}

export const debouncedSendBufferedState = debounce(() => {
  void sendBufferedState()
}, BUFFERED_STATE_DEBOUNCE_MS)
