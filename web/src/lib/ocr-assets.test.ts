// Pins the self-hosted OCR assets and samples. A swapped file, a CDN default or an IndexedDB model
// cache coming back would each fail here before it reaches a browser.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webDir = fileURLToPath(new URL("../../", import.meta.url));
const tess = path.join(webDir, "public", "tesseract");
const samples = path.join(webDir, "public", "samples");

const ASSET_HASHES: Record<string, string> = {
  "worker.min.js": "576b7df7e3393e137e51849357c9adb53fe7ac1bb69bfa06cf3d61520f182c6d",
  "tesseract-core-lstm.wasm.js": "eef5f8b2f8e20e150680b20adaec4a60babafee3adbe8a94583c81fee46e8680",
  "tesseract-core-simd-lstm.wasm.js": "c58b46a4c796c0b8afccf77591d5b875b6896b45d402bbce8caa6f5362447b38",
  "tesseract-core-relaxedsimd-lstm.wasm.js": "861a536cf9ef8e63cb644d57bab39c388f37f7d6b6f60024b741c5f6b39a59b3",
  "lang/eng.traineddata.gz": "45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91",
};

const sha256 = (file: string) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");

describe("self-hosted OCR assets", () => {
  const readme = fs.readFileSync(path.join(tess, "README.md"), "utf8");

  for (const [name, hash] of Object.entries(ASSET_HASHES)) {
    it(`${name} has the recorded sha256, also listed in the README`, () => {
      expect(sha256(path.join(tess, name))).toBe(hash);
      expect(readme).toContain(hash);
    });
  }

  it("the model is a gzip file", () => {
    const head = fs.readFileSync(path.join(tess, "lang", "eng.traineddata.gz")).subarray(0, 2);
    expect([...head]).toEqual([0x1f, 0x8b]);
  });

  it("public/tesseract holds exactly the five assets, the README and nothing else", () => {
    expect(fs.readdirSync(tess).sort()).toEqual([
      "README.md",
      "lang",
      "tesseract-core-lstm.wasm.js",
      "tesseract-core-relaxedsimd-lstm.wasm.js",
      "tesseract-core-simd-lstm.wasm.js",
      "worker.min.js",
    ]);
    expect(fs.readdirSync(path.join(tess, "lang"))).toEqual(["eng.traineddata.gz"]);
  });
});

describe("sample bills", () => {
  for (const name of ["bill-grocery.png", "bill-electricity.png", "bill-pharmacy.png"]) {
    it(`${name} is a real PNG`, () => {
      const buf = fs.readFileSync(path.join(samples, name));
      expect([...buf.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
      expect(buf.length).toBeGreaterThan(50_000);
    });
  }
});

describe("ocr.ts privacy options", () => {
  const source = fs.readFileSync(path.join(webDir, "src", "lib", "ocr.ts"), "utf8");

  it("serves every asset from the app origin and keeps no model cache", () => {
    expect(source).toContain('const BASE = "/tesseract"');
    expect(source).toContain("corePath: BASE");
    expect(source).toContain('cacheMethod: "none"');
  });

  it("contains no absolute URL (a CDN default would have to come back through one)", () => {
    expect(source).not.toMatch(/https?:\/\//);
  });
});
