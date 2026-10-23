/**
 * स्टाफ नर्स लाइव मॉक टेस्ट — उत्तर डेटा को Google Sheet में सहेजने वाली Apps Script
 *
 * लगाने की विधि (एक बार):
 * 1. Google Sheet "स्टाफ नर्स मॉक टेस्ट — उत्तर डेटा" खोलें → Extensions (एक्सटेंशन) → Apps Script
 * 2. वहाँ का सारा कोड हटाकर यह पूरी फ़ाइल चिपकाएँ → Save (💾)
 * 3. Deploy → New deployment → प्रकार (⚙) "Web app" चुनें
 *      Execute as: Me (आपका ईमेल)   ·   Who has access: Anyone
 *    → Deploy → Google खाते की अनुमति दें (Advanced → Go to … → Allow)
 * 4. जो "Web app URL" मिले (…/macros/s/…/exec), उसे रिपॉज़िटरी की config.js में SHEET_URL में लिखें।
 *
 * कोड बदलने पर: Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy (URL वही रहता है)।
 */
const SHEET_NAME = "Responses";
const ID_COL = 15;             // अंतिम कॉलम "प्रयास ID" (O)

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const d = JSON.parse(e.postData.contents);
    const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    const id = txt(d.id, 40);
    if (!id) return out({ ok: false, error: "id नहीं" });

    // एक ही प्रयास दोबारा पहुँचे तो दूसरी पंक्ति न बने
    const last = sh.getLastRow();
    if (last > 1) {
      const found = sh.getRange(2, ID_COL, last - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
      if (found) return out({ ok: true, duplicate: true });
    }

    const row = [
      new Date(),
      num(d.set), txt(d.date, 30), txt(d.name, 60),
      "'" + String(d.mobile || "").replace(/\D/g, "").slice(0, 10),
      num(d.score), num(d.max), num(d.pct),
      num(d.right), num(d.wrong), num(d.skip), num(d.acc),
      txt(d.time, 10), d.auto ? "हाँ" : "नहीं",
      id
    ];
    sh.appendRow(row);
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() { return out({ ok: true, msg: "स्टाफ नर्स मॉक टेस्ट — डेटा संग्रह चालू है" }); }

// पाठ: लंबाई सीमित, और = + - @ से शुरू हो तो सूत्र न बने
function txt(v, max) {
  let s = String(v == null ? "" : v).replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
function num(v) { const n = Number(v); return isFinite(n) ? n : ""; }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
