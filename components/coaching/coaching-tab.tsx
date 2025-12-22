"use client"

import * as React from "react"

import { cn } from "~/lib/utils"
import { useVideoPlayer } from "~/lib/contexts/video-player-context"
import { PhaseAccordion } from "./phase-accordion"

interface CoachingTabProps {
  className?: string
}

function CoachingTab({ className }: CoachingTabProps) {
  const { phases, activePhaseId, activeInterventionId, seek } = useVideoPlayer()

  const [expandedPhaseId, setExpandedPhaseId] = React.useState<string | null>(
    phases[0]?.id ?? null
  )
  const [expandedInterventionId, setExpandedInterventionId] = React.useState<string | null>(null)

  // Track previous active IDs to detect transitions
  const prevActivePhaseIdRef = React.useRef<string | null>(null)
  const prevActiveInterventionIdRef = React.useRef<string | null>(null)

  const phaseContainerRef = React.useRef<HTMLDivElement>(null)
  const phaseRefs = React.useRef<Map<string, HTMLElement>>(new Map())

  // Auto-expand phase only when video ENTERS a new phase (not constantly)
  React.useEffect(() => {
    // Only auto-expand if the active phase actually changed
    if (activePhaseId && activePhaseId !== prevActivePhaseIdRef.current) {
      setExpandedPhaseId(activePhaseId)

      // Scroll to phase
      const phaseEl = phaseRefs.current.get(activePhaseId)
      if (phaseEl) {
        setTimeout(() => {
          phaseEl.scrollIntoView({ behavior: "smooth", block: "start" })
        }, 100)
      }
    }
    prevActivePhaseIdRef.current = activePhaseId
  }, [activePhaseId])

  // Auto-expand intervention only when video ENTERS a new intervention
  React.useEffect(() => {
    if (activeInterventionId && activeInterventionId !== prevActiveInterventionIdRef.current) {
      setExpandedInterventionId(activeInterventionId)
    }
    prevActiveInterventionIdRef.current = activeInterventionId
  }, [activeInterventionId])

  // Handle timestamp clicks
  const handlePhaseClick = React.useCallback(
    (_phaseId: string, timestamp: number) => {
      seek(timestamp)
    },
    [seek]
  )

  const handleInterventionClick = React.useCallback(
    (_interventionId: string, timestamp: number) => {
      seek(timestamp)
    },
    [seek]
  )

  // Register phase ref
  const registerPhaseRef = React.useCallback(
    (phaseId: string, el: HTMLElement | null) => {
      if (el) {
        phaseRefs.current.set(phaseId, el)
      } else {
        phaseRefs.current.delete(phaseId)
      }
    },
    []
  )

  // Convert phases to the format expected by PhaseAccordion
  const accordionPhases = React.useMemo(
    () =>
      phases.map((phase) => ({
        id: phase.id,
        title: phase.title,
        description: phase.description,
        startTimeSec: phase.startTimeSec,
        endTimeSec: phase.endTimeSec,
        interventions: phase.interventions,
      })),
    [phases]
  )

  return (
    <div
      ref={phaseContainerRef}
      data-slot="coaching-tab"
      className={cn("w-full", className)}
    >
      <PhaseAccordion
        phases={accordionPhases}
        activePhaseId={activePhaseId}
        activeInterventionId={activeInterventionId}
        expandedPhaseId={expandedPhaseId}
        expandedInterventionId={expandedInterventionId}
        onPhaseClick={handlePhaseClick}
        onInterventionClick={handleInterventionClick}
        onExpandedPhaseChange={setExpandedPhaseId}
        onExpandedInterventionChange={setExpandedInterventionId}
        onPhaseRef={registerPhaseRef}
      />
    </div>
  )
}

export { CoachingTab }
export type { CoachingTabProps }
