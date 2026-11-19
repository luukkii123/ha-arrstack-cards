"use strict";

// M79 (#1320, user decision 19.11.): coloured symbols are non-text graphics (WCAG 1.4.11) and reach 3:1 on the
// surface they sit on, light and dark, also next to a text. Computed from the declared CSS with the theme values of
// docs/render/render.py (primary #1c76be) and HA's default primary #03a9f4 (the card's fallback), same formula as
// hacs/scripts/kontrast_touch.py.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SOURCE = fs.readFileSync(path.join(__dirname, "..", "dist", "arrstack-cards.js"), "utf8");
const OWN = SOURCE.slice(SOURCE.indexOf("/* END BUSCH SHARED UI */")).replace(/\/\*[\s\S]*?\*\//g, "");

const LIGHT = { "primary-color": "#1c76be", "primary-text-color": "#212121", "secondary-text-color": "#727272", "card-background-color": "#ffffff",
  "secondary-background-color": "#e5e5e5", "warning-color": "#ffa600", "error-color": "#db4437" };
const DARK = { ...LIGHT, "primary-text-color": "#e1e1e1", "secondary-text-color": "#9b9b9b", "card-background-color": "#1c1c1c", "secondary-background-color": "#202020" };
const THEMEN = { light: LIGHT, dark: DARK, "light HA blue": { ...LIGHT, "primary-color": "#03a9f4" }, "dark HA blue": { ...DARK, "primary-color": "#03a9f4" } };

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** A card custom property (`--arr-x: value;`). */
const token = (name) => (OWN.match(new RegExp(name + ":\\s*([^;]+);")) || [])[1];
function farbe(wert, t) {
  wert = wert.trim(); let m;
  if (/^#[0-9a-f]{6}$/i.test(wert)) return hex(wert);
  if ((m = wert.match(/^var\(--([\w-]+)(?:,\s*([\s\S]*))?\)$/))) {
    if (t[m[1]]) return hex(t[m[1]]);
    const def = token("--" + m[1]); if (def) return farbe(def, t);
    assert.ok(m[2], "unknown token --" + m[1]); return farbe(m[2], t);
  }
  if ((m = wert.match(/^color-mix\(in srgb,\s*(var\((?:[^()]|\([^()]*\))*\))\s+(\d+)%,\s*(var\((?:[^()]|\([^()]*\))*\))\)$/))) {
    const a = farbe(m[1], t), b = farbe(m[3], t), p = Number(m[2]) / 100; return a.map((v, i) => v * p + b[i] * (1 - p));
  }
  throw new Error("colour not understood: " + wert);
}
const lum = (c) => { const l = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; };
const quote = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
/** First rule of `sel` in the card CSS (after the shared block). */
function regel(sel) {
  const m = OWN.match(new RegExp("(?:^|[\\n}])\\s*" + sel.replace(/[.()[\]]/g, "\\$&") + "\\s*\\{([^}]*)\\}"));
  assert.ok(m, "rule " + sel); return m[1];
}
const wert = (block, prop) => (block.match(new RegExp("(?:^|[;{\\s])" + prop + ":\\s*([^;]+);")) || [])[1];

test("M79 coloured symbols reach 3:1 on their surface (head media, title icon, warning thumb)", () => {
  const faelle = [
    [".head-media", "background"],
    [".head-title .icon", "card"],
    [".thumb.warn", ".thumb"],
  ];
  const all = [], low = [];
  for (const [sel, grund] of faelle) for (const [name, t] of Object.entries(THEMEN)) {
    const bg = grund === "card" ? hex(t["card-background-color"]) : farbe(wert(regel(grund === "background" ? sel : grund), "background"), t);
    const q = quote(farbe(wert(regel(sel), "color"), t), bg);
    all.push(`${sel} ${name}: ${q.toFixed(2)}:1`);
    if (q < 3) low.push(all.at(-1));
  }
  assert.equal(all.length, 12);
  assert.deepEqual(low, []);
});

// #1320 (Etappe I, Kontrast-Rest, user decision: no exception for graphics): the progress fill carries the amount and
// reaches 3:1 against the card and against its own track; the checked import checkbox (accent colour) reaches 3:1 on
// the card (WCAG 1.4.11). Same themes as above, HA blue included.
test("#1320 progress fill and checkbox accent reach 3:1 (card, track), light and dark, Arrstack and HA blue", () => {
  const all = [], low = [];
  for (const [name, t] of Object.entries(THEMEN)) {
    const karte = hex(t["card-background-color"]), spur = farbe(wert(regel(".bar"), "background"), t);
    const faelle = [
      ["bar fill/card", wert(regel(".bar > i"), "background"), karte],
      ["bar fill/track", wert(regel(".bar > i"), "background"), spur],
      ["checkbox/card", wert(regel("input[type=checkbox], input[type=radio]"), "accent-color"), karte],
    ];
    for (const [art, fg, bg] of faelle) {
      const q = quote(farbe(fg, t), bg); all.push(`${art} ${name}: ${q.toFixed(2)}:1`); if (q < 3) low.push(all.at(-1));
    }
  }
  assert.equal(all.length, 12);
  assert.deepEqual(low, []);
});
