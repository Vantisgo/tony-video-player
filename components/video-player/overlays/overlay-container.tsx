"use client"

import * as React from "react"

import { cn } from "~/lib/utils"

type OverlayPosition = "top-right" | "top-left" | "bottom" | "bottom-right" | "center"

interface OverlayContainerProps {
  position: OverlayPosition
  children: React.ReactNode
  className?: string
}

const positionClasses: Record<OverlayPosition, string> = {
  "top-right": "absolute top-4 right-4",
  "top-left": "absolute top-4 left-4",
  bottom: "absolute bottom-20 left-4 right-4",
  "bottom-right": "absolute bottom-20 right-4",
  center: "absolute inset-0 flex items-center justify-center",
}

function OverlayContainer({
  position,
  children,
  className,
}: OverlayContainerProps) {
  return (
    <div
      data-slot="overlay-container"
      data-position={position}
      className={cn(
        "pointer-events-none z-10",
        positionClasses[position],
        className
      )}
    >
      {children}
    </div>
  )
}

export { OverlayContainer }
export type { OverlayContainerProps, OverlayPosition }
