// Renders the 3 synthetic sample bills to PNG with headless Chrome (playwright-core from web/node_modules).
// The vendors, GSTIN and addresses are invented: no real personal data. The arithmetic is consistent
// (items add to the sub total, plus tax, give the total). Regenerating changes pixels, so
// src/lib/parse-receipt.fixtures.ts (real Tesseract output for these exact bytes) must be recaptured.
// Usage: node scripts/gen-sample-bills.mjs [outDir]   (default: ../public/samples)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
const here = path.dirname(fileURLToPath(import.meta.url));

const css = `
 body{margin:0;background:#fff;color:#000}
 .r{box-sizing:border-box;padding:28px 30px;background:#fff}
 .mono{font-family:"Courier New",Courier,monospace;font-size:19px;line-height:1.35;width:560px}
 .sans{font-family:Arial,Helvetica,sans-serif;font-size:20px;line-height:1.4;width:760px}
 .c{text-align:center} .b{font-weight:bold} hr{border:0;border-top:2px dashed #000;margin:10px 0}
 .row{display:flex;justify-content:space-between} .big{font-size:26px}
 table{border-collapse:collapse;width:100%} td,th{padding:4px 6px;border-bottom:1px solid #444;text-align:left} td.n,th.n{text-align:right}
 h1{font-size:30px;margin:0 0 4px 0}
`;
const bills = {
  "bill-grocery": `<div class="r mono">
  <div class="c b big">SHREE GANESH SUPER MART</div>
  <div class="c">Plot 14, MG Road, Pune 411001</div>
  <div class="c">GSTIN 27ABCDE1234F1Z5</div>
  <hr>
  <div class="row"><span>Bill No: 004521</span><span>Date: 18/10/2026</span></div>
  <div>Time: 18:42  Cashier: 03</div>
  <hr>
  <div class="row b"><span>ITEM</span><span>QTY  AMOUNT</span></div>
  <div class="row"><span>Basmati Rice 5kg</span><span>1   642.00</span></div>
  <div class="row"><span>Toor Dal 1kg</span><span>2   318.00</span></div>
  <div class="row"><span>Amul Butter 500g</span><span>1   285.00</span></div>
  <div class="row"><span>Fresh Milk 1L</span><span>4   112.00</span></div>
  <div class="row"><span>Tomato 2kg</span><span>1    79.00</span></div>
  <hr>
  <div class="row"><span>Total Items: 9</span><span></span></div>
  <div class="row"><span>Sub Total</span><span>1,436.00</span></div>
  <div class="row"><span>GST 5%</span><span>71.80</span></div>
  <div class="row b big"><span>GRAND TOTAL</span><span>1,507.80</span></div>
  <hr>
  <div class="row"><span>CASH TENDERED</span><span>2,000.00</span></div>
  <div class="row"><span>CHANGE</span><span>492.20</span></div>
  <hr>
  <div class="c">Thank you, visit again!</div>
</div>`,
  "bill-electricity": `<div class="r sans">
  <h1>Bright Power Distribution Co. Ltd.</h1>
  <div class="b">ELECTRICITY BILL</div>
  <hr>
  <div class="row"><span>Consumer No: 1002938475</span><span>Bill Date: 12 Oct 2026</span></div>
  <div class="row"><span>Billing Period: 01 Sep - 30 Sep 2026</span><span>Due Date: 27 Oct 2026</span></div>
  <div>Units Consumed: 412 kWh</div>
  <hr>
  <table>
   <tr><th>Charge</th><th class="n">Amount (Rs.)</th></tr>
   <tr><td>Energy Charges</td><td class="n">2,884.00</td></tr>
   <tr><td>Fixed Charges</td><td class="n">150.00</td></tr>
   <tr><td>Electricity Duty</td><td class="n">288.40</td></tr>
   <tr><td>Arrears</td><td class="n">0.00</td></tr>
  </table>
  <div class="row b big" style="margin-top:14px"><span>Total Amount Due</span><span>Rs. 3,322.40</span></div>
  <div style="margin-top:10px">Pay before the due date to avoid a late fee.</div>
</div>`,
  "bill-pharmacy": `<div class="r sans">
  <h1>CityCare Pharmacy</h1>
  <div>12 Station Road, Nagpur 440001  |  Ph 0712 5550142</div>
  <hr>
  <div class="row"><span>Invoice No: INV-20817</span><span>Date : 25-10-2026</span></div>
  <div>Patient: Walk-in customer</div>
  <table style="margin-top:8px">
   <tr><th>Medicine</th><th class="n">Qty</th><th class="n">MRP</th><th class="n">Amount</th></tr>
   <tr><td>Metformin 500mg</td><td class="n">3</td><td class="n">180.00</td><td class="n">540.00</td></tr>
   <tr><td>Atorvastatin 10mg</td><td class="n">2</td><td class="n">310.00</td><td class="n">620.00</td></tr>
   <tr><td>Insulin Glargine</td><td class="n">2</td><td class="n">3,250.00</td><td class="n">6,500.00</td></tr>
   <tr><td>Glucose strips</td><td class="n">1</td><td class="n">785.50</td><td class="n">785.50</td></tr>
  </table>
  <div class="row" style="margin-top:12px"><span>Total Qty: 8</span><span>Discount: 100.00</span></div>
  <div class="row b big"><span>Net Amount Payable</span><span>Rs. 8,345.50</span></div>
</div>`,
};

const browser = await chromium.launch({ channel: "chrome" });
const out = process.argv[2] ?? path.join(here, "..", "public", "samples");
for (const [name, body] of Object.entries(bills)) {
  const page = await browser.newPage({ viewport: { width: 900, height: 800 }, deviceScaleFactor: 2 });
  await page.setContent(`<!doctype html><meta charset=utf-8><style>${css}</style>${body}`);
  const el = page.locator(".r");
  await el.screenshot({ path: path.join(out, name + ".png") });
  await page.close();
}
await browser.close();
for (const n of Object.keys(bills)) console.log(n, fs.statSync(path.join(out, n + ".png")).size);
