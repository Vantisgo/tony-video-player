"use client"

import * as React from "react"
import { Flask } from "@phosphor-icons/react"

import { cn } from "~/lib/utils"

interface ScienceTriggerProps {
  title: string
  onOpen: () => void
  onDismiss: () => void
  className?: string
}

function ScienceTrigger({
  title,
  onOpen,
  className,
}: ScienceTriggerProps) {
  return (
    <div
      data-slot="science-trigger"
      className={cn(
        "w-72 pointer-events-auto animate-in fade-in slide-in-from-right-2",
        className
      )}
    >
      <div className="bg-gradient-to-br from-orange-500/20 via-amber-500/20 to-yellow-500/20 border border-orange-300/25 rounded-2xl p-4 backdrop-blur-md shadow-2xl">
        <div className="flex items-center gap-3">
          <Flask className="size-5 text-orange-400 shrink-0" weight="fill" />
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold">Science Corner</p>
            <p className="text-orange-100/70 text-xs truncate">{title}</p>
          </div>
          <button
            onClick={onOpen}
            className="px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 rounded-xl text-white text-sm font-medium transition-colors shrink-0"
          >
            Open
          </button>
        </div>
      </div>
    </div>
  )
}

export { ScienceTrigger }
export type { ScienceTriggerProps }
