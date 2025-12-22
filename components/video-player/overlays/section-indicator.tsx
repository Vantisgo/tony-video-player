"use client"

import * as React from "react"
import { Circle, CheckCircle2, ChevronRight } from "lucide-react"
import { useVideoPlayer } from "~/lib/contexts/video-player-context"

interface SubsectionItem {
  title: string
  completed: boolean
  current: boolean
  timestampSec: number
}

function SectionIndicator() {
  const { phases, activePhaseId, activeInterventionId, currentTime, seek } = useVideoPlayer()

  const [isExpanded, setIsExpanded] = React.useState(false)
  const [prevCurrentIndex, setPrevCurrentIndex] = React.useState(-1)
  const [prevSection, setPrevSection] = React.useState("")
  const [showTransition, setShowTransition] = React.useState(false)
  const [sectionChanged, setSectionChanged] = React.useState(false)
  const [animationState, setAnimationState] = React.useState<"idle" | "exit" | "enter">("idle")
  const [justCompletedIndex, setJustCompletedIndex] = React.useState<number | null>(null)

  // Find the active phase - show "Intro" if no phase is active
  const activePhase = phases.find((p) => p.id === activePhaseId)
  const isIntro = !activePhase
  const section = activePhase?.title ?? "Intro"

  // Convert interventions to subsections format
  const subsections: SubsectionItem[] = React.useMemo(() => {
    if (!activePhase) return []

    return activePhase.interventions.map((intervention) => ({
      title: intervention.title,
      completed: currentTime > intervention.timestampSec,
      current: intervention.id === activeInterventionId,
      timestampSec: intervention.timestampSec,
    }))
  }, [activePhase, activeInterventionId, currentTime])

  const currentIndex = subsections.findIndex((s) => s.current)
  const currentSubsection = subsections[currentIndex]

  React.useEffect(() => {
    if (prevSection !== section && prevSection !== "" && section !== "") {
      // Section changed - trigger exit animation then enter animation
      setSectionChanged(true)
      setAnimationState("exit")
      setIsExpanded(true)

      setTimeout(() => {
        setAnimationState("enter")
        setPrevSection(section)
      }, 400) // Exit animation duration

      const timer = setTimeout(() => {
        setShowTransition(false)
        setIsExpanded(false)
        setAnimationState("idle")
        setSectionChanged(false)
      }, 3400) // Stay expanded for 3 seconds after enter animation

      return () => clearTimeout(timer)
    } else if (prevCurrentIndex !== -1 && prevCurrentIndex !== currentIndex && currentIndex !== -1) {
      // Subsection changed within same section
      setJustCompletedIndex(prevCurrentIndex)
      setShowTransition(true)
      setIsExpanded(true)

      // Clear the completion highlight after animation
      setTimeout(() => {
        setJustCompletedIndex(null)
      }, 600)

      const timer = setTimeout(() => {
        setShowTransition(false)
        setIsExpanded(false)
      }, 3000)

      return () => clearTimeout(timer)
    }
    setPrevCurrentIndex(currentIndex)
    if (section) {
      setPrevSection(section)
    }
  }, [currentIndex, prevCurrentIndex, section, prevSection])

  return (
    <div
      className={`pointer-events-auto transition-all duration-500 ease-in-out ${isExpanded ? "w-96" : "w-auto max-w-2xl"}`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => !showTransition && setIsExpanded(false)}
    >
      <div
        className={`bg-gradient-to-br from-orange-500/20 via-amber-500/20 to-yellow-500/20 border border-orange-300/25 backdrop-blur-md shadow-2xl transition-all duration-500 ${
          isExpanded ? "rounded-2xl p-5" : "rounded-xl px-4 py-2.5"
        }`}
      >
        {!isExpanded && (
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-orange-100 font-medium truncate" title={section}>
              {section}
            </span>
            {currentSubsection && (
              <div className="flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-orange-300/60 flex-shrink-0" />
                <span className="text-amber-100/80 font-normal truncate" title={currentSubsection.title}>
                  {currentSubsection.title}
                </span>
              </div>
            )}
          </div>
        )}

        {isExpanded && (
          <div className="space-y-3 overflow-hidden">
            <div
              className={`space-y-3 transition-all duration-400 ${
                animationState === "exit"
                  ? "-translate-x-full opacity-0"
                  : animationState === "enter"
                    ? "animate-in slide-in-from-right duration-400"
                    : "animate-in fade-in duration-300"
              }`}
            >
              {/* Section Title */}
              <div className="space-y-1">
                <div className="text-orange-100/60 text-xs font-medium uppercase tracking-wide">Course Section</div>
                <h3 className="text-white text-lg font-bold leading-tight text-pretty">{section}</h3>
              </div>

              {/* Show progress and interventions only if not intro */}
              {!isIntro && subsections.length > 0 && (
                <>
                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${(subsections.filter((s) => s.completed).length / subsections.length) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="text-orange-100/60 text-xs">
                      {subsections.filter((s) => s.completed).length} of {subsections.length} completed
                    </div>
                  </div>

                  {/* Subsections List */}
                  <div className="space-y-1">
                    {subsections.map((sub, index) => (
                      <div
                        key={index}
                        onClick={() => seek(sub.timestampSec)}
                        className={`flex items-start gap-3 p-1.5 rounded-lg transition-all duration-300 cursor-pointer ${
                          sub.current ? "bg-white/10 scale-[1.02]" : "hover:bg-white/5"
                        } ${
                          showTransition && sub.current && !sectionChanged
                            ? "animate-in slide-in-from-top-2 duration-500"
                            : ""
                        }`}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {sub.completed ? (
                            <CheckCircle2
                              className={`w-4 h-4 text-orange-400 ${
                                justCompletedIndex === index ? "animate-in zoom-in duration-300" : ""
                              }`}
                            />
                          ) : sub.current ? (
                            <div className="w-4 h-4 rounded-full border-2 border-orange-400 flex items-center justify-center">
                              <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                            </div>
                          ) : (
                            <Circle className="w-4 h-4 text-orange-300/30" />
                          )}
                        </div>
                        <span
                          className={`text-sm flex-1 leading-snug text-pretty ${
                            sub.current
                              ? "text-white font-medium"
                              : sub.completed
                                ? "text-orange-100/60"
                                : "text-orange-100/40"
                          }`}
                        >
                          {sub.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Intro message when no phase is active */}
              {isIntro && (
                <div className="text-orange-100/60 text-sm">
                  Starting soon...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export { SectionIndicator }
