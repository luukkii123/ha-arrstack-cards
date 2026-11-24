'use strict';
// M26 (#1347, W10/W2): every synthetic render script measures contrast and touch targets with the shared module
// (hacs/scripts/kontrast_touch.py via regeln.messe_kontrast_touch[_hier]) and writes the areas `kontrast` and `touch`
// into its report; a violation fails the run. compact-contract.py is also a repo CI contract
// (.github/ci-contracts.txt) without regeln.py: there both areas carry a kein_urteil instead of a crash.
// Checked in the source: no browser in the Node run.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');

const lies = (name) => fs.readFileSync(path.join(__dirname, '../docs/render', name), 'utf8');

test('M26 compact-contract measures contrast and touch of its three cards and its dialog', () => {
  const text = lies('compact-contract.py');
  assert.match(text, /regeln\.messe_kontrast_touch_hier\(/, 'no contrast/touch measurement');
  assert.match(text, /kontrast-ausnahmen\.json/, 'exception list of the repo not passed');
  const ziele = text.match(/KT_ZIELE\s*=\s*\{[^}]*\}/);
  assert.ok(ziele, 'KT_ZIELE (measured hosts) missing');
  for (const host of ['codex-arrcompact-seer-card', 'codex-arrcompact-fix-card', 'codex-arrcompact-downloads-card'])
    assert.ok(ziele[0].includes(host), host + ' not measured');
  assert.match(text, /messe_kt\([^)]*'codex-arrcompact-dialog'/, 'open candidate dialog not measured');
});

test('M26 compact-report.json carries kontrast and touch, a violation is exit 1', () => {
  const text = lies('compact-contract.py');
  assert.match(text, /'kontrast':\s*kontrast_touch\['kontrast'\]/, 'report without kontrast');
  assert.match(text, /'touch':\s*kontrast_touch\['touch'\]/, 'report without touch');
  assert.match(text, /regeln\.bewerte\(kontrast_touch\)/, 'violations do not fail the run');
});

test('M26 compact-contract keeps running without regeln.py: kontrast/touch are kein_urteil', () => {
  const text = lies('compact-contract.py');
  assert.match(text, /kontrast_touch\s*=\s*\{bereich:\s*\{'kein_urteil'/, 'no kein_urteil for kontrast/touch without regeln.py');
});

// Run karten-20261124-120007 (37-compact-contract): in light theme the secondary texts (.row-meta, .queue-label,
// queue summary) stood at #727272 on the page background #f2f4f7 (4.3:1), because compact-contract.py defined ha-card
// as a bare element without the card surface. The synthetic page uses render.py's ha-card stand-in (shadow root
// painting --card-background-color, as the real ha-card), so the measurement compares text with the card surface.
test('M26 compact-contract uses the ha-card stand-in of render.py that paints the card surface', () => {
  const text = lies('compact-contract.py');
  assert.doesNotMatch(text, /customElements\.define\('ha-card',\s*class extends HTMLElement\s*\{\s*\}\)/, 'bare ha-card without surface');
  assert.match(text, /html\.index\('class HaCard'\)/, 'ha-card stand-in not taken from render.py PAGE');
  assert.match(lies('render.py'), /class HaCard extends HTMLElement[\s\S]*?background: var\(--ha-card-background, var\(--card-background-color, #fff\)\)/);
});
