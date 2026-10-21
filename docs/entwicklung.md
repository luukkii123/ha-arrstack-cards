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
```

## Renderprüfung (Chromium, erfundene Daten)

`docs/render/render.py` lädt das Bundle in Chromium (Playwright), ersetzt
`ha-card`/`ha-icon`/`ha-form` durch Attrappen und beantwortet `callWS` mit
erfundenen Daten; weder Medien-Stack noch Schlüssel nötig. Die Titel sind
absichtlich zu lang, um das Kürzen zu prüfen. Es misst Textüberlauf bei
320/390/480/960 px, hell/dunkel, mit und ohne HA-Tokens sowie das Schließen
der Dialoge (Escape, Zurück, Schließen, geschützter Außenklick).

Hinweis: `render.py` bindet das Messmodul `regeln.py` ein, das nicht in diesem
Repo liegt (es gehört zur Verwaltungsumgebung des Autors); ohne es läuft das
Skript nicht.

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
  kompakte Queue und Importdialoge.
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
