"use client"

import * as React from "react"
import { Flask } from "@phosphor-icons/react"

import { cn } from "~/lib/utils"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion"

interface ScienceItem {
  id: string
  name: string
  description: string
  timestampsSec?: number[]
  content?: {
    title?: string
    subtitle?: string
    sections?: Array<{
      heading: string
      content?: string
      items?: Array<{
        text: string
        subItems?: string[]
      }>
    }>
    references?: Array<{
      text: string
      url?: string
    }>
  }
}

interface ScienceAccordionProps {
  items: ScienceItem[]
  expandedItemId?: string | null
  highlightedItemId?: string | null
  onExpandedChange?: (itemId: string | null) => void
  onItemRef?: (itemId: string, el: HTMLElement | null) => void
  className?: string
}

function ScienceAccordion({
  items,
  expandedItemId,
  highlightedItemId,
  onExpandedChange,
  onItemRef,
  className,
}: ScienceAccordionProps) {
  const handleValueChange = React.useCallback(
    (value: string) => {
      onExpandedChange?.(value || null)
    },
    [onExpandedChange]
  )

  return (
    <Accordion
      data-slot="science-accordion"
      type="single"
      collapsible
      value={expandedItemId ?? undefined}
      onValueChange={handleValueChange}
      className={cn("space-y-2", className)}
    >
      {items.map((item) => {
        const isHighlighted = item.id === highlightedItemId

        return (
          <AccordionItem
            key={item.id}
            value={item.id}
            ref={(el) => onItemRef?.(item.id, el)}
            className={cn(
              "rounded-lg border px-3 transition-all duration-300",
              isHighlighted && "ring-2 ring-primary ring-offset-2"
            )}
          >
            <AccordionTrigger className="gap-2 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <Flask className="size-4 text-muted-foreground" />
                <span className="font-medium">{item.name}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="prose prose-sm max-w-none pt-2 text-foreground/80">
                {item.content ? (
                  <div className="space-y-4">
                    {/* Title */}
                    {item.content.title && (
                      <h2 className="text-lg font-semibold text-foreground">
                        {item.content.title}
                      </h2>
                    )}

                    {/* Subtitle */}
                    {item.content.subtitle && (
                      <p className="text-base font-medium text-foreground/90">
                        {item.content.subtitle}
                      </p>
                    )}

                    {/* Description fallback */}
                    {item.description && !item.content.title && (
                      <p className="text-sm text-foreground/80">{item.description}</p>
                    )}

                    {/* Sections */}
                    {item.content.sections && item.content.sections.length > 0 && (
                      <div className="space-y-4">
                        {item.content.sections.map((section, sectionIdx) => (
                          <div key={sectionIdx} className="space-y-2">
                            {section.heading && (
                              <h3 className="text-base font-semibold text-foreground mt-4">
                                {section.heading}
                              </h3>
                            )}
                            {section.content && (
                              <p className="text-sm text-foreground/80 leading-relaxed">
                                {section.content}
                              </p>
                            )}
                            {section.items && section.items.length > 0 && (
                              <ol className="list-decimal list-inside space-y-2 ml-2">
                                {section.items.map((listItem, itemIdx) => (
                                  <li
                                    key={itemIdx}
                                    className="text-sm text-foreground/80 leading-relaxed"
                                  >
                                    <span className="font-medium">{listItem.text}</span>
                                    {listItem.subItems && listItem.subItems.length > 0 && (
                                      <ul className="list-disc list-inside space-y-1 ml-4 mt-1">
                                        {listItem.subItems.map((subItem, subIdx) => (
                                          <li
                                            key={subIdx}
                                            className="text-sm text-foreground/70"
                                          >
                                            {subItem}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* References */}
                    {item.content.references && item.content.references.length > 0 && (
                      <div className="mt-6 pt-4 border-t space-y-2">
                        <h4 className="text-sm font-semibold text-foreground">
                          References
                        </h4>
                        <ul className="list-disc ml-4 space-y-1.5">
                          {item.content.references.map((ref, refIdx) => (
                            <li key={refIdx} className="text-xs text-foreground/70 pl-1">
                              {ref.url ? (
                                <a
                                  href={ref.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline break-all"
                                >
                                  {ref.text}
                                </a>
                              ) : (
                                <span>{ref.text}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-foreground/80">{item.description}</p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}

export { ScienceAccordion }
export type { ScienceAccordionProps, ScienceItem }
