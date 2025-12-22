"use client"

import * as React from "react"
import { upload as vercelUpload } from "@vercel/blob/client"

export type UploadedFile = {
  name: string
  url: string
  size: number
}

export type FileType = "video" | "audio" | "json"

interface UseUploadOptions {
  onUploadComplete?: (files: UploadedFile[]) => void
  onUploadError?: (error: Error) => void
  onUploadProgress?: (progress: number) => void
}

export function useUpload(fileType: FileType, options: UseUploadOptions = {}) {
  const [isUploading, setIsUploading] = React.useState(false)
  const [progress, setProgress] = React.useState(0)

  const upload = React.useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files)
      if (fileArray.length === 0) return

      setIsUploading(true)
      setProgress(0)

      try {
        const uploadedFiles: UploadedFile[] = []

        for (let i = 0; i < fileArray.length; i++) {
          const file = fileArray[i]

          // Generate unique pathname
          const timestamp = Date.now()
          const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
          const pathname = `${fileType}/${timestamp}-${sanitizedName}`

          // Use Vercel Blob client upload (direct to blob storage, bypasses 4.5MB limit)
          const blob = await vercelUpload(pathname, file, {
            access: "public",
            handleUploadUrl: "/api/upload",
            onUploadProgress: (progressEvent) => {
              const fileProgress = progressEvent.percentage
              const overallProgress =
                (i / fileArray.length) * 100 +
                fileProgress / fileArray.length
              setProgress(overallProgress)
              options.onUploadProgress?.(overallProgress)
            },
          })

          uploadedFiles.push({
            name: file.name,
            url: blob.url,
            size: file.size,
          })

          const currentProgress = ((i + 1) / fileArray.length) * 100
          setProgress(currentProgress)
          options.onUploadProgress?.(currentProgress)
        }

        options.onUploadComplete?.(uploadedFiles)
        return uploadedFiles
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Upload failed")
        options.onUploadError?.(err)
        throw err
      } finally {
        setIsUploading(false)
      }
    },
    [fileType, options]
  )

  return {
    upload,
    isUploading,
    progress,
  }
}
