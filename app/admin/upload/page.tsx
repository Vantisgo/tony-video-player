"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Upload, FileVideo, FileAudio, FileJs, Check, X, Link } from "@phosphor-icons/react"

import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Textarea } from "~/components/ui/textarea"
import { Label } from "~/components/ui/label"
import { UploadDropzone } from "~/components/ui/upload-dropzone"

interface UploadedFile {
  name: string
  url: string
  size: number
}

interface FormData {
  title: string
  description: string
  videoFile: UploadedFile | null
  videoUrl: string
  audioFiles: Map<string, UploadedFile>
  jsonData: object | null
  jsonError: string | null
}

type VideoInputMode = "upload" | "url"

export default function UploadPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [videoInputMode, setVideoInputMode] = React.useState<VideoInputMode>("upload")

  const [formData, setFormData] = React.useState<FormData>({
    title: "",
    description: "",
    videoFile: null,
    videoUrl: "",
    audioFiles: new Map(),
    jsonData: null,
    jsonError: null,
  })

  // Handle video upload complete
  const handleVideoUpload = React.useCallback(
    (res: { name: string; url: string; size: number }[]) => {
      if (res[0]) {
        setFormData((prev) => ({
          ...prev,
          videoFile: { name: res[0].name, url: res[0].url, size: res[0].size },
        }))
      }
    },
    []
  )

  // Handle audio upload complete
  const handleAudioUpload = React.useCallback(
    (res: { name: string; url: string; size: number }[]) => {
      if (res[0]) {
        const audioRef = res[0].name.replace(/\.[^/.]+$/, "") // Remove extension for ref
        setFormData((prev) => {
          const newAudioFiles = new Map(prev.audioFiles)
          newAudioFiles.set(audioRef, {
            name: res[0].name,
            url: res[0].url,
            size: res[0].size,
          })
          return { ...prev, audioFiles: newAudioFiles }
        })
      }
    },
    []
  )

  // Handle JSON file selection
  const handleJsonSelect = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const json = JSON.parse(text)
        setFormData((prev) => ({
          ...prev,
          jsonData: json,
          jsonError: null,
        }))
      } catch {
        setFormData((prev) => ({
          ...prev,
          jsonData: null,
          jsonError: "Invalid JSON file",
        }))
      }
    },
    []
  )

  // Get video URL from either upload or direct URL input
  const getVideoUrl = () => {
    if (videoInputMode === "upload") {
      return formData.videoFile?.url
    }
    return formData.videoUrl.trim() || undefined
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Build audio URLs map
      const audioUrls: Record<string, string> = {}
      formData.audioFiles.forEach((file, ref) => {
        audioUrls[ref] = file.url
      })

      const response = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          jsonData: formData.jsonData,
          videoUrl: getVideoUrl(),
          audioUrls,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create lesson")
      }

      const lesson = await response.json()
      router.push(`/lessons/${lesson.id}`)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to create lesson")
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasValidVideo =
    videoInputMode === "upload"
      ? !!formData.videoFile
      : formData.videoUrl.trim().length > 0

  const isValid =
    formData.title &&
    hasValidVideo &&
    formData.jsonData &&
    !formData.jsonError

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold">Upload New Lesson</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Lesson Information</CardTitle>
            <CardDescription>Basic details about the lesson</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Enter lesson title"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Enter lesson description"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Video Upload / URL */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileVideo className="size-5" />
              Video Source
            </CardTitle>
            <CardDescription>Upload a video file or paste a direct link to an MP4</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mode Toggle */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={videoInputMode === "upload" ? "default" : "outline"}
                size="sm"
                onClick={() => setVideoInputMode("upload")}
                className="gap-2"
              >
                <Upload className="size-4" />
                Upload File
              </Button>
              <Button
                type="button"
                variant={videoInputMode === "url" ? "default" : "outline"}
                size="sm"
                onClick={() => setVideoInputMode("url")}
                className="gap-2"
              >
                <Link className="size-4" />
                Paste URL
              </Button>
            </div>

            {/* Upload Mode */}
            {videoInputMode === "upload" && (
              <>
                {formData.videoFile ? (
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
                    <Check className="size-5 text-green-600" />
                    <div className="flex-1">
                      <p className="font-medium">{formData.videoFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(formData.videoFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, videoFile: null }))
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <UploadDropzone
                    endpoint="video"
                    onClientUploadComplete={handleVideoUpload}
                    onUploadError={(error) => {
                      console.error("Video upload error:", error)
                    }}
                  />
                )}
              </>
            )}

            {/* URL Mode */}
            {videoInputMode === "url" && (
              <div className="space-y-2">
                <Label htmlFor="videoUrl">Video URL</Label>
                <Input
                  id="videoUrl"
                  type="url"
                  value={formData.videoUrl}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, videoUrl: e.target.value }))
                  }
                  placeholder="https://example.com/video.mp4"
                />
                <p className="text-xs text-muted-foreground">
                  Direct link to an MP4 or WebM file. Must be publicly accessible.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audio Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileAudio className="size-5" />
              Audio Files (Optional)
            </CardTitle>
            <CardDescription>
              Upload audio files for phase overlays. The file name should match
              the audioAssetRef in your JSON.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.audioFiles.size > 0 && (
              <div className="space-y-2">
                {Array.from(formData.audioFiles.entries()).map(([ref, file]) => (
                  <div
                    key={ref}
                    className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3"
                  >
                    <Check className="size-4 text-green-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Ref: {ref}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFormData((prev) => {
                          const newAudioFiles = new Map(prev.audioFiles)
                          newAudioFiles.delete(ref)
                          return { ...prev, audioFiles: newAudioFiles }
                        })
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <UploadDropzone
              endpoint="audio"
              onClientUploadComplete={handleAudioUpload}
              onUploadError={(error) => {
                console.error("Audio upload error:", error)
              }}
            />
          </CardContent>
        </Card>

        {/* JSON Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJs className="size-5" />
              Lesson Content (JSON)
            </CardTitle>
            <CardDescription>
              Upload the lesson content JSON file with phases, interventions,
              and science items.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {formData.jsonData ? (
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-4",
                  formData.jsonError
                    ? "border-red-200 bg-red-50"
                    : "bg-muted/50"
                )}
              >
                {formData.jsonError ? (
                  <X className="size-5 text-red-600" />
                ) : (
                  <Check className="size-5 text-green-600" />
                )}
                <div className="flex-1">
                  <p className="font-medium">
                    {formData.jsonError || "JSON file loaded"}
                  </p>
                  {!formData.jsonError && (
                    <p className="text-sm text-muted-foreground">
                      Content validated successfully
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      jsonData: null,
                      jsonError: null,
                    }))
                  }
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept=".json"
                  onChange={handleJsonSelect}
                  className="flex-1"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        {submitError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            {submitError}
          </div>
        )}

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!isValid || isSubmitting}>
            {isSubmitting ? (
              <>
                <Upload className="mr-2 size-4 animate-spin" />
                Creating Lesson...
              </>
            ) : (
              <>
                <Upload className="mr-2 size-4" />
                Create Lesson
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
