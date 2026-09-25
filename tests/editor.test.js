const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class Element {
  constructor() {
    this.listeners = new Map();
    this.children = [];
  }
  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }
  appendChild(child) {
    this.children.push(child);
  }
  dispatchEvent(event) {
    this.listeners.get(event.type)?.(event);
    return true;
  }
}

class Form extends Element {
  set schema(value) {
    this.schemaWrites = (this.schemaWrites || 0) + 1;
    this.currentSchema = value;
  }
  get schema() { return this.currentSchema; }
  set data(value) {
    this.dataWrites = (this.dataWrites || 0) + 1;
    this.currentData = value;
  }
}

const elements = new Map();
const context = {
  HTMLElement: Element,
  customElements: { define: (name, type) => elements.set(name, type) },
  document: { createElement: (name) => name === "ha-form" ? new Form() : new Element() },
  window: {},
  navigator: { language: "en" },
  console: { info() {} },
  CustomEvent: class {
    constructor(type, options) { Object.assign(this, { type }, options); }
  },
};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/arrstack-cards.js"), "utf8"), context);

async function run() {
  for (const tag of [
    "arrstack-downloads-card-editor",
    "arrstack-recent-card-editor",
    "arrstack-fix-card-editor",
    "arrstack-seer-card-editor",
  ]) {
    const editor = new (elements.get(tag))();
    const original = Object.freeze({ type: `custom:${tag.slice(0, -7)}`, title: "Start", refresh_seconds: 15 });
    const emitted = [];
    editor.addEventListener("config-changed", (event) => emitted.push(event.detail.config));
    editor.setConfig(original);
    editor.hass = {
      locale: { language: "de" },
      callWS: async () => ({ instances: [
        { entry_id: "sonarr-1", service: "sonarr", title: "Sonarr Eins" },
        { entry_id: "seerr-1", service: "seerr", title: "Seerr Eins" },
      ] }),
    };
    await new Promise((resolve) => setImmediate(resolve));
    const form = editor.children[0];
    assert.equal(form.schema.find((field) => field.name === "entry_id").selector.select.options.length, 1);
    assert.equal(form.computeLabel(form.schema[0]) !== form.schema[0].name, true);
    assert.match(form.computeHelper(form.schema[0]), /[.!?]$/);

    const writes = form.dataWrites;
    const schemaWrites = form.schemaWrites;
    editor.setConfig({ ...original });
    editor.hass = { ...editor._hass, locale: { language: "en" } };
    assert.equal(form.dataWrites, writes, `${tag}: gleiche Config und hass dürfen Eingabe nicht zurücksetzen`);
    assert.equal(form.schemaWrites, schemaWrites, `${tag}: hass darf das Schema nicht neu aufbauen`);
    assert.notEqual(form.computeLabel(form.schema[0]), "Überschrift");

    form.dispatchEvent({ type: "value-changed", detail: { value: { title: "Neu" } }, stopPropagation() {} });
    form.dispatchEvent({ type: "value-changed", detail: { value: { max_items: 4 } }, stopPropagation() {} });
    assert.equal(emitted.length, 2);
    assert.deepEqual({ ...emitted[1] }, { ...original, title: "Neu", max_items: 4 }, `${tag}: zweite Änderung enthält die erste`);
    assert.equal(original.title, "Start", `${tag}: setConfig-Eingabe bleibt unverändert`);
    editor.setConfig(emitted[0]);
    assert.equal(form.dataWrites, writes, `${tag}: verspätetes Echo setzt keine jüngere Eingabe zurück`);
    editor.setConfig(emitted[1]);
    assert.equal(form.dataWrites, writes, `${tag}: bestätigtes Echo setzt keinen Fokus zurück`);

    for (const type of ["keydown", "keyup"]) {
      let stopped = 0;
      let prevented = 0;
      editor.dispatchEvent({ type, stopPropagation() { stopped++; }, preventDefault() { prevented++; } });
      assert.equal(stopped, 1, `${tag}: ${type} bleibt im Editor`);
      assert.equal(prevented, 0, `${tag}: ${type} behält die Standardaktion`);
    }
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
