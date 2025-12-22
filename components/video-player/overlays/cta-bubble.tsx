"use client"

import * as React from "react"
import { X, BookOpen } from "@phosphor-icons/react"

import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"

interface CTABubbleProps {
  title: string
  remainingSeconds: number
  onAction: () => void
  onDismiss: () => void
  className?: string
}

function CTABubble({
  title,
  remainingSeconds,
  onAction,
  onDismiss,
  className,
}: CTABubbleProps) {
  return (
    <Card
      data-slot="cta-bubble"
      className={cn(
        "pointer-events-auto animate-in fade-in slide-in-from-right-4 bg-card/95 backdrop-blur-sm shadow-lg",
        className
      )}
    >
      <CardContent className="flex items-center gap-3 p-3">
        <Button
          variant="default"
          size="sm"
          onClick={onAction}
          className="gap-2"
        >
          <BookOpen className="size-4" />
          {title}
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">
          {remainingSeconds}s
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-3" />
        </Button>
      </CardContent>
    </Card>
  )
}

export { CTABubble }
export type { CTABubbleProps }
