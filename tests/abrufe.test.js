"use strict";

// Fetch load of the arrstack cards with the shared test kit (#1286, M13; N5, P5).
// Hidden tabs fetch nothing, cards of one instance share a fetch, the fix card
// scans imports only on demand, errors back off, and the recent card keeps its
// DOM when nothing changed.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const kit = require("./_testkit.cjs");
const { installOuterHTML } = require("./_html.cjs");

const BUNDLE = path.join(__dirname, "..", "dist", "arrstack-cards.js");
const row = (id, extra = {}) => ({ id, title: `Release ${id}`, parent_title: `Series ${id}`, status: "completed", tracked_state: "importBlocked", is_problem: true, sizeleft: 0, progress: 100, ...extra });
const inspected = (item) => ({ ...item, queue_item_id: item.id, download_complete: true, import_state: "no_match", candidate_count: 0, candidates: [] });
const arrCalls = (ha) => ha.countMatching(/^arrstack\//);

function setup() {
  const clock = kit.createClock();
  const env = kit.createEnvironment({ clock, language: "de-DE" });
  kit.loadScript(BUNDLE, { globals: env });
  const ha = kit.createHass({ clock, language: "de" });
  const server = { queue: [row(71), row(72)], recent: [{ title: "Film", subtitle: "2026", quality: "WEB", added: "2020-01-01T00:00:00Z" }] };
  ha.respond("arrstack/queue", () => ({ service: "sonarr", brand: "sonarr", items: server.queue.map((item) => ({ ...item })), total: server.queue.length }));
  ha.respond("arrstack/refresh_import_queue", () => ({ service: "sonarr", items: server.queue.map(inspected) }));
  ha.respond("arrstack/recent", () => ({ service: "sonarr", brand: "sonarr", items: server.recent.map((item) => ({ ...item })) }));
  /** Mounts a card like Lovelace does; `_render` is stubbed unless `render` is set. */
  const mount = (kind, config = {}, { render = false } = {}) => {
    const card = new (env.customElements.get(`arrstack-${kind}-card`))();
    if (!render) card._render = () => {};
    env.document.body.appendChild(card);
    card.setConfig({ type: `custom:arrstack-${kind}-card`, entry_id: "entry", ...config });
    card.connectedCallback();
    card.hass = ha.hass;
    return card;
  };
  return { clock, env, ha, server, mount };
}

test("M13: a hidden tab makes no fetch in 10 minutes and loads once when visible again", async () => {
  const { clock, env, ha, mount } = setup();
  const cards = [mount("downloads"), mount("fix"), mount("recent")];
  await clock.flush();
  ha.resetStats();
  env.document.setHidden(true);
  await clock.advance(10 * 60_000);
  assert.equal(arrCalls(ha), 0, `hidden tab fetched: ${JSON.stringify(ha.stats.count)}`);
  env.document.setHidden(false);
  await clock.flush();
  assert.equal(ha.count("arrstack/queue"), 1, "downloads and fix card share one queue read on return");
  assert.equal(ha.count("arrstack/recent"), 1);
  assert.equal(ha.count("arrstack/refresh_import_queue"), 0, "returning to the tab is no import scan");
  for (const card of cards) card.disconnectedCallback();
});

test("M13: two cards of the same instance share one fetch", async () => {
  const { clock, ha, mount } = setup();
  ha.behave("arrstack/queue", { delay: 300 });
  const first = mount("downloads"), second = mount("downloads");
  await clock.advance(1000);
  assert.equal(ha.count("arrstack/queue"), 1, "first display");
  assert.deepEqual(second._data.items.map((item) => item.id), [71, 72]);
  await clock.advance(15_000);
  assert.equal(ha.count("arrstack/queue"), 2, "one read per tick for both cards");
  const other = mount("downloads", { entry_id: "other" });
  await clock.advance(1000);
  assert.equal(ha.count("arrstack/queue"), 3, "another instance fetches on its own");
  for (const card of [first, second, other]) card.disconnectedCallback();
});

test("M13: the fix card scans imports on first display, on demand and for a new problem only", async () => {
  const { clock, ha, server, mount } = setup();
  const card = mount("fix", { refresh_seconds: 60 });
  await clock.flush();
  assert.equal(ha.count("arrstack/refresh_import_queue"), 1, "first display");
  await clock.advance(10 * 60_000);
  assert.equal(ha.count("arrstack/refresh_import_queue"), 1, "timer ticks do not scan");
  assert.equal(ha.count("arrstack/queue"), 10, "timer ticks read the cheap queue");
  assert.equal(card._data.items[0].import_state, "no_match", "inspection result survives the queue ticks");
  server.queue.push(row(73, { progress: 40, sizeleft: 600, status: "downloading", is_problem: false }));
  await clock.advance(60_000);
  assert.equal(ha.count("arrstack/refresh_import_queue"), 1, "a running download is no new problem");
  assert.deepEqual(card._data.items.map((item) => item.id), [71, 72, 73]);
  server.queue[2] = row(73);
  await clock.advance(60_000);
  assert.equal(ha.count("arrstack/refresh_import_queue"), 2, "a new finished problem entry triggers one scan");
  await clock.advance(60_000);
  assert.equal(ha.count("arrstack/refresh_import_queue"), 2);
  await card._load(); // what the refresh and retry buttons call
  assert.equal(ha.count("arrstack/refresh_import_queue"), 3, "refresh button scans");
  card.disconnectedCallback();
});

test("M13: errors back off exponentially, capped at 10 minutes", async () => {
  const { clock, ha, mount } = setup();
  ha.behave("arrstack/queue", { reject: Object.assign(new Error("down"), { code: "unknown" }) });
  const card = mount("downloads");
  await clock.advance(30 * 60_000);
  const times = ha.log.filter((entry) => entry.type === "arrstack/queue").map((entry) => entry.at - ha.log[0].at);
  assert.deepEqual(times.map((ms) => ms / 1000), [0, 15, 45, 105, 225, 465, 945, 1545], "15 s doubling up to 600 s");
  ha.behave("arrstack/queue", null);
  await card._load();
  assert.equal(card._error, null);
  const before = ha.count("arrstack/queue");
  await clock.advance(15_000);
  assert.equal(ha.count("arrstack/queue"), before + 1, "back to the normal tick after success");
  card.disconnectedCallback();
});

test("M13: the recent card does not rebuild its DOM for unchanged data", async () => {
  const { clock, env, ha, server, mount } = setup();
  installOuterHTML(env);
  const card = mount("recent", {}, { render: true });
  await clock.flush();
  const root = card.shadowRoot, proto = Object.getPrototypeOf(root);
  const sink = Object.getOwnPropertyDescriptor(proto, "innerHTML");
  let writes = 0;
  Object.defineProperty(root, "innerHTML", { get() { return sink.get.call(this); }, set(value) { writes++; sink.set.call(this, value); } });
  await clock.advance(120_000);
  assert.equal(ha.count("arrstack/recent"), 2);
  assert.equal(writes, 0, "same data, no rebuild");
  server.recent.push({ title: "Neu", added: "2020-01-02T00:00:00Z" });
  await clock.advance(120_000);
  assert.equal(writes, 1, "changed data rebuilds once");
  card.disconnectedCallback();
});

test("M13: the fix card sees a new problem beyond the first queue page (more than 200 entries)", async () => {
  const { clock, ha, server, mount } = setup();
  // `arrstack/queue` answers from the coordinator: the first page only (200), `total` counts all.
  // Only `refresh_import_queue` reads every page, so the tick must scan while the queue is cut off.
  server.queue = Array.from({ length: 250 }, (_, i) => row(1000 + i, { progress: 40, sizeleft: 600, status: "downloading", is_problem: false }));
  ha.respond("arrstack/queue", () => ({ service: "sonarr", brand: "sonarr", items: server.queue.slice(0, 200).map((item) => ({ ...item })), total: server.queue.length }));
  const card = mount("fix", { refresh_seconds: 60 });
  await clock.flush();
  assert.equal(ha.count("arrstack/refresh_import_queue"), 1, "first display");
  assert.equal(card._data.items.length, 250, "the scan reads every page");
  server.queue[230] = row(1230); // finishes with an import problem, on page 2
  await clock.advance(60_000);
  assert.equal(ha.count("arrstack/refresh_import_queue"), 2, "a cut-off queue is scanned on the tick");
  const found = card._data.items.find((item) => item.queue_item_id === 1230);
  assert.equal(found && found.import_state, "no_match", "the problem on page 2 is inspected");
  assert.equal(card._data.items.length, 250, "entries beyond page 1 stay on the card");
  server.queue = server.queue.slice(0, 150); // back under one page: cheap ticks again
  await clock.advance(60_000);
  const scans = ha.count("arrstack/refresh_import_queue");
  await clock.advance(5 * 60_000);
  assert.equal(ha.count("arrstack/refresh_import_queue"), scans, "a complete first page needs no scan");
  card.disconnectedCallback();
});
