"use client"

import * as React from "react"

import {
  VideoPlayerProvider,
  type LessonData,
} from "~/lib/contexts/video-player-context"

// Sample data for demo mode
const DEMO_LESSON: LessonData = {
  id: "demo",
  title: "Demo Lesson: Introduction to Coaching",
  description: "A sample lesson demonstrating the video learning platform",
  videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  duration: 596,
  phases: [
    {
      id: "phase-1",
      title: "Phase 1: Opening & Orientation",
      description: "Initial framing and context setting for the coaching session",
      startTimeSec: 0,
      endTimeSec: 120,
      audioAssetUrl: null,
      audioTriggerTime: null,
      interventions: [
        {
          id: "int-1-1",
          title: "Intervention 1.1: Model-Based Self-Localization",
          timestampSec: 15,
          prompt: "What is your center of gravity?",
          description:
            "Tony invites the coachee to locate their current state within a model of development stages.",
          methodModelFramework: "Center of Gravity Mapping",
          function: "Cognitive anchoring",
          scientificReferenceFields: ["Cognitive Psychology", "Metacognition"],
        },
        {
          id: "int-1-2",
          title: "Intervention 1.2: Perspective Taking",
          timestampSec: 60,
          prompt: "How would you describe this from the outside?",
          description:
            "Tony guides the coachee to observe their situation from a third-person perspective.",
          methodModelFramework: "Self-Distancing",
          function: "Emotional regulation",
          scientificReferenceFields: ["Social Psychology", "Emotional Intelligence"],
        },
      ],
    },
    {
      id: "phase-2",
      title: "Phase 2: Exploration & Discovery",
      description: "Deep dive into the core issues and patterns",
      startTimeSec: 120,
      endTimeSec: 300,
      audioAssetUrl: null,
      audioTriggerTime: null,
      interventions: [
        {
          id: "int-2-1",
          title: "Intervention 2.1: Pattern Recognition",
          timestampSec: 150,
          prompt: "What patterns do you notice?",
          description: "Identifying recurring themes and behaviors in the coachee's experience.",
          methodModelFramework: "Systems Thinking",
          function: "Pattern awareness",
          scientificReferenceFields: ["Systems Theory", "Behavioral Psychology"],
        },
      ],
    },
    {
      id: "phase-3",
      title: "Phase 3: Integration & Closure",
      description: "Synthesizing insights and planning next steps",
      startTimeSec: 300,
      endTimeSec: 596,
      audioAssetUrl: null,
      audioTriggerTime: null,
      interventions: [
        {
          id: "int-3-1",
          title: "Intervention 3.1: Commitment Elicitation",
          timestampSec: 450,
          prompt: "What will you do differently?",
          description: "Guiding the coachee to make specific commitments for change.",
          methodModelFramework: "Action Planning",
          function: "Behavioral change",
          scientificReferenceFields: ["Motivational Psychology", "Goal Setting Theory"],
        },
      ],
    },
  ],
  scienceItems: [
    {
      id: "sci-1",
      name: "Cognitive Self-Distancing",
      description:
        "Self-distancing is a psychological strategy that involves creating mental separation between oneself and a situation. Research shows it can reduce emotional reactivity and improve decision-making by enabling a more objective perspective.",
      timestampsSec: [30, 180],
    },
    {
      id: "sci-2",
      name: "Metacognition in Coaching",
      description:
        "Metacognition refers to awareness and understanding of one's own thought processes. In coaching contexts, developing metacognitive skills helps clients recognize patterns in their thinking and make more intentional choices.",
      timestampsSec: [90],
    },
    {
      id: "sci-3",
      name: "Systems Thinking Approach",
      description:
        "Systems thinking is an approach that views problems as parts of an interconnected whole. It helps identify feedback loops and unintended consequences that might not be visible when examining components in isolation.",
      timestampsSec: [200],
    },
  ],
  comments: [
    {
      id: "comment-1",
      content: "Great explanation of the self-distancing technique!",
      timestamp: 45,
      authorName: "User A",
      createdAt: new Date().toISOString(),
    },
    {
      id: "comment-2",
      content: "This connects well to the earlier discussion about metacognition.",
      timestamp: 120,
      authorName: "User B",
      createdAt: new Date().toISOString(),
    },
    {
      id: "comment-3",
      content: "The pattern recognition approach is really powerful here.",
      timestamp: 180,
      authorName: "User A",
      createdAt: new Date().toISOString(),
    },
  ],
}

interface LessonClientWrapperProps {
  children: React.ReactNode
  lesson?: LessonData
}

function LessonClientWrapper({ children, lesson }: LessonClientWrapperProps) {
  // Use demo data if no lesson provided
  const lessonData = lesson ?? DEMO_LESSON

  return (
    <VideoPlayerProvider lesson={lessonData}>{children}</VideoPlayerProvider>
  )
}

export { LessonClientWrapper }
