import { useState, useEffect, useRef, useCallback } from 'react'
import { Rnd } from 'react-rnd'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select'
import { Trash } from 'lucide-react'
import { toFileUrl } from '../utils/fileUtils'
import { useImageAspectRatio } from '../hooks/useImageAspectRatio'

const LayoutTab = ({
  activeSticker,
  selectedScreen,
  screens,
  selectedScreens,
  layout,
  screenSize,
  screenStream,
  stickers,
  onLayoutChange,
  onScreenSelection,
  onMultiScreenSelection,
  onSetStickerForScreen,
  onDelete,
  onRemoveBg
}) => {
  const [aspectLock, setAspectLock] = useState(true)
  const [toolbarSize, setToolbarSize] = useState({ width: 200, height: 200 })
  const [sizeDialogOpen, setSizeDialogOpen] = useState(false)
  const [tempSize, setTempSize] = useState({ width: '', height: '' })
  const [selectedSticker, setSelectedSticker] = useState(null)
  const aspectRatio = useImageAspectRatio(selectedSticker)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  const previewScale = 0.25
  const previewWidth = Math.round(screenSize.width * previewScale)
  const previewHeight = Math.round(screenSize.height * previewScale)

  useEffect(() => {
    if (activeSticker && layout.width && layout.height) {
      setToolbarSize({
        width: Math.round(layout.widthPct ? layout.widthPct * previewWidth : layout.width),
        height: Math.round(layout.heightPct ? layout.heightPct * previewHeight : layout.height)
      })
    }
  }, [activeSticker, layout, previewWidth, previewHeight])

  const initDrawingIfReady = useCallback(() => {
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

    canvas.width = previewWidth
    canvas.height = previewHeight

    if (!video.srcObject) {
      video.srcObject = screenStream
      video.muted = true
      video.playsInline = true
    }

    const start = () => {
      console.log('Starting video playback and drawing')
      video.play().catch(console.error)
      const render = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        requestAnimationFrame(render)
      }
      requestAnimationFrame(render)
    }

    video.addEventListener('loadedmetadata', start, { once: true })
  }, [screenStream, previewWidth, previewHeight])

  useEffect(() => {
    if (screenStream) {
      console.log('Screen stream changed, reinitializing drawing')
      initDrawingIfReady()
    }
  }, [screenStream, initDrawingIfReady])

  const handleVideoRef = useCallback((node) => {
    if (node) {
      console.log('Video node is ready')
      videoRef.current = node
    }
  }, [])

  const handleCanvasRef = useCallback((node) => {
    if (node) {
      console.log('Canvas node is ready')
      canvasRef.current = node
    }
  }, [])

  const getAspectRatio = () => {
    const w = layout.widthPct ? layout.widthPct * previewWidth : layout.width
    const h = layout.heightPct ? layout.heightPct * previewHeight : layout.height
    return w / h
  }

  const openSizeDialog = () => {
    setTempSize({
      width: toolbarSize.width.toString(),
      height: toolbarSize.height.toString()
    })
    setSizeDialogOpen(true)
  }

  const closeSizeDialog = () => {
    setSizeDialogOpen(false)
    setTempSize({ width: '', height: '' })
  }

  const applySizeDialog = () => {
    const newWidth = Math.max(24, Math.min(Number(tempSize.width), previewWidth))
    const newHeight = Math.max(24, Math.min(Number(tempSize.height), previewHeight))

    setToolbarSize({ width: newWidth, height: newHeight })

    onLayoutChange(
      layout.xPct ? layout.xPct * previewWidth : layout.x,
      layout.yPct ? layout.yPct * previewHeight : layout.y,
      newWidth,
      newHeight
    )

    closeSizeDialog()
  }

  const handleTempSizeChange = (field, value) => {
    setTempSize((prev) => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && sizeDialogOpen) {
        closeSizeDialog()
      }
    }

    const handleEnter = (e) => {
      if (e.key === 'Enter' && sizeDialogOpen && tempSize.width && tempSize.height) {
        applySizeDialog()
      }
    }

    if (sizeDialogOpen) {
      document.addEventListener('keydown', handleEscape)
      document.addEventListener('keydown', handleEnter)
      return () => {
        document.removeEventListener('keydown', handleEscape)
        document.removeEventListener('keydown', handleEnter)
      }
    }
  }, [sizeDialogOpen, tempSize.width, tempSize.height])

  useEffect(() => {
    if (aspectRatio && selectedSticker && selectedScreen) {
      onSetStickerForScreen(selectedSticker, selectedScreen.id, { aspectRatio })
      setSelectedSticker(null)
    }
  }, [aspectRatio, selectedSticker, selectedScreen, onSetStickerForScreen])

  return (
    <div className="space-y-6">
      <div className="w-full flex justify-center mb-2">
        <div className="inline-block text-muted-foreground/80 text-md px-3 py-1 rounded-full border bg-card/70 border-card shadow-sm">
          Screen Preview -{' '}
          {selectedScreen?.primary ? 'Primary Display' : `Display ${selectedScreen?.index + 1}`} (
          {selectedScreen?.bounds.width}x{selectedScreen?.bounds.height})
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
            <div
              className="relative w-full h-full rounded-lg overflow-hidden"
              style={{
                width: Math.min(previewWidth, window.innerWidth - 52),
                height: Math.min(previewHeight, window.innerHeight - 404)
              }}
            >
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
                className=""
                size={{
                  width: layout.widthPct
                    ? layout.widthPct * Math.min(previewWidth, window.innerWidth - 52)
                    : layout.width,
                  height: layout.heightPct
                    ? layout.heightPct * Math.min(previewHeight, window.innerHeight - 404)
                    : layout.height
                }}
                position={{
                  x: layout.xPct
                    ? layout.xPct * Math.min(previewWidth, window.innerWidth - 52)
                    : layout.x,
                  y: layout.yPct
                    ? layout.yPct * Math.min(previewHeight, window.innerHeight - 404)
                    : layout.y
                }}
                onDragStop={(e, d) =>
                  onLayoutChange(
                    d.x,
                    d.y,
                    layout.widthPct
                      ? layout.widthPct * Math.min(previewWidth, window.innerWidth - 52)
                      : layout.width,
                    layout.heightPct
                      ? layout.heightPct * Math.min(previewHeight, window.innerHeight - 404)
                      : layout.height
                  )
                }
                onResizeStop={(e, dir, ref, delta, pos) => {
                  const w = parseInt(ref.style.width)
                  const h = parseInt(ref.style.height)
                  onLayoutChange(pos.x, pos.y, w, h)
                }}
                bounds="parent"
                style={{ zIndex: 1 }}
                lockAspectRatio={aspectLock}
              >
                <div className="absolute top-0 left-0 w-full h-full z-2 border-[2px] transition-all duration-300 border-transparent hover:border-pink-600/33 rounded-sm"></div>
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
            <Button
              onClick={openSizeDialog}
              className="bg-pink-600 text-white hover:bg-pink-700"
              size="sm"
            >
              Set Size
            </Button>
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={aspectLock}
                onChange={(e) => setAspectLock(e.target.checked)}
                className="accent-pink-600"
              />
              Lock aspect ratio
            </label>
          </div>

          {/* Size Dialog */}
          {sizeDialogOpen && (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
              onClick={closeSizeDialog}
            >
              <div
                className="bg-card border rounded-lg p-6 w-80 max-w-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold mb-4">Set Sticker Size</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Width (px)</label>
                    <Input
                      type="number"
                      min={24}
                      max={Math.min(previewWidth, window.innerWidth - 52)}
                      value={tempSize.width}
                      onChange={(e) => handleTempSizeChange('width', e.target.value)}
                      placeholder="Enter width"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Height (px)</label>
                    <Input
                      type="number"
                      min={24}
                      max={Math.min(previewHeight, window.innerHeight - 404)}
                      value={tempSize.height}
                      onChange={(e) => handleTempSizeChange('height', e.target.value)}
                      placeholder="Enter height"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={applySizeDialog}
                      className="flex-1 bg-pink-600 text-white hover:bg-pink-700"
                      disabled={!tempSize.width || !tempSize.height}
                    >
                      Apply
                    </Button>
                    <Button onClick={closeSizeDialog} variant="outline" className="flex-1">
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Screen Selection */}
      <div className="mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Preview Screen Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Preview Screen:</label>
            <Select value={selectedScreen?.id || ''} onValueChange={onScreenSelection}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select screen for preview" />
              </SelectTrigger>
              <SelectContent>
                {screens.map((screen) => (
                  <SelectItem key={screen.id} value={screen.id}>
                    {screen.primary ? 'Primary Display' : `Display ${screen.index + 1}`}(
                    {screen.bounds.width}x{screen.bounds.height})
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
                    onChange={(e) => onMultiScreenSelection(screen.id, e.target.checked)}
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

      <div className="font-semibold mb-3 text-lg mt-4">Stickers</div>
      <div className="flex gap-4 flex-wrap mb-8">
        {stickers.length === 0 && <div>No stickers yet.</div>}
        {stickers.map((sticker, i) => (
          <div
            key={i}
            className="bg-muted p-2 px-[30px] pb-[36px] rounded-lg flex flex-col items-center relative group"
          >
            <img
              src={toFileUrl(sticker.path)}
              alt="sticker"
              className="w-24 h-24 rounded-lg mb-[2px]"
            />
            <Button
              size="icon"
              variant="outline"
              onClick={() => onDelete(sticker)}
              className="absolute top-1 right-1 bg-transparent opacity-0 group-hover:opacity-100 duration-300 transition-opacity z-10"
              aria-label="Delete"
            >
              <Trash className="w-2 h-2 text-red-500" />
            </Button>
            <div className="text-xs text-center w-24 absolute bottom-[10px] truncate transition-opacity duration-400 group-hover:opacity-0">
              {`Sticker ${i + 1}`}
            </div>
            <div className="flex gap-2 absolute bottom-[6px] opacity-0 duration-400 group-hover:opacity-100">
              <Button
                size="sm"
                className="h-6 px-2 text-xs bg-pink-600 text-white hover:bg-pink-700"
                onClick={() => setSelectedSticker(sticker)}
              >
                Set
              </Button>
              <Button
                size="sm"
                className="h-6 px-2 text-xs bg-primary"
                onClick={() => onRemoveBg(sticker)}
              >
                Remove BG
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default LayoutTab
