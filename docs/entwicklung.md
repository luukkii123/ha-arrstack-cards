# Entwicklung

## Aufbau

- `dist/arrstack-cards.js` ist Quelltext und Auslieferung in einem: Vanilla-JS
  mit Custom Elements, kein Bundler, keine Abhängigkeit. HACS liefert für ein
  Dashboard-Repo genau diese eine Datei aus, Unterordner erreichen den Browser
  nie. Alles, was eine Karte braucht, steht in der Datei.
- `CARD_VERSION` in der Datei muss zum Tag passen (prüft der Release-Workflow).
  HACS liest den Tag, nicht `main`.
- Karten sprechen nie direkt mit Sonarr/Radarr/SABnzbd/Jellyseerr, sondern per
  `hass.callWS({ type: "arrstack/…" })` mit der Integration. Grund:
  Jellyseerr setzt keine CORS-Header, und der API-Schlüssel gehört nicht in den
  Browser.
- Jede Karte hat ein eigenes Wörterbuch (`TEXTE_ARRSTACK_*`, de/en) und ein
  Editor-Schema (`SCHEMA_ARRSTACK_*`); jedes Feld braucht Beschriftung und
  Erklärung in beiden Sprachen.
- Dienst-Logos kommen von `brands.home-assistant.io` und liegen nicht im Repo.
  Für Seerr gibt es dort kein Zeichen (die Adresse liefert trotzdem HTTP 200 mit
  einem Platzhalterbild), deshalb nutzt die Seer-Karte ein eigenes
  Qualle-Symbol.

## Tests

```bash
node --check dist/arrstack-cards.js
node tests/editor.test.js
node tests/downloads.test.js
node tests/import-seer.test.js
node --test tests/*.test.js   # alle, auch poster.test.js und xss.test.js
```

`tests/xss.test.js` rendert jede Karte mit den Payloads aus `XSS_PAYLOADS` in
jedem Textfeld. Der CI-Schritt „Sinks“ meldet jede HTML-Senke mit `${…}` ohne
`escapeHtml(` und ohne Markierung `// sink-ok: <Grund>`.

## Renderprüfung (Chromium, erfundene Daten)

`docs/render/render.py` lädt das Bundle in Chromium (Playwright), ersetzt
`ha-card`/`ha-icon`/`ha-form` durch Attrappen und beantwortet `callWS` mit
erfundenen Daten; weder Medien-Stack noch Schlüssel nötig. Die Titel sind
absichtlich zu lang, um das Kürzen zu prüfen. Es misst Textüberlauf bei
320/390/480/960 px, hell/dunkel, mit und ohne HA-Tokens sowie das Schließen
der Dialoge (Escape, Zurück, Schließen, geschützter Außenklick).
Die Dialoge (Prüfen, Löschen) misst es zusätzlich bei 360 px (Regel 1),
bei allen Breiten auf Kontrast/Touch und Regel 2 auch bei 360/390 px; die
Dialogbilder entstehen bei 360/390 px hell und dunkel. `visual-contract.py` misst die Editoren auch bei
360 px mit Regel 1 und Kontrast/Touch, `compact-contract.py` den
Importfehler-Dialog bei 360/390 px (M76).

Hinweis: `render.py` bindet das Messmodul `regeln.py` ein, das nicht in diesem
Repo liegt (es gehört zur Verwaltungsumgebung des Autors); ohne es läuft das
Skript nicht. `ha-icon` kommt dort als gemeinsame Attrappe
(`regeln.ha_icon_attrappe`, echte MDI-Glyphen aus `mdi-pfade.json` neben
`regeln.py`); die Kontrastmessung prüft die Symbole mit 3:1 (M79), und
`report.json` meldet unter `ha_icon`, ob die Attrappe aktiv war und welche
Namen ohne Pfad blieben. `visual-contract.py` und `compact-contract.py` nutzen
dieselbe Attrappe; ohne `regeln.py` (Repo-CI) entfällt nur diese Prüfung
(`kein_urteil`). `tests/render-ha-icon.test.js` sichert das im Quelltext.

```bash
docker run --rm \
  -v "$PWD:/cards" \
  --entrypoint bash mcr.microsoft.com/playwright/python:v1.62.0-noble \
  -c 'pip install --quiet --break-system-packages playwright==1.62.0 >/dev/null; \
      python3 /cards/docs/render/render.py /cards/dist/arrstack-cards.js \
              /cards/docs/render/ergebnis'
```

Weitere Skripte in `docs/render/`:

- `visual-contract.py <ergebnis> [--record]` vergleicht Geometrie und die
  PNG-Baselines in `docs/render/baselines/ui-0.1.0/` (Editorbilder nutzen eine
  `ha-form`-Attrappe).
- `compact-contract.py <bundle> <ausgabe> [zugangsdaten.json]` prüft die
  kompakte Queue und Importdialoge. Mit `regeln.py` misst es auf der
  Attrappenseite Kontrast und Touchziele der Karten und Dialoge
  (`compact-report.json`, Bereiche `kontrast`/`touch`, Verstoß = Exit 1);
  ohne `regeln.py` (Repo-CI) stehen beide als `kein_urteil` (M26).
- `live-ha-native.py <bundle> <zugangsdaten.json> <dashboard> <ausgabe>` prüft
  die echten `ha-form`-Editoren in einem laufenden Home Assistant mit einem
  vorübergehenden, versteckten Admin-Testdashboard
  (`live-ha-native-dashboard.json`, synthetische Konfiguration). Die
  Zugangsdatei (`base_url`, `token`) liegt außerhalb des Repos und gehört nie
  hinein. Das Testdashboard danach löschen.

## Bekannte Grenzen

Nicht nachgewiesen sind Screenreader-Verhalten, physische PWA-/Companion-App,
echter Browserzoom und vollständige Kontrastmessung aller Hostflächen. Beim
Öffnen des nativen Karteneditors kann in manchen HA-Frontends ein
`lit-virtualizer`-Registrierungskonflikt auftreten, der nicht von dieser Karte
stammt.

## Geprüft

**24.11.2026 · 0.10.1, Nachholetappe J (#1330, Tag `v0.10.1`)** — echte MDI-Symbole in den Renderskripten (M79), Abstand Symbol→Titel 12 px (M61); Baselines nach Sichtprüfung neu. Abschlusslauf `karten-20261124-104659-fea696` grün (58/58, Volllauf, 2752 Node-Tests), `--beleg-pruefen` gleich; Bilder am Bild geprüft (Sonnet).

**20.11.2026 · 0.10.0, Buschcheck Etappe I (#1324, Tag `v0.10.0`)** — Kopfkommentar mit Test (M73), Seer-X ≥ 3:1, gewählte Staffel mit Rahmen, Fokus-Token, Shared UI 0.5.3, CI aus der Vorlage (M45). 174 Node-Tests; Baselines nach Sichtprüfung neu. Abschlusslauf `karten-20261119-234243-239269` grün (57/57, Volllauf, 2700 Node-Tests, Block `statisch` grün inkl. CI-Vorlage und Zeilenlänge), `--beleg-pruefen` gleich; Bilder am Bild geprüft (Sonnet).

**19.11.2026 · 0.9.0, Buschcheck Etappe H (#1314, Tag `v0.9.0`)** — Shared UI 0.5.0: Zustandsbaustein (M27), `.busch-btn`/Chips/Hinweis (M62), Tokens (M63), Kopf Stufe 1 (M61), Dialoge über dialogHistory/focusTrap (M28), ein Zeilenraster für alle Listen, Status mit Symbol, Umlaute (M59), `BuschUI.register` (M42), Kontrast/Touch (M26). 164 Node-Tests; Baselines nach Sichtprüfung neu. Abschlusslauf `karten-20261119-195834-aaec84` grün (55/55, 2590 Node-Tests, Block `statisch` grün, Kontrast/Touch gemessen), `--beleg-pruefen` gleich; Bilder zweimal am Bild geprüft (Sonnet), Befunde behoben.

**19.11.2026 · 0.8.0, Buschcheck Etappe G (#1308, Tag `v0.8.0`)** — Editoren mit „Automatisch“, Kartenname als Überschrift, Spaltenreihenfolge nur bei gewählten Spalten (M32; Baselines nach Sichtprüfung neu); Tabellenzellen ohne aria-label (M58). 136 Node-Tests. Abschlusslauf `karten-20261119-141846-b2547c` grün (43/43, 948 Node-Tests, Block `statisch` grün), `--beleg-pruefen` gleich; Bilder zweimal am Bild geprüft (Sonnet), Mängel bei 320 px behoben, sonst Rauschen.

**19.11.2026 · 0.7.1, Buschcheck Etappe F (#1302, Tag `v0.7.1`)** — Fix-Karte erkennt Probleme jenseits der ersten Queue-Seite (bei > 200 Einträgen Scan im Takt, M13-Rest); Statustexte nur aus eigenen Tabelleneinträgen (`Object.hasOwn`, M19-Rest). 124 Node-Tests. Abschlusslauf `karten-20261119-114355-b75c2d` grün (52/52, 1492 Node-Tests, Block `statisch` grün), `--beleg-pruefen` gleich; Bilder gegen den Vorlauf am Bild geprüft (Sonnet), Markenlogo-Rauschen gegen Zwischenlauf `karten-20261119-112024-405e84` gegengeprüft.

**18.11.2026 · 0.7.0, Buschcheck Etappe D (#1286, Tag `v0.7.0`)** — Abrufgeneration: Schreibaktionen verwerfen ältere Abrufe (M13); kein Abruf im verborgenen Tab, einmal beim Sichtbarwerden; Fix-Karte prüft Importe nur beim Öffnen, auf Knopfdruck, nach Aktionen und bei neuem Problem; Karten einer Instanz teilen Abrufe; Fehlerpause bis 10 min; Zeitgrenze 15 s (Listen) bzw. 30 s (Aktionen, ohne Wiederholung) mit „Erneut versuchen“, „Stand vor N Min.“ im Kopf (M34). 121 Node-Tests. Abschlusslauf `karten-20261118-181023-bd0060` grün (49/49, 1235 Node-Tests, Block `statisch` mit `sinks` grün), `--beleg-pruefen` gleich; Bilder gegen Etappe C am Bild geprüft (Sonnet), Abweichungen nur Rauschen (Uhrzeit, Kacheln, Markenlogo aus dem Netz, gegen Zwischenlauf `karten-20261118-173114-993d7a` gegengeprüft).

**18.11.2026 · 0.6.3, Buschcheck Etappe C (#1276, Tag `v0.6.3`)** — Poster- und Logo-Fallback per Listener statt Inline-`onerror` (M47), README „Datenschutz“; XSS-Payloadtests für vier Karten und CI-Schritt Sinks (M19); Shared UI 0.4.0. Sichtbar unverändert. 111 Node-Tests (1 TODO). Abschlusslauf `karten-20261118-143236-199107` grün (55/55, 2159 Node-Tests, Block `statisch` mit `sinks` grün), `--beleg-pruefen` gleich; Bilder gegen Etappe B am Bild geprüft (Sonnet), Abweichungen gewollt oder Rauschen (Uhrzeit, Kacheln, Markenlogo aus dem Netz).

**18.11.2026 · main nach 0.6.2, Buschcheck Etappe B (#1270, kein Tag)** — 74 benannte Einzeltests statt 5, Sortierung, seer_status, abgelehntes callWS (M41); Testkit, Rennen M13 als TODO rot (M5). 76 Node-Tests (1 TODO); dist unverändert. Abschlusslauf `karten-20261118-131312-6dd1c4` grün (51/51, 1003 Node-Tests, Block `statisch` grün), `--beleg-pruefen` gleich; Bilder gegen Etappe A: 1836/1901 bytegleich, Rest Uhrzeit-/Animationsrauschen.

**12.11.2026 · 0.6.2, Kartenwähler ohne Live-Vorschau (#1011, Tag `v0.6.2`)** — vier Karten: Beschreibung je ein Satz mit Verb; `getStubConfig` liest `hass` nicht (Test).

1. `node --check` grün; neue Tests `tests/kartenwaehler.test.js` (preview false, ein Satz Beschreibung de/en, höchstens ein Durchlauf je Register, kein Netz) zuerst rot, danach grün.
2. `python3 scripts/ui-regeln-pruefen.py`: 0 Verstöße, mit der neuen Prüfung R3.6 (Kartenwähler-Vertrag), die vorher für dieses Repo rot war.
3. Einziger Abnahmelauf `karten-alle.sh` für alle fünf geänderten Kartenrepos (Lauf `karten-20261112-175558-77c23e`): 5/5 Schritte grün, Node 5 Testdateien grün, 91 Bilder.
4. Eintrag in `docs/stand.md` der Projektverwaltung, Block 12.11.2026 (#1011).

