"use client"

import * as React from "react"
import { Play } from "@phosphor-icons/react"

import { cn } from "~/lib/utils"

interface TimestampBadgeProps {
  timestamp: number
  onClick?: (timestamp: number) => void
  size?: "sm" | "default"
  className?: string
  /** Use "span" when nested inside a button (e.g., AccordionTrigger) to avoid invalid HTML */
  as?: "button" | "span"
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
  as = "button",
}: TimestampBadgeProps) {
  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onClick?.(timestamp)
    },
    [timestamp, onClick]
  )

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        e.stopPropagation()
        onClick?.(timestamp)
      }
    },
    [timestamp, onClick]
  )

  const sharedClassName = cn(
    "inline-flex items-center gap-1.5 font-mono transition-all duration-200",
    "rounded-md border bg-background/80 backdrop-blur-sm",
    "hover:bg-primary hover:text-primary-foreground hover:border-primary",
    "active:scale-95",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
    size === "sm"
      ? "px-2 py-0.5 text-[11px] gap-1"
      : "px-2.5 py-1 text-xs",
    as === "span" && "cursor-pointer",
    className
  )

  const content = (
    <>
      <Play
        weight="fill"
        className={cn(
          "shrink-0 opacity-70 group-hover:opacity-100",
          size === "sm" ? "size-2.5" : "size-3"
        )}
      />
      <span className="tabular-nums">{formatTimestamp(timestamp)}</span>
    </>
  )

  if (as === "span") {
    return (
      <span
        role="button"
        tabIndex={0}
        data-slot="timestamp-badge"
        className={sharedClassName}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {content}
      </span>
    )
  }

  return (
    <button
      type="button"
      data-slot="timestamp-badge"
      className={sharedClassName}
      onClick={handleClick}
    >
      {content}
    </button>
  )
}

export { TimestampBadge, formatTimestamp }
export type { TimestampBadgeProps }
