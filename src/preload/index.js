import { contextBridge, desktopCapturer, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {}

// Add getScreenInfo and getScreenStream
api.getScreenInfo = async () => {
  return { width: window.screen.width, height: window.screen.height };
};

api.getScreenStream = async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen'] });
  const primary = sources[0];
  return await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: primary.id,
        minWidth: 1280,
        minHeight: 720,
        maxWidth: 9999,
        maxHeight: 9999
      }
    }
  });
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', { ...electronAPI, ...api })
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = { ...electronAPI, ...api }
  window.api = api
}
