import { useState, useEffect, useRef, useCallback } from 'react'
import { GiphyFetch } from '@giphy/js-fetch-api'
import { createApi } from 'unsplash-js'
import { Rnd } from 'react-rnd'
import * as imglyRemoveBackground from '@imgly/background-removal'

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
      
          // 2· Ask preload for the primary screen’s source-ID
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
    
  
  // useEffect(() => {
  //   if (!screenStream){ 
  //     console.log('Screen stream is not ready');
  //     return; }
  //    if(!videoRef.current) {
  //     console.log('Video node is not ready');
  //     return;
  //    }
  //    if(!canvasRef.current) {
  //     console.log('Canvas node is not ready');
  //     return;
  //    }

  //   const video  = videoRef.current;
  //   const canvas = canvasRef.current;
  //   const ctx    = canvas.getContext('2d');
  
  //   // Attach stream
  //   video.srcObject   = screenStream;
  //   video.muted       = true;       // autoplay safe
  //   video.playsInline = true;
  
  //   // Draw once metadata is ready
  //   const start = () => {
  //     video.play().catch(console.error);   // handle any promise rejection
  
  //     // Make sure canvas always matches preview dimensions
  //     canvas.width  = previewWidth;
  //     canvas.height = previewHeight;
  
  //     const render = () => {
  //       ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  //       requestAnimationFrame(render);     // ~60 fps, feels live
  //     };
  //     requestAnimationFrame(render);
  //   };
  
  //   video.addEventListener('loadedmetadata', start, { once: true });
  
  //   return () => {                       // cleanup on unmount/stream change
  //     video.pause();
  //     video.srcObject = null;
  //   };
  // }, [screenStream, previewWidth, previewHeight]);
  

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
    setLoading(true)
    try {
      const response = await fetch(importUrl)
      const blob = await response.blob()
      const arrayBuffer = await blob.arrayBuffer()
      const ext = blob.type.split('/')[1] || 'png'
      await saveSticker(arrayBuffer, ext)
      setImportUrl('')
    } catch (e) { showToast('Import failed!') }
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
    <div style={{ background: settings.theme === 'dark' ? '#18181b' : '#fff', color: settings.theme === 'dark' ? '#fff' : '#222', minHeight: '100vh', padding: 24 }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ background: tab === t ? '#27272a' : 'transparent', color: 'inherit', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}>{t}</button>
        ))}
      </div>
      {toast && <div style={{ position: 'fixed', top: 24, right: 24, background: '#222', color: '#fff', padding: '12px 24px', borderRadius: 8, zIndex: 1000 }}>{toast}</div>}
      {tab === 'Search' && (
        <div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search for stickers or GIFs..." style={{ width: 300, padding: 8, borderRadius: 8, border: '1px solid #333', background: '#222', color: '#fff' }} />
          <button onClick={handleSearch} style={{ marginLeft: 8, padding: '8px 16px', borderRadius: 8, background: '#27272a', color: '#fff', border: 'none' }}>Search</button>
          {loading && <div style={{ marginTop: 16 }}>Loading...</div>}
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {results.map((item, i) => (
                <div key={i} style={{ background: '#222', padding: 8, borderRadius: 8 }}>
                  <img src={item.thumb} alt="result" style={{ width: 100, height: 100, borderRadius: 8 }} />
                  <button onClick={() => handleImport(item)} style={{ marginTop: 8, width: '100%', borderRadius: 8, background: '#3b82f6', color: '#fff', border: 'none', padding: 8 }}>Import</button>
                </div>
              ))}
            </div>
            {!search && (
              <div style={{ marginTop: 32 }}>
                <div>Import from URL:</div>
                <input value={importUrl} onChange={e => setImportUrl(e.target.value)} placeholder="Paste image URL..." style={{ width: 300, padding: 8, borderRadius: 8, border: '1px solid #333', background: '#222', color: '#fff', marginRight: 8 }} />
                <button onClick={handleImportUrl} style={{ padding: '8px 16px', borderRadius: 8, background: '#3b82f6', color: '#fff', border: 'none' }}>Import</button>
                <div style={{ marginTop: 16 }}>
                  <div>Import from local file:</div>
                  <input type="file" accept="image/*" onChange={handleImportLocal} />
                  {localFile && (
                    <div style={{ marginTop: 8 }}>
                      <span>{localFile.name}</span>
                      <button onClick={handleImportLocalButton} style={{ marginLeft: 8, padding: '4px 12px', borderRadius: 8, background: '#3b82f6', color: '#fff', border: 'none' }}>Import</button>
                      {localPreview && (
                        <div style={{ marginTop: 8 }}>
                          <img src={localPreview} alt="preview" style={{ width: 100, height: 100, borderRadius: 8 }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {tab === 'Layout' && (
        <div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
            {stickers.length === 0 && <div>No stickers yet.</div>}
            {stickers.map((sticker, i) => (
              <div key={i} style={{ background: '#222', padding: 8, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* Use toFileUrl for displaying sticker images */}
                <img src={toFileUrl(sticker.path)} alt="sticker" style={{ width: 100, height: 100, borderRadius: 8, marginBottom: 8 }} />
                {renameId === sticker.name ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input value={renameValue} onChange={e => setRenameValue(e.target.value)} style={{ width: 80 }} />
                    <button onClick={() => handleRename(sticker)} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 8px' }}>Save</button>
                    <button onClick={() => { setRenameId(null); setRenameValue('') }} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 8px' }}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleSetSticker(sticker)} style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 8px' }}>Set</button>
                    <button onClick={() => handleRemoveBg(sticker)} style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 8px' }}>Remove BG</button>
                    <button onClick={() => handleDelete(sticker)} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 8px' }}>Delete</button>
                    <button onClick={() => { setRenameId(sticker.name); setRenameValue(sticker.name) }} style={{ background: '#f59e42', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 8px' }}>Rename</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Drag/resize preview for active sticker */}
          {activeSticker && (
            <div style={{ position: 'relative', width: previewWidth, height: previewHeight, background: '#111', borderRadius: 16, margin: '0 auto', overflow: 'hidden' }}>
              {/* Live screen preview as background */}
              <canvas ref={handleCanvasRef} width={previewWidth} height={previewHeight} style={{ position: 'absolute', top: 0, left: 0, width: previewWidth, height: previewHeight, zIndex: 0 }} />
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
                {/* Use toFileUrl for the active sticker preview */}
                <img src={toFileUrl(activeSticker.path)} alt="active" style={{ width: '100%', height: '100%', zIndex: 1 }} />
              </Rnd>
            </div>
          )}
        </div>
      )}
      {tab === 'Settings' && (
        <div style={{ maxWidth: 400 }}>
          <div style={{ marginBottom: 16 }}>
            <label>
              <input type="checkbox" checked={settings.alwaysOnTop} onChange={e => handleSettingsChange('alwaysOnTop', e.target.checked)} /> Always on top
            </label>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>
              <input type="checkbox" checked={autoLaunch} onChange={e => { setAutoLaunch(e.target.checked); handleSettingsChange('startup', e.target.checked) }} /> Start on system startup
            </label>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>Theme: </label>
            <select value={settings.theme} onChange={e => handleSettingsChange('theme', e.target.value)}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
        </div>
      )}
      </div>
  )
}

export default App
