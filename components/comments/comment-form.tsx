"use client"

import * as React from "react"
import { PaperPlaneRight, Clock } from "@phosphor-icons/react"

import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Badge } from "~/components/ui/badge"

interface CommentFormProps {
  currentTime?: number
  onSubmit?: (content: string, timestamp: number) => void
  disabled?: boolean
  className?: string
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function CommentForm({
  currentTime = 0,
  onSubmit,
  disabled = false,
  className,
}: CommentFormProps) {
  const [content, setContent] = React.useState("")

  const handleSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (content.trim() && onSubmit) {
        onSubmit(content.trim(), currentTime)
        setContent("")
      }
    },
    [content, currentTime, onSubmit]
  )

  return (
    <form
      data-slot="comment-form"
      onSubmit={handleSubmit}
      className={cn("flex items-center gap-2", className)}
    >
      <Badge variant="outline" className="shrink-0 gap-1 font-mono text-xs">
        <Clock className="size-3" />
        {formatTime(currentTime)}
      </Badge>
      <Input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add a comment at this time..."
        disabled={disabled}
        className="flex-1"
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled || !content.trim()}
      >
        <PaperPlaneRight className="size-4" />
      </Button>
    </form>
  )
}

export { CommentForm }
export type { CommentFormProps }
