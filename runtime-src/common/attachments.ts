// Resolve a LearningSuite lesson attachment ("Anhänge") to its live download URL
// by reading the rendered DOM. Each attachment is an anchor whose visible text is
// the exact filename and whose href is a freshly signed Google-Cloud-Storage URL
// (`storage.googleapis.com/<bucket>/courses/steps/<cuid>?X-Goog-…`). The page
// re-mints that URL on every load, so we resolve lazily and never persist it.
//
// Pure and defensive like `getBunnyVideoId` in ./tracks: returns "" on any miss
// and never throws.

// Defense-in-depth: the href comes from a DOM we do not own, so only accept an
// https URL (never a planted `javascript:` / `data:` anchor).
function httpsHref(href: string): string {
  try {
    return new URL(href).protocol === "https:" ? href : "";
  } catch {
    return "";
  }
}

export function resolveAttachmentUrl(
  filename: string | null | undefined,
  doc: Document = document,
): string {
  const want = String(filename ?? "").trim();
  if (!want) return "";
  const wantLc = want.toLowerCase();

  // Match on the stable href path segment, not on host CSS classes.
  const candidates = Array.from(
    doc.querySelectorAll<HTMLAnchorElement>('a[href*="/courses/steps/"]'),
  ).map((a) => ({
    // An inner icon <svg> contributes no text, so trimming the label is enough.
    text: (a.textContent || "").trim(),
    href: a.href || a.getAttribute("href") || "",
  }));

  // Exact filename wins; case-insensitive is a forgiving second tier.
  const matched = [
    ...candidates.filter((c) => c.text === want),
    ...candidates.filter((c) => c.text.toLowerCase() === wantLc),
  ]
    .map((c) => httpsHref(c.href))
    .find((href) => href !== "");

  return matched ?? "";
}
