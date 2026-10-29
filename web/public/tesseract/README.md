# Self-hosted Tesseract OCR assets

Opaquely reads bill images in the browser with Tesseract.js. These files are served from the app's
own origin under `/tesseract/`, so OCR works with no CDN and no network at all, and the model is
never fetched from a third party. `src/lib/ocr.ts` is the only module that loads them.

## What is here, where it came from, and its sha256

| File | Source | sha256 |
|------|--------|--------|
| `worker.min.js` | `tesseract.js@7.0.0` (npm), `dist/worker.min.js` | `576b7df7e3393e137e51849357c9adb53fe7ac1bb69bfa06cf3d61520f182c6d` |
| `tesseract-core-lstm.wasm.js` | `tesseract.js-core@7.0.0` (npm, transitive), file of the same name | `eef5f8b2f8e20e150680b20adaec4a60babafee3adbe8a94583c81fee46e8680` |
| `tesseract-core-simd-lstm.wasm.js` | `tesseract.js-core@7.0.0`, file of the same name | `c58b46a4c796c0b8afccf77591d5b875b6896b45d402bbce8caa6f5362447b38` |
| `tesseract-core-relaxedsimd-lstm.wasm.js` | `tesseract.js-core@7.0.0`, file of the same name | `861a536cf9ef8e63cb644d57bab39c388f37f7d6b6f60024b741c5f6b39a59b3` |
| `lang/eng.traineddata.gz` | `@tesseract.js-data/eng@1.0.0` (npm, one-time data source, not a dependency), path `4.0.0_best_int/eng.traineddata.gz` | `45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91` |

Licenses: tesseract.js and tesseract.js-core are Apache-2.0 (see their npm package.json). The model is
the tessdata_best English data distributed by `@tesseract.js-data/eng` (check that package for its terms). `src/lib/ocr-assets.test.ts` re-checks every hash above on each test run.

## Why only the three `-lstm` cores

`ocr.ts` creates the worker with OEM 1 (LSTM only). For that engine mode the worker loads exactly one
of the three `*-lstm.wasm.js` cores, chosen by CPU feature detection (relaxed SIMD, SIMD or plain).
The non-LSTM cores and the separate `.wasm` files are never requested, so they are not committed.
`corePath` is the directory `/tesseract`, never a single file.

## Why `cacheMethod: "none"`

By default Tesseract.js stores the downloaded model in IndexedDB (a database named `keyval-store`).
The model is not user data, but nothing about a bill should persist in the browser, and the model is
already served from a local file. `ocr.ts` sets `cacheMethod: "none"`, and the OCR e2e asserts that no
`keyval-store` database exists.

## Byte-exactness

`web/.gitattributes` marks `public/tesseract/**` as `-text -diff`. The repo runs with
`core.autocrlf=true`; without that attribute git would rewrite line endings in the `.js` files on a
Windows checkout and the sha256 values above would no longer match.

## Refreshing the assets

1. In `web/`, install the new `tesseract.js` version exactly (`npm install --save-exact tesseract.js@X`)
   and check that `node_modules/tesseract.js-core` has the matching version.
2. Copy the four `.js` files above from `node_modules` into this folder.
3. For a different model, take `4.0.0_best_int/eng.traineddata.gz` from `@tesseract.js-data/eng`
   (`npm pack` it somewhere outside the repo; do not add it to `package.json`).
4. Recompute the sha256 of all five files, update this table and the constants in
   `src/lib/ocr-assets.test.ts`.
5. Re-run the OCR e2e (`node e2e/run-all.mjs seller-ocr`); the sample bills' recorded OCR text in
   `src/lib/parse-receipt.fixtures.ts` may need to be recaptured if the engine output changed.
