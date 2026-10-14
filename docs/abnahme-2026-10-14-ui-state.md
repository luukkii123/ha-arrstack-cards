# UI-Zustand der ARR-Warteschlangen — #256

Geprüfte Kartenfassung 0.6.1 am 14.10.2026. Unabhängige Review nach dem
Fokusfix ohne verbleibende P1/P2-Befunde. Veröffentlichung und Installation
werden im gemeinsamen Auslieferungsbericht separat belegt; keine produktive
Medienaktion wurde für die Abnahme ausgeführt.

## Ursache und Änderung

Die periodischen Queueabfragen riefen `_render()` auf, das den kompletten
Shadow-Root durch `innerHTML` ersetzte. Modellwerte wie Seite und Auswahl
blieben erhalten; DOM-Zustand wie Fokus, aufgeklappte Queuehinweise und
Scrollposition des Listenbereichs ging verloren. Die Downloads-Karte stellte
den Fokus nur für die Schaltfläche „Dateien prüfen" wieder her.

Downloads- und Reparaturkarte gleichen ihr erzeugtes Markup nun mit dem
vorhandenen DOM ab. Queuezeilen werden über ihre `data-item`-ID wiedererkannt;
stabile Zeilen und Controls behalten dadurch ihre Identität bei aktualisierten,
sortierten und entfernten Einträgen. Checkboxwerte werden aus der Auswahl
abgeglichen, offene `<details>`-Abschnitte bleiben geöffnet und Clickhandler
werden idempotent gesetzt. Wenn ein DOM-Move den Fokus eines noch verbundenen
Controls löst, wird dasselbe Element nur dann fokussiert, wenn der aktive Fokus
auf die Karten-/Host-Kette zurückgefallen ist. Ein anderer aktiver Control oder
der außerhalb liegende Importdialog wird nicht überfokussiert. Der Importdialog
bleibt samt ausgewähltem, fokussiertem Kandidaten erhalten.

## Abnahme

- **RED:** Der neue Chromiumvertrag `queue-poll-preserves-page-selection-focus-scroll`
  schlug mit dem alten Renderpfad erwartungsgemäß fehl. Seite und Set-Auswahl
  waren da, fokussierte Checkbox und Scrollposition des Listenbereichs gingen
  verloren. Der zusätzliche Reviewvertrag `queue-keyed-reorder-preserves-focus`
  schlug mit dem unfokussierten DOM-Abgleich im echten Chromium reproduzierbar
  fehl; derselbe Contract prüft nach dem Fix auch das Entfernen einer
  Vorgängerzeile. Beim iterativen Fix deckte eine weitere RED-Probe das
  verlorene `details.open` auf.
- **Node:** `node --check ha-arrstack-cards/dist/arrstack-cards.js`,
  `node ha-arrstack-cards/tests/downloads.test.js`,
  `node ha-arrstack-cards/tests/editor.test.js` und
  `node ha-arrstack-cards/tests/import-seer.test.js` liefen erfolgreich.
- **Chromium:** `ha-arrstack-cards/docs/render/compact-contract.py` prüfte
  wiederholte Queueabfragen, Checkbox/Seite/Scroll/Fokus, offene Details,
  Kandidatenauswahl und Fokus im Importdialog, dynamisches Hinzufügen,
  Sortieren und Entfernen von Zeilen sowie die bestehenden Import-/Dialogfälle.
  Nach dem Review-Fix bestanden lokal 153/153 synthetische Checks, mit 0
  PageErrors, 0 unhandled Rejections und 0 blockierten HTTP-/WS-Schreibversuchen.
  Der unabhängige native HA-Neulauf nach dem Review-Fix und der korrigierten
  Gegenprobe zur tatsächlich vorhergehenden Zeile bestand 170/170 Checks,
  mit 0 PageErrors, 0 unhandled Rejections und 0 HTTP-Schreibversuchen. Die 44 blockierten
  WebSocket-Aufrufe waren ausschließlich `browser_mod/update` des HA-Hosts;
  der ARR-Schreibzähler blieb bei 0. Er verwendete synthetische Medienantworten
  und ein lokales Kandidatenbundle; es wurde kein Dashboard gespeichert und
  keine Medienaktion ausgeführt.
- **Darstellung:** `ha-arrstack-cards/docs/render/render.py` in echtem Chromium
  bei 320, 390, 480 und 960 CSS-Pixeln, jeweils hell/dunkel und mit/ohne
  HA-Design-Tokens: 602 Textprüfungen pro Kartenlauf, 128 Dialog- und 136
  Inlineprüfungen. 0 Überlauf-, Außen-, Überlappungs- oder Textverstöße;
  Selbsttest der Messung und beide Popupverträge bestanden; 0 Konsolen- oder
  Seitenfehler.
- **Bilder:** Der Hauptagent sah die nativen Ansichten `queue320dark`,
  `candidates960light` und `editor390light` an; dabei waren keine sichtbaren
  Layoutprobleme erkennbar.
- **Statisch:** `python3 scripts/ui-regeln-pruefen.py --repo ha-arrstack-cards`
  meldete 0 Verstöße; `git diff --check` blieb leer.

Die gezielten lokalen RED/GREEN-Aufrufe waren:

```bash
docker run --rm \
  -v "/mnt/user/Data/Claude Projekte/hacs:/hacs" \
  -v /tmp/arrstack-focus-red:/out \
  --entrypoint bash hacs-playwright:1.62.0 \
  -c 'python3 /hacs/ha-arrstack-cards/docs/render/compact-contract.py /hacs/ha-arrstack-cards/dist/arrstack-cards.js /out'
```

Der Review-RED-Lauf endete mit Exit 1 am Reorder-Fokustest. Nach dem Patch waren
die finalen Prüfbefehle:

```bash
node --check ha-arrstack-cards/dist/arrstack-cards.js
node ha-arrstack-cards/tests/downloads.test.js
node ha-arrstack-cards/tests/editor.test.js
node ha-arrstack-cards/tests/import-seer.test.js
python3 scripts/ui-regeln-pruefen.py --repo ha-arrstack-cards
docker run --rm \
  -v "/mnt/user/Data/Claude Projekte/hacs:/hacs" \
  -v /tmp/arrstack-focus-green:/out \
  --entrypoint bash hacs-playwright:1.62.0 \
  -c 'python3 /hacs/ha-arrstack-cards/docs/render/compact-contract.py /hacs/ha-arrstack-cards/dist/arrstack-cards.js /out'
docker run --rm \
  -v "/mnt/user/Data/Claude Projekte/hacs/docs/render:/work" \
  -v "/mnt/user/Data/Claude Projekte/hacs/ha-arrstack-cards:/cards" \
  -v /tmp/arrstack-256-render:/out \
  --entrypoint bash hacs-playwright:1.62.0 \
  -c 'python3 /cards/docs/render/render.py /cards/dist/arrstack-cards.js /out 960'
```

Chromiumberichte und Screenshots liegen außerhalb von Git unter
`/tmp/arrstack-256-green`, `/tmp/arrstack-256-render` und
`/tmp/hacs-stability-20261014/arr-native-final`.

## Alle 26 Designregeln

| ID | Status im Änderungsumfang | Anwendbarkeit und Beleg / Grenze |
| --- | --- | --- |
| R01 | erfüllt | Dieselben Queueaktionen und -labels bleiben beim DOM-Abgleich erhalten; Node- und Chromiumverträge. |
| R02 | teilweise | Mehrfachauswahl bleibt modellbasiert; Checkbox-/Bulk-/Shift-Proben im Chromiumvertrag. Keine neue Sammelaktion. |
| R03 | teilweise | Tastaturfokus bleibt auf Checkbox/Prüfaktion; Importdialog-Fokus und bestehender Tab-/Escape-Vertrag geprüft. Screenreader/Shortcuts nicht Teil dieses Fixes. |
| R04 | teilweise | Offener Import- und Bestätigungsdialog überlebt Queuepoll; vorhandener geschützter Dialogvertrag im Renderer. Vollständige Hostnavigation nicht erneut abgenommen. |
| R05 | teilweise | Warteschlangenseite und Dialoginhalte bleiben beim Poll; Browser-Back-Verhalten deckt der bestehende Renderer ab. HA-Deep-Link/Refresh bleibt Hostverantwortung. |
| R06 | erfüllt im geprüften Kartenumfang | 320/390/480/960 px in hell/dunkel; keine Text-/Layoutverstöße. Physische Companion-Touchprobe fehlt. |
| R07 | nicht anwendbar | Lovelace-Karte im HA-/Companion-Host, keine eigene PWA oder eigenes Manifest. |
| R08 | erfüllt | Der gemeinsame Importcontroller und bestehende Dialog bleiben unverändert; Queue- und Reparaturkarte nutzen weiterhin denselben Vertrag. |
| R09 | teilweise | HA-Tokens mit und ohne Tokenpfad, beide Themes; keine vollständige Kontrastmessung aller Hostflächen. |
| R10 | teilweise | Checkboxauswahl bleibt mit dem internen Auswahlmodell synchron. Kein Editor-/Formularverhalten geändert oder neu als native Save-Abnahme geprüft. |
| R11 | teilweise | Poll-/Busy-/Importverträge bleiben grün; keine neue langsame Netzwerk-/Doppelklickprobe außerhalb der synthetischen Suite. |
| R12 | teilweise | Vorhandene Fehler-/Retry-Prüfungen laufen weiter; dieser Fix ändert keine Fehlermeldungen oder Retrylogik. |
| R13 | teilweise | Bestätigungsdialog bleibt nach Queuepoll bestehen; keine Löschaktion ausgeführt. |
| R14 | erfüllt im geprüften Umfang | Seite, Checkboxauswahl und Scroll bleiben beim Poll; synthetische Zeilen wurden hinzugefügt, sortiert und entfernt. Kein Feldbestand mit realen Medien. |
| R15 | nicht anwendbar | Die betroffenen Queuekarten bieten kein Drag&Drop; bestehende Spaltenordnung bleibt unverändert. |
| R16 | teilweise | Fokus, Checkboxsemantik und 320-px-Reflow geprüft; kein Screenreader, echter 200/400-%-Zoom oder vollständiger Kontrastscan. |
| R17 | teilweise | Fokus, Auswahl, disabled/Busy und offene Details geprüft; Status-/Offlinezustände sind keine neue Abnahme dieses Fixes. |
| R18 | teilweise | Bestehende leere, volle, Fehler- und Dialogzustände laufen in vorhandenen Render-/Contractproben; kein echter Offline-/Forbidden-Hosttest. |
| R19 | nicht anwendbar | Keine Browserberechtigungen angefordert. |
| R20 | teilweise | Wiederholte Polls ersetzen stabile Queueknoten nicht mehr unnötig; keine Web-Vitals-Feldmessung oder Lastprofilierung. |
| R21 | erfüllt im geprüften Umfang | Seite, Auswahl, Scroll und offene Details bleiben beim Poll; keine Persistenz über Neuladen oder HA-Neustart versprochen. |
| R22 | teilweise | Checkbox-, Pagination-, Prüf- und Dialogaktionen bleiben sichtbar und bedienbar; keine vollständige Funktionsinventur aller Karten. |
| R23 | erfüllt im geprüften Kartenumfang | Derselbe Queuevertrag bei vier Breiten; die fachliche Bedienung bleibt gleich. |
| R24 | erfüllt | Host-, Screenreader-, physische Touch-, Zoom-, Feldmess- und Offlinegrenzen sind hier benannt. |
| R25 | nicht betroffen | Kein Menü, Settingsbereich oder Editor geändert; bestehender Editorvertrag bleibt separat geprüft. |
| R26 | teilweise | DE/EN Wörterbuch und Beschriftungen unverändert; Renderer prüft beide Editorspracheinstellungen. Keine neue Fachbenennung eingeführt. |
