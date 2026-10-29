import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("Button", () => {
  it("renders primary as a real button with the specular look, flat until a context is live", () => {
    const html = renderToStaticMarkup(<Button>Encrypt</Button>);
    expect(html).toMatch(/^<button/);
    expect(html).toContain("Encrypt");
    expect(html).toContain("specular-button");
    expect(html).toContain('data-gl="off"');
    expect(html).toContain('type="button"');
  });

  it("uses aria-disabled for disabled and never the native disabled attribute", () => {
    const html = renderToStaticMarkup(<Button disabled>Buy this dataset</Button>);
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain(' disabled=""');
  });

  it("marks loading with aria-busy and blocks it like disabled", () => {
    const html = renderToStaticMarkup(<Button loading>Pay</Button>);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-disabled="true"');
  });

  it("renders a link for href", () => {
    const html = renderToStaticMarkup(<Button href="/upload">Upload</Button>);
    expect(html).toMatch(/^<a/);
    expect(html).toContain('href="/upload"');
  });

  it("keeps ghost CSS-only", () => {
    const html = renderToStaticMarkup(<Button variant="ghost">Cancel</Button>);
    expect(html).not.toContain("specular-button");
    expect(html).toContain('data-variant="ghost"');
  });

  it("tells primary and secondary apart by variant, not fill", () => {
    const primary = renderToStaticMarkup(<Button>Go</Button>);
    const secondary = renderToStaticMarkup(<Button variant="secondary">Go</Button>);
    expect(primary).toContain('data-variant="primary"');
    expect(secondary).toContain('data-variant="secondary"');
  });
});
