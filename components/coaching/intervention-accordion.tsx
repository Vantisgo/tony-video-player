"use client"

import * as React from "react"
import {
  Quotes,
  ChatText,
  Lightning,
  BookOpen,
  Target,
} from "@phosphor-icons/react"

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
      className={cn("w-full space-y-1.5", className)}
    >
      {interventions.map((intervention, index) => {
        const isActive = intervention.id === activeInterventionId

        return (
          <AccordionItem
            key={intervention.id}
            value={intervention.id}
            className={cn(
              "relative rounded-lg border-l-2 bg-muted/30 px-3 transition-all duration-200",
              "border-t border-r border-b border-border/50",
              isActive
                ? "border-l-primary"
                : "border-l-muted-foreground/30 hover:border-l-muted-foreground/50"
            )}
          >
            <AccordionTrigger className="gap-3 py-3 hover:no-underline">
              <div className="flex flex-1 items-center gap-3 min-w-0">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                  {index + 1}
                </span>
                <div className="flex flex-col items-start gap-1 min-w-0">
                  <span
                    className={cn(
                      "text-left text-sm font-medium leading-tight",
                      isActive && "text-primary"
                    )}
                  >
                    {intervention.title}
                  </span>
                  <TimestampBadge
                    as="span"
                    timestamp={intervention.timestampSec}
                    onClick={(timestamp) =>
                      onInterventionClick?.(intervention.id, timestamp)
                    }
                    size="sm"
                  />
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-4 pt-1">
                {/* Coaching Prompt */}
                <div className="flex gap-2">
                  <Quotes weight="fill" className="size-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-base font-medium italic text-foreground leading-relaxed">
                    &ldquo;{intervention.prompt}&rdquo;
                  </p>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <ChatText weight="duotone" className="size-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      What&apos;s Happening
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed pl-5.5">
                    {intervention.description}
                  </p>
                </div>

                {/* Method/Model/Framework */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Lightning weight="duotone" className="size-3.5 text-amber-500" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Tony&apos;s Method / Model / Framework
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 pl-5.5">
                    {intervention.methodModelFramework}
                  </p>
                </div>

                {/* Function */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Target weight="duotone" className="size-3.5 text-emerald-500" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Function
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 pl-5.5">
                    {intervention.function}
                  </p>
                </div>

                {/* Scientific Reference Fields */}
                {intervention.scientificReferenceFields.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2">
                      <BookOpen weight="duotone" className="size-3.5 text-blue-500" />
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Scientific Fields
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-5.5">
                      {intervention.scientificReferenceFields.map((field) => (
                        <Badge
                          key={field}
                          variant="outline"
                          className="text-xs bg-background/50"
                        >
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
