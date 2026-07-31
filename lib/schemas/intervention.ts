import { z } from "zod"

/**
 * Intervention Schema
 * Represents a coaching intervention within a phase
 */
export const InterventionSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    timestampSec: z.number().min(0),
    endTimeSec: z.number().min(0).nullish(),
    prompt: z.string(),
    description: z.string(),
    methodModelFramework: z.string(),
    function: z.string(),
    scientificReferenceFields: z.array(z.string()),
  })
  .refine(
    ({ timestampSec, endTimeSec }) =>
      endTimeSec == null || endTimeSec >= timestampSec,
    {
      message: "End time must not be before start time",
      path: ["endTimeSec"],
    }
  )

export type Intervention = z.infer<typeof InterventionSchema>
