#!/usr/bin/env node
/* bake-og.js — bake og/card.png (1200x630) and og/icon-512.png from the REAL
   renderer, so link previews and installs show actual game output instead of
   a grey box (the 80-of-83-satellites lesson). Deterministic: fixed
   codeblocks, no Date/random. Rerun after any renderer look change. */
var fs = require("fs");
var path = require("path");
var sharp = require("sharp");
var E = require("../bug-engine.js");

var ROOT = path.join(__dirname, "..");
var OUT = path.join(ROOT, "og");
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

/* fixed specimens, chosen for silhouette variety (hex chars only) */
var CBS = [
  "a3c1f08e5d92467b0e1f4a6c8d92b35e7f01c4a6d8e2b95f13a7c50e9d24b861",
  "5e92c7a1048f6d3b9c25e8f1a47d0b63e92c58a1f47b0d36c81e5a92f47d0b3c",
  "c80f3a65d17e92b4f60a3c85d29e17b4f80c3a65d92e17b4a60f3c85d29e07b1"
];

function svgToPng(svg, w, h) {
  return sharp(Buffer.from(svg)).resize(w, h).png().toBuffer();
}

(async function () {
  /* ---- card.png: three bugs on the urban nocturne, title plate ---- */
  var W = 1200, H = 630;
  var bg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '">' +
    '<defs><radialGradient id="g" cx="50%" cy="18%" r="90%">' +
    '<stop offset="0%" stop-color="#1c2418"/><stop offset="60%" stop-color="#0f130d"/>' +
    '<stop offset="100%" stop-color="#080a07"/></radialGradient></defs>' +
    '<rect width="100%" height="100%" fill="url(#g)"/>' +
    '<circle cx="600" cy="96" r="46" fill="#f5e9c8" opacity="0.85"/>' +
    '<circle cx="600" cy="96" r="72" fill="#f5e9c8" opacity="0.12"/>' +
    '<text x="600" y="536" text-anchor="middle" font-family="Arial, sans-serif" font-size="86" font-weight="800" fill="#e8dcc8" letter-spacing="6">LITTER BUG</text>' +
    '<text x="600" y="588" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#9aa385">bugs made of trash. one of one, minted by play.</text>' +
    '</svg>';
  var layers = [];
  for (var i = 0; i < CBS.length; i++) {
    var svg = E._generateBugSVG(CBS[i], 300);
    layers.push({ input: await svgToPng(svg, 300, 300), left: 150 + i * 300, top: 130 });
  }
  await sharp(Buffer.from(bg)).composite(layers).png().toFile(path.join(OUT, "card.png"));

  /* ---- icon-512.png: one bug, tight crop, dark plate ---- */
  var ibg = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">' +
    '<rect width="512" height="512" rx="96" fill="#12160f"/>' +
    '<rect x="8" y="8" width="496" height="496" rx="88" fill="none" stroke="#3a4430" stroke-width="6"/></svg>';
  /* the renderer leaves generous canvas margin, so rasterize big and crop the
     center — otherwise the bug is a speck on the plate (thumb-fills-button law) */
  var iconBig = await svgToPng(E._generateBugSVG(CBS[0], 1100), 1100, 1100);
  var iconBug = await sharp(iconBig).extract({ left: 260, top: 260, width: 580, height: 580 }).resize(430, 430).png().toBuffer();
  await sharp(Buffer.from(ibg)).composite([{ input: iconBug, left: 41, top: 41 }]).png().toFile(path.join(OUT, "icon-512.png"));

  var c = fs.statSync(path.join(OUT, "card.png")).size;
  var ic = fs.statSync(path.join(OUT, "icon-512.png")).size;
  console.log("baked og/card.png " + c + "b, og/icon-512.png " + ic + "b");
  if (c < 20000 || ic < 5000) { console.error("bake looks empty, inspect before committing"); process.exit(1); }
})().catch(function (e) { console.error(e); process.exit(1); });
