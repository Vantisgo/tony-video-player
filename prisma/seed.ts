import prisma from "./prisma"

async function main() {
  console.log("Seeding database...")

  // Delete existing data
  await prisma.comment.deleteMany()
  await prisma.intervention.deleteMany()
  await prisma.scienceItem.deleteMany()
  await prisma.phase.deleteMany()
  await prisma.lesson.deleteMany()

  // =======================================================================
  // MEDIA FILES CONFIGURATION
  // =======================================================================
  const MEDIA = {
    video: "/uploads/videos/1 Coaching von Toniklein.mp4",
    audio: {
      intro: "/uploads/audio/2025-12-22 at 00.22.27 Intro.mp3",
      phase1: "/uploads/audio/2025-12-22 at 00.50.40 Voiceover Phase 1.mp3",
      phase2: "/uploads/audio/2025-12-22 at 01.06.59 Voiceover phase 2.mp3",
      phase3: "/uploads/audio/2025-12-22 at 01.12.26 Voiceover Phase 3.mp3",
      phase4: "/uploads/audio/2025-12-22 at 01.17.45 Voiceover Phase 4.mp3",
      phase5: "/uploads/audio/2025-12-22 at 01.25.16 Voiceover Phase 5.mp3",
      phase6: "/uploads/audio/2025-12-22 at 01.33.11 Voiceover Phase 6.mp3",
      phase7: "/uploads/audio/2025-12-22 at 01.37.55 Voiceover Phase 7.mp3",
      phase8: "/uploads/audio/2025-12-22 at 02.03.58 Voiceover Phase 8.mp3",
      phase9: "/uploads/audio/2025-12-22 at 02.08.40 Voiceopver Phase 9.mp3",
      phase10: "/uploads/audio/2025-12-22 at 02.10.36 Voiceover Phase 10.mp3",
      phase11: "/uploads/audio/2025-12-22 at 02.12.41 Voiceover Phase 11.mp3",
    },
  }

  // Helper to convert mm:ss to seconds
  const toSec = (time: string) => {
    const parts = time.split(":").map(Number)
    if (parts.length === 2) return parts[0] * 60 + parts[1]
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }

  // Create the lesson
  const lesson = await prisma.lesson.create({
    data: {
      title: "Tony Robbins: Panic Pattern Coaching Session",
      description:
        "Tony brings the coachee into the framework of the 8 Levels of Consciousness and helps her understand and transform her panic pattern through structured interventions.",
      videoUrl: MEDIA.video,
      duration: 5882, // ~1h 38min
      introAudioUrl: MEDIA.audio.intro,

      phases: {
        create: [
          // ===================================================================
          // PHASE 1: Introduction and Positioning in Model (00:33 - 02:10)
          // ===================================================================
          {
            title: "Phase 1: Introduction and Positioning in Model",
            description:
              "Tony brings the coachee into the framework of the 8 Levels of Consciousness and asks her to place herself within it.",
            startTime: 33, // 00:33
            endTime: 130, // 02:10
            sortOrder: 0,
            audioAssetUrl: MEDIA.audio.phase1,
            audioTriggerTime: 130,
            interventions: {
              create: [
                {
                  title: "Intervention 1.1: Model-Based Self-Localization",
                  timestampSec: 47, // 00:00:47
                  prompt: "What is your center of gravity?",
                  description: "Tony invites the coachee to locate her lived experience within a pre-existing conceptual model.",
                  methodModelFramework: "Center of Gravity Mapping",
                  function: "Cognitive anchoring",
                  scientificReferenceFields: ["Cognitive Psychology", "Metacognition"],
                  sortOrder: 0,
                },
                {
                  title: "Intervention 1.2: Playful Inconsistency Highlighting",
                  timestampSec: 73, // 00:01:13
                  prompt: "Either beige or yellow. That's quite a broad stroke.",
                  description: "Humor as status-preserving contradiction",
                  methodModelFramework: "Humor framing",
                  function: "Soft contradiction without threat",
                  scientificReferenceFields: ["Social Psychology", "Cognitive Dissonance Theory"],
                  sortOrder: 1,
                },
                {
                  title: "Intervention 1.3: Audience-Directed Meta-Framing",
                  timestampSec: 91, // 00:01:31
                  prompt: "[Addressing the audience about the process]",
                  description: "Externalizes the intervention to reduce resistance",
                  methodModelFramework: "Making a distinction",
                  function: "Resistance reduction",
                  scientificReferenceFields: ["Cognitive Linguistics", "Psycholinguistics"],
                  sortOrder: 2,
                },
                {
                  title: "Intervention 1.4: Metaphor Deconstruction",
                  timestampSec: 91, // 00:01:31
                  prompt: "People use metaphors all the time.",
                  description: "Separates metaphorical language from literal physiological reality",
                  methodModelFramework: "Deconstruction of Global Metaphor",
                  function: "Semantic precision",
                  scientificReferenceFields: ["Conceptual Metaphor Theory", "CBT"],
                  sortOrder: 3,
                },
                {
                  title: "Intervention 1.5: State Interruption with Agency Reframing",
                  timestampSec: 125, // 00:02:05
                  prompt: "We're gonna solve that real quick then.",
                  description: "Directive verbal frame with ease presupposition",
                  methodModelFramework: "Pattern interrupt",
                  function: "Somatic and cognitive pattern break",
                  scientificReferenceFields: ["Affective Neuroscience", "Somatic Psychology"],
                  sortOrder: 4,
                },
              ],
            },
          },

          // ===================================================================
          // PHASE 2: From Symptom Story to Process Control (02:10 - 03:39)
          // ===================================================================
          {
            title: "Phase 2: From Symptom Story to Process Control",
            description:
              "Tony helps her notice what she is doing internally - how she breathes, what she focuses on, and how the state builds.",
            startTime: 130, // 02:10
            endTime: 219, // 03:39
            sortOrder: 1,
            audioAssetUrl: MEDIA.audio.phase2,
            audioTriggerTime: 219,
            interventions: {
              create: [
                {
                  title: "Intervention 2.1: Rapport and Emotional Safety",
                  timestampSec: 135, // 00:02:15
                  prompt: "Okay (with laughter, smile, eye contact)",
                  description: "Co-regulation through nonverbal attunement",
                  methodModelFramework: "Rapport building",
                  function: "Emotional stabilization",
                  scientificReferenceFields: ["Affective Neuroscience", "Polyvagal Theory"],
                  sortOrder: 0,
                },
                {
                  title: "Intervention 2.2: Testing the Pattern",
                  timestampSec: 135, // 00:02:15
                  prompt: "Do your panic disorder for me.",
                  description: "Diagnostic probing and re-entry priming",
                  methodModelFramework: "NAC pattern analysis",
                  function: "Diagnostic assessment",
                  scientificReferenceFields: ["Exposure-based assessment", "Behavioral analysis"],
                  sortOrder: 1,
                },
                {
                  title: "Intervention 2.3: You Create the Pattern",
                  timestampSec: 158, // 00:02:38
                  prompt: "To feel, you have to do things.",
                  description: "Reframes symptom as actively created",
                  methodModelFramework: "NAC agency frame",
                  function: "Restoration of agency",
                  scientificReferenceFields: ["CBT", "Enactive Cognition"],
                  sortOrder: 2,
                },
                {
                  title: "Intervention 2.4: Interoceptive Pattern Decoding",
                  timestampSec: 175, // 00:02:55
                  prompt: "It's her breathing, it's the biggest piece.",
                  description: "Identifies breathing as primary component",
                  methodModelFramework: "Physiology-first intervention",
                  function: "Making unconscious processes conscious",
                  scientificReferenceFields: ["Interoception Research", "Panic Physiology"],
                  sortOrder: 3,
                },
                {
                  title: "Intervention 2.5: Total Responsibility Without Guilt",
                  timestampSec: 188, // 00:03:08
                  prompt: "She uses external trigger to do something with her body.",
                  description: "Assigns responsibility while avoiding blame",
                  methodModelFramework: "Cause-effect reframing",
                  function: "Ownership without guilt",
                  scientificReferenceFields: ["Attribution Theory", "Trauma-Informed Psychology"],
                  sortOrder: 4,
                },
                {
                  title: "Intervention 2.6: Competence-Based Future Pacing",
                  timestampSec: 188, // 00:03:08
                  prompt: "She knows how to get out of it as well.",
                  description: "Highlights existing ability to exit panic state",
                  methodModelFramework: "Future pacing within NAC",
                  function: "Strengthening self-efficacy",
                  scientificReferenceFields: ["Self-Efficacy Theory", "Solution-Focused Therapy"],
                  sortOrder: 5,
                },
              ],
            },
          },

          // ===================================================================
          // PHASE 3: Interoceptive Decoding (03:39 - 09:13)
          // ===================================================================
          {
            title: "Phase 3: Interoceptive Decoding and Implicit Need Identification",
            description:
              "Tony connects the panic pattern to an underlying need being met through the symptom.",
            startTime: 219, // 03:39
            endTime: 553, // 09:13
            sortOrder: 2,
            audioAssetUrl: MEDIA.audio.phase3,
            audioTriggerTime: 553,
            interventions: {
              create: [
                {
                  title: "Intervention 3.1: Symptom as Action (Need Frame)",
                  timestampSec: 206, // 00:03:26
                  prompt: "What do you get out of being panicked?",
                  description: "Links symptom to benefit",
                  methodModelFramework: "Six Human Needs",
                  function: "Identifying implicit benefit",
                  scientificReferenceFields: ["Motivational Psychology", "Functional Analysis"],
                  sortOrder: 0,
                },
                {
                  title: "Intervention 3.2: Perspective Shift",
                  timestampSec: 227, // 00:03:47
                  prompt: "Be Tony Robbins for a second and I'll be you.",
                  description: "Role reversal creates psychological distance",
                  methodModelFramework: "Perspective shift",
                  function: "Disrupting self-identification",
                  scientificReferenceFields: ["Systemic Therapy", "Embodied Cognition"],
                  sortOrder: 1,
                },
                {
                  title: "Intervention 3.3: Six Human Needs Mapping",
                  timestampSec: 287, // 00:04:47
                  prompt: "[Guided exploration of six needs]",
                  description: "Identifies which need is being met",
                  methodModelFramework: "Six Human Needs assessment",
                  function: "Motivational driver identification",
                  scientificReferenceFields: ["Needs-based theories", "Humanistic Psychology"],
                  sortOrder: 2,
                },
                {
                  title: "Intervention 3.4: Positive State Induction",
                  timestampSec: 376, // 00:06:16
                  prompt: "You know how to celebrate, don't you?",
                  description: "Activates resourceful state",
                  methodModelFramework: "State change",
                  function: "Expanding emotional range",
                  scientificReferenceFields: ["Positive Affect", "Broaden-and-Build Theory"],
                  sortOrder: 3,
                },
                {
                  title: "Intervention 3.5: Balancing Emotional Certainty",
                  timestampSec: 405, // 00:06:45
                  prompt: "Are you as certain about that as panic?",
                  description: "Compares intensity of panic and positive states",
                  methodModelFramework: "Comparative state evaluation",
                  function: "Reducing panic dominance",
                  scientificReferenceFields: ["Cognitive Appraisal", "Attentional Bias"],
                  sortOrder: 4,
                },
                {
                  title: "Intervention 3.6: Positive Feedback and Social Reinforcement",
                  timestampSec: 442, // 00:07:22
                  prompt: "I love your honesty. Give her a hand.",
                  description: "Amplifies positive state through social validation",
                  methodModelFramework: "Social reinforcement",
                  function: "Strengthening alliance",
                  scientificReferenceFields: ["Social Reinforcement", "Attachment Research"],
                  sortOrder: 5,
                },
                {
                  title: "Intervention 3.7: Five Elements Mapping",
                  timestampSec: 459, // 00:07:39
                  prompt: "Wood, fire, earth, metal, or water?",
                  description: "Identifies dominant energetic expression style",
                  methodModelFramework: "Five Elements model",
                  function: "Integrating emotional extremes",
                  scientificReferenceFields: ["Psychophysiological Typologies", "Arousal Regulation"],
                  sortOrder: 6,
                },
              ],
            },
          },

          // ===================================================================
          // PHASES 4-11: Placeholder phases with interventions
          // ===================================================================
          {
            title: "Phase 4: Understanding the Payoff System",
            description: "Physiology, needs, rewards, and addiction patterns explored.",
            startTime: 553, // 09:13
            endTime: 869, // 14:29
            sortOrder: 3,
            audioAssetUrl: MEDIA.audio.phase4,
            audioTriggerTime: 869,
            interventions: {
              create: [
                { title: "Intervention 4.1", timestampSec: 621, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 0 },
                { title: "Intervention 4.2", timestampSec: 682, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 1 },
                { title: "Intervention 4.3", timestampSec: 740, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 2 },
                { title: "Intervention 4.4", timestampSec: 825, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 3 },
              ],
            },
          },

          {
            title: "Phase 5: Exposing Safety Strategies and Reclaiming Identity-Based Agency",
            description: "Exposing safety strategies and reclaiming identity-based agency.",
            startTime: 869, // 14:29
            endTime: 1471, // 24:31
            sortOrder: 4,
            audioAssetUrl: MEDIA.audio.phase5,
            audioTriggerTime: 1471,
            interventions: {
              create: [
                { title: "Intervention 5.1", timestampSec: 879, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 0 },
                { title: "Intervention 5.2", timestampSec: 971, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 1 },
                { title: "Intervention 5.3", timestampSec: 1046, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 2 },
                { title: "Intervention 5.4", timestampSec: 1174, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 3 },
                { title: "Intervention 5.5", timestampSec: 1277, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 4 },
                { title: "Intervention 5.6", timestampSec: 1331, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 5 },
                { title: "Intervention 5.7", timestampSec: 1363, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 6 },
                { title: "Intervention 5.8", timestampSec: 1411, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 7 },
              ],
            },
          },

          {
            title: "Phase 6: Closing the Loops and Installing Commitment",
            description: "Closing the loops and installing commitment.",
            startTime: 1471, // 24:31
            endTime: 2072, // 34:32
            sortOrder: 5,
            audioAssetUrl: MEDIA.audio.phase6,
            audioTriggerTime: 2072,
            interventions: {
              create: [
                { title: "Intervention 6.1", timestampSec: 1500, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 0 },
                { title: "Intervention 6.2", timestampSec: 1515, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 1 },
                { title: "Intervention 6.3", timestampSec: 1539, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 2 },
                { title: "Intervention 6.4", timestampSec: 1576, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 3 },
                { title: "Intervention 6.5", timestampSec: 1620, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 4 },
                { title: "Intervention 6.6", timestampSec: 1638, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 5 },
                { title: "Intervention 6.7", timestampSec: 1710, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 6 },
                { title: "Intervention 6.8", timestampSec: 1742, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 7 },
                { title: "Intervention 6.9", timestampSec: 1749, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 8 },
                { title: "Intervention 6.10", timestampSec: 1773, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 9 },
                { title: "Intervention 6.11", timestampSec: 1885, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 10 },
                { title: "Intervention 6.12", timestampSec: 1929, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 11 },
                { title: "Intervention 6.13", timestampSec: 2000, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 12 },
                { title: "Intervention 6.14", timestampSec: 2018, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 13 },
                { title: "Intervention 6.15", timestampSec: 2030, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 14 },
                { title: "Intervention 6.16", timestampSec: 2049, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 15 },
              ],
            },
          },

          {
            title: "Phase 7: From Insight to Proof: Controlled Re-Entry Conditioning (Part 1)",
            description: "Core intervention - controlled re-entry conditioning begins.",
            startTime: 2072, // 34:32
            endTime: 3933, // 01:05:33
            sortOrder: 6,
            audioAssetUrl: MEDIA.audio.phase7,
            audioTriggerTime: 3933,
            interventions: {
              create: [
                { title: "Intervention 7.1", timestampSec: 2071, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 0 },
                { title: "Intervention 7.2", timestampSec: 2148, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 1 },
                { title: "Intervention 7.3", timestampSec: 2174, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 2 },
                { title: "Intervention 7.4", timestampSec: 2304, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 3 },
                { title: "Intervention 7.5", timestampSec: 2428, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 4 },
                { title: "Intervention 7.6", timestampSec: 2517, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 5 },
                { title: "Intervention 7.7", timestampSec: 2563, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 6 },
                { title: "Intervention 7.8", timestampSec: 2745, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 7 },
                { title: "Intervention 7.9", timestampSec: 2827, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 8 },
                { title: "Intervention 7.10", timestampSec: 2850, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 9 },
                { title: "Intervention 7.11", timestampSec: 2951, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 10 },
                { title: "Intervention 7.12", timestampSec: 3027, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 11 },
                { title: "Intervention 7.13", timestampSec: 3071, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 12 },
                { title: "Intervention 7.14", timestampSec: 3098, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 13 },
                { title: "Intervention 7.15", timestampSec: 3145, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 14 },
                { title: "Intervention 7.16", timestampSec: 3162, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 15 },
                { title: "Intervention 7.17", timestampSec: 3172, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 16 },
                { title: "Intervention 7.18", timestampSec: 3201, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 17 },
                { title: "Intervention 7.19", timestampSec: 3263, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 18 },
                { title: "Intervention 7.20", timestampSec: 3314, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 19 },
                { title: "Intervention 7.21", timestampSec: 3331, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 20 },
                { title: "Intervention 7.22", timestampSec: 3365, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 21 },
                { title: "Intervention 7.23", timestampSec: 3414, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 22 },
                { title: "Intervention 7.24", timestampSec: 3451, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 23 },
                { title: "Intervention 7.25", timestampSec: 3554, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 24 },
                { title: "Intervention 7.26", timestampSec: 3575, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 25 },
                { title: "Intervention 7.27", timestampSec: 3616, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 26 },
                { title: "Intervention 7.28", timestampSec: 3674, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 27 },
                { title: "Intervention 7.29", timestampSec: 3720, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 28 },
                { title: "Intervention 7.30", timestampSec: 3866, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 29 },
              ],
            },
          },

          {
            title: "Phase 8: Integration and Consolidation for Final Re-Entry (Part 2)",
            description: "Core intervention continues - integration and consolidation.",
            startTime: 3933, // 01:05:33
            endTime: 4979, // 01:22:59
            sortOrder: 7,
            audioAssetUrl: MEDIA.audio.phase8,
            audioTriggerTime: 4979,
            interventions: {
              create: [
                { title: "Intervention 8.1", timestampSec: 3919, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 0 },
                { title: "Intervention 8.2", timestampSec: 4446, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 1 },
                { title: "Intervention 8.3", timestampSec: 4567, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 2 },
                { title: "Intervention 8.4", timestampSec: 4601, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 3 },
              ],
            },
          },

          {
            title: "Phase 9: Cognitive Stabilization via Primary Question Replacement",
            description: "Cognitive stabilization via primary question replacement.",
            startTime: 4979, // 01:22:59
            endTime: 5668, // 01:34:28
            sortOrder: 8,
            audioAssetUrl: MEDIA.audio.phase9,
            audioTriggerTime: 5668,
            interventions: {
              create: [
                { title: "Intervention 9.1", timestampSec: 5181, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 0 },
                { title: "Intervention 9.2", timestampSec: 5427, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 1 },
                { title: "Intervention 9.3", timestampSec: 5659, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 2 },
              ],
            },
          },

          {
            title: "Phase 10: Ownership Consolidation and Agency Encoding",
            description: "Ownership consolidation and agency encoding.",
            startTime: 5668, // 01:34:28
            endTime: 5822, // 01:37:02
            sortOrder: 9,
            audioAssetUrl: MEDIA.audio.phase10,
            audioTriggerTime: 5822,
            interventions: {
              create: [
                { title: "Intervention 10.1", timestampSec: 5700, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 0 },
                { title: "Intervention 10.2", timestampSec: 5714, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 1 },
                { title: "Intervention 10.3", timestampSec: 5727, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 2 },
                { title: "Intervention 10.4", timestampSec: 5746, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 3 },
                { title: "Intervention 10.5", timestampSec: 5766, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 4 },
              ],
            },
          },

          {
            title: "Phase 11: Identity and Future Anchoring",
            description: "Identity and future anchoring - final phase.",
            startTime: 5822, // 01:37:02
            endTime: 5882,
            sortOrder: 10,
            audioAssetUrl: MEDIA.audio.phase11,
            audioTriggerTime: 5882,
            interventions: {
              create: [
                { title: "Intervention 11.1", timestampSec: 5839, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 0 },
                { title: "Intervention 11.2", timestampSec: 5860, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 1 },
                { title: "Intervention 11.3", timestampSec: 5875, prompt: "", description: "Placeholder", methodModelFramework: "", function: "", scientificReferenceFields: [], sortOrder: 2 },
              ],
            },
          },
        ],
      },

      scienceItems: {
        create: [
          {
            name: "Symptoms as Competence",
            description: `Panic, anxiety, and hypervigilance are often framed as disorders — malfunctions of the brain or nervous system. But from an evolutionary and regulatory perspective, these responses are not errors. They are competencies: precisely calibrated survival mechanisms that activate under specific conditions.

When the brain perceives a threat — real or imagined — it initiates a cascade of physiological responses designed to maximize the chance of survival. Heart rate increases, breathing shallows, blood flow is redirected to the muscles, and non-essential functions like digestion are temporarily suppressed. This is the fight-or-flight response, and it is remarkably effective for what it was designed to do: help us escape from predators, respond to physical danger, and survive in an unpredictable environment.

The problem is not the response itself. The problem is the mismatch between the ancient system and the modern context. The brain cannot distinguish between a saber-toothed tiger and an overdue tax bill. It responds to perceived threat with the same intensity, regardless of whether the threat is physical or psychological, immediate or imagined.

What we call "panic disorder" is often the nervous system doing exactly what it is designed to do — just in the wrong context. The symptom is not a failure; it is an over-application of a competence. The person is not broken. The pattern is simply running in situations where it is no longer adaptive.

This reframe has significant implications for intervention. Rather than trying to suppress or eliminate the symptom, effective approaches work with the underlying competence: acknowledging its protective function, identifying the triggers that activate it, and training the system to recalibrate its threat assessment. The goal is not to disable the alarm — it is to update the conditions under which it fires.

Key References:
• Porges, S. W. (2011). The Polyvagal Theory: Neurophysiological Foundations of Emotions, Attachment, Communication, and Self-Regulation.
• LeDoux, J. (2015). Anxious: Using the Brain to Understand and Treat Fear and Anxiety.
• Sapolsky, R. M. (2004). Why Zebras Don't Get Ulcers: The Acclaimed Guide to Stress, Stress-Related Diseases, and Coping.
• Nesse, R. M. (2019). Good Reasons for Bad Feelings: Insights from the Frontier of Evolutionary Psychiatry.`,
            timestampsSec: [300, 450, 540, 720],
            sortOrder: 0,
          },
          {
            name: "Placebo as Medicine",
            description: `The placebo effect is often dismissed as a confounding variable in clinical trials — something to be controlled for, subtracted out, and ultimately ignored. But this framing misses the point. The placebo effect is not noise. It is signal. It reveals something fundamental about how the brain regulates the body.

When a person believes they are receiving an effective treatment, the brain initiates real physiological changes. Pain diminishes. Inflammation decreases. Neurotransmitter levels shift. These are not imaginary improvements — they are measurable, replicable, and in some cases, indistinguishable from the effects of active drugs.

The key mechanism is expectation. The brain is a prediction machine. It constantly generates forecasts about what will happen next and adjusts bodily states accordingly. When a person expects relief, the brain pre-emptively shifts toward that state. This is not deception — it is adaptive regulation.

This has profound implications for coaching and therapeutic work. The way an intervention is framed, the confidence with which it is delivered, and the context in which it occurs all influence outcomes. A technique presented with certainty and authority activates different neural pathways than the same technique offered tentatively.

The placebo effect also explains why belief systems matter. If a person believes they are broken, their brain will regulate toward that state. If they believe change is possible, the brain shifts its predictions accordingly. This is not magical thinking — it is the neuroscience of expectation.

Effective practitioners understand this. They do not manipulate or deceive. They leverage the brain's natural regulatory mechanisms by creating conditions where positive expectation is plausible. The intervention becomes more effective not because of trickery, but because the brain is working with the process rather than against it.

Key References:
• Benedetti, F. (2014). Placebo Effects: Understanding the Mechanisms in Health and Disease.
• Kaptchuk, T. J., & Miller, F. G. (2015). Placebo Effects in Medicine. New England Journal of Medicine.
• Wager, T. D., & Atlas, L. Y. (2015). The neuroscience of placebo effects: connecting context, learning and health. Nature Reviews Neuroscience.
• Kirsch, I. (2010). The Emperor's New Drugs: Exploding the Antidepressant Myth.`,
            timestampsSec: [840, 930],
            sortOrder: 1,
          },
          {
            name: "What Xanax Is – and What It Actually Does",
            description: `Benzodiazepines like Xanax (alprazolam) are among the most commonly prescribed medications for anxiety and panic. They work by enhancing the effect of GABA (gamma-aminobutyric acid), the brain's primary inhibitory neurotransmitter. Within minutes, the nervous system slows down, muscles relax, and the subjective experience of anxiety diminishes.

But here is the critical distinction: the drug does not solve the problem. It suppresses the signal.

Anxiety is not a chemical imbalance that benzodiazepines correct. It is a regulatory state — a pattern of activation that the brain generates in response to perceived threat. Xanax does not address the threat. It does not change the underlying pattern. It simply dampens the output.

This creates two significant problems. First, the person never learns that they can regulate the state themselves. The drug becomes the source of relief, and the sense of personal agency diminishes. Second, because the underlying pattern remains intact, it reasserts itself as soon as the drug wears off — often with greater intensity (rebound anxiety).

There is also a misattribution effect. When someone takes Xanax and feels better, they attribute the relief to the drug. But in many cases, the relief would have occurred anyway — panic attacks are self-limiting; the nervous system naturally returns to baseline. The drug captures the credit for a process that was already underway.

This is not an argument against medication. For some people, in some contexts, benzodiazepines serve a legitimate function — particularly in acute crisis or as a bridge to longer-term intervention. But they are not a solution. They are a pause button.

Effective intervention works differently. It teaches the person to recognize the pattern, understand its components, and develop the capacity to regulate it directly. The goal is not to suppress the signal but to update the system that generates it.

Key References:
• Ashton, C. H. (2002). Benzodiazepines: How They Work and How to Withdraw.
• Lader, M. (2011). Benzodiazepines revisited—will we ever learn? Addiction.
• Otto, M. W., & Hofmann, S. G. (2010). Avoiding Treatment Failures in the Anxiety Disorders.
• Barlow, D. H. (2004). Anxiety and Its Disorders: The Nature and Treatment of Anxiety and Panic.`,
            timestampsSec: [630, 720, 840],
            sortOrder: 2,
          },
          {
            name: "Why 'Scrambling' Works",
            description: `One of the most effective techniques for disrupting unwanted emotional patterns is "scrambling" — a process of deliberately distorting the internal representations that generate the state. The technique originated in NLP (Neuro-Linguistic Programming) but has parallels in cognitive defusion (ACT), imagery rescripting, and memory reconsolidation research.

The basic principle is simple: emotional states are not stored as abstract data. They are encoded as specific sensory representations — images, sounds, body sensations, and internal dialogue. Change the representation, and you change the state.

Here is how it works in practice. A person is asked to recall an anxiety-provoking memory or imagine a feared scenario. As they do so, they are guided to alter the sensory properties of the experience: shrinking the image, moving it further away, draining the color, adding absurd elements (circus music, cartoon voices), or running it backwards. These modifications disrupt the pattern that generates the emotional response.

Why does this work? The brain does not distinguish cleanly between "real" and "imagined" experience. The same neural circuits that fire during an actual event also fire during vivid recall or imagination. When you modify the representation, you are literally changing the neural pattern associated with that experience.

This is supported by research on memory reconsolidation. When a memory is recalled, it enters a labile state — temporarily unstable and open to modification. If new information is introduced during this window, the memory is re-encoded with the modification included. The next time the memory is accessed, it carries the new (scrambled) properties.

The result is not amnesia. The person still remembers the event. But the emotional charge is reduced, the automatic pattern is disrupted, and the response becomes more flexible. The memory loses its power to hijack the nervous system.

Scrambling is particularly effective for patterns that feel automatic and involuntary — like panic, phobias, or intrusive thoughts. By making the process conscious and playful, the person regains agency over experiences that previously felt uncontrollable.

Key References:
• Bandler, R. (1985). Using Your Brain—For a Change.
• Kindt, M., Soeter, M., & Vervliet, B. (2009). Beyond extinction: erasing human fear responses and preventing the return of fear. Nature Neuroscience.
• Holmes, E. A., & Mathews, A. (2010). Mental imagery in emotion and emotional disorders. Clinical Psychology Review.
• Nader, K., & Hardt, O. (2009). A single standard for memory: the case for reconsolidation. Nature Reviews Neuroscience.`,
            timestampsSec: [450, 540, 1020, 1260],
            sortOrder: 3,
          },
        ],
      },

      comments: {
        create: [
          {
            content:
              "The way Tony uses the model as a diagnostic tool rather than just teaching it is brilliant.",
            timestamp: 47,
            authorName: "Coach Sarah",
          },
          {
            content:
              "Notice how the humor completely disarms any defensiveness here.",
            timestamp: 73,
            authorName: "Learning Dev",
          },
        ],
      },
    },
  })

  console.log(`Created lesson: ${lesson.title}`)
  console.log(`Lesson ID: ${lesson.id}`)
  console.log(`Total phases: 11`)
  console.log(`Total interventions: 85`)
  console.log("Seeding complete!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
