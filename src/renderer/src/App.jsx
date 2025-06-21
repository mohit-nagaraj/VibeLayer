import { useState, useEffect, useRef } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs'
import { DotPattern } from '../../components/magicui/dot-pattern'
import CustomTitleBar from './components/CustomTitleBar'
import SearchTab from './components/SearchTab'
import LayoutTab from './components/LayoutTab'
import SettingsTab from './components/SettingsTab'
import { toFileUrl } from './utils/fileUtils'
import { useStickerManagement } from './hooks/useStickerManagement'
import { useScreenManagement } from './hooks/useScreenManagement'
import { useSettings } from './hooks/useSettings'

const TABS = ['Search', 'Layout', 'Settings']

function App() {
  const [tab, setTab] = useState('Search')
  const [toast, setToast] = useState('')
  const toastTimeout = useRef(null)

  // Custom hooks
  const {
    stickers,
    results,
    loading,
    fetchStickers,
    saveSticker,
    handleSearch,
    handleImportUrl,
    handleImport,
    handleRemoveBg,
    handleDelete
  } = useStickerManagement()

  const {
    screens,
    selectedScreen,
    selectedScreens,
    screenLayouts,
    screenSize,
    screenStream,
    handleScreenSelection,
    handleMultiScreenSelection,
    updateScreenLayout,
    setStickerForScreen
  } = useScreenManagement()

  const {
    settings,
    autoLaunch,
    layout,
    activeSticker,
    setLayout,
    setActiveSticker,
    saveLayout,
    handleSettingsChange,
    handleAutoLaunchChange
  } = useSettings()

  useEffect(() => {
    fetchStickers()
  }, [tab])

  const showToast = (msg) => {
    setToast(msg)
    if (toastTimeout.current) clearTimeout(toastTimeout.current)
    toastTimeout.current = setTimeout(() => setToast(''), 2000)
  }

  // Enhanced handlers that show toast messages
  const handleSearchWithToast = async (searchTerm) => {
    await handleSearch(searchTerm)
  }

  const handleImportUrlWithToast = async (url) => {
    const message = await handleImportUrl(url)
    showToast(message)
  }

  const handleImportWithToast = async (item) => {
    const message = await handleImport(item)
    showToast(message)
  }

  const handleImportLocalWithToast = async (arrayBuffer, ext) => {
    const message = await saveSticker(arrayBuffer, ext)
    showToast(message)
  }

  const handleRemoveBgWithToast = async (sticker) => {
    const message = await handleRemoveBg(sticker)
    showToast(message)
  }

  const handleDeleteWithToast = async (sticker) => {
    const message = await handleDelete(sticker)
    showToast(message)
    // If the deleted sticker was the active one, clear the active sticker and layout
    if (activeSticker && activeSticker.name === sticker.name) {
      setActiveSticker(null)
      const newLayout = { ...layout, sticker: null, stickerUrl: undefined }
      setLayout(newLayout)
      saveLayout(newLayout)
      // Send update to sticker window to clear it
      if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.send('update-sticker-layout', newLayout)
      }
    }
  }

  // Set sticker in sticker window
  const handleSetSticker = (sticker, l = layout) => {
    setActiveSticker(sticker)
    const stickerUrl = toFileUrl(sticker.path)

    // Update layout for current screen
    const newLayout = {
      ...l,
      sticker: sticker,
      stickerUrl,
      screenId: selectedScreen?.id
    }
    setLayout(newLayout)

    // Update screen layouts
    const updatedScreenLayouts = updateScreenLayout(selectedScreen.id, newLayout)

    saveLayout(newLayout)

    if (window.electron?.ipcRenderer) {
      // Send to all selected screens
      selectedScreens.forEach((screenId) => {
        const screenLayout = updatedScreenLayouts[screenId] || newLayout
        window.electron.ipcRenderer.send('update-sticker-layout', {
          ...screenLayout,
          screenId
        })
      })
    }
    showToast('Sticker set!')
  }

  // Set sticker for specific screen
  const handleSetStickerForScreen = (sticker, screenId, options) => {
    const result = setStickerForScreen(sticker, screenId, options)
    if (result) {
      // If this is the currently selected screen, update the main layout
      if (selectedScreen?.id === screenId) {
        setLayout(result.layout)
        setActiveSticker(sticker)
      }
      showToast(result.message)
    }
  }

  // Handle layout change
  const handleLayoutChange = (x, y, width, height, forceAspect) => {
    const previewScale = 0.25
    const previewWidth = Math.round(screenSize.width * previewScale)
    const previewHeight = Math.round(screenSize.height * previewScale)

    const getAspectRatio = () => {
      const w = layout.widthPct ? layout.widthPct * previewWidth : layout.width
      const h = layout.heightPct ? layout.heightPct * previewHeight : layout.height
      return w / h
    }

    const aspect = getAspectRatio()
    let newWidth = width
    let newHeight = height

    // Note: aspectLock is handled in LayoutTab component
    if (forceAspect) {
      if (width / height > aspect) {
        newWidth = Math.round(height * aspect)
      } else {
        newHeight = Math.round(width / aspect)
      }
    }

    const safePadding = 0.001
    const maxX = previewWidth - newWidth - safePadding
    const maxY = previewHeight - newHeight - safePadding
    const clampedX = Math.max(safePadding, Math.min(x, maxX))
    const clampedY = Math.max(safePadding, Math.min(y, maxY))
    const clampedWidth = Math.max(24, Math.min(newWidth, previewWidth - clampedX - safePadding))
    const clampedHeight = Math.max(24, Math.min(newHeight, previewHeight - clampedY - safePadding))

    const newLayout = {
      ...layout,
      xPct: clampedX / previewWidth,
      yPct: clampedY / previewHeight,
      widthPct: clampedWidth / previewWidth,
      heightPct: clampedHeight / previewHeight,
      sticker: activeSticker,
      screenId: selectedScreen?.id
    }

    setLayout(newLayout)

    // Update screen layouts
    const updatedScreenLayouts = updateScreenLayout(selectedScreen.id, newLayout)

    saveLayout(newLayout)

    if (window.electron?.ipcRenderer) {
      // Send to all selected screens
      selectedScreens.forEach((screenId) => {
        const screenLayout = updatedScreenLayouts[screenId] || newLayout
        window.electron.ipcRenderer.send('update-sticker-layout', {
          ...screenLayout,
          screenId
        })
      })
    }
  }

  // Settings handlers
  const handleSettingsChangeWithToast = async (field, value) => {
    const message = await handleSettingsChange(field, value)
    showToast(message)
  }

  const handleAutoLaunchChangeWithToast = async (value) => {
    await handleAutoLaunchChange(value)
  }

  return (
    <div className="h-screen w-full bg-background text-foreground flex flex-col overflow-hidden">
      <CustomTitleBar title="VibeLayer" theme={settings.theme} />
      <DotPattern className="[mask-image:radial-gradient(300px_circle_at_center,white,transparent)]" />
      <div className="relative z-10 flex-1 overflow-y-auto p-6 pt-12">
        <Tabs value={tab} onValueChange={setTab} className="mb-6">
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t} value={t}>
                {t}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="Search">
            <SearchTab
              loading={loading}
              results={results}
              onSearch={handleSearchWithToast}
              onImport={handleImportWithToast}
              onImportUrl={handleImportUrlWithToast}
              onImportLocal={handleImportLocalWithToast}
            />
          </TabsContent>

          <TabsContent value="Layout">
            <LayoutTab
              activeSticker={activeSticker}
              selectedScreen={selectedScreen}
              screens={screens}
              selectedScreens={selectedScreens}
              layout={layout}
              screenSize={screenSize}
              screenStream={screenStream}
              stickers={stickers}
              onLayoutChange={handleLayoutChange}
              onScreenSelection={handleScreenSelection}
              onMultiScreenSelection={handleMultiScreenSelection}
              onSetStickerForScreen={handleSetStickerForScreen}
              onDelete={handleDeleteWithToast}
              onRemoveBg={handleRemoveBgWithToast}
            />
          </TabsContent>

          <TabsContent value="Settings">
            <SettingsTab
              settings={settings}
              autoLaunch={autoLaunch}
              onSettingsChange={handleSettingsChangeWithToast}
              onAutoLaunchChange={handleAutoLaunchChangeWithToast}
            />
          </TabsContent>
        </Tabs>

        {toast && (
          <div className="fixed top-12 right-6 bg-muted text-foreground px-6 py-3 rounded-lg z-50 shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
