"use client"

import * as React from "react"
import {
  Play,
  Pause,
  Rewind,
  FastForward,
  ArrowCounterClockwise,
  X,
} from "@phosphor-icons/react"

import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Progress } from "~/components/ui/progress"
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
    <Card
      data-slot="audio-overlay"
      className={cn(
        "pointer-events-auto animate-in fade-in slide-in-from-bottom-4 bg-card/95 backdrop-blur-sm shadow-lg",
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

      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          {/* Restart */}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleRestart}
            title="Restart"
          >
            <ArrowCounterClockwise className="size-4" />
          </Button>

          {/* Rewind */}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleRewind}
            title="Rewind 10s"
          >
            <Rewind className="size-4" />
          </Button>

          {/* Play/Pause */}
          <Button
            variant="default"
            size="icon-sm"
            onClick={handlePlayPause}
          >
            {displayIsPlaying ? (
              <Pause weight="fill" className="size-4" />
            ) : (
              <Play weight="fill" className="size-4" />
            )}
          </Button>

          {/* Forward */}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleForward}
            title="Forward 10s"
          >
            <FastForward className="size-4" />
          </Button>

          {/* Title & Progress */}
          <div className="flex flex-1 flex-col gap-1 px-2">
            <span className="truncate text-sm font-medium">{title}</span>
            <div className="flex items-center gap-2">
              <Progress value={progress} className="h-1 flex-1" />
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatTime(displayCurrentTime)} / {formatTime(displayDuration)}
              </span>
            </div>
          </div>

          {/* Dismiss */}
          {onDismiss && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onDismiss}
              title="Skip"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export { AudioOverlay }
export type { AudioOverlayProps }
