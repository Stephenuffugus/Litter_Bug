#!/usr/bin/env node
/*
 * scripts/bug_contact_sheet.js  [out.png]
 *
 * THE CONTACT SHEET. Every bug drawn at the sizes the GAME actually draws it,
 * never at a comfortable review size, plus a flat BLACK silhouette column at
 * the SMALLEST size a bug is ever drawn (58px, the champion picker and the
 * ladder rows). ART_STYLE.md: "view each part as a solid black shape at ~64px.
 * If two collapse to the same blob, redesign one."
 *
 * Real sizes in index.html on 2026-08-24:
 *   58  champion picker card, ladder row portrait
 *   84  BUGDEX card, arena champion strip
 *   150 HOME champion, arena result
 *   230 the mint reveal
 *
 * Second sheet: one row per GRADE at Bugdex size, so the question "can you tell
 * a LEGENDARY from a COMMON at 84px" gets an answer you can look at.
 */
const path = require('path');
const PUP = '/workspaces/lucid-winds/node_modules/puppeteer';
const puppeteer = require(PUP);
const crypto = require('crypto');
const E = require(path.join(__dirname, '..', 'bug-engine.js'));

const OUT = process.argv[2] || '/tmp/lb-contact-sheet.png';
const cb = s => crypto.createHash('sha256').update(String(s)).digest('hex');

/* pick N codeblocks of each grade */
function pick(grade, n) {
  const out = [];
  for (let i = 0; i < 4000000 && out.length < n; i++) {
    const c = cb(grade + ':' + i);
    if (E.bugGrade(c).grade === grade) out.push(c);
  }
  return out;
}

const GRADES = E.GRADES;
const variety = [];
for (let i = 0; i < 10; i++) variety.push(cb('sheet' + i));

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
let html = `<style>
 body{margin:0;background:#12140f;color:#e8e2d4;font:12px/1.35 system-ui,sans-serif;padding:18px}
 h2{font:700 15px/1 system-ui;letter-spacing:2px;text-transform:uppercase;color:#c8b47a;margin:26px 0 4px}
 p.n{color:#8a9178;margin:0 0 12px;max-width:900px}
 table{border-collapse:collapse}
 td,th{padding:6px 8px;text-align:center;vertical-align:bottom}
 th{font:700 10px/1 system-ui;letter-spacing:1.5px;color:#8a9178;text-transform:uppercase;border-bottom:1px solid #2a3128}
 .sil{background:#fff}
 .sil svg *{fill:#000 !important;stroke:#000 !important}
 .lab{font:700 9px/1 system-ui;letter-spacing:1px;color:#6d7566;margin-top:3px}
 .g{font:700 10px/1 system-ui;letter-spacing:1.5px}
 td.cell{border-left:1px solid #1d2319}
</style>`;

html += `<h2>Real render sizes</h2><p class="n">Left to right: the exact pixel sizes index.html draws a bug at. The white column is the flat black silhouette at 58px, the smallest a bug is ever drawn in this game.</p>`;
html += '<table><tr><th>58 · lv1</th><th>58 · lv30</th><th class="sil">58 black</th><th>84 · lv1<br>bugdex</th><th>84 · lv30</th><th>150 · lv30<br>home</th><th>230 · lv1<br>the mint</th><th>grade</th></tr>';
for (const c of variety) {
  const g = E.bugGrade(c);
  html += '<tr>'
    + `<td class="cell">${E._generateBugSVG(c, 58, 8)}</td>`
    + `<td class="cell">${E._generateBugSVG(c, 58, 31)}</td>`
    + `<td class="cell sil">${E._generateBugSVG(c, 58, 31)}</td>`
    + `<td class="cell">${E._generateBugSVG(c, 84, 8)}</td>`
    + `<td class="cell">${E._generateBugSVG(c, 84, 31)}</td>`
    + `<td class="cell">${E._generateBugSVG(c, 150, 31)}</td>`
    + `<td class="cell">${E._generateBugSVG(c, 230, 8)}</td>`
    + `<td class="cell"><span class="g">${g.grade}</span><div class="lab">${esc(g.marks.slice(0, 3).join(' · '))}</div></td>`
    + '</tr>';
}
html += '</table>';

html += `<h2>Can you read the grade at bugdex size</h2><p class="n">Every row is one grade, six specimens, drawn at 84px which is the BUGDEX card size, at level 1 on the left and level 30 on the right. A rare bug should be visibly more built: an elytra shell, a plated carapace, a barbed stinger, a full spine ridge, raptorial forelegs.</p>`;
html += '<table><tr><th>grade</th>' + '<th>lv1</th>'.repeat(3) + '<th>lv30</th>'.repeat(3) + '</tr>';
for (const gr of GRADES) {
  const list = pick(gr, 3);
  html += `<tr><td class="cell"><span class="g" style="writing-mode:vertical-rl">${gr}</span></td>`;
  for (const c of list) html += `<td class="cell">${E._generateBugSVG(c, 84, 8)}</td>`;
  for (const c of list) html += `<td class="cell">${E._generateBugSVG(c, 84, 31)}</td>`;
  html += '</tr>';
}
html += '</table>';

(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1180, height: 900, deviceScaleFactor: 2 });
  await p.setContent(html, { waitUntil: 'load' });
  await p.screenshot({ path: OUT, fullPage: true });
  await b.close();
  console.log('wrote ' + OUT);
})();
