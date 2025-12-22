"use client"

import * as React from "react"
import { Clock } from "@phosphor-icons/react"

import { cn } from "~/lib/utils"
import { Badge } from "~/components/ui/badge"

interface TimestampBadgeProps {
  timestamp: number
  onClick?: (timestamp: number) => void
  size?: "sm" | "default"
  className?: string
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function TimestampBadge({
  timestamp,
  onClick,
  size = "default",
  className,
}: TimestampBadgeProps) {
  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onClick?.(timestamp)
    },
    [timestamp, onClick]
  )

  return (
    <Badge
      data-slot="timestamp-badge"
      variant="outline"
      className={cn(
        "cursor-pointer gap-1 font-mono transition-colors hover:bg-muted",
        onClick && "hover:text-primary",
        size === "sm" ? "px-1.5 py-0 text-[10px]" : "text-xs",
        className
      )}
      onClick={handleClick}
    >
      <Clock className={size === "sm" ? "size-2.5" : "size-3"} />
      {formatTimestamp(timestamp)}
    </Badge>
  )
}

export { TimestampBadge, formatTimestamp }
export type { TimestampBadgeProps }
