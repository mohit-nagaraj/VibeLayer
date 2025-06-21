import { useState, useEffect } from 'react'

export const useSettings = () => {
  const [settings, setSettings] = useState({
    alwaysOnTop: true,
    theme: 'dark',
    startup: false,
    hideStickerCapture: true
  })
  const [autoLaunch, setAutoLaunch] = useState(false)
  const [layout, setLayout] = useState({ x: 100, y: 100, width: 200, height: 200, sticker: null })
  const [activeSticker, setActiveSticker] = useState(null)

  useEffect(() => {
    loadLayout()
  }, [])

  useEffect(() => {
    loadSettings()
  }, [])

  useEffect(() => {
    // Set dark mode class on root for shadcn/tailwind
    document.documentElement.classList.toggle('dark', settings.theme === 'dark')
  }, [settings.theme])

  const loadLayout = async () => {
    const l = await window.electron.ipcRenderer.invoke('get-layout')
    if (l && l.sticker) setLayout(l)
    if (l && l.sticker) setActiveSticker(l.sticker)
  }

  const saveLayout = async (l) => {
    await window.electron.ipcRenderer.invoke('set-layout', l)
  }

  const loadSettings = async () => {
    const s = await window.electron.ipcRenderer.invoke('get-settings')
    setSettings({ ...settings, ...s })
    setAutoLaunch(await window.electron.ipcRenderer.invoke('get-auto-launch'))
  }

  const saveSettings = async (s) => {
    await window.electron.ipcRenderer.invoke('set-settings', s)
    setSettings(s)
    // Send IPC to update sticker capture protection
    if (typeof s.hideStickerCapture === 'boolean') {
      window.electron.ipcRenderer.invoke('set-sticker-content-protection', s.hideStickerCapture)
    }
    return 'Settings saved!'
  }

  const handleSettingsChange = async (field, value) => {
    const newSettings = { ...settings, [field]: value }
    setSettings(newSettings)
    const message = await saveSettings(newSettings)
    if (field === 'startup') await window.electron.ipcRenderer.invoke('set-auto-launch', value)
    return message
  }

  const handleAutoLaunchChange = async (value) => {
    setAutoLaunch(value)
    await handleSettingsChange('startup', value)
  }

  return {
    settings,
    autoLaunch,
    layout,
    activeSticker,
    setLayout,
    setActiveSticker,
    saveLayout,
    handleSettingsChange,
    handleAutoLaunchChange
  }
}
