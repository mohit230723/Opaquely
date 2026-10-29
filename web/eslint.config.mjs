import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "next-env.d.ts",
    "e2e/**",
    "scripts/**",
    // Vendored Tesseract OCR assets (worker and wasm cores, sha256-pinned): minified third-party code.
    "public/**",
    // Vendored hero (plan 01-05); the file is ignored now so no later plan edits this config for it.
    "src/components/GradientASCII.jsx",
  ]),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-console": "error",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/data/provider.tsx", "src/data/stub/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/data/stub", "@/data/stub/*", "**/data/stub", "**/data/stub/*"],
              message: "Screens read data through useDataLayer() and data/hooks.ts only",
            },
          ],
        },
      ],
    },
  },
]);
