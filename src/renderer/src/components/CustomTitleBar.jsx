import React from 'react'
import { Button } from './ui/button'

export default function CustomTitleBar({ title = 'VibeLayer', theme = 'dark' }) {
  // Use window.api for safe IPC calls
  const api = window.api

  const handleMinimize = () => {
    console.log('Minimize button clicked')
    api?.minimizeWindow()
  }

  const handleMaximize = () => {
    console.log('Maximize button clicked')
    api?.maximizeWindow()
  }

  const handleClose = () => {
    console.log('Close button clicked')
    api?.closeWindow()
  }

  return (
    <div
      className={`flex absolute top-0 left-0 right-0 items-center justify-between px-4 py-2 select-none ${theme === 'dark' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-black'}`}
      style={{ WebkitAppRegion: 'drag', userSelect: 'none', height: 40 }}
    >
      <span className="font-semibold tracking-wide text-base">{title}</span>
      <div className="flex gap-2 z-50" style={{ WebkitAppRegion: 'no-drag' }}>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Minimize"
          onClick={handleMinimize}
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <rect x="3" y="8" width="10" height="2" rx="1" fill="currentColor" />
          </svg>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Maximize"
          onClick={handleMaximize}
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <rect
              x="3"
              y="3"
              width="10"
              height="10"
              rx="2"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </Button>
        <Button size="icon" variant="ghost" aria-label="Close" onClick={handleClose}>
          <svg width="16" height="16" viewBox="0 0 16 16">
            <line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" strokeWidth="2" />
            <line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" strokeWidth="2" />
          </svg>
        </Button>
      </div>
    </div>
  )
}
