import { NextResponse } from "next/server"

import prisma from "~/prisma/prisma"
import { LessonJSONSchema } from "~/lib/schemas"

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate JSON content
    const parseResult = LessonJSONSchema.safeParse(body.jsonData)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid lesson JSON", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const jsonData = parseResult.data
    const { title, description, videoUrl, audioUrls } = body

    // Create lesson with nested relations
    const lesson = await prisma.lesson.create({
      data: {
        title,
        description,
        videoUrl,
        duration: jsonData.video.duration,
        phases: {
          create: jsonData.phases.map((phase, phaseIndex) => ({
            title: phase.title,
            description: phase.description,
            startTime: phase.startTimeSec,
            endTime: phase.endTimeSec ?? null,
            sortOrder: phaseIndex,
            audioAssetUrl: audioUrls?.[phase.audioOverlay.audioAssetRef] ?? null,
            audioTriggerTime: phase.audioOverlay.triggerTimeSec,
            interventions: {
              create: phase.interventions.map((intervention, intIndex) => ({
                title: intervention.title,
                timestampSec: intervention.timestampSec,
                prompt: intervention.prompt,
                description: intervention.description,
                methodModelFramework: intervention.methodModelFramework,
                function: intervention.function,
                scientificReferenceFields: intervention.scientificReferenceFields,
                sortOrder: intIndex,
              })),
            },
          })),
        },
        scienceItems: {
          create: jsonData.scienceCornerItems.map((item, index) => ({
            name: item.name,
            description: item.description,
            timestampsSec: item.timestampsSec,
            content: item.content ? JSON.parse(JSON.stringify(item.content)) : null,
            sortOrder: index,
          })),
        },
      },
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
      },
    })

    return NextResponse.json(lesson, { status: 201 })
  } catch (error) {
    console.error("Error creating lesson:", error)
    return NextResponse.json(
      { error: "Failed to create lesson" },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const lessons = await prisma.lesson.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        duration: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(lessons)
  } catch (error) {
    console.error("Error fetching lessons:", error)
    return NextResponse.json(
      { error: "Failed to fetch lessons" },
      { status: 500 }
    )
  }
}
