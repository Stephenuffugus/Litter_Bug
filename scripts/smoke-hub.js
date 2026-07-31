/*
 * Litter Bug lab-hub smoke harness (labs.html; the GAME is index.html).
 *
 * The hub adapts to the vault: a fresh player gets the PLAY THE TRIAL hero,
 * a player with a minted bug (anything past the 3 seeded starters) gets
 * their newest bug's portrait and PLAY ANOTHER TRIAL. Loads index.html in
 * jsdom twice (fresh vault, seeded vault) with the three engine script tags
 * inlined from disk, and also asserts the page identity block (og tags,
 * manifest, apple-touch icon) so link previews never regress to a grey box.
 *
 * Run via `npm run smoke` (chained) or directly: `node scripts/smoke-hub.js`.
 */
var fs = require('fs');
var path = require('path');
var { JSDOM, VirtualConsole } = require('jsdom');

var ROOT = path.join(__dirname, '..');
var W = require(path.join(ROOT, 'world-engine.js'));

/* ⛔ The GAME is index.html since v1. The old lab hub, which these
   structural checks describe, moved to labs.html. */
var html = fs.readFileSync(path.join(ROOT, 'labs.html'), 'utf8');
['bug-engine.js', 'battle-engine.js', 'world-engine.js'].forEach(function (f) {
  var src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  html = html.replace('<script src="' + f + '"></script>',
    '<script>\n' + src + '\n</script>');
});
if (/script src=/.test(html)) {
  console.error('SMOKE-HUB: an external script tag survived inlining.');
  process.exit(2);
}

var TEST_CB = 'a3c1f08e5d92467b0e1f4a6c8d92b35e7f01c4a6d8e2b95f13a7c50e9d24b861';

function boot(seedVault) {
  var vConsole = new VirtualConsole();
  var errs = [];
  vConsole.on('jsdomError', function (e) { errs.push(String(e && e.message || e)); });
  var dom = new JSDOM(html, {
    url: 'https://litterbug.test/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vConsole,
    beforeParse: function (w) {
      if (seedVault) w.localStorage.setItem(W.SAVE_KEY, JSON.stringify(seedVault));
    }
  });
  dom.errs = errs;
  return dom;
}

var results = [];
function check(name, fn) {
  try { var r = fn(); results.push([!!r, name]); }
  catch (e) { results.push([false, name + ' threw: ' + e.message]); }
}

// ---- run 1: fresh player ----
var fresh = boot(null);
var d1 = fresh.window.document;
check('fresh: hero says PLAY THE TRIAL', function () {
  return /PLAY THE TRIAL/.test(d1.getElementById('hero-big').textContent);
});
check('fresh: hero links to the trial', function () {
  return /mint-lab\.html$/.test(d1.getElementById('hero').href);
});
check('fresh: no portrait injected', function () {
  return !d1.querySelector('.hero .portrait');
});
check('fresh: zero page errors', function () { return fresh.errs.length === 0; });

// ---- run 2: returning player (starters + one real mint) ----
var vault = W.seedStarter(W.newVault());
W.addBug(vault, TEST_CB);
var back = boot(vault);
var d2 = back.window.document;
check('returning: hero says PLAY ANOTHER TRIAL', function () {
  return /PLAY ANOTHER TRIAL/.test(d2.getElementById('hero-big').textContent);
});
check('returning: newest bug portrait rendered as SVG', function () {
  var p = d2.querySelector('.hero .portrait');
  return p && /<svg/i.test(p.innerHTML);
});
check('returning: collection count in the hint', function () {
  return /4 bugs/.test(d2.getElementById('hero-hint').textContent);
});
check('returning: bug name line present and non-empty', function () {
  var n = d2.querySelector('.hero .bugname');
  return n && n.textContent.length > 0;
});
check('returning: zero page errors', function () { return back.errs.length === 0; });

// ---- identity block (both runs share the static head) ----
function meta(sel) { var m = d1.querySelector(sel); return m && m.getAttribute('content'); }
check('identity: og:title', function () { return meta('meta[property="og:title"]') === 'Litter Bug'; });
check('identity: og:image is absolute', function () { return /^https:\/\/.*card\.png$/.test(meta('meta[property="og:image"]')); });
check('identity: og:description set', function () { return (meta('meta[property="og:description"]') || '').length > 10; });
check('identity: manifest linked', function () { return !!d1.querySelector('link[rel="manifest"]'); });
check('identity: apple-touch icon linked', function () { return !!d1.querySelector('link[rel="apple-touch-icon"]'); });
check('identity: baked assets exist on disk', function () {
  return fs.existsSync(path.join(ROOT, 'og', 'card.png')) && fs.existsSync(path.join(ROOT, 'og', 'icon-512.png'));
});

// Every page reachable inside the arcade's iframe must announce
// {sws:'ready'} on load — the portal's black-screen recovery closes any
// framed page that navigates and then stays silent (~1.6s), which read as
// "the trial crashed me back to the arcade" on a real phone (Stephen 7/30).
['index.html', 'mint-lab.html', 'bugdex.html', 'world.html',
 'battle-lab.html', 'bug-lab.html', 'preview.html'].forEach(function (f) {
  check('embed: ' + f + ' announces sws ready', function () {
    return /sws:\s*'ready'/.test(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  });
});

var fails = 0;
results.forEach(function (r) {
  if (!r[0]) fails++;
  console.log((r[0] ? 'PASS' : 'FAIL') + '  ' + r[1]);
});
console.log('smoke-hub: ' + (results.length - fails) + ' / ' + results.length + (fails ? ' — FAILURES' : ''));
process.exit(fails ? 1 : 0);
