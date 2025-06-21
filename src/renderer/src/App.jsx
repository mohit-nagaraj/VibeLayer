import { useState, useEffect, useRef, useCallback } from 'react'
import { GiphyFetch } from '@giphy/js-fetch-api'
import { createApi } from 'unsplash-js'
import { Rnd } from 'react-rnd'
import * as imglyRemoveBackground from '@imgly/background-removal'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from './components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs'
import { DotPattern } from '../../components/magicui/dot-pattern'
import CustomTitleBar from './components/CustomTitleBar'
import { SearchIcon } from 'lucide-react'
import { Label } from './components/ui/label'
import { Card } from './components/ui/card'
import internetImg from './assets/internet.png';
import downloadImg from './assets/download.png';
import { Trash } from 'lucide-react'
import { Switch } from './components/ui/switch'

function toFileUrl(filePath) {
  let path = filePath.replace(/\\/g, '/')

  if (/^[A-Za-z]:\//.test(path)) {
    // Ensure three slashes for Windows drive paths and encode the path
    return 'file:///' + encodeURI(path)
  }

  // Handle other paths (e.g., network paths, relative paths)
  return 'file://' + encodeURI(path)
}

const gf = new GiphyFetch(import.meta.env.VITE_GIPHY_API_KEY || '')
const unsplash = createApi({ accessKey: import.meta.env.VITE_UNSPLASH_ACCESS_KEY || '' })
const TABS = ['Search', 'Layout', 'Settings']

function App() {
  const [tab, setTab] = useState('Search')
  const [results, setResults] = useState([])
  const [stickers, setStickers] = useState([])
  const [loading, setLoading] = useState(false)
  const [layout, setLayout] = useState({ x: 100, y: 100, width: 200, height: 200, sticker: null })
  const [activeSticker, setActiveSticker] = useState(null)
  const [toast, setToast] = useState('')
  const [settings, setSettings] = useState({
    alwaysOnTop: true,
    theme: 'dark',
    startup: false,
    hideStickerCapture: true
  })
  const [autoLaunch, setAutoLaunch] = useState(false)
  const toastTimeout = useRef(null)
  const [localFile, setLocalFile] = useState(null)
  const [localPreview, setLocalPreview] = useState(null)
  const [screenSize, setScreenSize] = useState({ width: 1920, height: 1080 })
  const [screenStream, setScreenStream] = useState(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [importUrl, setImportUrl] = useState('')
  const [imgError, setImgError] = useState(false)
  const searchRef = useRef();
  const [aspectLock, setAspectLock] = useState(true);
  const [toolbarSize, setToolbarSize] = useState({ width: 200, height: 200 });
  
  // Multi-screen support
  const [screens, setScreens] = useState([])
  const [selectedScreen, setSelectedScreen] = useState(null)
  const [selectedScreens, setSelectedScreens] = useState([]) // For multi-screen display
  const [screenLayouts, setScreenLayouts] = useState({}) // Different layouts per screen

  useEffect(() => {
    fetchStickers()
  }, [tab])
  useEffect(() => {
    loadLayout()
  }, [])
  useEffect(() => {
    loadSettings()
  }, [])
  
  // Load screens on mount
  useEffect(() => {
    const loadScreens = async () => {
      try {
        const allScreens = await window.electron.getAllScreens()
        console.log('Loaded screens:', allScreens)
        setScreens(allScreens)
        if (allScreens.length > 0) {
          setSelectedScreen(allScreens[0])
          setSelectedScreens([allScreens[0].id]) // Default to first screen
          // Initialize screen layouts
          const initialLayouts = {}
          allScreens.forEach(screen => {
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
    ; (async () => {
      // Get screen size for selected screen
      if (selectedScreen && window.electron?.getScreenInfo) {
        setScreenSize({ 
          width: selectedScreen.bounds.width, 
          height: selectedScreen.bounds.height 
        })
        
        // Update layout to match selected screen
        const screenLayout = screenLayouts[selectedScreen.id] || { x: 100, y: 100, width: 200, height: 200, sticker: null }
        setLayout(screenLayout)
        setActiveSticker(screenLayout.sticker)
      }

      // Get screen source ID for selected screen
      if (selectedScreen && window.electron?.getPrimaryScreenSourceId) {
        try {
          const sourceId = await window.electron.getPrimaryScreenSourceId(selectedScreen.id)
          console.log('Got source ID for screen:', selectedScreen.id, sourceId)

          // Stop existing stream if any
          if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop())
            setScreenStream(null)
          }

          // Reset video element
          if (videoRef.current) {
            videoRef.current.srcObject = null
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
          setScreenStream(stream) // ← now a genuine MediaStream
          
          // Reset video element with new stream
          if (videoRef.current) {
            videoRef.current.srcObject = stream
            videoRef.current.muted = true
            videoRef.current.playsInline = true
          }
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
              
              if (videoRef.current) {
                videoRef.current.srcObject = fallbackStream
                videoRef.current.muted = true
                videoRef.current.playsInline = true
              }
            }
          } catch (fallbackError) {
            console.error('Fallback screen capture also failed:', fallbackError)
          }
        }
      }
    })()
  }, [selectedScreen, screenLayouts])
  
  useEffect(() => {
    // Set dark mode class on root for shadcn/tailwind
    document.documentElement.classList.toggle('dark', settings.theme === 'dark')
  }, [settings.theme])

  const previewScale = 0.25
  const previewWidth = Math.round(screenSize.width * previewScale)
  const previewHeight = Math.round(screenSize.height * previewScale)

  useEffect(() => {
    if (activeSticker && layout.width && layout.height) {
      setToolbarSize({
        width: Math.round(layout.widthPct ? layout.widthPct * previewWidth : layout.width),
        height: Math.round(layout.heightPct ? layout.heightPct * previewHeight : layout.height)
      });
    }
  }, [activeSticker, layout, previewWidth, previewHeight]);

  const initDrawingIfReady = useCallback(() => {
    // Make sure everything is ready
    if (!screenStream || !videoRef.current || !canvasRef.current) {
      console.log('Drawing not ready:', { 
        hasStream: !!screenStream, 
        hasVideo: !!videoRef.current, 
        hasCanvas: !!canvasRef.current 
      })
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    // Keep canvas in sync with preview dimensions
    canvas.width = previewWidth
    canvas.height = previewHeight

    // Attach stream only once
    if (!video.srcObject) {
      video.srcObject = screenStream
      video.muted = true
      video.playsInline = true // avoids autoplay block :contentReference[oaicite:1]{index=1}
    }

    // Start drawing after metadata is ready
    const start = () => {
      console.log('Starting video playback and drawing')
      video.play().catch(console.error) // handle promise   :contentReference[oaicite:2]{index=2}
      const render = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height) // canvas API :contentReference[oaicite:3]{index=3}
        requestAnimationFrame(render) // 60 fps & efficient :contentReference[oaicite:4]{index=4}
      }
      requestAnimationFrame(render)
    }

    video.addEventListener('loadedmetadata', start, { once: true }) // fire when size known :contentReference[oaicite:5]{index=5}
  }, [screenStream, previewWidth, previewHeight])

  // Reinitialize drawing when screenStream changes
  useEffect(() => {
    if (screenStream) {
      console.log('Screen stream changed, reinitializing drawing')
      initDrawingIfReady()
    }
  }, [screenStream, initDrawingIfReady])

  const handleVideoRef = useCallback(
    (node) => {
      if (node) {
        console.log('Video node is ready')
        videoRef.current = node
        // Don't call initDrawingIfReady here, let the useEffect handle it
      }
    },
    []
  )

  const handleCanvasRef = useCallback(
    (node) => {
      if (node) {
        console.log('Canvas node is ready')
        canvasRef.current = node
        // Don't call initDrawingIfReady here, let the useEffect handle it
      }
    },
    []
  )

  const showToast = (msg) => {
    setToast(msg)
    if (toastTimeout.current) clearTimeout(toastTimeout.current)
    toastTimeout.current = setTimeout(() => setToast(''), 2000)
  }

  const fetchStickers = async () => {
    const files = await window.electron.ipcRenderer.invoke('list-stickers')
    files.forEach((sticker) => console.log('Sticker path:', sticker.path))
    setStickers(files)
  }
  const saveSticker = async (buffer, ext = 'png') => {
    const name = `sticker_${Date.now()}.${ext}`
    const filePath = await window.electron.ipcRenderer.invoke('save-sticker', { name, buffer })
    console.log('Sticker saved at:', filePath)
    fetchStickers()
    showToast('Sticker imported!')
  }

  // Layout persistence
  const loadLayout = async () => {
    const l = await window.electron.ipcRenderer.invoke('get-layout')
    if (l && l.sticker) setLayout(l)
    if (l && l.sticker) setActiveSticker(l.sticker)
  }
  const saveLayout = async (l) => {
    await window.electron.ipcRenderer.invoke('set-layout', l)
  }

  // Settings persistence
  const loadSettings = async () => {
    const s = await window.electron.ipcRenderer.invoke('get-settings')
    setSettings({ ...settings, ...s })
    setAutoLaunch(await window.electron.ipcRenderer.invoke('get-auto-launch'))
  }
  const saveSettings = async (s) => {
    await window.electron.ipcRenderer.invoke('set-settings', s)
    setSettings(s)
    showToast('Settings saved!')
    // Send IPC to update sticker capture protection
    if (typeof s.hideStickerCapture === 'boolean') {
      window.electron.ipcRenderer.invoke('set-sticker-content-protection', s.hideStickerCapture)
    }
  }

  const handleSearch = async (searchTerm) => {
    setLoading(true)
    setResults([])
    const { data: giphyData } = await gf.search(searchTerm, { limit: 5 })
    const unsplashRes = await unsplash.search.getPhotos({ query: searchTerm, perPage: 5 })
    const giphyResults = giphyData.map((gif) => ({
      type: 'gif',
      url: gif.images.original.url,
      thumb: gif.images.fixed_width_small.url
    }))
    const unsplashResults = (unsplashRes.response?.results || []).map((img) => ({
      type: 'img',
      url: img.urls.raw,
      thumb: img.urls.thumb
    }))
    setResults([...giphyResults, ...unsplashResults])
    setLoading(false)
  }

  const handleImportUrl = async () => {
    if (!importUrl || !importUrl.trim()) {
      showToast('Please enter a valid image URL.')
      return
    }
    setLoading(true)
    try {
      const filePath = await window.electron.ipcRenderer.invoke(
        'import-sticker-url',
        importUrl.trim()
      )
      if (filePath) {
        fetchStickers()
        showToast('Sticker imported!')
        setImportUrl('')
      }
    } catch (e) {
      showToast(e?.message || 'Import failed!')
    }
    setLoading(false)
  }

  const handleImportLocal = (e) => {
    const file = e.target.files[0]
    setLocalFile(file || null)
    if (file) {
      setLocalPreview(URL.createObjectURL(file))
    } else {
      setLocalPreview(null)
    }
  }

  const handleImportLocalButton = async () => {
    if (!localFile) {
      showToast('Please select a file first.')
      return
    }
    setLoading(true)
    const arrayBuffer = await localFile.arrayBuffer()
    const ext = localFile.name.split('.').pop()
    await saveSticker(arrayBuffer, ext)
    setLocalFile(null)
    setLocalPreview(null)
    setLoading(false)
  }

  const handleImport = async (item) => {
    setLoading(true)
    try {
      const response = await fetch(item.url)
      const blob = await response.blob()
      const arrayBuffer = await blob.arrayBuffer()
      const ext = blob.type.split('/')[1] || 'png'
      await saveSticker(arrayBuffer, ext)
    } catch (e) {
      showToast('Import failed!')
    }
    setLoading(false)
  }

  const handleRemoveBg = async (sticker) => {
    setLoading(true)
    try {
      const response = await fetch(toFileUrl(sticker.path))
      const blob = await response.blob()
      const file = new File([blob], sticker.name)
      const result = await imglyRemoveBackground.default(file)
      const resultBuffer = await result.arrayBuffer()
      await window.electron.ipcRenderer.invoke('save-sticker', {
        name: sticker.name,
        buffer: resultBuffer
      })
      fetchStickers()
      showToast('Background removed!')
    } catch (e) {
      showToast('Background removal failed!')
    }
    setLoading(false)
  }
  // Delete sticker
  const handleDelete = async (sticker) => {
    await window.electron.ipcRenderer.invoke('delete-sticker', sticker.name)
    fetchStickers()
    showToast('Sticker deleted!')
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
    // Use toFileUrl when sending to sticker window
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
    const updatedScreenLayouts = { ...screenLayouts }
    updatedScreenLayouts[selectedScreen.id] = newLayout
    setScreenLayouts(updatedScreenLayouts)
    
    saveLayout(newLayout)
    
    if (window.electron?.ipcRenderer) {
      // Send to all selected screens
      selectedScreens.forEach(screenId => {
        const screenLayout = updatedScreenLayouts[screenId] || newLayout
        window.electron.ipcRenderer.send('update-sticker-layout', {
          ...screenLayout,
          screenId
        })
      })
    }
    showToast('Sticker set!')
  }
  // Helper to get aspect ratio
  const getAspectRatio = () => {
    const w = layout.widthPct ? layout.widthPct * previewWidth : layout.width;
    const h = layout.heightPct ? layout.heightPct * previewHeight : layout.height;
    return w / h;
  };

  // Handler for toolbar input change
  const handleToolbarSizeChange = (field, value) => {
    let newWidth = toolbarSize.width;
    let newHeight = toolbarSize.height;
    const aspect = getAspectRatio();
    if (field === 'width') {
      newWidth = Math.max(24, Math.min(Number(value), previewWidth));
      newHeight = aspectLock ? Math.round(newWidth / aspect) : toolbarSize.height;
    } else {
      newHeight = Math.max(24, Math.min(Number(value), previewHeight));
      newWidth = aspectLock ? Math.round(newHeight * aspect) : toolbarSize.width;
    }
    setToolbarSize({ width: newWidth, height: newHeight });
    // Immediately update layout
    handleLayoutChange(
      layout.xPct ? layout.xPct * previewWidth : layout.x,
      layout.yPct ? layout.yPct * previewHeight : layout.y,
      newWidth,
      newHeight
    );
  };

  // Modified handleLayoutChange to optionally preserve aspect ratio
  const handleLayoutChange = (x, y, width, height, forceAspect) => {
    const aspect = getAspectRatio();
    let newWidth = width;
    let newHeight = height;
    if (aspectLock || forceAspect) {
      // preserve aspect ratio
      if (width / height > aspect) {
        newWidth = Math.round(height * aspect);
      } else {
        newHeight = Math.round(width / aspect);
      }
    }
    const safePadding = 0.01; // px, adjust as needed
    const maxX = previewWidth - newWidth - safePadding;
    const maxY = previewHeight - newHeight - safePadding;
    const clampedX = Math.max(safePadding, Math.min(x, maxX));
    const clampedY = Math.max(safePadding, Math.min(y, maxY));
    const clampedWidth = Math.max(24, Math.min(newWidth, previewWidth - clampedX - safePadding));
    const clampedHeight = Math.max(24, Math.min(newHeight, previewHeight - clampedY - safePadding));
    
    const newLayout = {
      ...layout,
      xPct: clampedX / previewWidth,
      yPct: clampedY / previewHeight,
      widthPct: clampedWidth / previewWidth,
      heightPct: clampedHeight / previewHeight,
      sticker: activeSticker,
      screenId: selectedScreen?.id
    };
    
    setLayout(newLayout);
    
    // Update screen layouts
    const updatedScreenLayouts = { ...screenLayouts }
    updatedScreenLayouts[selectedScreen.id] = newLayout
    setScreenLayouts(updatedScreenLayouts)
    
    saveLayout(newLayout);
    
    if (window.electron?.ipcRenderer) {
      // Send to all selected screens
      selectedScreens.forEach(screenId => {
        const screenLayout = updatedScreenLayouts[screenId] || newLayout
        window.electron.ipcRenderer.send('update-sticker-layout', {
          ...screenLayout,
          screenId
        })
      })
    }
  };

  // Settings
  const handleSettingsChange = async (field, value) => {
    const newSettings = { ...settings, [field]: value }
    setSettings(newSettings)
    saveSettings(newSettings)
    if (field === 'startup') await window.electron.ipcRenderer.invoke('set-auto-launch', value)
  }

  // Handle screen selection
  const handleScreenSelection = (screenId) => {
    const screen = screens.find(s => s.id === screenId)
    if (screen) {
      console.log('Selected screen:', screen)
      setSelectedScreen(screen)
    }
  }

  // Handle multi-screen selection
  const handleMultiScreenSelection = (screenId, checked) => {
    console.log('Multi-screen selection:', screenId, checked)
    
    if (checked) {
      setSelectedScreens(prev => [...prev, screenId])
    } else {
      // Remove sticker from unchecked screen
      if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.send('update-sticker-layout', {
          sticker: null,
          stickerUrl: null,
          screenId: screenId
        })
      }
      setSelectedScreens(prev => prev.filter(id => id !== screenId))
    }
  }

  // Set sticker for specific screen
  const handleSetStickerForScreen = (sticker, screenId) => {
    const screen = screens.find(s => s.id === screenId)
    if (!screen) return
    
    const stickerUrl = toFileUrl(sticker.path)
    const currentLayout = screenLayouts[screenId] || { x: 100, y: 100, width: 200, height: 200, sticker: null }
    
    const newLayout = {
      ...currentLayout,
      sticker: sticker,
      stickerUrl,
      screenId: screenId
    }
    
    // Update screen layouts
    const updatedScreenLayouts = { ...screenLayouts }
    updatedScreenLayouts[screenId] = newLayout
    setScreenLayouts(updatedScreenLayouts)
    
    // If this is the currently selected screen, update the main layout
    if (selectedScreen?.id === screenId) {
      setLayout(newLayout)
      setActiveSticker(sticker)
    }
    
    // Send to the specific screen
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('update-sticker-layout', {
        ...newLayout,
        screenId
      })
    }
    
    showToast(`Sticker set for ${screen.primary ? 'Primary Display' : `Display ${screen.index + 1}`}!`)
  }

  return (
    <div className="h-screen w-full bg-background text-foreground flex flex-col overflow-hidden">
      <CustomTitleBar title="VibeLayer" theme={settings.theme} />
      <DotPattern className="[mask-image:radial-gradient(300px_circle_at_center,white,transparent)]" />
      <div className="relative z-10 flex-1 overflow-y-auto p-6 pt-10">
        <Tabs value={tab} onValueChange={setTab} className="mb-6">
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t} value={t}>
                {t}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="Search">
            <TabsContent value="Search">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Local File Upload Box */}
                <Card className="p-4 flex flex-col items-center justify-between gap-2">
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="w-full text-left font-semibold text-2xl">Local File</div>
                    {loading && localFile ? (
                      <div className="text-sm text-muted-foreground">Loading...</div>
                    ) : (
                      localPreview ? <Button size={"sm"} className={"ml-auto bg-pink-600 text-white hover:bg-pink-700 cursor-pointer"} onClick={handleImportLocalButton}>Import</Button> : null
                    )}
                  </div>
                  <div className="w-full min-h-48 border border-dashed border-gray-300 dark:border-gray-600 rounded-md flex flex-col items-center justify-center p-6">
                    <Label htmlFor="local-file" className="cursor-pointer ">
                      Choose file...{' '}
                      <span className="text-sm text-muted-foreground">or Drag n Drop</span>
                    </Label>
                    <Input
                      id="local-file"
                      type="file"
                      accept="image/*"
                      onChange={handleImportLocal}
                      className="hidden"
                    />

                    <img
                      src={localPreview ?? downloadImg}
                      alt="preview"
                      className="w-24 h-24 object-cover rounded-md mt-4"
                      style={{ marginTop: '3px', marginBottom: '-15px' }}
                    />

                  </div>
                </Card>

                {/* URL Import Box */}
                <Card className="p-4 flex flex-col items-center justify-between gap-4">
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="w-full text-left font-semibold text-2xl">Direct Link</div>
                    {importUrl && <Button className={"ml-auto cursor-pointer bg-pink-600 text-white hover:bg-pink-700"} size={"sm"} onClick={handleImportUrl}>Import</Button>}

                  </div>
                  <div className="w-full min-h-48 flex flex-col items-center">

                    <Input
                      value={importUrl}
                      onChange={e => {
                        setImportUrl(e.target.value)
                        setImgError(false)
                      }}
                      placeholder="https://..."
                    />
                    <img
                      src={importUrl && !imgError ? importUrl : internetImg}
                      alt="internet"
                      className="w-24 h-24 object-cover rounded-md"
                      style={{ marginTop: '30px' }}
                      onError={() => setImgError(true)}
                    />
                  </div>
                </Card>
              </div>

              <div className="my-6" />

              <div className="mt-10" style={{ marginTop: "16px" }}>
                <div className="font-semibold mb-2 text-2xl">Search online</div>
                <div className="flex items-center gap-2 mb-4">
                  <Input
                    ref={searchRef}
                    placeholder="Start typing keywords..."
                    className="backdrop-blur-xs"
                  />
                  <Button className={"cursor-pointer bg-pink-600 text-white hover:bg-pink-700"} onClick={() => handleSearch(searchRef.current.value)} disabled={loading}>
                    <SearchIcon className="w-4 h-4" />
                  </Button>
                </div>

                {loading && searchRef.current && searchRef.current.value ? <div>Loading...</div> : null}

                {/* Search Results */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
                  {results.map((item, i) => (
                    <Card key={i} className="p-2 gap-2 flex flex-col items-center">
                      <img
                        src={item.thumb}
                        alt="result"
                        className="w-24 h-24 object-cover rounded-md"
                      />
                      <Button onClick={() => handleImport(item)} size="sm" className="mt-[2px] w-full bg-pink-600 text-white hover:bg-pink-700">
                        Import
                      </Button>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>
          </TabsContent>
          <TabsContent value="Layout">
            {/* Screen Selection */}
            <div className="mb-6">
              <div className="font-semibold mb-3 text-lg">Screen Selection</div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Preview Screen Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Preview Screen:</label>
                  <Select
                    value={selectedScreen?.id || ''}
                    onValueChange={handleScreenSelection}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select screen for preview" />
                    </SelectTrigger>
                    <SelectContent>
                      {screens.map((screen) => (
                        <SelectItem key={screen.id} value={screen.id}>
                          {screen.primary ? 'Primary Display' : `Display ${screen.index + 1}`} 
                          ({screen.bounds.width}x{screen.bounds.height})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Multi-Screen Display */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Display on Screens:</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {screens.map((screen) => (
                      <label key={screen.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={selectedScreens.includes(screen.id)}
                          onChange={(e) => handleMultiScreenSelection(screen.id, e.target.checked)}
                          className="accent-pink-600"
                        />
                        <span className="text-sm">
                          {screen.primary ? 'Primary Display' : `Display ${screen.index + 1}`}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 flex-wrap mb-8">
              {stickers.length === 0 && <div>No stickers yet.</div>}
              {stickers.map((sticker, i) => (
                <div key={i} className="bg-muted p-2 px-[30px] pb-[36px] rounded-lg flex flex-col items-center relative group">
                  <img
                    src={toFileUrl(sticker.path)}
                    alt="sticker"
                    className="w-24 h-24 rounded-lg mb-[2px]"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleDelete(sticker)}
                    className="absolute top-1 right-1 bg-transparent opacity-0 group-hover:opacity-100 duration-300 transition-opacity z-10"
                    aria-label="Delete"
                  >
                    <Trash className="w-2 h-2 text-red-500" />
                  </Button>
                  <div
                    className="text-xs text-center w-24 absolute bottom-[10px] truncate transition-opacity duration-400 group-hover:opacity-0"
                  >
                    {`Sticker ${i + 1}`}
                  </div>
                  <div className="flex gap-2 absolute bottom-[6px] opacity-0 duration-400 group-hover:opacity-100">
                    <Button
                      size="sm"
                      className="h-6 px-2 text-xs bg-pink-600 text-white hover:bg-pink-700"
                      onClick={() => handleSetStickerForScreen(sticker, selectedScreen.id)}
                    >
                      Set
                    </Button>
                    <Button
                      size="sm"
                      className="h-6 px-2 text-xs bg-primary"
                      onClick={() => handleRemoveBg(sticker)}
                    >
                      Remove BG
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="w-full flex justify-center mb-2">
              <div className="inline-block text-muted-foreground/80 text-md px-3 py-1 rounded-full border bg-card/70 border-card shadow-sm">
                Screen Preview - {selectedScreen?.primary ? 'Primary Display' : `Display ${selectedScreen?.index + 1}`} ({selectedScreen?.bounds.width}x{selectedScreen?.bounds.height})
              </div>
            </div>
            {activeSticker && selectedScreen && (
              <>
                {/* Sticker preview and Rnd */}
                <div
                  className="relative mx-auto p-2 rounded-xl border bg-card/60 backdrop-blur-md shadow-lg"
                  style={{
                    width: Math.min(previewWidth + 2, window.innerWidth - 48),
                    height: Math.min(previewHeight + 2, window.innerHeight - 400),
                    overflow: 'hidden',
                    boxSizing: 'content-box'
                  }}
                >
                  <div className="relative w-full h-full rounded-lg overflow-hidden" style={{ 
                    width: Math.min(previewWidth, window.innerWidth - 52), 
                    height: Math.min(previewHeight, window.innerHeight - 404) 
                  }}>
                    {screenStream ? (
                      <>
                        <canvas
                          ref={handleCanvasRef}
                          width={Math.min(previewWidth, window.innerWidth - 52)}
                          height={Math.min(previewHeight, window.innerHeight - 404)}
                          className="absolute top-0 left-0 w-full h-full z-0 rounded-lg"
                        />
                        <video ref={handleVideoRef} />
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted/50 rounded-lg">
                        <div className="text-center text-muted-foreground">
                          <div className="text-sm font-medium">Screen Preview Unavailable</div>
                          <div className="text-xs">Check console for details</div>
                        </div>
                      </div>
                    )}
                    <Rnd
                      className=''
                      size={{
                        width: layout.widthPct ? layout.widthPct * Math.min(previewWidth, window.innerWidth - 52) : layout.width,
                        height: layout.heightPct ? layout.heightPct * Math.min(previewHeight, window.innerHeight - 404) : layout.height
                      }}
                      position={{
                        x: layout.xPct ? layout.xPct * Math.min(previewWidth, window.innerWidth - 52) : layout.x,
                        y: layout.yPct ? layout.yPct * Math.min(previewHeight, window.innerHeight - 404) : layout.y
                      }}
                      onDragStop={(e, d) =>
                        handleLayoutChange(
                          d.x,
                          d.y,
                          layout.widthPct ? layout.widthPct * Math.min(previewWidth, window.innerWidth - 52) : layout.width,
                          layout.heightPct ? layout.heightPct * Math.min(previewHeight, window.innerHeight - 404) : layout.height
                        )
                      }
                      onResizeStop={(e, dir, ref, delta, pos) => {
                        const w = parseInt(ref.style.width);
                        const h = parseInt(ref.style.height);
                        handleLayoutChange(
                          pos.x,
                          pos.y,
                          w,
                          h
                        );
                      }}
                      bounds="parent"
                      style={{ zIndex: 1 }}
                      lockAspectRatio={aspectLock}
                    >
                      <div className='absolute top-0 left-0 w-full h-full z-2 border-[2px] transition-all duration-300 border-transparent hover:border-pink-600/33 rounded-sm'></div>
                      <img
                        src={toFileUrl(activeSticker.path)}
                        alt="active"
                        className="w-full h-full z-1"
                      />
                    </Rnd>
                  </div>
                </div>
                {/* Toolbar for width/height and aspect lock */}
                <div className="flex mt-4 items-center gap-4 mb-2 justify-center flex-wrap">
                  <label className="flex items-center gap-1 text-sm">
                    W(px) :
                    <input
                      type="number"
                      min={24}
                      max={Math.min(previewWidth, window.innerWidth - 52)}
                      value={toolbarSize.width}
                      onChange={e => handleToolbarSizeChange('width', e.target.value)}
                      className="w-16 px-2 py-1 border rounded text-sm bg-card"
                    />
                    
                  </label>
                  <label className="flex items-center gap-1 text-sm">
                    H(px) :
                    <input
                      type="number"
                      min={24}
                      max={Math.min(previewHeight, window.innerHeight - 404)}
                      value={toolbarSize.height}
                      onChange={e => handleToolbarSizeChange('height', e.target.value)}
                      className="w-16 px-2 py-1 border rounded text-sm bg-card"
                    />
                    
                  </label>
                  <label className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={aspectLock}
                      onChange={e => setAspectLock(e.target.checked)}
                      className="accent-pink-600"
                    />
                    Lock aspect ratio
                  </label>
                </div>
              </>
            )}
          </TabsContent>
          <TabsContent value="Settings">
            <div className="w-full flex flex-col gap-4">
              {/* Always on top */}
              <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-card/80">
                <div className="space-y-0.5">
                  <div className="font-medium">Always on top</div>
                  <div className="text-muted-foreground text-sm">Keep the window always on top of other windows.</div>
                </div>
                <Switch
                  checked={settings.alwaysOnTop}
                  onCheckedChange={v => handleSettingsChange('alwaysOnTop', v)}
                />
              </div>
              {/* Start on system startup */}
              <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-card/80">
                <div className="space-y-0.5">
                  <div className="font-medium">Start on system startup</div>
                  <div className="text-muted-foreground text-sm">Launch the app automatically when your system starts.</div>
                </div>
                <Switch
                  checked={autoLaunch}
                  onCheckedChange={v => {
                    setAutoLaunch(v)
                    handleSettingsChange('startup', v)
                  }}
                />
              </div>
              {/* Hide sticker capture */}
              <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-card/80">
                <div className="space-y-0.5">
                  <div className="font-medium">Hide sticker capture</div>
                  <div className="text-muted-foreground text-sm">Protect stickers from being captured in screenshots.</div>
                </div>
                <Switch
                  checked={settings.hideStickerCapture}
                  onCheckedChange={v => handleSettingsChange('hideStickerCapture', v)}
                />
              </div>
              {/* Theme select */}
              <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm bg-card/80">
                <div className="space-y-0.5">
                  <div className="font-medium">Theme</div>
                  <div className="text-muted-foreground text-sm">Choose between dark and light mode.</div>
                </div>
                <Select
                  value={settings.theme}
                  onValueChange={v => handleSettingsChange('theme', v)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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
