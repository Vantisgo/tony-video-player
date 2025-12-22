"use client"

import * as React from "react"

import { cn } from "~/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { useVideoPlayer } from "~/lib/contexts/video-player-context"
import { CommentCard } from "./comment-card"
import { CommentForm } from "./comment-form"

interface CommentsSectionProps {
  className?: string
}

function CommentsSection({ className }: CommentsSectionProps) {
  const { lessonId, comments, currentTime, seek, addComment } = useVideoPlayer()

  const containerRef = React.useRef<HTMLDivElement>(null)
  const commentRefs = React.useRef<Map<string, HTMLDivElement>>(new Map())

  // Sort comments by timestamp
  const sortedComments = React.useMemo(
    () => [...comments].sort((a, b) => a.timestamp - b.timestamp),
    [comments]
  )

  // Find active comment based on current time
  const activeCommentId = React.useMemo(() => {
    // Find comments within 5 seconds of current time
    const nearby = sortedComments.filter(
      (c) => Math.abs(c.timestamp - currentTime) <= 5
    )
    if (nearby.length === 0) return null

    // Return the most recent one that has passed
    const passed = nearby.filter((c) => c.timestamp <= currentTime)
    return passed[passed.length - 1]?.id ?? null
  }, [sortedComments, currentTime])

  // Auto-scroll to active comment
  React.useEffect(() => {
    if (activeCommentId) {
      const element = commentRefs.current.get(activeCommentId)
      if (element && containerRef.current) {
        element.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }
  }, [activeCommentId])

  // Handle timestamp click - seek video
  const handleTimestampClick = React.useCallback(
    (timestamp: number) => {
      seek(timestamp)
    },
    [seek]
  )

  // Handle comment submission
  const handleAddComment = React.useCallback(
    async (content: string, timestamp: number) => {
      // Create optimistic comment
      const optimisticComment = {
        id: `temp-${Date.now()}`,
        content,
        timestamp,
        authorName: "You",
        createdAt: new Date().toISOString(),
      }

      // Add to local state optimistically
      addComment(optimisticComment)

      // Send to API
      try {
        const response = await fetch(`/api/lessons/${lessonId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            timestamp,
            authorName: "User", // In a real app, this would come from auth
          }),
        })

        if (!response.ok) {
          console.error("Failed to save comment")
        }
      } catch (error) {
        console.error("Error saving comment:", error)
      }
    },
    [lessonId, addComment]
  )

  return (
    <Card data-slot="comments-section" className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Comments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comment form */}
        <CommentForm currentTime={currentTime} onSubmit={handleAddComment} />

        {/* Comments list */}
        <div
          ref={containerRef}
          className="max-h-[400px] space-y-3 overflow-y-auto"
        >
          {sortedComments.map((comment) => (
            <div
              key={comment.id}
              ref={(el) => {
                if (el) commentRefs.current.set(comment.id, el)
              }}
            >
              <CommentCard
                comment={comment}
                isActive={comment.id === activeCommentId}
                onTimestampClick={handleTimestampClick}
              />
            </div>
          ))}
          {sortedComments.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No comments yet. Be the first to comment!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export { CommentsSection }
export type { CommentsSectionProps }
