import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Authenticate user here if needed
        return {
          allowedContentTypes: [
            "video/mp4",
            "video/webm",
            "video/quicktime",
            "video/x-msvideo",
            "audio/mpeg",
            "audio/wav",
            "audio/ogg",
            "audio/mp4",
            "application/json",
          ],
          maximumSizeInBytes: 5 * 1024 * 1024 * 1024, // 5GB max (requires Pro plan)
        }
      },
      onUploadCompleted: async ({ blob }) => {
        // Optional: save blob info to database here
        console.log("Upload completed:", blob.url)
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 }
    )
  }
}
