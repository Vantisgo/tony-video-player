"use client"

import * as React from "react"

interface ScienceItem {
  id: string
}

interface UseScienceSyncOptions {
  items: ScienceItem[]
  highlightedItemId: string | null
  containerRef: React.RefObject<HTMLDivElement | null>
}

interface UseScienceSyncReturn {
  expandedItemId: string | null
  setExpandedItemId: (id: string | null) => void
  itemRefs: React.MutableRefObject<Map<string, HTMLElement>>
}

function useScienceSync({
  highlightedItemId,
  containerRef,
}: UseScienceSyncOptions): UseScienceSyncReturn {
  const [expandedItemId, setExpandedItemId] = React.useState<string | null>(null)
  const itemRefs = React.useRef<Map<string, HTMLElement>>(new Map())

  // When overlay triggers science item
  React.useEffect(() => {
    if (highlightedItemId) {
      setExpandedItemId(highlightedItemId)

      // Scroll to item
      const itemEl = itemRefs.current.get(highlightedItemId)
      if (itemEl && containerRef.current) {
        itemEl.scrollIntoView({ behavior: "smooth", block: "start" })
      }
    }
  }, [highlightedItemId, containerRef])

  return {
    expandedItemId,
    setExpandedItemId,
    itemRefs,
  }
}

export { useScienceSync }
export type { UseScienceSyncOptions, UseScienceSyncReturn }
