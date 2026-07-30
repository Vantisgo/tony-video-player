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

// Match on the stable href path segment, not on host CSS classes.
function attachmentAnchors(doc: Document): HTMLAnchorElement[] {
  return Array.from(
    doc.querySelectorAll<HTMLAnchorElement>('a[href*="/courses/steps/"]'),
  );
}

// An inner icon <svg> contributes no text, so trimming the label is enough.
function attachmentFilename(anchor: HTMLAnchorElement): string {
  return (anchor.textContent || "").trim();
}

export function resolveAttachmentUrl(
  filename: string | null | undefined,
  doc: Document = document,
): string {
  const want = String(filename ?? "").trim();
  if (!want) return "";
  const wantLc = want.toLowerCase();

  const candidates = attachmentAnchors(doc).map((a) => ({
    text: attachmentFilename(a),
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

// Voice-over attachments are redundant once the re-skinned player plays them, so
// the reskin hides them. They stay in the DOM (display:none, never removed)
// because resolveAttachmentUrl reads their freshly signed href at cue time.
const AUDIO_FILENAME = /\.mp3$/i;

// The previous inline display is parked on the element itself, so restoring
// needs no module-level bookkeeping and survives a re-injected runtime.
const HIDDEN_MARKER = "vpHiddenAttachment";

export function hideAudioAttachments(doc: Document = document): void {
  attachmentAnchors(doc)
    .filter(
      (a) =>
        AUDIO_FILENAME.test(attachmentFilename(a)) &&
        a.dataset[HIDDEN_MARKER] === undefined,
    )
    .forEach((a) => {
      a.dataset[HIDDEN_MARKER] = a.style.display;
      a.style.display = "none";
    });
}

export function restoreAudioAttachments(doc: Document = document): void {
  doc
    .querySelectorAll<HTMLElement>("[data-vp-hidden-attachment]")
    .forEach((el) => {
      const previous = el.dataset[HIDDEN_MARKER] || "";
      if (previous) el.style.display = previous;
      else el.style.removeProperty("display");
      delete el.dataset[HIDDEN_MARKER];
    });
}
