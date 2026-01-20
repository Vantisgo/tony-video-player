"use client"

import * as React from "react"

import { cn } from "~/lib/utils"
import { TimestampBadge } from "~/components/coaching"
import type { MetaStep } from "~/lib/constants/meta-steps"

interface MetaStepListItemProps {
  step: MetaStep
  isActive?: boolean
  onSeek?: (timestamp: number) => void
  className?: string
}

function MetaStepListItem({
  step,
  isActive = false,
  onSeek,
  className,
}: MetaStepListItemProps) {
  return (
    <div
      data-slot="meta-step-list-item"
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 transition-all duration-200",
        isActive
          ? "border-primary bg-primary/5"
          : "border-transparent hover:border-border hover:bg-muted/50",
        className
      )}
    >
      {/* Step Number Badge */}
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          isActive
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {step.number}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4
          className={cn(
            "text-sm font-medium leading-tight",
            isActive ? "text-foreground" : "text-foreground/80"
          )}
        >
          {step.title}
        </h4>
        {step.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {step.description}
          </p>
        )}
      </div>

      {/* Timestamp Badge */}
      <TimestampBadge
        timestamp={step.timestampSec}
        onClick={onSeek}
        size="sm"
        className="shrink-0"
      />
    </div>
  )
}

export { MetaStepListItem }
export type { MetaStepListItemProps }
