#!/usr/bin/env node
// उपयोग: node tools/add_set.js NN
// sets/set-NN.js को sets/manifest.js में जोड़ता है (date उसी फ़ाइल से), फिर validate.js NN चलाता है।
const fs = require("fs"), path = require("path"), vm = require("vm"), { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, "..");
const n = parseInt(process.argv[2], 10);
if (!n) { console.error("उपयोग: node tools/add_set.js NN"); process.exit(2); }
const pad2 = x => String(x).padStart(2, "0");
const file = `set-${pad2(n)}.js`, fp = path.join(ROOT, "sets", file);
if (!fs.existsSync(fp)) { console.error(`sets/${file} नहीं मिली`); process.exit(1); }
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(fp, "utf8"), ctx);
const date = ctx.window.SET_DATA && ctx.window.SET_DATA.date;
const mp = path.join(ROOT, "sets/manifest.js");
const m = { window: {} }; vm.runInNewContext(fs.readFileSync(mp, "utf8"), m);
const sets = m.window.SETS || [];
if (sets.some(s => s.n === n)) console.log(`सेट ${n} पहले से manifest में है — manifest नहीं बदला`);
else {
  if (sets.length && sets[sets.length - 1].n !== n - 1) { console.error(`manifest का अंतिम सेट ${sets[sets.length - 1].n} है; अगला ${sets[sets.length - 1].n + 1} होना चाहिए`); process.exit(1); }
  sets.push({ n, date, file });
  const body = sets.map(s => `  {n: ${s.n}, date: "${s.date}", file: "${s.file}"}`).join(",\n");
  fs.writeFileSync(mp, `// हर नए सेट के लिए एक पंक्ति जोड़ें (सबसे नया सबसे नीचे)। tools/add_set.js यह अपने आप करता है।\nwindow.SETS = [\n${body}\n];\n`);
  console.log(`manifest में जोड़ा: सेट ${pad2(n)} — ${date}`);
}
try { process.stdout.write(execFileSync("node", [path.join(__dirname, "validate.js"), String(n)], { encoding: "utf8" })); }
catch (e) { process.stdout.write(e.stdout || ""); process.exit(1); }
