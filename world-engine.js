// world-engine.js — Litter Bug territory + progression (P3/P4/P5).
//
// The world is a grid of cells. Each cell is either EMPTY, held by a WILD
// bug (procedurally placed, deterministic from the cell coords, so the world
// is populated with no server), or YOURS (claimed, with a frozen defender).
// You place bugs to claim empty cells and attack wild-held cells; winning the
// turn-based battle takes the cell. Bugs gain XP and level from wins.
//
// Pure + deterministic: state lives in a `vault` object passed in, and time
// is passed as `now`, so everything is Node-testable. The browser layer owns
// localStorage + Date.now(). Depends on bug-engine + battle-engine.
;(function () {
  "use strict";
  var isNode = (typeof module !== "undefined" && module.exports);
  var ENG = isNode ? require("./bug-engine.js") : (typeof window !== "undefined" ? window.BUG_ENGINE : null);
  var BAT = isNode ? require("./battle-engine.js") : (typeof window !== "undefined" ? window.BATTLE_ENGINE : null);

  var WORLD_SALT = "litterbug-world-v1";
  var WILD_DENSITY = 0.42;      // fraction of non-home cells holding a wild bug
  var ENERGY_MAX = 10;
  var REGEN_MS = 5 * 60 * 1000; // 1 energy per 5 minutes
  var PLACE_COST = 1, ATTACK_COST = 1;
  var LEVEL_STEP = 0.08;        // must match battle-engine
  var LEVEL_CAP = 30;

  function key(ix, iy) { return ix + "," + iy; }
  function parseKey(k) { var p = k.split(","); return [parseInt(p[0], 10), parseInt(p[1], 10)]; }
  function hexFromRng(rng, len) {
    var s = "", c = "0123456789abcdef";
    for (var i = 0; i < len; i++) s += c[Math.floor(rng() * 16)];
    return s;
  }

  // ── Procedural wild world (deterministic from coords) ───────────────
  function isWild(ix, iy) {
    if (ix === 0 && iy === 0) return false; // home is always safe/empty
    return ENG.seededRng(WORLD_SALT + ":occ:" + key(ix, iy))() < WILD_DENSITY;
  }
  function wildCodeblock(ix, iy) {
    return hexFromRng(ENG.seededRng(WORLD_SALT + ":bug:" + key(ix, iy)), 64);
  }
  function wildLevel(ix, iy) {
    var ring = Math.max(Math.abs(ix), Math.abs(iy));
    var r = ENG.seededRng(WORLD_SALT + ":lvl:" + key(ix, iy));
    var lvl = 1 + Math.floor(ring / 1.5) + Math.floor(r() * 3); // farther = stronger
    return Math.min(LEVEL_CAP, Math.max(1, lvl));
  }

  // ── Vault (save state) ──────────────────────────────────────────────
  function newVault() {
    return { v: 1, bugs: [], claims: {}, energy: ENERGY_MAX,
      energyMax: ENERGY_MAX, lastEnergyTs: 0 };
  }
  function findBug(vault, cb) {
    for (var i = 0; i < vault.bugs.length; i++) if (vault.bugs[i].cb === cb) return vault.bugs[i];
    return null;
  }
  function addBug(vault, cb) {
    if (findBug(vault, cb)) return findBug(vault, cb);
    var e = { cb: cb, level: 1, xp: 0, wins: 0 };
    vault.bugs.push(e); return e;
  }
  // Give a fresh player a home cell + a small starter roster.
  function seedStarter(vault) {
    for (var i = 0; i < 3; i++) {
      var cb = hexFromRng(ENG.seededRng(WORLD_SALT + ":starter:" + i), 64);
      addBug(vault, cb);
      if (i === 0) vault.claims[key(0, 0)] = { defenderCb: cb, defenderLevel: 1, claimedAt: 0 };
    }
    return vault;
  }

  // ── Energy ──────────────────────────────────────────────────────────
  function energyNow(vault, now) {
    var regen = Math.floor((now - (vault.lastEnergyTs || 0)) / REGEN_MS);
    return Math.min(vault.energyMax, vault.energy + Math.max(0, regen));
  }
  function spendEnergy(vault, now, cost) {
    var cur = energyNow(vault, now);
    if (cur < cost) return false;
    vault.energy = cur - cost; vault.lastEnergyTs = now; return true;
  }
  function msToNextEnergy(vault, now) {
    if (energyNow(vault, now) >= vault.energyMax) return 0;
    var since = (now - (vault.lastEnergyTs || 0)) % REGEN_MS;
    return REGEN_MS - since;
  }

  // which cell (if any) each of your bugs is currently defending
  function deployedMap(vault) {
    var m = {};
    for (var k in vault.claims) m[vault.claims[k].defenderCb] = k;
    return m;
  }

  // ── Cell state ──────────────────────────────────────────────────────
  function cellState(vault, ix, iy) {
    var k = key(ix, iy);
    if (vault.claims[k]) return { type: "yours", key: k, cb: vault.claims[k].defenderCb, level: vault.claims[k].defenderLevel };
    if (isWild(ix, iy)) return { type: "wild", key: k, cb: wildCodeblock(ix, iy), level: wildLevel(ix, iy) };
    return { type: "empty", key: k };
  }

  // ── Leveling ────────────────────────────────────────────────────────
  function xpToNext(level) { return 18 + level * 12; }
  function gainXp(entry, amount) {
    entry.xp += amount; var gained = 0;
    while (entry.level < LEVEL_CAP && entry.xp >= xpToNext(entry.level)) {
      entry.xp -= xpToNext(entry.level); entry.level++; gained++;
    }
    return gained;
  }
  function winXp(defLevel) { return 14 + defLevel * 7; }
  function leveledStats(cb, level) {
    var s = ENG.bugStats(cb).stats, f = 1 + LEVEL_STEP * ((level || 1) - 1), o = {};
    for (var k in s) o[k] = Math.round(s[k] * f);
    return o;
  }

  // ── Actions ─────────────────────────────────────────────────────────
  // Place one of your (undeployed) bugs onto an empty, in-range cell.
  function placeBug(vault, ix, iy, bugCb, now) {
    var st = cellState(vault, ix, iy);
    if (st.type !== "empty") return { ok: false, reason: "cell not empty" };
    var e = findBug(vault, bugCb);
    if (!e) return { ok: false, reason: "not your bug" };
    if (deployedMap(vault)[bugCb]) return { ok: false, reason: "bug already deployed" };
    if (!spendEnergy(vault, now, PLACE_COST)) return { ok: false, reason: "not enough energy" };
    vault.claims[key(ix, iy)] = { defenderCb: bugCb, defenderLevel: e.level, claimedAt: now };
    return { ok: true, key: key(ix, iy) };
  }

  // Attack a wild-held cell with one of your bugs. Win => claim it (the bug
  // relocates there as the new defender) + XP. Lose/draw => small XP, no claim.
  function attackCell(vault, ix, iy, attackerCb, now) {
    var st = cellState(vault, ix, iy);
    if (st.type === "empty") return { ok: false, reason: "nothing to attack" };
    if (st.type === "yours") return { ok: false, reason: "you already hold this" };
    var e = findBug(vault, attackerCb);
    if (!e) return { ok: false, reason: "not your bug" };
    if (!spendEnergy(vault, now, ATTACK_COST)) return { ok: false, reason: "not enough energy" };

    var res = BAT.resolveBattle(attackerCb, st.cb, e.level, st.level);
    var won = res.winner === "a" && !res.draw;        // draws favor the defender
    var xp = won ? winXp(st.level) : Math.round(winXp(st.level) * 0.25);
    var levelsGained = gainXp(e, xp);
    if (won) {
      e.wins++;
      var dep = deployedMap(vault)[attackerCb];        // relocate if it was defending elsewhere
      if (dep) delete vault.claims[dep];
      vault.claims[key(ix, iy)] = { defenderCb: attackerCb, defenderLevel: e.level, claimedAt: now };
    }
    return { ok: true, won: won, draw: res.draw, battle: res, xp: xp,
      levelsGained: levelsGained, newLevel: e.level, key: key(ix, iy) };
  }

  function summary(vault) {
    return { territory: Object.keys(vault.claims).length, roster: vault.bugs.length };
  }

  var _api = {
    WORLD_SALT: WORLD_SALT, ENERGY_MAX: ENERGY_MAX, PLACE_COST: PLACE_COST,
    ATTACK_COST: ATTACK_COST, LEVEL_CAP: LEVEL_CAP, REGEN_MS: REGEN_MS,
    key: key, parseKey: parseKey,
    newVault: newVault, seedStarter: seedStarter, findBug: findBug, addBug: addBug,
    energyNow: energyNow, spendEnergy: spendEnergy, msToNextEnergy: msToNextEnergy,
    deployedMap: deployedMap, cellState: cellState,
    isWild: isWild, wildCodeblock: wildCodeblock, wildLevel: wildLevel,
    xpToNext: xpToNext, gainXp: gainXp, winXp: winXp, leveledStats: leveledStats,
    placeBug: placeBug, attackCell: attackCell, summary: summary
  };
  if (isNode) module.exports = _api;
  if (typeof window !== "undefined") window.WORLD_ENGINE = _api;
})();
