"use client"

import * as React from "react"

// Types for lesson content
interface Intervention {
  id: string
  title: string
  timestampSec: number
  prompt: string
  description: string
  methodModelFramework: string
  function: string
  scientificReferenceFields: string[]
}

interface Phase {
  id: string
  title: string
  description: string
  startTimeSec: number
  endTimeSec?: number
  audioAssetUrl?: string | null
  audioTriggerTime?: number | null
  interventions: Intervention[]
}

interface ScienceItem {
  id: string
  name: string
  description: string
  timestampsSec: number[]
  content?: {
    title?: string
    subtitle?: string
    sections?: Array<{
      heading: string
      content?: string
      items?: Array<{
        text: string
        subItems?: string[]
      }>
    }>
    references?: Array<{
      text: string
      url?: string
    }>
  }
}

interface Comment {
  id: string
  content: string
  timestamp: number
  authorName: string
  createdAt: string
}

interface OverlayEvent {
  id: string
  type: "cta" | "audio" | "science"
  triggerTimeSec: number
  durationSec?: number
  title?: string
  audioUrl?: string
  scienceItemId?: string
  phaseId?: string
}

interface LessonData {
  id: string
  title: string
  description: string
  videoUrl: string
  duration: number
  introAudioUrl?: string | null
  phases: Phase[]
  scienceItems: ScienceItem[]
  comments: Comment[]
}

// Video player state
interface VideoPlayerState {
  // Lesson data
  lessonId: string
  title: string
  videoUrl: string

  // Playback
  currentTime: number
  duration: number
  isPlaying: boolean
  volume: number
  isMuted: boolean

  // Content data
  phases: Phase[]
  scienceItems: ScienceItem[]
  comments: Comment[]
  overlayEvents: OverlayEvent[]

  // Active content (computed from currentTime)
  activePhaseId: string | null
  activeInterventionId: string | null

  // Overlay state
  activeOverlay: OverlayEvent | null
  dismissedOverlayIds: Set<string>
  isOverlayAudioPlaying: boolean
  overlayAudioCurrentTime: number

  // UI state
  rightPanelTab: "coaching" | "science"
  highlightedScienceItemId: string | null
}

// Actions
interface VideoPlayerActions {
  // Playback controls
  play: () => void
  pause: () => void
  seek: (time: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void

  // Video ref management
  registerVideoRef: (ref: HTMLVideoElement | null) => void
  registerOverlayAudioRef: (ref: HTMLAudioElement | null) => void

  // Time update (called by video element)
  updateTime: (time: number) => void
  setDuration: (duration: number) => void

  // Overlay controls
  dismissOverlay: (overlayId: string) => void
  triggerScienceItem: (itemId: string) => void
  playOverlayAudio: () => void
  pauseOverlayAudio: () => void
  seekOverlayAudio: (time: number) => void

  // Comments
  addComment: (comment: Comment) => void

  // UI controls
  setRightPanelTab: (tab: "coaching" | "science") => void
  clearHighlight: () => void
}

type VideoPlayerContextValue = VideoPlayerState & VideoPlayerActions

const VideoPlayerContext = React.createContext<VideoPlayerContextValue | null>(
  null
)

// Initial state factory
function createInitialState(lesson?: LessonData): VideoPlayerState {
  // Generate overlay events from lesson data
  const overlayEvents: OverlayEvent[] = []

  if (lesson) {
    // Add intro audio overlay at the beginning
    if (lesson.introAudioUrl) {
      overlayEvents.push({
        id: "audio-intro",
        type: "audio",
        triggerTimeSec: 0,
        title: "Introduction",
        audioUrl: lesson.introAudioUrl,
      })
    }

    // Add audio overlays for each phase
    lesson.phases.forEach((phase) => {
      if (phase.audioAssetUrl && phase.audioTriggerTime != null) {
        overlayEvents.push({
          id: `audio-${phase.id}`,
          type: "audio",
          triggerTimeSec: phase.audioTriggerTime,
          title: phase.title,
          audioUrl: phase.audioAssetUrl,
          phaseId: phase.id,
        })
      }
    })

    // Add science overlays
    lesson.scienceItems.forEach((item) => {
      item.timestampsSec.forEach((timestamp, index) => {
        overlayEvents.push({
          id: `science-${item.id}-${index}`,
          type: "science",
          triggerTimeSec: timestamp,
          title: item.name,
          scienceItemId: item.id,
        })
      })
    })

    // Sort by trigger time
    overlayEvents.sort((a, b) => a.triggerTimeSec - b.triggerTimeSec)
  }

  // Set intro overlay as active on load if it exists
  const introOverlay = overlayEvents.find((e) => e.id === "audio-intro") ?? null

  // Debug logging
  if (lesson?.introAudioUrl) {
    console.log("Intro audio URL:", lesson.introAudioUrl)
    console.log("Intro overlay:", introOverlay)
    console.log("All overlay events:", overlayEvents)
  }

  return {
    lessonId: lesson?.id ?? "",
    title: lesson?.title ?? "",
    videoUrl: lesson?.videoUrl ?? "",
    currentTime: 0,
    duration: lesson?.duration ?? 0,
    isPlaying: false,
    volume: 1,
    isMuted: false,
    phases: lesson?.phases ?? [],
    scienceItems: lesson?.scienceItems ?? [],
    comments: lesson?.comments ?? [],
    overlayEvents,
    activePhaseId: null,
    activeInterventionId: null,
    activeOverlay: introOverlay,
    dismissedOverlayIds: new Set(),
    isOverlayAudioPlaying: false,
    overlayAudioCurrentTime: 0,
    rightPanelTab: "coaching",
    highlightedScienceItemId: null,
  }
}

// Reducer
type Action =
  | { type: "SET_TIME"; payload: number }
  | { type: "SET_DURATION"; payload: number }
  | { type: "SET_PLAYING"; payload: boolean }
  | { type: "SET_VOLUME"; payload: number }
  | { type: "SET_MUTED"; payload: boolean }
  | { type: "SET_ACTIVE_PHASE"; payload: string | null }
  | { type: "SET_ACTIVE_INTERVENTION"; payload: string | null }
  | { type: "SET_ACTIVE_OVERLAY"; payload: OverlayEvent | null }
  | { type: "DISMISS_OVERLAY"; payload: string }
  | { type: "CLEAR_DISMISSED_OVERLAYS"; payload: Set<string> }
  | { type: "SET_TAB"; payload: "coaching" | "science" }
  | { type: "HIGHLIGHT_SCIENCE"; payload: string | null }
  | { type: "SET_OVERLAY_AUDIO_PLAYING"; payload: boolean }
  | { type: "SET_OVERLAY_AUDIO_TIME"; payload: number }
  | { type: "ADD_COMMENT"; payload: Comment }

function reducer(state: VideoPlayerState, action: Action): VideoPlayerState {
  switch (action.type) {
    case "SET_TIME":
      return { ...state, currentTime: action.payload }
    case "SET_DURATION":
      return { ...state, duration: action.payload }
    case "SET_PLAYING":
      return { ...state, isPlaying: action.payload }
    case "SET_VOLUME":
      return { ...state, volume: action.payload }
    case "SET_MUTED":
      return { ...state, isMuted: action.payload }
    case "SET_ACTIVE_PHASE":
      return { ...state, activePhaseId: action.payload }
    case "SET_ACTIVE_INTERVENTION":
      return { ...state, activeInterventionId: action.payload }
    case "SET_ACTIVE_OVERLAY":
      return { ...state, activeOverlay: action.payload }
    case "DISMISS_OVERLAY":
      return {
        ...state,
        dismissedOverlayIds: new Set([...state.dismissedOverlayIds, action.payload]),
        activeOverlay:
          state.activeOverlay?.id === action.payload ? null : state.activeOverlay,
        isOverlayAudioPlaying: false,
        overlayAudioCurrentTime: 0,
      }
    case "CLEAR_DISMISSED_OVERLAYS":
      return {
        ...state,
        dismissedOverlayIds: action.payload,
      }
    case "SET_TAB":
      return { ...state, rightPanelTab: action.payload }
    case "HIGHLIGHT_SCIENCE":
      return { ...state, highlightedScienceItemId: action.payload }
    case "SET_OVERLAY_AUDIO_PLAYING":
      return { ...state, isOverlayAudioPlaying: action.payload }
    case "SET_OVERLAY_AUDIO_TIME":
      return { ...state, overlayAudioCurrentTime: action.payload }
    case "ADD_COMMENT":
      return {
        ...state,
        comments: [...state.comments, action.payload].sort(
          (a, b) => a.timestamp - b.timestamp
        ),
      }
    default:
      return state
  }
}

// Provider component
interface VideoPlayerProviderProps {
  children: React.ReactNode
  lesson?: LessonData
}

function VideoPlayerProvider({
  children,
  lesson,
}: VideoPlayerProviderProps) {
  const [state, dispatch] = React.useReducer(
    reducer,
    lesson,
    createInitialState
  )

  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const overlayAudioRef = React.useRef<HTMLAudioElement | null>(null)

  // Compute active phase and intervention based on current time
  React.useEffect(() => {
    const currentPhase = state.phases.find((phase, index) => {
      const nextPhase = state.phases[index + 1]
      const endTime = phase.endTimeSec ?? nextPhase?.startTimeSec ?? state.duration
      return state.currentTime >= phase.startTimeSec && state.currentTime < endTime
    })
    dispatch({ type: "SET_ACTIVE_PHASE", payload: currentPhase?.id ?? null })

    // Find active intervention within the current phase
    if (currentPhase) {
      const sortedInterventions = [...currentPhase.interventions].sort(
        (a, b) => a.timestampSec - b.timestampSec
      )
      // Find the last intervention that has been passed
      const activeIntervention = sortedInterventions
        .filter((int) => state.currentTime >= int.timestampSec)
        .pop()
      dispatch({
        type: "SET_ACTIVE_INTERVENTION",
        payload: activeIntervention?.id ?? null,
      })
    } else {
      dispatch({ type: "SET_ACTIVE_INTERVENTION", payload: null })
    }
  }, [state.currentTime, state.phases, state.duration])

  // Check for overlay triggers (excluding intro which is shown on load)
  React.useEffect(() => {
    if (!state.isPlaying) return

    const pendingOverlay = state.overlayEvents.find((event) => {
      // Skip intro overlay - it's handled separately on page load
      if (event.id === "audio-intro") return false

      // For dismissed overlays, skip them
      if (state.dismissedOverlayIds.has(event.id)) return false
      // If this overlay is already active, don't re-trigger it
      if (state.activeOverlay?.id === event.id) return false

      const triggerWindow = 1.0 // 1 second window for trigger
      return (
        state.currentTime >= event.triggerTimeSec &&
        state.currentTime < event.triggerTimeSec + triggerWindow
      )
    })

    if (pendingOverlay) {
      dispatch({ type: "SET_ACTIVE_OVERLAY", payload: pendingOverlay })

      // Pause video for audio and science overlays
      if (pendingOverlay.type === "audio" || pendingOverlay.type === "science") {
        videoRef.current?.pause()
      }
    }
  }, [state.currentTime, state.overlayEvents, state.dismissedOverlayIds, state.activeOverlay, state.isPlaying])

  // Clear dismissed overlays when seeking backwards past their trigger points
  React.useEffect(() => {
    const overlaysToClear = Array.from(state.dismissedOverlayIds).filter((overlayId) => {
      const overlay = state.overlayEvents.find((e) => e.id === overlayId)
      if (!overlay) return false
      // Clear dismissal if we've seeked to before the trigger point
      return state.currentTime < overlay.triggerTimeSec
    })

    if (overlaysToClear.length > 0) {
      const newDismissedIds = new Set(state.dismissedOverlayIds)
      overlaysToClear.forEach((id) => newDismissedIds.delete(id))
      dispatch({
        type: "CLEAR_DISMISSED_OVERLAYS",
        payload: newDismissedIds,
      })
    }
  }, [state.currentTime, state.dismissedOverlayIds, state.overlayEvents])

  // Actions
  const actions: VideoPlayerActions = React.useMemo(
    () => ({
      play: () => {
        // Don't play video if intro overlay is active
        if (state.activeOverlay?.id === "audio-intro") return
        videoRef.current?.play()
      },
      pause: () => {
        videoRef.current?.pause()
      },
      seek: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time
          dispatch({ type: "SET_TIME", payload: time })
        }
      },
      setVolume: (volume: number) => {
        if (videoRef.current) {
          videoRef.current.volume = volume
          dispatch({ type: "SET_VOLUME", payload: volume })
          if (volume > 0) dispatch({ type: "SET_MUTED", payload: false })
        }
      },
      toggleMute: () => {
        if (videoRef.current) {
          const newMuted = !state.isMuted
          videoRef.current.muted = newMuted
          dispatch({ type: "SET_MUTED", payload: newMuted })
        }
      },
      registerVideoRef: (ref: HTMLVideoElement | null) => {
        videoRef.current = ref
      },
      registerOverlayAudioRef: (ref: HTMLAudioElement | null) => {
        overlayAudioRef.current = ref
      },
      updateTime: (time: number) => {
        dispatch({ type: "SET_TIME", payload: time })
      },
      setDuration: (duration: number) => {
        dispatch({ type: "SET_DURATION", payload: duration })
      },
      dismissOverlay: (overlayId: string) => {
        dispatch({ type: "DISMISS_OVERLAY", payload: overlayId })
        overlayAudioRef.current?.pause()
        // Resume video if it was paused
        videoRef.current?.play()
      },
      triggerScienceItem: (itemId: string) => {
        dispatch({ type: "SET_TAB", payload: "science" })
        dispatch({ type: "HIGHLIGHT_SCIENCE", payload: itemId })
        // Clear highlight after animation
        setTimeout(() => {
          dispatch({ type: "HIGHLIGHT_SCIENCE", payload: null })
        }, 3000)
      },
      playOverlayAudio: () => {
        overlayAudioRef.current?.play()
        dispatch({ type: "SET_OVERLAY_AUDIO_PLAYING", payload: true })
      },
      pauseOverlayAudio: () => {
        overlayAudioRef.current?.pause()
        dispatch({ type: "SET_OVERLAY_AUDIO_PLAYING", payload: false })
      },
      seekOverlayAudio: (time: number) => {
        if (overlayAudioRef.current) {
          overlayAudioRef.current.currentTime = time
          dispatch({ type: "SET_OVERLAY_AUDIO_TIME", payload: time })
        }
      },
      addComment: (comment: Comment) => {
        dispatch({ type: "ADD_COMMENT", payload: comment })
      },
      setRightPanelTab: (tab: "coaching" | "science") => {
        dispatch({ type: "SET_TAB", payload: tab })
      },
      clearHighlight: () => {
        dispatch({ type: "HIGHLIGHT_SCIENCE", payload: null })
      },
    }),
    [state.isMuted, state.activeOverlay]
  )

  // Video event handlers to sync state
  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handlePlay = () => dispatch({ type: "SET_PLAYING", payload: true })
    const handlePause = () => dispatch({ type: "SET_PLAYING", payload: false })
    const handleTimeUpdate = () =>
      dispatch({ type: "SET_TIME", payload: video.currentTime })
    const handleLoadedMetadata = () =>
      dispatch({ type: "SET_DURATION", payload: video.duration })

    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("loadedmetadata", handleLoadedMetadata)

    return () => {
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("loadedmetadata", handleLoadedMetadata)
    }
  }, [])

  const value = React.useMemo(
    () => ({ ...state, ...actions }),
    [state, actions]
  )

  return (
    <VideoPlayerContext.Provider value={value}>
      {children}
    </VideoPlayerContext.Provider>
  )
}

// Hook to use the context
function useVideoPlayer() {
  const context = React.useContext(VideoPlayerContext)
  if (!context) {
    throw new Error("useVideoPlayer must be used within a VideoPlayerProvider")
  }
  return context
}

export { VideoPlayerProvider, useVideoPlayer }
export type {
  VideoPlayerState,
  VideoPlayerActions,
  VideoPlayerContextValue,
  LessonData,
  Phase,
  Intervention,
  ScienceItem,
  Comment,
  OverlayEvent,
}
