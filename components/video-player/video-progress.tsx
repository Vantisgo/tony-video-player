"use client"

import * as React from "react"

import { cn } from "~/lib/utils"
import { getPercentage } from "./utils"

interface Phase {
  id: string
  title: string
  startTimeSec: number
  endTimeSec?: number
}

interface VideoProgressProps {
  currentTime: number
  duration: number
  buffered?: number
  phases?: Phase[]
  onSeek: (time: number) => void
  className?: string
}

function VideoProgress({
  currentTime,
  duration,
  buffered = 0,
  phases = [],
  onSeek,
  className,
}: VideoProgressProps) {
  const progressRef = React.useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [hoverTime, setHoverTime] = React.useState<number | null>(null)

  const progress = getPercentage(currentTime, duration)
  const bufferedProgress = getPercentage(buffered, duration)

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || !duration) return

      const rect = progressRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const percentage = Math.max(0, Math.min(1, x / rect.width))
      const time = percentage * duration

      setHoverTime(time)

      if (isDragging) {
        onSeek(time)
      }
    },
    [duration, isDragging, onSeek]
  )

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || !duration) return

      const rect = progressRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const percentage = Math.max(0, Math.min(1, x / rect.width))
      const time = percentage * duration

      setIsDragging(true)
      onSeek(time)
    },
    [duration, onSeek]
  )

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleMouseLeave = React.useCallback(() => {
    setHoverTime(null)
    setIsDragging(false)
  }, [])

  // Global mouse up handler for drag release
  React.useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false)
      window.addEventListener("mouseup", handleGlobalMouseUp)
      return () => window.removeEventListener("mouseup", handleGlobalMouseUp)
    }
  }, [isDragging])

  return (
    <div
      ref={progressRef}
      data-slot="video-progress"
      className={cn(
        "group/progress relative h-1 w-full cursor-pointer rounded-full bg-white/30 transition-all hover:h-1.5",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Buffered Progress */}
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-white/40"
        style={{ width: `${bufferedProgress}%` }}
      />

      {/* Chapter Markers */}
      {phases.map((phase) => {
        const position = getPercentage(phase.startTimeSec, duration)
        return (
          <div
            key={phase.id}
            className="absolute top-0 h-full w-0.5 bg-white/60"
            style={{ left: `${position}%` }}
            title={phase.title}
          />
        )
      })}

      {/* Current Progress */}
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-primary"
        style={{ width: `${progress}%` }}
      />

      {/* Scrubber Handle */}
      <div
        className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-0 shadow-md transition-opacity group-hover/progress:opacity-100"
        style={{ left: `${progress}%` }}
      />

      {/* Hover Preview */}
      {hoverTime !== null && (
        <div
          className="absolute -top-8 -translate-x-1/2 rounded bg-black/80 px-2 py-1 text-xs text-white"
          style={{ left: `${getPercentage(hoverTime, duration)}%` }}
        >
          {formatTimeSimple(hoverTime)}
        </div>
      )}
    </div>
  )
}

function formatTimeSimple(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export { VideoProgress }
export type { VideoProgressProps, Phase }
