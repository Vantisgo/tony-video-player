import { z } from "zod"

/**
 * Science Content Section Schema
 * A section within a science item with heading, content, and optional items
 */
export const ScienceContentSectionSchema = z.object({
  heading: z.string().min(1),
  content: z.string().optional(),
  items: z
    .array(
      z.object({
        text: z.string(),
        subItems: z.array(z.string()).optional(),
      })
    )
    .optional(),
})

/**
 * Science Reference Schema
 * A scientific reference/citation
 */
export const ScienceReferenceSchema = z.object({
  text: z.string().min(1),
  url: z.string().url().optional(),
})

/**
 * Structured Science Content Schema
 * Rich structured content for science items
 */
export const ScienceContentSchema = z.object({
  title: z.string().optional(), // e.g., "#1 Symptoms as Competence"
  subtitle: z.string().optional(), // e.g., "Why Symptoms Make Sense..."
  sections: z.array(ScienceContentSectionSchema).optional(),
  references: z.array(ScienceReferenceSchema).optional(),
})

/**
 * Science Corner Item Schema
 * Scientific/explanatory content linked to video overlays
 */
export const ScienceItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  timestampsSec: z.array(z.number().min(0)),
  content: ScienceContentSchema.optional(),
})

export type ScienceItem = z.infer<typeof ScienceItemSchema>
export type ScienceContent = z.infer<typeof ScienceContentSchema>
export type ScienceContentSection = z.infer<typeof ScienceContentSectionSchema>
export type ScienceReference = z.infer<typeof ScienceReferenceSchema>
