import { describe, expect, it } from "vitest";
import type { Science } from "../../common/types";
import { richText, scienceCard } from "../../demo-overlays/science-card";

function render(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host;
}

describe("richText", () => {
  it("keeps paragraphs, headings and lists apart", () => {
    const host = render(
      richText(
        "Intro line\ncontinued\n\n## Adaptive Solutions\n\nA panic attack provides:\n\n- energy\n\n- narrowing\n\n2. Stabilization\n\nBody.\n\n1. one\n2. two",
      ),
    );

    expect([...host.children].map((el) => el.tagName.toLowerCase())).toEqual([
      "p",
      "h4",
      "p",
      "ul",
      "h4",
      "p",
      "ol",
    ]);
    expect(host.querySelector("p")?.innerHTML).toBe("Intro line<br>continued");
    expect(host.querySelectorAll("ul li")).toHaveLength(2);
    expect(host.querySelectorAll("h4")[1].textContent).toBe("2. Stabilization");
    expect(host.querySelectorAll("ol li")).toHaveLength(2);
  });

  it("escapes markup in the source", () => {
    const host = render(richText("## <img src=x>\n\n<b>bold</b>"));
    expect(host.querySelector("img, b")).toBeNull();
    expect(host.textContent).toContain("<b>bold</b>");
  });
});

describe("scienceCard", () => {
  const SCI: Science = {
    id: "s1",
    name: "Symptoms as Competence",
    description: "First paragraph.\n\nSecond paragraph.",
    timestampsSec: [22, 90],
  };

  it("renders the body only when open", () => {
    expect(
      render(scienceCard(SCI, { highlighted: false, open: false })).textContent,
    ).not.toContain("First paragraph.");

    const open = render(scienceCard(SCI, { highlighted: false, open: true }));
    expect(open.querySelectorAll("p")).toHaveLength(2);
    expect(open.querySelectorAll("[data-seek]")).toHaveLength(2);
  });
});
