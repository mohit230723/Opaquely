// Seller adds a bill: the validated review form, then (Task 2) the in-memory image preview and the
// dataset detail screen. No request with method POST may leave the page during the whole script.
// Stub state lives in page memory, so the flow uses in-app links and goBack instead of page.goto
// once a write has happened.

const T = { timeout: 10_000 };
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

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
  const page = await newPage({ account: accounts.seller, roles: { [accounts.seller]: "seller" } });
  const posts = [];
  trackPosts(page, posts);

  // ---- review form validation and a successful add ----
  await page.goto(baseUrl + "/sell/datasets/household-utilities-2026/add");
  await waitForWallet(page, accounts.seller);
  await page.getByRole("heading", { name: "Add a bill" }).waitFor({ state: "visible", timeout: 25_000 });

  const submit = page.getByRole("button", { name: "Add bill to dataset" });
  await submit.waitFor({ state: "visible", ...T });

  await page.getByLabel("Total amount").fill("0");
  await page.getByLabel("Total amount").blur();
  await page.getByText("Enter an amount greater than 0.").waitFor({ state: "visible", ...T });

  await page.getByLabel("Date").fill(localDateInput(1));
  await page.getByLabel("Date").blur();
  await page.getByText("Enter a valid date that is not in the future.").waitFor({ state: "visible", ...T });

  assert((await submit.getAttribute("aria-disabled")) === "true", "submit must be aria-disabled while the form is invalid");
  await page.getByText("Enter an amount, a date and a category to continue.").waitFor({ state: "visible", ...T });

  await page.getByLabel("Vendor (optional)").fill("Corner Store");
  await page.getByLabel("Total amount").fill("1,234.50");
  await page.getByLabel("Date").fill("2026-10-01");
  await page.getByRole("radio", { name: "Utilities" }).click();
  assert((await submit.getAttribute("aria-disabled")) === null, "submit must be enabled once the form is valid");
  assert(
    (await page.getByText("Enter an amount, a date and a category to continue.").count()) === 0,
    "the missing-fields helper must disappear when the form is valid",
  );

  await submit.click();
  await page.getByText("Transaction confirmed").waitFor({ state: "visible", ...T });
  await page.getByText("Bill added. This dataset now has 2 bills.").waitFor({ state: "visible", ...T });

  await page.getByRole("button", { name: "Add another bill" }).click();
  await page.getByLabel("Total amount").waitFor({ state: "visible", ...T });
  assert((await page.getByLabel("Total amount").inputValue()) === "", "the amount field must be empty after Add another bill");
  assert((await page.getByLabel("Vendor (optional)").inputValue()) === "", "the vendor field must be empty after Add another bill");

  // ---- image preview: in memory only, wrong files rejected, remove clears it ----
  await page.getByText("Drop a JPG or PNG here, or choose a file").waitFor({ state: "visible", ...T });
  const fileInput = page.locator('input[type="file"]');
  const preview = page.getByRole("img", { name: "Preview of the selected bill" });

  await fileInput.setInputFiles({ name: "bill.png", mimeType: "image/png", buffer: TINY_PNG });
  await preview.waitFor({ state: "visible", ...T });
  const src = (await preview.getAttribute("src")) ?? "";
  assert(src.startsWith("blob:"), `preview src must be a blob: URL, got ${src.slice(0, 20)}`);
  await page.getByText("bill.png. Stays in this browser tab. It is never uploaded.").waitFor({ state: "visible", ...T });

  await fileInput.setInputFiles({ name: "bill.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await page.getByText("Only JPG or PNG images are supported. Choose a different file.").waitFor({ state: "visible", ...T });
  assert((await preview.count()) === 1, "the PNG preview must stay after a rejected file");

  await fileInput.setInputFiles({ name: "huge.png", mimeType: "image/png", buffer: Buffer.alloc(10485761) });
  await page.getByText("That image is larger than 10 MB. Choose a smaller file.").waitFor({ state: "visible", ...T });
  assert((await preview.count()) === 1, "the PNG preview must stay after an oversized file");

  await page.getByRole("button", { name: "Remove image" }).click();
  await preview.waitFor({ state: "detached", ...T });

  // ---- sealed and listed datasets, not found, and the dataset detail screen (fresh page, reseeded) ----
  const detail = await newPage({ account: accounts.seller, roles: { [accounts.seller]: "seller" } });
  trackPosts(detail, posts);
  const visit = async (path) => {
    await detail.goto(baseUrl + path);
    await waitForWallet(detail, accounts.seller);
  };

  await visit("/sell/datasets/household-utilities-2026");
  await detail.getByText("1 of 3 bills needed to list").waitFor({ state: "visible", timeout: 25_000 });
  await detail.getByRole("link", { name: "Add bill", exact: true }).waitFor({ state: "visible", ...T });
  await detail.getByText("Needs 3 bills").waitFor({ state: "visible", ...T });
  assert(
    (await detail.getByRole("link", { name: "List dataset" }).getAttribute("aria-disabled")) === "true",
    "List dataset must be disabled under the minimum",
  );

  await visit("/sell/datasets/medical-and-pharmacy");
  await detail.getByText("Listed", { exact: true }).waitFor({ state: "visible", timeout: 25_000 });
  await detail.getByText("0.03 ETH").waitFor({ state: "visible", ...T });
  assert((await detail.getByRole("link", { name: "Add bill", exact: true }).count()) === 0, "a listed dataset must not offer Add bill");

  await visit("/sell/datasets/does-not-exist");
  await detail.getByText("Dataset not found").waitFor({ state: "visible", timeout: 25_000 });

  await visit("/sell/datasets/medical-and-pharmacy/add");
  await detail.getByText("This dataset is sealed").waitFor({ state: "visible", timeout: 25_000 });

  assert(posts.length === 0, `no POST request may leave the page, saw: ${posts.join(", ")}`);
}
