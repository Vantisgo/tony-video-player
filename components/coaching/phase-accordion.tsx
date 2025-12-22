"use client"

import * as React from "react"
import { Timer } from "@phosphor-icons/react"

import { cn } from "~/lib/utils"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion"
import { Badge } from "~/components/ui/badge"
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

// Strip "Phase X:" prefix from title since we show the number separately
function stripPhasePrefix(title: string): string {
  return title.replace(/^Phase\s*\d+\s*:\s*/i, "")
}

// Expandable description component
function ExpandableDescription({
  description,
  isCollapsed,
}: {
  description: string
  isCollapsed: boolean
}) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  // Reset expanded state when intervention collapses
  React.useEffect(() => {
    if (!isCollapsed) {
      setIsExpanded(false)
    }
  }, [isCollapsed])

  if (!isCollapsed || isExpanded) {
    return (
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    )
  }

  return (
    <p className="text-sm text-muted-foreground leading-relaxed">
      <span className="line-clamp-2">{description}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsExpanded(true)
        }}
        className="text-primary hover:underline font-medium ml-1"
      >
        more
      </button>
    </p>
  )
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

  return (
    <Accordion
      type="single"
      collapsible
      value={expandedPhaseId ?? undefined}
      onValueChange={handleValueChange}
      className={cn("w-full space-y-3", className)}
    >
      {phases.map((phase, index) => {
        const isActive = phase.id === activePhaseId
        const interventionCount = phase.interventions.length
        // Check if any intervention in this phase is expanded
        const hasExpandedIntervention = expandedInterventionId
          ? phase.interventions.some((i) => i.id === expandedInterventionId)
          : false

        return (
          <AccordionItem
            key={phase.id}
            value={phase.id}
            ref={(el) => onPhaseRef?.(phase.id, el)}
            className={cn(
              "rounded-xl border-2 bg-card overflow-hidden transition-all duration-200",
              isActive
                ? "border-primary shadow-sm shadow-primary/10"
                : "border-border hover:border-border/80"
            )}
          >
            <AccordionTrigger className="gap-3 px-4 py-4 hover:no-underline hover:bg-muted/30">
              <div className="flex flex-1 items-start gap-3 min-w-0">
                {/* Phase number indicator */}
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg font-bold text-lg transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {index + 1}
                </div>

                <div className="flex flex-col items-start gap-2 min-w-0 flex-1">
                  {/* Title and timestamp row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3
                      className={cn(
                        "text-base font-semibold leading-tight",
                        isActive && "text-primary"
                      )}
                    >
                      {stripPhasePrefix(phase.title)}
                    </h3>
                    <TimestampBadge
                      timestamp={phase.startTimeSec}
                      onClick={(timestamp) => onPhaseClick?.(phase.id, timestamp)}
                    />
                  </div>

                  {/* Description - truncated when intervention is expanded */}
                  <ExpandableDescription
                    description={phase.description}
                    isCollapsed={hasExpandedIntervention}
                  />

                  {/* Meta info - hide intervention count when phase is expanded */}
                  {expandedPhaseId !== phase.id && (
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {interventionCount} intervention{interventionCount !== 1 ? "s" : ""}
                      </Badge>
                      {phase.endTimeSec && (
                        <Badge variant="outline" className="text-xs gap-1 font-mono">
                          <Timer weight="duotone" className="size-3" />
                          {Math.round((phase.endTimeSec - phase.startTimeSec) / 60)}m
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="pt-3 border-t border-border/50">
                {phase.interventions.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Interventions
                    </h4>
                    <InterventionAccordion
                      interventions={phase.interventions}
                      activeInterventionId={activeInterventionId}
                      expandedInterventionId={expandedInterventionId}
                      onInterventionClick={onInterventionClick}
                      onExpandedChange={onExpandedInterventionChange}
                    />
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      No interventions in this phase
                    </p>
                  </div>
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
