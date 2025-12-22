import { notFound } from "next/navigation"

import prisma from "~/prisma/prisma"
import { LessonLayout } from "~/components/layout/lesson-layout"
import { LessonClientWrapper } from "./lesson-client"
import type { LessonData } from "~/lib/contexts/video-player-context"

interface LessonPageProps {
  params: Promise<{ lessonId: string }>
}

async function getLesson(lessonId: string): Promise<LessonData | null> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      phases: {
        include: {
          interventions: {
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
      scienceItems: {
        orderBy: { sortOrder: "asc" },
      },
      comments: {
        orderBy: { timestamp: "asc" },
      },
    },
  })

  if (!lesson) return null

  // Transform to LessonData format
  return {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    videoUrl: lesson.videoUrl,
    duration: lesson.duration,
    introAudioUrl: lesson.introAudioUrl,
    phases: lesson.phases.map((phase) => ({
      id: phase.id,
      title: phase.title,
      description: phase.description,
      startTimeSec: phase.startTime,
      endTimeSec: phase.endTime ?? undefined,
      audioAssetUrl: phase.audioAssetUrl,
      audioTriggerTime: phase.audioTriggerTime,
      interventions: phase.interventions.map((int) => ({
        id: int.id,
        title: int.title,
        timestampSec: int.timestampSec,
        prompt: int.prompt,
        description: int.description,
        methodModelFramework: int.methodModelFramework,
        function: int.function,
        scientificReferenceFields: int.scientificReferenceFields,
      })),
    })),
    scienceItems: lesson.scienceItems.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      timestampsSec: item.timestampsSec,
    })),
    comments: lesson.comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      timestamp: comment.timestamp,
      authorName: comment.authorName,
      createdAt: comment.createdAt.toISOString(),
    })),
  }
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { lessonId } = await params

  // Check if this is a demo request
  if (lessonId === "demo") {
    return (
      <LessonClientWrapper>
        <LessonLayout />
      </LessonClientWrapper>
    )
  }

  const lesson = await getLesson(lessonId)

  if (!lesson) {
    notFound()
  }

  return (
    <LessonClientWrapper lesson={lesson}>
      <LessonLayout />
    </LessonClientWrapper>
  )
}
