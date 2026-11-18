"use strict";

// Time limit for callWS and age of the shown state (#1286, M34; N9).
// A hung read ends after 15 s with a retry notice and frees the load lock; a
// hung write ends after 30 s, is not repeated and the card reads anew.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const kit = require("./_testkit.cjs");

const BUNDLE = path.join(__dirname, "..", "dist", "arrstack-cards.js");
const row = (id) => ({ id, title: `Release ${id}`, parent_title: `Series ${id}`, status: "completed", tracked_state: "importBlocked", is_problem: true, sizeleft: 0, progress: 100 });

function setup() {
  const clock = kit.createClock();
  const env = kit.createEnvironment({ clock, language: "de-DE" });
  Object.defineProperty(env.Element.prototype, "outerHTML", {
    get() { return `<${this.localName} class="${this.className}">${this._innerHTML}</${this.localName}>`; },
  });
  env.history = { pushState() {}, back() {}, state: null };
  env.window.history = env.history;
  const { exposed } = kit.loadScript(BUNDLE, { globals: env, expose: ["TEXTE_ARRSTACK_BASIS"] });
  const ha = kit.createHass({ clock, language: "de" });
  let queue = [row(71), row(72)];
  ha.respond("arrstack/queue", () => ({ service: "sonarr", items: queue.map((item) => ({ ...item })) }));
  ha.respond("arrstack/refresh_import_queue", () => ({ service: "sonarr", items: queue.map((item) => ({ ...item, queue_item_id: item.id, download_complete: true, import_state: "no_match" })) }));
  ha.respond("arrstack/queue_remove", (message) => { queue = queue.filter((item) => item.id !== message.item_id); return { removed: message.item_id }; });
  ha.respond("arrstack/request", () => ({ request_id: 7 }));
  const mount = (kind, config = {}) => {
    const card = new (env.customElements.get(`arrstack-${kind}-card`))();
    card._render = () => {};
    env.document.body.appendChild(card);
    card.setConfig({ type: `custom:arrstack-${kind}-card`, entry_id: "entry", ...config });
    card.connectedCallback();
    card.hass = ha.hass;
    return card;
  };
  return { clock, ha, mount, texts: exposed.TEXTE_ARRSTACK_BASIS };
}

test("M34: a hung queue read ends after 15 s with a retry notice, and the next tick loads again", async () => {
  const { clock, ha, mount, texts } = setup();
  const card = mount("downloads");
  await clock.flush();
  ha.behaveOnce("arrstack/queue", { hang: true });
  await clock.advance(15_000);
  assert.equal(ha.held("arrstack/queue"), 1, "timer read hangs");
  await clock.advance(15_000);
  assert.equal(card._error?.code, "timeout");
  assert.equal(card._loading, false, "load lock is free");
  const body = card._body();
  assert.ok(body.includes("act-retry"), "retry button");
  assert.ok(body.includes(texts.de.fehler_zeit), "time-limit notice");
  const before = ha.count("arrstack/queue");
  await clock.advance(15_000);
  assert.equal(ha.count("arrstack/queue"), before + 1, "next tick loads again");
  assert.equal(card._error, null);
  card.disconnectedCallback();
});

test("M34: a hung delete ends after 30 s, is not repeated, and the card reads anew", async () => {
  const { clock, ha, mount, texts } = setup();
  const card = mount("fix", { refresh_seconds: 60 });
  await clock.flush();
  ha.behaveOnce("arrstack/queue_remove", { hang: true });
  const done = card._delete(71);
  await clock.advance(30_000);
  await done;
  assert.equal(ha.count("arrstack/queue_remove"), 1, "write not repeated");
  assert.equal(card._operationError?.code, "write_timeout");
  assert.equal(card._busy, null);
  const removed = ha.log.find((entry) => entry.type === "arrstack/queue_remove");
  assert.ok(ha.log.some((entry) => entry.type === "arrstack/refresh_import_queue" && entry.at >= removed.at + 30_000), "fresh read after the time limit");
  assert.ok(card._errorMarkup(card._operationError, "", false).includes(texts.de.fehler_zeit_schreiben));
  card.disconnectedCallback();
});

test("M34: a hung seer request ends after 30 s without a second request", async () => {
  const { clock, ha, mount } = setup();
  const card = mount("seer", { service: "seerr", entry_id: undefined });
  card._show = { media_type: "movie", id: 5, seasons: [] };
  ha.behaveOnce("arrstack/request", { hang: true });
  const done = card._request();
  await clock.advance(30_000);
  await done;
  assert.equal(ha.count("arrstack/request"), 1);
  assert.equal(card._requestError?.code, "write_timeout");
  assert.equal(card._busy, false);
});

test("M34: the head shows the age of the state once the last success is older than two ticks", async () => {
  const { clock, ha, mount, texts } = setup();
  const card = mount("downloads");
  await clock.flush();
  ha.behave("arrstack/queue", { reject: Object.assign(new Error("down"), { code: "unknown" }) });
  await clock.advance(30_000);
  assert.ok(!card._head("download", "").includes(texts.de.stand_alt.slice(0, 5)), "two ticks: no age yet");
  await clock.advance(90_000);
  assert.ok(card._head("download", "").includes("Stand vor 2 Min."), card._head("download", ""));
  assert.equal(texts.en.stand_alt, "As of {n} min ago");
  ha.behave("arrstack/queue", null);
  await card._load();
  assert.ok(!card._head("download", "").includes("Stand vor"), "fresh state: no age");
  card.disconnectedCallback();
});
