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

  // Create the lesson
  const lesson = await prisma.lesson.create({
    data: {
      title: "Tony Robbins: Panic Pattern Coaching Session",
      description:
        "Tony brings the coachee into the framework of the 8 Levels of Consciousness and helps her understand and transform her panic pattern through structured interventions.",
      videoUrl: MEDIA.video,
      duration: 5882, // ~1h 38min (last phase ends around 1:37:02 + some buffer)

      phases: {
        create: [
          // Phase 1: Introduction and Positioning in Model (Framing & Priming)
          {
            title: "Phase 1: Introduction and Positioning in Model",
            description:
              "Tony brings the coachee into the framework of the 8 Levels of Consciousness and asks her to place herself within it. As the conversation unfolds, he notices that her self-placement does not match what she is actually experiencing. That mismatch signals that there is something deeper going on. Rather than staying with the model as a teaching tool, Tony uses it to listen more closely and shifts the focus away from labels toward the lived experience.",
            startTime: 33, // 00:33
            endTime: 130, // 02:10
            sortOrder: 0,
            audioAssetUrl: MEDIA.audio.phase1,
            audioTriggerTime: 40,
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
                  prompt:
                    "Okay. Either beige or yellow. That's quite a broad stroke. Okay.",
                  description:
                    "Tony highlights an internal inconsistency in the coachee's self-assessment while deliberately embedding the contradiction in humor. This allows him to challenge the accuracy of her cognitive mapping without triggering defensiveness or shame. Humor functions as a status-preserving softener: the inconsistency is exposed, but the coachee's dignity and emotional safety remain intact. Humor lowers the perceived threat and increases cognitive flexibility, creating a brain state that is more receptive to learning and updating existing patterns.",
                  methodModelFramework:
                    "Humor framing, rapport-preserving 'pattern break'",
                  function: "Soft contradiction without threat",
                  scientificReferenceFields: [
                    "Social Psychology (Face-Saving Mechanisms)",
                    "Cognitive Dissonance Theory",
                    "Affective Neuroscience (humor and threat reduction)",
                  ],
                  sortOrder: 1,
                },
                {
                  title: "Intervention 1.3: Audience-Directed Meta-Framing",
                  timestampSec: 91, // 00:01:31
                  prompt: "[Addressing the audience about the process]",
                  description:
                    "Tony temporarily redirects his explanation away from the coachee and toward the audience, describing what is happening and why it matters. By doing so, he externalizes the intervention and removes the coachee from the position of being directly corrected or analyzed. This shift lowers self-consciousness and psychological resistance, while simultaneously increasing the coachee's sense of safety and social inclusion. The coachee becomes an observer of her own process rather than its target.",
                  methodModelFramework:
                    "Making a distinction, teaching the room",
                  function: "Resistance reduction",
                  scientificReferenceFields: [
                    "Cognitive Linguistics (Conceptual Metaphor Theory)",
                    "Psycholinguistics",
                    "Cognitive-Behavioral Therapy (language and emotional regulation)",
                  ],
                  sortOrder: 2,
                },
                {
                  title: "Intervention 1.4: Metaphor Deconstruction",
                  timestampSec: 91, // 00:01:31 (same as 1.3)
                  prompt: "Remember, people use metaphors all the time.",
                  description:
                    "Tony explicitly separates metaphorical language from literal physiological reality. By doing so, he prevents symbolic expressions such as 'survival' from being treated as factual descriptions of the nervous system's state. This intervention reduces emotional amplification caused by metaphor inflation and dismantles implicit identity claims embedded in language. By restoring semantic precision, Tony weakens the cognitive legitimacy of the fear narrative before engaging in deeper experiential work.",
                  methodModelFramework: "Deconstruction of Global Metaphor",
                  function: "Semantic precision, identity loosening",
                  scientificReferenceFields: [
                    "Cognitive Linguistics (Conceptual Metaphor Theory)",
                    "Psycholinguistics",
                    "Cognitive-Behavioral Therapy (language and emotional regulation)",
                  ],
                  sortOrder: 3,
                },
                {
                  title:
                    "Intervention 1.5: State Interruption with Agency Reframing",
                  timestampSec: 125, // 00:02:05
                  prompt:
                    "Oh, come here. We're gonna solve that real quick then.",
                  description:
                    "Implicit in the coachee's statement is a construction of the problem as identity ('I have really bad…', 'I'm constantly…'). This language signals perceived permanence and a loss of personal agency. Tony interrupts this pattern through a directive verbal frame ('We're gonna solve'), combined with an ease presupposition ('real quick') and immediate somatic movement by asking the coachee to come to him. The bodily compliance functions as a nonverbal acceptance signal, reinforcing agency and authority before any cognitive negotiation occurs.",
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

          // Phase 2: From Symptom Story to Process Control
          {
            title: "Phase 2: From Symptom Story to Process Control",
            description:
              "Tony moves away from talking about the problem and starts looking at how it is actually created. He invites the coachee to interact with the panic instead of describing it, which allows him to see how the pattern works and how accessible it is. Step by step, he helps her notice what she is doing internally - how she breathes, what she focuses on, and how the state builds. By framing the symptom as something she does rather than something that happens to her, Tony restores a sense of control without blame.",
            startTime: 130, // 02:10
            endTime: 219, // 03:39
            sortOrder: 1,
            audioAssetUrl: MEDIA.audio.phase2,
            audioTriggerTime: 135,
            interventions: {
              create: [
                {
                  title: "Intervention 2.1: Rapport and Emotional Safety",
                  timestampSec: 390,
                  prompt:
                    "Okay (with nonverbal interaction: laughter, smile, eye contact)",
                  description:
                    "The coachee's laughter functions as a stress response rather than amusement. Tony responds with a calm smile, steady eye contact, and a soft verbal acknowledgment ('Okay'), which serves to co-regulate her emotional state. This nonverbal attunement stabilizes arousal, maintains rapport, and signals psychological safety. By repeatedly checking in without pushing forward, Tony implicitly communicates that only experiences the coachee feels safe with will be explored.",
                  methodModelFramework:
                    "Rapport building, emotional pacing, state regulation through presence",
                  function: "Emotional stabilization and safety signaling",
                  scientificReferenceFields: [
                    "Affective Neuroscience (co-regulation)",
                    "Social Baseline Theory",
                    "Polyvagal-informed research on interpersonal regulation",
                  ],
                  sortOrder: 0,
                },
                {
                  title:
                    "Intervention 2.2: Testing the Pattern (Exploratory Re-Entry)",
                  timestampSec: 450,
                  prompt: "So do your panic disorder for me.",
                  description:
                    "Tony invites the coachee to attempt a brief re-entry into the feared state, treating it as if it were a normal and accessible action. The primary function of this intervention is diagnostic rather than transformational. By observing hesitation, confusion, or resistance, Tony gathers information about how the panic pattern is accessed, how automatic it feels, and where avoidance mechanisms are already operating. The request subtly primes the idea that the state is something that can be entered intentionally.",
                  methodModelFramework:
                    "Pattern analysis, state access testing, early re-entry priming within NAC (Neuro-Associative Conditioning)",
                  function:
                    "Diagnostic probing and preparation for later voluntary re-entry",
                  scientificReferenceFields: [
                    "Exposure-based assessment",
                    "Behavioral analysis",
                    "Research on avoidance and approach behavior",
                  ],
                  sortOrder: 1,
                },
                {
                  title:
                    "Intervention 2.3: You Create the Pattern (Agency Frame)",
                  timestampSec: 540,
                  prompt: "To feel, you have to do things.",
                  description:
                    "Tony reframes the symptom from something that happens to the coachee into something she actively does. By asking her to 'do' the panic disorder, he shifts the experience from an external, uncontrollable event to an internally generated process. This reframing implicitly restores agency: if the symptom is enacted, it can also be interrupted, modified, or stopped. The intervention dismantles the passive victim narrative without confrontation.",
                  methodModelFramework:
                    "Pattern analysis, Neuro-Associative Conditioning (NAC)",
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
                  timestampSec: 630,
                  prompt: "It's her breathing, it's the biggest piece.",
                  description:
                    "Tony begins to decode the symptom by identifying breathing as the primary physiological component of the panic pattern. He introduces interoceptive awareness by directing attention to internal bodily processes that are normally unconscious. Step by step, he helps the coachee recognize how breathing, bodily tension, imagery, and internal dialogue interact to produce panic. Developing accurate interoceptive perception is essential for later control.",
                  methodModelFramework:
                    "Physiology-first intervention, state awareness within NAC",
                  function:
                    "Making unconscious bodily processes conscious and observable",
                  scientificReferenceFields: [
                    "Interoception Research",
                    "Affective Neuroscience",
                    "Panic Disorder Physiology and Breath Regulation Studies",
                  ],
                  sortOrder: 3,
                },
                {
                  title: "Intervention 2.5: Total Responsibility Without Guilt",
                  timestampSec: 720,
                  prompt:
                    "So she uses some external trigger to then do something with her body, and then she adds to it something, and then she's outta control.",
                  description:
                    "Tony explains the panic sequence as a chain of actions rather than a flaw or pathology. He assigns responsibility for the process while explicitly avoiding blame by clarifying that the behavior is not consciously chosen. This distinction preserves dignity and prevents shame while still establishing causality. The coachee can recognize her role in creating the state without feeling attacked.",
                  methodModelFramework:
                    "Total responsibility without judgment, cause-effect reframing",
                  function:
                    "Ownership of behavior without inducing guilt or defensiveness",
                  scientificReferenceFields: [
                    "Attribution Theory",
                    "Trauma-Informed Psychology",
                    "Research on Agency and Learned Helplessness",
                  ],
                  sortOrder: 4,
                },
                {
                  title: "Intervention 2.6: Competence-Based Future Pacing",
                  timestampSec: 840,
                  prompt: "So she knows how to get out of it as well.",
                  description:
                    "Tony highlights that the coachee already possesses the ability to exit the panic state. By emphasizing that she has done this repeatedly, he future-paces competence rather than pathology. He explicitly removes blame by noting that the process is not conscious, preventing self-accusation while still reinforcing capability. This intervention builds confidence and prepares the nervous system for later experiential work by anchoring change in existing success.",
                  methodModelFramework:
                    "Future pacing, resource activation within NAC",
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

          // Phase 3: Interoceptive Decoding and Implicit Need Identification
          {
            title:
              "Phase 3: Interoceptive Decoding and Implicit Need Identification",
            description:
              "Tony deepens the work by connecting the panic pattern to an underlying need that is being met through the symptom. Having already established agency and pattern awareness, he now explores why the pattern exists in the first place. By shifting perspectives, activating positive states, and systematically working through his core models, Tony helps the coachee recognize that panic is not random but functional. This phase transforms the symptom from something to eliminate into something to understand.",
            startTime: 900,
            endTime: 1800,
            sortOrder: 2,
            audioAssetUrl: MEDIA.audio.phase3,
            audioTriggerTime: 910,
            interventions: {
              create: [
                {
                  title: "Intervention 3.1: Symptom as Action (Need Frame)",
                  timestampSec: 930,
                  prompt:
                    "Because what do you get out of being panicked of the six needs?",
                  description:
                    "Tony reframes the panic pattern once again as an action, this time linking it explicitly to benefit rather than dysfunction. By asking what the coachee gets out of panic, he introduces the idea that the symptom serves a purpose, even if unconsciously. This question shifts the frame from control to motivation and opens the door to examining panic as a strategy for meeting an underlying need.",
                  methodModelFramework:
                    "Six Human Needs, pattern purpose identification",
                  function: "Linking symptom behavior to implicit benefit",
                  scientificReferenceFields: [
                    "Motivational Psychology",
                    "Functional analysis in Behavioral Therapy",
                    "Secondary Gain Research",
                  ],
                  sortOrder: 0,
                },
                {
                  title:
                    "Intervention 3.2: Perspective Shift (Step Outside Yourself)",
                  timestampSec: 1020,
                  prompt:
                    "Come over here and be Tony Robbins for a second and I'll be you.",
                  description:
                    "Tony asks the coachee to physically and mentally step outside of herself and adopt his perspective. This role reversal creates immediate psychological distance and enables the coachee to view her own behavior with less emotional load. By embodying another viewpoint, she gains access to insights that are difficult to reach from within the symptom state. Tony's humor during this exchange supports the shift by lowering tension.",
                  methodModelFramework:
                    "Perspective shift, role reversal, state change through embodiment",
                  function:
                    "Disrupting habitual self-identification and enabling insight",
                  scientificReferenceFields: [
                    "Systemic Therapy (role switching)",
                    "Embodied Cognition",
                    "Affective neuroscience (humor and cognitive flexibility)",
                  ],
                  sortOrder: 1,
                },
                {
                  title: "Intervention 3.3: Six Human Needs Mapping",
                  timestampSec: 1140,
                  prompt:
                    "[Guided exploration of certainty, variety, significance, love/connection, growth, contribution]",
                  description:
                    "Tony systematically walks the coachee through the Six Human Needs model to identify which need is being met through the panic pattern. Rather than analyzing the symptom abstractly, he helps her recognize how panic provides certainty, significance, or another core need in an intensified form. This structured exploration transforms panic from an enemy into a signal, revealing the underlying driver that sustains the behavior.",
                  methodModelFramework: "Six Human Needs assessment",
                  function:
                    "Identifying the motivational driver behind the symptom",
                  scientificReferenceFields: [
                    "Needs-based motivation theories",
                    "Humanistic psychology",
                    "Behavioral substitution models",
                  ],
                  sortOrder: 2,
                },
                {
                  title: "Intervention 3.4: Positive State Induction",
                  timestampSec: 1260,
                  prompt: "You know how to celebrate, don't you?",
                  description:
                    "Tony deliberately shifts the coachee out of the problem-focused state and into a positive emotional experience. By activating a familiar, resourceful state, he broadens her emotional range and makes it easier to recall moments where core needs were fulfilled without panic. This contrast reduces over-identification with the symptom and supports more balanced perception.",
                  methodModelFramework: "State change, resource activation",
                  function:
                    "Expanding emotional range and access to positive reference states",
                  scientificReferenceFields: [
                    "Positive affect research",
                    "Broaden-and-build theory",
                    "State-dependent learning",
                  ],
                  sortOrder: 3,
                },
                {
                  title: "Intervention 3.5: Balancing Emotional Certainty",
                  timestampSec: 1380,
                  prompt: "Are you as certain about that as panic?",
                  description:
                    "Tony draws a direct comparison between the intensity and certainty of panic and the certainty present in positive states. By doing so, he challenges the implicit assumption that panic is uniquely powerful or dominant. This comparison widens the coachee's perceptual field and helps her recognize that certainty is not exclusive to fear. The intervention restores balance by integrating positive certainty alongside negative intensity.",
                  methodModelFramework:
                    "Comparative state evaluation, meaning balancing",
                  function:
                    "Reducing dominance of the panic state through contrast",
                  scientificReferenceFields: [
                    "Cognitive appraisal theory",
                    "Affective contrast effects",
                    "Attentional bias research",
                  ],
                  sortOrder: 4,
                },
                {
                  title:
                    "Intervention 3.6: Positive Feedback and Social Reinforcement",
                  timestampSec: 1500,
                  prompt:
                    "I love your honesty. Give her a hand. She's so beautiful, isn't she?",
                  description:
                    "Tony offers direct positive feedback and amplifies it through the audience. This social reinforcement strengthens the coaching alliance and anchors the positive emotional state. Public recognition validates vulnerability and honesty, increasing trust and reinforcing the coachee's engagement. The intervention stabilizes the emotional gains made in the session and deepens relational safety.",
                  methodModelFramework:
                    "Positive reinforcement, social validation",
                  function:
                    "Strengthening alliance and reinforcing positive emotional states",
                  scientificReferenceFields: [
                    "Social reinforcement theory",
                    "Attachment research",
                    "Affective neuroscience of reward",
                  ],
                  sortOrder: 5,
                },
                {
                  title: "Intervention 3.7: Five Elements Mapping",
                  timestampSec: 1650,
                  prompt: "Wood, fire, earth, metal, or water?",
                  description:
                    "Tony introduces the Five Elements framework to identify the coachee's dominant energetic and emotional expression style. By linking both panic and positive states to the same underlying element, he highlights what they have in common rather than treating them as opposites. This mapping connects physiology, emotional intensity, and need fulfillment into a coherent pattern. The coachee gains a unifying understanding of how her energy operates across different states.",
                  methodModelFramework: "Five Elements model",
                  function:
                    "Integrating emotional extremes into a single regulatory pattern",
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
            timestamp: 30,
            authorName: "Coach Sarah",
          },
          {
            content:
              "Notice how the humor completely disarms any defensiveness here.",
            timestamp: 90,
            authorName: "Learning Dev",
          },
          {
            content:
              "This meta-framing technique is so powerful for reducing resistance.",
            timestamp: 150,
            authorName: "Therapist Mike",
          },
          {
            content:
              "The distinction between metaphor and reality is crucial for panic work.",
            timestamp: 210,
            authorName: "Coach Sarah",
          },
          {
            content:
              "Physical movement as a pattern interrupt - so simple yet effective.",
            timestamp: 300,
            authorName: "NLP Practitioner",
          },
          {
            content:
              "The co-regulation here is textbook polyvagal - beautiful to watch.",
            timestamp: 390,
            authorName: "Therapist Mike",
          },
          {
            content:
              "'Do your panic disorder for me' - what a reframe! Agency restored instantly.",
            timestamp: 450,
            authorName: "Learning Dev",
          },
          {
            content:
              "This is the key insight: feelings require actions. You have to DO something to feel something.",
            timestamp: 540,
            authorName: "Coach Sarah",
          },
          {
            content:
              "Breaking down the sequence into components makes it manageable and controllable.",
            timestamp: 630,
            authorName: "Anxiety Specialist",
          },
          {
            content:
              "Total responsibility without guilt - this is such an important distinction.",
            timestamp: 720,
            authorName: "Therapist Mike",
          },
          {
            content:
              "Anchoring competence in what she already knows how to do. Genius.",
            timestamp: 840,
            authorName: "NLP Practitioner",
          },
          {
            content:
              "Connecting symptoms to needs changes everything about how we view them.",
            timestamp: 930,
            authorName: "Coach Sarah",
          },
          {
            content:
              "The role reversal creates instant distance from the problem state.",
            timestamp: 1020,
            authorName: "Family Systems Coach",
          },
          {
            content:
              "Walking through all six needs systematically - thorough diagnostic work.",
            timestamp: 1140,
            authorName: "Therapist Mike",
          },
          {
            content:
              "State changes make the positive resources equally accessible.",
            timestamp: 1260,
            authorName: "Learning Dev",
          },
          {
            content:
              "Comparing certainty levels between panic and positive states - powerful reframe.",
            timestamp: 1380,
            authorName: "Anxiety Specialist",
          },
          {
            content:
              "Social reinforcement through the audience amplifies the positive anchoring.",
            timestamp: 1500,
            authorName: "Coach Sarah",
          },
          {
            content:
              "The Five Elements gives her a way to understand her intensity as a gift, not a flaw.",
            timestamp: 1650,
            authorName: "Holistic Practitioner",
          },
        ],
      },
    },
  })

  console.log(`Created lesson: ${lesson.title}`)
  console.log(`Lesson ID: ${lesson.id}`)
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
