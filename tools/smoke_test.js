#!/usr/bin/env node
// उपयोग: node tools/smoke_test.js NN
// ब्राउज़र में index.html?set=NN खोलकर नाम/मोबाइल भरता है, सभी सही उत्तर चुनकर जमा करता है
// और जाँचता है कि स्कोर 100/100 आए, पैलेट/टाइमर चलें और कोई JavaScript त्रुटि न हो।
// Playwright का ब्राउज़र न मिले तो: PW_EXEC=/opt/pw-browsers/chromium node tools/smoke_test.js NN
const path = require("path"), vm = require("vm"), fs = require("fs");
let chromium;
try { ({ chromium } = require("playwright")); }
catch { const g = require("child_process").execSync("npm root -g").toString().trim(); ({ chromium } = require(path.join(g, "playwright"))); }
const n = parseInt(process.argv[2], 10);
if (!n) { console.error("उपयोग: node tools/smoke_test.js NN"); process.exit(2); }
const ROOT = path.join(__dirname, "..");
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, `sets/set-${String(n).padStart(2, "0")}.js`), "utf8"), ctx);
const Q = ctx.window.SET_DATA.questions;

(async () => {
  const opts = process.env.PW_EXEC ? { executablePath: process.env.PW_EXEC } : {};
  const b = await chromium.launch(opts);
  const p = await b.newPage();
  const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  p.on("dialog", d => d.accept());
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await p.goto("file://" + path.join(ROOT, "index.html") + "?set=" + n);
  await p.waitForFunction(() => document.getElementById("secTable").children.length === 5);
  const label = await p.textContent(".setLabel");
  if (!label.includes(String(n).padStart(2, "0"))) throw new Error("सेट लेबल ग़लत: " + label);
  await p.check("#agree");
  if (!(await p.isDisabled("#startBtn"))) throw new Error("नाम/मोबाइल के बिना परीक्षा शुरू हो रही है");
  await p.fill("#cname", "परीक्षण अभ्यर्थी");
  await p.fill("#cmobile", "9876543210");
  await p.click("#startBtn");
  for (let i = 0; i < Q.length; i++) {
    const txt = await p.textContent("#qtext");
    if (txt.trim() !== Q[i].q.trim()) throw new Error(`प्र.${i + 1} का पाठ मेल नहीं खाता`);
    const en = (await p.textContent("#qtextEn")).trim();
    if (en !== (Q[i].qe || "").trim()) throw new Error(`प्र.${i + 1} का English पाठ नहीं दिखा`);
    await p.locator(".opt input").nth(Q[i].a).check();
    if (i < Q.length - 1) await p.click("#saveBtn");
    else { await p.evaluate(() => document.getElementById("saveBtn").click()); }
  }
  await p.click("#submitBtn");
  await p.waitForSelector("#resultScreen:not(.hidden)");
  const score = (await p.textContent(".score")).replace(/\s+/g, " ").trim();
  await b.close();
  if (score !== "100 / 100") throw new Error("स्कोर अपेक्षित 100 / 100, मिला: " + score);
  if (errs.length) throw new Error("JavaScript त्रुटि: " + errs.join(" | "));
  console.log(`PASS — सेट ${n}: ${label}, 50 प्रश्न, स्कोर ${score}`);
})().catch(e => { console.error("FAIL — " + e.message); process.exit(1); });
