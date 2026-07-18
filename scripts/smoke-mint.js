/*
 * Litter Bug mint-loop smoke harness (Phase 0 of the bug-battler reinvent).
 *
 * Proves the sacred loop that the whole game rests on:
 *   play trace  ->  serializeTrace  ->  mintCodeblock(salt + trace)  ->  bug
 *
 * Loads bug-engine.js directly in Node (the module is browser + Node safe),
 * so this needs no jsdom. Asserts:
 *   - determinism   (same salt + same trace  => same codeblock => same bug)
 *   - input-sense   (a 1ms timing change or a different move => different bug)
 *   - salt-sense    (the server-secret seam actually changes the outcome)
 *   - a GOLDEN vector so a future refactor cannot silently remap play->bug.
 *
 * Run via `npm run smoke` (chained last) or directly: `node scripts/smoke-mint.js`.
 * Exits non-zero on any failure so pre-push / CI can gate on it.
 */
var path = require('path');
var E = require(path.join(__dirname, '..', 'bug-engine.js'));

var results = [];
function check(name, fn) {
  try {
    var r = fn();
    if (r && typeof r.then === 'function') {
      return r.then(function (v) {
        results.push({ name: name, ok: !!(v && v.ok), detail: v && v.detail });
      }, function (err) {
        results.push({ name: name, ok: false, detail: 'threw: ' + (err && err.message) });
      });
    }
    results.push({ name: name, ok: !!(r && r.ok), detail: r && r.detail });
  } catch (err) {
    results.push({ name: name, ok: false, detail: 'threw: ' + (err && err.message) });
  }
}

// Fixed fixtures. traceA is the golden play; the others are minimal deltas.
var SALT = 'phase0-demo-salt';
var traceA = [{ i: 5, dt: 120 }, { i: 12, dt: 340 }, { i: 3, dt: 90 }, { i: 19, dt: 210 }];
var traceA_1ms = [{ i: 5, dt: 120 }, { i: 12, dt: 341 }, { i: 3, dt: 90 }, { i: 19, dt: 210 }];
var traceA_cell = [{ i: 6, dt: 120 }, { i: 12, dt: 340 }, { i: 3, dt: 90 }, { i: 19, dt: 210 }];
var traceA_order = [{ i: 12, dt: 340 }, { i: 5, dt: 120 }, { i: 3, dt: 90 }, { i: 19, dt: 210 }];
var traceB = [{ i: 1, dt: 500 }, { i: 8, dt: 75 }, { i: 22, dt: 900 }];

// Golden codeblock: salt=SALT, trace=traceA. If serialization or hashing
// ever changes, this fails loudly. Recompute deliberately if you MEANT to
// change the play->codeblock contract (that is a breaking economy change).
var GOLDEN = 'f8c206d15ad0e81a539590a8bf8f812eba7da09c8e54f91bd8fbe4c73db17a12';

async function run() {
  check('bug-engine exposes the mint + roll API', function () {
    var need = ['sha256Hex', 'hashToBugTraits', '_generateBugSVG', 'bugName',
                'serializeTrace', 'mintCodeblock', 'bugFromCodeblock'];
    var missing = need.filter(function (k) { return typeof E[k] !== 'function'; });
    return { ok: missing.length === 0, detail: missing.length ? 'missing ' + missing.join(',') : 'all present' };
  });

  check('serializeTrace is deterministic', function () {
    return { ok: E.serializeTrace(traceA) === E.serializeTrace(traceA),
             detail: E.serializeTrace(traceA) };
  });

  check('serializeTrace is order-sensitive', function () {
    return { ok: E.serializeTrace(traceA) !== E.serializeTrace(traceA_order),
             detail: 'reordered moves change the trace' };
  });

  check('serializeTrace handles empty trace', function () {
    return { ok: E.serializeTrace([]) === 'lb1|' && E.serializeTrace(null) === 'lb1|',
             detail: E.serializeTrace([]) };
  });

  await check('mintCodeblock returns a 64-hex codeblock', async function () {
    var cb = await E.mintCodeblock(SALT, traceA);
    return { ok: /^[0-9a-f]{64}$/.test(cb), detail: cb };
  });

  await check('mint is deterministic (same salt+trace => same codeblock)', async function () {
    var a = await E.mintCodeblock(SALT, traceA);
    var b = await E.mintCodeblock(SALT, traceA);
    return { ok: a === b, detail: a === b ? 'stable' : a + ' != ' + b };
  });

  await check('mint matches the GOLDEN vector (play->codeblock contract locked)', async function () {
    var cb = await E.mintCodeblock(SALT, traceA);
    return { ok: cb === GOLDEN, detail: cb === GOLDEN ? 'golden ok' : 'got ' + cb };
  });

  await check('mint is input-sensitive: a 1ms timing change flips the bug', async function () {
    var a = await E.mintCodeblock(SALT, traceA);
    var b = await E.mintCodeblock(SALT, traceA_1ms);
    return { ok: a !== b, detail: a !== b ? '1ms => different codeblock' : 'collision' };
  });

  await check('mint is input-sensitive: a different move flips the bug', async function () {
    var a = await E.mintCodeblock(SALT, traceA);
    var b = await E.mintCodeblock(SALT, traceA_cell);
    return { ok: a !== b, detail: a !== b ? 'move change => different codeblock' : 'collision' };
  });

  await check('mint is salt-sensitive (server-secret seam works)', async function () {
    var a = await E.mintCodeblock(SALT, traceA);
    var b = await E.mintCodeblock('a-different-server-secret', traceA);
    return { ok: a !== b, detail: a !== b ? 'salt changes outcome' : 'salt ignored (BUG)' };
  });

  await check('codeblock -> traits is deterministic', async function () {
    var cb = await E.mintCodeblock(SALT, traceA);
    var t1 = JSON.stringify(E.hashToBugTraits(cb));
    var t2 = JSON.stringify(E.hashToBugTraits(cb));
    return { ok: t1 === t2, detail: t1 };
  });

  await check('codeblock -> bug SVG is byte-identical on repeat', async function () {
    var cb = await E.mintCodeblock(SALT, traceA);
    var s1 = E._generateBugSVG(cb, 160);
    var s2 = E._generateBugSVG(cb, 160);
    return { ok: s1 === s2 && s1.indexOf('<svg') === 0, detail: s1.length + ' bytes' };
  });

  await check('bugFromCodeblock returns {traits,name,svg}', async function () {
    var cb = await E.mintCodeblock(SALT, traceA);
    var bug = E.bugFromCodeblock(cb, 160);
    var ok = bug && bug.traits && typeof bug.name === 'string' && bug.name.length > 0
             && typeof bug.svg === 'string' && bug.svg.indexOf('<svg') === 0;
    return { ok: ok, detail: bug ? bug.name : 'no bug' };
  });

  await check('two different plays produce two different bugs', async function () {
    var cbA = await E.mintCodeblock(SALT, traceA);
    var cbB = await E.mintCodeblock(SALT, traceB);
    var svgA = E._generateBugSVG(cbA, 160);
    var svgB = E._generateBugSVG(cbB, 160);
    return { ok: cbA !== cbB && svgA !== svgB, detail: 'distinct codeblocks and distinct art' };
  });

  // ── Output ─────────────────────────────────────────────────────────
  console.log('');
  console.log('=== Litter Bug mint-loop smoke ===');
  var pass = 0, fail = 0;
  results.forEach(function (r) {
    console.log((r.ok ? '  ✓ ' : '  ✗ ') + r.name + (r.detail ? '   → ' + r.detail : ''));
    if (r.ok) pass++; else fail++;
  });
  console.log('');
  console.log(pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
}

run();
