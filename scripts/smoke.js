/*
 * Lucid Winds smoke harness.
 *
 * Loads index.html in jsdom, stubs the externals the page expects
 * (Firebase, Pi SDK, Leaflet, GA tag, etc.), lets the inline IIFEs
 * execute, then asserts that the critical paths still work:
 *   - window-exposed renderer + trait functions exist
 *   - hashToTraits returns an expected-shape object
 *   - getTerraGrade returns a grade name
 *   - _generatePlantSVG produces an SVG that includes pot + stem +
 *     leaves at the expected viewBox
 *   - breedingForecast (the 600-iter Monte Carlo sim) runs and
 *     returns a grade distribution
 *   - renderGreenhouse can be invoked against a one-plant vault
 *     without throwing
 *
 * Run: `node scripts/smoke.js` or `npm run smoke`
 * Exits non-zero on any failure so CI / pre-push hooks can gate on it.
 */
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var { JSDOM, VirtualConsole } = require('jsdom');

var ROOT = path.join(__dirname, '..');
var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Strip external <script src="..."> tags. jsdom won't fetch them anyway,
// but cleaner this way + makes the failure modes explicit.
var stripped = html.replace(/<script\s+src=["'][^"']+["']\s*><\/script>/gi, '');

// Track errors thrown inside the page so we can surface them.
var pageErrors = [];
var vConsole = new VirtualConsole();
vConsole.on('jsdomError', function(err){
  pageErrors.push(err && (err.detail ? err.detail.message : err.message) || String(err));
});

// Bootstrapping: stubs go in via beforeParse so they exist BEFORE the
// inline scripts run. We mimic just enough of each external surface
// that the inline IIFEs don't blow up while initializing.
var dom = new JSDOM(stripped, {
  url: 'https://lucidwinds.com/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vConsole,
  beforeParse: function(window) {
    // Real WebCrypto from Node — index.html uses crypto.subtle.digest
    // (SHA-256 for plant hashes + auth). jsdom's default crypto stub
    // doesn't include .subtle, so we plug Node's webcrypto in.
    try { window.crypto = crypto.webcrypto; } catch(e) {}

    // Firebase compat surface — every consumer guards on auth().currentUser
    // and falls back gracefully when not signed in, so we just need the
    // chain to be callable without throws.
    var noopFn = function(){ return Promise.resolve({ data: { ok: false } }); };
    // Firebase.auth().onAuthStateChanged returns an unsubscribe function
    // in production. Page code does `var u = onAuthStateChanged(cb); u();`
    // so we MUST return a function — a no-op suffices.
    var unsubFn = function(){};
    window.firebase = {
      initializeApp: function(){ return {}; },
      auth: function(){
        return {
          currentUser: null,
          onAuthStateChanged: function(cb){
            if (cb) setTimeout(function(){ cb(null); }, 0);
            return unsubFn;
          },
          signOut: function(){ return Promise.resolve(); },
          createUserWithEmailAndPassword: noopFn,
          signInWithEmailAndPassword: noopFn,
          signInWithPopup: noopFn,
          GoogleAuthProvider: function(){},
          FacebookAuthProvider: function(){}
        };
      },
      firestore: function(){
        var coll = function(){ return { doc: function(){ return { get: noopFn, set: noopFn, update: noopFn, onSnapshot: function(){ return unsubFn; } }; }, where: function(){ return { get: noopFn, limit: function(){ return { get: noopFn }; }, orderBy: function(){ return { get: noopFn, limit: function(){ return { get: noopFn }; } }; } }; }, get: noopFn, add: noopFn, onSnapshot: function(){ return unsubFn; } }; };
        return { collection: coll, doc: function(){ return { get: noopFn, set: noopFn, onSnapshot: function(){ return unsubFn; } }; }, FieldValue: { serverTimestamp: function(){ return 0; }, increment: function(){ return 0; }, delete: function(){ return null; } } };
      },
      functions: function(){ return { httpsCallable: function(){ return noopFn; } }; }
    };

    // Pi SDK — index.html guards with typeof Pi === 'undefined'. Leaving
    // Pi as undefined lets that branch take and disables payments cleanly.
    // (Anything we'd stub here would falsely flip the new pi-browser
    // detector we just fixed.)

    // Leaflet — Wild tab. Same pattern: object-chain that's callable but
    // does nothing. Tests don't open the Wild map, but parse-time refs
    // would crash without this.
    var Lnode = function(){ return Lnode; };
    Lnode.map = function(){ return { setView: function(){ return Lnode; }, on: function(){ return Lnode; }, off: function(){ return Lnode; }, removeLayer: function(){}, addLayer: function(){}, hasLayer: function(){ return false; }, invalidateSize: function(){} }; };
    Lnode.marker = function(){ return { addTo: function(){ return Lnode; }, on: function(){ return Lnode; }, bindPopup: function(){ return Lnode; }, remove: function(){} }; };
    Lnode.tileLayer = function(){ return { addTo: function(){ return Lnode; } }; };
    Lnode.divIcon = function(){ return {}; };
    Lnode.icon = function(){ return {}; };
    Lnode.polygon = function(){ return { addTo: function(){ return Lnode; }, on: function(){ return Lnode; }, remove: function(){} }; };
    Lnode.latLng = function(a,b){ return { lat:a, lng:b }; };
    Lnode.latLngBounds = function(){ return { extend: function(){} }; };
    Lnode.Control = { extend: function(){ return function(){ return { onAdd: function(){ return document.createElement('div'); }, addTo: function(){} }; }; } };
    window.L = Lnode;

    // GA + Pi + misc globals the page expects to be present.
    window.gtag = function(){};
    window.ga = function(){};
    window.dataLayer = [];

    // engagement.js defines this; we stub a no-op shape so referenced
    // calls don't throw if engagement.js isn't loaded in the harness.
    window.LW_ACH = {
      bump: function(){}, set: function(){}, add: function(){},
      progress: function(){ return {}; }, claim: function(){ return null; },
      catalog: []
    };

    // Service worker — index.html registers SW; jsdom doesn't ship one.
    if (!window.navigator.serviceWorker) {
      Object.defineProperty(window.navigator, 'serviceWorker', {
        value: { register: function(){ return Promise.resolve({}); }, getRegistration: function(){ return Promise.resolve(null); } }
      });
    }
    // navigator.vibrate — _haptic uses it
    window.navigator.vibrate = function(){};
    // navigator.share — share fallback path
    window.navigator.share = undefined;
    // navigator.geolocation — Wild GPS
    window.navigator.geolocation = { getCurrentPosition: function(){}, watchPosition: function(){}, clearWatch: function(){} };
  }
});

// Wait for the page to finish booting, then run checks.
var window = dom.window;
window.addEventListener('load', function(){
  // Give async deferred work one tick to settle (Pi SDK polling,
  // any setTimeout(0) bootstrap, etc.).
  setTimeout(runChecks, 50);
});

// Hard wall: if the page never finishes booting, fail loudly.
setTimeout(function(){
  console.error('SMOKE TIMEOUT: page never reached load event in 12s.');
  if (pageErrors.length) {
    console.error('Page errors caught before timeout:');
    pageErrors.forEach(function(e){ console.error('  - ' + e); });
  }
  process.exit(2);
}, 12000);

function runChecks(){
  var results = [];
  function check(name, fn){
    try {
      var r = fn();
      results.push({ name: name, ok: !!r.ok, detail: r.detail || '' });
    } catch(e) {
      results.push({ name: name, ok: false, detail: 'THREW: ' + (e && e.message || e) });
    }
  }

  // 1. Window-exposed core functions are present after page boot.
  check('window._generatePlantSVG is a function', function(){
    return { ok: typeof window._generatePlantSVG === 'function' };
  });
  check('window.hashToTraits is a function', function(){
    return { ok: typeof window.hashToTraits === 'function' };
  });
  check('window.getTerraGrade is a function', function(){
    return { ok: typeof window.getTerraGrade === 'function' };
  });
  check('window.mintPlant is a function', function(){
    return { ok: typeof window.mintPlant === 'function' };
  });
  check('window.renderGreenhouse is a function', function(){
    return { ok: typeof window.renderGreenhouse === 'function' };
  });
  check('window.breedingForecast is a function', function(){
    return { ok: typeof window.breedingForecast === 'function' };
  });
  check('window._chimeraDualClass is a function', function(){
    return { ok: typeof window._chimeraDualClass === 'function' };
  });

  // 2. hashToTraits returns expected shape from a deterministic hash.
  var testHash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  check('hashToTraits returns object with pot/stem/leaf/season fields', function(){
    var t = window.hashToTraits(testHash);
    var ok = t && typeof t === 'object'
      && typeof t.pot === 'number'
      && typeof t.stem === 'number'
      && typeof t.leafType === 'number'
      && typeof t.season === 'number';
    return { ok: ok, detail: ok ? 'pot=' + t.pot + ' stem=' + t.stem + ' season=' + t.season : 'shape=' + JSON.stringify(t).slice(0,200) };
  });

  // 3. getTerraGrade returns a named grade.
  check('getTerraGrade returns a recognized grade name', function(){
    var t = window.hashToTraits(testHash);
    var g = window.getTerraGrade(t);
    var names = ['Common','Uncommon','Rare','Epic','Legendary','Mythic','Cosmic'];
    return { ok: g && names.indexOf(g.name) >= 0, detail: g ? g.name + ' (score=' + g.score + ')' : 'null' };
  });

  // 4. _generatePlantSVG returns SVG with the three core layers.
  // The renderer should output pot + stem + leaves at minimum for any
  // hash. Regressions like the May 9 wild-render bug + May 13 bloom
  // bug both broke this property.
  check('_generatePlantSVG produces full plant (pot + stem + leaves)', function(){
    var svg = window._generatePlantSVG(testHash, 200, 1, null);
    if (typeof svg !== 'string' || svg.length < 200) {
      return { ok: false, detail: 'svg too short: ' + (svg && svg.length) };
    }
    var hasOpen = /<svg[\s>]/.test(svg);
    var hasClose = /<\/svg>/.test(svg);
    // Heuristics — look for pot fill, stem id pattern, leaf-shape elements.
    var hasPot = /\bpot\b|url\(#pg|<rect/.test(svg);
    var hasStem = /url\(#sg|<line\b|stem/i.test(svg);
    var hasLeaves = /<ellipse\b|<path\b.*?d=/.test(svg);
    var ok = hasOpen && hasClose && hasPot && hasStem && hasLeaves;
    return { ok: ok, detail: 'len=' + svg.length + ' pot=' + hasPot + ' stem=' + hasStem + ' leaves=' + hasLeaves };
  });

  // 5. Thumbnail mode works too (greenhouse grid uses size=50ish).
  check('_generatePlantSVG thumbnail (size 40) produces valid SVG', function(){
    var svg = window._generatePlantSVG(testHash, 40, 1, null);
    var ok = typeof svg === 'string' && svg.length > 100 && /<svg[\s>]/.test(svg) && /<\/svg>/.test(svg);
    return { ok: ok, detail: 'len=' + (svg && svg.length) };
  });

  // 6. breedingForecast (the 600-iter sim) runs and returns grades.
  check('breedingForecast returns a grade distribution', function(){
    if (typeof window.breedingForecast !== 'function') return { ok: false, detail: 'not a function' };
    var hashB = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
    var fc = window.breedingForecast(testHash, hashB);
    if (!fc) return { ok: false, detail: 'returned null' };
    var ok = fc.grades && typeof fc.grades === 'object'
      && fc.eaRange && fc.eaRange.length === 2
      && typeof fc.mutationChance !== 'undefined';
    var sum = 0;
    if (fc.grades) for (var k in fc.grades) sum += fc.grades[k];
    return { ok: ok && sum > 0, detail: 'gradeSum=' + sum + '% eaRange=' + (fc.eaRange ? fc.eaRange.join('-') : '?') };
  });

  // 7. _chimeraDualClass returns dual class for a cross-season bred plant.
  // Verifies the bug fixed today (parents + generation flowing through).
  check('_chimeraDualClass returns dual class for valid bred plant', function(){
    // Forge a plant with parents in different seasons. Season byte = hb(22) % 4.
    // Pick parent hashes whose char[22..23] hex resolve to different seasons.
    var pA = '00000000000000000000003000000000000000000000000000000000000ff000'; // season idx 0
    var pB = '00000000000000000000001100000000000000000000000000000000000ff000'; // season idx 1 (different)
    // Pick a child hash whose char[16..17] roll < 0x40 so the 25% gate passes.
    var child = '00000000000000003000000000000000000000000000000000000000000ff000';
    var plant = { hash: child, parentAHash: pA, parentBHash: pB, generation: 2 };
    var cls = window._chimeraDualClass(plant);
    return { ok: typeof cls === 'string' && cls.indexOf('chimera-dual') >= 0, detail: '"' + cls + '"' };
  });

  // 8. renderGreenhouse doesn't throw with an empty greenhouse.
  check('renderGreenhouse() does not throw on empty greenhouse', function(){
    if (typeof window.renderGreenhouse !== 'function') return { ok: false, detail: 'no fn' };
    window.localStorage.setItem('sws_greenhouse', '[]');
    // The render target may not exist in the static markup served by
    // jsdom (it's typically created at switchTab time); we just want
    // to confirm the function doesn't throw on an empty vault.
    window.renderGreenhouse();
    return { ok: true };
  });

  // 9. renderGreenhouse doesn't throw with one plant in localStorage.
  check('renderGreenhouse() does not throw with one plant', function(){
    if (typeof window.renderGreenhouse !== 'function') return { ok: false, detail: 'no fn' };
    var p = { hash: testHash, born: Date.now(), generation: 1, origin: 'bloom' };
    window.localStorage.setItem('sws_greenhouse', JSON.stringify([p]));
    window.renderGreenhouse();
    return { ok: true };
  });

  // ── Output ───────────────────────────────────────────────────────────
  console.log('');
  console.log('=== Lucid Winds smoke harness ===');
  var pass = 0, fail = 0;
  results.forEach(function(r){
    console.log((r.ok ? '  ✓ ' : '  ✗ ') + r.name + (r.detail ? '   → ' + r.detail : ''));
    if (r.ok) pass++; else fail++;
  });
  console.log('');
  console.log(pass + ' pass, ' + fail + ' fail');
  if (pageErrors.length) {
    console.log('');
    console.log('Page errors caught during boot (' + pageErrors.length + ', first 5):');
    pageErrors.slice(0, 5).forEach(function(e){ console.log('  - ' + e); });
  }
  process.exit(fail ? 1 : 0);
}
