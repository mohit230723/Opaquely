// Upload flow (Phase 7, D-03): one page. Describe the dataset, read a sample bill by OCR in this browser, then
// press Encrypt; the first Encrypt creates the dataset and records the bill (stub data layer, about 5.4 s of
// simulated signing and confirming). It also carries the dataset-name validation that create-dataset covered.
// Every lookup is scoped to main: the footer repeats the nav link names.

const T = { timeout: 10_000 };

export default async function uploadFlow({ baseUrl, accounts, assert, waitForWallet, newPage }) {
  const page = await newPage({ account: accounts.seller });
  const posts = [];
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).hostname !== "pulse.walletconnect.org") posts.push(req.url());
  });

  await page.goto(baseUrl + "/upload");
  await waitForWallet(page, accounts.seller);
  const main = page.locator("main");
  await main.getByRole("heading", { level: 1, name: "Upload" }).waitFor({ state: "visible", timeout: 25_000 });
  await main.getByRole("heading", { level: 2, name: "Describe your dataset" }).waitFor({ state: "visible", ...T });
  await main.getByRole("heading", { level: 2, name: "Add a bill" }).waitFor({ state: "visible", ...T });
  assert((await main.locator("ol").count()) === 0, "the Upload steps are sections, not an ol");
  await main.getByText("Local FHEVM mock: the image and the vendor stay in this browser").waitFor({ state: "visible", ...T });
  await main.getByText("Local only: the image and these fields stay in your browser until they are encrypted.").waitFor({ state: "visible", ...T });
  await main
    .getByText("The first Encrypt asks your wallet twice: once to create the dataset, once to record the bill.")
    .waitFor({ state: "visible", ...T });

  // Fresh dataset: Encrypt is a real, named button, blocked until step 1 is valid.
  const encrypt = main.getByRole("button", { name: "Encrypt", exact: true });
  await encrypt.waitFor({ state: "visible", ...T });
  assert((await encrypt.getAttribute("aria-disabled")) === "true", "Encrypt must be aria-disabled before step 1 is filled");
  await main.getByText("Add a name and description first.").waitFor({ state: "visible", ...T });

  // Leaving each empty field shows its validation copy (unchanged from Phase 1).
  const nameField = main.getByLabel("Dataset name");
  const descriptionField = main.getByLabel("Description");
  await nameField.focus();
  await nameField.blur();
  await main.getByText("Give your dataset a name (1 to 60 characters).").waitFor({ state: "visible", ...T });
  await descriptionField.focus();
  await descriptionField.blur();
  await main.getByText("Add a short description (1 to 300 characters).").waitFor({ state: "visible", ...T });

  const datasetName = `E2E upload ${Date.now().toString(36)}`;
  await nameField.fill(datasetName);
  await descriptionField.fill("Three household bills from October, read in the browser.");
  assert(
    (await main.getByText("Give your dataset a name (1 to 60 characters).").count()) === 0,
    "the name error must clear once the name is valid",
  );
  await main.getByText("Add a name and description first.").waitFor({ state: "detached", ...T });

  // Read a sample bill in this browser; the review form is prefilled.
  await main.getByRole("button", { name: "Grocery" }).click();
  await main.getByTestId("ocr-status").filter({ hasText: "Read the bill" }).waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => (document.querySelector('main input[name="amount"]')?.value ?? "") !== "", null, T);
  assert((await main.getByLabel("Total amount").inputValue()) === "1507.80", "amount prefill from the sample");
  assert((await encrypt.getAttribute("aria-disabled")) === null, "Encrypt must be enabled once step 1 and the bill are valid");

  // First Encrypt: create the dataset, then record the bill, through one TxStatus.
  await encrypt.click();
  await main.getByText("Confirm in your wallet").waitFor({ state: "visible", ...T });
  await main.getByText("Bill encrypted. This dataset has 1 bill.").waitFor({ state: "visible", timeout: 20_000 });
  await main
    .getByText("Your bill was encrypted in this browser and added to the dataset's encrypted totals. The chain never saw the values.")
    .waitFor({ state: "visible", ...T });
  await main.getByText("Transaction confirmed").waitFor({ state: "visible", ...T });
  assert(
    (await nameField.getAttribute("readonly")) !== null,
    "the dataset name must be read-only once the dataset exists",
  );

  // Add another bill clears the form; the next Encrypt no longer mentions creating the dataset.
  await main.getByRole("button", { name: "Add another bill" }).click();
  await main.getByLabel("Total amount").waitFor({ state: "visible", ...T });
  assert((await main.getByLabel("Total amount").inputValue()) === "", "the amount field must be empty after Add another bill");
  assert(
    (await main.getByText("The first Encrypt asks your wallet twice").count()) === 0,
    "the two-prompt note is only for the first Encrypt",
  );

  assert(posts.length === 0, "no POST may leave the page, got " + posts.join(","));
}
