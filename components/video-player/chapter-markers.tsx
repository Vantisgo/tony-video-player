"use client"

import * as React from "react"

import { cn } from "~/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip"
import { getPercentage } from "./utils"

interface Phase {
  id: string
  title: string
  startTimeSec: number
  endTimeSec?: number
}

interface ChapterMarkersProps {
  phases: Phase[]
  duration: number
  activePhaseId?: string | null
  onChapterClick: (phaseId: string, timestamp: number) => void
  className?: string
}

function ChapterMarkers({
  phases,
  duration,
  activePhaseId,
  onChapterClick,
  className,
}: ChapterMarkersProps) {
  if (!phases.length || !duration) return null

  // Calculate phase segments including any gap before the first phase
  const segments = React.useMemo(() => {
    const result: Array<{
      type: 'gap' | 'phase'
      width: number
      phase?: Phase
      index?: number
    }> = []

    phases.forEach((phase, index) => {
      const startPercent = getPercentage(phase.startTimeSec, duration)
      const endPercent = phase.endTimeSec
        ? getPercentage(phase.endTimeSec, duration)
        : index < phases.length - 1
          ? getPercentage(phases[index + 1]?.startTimeSec ?? duration, duration)
          : 100

      // Add gap before first phase if it doesn't start at 0
      if (index === 0 && startPercent > 0) {
        result.push({ type: 'gap', width: startPercent })
      }

      // Add phase segment
      result.push({
        type: 'phase',
        width: endPercent - startPercent,
        phase,
        index,
      })

      // Add gaps between phases
      if (index < phases.length - 1) {
        const nextPhase = phases[index + 1]
        const nextStartPercent = getPercentage(nextPhase.startTimeSec, duration)
        const gapWidth = nextStartPercent - endPercent
        if (gapWidth > 0) {
          result.push({ type: 'gap', width: gapWidth })
        }
      }
    })

    return result
  }, [phases, duration])

  return (
    <TooltipProvider>
      <div
        data-slot="chapter-markers"
        className={cn("absolute inset-x-0 -top-6 flex h-4", className)}
      >
        {segments.map((segment, idx) => {
          if (segment.type === 'gap') {
            return (
              <div
                key={`gap-${idx}`}
                className="h-full"
                style={{ width: `${segment.width}%` }}
              />
            )
          }

          const isActive = segment.phase?.id === activePhaseId

          return (
            <Tooltip key={segment.phase!.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "relative h-full transition-colors",
                    isActive ? "bg-primary/30" : "hover:bg-white/10"
                  )}
                  style={{
                    width: `${segment.width}%`,
                  }}
                  onClick={() => onChapterClick(segment.phase!.id, segment.phase!.startTimeSec)}
                >
                  {/* Chapter start indicator */}
                  {segment.index! > 0 && (
                    <div className="absolute left-0 top-0 h-full w-px bg-white/40" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {segment.phase!.title}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}

export { ChapterMarkers }
export type { ChapterMarkersProps }
