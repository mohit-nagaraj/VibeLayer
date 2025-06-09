// src/preload/index.js
// ──────────────────────────────────────────────────────────
const { contextBridge, ipcRenderer } = require('electron');
import { electronAPI } from '@electron-toolkit/preload';

// ----------------------------------------------------------
// Custom APIs exposed to the renderer process
// ----------------------------------------------------------
const api = {
  /** Return basic screen dimensions */
  getScreenInfo: () => ({
    width:  window.screen.width,
    height: window.screen.height
  }),

  /**
   * Return the desktop-capturer ID for the primary screen.
   * The renderer should call getUserMedia() with this ID.
   */
  async getPrimaryScreenSourceId() {
    try {
      const sources = await ipcRenderer.invoke(
        'DESKTOP_CAPTURER_GET_SOURCES',
        { types: ['screen'] }          // add 'window' if you need windows too
      );

      if (!sources?.length) throw new Error('No screen sources found');
      return sources[0].id;            // e.g. 'screen:0:0'
    } catch (err) {
      console.error('getPrimaryScreenSourceId failed:', err);
      throw err;
    }
  },

  /**
   * (Optional helper) Return *all* screen/window sources if
   * you need to present a picker in the renderer.
   */
  async listDesktopSources(opts = { types: ['screen', 'window'] }) {
    return await ipcRenderer.invoke('DESKTOP_CAPTURER_GET_SOURCES', opts);
  }
};

// ----------------------------------------------------------
// Expose the API depending on context-isolation status
// ----------------------------------------------------------
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', { ...electronAPI, ...api });
    contextBridge.exposeInMainWorld('api', api);   // legacy alias
  } catch (error) {
    console.error('preload expose error:', error);
  }
} else {
  // Fallback for apps with nodeIntegration
  window.electron = { ...electronAPI, ...api };
  window.api      = api;
}
