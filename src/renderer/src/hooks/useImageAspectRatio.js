import { useState, useEffect } from 'react'
import { toFileUrl } from '../utils/fileUtils'

export const useImageAspectRatio = (sticker) => {
  const [aspectRatio, setAspectRatio] = useState(null)

  useEffect(() => {
    if (!sticker) {
      setAspectRatio(null)
      return
    }

    const img = new Image()
    img.src = toFileUrl(sticker.path)

    const handleLoad = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setAspectRatio(img.naturalWidth / img.naturalHeight)
      }
    }

    img.addEventListener('load', handleLoad)

    return () => {
      img.removeEventListener('load', handleLoad)
    }
  }, [sticker])

  return aspectRatio
} 