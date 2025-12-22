import { NextResponse } from "next/server"
import { z } from "zod"

import prisma from "~/prisma/prisma"

interface RouteParams {
  params: Promise<{ lessonId: string }>
}

const CreateCommentSchema = z.object({
  content: z.string().min(1),
  timestamp: z.number().min(0),
  authorName: z.string().min(1),
})

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { lessonId } = await params

    const comments = await prisma.comment.findMany({
      where: { lessonId },
      orderBy: { timestamp: "asc" },
    })

    return NextResponse.json(comments)
  } catch (error) {
    console.error("Error fetching comments:", error)
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { lessonId } = await params
    const body = await request.json()

    // Validate input
    const parseResult = CreateCommentSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid comment data", details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    // Check if lesson exists
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
    })

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 })
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        ...parseResult.data,
        lessonId,
      },
    })

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error("Error creating comment:", error)
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    )
  }
}
