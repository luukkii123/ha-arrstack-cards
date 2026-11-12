"use strict";

// #1011 Kartenwähler: keine Live-Vorschau, ein Satz Beschreibung, Vorgaben ohne hass-Zugriff.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function lade(sprache) {
  const elements = new Map();
  class Element { addEventListener() {} appendChild() {} attachShadow() { return new Element(); } }
  const context = {
    HTMLElement: Element,
    customElements: { define: (name, type) => elements.set(name, type), get: (name) => elements.get(name) },
    document: { createElement: () => new Element() },
    window: {}, navigator: { language: sprache }, console: { info() {} },
    CustomEvent: class { constructor(type, options) { Object.assign(this, { type }, options); } },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/arrstack-cards.js"), "utf8"), context);
  return { elements, karten: context.window.customCards };
}

test("jeder Kartenwähler-Eintrag: preview false, Name „arrstack …“ und ein Satz Beschreibung (de und en)", () => {
  for (const sprache of ["de-DE", "en-US"]) {
    const { karten } = lade(sprache);
    assert.equal(karten.length, 4);
    for (const e of karten) {
      assert.equal(e.preview, false, `${e.type}: preview`);
      assert.match(e.name, /^arrstack \S/, `${e.type}: Name ${e.name}`);
      assert.match(e.description, /^[A-ZÄÖÜ].*[^.]\.$/, `${e.type}: ein Satz mit Punkt: ${e.description}`);
      assert.ok(!/[.!?] /.test(e.description), `${e.type}: genau ein Satz: ${e.description}`);
      assert.ok(!/—/.test(e.description), `${e.type}: kein Gedankenstrich-Fragment`);
    }
  }
});

test("getStubConfig liest hass nicht (kein Durchlauf, kein Netz)", () => {
  const { elements, karten } = lade("de-DE");
  const hass = new Proxy({}, { get(_t, k) { throw new Error("hass." + String(k) + " gelesen"); } });
  for (const { type } of karten) {
    const stub = elements.get(type).getStubConfig(hass);
    assert.equal(stub.type, "custom:" + type);
  }
});
