"use strict";

// M73 (#1324): the file head lists every card of the bundle. The list is
// compared with the `window.customCards` entries the bundle registers, so a
// new card without a head entry turns this test red.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const BUNDLE = path.join(__dirname, "..", "dist", "arrstack-cards.js");
const SOURCE = fs.readFileSync(BUNDLE, "utf8");

/** The first doc comment after the synced Shared UI block: the file head. */
function head(source) {
  const own = source.slice(source.indexOf("/* END BUSCH SHARED UI */"));
  return (own.match(/\/\*\*[\s\S]*?\*\//) || [""])[0];
}

/** Card types named in the head list (` *  - `type` …`). */
function headCards(source) {
  return [...head(source).matchAll(/^ \*\s+- `([a-z0-9-]+)`/gm)].map((m) => m[1]);
}

function registeredCards(source) {
  const elements = new Map();
  class Element { addEventListener() {} appendChild() {} attachShadow() { return new Element(); } }
  const context = {
    HTMLElement: Element,
    customElements: { define: (name, type) => elements.set(name, type), get: (name) => elements.get(name) },
    document: { createElement: () => new Element() },
    window: {}, navigator: { language: "en-US" }, console: { info() {} },
    CustomEvent: class { constructor(type, options) { Object.assign(this, { type }, options); } },
  };
  vm.runInNewContext(source, context);
  // Array.from: the entries live in the vm realm, deepEqual compares prototypes.
  return Array.from(context.window.customCards, (entry) => entry.type);
}

/** Differences between head list and registry, empty when both agree. */
function mismatch(source) {
  const listed = headCards(source), registered = registeredCards(source);
  return {
    missing: registered.filter((type) => !listed.includes(type)),
    stale: listed.filter((type) => !registered.includes(type)),
    duplicate: listed.filter((type, i) => listed.indexOf(type) !== i),
  };
}

test("M73: the file head lists exactly the cards in window.customCards", () => {
  assert.ok(headCards(SOURCE).length > 0, "the head carries a card list");
  assert.deepEqual(mismatch(SOURCE), { missing: [], stale: [], duplicate: [] });
});

test("M73: a new card without a head entry is reported as missing", () => {
  const extra = `\nBuschUI.register("arrstack-new-card", class extends HTMLElement {}, {
    type: "arrstack-new-card", name: "arrstack New", description: "Shows nothing.", preview: false });\n`;
  assert.deepEqual(mismatch(SOURCE + extra).missing, ["arrstack-new-card"]);
});

test("M73: the head no longer carries the text copied from busch-cards", () => {
  const text = head(SOURCE);
  assert.ok(!/Neue Karte hinzufügen/.test(text), "copied paragraph removed");
  assert.match(text, /BuschUI\.register/, "the head names how a card is registered");
});
