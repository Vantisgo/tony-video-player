"use client"

import * as React from "react"

import { cn } from "~/lib/utils"
import { Card, CardContent, CardHeader } from "~/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"

interface RightPanelProps {
  coachingContent: React.ReactNode
  scienceContent: React.ReactNode
  defaultTab?: "coaching" | "science"
  className?: string
}

function RightPanel({
  coachingContent,
  scienceContent,
  defaultTab = "coaching",
  className,
}: RightPanelProps) {
  return (
    <Card
      data-slot="right-panel"
      className={cn("flex h-full flex-col overflow-hidden", className)}
    >
      <Tabs defaultValue={defaultTab} className="flex h-full flex-col">
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
        <CardContent className="flex-1 overflow-hidden p-0">
          <TabsContent
            value="coaching"
            className="mt-0 h-full overflow-y-auto p-4"
          >
            {coachingContent}
          </TabsContent>
          <TabsContent
            value="science"
            className="mt-0 h-full overflow-y-auto p-4"
          >
            {scienceContent}
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  )
}

export { RightPanel }
export type { RightPanelProps }
