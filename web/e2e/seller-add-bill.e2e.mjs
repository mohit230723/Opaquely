// Seller adds a bill on the Upload page (Phase 7, D-02/D-13): resume the seeded open draft at
// /upload?dataset=, run the validated review form, press Encrypt and see the new bill's chain row, then the
// in-memory image preview and the Dropzone errors. The old per-dataset seller pages are gone: their URLs
// redirect to Upload (add, list) or My Datasets (detail, chain-view). No request with method POST may leave
// the page during the whole script. Every lookup is scoped to main: the footer repeats the nav link names.

const T = { timeout: 10_000 };
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const DRAFT = "household-utilities-2026";

// RainbowKit/WalletConnect fires a telemetry POST at this host on load. The runner aborts every
// non-local request, and the payload is wallet-library usage with no page data. Any other POST,
// local or remote, fails the script.
const WALLET_TELEMETRY_HOST = "pulse.walletconnect.org";

function trackPosts(page, posts) {
  page.on("request", (req) => {
    if (req.method() !== "POST") return;
    if (new URL(req.url()).hostname === WALLET_TELEMETRY_HOST) return;
    posts.push(req.url());
  });
}

function localDateInput(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function sellerAddBill({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  const page = await newPage({ account: accounts.seller });
  const posts = [];
  trackPosts(page, posts);

  // ---- resume the seeded draft (1 bill) on Upload ----
  await page.goto(baseUrl + "/upload?dataset=household-utilities-2026");
  await waitForWallet(page, accounts.seller);
  const main = page.locator("main");
  await main.getByRole("heading", { level: 2, name: "Add a bill" }).waitFor({ state: "visible", timeout: 25_000 });
  await page.waitForFunction(
    () => document.querySelector('main input[name="dataset-name"]')?.value === "Household utilities 2026",
    null,
    T,
  );
  const step3 = main.locator("section", { has: page.getByRole("heading", { level: 2, name: "Encrypted bills" }) });
  await step3.getByText("1 of 3 bills needed to list").waitFor({ state: "visible", ...T });

  const submit = main.getByRole("button", { name: "Encrypt", exact: true });
  await submit.waitFor({ state: "visible", ...T });

  // ---- review form validation ----
  // Enter on an untouched, incomplete form shows every error and focuses the first invalid field.
  await main.getByLabel("Vendor (optional)").press("Enter");
  await main.getByText("Enter an amount greater than 0.").waitFor({ state: "visible", ...T });
  await main.getByText("Choose a category.").waitFor({ state: "visible", ...T });
  assert(
    await main.getByLabel("Total amount").evaluate((el) => el === document.activeElement),
    "Enter on an incomplete form must focus the first invalid field",
  );

  await main.getByLabel("Total amount").fill("0");
  await main.getByLabel("Total amount").blur();
  await main.getByText("Enter an amount greater than 0.").waitFor({ state: "visible", ...T });

  await main.getByLabel("Date").fill(localDateInput(1));
  await main.getByLabel("Date").blur();
  await main.getByText("Enter a valid date that is not in the future.").waitFor({ state: "visible", ...T });

  assert((await submit.getAttribute("aria-disabled")) === "true", "Encrypt must be aria-disabled while the form is invalid");
  await main.getByText("Enter an amount, a date and a category to continue.").waitFor({ state: "visible", ...T });

  await main.getByLabel("Vendor (optional)").fill("Corner Store");
  await main.getByLabel("Total amount").fill("1,234.50");
  await main.getByLabel("Date").fill("2026-10-01");
  await main.getByRole("radio", { name: "Utilities" }).click();
  assert((await submit.getAttribute("aria-disabled")) === null, "Encrypt must be enabled once the form is valid");
  assert(
    (await main.getByText("Enter an amount, a date and a category to continue.").count()) === 0,
    "the missing-fields helper must disappear when the form is valid",
  );

  // ---- Encrypt: one transaction through useTx and TxStatus (create-dataset's busy and pending checks) ----
  await submit.click();
  await main.getByText("Confirm in your wallet").waitFor({ state: "visible", ...T });
  assert((await submit.getAttribute("aria-busy")) === "true", "Encrypt must be aria-busy while the transaction is in flight");
  await main.getByText("Transaction pending").waitFor({ state: "visible", ...T });
  await main.getByText("Transaction confirmed").waitFor({ state: "visible", ...T });
  await main.getByText("Bill encrypted. This dataset has 2 bills.").waitFor({ state: "visible", ...T });

  // The new bill shows under Encrypted bills with the values this tab holds; the seeded one cannot.
  await step3.getByRole("heading", { level: 3, name: "Bill 2" }).waitFor({ state: "visible", ...T });
  await step3.getByText("2 of 3 bills needed to list").waitFor({ state: "visible", ...T });
  const bill2 = step3.locator("li").filter({ has: page.getByRole("heading", { level: 3, name: "Bill 2" }) });
  assert((await bill2.count()) === 1, "exactly one chain row for Bill 2");
  assert(
    (await bill2.getByText("Not available after reload").count()) === 0,
    "the bill encrypted in this tab must show its values, not the after-reload note",
  );
  await step3.getByText("Not available after reload").first().waitFor({ state: "visible", ...T });

  await main.getByRole("button", { name: "Add another bill" }).click();
  await main.getByLabel("Total amount").waitFor({ state: "visible", ...T });
  assert((await main.getByLabel("Total amount").inputValue()) === "", "the amount field must be empty after Add another bill");
  assert((await main.getByLabel("Vendor (optional)").inputValue()) === "", "the vendor field must be empty after Add another bill");

  // ---- image preview: in memory only, wrong files rejected, remove clears it ----
  await main.getByText("Drop a JPG or PNG here, or choose a file").waitFor({ state: "visible", ...T });
  const fileInput = main.locator('input[type="file"]');
  const preview = main.getByRole("img", { name: "Preview of the selected bill" });

  await fileInput.setInputFiles({ name: "bill.png", mimeType: "image/png", buffer: TINY_PNG });
  await preview.waitFor({ state: "visible", ...T });
  const src = (await preview.getAttribute("src")) ?? "";
  assert(src.startsWith("blob:"), `preview src must be a blob: URL, got ${src.slice(0, 20)}`);
  await main.getByText("bill.png. Stays in this browser tab. It is never uploaded.").waitFor({ state: "visible", ...T });

  await fileInput.setInputFiles({ name: "bill.txt", mimeType: "text/plain", buffer: Buffer.from("not a bill") });
  await main.getByText("Only JPG or PNG images are supported. Choose a different file.").waitFor({ state: "visible", ...T });
  assert((await preview.count()) === 1, "the PNG preview must stay after a rejected file");
  assert((await preview.getAttribute("src")) === src, "the previous preview must be kept, not replaced");

  await fileInput.setInputFiles({ name: "huge.png", mimeType: "image/png", buffer: Buffer.alloc(10485761) });
  await main.getByText("That image is larger than 10 MB. Choose a smaller file.").waitFor({ state: "visible", ...T });
  assert((await preview.count()) === 1, "the PNG preview must stay after an oversized file");
  assert((await preview.getAttribute("src")) === src, "the previous preview must be kept after an oversized file");

  await main.getByRole("button", { name: "Remove image" }).click();
  await preview.waitFor({ state: "detached", ...T });

  // ---- the retired seller pages redirect (fresh page, reseeded stub) ----
  const old = await newPage({ account: accounts.seller });
  trackPosts(old, posts);
  const visit = async (path) => {
    await old.goto(baseUrl + path);
    await waitForWallet(old, accounts.seller);
    return new URL(old.url());
  };
  const omain = old.locator("main");

  for (const sub of ["add", "list"]) {
    const landed = await visit(`/sell/datasets/${DRAFT}/${sub}`);
    assert(landed.pathname === "/upload", `/sell/datasets/{id}/${sub} must land on /upload, got ${landed.pathname}`);
    assert(
      landed.searchParams.get("dataset") === DRAFT,
      `/sell/datasets/{id}/${sub} must carry dataset=${DRAFT}, got ${landed.search}`,
    );
    await old.waitForFunction(
      () => document.querySelector('main input[name="dataset-name"]')?.value === "Household utilities 2026",
      null,
      { timeout: 25_000 },
    );
  }

  for (const path of [`/sell/datasets/${DRAFT}`, `/sell/datasets/${DRAFT}/chain-view`]) {
    const landed = await visit(path);
    assert(landed.pathname === "/my-datasets", `${path} must land on /my-datasets, got ${landed.pathname}`);
  }

  // A listed dataset is sealed: its old add link resumes nothing and says so.
  const sealed = await visit("/sell/datasets/medical-and-pharmacy/add");
  assert(sealed.pathname === "/upload", `a sealed dataset's add link must land on /upload, got ${sealed.pathname}`);
  await omain.getByRole("heading", { name: "Dataset not found" }).waitFor({ state: "visible", timeout: 25_000 });
  assert(
    (await omain.getByRole("button", { name: "Encrypt", exact: true }).count()) === 0,
    "a sealed dataset must not offer Encrypt",
  );

  assert(posts.length === 0, `no POST request may leave the page, saw: ${posts.join(", ")}`);
}
