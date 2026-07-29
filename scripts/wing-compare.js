#!/usr/bin/env node
/*
 * wing-compare — the plan-B proof sheet. Finds four winged (non-elytra)
 * bugs, renders each procedural (top row) and with the authored test wing
 * registered (bottom row), and writes WING_DROPIN_PROOF.png.
 * Same codeblocks both rows: only the wing source changes.
 */
var path = require('path');
var crypto = require('crypto');
var sharp = require('sharp');
var E = require(path.join(__dirname, '..', 'bug-engine.js'));
var TEST_WING = require('./test-wing.js');
function cb(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }

(async function () {
  // find winged non-elytra bugs: their render CHANGES when a wing symbol registers
  var picks = [];
  for (var i = 0; i < 200 && picks.length < 4; i++) {
    var h = cb('wingpick' + i);
    E.clearParts('wing');
    var proc = E._generateBugSVG(h, 160);
    E.registerPart('wing', 0, TEST_WING);
    var auth = E._generateBugSVG(h, 160);
    if (proc !== auth) picks.push({ h: h, proc: proc, auth: auth });
  }
  E.clearParts('wing');
  if (picks.length < 4) { console.log('FAIL: found only ' + picks.length + ' winged bugs in 200'); process.exit(1); }

  var CELL = 200, PAD = 10, comps = [];
  for (var j = 0; j < 4; j++) {
    var a = await sharp(Buffer.from(picks[j].proc)).resize(CELL, CELL).png().toBuffer();
    var b = await sharp(Buffer.from(picks[j].auth)).resize(CELL, CELL).png().toBuffer();
    comps.push({ input: a, left: PAD + j * (CELL + PAD), top: PAD });
    comps.push({ input: b, left: PAD + j * (CELL + PAD), top: PAD * 2 + CELL });
  }
  var W = PAD + 4 * (CELL + PAD), H = PAD * 3 + CELL * 2;
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 18, g: 20, b: 18, alpha: 1 } } })
    .composite(comps).png().toFile(path.join(__dirname, '..', 'WING_DROPIN_PROOF.png'));
  console.log('WING_DROPIN_PROOF.png written: top row procedural, bottom row authored test wing, same codeblocks');
})();
