"use client"

import * as React from "react"

import { cn } from "~/lib/utils"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
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

interface InterventionItemProps {
  intervention: Intervention
  isActive?: boolean
  onTimestampClick?: (timestamp: number) => void
  className?: string
}

function InterventionItem({
  intervention,
  isActive = false,
  onTimestampClick,
  className,
}: InterventionItemProps) {
  return (
    <Card
      data-slot="intervention-item"
      data-active={isActive}
      className={cn(
        "transition-colors",
        isActive && "border-primary bg-primary/5",
        className
      )}
      size="sm"
    >
      <CardHeader className="pb-2">
        <div className="flex items-start gap-2">
          <TimestampBadge
            timestamp={intervention.timestampSec}
            onClick={onTimestampClick}
          />
          <CardTitle className="text-sm font-medium leading-tight">
            {intervention.title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {/* Prompt */}
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Prompt
          </p>
          <p className="italic text-foreground/90">
            &ldquo;{intervention.prompt}&rdquo;
          </p>
        </div>

        {/* Description */}
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Description
          </p>
          <p className="text-foreground/80">{intervention.description}</p>
        </div>

        {/* Method/Model/Framework */}
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Method / Model / Framework
          </p>
          <p className="text-foreground/80">
            {intervention.methodModelFramework}
          </p>
        </div>

        {/* Function */}
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Function
          </p>
          <p className="text-foreground/80">{intervention.function}</p>
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
      </CardContent>
    </Card>
  )
}

export { InterventionItem }
export type { InterventionItemProps, Intervention }
