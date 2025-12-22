"use client"

import * as React from "react"

interface Comment {
  id: string
  timestamp: number
}

interface UseCommentsSyncOptions {
  comments: Comment[]
  currentTime: number
  containerRef: React.RefObject<HTMLDivElement | null>
}

interface UseCommentsSyncReturn {
  activeCommentId: string | null
  commentRefs: React.MutableRefObject<Map<string, HTMLElement>>
}

function useCommentsSync({
  comments,
  currentTime,
  containerRef,
}: UseCommentsSyncOptions): UseCommentsSyncReturn {
  const commentRefs = React.useRef<Map<string, HTMLElement>>(new Map())

  // Find comment closest to current time (within 5 second window)
  const activeCommentId = React.useMemo(() => {
    const nearby = comments.filter(
      (c) => Math.abs(c.timestamp - currentTime) <= 5
    )
    if (nearby.length === 0) return null

    // Return the one that just passed
    const passed = nearby.filter((c) => c.timestamp <= currentTime)
    return passed[passed.length - 1]?.id ?? null
  }, [comments, currentTime])

  // Auto-scroll to active comment
  React.useEffect(() => {
    if (activeCommentId && containerRef.current) {
      const el = commentRefs.current.get(activeCommentId)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }
  }, [activeCommentId, containerRef])

  return {
    activeCommentId,
    commentRefs,
  }
}

export { useCommentsSync }
export type { UseCommentsSyncOptions, UseCommentsSyncReturn }
