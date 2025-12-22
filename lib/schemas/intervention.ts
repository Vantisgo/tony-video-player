import { z } from "zod"

/**
 * Intervention Schema
 * Represents a coaching intervention within a phase
 */
export const InterventionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  timestampSec: z.number().min(0),
  prompt: z.string(),
  description: z.string(),
  methodModelFramework: z.string(),
  function: z.string(),
  scientificReferenceFields: z.array(z.string()),
})

export type Intervention = z.infer<typeof InterventionSchema>
