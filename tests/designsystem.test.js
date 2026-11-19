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

/* ── M62: shared base components instead of own variants ───────────────── */

const QUEUE_ITEM = { id: 71, queue_item_id: 71, title: "Release", parent_title: "Serie", episode: "S01E02", status: "completed",
  tracked_state: "importBlocked", is_problem: true, sizeleft: 0, progress: 100, messages: ["Hinweis"], download_complete: true,
  import_state: "ready", candidate_count: 1, candidates: [] };

/** Every card in a full state (rows, pager, toolbar, messages, item errors, season draft) plus both dialogs and the editor order. */
function fullMarkup() {
  const env = setup();
  const parts = {};
  const downloads = card(env, "downloads", { max_items: 1 });
  downloads._data = { service: "sonarr", items: [QUEUE_ITEM, { ...QUEUE_ITEM, id: 72, queue_item_id: 72 }] };
  downloads._message = "Übermittelt.";
  downloads._operationError = new Error("refused");
  downloads._itemErrors.set(71, { message: "Import bereits übermittelt." });
  downloads._render();
  parts.downloads = downloads.shadowRoot.innerHTML;
  const recent = card(env, "recent");
  recent._data = { items: [{ title: "Film", subtitle: "2026", quality: "WEB", added: "2020-01-01T00:00:00Z" }] };
  recent._render();
  parts.recent = recent.shadowRoot.innerHTML;
  const fix = card(env, "fix", { max_items: 1 });
  fix._data = { service: "sonarr", items: [QUEUE_ITEM, { ...QUEUE_ITEM, id: 72, queue_item_id: 72, import_state: "selection_required", candidate_count: 2 }] };
  fix._selected.add(71);
  fix._message = "Gesperrt.";
  fix._itemErrors.set(71, { message: "Import bereits übermittelt." });
  fix._render();
  parts.fix = fix.shadowRoot.innerHTML;
  fix._fragLoeschen(71, "Serie");
  try { fix._dialog._render(); } catch { /* the test DOM does not parse the dialog markup it binds */ }
  parts.deleteDialog = fix._dialog.shadowRoot.innerHTML;
  fix._dialog._discardPrompt = true;
  try { fix._dialog._render(); } catch { /* see above */ }
  parts.discardDialog = fix._dialog.shadowRoot.innerHTML;
  const seer = card(env, "seer");
  seer._results = [{ id: 1, media_type: "tv", title: "Serie", date: "2020", status: "available" }];
  seer._show = { id: 1, media_type: "tv", seasons: [{ season: 1, episodes: 3, status_code: 1 }, { season: 2, episodes: 3, status_code: 5 }] };
  seer._selected.add(1);
  seer._message = "Angefragt (Nr. 7).";
  seer._requestError = new Error("refused");
  seer._render();
  parts.seer = seer.shadowRoot.innerHTML;
  seer._discardInline = true;
  seer._render();
  parts.seerDiscard = seer.shadowRoot.innerHTML;
  const editor = env.document.createElement("arrstack-downloads-card-editor");
  editor.setConfig({ type: "custom:arrstack-downloads-card", columns: ["title", "status"] });
  editor.hass = { locale: { language: "de" }, callWS: () => new Promise(() => {}) };
  parts.editorOrder = editor._order.innerHTML;
  return parts;
}

test("M62: every button of cards, dialogs and editor is a shared base component", () => {
  const parts = fullMarkup();
  const BASE = /class="(?:[^"]* )?(?:busch-btn|busch-chip|busch-ui-action)(?: [^"]*)?"/;
  for (const [where, html] of Object.entries(parts)) {
    const buttons = [...html.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
    if (where !== "recent") assert.ok(buttons.length, `${where}: buttons rendered`);
    assert.deepEqual(buttons.filter((tag) => !BASE.test(tag)), [], `${where}: own button variant`);
  }
  assert.ok(/class="act-delete busch-btn" data-variant="destructive"/.test(parts.fix), "delete in a row is the destructive variant");
  assert.ok(/data-akt="delete"[^>]*|data-variant="destructive" data-filled/.test(parts.deleteDialog) && /data-variant="destructive" data-filled/.test(parts.deleteDialog), "final delete is the filled destructive variant");
  assert.ok(/class="busch-btn" data-variant="primary"[^>]*data-inline-action="request"/.test(parts.seer), "the request is the one primary button");
  assert.ok(/class="season busch-chip"/.test(parts.seer), "season toggles are chips");
});

test("M62: status is a busch-chip with tone, messages and item errors are busch-notices", () => {
  const parts = fullMarkup();
  for (const where of ["downloads", "fix", "seer"]) {
    assert.ok(/<span class="status-badge busch-chip [a-z]+" data-tone="(?:success|warning|error)"/.test(parts[where]) ||
      /<span class="status-badge busch-chip [a-z]+"/.test(parts[where]), `${where}: status chip`);
  }
  assert.ok(/<span class="status-badge busch-chip error" data-tone="error"/.test(parts.downloads), "blocked import carries the error tone");
  assert.ok(/class="busch-notice" data-tone="info" role="status"/.test(parts.downloads), "downloads message");
  assert.ok(/class="busch-notice" data-tone="info" role="status"/.test(parts.fix), "fix message");
  assert.ok(/class="busch-notice" data-tone="info" role="status"/.test(parts.seer), "seer message");
  for (const where of ["downloads", "fix", "seer"]) assert.ok(/class="busch-notice" data-tone="error" role="alert"/.test(parts[where]), `${where}: error notice`);
  assert.ok(/<span class="busch-chip"><span class="lbl">/.test(parts.fix), "page and selection counters are chips");
  assert.ok(!/class="(?:[^"]* )?(?:notice|chip)(?: [^"]*)?"/.test(Object.values(parts).join("")), "no own notice/chip class left");
});

test("M62: the bundle keeps no own button, chip or notice variants in its CSS", () => {
  assert.ok(!/^\s*button\s*[{:,[]/m.test(OWN), "no generic button rule");
  assert.ok(!/button\.(?:quiet|primary|danger)\b/.test(OWN), "no button.quiet/primary/danger");
  assert.ok(!/\.(?:notice|chip)\s*[{,.]/.test(OWN.replace(/busch-(?:notice|chip)/g, "")), "no own .notice/.chip rules");
  assert.ok(!/\.status-badge\.(?:success|warning|error|unavailable)\s*\{/.test(OWN), "no own status colours");
});

/* ── M63: spacing, radius and type from tokens ─────────────────────────── */

test("M63: one inner radius step and the type scale come from the shared tokens", () => {
  const { exposed } = kit.loadScript(BUNDLE, { globals: kit.createEnvironment({ language: "de-DE" }), expose: ["ARRSTACK_TOKENS", "BuschUI"] });
  const tokens = exposed.ARRSTACK_TOKENS, ui = exposed.BuschUI.tokens;
  const value = (name) => (tokens.match(new RegExp(`--arr-${name}:\\s*([^;]+);`)) || [])[1]?.trim();
  assert.equal(value("radius-1"), ui.radiusInner, "inner radius: the one shared step (8 px)");
  assert.equal(value("font-sm"), ui.fontSizeS, "small type");
  assert.equal(value("font-md"), ui.fontSizeM, "body type");
  assert.equal(value("font-lg"), ui.fontSizeL, "large type");
});

test("M63: no fixed px font size, no fixed spacing, no capitals in headings in the own CSS", () => {
  const css = OWN.replace(/var\([^()]*(?:\([^()]*\)[^()]*)*\)/g, "var()");
  assert.deepEqual(css.match(/font-size\s*:\s*[\d.]+(?:px|rem|em)/g) || [], [], "font sizes only through tokens");
  assert.deepEqual(css.match(/(?:margin|padding|gap)[\w-]*\s*:[^;"`]*\b\d+px/g) || [], [], "spacing only through tokens");
  assert.ok(!/text-transform\s*:\s*uppercase|letter-spacing\s*:\s*0?\.\d/.test(OWN), "no capitals in headings");
  assert.ok(!/var\(--ha-space-4,\s*24px\)/.test(OWN), "a fallback matches its token");
});

/* ── M61: one card head and title step for the whole family ────────────── */

test("M61: the card head is BuschUI.header with title level 1 and the full title", () => {
  const env = setup();
  const c = card(env, "fix", { title: "Ein sehr langer Kartentitel für zwei Zeilen" });
  c._data = { service: "sonarr", items: [] };
  const head = c._head("download", "4 offen", "warning");
  const group = tagsWith(head, "busch-ui-header")[0];
  assert.ok(group && attr(group, "role") === "group", `header group: ${head}`);
  const title = tagsWith(head, "busch-ui-title")[0];
  assert.ok(title, `title node: ${head}`);
  assert.equal(attr(title, "data-level"), "1", "card title step");
  assert.equal(attr(title, "role"), "heading");
  assert.equal(attr(title, "title"), "Ein sehr langer Kartentitel für zwei Zeilen", "full title in the tooltip (E12)");
  assert.ok(head.includes("4 offen"), "status stays in the head");
});

test("M61: the family sets no own title type; the title may wrap to two lines (E12)", () => {
  assert.ok(!/(?:^|[\s,}])\.title\s*\{[^}]*font-(?:size|weight)/.test(OWN), "no own .title font size or weight");
  const clamp = (OWN.match(/\.head \.title\s*\{([^}]*)\}/) || [])[1] || "";
  assert.match(clamp, /-webkit-line-clamp:\s*2/, "two lines at most");
  assert.match(clamp, /overflow:\s*hidden/);
  assert.match(clamp, /overflow-wrap:\s*anywhere/);
});
