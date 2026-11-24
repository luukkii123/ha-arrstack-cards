'use strict';
// M79 (#1330, W23): every synthetic render script of the runner (hacs/scripts/karten-runner.json) installs the shared
// ha-icon stand-in of hacs/docs/render/regeln.py, so the images show the real MDI glyphs (measured as non-text contrast,
// 3:1) instead of an empty 24 px box, and writes its state (active, names without a path) into its report.
// compact-contract.py is a repo CI contract (.github/ci-contracts.txt) and must keep running without regeln.py.
// Checked in the source: no browser in the Node run.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');

const RENDER = path.join(__dirname, '../docs/render');
const SKRIPTE = ['render.py', 'visual-contract.py', 'compact-contract.py'];
const lies = (name) => fs.readFileSync(path.join(RENDER, name), 'utf8');

test('M79 every synthetic render script installs the shared ha-icon stand-in and reports it', () => {
  for (const name of SKRIPTE) {
    const text = lies(name);
    assert.match(text, /regeln\.ha_icon_attrappe\(/, name + ': regeln.ha_icon_attrappe missing');
    assert.match(text, /regeln\.ha_icon_fehlend\(/, name + ': regeln.ha_icon_fehlend (report) missing');
  }
});

test('M79 CI contracts keep running without regeln.py (optional import, no verdict instead of a crash)', () => {
  const contracts = fs.readFileSync(path.join(__dirname, '../.github/ci-contracts.txt'), 'utf8')
    .split('\n').filter((line) => line.trim() && !line.startsWith('#')).map((line) => path.basename(line.split(/\s+/)[0]));
  assert.ok(contracts.includes('compact-contract.py'));
  for (const name of contracts) {
    const text = lies(name);
    assert.match(text, /try:\s*\n\s*import regeln[^\n]*\n\s*except ImportError:/, name + ': regeln import is not optional');
    assert.match(text, /kein_urteil/, name + ': no kein_urteil when regeln.py is missing');
  }
});

test('M79 no contrast exception for ha-icon: glyphs are measured with 3:1', () => {
  const liste = JSON.parse(lies('kontrast-ausnahmen.json'));
  assert.ok(!liste.kontrast.some((a) => /ha-icon|busch-icon/.test(a.selektor)), 'kontrast: ha-icon exception present');
});
