// Seller adds a bill: the validated review form, then (Task 2) the in-memory image preview and the
// dataset detail screen. No request with method POST may leave the page during the whole script.
// Stub state lives in page memory, so the flow uses in-app links and goBack instead of page.goto
// once a write has happened.

const T = { timeout: 10_000 };

function localDateInput(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function sellerAddBill({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  const page = await newPage({ account: accounts.seller, roles: { [accounts.seller]: "seller" } });
  const posts = [];
  page.on("request", (req) => {
    if (req.method() === "POST") posts.push(req.url());
  });

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

  assert(posts.length === 0, `no POST request may leave the page, saw: ${posts.join(", ")}`);
}
