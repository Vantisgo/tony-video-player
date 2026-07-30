import { afterEach, describe, expect, it } from "vitest";
import {
  hideAudioAttachments,
  resolveAttachmentUrl,
  restoreAudioAttachments,
} from "../../common/attachments";

const SIGNED_BASE =
  "https://storage.googleapis.com/learningsuite-prod-de-storage-x/courses/steps/";

afterEach(() => {
  document.body.innerHTML = "";
});

// Mirrors the real "Anhänge" markup: an anchor with an icon <svg> and the exact
// filename as its visible text.
function addAttachment(options: {
  text: string;
  href: string;
  withIcon?: boolean;
}): HTMLAnchorElement {
  const a = document.createElement("a");
  a.setAttribute("href", options.href);
  if (options.withIcon) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    a.appendChild(svg);
  }
  a.appendChild(document.createTextNode(options.text));
  document.body.appendChild(a);
  return a;
}

describe("resolveAttachmentUrl", () => {
  it("returns the signed href of the anchor whose text is the filename", () => {
    const href = `${SIGNED_BASE}cmrz0mmse1i4xbu01ps23bygk?X-Goog-Algorithm=GOOG4-HMAC-SHA256`;
    addAttachment({ text: "Intro.mp3", href });

    expect(resolveAttachmentUrl("Intro.mp3")).toBe(href);
  });

  it("matches case-insensitively when the author's casing differs", () => {
    const href = `${SIGNED_BASE}abc?X-Goog-Expires=604800`;
    addAttachment({ text: "Voiceover Phase 1.mp3", href });

    expect(resolveAttachmentUrl("voiceover phase 1.MP3")).toBe(href);
  });

  it("prefers the exact match over a case-only match", () => {
    const lower = `${SIGNED_BASE}lower`;
    const exact = `${SIGNED_BASE}exact`;
    addAttachment({ text: "intro.mp3", href: lower });
    addAttachment({ text: "Intro.mp3", href: exact });

    expect(resolveAttachmentUrl("Intro.mp3")).toBe(exact);
  });

  it("ignores an anchor that is not a lesson-step attachment", () => {
    addAttachment({
      text: "Intro.mp3",
      href: "https://example.com/elsewhere/Intro.mp3",
    });

    expect(resolveAttachmentUrl("Intro.mp3")).toBe("");
  });

  it("returns an empty string when no anchor text matches", () => {
    addAttachment({ text: "Outro.mp3", href: `${SIGNED_BASE}abc` });

    expect(resolveAttachmentUrl("Intro.mp3")).toBe("");
  });

  it("skips a matching anchor whose href is not https", () => {
    addAttachment({
      text: "Intro.mp3",
      href: "javascript:alert('/courses/steps/x')",
    });

    expect(resolveAttachmentUrl("Intro.mp3")).toBe("");
  });

  it("falls through to a valid https anchor when an earlier match is unsafe", () => {
    const href = `${SIGNED_BASE}safe`;
    addAttachment({
      text: "Intro.mp3",
      href: "javascript:alert('/courses/steps/x')",
    });
    addAttachment({ text: "Intro.mp3", href });

    expect(resolveAttachmentUrl("Intro.mp3")).toBe(href);
  });

  it("matches despite surrounding whitespace and an inner icon", () => {
    const href = `${SIGNED_BASE}whitespace`;
    addAttachment({ text: "\n  Intro.mp3  \n", href, withIcon: true });

    expect(resolveAttachmentUrl("  Intro.mp3 ")).toBe(href);
  });

  it("returns an empty string for an absent or empty filename", () => {
    addAttachment({ text: "Intro.mp3", href: `${SIGNED_BASE}abc` });

    expect(resolveAttachmentUrl(undefined)).toBe("");
    expect(resolveAttachmentUrl("")).toBe("");
    expect(resolveAttachmentUrl("   ")).toBe("");
  });

  it("resolves each of two distinct attachments to its own href", () => {
    const intro = `${SIGNED_BASE}intro`;
    const phase = `${SIGNED_BASE}phase`;
    addAttachment({ text: "Intro.mp3", href: intro });
    addAttachment({ text: "Voiceover Phase 1.mp3", href: phase });

    expect(resolveAttachmentUrl("Intro.mp3")).toBe(intro);
    expect(resolveAttachmentUrl("Voiceover Phase 1.mp3")).toBe(phase);
  });

  it("reads from an explicitly passed document", () => {
    const other = document.implementation.createHTMLDocument("other");
    const a = other.createElement("a");
    a.setAttribute("href", `${SIGNED_BASE}other`);
    a.textContent = "Intro.mp3";
    other.body.appendChild(a);

    expect(resolveAttachmentUrl("Intro.mp3", other)).toBe(
      `${SIGNED_BASE}other`,
    );
    expect(resolveAttachmentUrl("Intro.mp3")).toBe("");
  });
});

describe("hideAudioAttachments", () => {
  it("hides every .mp3 lesson attachment", () => {
    const intro = addAttachment({
      text: "Intro.mp3",
      href: `${SIGNED_BASE}intro`,
      withIcon: true,
    });
    const phase = addAttachment({
      text: "  Voiceover Phase 1.mp3  ",
      href: `${SIGNED_BASE}phase`,
    });

    hideAudioAttachments();

    expect(intro.style.display).toBe("none");
    expect(phase.style.display).toBe("none");
  });

  it("leaves non-audio attachments visible", () => {
    const workbook = addAttachment({
      text: "Workbook.pdf",
      href: `${SIGNED_BASE}workbook`,
    });

    hideAudioAttachments();

    expect(workbook.style.display).toBe("");
  });

  it("hides an .MP3 attachment regardless of extension casing", () => {
    const intro = addAttachment({
      text: "Intro.MP3",
      href: `${SIGNED_BASE}intro`,
    });

    hideAudioAttachments();

    expect(intro.style.display).toBe("none");
  });

  it("ignores an .mp3 link that is not a lesson-step attachment", () => {
    const elsewhere = addAttachment({
      text: "Intro.mp3",
      href: "https://example.com/elsewhere/Intro.mp3",
    });

    hideAudioAttachments();

    expect(elsewhere.style.display).toBe("");
  });

  it("keeps a hidden attachment resolvable for voice-over playback", () => {
    const href = `${SIGNED_BASE}intro?X-Goog-Expires=604800`;
    addAttachment({ text: "Intro.mp3", href });

    hideAudioAttachments();

    expect(resolveAttachmentUrl("Intro.mp3")).toBe(href);
  });

  it("restores the attachment, including a pre-existing inline display", () => {
    const intro = addAttachment({
      text: "Intro.mp3",
      href: `${SIGNED_BASE}intro`,
    });
    const phase = addAttachment({
      text: "Voiceover Phase 1.mp3",
      href: `${SIGNED_BASE}phase`,
    });
    phase.style.display = "flex";

    hideAudioAttachments();
    restoreAudioAttachments();

    expect(intro.getAttribute("style")).toBe(null);
    expect(phase.style.display).toBe("flex");
    expect(document.querySelector("[data-vp-hidden-attachment]")).toBeNull();
  });

  it("restores the original display after repeated hide calls", () => {
    const intro = addAttachment({
      text: "Intro.mp3",
      href: `${SIGNED_BASE}intro`,
    });
    intro.style.display = "block";

    hideAudioAttachments();
    hideAudioAttachments();
    restoreAudioAttachments();

    expect(intro.style.display).toBe("block");
  });
});
