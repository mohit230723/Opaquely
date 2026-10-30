// Seller OCR on the Upload page (Phase 7, D-02/D-13): resume a seeded draft at /upload?dataset=, pick a bundled
// sample (and upload a file), watch the progress, and check the review form is pre-filled from the parsed text.
// The runner aborts every non-local request, so a pass also proves OCR works with the CDN blocked. Privacy
// checks: no POST, no tesseract IndexedDB cache, no failed OCR request, no opaquely* storage key.
// Every lookup is scoped to main: the footer repeats the nav link names. scripts/demo-rehearse.mjs runs this
// script by name, so the file name stays.
import path from "node:path";
import { fileURLToPath } from "node:url";

const T = { timeout: 30_000 };
const samplesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/samples");

export default async function sellerOcr({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  const page = await newPage({ account: accounts.seller });
  const posts = [];
  const failed = [];
  const requested = [];
  page.on("request", (r) => {
    requested.push(r.url());
    if (r.method() === "POST" && new URL(r.url()).hostname !== "pulse.walletconnect.org") posts.push(r.url());
  });
  page.on("requestfailed", (r) => {
    if (new URL(r.url()).hostname !== "pulse.walletconnect.org") failed.push(r.url());
  });

  await page.goto(baseUrl + "/upload?dataset=household-utilities-2026");
  await waitForWallet(page, accounts.seller);
  const main = page.locator("main");
  await main.getByRole("heading", { level: 2, name: "Add a bill" }).waitFor({ state: "visible", timeout: 25_000 });
  // The resumed draft is the seeded one, not a new upload.
  await page.waitForFunction(
    () => document.querySelector('main input[name="dataset-name"]')?.value === "Household utilities 2026",
    null,
    T,
  );
  // The banner is honest about the local mock: the node sees amount, date and category in cleartext.
  await main.getByText("Local FHEVM mock: the image and the vendor stay in this browser").waitFor({ state: "visible", timeout: 10_000 });

  // Sample 1: grocery. The progress indicator shows, then the form is filled.
  await main.getByRole("button", { name: "Grocery" }).click();
  await main.getByRole("progressbar", { name: "OCR progress" }).waitFor({ state: "visible", timeout: 10_000 });
  await main.getByTestId("ocr-status").filter({ hasText: "Read the bill" }).waitFor(T);
  assert((await main.getByLabel("Vendor (optional)").inputValue()) === "SHREE GANESH SUPER MART", "vendor prefill");
  assert((await main.getByLabel("Total amount").inputValue()) === "1507.80", "amount prefill");
  assert((await main.getByLabel("Date").inputValue()) === "2026-10-18", "date prefill");
  assert(
    (await main.getByRole("radio", { name: "Groceries/Food" }).getAttribute("aria-checked")) === "true",
    "category prefill",
  );

  // Sample 2 by file upload (a real File through the input), then a manual correction still works.
  await main.getByLabel("Bill image file").setInputFiles(path.join(samplesDir, "bill-pharmacy.png"));
  await main.getByTestId("ocr-status").filter({ hasText: "Read the bill" }).waitFor(T);
  await page.waitForFunction(() => document.querySelector('main input[name="amount"]')?.value === "8345.50", null, T);
  assert((await main.getByLabel("Date").inputValue()) === "2026-10-25", "pharmacy date prefill");
  assert((await main.getByRole("radio", { name: "Medical" }).getAttribute("aria-checked")) === "true", "medical prefill");
  await main.getByLabel("Total amount").fill("8,300.00");
  assert((await main.getByLabel("Total amount").inputValue()) === "8,300.00", "manual correction");

  // A third read (WR-03) must not wipe what the seller corrected: the amount stays, the untouched fields follow the new bill.
  await main.getByRole("button", { name: "Grocery" }).click();
  await page.waitForFunction(() => document.querySelector('main input[name="date"]')?.value === "2026-10-18", null, T);
  assert((await main.getByLabel("Total amount").inputValue()) === "8,300.00", "typed amount survives a later OCR run");
  assert((await main.getByLabel("Vendor (optional)").inputValue()) === "SHREE GANESH SUPER MART", "untouched vendor follows the new bill");

  // Privacy and self-hosting.
  const dbs = await page.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : []));
  // Wallet libraries own WALLET_CONNECT_V2_INDEXED_DB and base-acc-sdk. tesseract.js would add idb-keyval's
  // default "keyval-store" (the model cache) unless cacheMethod is "none".
  assert(!dbs.includes("keyval-store"), "tesseract must not cache the model in IndexedDB, got " + JSON.stringify(dbs));
  // The app stores nothing of its own (no role, no bill, no draft): no opaquely* key in either storage, and
  // localStorage holds only the wallet libraries' keys.
  const { local, session } = await page.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }));
  const ownKeys = [...local, ...session].filter((k) => k.toLowerCase().startsWith("opaquely"));
  assert(ownKeys.length === 0, "no opaquely* storage key expected, got " + ownKeys.join(","));
  assert(
    local.every((k) => /^(wagmi|rk-|@appkit|base-acc-sdk|WALLETCONNECT|wc@)/i.test(k)),
    "unexpected localStorage keys: " + local.join(","),
  );
  assert(posts.length === 0, "no POST allowed, got " + posts.join(","));
  // Wallet libraries make their own external calls that the runner aborts; OCR assets must never fail.
  const ocrFailed = failed.filter((u) => /\/(tesseract|samples)\//.test(u));
  assert(ocrFailed.length === 0, "no OCR asset request may fail: " + ocrFailed.join(","));
  const tess = requested.filter((u) => u.includes("/tesseract/"));
  assert(tess.some((u) => u.endsWith("/tesseract/worker.min.js")), "worker.min.js must load from /tesseract");
  assert(tess.some((u) => /-lstm\.wasm\.js$/.test(u)), "an lstm core must load from /tesseract");
  assert(tess.some((u) => u.endsWith("/tesseract/lang/eng.traineddata.gz")), "eng model must load from /tesseract/lang");
  assert(!requested.some((u) => /jsdelivr|unpkg|cdn\./.test(u)), "no CDN request may be attempted");
  console.log("  OCR OK requests=" + tess.map((u) => u.split("/tesseract/")[1]).join(" "));
}
