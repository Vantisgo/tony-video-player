"use client"

import * as React from "react"
import { Play, Pause, SkipForward, Mic2 } from "lucide-react"

import { cn } from "~/lib/utils"
import { formatTime } from "../utils"

interface AudioOverlayProps {
  title: string
  audioUrl?: string
  isPlaying?: boolean
  currentTime?: number
  duration?: number
  onPlayPause?: () => void
  onRewind?: () => void
  onForward?: () => void
  onRestart?: () => void
  onDismiss?: () => void
  className?: string
  autoPlay?: boolean
}

function AudioOverlay({
  title,
  audioUrl,
  isPlaying = false,
  currentTime = 0,
  duration = 0,
  onPlayPause,
  onRewind,
  onForward,
  onRestart,
  onDismiss,
  className,
  autoPlay = true,
}: AudioOverlayProps) {
  const audioRef = React.useRef<HTMLAudioElement>(null)

  // Detect if component is externally controlled
  const isControlled = !!onPlayPause

  // Local state for uncontrolled mode only
  const [localIsPlaying, setLocalIsPlaying] = React.useState(false)
  const [localCurrentTime, setLocalCurrentTime] = React.useState(0)
  const [localDuration, setLocalDuration] = React.useState(0)

  // Use props in controlled mode, local state in uncontrolled mode
  const displayIsPlaying = isControlled ? isPlaying : localIsPlaying
  const displayCurrentTime = isControlled ? currentTime : localCurrentTime
  const displayDuration = isControlled ? duration : localDuration

  const progress = displayDuration > 0 ? (displayCurrentTime / displayDuration) * 100 : 0

  // Use local state if no external control provided
  const handlePlayPause = React.useCallback(() => {
    if (onPlayPause) {
      onPlayPause()
    } else if (audioRef.current) {
      if (localIsPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
    }
  }, [onPlayPause, localIsPlaying])

  const handleRewind = React.useCallback(() => {
    if (onRewind) {
      onRewind()
    } else if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10)
    }
  }, [onRewind])

  const handleForward = React.useCallback(() => {
    if (onForward) {
      onForward()
    } else if (audioRef.current) {
      audioRef.current.currentTime = Math.min(
        localDuration,
        audioRef.current.currentTime + 10
      )
    }
  }, [onForward, localDuration])

  const handleRestart = React.useCallback(() => {
    if (onRestart) {
      onRestart()
    } else if (audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play()
    }
  }, [onRestart])

  // Audio element event handlers
  const handleTimeUpdate = React.useCallback(() => {
    if (audioRef.current) {
      setLocalCurrentTime(audioRef.current.currentTime)
    }
  }, [])

  const handleLoadedMetadata = React.useCallback(() => {
    if (audioRef.current) {
      setLocalDuration(audioRef.current.duration)
    }
  }, [])

  const handlePlay = React.useCallback(() => setLocalIsPlaying(true), [])
  const handlePauseEvent = React.useCallback(() => setLocalIsPlaying(false), [])
  const handleEnded = React.useCallback(() => {
    setLocalIsPlaying(false)
    // Auto-dismiss overlay when audio finishes
    if (onDismiss) {
      onDismiss()
    }
  }, [onDismiss])

  // Auto-play when overlay appears (only in uncontrolled mode and if autoPlay is true)
  React.useEffect(() => {
    if (!isControlled && audioRef.current && audioUrl && autoPlay) {
      // Small delay to ensure component is mounted
      const timer = setTimeout(() => {
        audioRef.current?.play().catch(() => {
          // Ignore autoplay errors (browser may block autoplay)
          console.warn("Autoplay blocked - user interaction required")
        })
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isControlled, audioUrl, autoPlay])

  return (
    <div
      data-slot="audio-overlay"
      className={cn(
        "pointer-events-auto w-80 animate-in fade-in slide-in-from-bottom-4",
        className
      )}
    >
      {/* Hidden audio element for self-contained playback (uncontrolled mode only) */}
      {!isControlled && audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlay}
          onPause={handlePauseEvent}
          onEnded={handleEnded}
        />
      )}

      <div className="space-y-4 rounded-2xl border border-orange-300/25 bg-gradient-to-br from-orange-500/20 via-amber-500/20 to-yellow-500/20 p-5 shadow-2xl backdrop-blur-md">
        {/* Header with Avatar and Name */}
        <div className="flex items-start gap-3">
          <div className="relative">
            <img
              src="/frederik.webp"
              alt="Voice-Over"
              className="h-13 w-13 rounded-full border-3 border-orange-400 shadow-lg"
            />
            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-orange-500 to-amber-500">
              <Mic2 className="h-3 w-3 text-white" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-white">{title}</h3>
            <p className="text-xs text-orange-100/70">Voice-Over</p>
            <div className="mt-1 flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
              <span className="text-xs text-orange-100/50">
                {displayIsPlaying ? "Playing" : "Paused"}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Section */}
        <div className="space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 shadow-lg transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs font-medium text-orange-100/60">
            <span>{formatTime(displayCurrentTime)}</span>
            <span>{formatTime(displayDuration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2.5">
          {/* Rewind 10s */}
          <button
            onClick={handleRewind}
            className="rounded-xl bg-white/15 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/25"
          >
            -10s
          </button>

          {/* Play/Pause */}
          <button
            onClick={handlePlayPause}
            className="rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 p-3 shadow-lg transition-colors hover:from-orange-700 hover:to-amber-700"
          >
            {displayIsPlaying ? (
              <Pause className="h-5 w-5 text-white" />
            ) : (
              <Play className="h-5 w-5 text-white" />
            )}
          </button>

          {/* Forward 10s */}
          <button
            onClick={handleForward}
            className="rounded-xl bg-white/15 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/25"
          >
            +10s
          </button>

          {/* Skip/Dismiss */}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white/15 py-3 text-sm font-medium text-white transition-colors hover:bg-white/25"
            >
              <SkipForward className="h-4 w-4" />
              <span>Skip</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export { AudioOverlay }
export type { AudioOverlayProps }
