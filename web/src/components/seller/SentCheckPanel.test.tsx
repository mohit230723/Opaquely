import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SentCheckPanel, type SentCheck } from "./SentCheckPanel";

const noop = () => undefined;

function render(check: SentCheck | null) {
  return renderToStaticMarkup(
    <SentCheckPanel check={check} datasetId="d1" onCheck={noop} onSendAgain={noop} onAddAnother={noop} />,
  );
}

describe("SentCheckPanel (WR-05)", () => {
  it("offers Check status and no resend before the dataset has been looked at", () => {
    const html = render(null);
    expect(html).toContain("Check status");
    expect(html).not.toContain("Send again");
    expect(html).not.toContain("Try again");
  });

  it("says the bill is on the dataset and offers no resend when the count grew", () => {
    const html = render({ hash: "0xabc", result: "added", billCount: 4 });
    expect(html).toContain("4 bills");
    expect(html).toContain("Do not add it again");
    expect(html).not.toContain("Send again");
  });

  it("offers Send again only once the dataset shows the bill is missing", () => {
    const html = render({ hash: "0xabc", result: "not_added", billCount: 3 });
    expect(html).toContain("Send again");
    expect(html).toContain("Check again");
  });

  it("keeps the resend locked when the dataset could not be read", () => {
    const html = render({ hash: "0xabc", result: "unknown" });
    expect(html).toContain("Check status");
    expect(html).not.toContain("Send again");
  });
});
