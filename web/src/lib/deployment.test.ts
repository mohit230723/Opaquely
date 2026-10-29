import { describe, expect, it } from "vitest";
import { deploymentStatus, STALE_DEPLOYMENT_TEXT, type CodeRead } from "./deployment";

const ok = (data: string | null | undefined): CodeRead => ({ status: "success", data });

describe("deploymentStatus", () => {
  it("is ok when both reads succeeded with code", () => {
    expect(deploymentStatus([ok("0x6080"), ok("0x6080")])).toBe("ok");
  });

  it("is missing when a successful read has no code (undefined or 0x)", () => {
    expect(deploymentStatus([ok(undefined), ok("0x6080")])).toBe("missing");
    expect(deploymentStatus([ok("0x6080"), ok("0x")])).toBe("missing");
    expect(deploymentStatus([ok(undefined), ok("0x")])).toBe("missing");
  });

  it("is missing when wagmi reports an empty account as null", () => {
    expect(deploymentStatus([ok(null), ok("0x6080")])).toBe("missing");
    expect(deploymentStatus([ok("0x6080"), ok(null)])).toBe("missing");
  });

  it("is unknown while any read is pending", () => {
    expect(deploymentStatus([{ status: "pending" }, ok("0x6080")])).toBe("unknown");
    expect(deploymentStatus([{ status: "pending" }, ok(undefined)])).toBe("unknown");
  });

  it("is unknown when any read failed, even when the other is empty", () => {
    expect(deploymentStatus([{ status: "error" }, ok("0x6080")])).toBe("unknown");
    expect(deploymentStatus([{ status: "error" }, ok(undefined)])).toBe("unknown");
    expect(deploymentStatus([{ status: "error" }, { status: "error" }])).toBe("unknown");
  });

  it("is unknown for an empty list", () => {
    expect(deploymentStatus([])).toBe("unknown");
  });

  it("carries the exact banner text", () => {
    expect(STALE_DEPLOYMENT_TEXT).toBe(
      "The contracts are not on this chain. The node was probably restarted. Run the deploy again and reload.",
    );
  });
});
