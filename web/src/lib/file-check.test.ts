import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES } from "./constants";
import { checkBillImage, TYPE_ERROR, SIZE_ERROR } from "./file-check";

describe("checkBillImage", () => {
  it("accepts a PNG and a JPEG up to exactly 10 MB", () => {
    expect(checkBillImage({ type: "image/png", size: 1000 })).toEqual({ ok: true });
    expect(checkBillImage({ type: "image/jpeg", size: 10485760 })).toEqual({ ok: true });
    expect(checkBillImage({ type: "image/jpeg", size: MAX_UPLOAD_BYTES })).toEqual({ ok: true });
  });

  it.each([
    ["application/pdf", 10],
    ["image/webp", 10],
    ["image/gif", 10],
    ["", 10],
  ])("rejects type %j with the type message", (type, size) => {
    expect(checkBillImage({ type, size })).toEqual({
      ok: false,
      error: "Only JPG or PNG images are supported. Choose a different file.",
    });
  });

  it("rejects a file over 10 MB with the size message", () => {
    expect(checkBillImage({ type: "image/png", size: 10485761 })).toEqual({
      ok: false,
      error: "That image is larger than 10 MB. Choose a smaller file.",
    });
  });

  it("checks the type before the size", () => {
    expect(checkBillImage({ type: "application/pdf", size: 99_999_999 })).toEqual({ ok: false, error: TYPE_ERROR });
    expect(checkBillImage({ type: "image/png", size: 99_999_999 })).toEqual({ ok: false, error: SIZE_ERROR });
  });
});
