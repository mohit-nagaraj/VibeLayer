import { useState, useEffect } from 'react'
import { toFileUrl } from '../utils/fileUtils'

export const useScreenManagement = () => {
  const [screens, setScreens] = useState([])
  const [selectedScreen, setSelectedScreen] = useState(null)
  const [selectedScreens, setSelectedScreens] = useState([])
  const [screenLayouts, setScreenLayouts] = useState({})
  const [screenSize, setScreenSize] = useState({ width: 1920, height: 1080 })
  const [screenStream, setScreenStream] = useState(null)

  // Load screens on mount
  useEffect(() => {
    const loadScreens = async () => {
      try {
        const allScreens = await window.electron.getAllScreens()
        console.log('Loaded screens:', allScreens)
        setScreens(allScreens)
        if (allScreens.length > 0) {
          setSelectedScreen(allScreens[0])
          setSelectedScreens([allScreens[0].id])
          // Initialize screen layouts
          const initialLayouts = {}
          allScreens.forEach((screen) => {
            initialLayouts[screen.id] = { x: 100, y: 100, width: 200, height: 200, sticker: null }
          })
          setScreenLayouts(initialLayouts)
        }
      } catch (error) {
        console.error('Failed to load screens:', error)
      }
    }
    loadScreens()
  }, [])

  useEffect(() => {
    ;(async () => {
      // Get screen size for selected screen
      if (selectedScreen && window.electron?.getScreenInfo) {
        setScreenSize({
          width: selectedScreen.bounds.width,
          height: selectedScreen.bounds.height
        })
      }

      // Get screen source ID for selected screen
      if (selectedScreen && window.electron?.getPrimaryScreenSourceId) {
        try {
          const sourceId = await window.electron.getPrimaryScreenSourceId(selectedScreen.id)
          console.log('Got source ID for screen:', selectedScreen.id, sourceId)

          // Stop existing stream if any
          if (screenStream) {
            screenStream.getTracks().forEach((track) => track.stop())
            setScreenStream(null)
          }

          // Create a real MediaStream *in the renderer*
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: sourceId,
                minWidth: 1280,
                minHeight: 720,
                maxWidth: 9999,
                maxHeight: 9999
              }
            }
          })

          console.log('Screen stream created successfully')
          setScreenStream(stream)
        } catch (error) {
          console.error('Failed to get screen stream:', error)
          setScreenStream(null)

          // Try fallback: get all sources and use the first one
          try {
            console.log('Trying fallback screen capture...')
            const sources = await window.electron.listDesktopSources({ types: ['screen'] })
            if (sources && sources.length > 0) {
              const fallbackStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                  mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: sources[0].id,
                    minWidth: 1280,
                    minHeight: 720,
                    maxWidth: 9999,
                    maxHeight: 9999
                  }
                }
              })
              console.log('Fallback screen stream created successfully')
              setScreenStream(fallbackStream)
            }
          } catch (fallbackError) {
            console.error('Fallback screen capture also failed:', fallbackError)
          }
        }
      }
    })()
  }, [selectedScreen, screenLayouts])

  const handleScreenSelection = (screenId) => {
    const screen = screens.find((s) => s.id === screenId)
    if (screen) {
      console.log('Selected screen:', screen)
      setSelectedScreen(screen)
    }
  }

  const handleMultiScreenSelection = (screenId, checked) => {
    console.log('Multi-screen selection:', screenId, checked)

    if (checked) {
      setSelectedScreens((prev) => [...prev, screenId])
    } else {
      // Remove sticker from unchecked screen
      if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.send('update-sticker-layout', {
          sticker: null,
          stickerUrl: null,
          screenId: screenId
        })
      }
      setSelectedScreens((prev) => prev.filter((id) => id !== screenId))
    }
  }

  const updateScreenLayout = (screenId, layout) => {
    const updatedScreenLayouts = { ...screenLayouts }
    updatedScreenLayouts[screenId] = layout
    setScreenLayouts(updatedScreenLayouts)
    return updatedScreenLayouts
  }

  const setStickerForScreen = (sticker, screenId) => {
    const screen = screens.find((s) => s.id === screenId)
    if (!screen) return null

    const stickerUrl = toFileUrl(sticker.path)
    const currentLayout = screenLayouts[screenId] || {
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      sticker: null
    }

    const newLayout = {
      ...currentLayout,
      sticker: sticker,
      stickerUrl,
      screenId: screenId
    }

    // Update screen layouts
    const updatedScreenLayouts = updateScreenLayout(screenId, newLayout)

    // Send to the specific screen
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('update-sticker-layout', {
        ...newLayout,
        screenId
      })
    }

    return {
      layout: newLayout,
      screenLayouts: updatedScreenLayouts,
      message: `Sticker set for ${screen.primary ? 'Primary Display' : `Display ${screen.index + 1}`}!`
    }
  }

  return {
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
  }
}
