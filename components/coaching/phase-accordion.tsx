"use client"

import * as React from "react"

import { cn } from "~/lib/utils"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion"
import { InterventionAccordion, type Intervention } from "./intervention-accordion"
import { TimestampBadge } from "./timestamp-badge"

interface Phase {
  id: string
  title: string
  description: string
  startTimeSec: number
  endTimeSec?: number
  interventions: Intervention[]
}

interface PhaseAccordionProps {
  phases: Phase[]
  activePhaseId?: string | null
  activeInterventionId?: string | null
  expandedPhaseId?: string | null
  expandedInterventionId?: string | null
  onPhaseClick?: (phaseId: string, timestamp: number) => void
  onInterventionClick?: (interventionId: string, timestamp: number) => void
  onExpandedPhaseChange?: (phaseId: string | null) => void
  onExpandedInterventionChange?: (interventionId: string | null) => void
  onPhaseRef?: (phaseId: string, el: HTMLElement | null) => void
  className?: string
}

function PhaseAccordion({
  phases,
  activePhaseId,
  activeInterventionId,
  expandedPhaseId,
  expandedInterventionId,
  onPhaseClick,
  onInterventionClick,
  onExpandedPhaseChange,
  onExpandedInterventionChange,
  onPhaseRef,
  className,
}: PhaseAccordionProps) {
  const handleValueChange = React.useCallback(
    (value: string) => {
      onExpandedPhaseChange?.(value || null)
    },
    [onExpandedPhaseChange]
  )

  const truncateDescription = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text
    const truncated = text.slice(0, maxLength).trim()
    return `${truncated}... more`
  }

  return (
    <Accordion
      type="single"
      collapsible
      value={expandedPhaseId ?? undefined}
      onValueChange={handleValueChange}
      className={cn("w-full space-y-2", className)}
    >
      {phases.map((phase) => {
        const isActive = phase.id === activePhaseId

        return (
          <AccordionItem
            key={phase.id}
            value={phase.id}
            ref={(el) => onPhaseRef?.(phase.id, el)}
            className={cn(
              "rounded-lg border px-3 transition-colors",
              isActive && "border-primary bg-primary/5"
            )}
          >
            <AccordionTrigger className="gap-2 py-3 hover:no-underline">
              <div className="flex flex-1 flex-col items-start gap-1">
                <div className="flex items-center gap-2 w-full">
                  <TimestampBadge
                    timestamp={phase.startTimeSec}
                    onClick={(timestamp) => onPhaseClick?.(phase.id, timestamp)}
                  />
                  <span className="font-medium truncate">{phase.title}</span>
                </div>
                <p className="text-xs text-muted-foreground break-words">
                  {truncateDescription(phase.description)}
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="pt-2 space-y-2">
                {phase.interventions.length > 0 ? (
                  <InterventionAccordion
                    interventions={phase.interventions}
                    activeInterventionId={activeInterventionId}
                    expandedInterventionId={expandedInterventionId}
                    onInterventionClick={onInterventionClick}
                    onExpandedChange={onExpandedInterventionChange}
                  />
                ) : (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No interventions in this phase
                  </p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}

export { PhaseAccordion }
export type { PhaseAccordionProps, Phase }
