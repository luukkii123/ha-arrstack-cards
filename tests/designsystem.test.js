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

/* ── M28: one dialog anatomy, history and focus logic from Shared UI ───── */

/** A history stand-in: an entry stack, back() pops and fires popstate like the browser. */
function historyStub(env) {
  const entries = [{ state: null }];
  const stub = {
    pushes: [], backs: 0,
    get state() { return entries.at(-1).state; },
    get length() { return entries.length; },
    pushState(state) { stub.pushes.push(state); entries.push({ state: JSON.parse(JSON.stringify(state)) }); },
    back() { stub.backs++; if (entries.length > 1) entries.pop(); env.window.dispatchEvent(new env.Event("popstate")); },
  };
  env.history = stub;
  env.window.history = stub;
  return stub;
}

function openDialog({ dirty = false } = {}) {
  const env = installOuterHTML(kit.createEnvironment({ language: "de-DE" }));
  const history = historyStub(env);
  kit.loadScript(BUNDLE, { globals: env });
  const fix = card(env, "fix");
  env.document.body.appendChild(fix);
  const opener = env.document.createElement("button");
  fix.shadowRoot.appendChild(opener);
  opener.focus();
  let closed = 0;
  const dialog = fix._oeffneDialog({ titel: "Endgültig löschen", schliessen: "Schließen", schmal: true, dirty: () => dirty,
    koerper: () => "", aktionen: [], beimSchliessen: () => { closed++; } });
  // The test DOM does not parse the dialog markup: give it two real buttons and skip the binding render.
  dialog._render = () => {};
  dialog.connectedCallback();
  const first = env.document.createElement("button"), last = env.document.createElement("button");
  dialog.shadowRoot.append(first, last);
  return { env, history, fix, opener, dialog, first, last, closed: () => closed };
}

test("M28: the dialog keeps no own pushState, popstate or Tab handling", () => {
  assert.ok(!/history\.(?:pushState|back|go)\s*\(/.test(OWN), "no own history calls");
  assert.ok(!/addEventListener\(\s*["']popstate/.test(OWN), "no own popstate listener");
  assert.ok(!/key\s*===\s*["']Tab["']/.test(OWN), "no own Tab trap");
  assert.match(OWN, /BuschUI\.dialogHistory\(/);
  assert.match(OWN, /BuschUI\.focusTrap\(/);
});

test("M28: opening pushes one shared entry, the back gesture closes and focus returns", () => {
  const { env, history, fix, opener, dialog, closed } = openDialog();
  assert.equal(history.pushes.length, 1, "one history entry");
  assert.ok(history.pushes[0].buschUiDialog, `shared key, never HA's dialog key: ${JSON.stringify(history.pushes[0])}`);
  history.back();
  assert.equal(closed(), 1, "back closes the dialog once");
  assert.ok(!dialog.isConnected, "dialog removed");
  dialog.disconnectedCallback();
  assert.equal(fix.shadowRoot.activeElement, opener, "focus back at the opener");
  assert.equal(history.backs, 1, "no extra back after a back gesture");
  assert.equal(env.document.body.contains(dialog), false);
});

test("M28: the close button removes the own entry once, without an orphan", () => {
  const { history, dialog, closed } = openDialog();
  dialog.close();
  dialog.disconnectedCallback();
  assert.equal(closed(), 1);
  assert.equal(history.backs, 1, "own entry on top: one back");
  assert.equal(history.length, 1, "history as before opening");
});

test("M28: a dirty dialog survives the back gesture, asks, and keeps one entry", () => {
  const { history, dialog, closed } = openDialog({ dirty: true });
  history.back();
  assert.equal(closed(), 0, "still open");
  assert.equal(dialog._discardPrompt, true, "asks before discarding");
  assert.equal(history.pushes.length, 2, "own entry pushed again");
  assert.equal(history.length, 2, "exactly one own entry on the stack");
  dialog.close(true);
  assert.equal(history.length, 1, "discarding removes it");
});

test("M28: Tab and Shift+Tab stay inside the dialog (BuschUI.focusTrap)", () => {
  const { env, dialog, first, last } = openDialog();
  last.focus();
  const tab = (shiftKey) => {
    const event = new env.KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true });
    env.document.dispatchEvent(event);
    return event;
  };
  assert.ok(tab(false).defaultPrevented, "Tab handled");
  assert.equal(dialog.shadowRoot.activeElement, first, "Tab after the last control wraps to the first");
  tab(true);
  assert.equal(dialog.shadowRoot.activeElement, last, "Shift+Tab on the first wraps to the last");
  dialog.close();
});

test("M28: the dialog uses the shared anatomy: X left in the head, title, content, foot", () => {
  const env = setup();
  const fix = card(env, "fix");
  fix._fragLoeschen(71, "Serie");
  try { fix._dialog._render(); } catch { /* the test DOM does not parse what the dialog binds */ }
  const html = fix._dialog.shadowRoot.innerHTML;
  for (const part of ["busch-dialog", "busch-dialog-head", "busch-dialog-close", "busch-dialog-title", "busch-dialog-content", "busch-dialog-foot"])
    assert.ok(tagsWith(html, part).length === 1, `${part}: ${html}`);
  assert.equal(attr(tagsWith(html, "busch-dialog")[0], "data-size"), "confirm", "confirmation is the narrow size");
  assert.ok(html.indexOf("busch-dialog-close") < html.indexOf("busch-dialog-title"), "X before the title");
  assert.ok(html.indexOf('data-akt="cancel"') < html.indexOf('data-akt="delete"'), "Abbrechen left of the final action");
});

/* ── M59: one row raster, real buttons, status with a symbol ───────────── */

test("M59: recent, import and search rows share one structure: poster, then everything in .row-main", () => {
  const parts = fullMarkup();
  for (const where of ["recent", "fix", "seer"]) {
    const html = parts[where].slice(parts[where].indexOf('<div class="rows">'));
    const rows = html.split(/<div class="row(?=[ "])/).slice(1);
    assert.ok(rows.length, `${where}: rows rendered`);
    for (const row of rows) {
      const body = row.slice(row.indexOf(">") + 1);
      const main = body.indexOf('<div class="row-main">');
      assert.ok(main > 0, `${where}: row-main after the poster: ${row}`);
      assert.ok(/^\s*(?:<img class="poster"[^>]*>)?\s*<div class="poster[^"]*"/.test(body), `${where}: the poster comes first: ${body.slice(0, 120)}`);
      assert.ok(!/class="row-side"/.test(row), `${where}: no side column`);
    }
  }
  assert.ok(/<div class="row-meta split"><span class="meta-text">2026 · WEB<\/span><span class="meta-time">/.test(parts.recent), "the time is part of the meta line");
  assert.ok(/<div class="row-main">[\s\S]*<div class="actions">/.test(parts.fix), "import actions belong to the row's main column");
  assert.ok(/<div class="row-main">[\s\S]*class="status-badge/.test(parts.seer), "search status belongs to the main column");
});

test("M59: the CSS has one row raster and the queue fields stop before the action column", () => {
  const row = (OWN.match(/\n {2}\.row \{([^}]*)\}/) || [])[1] || "";
  assert.match(row, /display:\s*grid/);
  assert.match(row, /grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
  assert.ok(!/\.row\.result\s*\{[^}]*grid-template-columns|\.import-row\s*\{[^}]*grid-template-columns/.test(OWN), "no second raster for search or import rows");
  assert.ok(!/\.queue-fields\s*\{[^}]*grid-column:\s*2\s*\/\s*-1/.test(OWN), "queue fields do not run under the action column");
  assert.ok(!/padding-inline-end:\s*calc\(var\(--queue-action\)/.test(OWN), "no padding trick for the action column");
});

test("M59: a compact queue row with a chip and a hint stays below 180 px (compact-contract queue-compact-row500)", () => {
  // Measured in the final run 19.11. (queue-480-light.png): row pitch 171 px in 0.8.0, 183 px with the
  // 28 px busch-chip. Fixed parts: padding 2×12, title 44, chip 28, progress line 15, grid gap 12, hint summary 44.
  const fields = (OWN.match(/\.queue-table:not\(\.expanded\) \.queue-fields \{([^}]*)\}/) || [])[1] || "";
  const gap = (fields.match(/(?:^|;)\s*gap:\s*([^;]+)/) || [])[1] || "";
  const space = { "var(--arr-space-1)": 4, "var(--arr-space-2)": 8, "var(--arr-space-3)": 12 };
  const rowGap = space[gap.trim().split(/\s+/)[0]];
  assert.ok(rowGap !== undefined, `row gap is a space token: ${gap}`);
  const height = 24 + 44 + 28 + 15 + 12 + 44 + 2 * rowGap;
  assert.ok(height < 180, `compact row ${height} px`);
  assert.equal(space[gap.trim().split(/\s+/)[1] || gap.trim()], 8, "column gap between cells stays 8 px");
});

test("M59: every status chip carries a symbol, the selection has a visible label", () => {
  const parts = fullMarkup();
  for (const where of ["downloads", "fix", "seer"]) {
    const chips = parts[where].match(/<span class="status-badge[^>]*>[\s\S]*?<span class="lbl">/g) || [];
    assert.ok(chips.length, `${where}: status chips`);
    for (const chip of chips) assert.ok(/<svg class="icon"/.test(chip), `${where}: chip without symbol: ${chip}`);
  }
  const select = (parts.fix.match(/<label class="select-label">[\s\S]*?<\/label>/) || [""])[0];
  assert.match(select, /<span class="lbl">Auswählen<\/span>/, "visible label text");
  assert.match(select, /aria-label="Auswählen: /, "the accessible name contains the visible label (WCAG 2.5.3)");
});

test("M59: the render fixtures write German umlauts, no ASCII transliterations", () => {
  for (const file of ["render.py", "visual-contract.py", "compact-contract.py"]) {
    const text = fs.readFileSync(path.join(__dirname, "..", "docs", "render", file), "utf8");
    assert.deepEqual(text.match(/ungewoehnlich|ausserordentlich|laenger|Veroeffentlich|aussergewoehnlich/g) || [], [], file);
  }
});

/* ── M42: double-load safe registration ────────────────────────────────── */

test("M42: a second copy of the bundle (second resource URL) loads without error and adds nothing twice", () => {
  const first = kit.createEnvironment({ language: "de-DE" });
  const second = kit.createEnvironment({ language: "de-DE" });
  // One realm, two module copies: shared registry and window, separate top-level scopes.
  second.customElements = first.customElements;
  second.window = first.window;
  const errors = [];
  for (const env of [first, second]) {
    try { kit.loadScript(BUNDLE, { globals: env }); } catch (error) { errors.push(error.message); }
  }
  assert.deepEqual(errors, [], "no NotSupportedError / already defined");
  const types = first.window.customCards.map((entry) => entry.type);
  assert.deepEqual(types, ["arrstack-downloads-card", "arrstack-recent-card", "arrstack-fix-card", "arrstack-seer-card"], "each card once");
  for (const tag of ["arrstack-dialog", "arrstack-downloads-card", "arrstack-recent-card", "arrstack-fix-card", "arrstack-seer-card",
    "arrstack-downloads-card-editor", "arrstack-recent-card-editor", "arrstack-fix-card-editor", "arrstack-seer-card-editor"])
    assert.ok(first.customElements.get(tag), `${tag} defined`);
});

test("M42: the bundle registers through BuschUI.register only", () => {
  assert.ok(!/customElements\.define\s*\(/.test(OWN), "no unguarded customElements.define");
  assert.ok(!/customCards\.push\s*\(/.test(OWN), "no unguarded customCards.push");
  assert.equal((OWN.match(/BuschUI\.register\(/g) || []).length >= 1, true);
});

/* ── M26: contrast fixes found by calculation (the final run measures) ──── */

const hex = (value) => value.replace("#", "").match(/../g).map((part) => parseInt(part, 16));
const luminance = (rgb) => {
  const [r, g, b] = rgb.map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (a, b, share) => a.map((c, i) => Math.round(c * share + b[i] * (1 - share)));
/** Theme values of docs/render/render.py (light and dark). */
const THEMES = { light: { error: "#db4437", text: "#212121", card: "#ffffff" }, dark: { error: "#db4437", text: "#e1e1e1", card: "#1c1c1c" } };

test("M26: the outlined destructive button text reaches 4.5:1 in light and dark", () => {
  const rule = (OWN.match(/\.busch-btn\[data-variant=destructive\]:not\(\[data-filled\]\)\s*\{([^}]*)\}/) || [])[1] || "";
  const m = rule.match(/color:\s*color-mix\(in srgb,\s*var\(--error-color[^)]*\)\s*(\d+)%,\s*var\(--primary-text-color[^)]*\)\)/);
  assert.ok(m, `destructive text mixes the error colour with the text colour: ${rule}`);
  for (const [name, theme] of Object.entries(THEMES)) {
    const plain = contrast(hex(theme.error), hex(theme.card));
    const mixed = contrast(mix(hex(theme.error), hex(theme.text), Number(m[1]) / 100), hex(theme.card));
    assert.ok(plain < 4.5, `${name}: the plain error colour fails (${plain.toFixed(2)}), the fix is needed`);
    assert.ok(mixed >= 4.5, `${name}: ${mixed.toFixed(2)}:1`);
  }
});

test("M26: the render mock ha-card paints HA's card surface, so contrast is measured against the card", () => {
  // Final run 19.11.: 85 contrast findings, all secondary text #727272 on rgb(242,244,247) –
  // the page background, because the mock ha-card inside the card's shadow root had no surface.
  const render = fs.readFileSync(path.join(__dirname, "..", "docs", "render", "render.py"), "utf8");
  const mock = (render.match(/class HaCard extends HTMLElement \{[\s\S]*?\n {2}\}\n/) || [""])[0];
  assert.match(mock, /attachShadow/, "the mock styles itself like the real element (shadow :host)");
  assert.match(mock, /:host\s*\{[^}]*background:\s*var\(--ha-card-background,\s*var\(--card-background-color/, "HA's ha-card background");
  const page = (render.match(/--seite-hintergrund:\s*(#[0-9a-f]{6})/) || [])[1];
  assert.ok(contrast(hex("#727272"), hex(page)) < 4.5, "on the page background the secondary text fails (measuring error)");
  assert.ok(contrast(hex("#727272"), hex(THEMES.light.card)) >= 4.5, "on HA's card surface it passes");
});

test("M26: no own text in the primary colour, only icons, bars, outlines and tints", () => {
  const css = OWN.replace(/\/\*[\s\S]*?\*\//g, "");
  const accentText = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(([, , body]) => /(?:^|[;\s])color:\s*var\(--(?:arr-accent|primary-color)/.test(body))
    .map(([, selector]) => selector.trim().replace(/\s+/g, " "));
  assert.deepEqual(accentText, [".head-media", ".head-title .icon"], "accent colour only on the service symbol");
});
