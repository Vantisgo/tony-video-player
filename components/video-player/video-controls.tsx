"use client"

import * as React from "react"
import {
  Play,
  Pause,
  SpeakerHigh,
  SpeakerX,
  CornersOut,
} from "@phosphor-icons/react"

import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import { Slider } from "~/components/ui/slider"
import { formatTime } from "./utils"

interface VideoControlsProps {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  onPlayPause: () => void
  onVolumeChange: (volume: number) => void
  onMuteToggle: () => void
  onFullscreen: () => void
  className?: string
}

function VideoControls({
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  onPlayPause,
  onVolumeChange,
  onMuteToggle,
  onFullscreen,
  className,
}: VideoControlsProps) {
  return (
    <div
      data-slot="video-controls"
      className={cn("flex items-center gap-2", className)}
    >
      {/* Play/Pause Button */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onPlayPause}
        className="text-white hover:bg-white/20"
      >
        {isPlaying ? (
          <Pause weight="fill" className="size-5" />
        ) : (
          <Play weight="fill" className="size-5" />
        )}
      </Button>

      {/* Time Display */}
      <div className="flex items-center gap-1 text-sm font-medium text-white">
        <span>{formatTime(currentTime)}</span>
        <span className="text-white/60">/</span>
        <span className="text-white/60">{formatTime(duration)}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Volume Controls */}
      <div className="group/volume flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onMuteToggle}
          className="text-white hover:bg-white/20"
        >
          {isMuted || volume === 0 ? (
            <SpeakerX weight="fill" className="size-5" />
          ) : (
            <SpeakerHigh weight="fill" className="size-5" />
          )}
        </Button>
        <div className="w-0 overflow-hidden transition-all group-hover/volume:w-20">
          <Slider
            value={[isMuted ? 0 : volume * 100]}
            min={0}
            max={100}
            step={1}
            onValueChange={([value]) => onVolumeChange((value ?? 0) / 100)}
            className="w-20"
          />
        </div>
      </div>

      {/* Fullscreen Button */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onFullscreen}
        className="text-white hover:bg-white/20"
      >
        <CornersOut weight="bold" className="size-5" />
      </Button>
    </div>
  )
}

export { VideoControls }
export type { VideoControlsProps }
