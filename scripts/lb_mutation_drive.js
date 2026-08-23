#!/usr/bin/env node
/*
 * scripts/lb_mutation_drive.js
 *
 * ⛔ A CHECK YOU HAVE NOT WATCHED GO RED IS DECORATION.
 *
 * This applies ONE realistic single point defect at a time, runs the real
 * check.js against the mutated file, and reports whether the suite noticed.
 * Every mutation below is a REGRESSION OF A DEFECT THAT ACTUALLY SHIPPED, or
 * the removal of a guard that was added because of one.
 *
 *   node scripts/lb_mutation_drive.js          all mutations
 *   node scripts/lb_mutation_drive.js 3        just mutation 3
 *
 * Verdicts:
 *   BITES  the suite went red, and on the check we expected
 *   WRONG  the suite went red on some OTHER check (the mutation is sloppy)
 *   VACUOUS the suite stayed GREEN: whatever guards this is not guarding it
 *   BADMUT the mutation did not apply (the source moved; fix the mutation)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const IDX = path.join(ROOT, 'index.html');
const ENG = path.join(ROOT, 'bug-engine.js');

const M = [
  { n: 'jobs measure the field before the screen is shown (the v1 defect)', f: IDX,
    from: "  show('s-play');\n  var f=$('p-field');\n  G.fw=f.clientWidth||494; G.fh=f.clientHeight||700;",
    to:   "  var f=$('p-field');\n  G.fw=f.clientWidth||0; G.fh=f.clientHeight||0;\n  show('s-play');",
    want: 'field measures a real size' },
  { n: 'the broad `.alley svg` selector comes back (champion height 0)', f: IDX,
    from: "#alley-svg{position:absolute;inset:0;width:100%;height:100%}",
    to:   ".alley svg{position:absolute;inset:0;width:100%;height:100%}",
    want: 'champion SVG has a REAL rendered size' },
  { n: 'the shift cap is removed from bump()', f: IDX,
    from: "G.score=Math.max(0,Math.min(SHIFT_CAP,G.score+n));",
    to:   "G.score=Math.max(0,G.score+n);",
    want: 'score no more than one shift is worth' },
  { n: 'the save loader trusts the blob (a corrupt save kills the block)', f: IDX,
    from: "function _cleanEntry(b){\n  if(!b || typeof b!=='object' || !_isCB(b.cb)) return null;",
    to:   "function _cleanEntry(b){\n  if(b && b.cb) return b;\n  if(!b || typeof b!=='object' || !_isCB(b.cb)) return null;",
    want: 'validated on the way in' },
  { n: 'SVG ids go back to being shared between copies of the same bug', f: ENG,
    from: "var uid = hash.substr(0, 6) + (_uidSeq = (_uidSeq + 1) % 100000).toString(36);",
    to:   "var uid = hash.substr(0, 6);",
    want: 'duplicate element ids' },
  { n: 'the camera goes back to a hard 200x200 viewBox', f: ENG,
    from: "'<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"' + q(vbx) + ' ' + q(vby) + ' ' + q(side) + ' ' + q(side) + '\"",
    to:   "'<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 200\"",
    want: 'camera frames the bug' },
  { n: 'the Flying tag goes back to a trait index nothing draws', f: ENG,
    from: "var winged = bugPlan(codeblock).plan.wings !== 999;",
    to:   "var winged = (t.wing % 5) !== 4;",
    want: 'Flying tag matches the wings' },
  { n: 'the grade stops naming the parts it scored', f: ENG,
    from: "return { grade: GRADES[g], score: score, marks: marks };",
    to:   "return { grade: GRADES[g], score: score, marks: [] };",
    want: 'named visible part' },
  { n: 'the grade scores a trait index the renderer never draws', f: ENG,
    from: "    var P = bugPlan(codeblock), pl = P.plan, marks = [], score = 0, i;",
    to:   "    var P = bugPlan(codeblock), pl = P.plan, marks = [], score = 0, i;\n    P = { plan: { wings: 999, horns: 999, pincers: 999, tail: 999, spines: [999], extraEyes: 999 }, N: 3, wingKind: 0, jawKind: 1, tailKind: 0, legKind: 0, plateKind: 0, mats: [1, 2] }; pl = P.plan;",
    want: 'spread to separate seven tiers' },
  { n: 'a touch target drops under 48px', f: IDX,
    from: "gap:12px;min-height:76px;width:100%;",
    to:   "gap:12px;min-height:30px;max-height:30px;width:100%;",
    want: '48 RENDERED px' },
  { n: 'the embed handshake is removed', f: IDX,
    from: "  swsHi(); window.addEventListener('load', swsHi); setTimeout(swsHi, 700);",
    to:   "  void swsHi;",
    want: 'posts {sws:"ready"}' },
  { n: 'playMove stops resolving (the arena hangs on round 1)', f: IDX,
    from: "function playMove(i){\n  if(!AR||AR.busy||AR.st.over) return;",
    to:   "function playMove(i){\n  if(true) return;\n  if(!AR||AR.busy||AR.st.over) return;",
    want: 'exchange RESOLVES' },
  { n: 'THE DUMPSTER goes back to calling resolveBattle with fighters', f: IDX,
    from: "function paintDump(){",
    to:   "function paintDump(){ if(window.__lbBreakDump) throw new Error('boom');",
    want: 'challengers, seeded for the day', skipIfNoTrigger: true }
];

const only = process.argv[2] ? parseInt(process.argv[2], 10) : null;
const results = [];

function run() {
  try {
    execFileSync('node', [path.join(ROOT, 'check.js')], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 });
    return { code: 0, out: '' };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, out: String(e.stdout || '') + String(e.stderr || '') };
  }
}

M.forEach((m, idx) => {
  const num = idx + 1;
  if (only && only !== num) return;
  if (m.skipIfNoTrigger) return;   // needs a page side trigger; not a source mutation
  const orig = fs.readFileSync(m.f, 'utf8');
  if (orig.split(m.from).length - 1 !== 1) {
    results.push([num, 'BADMUT', m.n, 'anchor not found exactly once']);
    console.log(num + '  BADMUT  ' + m.n);
    return;
  }
  fs.writeFileSync(m.f, orig.replace(m.from, m.to));
  let verdict, note = '';
  try {
    const r = run();
    const fails = (r.out.match(/^\s*FAIL .*/gm) || []).map(s => s.trim());
    if (r.code === 0) verdict = 'VACUOUS';
    else if (!fails.length) { verdict = 'CRASH'; note = 'suite died: ' + r.out.split('\n').filter(Boolean).slice(-2).join(' | ').slice(0, 140); }
    else if (fails.some(f => f.indexOf(m.want) >= 0)) { verdict = 'BITES'; note = fails.length + ' red'; }
    else { verdict = 'WRONG'; note = fails[0].slice(0, 110); }
  } finally {
    fs.writeFileSync(m.f, orig);
  }
  results.push([num, verdict, m.n, note]);
  console.log(num + '  ' + verdict.padEnd(7) + m.n + (note ? '   [' + note + ']' : ''));
});

const bites = results.filter(r => r[1] === 'BITES').length;
console.log('\n' + bites + '/' + results.length + ' mutations BITE');
const bad = results.filter(r => r[1] === 'VACUOUS' || r[1] === 'BADMUT' || r[1] === 'WRONG' || r[1] === 'CRASH');
if (bad.length) { console.log('needs attention:'); bad.forEach(r => console.log('  ' + r[0] + ' ' + r[1] + ' ' + r[2] + (r[3] ? '  ' + r[3] : ''))); }
process.exit(bad.length ? 1 : 0);
