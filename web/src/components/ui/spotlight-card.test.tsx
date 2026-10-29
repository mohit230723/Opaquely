import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GlowCard } from "./spotlight-card";

describe("GlowCard", () => {
  it("renders the glow surface without an injected style element", () => {
    const html = renderToStaticMarkup(<GlowCard>Content</GlowCard>);
    expect(html).toContain("data-glow");
    expect(html).not.toContain("<style");
    expect(html).toContain("Content");
  });

  it("renders as another element when asked", () => {
    const html = renderToStaticMarkup(<GlowCard as="li">Step</GlowCard>);
    expect(html).toMatch(/^<li/);
  });

  it("defaults to the brand hue range starting at 199 degrees", () => {
    const html = renderToStaticMarkup(<GlowCard>x</GlowCard>);
    expect(html).toContain("--base:199");
    expect(html).toContain("--spread:40");
  });

  it("lets a touch that starts on a card scroll the page", () => {
    const html = renderToStaticMarkup(<GlowCard>x</GlowCard>);
    expect(html).toContain("touch-action:auto");
  });
});
