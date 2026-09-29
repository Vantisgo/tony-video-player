import { describe, expect, it } from "vitest";
import type { Intervention } from "../../common/types";
import { interventionCard } from "../../demo-overlays/intervention-card";

const BASE: Intervention = {
  id: "i11",
  label: "1.1",
  title: "Model-Based Self-Localization",
  t: 47,
  desc: "Tony invites the coachee to locate her lived experience.",
};

function render(iv: Intervention, open = true): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = interventionCard(iv, { active: false, open });
  return host;
}

describe("interventionCard", () => {
  it("shows the full structured breakdown when open", () => {
    const text = render({
      ...BASE,
      prompt: "What is your center of gravity?",
      method: "Center of Gravity Mapping",
      function: "Cognitive anchoring",
      scienceFields: ["Cognitive Psychology", "Constructivist Psychology"],
    }).textContent;

    for (const part of [
      "“What is your center of gravity?”",
      "What's happening",
      BASE.desc,
      "Center of Gravity Mapping",
      "Cognitive anchoring",
      "Cognitive Psychology",
      "Constructivist Psychology",
    ])
      expect(text).toContain(part);
  });

  it("falls back to the description alone for a config without the new fields", () => {
    const text = render(BASE).textContent ?? "";
    expect(text).toContain(BASE.desc);
    expect(text).not.toContain("Method / Model / Framework");
    expect(text).not.toContain("Scientific fields");
  });

  it("drops wrong-typed fields instead of rendering them", () => {
    const text =
      render({
        ...BASE,
        method: { nested: true } as unknown as string,
        scienceFields: "Psychology" as unknown as string[],
      }).textContent ?? "";
    expect(text).not.toContain("[object Object]");
    expect(text).not.toContain("Method / Model / Framework");
    expect(text).not.toContain("Scientific fields");
  });

  it("escapes every authored value", () => {
    const host = render({
      ...BASE,
      prompt: "<img src=x onerror=alert(1)>",
      scienceFields: ["<b>x</b>"],
    });
    expect(host.querySelector("img")).toBeNull();
    expect(host.querySelector("b")).toBeNull();
  });

  it("shows only the header while collapsed", () => {
    const host = render({ ...BASE, prompt: "Quote" }, false);
    expect(host.textContent).toContain(BASE.title);
    expect(host.textContent).not.toContain("Quote");
    expect(
      host.querySelector("[data-iv-toggle]")?.getAttribute("aria-expanded"),
    ).toBe("false");
  });
});
