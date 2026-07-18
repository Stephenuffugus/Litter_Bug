// battle-engine.js — Litter Bug turn-based battle (P2).
//
// Deterministic combat between two bugs. Reads bugStats + typeMatchup +
// seededRng from bug-engine.js. Given the same two codeblocks and the same
// move choices, a battle always resolves identically, so it can later run
// server-side and verify a submitted territory fight. Browser + Node.
//
// Two entry points:
//   resolveBattle(cbA, cbB)      -> auto-battle, both sides AI (for tests +
//                                   async territory defense). { winner, log }
//   startBattle(cbA, cbB)        -> interactive state; the player drives side A
//   playerRound(state, moveIdx)  -> resolve one round (player move + AI move)
;(function () {
  "use strict";
  var ENG = (typeof module !== "undefined" && module.exports)
    ? require("./bug-engine.js")
    : (typeof window !== "undefined" ? window.BUG_ENGINE : null);

  // ── Moves ───────────────────────────────────────────────────────────
  // mv(name, power, opts). power 0 = status move. type "self" = the bug's own
  // type. eff is an effect tag handled in applyMove. prio = turn priority.
  function mv(name, power, o) {
    o = o || {};
    return { name: name, kind: (power > 0 ? "attack" : "status"), pow: power,
      acc: (o.acc == null ? 0.95 : o.acc), type: o.type || "self",
      eff: o.eff || null, prio: o.prio || 0, multi: o.multi || 1 };
  }
  var CLASS_MOVES = {
    Aggressor:  [mv("Strike",1.0), mv("Heavy Blow",1.55,{acc:0.82}), mv("Reckless Charge",1.35,{eff:"selfDefDown"}), mv("Brace",0,{eff:"defUp"})],
    Bulwark:    [mv("Strike",0.95), mv("Body Check",1.15), mv("Fortify",0,{eff:"defUp2"}), mv("Guard",0,{eff:"guard"})],
    Skirmisher: [mv("Quick Jab",0.7,{prio:1,acc:0.98}), mv("Strike",1.0), mv("Evade",0,{eff:"evaUp"}), mv("Double Hit",0.5,{multi:2})],
    Ambusher:   [mv("Ambush",1.5,{acc:0.85,eff:"critUp"}), mv("Strike",1.0), mv("Feint",0,{eff:"accDownEnemy"}), mv("Guard",0,{eff:"guard"})],
    Venomancer: [mv("Venom Bite",0.65,{eff:"poison"}), mv("Toxic Spray",0,{acc:0.95,eff:"poison"}), mv("Strike",0.9), mv("Weaken",0,{eff:"atkDownEnemy"})],
    Sentinel:   [mv("Strike",0.95), mv("Guard Stance",0,{eff:"guard"}), mv("Harden",0,{eff:"defUp"}), mv("Retaliate",1.25)],
    Trickster:  [mv("Strike",0.9), mv("Sand Flick",0,{eff:"accDownEnemy"}), mv("Slow Hex",0,{eff:"spdDownEnemy"}), mv("Hex Bolt",1.05)],
    Swarm:      [mv("Swarm",0.35,{multi:3}), mv("Strike",0.95), mv("Nibble",0.8), mv("Rally",0,{eff:"atkUp"})]
  };

  // ── Fighter ─────────────────────────────────────────────────────────
  // Each level adds 8% to the combat stats (matches world-engine leveling).
  var LEVEL_STEP = 0.08;
  function leveledStat(v, level) { return Math.round(v * (1 + LEVEL_STEP * ((level || 1) - 1))); }
  function buildFighter(cb, level) {
    level = level || 1;
    var s = ENG.bugStats(cb);
    var moves = (CLASS_MOVES[s.cls] || CLASS_MOVES.Aggressor).map(function (m) {
      var c = {}; for (var k in m) c[k] = m[k];
      if (c.type === "self") c.type = s.type;
      return c;
    });
    var hp = leveledStat(s.stats.hp, level);
    return {
      cb: cb, name: ENG.bugName(cb), type: s.type, cls: s.cls, kit: s.kit, level: level,
      maxhp: hp, hp: hp,
      atk: leveledStat(s.stats.atk, level), def: leveledStat(s.stats.def, level),
      spd: leveledStat(s.stats.spd, level), acc: leveledStat(s.stats.acc, level),
      eva: leveledStat(s.stats.eva, level), power: s.power,
      moves: moves,
      stages: { atk: 0, def: 0, spd: 0, acc: 0, eva: 0 },
      poison: 0, guard: false, critUp: false
    };
  }
  // Pokemon-style stage multiplier, clamped to [-6, 6].
  function stageMul(st) { st = Math.max(-6, Math.min(6, st)); return st >= 0 ? (2 + st) / 2 : 2 / (2 - st); }
  function eatk(f) { return f.atk * stageMul(f.stages.atk); }
  function edef(f) { return f.def * stageMul(f.stages.def); }
  function espd(f) { return f.spd * stageMul(f.stages.spd); }

  // ── Resolution helpers ──────────────────────────────────────────────
  function hitChance(att, def, move) {
    var accMul = stageMul(att.stages.acc), evaMul = stageMul(def.stages.eva);
    var p = move.acc * accMul / evaMul * (1 - def.eva / 300);
    return Math.max(0.33, Math.min(0.99, p));
  }
  function damage(att, def, move, rng) {
    var typeMul = ENG.typeMatchup(move.type, def.type);
    var critChance = 0.0625 + (move.eff === "critUp" ? 0.25 : 0);
    var crit = rng() < critChance ? 1.6 : 1;
    var variance = 0.88 + 0.12 * rng();
    var raw = move.pow * (eatk(att) * 14) / (edef(def) + 22);
    var dmg = raw * typeMul * crit * variance * (def.guard ? 0.5 : 1);
    return { dmg: Math.max(1, Math.round(dmg)), typeMul: typeMul, crit: crit > 1 };
  }
  function bump(f, key, n) { f.stages[key] = Math.max(-6, Math.min(6, f.stages[key] + n)); }

  // Execute one move; push readable log lines; return {fainted:bool}.
  function applyMove(att, def, move, rng, log) {
    // status effects
    if (move.kind === "status") {
      if (move.eff === "defUp") { bump(att, "def", 2); log.push(att.name + " hardens its shell. (DEF up)"); }
      else if (move.eff === "defUp2") { bump(att, "def", 3); log.push(att.name + " fortifies. (DEF up sharply)"); }
      else if (move.eff === "atkUp") { bump(att, "atk", 2); log.push(att.name + " rallies. (ATK up)"); }
      else if (move.eff === "evaUp") { bump(att, "eva", 2); log.push(att.name + " weaves. (harder to hit)"); }
      else if (move.eff === "guard") { att.guard = true; log.push(att.name + " braces to guard."); }
      else if (move.eff === "accDownEnemy") { bump(def, "acc", -2); log.push(att.name + " flings grit. " + def.name + "'s aim drops."); }
      else if (move.eff === "spdDownEnemy") { bump(def, "spd", -2); log.push(att.name + " hexes " + def.name + ". (slowed)"); }
      else if (move.eff === "atkDownEnemy") { bump(def, "atk", -2); log.push(att.name + " weakens " + def.name + ". (ATK down)"); }
      else if (move.eff === "poison") {
        if (def.poison <= 0) { def.poison = 3; log.push(att.name + " sprays toxin. " + def.name + " is poisoned!"); }
        else log.push(att.name + " sprays toxin, but " + def.name + " is already poisoned.");
      }
      return { fainted: false };
    }
    // attack (possibly multi-hit)
    var hits = move.multi || 1, landed = 0, total = 0, notedType = false;
    for (var h = 0; h < hits; h++) {
      if (def.hp <= 0) break;
      if (rng() > hitChance(att, def, move)) { if (hits === 1) log.push(att.name + " used " + move.name + " but missed."); continue; }
      var r = damage(att, def, move, rng);
      def.hp = Math.max(0, def.hp - r.dmg);
      landed++; total += r.dmg;
      if (!notedType && r.typeMul !== 1) notedType = r.typeMul > 1;
    }
    if (landed > 0) {
      var extra = (notedType === true ? " Super effective!" : "") + (landed > 1 ? " (" + landed + " hits)" : "");
      log.push(att.name + " used " + move.name + " for " + total + " damage." + extra);
      if (move.eff === "poison" && def.poison <= 0) { def.poison = 3; log.push(def.name + " is poisoned!"); }
      if (move.eff === "selfDefDown") { bump(att, "def", -1); }
    } else if (hits > 1) {
      log.push(att.name + " used " + move.name + " but missed.");
    }
    return { fainted: def.hp <= 0 };
  }

  // ── AI move choice (deterministic via rng) ──────────────────────────
  function aiPick(self, foe, rng) {
    var best = 0, bestScore = -1;
    for (var i = 0; i < self.moves.length; i++) {
      var m = self.moves[i], score;
      if (m.kind === "attack") {
        score = m.pow * (m.multi || 1) * ENG.typeMatchup(m.type, foe.type) * m.acc;
      } else {
        // value defense when hurt, poison when foe is healthy and unpoisoned
        var hurt = self.hp / self.maxhp;
        if (m.eff === "poison") score = (foe.poison <= 0 ? 0.9 : 0.1) + (foe.hp / foe.maxhp) * 0.4;
        else if (m.eff === "guard" || m.eff === "defUp" || m.eff === "defUp2") score = (hurt < 0.5 ? 1.0 : 0.35);
        else score = 0.5;
      }
      score += rng() * 0.05; // deterministic tiebreak
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return best;
  }

  // ── One round: both sides act in priority/speed order ───────────────
  function resolveRound(state, aMoveIdx) {
    if (state.over) return state;
    var a = state.a, b = state.b, rng = state.rng, log = [];
    state.round++;
    a.guard = false; b.guard = false; // guard lasts only the round it's set... set during this round below
    var aMove = a.moves[aMoveIdx] || a.moves[0];
    var bMove = b.moves[aiPick(b, a, rng)];

    // order: higher priority first, then higher effective speed, then A
    var aFirst;
    if (aMove.prio !== bMove.prio) aFirst = aMove.prio > bMove.prio;
    else if (espd(a) !== espd(b)) aFirst = espd(a) > espd(b);
    else aFirst = true;

    var order = aFirst ? [[a, b, aMove], [b, a, bMove]] : [[b, a, bMove], [a, b, aMove]];
    for (var i = 0; i < order.length; i++) {
      var att = order[i][0], def = order[i][1], mv2 = order[i][2];
      if (att.hp <= 0) continue;
      applyMove(att, def, mv2, rng, log);
      if (def.hp <= 0) { log.push(def.name + " is down!"); break; }
    }

    // A direct KO this round decides the fight; end-of-round poison does not
    // then kill the winner. Poison only bites when nobody landed a knockout.
    var koNow = (a.hp <= 0 || b.hp <= 0);
    if (!koNow) {
      [a, b].forEach(function (f) {
        if (f.hp > 0 && f.poison > 0) {
          var tick = Math.max(1, Math.round(f.maxhp / 12));
          f.hp = Math.max(0, f.hp - tick); f.poison--;
          log.push(f.name + " takes " + tick + " poison damage.");
          if (f.hp <= 0) log.push(f.name + " succumbs to poison!");
        }
      });
    }

    if (a.hp <= 0 || b.hp <= 0 || state.round >= 60) {
      state.over = true;
      state.draw = (a.hp <= 0 && b.hp <= 0);   // simultaneous poison deaths
      state.winner = (a.hp > 0 && b.hp <= 0) ? "a"
        : (b.hp > 0 && a.hp <= 0) ? "b"
        : (a.hp / a.maxhp >= b.hp / b.maxhp ? "a" : "b"); // draw/timeout: higher HP%
      if (state.draw) log.push("Both bugs fall. It is a draw.");
    }
    state.log = log;
    return state;
  }

  function startBattle(cbA, cbB, aLevel, bLevel) {
    return { a: buildFighter(cbA, aLevel), b: buildFighter(cbB, bLevel),
      rng: ENG.seededRng(cbA + "|" + cbB + "|battle-v1"),
      round: 0, over: false, draw: false, winner: null, log: [] };
  }
  // interactive: player controls A, picks a move index; B answers via AI
  function playerRound(state, aMoveIdx) { return resolveRound(state, aMoveIdx); }

  // auto-battle: both AI. Returns { winner:'a'|'b', winnerName, rounds, log }
  function resolveBattle(cbA, cbB, aLevel, bLevel) {
    var st = startBattle(cbA, cbB, aLevel, bLevel), full = [];
    while (!st.over) {
      resolveRound(st, aiPick(st.a, st.b, st.rng));
      full = full.concat(st.log);
    }
    return { winner: st.winner, winnerName: (st.winner === "a" ? st.a : st.b).name,
      draw: st.draw, rounds: st.round, log: full,
      aHp: st.a.hp, bHp: st.b.hp, aName: st.a.name, bName: st.b.name };
  }

  var _api = { buildFighter: buildFighter, startBattle: startBattle,
    playerRound: playerRound, resolveBattle: resolveBattle,
    CLASS_MOVES: CLASS_MOVES };
  if (typeof module !== "undefined" && module.exports) module.exports = _api;
  if (typeof window !== "undefined") { window.BATTLE_ENGINE = _api; }
})();
