import { useState, useRef } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card } from './ui/card'
import { SearchIcon } from 'lucide-react'
import internetImg from '../assets/internet.png'
import downloadImg from '../assets/download.png'

const SearchTab = ({ loading, results, onSearch, onImport, onImportUrl, onImportLocal }) => {
  const [localFile, setLocalFile] = useState(null)
  const [localPreview, setLocalPreview] = useState(null)
  const [importUrl, setImportUrl] = useState('')
  const [imgError, setImgError] = useState(false)
  const searchRef = useRef()

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
      return false
    }
    const arrayBuffer = await localFile.arrayBuffer()
    const ext = localFile.name.split('.').pop()
    await onImportLocal(arrayBuffer, ext)
    setLocalFile(null)
    setLocalPreview(null)
    return true
  }

  const handleImportUrlSubmit = async () => {
    if (!importUrl || !importUrl.trim()) {
      return false
    }
    await onImportUrl(importUrl.trim())
    setImportUrl('')
    return true
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Local File Upload Box */}
        <Card className="p-4 flex flex-col items-center justify-between gap-2">
          <div className="flex w-full items-center justify-between gap-2">
            <div className="w-full text-left font-semibold text-2xl">Local File</div>
            {loading && localFile ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : localPreview ? (
              <Button
                size={'sm'}
                className={'ml-auto bg-pink-600 text-white hover:bg-pink-700 cursor-pointer'}
                onClick={handleImportLocalButton}
              >
                Import
              </Button>
            ) : null}
          </div>
          <div className="w-full min-h-48 border border-dashed border-gray-300 dark:border-gray-600 rounded-md flex flex-col items-center justify-center p-6">
            <Label htmlFor="local-file" className="cursor-pointer">
              Choose file... <span className="text-sm text-muted-foreground">or Drag n Drop</span>
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
            {importUrl && (
              <Button
                className={'ml-auto cursor-pointer bg-pink-600 text-white hover:bg-pink-700'}
                size={'sm'}
                onClick={handleImportUrlSubmit}
              >
                Import
              </Button>
            )}
          </div>
          <div className="w-full min-h-48 flex flex-col items-center">
            <Input
              value={importUrl}
              onChange={(e) => {
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

      <div className="mt-10" style={{ marginTop: '16px' }}>
        <div className="font-semibold mb-2 text-2xl">Search online</div>
        <div className="flex items-center gap-2 mb-4">
          <Input
            ref={searchRef}
            placeholder="Start typing keywords..."
            className="backdrop-blur-xs"
          />
          <Button
            className={'cursor-pointer bg-pink-600 text-white hover:bg-pink-700'}
            onClick={() => onSearch(searchRef.current.value)}
            disabled={loading}
          >
            <SearchIcon className="w-4 h-4" />
          </Button>
        </div>

        {loading && searchRef.current && searchRef.current.value ? <div>Loading...</div> : null}

        {/* Search Results */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-4">
          {results.map((item, i) => (
            <Card key={i} className="p-2 gap-2 flex flex-col items-center">
              <img src={item.thumb} alt="result" className="w-24 h-24 object-cover rounded-md" />
              <Button
                onClick={() => onImport(item)}
                size="sm"
                className="mt-[2px] w-full bg-pink-600 text-white hover:bg-pink-700"
              >
                Import
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SearchTab
