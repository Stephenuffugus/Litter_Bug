/* Fit GRADE_CUT to the Variant G curve, using the LIVE scorer's own output.
 *
 *   node scripts/grade_tune.js [N]
 *
 * ⛔ This does NOT reimplement the scoring maths. It asks the real gradeOf() for
 * the SCORE of a large sample, builds the actual score histogram, and then
 * solves for the seven thresholds that land the target percentages. The only
 * thing computed here is where to cut a distribution the game produced.
 */
const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const path = require('path');

const N = parseInt(process.argv[2] || '200000', 10);
const ROOT = path.join(__dirname, '..');
const PORT = 8792;

/* Variant G, Stephen ratified. Percentages, in grade order. */
const TARGET = [33.8, 32.0, 23.0, 9.3, 1.62, 0.23, 0.028];
const NAMES = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC', 'COSMIC'];

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1200));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/index.html?lbtest=1`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate(() => new Promise(r => setTimeout(r, 400)));

  // ---- sample SCORES from the live scorer ----
  const hist = {};
  const CHUNK = 20000;
  for (let done = 0; done < N; done += CHUNK) {
    const n = Math.min(CHUNK, N - done);
    const part = await page.evaluate((n) => {
      const out = {}; const hex = '0123456789abcdef';
      for (let i = 0; i < n; i++) {
        let cb = ''; for (let j = 0; j < 64; j++) cb += hex[(Math.random() * 16) | 0];
        const s = window.LB_DEV.grade(cb).score;
        out[s] = (out[s] || 0) + 1;
      }
      return out;
    }, n);
    for (const k in part) hist[k] = (hist[k] || 0) + part[k];
  }

  const scores = Object.keys(hist).map(Number).sort((a, b) => a - b);
  const maxS = scores[scores.length - 1];
  console.log(`sampled ${N.toLocaleString()} · score range ${scores[0]} to ${maxS}\n`);

  // cumulative fraction at or below each score
  const cum = [];
  let run = 0;
  for (let s = 0; s <= maxS; s++) { run += (hist[s] || 0); cum[s] = run / N; }

  /* Walk the target percentages and pick the smallest score whose cumulative
     share has passed the boundary. Cuts must be strictly increasing, so a tier
     the histogram cannot separate gets pushed one score up and reported. */
  const cuts = [0];
  let acc = 0, prev = 0;
  const squeezed = [];
  for (let g = 0; g < TARGET.length - 1; g++) {
    acc += TARGET[g] / 100;
    let s = prev;
    while (s <= maxS && cum[s] < acc) s++;
    if (s <= prev) { s = prev + 1; squeezed.push(NAMES[g + 1]); }
    cuts.push(s);
    prev = s;
  }

  console.log('proposed GRADE_CUT = [' + cuts.join(',') + ']\n');

  // ---- what that actually yields, checked against the same sample ----
  console.log('grade'.padEnd(12) + 'would be'.padStart(10) + 'target'.padStart(10));
  for (let g = 0; g < NAMES.length; g++) {
    const lo = cuts[g], hi = (g + 1 < cuts.length) ? cuts[g + 1] : maxS + 1;
    let n = 0; for (let s = lo; s < hi; s++) n += (hist[s] || 0);
    console.log(NAMES[g].padEnd(12) + ((n / N * 100).toFixed(3) + '%').padStart(10) + (TARGET[g].toFixed(3) + '%').padStart(10));
  }
  if (squeezed.length) {
    console.log('\n⚠️ these tiers could not be separated by the current score spread: ' + squeezed.join(', '));
    console.log('   the score histogram is too coarse at the top. Widen TIER_BANDS or add score weight.');
  }
  await browser.close(); server.kill();
})();
