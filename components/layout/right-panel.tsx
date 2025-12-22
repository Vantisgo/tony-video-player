"use client"

import * as React from "react"

import { cn } from "~/lib/utils"
import { Card, CardContent, CardHeader } from "~/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { CoachingTab } from "~/components/coaching"
import { ScienceTab } from "~/components/science"
import { useVideoPlayer } from "~/lib/contexts/video-player-context"

interface RightPanelProps {
  className?: string
}

function RightPanel({ className }: RightPanelProps) {
  const { rightPanelTab, setRightPanelTab } = useVideoPlayer()

  return (
    <Card
      data-slot="right-panel"
      className={cn("flex h-full flex-col overflow-hidden", className)}
    >
      <Tabs
        value={rightPanelTab}
        onValueChange={(value) =>
          setRightPanelTab(value as "coaching" | "science")
        }
        className="flex h-full flex-col"
      >
        <CardHeader className="border-b pb-3">
          <TabsList className="w-full">
            <TabsTrigger value="coaching" className="flex-1">
              Coaching
            </TabsTrigger>
            <TabsTrigger value="science" className="flex-1">
              Science Corner
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
        </CardContent>
      </Tabs>
    </Card>
  )
}

export { RightPanel }
export type { RightPanelProps }
