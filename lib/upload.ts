"use client"

import * as React from "react"

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

          // Use streaming upload with query params
          const params = new URLSearchParams({
            filename: file.name,
            type: fileType,
          })

          const response = await fetch(`/api/upload?${params.toString()}`, {
            method: "POST",
            body: file,
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || "Upload failed")
          }

          const result = await response.json()
          uploadedFiles.push({
            name: result.name,
            url: result.url,
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
