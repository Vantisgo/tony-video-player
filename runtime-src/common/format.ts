// Format a number of seconds as m:ss. Coerces via `| 0`, so the result is
// always digits + a colon — safe to interpolate into HTML without escaping.
export const formatTime = (s: number): string => {
  if (!isFinite(s)) return "0:00";
  const total = Math.max(0, s | 0);
  return `${(total / 60) | 0}:${String(total % 60).padStart(2, "0")}`;
};
