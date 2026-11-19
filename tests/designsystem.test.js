"use strict";

// Buschcheck Etappe H (#1314): the cards use the shared design system of
// Shared UI 0.5.0 instead of their own variants (M27, M62, M63, M61, M28, M59,
// M42, M26). Markup comes from the card HTML sinks; the testkit DOM gets a real
// outerHTML so blocks built by BuschUI reach the markup as in the browser.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const kit = require("./_testkit.cjs");
const { installOuterHTML } = require("./_html.cjs");

const BUNDLE = path.join(__dirname, "..", "dist", "arrstack-cards.js");
const SOURCE = fs.readFileSync(BUNDLE, "utf8");
/** The bundle without the synced Shared UI block: what this repo writes itself. */
const OWN = SOURCE.slice(SOURCE.indexOf("/* END BUSCH SHARED UI */"));

function setup() {
  const env = installOuterHTML(kit.createEnvironment({ language: "de-DE" }));
  env.history = { pushState() {}, back() {}, state: null };
  env.window.history = env.history;
  kit.loadScript(BUNDLE, { globals: env });
  env.patchQueueMarkup = (root, markup) => { root.innerHTML = markup; };
  return env;
}

function card(env, kind, config = {}) {
  const el = new (env.customElements.get(`arrstack-${kind}-card`))();
  el._hass = { locale: { language: "de" }, callWS: () => new Promise(() => {}) };
  el._config = { ...el._defaults(), ...config };
  return el;
}

/** Opening tags of every element carrying `className`. */
const tagsWith = (html, className) =>
  [...String(html).matchAll(/<[a-z][\w-]*\b[^>]*>/g)].map((m) => m[0])
    .filter((tag) => new RegExp(`class="(?:[^"]* )?${className}(?: [^"]*)?"`).test(tag));
const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];

/* ── M27: one state block for loading, empty and error ─────────────────── */

const ROLES = { loading: ["status", "polite"], empty: ["status", "polite"], error: ["alert", "assertive"] };

function assertState(html, kind, where) {
  const blocks = tagsWith(html, "busch-state");
  assert.equal(blocks.length, 1, `${where}: one state block, got ${blocks.length}: ${html}`);
  const [role, live] = ROLES[kind];
  assert.equal(attr(blocks[0], "data-kind"), kind, `${where}: kind`);
  assert.equal(attr(blocks[0], "role"), role, `${where}: role`);
  assert.equal(attr(blocks[0], "aria-live"), live, `${where}: aria-live`);
  assert.ok(html.includes('class="busch-state-title"'), `${where}: title`);
}

test("M27: every card shows loading, empty and error as one BuschUI.stateBlock live region", () => {
  const env = setup();
  const failure = Object.assign(new Error("HTTP 502: upstream"), { code: "timeout" });
  for (const kind of ["downloads", "recent", "fix"]) {
    const c = card(env, kind);
    const body = () => (kind === "fix" ? c._body([]) : c._body());
    c._data = null;
    assertState(body(), "loading", `${kind} loading`);
    c._data = { service: "sonarr", items: [] };
    assertState(body(), "empty", `${kind} empty`);
    c._error = failure;
    const error = body();
    assertState(error, "error", `${kind} error`);
    assert.ok(error.includes("act-retry"), `${kind}: retry offered`);
    assert.ok(error.split("<details")[0].includes(c._t().fehler_zeit), `${kind}: the known cause is the hint`);
    assert.ok(!error.split("<details")[0].includes("upstream"), `${kind}: raw message only in the details`);
    assert.ok(error.includes("<details"), `${kind}: technical details stay reachable`);
  }
  const seer = card(env, "seer");
  seer._searching = true;
  assertState(seer._body(), "loading", "seer searching");
  seer._searching = false;
  assertState(seer._body(), "empty", "seer before a search");
  seer._results = [];
  assertState(seer._body(), "empty", "seer without results");
  seer._error = failure;
  assertState(seer._body(), "error", "seer error");
});

test("M27: the card texts fill the state block (de and en), no own empty markup is left", () => {
  const env = setup();
  const c = card(env, "recent");
  c._data = { items: [] };
  assert.ok(c._body().includes(">Noch nichts aufgenommen.<"), "German empty text");
  c._hass = { locale: { language: "en" } };
  assert.ok(c._body().includes(">Nothing added yet.<"), "English empty text");
  assert.ok(!/class="empty/.test(OWN), "no own .empty block left in the bundle");
});
