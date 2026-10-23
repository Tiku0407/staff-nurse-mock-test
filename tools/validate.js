#!/usr/bin/env node
// उपयोग: node tools/validate.js [NN]
// सभी सेटों की संरचना जाँचता है; NN देने पर उस सेट की कठिनाई, उत्तर-वितरण और
// पिछले सभी सेटों से दोहराव (FLAG) भी जाँचता है। त्रुटि न हो तो अंत में "सब ठीक" छापता है।
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, "..");
const target = process.argv[2] ? parseInt(process.argv[2], 10) : null;
const errors = [], warns = [], flags = [];
const pad2 = n => String(n).padStart(2, "0");

function load(file, key) {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), ctx, { filename: file });
  return ctx.window[key];
}

// ---------- manifest ----------
const sets = load(path.join(ROOT, "sets/manifest.js"), "SETS") || [];
sets.forEach((s, i) => {
  if (s.n !== i + 1) errors.push(`manifest: क्रम ${i + 1} पर n=${s.n} है (सेट 1 से लगातार होने चाहिए)`);
  if (s.file !== `set-${pad2(s.n)}.js`) errors.push(`manifest: सेट ${s.n} की फ़ाइल "${s.file}" होनी चाहिए "set-${pad2(s.n)}.js"`);
  if (!fs.existsSync(path.join(ROOT, "sets", s.file))) errors.push(`manifest: फ़ाइल sets/${s.file} नहीं मिली`);
});

// ---------- सेट फ़ाइलें ----------
const files = fs.readdirSync(path.join(ROOT, "sets")).filter(f => /^set-\d+\.js$/.test(f)).sort();
const all = {};
for (const f of files) {
  let d;
  try { d = load(path.join(ROOT, "sets", f), "SET_DATA"); }
  catch (e) { errors.push(`${f}: JavaScript त्रुटि — ${e.message}`); continue; }
  const n = parseInt(f.match(/\d+/)[0], 10);
  if (!d || d.n !== n) { errors.push(`${f}: SET_DATA.n = ${d && d.n}, अपेक्षित ${n}`); continue; }
  if (!d.date || !/^\d{1,2} \S+ \d{4}$/.test(d.date)) errors.push(`${f}: date "${d.date}" ग़लत ढाँचा (जैसे "23 अक्टूबर 2026")`);
  const Q = d.questions || [];
  if (Q.length !== 50) errors.push(`${f}: ${Q.length} प्रश्न हैं, 50 चाहिए`);
  const per = [0, 0, 0, 0, 0, 0];
  Q.forEach((q, i) => {
    const id = `${f} प्र.${i + 1}`;
    if (![1, 2, 3, 4, 5].includes(q.s)) errors.push(`${id}: s=${q.s} (1–5 होना चाहिए)`); else per[q.s]++;
    if (i > 0 && Q[i - 1].s > q.s) errors.push(`${id}: खंड क्रम में नहीं (खंड ${Q[i - 1].s} के बाद ${q.s})`);
    if (!q.q || q.q.trim().length < 10) errors.push(`${id}: प्रश्न-पाठ बहुत छोटा/खाली`);
    if (!Array.isArray(q.o) || q.o.length !== 4) errors.push(`${id}: ठीक 4 विकल्प चाहिए`);
    else {
      const norm = q.o.map(o => String(o).trim().toLowerCase());
      if (new Set(norm).size !== 4) errors.push(`${id}: दो विकल्प एक जैसे हैं`);
      if (norm.some(o => !o)) errors.push(`${id}: खाली विकल्प`);
      if (norm.some(o => /^(उपरोक्त सभी|इनमें से कोई नहीं|all of the above|none of the above)$/.test(o)) && n >= 2)
        warns.push(`${id}: "उपरोक्त सभी/कोई नहीं" विकल्प — केवल तभी रखें जब सचमुच आवश्यक हो`);
    }
    if (!Number.isInteger(q.a) || q.a < 0 || q.a > 3) errors.push(`${id}: a=${q.a} (0–3 होना चाहिए)`);
    if (!q.e || q.e.trim().length < 8) errors.push(`${id}: व्याख्या (e) खाली/बहुत छोटी`);
    if (n >= 2 && !["E", "M", "D"].includes(q.d)) errors.push(`${id}: कठिनाई d = "E" | "M" | "D" होनी चाहिए`);
    // द्विभाषी: हर प्रश्न का English अनुवाद अनिवार्य
    if (!q.qe || q.qe.trim().length < 10) errors.push(`${id}: English प्रश्न (qe) खाली/बहुत छोटा`);
    else if (/[\u0900-\u097F]/.test(q.qe)) errors.push(`${id}: qe में देवनागरी है — English प्रश्न शुद्ध English में हो`);
    if (!Array.isArray(q.oe) || q.oe.length !== 4) errors.push(`${id}: English विकल्प (oe) ठीक 4 चाहिए`);
    else {
      if (q.oe.some(o => !String(o).trim())) errors.push(`${id}: खाली English विकल्प`);
      if (new Set(q.oe.map(o => String(o).trim().toLowerCase())).size !== 4) errors.push(`${id}: दो English विकल्प एक जैसे हैं`);
      if (q.oe.some(o => /[\u0900-\u097F]/.test(o))) errors.push(`${id}: oe में देवनागरी है`);
    }
  });
  for (let s = 1; s <= 5; s++) if (per[s] !== 10) errors.push(`${f}: खंड ${s} में ${per[s]} प्रश्न, 10 चाहिए`);
  all[n] = d;
}

// ---------- दोहराव-जाँच के लिए सामान्यीकरण ----------
const STOP = new Set("का की के में है हैं से को पर और या एक कौन कौनसा कौन-सा सा सी क्या किस किसे कितना कितनी कितने होता होती होते जाता जाती जाते दिया दी जाने वाले वाली वाला निम्न निम्नलिखित सही गलत कथन यह वह इस उस द्वारा लिए हेतु तथा भी नहीं the of a an in is to for which what".split(" "));
const clean = t => String(t).toLowerCase().replace(/\([^)]*\)/g, " $& ").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const toks = t => new Set(clean(t).split(" ").filter(w => w.length > 1 && !STOP.has(w)));
const jacc = (A, B) => { let i = 0; A.forEach(x => B.has(x) && i++); return i / (A.size + B.size - i || 1); };

if (target !== null) {
  const d = all[target];
  if (!d) errors.push(`सेट ${target} (sets/set-${pad2(target)}.js) नहीं मिला`);
  else {
    const Q = d.questions;
    // कठिनाई लक्ष्य
    const goal = target <= 7 ? [15, 25, 10] : target <= 21 ? [12, 25, 13] : [10, 25, 15];
    const cnt = { E: 0, M: 0, D: 0 }; Q.forEach(q => cnt[q.d] !== undefined && cnt[q.d]++);
    const got = [cnt.E, cnt.M, cnt.D];
    if (got.some((v, i) => Math.abs(v - goal[i]) > 2))
      errors.push(`सेट ${target}: कठिनाई E/M/D = ${got.join("/")}, लक्ष्य ${goal.join("/")} (±2)`);
    // उत्तर-वितरण
    const dist = [0, 0, 0, 0]; Q.forEach(q => dist[q.a]++);
    if (dist.some(v => v < 10 || v > 15)) errors.push(`सेट ${target}: उत्तर-वितरण क/ख/ग/घ = ${dist.join("/")} — हर अक्षर 10–15 बार होना चाहिए`);
    let run = 1; for (let i = 1; i < Q.length; i++) { run = Q[i].a === Q[i - 1].a ? run + 1 : 1; if (run >= 4) { errors.push(`सेट ${target}: प्र.${i - 2}–${i + 1} लगातार 4 बार एक ही उत्तर`); break; } }
    // सबसे लंबा विकल्प = सही उत्तर वाला पैटर्न
    const longest = Q.filter(q => { const L = q.o.map(o => o.length); const m = Math.max(...L); return L[q.a] === m && L.filter(x => x === m).length === 1; }).length;
    if (longest > 22) warns.push(`सेट ${target}: ${longest}/50 प्रश्नों में सही उत्तर ही सबसे लंबा विकल्प है — कुछ विकल्प संतुलित करें`);
    // दोहराव — नए सेट के अंदर और सभी पिछले सेटों से
    const prev = [];
    Object.keys(all).map(Number).filter(n => n !== target).forEach(n => all[n].questions.forEach((q, i) => prev.push({ where: `सेट ${pad2(n)} प्र.${i + 1}`, q })));
    Q.forEach((q, i) => {
      const A = toks(q.q), ansA = clean(q.o[q.a]);
      const pool = prev.concat(Q.slice(0, i).map((p, j) => ({ where: `इसी सेट प्र.${j + 1}`, q: p })));
      for (const p of pool) {
        const ansB = clean(p.q.o[p.q.a]);
        if (clean(q.q) === clean(p.q.q)) { errors.push(`सेट ${target} प्र.${i + 1}: ${p.where} का हूबहू दोहराव`); break; }
        const j = jacc(A, toks(p.q.q));
        const sameAns = ansA === ansB || jacc(toks(ansA), toks(ansB)) >= 0.6;
        if (j >= 0.75 || (j >= 0.4 && sameAns) || (sameAns && ansA.length > 3 && jacc(A, toks(p.q.q)) >= 0.25)) {
          flags.push(`FLAG सेट ${target} प्र.${i + 1} ↔ ${p.where} (समानता ${j.toFixed(2)}${sameAns ? ", उत्तर समान" : ""})\n     नया : ${q.q}  → ${q.o[q.a]}\n     पुराना: ${p.q.q}  → ${p.q.o[p.q.a]}`);
          break;
        }
      }
    });
  }
}

warns.forEach(w => console.log("चेतावनी: " + w));
flags.forEach(f => console.log(f));
if (flags.length) console.log(`\n${flags.length} FLAG — हर एक पढ़ें: यदि वही तथ्य/अवधारणा दोबारा पूछी गई है (शब्द बदलकर भी), तो प्रश्न बदलें। केवल संयोगवश मिलते शब्द हों तो छोड़ सकते हैं।`);
if (errors.length) { errors.forEach(e => console.log("त्रुटि: " + e)); console.log(`\n${errors.length} त्रुटियाँ`); process.exit(1); }
console.log(`सब ठीक — ${Object.keys(all).length} सेट, manifest में ${sets.length}`);
