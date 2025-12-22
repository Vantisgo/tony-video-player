"use client"

import * as React from "react"
import { User } from "@phosphor-icons/react"

import { cn } from "~/lib/utils"
import { Card, CardContent } from "~/components/ui/card"
import { TimestampBadge } from "~/components/coaching/timestamp-badge"

interface Comment {
  id: string
  timestamp: number
  content: string
  authorName: string
  createdAt?: string
}

interface CommentCardProps {
  comment: Comment
  isActive?: boolean
  onTimestampClick?: (timestamp: number) => void
  className?: string
}

function CommentCard({
  comment,
  isActive = false,
  onTimestampClick,
  className,
}: CommentCardProps) {
  return (
    <Card
      data-slot="comment-card"
      data-active={isActive}
      className={cn(
        "transition-all duration-200",
        isActive && "border-primary bg-primary/5 ring-1 ring-primary/20",
        className
      )}
      size="sm"
    >
      <CardContent className="flex gap-3 p-3">
        {/* Avatar placeholder */}
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="size-4 text-muted-foreground" />
        </div>

        <div className="flex-1 space-y-1">
          {/* Header: timestamp and author */}
          <div className="flex items-center gap-2">
            <TimestampBadge
              timestamp={comment.timestamp}
              onClick={onTimestampClick}
            />
            <span className="text-sm font-medium">{comment.authorName}</span>
          </div>

          {/* Comment content */}
          <p className="text-sm text-foreground/80">{comment.content}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export { CommentCard }
export type { CommentCardProps, Comment }
