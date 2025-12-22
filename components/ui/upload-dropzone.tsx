"use client"

import * as React from "react"
import { Upload, X, FileVideo, FileAudio, FileText } from "lucide-react"

import { cn } from "~/lib/utils"
import { useUpload, type FileType, type UploadedFile } from "~/lib/upload"
import { Button } from "~/components/ui/button"
import { Progress } from "~/components/ui/progress"

interface UploadDropzoneProps {
  endpoint: FileType
  onClientUploadComplete?: (files: UploadedFile[]) => void
  onUploadError?: (error: Error) => void
  className?: string
}

const acceptMap: Record<FileType, string> = {
  video: "video/mp4,video/webm",
  audio: "audio/mpeg,audio/wav,audio/mp3",
  json: "application/json",
}

const labelMap: Record<FileType, string> = {
  video: "video",
  audio: "audio",
  json: "JSON",
}

const iconMap: Record<FileType, React.ReactNode> = {
  video: <FileVideo className="size-10 text-muted-foreground" />,
  audio: <FileAudio className="size-10 text-muted-foreground" />,
  json: <FileText className="size-10 text-muted-foreground" />,
}

export function UploadDropzone({
  endpoint,
  onClientUploadComplete,
  onUploadError,
  className,
}: UploadDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)

  const { upload, isUploading, progress } = useUpload(endpoint, {
    onUploadComplete: (files) => {
      setSelectedFile(null)
      onClientUploadComplete?.(files)
    },
    onUploadError: (error) => {
      setSelectedFile(null)
      onUploadError?.(error)
    },
  })

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = React.useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const files = e.dataTransfer.files
      if (files.length > 0) {
        setSelectedFile(files[0])
        await upload(files)
      }
    },
    [upload]
  )

  const handleFileSelect = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        setSelectedFile(files[0])
        await upload(files)
      }
    },
    [upload]
  )

  const handleClick = React.useCallback(() => {
    inputRef.current?.click()
  }, [])

  const clearSelection = React.useCallback(() => {
    setSelectedFile(null)
    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }, [])

  return (
    <div
      className={cn(
        "relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50",
        isUploading && "pointer-events-none opacity-60",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        accept={acceptMap[endpoint]}
        onChange={handleFileSelect}
        className="hidden"
      />

      {isUploading ? (
        <div className="flex w-full max-w-xs flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <Upload className="size-5 animate-pulse" />
            <span className="text-sm font-medium">Uploading...</span>
          </div>
          <Progress value={progress} className="w-full" />
          <span className="text-xs text-muted-foreground">
            {selectedFile?.name}
          </span>
        </div>
      ) : selectedFile ? (
        <div className="flex flex-col items-center gap-2">
          {iconMap[endpoint]}
          <span className="text-sm font-medium">{selectedFile.name}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              clearSelection()
            }}
          >
            <X className="mr-1 size-4" />
            Clear
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          {iconMap[endpoint]}
          <div className="text-center">
            <p className="text-sm font-medium">
              Drop {labelMap[endpoint]} file here or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              {endpoint === "video" && "MP4, WebM up to 512MB"}
              {endpoint === "audio" && "MP3, WAV up to 64MB"}
              {endpoint === "json" && "JSON up to 1MB"}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
