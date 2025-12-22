"use client"

import * as React from "react"

interface Phase {
  id: string
  startTimeSec: number
}

interface UseCoachingSyncOptions {
  phases: Phase[]
  activePhaseId: string | null
  containerRef: React.RefObject<HTMLDivElement | null>
}

interface UseCoachingSyncReturn {
  expandedPhaseId: string | null
  setExpandedPhaseId: (id: string | null) => void
  phaseRefs: React.MutableRefObject<Map<string, HTMLElement>>
}

function useCoachingSync({
  phases,
  activePhaseId,
  containerRef,
}: UseCoachingSyncOptions): UseCoachingSyncReturn {
  const [expandedPhaseId, setExpandedPhaseId] = React.useState<string | null>(
    phases[0]?.id ?? null
  )
  const phaseRefs = React.useRef<Map<string, HTMLElement>>(new Map())

  // Auto-expand active phase
  React.useEffect(() => {
    if (activePhaseId && activePhaseId !== expandedPhaseId) {
      setExpandedPhaseId(activePhaseId)
    }
  }, [activePhaseId, expandedPhaseId])

  // Auto-scroll to active phase
  React.useEffect(() => {
    if (activePhaseId && containerRef.current) {
      const phaseEl = phaseRefs.current.get(activePhaseId)
      if (phaseEl) {
        phaseEl.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }
  }, [activePhaseId, containerRef])

  return {
    expandedPhaseId,
    setExpandedPhaseId,
    phaseRefs,
  }
}

export { useCoachingSync }
export type { UseCoachingSyncOptions, UseCoachingSyncReturn }
