"use client"

import * as React from "react"
import Link from "next/link"
import { PencilSimple, ArrowLeft } from "@phosphor-icons/react"

import { cn } from "~/lib/utils"
import { VideoPlayer } from "~/components/video-player"
import { RightPanel } from "~/components/layout/right-panel"
import { CommentsSection } from "~/components/comments"
import { Button } from "~/components/ui/button"
import { useVideoPlayer } from "~/lib/contexts/video-player-context"

interface LessonLayoutProps {
  className?: string
}

const STORAGE_KEY = "lesson-layout-ratio"
const DEFAULT_RATIO = 0.65 // 65% video, 35% sidebar
const MIN_RATIO = 0.3
const MAX_RATIO = 0.85

function LessonLayout({ className }: LessonLayoutProps) {
  const { lessonId, title } = useVideoPlayer()
  const [ratio, setRatio] = React.useState(DEFAULT_RATIO)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isClient, setIsClient] = React.useState(false)
  const [isLargeScreen, setIsLargeScreen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Initialize client-side state
  React.useEffect(() => {
    setIsClient(true)
    setIsLargeScreen(window.innerWidth >= 1024)

    const handleResize = () => {
      setIsLargeScreen(window.innerWidth >= 1024)
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Load ratio from localStorage on mount
  React.useEffect(() => {
    if (!isClient) return
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsedRatio = parseFloat(stored)
      if (!isNaN(parsedRatio)) {
        setRatio(Math.max(MIN_RATIO, Math.min(MAX_RATIO, parsedRatio)))
      }
    }
  }, [isClient])

  // Save ratio to localStorage when it changes
  React.useEffect(() => {
    if (!isClient) return
    localStorage.setItem(STORAGE_KEY, ratio.toString())
  }, [ratio, isClient])

  // Handle mouse move during drag
  React.useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const newRatio = x / rect.width

      setRatio(Math.max(MIN_RATIO, Math.min(MAX_RATIO, newRatio)))
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging])

  return (
    <div
      data-slot="lesson-layout"
      className={cn("min-h-screen bg-background", className)}
    >
      <div className="container mx-auto px-4 py-6">
        {/* Header with title and edit button */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button size="icon-sm" variant="ghost" asChild>
              <Link href="/">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">{title}</h1>
          </div>
          {lessonId && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/admin/lessons/${lessonId}/edit`}>
                <PencilSimple className="mr-2 size-4" />
                Edit Lesson
              </Link>
            </Button>
          )}
        </div>

        <div
          ref={containerRef}
          className={cn(
            "relative gap-6",
            isLargeScreen ? "flex" : "grid grid-cols-1"
          )}
        >
          {/* Left Column: Video + Comments */}
          <div
            className="flex flex-col gap-6"
            style={
              isClient && isLargeScreen
                ? { width: `calc(${ratio * 100}% - 12px)` }
                : undefined
            }
          >
            <VideoPlayer />
            <CommentsSection />
          </div>

          {/* Resize Handle */}
          {isClient && isLargeScreen && (
            <div
              className={cn(
                "group absolute top-0 z-10 h-full w-3 -translate-x-1/2 cursor-col-resize",
                isDragging && "bg-primary/20"
              )}
              style={{ left: `${ratio * 100}%` }}
              onMouseDown={() => setIsDragging(true)}
            >
              <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-primary" />
            </div>
          )}

          {/* Right Column: Tabs Panel */}
          <div
            className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]"
            style={
              isClient && isLargeScreen
                ? { width: `calc(${(1 - ratio) * 100}% - 12px)` }
                : undefined
            }
          >
            <RightPanel />
          </div>
        </div>
      </div>
    </div>
  )
}

export { LessonLayout }
export type { LessonLayoutProps }
