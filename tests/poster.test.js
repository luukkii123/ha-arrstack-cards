"use strict";

// Poster and logo fallback without inline handlers (#1276, M47, S7.1).
// A failed poster or service logo must reveal the placeholder right after it,
// exactly as the former inline `onerror` did, but through addEventListener.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const kit = require("./_testkit.cjs");

const BUNDLE = path.join(__dirname, "..", "dist", "arrstack-cards.js");

function load() {
  const env = kit.createEnvironment({ language: "de-DE" });
  const { exposed } = kit.loadScript(BUNDLE, { globals: env, expose: ["posterMarkup", "serviceSymbol"] });
  return { env, ...exposed, bind: env.bindImageFallbacks };
}

/** Builds `<img class=…><placeholder hidden>` inside a shadow root, as the markup does. */
function pair(env, imgClass, fallbackTag, fallbackClass) {
  const host = env.document.createElement("div");
  const root = host.attachShadow({ mode: "open" });
  const img = env.document.createElement("img");
  img.className = imgClass;
  const fallback = env.document.createElement(fallbackTag);
  fallback.className = fallbackClass;
  fallback.hidden = true;
  root.append(img, fallback);
  return { root, img, fallback };
}

test("poster and logo markup carry no inline event handler", () => {
  const { posterMarkup, serviceSymbol } = load();
  for (const html of [
    posterMarkup("https://image.tmdb.org/t/p/w300/a.jpg", "sonarr", "download"),
    posterMarkup("https://image.tmdb.org/t/p/w300/a.jpg"),
    posterMarkup(null, "radarr"),
    serviceSymbol("sonarr", "download", 24),
  ]) {
    assert.ok(!/onerror\s*=/i.test(html), html);
    assert.deepEqual(kit.activeMarkup(html).filter((found) => found.includes("[")), [], html);
  }
});

test("poster markup keeps the hidden placeholder right after the image", () => {
  const { posterMarkup } = load();
  const html = posterMarkup("https://image.tmdb.org/t/p/w300/a.jpg", "sonarr");
  assert.match(html, /<img class="poster" src="https:\/\/image\.tmdb\.org\/t\/p\/w300\/a\.jpg" alt="" loading="lazy"><div class="poster poster-fallback" hidden>/);
});

test("an error event on a poster reveals the placeholder and removes the image", () => {
  const { env, bind } = load();
  assert.equal(typeof bind, "function", "bindImageFallbacks exists");
  const { root, img, fallback } = pair(env, "poster", "div", "poster poster-fallback");
  bind(root);
  assert.equal(fallback.hidden, true, "placeholder stays hidden while the image may load");
  img.dispatchEvent(new env.Event("error"));
  assert.equal(fallback.hidden, false, "placeholder visible");
  assert.equal(img.parentNode, null, "broken image removed");
});

test("an error event on a service logo reveals its symbol", () => {
  const { env, bind } = load();
  const { root, img, fallback } = pair(env, "logo", "span", "");
  bind(root);
  img.dispatchEvent(new env.Event("error"));
  assert.equal(fallback.hidden, false);
  assert.equal(img.parentNode, null);
});

test("binding twice keeps one error listener per image", () => {
  const { env, bind } = load();
  const { root, img } = pair(env, "poster", "div", "poster poster-fallback");
  bind(root);
  bind(root);
  assert.equal((img.listeners.error || []).length, 1);
});

test("every card binds the fallbacks after inserting its markup", () => {
  const { env } = load();
  const bound = [];
  env.bindImageFallbacks = (root) => bound.push(root);
  const hass = { locale: { language: "de" }, callWS: () => new Promise(() => {}) };
  for (const tag of ["arrstack-downloads-card", "arrstack-recent-card", "arrstack-fix-card", "arrstack-seer-card"]) {
    const card = new (env.customElements.get(tag))();
    card._hass = hass;
    card._config = { ...card._defaults() };
    bound.length = 0;
    card._render();
    assert.ok(bound.includes(card.shadowRoot), `${tag} binds its shadow root`);
  }
});
