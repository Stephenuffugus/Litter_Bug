#!/usr/bin/env node
/*
 * check.js — the gate that LOADS THE GAME.
 *
 *   node check.js            run against index.html
 *   LB_FILE=x.html node check.js   run against a copy (the mutation driver)
 *
 * ⛔ WHY THIS EXISTS. Before 2026-08-24 this repo had ten smoke harnesses and
 * not one of them opened index.html. Playing it for ten minutes in a browser
 * found five defects that had shipped since v1: all three jobs laid out in a
 * 0x0 field, the champion's SVG computed to height 0 on HOME, THE DUMPSTER
 * printed "?" five times because it threw, a brisk thumb drained the whole
 * day in 22 seconds, and a corrupt save killed the script block. A green test
 * suite is not a played game, and a suite that never loads the page is not a
 * suite. Every check below guards one of the things that was actually broken.
 *
 * ⛔ Every check in here has been WATCHED GOING RED. scripts/lb_mutation_drive.js
 * applies one realistic single point defect to a copy of index.html, runs this
 * file against it, and reports BITES or VACUOUS per mutation. A check nobody
 * has seen fail is decoration.
 */
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require(require.resolve('puppeteer', { paths: ['/workspaces/lucid-winds'] }));

const ROOT = __dirname;
const FILE = process.env.LB_FILE || 'index.html';
const PORT = parseInt(process.env.LB_PORT || '8793', 10);

let pass = 0, fail = 0, gname = '';
function group(n) { gname = n; console.log('\n── ' + n + ' ' + '─'.repeat(Math.max(0, 58 - n.length))); }
function ok(cond, label, detail) {
  if (cond) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.log('  FAIL ' + label + (detail !== undefined ? '   got: ' + JSON.stringify(detail) : '')); }
}

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1100));
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const base = `http://127.0.0.1:${PORT}/`;

  async function open(url, w, h) {
    const p = await browser.newPage();
    const errs = [];
    p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
    p.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 200)));
    await p.setViewport({ width: w || 412, height: h || 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await p.goto(base + url, { waitUntil: 'networkidle2', timeout: 45000 });
    await p.evaluate(() => new Promise(r => setTimeout(r, 450)));
    p._errs = errs;
    return p;
  }

  try {
    // ══ BOOT ══════════════════════════════════════════════════════════
    group('the page boots and the script block is alive');
    const p = await open(FILE + '?lbtest=1');
    const boot = await p.evaluate(() => ({
      dev: typeof window.LB_DEV === 'object' && !!window.LB_DEV,
      engine: typeof window.BUG_ENGINE === 'object',
      battle: typeof window.BATTLE_ENGINE === 'object',
      screens: document.querySelectorAll('.screen').length,
      onScreen: (document.querySelector('.screen.on') || {}).id || null
    }));
    ok(boot.dev, 'LB_DEV exists under ?lbtest=1 (a dead script block kills this first)', boot);
    ok(boot.engine && boot.battle, 'bug-engine and battle-engine both loaded', boot);
    ok(boot.screens >= 9, 'every screen is in the document', boot.screens);
    /* a first run opens the rules, not HOME: the guard is `if (window.parent
       !== window)`-shaped, it is deliberate, and a check that demanded s-home
       was asserting the wrong thing on a clean browser. */
    ok(boot.onScreen === 's-how' || boot.onScreen === 's-home', 'a fresh browser opens on the rules or HOME', boot.onScreen);
    const afterRules = await p.evaluate(async () => {
      const b = document.getElementById('b-how-go'); if (b) b.click();
      await new Promise(r => setTimeout(r, 250));
      return (document.querySelector('.screen.on') || {}).id || null;
    });
    ok(afterRules === 's-home', 'START WORKING off the rules screen lands on HOME', afterRules);
    ok(p._errs.length === 0, 'zero console errors and zero page errors on boot', p._errs.slice(0, 3));

    // ══ THE JOBS LAY OUT IN A REAL FIELD ══════════════════════════════
    group('the four blocks lay out in a field with a real size');
    for (const kind of ['sort', 'grub', 'wire', 'pry']) {
      const r = await p.evaluate(async (k) => {
        const D = window.LB_DEV; D.reset(); D.show('s-home');
        D.startJob(k);
        await new Promise(x => setTimeout(x, 260));
        const G = D.state();
        const f = document.getElementById('p-field');
        const fr = f.getBoundingClientRect();
        const kids = [...f.children].map(c => {
          const s = c.style;
          return { l: parseFloat(s.left), t: parseFloat(s.top), cls: c.className };
        }).filter(o => isFinite(o.l) && isFinite(o.t));
        const xs = kids.map(o => o.l), ys = kids.map(o => o.t);
        D.endJob();
        return { fw: G && G.fw, fh: G && G.fh, rectW: Math.round(fr.width), rectH: Math.round(fr.height),
          n: kids.length, minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
      }, kind);
      ok(r.fw > 200 && r.fh > 200, kind + ': the field measures a real size, not 0x0', { fw: r.fw, fh: r.fh });
      ok(r.rectW > 200 && r.rectH > 200, kind + ': the field is actually on screen when it is measured', r);
      if (r.n > 0) {
        ok(r.minX >= -8 && r.minY >= -8, kind + ': nothing spawns at a negative offset', r);
        ok(r.maxX <= r.fw && r.maxY <= r.fh, kind + ': nothing spawns past the far edge', r);
        const spreadX = r.maxX - r.minX, spreadY = r.maxY - r.minY;
        if (r.n >= 4) ok(spreadX > 60 || spreadY > 60, kind + ': the pieces are spread out, not stacked in one corner', { spreadX, spreadY, n: r.n });
      }
    }

    // ══ YOU CAN SEE YOUR BUG ══════════════════════════════════════════
    group('the champion is visible on HOME');
    const home = await p.evaluate(async () => {
      const D = window.LB_DEV; D.reset();
      D.setShinies(D.mintCost); await D.doMint(); D.keep();
      D.show('s-home'); paintHome();
      await new Promise(r => setTimeout(r, 250));
      const svg = document.querySelector('#home-bug svg');
      if (!svg) return { none: true };
      const r = svg.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), chars: svg.outerHTML.length, vb: svg.getAttribute('viewBox') };
    });
    ok(!home.none, 'the champion SVG is in the document', home);
    ok(home.h > 40 && home.w > 40, 'the champion SVG has a REAL rendered size (it computed to 494x0 before)', home);
    ok(home.vb && home.vb !== '0 0 200 200', 'the camera frames the bug instead of a fixed 200x200 box', home.vb);
    /* ⛔ 2026-09-05: an SVG gradient in the drawn alley was given the id "b-dump", so
       getElementById('b-dump') returned the gradient and THE DUMPSTER button silently left HOME.
       Ids are one namespace for the whole document, and the duplicate-id check below cannot see
       a SHADOWED id (there was only one "b-dump" element, it was just the wrong one). */
    const doors = await p.evaluate(() => ['b-scav', 'b-dex', 'b-dump', 'b-how'].map(id => {
      const el = document.getElementById(id); const r = el ? el.getBoundingClientRect() : null;
      return { id, tag: el ? el.tagName : null, w: r ? Math.round(r.width) : 0, h: r ? Math.round(r.height) : 0 };
    }));
    ok(doors.every(d => d.tag === 'BUTTON' && d.w > 100 && d.h > 40), 'every door on HOME is a BUTTON with a real size (a gradient once stole b-dump)', doors);

    // ══ THE DUMPSTER ══════════════════════════════════════════════════
    group('THE DUMPSTER returns real results');
    const dump = await p.evaluate(async () => {
      const D = window.LB_DEV; D.reset();
      for (let i = 0; i < 2; i++) { D.setShinies(D.mintCost); await D.doMint(); D.keep(); }
      D.show('s-dump'); paintDump();
      await new Promise(r => setTimeout(r, 320));
      const rows = [...document.querySelectorAll('#k-list > *')];
      return { n: rows.length, txt: rows.map(r => r.textContent.replace(/\s+/g, ' ').trim()),
        anyQ: rows.some(r => /\?/.test(r.textContent)),
        champ: (document.getElementById('k-champ').textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90) };
    });
    ok(dump.n === 5, 'five challengers, seeded for the day', dump.n);
    ok(!dump.anyQ, 'no row prints "?" (resolveBattle threw on all five before)', dump.txt);
    ok(dump.txt.every(t => t.length > 8), 'every challenger row carries real text', dump.txt);
    ok(/LV|LEVEL|\d/.test(dump.champ), 'the champion card is painted', dump.champ);
    ok(!/DAY \d{4,}/.test(dump.txt.join(' ') + dump.champ), 'no raw epoch day index is shown to the player', dump.txt);

    // ══ THE ARENA, ON THE INTERACTIVE PATH ════════════════════════════
    group('a battle actually plays and finishes');
    const battle = await p.evaluate(async () => {
      const D = window.LB_DEV; D.reset();
      for (let i = 0; i < 2; i++) { D.setShinies(D.mintCost); await D.doMint(); D.keep(); }
      D.show('s-dump'); paintDump();
      await new Promise(r => setTimeout(r, 260));
      const row = document.querySelector('#k-list > *');
      (row.querySelector('button') || row).click();
      await new Promise(r => setTimeout(r, 420));
      const a0 = D.arena();
      if (!a0 || !a0.st) return { noArena: true };
      const startHp = { a: a0.st.a.hp, b: a0.st.b.hp };
      let moves = 0, sawFlash = 0, sawPop = 0, rounds = 0;
      /* ⛔ WALL CLOCK BOUND. Without it a hung arena spins 60 iterations at
         ~1s each inside one evaluate and the suite dies with a protocol
         TargetCloseError instead of reporting a red check. A gate that CRASHES
         on the defect it is supposed to catch has not caught it. Found by the
         mutation driver, which is the point of the mutation driver. */
      const deadline = Date.now() + 22000;
      for (let i = 0; i < 60 && Date.now() < deadline; i++) {
        const ar = D.arena();
        if (!ar || !ar.st || ar.st.over) break;
        if (ar.busy) { await new Promise(r => setTimeout(r, 120)); continue; }
        const btns = [...document.querySelectorAll('#a-moves button, #a-moves .move')].filter(b => !b.hasAttribute('disabled'));
        if (!btns.length) { await new Promise(r => setTimeout(r, 120)); continue; }
        const hpBefore = ar.st.a.hp + ar.st.b.hp;
        btns[0].click();
        await new Promise(r => setTimeout(r, 120));
        if (document.querySelector('.flash.on')) sawFlash++;
        if (document.querySelector('.dmgpop')) sawPop++;
        if (document.querySelector('.spark')) sawFlash++;
        await new Promise(r => setTimeout(r, 700));
        const after = D.arena() && D.arena().st;
        /* ⛔ an EXCHANGE is HP that moved, never a click that landed. */
        if (after && (after.a.hp + after.b.hp) !== hpBefore) moves++;
        rounds = after ? (after.round || rounds) : rounds;
      }
      const ar = D.arena();
      return { moves, sawFlash, sawPop, rounds,
        over: !!(ar && ar.st && ar.st.over),
        endHp: ar && ar.st ? { a: ar.st.a.hp, b: ar.st.b.hp } : null, startHp,
        moveCards: document.querySelectorAll('#a-moves button, #a-moves .move').length };
    });
    ok(!battle.noArena, 'the arena opens with a live state', battle);
    ok(battle.moveCards >= 3, 'the player is given move cards to choose from', battle.moveCards);
    /* ⛔ >= 1, not >= 2: a fast bug can one-shot a challenger, and demanding two
       resolving exchanges made this check FLIP between runs (1 of 4 red).
       `moves` counts HP THAT MOVED, never a click that landed, so a no-op
       playMove scores 0 here even though the buttons stay clickable. */
    ok(battle.moves >= 1, 'an exchange RESOLVES (hp moves, not just a click)', battle.moves);
    ok(battle.over, 'the battle reaches an end state', battle);
    ok(battle.endHp && (battle.endHp.a < battle.startHp.a || battle.endHp.b < battle.startHp.b),
      'somebody actually took damage', battle);
    ok(battle.sawPop >= 1, 'a damage number pops on a hit', battle.sawPop);
    ok(battle.sawFlash >= 1, 'a hit flash or a spark fires on an exchange', battle.sawFlash);

    // ══ THE DAILY CAP ═════════════════════════════════════════════════
    group('the day cannot be drained by tapping fast');
    /* ⛔ ON ITS OWN PAGE. This group used to share the page with the arena group
       and read SAVE.shinies as an absolute. finishArena pays the purse on a
       setTimeout tail, so 9 purse Shinies landed AFTER reset() and the check
       flipped between runs. A check that flips is a bug in the check. */
    const capPage = await open(FILE + '?lbtest=1');
    const cap = await capPage.evaluate(async () => {
      const D = window.LB_DEV; D.reset();
      const SHIFT = D.shiftCap(), DAILY = D.dailyCap(), SHIFTS = D.dailyShifts();
      D.startJob('sort');
      await new Promise(r => setTimeout(r, 200));
      /* ⛔ this drives bump(), the function the JOBS call, not the raw currency
         function. Driving earnShinies directly would prove nothing: the shift
         cap lives in bump and the day cap lives in earnShinies, and the defect
         on 2026-08-24 was that NEITHER existed. 22 seconds of a brisk 380ms
         thumb is 58 scoring taps. */
      for (let i = 0; i < 58; i++) D.bump(2);
      const shiftScore = D.state().score;
      D.endJob();
      const afterBurst = D.save().shinies;
      const left = D.capLeft();
      return { SHIFT, DAILY, SHIFTS, shiftScore, afterBurst, left, shiftsLeft: D.shiftsLeft() };
    });
    await capPage.close();
    ok(cap.SHIFT < cap.DAILY, 'one shift can never pay the whole day', cap);
    ok(cap.SHIFT * cap.SHIFTS >= cap.DAILY * 0.9, 'the shifts on offer can actually reach the daily cap', cap);
    ok(cap.shiftScore <= cap.SHIFT, '58 fast taps in one shift score no more than one shift is worth', cap);
    ok(cap.afterBurst <= cap.SHIFT, '58 fast taps in one shift cannot PAY more than one shift', cap);
    ok(cap.afterBurst < cap.DAILY, 'one shift cannot empty the day', cap);
    ok(cap.left > 0, 'there is still something to earn after a burst of tapping', cap);
    ok(cap.shiftsLeft >= 1, 'there are shifts left after the first one', cap);

    // ══ A CLEAN SHIFT ENDS AT FORTY, THE FEATURED BLOCK STAMPS THE WEEK ═
    group('forty ends the shift, and the featured block stamps the week');
    /* Drives bump(), the function the jobs call. Before 2026-09-05 forty was a ceiling you
       sat under for the rest of the minute; now it is the finish line, the time is kept per
       block, and a clean shift on the day's featured block stamps a seven day strip. */
    const clPage = await open(FILE + '?lbtest=1');
    const cl = await clPage.evaluate(async () => {
      const D = window.LB_DEV; D.reset();
      const feat = D.featured(), SHIFT = D.shiftCap();
      D.startJob(feat);
      await new Promise(r => setTimeout(r, 300));
      let taps = 0;
      for (let i = 0; i < 40 && !D.state().over; i++) { D.bump(2); taps++; }
      const st = D.state(), scr = D.cur();
      const head = document.getElementById('d-head').textContent;
      const note = document.getElementById('d-note').textContent;
      const t = (D.save().times || {})[feat];
      const wk = D.save().week, dow = D.dow();
      const stampedToday = !!(wk && wk.s && wk.s[dow]);
      const strip = document.querySelectorAll('#d-week .wd').length;
      const stripOn = document.querySelectorAll('#d-week .wd.on').length;
      /* the picker */
      D.show('s-home'); document.getElementById('b-scav').click();
      const first = document.querySelector('#s-block .stack .btn');
      const firstJob = first && first.getAttribute('data-job');
      const prim = document.querySelectorAll('#s-block .btn.primary').length;
      const chip = first && first.querySelector('.fb') ? first.querySelector('.fb').textContent : null;
      const bestTxt = first && first.querySelector('.best') ? first.querySelector('.best').textContent : '';
      const chipR = first && first.querySelector('.fb') ? first.querySelector('.fb').getBoundingClientRect() : null;
      const pickStrip = document.querySelectorAll('#block-week .wd').length;
      /* a clean shift on a block that is NOT featured must not stamp */
      const other = ['sort', 'grub', 'wire', 'pry'].filter(k => k !== feat)[0];
      D.startJob(other);
      await new Promise(r => setTimeout(r, 300));
      for (let i = 0; i < 40 && !D.state().over; i++) D.bump(2);
      const head2 = document.getElementById('d-head').textContent;
      const stamps2 = D.save().week.s.reduce((a, b) => a + b, 0);
      const week2 = document.querySelectorAll('#d-week .wd').length;
      /* a shift that runs out of clock is still SHIFT OVER */
      D.startJob(other);
      await new Promise(r => setTimeout(r, 200));
      D.bump(3); D.endJob();
      const head3 = document.getElementById('d-head').textContent;
      return { feat, SHIFT, taps, over: st.over, score: st.score, tLeft: st.t, scr, head, note, t, stampedToday, strip, stripOn,
        firstJob, prim, chip, chipW: chipR ? Math.round(chipR.width) : 0, bestTxt, pickStrip, other, head2, stamps2, week2, head3 };
    });
    await clPage.close();
    ok(cl.over && cl.scr === 's-done' && cl.score === cl.SHIFT, 'forty Shinies ends the shift, the done screen is up', cl);
    ok(cl.tLeft > 0 && cl.taps <= cl.SHIFT / 2 + 1, 'it ended while the clock still had time on it', { tLeft: cl.tLeft, taps: cl.taps });
    ok(cl.head === 'CLEAN SHIFT', 'the done screen says CLEAN SHIFT', cl.head);
    ok(cl.t > 0 && cl.t <= 60 && /Forty in [\d.]+ seconds/.test(cl.note), 'the clean time is kept for the block and read out', { t: cl.t, note: cl.note });
    ok(cl.stampedToday && cl.strip === 7 && cl.stripOn === 1, 'a clean shift on the featured block stamps today on a seven day strip', cl);
    ok(cl.firstJob === cl.feat && cl.prim === 1 && cl.chip === 'TODAY' && cl.chipW > 30, 'the picker puts the featured block first, alone in green, wearing a TODAY chip', cl);
    ok(/CLEAN/.test(cl.bestTxt) && cl.pickStrip === 7, 'the picker shows the clean time on that block and the week strip', { bestTxt: cl.bestTxt, pickStrip: cl.pickStrip });
    ok(cl.head2 === 'CLEAN SHIFT' && cl.stamps2 === 1 && cl.week2 === 0, 'a clean shift on another block is clean but does not stamp the week', cl);
    ok(cl.head3 === 'SHIFT OVER', 'a shift that runs out of clock is SHIFT OVER, not clean', cl.head3);

    // ══ IDENTITY DEPTH ════════════════════════════════════════════════
    group('identity depth: the lore names a part the bug has, and no name moves');
    /* fixtures/identity-60.json was captured from the engine BEFORE the part line
       existed. A bug is its name: the sixty must still answer to theirs, their old
       three lines must still lead, and line four must name a part the plan drew. */
    const idPage = await open(FILE + '?lbtest=1');
    const idr = await idPage.evaluate(async () => {
      const E = window.BUG_ENGINE, D = window.LB_DEV; D.reset();
      const fx = await (await fetch('fixtures/identity-60.json?' + Math.random())).json();
      let nameSame = 0, loreKept = 0, fourLines = 0;
      fx.forEach(f => { const id = E.bugIdentity(f.h); if (id.name === f.name && id.species === f.species) nameSame++; if (id.lore.indexOf(f.lore) === 0) loreKept++; if (id.lore.split('\n').length === 4) fourLines++; });
      let partOk = 0, wingLeak = 0, keys = {}, n = 600;
      for (let i = 0; i < n; i++) {
        /* sha256Hex is async in the browser; a seeded rng gives the same 600 hashes every run */
        const rr = E.seededRng('idcheck-' + i); let h = ''; for (let k = 0; k < 64; k++) h += Math.floor(rr() * 16).toString(16);
        const p = E.bugPartLine(h), c = E.bugPartCandidates(h), P = E.bugPlan(h);
        const bank = E.PART_LINES[p.key] || [];
        if (c.indexOf(p.key) >= 0 && bank.some(t => p.line.indexOf(t.split('{')[0]) === 0)) partOk++;
        keys[p.key] = 1;
        if (P.plan.wings === 999 && /^(shell|fourWings|membrane|veined|eyespot|tattered)$/.test(p.key)) wingLeak++;
      }
      /* the family chips over a dozen minted bugs */
      for (let i = 0; i < 12; i++) { D.setShinies(D.mintCost); await D.doMint(); D.keep(); }
      document.getElementById('b-dex').click();
      const chips = [...document.querySelectorAll('#x-chips .chip')];
      const chipH = chips.length ? chips[0].getBoundingClientRect().height : 0;
      const total = document.querySelectorAll('#x-grid .card').length;
      const fam = D.dex().map(b => E.bugFamily(b.cb).wing);
      let filterOk = true, detail = [];
      chips.slice(1).forEach((ch, i) => { ch.click(); const shown = document.querySelectorAll('#x-grid .card').length; const want = fam.filter(w => w === i).length; detail.push(shown + '/' + want); if (shown !== want) filterOk = false; });
      chips[0].click(); const back = document.querySelectorAll('#x-grid .card').length;
      D.openSpec(0); const famLine = document.querySelector('#sp-front .specfam');
      const famRow = [...document.querySelectorAll('#sp-back .row .k')].some(k => k.textContent === 'FAMILY');
      /* growth honesty: parts carry thresholds, the part line prefers what is drawn at mint,
         and a young high grade bug wears dashed chips for what has not grown in */
      let partsParallel = 0, preferOk = 0;
      for (let i = 0; i < n; i++) {
        const rr = E.seededRng('idcheck-' + i); let h = ''; for (let k = 0; k < 64; k++) h += Math.floor(rr() * 16).toString(16);
        const g = E.bugGrade(h); if (g.parts.length === g.marks.length && g.parts.every((p, j) => p.label === g.marks[j] && p.th >= 0 && p.th <= 1)) partsParallel++;
        const c = E.bugPartCandidates(h), p = E.bugPartLine(h);
        const anyNow = c.some(k => E.partThreshold(h, k) <= E.MINT_GROWTH);
        if (!anyNow || E.partThreshold(h, p.key) <= E.MINT_GROWTH) preferOk++;
      }
      /* a fixture with the most latent parts, pinned at level 1 then grown to 30 */
      let best = null; fx.forEach(f => { const g = E.bugGrade(f.h); const lat = g.parts.filter(p => p.th > E.MINT_GROWTH).length; if (!best || lat > best.lat) best = { h: f.h, lat, grade: g.grade }; });
      D.dex().push({ cb: best.h, grade: best.grade, lvl: 1, wins: 0, at: Date.now() });
      const idx = D.dex().length - 1;
      D.openSpec(idx);
      const latentAt1 = document.querySelectorAll('#sp-front .mark.latent').length;
      const grownRow1 = [...document.querySelectorAll('#sp-back .row')].map(r => r.textContent).find(t => /^GROWN/.test(t)) || '';
      D.setLvl(idx, 30); D.openSpec(idx);
      const latentAt30 = document.querySelectorAll('#sp-front .mark.latent').length;
      const grownRow30 = [...document.querySelectorAll('#sp-back .row')].map(r => r.textContent).find(t => /^GROWN/.test(t)) || '';
      return { nameSame, loreKept, fourLines, fxN: fx.length, partOk, n, wingLeak, keysUsed: Object.keys(keys).length, chips: chips.length, chipH, total, filterOk, detail, back, famLine: famLine ? famLine.textContent : null, famRow,
        partsParallel, preferOk, bestLat: best.lat, latentAt1, grownRow1, latentAt30, grownRow30 };
    });
    await idPage.close();
    ok(idr.nameSame === idr.fxN, 'sixty fixture bugs still answer to their name and species', idr.nameSame + '/' + idr.fxN);
    ok(idr.loreKept === idr.fxN, 'the three lore lines every bug already had still lead', idr.loreKept + '/' + idr.fxN);
    ok(idr.fourLines === idr.fxN, 'and every bug now has a fourth line', idr.fourLines + '/' + idr.fxN);
    ok(idr.partOk === idr.n, 'the fourth line names a part the plan drew, from that part\'s bank', idr.partOk + '/' + idr.n);
    ok(idr.wingLeak === 0, 'a wingless bug never gets a wing line', idr.wingLeak);
    ok(idr.keysUsed >= 25, 'the part line draws on a wide bank', idr.keysUsed + ' parts used over 600');
    ok(idr.chips === 5 && idr.chipH >= 48, 'five family chips over the Bugdex, 48px tall', { chips: idr.chips, chipH: idr.chipH });
    ok(idr.total === 12 && idr.filterOk && idr.back === 12, 'a chip filters the grid to its family and ALL brings it back', idr.detail);
    ok(!!idr.famLine && /^[A-Za-z]+ · [a-z ]+$/.test(idr.famLine) && idr.famRow, 'the specimen card names the family, front and ledger', idr.famLine);
    ok(idr.partsParallel === idr.n, 'every scored mark carries the growth threshold it is drawn at', idr.partsParallel + '/' + idr.n);
    ok(idr.preferOk === idr.n, 'the part line prefers a part drawn at mint growth when there is one', idr.preferOk + '/' + idr.n);
    ok(idr.bestLat >= 3 && idr.latentAt1 === idr.bestLat && /of \d+ parts in · the .+ at level \d+/.test(idr.grownRow1), 'a young bug wears a dashed chip for every part not grown in yet, and the ledger says which is next', { lat: idr.bestLat, at1: idr.latentAt1, row: idr.grownRow1 });
    ok(idr.latentAt30 === 0 && /fully grown/.test(idr.grownRow30), 'at level 30 every chip is solid and the ledger says fully grown', { at30: idr.latentAt30, row: idr.grownRow30 });

    // ══ SOUND ═════════════════════════════════════════════════════════
    group('sound: every beat has a cue, every cue moves air, the pill mutes it');
    const sndPage = await open(FILE + '?lbtest=1');
    const snd = await sndPage.evaluate(async () => {
      const S = window.LB_SFX, D = window.LB_DEV; const wait = ms => new Promise(r => setTimeout(r, ms));
      D.reset(); S.reset();
      const names = Object.keys(S.cues);
      /* every cue bounced offline: RMS above the floor or it is a call with no sound behind it */
      const rms = {}; for (const n of names) rms[n] = await new Promise(res => S.render(n, res));
      const silent = names.filter(n => !(rms[n] > 0.002));
      /* the beats fire from the game's own paths */
      document.getElementById('b-dex').click(); const tick = S.log.indexOf('tick') >= 0; D.show('s-home');
      D.startJob('sort'); await wait(300); D.bump(3); D.endJob(); const over = S.log.indexOf('over') >= 0;
      D.startJob('pry'); await wait(300); for (let i = 0; i < 40 && !D.state().over; i++) D.bump(2); const clean = S.log.indexOf('clean') >= 0;
      D.setShinies(D.mintCost); await D.doMint(); const jar = S.log.indexOf('jar') >= 0; D.keep();
      /* the pill */
      const pill = document.getElementById('b-snd'); const r = pill.getBoundingClientRect();
      const label1 = pill.textContent; pill.click(); const off = !S.on(); const stored = localStorage.getItem('lb_snd'); const label2 = pill.textContent;
      S.reset(); document.getElementById('b-dex').click(); const loggedWhileOff = S.log.indexOf('tick') >= 0; D.show('s-home');
      pill.click(); const back = S.on();
      return { cues: names.length, silent, tick, over, clean, jar, pillH: r.height, pillW: r.width, label1, label2, off, stored, loggedWhileOff, back, ctx: !!S.ctxRef() };
    });
    await sndPage.close();
    ok(snd.cues >= 14, 'a cue for every beat of the alley and the dumpster', snd.cues);
    ok(snd.silent.length === 0, 'every cue moves air when bounced offline', snd.silent);
    ok(snd.tick && snd.over && snd.clean && snd.jar, 'a button, a shift ending, a clean shift and the jar each speak from the real path', { tick: snd.tick, over: snd.over, clean: snd.clean, jar: snd.jar });
    ok(snd.pillH >= 48 && snd.label1 === 'SOUND ON' && snd.label2 === 'SOUND OFF' && snd.off && snd.stored === '0' && snd.back, 'the SOUND pill mutes, remembers, and unmutes', { pillH: snd.pillH, label1: snd.label1, label2: snd.label2, stored: snd.stored });
    ok(snd.loggedWhileOff, 'muted still logs the beat (the mute is at the speaker, not the game)', snd.loggedWhileOff);
    ok(snd.ctx, 'an AudioContext exists after the first beat', snd.ctx);

    // ══ VOCABULARY 2 ══════════════════════════════════════════════════
    group('vocabulary 2: new shapes on the body, not one grade moved');
    const v2Page = await open(FILE + '?lbtest=1');
    const v2 = await v2Page.evaluate(async () => {
      const E = window.BUG_ENGINE;
      const fx = await (await fetch('fixtures/grades-3000.json?' + Math.random())).json();
      let moved = 0, n = 0;
      for (const h in fx) { n++; const g = E.bugGrade(h); if (g.grade + ':' + g.score !== fx[h]) moved++; }
      const seg = [0, 0, 0, 0]; let irid = 0, pairs = 0, tint = 0, bad = 0, tear = 0, iridDrawn = 0, m = 600;
      for (let i = 0; i < m; i++) {
        const rr = E.seededRng('v2-' + i); let h = ''; for (let k = 0; k < 64; k++) h += Math.floor(rr() * 16).toString(16);
        const P = E.bugPlan(h); seg[P.segShape]++; if (P.irid) irid++; if (P.legPairs === 2) pairs++; if (P.wingTint) tint++;
        if (i < 200) { const svg = E._generateBugSVG(h, 150, 31); if (/NaN|undefined/.test(svg)) bad++; if (P.segShape === 1 && /A [\d.]+ [\d.]+ 0 0 1/.test(svg)) tear++; if (P.irid && svg.indexOf('id="gi') >= 0) iridDrawn++; }
      }
      return { n, moved, seg, irid, pairs, tint, m, bad, tear, iridDrawn };
    });
    await v2Page.close();
    ok(v2.n === 3000 && v2.moved === 0, 'three thousand bugs grade and score exactly as before the pass', v2.moved + ' moved of ' + v2.n);
    ok(v2.seg[0] > v2.m * 0.35 && v2.seg[0] < v2.m * 0.55 && v2.seg[1] > 0 && v2.seg[2] > 0 && v2.seg[3] > 0, 'segment shapes roll: about half stay round, the three new shapes all occur', v2.seg);
    ok(v2.irid > v2.m * 0.12 && v2.irid < v2.m * 0.32 && v2.pairs > v2.m * 0.2 && v2.pairs < v2.m * 0.4 && v2.tint > v2.m * 0.3, 'iridescence, a second leg pair and a wing tint roll at their rates', { irid: v2.irid, pairs: v2.pairs, tint: v2.tint });
    ok(v2.bad === 0 && v2.tear > 0 && v2.iridDrawn > 0, 'two hundred renders are clean, teardrops and the sweep reach the picture', { bad: v2.bad, tear: v2.tear, iridDrawn: v2.iridDrawn });

    // ══ A CORRUPT SAVE ════════════════════════════════════════════════
    group('a junk save boots into a clean game, not a dead page');
    const JUNK = [
      'not json{{{',
      '[]',
      'null',
      '{"dex":[{"cb":"zz"},null,{"cb":123}],"shinies":"abc"}',
      '{"dex":{"0":{"cb":"' + 'a'.repeat(64) + '"}},"champ":99,"king":[]}',
      '{"shinies":-5,"jobs":"x","lastDay":{},"dex":[{"cb":"' + 'b'.repeat(64) + '","lvl":9999}]}'
    ];
    for (const j of JUNK) {
      const q = await open(FILE + '?lbtest=1');
      await q.evaluate(v => { try { localStorage.setItem('lb_dex_v1', v); } catch (e) {} }, j);
      await q.reload({ waitUntil: 'networkidle2' });
      await q.evaluate(() => new Promise(r => setTimeout(r, 400)));
      const st = await q.evaluate(() => {
        if (typeof window.LB_DEV !== 'object' || !window.LB_DEV) return { dead: true };
        const s = window.LB_DEV.save();
        return { dead: false, dex: (s.dex || []).length, shin: s.shinies,
          allValid: (s.dex || []).every(b => /^[0-9a-f]{64}$/.test(b.cb) && b.lvl >= 1 && b.lvl <= 30),
          onScreen: (document.querySelector('.screen.on') || {}).id || null };
      });
      const tag = j.slice(0, 26).replace(/\s+/g, ' ');
      ok(!st.dead, 'save "' + tag + '": the script block survives', st);
      if (!st.dead) {
        ok(typeof st.shin === 'number' && st.shin >= 0 && st.allValid, 'save "' + tag + '": every field is validated on the way in', st);
        ok(st.onScreen === 's-home', 'save "' + tag + '": the game still opens on HOME', st.onScreen);
      }
      await q.close();
    }

    // ══ THE ART DEFECTS FOUND BY LOOKING ══════════════════════════════
    group('the art cannot vanish');
    const art = await p.evaluate(async () => {
      const D = window.LB_DEV; D.reset();
      const S = D.save(); const hex = '0123456789abcdef';
      const mk = n => { let s = ''; for (let i = 0; i < 64; i++) s += hex[(Math.abs(Math.sin(n * 97 + i * 13)) * 16 | 0) % 16]; return s; };
      S.dex = []; for (let i = 0; i < 9; i++) S.dex.push({ cb: mk(i), at: Date.now(), grade: D.grade(mk(i)).grade, score: 0, lvl: 1 + i * 3, wins: 0 });
      S.champ = 0;
      D.show('s-home'); paintHome();
      D.show('s-dex'); paintDex();
      await new Promise(r => setTimeout(r, 350));
      // ids must be unique across the WHOLE document or a fill resolves into a
      // hidden copy and paints nothing
      const ids = [...document.querySelectorAll('[id]')].map(e => e.id);
      const seen = {}, dupes = [];
      ids.forEach(i => { if (seen[i]) { if (dupes.indexOf(i) < 0) dupes.push(i); } seen[i] = 1; });
      const cards = [...document.querySelectorAll('#x-grid .card svg')];
      const sizes = cards.map(s => { const r = s.getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); });
      // every card must have painted body geometry, not just strokes
      const bodies = cards.map(s => s.querySelectorAll('[fill^="url(#"]').length);
      return { dupes: dupes.slice(0, 6), nCards: cards.length, minSize: Math.min(...sizes),
        minBodies: Math.min(...bodies), sameBug: cards.length };
    });
    ok(art.dupes.length === 0, 'no duplicate element ids anywhere in the document', art.dupes);
    ok(art.nCards === 9, 'every bug in the dex draws a card', art.nCards);
    ok(art.minSize > 40, 'every card SVG has a real rendered size', art.minSize);
    ok(art.minBodies >= 1, 'every card paints filled body geometry, not just a wire skeleton', art.minBodies);

    // ══ THE CARD YOU CAN HOLD ═════════════════════════════════════════
    group('the specimen card renders a 640x960 PNG with the bug on it');
    const card = await p.evaluate(async () => {
      const D = window.LB_DEV, E = window.BUG_ENGINE; D.reset();
      D.setShinies(D.mintCost); await D.doMint(); D.keep();
      /* ⛔ a FIXED bug, not the random mint: the lit test reads saturation and brightness, and
         a dark scrap palette (Oil Slick, Sodium Night) paints under 3% however big the bug is.
         Sixty fixtures measured 0.012 to 0.304 on 2026-09-05, so the random mint flipped this
         check about half the time. Fixture 0 is a bright Baron on a plain plate: 0.30. */
      const fx = await (await fetch('fixtures/identity-60.json?' + Math.random())).json();
      const b = { cb: fx[0].h, grade: E.bugGrade(fx[0].h).grade, lvl: 1, wins: 0, at: Date.now() };
      const cv = await new Promise(res => D.renderCard(b, res));
      const ctx = cv.getContext('2d');
      /* the art band: count pixels that are not the plate or the ground */
      const band = ctx.getImageData(130, 180, 380, 380).data; let lit = 0, n = 0;
      for (let i = 0; i < band.length; i += 16) { n++; const r = band[i], g = band[i + 1], bl = band[i + 2]; if (Math.max(r, g, bl) - Math.min(r, g, bl) > 40 || Math.max(r, g, bl) > 120) lit++; }
      D.openSpec(0); await new Promise(r => setTimeout(r, 200));
      const front = document.getElementById('sp-front'), back = document.getElementById('sp-back');
      return { w: cv.width, h: cv.height, litShare: lit / n, frontHasArt: !!(front && front.querySelector('svg')), backHasHash: !!(back && /[0-9a-f]{64}/.test(back.textContent)),
        onScreen: (document.querySelector('.screen.on') || {}).id };
    });
    ok(card.w === 640 && card.h === 960, 'the card canvas is 640x960', card);
    /* ⛔ a card with no bug on it is a coloured rectangle. The art band must carry real paint:
       watched red by removing the drawImage in a mutant copy, which leaves only the plate. */
    ok(card.litShare > 0.15, 'the art band of the card has the bug painted in it (more than the plate alone)', card.litShare);
    ok(card.frontHasArt && card.backHasHash && card.onScreen === 's-spec', 'the specimen flip card shows the bug on the front and the full hash on the back', card);

    // ══ THE GRADE READS THE ART ═══════════════════════════════════════
    group('the grade reads the parts that are drawn');
    const grade = await p.evaluate(() => {
      const D = window.LB_DEV, E = window.BUG_ENGINE;
      const hex = '0123456789abcdef'; let agree = 0, marked = 0, plain = 0, n = 400;
      let minS = 1e9, maxS = -1e9;
      for (let i = 0; i < n; i++) {
        let cb = ''; for (let j = 0; j < 64; j++) cb += hex[(Math.random() * 16) | 0];
        const g = D.grade(cb), pl = E.bugPlan(cb);
        if (g.marks.length) marked++; else plain++;
        // an elytra shell in the marks must mean the plan really rolled one
        if ((g.marks.indexOf('elytra shell') >= 0) === (pl.plan.wings !== 999 && pl.wingKind === 2)) agree++;
        minS = Math.min(minS, g.score); maxS = Math.max(maxS, g.score);
      }
      // the Flying tag must match the wings the renderer draws
      let tagAgree = 0;
      for (let i = 0; i < 200; i++) {
        let cb = ''; for (let j = 0; j < 64; j++) cb += hex[(Math.random() * 16) | 0];
        if ((E.bugStats(cb).tags[0] === 'Flying') === (E.bugPlan(cb).plan.wings !== 999)) tagAgree++;
      }
      return { agree, n, marked, plain, minS, maxS, tagAgree, cuts: E.GRADE_CUT.slice() };
    });
    ok(grade.agree === grade.n, 'every "elytra shell" mark corresponds to a shell the renderer draws', grade);
    ok(grade.tagAgree === 200, 'the Flying tag matches the wings that are drawn', grade.tagAgree);
    ok(grade.marked > grade.n * 0.9, 'nearly every bug has at least one named visible part', grade);
    ok(grade.maxS - grade.minS > 30, 'the score has enough spread to separate seven tiers', grade);
    ok(grade.cuts.length === 7 && grade.cuts[6] > grade.cuts[0], 'seven grade cuts, strictly increasing', grade.cuts);

    // ══ TOUCH TARGETS, MEASURED IN RENDERED PIXELS ════════════════════
    group('48px touch targets at 375x667, measured RENDERED not CSS');
    const small = await open(FILE + '?lbtest=1', 375, 667);
    const touch = await small.evaluate(async () => {
      const D = window.LB_DEV; D.reset();
      for (let i = 0; i < 2; i++) { D.setShinies(D.mintCost); await D.doMint(); D.keep(); }
      const st = document.getElementById('stage');
      const scale = st.getBoundingClientRect().width / st.offsetWidth;
      const out = [];
      const screens = ['s-home', 's-block', 's-dex', 's-dump', 's-how'];
      for (const id of screens) {
        D.show(id);
        if (id === 's-home') paintHome(); if (id === 's-dex') paintDex(); if (id === 's-dump') paintDump();
        await new Promise(r => setTimeout(r, 220));
        const btns = [...document.querySelectorAll('#' + id + ' button, #' + id + ' .btn')];
        btns.forEach(b => {
          const r = b.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) return;
          out.push({ id, t: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 26),
            w: +r.width.toFixed(1), h: +r.height.toFixed(1) });
        });
      }
      return { scale: +scale.toFixed(3), out };
    });
    const tooSmall = touch.out.filter(o => o.h < 48 || o.w < 48);
    ok(touch.out.length > 8, 'the audit actually found buttons to measure', touch.out.length);
    ok(touch.scale < 1, 'the stage really is scaled down at 375x667 (CSS px would lie here)', touch.scale);
    ok(tooSmall.length === 0, 'every button measures 48 RENDERED px or more', tooSmall.slice(0, 6));
    await small.close();

    // ══ THE EMBED PROTOCOL ════════════════════════════════════════════
    group('every page posts {sws:ready} when the portal frames it');
    /* ⛔ the post is guarded by `if (window.parent !== window)`, which is right:
       it only means anything to an embedder. So this check FRAMES the page the
       way the portal does and listens in the parent. The first version of this
       check loaded each page top level and found nothing on all eight, which
       looked like eight broken pages and was eight broken assertions. */
    {
      const h = await browser.newPage();
      await h.setContent('<body style="margin:0"><script>window.__got={};window.addEventListener("message",function(e){if(e&&e.data&&e.data.sws){window.__got[(e.source&&e.source.frameElement&&e.source.frameElement.dataset.p)||"?"]=e.data.sws;}});<\/script></body>', { waitUntil: 'load' });
      for (const page of ['index.html', 'labs.html', 'bugdex.html', 'mint-lab.html', 'battle-lab.html', 'world.html', 'bug-lab.html', 'preview.html']) {
        const got = await h.evaluate(async (src, slug) => {
          return await new Promise(res => {
            let done = false;
            const onMsg = e => { if (e && e.data && e.data.sws === 'ready' && e.source === f.contentWindow) { done = true; cleanup(); res('ready'); } };
            const cleanup = () => { window.removeEventListener('message', onMsg); if (f.parentNode) f.parentNode.removeChild(f); };
            window.addEventListener('message', onMsg);
            const f = document.createElement('iframe');
            f.dataset.p = slug; f.style.cssText = 'width:412px;height:915px;border:0';
            f.src = src;
            document.body.appendChild(f);
            setTimeout(() => { if (!done) { cleanup(); res('TIMEOUT'); } }, 6000);
          });
        }, base + page, page);
        ok(got === 'ready', page + ' posts {sws:"ready"} to its embedder', got);
      }
      await h.close();
    }

    // ══ ZERO CONSOLE ERRORS AFTER A FULL WALK ═════════════════════════
    group('a full walk leaves the console clean');
    ok(p._errs.length === 0, 'no console or page errors across the whole run', p._errs.slice(0, 4));
    await p.close();
  } catch (e) {
    fail++; console.log('\n  FAIL the suite itself threw: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
  }

  await browser.close();
  server.kill();
  console.log('\n' + '─'.repeat(62));
  console.log(pass + ' ok, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
})();
