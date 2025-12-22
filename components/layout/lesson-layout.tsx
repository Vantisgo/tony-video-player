import * as React from "react"

import { cn } from "~/lib/utils"

interface LessonLayoutProps {
  videoSection: React.ReactNode
  commentsSection: React.ReactNode
  rightPanel: React.ReactNode
  className?: string
}

function LessonLayout({
  videoSection,
  commentsSection,
  rightPanel,
  className,
}: LessonLayoutProps) {
  return (
    <div
      data-slot="lesson-layout"
      className={cn("min-h-screen bg-background", className)}
    >
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_450px]">
          {/* Left Column: Video + Comments */}
          <div className="flex flex-col gap-6">
            {videoSection}
            {commentsSection}
          </div>

          {/* Right Column: Tabs Panel */}
          <div className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
            {rightPanel}
          </div>
        </div>
      </div>
    </div>
  )
}

export { LessonLayout }
export type { LessonLayoutProps }
