"use client"

import * as React from "react"

import { cn } from "~/lib/utils"
import { useVideoPlayer } from "~/lib/contexts/video-player-context"
import { ScienceAccordion } from "./science-accordion"

interface ScienceTabProps {
  className?: string
}

function ScienceTab({ className }: ScienceTabProps) {
  const { scienceItems, highlightedScienceItemId } = useVideoPlayer()

  const [expandedItemId, setExpandedItemId] = React.useState<string | null>(null)
  const itemRefs = React.useRef<Map<string, HTMLElement>>(new Map())

  // Auto-expand highlighted item and scroll to it
  React.useEffect(() => {
    if (highlightedScienceItemId) {
      setExpandedItemId(highlightedScienceItemId)

      // Scroll to item
      const itemEl = itemRefs.current.get(highlightedScienceItemId)
      if (itemEl) {
        setTimeout(() => {
          itemEl.scrollIntoView({ behavior: "smooth", block: "start" })
        }, 100)
      }
    }
  }, [highlightedScienceItemId])

  // Register item ref
  const registerItemRef = React.useCallback(
    (itemId: string, el: HTMLElement | null) => {
      if (el) {
        itemRefs.current.set(itemId, el)
      } else {
        itemRefs.current.delete(itemId)
      }
    },
    []
  )

  // Convert to the format expected by ScienceAccordion
  const accordionItems = React.useMemo(
    () =>
      scienceItems.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        timestampsSec: item.timestampsSec,
        content: item.content,
      })),
    [scienceItems]
  )

  return (
    <div data-slot="science-tab" className={cn("", className)}>
      <ScienceAccordion
        items={accordionItems}
        expandedItemId={expandedItemId}
        highlightedItemId={highlightedScienceItemId}
        onExpandedChange={setExpandedItemId}
        onItemRef={registerItemRef}
      />
    </div>
  )
}

export { ScienceTab }
export type { ScienceTabProps }
