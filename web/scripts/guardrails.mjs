// Guardrails: dependency pins and privacy rules. Plain Node ESM, no dependencies.
// Usage: node scripts/guardrails.mjs [pins|privacy|all]
// Prints one line per violation as `GUARDRAIL <rule> <file>:<line>`, then `GUARDRAILS OK` (exit 0)
// or exits 1.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] ?? "all";
if (!["pins", "privacy", "all"].includes(mode)) {
  console.log(`GUARDRAIL usage unknown-mode:${mode} (use pins, privacy or all)`);
  process.exit(1);
}

const violations = [];
const violation = (rule, file, line = 1) => violations.push(`GUARDRAIL ${rule} ${file}:${line}`);
const rel = (p) => path.relative(webDir, p).split(path.sep).join("/");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

// ---------------------------------------------------------------- pins
const CDP_SDK = "@coinbase/cdp-sdk";
const CDP_SDK_VERSION = "1.52.0";

function findNestedPackages(nodeModulesDir, name, depth, found) {
  if (depth > 4 || !fs.existsSync(nodeModulesDir)) return;
  const direct = path.join(nodeModulesDir, ...name.split("/"));
  if (fs.existsSync(path.join(direct, "package.json"))) found.push(direct);
  for (const entry of fs.readdirSync(nodeModulesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === ".bin") continue;
    const dirs = entry.name.startsWith("@")
      ? fs.readdirSync(path.join(nodeModulesDir, entry.name), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => path.join(nodeModulesDir, entry.name, e.name))
      : [path.join(nodeModulesDir, entry.name)];
    for (const dir of dirs) findNestedPackages(path.join(dir, "node_modules"), name, depth + 1, found);
  }
}

function checkPins() {
  const pkgPath = path.join(webDir, "package.json");
  const pkg = readJson(pkgPath);
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const [name, range] of Object.entries(all)) {
    if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(range)) violation(`pin-not-exact(${name}@${range})`, "package.json");
    const installed = path.join(webDir, "node_modules", ...name.split("/"), "package.json");
    if (!fs.existsSync(installed)) {
      violation(`pin-not-installed(${name})`, "package.json");
      continue;
    }
    const version = readJson(installed).version;
    if (version !== range) violation(`pin-drift(${name}:wanted-${range}-installed-${version})`, "package.json");
  }
  const found = [];
  findNestedPackages(path.join(webDir, "node_modules"), CDP_SDK, 0, found);
  for (const dir of found) {
    const version = readJson(path.join(dir, "package.json")).version;
    if (version !== CDP_SDK_VERSION) violation(`cdp-sdk-version(${version})`, rel(path.join(dir, "package.json")));
  }
  const major = (name) => {
    const f = path.join(webDir, "node_modules", name, "package.json");
    return fs.existsSync(f) ? Number(readJson(f).version.split(".")[0]) : NaN;
  };
  if (major("wagmi") !== 2) violation("wagmi-major-not-2", "package.json");
  if (major("typescript") !== 5) violation("typescript-major-not-5", "package.json");
}

// ---------------------------------------------------------------- privacy
// Files that may import an FHE SDK or the OCR package. Phase 2 opened exactly these two; Phase 4
// adds the OCR module.
const ALLOWED_SDK_FILES = ["src/lib/fhe.ts", "src/lib/zama.ts"];
const STORAGE_ALLOWED_FILE = "src/lib/role.ts";

const SOURCE_EXT = /\.(ts|tsx|js|jsx)$/;
const TEST_FILE = /\.test\.(ts|tsx)$/;

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (SOURCE_EXT.test(entry.name) && !TEST_FILE.test(entry.name)) out.push(full);
  }
}

const LINE_RULES = [
  { rule: "sdk-import", test: (l) => /(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)["']@zama-fhe\//.test(l) || /(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)["']tesseract/.test(l), sdkFile: true },
  { rule: "local-storage", test: (l) => /localStorage/.test(l), allowedFile: STORAGE_ALLOWED_FILE },
  { rule: "session-storage", test: (l) => /sessionStorage/.test(l) },
  { rule: "indexed-db", test: (l) => /indexedDB/.test(l) },
  { rule: "raw-html-injection", test: (l) => /dangerouslySetInnerHTML/.test(l) },
  { rule: "network-send(fetch)", test: (l) => /\bfetch\s*\(/.test(l) },
  { rule: "network-send(XMLHttpRequest)", test: (l) => /XMLHttpRequest/.test(l) },
  { rule: "network-send(sendBeacon)", test: (l) => /sendBeacon/.test(l) },
  { rule: "network-send(FormData)", test: (l) => /new\s+FormData/.test(l) },
];

// A static value import of the FHE SDK is evaluated by the server render, which is the SSR crash
// vector (the SDK needs browser globals). Inside the allowed files only `import type` and
// `import()` inside async functions are accepted.
const SDK_STATIC_VALUE_IMPORT = /^\s*import\s+(?!type\b)[^(]*?from\s+["']@zama-fhe\/|^\s*import\s+["']@zama-fhe\//;

function checkPrivacy() {
  const srcDir = path.join(webDir, "src");
  const files = [];
  if (fs.existsSync(srcDir)) walk(srcDir, files);
  for (const file of files) {
    const r = rel(file);
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((text, i) => {
      for (const rule of LINE_RULES) {
        if (rule.allowedFile && r === rule.allowedFile) continue;
        if (rule.sdkFile && ALLOWED_SDK_FILES.includes(r)) continue;
        if (rule.test(text)) violation(rule.rule, r, i + 1);
      }
      if (ALLOWED_SDK_FILES.includes(r) && SDK_STATIC_VALUE_IMPORT.test(text)) violation("sdk-static-import", r, i + 1);
    });
  }
  for (const name of ["next.config.ts", "next.config.mjs", "next.config.js"]) {
    const f = path.join(webDir, name);
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, "utf8").split(/\r?\n/).forEach((text, i) => {
      if (/Cross-Origin-(Embedder|Opener)-Policy/i.test(text)) violation("coop-coep-header", name, i + 1);
    });
  }
}

if (mode === "pins" || mode === "all") checkPins();
if (mode === "privacy" || mode === "all") checkPrivacy();

if (violations.length > 0) {
  for (const v of violations) console.log(v);
  process.exit(1);
}
console.log("GUARDRAILS OK");
