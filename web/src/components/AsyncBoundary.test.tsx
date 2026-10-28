import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";
import { AsyncBoundary, asyncView } from "./AsyncBoundary";

function fakeQuery<T>(status: "pending" | "error" | "success", data?: T) {
  return { status, data, refetch: () => Promise.resolve() } as unknown as UseQueryResult<T>;
}

function render(query: UseQueryResult<string[]>, isEmpty?: (d: string[]) => boolean) {
  return renderToStaticMarkup(
    <AsyncBoundary
      query={query}
      thing="datasets"
      skeleton={<div>skeleton-block</div>}
      isEmpty={isEmpty}
      empty={<p>nothing-here</p>}
    >
      {(rows) => (
        <ul>
          {rows.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </AsyncBoundary>,
  );
}

describe("asyncView", () => {
  it("maps pending and error straight through", () => {
    expect(asyncView({ status: "pending", data: undefined })).toBe("pending");
    expect(asyncView({ status: "error", data: undefined })).toBe("error");
  });
  it("is empty when success and isEmpty says so", () => {
    expect(asyncView({ status: "success", data: [] as string[] }, (d) => d.length === 0)).toBe("empty");
  });
  it("is content when success and not empty", () => {
    expect(asyncView({ status: "success", data: ["a"] }, (d) => d.length === 0)).toBe("content");
    expect(asyncView({ status: "success", data: ["a"] })).toBe("content");
  });
});

describe("AsyncBoundary", () => {
  it("renders the error copy with a Try again button", () => {
    const html = render(fakeQuery("error"));
    expect(html).toContain("Could not load datasets");
    expect(html).toContain("Something went wrong while reading data. Try again.");
    expect(html).toMatch(/<button[^>]*>[^<]*Try again/);
    expect(html).not.toContain("skeleton-block");
  });
  it("renders the skeleton with aria-busy and screen-reader text while pending", () => {
    const html = render(fakeQuery("pending"));
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Loading datasets");
    expect(html).toContain("skeleton-block");
  });
  it("renders the empty node when the data is empty", () => {
    const html = render(fakeQuery("success", [] as string[]), (d) => d.length === 0);
    expect(html).toContain("nothing-here");
  });
  it("renders children with the data on success", () => {
    const html = render(fakeQuery("success", ["Groceries Q3"]), (d) => d.length === 0);
    expect(html).toContain("<li>Groceries Q3</li>");
    expect(html).not.toContain("nothing-here");
  });
});
