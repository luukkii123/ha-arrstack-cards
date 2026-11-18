"use strict";

// Fetch races of the arrstack cards with the shared test kit (#1270, M5 for M13).
// An older timer fetch must never overwrite the state after a write action.
// The race tests are `todo` while the cards still have the race: they run and
// report `not ok … # TODO` without failing the suite. M13 turns them into
// normal tests.
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

test("kit baseline: the fix card loads the queue once on build and once per timer tick", async () => {
  const { clock, ha, ids, card } = await fixCard();
  assert.deepEqual(ids(), [71, 72]);
  assert.equal(ha.count("arrstack/refresh_import_queue"), 1);
  await clock.advance(60_000);
  assert.equal(ha.count("arrstack/refresh_import_queue"), 2);
  card.disconnectedCallback();
});

test("M13: a timer fetch started before a delete must not bring the deleted item back", { todo: "M13 _loadSeq: write actions invalidate older fetches" }, async () => {
  const { clock, ha, card, ids } = await fixCard();
  // The timer fetch answers with the queue as it was (71, 72) but only after the delete.
  ha.behaveOnce("arrstack/refresh_import_queue", { hang: true });
  await clock.advance(60_000);
  assert.equal(ha.held("arrstack/refresh_import_queue"), 1, "timer fetch is in flight");
  await card._delete(71);
  assert.equal(ha.count("arrstack/queue_remove"), 1);
  ha.release("arrstack/refresh_import_queue");
  await clock.flush();
  card.disconnectedCallback();
  assert.ok(!ids().includes(71), `deleted item 71 reappeared from the older fetch: ${JSON.stringify(ids())}`);
  const removed = ha.log.find((entry) => entry.type === "arrstack/queue_remove");
  assert.ok(ha.log.some((entry) => entry.type === "arrstack/refresh_import_queue" && entry.id > removed.doneSeq),
    "a fresh fetch must start after the delete answered");
});
