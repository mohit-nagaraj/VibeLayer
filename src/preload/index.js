// src/preload/index.js
// ──────────────────────────────────────────────────────────
const { contextBridge, ipcRenderer } = require('electron')
import { electronAPI } from '@electron-toolkit/preload'

// ----------------------------------------------------------
// Custom APIs exposed to the renderer process
// ----------------------------------------------------------
const api = {
  /** Return basic screen dimensions */
  getScreenInfo: () => ({
    width: window.screen.width,
    height: window.screen.height
  }),

  /**
   * Return all available screens
   */
  getAllScreens: () => ipcRenderer.invoke('get-all-screens'),

  /**
   * Return info for a specific screen
   */
  getScreenInfoById: (screenId) => ipcRenderer.invoke('get-screen-info', screenId),

  /**
   * Return the desktop-capturer ID for the primary screen.
   * The renderer should call getUserMedia() with this ID.
   */
  async getPrimaryScreenSourceId(screenId) {
    try {
      const sourceId = await ipcRenderer.invoke('get-primary-screen-source-id', screenId)
      return sourceId
    } catch (err) {
      console.error('getPrimaryScreenSourceId failed:', err)
      throw err
    }
  },

  /**
   * (Optional helper) Return *all* screen/window sources if
   * you need to present a picker in the renderer.
   */
  async listDesktopSources(opts = { types: ['screen', 'window'] }) {
    return await ipcRenderer.invoke('DESKTOP_CAPTURER_GET_SOURCES', opts)
  },
  
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close')
}

// ----------------------------------------------------------
// Expose the API depending on context-isolation status
// ----------------------------------------------------------
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', { ...electronAPI, ...api })
    contextBridge.exposeInMainWorld('api', api) // legacy alias
  } catch (error) {
    console.error('preload expose error:', error)
  }
} else {
  // Fallback for apps with nodeIntegration
  window.electron = { ...electronAPI, ...api }
  window.api = api
}
