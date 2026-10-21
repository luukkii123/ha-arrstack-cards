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
  const columnEditor = new (elements.get('arrstack-downloads-card-editor'))();
  const initialColumns=Object.freeze(['title','status','title','unknown']);
  columnEditor.setConfig(Object.freeze({type:'custom:arrstack-downloads-card',columns:initialColumns,show_posters:true}));
  columnEditor.hass={locale:{language:'de'},callWS:async()=>({instances:[]})};
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(Array.from(columnEditor._config.columns),['title','status'],'Editor normalisiert ohne fremde Eingabe zu mutieren');
  assert.deepEqual(Array.from(initialColumns),['title','status','title','unknown']);
  const legacyEditor=new (elements.get('arrstack-downloads-card-editor'))();
  legacyEditor.setConfig({type:'custom:arrstack-downloads-card',show_posters:false});
  assert.equal(legacyEditor._config.show_posters,false,'bestehende explizite Posteroption erhalten');
  assert.equal(legacyEditor._config.show_unknown,true,'unbekannte Titel bleiben sichtbar');
  assert.deepEqual(Array.from(legacyEditor._config.columns),['title','status','episode','timeleft','progress'],'legacy Config bekommt konsistente sichtbare Defaults');
  const selectedField=columnEditor.children[0].schema.find(field=>field.name==='columns');
  assert(selectedField.selector.select.multiple,'sichtbare Spalten sind ha-form Mehrfachauswahl');
  const columnChanges=[];
  columnEditor.addEventListener('config-changed',event=>columnChanges.push(JSON.parse(JSON.stringify(event.detail.config))));
  columnEditor._moveColumn('status',-1);
  assert.deepEqual(Array.from(columnEditor._config.columns),['status','title'],'native Hochaktion ändert Reihenfolge');
  const orderWrites=columnEditor.children[0].dataWrites;
  columnEditor.setConfig(columnChanges[0]);
  assert.equal(columnEditor.children[0].dataWrites,orderWrites,'Reihenfolgen-Echo setzt Formular nicht zurück');
  columnEditor._moveColumn('status',-1);
  assert.equal(columnChanges.length,1,'Grenze führt keine leere Änderung aus');
  columnEditor.children[0].dispatchEvent({type:'value-changed',detail:{value:{columns:['status','episode']}},stopPropagation(){}});
  assert.deepEqual(Array.from(columnEditor._config.columns),['status','episode'],'sichtbare Spalten aktualisieren Reihenfolge');

  for (const tag of [
    "arrstack-downloads-card-editor",
    "arrstack-recent-card-editor",
    "arrstack-fix-card-editor",
    "arrstack-seer-card-editor",
  ]) {
    const editor = new (elements.get(tag))();
    const entityIds = Object.freeze(["light.example"]);
    const target = Object.freeze({ entity_id: entityIds });
    const tapAction = Object.freeze({ action: "perform-action", target });
    const original = Object.freeze({
      type: `custom:${tag.slice(0, -7)}`, title: "Start", refresh_seconds: 15,
      tap_action: tapAction,
      ...(tag.includes("downloads") ? {columns:["title","status","episode","timeleft","progress"],show_posters:true,show_unknown:true,max_items:10} : {}),
    });
    const emitted = [];
    editor.addEventListener("config-changed", (event) => {
      emitted.push(JSON.parse(JSON.stringify(event.detail.config)));
      event.detail.config.tap_action.target.entity_id[0] = "light.changed_by_consumer";
      assert.equal(event.detail.config.tap_action.target.entity_id[0], "light.changed_by_consumer");
    });
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
    form.currentData.tap_action.target.entity_id[0] = "light.changed_by_form";
    assert.equal(editor._config.tap_action.target.entity_id[0], "light.example", `${tag}: Formular besitzt eigene Daten`);
    editor.setConfig(JSON.parse(JSON.stringify(original)));
    editor.hass = { ...editor._hass, locale: { language: "en" } };
    assert.equal(form.dataWrites, writes, `${tag}: gleiche Config und hass dürfen Eingabe nicht zurücksetzen`);
    assert.equal(form.schemaWrites, schemaWrites + (tag.includes("downloads") ? 1 : 0), `${tag}: nur neue Spaltenlabels brauchen Schema bei Sprachwechsel`);
    assert.notEqual(form.computeLabel(form.schema[0]), "Überschrift");

    form.dispatchEvent({ type: "value-changed", detail: { value: { title: "Neu" } }, stopPropagation() {} });
    assert.equal(editor._config.tap_action.target.entity_id[0], "light.example", `${tag}: Ereignisempfänger verändert keinen Editorstand`);
    form.dispatchEvent({ type: "value-changed", detail: { value: { title: "Neu B", max_items: 4 } }, stopPropagation() {} });
    assert.equal(emitted.length, 2);
    assert.deepEqual({ ...emitted[1] }, { ...original, title: "Neu B", max_items: 4 }, `${tag}: zweite Änderung enthält die erste`);
    assert.equal(original.title, "Start", `${tag}: setConfig-Eingabe bleibt unverändert`);
    assert.equal(original.tap_action.target.entity_id[0], "light.example", `${tag}: verschachtelte Eingabe bleibt unverändert`);
    editor.setConfig(emitted[1]);
    assert.equal(form.dataWrites, writes, `${tag}: bestätigtes Echo setzt keinen Fokus zurück`);
    editor.setConfig(JSON.parse(JSON.stringify(emitted[1])));
    assert.equal(form.dataWrites, writes, `${tag}: doppeltes neuestes Echo bleibt idempotent`);
    editor.setConfig(JSON.parse(JSON.stringify(emitted[0])));
    assert.equal(editor._config.title, "Neu B", `${tag}: noch ausstehendes altes Echo nach neuestem Echo wird ignoriert`);
    assert.equal(form.dataWrites, writes, `${tag}: spätes altes Echo ersetzt das aktive Formular nicht`);
    editor.setConfig({ ...emitted[1], title: "Aus YAML" });
    assert.equal(editor._config.title, "Aus YAML", `${tag}: bewusste externe Änderung wird übernommen`);
    assert.equal(form.dataWrites, writes + 1, `${tag}: externe Änderung erreicht das Formular`);
    editor.setConfig(JSON.parse(JSON.stringify(emitted[0])));
    assert.equal(editor._config.title, "Neu", `${tag}: bewusste YAML-Rückkehr zu einem früheren Wert bleibt möglich`);
    assert.equal(form.dataWrites, writes + 2, `${tag}: YAML-Rückkehr aktualisiert das Formular`);

    const orderedEditor = new (elements.get(tag))();
    const orderedEmitted = [];
    orderedEditor.addEventListener("config-changed", (event) =>
      orderedEmitted.push(JSON.parse(JSON.stringify(event.detail.config))));
    orderedEditor.setConfig(original);
    orderedEditor.hass = {
      locale: { language: "de" }, callWS: async () => ({ instances: [] }),
    };
    await new Promise((resolve) => setImmediate(resolve));
    const orderedForm = orderedEditor.children[0];
    orderedForm.dispatchEvent({ type: "value-changed", detail: { value: { title: "A" } }, stopPropagation() {} });
    orderedForm.dispatchEvent({ type: "value-changed", detail: { value: { title: "B" } }, stopPropagation() {} });
    const beforeEchoWrites = orderedForm.dataWrites;
    orderedEditor.setConfig(orderedEmitted[0]);
    assert.equal(orderedEditor._config.title, "B", `${tag}: frühes A-Echo setzt B nicht zurück`);
    assert.equal(orderedForm.dataWrites, beforeEchoWrites, `${tag}: frühes A-Echo ersetzt das Formular nicht`);
    orderedEditor.setConfig(JSON.parse(JSON.stringify(orderedEmitted[0])));
    assert.equal(orderedEditor._config.title, "B", `${tag}: doppeltes frühes A-Echo setzt B nicht zurück`);
    assert.equal(orderedForm.dataWrites, beforeEchoWrites, `${tag}: doppeltes A-Echo ersetzt das Formular nicht`);
    orderedEditor.setConfig(orderedEmitted[1]);
    const orderedWrites = orderedForm.dataWrites;
    orderedEditor.setConfig(JSON.parse(JSON.stringify(orderedEmitted[0])));
    assert.equal(orderedEditor._config.title, "A", `${tag}: bestätigtes A darf später als YAML-Wert zurückkehren`);
    assert.equal(orderedForm.dataWrites, orderedWrites + 1, `${tag}: YAML-Rückkehr nach regulären Echos erreicht das Formular`);

    const repeatedEditor = new (elements.get(tag))();
    const repeatedEmitted = [];
    repeatedEditor.addEventListener("config-changed", (event) =>
      repeatedEmitted.push(JSON.parse(JSON.stringify(event.detail.config))));
    repeatedEditor.setConfig(original);
    repeatedEditor.hass = {
      locale: { language: "de" }, callWS: async () => ({ instances: [] }),
    };
    await new Promise((resolve) => setImmediate(resolve));
    const repeatedForm = repeatedEditor.children[0];
    for (const title of ["A", "B", "A", "C"]) {
      repeatedForm.dispatchEvent({ type: "value-changed", detail: { value: { title } }, stopPropagation() {} });
    }
    assert.equal(repeatedEmitted.length, 4);
    assert.deepEqual(repeatedEmitted[0], repeatedEmitted[2], `${tag}: A wird tatsächlich mit identischem Config-Wert wiederholt`);
    const repeatedWrites = repeatedForm.dataWrites;
    for (const echo of repeatedEmitted) repeatedEditor.setConfig(JSON.parse(JSON.stringify(echo)));
    assert.equal(repeatedForm.dataWrites, repeatedWrites, `${tag}: gleiche Werte und ihre Echos ersetzen das Formular nicht`);
    repeatedEditor.setConfig(JSON.parse(JSON.stringify(repeatedEmitted[0])));
    assert.equal(repeatedEditor._config.title, "A", `${tag}: wiederholter, bereits bestätigter Wert bleibt extern editierbar`);
    assert.equal(repeatedForm.dataWrites, repeatedWrites + 1, `${tag}: externe Rückkehr zu A erreicht das Formular`);

    const retryEditor = new (elements.get(tag))();
    retryEditor.setConfig(original);
    let calls = 0;
    retryEditor.hass = {
      locale: { language: "de" },
      callWS: async () => { calls++; throw new Error("temporär nicht erreichbar"); },
    };
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 1, `${tag}: erster Instanzabruf lief`);
    retryEditor.hass = {
      locale: { language: "de" },
      callWS: async () => {
        calls++;
        return { instances: [{ entry_id: "retry-1",
          service: tag.includes("seer") ? "seerr" : "sonarr", title: "Wieder da" }] };
      },
    };
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(calls, 2, `${tag}: hass-Update wiederholt fehlgeschlagenen Instanzabruf`);
    assert.equal(retryEditor.children[0].schema.find((field) => field.name === "entry_id")
      .selector.select.options.length, 1, `${tag}: wiederhergestellte Option erscheint`);

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
