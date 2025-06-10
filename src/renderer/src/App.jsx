import { useState, useEffect, useRef, useCallback } from 'react'
import { GiphyFetch } from '@giphy/js-fetch-api'
import { createApi } from 'unsplash-js'
import { Rnd } from 'react-rnd'
import * as imglyRemoveBackground from '@imgly/background-removal'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs'
import { DotPattern } from '../../components/magicui/dot-pattern'
import CustomTitleBar from './components/CustomTitleBar'

function toFileUrl(filePath) {
  let path = filePath.replace(/\\/g, '/');

  if (/^[A-Za-z]:\//.test(path)) {
    // Ensure three slashes for Windows drive paths and encode the path
    return 'file:///' + encodeURI(path);
  }

  // Handle other paths (e.g., network paths, relative paths)
  return 'file://' + encodeURI(path);
}

const gf = new GiphyFetch(import.meta.env.VITE_GIPHY_API_KEY || '')
const unsplash = createApi({ accessKey: import.meta.env.VITE_UNSPLASH_ACCESS_KEY || '' })
const TABS = ['Search', 'Layout', 'Settings']

function App() {
  const [tab, setTab] = useState('Search')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [stickers, setStickers] = useState([])
  const [importUrl, setImportUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [layout, setLayout] = useState({ x: 100, y: 100, width: 200, height: 200, sticker: null })
  const [activeSticker, setActiveSticker] = useState(null)
  const [renameId, setRenameId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [toast, setToast] = useState('')
  const [settings, setSettings] = useState({ alwaysOnTop: true, theme: 'dark', startup: false })
  const [autoLaunch, setAutoLaunch] = useState(false)
  const toastTimeout = useRef(null)
  const [localFile, setLocalFile] = useState(null)
  const [localPreview, setLocalPreview] = useState(null)
  const [screenSize, setScreenSize] = useState({ width: 1920, height: 1080 });
  const [screenStream, setScreenStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => { fetchStickers() }, [tab])
  useEffect(() => { loadLayout() }, [])
  useEffect(() => { loadSettings() }, [])
  useEffect(() => {
    (async () => {
      // 1· Get screen size (unchanged)
      if (window.electron?.getScreenInfo) {
        const { width, height } = await window.electron.getScreenInfo();
        setScreenSize({ width, height });
      }
  
      // 2· Ask preload for the primary screen's source-ID
      if (window.electron?.getPrimaryScreenSourceId) {
        const sourceId = await window.electron.getPrimaryScreenSourceId();
  
        // 3· Create a real MediaStream *in the renderer*
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
        });
        setScreenStream(stream);      // ← now a genuine MediaStream
      }
    })();
  }, []);
  useEffect(() => { 
    // Set dark mode class on root for shadcn/tailwind
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings.theme]);
  
  const previewScale = 0.25;
  const previewWidth = Math.round(screenSize.width * previewScale);
  const previewHeight = Math.round(screenSize.height * previewScale);

  const initDrawingIfReady = useCallback(() => {
    // Make sure everything is ready
    if (!screenStream || !videoRef.current || !canvasRef.current) return;
  
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
  
    // Keep canvas in sync with preview dimensions
    canvas.width  = previewWidth;
    canvas.height = previewHeight;
  
    // Attach stream only once
    if (!video.srcObject) {
      video.srcObject   = screenStream;
      video.muted       = true;
      video.playsInline = true;       // avoids autoplay block :contentReference[oaicite:1]{index=1}
    }
  
    // Start drawing after metadata is ready
    const start = () => {
      video.play().catch(console.error);   // handle promise   :contentReference[oaicite:2]{index=2}
      const render = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height); // canvas API :contentReference[oaicite:3]{index=3}
        requestAnimationFrame(render);     // 60 fps & efficient :contentReference[oaicite:4]{index=4}
      };
      requestAnimationFrame(render);
    };
  
    video.addEventListener('loadedmetadata', start, { once: true }); // fire when size known :contentReference[oaicite:5]{index=5}
  }, [screenStream, previewWidth, previewHeight]);
  

  const handleVideoRef = useCallback(
    (node) => {
      if (node) {
        console.log('Video node is ready');
        videoRef.current = node;
        initDrawingIfReady();
      }
    },
    [screenStream, previewWidth, previewHeight]
  );

  const handleCanvasRef = useCallback( 
    (node) => {
      if (node) {
        console.log('Canvas node is ready');
        canvasRef.current = node; 
        initDrawingIfReady();
      }
    },
    [screenStream, previewWidth, previewHeight]
  );


  const showToast = (msg) => {
    setToast(msg)
    if (toastTimeout.current) clearTimeout(toastTimeout.current)
    toastTimeout.current = setTimeout(() => setToast(''), 2000)
  }

  const fetchStickers = async () => {
    const files = await window.electron.ipcRenderer.invoke('list-stickers')
    files.forEach(sticker => console.log('Sticker path:', sticker.path))
    setStickers(files)
  }
  const saveSticker = async (buffer, ext = 'png') => {
    const name = `sticker_${Date.now()}.${ext}`
    const filePath = await window.electron.ipcRenderer.invoke('save-sticker', { name, buffer })
    console.log('Sticker saved at:', filePath)
    fetchStickers(); showToast('Sticker imported!')
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
  }

  const handleSearch = async () => {
    setLoading(true)
    setResults([])
    const { data: giphyData } = await gf.search(search, { limit: 5 })
    const unsplashRes = await unsplash.search.getPhotos({ query: search, perPage: 5 })
    const giphyResults = giphyData.map(gif => ({ type: 'gif', url: gif.images.original.url, thumb: gif.images.fixed_width_small.url }))
    const unsplashResults = (unsplashRes.response?.results || []).map(img => ({ type: 'img', url: img.urls.raw, thumb: img.urls.thumb }))
    setResults([...giphyResults, ...unsplashResults])
    setLoading(false)
  }

  const handleImportUrl = async () => {
    if (!importUrl || !importUrl.trim()) {
      showToast('Please enter a valid image URL.');
      return;
    }
    setLoading(true);
    try {
      const filePath = await window.electron.ipcRenderer.invoke('import-sticker-url', importUrl.trim());
      if (filePath) {
        fetchStickers();
        showToast('Sticker imported!');
        setImportUrl('');
      }
    } catch (e) {
      showToast(e?.message || 'Import failed!');
    }
    setLoading(false);
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
    if (!localFile) return
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
    } catch (e) { showToast('Import failed!') }
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
      await window.electron.ipcRenderer.invoke('save-sticker', { name: sticker.name, buffer: resultBuffer })
      fetchStickers(); showToast('Background removed!')
    } catch (e) { showToast('Background removal failed!') }
    setLoading(false)
  }
  // Delete sticker
  const handleDelete = async (sticker) => {
    await window.electron.ipcRenderer.invoke('delete-sticker', sticker.name)
    fetchStickers(); showToast('Sticker deleted!')
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
    const newLayout = { ...l, sticker: sticker, stickerUrl }
    setLayout(newLayout)
    saveLayout(newLayout)
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('update-sticker-layout', newLayout)
    }
    showToast('Sticker set!')
  }
  // Rename sticker
  const handleRename = async (sticker) => {
    if (!renameValue) return
    await window.electron.ipcRenderer.invoke('rename-sticker', { oldName: sticker.name, newName: renameValue })
    setRenameId(null); setRenameValue(''); fetchStickers(); showToast('Sticker renamed!')
  }
  // Layout drag/resize
  const handleLayoutChange = (x, y, width, height) => {
    const newLayout = {
      ...layout,
      xPct: x / previewWidth,
      yPct: y / previewHeight,
      widthPct: width / previewWidth,
      heightPct: height / previewHeight,
      sticker: activeSticker
    };
    setLayout(newLayout);
    saveLayout(newLayout);
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('update-sticker-layout', {
        ...newLayout,
        stickerUrl: newLayout.sticker ? toFileUrl(newLayout.sticker.path) : undefined
      });
    }
  };
  // Settings
  const handleSettingsChange = async (field, value) => {
    const newSettings = { ...settings, [field]: value }
    setSettings(newSettings)
    saveSettings(newSettings)
    if (field === 'startup') await window.electron.ipcRenderer.invoke('set-auto-launch', value)
  }

  console.log('screenStream:', screenStream);
console.log('Constructor name:', screenStream?.constructor?.name);


  return (
    <div className="min-h-screen w-full p-6 bg-background text-foreground grid grid-cols-1 relative overflow-hidden">
      <CustomTitleBar title="VibeLayer" theme={settings.theme} />
      <DotPattern className="opacity-40 z-0 w-full h-full" />
      <div className="relative z-10 pt-10">
        <Tabs value={tab} onValueChange={setTab} className="mb-6">
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t} value={t}>{t}</TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="Search">
            <div className="flex items-center mb-4">
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search for stickers or GIFs..." className="w-72 mr-2" />
              <Button onClick={handleSearch} disabled={loading}>Search</Button>
            </div>
            {loading && <div className="mt-4">Loading...</div>}
            <div className="mt-6">
              <div className="flex gap-4 flex-wrap">
                {results.map((item, i) => (
                  <div key={i} className="bg-muted p-2 rounded-lg">
                    <img src={item.thumb} alt="result" className="w-24 h-24 rounded-lg" />
                    <Button onClick={() => handleImport(item)} className="mt-2 w-full">Import</Button>
                  </div>
                ))}
              </div>
              {!search && (
                <div className="mt-8">
                  <div>Import from URL:</div>
                  <div className="flex items-center mt-2">
                    <Input value={importUrl} onChange={e => setImportUrl(e.target.value)} placeholder="Paste image URL..." className="w-72 mr-2" />
                    <Button onClick={handleImportUrl}>Import</Button>
                  </div>
                  <div className="mt-4">
                    <div>Import from local file:</div>
                    <Input type="file" accept="image/*" onChange={handleImportLocal} className="mt-2" />
                    {localFile && (
                      <div className="mt-2 flex items-center">
                        <span>{localFile.name}</span>
                        <Button onClick={handleImportLocalButton} className="ml-2">Import</Button>
                        {localPreview && (
                          <div className="mt-2">
                            <img src={localPreview} alt="preview" className="w-24 h-24 rounded-lg" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="Layout">
            <div className="flex gap-4 flex-wrap mb-8">
              {stickers.length === 0 && <div>No stickers yet.</div>}
              {stickers.map((sticker, i) => (
                <div key={i} className="bg-muted p-2 rounded-lg flex flex-col items-center">
                  <img src={toFileUrl(sticker.path)} alt="sticker" className="w-24 h-24 rounded-lg mb-2" />
                  {renameId === sticker.name ? (
                    <div className="flex gap-1">
                      <Input value={renameValue} onChange={e => setRenameValue(e.target.value)} className="w-20" />
                      <Button size="sm" className="h-6 px-2 text-xs bg-primary" onClick={() => handleRename(sticker)}>Save</Button>
                      <Button size="sm" className="h-6 px-2 text-xs bg-destructive" onClick={() => { setRenameId(null); setRenameValue('') }}>Cancel</Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" className="h-6 px-2 text-xs bg-primary" onClick={() => handleSetSticker(sticker)}>Set</Button>
                      <Button size="sm" className="h-6 px-2 text-xs bg-green-600" onClick={() => handleRemoveBg(sticker)}>Remove BG</Button>
                      <Button size="sm" className="h-6 px-2 text-xs bg-destructive" onClick={() => handleDelete(sticker)}>Delete</Button>
                      <Button size="sm" className="h-6 px-2 text-xs bg-orange-500" onClick={() => { setRenameId(sticker.name); setRenameValue(sticker.name) }}>Rename</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {activeSticker && (
              <div className="relative mx-auto" style={{ width: previewWidth, height: previewHeight, background: '#111', borderRadius: 2, overflow: 'hidden' }}>
                <canvas ref={handleCanvasRef} width={previewWidth} height={previewHeight} className="absolute top-0 left-0 w-full h-full z-0" />
                <video ref={handleVideoRef} />
                <Rnd
                  size={{
                    width: layout.widthPct ? layout.widthPct * previewWidth : layout.width,
                    height: layout.heightPct ? layout.heightPct * previewHeight : layout.height
                  }}
                  position={{
                    x: layout.xPct ? layout.xPct * previewWidth : layout.x,
                    y: layout.yPct ? layout.yPct * previewHeight : layout.y
                  }}
                  onDragStop={(e, d) => handleLayoutChange(d.x, d.y, layout.widthPct ? layout.widthPct * previewWidth : layout.width, layout.heightPct ? layout.heightPct * previewHeight : layout.height)}
                  onResizeStop={(e, dir, ref, delta, pos) => handleLayoutChange(pos.x, pos.y, parseInt(ref.style.width), parseInt(ref.style.height))}
                  bounds="parent"
                  style={{ zIndex: 1 }}
                >
                  <img src={toFileUrl(activeSticker.path)} alt="active" className="w-full h-full z-1" />
                </Rnd>
              </div>
            )}
          </TabsContent>
          <TabsContent value="Settings">
            <div className="max-w-sm">
              <div className="mb-4">
                <label className="flex items-center gap-2">
                  <Input type="checkbox" checked={settings.alwaysOnTop} onChange={e => handleSettingsChange('alwaysOnTop', e.target.checked)} /> Always on top
                </label>
              </div>
              <div className="mb-4">
                <label className="flex items-center gap-2">
                  <Input type="checkbox" checked={autoLaunch} onChange={e => { setAutoLaunch(e.target.checked); handleSettingsChange('startup', e.target.checked) }} /> Start on system startup
                </label>
              </div>
              <div className="mb-4">
                <label>Theme: </label>
                <Select value={settings.theme} onValueChange={v => handleSettingsChange('theme', v)}>
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
        {toast && <div className="fixed top-6 right-6 bg-muted text-foreground px-6 py-3 rounded-lg z-50 shadow-lg">{toast}</div>}
      </div>
    </div>
  )
}

export default App
