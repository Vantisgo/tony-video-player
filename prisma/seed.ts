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
    video:
      "https://xw2q4gahxr6qj14h.public.blob.vercel-storage.com/video/1766432271545-1_Coaching_100MB.mp4",
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
          // PHASE 1: Model-Based Framing & Agency Priming (00:33 - 02:10)
          // ===================================================================
          {
            title: "Phase 1: Model-Based Framing & Agency Priming",
            description:
              "Tony brings the coachee into the framework of the 8 Levels of Consciousness and asks her to place herself within it. As the conversation unfolds, he notices that her self-placement does not match what she is actually experiencing. That mismatch signals that there is something deeper going on. Rather than staying with the model as a teaching tool, Tony uses it to listen more closely and shifts the focus away from labels toward the lived experience. This allows him to identify the real pattern at work and sets up the transition into the next phase, where that pattern can be addressed directly.",
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
                  prompt:
                    "What is your center of gravity? Where do you spend most of your time in these levels of consciousness?",
                  description:
                    "Tony invites the coachee to locate her lived experience within a pre-existing conceptual model rather than narrating it freely. This shifts the frame from subjective storytelling to structured self-observation. By asking where her center of gravity lies, he implicitly positions her experience as dynamic, distributable, and observable over time - rather than fixed or identity-bound. The intervention establishes cognitive distance, reduces emotional fusion, and primes personal agency by framing inner states as locations one inhabits rather than traits one is.",
                  methodModelFramework:
                    "Center of Gravity Mapping within the 8 Levels of Consciousness",
                  function: "Cognitive anchoring",
                  scientificReferenceFields: [
                    "Cognitive Psychology (Self-Distancing, Metacognition)",
                    "Constructivist Psychology",
                    "Model-Based Reasoning in Cognitive Science",
                  ],
                  sortOrder: 0,
                },
                {
                  title: "Intervention 1.2: Playful Inconsistency Highlighting",
                  timestampSec: 73, // 00:01:13
                  prompt: "Okay. Either beige or yellow. That's quite a broad stroke. Okay.",
                  description:
                    "Tony highlights an internal inconsistency in the coachee's self-assessment while deliberately embedding the contradiction in humor. This allows him to challenge the accuracy of her cognitive mapping without triggering defensiveness or shame. Humor functions as a status-preserving softener: the inconsistency is exposed, but the coachee's dignity and emotional safety remain intact. Humor lowers the perceived threat and increases cognitive flexibility, creating a brain state that is more receptive to learning and updating existing patterns. The result is cognitive recalibration without resistance, keeping rapport and authority simultaneously.",
                  methodModelFramework: "Humor framing, rapport-preserving 'pattern break'",
                  function: "Soft contradiction without threat",
                  scientificReferenceFields: [
                    "Social Psychology (Face-Saving Mechanisms)",
                    "Cognitive Dissonance Theory",
                    "Affective Neuroscience related to humor and threat reduction",
                  ],
                  sortOrder: 1,
                },
                {
                  title: "Intervention 1.3: Audience-Directed Meta-Framing",
                  timestampSec: 91, // 00:01:31
                  prompt: "[Addressing the audience about the process]",
                  description:
                    "Tony temporarily redirects his explanation away from the coachee and toward the audience, describing what is happening and why it matters. By doing so, he externalizes the intervention and removes the coachee from the position of being directly corrected or analyzed. This shift lowers self-consciousness and psychological resistance, while simultaneously increasing the coachee's sense of safety and social inclusion. The coachee becomes an observer of her own process rather than its target, which allows insight and behavioral change to occur with significantly less defensiveness.",
                  methodModelFramework: "Making a distinction, teaching the room",
                  function: "Resistance reduction",
                  scientificReferenceFields: [
                    "Cognitive Linguistics (Conceptual Metaphor Theory)",
                    "Psycholinguistics",
                    "Cognitive-Behavioral Therapy research on language and emotional regulation",
                  ],
                  sortOrder: 2,
                },
                {
                  title: "Intervention 1.4: Metaphor Deconstruction",
                  timestampSec: 91, // 00:01:31
                  prompt: "Remember, people use metaphors all the time.",
                  description:
                    "Tony explicitly separates metaphorical language from literal physiological reality. By doing so, he prevents symbolic expressions such as 'survival' from being treated as factual descriptions of the nervous system's state. This intervention reduces emotional amplification caused by metaphor inflation and dismantles implicit identity claims embedded in language. By restoring semantic precision, Tony weakens the cognitive legitimacy of the fear narrative before engaging in deeper experiential work.",
                  methodModelFramework: "Deconstruction of Global Metaphor",
                  function: "Semantic precision, identity loosening",
                  scientificReferenceFields: [
                    "Cognitive Linguistics (Conceptual Metaphor Theory)",
                    "Psycholinguistics",
                    "Cognitive-Behavioral Therapy research on language and emotional regulation",
                  ],
                  sortOrder: 3,
                },
                {
                  title: "Intervention 1.5: State Interruption with Agency Reframing",
                  timestampSec: 125, // 00:02:05
                  prompt: "Oh, come here. We're gonna solve that real quick then.",
                  description:
                    "Implicit in the coachee's statement, is a construction of the problem as identity (\"I have really bad…\", \"I'm constantly…\"). This language signals perceived permanence and a loss of personal agency. Tony interrupts this pattern through a directive verbal frame (\"We're gonna solve\"), combined with an ease presupposition (\"real quick\") and immediate somatic movement by asking the coachee to come to him. The bodily compliance functions as a nonverbal acceptance signal, reinforcing agency and authority before any cognitive negotiation occurs.",
                  methodModelFramework: "Change our state, pattern interrupt",
                  function: "Somatic and cognitive pattern break",
                  scientificReferenceFields: [
                    "Affective Neuroscience",
                    "Somatic Psychology",
                    "Research on State-Dependent Learning and Behavioral Interrupts",
                  ],
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
              "Tony moves away from talking about the problem and starts looking at how it is actually created. He invites the coachee to interact with the panic instead of describing it, which allows him to see how the pattern works and how accessible it is. Step by step, he helps her notice what she is doing internally - how she breathes, what she focuses on, and how the state builds. By framing the symptom as something she does rather than something that happens to her, Tony restores a sense of control without blame. He highlights that she already knows how to get out of the state, setting the stage for the next phase, where this understanding will be tested and proven through direct experience.",
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
                  prompt: "Okay (with nonverbal interaction: laughter, smile, eye contact)",
                  description:
                    "The coachee's laughter functions as a stress response rather than amusement. Tony responds with a calm smile, steady eye contact, and a soft verbal acknowledgment (\"Okay\"), which serves to co-regulate her emotional state. This nonverbal attunement stabilizes arousal, maintains rapport, and signals psychological safety. By repeatedly checking in without pushing forward, Tony implicitly communicates that only experiences the coachee feels safe with will be explored, preventing premature escalation and preserving trust.",
                  methodModelFramework:
                    "Rapport building, emotional pacing, state regulation through presence",
                  function: "Emotional stabilization and safety signaling",
                  scientificReferenceFields: [
                    "Affective Neuroscience (co-regulation)",
                    "Social Baseline Theory",
                    "Polyvagal-Informed Research on Interpersonal Regulation",
                  ],
                  sortOrder: 0,
                },
                {
                  title: "Intervention 2.2: Testing the Pattern (Exploratory Re-Entry)",
                  timestampSec: 135, // 00:02:15
                  prompt: "So do your panic disorder for me.",
                  description:
                    "Tony invites the coachee to attempt a brief re-entry into the feared state, treating it as if it were a normal and accessible action. The primary function of this intervention is diagnostic rather than transformational. By observing hesitation, confusion, or resistance, Tony gathers information about how the panic pattern is accessed, how automatic it feels, and where avoidance mechanisms are already operating. At the same time, the request subtly primes the idea that the state is something that can be entered intentionally. The intervention introduces re-entry as a non-threatening behavioral possibility while allowing Tony to assess the coachee's implicit understanding of her own pattern.",
                  methodModelFramework:
                    "Pattern analysis, state access testing, early re-entry priming within NAC (Neuro-Associative Conditioning)",
                  function: "Diagnostic probing and preparation for later voluntary re-entry",
                  scientificReferenceFields: [
                    "Exposure-based assessment",
                    "Behavioral analysis",
                    "Research on avoidance and approach behavior",
                  ],
                  sortOrder: 1,
                },
                {
                  title: "Intervention 2.3: You Create the Pattern (Agency Frame)",
                  timestampSec: 158, // 00:02:38
                  prompt: "To feel, you have to do things.",
                  description:
                    "Tony reframes the symptom from something that happens to the coachee into something she actively does. By asking her to 'do' the panic disorder, he shifts the experience from an external, uncontrollable event to an internally generated process. This reframing implicitly restores agency: if the symptom is enacted, it can also be interrupted, modified, or stopped. The intervention dismantles the passive victim narrative without confrontation and establishes the foundation for behavioral control.",
                  methodModelFramework: "Pattern analysis, Neuro-Associative Conditioning (NAC)",
                  function: "Restoration of agency through process framing",
                  scientificReferenceFields: [
                    "Cognitive-Behavioral Therapy (behavioral analysis)",
                    "Enactive and Embodied Cognition",
                    "Sense of Agency research",
                  ],
                  sortOrder: 2,
                },
                {
                  title: "Intervention 2.4: Interoceptive Pattern Decoding",
                  timestampSec: 175, // 00:02:55
                  prompt: "It's her breathing, it's the biggest piece.",
                  description:
                    "Tony begins to decode the symptom by identifying breathing as the primary physiological component of the panic pattern. He introduces interoceptive awareness by directing attention to internal bodily processes that are normally unconscious. Interoception means the perception, sensing, and interpretation of internal bodily signals such as breathing, heart rate, muscle tension, temperature, and visceral sensations. Step by step, he helps the coachee recognize how breathing, bodily tension, imagery, and internal dialogue interact to produce panic. Developing accurate interoceptive perception is essential for later control, as agency depends on the ability to notice and influence internal signals before they escalate.",
                  methodModelFramework: "Physiology-first intervention, state awareness within NAC",
                  function: "Making unconscious bodily processes conscious and observable",
                  scientificReferenceFields: [
                    "Interoception Research",
                    "Affective Neuroscience",
                    "Panic Disorder Physiology and Breath Regulation Studies",
                  ],
                  sortOrder: 3,
                },
                {
                  title: "Intervention 2.5: Total Responsibility Without Guilt",
                  timestampSec: 188, // 00:03:08
                  prompt:
                    "So she uses some external trigger to then do something with her body, and then she adds to it something, and then she's outta control.",
                  description:
                    "Tony explains the panic sequence as a chain of actions rather than a flaw or pathology. He assigns responsibility for the process while explicitly avoiding blame by clarifying that the behavior is not consciously chosen. This distinction preserves dignity and prevents shame while still establishing causality. The coachee can recognize her role in creating the state without feeling attacked, which keeps her engaged and open to change.",
                  methodModelFramework:
                    "Total responsibility without judgment, cause-effect reframing",
                  function: "Ownership of behavior without inducing guilt or defensiveness",
                  scientificReferenceFields: [
                    "Attribution Theory",
                    "Trauma-Informed Psychology",
                    "Research on Agency and Learned Helplessness",
                  ],
                  sortOrder: 4,
                },
                {
                  title: "Intervention 2.6: Competence-Based Future Pacing",
                  timestampSec: 188, // 00:03:08
                  prompt: "So she knows how to get out of it as well.",
                  description:
                    "Tony highlights that the coachee already possesses the ability to exit the panic state. By emphasizing that she has done this repeatedly, he future-paces competence rather than pathology. He explicitly removes blame by noting that the process is not conscious, preventing self-accusation while still reinforcing capability. This intervention builds confidence, stabilizes motivation, and prepares the nervous system for later experiential work by anchoring change in existing success.",
                  methodModelFramework: "Future pacing, resource activation within NAC",
                  function: "Strengthening self-efficacy and perceived control",
                  scientificReferenceFields: [
                    "Self-Efficacy Theory (Bandura)",
                    "Solution-Focused Therapy",
                    "Implicit Learning and Memory Research",
                  ],
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
              "Tony deepens the work by connecting the panic pattern to an underlying need that is being met through the symptom. Having already established agency and pattern awareness, he now explores why the pattern exists in the first place. By shifting perspectives, activating positive states, and systematically working through his core models, Tony helps the coachee recognize that panic is not random but functional. This phase transforms the symptom from something to eliminate into something to understand, preparing the ground for replacing the pattern rather than merely interrupting it.",
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
                  prompt: "Because what do you get out of being panicked of the six needs?",
                  description:
                    "Tony reframes the panic pattern once again as an action, this time linking it explicitly to benefit rather than dysfunction. By asking what the coachee gets out of panic, he introduces the idea that the symptom serves a purpose, even if unconsciously. This question shifts the frame from control to motivation and opens the door to examining panic as a strategy for meeting an underlying need. The intervention prevents moral judgment and redirects curiosity toward function, setting up the transition into the Six Human Needs framework.",
                  methodModelFramework: "Six Human Needs, pattern purpose identification",
                  function: "Linking symptom behavior to implicit benefit",
                  scientificReferenceFields: [
                    "Motivational Psychology",
                    "Functional analysis in Behavioral Therapy",
                    "Secondary Gain Research",
                  ],
                  sortOrder: 0,
                },
                {
                  title: "Intervention 3.2: Perspective Shift (Step Outside Yourself)",
                  timestampSec: 227, // 00:03:47
                  prompt: "Come over here and be Tony Robbins for a second and I'll be you.",
                  description:
                    "Tony asks the coachee to physically and mentally step outside of herself and adopt his perspective. This role reversal creates immediate psychological distance and enables the coachee to view her own behavior with less emotional load. By embodying another viewpoint, she gains access to insights that are difficult to reach from within the symptom state. Tony's humor during this exchange supports the shift by lowering tension and keeping the nervous system flexible, increasing the likelihood of new understanding.",
                  methodModelFramework:
                    "Perspective shift, role reversal, state change through embodiment",
                  function: "Disrupting habitual self-identification and enabling insight",
                  scientificReferenceFields: [
                    "Systemic Therapy (role switching)",
                    "Embodied Cognition",
                    "Affective Neuroscience related to Humor and Cognitive Flexibility",
                  ],
                  sortOrder: 1,
                },
                {
                  title: "Intervention 3.3: Six Human Needs Mapping",
                  timestampSec: 287, // 00:04:47
                  prompt:
                    "(guided exploration of certainty, variety, significance, love/connection, growth, contribution)",
                  description:
                    "Tony systematically walks the coachee through the Six Human Needs model to identify which need is being met through the panic pattern. Rather than analyzing the symptom abstractly, he helps her recognize how panic provides certainty, significance, or another core need in an intensified form. This structured exploration transforms panic from an enemy into a signal, revealing the underlying driver that sustains the behavior. Identifying the need makes it possible to later meet it through healthier strategies.",
                  methodModelFramework: "Six Human Needs assessment",
                  function: "Identifying the motivational driver behind the symptom",
                  scientificReferenceFields: [
                    "Needs-Based Motivation Theories",
                    "Humanistic Psychology",
                    "Behavioral Substitution Models",
                  ],
                  sortOrder: 2,
                },
                {
                  title: "Intervention 3.4: Positive State Induction",
                  timestampSec: 376, // 00:06:16
                  prompt: "You know how to celebrate, don't you?",
                  description:
                    "Tony deliberately shifts the coachee out of the problem-focused state and into a positive emotional experience. By activating a familiar, resourceful state, he broadens her emotional range and makes it easier to recall moments where core needs were fulfilled without panic. This contrast reduces over-identification with the symptom and supports more balanced perception, allowing positive experiences to carry equal psychological weight.",
                  methodModelFramework: "State change, resource activation",
                  function:
                    "Expanding emotional range and access to positive reference states",
                  scientificReferenceFields: [
                    "Positive Affect Research",
                    "Broaden-and-Build Theory",
                    "State-Dependent Learning",
                  ],
                  sortOrder: 3,
                },
                {
                  title: "Intervention 3.5: Balancing Emotional Certainty",
                  timestampSec: 405, // 00:06:45
                  prompt: "Are you as certain about that as panic?",
                  description:
                    "Tony draws a direct comparison between the intensity and certainty of panic and the certainty present in positive states. By doing so, he challenges the implicit assumption that panic is uniquely powerful or dominant. This comparison widens the coachee's perceptual field and helps her recognize that certainty is not exclusive to fear. The intervention restores balance by integrating positive certainty alongside negative intensity.",
                  methodModelFramework: "Comparative state evaluation, meaning balancing",
                  function: "Reducing dominance of the panic state through contrast",
                  scientificReferenceFields: [
                    "Cognitive Appraisal Theory",
                    "Affective Contrast Effects",
                    "Attentional Bias Research",
                  ],
                  sortOrder: 4,
                },
                {
                  title: "Intervention 3.6: Positive Feedback and Social Reinforcement",
                  timestampSec: 442, // 00:07:22
                  prompt: "I love your honesty. Give her a hand. She's so beautiful, isn't she?",
                  description:
                    "Tony offers direct positive feedback and amplifies it through the audience. This social reinforcement strengthens the coaching alliance and anchors the positive emotional state. Public recognition validates vulnerability and honesty, increasing trust and reinforcing the coachee's engagement. The intervention stabilizes the emotional gains made in the session and deepens relational safety.",
                  methodModelFramework: "Positive reinforcement, social validation",
                  function:
                    "Strengthening alliance and reinforcing positive emotional states",
                  scientificReferenceFields: [
                    "Social Reinforcement Theory",
                    "Attachment Research",
                    "Affective Neuroscience of Reward",
                  ],
                  sortOrder: 5,
                },
                {
                  title: "Intervention 3.7: Five Elements Mapping",
                  timestampSec: 459, // 00:07:39
                  prompt: "Wood, fire, earth, metal, or water?",
                  description:
                    "Tony introduces the Five Elements framework to identify the coachee's dominant energetic and emotional expression style. By linking both panic and positive states to the same underlying element, he highlights what they have in common rather than treating them as opposites. This mapping connects physiology, emotional intensity, and need fulfillment into a coherent pattern. The coachee gains a unifying understanding of how her energy operates across different states, preparing the ground for regulation rather than suppression.",
                  methodModelFramework: "Five Elements model",
                  function: "Integrating emotional extremes into a single regulatory pattern",
                  scientificReferenceFields: [
                    "Psychophysiological typologies",
                    "Arousal regulation research",
                    "Cross-cultural models of emotion and energy",
                  ],
                  sortOrder: 6,
                },
              ],
            },
          },

          // ===================================================================
          // PHASE 4: Understanding the Payoff System (09:13 - 14:29)
          // ===================================================================
          {
            title: "Phase 4: Understanding the Payoff System",
            description:
              "Tony helps the coachee understand why the panic pattern has been so persistent. Rather than treating it as a failure of discipline or effort, he reframes it as a payoff-driven system involving physiology, emotional rewards, and unmet needs. By doing so, he removes self-blame and introduces a more accurate explanation for why change has not worked so far. This phase shifts the frame from 'trying harder' to understanding the mechanics of reinforcement, laying the groundwork for interrupting the pattern without resistance.",
            startTime: 553, // 09:13
            endTime: 869, // 14:29
            sortOrder: 3,
            audioAssetUrl: MEDIA.audio.phase4,
            audioTriggerTime: 869,
            interventions: {
              create: [
                {
                  title: "Intervention 4.1: Positive Feedback and Recognition",
                  timestampSec: 621,
                  prompt: "That's beautiful. Beautiful job. Most people couldn't see that.",
                  description:
                    "As the coachee identifies needs connected to the panic pattern, Tony reinforces her insight through explicit positive feedback. This recognition strengthens learning by marking the insight as valuable and rare, increasing its emotional weight. By affirming her capacity to see the pattern clearly, Tony stabilizes the progress made so far and keeps motivation high without pressure.",
                  methodModelFramework: "Positive reinforcement, acknowledgment of insight",
                  function: "Strengthening learning and consolidating insight",
                  scientificReferenceFields: [
                    "Reinforcement Learning",
                    "Motivational Psychology",
                    "Affective Neuroscience of Reward",
                  ],
                  sortOrder: 0,
                },
                {
                  title: "Intervention 4.2: Probing Questions for Self-Discovery",
                  timestampSec: 682,
                  prompt:
                    "Where does the connection part come from? There's certain people that know. I'm asking how much do they connect with you when they know?",
                  description:
                    "Instead of explaining how the need for connection is being met, Tony uses a sequence of precise probing questions. This approach guides the coachee toward discovering the insight herself. By leading through inquiry rather than instruction, Tony increases ownership and impact. Self-generated insight is more deeply encoded and less likely to be dismissed or forgotten than information that is simply provided.",
                  methodModelFramework: "Socratic questioning, guided discovery",
                  function: "Facilitating insight through self-generated understanding",
                  scientificReferenceFields: [
                    "Socratic Dialogue in Psychotherapy",
                    "Self-Determination Theory",
                    "Learning-by-Discovery Research",
                  ],
                  sortOrder: 1,
                },
                {
                  title: "Intervention 4.3: Failure Reattribution (Addiction Frame)",
                  timestampSec: 740,
                  prompt:
                    "Anything you're trying to change and you're failing to change, it's not because you don't have the willpower.",
                  description:
                    "Tony reframes repeated failure as a consequence of the payoff structure of addiction rather than a lack of willpower. By introducing the addiction frame, he offers a more accurate explanation for why previous attempts at change did not work. This reattribution removes shame and self-criticism while simultaneously pointing toward a solution: patterns driven by rewards must be interrupted and replaced, not forced away through effort. Tony also dismantles the common misconception that change requires struggle, which would otherwise create resistance before the real work begins.",
                  methodModelFramework: "Addiction model, payoff-based pattern analysis",
                  function: "Removing self-blame and reframing resistance to change",
                  scientificReferenceFields: [
                    "Addiction Neuroscience",
                    "Habit Formation Research",
                    "Reinforcement and Reward Circuitry Studies",
                  ],
                  sortOrder: 2,
                },
                {
                  title: "Intervention 4.4: Audience Calibration and Social Proof",
                  timestampSec: 825,
                  prompt: "How many follow? How important this is? If you wanna make change here, say aye.",
                  description:
                    "Tony involves the audience to reinforce the significance of the insight just introduced. This calibration serves as social proof, signaling to the coachee that her experience is shared and understood. By normalizing the pattern within a broader human context, Tony reduces isolation and strengthens credibility. The collective response also anchors the explanation emotionally, making it more memorable and harder to dismiss.",
                  methodModelFramework: "Social proof, audience calibration",
                  function: "Normalizing the experience and reinforcing credibility",
                  scientificReferenceFields: [
                    "Social Psychology (norms and conformity)",
                    "Group Validation Effects",
                    "Social Learning Theory",
                  ],
                  sortOrder: 3,
                },
              ],
            },
          },

          {
            title: "Phase 5: Exposing Safety Strategies and Reclaiming Identity-Based Agency",
            description:
              "Tony exposes the remaining safety strategies that quietly undermine agency and ties them directly to her identity. He dismantles belief in external regulators, challenges fixed diagnostic labels, and redirects responsibility back to the coachee without pressure or blame. This phase shifts the coachee from managing anxiety to owning her capacity to regulate it, setting the stage for direct experiential proof.",
            startTime: 869, // 14:29
            endTime: 1471, // 24:31
            sortOrder: 4,
            audioAssetUrl: MEDIA.audio.phase5,
            audioTriggerTime: 1471,
            interventions: {
              create: [
                {
                  title: "Intervention 5.1: Expectation Effect Framing",
                  timestampSec: 879,
                  prompt:
                    "You know placebos, you can give somebody a placebo and you can produce the same result as any drug in about 30% of cases.",
                  description:
                    "Tony introduces the placebo effect to prepare a layered cognitive intervention. Rather than attacking medication directly, he reframes relief as a result of expectation and self-regulation rather than chemical causation alone. This creates cognitive flexibility and opens the possibility that the coachee's calming response is already internally generated. The intervention quietly shifts agency back to the coachee while preserving respect for medical authority, preparing the ground for later causal reassignment.",
                  methodModelFramework: "Expectation reframing, belief-effect linkage",
                  function: "Decoupling relief from external agents and restoring internal agency",
                  scientificReferenceFields: [
                    "Placebo Research",
                    "Expectancy Effects",
                    "Psychoneurobiology of Belief",
                  ],
                  sortOrder: 0,
                },
                {
                  title: "Intervention 5.2: Identity Shift Through Label Collapse",
                  timestampSec: 971,
                  prompt: "Who are you if you're not a girl filled with anxiety at a 200 of significance?",
                  description:
                    "Tony challenges the coachee to consider who she is beyond the anxiety label. The question is intentionally difficult, directing attention toward an unresolved identity inquiry rather than an answer. By doing so, Tony creates cognitive space between the person and the diagnosis. He then explains how diagnostic labels often become identities, which makes change feel impossible. The intervention reframes identity as flexible and unfinished, implicitly positioning change as both possible and necessary.",
                  methodModelFramework: "Identity reframing, label deconstruction",
                  function: "Separating self-concept from symptom identity",
                  scientificReferenceFields: [
                    "Identity Theory",
                    "Self-Schema Research",
                    "Narrative Psychology",
                  ],
                  sortOrder: 1,
                },
                {
                  title: "Intervention 5.3: Identity Contrast via Audience Normalization",
                  timestampSec: 1046,
                  prompt:
                    "How many of you have ever felt depressed?… But you don't call yourself a depressed person. It's not your identity.",
                  description:
                    "Tony builds a clear contrast between experiencing a state and becoming identified with it. By addressing the audience, he normalizes emotional states while stripping them of identity status. This indirect approach allows the coachee to internalize the insight without defensiveness. Letting go of the identity label weakens the emotional grip of the problem and reduces neurological threat, making behavioral change more accessible.",
                  methodModelFramework: "Contrast framing, audience-directed normalization",
                  function: "Loosening identity fusion with emotional states",
                  scientificReferenceFields: [
                    "Cognitive Defusion",
                    "Social Comparison Theory",
                    "Affective Neuroscience of Threat Reduction",
                  ],
                  sortOrder: 2,
                },
                {
                  title: "Intervention 5.4: Results Frame Establishment",
                  timestampSec: 1174,
                  prompt:
                    "So if you want results, you came to the right place, but you have to do your part and you're doing a great job of your part.",
                  description:
                    "Tony reinforces progress while simultaneously setting a clear performance frame: success will be measured by change, not explanation. This legitimizes upcoming corrective interventions and establishes shared responsibility. By acknowledging the coachee's effort, he strengthens hope and commitment while making it clear that insight alone is not sufficient. The frame shifts the session from understanding to execution.",
                  methodModelFramework: "Results-based coaching frame",
                  function: "Preparing the coachee for direct corrective action",
                  scientificReferenceFields: [
                    "Goal-Directed Behavior Research",
                    "Performance Psychology",
                    "Commitment and Consistency Principles",
                  ],
                  sortOrder: 3,
                },
                {
                  title: "Intervention 5.5: Responsibility Frame (100% Responsibility)",
                  timestampSec: 1277,
                  prompt:
                    "You take a hundred percent responsibility and you can change anything in that game.",
                  description:
                    "Tony offers the coachee a new role: from passive observer to active owner of outcomes. By framing responsibility as empowering rather than blaming, he positions full responsibility as the access point to change. This reframing restores agency at the identity level and makes further intervention legitimate and actionable.",
                  methodModelFramework: "Total responsibility principle",
                  function: "Repositioning the coachee as the primary agent of change",
                  scientificReferenceFields: [
                    "Locus of Control Research",
                    "Agency Theory",
                    "Motivational Psychology",
                  ],
                  sortOrder: 4,
                },
                {
                  title: "Intervention 5.6: Certainty-Trance Pattern Interrupt",
                  timestampSec: 1331,
                  prompt: "Oh, it's prescribed. Well then, fuck. Let's all take one.",
                  description:
                    "Tony uses irony and exaggeration to interrupt the certainty trance created by medical authority. By momentarily amplifying the logic to absurdity, he exposes how unquestioned authority can suppress personal agency and exploration of alternatives. The humor destabilizes rigid belief structures and reopens cognitive flexibility without direct confrontation.",
                  methodModelFramework: "Pattern interrupt, certainty disruption through humor",
                  function: "Breaking authority-based cognitive rigidity",
                  scientificReferenceFields: [
                    "Authority Bias Research",
                    "Humor and Cognitive Flexibility",
                    "Belief Updating Mechanisms",
                  ],
                  sortOrder: 5,
                },
                {
                  title: "Intervention 5.7: Causal Reassignment",
                  timestampSec: 1363,
                  prompt:
                    "After all that, it'll calm you down an hour from now. But that is not how you stop your anxiety, that is your placebo for stopping anxiety.",
                  description:
                    "Tony reassigns causality by pointing out that calming has already occurred before the medication takes effect. By doing so, he demonstrates that expectation and self-regulation are the true drivers of relief. This reframing implicitly proves competence: if the coachee can calm herself through belief, she already possesses the capacity to end panic without external rescue.",
                  methodModelFramework: "Causal reframing, expectancy-based reassignment",
                  function: "Restoring confidence in internal regulation capacity",
                  scientificReferenceFields: [
                    "Causal Attribution Theory",
                    "Placebo Research",
                    "Self-Regulation Studies",
                  ],
                  sortOrder: 6,
                },
                {
                  title: "Intervention 5.8: Identity Validation Through Strength Reframing",
                  timestampSec: 1411,
                  prompt:
                    "You've got a beautiful fire here that our medical group has taught her that she's not who she should be.",
                  description:
                    "Tony validates the coachee's intensity as an inherent strength rather than a flaw. By mapping her identity to the Fire element, he reframes emotional intensity as energy that needs expression and regulation, not suppression. This intervention integrates identity rather than pathologizing it, replacing 'something is wrong with me' with 'this needs a different channel'.",
                  methodModelFramework: "Five Elements model, strength-based identity reframing",
                  function: "Integrating identity and reducing self-pathologization",
                  scientificReferenceFields: [
                    "Strength-Based Psychology",
                    "Emotional Regulation Research",
                    "Identity Integration Models",
                  ],
                  sortOrder: 7,
                },
              ],
            },
          },

          {
            title: "Phase 6: Eliminating Escape Routes and Committing to Change",
            description:
              "Tony consolidates the previous insights and removes the final psychological escape routes that would allow the coachee to agree intellectually without committing behaviorally. He repeatedly exposes authority-based safety strategies, normalizes the addiction frame through social proof, and reinforces agency through logic, attachment, and moral responsibility. This phase integrates cognition, emotion, identity, and relationship into a coherent commitment to change, closing the loop between insight and action.",
            startTime: 1471, // 24:31
            endTime: 2072, // 34:32
            sortOrder: 5,
            audioAssetUrl: MEDIA.audio.phase6,
            audioTriggerTime: 2072,
            interventions: {
              create: [
                {
                  title: "Intervention 6.1: Contrasting with Recognition",
                  timestampSec: 1500,
                  prompt:
                    "I'm not telling you anything. I'm asking you to be as smart as I know you really are.",
                  description:
                    "Tony notices that the 'addiction' frame lands emotionally and risks being received as judgment. He immediately protects the relationship by naming what he is not doing (\"I'm not telling you\") and then contrasts it with his actual intent: an invitation to use her intelligence. This repositioning preserves challenge while removing shame, so the coachee can stay open and engaged instead of defending her self-image. The move also quietly restores agency: if she is 'smart', she can evaluate the truth and choose action from strength rather than from being corrected.",
                  methodModelFramework: "Contrast framing, positive identity affirmation",
                  function: "Reducing defensiveness while preserving challenge",
                  scientificReferenceFields: [
                    "Self-Affirmation Theory",
                    "Threat Reduction in Learning",
                  ],
                  sortOrder: 0,
                },
                {
                  title: "Intervention 6.2: Parts Differentiation (Inner Team Activation)",
                  timestampSec: 1515,
                  prompt: "…beautiful, energetic piece, but there's a smart woman in there.",
                  description:
                    "Tony separates the emotional part that reacts from the reflective part that can learn. By naming both, without rejecting either, he creates a map for internal cooperation: the energetic part can be felt, and the smart part can evaluate and decide. This prevents the coachee from collapsing into one state (\"I am this\") and gives her a usable internal structure for change: a part can be activated without taking over identity. The intervention turns overwhelm into choice by making 'who is speaking' explicit.",
                  methodModelFramework: "Parts work, implicit inner team model",
                  function: "Enabling insight without emotional overwhelm",
                  scientificReferenceFields: ["Ego State Theory", "Parts-Based Psychotherapy"],
                  sortOrder: 1,
                },
                {
                  title: "Intervention 6.3: Agency–Competence Synthesis",
                  timestampSec: 1539,
                  prompt:
                    "You got yourself out of panic, which means you could do it any fucking time, anytime you want.",
                  description:
                    "Tony delivers a synthesis statement that collapses doubt. He converts scattered elements—understanding the pattern, breathing/physiology, and prior successful exits, into one hard conclusion: she already demonstrated control. The language is deliberately absolute to prevent backsliding into \"maybe\" and \"but.\" This turns the story from \"I need rescuing\" into \"I've already done it,\" anchoring competence as evidence rather than as hope. From here, the next steps can be framed as training and repetition, not discovery.",
                  methodModelFramework: "Integration framing, competence consolidation",
                  function: "Anchoring agency as lived reality",
                  scientificReferenceFields: ["Self-Efficacy Research", "Integrative Learning"],
                  sortOrder: 2,
                },
                {
                  title: "Intervention 6.4: Authority Certainty Deconstruction",
                  timestampSec: 1576,
                  prompt:
                    "Maybe the doctor fits all those criteria or maybe just wears a white coat and that's enough for you to say with certainty it's the right thing.",
                  description:
                    "Tony returns to the authority loop because he knows it will try to reassert itself the moment change becomes real. He expands the argument by adding a sharper explanation: certainty is often borrowed from symbols (the coat, the status) rather than earned from understanding. He repeats the point with new detail to prevent the coachee from treating it as a clever one-liner; the repetition makes it a stable belief shift. The goal is not disrespect for doctors, but removal of outsourced certainty so the coachee can keep responsibility without needing permission.",
                  methodModelFramework: "Pattern repetition, authority deconstruction",
                  function: "Breaking rigid belief reinforcement",
                  scientificReferenceFields: [
                    "Authority Bias Research",
                    "Spaced Learning Effects",
                  ],
                  sortOrder: 3,
                },
                {
                  title: "Intervention 6.5: Social Proof with Normalization",
                  timestampSec: 1620,
                  prompt: "How many are thinking right now about yourself or someone you care about?",
                  description:
                    "Tony uses the audience to make the 'addiction' frame socially safe. The show of hands and the shared silence create a collective signal: this is common, human, and not isolating. That matters because shame would force denial, and denial would block change. The group response also functions as emotional regulation: the coachee feels held in a wider context, which lowers the threat of fully accepting the label and its implications.",
                  methodModelFramework: "Social proof, group normalization",
                  function: "Reducing shame and increasing acceptance",
                  scientificReferenceFields: ["Social Learning Theory", "Affective Co-Regulation"],
                  sortOrder: 4,
                },
                {
                  title: "Intervention 6.6: Self-Directed Proof by Logical Confirmation",
                  timestampSec: 1638,
                  prompt: "Tell me I'm wrong. Zero to ten, how certain are you…?",
                  description:
                    "Tony invites resistance on purpose, but he structures it so resistance produces evidence. By asking for a rating and demanding precision, he moves the coachee from vague disagreement into accountable thinking. The question format presupposes evaluation and forces her to confront her own certainty level, making inconsistencies visible. After emotional normalization through the audience, this logical step locks the insight in cognitively - she is no longer agreeing with Tony, she is agreeing with herself.",
                  methodModelFramework: "Presuppositional questioning, logical self-proof",
                  function: "Internal validation of the addiction frame",
                  scientificReferenceFields: [
                    "Socratic Questioning",
                    "Cognitive Consistency Research",
                  ],
                  sortOrder: 5,
                },
                {
                  title: "Intervention 6.7: Attachment Redirection (from Authority to Bonding)",
                  timestampSec: 1710,
                  prompt: "You're like, God or something. – I love you, Emmy.",
                  description:
                    "When the coachee idealizes Tony, she is trying to externalize safety onto him - classic dependency risk. Tony refuses the guru position without rejecting her, responding with warmth that meets the attachment need while keeping her autonomy intact. He then shifts the center of safety from 'the authority' to 'real relationship', and further distributes it by involving her mother. The result is calming without surrendering responsibility: she can feel supported without giving away agency.",
                  methodModelFramework: "Attachment redirection, bonding without dependency",
                  function: "Maintaining agency while reducing arousal",
                  scientificReferenceFields: [
                    "Attachment Theory",
                    "Social Bonding and Stress Regulation",
                  ],
                  sortOrder: 6,
                },
                {
                  title: "Intervention 6.8: Relational Social Proof (Mother Validation)",
                  timestampSec: 1742,
                  prompt: "Mom, how much of what I've said makes sense to you?",
                  description:
                    "Tony uses the mother as a trusted external validator. By returning briefly to content before moving into meaning, he reinforces credibility and prepares for deeper emotional integration.",
                  methodModelFramework: "Relational social proof",
                  function: "Reinforcing insight through trusted attachment",
                  scientificReferenceFields: ["Social Validation", "Attachment-Based Learning"],
                  sortOrder: 7,
                },
                {
                  title: "Intervention 6.9: Need-Based Attachment Reassignment",
                  timestampSec: 1749,
                  prompt: "Are you proud of her right now?",
                  description:
                    "Tony activates pride as an alternative payoff to fear. By linking bonding and pride, he directly addresses the underlying need previously met by panic, offering a healthier reward structure.",
                  methodModelFramework: "Need substitution, attachment priming",
                  function: "Replacing fear-based payoff with relational reward",
                  scientificReferenceFields: [
                    "Reward Substitution",
                    "Attachment and Motivation Research",
                  ],
                  sortOrder: 8,
                },
                {
                  title: "Intervention 6.10: Responsibility Reframing (Without Guilt)",
                  timestampSec: 1773,
                  prompt: "Everyone involved is innocent.",
                  description:
                    "Tony removes the moral trap that would keep the coachee stuck: if acceptance of the addiction frame equals guilt, she will resist it. By declaring innocence, he separates conditioning from culpability - past behavior can be understandable and still changeable. This allows responsibility to become empowering rather than crushing. The move prevents shame-based collapse and keeps the coachee in a forward-facing stance.",
                  methodModelFramework: "Responsibility reframing",
                  function: "Eliminating blame while preserving agency",
                  scientificReferenceFields: ["Moral Psychology", "Responsibility Attribution"],
                  sortOrder: 9,
                },
                {
                  title: "Intervention 6.11: Moral Commitment to Change Installation",
                  timestampSec: 1885,
                  prompt: "Once you know something different, you have to do something different.",
                  description:
                    "Tony turns insight into obligation. He tells a story that frames past action as reasonable given what was known, and then draws a moral line: new knowledge requires new behavior. This is not punishment; it is a rule that protects integrity and prevents rationalization. The intervention creates a clean internal standard so the coachee cannot hide behind confusion or 'maybe later'. It converts understanding into a personal contract.",
                  methodModelFramework: "Moral framing through narrative",
                  function: "Creating commitment to action",
                  scientificReferenceFields: ["Narrative Identity", "Moral Motivation Research"],
                  sortOrder: 10,
                },
                {
                  title: "Intervention 6.12: Solution Space Expansion",
                  timestampSec: 1929,
                  prompt: "And when it's a must, you find the way.",
                  description:
                    "After responsibility is accepted, Tony expands possibility. He reassures the coachee that there are multiple paths forward, which reduces fear of failure and prevents all-or-nothing thinking. The timing matters: he does not open the solution space before commitment, because options can become avoidance. Here, options become empowerment. Tony reassures that multiple paths to change exist, removing fear of failure.",
                  methodModelFramework: "Possibility framing",
                  function: "Reducing fear of change",
                  scientificReferenceFields: ["Hope Theory", "Motivational Psychology"],
                  sortOrder: 11,
                },
                {
                  title: "Intervention 6.13: Vulnerability-to-Strength Reframing",
                  timestampSec: 2000,
                  prompt: "You're helping because of your honesty.",
                  description:
                    "Tony redefines the coachee's vulnerability as contribution and competence. This reverses the old association where vulnerability triggered panic and self-doubt. By linking honesty to helping others, he installs meaning and pride around the very quality that used to feel dangerous. This strengthens identity integration: she can be open without collapsing, and intensity can serve connection rather than crisis.",
                  methodModelFramework: "Strength-based reframing",
                  function: "Integrating vulnerability into identity",
                  scientificReferenceFields: [
                    "Strength-Based Psychology",
                    "Post-Traumatic Growth",
                  ],
                  sortOrder: 12,
                },
                {
                  title: "Intervention 6.14: Problem-to-Advantage Reframing",
                  timestampSec: 2018,
                  prompt: "You have it at 23. That is awesome for your future. That's incredible.",
                  description:
                    "Tony reframes the problem from a deficit into a developmental advantage by placing it in a life-span perspective. By emphasizing the coachee's age, he shifts the meaning of the issue from 'something is wrong' to 'this is an opportunity to build critical skills early'. The intervention installs a future-oriented narrative in which mastering the current challenge becomes a source of strength, competence, and long-term advantage. This reframing reduces despair and resistance while aligning change with growth and possibility rather than loss.",
                  methodModelFramework: "Meaning reframing, future-oriented narrative installation",
                  function: "Transforming problem meaning from liability to developmental asset",
                  scientificReferenceFields: [
                    "Meaning-Making Research",
                    "Post-Adversity Growth",
                    "Developmental Psychology",
                  ],
                  sortOrder: 13,
                },
                {
                  title: "Intervention 6.15: Commitment Threshold Check",
                  timestampSec: 2030,
                  prompt: "So can you see you're addicted to Xanax?",
                  description:
                    "Tony asks for a direct yes/no acceptance to confirm that the frame has fully landed. This is a commitment threshold: if she cannot say it, the old escape routes are still active. If she can say it, the conversation can move from explanation to execution. The intervention is both diagnostic and consolidating - he tests readiness and simultaneously strengthens ownership by having her name the conclusion.",
                  methodModelFramework: "Commitment check",
                  function: "Confirming readiness for action",
                  scientificReferenceFields: ["Commitment and Consistency Principles"],
                  sortOrder: 14,
                },
                {
                  title: "Intervention 6.16: Risk-Based Decision Reframing",
                  timestampSec: 2049,
                  prompt: "What does it do to your biochemistry long term?",
                  description:
                    "Tony reframes the default path (staying on the medication as the safety strategy) as the higher-risk option. By emphasizing uncertainty and long-term consequences, he removes the illusion that 'doing nothing' is neutral. This is not fearmongering; it is a decision frame shift: avoiding change carries costs too. The intervention pushes the coachee toward action as the rational and responsible choice.",
                  methodModelFramework: "Risk reframing",
                  function: "Motivating action through rational evaluation",
                  scientificReferenceFields: ["Risk Perception", "Decision-Making Research"],
                  sortOrder: 15,
                },
              ],
            },
          },

          {
            title: "Phase 7: From Insight to Proof: Re-Entry Conditioning (Core Intervention 1)",
            description:
              "Tony turns insight into usable skill. He extracts the coachee's implicit competence in stopping panic, installs concrete state anchors, and exposes the micro-patterns that keep anxiety running - especially safety strategies like question stacking interruption and authority-based certainty. He then shifts into repeated, staged re-entry: the coachee generates the state on purpose, gets interrupted at the right threshold, and learns control in real time. The phase ends by consolidating meaning, future-pacing a new identity, and weakening the fear logic through counterfactual reframing.",
            startTime: 2072, // 34:32
            endTime: 3933, // 01:05:33
            sortOrder: 6,
            audioAssetUrl: MEDIA.audio.phase7,
            audioTriggerTime: 3933,
            interventions: {
              create: [
                {
                  title: "Intervention 7.1: Implicit Competence Extraction",
                  timestampSec: 2071,
                  prompt: "So how do you get out of it?",
                  description:
                    "Tony brings attention back to the fact that she already got herself out of panic without external rescue. He then starts to extract the *how* by asking for the steps, turning an implicit success into explicit, repeatable behavior. This creates a usable map for future self-regulation: she learns that stopping the cycle is something she can do on purpose, not something that randomly happens.",
                  methodModelFramework: "Pattern analysis, competence extraction within NAC",
                  function: "Making implicit competence explicit and repeatable",
                  scientificReferenceFields: [
                    "Skill Acquisition Research",
                    "Self-Efficacy (mastery recall)",
                    "Behavioral Chain Analysis",
                  ],
                  sortOrder: 0,
                },
                {
                  title: "Intervention 7.2: Narrative State Anchoring",
                  timestampSec: 2148,
                  prompt: "What kinda movie do you watch?",
                  description:
                    "Tony asks for a specific narrative stimulus that reliably evokes a more regulated emotional state. The movie becomes a practical state anchor because it is already linked to a calmer physiology and emotional tone. By using a familiar cue the coachee already responds to, Tony creates an accessible resource she can use to shift focus and regulate state without needing complex technique in the moment.",
                  methodModelFramework: "State anchoring, resource elicitation",
                  function:
                    "Creating fast access to a regulated state through an existing association",
                  scientificReferenceFields: [
                    "Associative Learning",
                    "Cue-Based Emotion Regulation",
                    "Attentional Control Mechanisms",
                  ],
                  sortOrder: 1,
                },
                {
                  title: "Intervention 7.3: Pattern Reveal",
                  timestampSec: 2174,
                  prompt:
                    "So notice she goes on a journey, on an adventure, which is what she wants for her own life.",
                  description:
                    "Tony makes the underlying structure visible by naming the archetypal pattern: the coachee is drawn to 'journey/adventure' as a way to meet needs through intensity and storyline. This reframes panic engagement as a misdirected form of what she already wants - movement, aliveness, and meaningful experience. By revealing the pattern beneath the symptoms, Tony prepares the ground for substitution: meeting needs through a healthier route rather than through anxiety escalation.",
                  methodModelFramework: "Pattern naming, meaning reframing",
                  function: "Making the hidden payoff-pattern conscious to enable replacement",
                  scientificReferenceFields: [
                    "Motivation Research",
                    "Narrative Identity",
                    "Reinforcement Patterns",
                  ],
                  sortOrder: 2,
                },
                {
                  title: "Intervention 7.4: Implicit Competence Reveal",
                  timestampSec: 2304,
                  prompt:
                    "So, but what do you do immediately in the moment when you think you're dying to stop?",
                  description:
                    "Tony increases resolution by forcing specificity: not 'what helps', but what she does immediately when the fear spikes. This pulls the intervention point closer to the onset of escalation and exposes the first controllable step in her sequence. By driving for precise actions and having her repeat/prototype them, Tony turns vague coping into an observable skill that can be trained and applied deliberately before the state takes over.",
                  methodModelFramework: "Micro-sequencing, behavioral chain decomposition",
                  function:
                    "Identifying exact interruption points and converting them into trainable behavior",
                  scientificReferenceFields: [
                    "Behavioral Analysis",
                    "Procedural Learning",
                    "Early-Interruption Models in Anxiety",
                  ],
                  sortOrder: 3,
                },
                {
                  title: "Intervention 7.5: Voluntary Re-Entry (Exposure Initiation 1)",
                  timestampSec: 2428,
                  prompt: "So, now do your panic attack",
                  description:
                    "Tony converts fear into a task by asking her to generate the state intentionally. This directly challenges avoidance, which typically maintains anxiety by making the feared state feel uncontrollable and dangerous. Voluntary entry shifts the frame from \"this happens to me\" to \"I can initiate it\", which is a direct route to \"I can stop it.\" The intervention is designed to create controllability at the physiological level, not just conceptual understanding.",
                  methodModelFramework: "Voluntary re-entry, exposure-with-control within NAC",
                  function:
                    "Reducing avoidance and establishing controllability through intentional activation",
                  scientificReferenceFields: [
                    "Exposure Principles",
                    "Inhibitory Learning",
                    "Avoidance-Maintenance Research",
                  ],
                  sortOrder: 4,
                },
                {
                  title: "Intervention 7.6: Trigger Identification via Probing Questions",
                  timestampSec: 2517,
                  prompt: "What was the trigger? … What was it that triggered the fear of dying?",
                  description:
                    "Tony uses targeted probing questions to isolate the ignition point: what specifically triggered the shift from arousal into 'I'm dying'. This forces the coachee to move from global panic to a concrete cause chain. The questions guide her to name the uncertainty underneath the fear, turning a vague terror into something identifiable and therefore workable.",
                  methodModelFramework: "Probing questions, causal chain mapping",
                  function: "Locating the trigger-to-meaning link that starts escalation",
                  scientificReferenceFields: [
                    "Cognitive Appraisal Research",
                    "Panic Trigger Models",
                    "Causal Attribution",
                  ],
                  sortOrder: 5,
                },
                {
                  title: "Intervention 7.7: Physiological Pattern Interrupt",
                  timestampSec: 2563,
                  prompt: "Change hands. Tell me, tell me this, using this hand.",
                  description:
                    "Tony notices rising arousal and interrupts the sequence immediately with an unusual, embodied instruction. The forced hand switch disrupts automaticity and breaks the momentum of escalation long enough to reintroduce control. The interruption is deliberately timed early, at the threshold, so the pattern is interrupted before it becomes self-sustaining.",
                  methodModelFramework: "Pattern interrupt, physiology-based disruption",
                  function:
                    "Stopping escalation by breaking the automatic sequence at the threshold",
                  scientificReferenceFields: [
                    "Attentional Reset Mechanisms",
                    "Arousal Interruption Timing",
                    "State-Dependent Learning",
                  ],
                  sortOrder: 6,
                },
                {
                  title: "Intervention 7.8: Pattern Explanation and Transfer",
                  timestampSec: 2745,
                  prompt:
                    "She has a pattern of how she gets certainty and part of it, she used that hand. She could still do it over here, but notice it fucked her up.",
                  description:
                    "Tony explains the interruption immediately to convert it from a momentary trick into a transferable insight. He links body behavior to certainty-seeking and shows that tiny procedural shifts can destabilize the whole pattern. By naming what he observed and what it did, Tony teaches the coachee how her own certainty-pattern operates and how it can be disrupted on purpose.",
                  methodModelFramework: "Making a distinction, pattern education",
                  function:
                    "Turning the interrupt into learnable, repeatable self-control knowledge",
                  scientificReferenceFields: [
                    "Psychoeducation Effects",
                    "Metacognitive Skill Building",
                    "Procedural Learning",
                  ],
                  sortOrder: 7,
                },
                {
                  title: "Intervention 7.9: Insight Validation and Reinforcement",
                  timestampSec: 2827,
                  prompt: "She had a breakthrough, ladies and gentlemen.",
                  description:
                    "Tony marks the moment publicly to increase emotional salience and reinforce learning. Recognition rewards the coachee for contact with truth and stabilizes the alliance by pairing insight with positive emotion. By amplifying it through the room, he helps lock the experience in as a meaningful win rather than a fragile observation.",
                  methodModelFramework: "Positive reinforcement, audience amplification",
                  function: "Consolidating learning through reward and salience",
                  scientificReferenceFields: [
                    "Reinforcement Learning",
                    "Social Reward",
                    "Motivation Research",
                  ],
                  sortOrder: 8,
                },
                {
                  title: "Intervention 7.10: Hard State Interrupt (Pacing Control)",
                  timestampSec: 2850,
                  prompt: "STOP!",
                  description:
                    "Tony uses a hard interrupt to break the rapid cognitive acceleration that comes from stacking questions without pausing. The purpose is pacing control: he stops the coachee from generating more threat than she can process. The interrupt resets attention and creates space for a single thread to be addressed, preventing the spiral from feeding itself.",
                  methodModelFramework: "State interrupt, pacing control",
                  function: "Halting cognitive flooding and restoring processing capacity",
                  scientificReferenceFields: [
                    "Cognitive Load Limits",
                    "Arousal Regulation",
                    "Attentional Gating",
                  ],
                  sortOrder: 9,
                },
                {
                  title: "Intervention 7.11: Symptom as Feedback Reframing",
                  timestampSec: 2951,
                  prompt:
                    "So you're going against life, which means life is gonna give you some uncomfortable experiences to wake you up.",
                  description:
                    "Tony reframes the coachee's symptoms as feedback rather than malfunction. By positioning anxiety as a corrective signal from life, he shifts the meaning of discomfort from threat to guidance. This removes the sense of being attacked by symptoms and replaces it with the idea that the experiences are information pointing toward a needed change in perspective or direction.",
                  methodModelFramework: "Meaning reframing, feedback frame",
                  function: "Transforming symptoms from threat into guidance",
                  scientificReferenceFields: [
                    "Cognitive Appraisal Theory",
                    "Resilience Framing",
                    "Meaning-Making Research",
                  ],
                  sortOrder: 10,
                },
                {
                  title: "Intervention 7.12: Existential Paradox Reframing",
                  timestampSec: 3027,
                  prompt:
                    "I'm gonna do everything I can to take care of myself. But in addition to that, I'm not gonna waste any of my time with having anxiety 'cause then I'm not here now to enjoy it.",
                  description:
                    "Tony introduces an existential rule that balances responsibility and presence. He separates reasonable self-care from compulsive anxiety and reframes anxiety as the true cost: wasted life-time. This paradox reduces over-control by anchoring behavior to values rather than fear, making presence the rational choice rather than avoidance.",
                  methodModelFramework: "Existential reframing, values-based rule installation",
                  function:
                    "Reducing anxiety maintenance through a values-based decision rule",
                  scientificReferenceFields: [
                    "Existential Psychology & Philosophy",
                    "Acceptance-Based Approaches",
                    "Values-Consistent Action",
                  ],
                  sortOrder: 11,
                },
                {
                  title:
                    "Intervention 7.13: Paradoxical Metaphor Literalization & Focus Shift",
                  timestampSec: 3071,
                  prompt:
                    "You've died many, many times in your head. To remind you to live fully and to enjoy this moment.",
                  description:
                    "Tony takes the coachee's implicit fear metaphor and makes it explicit, deliberately inflating it. What was previously experienced as 'feels like dying' is now stated as 'is dying'. This creates a clear paradox: while the coachee is afraid of death, she repeatedly enters states that subjectively feel like death itself. The intervention exposes this contradiction without arguing against the fear or trying to reassure her. By literalizing the metaphor, Tony reveals that the behavior intended to avoid death is simultaneously recreating it on an experiential level. This collapses the internal logic of the panic pattern and opens the space for a fundamental shift in meaning and choice. Then, he immediately reiterates the existential idea as a focus shift, positioning death not as a threat, but as a resource to remind her to enjoy life.",
                  methodModelFramework: "Cognitive contrast, threat reframing",
                  function: "Reducing catastrophic rehearsal and redirecting focus",
                  scientificReferenceFields: [
                    "Rumination Research",
                    "Cognitive Reappraisal",
                    "Attentional Control",
                  ],
                  sortOrder: 12,
                },
                {
                  title: "Intervention 7.14: Present Moment Grounding",
                  timestampSec: 3098,
                  prompt: "This moment we're in right now is the only moment that's real.",
                  description:
                    "Tony grounds the coachee by demoting imagined futures and reasserting the immediacy of the present. The statement functions as a simple orienting rule that interrupts projection-driven anxiety and stabilizes attention in current sensory reality.",
                  methodModelFramework: "Grounding, focus control",
                  function: "Interrupting projection and stabilizing present-moment awareness",
                  scientificReferenceFields: [
                    "Mindfulness Mechanisms",
                    "Attentional Anchoring",
                    "Anxiety Projection Models",
                  ],
                  sortOrder: 13,
                },
                {
                  title: "Intervention 7.15: Opportunity Frame Reinforcement",
                  timestampSec: 3145,
                  prompt: "Once you give yourself this gift",
                  description:
                    "Tony reactivates the opportunity frame by presenting change as a gift rather than a burden. The language implies that only a decision is required, not struggle. This reframing lowers perceived effort and aligns change with self-respect and growth.",
                  methodModelFramework: "Opportunity reframing, suggestion language",
                  function: "Increasing motivation by reducing perceived cost of change",
                  scientificReferenceFields: [
                    "Motivational Framing",
                    "Expectancy Effects",
                    "Cognitive Reappraisal",
                  ],
                  sortOrder: 14,
                },
                {
                  title: "Intervention 7.16: Meaning and Contribution Framing",
                  timestampSec: 3162,
                  prompt:
                    "I've helped many others live and then they help other people. And that's God's grace.",
                  description:
                    "Tony places the breakthrough into a transpersonal meaning frame. By linking personal change to contribution beyond the self, he stabilizes the experience and reduces ego-driven pressure to maintain control. Framing the moment as 'God's grace' positions change as legitimate and meant to be carried forward.",
                  methodModelFramework: "Meaning framing, contribution linkage",
                  function: "Embedding change in purpose to support integration",
                  scientificReferenceFields: [
                    "Meaning-Making Research",
                    "Purpose and Wellbeing Studies",
                    "Prosocial Motivation",
                  ],
                  sortOrder: 15,
                },
                {
                  title: "Intervention 7.17: Future Pacing",
                  timestampSec: 3172,
                  prompt: "If you really get this, here's what will happen…",
                  description:
                    "Tony projects the effects of the insight into the future, turning the breakthrough into a trajectory rather than a moment. Future pacing clarifies how the new understanding will show up in real situations and stabilizes identity around the upcoming behavior.",
                  methodModelFramework: "Future pacing, identity projection",
                  function: "Stabilizing change by linking it to a future self",
                  scientificReferenceFields: [
                    "Mental Simulation",
                    "Behavior Maintenance Research",
                    "Implementation Effects",
                  ],
                  sortOrder: 16,
                },
                {
                  title: "Intervention 7.18: Security Frame Establishment (Group Container)",
                  timestampSec: 3201,
                  prompt: "So we're all here to be mirrors for each other.",
                  description:
                    "Tony establishes a shared social container in which support is present but responsibility remains individual. The mirror metaphor normalizes exposure and learning while preventing dependency. Safety is increased without removing agency.",
                  methodModelFramework: "Group container, social safety framing",
                  function: "Increasing safety while preserving responsibility",
                  scientificReferenceFields: [
                    "Social Baseline Theory",
                    "Group Support Effects",
                    "Accountability Mechanisms",
                  ],
                  sortOrder: 17,
                },
                {
                  title: "Intervention 7.19: Re-Entry Protocol Setup",
                  timestampSec: 3263,
                  prompt:
                    "I'm going to ask you to go into that state and then come out of it very quickly.",
                  description:
                    "Tony sets the structure for proof: deliberate entry followed by deliberate exit. By framing re-entry as brief and reversible, he reduces anticipatory threat while establishing a high standard for control. This marks the transition from insight to procedural certainty.",
                  methodModelFramework: "Re-entry protocol setup, exposure-with-control within NAC",
                  function: "Preparing proof of controllability through structured re-entry",
                  scientificReferenceFields: [
                    "Exposure Principles",
                    "Inhibitory Learning",
                    "Mastery Experience Consolidation",
                  ],
                  sortOrder: 18,
                },
                {
                  title: "Intervention 7.20: Commitment Elicitation",
                  timestampSec: 3314,
                  prompt: "Are you willing to do this?",
                  description:
                    "Tony asks for explicit consent to convert cooperation into commitment. The question closes escape routes and establishes responsibility in the moment. Willingness transforms the next step from something happening to her into something she chooses.",
                  methodModelFramework: "Commitment installation",
                  function: "Increasing ownership and follow-through before exposure",
                  scientificReferenceFields: [
                    "Commitment and Consistency Research",
                    "Verbal Commitment Effects",
                  ],
                  sortOrder: 19,
                },
                {
                  title: "Intervention 7.21: Environmental Safety Framing",
                  timestampSec: 3331,
                  prompt: "And notice you're here in a very safe place",
                  description:
                    "Tony reinforces environmental safety immediately before deeper re-entry. This framing reduces anticipatory threat and stabilizes arousal without removing responsibility. The safety cue functions as containment, allowing voluntary engagement with the feared state rather than avoidance or flooding.",
                  methodModelFramework: "Safety framing, containment setup",
                  function: "Reducing anticipatory arousal while preserving voluntary approach",
                  scientificReferenceFields: [
                    "Arousal Regulation",
                    "Contextual Safety Cues",
                    "Exposure Readiness Research",
                  ],
                  sortOrder: 20,
                },
                {
                  title: "Intervention 7.22: Pattern Consolidation and Ownership Transfer",
                  timestampSec: 3365,
                  prompt:
                    "Was an adaptive behavior. Something happened, you didn't know how to deal with it.… So now you've grown up, you've outgrown the pattern.",
                  description:
                    "Tony compresses the session's core learning into a developmental narrative. He frames the pattern as once adaptive and now outdated, removing shame while legitimizing change. By speaking in the coachee's voice, he increases ownership and reduces friction in integration, turning insight into a personal statement she can carry forward.",
                  methodModelFramework: "Pattern consolidation, ownership scripting",
                  function: "Stabilizing understanding and transferring ownership",
                  scientificReferenceFields: [
                    "Narrative Consolidation",
                    "Reattribution Theory",
                    "Habit Change Models",
                  ],
                  sortOrder: 21,
                },
                {
                  title: "Intervention 7.23: Re-Entry Activation",
                  timestampSec: 3414,
                  prompt:
                    "So let's do it. Put yourself in the car, okay? And start the process that produces that anxiety.",
                  description:
                    "Tony initiates re-entry in a realistic context, instructing the coachee to generate the state the way it normally occurs. This increases ecological validity and trains control under conditions that mirror real life. Difficulty is reframed as useful data, reinforcing that the state is produced by a sequence, not fate.",
                  methodModelFramework: "Contextual re-entry, procedural exposure",
                  function: "Training controllability within a realistic trigger context",
                  scientificReferenceFields: [
                    "Contextual Learning",
                    "Exposure Generalization",
                    "Procedural Activation",
                  ],
                  sortOrder: 22,
                },
                {
                  title: "Intervention 7.24: Hypnotic Resource Activation",
                  timestampSec: 3451,
                  prompt: "Close your eyes just for a moment and…",
                  description:
                    "Tony reduces analytical interference and recruits implicit self-regulation by narrowing attention inward. The instruction increases receptivity to suggestion, stabilizes arousal, and primes inner support and meaning. This prepares the nervous system to face activation without immediate cognitive struggle.",
                  methodModelFramework: "Guided focus, suggestion-based resource activation",
                  function: "Increasing internal support and readiness for re-entry",
                  scientificReferenceFields: [
                    "Hypnotic Suggestion Mechanisms",
                    "Attentional Absorption",
                    "State Modulation",
                  ],
                  sortOrder: 23,
                },
                {
                  title: "Intervention 7.25: 1st Re-Entry Reactivation & Progress Pacing",
                  timestampSec: 3554,
                  prompt: "You're starting to get ready. I see. Go ahead and do it.",
                  description:
                    "Tony marks progress to sustain engagement and prevent self-doubt from interrupting the process. The confirmation normalizes activation and reinforces intentional state generation, maintaining approach behavior under guidance.",
                  methodModelFramework: "Pacing and leading, progress reinforcement",
                  function: "Maintaining engagement during activation",
                  scientificReferenceFields: [
                    "Exposure Adherence",
                    "Coaching Reinforcement",
                    "Motivational Scaffolding",
                  ],
                  sortOrder: 24,
                },
                {
                  title: "Intervention 7.26: Reframing Insecurity with Humor",
                  timestampSec: 3575,
                  prompt: "Look at her. Look at her practicing her skills. Give her a hand.",
                  description:
                    "Tony reframes being observed from threat into deliberate skill practice. Public recognition converts insecurity into mastery and attaches pride to exposure. Humor and applause reduce social threat while reinforcing competence.",
                  methodModelFramework: "Social reinforcement, mastery framing",
                  function: "Reducing social evaluative threat and reinforcing skill identity",
                  scientificReferenceFields: [
                    "Social Evaluative Threat Research",
                    "Reinforcement Learning",
                    "Self-Efficacy",
                  ],
                  sortOrder: 25,
                },
                {
                  title: "Intervention 7.27: 2nd Re-Entry Reactivation & Amplified Activation",
                  timestampSec: 3616,
                  prompt:
                    "Go ahead, but do it the way you do it, which is, make it bigger. You're in your car.",
                  description:
                    "Tony instructs authentic pattern activation to ensure transfer to real life, while controlling timing so escalation remains manageable. By activating the pattern without allowing takeover, the coachee learns early interruption and regulation while the state is online, increasing future accessibility of the new response.",
                  methodModelFramework:
                    "Authentic pattern activation with guided threshold control",
                  function: "Training control while the pattern is active but contained",
                  scientificReferenceFields: [
                    "State-Dependent Learning",
                    "Exposure Titration",
                    "Inhibitory Learning",
                  ],
                  sortOrder: 26,
                },
                {
                  title: "Intervention 7.28: Threshold Interruption and Downshift",
                  timestampSec: 3674,
                  prompt: "Okay, so slow down, slow down.",
                  description:
                    "Tony interrupts at the precise threshold as anxiety questions begin to accelerate. He downshifts arousal through timing, proximity, and relational contact, turning the interruption itself into live practice of stopping the attack at the right moment.",
                  methodModelFramework: "Threshold interrupt, relational downshift",
                  function: "Preventing full escalation while teaching the stop-point",
                  scientificReferenceFields: [
                    "Arousal Escalation Models",
                    "Co-Regulation",
                    "Interruption Timing",
                  ],
                  sortOrder: 27,
                },
                {
                  title: "Intervention 7.29: Victory Future Pacing and Emotional Conditioning",
                  timestampSec: 3720,
                  prompt: "So I want you to imagine the victory of your life",
                  description:
                    "Tony installs a high-intensity success image to compete with fear imagery. The visualization redirects emotional intensity toward mastery and pride. He briefly reintroduces the death theme with a different emotional tone to consolidate existential insight without threat.",
                  methodModelFramework: "Guided visualization, emotional conditioning",
                  function: "Conditioning pride and certainty as the new default intensity",
                  scientificReferenceFields: [
                    "Mental Imagery",
                    "Emotional Conditioning",
                    "Motivation and Reward Research",
                  ],
                  sortOrder: 28,
                },
                {
                  title: "Intervention 7.30: Counterfactual Fear Reframing",
                  timestampSec: 3866,
                  prompt:
                    "So I'm curious what would happen if death was something that's gonna happen a long time from now and when it happens, it was gonna be beautiful and you were gonna be connected to everything you love.",
                  description:
                    "Tony introduces a hypothetical sequence to test the logic of fear. By changing imagined conditions, he demonstrates that anxiety is conditional on interpretation, not inevitable. This dismantles catastrophic prediction and increases cognitive-emotional flexibility.",
                  methodModelFramework: "Counterfactual reframing, meaning shift",
                  function:
                    "Weakening catastrophic prediction and increasing interpretive flexibility",
                  scientificReferenceFields: [
                    "Cognitive Reappraisal",
                    "Counterfactual Thinking",
                    "Catastrophic Misinterpretation Research",
                  ],
                  sortOrder: 29,
                },
              ],
            },
          },

          {
            title: "Phase 8: Integration and Consolidation for Final Re-Entry (Core Intervention 2)",
            description:
              "Tony stabilizes the breakthroughs achieved under activation by integrating them emotionally, relationally, and meaningfully. The focus shifts from skill execution to consolidation: new states are rewarded, socially mirrored, and emotionally differentiated. Rather than adding new techniques, Tony holds space for the nervous system to register safety, pride, and aliveness as the new default. This prepares the ground for the final re-entry, where the coachee is first experiencing the proof of control and, second, that this is desired, valued, and socially rewarded.",
            startTime: 3933, // 01:05:33
            endTime: 4979, // 01:22:59
            sortOrder: 7,
            audioAssetUrl: MEDIA.audio.phase8,
            audioTriggerTime: 4979,
            interventions: {
              create: [
                {
                  title: "Intervention 8.1: Values-Based State Consolidation",
                  timestampSec: 3919,
                  prompt: "So all I believe is we're here to live fully.",
                  description:
                    "Tony steps out of technical intervention mode and into a values-based frame. By widening the focus from symptom control to living fully, he prevents the work from collapsing back into fear management. The message connects regulation with life orientation, not avoidance. Through applause and shared emotional intensity, Tony anchors the insight with reward. He then deliberately refrains from further instruction, allowing music, touch, and collective joy to prolong positive arousal. This extended state-holding stabilizes the new pattern through emotional integration rather than cognitive reinforcement.",
                  methodModelFramework: "Values framing, emotional state consolidation",
                  function: "Stabilizing change by linking regulation to meaning and reward",
                  scientificReferenceFields: [
                    "Affective Consolidation",
                    "Reward-Based Learning",
                    "Values-Driven Behavior Change",
                  ],
                  sortOrder: 0,
                },
                {
                  title: "Intervention 8.2: Attachment-Anchored Social Validation",
                  timestampSec: 4446,
                  prompt: "Hi mom. How are you feeling right now?",
                  description:
                    "Tony shifts validation from the coachee's internal experience to primary attachment mirroring. By inviting the mother to reflect her state, pride replaces fear as the dominant emotional payoff. The change is no longer self-assessed but socially witnessed. This anchors the new state relationally, increasing stability and reducing the risk of self-doubt-driven relapse.",
                  methodModelFramework: "Social proof through attachment mirroring",
                  function: "Stabilizing change via relational validation",
                  scientificReferenceFields: [
                    "Attachment Theory",
                    "Social Regulation of Emotion",
                    "Interpersonal Neurobiology",
                  ],
                  sortOrder: 1,
                },
                {
                  title: "Intervention 8.3: Contrastive State Encoding",
                  timestampSec: 4567,
                  prompt:
                    "And how does that compare to when she's scared because she thinks you can't breathe?",
                  description:
                    "Tony deliberately contrasts two emotional states: shared safety and pride versus panic and fear. This sharpens emotional discrimination, allowing the nervous system to clearly register which state is preferable. By explicitly naming the contrast, Tony strengthens memory encoding of the non-anxious state and increases motivation to choose it in the future.",
                  methodModelFramework: "Contrast framing, emotional discrimination",
                  function: "Strengthening memory and preference for the regulated state",
                  scientificReferenceFields: [
                    "Affective Learning",
                    "Contrast Effects",
                    "Emotional Memory Consolidation",
                  ],
                  sortOrder: 2,
                },
                {
                  title: "Intervention 8.4: 3rd (final) Re-Entry Reactivation",
                  timestampSec: 4601,
                  prompt: "So close your eyes, walk yourself through it.",
                  description:
                    "Tony initiates the final preparatory re-entry. He carefully secures the coachee before activation and later guides her back out, reinforcing the experience of success and control. At this stage, re-entry is no longer exploratory but confirmatory: it prepares the nervous system for the final proof moment by combining safety, agency, and repetition without escalation.",
                  methodModelFramework: "Guided re-entry rehearsal",
                  function:
                    "Preparing the nervous system for final proof through controlled reactivation",
                  scientificReferenceFields: [
                    "State Rehearsal",
                    "Exposure Preparation",
                    "Mastery Consolidation",
                  ],
                  sortOrder: 3,
                },
              ],
            },
          },

          {
            title: "Phase 9: Stabilisation through Creating Primary Questions and Scrambling",
            description:
              "Tony stabilizes change at the cognitive level by intervening directly at the level of the primary questions, which automatically organize attention, interpretation, and emotional response. Rather than relying on state control alone, he targets the linguistic structures that previously generated fear and uncertainty. By installing a new primary question and deliberately scrambling the old one, Tony disrupts habitual meaning-making and establishes a more adaptive attentional default that supports long-term stability.",
            startTime: 4979, // 01:22:59
            endTime: 5668, // 01:34:28
            sortOrder: 8,
            audioAssetUrl: MEDIA.audio.phase9,
            audioTriggerTime: 5668,
            interventions: {
              create: [
                {
                  title: "Intervention 9.1: Primary Question Installation",
                  timestampSec: 5181,
                  prompt: "So let's come up with a new question.",
                  description:
                    "Tony targets the deepest driver of recurring emotional patterns: the primary question the coachee habitually asks herself. By making the question explicit, he shifts it from an unconscious organizer of experience into a conscious object of choice. This prepares the ground for replacing a fear-based inquiry with a generative one, ensuring that regulation is sustained not only through physiological control but through a fundamentally different cognitive orientation.",
                  methodModelFramework: "Primary question framework",
                  function: "Reorganizing attention and meaning at the cognitive level",
                  scientificReferenceFields: [
                    "Attentional Control",
                    "Cognitive Schemas",
                    "Question-Based Self-Regulation",
                  ],
                  sortOrder: 0,
                },
                {
                  title: "Intervention 9.2: Scrambling for Linguistic Deautomation",
                  timestampSec: 5427,
                  prompt:
                    "You gotta scramble it when you say it. So when you hear it in the future, it'll never work the same way.",
                  description:
                    "Tony deliberately disrupts the automatic emotional charge of the old primary question by scrambling its structure, tone, and sequencing. This breaks the learned coupling between language and effect. As a result, the brain can no longer run the familiar emotional program, creating prediction error and weakening the underlying neural association. This opens a window for reconsolidation and lasting change.",
                  methodModelFramework: "Linguistic pattern interrupt, scrambling",
                  function: "De-automating fear-linked language patterns",
                  scientificReferenceFields: [
                    "Memory Reconsolidation",
                    "Prediction Error",
                    "Affect–Language Coupling",
                  ],
                  sortOrder: 1,
                },
                {
                  title: "Intervention 9.3: Attentional Reorientation through Question Testing",
                  timestampSec: 5659,
                  prompt:
                    "You see that the test of your question is what does it do to you? There's no right or wrong question.",
                  description:
                    "Tony explicitly tests the impact of the new primary question on the coachee's state. Rather than evaluating the question for correctness, he evaluates it for effect. This step functions as a selection mechanism: the nervous system learns which question produces regulation, presence, and openness. This consolidates attentional preference and ensures the new question is chosen because it works, not because it sounds good.",
                  methodModelFramework: "Attentional testing, state-based validation",
                  function: "Selecting and stabilizing the most adaptive attentional habit",
                  scientificReferenceFields: [
                    "Affective Feedback Loops",
                    "Experiential Learning",
                    "Attentional Bias Modification",
                  ],
                  sortOrder: 2,
                },
              ],
            },
          },

          {
            title: "Phase 10: Consolidation of Insight & Ownership",
            description:
              "Tony consolidates the change by locking agency and ownership at the identity level. Tony prevents dependency and transference by explicitly rejecting the idea that change was caused by him. Instead, he sharpens language and attribution so the coachee experiences the breakthrough as self-generated. This verbal precision here is not merely intellectual: it is a structural tool for ensuring durability.",
            startTime: 5668, // 01:34:28
            endTime: 5822, // 01:37:02
            sortOrder: 9,
            audioAssetUrl: MEDIA.audio.phase10,
            audioTriggerTime: 5822,
            interventions: {
              create: [
                {
                  title: "Intervention 10.1: Ownership Reattribution",
                  timestampSec: 5700,
                  prompt: "No, you cured you, but go ahead.",
                  description:
                    "Tony interrupts the attribution of change to himself and immediately returns ownership to the coachee. This sharp correction prevents dependency and guru dynamics. By locking agency at the identity level, the change is encoded as a self-generated capability rather than externally induced help, which is critical for long-term stability and relapse prevention.",
                  methodModelFramework: "Agency installation, responsibility framing",
                  function: "Preventing transference and stabilizing self-efficacy",
                  scientificReferenceFields: [
                    "Self-Efficacy Theory",
                    "Attribution Theory",
                    "Autonomy-Supportive Intervention",
                  ],
                  sortOrder: 0,
                },
                {
                  title:
                    "Intervention 10.2: Precision Reinforcement through Repeated Verbal Mirroring",
                  timestampSec: 5714,
                  prompt: "Actually, I hope you take that in. You cured you.",
                  description:
                    "Tony repeats the coachee's statement with minimal but decisive precision. This is linguistic sharpening. By mirroring the reverted coachee's statement (from \"you cured me\" to \"you cured you\"), he removes ambiguity and soft attribution, ensuring ownership is encoded without dilution. Precision in repetition here functions as consolidation, not explanation.",
                  methodModelFramework: "Verbal mirroring, linguistic precision",
                  function: "Encoding ownership without ambiguity",
                  scientificReferenceFields: [
                    "Language-Based Encoding",
                    "Self-Referential Processing",
                    "Memory Consolidation",
                  ],
                  sortOrder: 1,
                },
                {
                  title: "Intervention 10.3: Identity- & Competence-Based Future Projection",
                  timestampSec: 5727,
                  prompt:
                    "Weren't you already the person that was curing yourself throughout the years? All I do is help you remember it.",
                  description:
                    "Tony reframes the change not as something newly acquired but as an expression of an identity, including the sufficient competence that already existed. It just needed to be 'remembered'. By projecting identity before behavior, he stabilizes the change at the deepest level. The future is anchored in continuity rather than effort, reducing internal resistance and self-doubt. Tony closes the entire process by giving it a coherent narrative arc. The problem, the struggle, and the resolution are unified into a single story of rediscovery. This narrative closure re-encodes the experience in autobiographical memory, increasing coherence, meaning, and long-term retention of the change.",
                  methodModelFramework:
                    "Identity-first framing, Re-encoding the experience as a completed transformation",
                  function:
                    "Stabilizing change through identity continuity, Re-encoding the experience as a completed transformation",
                  scientificReferenceFields: [
                    "Identity-Based Motivation",
                    "Self-Concept Stability",
                    "Narrative Identity",
                    "Autobiographical Memory",
                    "Narrative Coherence",
                    "Meaning-Making Processes",
                  ],
                  sortOrder: 2,
                },
                {
                  title: "Intervention 10.4: Symptom Differentiation (Anxiety ≠ Panic)",
                  timestampSec: 5746,
                  prompt: "You will get anxious, but you won't have panic.",
                  description:
                    "Tony introduces a precise distinction between anxiety and panic to prevent all-or-nothing thinking. Instead of promising the absence of discomfort, he normalizes anxiety as a part of life while clearly separating it from panic as a dysregulated state. This differentiation reduces catastrophic expectation and removes the false requirement of complete emotional elimination. By clarifying that anxiety can occur without escalating into panic, Tony installs a realistic, controllable frame that supports confidence, resilience, and sustained agency.",
                  methodModelFramework: "Symptom differentiation, cognitive distinction framing",
                  function:
                    "Reducing catastrophic expectation by separating normal arousal from pathological escalation",
                  scientificReferenceFields: [
                    "Affective Differentiation",
                    "Cognitive Appraisal Theory",
                    "Panic Disorder Maintenance Models",
                  ],
                  sortOrder: 3,
                },
                {
                  title: "Intervention 10.5: Meaning-Based Focus Redirection",
                  timestampSec: 5766,
                  prompt: "When you think about death, what could you do?",
                  description:
                    "Tony revisits and repeats the topic of death one final time, but now uses it as a cue for intentional focus rather than fear. Instead of treating death as a trigger for anxiety, he reframes it as a reminder to consciously choose how to live in the present. The question redirects attention from catastrophic projection to value-driven action. By doing so, Tony completes the transformation of death from a threat stimulus into a functional orienting signal that activates presence, appreciation, and engagement with life.",
                  methodModelFramework: "Meaning-based attentional redirection",
                  function:
                    "Converting a former fear trigger into a cue for value-aligned focus and action",
                  scientificReferenceFields: [
                    "Attentional Control",
                    "Meaning-Making Processes",
                    "Existential Psychology",
                  ],
                  sortOrder: 4,
                },
              ],
            },
          },

          {
            title: "Phase 11: Identity and Future Anchoring",
            description:
              "In Phase 11, Tony stabilizes the change by anchoring it in identity and future expression. By asking what lesson the coachee would give her kindergarteners, he turns insight into something that can be carried forward and lived in everyday roles. At the same time, he emphasizes that the real transmission happens through who she is rather than what she says. Together, these moves ensure that the change is embodied and sustained beyond the session. Tony closes the session with social affirmation by inviting the audience to acknowledge her and sealing the moment with physical closeness through a hug, reinforcing safety, belonging, and completion.",
            startTime: 5822, // 01:37:02
            endTime: 5882,
            sortOrder: 10,
            audioAssetUrl: MEDIA.audio.phase11,
            audioTriggerTime: 5882,
            interventions: {
              create: [
                {
                  title: "Intervention 11.1: Teach-Back Identity Anchoring",
                  timestampSec: 5839,
                  prompt: "What's the lesson you want to give your kindergarteners now?",
                  description:
                    "Tony shifts the focus from personal insight to contribution by asking the coachee to translate her experience into a lesson she would teach others. Teach-Back is the learning you realize through teaching. This forces integration through articulation: the insight must now be clear, usable, and embodied enough to be passed on. By placing the learning in a teaching role, Tony anchors the change in identity rather than in a temporary emotional state. The coachee is no longer positioned as someone who overcame a problem, but as someone who stands for a principle and can transmit it. This stabilizes the change by embedding it in a future-facing social role.",
                  methodModelFramework: "Teach-back integration, role-based identity anchoring",
                  function:
                    "Consolidating change by translating insight into responsibility and contribution",
                  scientificReferenceFields: [
                    "Protégé Effect (learning by teaching)",
                    "Identity-Based Motivation",
                    "Elaborative Retrieval and Memory Consolidation",
                  ],
                  sortOrder: 0,
                },
                {
                  title: "Intervention 11.2: Embodied Identity Priming",
                  timestampSec: 5860,
                  prompt:
                    "No matter what she says, who she is is a bigger lesson than what she says her way of being will be the teacher here",
                  description:
                    "Tony emphasizes that transformation is not transmitted through explanation but through embodiment. By highlighting that who she is matters more than what she says, he establishes a norm: the new identity is meant to be lived, not performed or taught cognitively. This primes the coachee to express the change implicitly through presence, behavior, and emotional tone. The intervention stabilizes integration by shifting responsibility away from correct messaging and toward authentic being.",
                  methodModelFramework: "Identity priming, modeling frame",
                  function:
                    "Stabilizing change by anchoring it at the level of embodiment rather than instruction",
                  scientificReferenceFields: [
                    "Social Learning Theory",
                    "Embodied Cognition",
                    "Implicit Modeling Effects",
                  ],
                  sortOrder: 1,
                },
                {
                  title: "Intervention 11.3: Pressure Release Framing (Exploratory Permission)",
                  timestampSec: 5875,
                  prompt:
                    "There's no perfect answer and I'll put you on the spot. I'm just curious what thoughts you start to have.",
                  description:
                    "Tony explicitly removes performance pressure by clarifying that no correct answer is expected. By framing the question as curiosity rather than evaluation, he shifts the coachee from self-monitoring into exploration. This lowers social threat and cognitive load, allowing associative thinking, creativity, and genuine insight to emerge. The intervention widens the solution space and supports integration by inviting playfulness and brainstorming instead of precision or correctness.",
                  methodModelFramework: "Pressure release framing, permissive inquiry",
                  function:
                    "Reducing evaluative stress to enable creative exploration and authentic expression",
                  scientificReferenceFields: [
                    "Psychological Safety",
                    "Creativity Research",
                    "Threat Reduction and Prefrontal Flexibility",
                  ],
                  sortOrder: 2,
                },
              ],
            },
          },
        ],
      },

      scienceItems: {
        create: [
          {
            name: "Symptoms as Competence",
            description: "Why Symptoms Make Sense: A Resource- and Competence-Oriented View on Panic and Anxiety",
            timestampsSec: [300, 450, 540, 720],
            sortOrder: 0,
            content: {
              title: "#1 Symptoms as Competence",
              subtitle: "Why Symptoms Make Sense: A Resource- and Competence-Oriented View on Panic and Anxiety",
              sections: [
                {
                  heading: "Symptoms as Adaptive Solutions",
                  content: "Repeated emotional and physiological patterns do not emerge randomly. Learning theory and affective neuroscience show that behaviors and internal states are stabilized when they reduce perceived threat or restore equilibrium—even if the long-term cost is high.",
                  items: [
                    {
                      text: "A panic attack, for example, provides:",
                      subItems: [
                        "rapid mobilization of energy (fight-or-flight)",
                        "extreme attentional narrowing",
                        "heightened bodily monitoring",
                        "a strong sense of certainty (\"something is happening, I know what this is\")",
                      ],
                    },
                  ],
                },
                {
                  heading: "Neurobiological Stabilization of Symptoms",
                  content: "Neuroimaging and neurophysiological studies demonstrate that anxiety and panic are associated with recurrent activation patterns involving the amygdala, insula, brainstem nuclei, and prefrontal regions responsible for threat appraisal and interoception.",
                },
                {
                  heading: "Secondary Gain and Emotional Regulation",
                  content: "Clinical research consistently shows that symptoms often provide so-called secondary gains—not consciously intended benefits such as:",
                  items: [
                    {
                      text: "predictability and control",
                    },
                    {
                      text: "protection from overwhelming demands",
                    },
                    {
                      text: "relational proximity or care",
                    },
                    {
                      text: "stabilization of identity (\"this explains me\")",
                    },
                  ],
                },
                {
                  heading: "Why Pathologizing Fails",
                  content: "Approaches that frame symptoms as defects or enemies tend to increase internal threat perception and defensive rigidity. In contrast, competence-oriented models align with empirical findings showing that change becomes possible only when the underlying regulatory function is acknowledged and replaced, not suppressed.",
                  items: [
                    {
                      text: "Lasting transformation requires:",
                      subItems: [
                        "identifying the function the symptom fulfills",
                        "recognizing the competence embedded in that function",
                        "developing alternative strategies that meet the same regulatory needs with lower cost",
                      ],
                    },
                  ],
                },
                {
                  heading: "Implications for Change",
                  content: "From a scientific standpoint, symptoms disappear when they become unnecessary, not when they are fought. When the nervous system learns new, equally reliable ways to create safety, predictability, and regulation, old patterns lose their adaptive value.",
                },
              ],
              references: [
                {
                  text: "Gross, J. J. (2015). Emotion regulation: Current status and future prospects. Psychological Inquiry, 26(1), 1–26.",
                  url: "https://doi.org/10.1080/1047840X.2014.940781",
                },
                {
                  text: "Phelps, E. A., & LeDoux, J. E. (2005). Contributions of the amygdala to emotion processing: From animal models to human behavior. Neuron, 48(2), 175–187.",
                  url: "https://doi.org/10.1016/j.neuron.2005.09.025",
                },
                {
                  text: "Bouton, M. E. (2007). Learning and behavior: A contemporary synthesis. Annual Review of Psychology, 58, 219–245.",
                  url: "https://doi.org/10.1146/annurev.psych.58.110405.085542",
                },
                {
                  text: "Paulus, M. P., & Stein, M. B. (2010). Interoception in anxiety and depression. Brain Structure and Function, 214(5–6), 451–463.",
                  url: "https://doi.org/10.1007/s00429-010-0258-9",
                },
                {
                  text: "Carver, C. S., & Scheier, M. F. (1990). Origins and functions of positive and negative affect: A control-process view. Psychological Review, 97(1), 19–35.",
                  url: "https://doi.org/10.1037/0033-295X.97.1.19",
                },
                {
                  text: "McEwen, B. S. (2007). Physiology and neurobiology of stress and adaptation. Physiological Reviews, 87(3), 873–904.",
                  url: "https://doi.org/10.1152/physrev.00041.2006",
                },
              ],
            },
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
