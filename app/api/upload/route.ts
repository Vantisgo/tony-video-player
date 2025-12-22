import { put } from "@vercel/blob"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const fileType = formData.get("type") as string | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Validate file type
    const allowedTypes: Record<string, string[]> = {
      video: ["video/mp4", "video/webm"],
      audio: ["audio/mpeg", "audio/wav", "audio/mp3"],
      json: ["application/json"],
    }

    if (fileType && allowedTypes[fileType]) {
      if (!allowedTypes[fileType].includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type. Expected ${fileType}` },
          { status: 400 }
        )
      }
    }

    // Generate a unique filename with timestamp
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
    const filename = `${timestamp}-${sanitizedName}`

    // Determine folder based on file type
    const folder = fileType || "files"
    const pathname = `${folder}/${filename}`

    // Upload to Vercel Blob
    const blob = await put(pathname, file, {
      access: "public",
    })

    return NextResponse.json({
      url: blob.url,
      name: file.name,
      size: file.size,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    )
  }
}
