import { useState, useRef, useEffect } from 'react'
import { musicData } from '../data/music'

export const useMusicPlayer = () => {
  const [playlist] = useState(musicData)
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef(null)

  const currentTrack = playlist[currentTrackIndex]

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch((e) => console.error('Play error:', e))
      } else {
        audioRef.current.pause()
      }
    }
  }, [isPlaying, currentTrackIndex])

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  const playNext = () => {
    setCurrentTrackIndex((prevIndex) => (prevIndex + 1) % playlist.length)
    setIsPlaying(true)
  }

  const playPrevious = () => {
    setCurrentTrackIndex((prevIndex) => (prevIndex - 1 + playlist.length) % playlist.length)
    setIsPlaying(true)
  }

  const handleEnded = () => {
    playNext()
  }

  return {
    audioRef,
    currentTrack,
    isPlaying,
    togglePlayPause,
    playNext,
    playPrevious,
    handleEnded
  }
} 