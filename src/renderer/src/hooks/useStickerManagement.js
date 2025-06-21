import { useState, useRef } from 'react'
import { GiphyFetch } from '@giphy/js-fetch-api'
import { createApi } from 'unsplash-js'
import * as imglyRemoveBackground from '@imgly/background-removal'
import { toFileUrl } from '../utils/fileUtils'

const gf = new GiphyFetch(import.meta.env.VITE_GIPHY_API_KEY || '')
const unsplash = createApi({ accessKey: import.meta.env.VITE_UNSPLASH_ACCESS_KEY || '' })

export const useStickerManagement = () => {
  const [stickers, setStickers] = useState([])
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const toastTimeout = useRef(null)

  const showToast = (msg) => {
    // This will be handled by the parent component
    return msg
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
    return 'Sticker imported!'
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

  const handleImportUrl = async (url) => {
    if (!url || !url.trim()) {
      return 'Please enter a valid image URL.'
    }
    setLoading(true)
    try {
      const filePath = await window.electron.ipcRenderer.invoke('import-sticker-url', url.trim())
      if (filePath) {
        fetchStickers()
        setLoading(false)
        return 'Sticker imported!'
      }
    } catch (e) {
      setLoading(false)
      return e?.message || 'Import failed!'
    }
  }

  const handleImport = async (item) => {
    setLoading(true)
    try {
      const response = await fetch(item.url)
      const blob = await response.blob()
      const arrayBuffer = await blob.arrayBuffer()
      const ext = blob.type.split('/')[1] || 'png'
      const result = await saveSticker(arrayBuffer, ext)
      setLoading(false)
      return result
    } catch (e) {
      setLoading(false)
      return 'Import failed!'
    }
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
      setLoading(false)
      return 'Background removed!'
    } catch (e) {
      setLoading(false)
      return 'Background removal failed!'
    }
  }

  const handleDelete = async (sticker) => {
    await window.electron.ipcRenderer.invoke('delete-sticker', sticker.name)
    fetchStickers()
    return 'Sticker deleted!'
  }

  return {
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
  }
}
