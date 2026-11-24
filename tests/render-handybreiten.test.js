'use strict';
// M76 (#1347, F14): every dialog (dialog-import, dialog-loeschen, dialog-pruefen, queue-dialog-error) and every editor is
// also rendered and measured at the phone widths 360 and 390 px (Regel 1, Regel 2 for the dialogs), so the closing run
// shows both widths per dialog. Checked in the source: no browser in the Node run.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');

const lies = (name) => fs.readFileSync(path.join(__dirname, '../docs/render', name), 'utf8');
const breiten = (tupel) => tupel.split(',').map((s) => Number(s.trim())).filter(Boolean);
const hatHandy = (tupel) => [360, 390].every((b) => breiten(tupel).includes(b));

test('M76 render.py: Regel 1 in both dialogs at 360 and 390', () => {
  const text = lies('render.py');
  const block = text.match(/ui_dialog\[name\] = regeln\.lauf_breiten\([\s\S]*?breiten=\(([^)]*)\)/);
  assert.ok(block, 'Regel 1 dialog run missing');
  assert.ok(hatHandy(block[1]), 'Regel 1 dialogs without 360/390: ' + block[1]);
});

test('M76 render.py: Regel 2 for both dialogs at 360 and 390', () => {
  const text = lies('render.py');
  const handy = text.match(/HANDY_BREITEN = \(([^)]*)\)/);
  assert.ok(handy && hatHandy(handy[1]), 'HANDY_BREITEN (360, 390) missing');
  assert.match(text, /for breite in HANDY_BREITEN:[\s\S]*?popups\[f"\{name\}_\{breite\}"\] = regeln\.messe_popup\(/,
    'Regel 2 is not measured per phone width');
  for (const name of ['fix_pruefen', 'fix_loeschen'])
    assert.match(text, new RegExp(`\\("${name}", "\\.act-`), name + ' not opened at the phone widths');
});

test('M76 render.py: dialog-import, dialog-loeschen and dialog-pruefen are captured at 360 and 390', () => {
  const text = lies('render.py');
  for (const bild of ['dialog-import', 'dialog-loeschen', 'dialog-pruefen'])
    assert.match(text, new RegExp(`\\("${bild}", `), bild + ' not captured at the phone widths');
  assert.match(text, /OUT \/ f"\{bild\}-\{breite\}-\{thema\}\.png"/, 'phone capture name');
});

test('M76 render.py: the dialogs carry contrast and touch at every width (Etappe I: new widths measured)', () => {
  const text = lies('render.py');
  const block = text.match(/ui_dialog\[name\]\.update\(regeln\.messe_kontrast_touch\([\s\S]*?breiten=\(([^)]*)\)/);
  assert.ok(block, 'dialogs without contrast/touch');
  assert.ok(hatHandy(block[1]), 'dialog contrast without 360/390');
});

test('M76 compact-contract.py: queue-dialog-error at 360 and 390 with Regel 1, contrast and touch', () => {
  const text = lies('compact-contract.py');
  const loop = text.match(/for width in \(([^)]*)\):\n(?:.*\n){0,12}?.*queue-dialog-error-\{width\}-\{theme\}\.png/);
  assert.ok(loop && hatHandy(loop[1]), 'queue-dialog-error not captured at 360/390');
  assert.match(text, /dialog_regel1\[f'queue-dialog-error-\{width\}-\{theme\}'\] = regeln\.messe_text\(page, *'\.sheet'\)/,
    'queue-dialog-error without Regel 1');
  assert.match(text, /messe_kt\('queue-dialog-error', 'codex-arrcompact-dialog', width, theme\)/, 'queue-dialog-error without contrast');
  assert.match(text, /regeln\.bewerte\(dialog_regel1\)/, 'a Regel-1 violation in the dialog does not fail the run');
});

test('M76 editors: visual-contract.py and the native queue editor at 360 and 390, Regel 1 in every editor', () => {
  const visual = lies('visual-contract.py');
  const loop = visual.match(/for width in \(([^)]*)\):\n\s*for theme in \("light", "dark"\):\n\s*page\.set_viewport_size\(\{"width": width, "height": 1200\}\)\n(?:.*\n){0,8}?\s*name = f"editoren-/);
  assert.ok(loop && hatHandy(loop[1]), 'editors not rendered at 360/390');
  assert.match(visual, /regeln\.messe_text\(page, f'\.editor-panel\[data-card="\{tag\}"\]'\)/, 'editors without Regel 1');
  assert.match(visual, /regeln\.messe_kontrast_touch_hier\(page, f'\.editor-panel\[data-card="\{tag\}"\]'/, 'editors without contrast/touch');
  const compact = lies('compact-contract.py');
  const nativ = compact.match(/for width in \(([^)]*)\):\n(?:.*\n){0,6}?.*queue-editor-\{width\}-\{theme\}\.png/);
  assert.ok(nativ && hatHandy(nativ[1]), 'native queue editor not at 360/390');
});
