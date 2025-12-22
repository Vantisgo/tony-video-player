import Link from "next/link"
import { Clock, PlayCircle, BookOpen, Flask, PencilSimple } from "@phosphor-icons/react/dist/ssr"

import prisma from "~/prisma/prisma"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "~/components/ui/card"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  if (mins >= 60) {
    const hours = Math.floor(mins / 60)
    const remainingMins = mins % 60
    return `${hours}h ${remainingMins}m`
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export default async function LessonsPage() {
  const lessons = await prisma.lesson.findMany({
    include: {
      phases: {
        include: {
          interventions: true,
        },
      },
      scienceItems: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  const totalInterventions = (lesson: (typeof lessons)[0]) =>
    lesson.phases.reduce((sum, phase) => sum + phase.interventions.length, 0)

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Lessons</h1>
          <p className="mt-2 text-muted-foreground">
            Explore coaching sessions with synchronized video, interventions, and science insights.
          </p>
        </div>

        {/* Lessons Grid */}
        {lessons.length === 0 ? (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <PlayCircle className="mb-4 size-12 text-muted-foreground" />
              <h2 className="text-lg font-medium">No lessons yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload your first lesson to get started.
              </p>
              <Button asChild className="mt-4">
                <Link href="/admin/upload">Upload Lesson</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {lessons.map((lesson) => (
              <Card key={lesson.id} className="h-full transition-all hover:ring-primary/50 hover:ring-2">
                <CardHeader>
                  <CardAction>
                    <Button size="icon-sm" variant="ghost" asChild>
                      <Link href={`/admin/lessons/${lesson.id}/edit`}>
                        <PencilSimple className="size-4" />
                      </Link>
                    </Button>
                  </CardAction>
                  <Link href={`/lessons/${lesson.id}`}>
                    <CardTitle className="line-clamp-2 hover:text-primary transition-colors">
                      {lesson.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-3">
                      {lesson.description}
                    </CardDescription>
                  </Link>
                </CardHeader>

                <CardContent className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="size-3" />
                    {formatDuration(lesson.duration)}
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <BookOpen className="size-3" />
                    {lesson.phases.length} phases
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <PlayCircle className="size-3" />
                    {totalInterventions(lesson)} interventions
                  </Badge>
                  <Badge variant="secondary" className="gap-1">
                    <Flask className="size-3" />
                    {lesson.scienceItems.length} science items
                  </Badge>
                </CardContent>

                <CardFooter className="text-xs text-muted-foreground">
                  Added {lesson.createdAt.toLocaleDateString()}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* Admin Link */}
        <div className="mt-8 flex justify-center">
          <Button variant="outline" asChild>
            <Link href="/admin/upload">Upload New Lesson</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
