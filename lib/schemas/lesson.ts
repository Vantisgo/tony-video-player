import { z } from "zod"
import { PhaseSchema } from "./phase"
import { ScienceItemSchema } from "./science"

/**
 * Video Configuration Schema
 */
export const VideoConfigSchema = z.object({
  url: z.string().url(),
  duration: z.number().positive(),
})

export type VideoConfig = z.infer<typeof VideoConfigSchema>

/**
 * Lesson JSON Schema
 * Top-level schema for JSON content uploads
 * Matches the JSON contract from the spec (section 12)
 */
export const LessonJSONSchema = z.object({
  contentId: z.string().min(1),
  language: z.literal("en"),
  video: VideoConfigSchema,
  phases: z.array(PhaseSchema).min(1),
  scienceCornerItems: z.array(ScienceItemSchema),
})

export type LessonJSON = z.infer<typeof LessonJSONSchema>

/**
 * Lesson Schema for database records
 * Extended version with metadata
 */
export const LessonSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string(),
  videoUrl: z.string().url(),
  duration: z.number().positive(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type Lesson = z.infer<typeof LessonSchema>

/**
 * Create Lesson Input Schema
 * For creating a new lesson from uploaded JSON
 */
export const CreateLessonInputSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  jsonData: LessonJSONSchema,
  videoUrl: z.string().url(),
  audioUrls: z.record(z.string(), z.string().url()).optional(),
})

export type CreateLessonInput = z.infer<typeof CreateLessonInputSchema>
