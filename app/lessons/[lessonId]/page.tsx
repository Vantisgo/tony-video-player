import { LessonLayout } from "~/components/layout/lesson-layout"
import { RightPanel } from "~/components/layout/right-panel"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"

interface LessonPageProps {
  params: Promise<{ lessonId: string }>
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { lessonId } = await params

  return (
    <LessonLayout
      videoSection={<VideoPlaceholder lessonId={lessonId} />}
      commentsSection={<CommentsPlaceholder />}
      rightPanel={
        <RightPanel
          coachingContent={<CoachingPlaceholder />}
          scienceContent={<SciencePlaceholder />}
        />
      }
    />
  )
}

function VideoPlaceholder({ lessonId }: { lessonId: string }) {
  return (
    <Card data-slot="video-placeholder">
      <CardContent className="flex aspect-video items-center justify-center bg-muted">
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground">
            Video Player
          </p>
          <p className="text-sm text-muted-foreground">Lesson: {lessonId}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function CommentsPlaceholder() {
  return (
    <Card data-slot="comments-placeholder">
      <CardHeader>
        <CardTitle>Comments</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground">
            Comments section will appear here
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CoachingPlaceholder() {
  return (
    <div
      data-slot="coaching-placeholder"
      className="space-y-4"
    >
      <p className="text-sm text-muted-foreground">
        Coaching phases and interventions will appear here
      </p>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-dashed p-4 text-muted-foreground"
          >
            Phase {i} placeholder
          </div>
        ))}
      </div>
    </div>
  )
}

function SciencePlaceholder() {
  return (
    <div
      data-slot="science-placeholder"
      className="space-y-4"
    >
      <p className="text-sm text-muted-foreground">
        Science corner items will appear here
      </p>
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-dashed p-4 text-muted-foreground"
          >
            Science Item {i} placeholder
          </div>
        ))}
      </div>
    </div>
  )
}
