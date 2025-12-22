"use client"

import * as React from "react"
import { Flask, X } from "@phosphor-icons/react"

import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

interface ScienceTriggerProps {
  title: string
  onOpen: () => void
  onDismiss: () => void
  className?: string
}

function ScienceTrigger({
  title,
  onOpen,
  onDismiss,
  className,
}: ScienceTriggerProps) {
  return (
    <Card
      data-slot="science-trigger"
      className={cn(
        "pointer-events-auto animate-in fade-in zoom-in-95 bg-card/95 backdrop-blur-sm shadow-xl max-w-sm",
        className
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Flask className="size-5 text-primary" weight="fill" />
            <CardTitle className="text-base">Science Corner</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          &ldquo;{title}&rdquo;
        </p>
        <div className="flex gap-2">
          <Button onClick={onOpen} className="flex-1">
            Open
          </Button>
          <Button variant="outline" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export { ScienceTrigger }
export type { ScienceTriggerProps }
