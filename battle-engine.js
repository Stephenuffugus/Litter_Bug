// battle-engine.js — Litter Bug turn-based battle (P2, v2 per research w8fh4s7z2).
//
// Deterministic combat between two bugs. Reads bugStats + typeMatchupDual +
// seededRng from bug-engine.js. Same two codeblocks + same move choices +
// same levels => identical battle (server-verifiable later). Browser + Node.
//
// v2 depth: dual-typing (product effectiveness {0.39..2.56}), STAB (1.4x),
// a COVERAGE move on every bug so no mono type is a dead counter, an
// integer-floored damage chain (cross-engine safe), a fair arg-order-
// independent tie-break, capped stat stages, natures, and a litter status set
// (Corrode / Smolder / Rust-lock) on top of Guard + stage buffs.
;(function () {
  "use strict";
  var ENG = (typeof module !== "undefined" && module.exports)
    ? require("./bug-engine.js")
    : (typeof window !== "undefined" ? window.BUG_ENGINE : null);

  var STAB = 1400, LEVEL_STEP = 0.08;
  var STAGE_CAP = { atk: 3, def: 3, spd: 3, acc: 2, eva: 2 };

  // ── Moves ───────────────────────────────────────────────────────────
  // mv(name, power, opts). power 0 = status. type "self" -> primary type,
  // "cover" -> secondary (or a mono off-type). Each class kit: >=2 self
  // damage + 1 coverage damage + 1 utility/status.
  function mv(name, power, o) {
    o = o || {};
    return { name: name, kind: (power > 0 ? "attack" : "status"), pow: power,
      acc: (o.acc == null ? 0.95 : o.acc), type: o.type || "self",
      eff: o.eff || null, prio: o.prio || 0, multi: o.multi || 1, desc: o.desc || "" };
  }
  var CLASS_MOVES = {
    Aggressor:  [mv("Strike",1.0,{desc:"a solid all-purpose hit"}), mv("Heavy Blow",1.55,{acc:0.85,desc:"big damage, less accurate"}), mv("Flank Bolt",1.15,{type:"cover",desc:"off-type coverage hit"}), mv("Rally",0,{eff:"atkUp",desc:"raise your attack"})],
    Bulwark:    [mv("Strike",0.95,{desc:"a steady hit"}), mv("Body Check",1.2,{desc:"a sturdy ram"}), mv("Cover Jab",0.9,{type:"cover",desc:"off-type coverage hit"}), mv("Fortify",0,{eff:"defUp2",desc:"sharply raise defense"})],
    Skirmisher: [mv("Quick Jab",0.75,{prio:1,acc:0.98,desc:"always strikes first"}), mv("Slash",1.05,{desc:"a clean hit"}), mv("Cover Dart",0.95,{type:"cover",desc:"off-type coverage hit"}), mv("Feint",0,{eff:"accDownEnemy",desc:"lower the enemy's aim"})],
    Ambusher:   [mv("Ambush",1.5,{acc:0.85,eff:"critUp",desc:"high crit chance"}), mv("Strike",1.0,{desc:"a solid hit"}), mv("Cover Strike",1.1,{type:"cover",desc:"off-type coverage hit"}), mv("Guard",0,{eff:"guard",desc:"halve the next hit taken"})],
    Venomancer: [mv("Venom Bite",0.7,{eff:"corrode",desc:"hit and corrode (damage over time)"}), mv("Strike",0.9,{desc:"a steady hit"}), mv("Cover Spit",0.85,{type:"cover",desc:"off-type coverage hit"}), mv("Toxic Spray",0,{eff:"corrode",desc:"corrode the enemy (ignores defense)"})],
    Sentinel:   [mv("Strike",0.95,{desc:"a steady hit"}), mv("Retaliate",1.25,{desc:"a hard counter-hit"}), mv("Cover Ward",0.9,{type:"cover",desc:"off-type coverage hit"}), mv("Sweep the Grate",0,{eff:"haze",desc:"reset all stat boosts, both sides"})],
    Trickster:  [mv("Hex Bolt",1.15,{desc:"a sharp hex"}), mv("Strike",0.95,{desc:"a steady hit"}), mv("Cover Hex",1.0,{type:"cover",desc:"off-type coverage hit"}), mv("Rust Hex",0,{eff:"rustlock",desc:"rust-lock: slow the enemy, may seize"})],
    Swarm:      [mv("Swarm",0.46,{multi:3,desc:"three small hits"}), mv("Nibble",1.0,{desc:"a quick hit"}), mv("Cover Bite",0.9,{type:"cover",desc:"off-type coverage hit"}), mv("Cinder Swarm",0,{eff:"smolder",desc:"smolder: enemy hits weaker + burns"})]
  };

  // ── Fighter ─────────────────────────────────────────────────────────
  function leveledStat(v, level) { return Math.round(v * (1 + LEVEL_STEP * ((level || 1) - 1))); }
  // Poise budget per class (plus a small DEF nudge). Chips are flat 1-3 per
  // hit over a ~5 round battle, so poise is class-driven (single digits), not
  // DEF-scaled, or it could never break. Defensive classes hold guard longer.
  var POISE_CLASS = { Bulwark: 12, Sentinel: 10, Trickster: 8, Skirmisher: 7, Venomancer: 7, Aggressor: 6, Ambusher: 6, Swarm: 6 };

  function buildFighter(cb, level) {
    level = level || 1;
    var s = ENG.bugStats(cb);
    var primary = s.type, type2 = s.type2;
    // mono coverage: an off-type (guaranteed != primary) so no mono bug is a
    // dead counter with no recourse.
    var coverType = type2 || ENG.TYPES[(ENG.TYPES.indexOf(primary) + 3) % ENG.TYPES.length];
    var nat = s.nature || { up: null, down: null };
    function stat(v, key) {
      v = leveledStat(v, level);
      if (nat.up === key) v = Math.round(v * 1.08);
      if (nat.down === key) v = Math.round(v * 0.92);
      return v;
    }
    var moves = (CLASS_MOVES[s.cls] || CLASS_MOVES.Aggressor).map(function (m) {
      var c = {}; for (var k in m) c[k] = m[k];
      c.type = (c.type === "self") ? primary : (c.type === "cover") ? coverType : c.type;
      c.stab = (c.kind === "attack") && (c.type === primary || (type2 && c.type === type2));
      return c;
    });
    var hp = stat(s.stats.hp, "hp"), defv = stat(s.stats.def, "def");
    // Poise: a stagger meter. Super-effective and coverage hits chip it; at 0
    // the bug's guard breaks and it loses its next action, then poise reforms.
    // Tanky/defensive classes hold more poise. Pure integer state, no rng.
    var poiseMax = (POISE_CLASS[s.cls] || 7) + Math.round(defv / 50);
    return {
      cb: cb, name: ENG.bugName(cb), type: primary, type2: type2, cls: s.cls, kit: s.kit,
      level: level, nature: nat, maxhp: hp, hp: hp,
      atk: stat(s.stats.atk, "atk"), def: defv, spd: stat(s.stats.spd, "spd"),
      acc: stat(s.stats.acc, "acc"), eva: stat(s.stats.eva, "eva"), power: s.power,
      moves: moves, stages: { atk: 0, def: 0, spd: 0, acc: 0, eva: 0 },
      corrode: 0, smolder: 0, rustlock: false, guard: false,
      poiseMax: poiseMax, poise: poiseMax, broken: false
    };
  }
  function stageMul(st) { st = Math.max(-6, Math.min(6, st)); return st >= 0 ? (2 + st) / 2 : 2 / (2 - st); }
  function eatk(f) { return f.atk * stageMul(f.stages.atk); }
  function edef(f) { return f.def * stageMul(f.stages.def); }
  function espd(f) { return f.spd * stageMul(f.stages.spd) * (f.rustlock ? 0.5 : 1); }
  function bump(f, key, n) { var c = STAGE_CAP[key] || 3; f.stages[key] = Math.max(-c, Math.min(c, f.stages[key] + n)); }

  function hitChance(att, def, move) {
    var accMul = stageMul(att.stages.acc), evaMul = stageMul(def.stages.eva);
    // EVA demoted: its contribution is capped small (degenerate under a seed).
    var p = move.acc * accMul / evaMul * (1 - Math.min(0.15, def.eva / 600));
    return Math.max(0.4, Math.min(0.99, p));
  }
  // Integer-floored damage chain, fixed factor order (cross-engine safe).
  function damage(att, def, move, rng) {
    var typeMul = ENG.typeMatchupDual(move.type, def.type, def.type2);
    var TYPE = Math.round(typeMul * 1000);
    var STABv = move.stab ? STAB : 1000;
    var critChance = 0.0625 + (move.eff === "critUp" ? 0.25 : 0);
    var isCrit = rng() < critChance;
    // crit ignores attacker's negative ATK stage and defender's positive DEF stage
    var ea = isCrit ? att.atk * stageMul(Math.max(0, att.stages.atk)) : eatk(att);
    var ed = isCrit ? def.def * stageMul(Math.min(0, def.stages.def)) : edef(def);
    var powI = Math.round(move.pow * 100);
    var d = Math.floor(powI * ea * 14 / (100 * (ed + 22)));
    d = Math.floor(d * STABv / 1000);
    d = Math.floor(d * TYPE / 1000);
    d = Math.floor(d * (isCrit ? 1600 : 1000) / 1000);
    d = Math.floor(d * (850 + Math.floor(150 * rng())) / 1000);       // variance
    if (att.smolder > 0) d = Math.floor(d * 500 / 1000);              // burned = half damage
    if (def.guard) d = Math.floor(d * 500 / 1000);
    return { dmg: Math.max(1, d), typeMul: typeMul, crit: isCrit };
  }
  // Read-only previews for the move cards (no rng, no state change).
  function hitPercent(att, def, move) { return Math.round(hitChance(att, def, move) * 100); }
  function damageBand(att, def, move) {
    if (move.kind !== "attack") return null;
    var typeMul = ENG.typeMatchupDual(move.type, def.type, def.type2);
    var STABv = move.stab ? STAB : 1000;
    var powI = Math.round(move.pow * 100);
    var b = Math.floor(powI * eatk(att) * 14 / (100 * (edef(def) + 22)));
    b = Math.floor(b * STABv / 1000);
    b = Math.floor(b * Math.round(typeMul * 1000) / 1000);
    var smol = att.smolder > 0 ? 500 : 1000, hits = move.multi || 1;
    function v(varN) { var d = Math.floor(b * varN / 1000); d = Math.floor(d * smol / 1000); return Math.max(1, d) * hits; }
    return { min: v(850), max: v(1000), mult: typeMul };
  }
  function immune(def, status) {
    if (status === "corrode") return def.type === "Ooze" || def.type2 === "Ooze";
    if (status === "smolder") return def.type === "Ash" || def.type2 === "Ash";
    if (status === "rustlock") return def.type === "Rust" || def.type === "Spark" || def.type2 === "Rust" || def.type2 === "Spark";
    return false;
  }

  // Execute one move; push log lines + structured events; mutate fighters.
  // byL/deL are 'a'/'b' side labels so the UI can animate from `ev` not regex.
  function applyMove(att, def, move, rng, log, ev, byL, deL) {
    ev = ev || [];
    if (move.kind === "status") {
      if (move.eff === "atkUp") { bump(att, "atk", 2); log.push(att.name + " rallies. (ATK up)"); }
      else if (move.eff === "defUp") { bump(att, "def", 2); log.push(att.name + " hardens. (DEF up)"); }
      else if (move.eff === "defUp2") { bump(att, "def", 2); bump(att, "def", 1); log.push(att.name + " fortifies. (DEF up sharply)"); }
      else if (move.eff === "guard") { att.guard = true; log.push(att.name + " braces to guard."); }
      else if (move.eff === "accDownEnemy") { bump(def, "acc", -2); log.push(att.name + " flings grit; " + def.name + "'s aim drops."); }
      else if (move.eff === "haze") { att.stages = { atk:0, def:0, spd:0, acc:0, eva:0 }; def.stages = { atk:0, def:0, spd:0, acc:0, eva:0 }; log.push(att.name + " sweeps the grate. All boosts reset."); }
      else if (move.eff === "corrode") {
        if (immune(def, "corrode")) log.push(def.name + " (Ooze) shrugs off the toxin.");
        else if (def.corrode <= 0) { def.corrode = 4; log.push(att.name + " sprays toxin. " + def.name + " is corroding!"); }
        else log.push(att.name + " sprays toxin, but " + def.name + " already corrodes.");
      }
      else if (move.eff === "rustlock") {
        if (immune(def, "rustlock")) log.push(def.name + " cannot be rust-locked.");
        else if (!def.rustlock) { def.rustlock = true; log.push(att.name + " rust-locks " + def.name + "! (slowed, may seize)"); }
        else log.push(def.name + " is already rust-locked.");
      }
      else if (move.eff === "smolder") {
        if (immune(def, "smolder")) log.push(def.name + " (Ash) cannot smolder.");
        else if (def.smolder <= 0) { def.smolder = 3; log.push(att.name + " sets " + def.name + " smoldering! (weaker hits)"); }
        else log.push(def.name + " is already smoldering.");
      }
      ev.push({ kind: "status", by: byL, target: deL, eff: move.eff, move: move.name });
      return;
    }
    // attack (possibly multi-hit)
    var hits = move.multi || 1, landed = 0, total = 0, se = 1, anyCrit = false;
    for (var h = 0; h < hits; h++) {
      if (def.hp <= 0) break;
      if (rng() > hitChance(att, def, move)) { if (hits === 1) log.push(att.name + " used " + move.name + " but missed."); continue; }
      var r = damage(att, def, move, rng);
      def.hp = Math.max(0, def.hp - r.dmg); landed++; total += r.dmg;
      if (r.typeMul !== 1) se = r.typeMul;
      if (r.crit) anyCrit = true;
    }
    if (landed > 0) {
      log.push(att.name + " used " + move.name + " for " + total + " damage."
        + (se > 1 ? " Super effective!" : "") + (landed > 1 ? " (" + landed + " hits)" : ""));
      if (move.eff === "corrode" && def.corrode <= 0 && !immune(def, "corrode")) { def.corrode = 4; log.push(def.name + " is corroding!"); }
      // poise: super-effective hits chip 2, off-type coverage hits chip 1.
      var chip = (se > 1 ? 2 : 0) + (!move.stab ? 1 : 0);
      var broke = false;
      if (chip > 0 && def.hp > 0 && def.poiseMax) {
        def.poise = Math.max(0, def.poise - chip);
        if (def.poise === 0 && !def.broken) { def.broken = true; def.poise = def.poiseMax; broke = true; log.push(def.name + "'s guard breaks! It reels."); }
      }
      ev.push({ kind: "hit", by: byL, target: deL, move: move.name, dmg: total, hits: landed,
        crit: anyCrit, mult: se, hpAfter: def.hp, poise: def.poise, poiseMax: def.poiseMax });
      if (broke) ev.push({ kind: "break", side: deL });
    } else {
      if (hits > 1) log.push(att.name + " used " + move.name + " but missed.");
      ev.push({ kind: "miss", by: byL, target: deL, move: move.name });
    }
  }

  // ── AI move choice (deterministic) ──────────────────────────────────
  // Deterministic (no rng): a pure function of state, so the foe's next move
  // can be TELEGRAPHED (previewFoeMove) and equal what resolveRound picks.
  // Ties go to the lowest index (the > comparison already does this).
  function aiPick(self, foe) {
    var best = 0, bestScore = -1, hurt = self.hp / self.maxhp;
    for (var i = 0; i < self.moves.length; i++) {
      var m = self.moves[i], score;
      if (m.kind === "attack") {
        score = m.pow * (m.multi || 1) * ENG.typeMatchupDual(m.type, foe.type, foe.type2) * (m.stab ? 1.4 : 1) * m.acc;
      } else if (m.eff === "corrode") score = (foe.corrode <= 0 && !immune(foe, "corrode") ? 1.0 : 0.05) + (foe.hp / foe.maxhp) * 0.4;
      else if (m.eff === "smolder") score = (foe.smolder <= 0 && !immune(foe, "smolder") ? 0.85 : 0.05);
      else if (m.eff === "rustlock") score = (!foe.rustlock && !immune(foe, "rustlock") && espd(foe) > espd(self) ? 0.95 : 0.1);
      else if (m.eff === "haze") score = (foe.stages.atk + foe.stages.spd > 2 ? 1.1 : 0.15);
      else if (m.eff === "guard" || m.eff === "defUp" || m.eff === "defUp2") score = (hurt < 0.5 ? 0.95 : 0.3);
      else score = 0.45;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return best;
  }
  // The move the foe will use this round, computed on pre-action state.
  function previewFoeMove(state) { return state.b.moves[aiPick(state.b, state.a)]; }

  // Same ordering resolveRound uses (priority, then effective SPD incl. stages
  // and rustlock, then lower cb). Exposed read-only so the UI "you first"
  // telegraph cannot drift from the real turn order. Returns true if the
  // player (a) acts before the foe (b) when a plays move aMoveIdx.
  function previewOrder(state, aMoveIdx) {
    var a = state.a, b = state.b;
    var aMove = a.moves[aMoveIdx] || a.moves[0], bMove = previewFoeMove(state);
    if (aMove.prio !== bMove.prio) return aMove.prio > bMove.prio;
    if (espd(a) !== espd(b)) return espd(a) > espd(b);
    return a.cb < b.cb;
  }

  // ── One round ───────────────────────────────────────────────────────
  function resolveRound(state, aMoveIdx) {
    if (state.over) return state;
    var a = state.a, b = state.b, rng = state.rng, log = [], ev = [];
    function sideOf(f) { return f === a ? "a" : "b"; }
    state.round++;
    a.guard = false; b.guard = false;
    var aMove = a.moves[aMoveIdx] || a.moves[0];
    var bMove = b.moves[aiPick(b, a)];

    // fair, arg-order-independent order: priority, then eff SPD, then lower cb
    var aFirst;
    if (aMove.prio !== bMove.prio) aFirst = aMove.prio > bMove.prio;
    else if (espd(a) !== espd(b)) aFirst = espd(a) > espd(b);
    else aFirst = a.cb < b.cb;

    var order = aFirst ? [[a, b, aMove], [b, a, bMove]] : [[b, a, bMove], [a, b, aMove]];
    for (var i = 0; i < order.length; i++) {
      var att = order[i][0], def = order[i][1], mv2 = order[i][2];
      if (att.hp <= 0) continue;
      if (att.broken) {
        att.broken = false;
        log.push(att.name + " is reeling from a broken guard and cannot act!");
        ev.push({ kind: "skip", side: sideOf(att), reason: "break" }); continue;
      }
      if (att.rustlock && rng() < 0.25) {
        log.push(att.name + " is rust-locked and seizes up!");
        ev.push({ kind: "skip", side: sideOf(att), reason: "rustlock" }); continue;
      }
      applyMove(att, def, mv2, rng, log, ev, sideOf(att), sideOf(def));
      if (def.hp <= 0) { log.push(def.name + " is down!"); ev.push({ kind: "ko", side: sideOf(def) }); break; }
    }

    // end-of-round DoT (only if no direct KO decided the round already)
    var koNow = (a.hp <= 0 || b.hp <= 0);
    if (!koNow) {
      [a, b].forEach(function (f) {
        if (f.hp <= 0) return;
        var dot = 0;
        if (f.corrode > 0) { dot += Math.ceil(f.maxhp / 8); f.corrode--; }
        if (f.smolder > 0) { dot += Math.ceil(f.maxhp / 16); f.smolder--; }
        if (dot > 0) {
          f.hp = Math.max(0, f.hp - dot);
          log.push(f.name + " takes " + dot + " lingering damage.");
          ev.push({ kind: "dot", side: sideOf(f), dmg: dot, hpAfter: f.hp });
          if (f.hp <= 0) { log.push(f.name + " succumbs!"); ev.push({ kind: "ko", side: sideOf(f) }); }
        }
      });
    }

    if (a.hp <= 0 || b.hp <= 0 || state.round >= 60) {
      state.over = true;
      state.draw = (a.hp <= 0 && b.hp <= 0);
      // timeout / both-alive: higher HP fraction wins; on an exact tie fall back
      // to codeblock order (like every other tiebreak) so the winner is the same
      // regardless of which bug was passed first (arg-order symmetry).
      state.winner = (a.hp > 0 && b.hp <= 0) ? "a"
        : (b.hp > 0 && a.hp <= 0) ? "b"
        : (a.hp / a.maxhp !== b.hp / b.maxhp ? (a.hp / a.maxhp > b.hp / b.maxhp ? "a" : "b")
          : (a.cb < b.cb ? "a" : "b"));
      if (state.draw) log.push("Both bugs fall. It is a draw.");
    }
    state.log = log;
    state.events = ev;
    return state;
  }

  function startBattle(cbA, cbB, aLevel, bLevel) {
    return { a: buildFighter(cbA, aLevel), b: buildFighter(cbB, bLevel),
      // seed is arg-order-independent (sorted) so resolveBattle(A,B) and (B,A)
      // share one rng stream; combined with the codeblock tie-break the whole
      // battle is fair regardless of which bug is passed first.
      rng: ENG.seededRng([cbA, cbB].sort().join("|") + "|battle-v1"),
      round: 0, over: false, draw: false, winner: null, log: [] };
  }
  function playerRound(state, aMoveIdx) { return resolveRound(state, aMoveIdx); }
  function resolveBattle(cbA, cbB, aLevel, bLevel) {
    var st = startBattle(cbA, cbB, aLevel, bLevel), full = [];
    while (!st.over) { resolveRound(st, aiPick(st.a, st.b)); full = full.concat(st.log); }
    return { winner: st.winner, winnerName: (st.winner === "a" ? st.a : st.b).name,
      draw: st.draw, rounds: st.round, log: full,
      aHp: st.a.hp, bHp: st.b.hp, aName: st.a.name, bName: st.b.name };
  }

  var _api = { buildFighter: buildFighter, startBattle: startBattle,
    playerRound: playerRound, resolveBattle: resolveBattle,
    previewFoeMove: previewFoeMove, previewOrder: previewOrder, damageBand: damageBand, hitPercent: hitPercent,
    CLASS_MOVES: CLASS_MOVES };
  if (typeof module !== "undefined" && module.exports) module.exports = _api;
  if (typeof window !== "undefined") { window.BATTLE_ENGINE = _api; }
})();
