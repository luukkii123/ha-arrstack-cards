"use strict";

// M26 rest finding of image review H (31-render/alle-320-light.png): the X that
// clears the Seerr search field was Chromium's native cancel glyph, white on the
// light grey field. It is now drawn by the card in its secondary text colour and
// must reach 3:1 (non-text control, WCAG 1.4.11) in light and dark.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SOURCE = fs.readFileSync(path.join(__dirname, "..", "dist", "arrstack-cards.js"), "utf8");
const OWN = SOURCE.slice(SOURCE.indexOf("/* END BUSCH SHARED UI */"));
const RENDER = fs.readFileSync(path.join(__dirname, "..", "docs", "render", "render.py"), "utf8");

const hex = (value) => value.replace("#", "").padEnd(6, value.slice(-1)).match(/../g).map((part) => parseInt(part, 16));
const luminance = (rgb) => {
  const [r, g, b] = rgb.map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

/** One CSS variable of a theme block of docs/render/render.py. */
function themeValue(theme, name) {
  const block = theme === "light"
    ? (RENDER.match(/:root, :root\[data-theme="light"\] \{([^}]*)\}/) || [])[1]
    : (RENDER.match(/:root\[data-theme="dark"\] \{([^}]*)\}/) || [])[1];
  const value = (String(block).match(new RegExp(`${name}:\\s*(#[0-9a-f]{3,6})`)) || [])[1];
  assert.ok(value, `${theme} ${name} in render.py`);
  return value;
}

/** A custom property of the card stylesheet with its hex fallback. */
function cardToken(name) {
  const m = OWN.match(new RegExp(`${name}:\\s*var\\((--[a-z-]+),\\s*([^;]+)\\);`));
  assert.ok(m, `${name} defined`);
  return { haVar: m[1], fallback: m[2].trim() };
}

const cancelRule = () =>
  (OWN.match(/\.search input::-webkit-search-cancel-button\s*\{([^}]*)\}/) || [])[1] || "";

test("Seerr search: the native cancel glyph is replaced by the card's own X", () => {
  const rule = cancelRule();
  assert.ok(rule, "a rule for ::-webkit-search-cancel-button exists");
  assert.match(rule, /-webkit-appearance:\s*none/, "native glyph off");
  assert.match(rule, /background-color:\s*var\(--arr-muted\)/, "drawn in the secondary text colour");
  assert.match(rule, /-webkit-mask:\s*url\("data:image\/svg\+xml,[^"]+"\)/, "X shape as mask (WebKit/Blink)");
  assert.match(rule, /(?:^|[;\s])mask:\s*url\("data:image\/svg\+xml,[^"]+"\)/, "X shape as mask (standard)");
  assert.ok(!/#[0-9a-f]{3,6}\b/i.test(rule.replace(/url\("[^"]*"\)/g, "")), "no hex colour outside the mask");
  const size = Number((rule.match(/width:\s*(\d+)px/) || [])[1]);
  assert.ok(size >= 16, `X at least 16 px (${size})`);
  assert.match(rule, /cursor:\s*pointer/);
});

test("Seerr search: the X reaches 3:1 against the field in light and dark", () => {
  // Field: --arr-surface (HA --secondary-background-color); X: --arr-muted (HA --secondary-text-color).
  assert.equal(cardToken("--arr-surface").haVar, "--secondary-background-color");
  assert.equal(cardToken("--arr-muted").haVar, "--secondary-text-color");
  assert.match(OWN, /\.search input \{[^}]*background:\s*var\(--arr-surface\)/, "field paints --arr-surface");
  for (const theme of ["light", "dark"]) {
    const ratio = contrast(hex(themeValue(theme, "--secondary-text-color")), hex(themeValue(theme, "--secondary-background-color")));
    assert.ok(ratio >= 3, `${theme}: ${ratio.toFixed(2)}:1`);
  }
  // Without an HA theme: fallback grey on the translucent surface over a white card.
  const surface = Math.round(255 - 0.12 * (255 - 127));
  const ratio = contrast(hex(cardToken("--arr-muted").fallback), [surface, surface, surface]);
  assert.ok(ratio >= 3, `fallback: ${ratio.toFixed(2)}:1`);
});

test("Seerr search: the render script measures the X contrast and fails below 3:1", () => {
  assert.match(RENDER, /::-webkit-search-cancel-button/, "render.py reads the pseudo element");
  assert.match(RENDER, /"suchfeld_x": suchfeld_x/, "result in report.json");
  assert.match(RENDER, /for breite, befund in suchfeld_x\.items\(\):[\s\S]*?schlecht = 1/, "a violation fails the run");
});
