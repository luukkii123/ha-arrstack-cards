# Warteschlangenlayout 0.6.0 — lokale Abnahme

Freigegebene Zielrichtung: Poster bleiben sichtbar, breite Titelspalte,
Status/Episode/Restzeit/Fortschritt und dezente Prüficonaktion rechts.
Kartenbreite bestimmt Tabellen-/Stackdarstellung; `max_items` ist Seitengröße.
Spalten sind eine gültige geordnete Arraykonfiguration. Sichtbarkeit über
`ha-form`, Reihenfolge über native Hoch-/Runteraktionen ohne Dragpflicht.
Konkrete Importfehler erscheinen am Eintrag; zusätzliche Queuegründe sind
über Importhinweise aufklappbar. Die gemeinsame Importlogik
bleibt unverändert sicher und Fehler-/Skipped-Zählung ist disjunkt.

Vor Implementierung: zentrale Richtlinien vollständig gelesen, bestehende
Marke/HA-Tokens/BuschUI und Glossar erhalten. Nutzer korrigierte den zuerst
vorgeschlagenen Default ausdrücklich zu **mit Postern**. R04 hat weiter
Vorrang vor historischer Außenklickregel. Keine produktiven Medienwrites.

## Anwendbarkeit aller 26 Regeln vor Edit

| ID | Anwendbarkeit / vorgesehener Nachweis |
| --- | --- |
| R01 | Gemeinsamer Importdialog, gleiche Bedeutung der Prüfaktion. |
| R02 | Downloads Einzelprüfung; Bulk bleibt bestehende separate Fix-Karte. Keine neue Sammelaktion. |
| R03 | Enter/Space, Pager und native Spalten-Hoch/Runter; Fokus nach Poll/Dialog. |
| R04 | Geschützter Importdialog, Dirty/Escape/Back, Busy und Fokusreturn. |
| R05 | Bestehende Dialoghistory beibehalten, Configroute gepinnt. |
| R06 | 320/390/480/960 Hell/Dunkel und Karte500 in breitem Viewport. |
| R07 | Nicht anwendbar: HA-Karte ohne eigene PWA. |
| R08 | Importbasis unverändert geteilt; Spaltenmetadata zentral für Editor/Rendering. |
| R09 | HA-Tokens, vorhandene Icons; keine globale Umgestaltung anderer Karten. |
| R10 | native ha-form Sichtbarkeit; immutability/echo/Datenerhalt und Defaults. |
| R11 | Loading/Busy/Erfolg/Fehler, kein Doppelimport. |
| R12 | Einzelfehler direkt lesbar, Queuegründe explizit aufklappbar, technische Fehler nur Details. |
| R13 | Kein neuer destruktiver Vertrag; Prüfung liest und Import bleibt explizit. |
| R14 | Pagination und Ergebnisanzahl, Seite bei geschrumpfter Queue begrenzen. |
| R15 | Kein Drag&Drop; Hoch/Runter tastatur-/touchbedienbar. |
| R16 | Semantik/Fokus/Label/44px, Reflow prüfen; Screenreader/Feldmessgrenzen nennen. |
| R17 | Disabled/Busy/Focus/Success/Error bewusst prüfen. |
| R18 | Leer/Loading/Fehler/Teildaten ohne Fantasiewerte. |
| R19 | Nicht anwendbar: keine Browserpermission-Anfragen. |
| R20 | Vorhandener Poll, begrenzte sichtbare Rows; keine p75-Feldbehauptung. |
| R21 | Spalten/Poster/Seitenumfang persistente HA-Config, Seite bleibt beim Poll. |
| R22 | Rechte sichtbare Prüficonaktion mit Label/Tooltip; keine Hoverpflicht. |
| R23 | Gleiches fachliches Grid, narrow mit kompakter Metazeile/Querbar; opt-in Details bei vielen Spalten. |
| R24 | Bestehende Host-/Screenreader-/Zoom-/Poll-Grenzen ausdrücklich nennen. |
| R25 | Editor in Auswahl und progressive Reihenfolge gruppieren; optionale Spalten. |
| R26 | DE/EN Labels/Helper und verständliche Importfehlersätze. |

## Prüfschritte

RED zuerst: `tests/downloads.test.js` fehlt direkt sichtbarer Queuegrund;
`tests/editor.test.js` erhält ungültige/doppelte Spalten statt Normalisierung.
Beide gezielt gegen 0.5.1 tatsächlich fehlgeschlagen, bevor Produktänderungen.
Weitere Ergebnisse werden nach tatsächlichen Läufen ergänzt.

## Tatsächlich bestandene Abnahme

- `tests/downloads.test.js`, `tests/editor.test.js`,
  `tests/import-seer.test.js` und `node --check` frisch grün. Spaltenfolge,
  unbekannte/doppelte IDs, leere Defaults, Poster/Legacy-Konfiguration,
  Seitengröße 200, schrumpfende Queue und disjunkte Fehlerzählung geprüft.
  Gemeinsame Sicherheits-/Instanz-/Busy-/Seer-Verträge bleiben grün.
- Statische UI-Regeln: 0 Verstöße. `git diff --check`: 0.
- Generischer Chromiumrenderer: beide Kartengruppen je 602 Textprüfungen,
  Dialog 128 und Inline 136; überall 0 Überlauf-/Außerhalb-/Überlappungsbefunde.
  Zehn Popupprüfungen, Selbsttest sowie DE/EN-Labels/Helper aller vier Editoren
  grün. Drei requests, 0 schlechte Antworten, Konsole und Pageerrors 0.
- Native HA-Prüfung im vorhandenen Testdashboard: 159/159 Checks, 0 Pageerrors,
  0 Rejections und 0 HTTP-Schreibversuche; 46 autonome WS-Schreibversuche
  geblockt. Guard greift vor Navigation. Medienantworten und Importaktionen
  ausschließlich synthetisch, kein produktiver Import und kein Speichern.
- Ergänzende echte native Spaltenpickerprobe: 4/4, 0 Pageerrors/Rejections/HTTP,
  7 autonome WS-Schreibversuche geblockt. Über **Sichtbare Spalten** wurde
  **Qualität** tatsächlich aus dem HA-Picker ausgewählt und anschließend über
  die echte Chip-Entfernenaktion entfernt. Beide `config-changed`-Ergebnisse,
  Formularstand und erhaltener Posterdefault geprüft; keine künstliche
  `value-changed`-Nachbildung für diese Laufzeitabnahme. Das zunächst erwartete
  ARIA-`option` existiert dort nicht: HA verwendet `ha-combo-box-item`;
  der Test klickt dessen eindeutigen sichtbaren Text.
- Echter HA-Editor: native `ha-form`/Selectors über HA-Kartenhelfer geladen,
  Hoch mit Enter, Runter mit Space, hass-Update-/Echo-Fokus, alle vier Breiten
  in Hell/Dunkel geprüft. Unabhängiger Reviewer reproduzierte den früheren
  Shadow-DOM-Fokusverlust und bestätigte danach denselben erhaltenen Button,
  Localewechsel und Fokus nach Hoch/Runter. Identische fachliche Dialogfehler
  erscheinen genau einmal.
- Native Karten: 320/390/480/960 Hell/Dunkel, vollständige acht Fixturezeilen;
  Capturemetriken halten Höhe/Zeilenzahl fest. Zusätzliche echte Kartenbreite
  500 bei Viewport 960 beweist Containeranpassung und kompakte Metazeile.
  Die gemeinsame 44-px-Titel-/Aktionszeile verhindert Kollisionen mit den
  Metadaten. Autor und Hauptagent haben die finalen 320-Dunkel-, 500-Dunkel-
  und Desktopansichten angesehen. Native 390-Hell-Editor und direkte Fehler-
  ansicht ebenfalls vom Autor angesehen.
- Vorher: dieselben erfundenen Medien mit archiviertem 0.5.1-Bundle nativ
  aufgenommen; 96 vorhandene Dialog-/Layoutchecks grün. Nachher: oben genannte
  geprüfte 0.6.0-Ansichten. Private Verzeichnisse `queue-table-before-final`,
  `queue-table-required`, `queue-table-selector-final` und
  `queue-table-render-required` enthalten die Reports/Bilder; nicht im Git.
  Frühere geclippte Captureversuche gelten ausdrücklich nicht als Abnahme.
- Visualvertrag: 28 Prüfgruppen, 0 Befunde nach bewusstem Aktualisieren der
  acht Gesamtbilder und acht Editorbilder. Beide Bildgruppen änderten sich
  erwartbar wegen Queuelayout bzw. Spalten-/Unknown-Feldern. Repräsentative
  Raster 320-Dunkel/960-Hell und Editor 320-Hell/960-Dunkel angesehen; Geometrie
  in allen acht Theme-/Breitenkombinationen gemessen. Der Editor-Rasterrenderer
  ist eine Attrappe; native Chips-/Picker-/Keyboardbelege stehen separat oben.

## Grenzen und fachliche Ausnahmen

R07/R19 sind nicht anwendbar; R02 erzwingt keine neue Downloads-Sammelaktion,
weil die vorhandene Fix-Karte dafür weiterhin die gemeinsame sichere Logik
nutzt. R15 ist ohne Dragfunktion erfüllt durch native Hoch-/Runteraktionen.
R16 bleibt teilweise: ARIA-Table/Row/Cell und zugängliche Labels sowie echter
Tastatur-/Reflow-/Fokusnachweis sind vorhanden, aber kein Screenreader,
physischer Companion-Touch, tatsächlicher 200/400-%-Zoom oder umfassender
Kontrastscan. R20 ist teilweise: keine p75-Web-Vitals-Feldmessung. Keine eigene
PWA-/Offline-Synchronisationszusage. R18 zeigt fehlende optionale Metadaten
als „—“, statt Werte zu erfinden; die neuen Felder brauchen Integration 0.4.1.

R05/R21: Spalten-/Poster-/Unknown-/Seitenumfang leben in persistenter
HA-Konfiguration, die Seite bleibt beim Poll; keine neue browserweite
Persistenz. Die bestehende Grenze bei überlappendem `_load` bleibt: ein schon
laufender Poll kann den danach angeforderten Reload zusammenfassen und bis
zum nächsten Poll ältere Queueinformationen zeigen. Backend-Revalidierung
vor Import bleibt verbindlich; dieser Auftrag verändert keine Pollarchitektur.
Keine globalen Styles anderer Karten oder produktiven Ressourcen verändert.

Datenschutzprüfung vor Commit: Index und Historie prüfen; keine privaten
Screenshots/Reports, Credentials, realen Mediennamen oder Dienstpfade stagen.
Veröffentlichung/Installation durch die Hauptkoordination, separat von dieser
lokalen Kandidatenabnahme.
