/**
 * Format seconds to MM:SS or HH:MM:SS format
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00"

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return `${minutes}:${secs.toString().padStart(2, "0")}`
}

/**
 * Calculate percentage position for a timestamp within a duration
 */
export function getPercentage(time: number, duration: number): number {
  if (!duration || duration <= 0) return 0
  return Math.min(100, Math.max(0, (time / duration) * 100))
}
