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
    // Vendored user-supplied React Bits components (plans 07-02 and 07-03), same precedent: their .d.ts files are
    // type-checked, and the guardrails walker and the 07-03 pattern re-scan still cover the .jsx sources.
    "src/components/ui/GooeyNav.jsx",
    "src/components/ui/StaggeredMenu.jsx",
    "src/components/ui/TiltedCard.jsx",
    "src/components/ui/SpecularButton.jsx",
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
