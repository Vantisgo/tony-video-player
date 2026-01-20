"use client"

import * as React from "react"

import { cn } from "~/lib/utils"
import { Card, CardContent, CardHeader } from "~/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { CoachingTab } from "~/components/coaching"
import { ScienceTab } from "~/components/science"
import { MetaStructureTab } from "~/components/meta-structure"
import { useVideoPlayer } from "~/lib/contexts/video-player-context"

interface RightPanelProps {
  className?: string
}

function RightPanel({ className }: RightPanelProps) {
  const { rightPanelTab, setRightPanelTab } = useVideoPlayer()
  const [isMounted, setIsMounted] = React.useState(false)

  // Delay rendering until after hydration to prevent Radix UI ID mismatch
  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return (
      <Card
        data-slot="right-panel"
        className={cn("flex h-full flex-col overflow-hidden", className)}
      >
        <CardHeader className="border-b pb-3">
          <div className="flex w-full gap-1 rounded-lg bg-muted p-1">
            <div className="h-8 flex-1 animate-pulse rounded-md bg-muted-foreground/10" />
            <div className="h-8 flex-1 animate-pulse rounded-md bg-muted-foreground/10" />
            <div className="h-8 flex-1 animate-pulse rounded-md bg-muted-foreground/10" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 p-4">
          <div className="space-y-3">
            <div className="h-24 w-full animate-pulse rounded-xl bg-muted" />
            <div className="h-24 w-full animate-pulse rounded-xl bg-muted" />
            <div className="h-24 w-full animate-pulse rounded-xl bg-muted" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      data-slot="right-panel"
      className={cn("flex h-full flex-col overflow-hidden", className)}
    >
      <Tabs
        value={rightPanelTab}
        onValueChange={(value) =>
          setRightPanelTab(value as "coaching" | "science" | "meta")
        }
        className="flex h-full flex-col"
      >
        <CardHeader className="border-b pb-3">
          <TabsList className="w-full">
            <TabsTrigger value="coaching" className="flex-1">
              Coaching
            </TabsTrigger>
            <TabsTrigger value="science" className="flex-1">
              Science
            </TabsTrigger>
            <TabsTrigger value="meta" className="flex-1">
              Meta Structure
            </TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent className="flex-1 p-0 flex flex-col min-h-0">
          <TabsContent
            value="coaching"
            className="mt-0 flex-1 overflow-y-auto p-4"
          >
            <CoachingTab />
          </TabsContent>
          <TabsContent
            value="science"
            className="mt-0 flex-1 overflow-y-auto p-4"
          >
            <ScienceTab />
          </TabsContent>
          <TabsContent
            value="meta"
            className="mt-0 flex-1 overflow-y-auto p-4"
          >
            <MetaStructureTab />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  )
}

export { RightPanel }
export type { RightPanelProps }
