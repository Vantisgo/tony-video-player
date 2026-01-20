"use client"

import * as React from "react"

import { cn } from "~/lib/utils"
import type { MetaStep } from "~/lib/constants/meta-steps"

interface MetaStepOverlayProps {
  step: MetaStep
  className?: string
}

function MetaStepOverlay({ step, className }: MetaStepOverlayProps) {
  return (
    <div
      data-slot="meta-step-overlay"
      className={cn(
        "pointer-events-auto animate-in fade-in slide-in-from-right-4 duration-300",
        className
      )}
    >
      <div className="flex items-center gap-3 rounded-xl border border-violet-300/25 bg-gradient-to-r from-violet-500/20 via-purple-500/20 to-fuchsia-500/20 px-4 py-3 shadow-2xl backdrop-blur-md">
        {/* Step Number Badge */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-purple-600 text-sm font-bold text-white shadow-lg">
          {step.number}
        </div>

        {/* Step Title */}
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-violet-200/70">
            Step {step.number} of 7
          </p>
          <h3 className="text-sm font-semibold text-white leading-tight">
            {step.title}
          </h3>
        </div>
      </div>
    </div>
  )
}

export { MetaStepOverlay }
export type { MetaStepOverlayProps }
