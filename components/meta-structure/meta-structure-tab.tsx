"use client"

import * as React from "react"

import { useVideoPlayer } from "~/lib/contexts/video-player-context"
import { MetaStepListItem } from "./meta-step-list-item"

interface MetaStructureTabProps {
  className?: string
}

function MetaStructureTab({ className }: MetaStructureTabProps) {
  const { metaSteps, activeMetaStepId, seek } = useVideoPlayer()

  const handleSeek = React.useCallback(
    (timestamp: number) => {
      seek(timestamp)
    },
    [seek]
  )

  return (
    <div data-slot="meta-structure-tab" className={className}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          7 Master Steps of Creating Lasting Change
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Tony Robbins&apos; framework for breakthrough transformation
        </p>
      </div>

      <div className="space-y-2">
        {metaSteps.map((step) => (
          <MetaStepListItem
            key={step.id}
            step={step}
            isActive={activeMetaStepId === step.id}
            onSeek={handleSeek}
          />
        ))}
      </div>
    </div>
  )
}

export { MetaStructureTab }
export type { MetaStructureTabProps }
