import { NextResponse } from "next/server"

import prisma from "~/prisma/prisma"

interface RouteParams {
  params: Promise<{ lessonId: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { lessonId } = await params

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

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    return NextResponse.json(lesson)
  } catch (error) {
    console.error("Error fetching lesson:", error)
    return NextResponse.json(
      { error: "Failed to fetch lesson" },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { lessonId } = await params
    const body = await request.json()

    // Check if lesson exists
    const existingLesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
    })

    if (!existingLesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    // Update lesson with transaction to handle all relations
    const updatedLesson = await prisma.$transaction(async (tx) => {
      // Delete existing phases/interventions/science items
      await tx.intervention.deleteMany({
        where: { phase: { lessonId } },
      })
      await tx.phase.deleteMany({
        where: { lessonId },
      })
      await tx.scienceItem.deleteMany({
        where: { lessonId },
      })

      // Update lesson with new data (similar to create logic)
      const { jsonData, audioUrls, scienceItems } = body

      // Determine science items source: JSON data takes precedence, then direct scienceItems array
      const scienceItemsToCreate =
        jsonData?.scienceCornerItems || scienceItems

      return await tx.lesson.update({
        where: { id: lessonId },
        data: {
          title: body.title || existingLesson.title,
          description: body.description || existingLesson.description,
          videoUrl: body.videoUrl || existingLesson.videoUrl,
          duration: jsonData?.video?.duration || existingLesson.duration,
          phases: jsonData?.phases
            ? {
                create: jsonData.phases.map((phase: any, idx: number) => ({
                  title: phase.title,
                  description: phase.description,
                  startTime: phase.startTimeSec,
                  endTime: phase.endTimeSec,
                  sortOrder: idx,
                  audioAssetUrl: phase.audioOverlay
                    ? audioUrls?.[phase.audioOverlay.audioAssetRef] || null
                    : null,
                  audioTriggerTime: phase.audioOverlay?.triggerTimeSec || null,
                  interventions: {
                    create: phase.interventions.map(
                      (intervention: any, intIdx: number) => ({
                        title: intervention.title,
                        timestampSec: intervention.timestampSec,
                        prompt: intervention.prompt,
                        description: intervention.description,
                        methodModelFramework: intervention.methodModelFramework,
                        function: intervention.function,
                        scientificReferenceFields:
                          intervention.scientificReferenceFields,
                        sortOrder: intIdx,
                      })
                    ),
                  },
                })),
              }
            : undefined,
          scienceItems: scienceItemsToCreate
            ? {
                create: scienceItemsToCreate.map((item: any, idx: number) => ({
                  name: item.name,
                  description: item.description,
                  timestampsSec: item.timestampsSec,
                  content: item.content || null,
                  sortOrder: idx,
                })),
              }
            : undefined,
        },
        include: {
          phases: {
            include: { interventions: true },
            orderBy: { sortOrder: "asc" },
          },
          scienceItems: { orderBy: { sortOrder: "asc" } },
          comments: { orderBy: { timestamp: "asc" } },
        },
      })
    })

    return NextResponse.json(updatedLesson)
  } catch (error) {
    console.error("Error updating lesson:", error)
    return NextResponse.json(
      { error: "Failed to update lesson" },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { lessonId } = await params

    // Check if lesson exists
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
    })

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    // Delete lesson (cascade will delete related data)
    await prisma.lesson.delete({
      where: { id: lessonId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting lesson:", error)
    return NextResponse.json(
      { error: "Failed to delete lesson" },
      { status: 500 }
    )
  }
}
