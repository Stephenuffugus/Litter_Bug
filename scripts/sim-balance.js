/*
 * Litter Bug balance simulator (battle-spec w8fh4s7z2, Step 6).
 *
 * Non-blocking report (NOT part of smoke). Brute-forces many equal-level
 * battles and reports type/class win-rate spread, battle length, and a
 * population histogram, so we can buff-the-weak instead of guessing.
 *
 *   node scripts/sim-balance.js [battles]
 */
var path = require('path');
var crypto = require('crypto');
var E = require(path.join(__dirname, '..', 'bug-engine.js'));
var B = require(path.join(__dirname, '..', 'battle-engine.js'));
function cb(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }

var N = parseInt(process.argv[2], 10) > 0 ? parseInt(process.argv[2], 10) : 24000;
var POOL = 4000;
var pool = [];
for (var i = 0; i < POOL; i++) { var c = cb('pool' + i); var s = E.bugStats(c); pool.push({ c: c, s: s }); }

function tally() { return { w: 0, n: 0 }; }
var byType = {}, byClass = {}, rounds = [], draws = 0;
E.TYPES.forEach(function (t) { byType[t] = tally(); });
E.CLASSES.forEach(function (c) { byClass[c.name] = tally(); });

for (var k = 0; k < N; k++) {
  var a = pool[(k * 7919) % POOL], b = pool[(k * 104729 + 3) % POOL];
  if (a.c === b.c) continue;
  var r = B.resolveBattle(a.c, b.c, 5, 5);
  rounds.push(r.rounds); if (r.draw) draws++;
  var aw = r.winner === 'a' && !r.draw, bw = r.winner === 'b' && !r.draw;
  byType[a.s.type].n++; byType[b.s.type].n++; if (aw) byType[a.s.type].w++; if (bw) byType[b.s.type].w++;
  byClass[a.s.cls].n++; byClass[b.s.cls].n++; if (aw) byClass[a.s.cls].w++; if (bw) byClass[b.s.cls].w++;
}

function line(map) {
  return Object.keys(map).sort(function (x, y) { return map[y].w / map[y].n - map[x].w / map[x].n; })
    .map(function (k) { var o = map[k]; var p = o.w / o.n * 100; var flag = (p > 60 || p < 40) ? ' <=FLAG' : '';
      return '  ' + k.padEnd(11) + p.toFixed(1) + '%' + flag; }).join('\n');
}
rounds.sort(function (a, b) { return a - b; });

// population histogram
var pop = { type: {}, dual: 0, mono: 0, cls: {}, natNeutral: 0 };
for (var p = 0; p < 10000; p++) {
  var s2 = E.bugStats(cb('census' + p));
  pop.type[s2.type] = (pop.type[s2.type] || 0) + 1;
  if (s2.type2) pop.dual++; else pop.mono++;
  pop.cls[s2.cls] = (pop.cls[s2.cls] || 0) + 1;
  if (!s2.nature.up) pop.natNeutral++;
}

console.log('=== Litter Bug balance report (' + N + ' battles @ L5) ===\n');
console.log('TYPE win rate (target 45-55%):\n' + line(byType) + '\n');
console.log('CLASS win rate (target 40-60%):\n' + line(byClass) + '\n');
console.log('battle length: min ' + rounds[0] + '  median ' + rounds[rounds.length >> 1]
  + '  avg ' + (rounds.reduce(function (a, b) { return a + b; }, 0) / rounds.length).toFixed(1)
  + '  max ' + rounds[rounds.length - 1] + '  (draws ' + draws + ')');
console.log('\npopulation (10k bugs): ' + pop.mono / 100 + '% mono / ' + pop.dual / 100 + '% dual, '
  + (pop.natNeutral / 100).toFixed(1) + '% neutral nature');
console.log('  types:  ' + Object.keys(pop.type).sort().map(function (t) { return t + ' ' + (pop.type[t] / 100).toFixed(1) + '%'; }).join('  '));
console.log('  classes:' + Object.keys(pop.cls).sort().map(function (c) { return ' ' + c + ' ' + (pop.cls[c] / 100).toFixed(1) + '%'; }).join(''));
