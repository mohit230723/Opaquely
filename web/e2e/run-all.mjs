// Headless Chrome e2e runner: starts `next start`, injects a test wallet, runs e2e/*.e2e.mjs.
// Usage: node e2e/run-all.mjs [--port 3100] [script-name ...]
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import { walletStubInitScript } from "./wallet-stub.mjs";

const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const e2eDir = path.join(webDir, "e2e");

// ---- args ----
const argv = process.argv.slice(2);
let port = 3100;
const filters = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--port") {
    port = Number(argv[++i]);
  } else {
    filters.push(argv[i]);
  }
}

if (!fs.existsSync(path.join(webDir, ".next", "BUILD_ID"))) {
  console.log("Run npm --prefix web run build first");
  process.exit(1);
}

// Public Hardhat dev accounts.
const accounts = {
  seller: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  buyer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
};
const baseUrl = `http://127.0.0.1:${port}`;

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function waitForServer(server, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (server.exitCode !== null) {
      throw new Error(`next start exited with code ${server.exitCode} (is port ${port} already in use?)`);
    }
    try {
      const res = await fetch(baseUrl + "/");
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`next start did not answer on ${baseUrl} within ${timeoutMs / 1000}s`);
}

const isLocalHost = (url) => {
  try {
    const h = new URL(url).hostname;
    return h === "127.0.0.1" || h === "localhost";
  } catch {
    return false;
  }
};

async function main() {
  // Refuse to run against a server we did not start (a stale dev server would answer the poll).
  const alreadyUp = await fetch(baseUrl + "/").then(() => true, () => false);
  if (alreadyUp) {
    console.log(`FAIL runner: port ${port} is already in use; pass --port <free port>`);
    console.log("E2E FAILED");
    process.exit(1);
  }
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
    cwd: webDir,
    stdio: ["ignore", "ignore", "inherit"],
  });
  let browser;
  let failed = false;
  try {
    await waitForServer(server);
    browser = await chromium.launch({
      channel: "chrome",
      headless: true,
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    });

    const files = fs
      .readdirSync(e2eDir)
      .filter((f) => f.endsWith(".e2e.mjs"))
      .sort();

    for (const file of files) {
      const name = file.replace(/\.e2e\.mjs$/, "");
      if (filters.length > 0 && !filters.includes(name)) continue;

      const startedAt = Date.now();
      const contexts = [];
      const pageErrors = [];

      // roles: map of address -> "seller" | "buyer", written to localStorage on the app origin only.
      async function newPage({ account = null, chainId = 31337, roles = {}, reducedMotion, viewport, rpcUrl } = {}) {
        const context = await browser.newContext({
          viewport: viewport ?? { width: 1280, height: 800 },
          reducedMotion: reducedMotion ? "reduce" : "no-preference",
        });
        contexts.push(context);
        // Nothing but the local server may be reached.
        await context.route("**/*", (route) => {
          if (isLocalHost(route.request().url())) return route.continue();
          return route.abort();
        });
        if (account) {
          await context.addInitScript({ content: walletStubInitScript({ account, chainId, rpcUrl }) });
        }
        await context.addInitScript(
          ({ origin, withWallet, roleEntries }) => {
            if (location.origin !== origin) return;
            if (withWallet) localStorage.setItem("wagmi.recentConnectorId", JSON.stringify("com.opaquely.e2e"));
            for (const [addr, role] of roleEntries) {
              localStorage.setItem("opaquely:role:" + addr.toLowerCase(), role);
            }
          },
          { origin: baseUrl, withWallet: Boolean(account), roleEntries: Object.entries(roles) },
        );
        const page = await context.newPage();
        page.on("pageerror", (err) => pageErrors.push(err));
        if (process.env.E2E_DEBUG) page.on("console", (m) => console.log("  [console." + m.type() + "]", m.text().slice(0, 300)));
        return page;
      }

      async function waitForWallet(page, address) {
        const last4 = address.slice(-4);
        await page
          .getByRole("button", { name: new RegExp(last4, "i") })
          .first()
          .waitFor({ state: "visible", timeout: 25_000 });
      }

      const ctx = { baseUrl, browser, accounts, assert, waitForWallet, newPage };

      try {
        const mod = await import(pathToFileURL(path.join(e2eDir, file)).href);
        await mod.default(ctx);
        if (pageErrors.length > 0) {
          throw new Error("page errors: " + pageErrors.map((e) => e.message).join(" | "));
        }
        console.log(`PASS ${name} (${((Date.now() - startedAt) / 1000).toFixed(1)}s)`);
      } catch (err) {
        failed = true;
        console.log(`FAIL ${name} (${((Date.now() - startedAt) / 1000).toFixed(1)}s): ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        for (const c of contexts) await c.close().catch(() => {});
      }
    }
  } catch (err) {
    failed = true;
    console.log(`FAIL runner: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill();
  }
  console.log(failed ? "E2E FAILED" : "E2E OK");
  process.exit(failed ? 1 : 0);
}

main();
