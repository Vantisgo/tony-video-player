import { createUploadthing, type FileRouter } from "uploadthing/next"

const f = createUploadthing()

/**
 * UploadThing File Router
 * Defines upload endpoints for different file types
 */
export const ourFileRouter = {
  /**
   * Video upload - for lesson videos
   * Max 500MB, .mp4/.webm
   */
  videoUploader: f({
    video: { maxFileSize: "512MB", maxFileCount: 1 },
  }).onUploadComplete(async ({ file }) => {
    console.log("Video upload complete:", file.ufsUrl)
    return { url: file.ufsUrl }
  }),

  /**
   * Audio upload - for phase audio overlays
   * Max 50MB, .mp3/.wav
   */
  audioUploader: f({
    audio: { maxFileSize: "64MB", maxFileCount: 1 },
  }).onUploadComplete(async ({ file }) => {
    console.log("Audio upload complete:", file.ufsUrl)
    return { url: file.ufsUrl }
  }),

  /**
   * JSON upload - for lesson content
   * Max 1MB
   */
  jsonUploader: f({
    blob: { maxFileSize: "1MB", maxFileCount: 1 },
  }).onUploadComplete(async ({ file }) => {
    console.log("JSON upload complete:", file.ufsUrl)
    return { url: file.ufsUrl }
  }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
