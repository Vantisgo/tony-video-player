"use client"

import * as React from "react"
import { useRouter, useParams } from "next/navigation"
import { Upload, FileVideo, FileAudio, FileJs, Check, X, Link, Plus, Pencil, Trash } from "@phosphor-icons/react"

import { cn } from "~/lib/utils"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Textarea } from "~/components/ui/textarea"
import { Label } from "~/components/ui/label"
import { UploadDropzone } from "~/lib/uploadthing"

interface UploadedFile {
  name: string
  url: string
  size: number
}

interface ScienceItem {
  id: string
  name: string
  description: string
  timestampsSec: number[]
  content?: {
    title?: string
    subtitle?: string
    sections?: Array<{
      heading: string
      content?: string
      items?: Array<{
        text: string
        subItems?: string[]
      }>
    }>
    references?: Array<{
      text: string
      url?: string
    }>
  }
}

interface Phase {
  id: string
  title: string
  description: string
  startTime: number
  endTime: number | null
  sortOrder: number
  audioAssetUrl: string | null
  audioTriggerTime: number | null
}

interface FormData {
  title: string
  description: string
  videoFile: UploadedFile | null
  videoUrl: string
  audioFiles: Map<string, UploadedFile>
  jsonData: object | null
  jsonError: string | null
  scienceItems: ScienceItem[]
  phases: Phase[]
}

type VideoInputMode = "upload" | "url"

export default function EditLessonPage() {
  const router = useRouter()
  const params = useParams()
  const lessonId = params.lessonId as string

  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [videoInputMode, setVideoInputMode] = React.useState<VideoInputMode>("url")

  const [formData, setFormData] = React.useState<FormData>({
    title: "",
    description: "",
    videoFile: null,
    videoUrl: "",
    audioFiles: new Map(),
    jsonData: null,
    jsonError: null,
    scienceItems: [],
    phases: [],
  })

  const [editingScienceItemId, setEditingScienceItemId] = React.useState<string | null>(null)
  const [newScienceItem, setNewScienceItem] = React.useState<Omit<ScienceItem, "id">>({
    name: "",
    description: "",
    timestampsSec: [],
  })
  const [newTimestamp, setNewTimestamp] = React.useState("")

  // Fetch existing lesson data
  React.useEffect(() => {
    const fetchLesson = async () => {
      try {
        const response = await fetch(`/api/lessons/${lessonId}`)
        if (!response.ok) throw new Error("Failed to fetch lesson")

        const lesson = await response.json()

        setFormData({
          title: lesson.title,
          description: lesson.description,
          videoFile: null,
          videoUrl: lesson.videoUrl,
          audioFiles: new Map(),
          jsonData: null,
          jsonError: null,
          scienceItems: lesson.scienceItems || [],
          phases: lesson.phases || [],
        })

        setIsLoading(false)
      } catch (error) {
        console.error("Error fetching lesson:", error)
        setSubmitError("Failed to load lesson")
        setIsLoading(false)
      }
    }

    fetchLesson()
  }, [lessonId])

  // Handle video upload complete
  const handleVideoUpload = React.useCallback(
    (res: { name: string; ufsUrl: string; size: number }[]) => {
      if (res[0]) {
        setFormData((prev) => ({
          ...prev,
          videoFile: { name: res[0].name, url: res[0].ufsUrl, size: res[0].size },
        }))
      }
    },
    []
  )

  // Handle audio upload complete
  const handleAudioUpload = React.useCallback(
    (res: { name: string; ufsUrl: string; size: number }[]) => {
      if (res[0]) {
        const audioRef = res[0].name.replace(/\.[^/.]+$/, "") // Remove extension for ref
        setFormData((prev) => {
          const newAudioFiles = new Map(prev.audioFiles)
          newAudioFiles.set(audioRef, {
            name: res[0].name,
            url: res[0].ufsUrl,
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
        
        // Extract phases from JSON for display
        const jsonPhases: Phase[] = []
        if (json.phases && Array.isArray(json.phases)) {
          json.phases.forEach((phase: any, idx: number) => {
            jsonPhases.push({
              id: `json-${idx}`,
              title: phase.title || "",
              description: phase.description || "",
              startTime: phase.startTimeSec || 0,
              endTime: phase.endTimeSec || null,
              sortOrder: idx,
              audioAssetUrl: phase.audioOverlay ? null : null, // Will be set from audioUrls
              audioTriggerTime: phase.audioOverlay?.triggerTimeSec || null,
            })
          })
        }
        
        setFormData((prev) => ({
          ...prev,
          jsonData: json,
          jsonError: null,
          // Clear manual science items when JSON is loaded (JSON will override)
          scienceItems: [],
          // Update phases from JSON for display purposes
          phases: jsonPhases,
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

  // Get audio-to-phase mappings
  const getAudioPhaseMappings = React.useMemo(() => {
    const mappings: Array<{
      audioRef: string
      audioFile: UploadedFile | null
      phaseTitle: string
      phaseId: string
      triggerTime: number | null
      source: "json" | "database"
    }> = []

    // If JSON data exists, extract from JSON (takes precedence)
    if (formData.jsonData && typeof formData.jsonData === "object" && "phases" in formData.jsonData) {
      const jsonPhases = (formData.jsonData as {
        phases?: Array<{
          title: string
          audioOverlay?: { audioAssetRef: string; triggerTimeSec: number }
        }>
      }).phases || []

      jsonPhases.forEach((phase, idx) => {
        if (phase.audioOverlay) {
          const audioRef = phase.audioOverlay.audioAssetRef
          const audioFile = formData.audioFiles.get(audioRef) || null
          mappings.push({
            audioRef,
            audioFile,
            phaseTitle: phase.title,
            phaseId: `json-${idx}`,
            triggerTime: phase.audioOverlay.triggerTimeSec,
            source: "json",
          })
        }
      })
    }

    // Also include phases from database (if not already in JSON)
    formData.phases.forEach((phase) => {
      if (phase.audioAssetUrl) {
        // Skip if this phase is already mapped from JSON (by checking if phase title matches)
        const alreadyMapped = mappings.some(
          (m) => m.phaseTitle === phase.title && m.source === "json"
        )
        if (alreadyMapped) return

        // Try to find matching audio file by URL
        let audioRef = ""
        let audioFile: UploadedFile | null = null

        // Check if any uploaded audio file matches the URL
        for (const [ref, file] of formData.audioFiles.entries()) {
          if (file.url === phase.audioAssetUrl) {
            audioRef = ref
            audioFile = file
            break
          }
        }

        // If not found in uploaded files, extract filename from URL
        if (!audioFile && phase.audioAssetUrl) {
          const urlParts = phase.audioAssetUrl.split("/")
          const filename = urlParts[urlParts.length - 1]
          audioRef = filename.replace(/\.[^/.]+$/, "") || "linked"
        }

        mappings.push({
          audioRef: audioRef || "linked",
          audioFile,
          phaseTitle: phase.title,
          phaseId: phase.id,
          triggerTime: phase.audioTriggerTime,
          source: "database",
        })
      }
    })

    return mappings
  }, [formData.jsonData, formData.phases, formData.audioFiles])

  // Get video URL from either upload or direct URL input
  const getVideoUrl = () => {
    if (videoInputMode === "upload" && formData.videoFile) {
      return formData.videoFile.url
    }
    return formData.videoUrl.trim() || undefined
  }

  // Science Items handlers
  const handleAddScienceItem = () => {
    if (!newScienceItem.name.trim()) return

    const item: ScienceItem = {
      id: `temp-${Date.now()}`,
      ...newScienceItem,
    }

    setFormData((prev) => ({
      ...prev,
      scienceItems: [...prev.scienceItems, item],
    }))

    setNewScienceItem({ name: "", description: "", timestampsSec: [] })
    setNewTimestamp("")
  }

  const handleUpdateScienceItem = (id: string, updates: Partial<ScienceItem>) => {
    setFormData((prev) => ({
      ...prev,
      scienceItems: prev.scienceItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }))
  }

  const handleDeleteScienceItem = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      scienceItems: prev.scienceItems.filter((item) => item.id !== id),
    }))
    if (editingScienceItemId === id) {
      setEditingScienceItemId(null)
    }
  }

  const handleAddTimestamp = (itemId: string, timestamp: string) => {
    const num = parseFloat(timestamp)
    if (isNaN(num) || num < 0) return

    const item = formData.scienceItems.find((i) => i.id === itemId)
    if (!item) return

    if (!item.timestampsSec.includes(num)) {
      handleUpdateScienceItem(itemId, {
        timestampsSec: [...item.timestampsSec, num].sort((a, b) => a - b),
      })
    }
    setNewTimestamp("")
  }

  const handleRemoveTimestamp = (itemId: string, timestamp: number) => {
    const item = formData.scienceItems.find((i) => i.id === itemId)
    if (!item) return

    handleUpdateScienceItem(itemId, {
      timestampsSec: item.timestampsSec.filter((t) => t !== timestamp),
    })
  }

  const handleAddTimestampToNew = () => {
    const num = parseFloat(newTimestamp)
    if (isNaN(num) || num < 0) return

    if (!newScienceItem.timestampsSec.includes(num)) {
      setNewScienceItem((prev) => ({
        ...prev,
        timestampsSec: [...prev.timestampsSec, num].sort((a, b) => a - b),
      }))
    }
    setNewTimestamp("")
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

      // Build science items data for JSON if not using JSON upload
      const scienceItemsData = formData.jsonData
        ? undefined
        : formData.scienceItems.map((item, idx) => ({
            id: item.id.startsWith("temp-") ? `item-${idx}` : item.id,
            name: item.name,
            description: item.description,
            timestampsSec: item.timestampsSec,
            content: item.content || null,
          }))

      const response = await fetch(`/api/lessons/${lessonId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          jsonData: formData.jsonData,
          videoUrl: getVideoUrl(),
          audioUrls,
          scienceItems: scienceItemsData,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update lesson")
      }

      const lesson = await response.json()
      router.push(`/lessons/${lesson.id}`)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to update lesson")
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasValidVideo =
    videoInputMode === "upload"
      ? !!formData.videoFile
      : formData.videoUrl.trim().length > 0

  const isValid = formData.title && hasValidVideo

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <p>Loading lesson...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold">Edit Lesson</h1>

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
                    endpoint="videoUploader"
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
              endpoint="audioUploader"
              onClientUploadComplete={handleAudioUpload}
              onUploadError={(error) => {
                console.error("Audio upload error:", error)
              }}
            />
          </CardContent>
        </Card>

        {/* Audio-Phase Mappings */}
        {(getAudioPhaseMappings.length > 0 || formData.audioFiles.size > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileAudio className="size-5" />
                Audio-Phase Linkages
              </CardTitle>
              <CardDescription>
                View which commentary audio files are linked to which phases
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {getAudioPhaseMappings.length > 0 ? (
                <div className="space-y-3">
                  {getAudioPhaseMappings.map((mapping, idx) => (
                    <div
                      key={`${mapping.phaseId}-${idx}`}
                      className="rounded-lg border bg-muted/50 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-muted-foreground">
                              Phase:
                            </span>
                            <span className="font-semibold">{mapping.phaseTitle}</span>
                            {mapping.source === "json" && (
                              <span className="text-xs bg-blue-100 text-blue-700 border border-blue-200 rounded px-2 py-0.5">
                                From JSON
                              </span>
                            )}
                            {mapping.source === "database" && (
                              <span className="text-xs bg-purple-100 text-purple-700 border border-purple-200 rounded px-2 py-0.5">
                                From Database
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-muted-foreground">
                              Audio Reference:
                            </span>
                            <span className="font-mono text-sm bg-background border rounded px-2 py-1">
                              {mapping.audioRef}
                            </span>
                            {mapping.audioFile ? (
                              <span className="flex items-center gap-1 text-sm text-green-600">
                                <Check className="size-4" />
                                {mapping.audioFile.name}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-sm text-amber-600">
                                <X className="size-4" />
                                File not uploaded
                              </span>
                            )}
                          </div>
                          {mapping.triggerTime !== null && (
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-muted-foreground">
                                Trigger Time:
                              </span>
                              <span className="text-sm font-mono">
                                {mapping.triggerTime.toFixed(1)}s
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">
                    No audio files are currently linked to phases.
                  </p>
                  <p className="text-xs mt-2">
                    Upload audio files and ensure your JSON data includes audioOverlay
                    configurations, or phases already have audioAssetUrl set.
                  </p>
                </div>
              )}

              {/* Show unlinked audio files */}
              {formData.audioFiles.size > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">Unlinked Audio Files</h4>
                  <div className="space-y-2">
                    {Array.from(formData.audioFiles.entries())
                      .filter(
                        ([ref]) =>
                          !getAudioPhaseMappings.some((m) => m.audioRef === ref)
                      )
                      .map(([ref, file]) => (
                        <div
                          key={ref}
                          className="flex items-center gap-2 rounded-md border bg-background p-2 text-sm"
                        >
                          <span className="font-mono text-xs">{ref}</span>
                          <span className="text-muted-foreground">→</span>
                          <span>{file.name}</span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            Not linked to any phase
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Science Corner Items */}
        <Card>
          <CardHeader>
            <CardTitle>Science Corner Items</CardTitle>
            <CardDescription>
              {formData.jsonData
                ? "JSON file is loaded. Science items will be updated from JSON on save. Remove JSON to edit manually."
                : "Manage science corner entries that appear during the video. Add timestamps where each item should be triggered."}
            </CardDescription>
          </CardHeader>
          <CardContent className={cn("space-y-4", formData.jsonData && "opacity-60 pointer-events-none")}>
            {/* Existing Science Items */}
            {formData.scienceItems.length > 0 && (
              <div className="space-y-3">
                {formData.scienceItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border bg-muted/50 p-4 space-y-3"
                  >
                    {editingScienceItemId === item.id ? (
                      <div className="space-y-4">
                        {/* Basic Info */}
                        <div className="space-y-3 border-b pb-4">
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                              value={item.name}
                              onChange={(e) =>
                                handleUpdateScienceItem(item.id, { name: e.target.value })
                              }
                              placeholder="Science item name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                              value={item.description}
                              onChange={(e) =>
                                handleUpdateScienceItem(item.id, {
                                  description: e.target.value,
                                })
                              }
                              placeholder="Description"
                              rows={2}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Timestamps (seconds)</Label>
                            <div className="flex flex-wrap gap-2">
                              {item.timestampsSec.map((ts) => (
                                <div
                                  key={ts}
                                  className="flex items-center gap-1 rounded-md bg-background border px-2 py-1 text-sm"
                                >
                                  <span>{ts}s</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0"
                                    onClick={() => handleRemoveTimestamp(item.id, ts)}
                                  >
                                    <X className="size-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                value={newTimestamp}
                                onChange={(e) => setNewTimestamp(e.target.value)}
                                placeholder="Add timestamp (seconds)"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault()
                                    handleAddTimestamp(item.id, newTimestamp)
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleAddTimestamp(item.id, newTimestamp)}
                              >
                                <Plus className="size-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Structured Content */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-base font-semibold">
                              Structured Content
                            </Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const currentContent = item.content || {}
                                handleUpdateScienceItem(item.id, {
                                  content: {
                                    ...currentContent,
                                    title: currentContent.title || "",
                                    subtitle: currentContent.subtitle || "",
                                    sections: currentContent.sections || [],
                                    references: currentContent.references || [],
                                  },
                                })
                              }}
                            >
                              <Plus className="mr-2 size-4" />
                              Initialize Content
                            </Button>
                          </div>

                          {item.content && (
                            <div className="space-y-4 rounded-lg border bg-background p-4">
                              {/* Title */}
                              <div className="space-y-2">
                                <Label>Title (e.g., "#1 Symptoms as Competence")</Label>
                                <Input
                                  value={item.content.title || ""}
                                  onChange={(e) =>
                                    handleUpdateScienceItem(item.id, {
                                      content: {
                                        ...item.content,
                                        title: e.target.value,
                                      },
                                    })
                                  }
                                  placeholder="#1 Title"
                                />
                              </div>

                              {/* Subtitle */}
                              <div className="space-y-2">
                                <Label>Subtitle</Label>
                                <Input
                                  value={item.content.subtitle || ""}
                                  onChange={(e) =>
                                    handleUpdateScienceItem(item.id, {
                                      content: {
                                        ...item.content,
                                        subtitle: e.target.value,
                                      },
                                    })
                                  }
                                  placeholder="Why Symptoms Make Sense..."
                                />
                              </div>

                              {/* Sections */}
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <Label>Sections</Label>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const sections = item.content?.sections || []
                                      handleUpdateScienceItem(item.id, {
                                        content: {
                                          ...item.content,
                                          sections: [
                                            ...sections,
                                            { heading: "", content: "" },
                                          ],
                                        },
                                      })
                                    }}
                                  >
                                    <Plus className="mr-2 size-4" />
                                    Add Section
                                  </Button>
                                </div>
                                {item.content.sections?.map((section, sectionIdx) => {
                                  const scienceItemId = item.id
                                  const scienceItemContent = item.content
                                  return (
                                    <div
                                      key={sectionIdx}
                                      className="rounded-lg border bg-muted/50 p-3 space-y-3"
                                    >
                                      <div className="flex items-center justify-between">
                                        <Label className="text-sm">
                                          Section {sectionIdx + 1}
                                        </Label>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const sections = scienceItemContent?.sections || []
                                            handleUpdateScienceItem(scienceItemId, {
                                              content: {
                                                ...scienceItemContent,
                                                sections: sections.filter(
                                                  (_, i) => i !== sectionIdx
                                                ),
                                              },
                                            })
                                          }}
                                        >
                                          <Trash className="size-4" />
                                        </Button>
                                      </div>
                                      <Input
                                        value={section.heading}
                                        onChange={(e) => {
                                          const sections = scienceItemContent?.sections || []
                                          sections[sectionIdx] = {
                                            ...section,
                                            heading: e.target.value,
                                          }
                                          handleUpdateScienceItem(scienceItemId, {
                                            content: {
                                              ...scienceItemContent,
                                              sections: [...sections],
                                            },
                                          })
                                        }}
                                        placeholder="Section heading"
                                      />
                                      <Textarea
                                        value={section.content || ""}
                                        onChange={(e) => {
                                          const sections = scienceItemContent?.sections || []
                                          sections[sectionIdx] = {
                                            ...section,
                                            content: e.target.value,
                                          }
                                          handleUpdateScienceItem(scienceItemId, {
                                            content: {
                                              ...scienceItemContent,
                                              sections: [...sections],
                                            },
                                          })
                                        }}
                                        placeholder="Section content"
                                        rows={3}
                                      />
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <Label className="text-xs">Items (numbered list)</Label>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              const sections = scienceItemContent?.sections || []
                                              const currentItems = sections[sectionIdx]?.items || []
                                              sections[sectionIdx] = {
                                                ...sections[sectionIdx],
                                                items: [...currentItems, { text: "" }],
                                              }
                                              handleUpdateScienceItem(scienceItemId, {
                                                content: {
                                                  ...scienceItemContent,
                                                  sections: [...sections],
                                                },
                                              })
                                            }}
                                          >
                                            <Plus className="mr-1 size-3" />
                                            Add Item
                                          </Button>
                                        </div>
                                        {section.items?.map((listItem, itemIdx) => (
                                          <div
                                            key={itemIdx}
                                            className="space-y-2 rounded border bg-background p-2"
                                          >
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs font-mono text-muted-foreground">
                                                {itemIdx + 1}.
                                              </span>
                                              <Input
                                                value={listItem.text}
                                                onChange={(e) => {
                                                  const sections = scienceItemContent?.sections || []
                                                  const items = sections[sectionIdx]?.items || []
                                                  items[itemIdx] = {
                                                    ...items[itemIdx],
                                                    text: e.target.value,
                                                  }
                                                  sections[sectionIdx] = {
                                                    ...sections[sectionIdx],
                                                    items: [...items],
                                                  }
                                                  handleUpdateScienceItem(scienceItemId, {
                                                    content: {
                                                      ...scienceItemContent,
                                                      sections: [...sections],
                                                    },
                                                  })
                                                }}
                                                placeholder="Item text"
                                                className="flex-1"
                                              />
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                  const sections = scienceItemContent?.sections || []
                                                  const items = sections[sectionIdx]?.items || []
                                                  sections[sectionIdx] = {
                                                    ...sections[sectionIdx],
                                                    items: items.filter((_, i) => i !== itemIdx),
                                                  }
                                                  handleUpdateScienceItem(scienceItemId, {
                                                    content: {
                                                      ...scienceItemContent,
                                                      sections: [...sections],
                                                    },
                                                  })
                                                }}
                                              >
                                                <X className="size-3" />
                                              </Button>
                                            </div>
                                            {/* Sub-items */}
                                            {listItem.subItems && listItem.subItems.length > 0 && (
                                              <div className="ml-6 space-y-1">
                                                {listItem.subItems.map((subItem, subIdx) => (
                                                  <div
                                                    key={subIdx}
                                                    className="flex items-center gap-2"
                                                  >
                                                    <span className="text-xs">•</span>
                                                    <Input
                                                      value={subItem}
                                                      onChange={(e) => {
                                                        const sections = scienceItemContent?.sections || []
                                                        const items = sections[sectionIdx]?.items || []
                                                        const subItems = items[itemIdx]?.subItems || []
                                                        subItems[subIdx] = e.target.value
                                                        items[itemIdx] = {
                                                          ...items[itemIdx],
                                                          subItems: [...subItems],
                                                        }
                                                        sections[sectionIdx] = {
                                                          ...sections[sectionIdx],
                                                          items: [...items],
                                                        }
                                                        handleUpdateScienceItem(scienceItemId, {
                                                          content: {
                                                            ...scienceItemContent,
                                                            sections: [...sections],
                                                          },
                                                        })
                                                      }}
                                                      placeholder="Sub-item"
                                                      className="flex-1 text-sm"
                                                    />
                                                    <Button
                                                      type="button"
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() => {
                                                        const sections = scienceItemContent?.sections || []
                                                        const items = sections[sectionIdx]?.items || []
                                                        const subItems = items[itemIdx]?.subItems || []
                                                        items[itemIdx] = {
                                                          ...items[itemIdx],
                                                          subItems: subItems.filter(
                                                            (_, i) => i !== subIdx
                                                          ),
                                                        }
                                                        sections[sectionIdx] = {
                                                          ...sections[sectionIdx],
                                                          items: [...items],
                                                        }
                                                        handleUpdateScienceItem(scienceItemId, {
                                                          content: {
                                                            ...scienceItemContent,
                                                            sections: [...sections],
                                                          },
                                                        })
                                                      }}
                                                    >
                                                      <X className="size-3" />
                                                    </Button>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="ml-6 text-xs"
                                              onClick={() => {
                                                const sections = scienceItemContent?.sections || []
                                                const items = sections[sectionIdx]?.items || []
                                                const subItems = items[itemIdx]?.subItems || []
                                                items[itemIdx] = {
                                                  ...items[itemIdx],
                                                  subItems: [...(subItems || []), ""],
                                                }
                                                sections[sectionIdx] = {
                                                  ...sections[sectionIdx],
                                                  items: [...items],
                                                }
                                                handleUpdateScienceItem(scienceItemId, {
                                                  content: {
                                                    ...scienceItemContent,
                                                    sections: [...sections],
                                                  },
                                                })
                                              }}
                                            >
                                              <Plus className="mr-1 size-3" />
                                              Add Sub-item
                                            </Button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>

                              {/* References */}
                              <div className="space-y-3 border-t pt-3">
                                <div className="flex items-center justify-between">
                                  <Label>References</Label>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const references = item.content?.references || []
                                      handleUpdateScienceItem(item.id, {
                                        content: {
                                          ...item.content,
                                          references: [...references, { text: "" }],
                                        },
                                      })
                                    }}
                                  >
                                    <Plus className="mr-2 size-4" />
                                    Add Reference
                                  </Button>
                                </div>
                                {item.content.references?.map((ref, refIdx) => (
                                  <div
                                    key={refIdx}
                                    className="flex gap-2 rounded-lg border bg-muted/50 p-3"
                                  >
                                    <div className="flex-1 space-y-2">
                                      <Input
                                        value={ref.text}
                                        onChange={(e) => {
                                          const references = item.content?.references || []
                                          references[refIdx] = {
                                            ...references[refIdx],
                                            text: e.target.value,
                                          }
                                          handleUpdateScienceItem(item.id, {
                                            content: {
                                              ...item.content,
                                              references: [...references],
                                            },
                                          })
                                        }}
                                        placeholder="Reference text (e.g., Author, Title, URL)"
                                      />
                                      <Input
                                        type="url"
                                        value={ref.url || ""}
                                        onChange={(e) => {
                                          const references = item.content?.references || []
                                          references[refIdx] = {
                                            ...references[refIdx],
                                            url: e.target.value,
                                          }
                                          handleUpdateScienceItem(item.id, {
                                            content: {
                                              ...item.content,
                                              references: [...references],
                                            },
                                          })
                                        }}
                                        placeholder="URL (optional)"
                                      />
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const references = item.content?.references || []
                                        handleUpdateScienceItem(item.id, {
                                          content: {
                                            ...item.content,
                                            references: references.filter(
                                              (_, i) => i !== refIdx
                                            ),
                                          },
                                        })
                                      }}
                                    >
                                      <Trash className="size-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex justify-end gap-2 border-t pt-4">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingScienceItemId(null)}
                          >
                            Done
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{item.name}</p>
                            {item.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {item.description}
                              </p>
                            )}
                            {item.timestampsSec.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {item.timestampsSec.map((ts) => (
                                  <span
                                    key={ts}
                                    className="text-xs bg-background border rounded px-2 py-0.5"
                                  >
                                    {ts}s
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingScienceItemId(item.id)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteScienceItem(item.id)}
                            >
                              <Trash className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add New Science Item */}
            <div className="rounded-lg border border-dashed p-4 space-y-3">
              <Label className="text-sm font-medium">Add New Science Item</Label>
              <div className="space-y-2">
                <Input
                  value={newScienceItem.name}
                  onChange={(e) =>
                    setNewScienceItem((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Science item name"
                />
                <Textarea
                  value={newScienceItem.description}
                  onChange={(e) =>
                    setNewScienceItem((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Description"
                  rows={2}
                />
                <div className="space-y-2">
                  <Label className="text-xs">Timestamps (seconds)</Label>
                  {newScienceItem.timestampsSec.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {newScienceItem.timestampsSec.map((ts) => (
                        <div
                          key={ts}
                          className="flex items-center gap-1 rounded-md bg-muted border px-2 py-1 text-sm"
                        >
                          <span>{ts}s</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0"
                            onClick={() =>
                              setNewScienceItem((prev) => ({
                                ...prev,
                                timestampsSec: prev.timestampsSec.filter((t) => t !== ts),
                              }))
                            }
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={newTimestamp}
                      onChange={(e) => setNewTimestamp(e.target.value)}
                      placeholder="Add timestamp (seconds)"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleAddTimestampToNew()
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddTimestampToNew}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddScienceItem}
                  disabled={!newScienceItem.name.trim()}
                  className="w-full"
                >
                  <Plus className="mr-2 size-4" />
                  Add Science Item
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* JSON Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJs className="size-5" />
              Lesson Content (JSON) - Optional
            </CardTitle>
            <CardDescription>
              Upload a new lesson content JSON file to update phases, interventions,
              and science items. Leave blank to keep existing content.
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
                  onClick={async () => {
                    // Reload science items and phases from server when JSON is removed
                    try {
                      const response = await fetch(`/api/lessons/${lessonId}`)
                      if (response.ok) {
                        const lesson = await response.json()
                        setFormData((prev) => ({
                          ...prev,
                          jsonData: null,
                          jsonError: null,
                          scienceItems: lesson.scienceItems || [],
                          phases: lesson.phases || [],
                        }))
                      } else {
                        setFormData((prev) => ({
                          ...prev,
                          jsonData: null,
                          jsonError: null,
                        }))
                      }
                    } catch {
                      setFormData((prev) => ({
                        ...prev,
                        jsonData: null,
                        jsonError: null,
                      }))
                    }
                  }}
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
                Updating Lesson...
              </>
            ) : (
              <>
                <Check className="mr-2 size-4" />
                Update Lesson
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
