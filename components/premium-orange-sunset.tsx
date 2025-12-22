"use client"

import { useState } from "react"
import { Play, Pause, SkipForward, Mic2 } from "lucide-react"

export default function PremiumOrangeSunset() {
  const [isPlaying, setIsPlaying] = useState(true)

  return (
    <div className="w-80">
      <div className="bg-gradient-to-br from-orange-500/20 via-amber-500/20 to-yellow-500/20 border border-orange-300/25 rounded-2xl p-5 backdrop-blur-md shadow-2xl space-y-4">
        {/* Header with Avatar and Name */}
        <div className="flex items-start gap-3">
          <div className="relative">
            <img
              src="/professional-voice-talent-headshot.jpg"
              alt="Emma Rodriguez"
              className="w-13 h-13 rounded-full border-3 border-orange-400 shadow-lg"
            />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full border-2 border-white flex items-center justify-center">
              <Mic2 className="w-3 h-3 text-white" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-white text-base font-bold">Emma Rodriguez</h3>
            <p className="text-orange-100/70 text-xs">Voice-Over Artist</p>
            <div className="mt-1 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
              <span className="text-orange-100/50 text-xs">Recording</span>
            </div>
          </div>
        </div>

        {/* Progress Section */}
        <div className="space-y-2">
          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-400 rounded-full shadow-lg" />
          </div>
          <div className="flex justify-between text-orange-100/60 text-xs font-medium">
            <span>1:23</span>
            <span>3:45</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2.5 items-center">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 rounded-xl transition-colors shadow-lg"
          >
            {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white" />}
          </button>
          <button className="flex-1 py-3 bg-white/15 hover:bg-white/25 rounded-xl transition-colors text-white text-sm font-medium flex items-center justify-center gap-2">
            <SkipForward className="w-4 h-4" />
            <span>Skip</span>
          </button>
          <button className="px-4 py-3 bg-white/15 hover:bg-white/25 rounded-xl transition-colors text-white text-sm font-medium">
            +10s
          </button>
        </div>
      </div>
    </div>
  )
}
