import { Button } from './ui/button'
import { Play, Pause, StepBack, StepForward } from 'lucide-react'
import cover from '../assets/cd.png'

const MusicTab = ({ currentTrack, isPlaying, togglePlayPause, playNext, playPrevious }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full pt-12">
      <div className="relative w-64 h-64 mb-8">
        <img
          src={cover}
          alt="album cover"
          className={`rounded-full w-full h-full object-cover shadow-lg ${
            isPlaying ? 'animate-spin' : ''
          }`}
          style={{ animationDuration: '20s', animationPlayState: isPlaying ? 'running' : 'paused' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 bg-white rounded-full border-4 border-gray-300 dark:border-gray-700"></div>
        </div>
      </div>

      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold">{currentTrack.name}</h2>
        <p className="text-muted-foreground">{currentTrack.singer}</p>
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={playPrevious} variant="ghost" size="icon">
          <StepBack className="w-6 h-6" />
        </Button>
        <Button onClick={togglePlayPause} size="icon" className="w-16 h-16 rounded-full">
          {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8" />}
        </Button>
        <Button onClick={playNext} variant="ghost" size="icon">
          <StepForward className="w-6 h-6" />
        </Button>
      </div>
    </div>
  )
}

export default MusicTab 