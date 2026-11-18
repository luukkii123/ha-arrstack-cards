"use strict";

// Fetch races of the arrstack cards with the shared test kit (#1270, M5; #1286, M13).
// An older timer fetch must never overwrite the state after a write action.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const kit = require("./_testkit.cjs");

const BUNDLE = path.join(__dirname, "..", "dist", "arrstack-cards.js");
const row = (id) => ({ id, title: `Release ${id}`, parent_title: `Series ${id}`, status: "completed", tracked_state: "importBlocked", is_problem: true, sizeleft: 0, progress: 100 });

/** Fix card on a server queue with items 71 and 72; `_render` is stubbed, the race is about `_data`. */
async function fixCard() {
  const clock = kit.createClock();
  const env = kit.createEnvironment({ clock, language: "de-DE" });
  kit.loadScript(BUNDLE, { globals: env });
  const ha = kit.createHass({ clock, language: "de" });
  let queue = [row(71), row(72)];
  ha.respond("arrstack/refresh_import_queue", () => ({ service: "sonarr", items: queue.map((item) => ({ ...item })) }));
  ha.respond("arrstack/queue", () => ({ service: "sonarr", items: queue.map((item) => ({ ...item })) }));
  ha.respond("arrstack/queue_remove", (message) => { queue = queue.filter((item) => item.id !== message.item_id); return { removed: true }; });
  const card = new (env.customElements.get("arrstack-fix-card"))();
  card._render = () => {};
  env.document.body.appendChild(card);
  card.setConfig({ type: "custom:arrstack-fix-card", entry_id: "entry", refresh_seconds: 60 });
  card.connectedCallback();
  card.hass = ha.hass;
  await clock.flush();
  return { clock, ha, card, ids: () => (card._data?.items || []).map((item) => item.id) };
}

test("kit baseline: the fix card scans imports once on build and reads the queue per timer tick", async () => {
  const { clock, ha, ids, card } = await fixCard();
  assert.deepEqual(ids(), [71, 72]);
  assert.equal(ha.count("arrstack/refresh_import_queue"), 1);
  await clock.advance(60_000);
  assert.equal(ha.count("arrstack/refresh_import_queue"), 1, "no import scan per tick (M13)");
  assert.equal(ha.count("arrstack/queue"), 1);
  card.disconnectedCallback();
});

/** Holds the next timer read of the fix card, whichever list it reads (old code: import scan, M13: queue). */
async function holdTimerRead(clock, ha) {
  const reads = ["arrstack/refresh_import_queue", "arrstack/queue"];
  for (const type of reads) ha.behave(type, { hang: true });
  await clock.advance(60_000);
  for (const type of reads) ha.behave(type, null);
  assert.equal(ha.held(), 1, "timer fetch is in flight");
  return () => { for (const type of reads) ha.release(type); };
}

test("M13: a timer fetch started before a delete must not bring the deleted item back", async () => {
  const { clock, ha, card, ids } = await fixCard();
  // The timer fetch answers with the queue as it was (71, 72) but only after the delete.
  const release = await holdTimerRead(clock, ha);
  await card._delete(71);
  assert.equal(ha.count("arrstack/queue_remove"), 1);
  release();
  await clock.flush();
  card.disconnectedCallback();
  assert.ok(!ids().includes(71), `deleted item 71 reappeared from the older fetch: ${JSON.stringify(ids())}`);
  const removed = ha.log.find((entry) => entry.type === "arrstack/queue_remove");
  assert.ok(ha.log.some((entry) => entry.type === "arrstack/refresh_import_queue" && entry.id > removed.doneSeq),
    "a fresh fetch must start after the delete answered");
});

test("M13: a timer fetch started before an import must not undo the import", async () => {
  const { clock, ha, card, ids } = await fixCard();
  let queue = [row(71), row(72)];
  ha.respond("arrstack/refresh_import_queue", () => ({ service: "sonarr", items: queue.map((item) => ({ ...item })) }));
  ha.respond("arrstack/queue", () => ({ service: "sonarr", items: queue.map((item) => ({ ...item })) }));
  ha.respond("arrstack/import_item", (message) => { queue = queue.filter((item) => item.id !== message.queue_item_id); return { status: "submitted", queue_item_id: message.queue_item_id }; });
  const release = await holdTimerRead(clock, ha);
  await card._import(72);
  release();
  await clock.flush();
  card.disconnectedCallback();
  assert.deepEqual(ids(), [71], "imported item 72 stays gone");
  assert.equal(card._loading, false, "load lock is free");
});
