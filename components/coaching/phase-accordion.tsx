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
  const interventionContentRefs = React.useRef<Map<string, HTMLDivElement>>(new Map())
  
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

  // Watch for intervention content size changes and force parent accordion to recalculate
  React.useEffect(() => {
    if (!expandedPhaseId) return
    
    const observers: ResizeObserver[] = []
    
    interventionContentRefs.current.forEach((element) => {
      const observer = new ResizeObserver(() => {
        // Find the parent phase accordion content (Radix element)
        const phaseContent = element.closest('[data-slot="accordion-content"]') as HTMLElement
        if (phaseContent) {
          // Get the inner div that has the height variable
          const innerDiv = phaseContent.querySelector('div') as HTMLElement
          
          if (innerDiv) {
            // Measure the total height of the inner div's content
            // This includes the intervention container and all its children
            const totalHeight = innerDiv.scrollHeight
            
            // Update the CSS variable on the Radix content element
            phaseContent.style.setProperty('--radix-accordion-content-height', `${totalHeight}px`)
            
            // Force the inner div to use the new height
            innerDiv.style.height = `${totalHeight}px`
          }
        }
      })
      
      // Observe the intervention content container
      observer.observe(element)
      observers.push(observer)
    })
    
    return () => {
      observers.forEach(observer => observer.disconnect())
    }
  }, [expandedPhaseId, expandedInterventionId])

  const registerInterventionContentRef = React.useCallback((phaseId: string, element: HTMLDivElement | null) => {
    if (element) {
      interventionContentRefs.current.set(phaseId, element)
    } else {
      interventionContentRefs.current.delete(phaseId)
    }
  }, [])

  return (
    <Accordion
      data-slot="phase-accordion"
      type="single"
      collapsible
      value={expandedPhaseId ?? undefined}
      onValueChange={handleValueChange}
      className={cn("w-full space-y-2 flex flex-col", className)}
    >
      {phases.map((phase) => {
        const isActive = phase.id === activePhaseId

        return (
          <AccordionItem
            key={phase.id}
            value={phase.id}
            ref={(el) => onPhaseRef?.(phase.id, el)}
            className={cn(
              "rounded-lg border px-3 transition-colors min-w-0 flex flex-col",
              isActive && "border-primary bg-primary/5"
            )}
          >
            <AccordionTrigger className="gap-2 py-3 hover:no-underline">
              <div className="flex flex-1 flex-col items-start gap-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0 w-full">
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
              <div 
                ref={(el) => registerInterventionContentRef(phase.id, el)}
                className="pt-2 w-full min-w-0 flex flex-col"
              >
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
