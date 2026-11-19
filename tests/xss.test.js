"use strict";

// XSS regression for every HTML sink of the arrstack cards (#1276, M19, S5.2).
// Each card renders mock WS data in which every displayed text field carries
// one payload of XSS_PAYLOADS. After removing the elements the cards draw on
// purpose (named below), activeMarkup must be empty.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const kit = require("./_testkit.cjs");
const { installOuterHTML } = require("./_html.cjs");

const BUNDLE = path.join(__dirname, "..", "dist", "arrstack-cards.js");

/** Elements the cards render on purpose; everything else is a finding. */
const KNOWN = [
  // arrIcon(): stroke icon, fixed attributes, paths are constants.
  /<svg class="icon" viewBox="0 0 24 24" width="\d+" height="\d+"\s+fill="none" stroke="currentColor" stroke-width="1\.5" stroke-linecap="round"\s+stroke-linejoin="round" aria-hidden="true">/g,
  // posterMarkup(): poster image, src escaped, fallback bound by bindImageFallbacks.
  /<img class="poster" src="[^"<>]*" alt="" loading="lazy">/g,
  // serviceLogo(): brand logo from brands.home-assistant.io, brand URI-encoded.
  /<img class="logo" src="https:\/\/brands\.home-assistant\.io\/_\/[^"<>/]*\/icon\.png"\s+alt="" loading="lazy" style="width: \d+px; height: \d+px">/g,
];

function findings(html) {
  let rest = String(html);
  for (const pattern of KNOWN) rest = rest.replace(pattern, "");
  const found = kit.activeMarkup(rest);
  if (/src="\s*(?:javascript|vbscript|data:text):/i.test(html)) found.push("img[src=script]");
  return found;
}

function setup() {
  const env = kit.createEnvironment({ language: "de-DE" });
  // The test DOM keeps innerHTML unparsed: give it outerHTML for the blocks built
  // as DOM (head, state blocks) and let patchQueueMarkup store the markup like a
  // plain innerHTML sink.
  installOuterHTML(env);
  env.history = { pushState() {}, back() {}, state: null };
  env.window.history = env.history;
  env.exposed = kit.loadScript(BUNDLE, { globals: env, expose: ["ARRSTACK_QUEUE_COLUMNS"] }).exposed;
  env.patchQueueMarkup = (root, markup) => { root.innerHTML = markup; };
  return env;
}

function card(env, tag, config, p) {
  const el = new (env.customElements.get(tag))();
  el._hass = { locale: { language: "de" }, callWS: () => new Promise(() => {}) };
  el._config = { ...el._defaults(), title: p, service: p, ...config };
  return el;
}

const allColumns = (env) => Object.keys(env.exposed.ARRSTACK_QUEUE_COLUMNS);

/** Queue item with a payload in every text field the queue cards show. */
const queueItem = (p, id) => ({
  id, queue_item_id: id, title: p, parent_title: p, episode: p, episode_title: p, episode_air_date: p,
  status: p, tracked_state: p, languages: [p, p], quality: p, custom_formats: [p], custom_format_score: p,
  protocol: p, indexer: p, download_client: p, output_path: p, timeleft: p, size: 1e9, sizeleft: 0,
  progress: 100, is_problem: true, messages: [p, p], poster: p, image: p, last_error: p,
  download_complete: true, import_state: "ready", candidate_count: 1,
});

const errorWith = (p) => Object.assign(new Error(p), { code: p, details: p });

function each(name, fn) {
  for (const [i, p] of kit.XSS_PAYLOADS.entries()) test(`${name} · payload ${i + 1}`, () => fn(p));
}

each("downloads card: rows, columns, reasons, head and messages stay inert", (p) => {
  const env = setup();
  const c = card(env, "arrstack-downloads-card", { columns: allColumns(env), show_posters: true }, p);
  assert.ok(allColumns(env).length >= 17, "every queue column is rendered");
  c._data = { service: "sonarr", brand: p, speed: 1000, total: p, items: [queueItem(p, 71), { ...queueItem(p, 72), poster: "https://image.tmdb.org/t/p/w300/a.jpg" }] };
  c._message = p;
  c._operationError = errorWith(p);
  c._itemErrors.set(71, { message: p, details: p });
  c._render();
  assert.ok(c.shadowRoot.innerHTML.includes('class="queue-grid queue-row"'), "rows rendered");
  assert.deepEqual(findings(c.shadowRoot.innerHTML), []);
  c._data = null; c._error = errorWith(p); c._render();
  assert.deepEqual(findings(c.shadowRoot.innerHTML), [], "error state");
});

each("recent card: titles, subtitle, quality, poster and head stay inert", (p) => {
  const env = setup();
  const c = card(env, "arrstack-recent-card", {}, p);
  c._data = { brand: p, items: [{ title: p, subtitle: p, quality: p, added: p, poster: p }, { title: p, subtitle: p, quality: p, added: p, poster: "https://image.tmdb.org/t/p/w300/a.jpg" }] };
  c._render();
  assert.ok(c.shadowRoot.innerHTML.includes('class="row"'), "rows rendered");
  assert.deepEqual(findings(c.shadowRoot.innerHTML), []);
  c._data = null; c._error = errorWith(p); c._render();
  assert.deepEqual(findings(c.shadowRoot.innerHTML), [], "error state");
});

each("fix card: rows, last_error, messages and both dialogs stay inert", async (p) => {
  const env = setup();
  const c = card(env, "arrstack-fix-card", {}, p);
  c._data = { service: p, brand: p, items: [queueItem(p, 71), { ...queueItem(p, 72), import_state: "error" }] };
  c._message = p;
  c._operationError = errorWith(p);
  c._itemErrors.set(72, { message: p, details: p });
  c._render();
  assert.ok(c.shadowRoot.innerHTML.includes("import-row"), "rows rendered");
  assert.deepEqual(findings(c.shadowRoot.innerHTML), []);

  c._open = {
    queue_item_id: 71, loading: false, title: p, parent_title: p, status: p, tracked_state: p, import_state: p,
    last_error: p, last_error_details: p, fehler: { ...errorWith(p), fachlich: true },
    candidates: [{ candidate_id: p, filename: p, name: p, quality: p, languages: [p], release_group: p, custom_formats: [p], path: p, rejections: [p, p], valid: false, size: 1 }],
  };
  assert.deepEqual(findings(c._dialogKoerper()), [], "check dialog body");
  c._open.fehler = errorWith(p);
  assert.deepEqual(findings(c._dialogKoerper()), [], "check dialog body, technical error");

  c._fragLoeschen(71, p);
  const dialog = c._dialog;
  // The test DOM neither calls lifecycle callbacks nor parses markup, so the
  // dialog's binding step after its innerHTML sink finds no elements and throws.
  assert.throws(() => dialog._render(), { name: "TypeError" });
  assert.ok(dialog && dialog.shadowRoot.innerHTML.includes("dlg-sub"), "delete dialog rendered");
  assert.deepEqual(findings(dialog.shadowRoot.innerHTML), [], "delete dialog");

  c._data = null; c._error = errorWith(p); c._render();
  assert.deepEqual(findings(c.shadowRoot.innerHTML), [], "error state");
});

each("seer card: query, results, status, seasons and messages stay inert", (p) => {
  const env = setup();
  const c = card(env, "arrstack-seer-card", {}, p);
  c._query = p;
  c._message = p;
  c._results = [
    { id: 1, media_type: "tv", title: p, date: p, status: p, poster: p },
    { id: 2, media_type: p, title: p, date: p, status: "available", poster: "https://image.tmdb.org/t/p/w300/a.jpg" },
  ];
  c._show = { id: 1, media_type: "tv", status: p, seasons: [{ season: 1, episodes: 3, status_code: 5 }, { season: 0, episodes: 2, status_code: 1 }] };
  c._requestError = errorWith(p);
  c._render();
  assert.ok(c.shadowRoot.innerHTML.includes("request-inline"), "results and season choice rendered");
  assert.deepEqual(findings(c.shadowRoot.innerHTML), []);
  c._discardInline = true; c._render();
  assert.deepEqual(findings(c.shadowRoot.innerHTML), [], "discard prompt");
  c._results = null; c._show = null; c._error = errorWith(p); c._render();
  assert.deepEqual(findings(c.shadowRoot.innerHTML), [], "error state");
});

test("the probe sees an unescaped payload (counter-check)", () => {
  assert.deepEqual(findings(`<div>${kit.XSS_PAYLOADS[0]}</div>`), ["img", "img[onerror]"]);
  assert.deepEqual(findings('<img class="poster" src="javascript:alert(1)" alt="" loading="lazy">'), ["img[src=script]"]);
});
