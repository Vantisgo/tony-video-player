"use client"

import * as React from "react"

import { cn } from "~/lib/utils"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion"
import { Badge } from "~/components/ui/badge"
import { TimestampBadge } from "./timestamp-badge"

interface Intervention {
  id: string
  title: string
  timestampSec: number
  prompt: string
  description: string
  methodModelFramework: string
  function: string
  scientificReferenceFields: string[]
}

interface InterventionAccordionProps {
  interventions: Intervention[]
  activeInterventionId?: string | null
  expandedInterventionId?: string | null
  onInterventionClick?: (interventionId: string, timestamp: number) => void
  onExpandedChange?: (interventionId: string | null) => void
  className?: string
}

function InterventionAccordion({
  interventions,
  activeInterventionId,
  expandedInterventionId,
  onInterventionClick,
  onExpandedChange,
  className,
}: InterventionAccordionProps) {
  const handleValueChange = React.useCallback(
    (value: string) => {
      onExpandedChange?.(value || null)
    },
    [onExpandedChange]
  )

  return (
    <Accordion
      data-slot="intervention-accordion"
      type="single"
      collapsible
      value={expandedInterventionId ?? undefined}
      onValueChange={handleValueChange}
      className={cn("w-full space-y-2", className)}
    >
      {interventions.map((intervention) => {
        const isActive = intervention.id === activeInterventionId

        return (
          <AccordionItem
            key={intervention.id}
            value={intervention.id}
            className={cn(
              "rounded-lg border bg-card px-3 transition-all duration-200",
              isActive && "border-primary ring-1 ring-primary/20"
            )}
          >
            <AccordionTrigger className="gap-2 py-2.5 hover:no-underline">
              <div className="flex flex-1 items-center gap-2 min-w-0">
                <TimestampBadge
                  timestamp={intervention.timestampSec}
                  onClick={(timestamp) =>
                    onInterventionClick?.(intervention.id, timestamp)
                  }
                  size="sm"
                />
                <span
                  className={cn(
                    "text-left text-sm font-medium leading-tight break-words",
                    isActive && "text-primary"
                  )}
                >
                  {intervention.title}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="space-y-3 pt-1 text-sm">
                {/* Prompt */}
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Prompt
                  </p>
                  <p className="italic text-foreground/90 break-words">
                    &ldquo;{intervention.prompt}&rdquo;
                  </p>
                </div>

                {/* Description */}
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Description
                  </p>
                  <p className="text-foreground/80 break-words">{intervention.description}</p>
                </div>

                {/* Method/Model/Framework */}
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Method / Model / Framework
                  </p>
                  <p className="text-foreground/80 break-words">
                    {intervention.methodModelFramework}
                  </p>
                </div>

                {/* Function */}
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Function
                  </p>
                  <p className="text-foreground/80 break-words">{intervention.function}</p>
                </div>

                {/* Scientific Reference Fields */}
                {intervention.scientificReferenceFields.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      Scientific Reference Fields
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {intervention.scientificReferenceFields.map((field) => (
                        <Badge key={field} variant="secondary" className="text-xs">
                          {field}
                        </Badge>
                      ))}
                    </div>
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

export { InterventionAccordion }
export type { InterventionAccordionProps, Intervention }
