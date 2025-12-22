"use client"

import * as React from "react"

import { cn } from "~/lib/utils"
import { useVideoPlayer } from "~/lib/contexts/video-player-context"
import { VideoControls } from "./video-controls"
import { VideoProgress } from "./video-progress"
import { ChapterMarkers } from "./chapter-markers"
import {
  OverlayContainer,
  CTABubble,
  AudioOverlay,
  ScienceTrigger,
} from "./overlays"

interface VideoPlayerProps {
  className?: string
}

function VideoPlayer({ className }: VideoPlayerProps) {
  const {
    videoUrl,
    phases,
    currentTime,
    duration,
    isPlaying,
    volume,
    isMuted,
    activePhaseId,
    activeOverlay,
    isOverlayAudioPlaying,
    overlayAudioCurrentTime,
    play,
    pause,
    seek,
    setVolume,
    toggleMute,
    registerVideoRef,
    registerOverlayAudioRef,
    dismissOverlay,
    triggerScienceItem,
    playOverlayAudio,
    pauseOverlayAudio,
    seekOverlayAudio,
  } = useVideoPlayer()

  const videoRef = React.useRef<HTMLVideoElement>(null)
  const audioRef = React.useRef<HTMLAudioElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const [buffered, setBuffered] = React.useState(0)
  const [showControls, setShowControls] = React.useState(true)
  const [audioDuration, setAudioDuration] = React.useState(0)
  const [ctaRemainingSeconds, setCtaRemainingSeconds] = React.useState(20)

  const controlsTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debug: Log active overlay
  React.useEffect(() => {
    console.log("VideoPlayer - activeOverlay:", activeOverlay)
  }, [activeOverlay])

  // Register video ref with context
  React.useEffect(() => {
    registerVideoRef(videoRef.current)
    return () => registerVideoRef(null)
  }, [registerVideoRef])

  // Register audio ref with context
  React.useEffect(() => {
    registerOverlayAudioRef(audioRef.current)
    return () => registerOverlayAudioRef(null)
  }, [registerOverlayAudioRef])

  // Video event handlers for buffered
  const handleTimeUpdate = React.useCallback(() => {
    if (videoRef.current) {
      const bufferedRanges = videoRef.current.buffered
      if (bufferedRanges.length > 0) {
        setBuffered(bufferedRanges.end(bufferedRanges.length - 1))
      }
    }
  }, [])

  // Control handlers
  const togglePlayPause = React.useCallback(() => {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }, [isPlaying, play, pause])

  const handleSeek = React.useCallback(
    (time: number) => {
      seek(time)
    },
    [seek]
  )

  const handleVolumeChange = React.useCallback(
    (newVolume: number) => {
      setVolume(newVolume)
    },
    [setVolume]
  )

  const handleFullscreen = React.useCallback(() => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        containerRef.current.requestFullscreen()
      }
    }
  }, [])

  const handleChapterClick = React.useCallback(
    (_phaseId: string, timestamp: number) => {
      handleSeek(timestamp)
    },
    [handleSeek]
  )

  // Show/hide controls on mouse move
  const handleMouseMove = React.useCallback(() => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false)
    }, 3000)
  }, [isPlaying])

  const handleMouseLeave = React.useCallback(() => {
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 1000)
    }
  }, [isPlaying])

  // Keyboard controls
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) return

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault()
          togglePlayPause()
          break
        case "ArrowLeft":
          e.preventDefault()
          handleSeek(Math.max(0, currentTime - 10))
          break
        case "ArrowRight":
          e.preventDefault()
          handleSeek(Math.min(duration, currentTime + 10))
          break
        case "ArrowUp":
          e.preventDefault()
          handleVolumeChange(Math.min(1, volume + 0.1))
          break
        case "ArrowDown":
          e.preventDefault()
          handleVolumeChange(Math.max(0, volume - 0.1))
          break
        case "m":
          e.preventDefault()
          toggleMute()
          break
        case "f":
          e.preventDefault()
          handleFullscreen()
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [
    togglePlayPause,
    handleSeek,
    handleVolumeChange,
    toggleMute,
    handleFullscreen,
    currentTime,
    duration,
    volume,
  ])

  // CTA countdown effect
  React.useEffect(() => {
    if (activeOverlay?.type === "cta") {
      const duration = activeOverlay.durationSec ?? 20
      setCtaRemainingSeconds(duration)

      const interval = setInterval(() => {
        setCtaRemainingSeconds((prev) => {
          if (prev <= 1) {
            dismissOverlay(activeOverlay.id)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [activeOverlay, dismissOverlay])

  // Convert phases to the format expected by VideoProgress
  const progressPhases = React.useMemo(
    () =>
      phases.map((phase) => ({
        id: phase.id,
        title: phase.title,
        startTimeSec: phase.startTimeSec,
        endTimeSec: phase.endTimeSec,
      })),
    [phases]
  )

  // Handle overlay actions
  const handleOverlayDismiss = React.useCallback(() => {
    if (activeOverlay) {
      dismissOverlay(activeOverlay.id)
    }
  }, [activeOverlay, dismissOverlay])

  const handleScienceOpen = React.useCallback(() => {
    if (activeOverlay?.scienceItemId) {
      triggerScienceItem(activeOverlay.scienceItemId)
      dismissOverlay(activeOverlay.id)
    }
  }, [activeOverlay, triggerScienceItem, dismissOverlay])

  const handleCtaAction = React.useCallback(() => {
    // CTA action - could trigger science item or external link
    if (activeOverlay?.scienceItemId) {
      triggerScienceItem(activeOverlay.scienceItemId)
    }
    if (activeOverlay) {
      dismissOverlay(activeOverlay.id)
    }
  }, [activeOverlay, triggerScienceItem, dismissOverlay])

  // Audio overlay handlers
  const handleAudioRestart = React.useCallback(() => {
    seekOverlayAudio(0)
    playOverlayAudio()
  }, [seekOverlayAudio, playOverlayAudio])

  const handleAudioSkipBack = React.useCallback(() => {
    seekOverlayAudio(Math.max(0, overlayAudioCurrentTime - 10))
  }, [seekOverlayAudio, overlayAudioCurrentTime])

  const handleAudioSkipForward = React.useCallback(() => {
    seekOverlayAudio(Math.min(audioDuration, overlayAudioCurrentTime + 10))
  }, [seekOverlayAudio, overlayAudioCurrentTime, audioDuration])

  return (
    <div
      ref={containerRef}
      data-slot="video-player"
      className={cn(
        "group/player relative aspect-video overflow-hidden rounded-xl bg-black",
        className
      )}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      tabIndex={0}
    >
      {/* Video Element */}
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          className="h-full w-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onClick={togglePlayPause}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center bg-muted/20"
          onClick={togglePlayPause}
        >
          <div className="text-center text-white/60">
            <p className="text-lg font-medium">Video Player</p>
            <p className="text-sm">No video source provided</p>
          </div>
        </div>
      )}

      {/* Hidden audio element for overlay audio */}
      {activeOverlay?.type === "audio" && activeOverlay.audioUrl && (
        <audio
          ref={audioRef}
          src={activeOverlay.audioUrl}
          onLoadedMetadata={(e) =>
            setAudioDuration((e.target as HTMLAudioElement).duration)
          }
        />
      )}

      {/* Overlay Container */}
      <div className="pointer-events-none absolute inset-0">
        {/* CTA Bubble - top right */}
        {activeOverlay?.type === "cta" && (
          <OverlayContainer position="top-right">
            <CTABubble
              title={activeOverlay.title ?? "Learn More"}
              remainingSeconds={ctaRemainingSeconds}
              onAction={handleCtaAction}
              onDismiss={handleOverlayDismiss}
            />
          </OverlayContainer>
        )}

        {/* Audio Overlay - bottom */}
        {activeOverlay?.type === "audio" && (
          <OverlayContainer position="bottom">
            <AudioOverlay
              title={activeOverlay.title ?? "Audio Commentary"}
              audioUrl={activeOverlay.audioUrl}
              isPlaying={isOverlayAudioPlaying}
              currentTime={overlayAudioCurrentTime}
              duration={audioDuration}
              onPlayPause={() =>
                isOverlayAudioPlaying ? pauseOverlayAudio() : playOverlayAudio()
              }
              onRestart={handleAudioRestart}
              onRewind={handleAudioSkipBack}
              onForward={handleAudioSkipForward}
              onDismiss={handleOverlayDismiss}
              autoPlay={activeOverlay.id !== "audio-intro"}
            />
          </OverlayContainer>
        )}

        {/* Science Trigger - center */}
        {activeOverlay?.type === "science" && (
          <OverlayContainer position="center">
            <ScienceTrigger
              title={activeOverlay.title ?? "Science Corner"}
              onOpen={handleScienceOpen}
              onDismiss={handleOverlayDismiss}
            />
          </OverlayContainer>
        )}
      </div>

      {/* Controls Overlay */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-16 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Chapter Markers (above progress) */}
        <div className="relative mb-1">
          <ChapterMarkers
            phases={progressPhases}
            duration={duration}
            activePhaseId={activePhaseId}
            onChapterClick={handleChapterClick}
          />
        </div>

        {/* Progress Bar */}
        <VideoProgress
          currentTime={currentTime}
          duration={duration}
          buffered={buffered}
          phases={progressPhases}
          onSeek={handleSeek}
          className="mb-2"
        />

        {/* Controls */}
        <VideoControls
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          isMuted={isMuted}
          onPlayPause={togglePlayPause}
          onVolumeChange={handleVolumeChange}
          onMuteToggle={toggleMute}
          onFullscreen={handleFullscreen}
        />
      </div>
    </div>
  )
}

export { VideoPlayer }
export type { VideoPlayerProps }
