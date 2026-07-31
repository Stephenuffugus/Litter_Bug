/* SPECIMEN GRADE distribution, measured against the LIVE scorer.
 *
 *   node scripts/grade_sim_live.js [N]
 *
 * ⛔ THE LAW THIS OBEYS: never hand mirror the scorer. Lucid Winds drifted twice
 * because a simulation reimplemented the grading maths and then disagreed with
 * the shipping code without anybody noticing. This loads game.html in a real
 * browser and calls the real gradeOf(), so the numbers below are the numbers a
 * player gets or the file is broken.
 *
 * Target curve is Lucid Winds Variant G, which Stephen ratified:
 *   Common 33.8 · Uncommon 32.0 · Rare 23.0 · Epic 9.3 · Legendary 1.62
 *   Mythic 0.23 · Cosmic 0.028
 */
const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const path = require('path');

const N = parseInt(process.argv[2] || '200000', 10);
const ROOT = path.join(__dirname, '..');
const PORT = 8791;

const TARGET = { COMMON: 33.8, UNCOMMON: 32.0, RARE: 23.0, EPIC: 9.3, LEGENDARY: 1.62, MYTHIC: 0.23, COSMIC: 0.028 };

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1200));

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(`http://localhost:${PORT}/index.html?lbtest=1`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(() => new Promise(r => setTimeout(r, 400)));

  const ok = await page.evaluate(() => typeof window.LB_DEV === 'object' && typeof window.LB_DEV.grade === 'function');
  if (!ok) { console.error('LB_DEV.grade missing: the sim cannot reach the live scorer'); process.exit(2); }

  console.log(`sampling ${N.toLocaleString()} hashes against the LIVE gradeOf()...\n`);

  // chunked so the page never blocks long enough to be killed
  const counts = {};
  const CHUNK = 20000;
  for (let done = 0; done < N; done += CHUNK) {
    const n = Math.min(CHUNK, N - done);
    const part = await page.evaluate((n) => {
      const out = {};
      const hex = '0123456789abcdef';
      for (let i = 0; i < n; i++) {
        let cb = '';
        for (let j = 0; j < 64; j++) cb += hex[(Math.random() * 16) | 0];
        const g = window.LB_DEV.grade(cb).grade;
        out[g] = (out[g] || 0) + 1;
      }
      return out;
    }, n);
    for (const k in part) counts[k] = (counts[k] || 0) + part[k];
  }

  const grades = await page.evaluate(() => window.LB_DEV.grades);
  console.log('grade'.padEnd(12) + 'measured'.padStart(10) + 'target'.padStart(10) + '   verdict');
  let worst = 0;
  for (const g of grades) {
    const pct = ((counts[g] || 0) / N) * 100;
    const t = TARGET[g];
    const ratio = t ? pct / t : (pct ? Infinity : 1);
    if (t >= 1 && Math.abs(ratio - 1) > worst) worst = Math.abs(ratio - 1);
    const verdict = !t ? '' : (ratio > 1.5 ? 'FAR OVER' : ratio < 0.5 ? 'FAR UNDER' : (ratio > 1.2 || ratio < 0.8) ? 'off' : 'ok');
    console.log(g.padEnd(12) + (pct.toFixed(3) + '%').padStart(10) + (t.toFixed(3) + '%').padStart(10) + '   ' + verdict);
  }
  console.log('\nepic and better: ' + (grades.slice(3).reduce((a, g) => a + (counts[g] || 0), 0) / N * 100).toFixed(2) + '%'
    + '   (Variant G target 11.2%)');
  if (errs.length) console.log('page errors:', errs.slice(0, 3));

  await browser.close();
  server.kill();
})();
