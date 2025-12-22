import { z } from "zod"
import { InterventionSchema } from "./intervention"

/**
 * Phase Audio Overlay Schema
 * Each phase has exactly one audio overlay
 */
export const PhaseAudioOverlaySchema = z.object({
  audioAssetRef: z.string().min(1),
  triggerTimeSec: z.number().min(0),
})

export type PhaseAudioOverlay = z.infer<typeof PhaseAudioOverlaySchema>

/**
 * Phase Schema
 * Represents a coaching phase (chapter) with interventions
 */
export const PhaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  startTimeSec: z.number().min(0),
  endTimeSec: z.number().min(0).optional(),
  audioOverlay: PhaseAudioOverlaySchema,
  interventions: z.array(InterventionSchema),
})

export type Phase = z.infer<typeof PhaseSchema>
