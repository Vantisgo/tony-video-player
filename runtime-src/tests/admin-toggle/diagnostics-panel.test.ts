import { beforeEach, describe, expect, it, vi } from "vitest";

// The editor as admin-toggle sees it: a player, and the block's saved code as
// the value of a text input.
async function mountEditor(savedCode: string): Promise<HTMLElement> {
  window.location.href = "http://localhost:3000/admin/editor/abc";
  const input = document.createElement("input");
  input.type = "text";
  input.value = savedCode;
  const host = document.createElement("div");
  host.appendChild(document.createElement("hls-video"));
  const wrapper = document.createElement("div");
  wrapper.append(host, input);
  document.body.appendChild(wrapper);
  await import("../../admin-toggle/index");
  return document.querySelector(".vp-admin-diag") as HTMLElement;
}

beforeEach(() => {
  vi.resetModules();
  const g = window as unknown as { __vpAdminCleanup?: Array<() => void> };
  g.__vpAdminCleanup?.forEach((fn) => fn());
  g.__vpAdminCleanup = [];
  document.body.innerHTML = "";
  localStorage.clear();
});

describe("admin-toggle diagnostics panel", () => {
  it("stays hidden until the option is switched on", async () => {
    const panel = await mountEditor("<pre data-vp-config>{ broken</pre>");
    expect(panel.hidden).toBe(true);
  });

  it("lists why the saved code is not recognised, escaping what it quotes", async () => {
    localStorage.setItem("vp-admin-diagnostics", "1");
    const panel = await mountEditor(
      '<pre data-vp-config>{ "phases": [] "&lt;img src=x onerror=alert(1)&gt;": 1 }</pre>',
    );

    expect(panel.hidden).toBe(false);
    expect(panel.dataset.state).toBe("error");
    expect(panel.querySelector("li")?.textContent).toContain("<img");
    expect(panel.querySelector("img")).toBeNull();
  });

  it("confirms recognised code", async () => {
    localStorage.setItem("vp-admin-diagnostics", "1");
    const panel = await mountEditor(
      '<pre data-vp-config>{ "phases": [] }</pre>',
    );

    expect(panel.dataset.state).toBe("ok");
    expect(panel.querySelector("li")).toBeNull();
  });

  it("persists the option from the dialog checkbox and applies it on close", async () => {
    const panel = await mountEditor("<pre data-vp-config>{ broken</pre>");
    (document.querySelector(".vp-admin-launch") as HTMLButtonElement).click();

    const checkbox = document.querySelector(
      ".vp-diag-checkbox",
    ) as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));
    (document.querySelector(".vp-close") as HTMLButtonElement).click();

    expect(localStorage.getItem("vp-admin-diagnostics")).toBe("1");
    expect(panel.hidden).toBe(false);
  });
});
