// Meta Structure: 7 Master Steps of Creating Lasting Change

export interface MetaStep {
  id: string
  number: number
  title: string
  timestampSec: number
  description?: string
}

export const META_STEPS: MetaStep[] = [
  {
    id: "meta-step-1",
    number: 1,
    title: "Connect: Understand and Appreciate Their World",
    timestampSec: 30, // 0:30
  },
  {
    id: "meta-step-2",
    number: 2,
    title: "Connect & Get Leverage: Make Change a Must",
    timestampSec: 120, // 2:00
  },
  {
    id: "meta-step-3",
    number: 3,
    title: "Interrupt & Annihilate Limiting Patterns (Triad)",
    timestampSec: 360, // 6:00
  },
  {
    id: "meta-step-4",
    number: 4,
    title: "Define the Problem in Solvable Terms",
    timestampSec: 960, // 16:00
  },
  {
    id: "meta-step-5",
    number: 5,
    title: "Access Empowering Resources & Make the Change",
    timestampSec: 1200, // 20:00
  },
  {
    id: "meta-step-6",
    number: 6,
    title: "Condition the Change (Habit & Identity)",
    timestampSec: 2040, // 34:00
  },
  {
    id: "meta-step-7",
    number: 7,
    title: "Test, Ecology, Higher Purpose & Environment",
    timestampSec: 3120, // 52:00
  },
]
