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
  var SCRAP_RATE_MS = 8 * 60 * 1000; // each held cell yields 1 scrap / 8 min
  var BREED_COST = 6;                // scrap to breed two bugs
  var SAVE_KEY = "litterbug_vault_v1";
  var RAID_INTERVAL_MS = 30 * 60 * 1000; // rivals raid held cells ~ every 30 min
  var MAX_RAIDS_PER_TICK = 3;            // never lose everything in one absence
  var RIVAL_NAMES = ["the Skip Kings", "the Gutter Syndicate", "the Drain Court",
    "the Rag Pickers", "the Ash Wardens", "the Bottle Barons"];

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
    return { v: 1, bugs: [], claims: {}, rivalClaims: {}, energy: ENERGY_MAX,
      energyMax: ENERGY_MAX, lastEnergyTs: 0, scrap: 0, lastScrapTs: 0, lastTickTs: 0 };
  }
  // Fill in fields missing from an older save so upgrades never crash.
  function migrate(v) {
    if (!v.bugs) v.bugs = [];
    if (!v.claims) v.claims = {};
    if (!v.rivalClaims) v.rivalClaims = {};
    if (v.energy == null) v.energy = ENERGY_MAX;
    if (v.energyMax == null) v.energyMax = ENERGY_MAX;
    if (v.lastEnergyTs == null) v.lastEnergyTs = 0;
    if (v.scrap == null) v.scrap = 0;
    if (v.lastScrapTs == null) v.lastScrapTs = 0;
    if (v.lastTickTs == null) v.lastTickTs = 0;
    return v;
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
    if (vault.rivalClaims && vault.rivalClaims[k]) {
      var rc = vault.rivalClaims[k];
      return { type: "rival", key: k, cb: rc.defenderCb, level: rc.defenderLevel, owner: rc.owner };
    }
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

  // Attacking a wild-held cell is split so the fight can be run EITHER
  // auto (attackCell) OR interactively (beginAttack -> play the arena ->
  // applyAttackResult). beginAttack validates + spends energy; applyAttackResult
  // grants XP and, on a win, claims the cell (the bug relocates to defend it).
  function beginAttack(vault, ix, iy, attackerCb, now) {
    var st = cellState(vault, ix, iy);
    if (st.type === "empty") return { ok: false, reason: "nothing to attack" };
    if (st.type === "yours") return { ok: false, reason: "you already hold this" };
    var e = findBug(vault, attackerCb);
    if (!e) return { ok: false, reason: "not your bug" };
    if (!spendEnergy(vault, now, ATTACK_COST)) return { ok: false, reason: "not enough energy" };
    return { ok: true, defenderCb: st.cb, defenderLevel: st.level,
      attackerLevel: e.level, key: key(ix, iy) };
  }
  function applyAttackResult(vault, ix, iy, attackerCb, won, defLevel, now) {
    var e = findBug(vault, attackerCb);
    if (!e) return { ok: false, reason: "not your bug" };
    var xp = won ? winXp(defLevel) : Math.round(winXp(defLevel) * 0.25);
    var levelsGained = gainXp(e, xp);
    if (won) {
      e.wins++;
      if (vault.rivalClaims) delete vault.rivalClaims[key(ix, iy)]; // reclaimed from a rival
      var dep = deployedMap(vault)[attackerCb];        // relocate if it was defending elsewhere
      if (dep) delete vault.claims[dep];
      vault.claims[key(ix, iy)] = { defenderCb: attackerCb, defenderLevel: e.level, claimedAt: now };
    }
    return { ok: true, won: won, xp: xp, levelsGained: levelsGained, newLevel: e.level, key: key(ix, iy) };
  }
  // Auto-resolve convenience (draws favor the defender). Used by tests + the
  // "quick fight" path.
  function attackCell(vault, ix, iy, attackerCb, now) {
    var b = beginAttack(vault, ix, iy, attackerCb, now);
    if (!b.ok) return b;
    var res = BAT.resolveBattle(attackerCb, b.defenderCb, b.attackerLevel, b.defenderLevel);
    var won = res.winner === "a" && !res.draw;
    var r = applyAttackResult(vault, ix, iy, attackerCb, won, b.defenderLevel, now);
    r.battle = res; r.draw = res.draw;
    return r;
  }

  function summary(vault) {
    return { territory: Object.keys(vault.claims).length, roster: vault.bugs.length,
      scrap: vault.scrap || 0, rival: Object.keys(vault.rivalClaims || {}).length };
  }

  // ── Rival raids (single-player async-PvP prototype) ─────────────────
  // While you are away, rival factions attack your held cells. A raid pits
  // your FROZEN defender snapshot against a rival bug (deterministic, scaled
  // to the cell's region). Lose and the cell flips to the rival, who now
  // defends it; you can go take it back. Home (0,0) is never raided.
  function rivalChallenger(ix, iy, tickN) {
    var kk = key(ix, iy) + ":" + tickN;
    var cb = hexFromRng(ENG.seededRng(WORLD_SALT + ":raid:" + kk), 64);
    var r = ENG.seededRng(WORLD_SALT + ":raidmeta:" + kk);
    var lvl = Math.min(LEVEL_CAP, wildLevel(ix, iy) + Math.floor(r() * 3)); // region + 0..2 edge
    return { cb: cb, level: lvl, name: RIVAL_NAMES[Math.floor(r() * RIVAL_NAMES.length)] };
  }
  function worldTick(vault, now) {
    var last = vault.lastTickTs || 0;
    var elapsed = Math.floor((now - last) / RAID_INTERVAL_MS);
    if (elapsed < 1) return { raids: [], defended: 0, lost: 0 };
    var targets = Object.keys(vault.claims).filter(function (k) { return k !== "0,0"; });
    var nRaids = Math.min(elapsed, MAX_RAIDS_PER_TICK, targets.length);
    var baseTick = Math.floor(last / RAID_INTERVAL_MS), raids = [];
    for (var i = 0; i < nRaids; i++) {
      var k = targets[i], c = vault.claims[k], xy = parseKey(k);
      var ch = rivalChallenger(xy[0], xy[1], baseTick + i);
      var res = BAT.resolveBattle(c.defenderCb, ch.cb, c.defenderLevel, ch.level);
      var held = res.winner === "a" && !res.draw;   // your defender is side A
      if (!held) {
        delete vault.claims[k];
        vault.rivalClaims[k] = { defenderCb: ch.cb, defenderLevel: ch.level, owner: ch.name, since: now };
      }
      raids.push({ key: k, ix: xy[0], iy: xy[1], rival: ch.name, level: ch.level, defended: held });
    }
    vault.lastTickTs = last + elapsed * RAID_INTERVAL_MS;   // keep the remainder
    var lost = raids.filter(function (r) { return !r.defended; }).length;
    return { raids: raids, defended: raids.length - lost, lost: lost };
  }

  // ── Territory rewards (scrap) ───────────────────────────────────────
  // Each held cell yields scrap over time; scrap is spent on breeding.
  // Holding more territory earns faster, so it is worth fighting for.
  function pendingScrap(vault, now) {
    var iv = Math.floor((now - (vault.lastScrapTs || 0)) / SCRAP_RATE_MS);
    return Math.max(0, iv) * Object.keys(vault.claims).length;
  }
  function collectScrap(vault, now) {
    var iv = Math.floor((now - (vault.lastScrapTs || 0)) / SCRAP_RATE_MS);
    if (iv < 1) return 0;
    var gain = iv * Object.keys(vault.claims).length;
    vault.scrap = (vault.scrap || 0) + gain;
    vault.lastScrapTs = (vault.lastScrapTs || 0) + iv * SCRAP_RATE_MS; // keep the remainder
    return gain;
  }

  // ── Breeding: spend scrap to make a child from two owned parents ────
  function breedBugs(vault, cbA, cbB, now) {
    if (!findBug(vault, cbA) || !findBug(vault, cbB)) return { ok: false, reason: "need two of your bugs" };
    if (cbA === cbB) return { ok: false, reason: "pick two different bugs" };
    collectScrap(vault, now); // bank pending scrap first
    if ((vault.scrap || 0) < BREED_COST) return { ok: false, reason: "need " + BREED_COST + " scrap" };
    var child = ENG.breed(cbA, cbB);
    if (findBug(vault, child)) return { ok: false, reason: "that pairing already made a bug" };
    vault.scrap -= BREED_COST;
    addBug(vault, child);
    return { ok: true, childCb: child };
  }

  // ── Browser persistence (localStorage). No-ops under Node. ─────────
  function browserSave(vault) {
    try { if (typeof localStorage !== "undefined") localStorage.setItem(SAVE_KEY, JSON.stringify(vault)); } catch (e) {}
  }
  function nowMs() { return (typeof Date !== "undefined" && Date.now) ? Date.now() : 0; }
  function browserLoad() {
    var v = null;
    try {
      if (typeof localStorage !== "undefined") {
        var raw = localStorage.getItem(SAVE_KEY);
        if (raw) v = migrate(JSON.parse(raw));
      }
    } catch (e) {}
    if (!v) v = seedStarter(newVault());
    // A fresh/old save has ts 0; stamp to NOW so scrap/energy don't pay out
    // retroactively for all of epoch time on first load.
    var t = nowMs();
    if (!v.lastScrapTs) v.lastScrapTs = t;
    if (!v.lastEnergyTs) v.lastEnergyTs = t;
    if (!v.lastTickTs) v.lastTickTs = t;
    browserSave(v); return v;
  }

  var _api = {
    WORLD_SALT: WORLD_SALT, ENERGY_MAX: ENERGY_MAX, PLACE_COST: PLACE_COST,
    ATTACK_COST: ATTACK_COST, LEVEL_CAP: LEVEL_CAP, REGEN_MS: REGEN_MS,
    SCRAP_RATE_MS: SCRAP_RATE_MS, BREED_COST: BREED_COST, SAVE_KEY: SAVE_KEY,
    key: key, parseKey: parseKey,
    newVault: newVault, seedStarter: seedStarter, migrate: migrate,
    findBug: findBug, addBug: addBug,
    energyNow: energyNow, spendEnergy: spendEnergy, msToNextEnergy: msToNextEnergy,
    deployedMap: deployedMap, cellState: cellState,
    isWild: isWild, wildCodeblock: wildCodeblock, wildLevel: wildLevel,
    xpToNext: xpToNext, gainXp: gainXp, winXp: winXp, leveledStats: leveledStats,
    placeBug: placeBug, attackCell: attackCell,
    beginAttack: beginAttack, applyAttackResult: applyAttackResult, summary: summary,
    worldTick: worldTick, rivalChallenger: rivalChallenger, RAID_INTERVAL_MS: RAID_INTERVAL_MS,
    pendingScrap: pendingScrap, collectScrap: collectScrap, breedBugs: breedBugs,
    browserSave: browserSave, browserLoad: browserLoad
  };
  if (isNode) module.exports = _api;
  if (typeof window !== "undefined") window.WORLD_ENGINE = _api;
})();
