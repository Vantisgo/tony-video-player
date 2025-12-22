import { put } from "@vercel/blob"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    // Check for blob token
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error("BLOB_READ_WRITE_TOKEN is not set")
      return NextResponse.json(
        { error: "Storage not configured" },
        { status: 500 }
      )
    }

    // Get filename and type from search params (for streaming upload)
    const { searchParams } = new URL(request.url)
    const filename = searchParams.get("filename")
    const fileType = searchParams.get("type")

    if (!filename) {
      return NextResponse.json({ error: "No filename provided" }, { status: 400 })
    }

    if (!request.body) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Generate a unique filename with timestamp
    const timestamp = Date.now()
    const sanitizedName = filename.replace(/[^a-zA-Z0-9.-]/g, "_")
    const uniqueFilename = `${timestamp}-${sanitizedName}`

    // Determine folder based on file type
    const folder = fileType || "files"
    const pathname = `${folder}/${uniqueFilename}`

    // Upload to Vercel Blob using streaming
    const blob = await put(pathname, request.body, {
      access: "public",
    })

    return NextResponse.json({
      url: blob.url,
      name: filename,
      size: 0, // Size not available in streaming mode
    })
  } catch (error) {
    console.error("Upload error:", error)
    const message = error instanceof Error ? error.message : "Upload failed"
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
