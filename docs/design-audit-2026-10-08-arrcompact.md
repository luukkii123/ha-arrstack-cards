# Arrstack Cards · Umsetzung und Laufzeitprüfung vom 08.10.2026

Kandidatenstand 0.5.0, lokal und unveröffentlicht. Umfang: #183 Seer, #184 sichere
Importauflösung und Arrstack-Anteil #156. Freigegebener Plan:
`../docs/superpowers/plans/arrstack-kompakte-karten-import-automation.md` im
HACS-Verwaltungsordner. Die dort benannten Referenz-PNGs sind lokal nicht
vorhanden; übernommen wurde die schriftlich freigegebene kompakte Zielrichtung.

Vor Implementierung wurden alle 26 Regeln auf Anwendbarkeit geprüft. R07
(eigene PWA), R15 (Drag&Drop) und R19 (Browserpermissions) entfallen: die Karte
läuft im HA-Host, bietet keine Ziehaktion und fordert keine Browserberechtigung.
Die übrigen Regeln sind im betroffenen Karten-/Editor-/Dialogumfang anwendbar.
R04 hat ausdrücklich Vorrang vor der älteren pauschalen Scrim-Schließregel.
Die strengere HACS-Mobile-Regel bleibt erhalten: ein kompakter Desktopdialog
wird unter 450 px zum mobilen Vollbild mit festen unteren Aktionen.

## Tatsächlich ausgeführte Nachweise

- **E01** Node im vorhandenen Playwright-Container: Parserprüfung,
  `tests/editor.test.js`, `tests/import-seer.test.js`. Import-/Suchregressionen
  mit 20/50/99/100 %, eindeutigem Kandidat, frischer `skipped`-Antwort und
  veralteter Dateiauswahl, eingeklappten Rohfehlern und Such-Doppelausführung.
  Die Importbereitschaft und der stale-Kandidat-Gegenbeleg waren vor dem Fix rot.
- **E02** `../scripts/ui-regeln-pruefen.py --repo ha-arrstack-cards`: 0 Verstöße.
- **E03** `docs/render/render.py`: echter Chromium, alle vier Karten bei
  320/390/480/960 px in Hell/Dunkel mit/ohne HA-Tokens. Textmessung, drei
  Dialoge, Escape/Back/Schließen/Stacking/Außenklick und zweisprachige Editorfelder;
  0 Überlauf, außerhalb, Überlappung oder Verletzung. Werkzeug-Gegenproben grün.
- **E04** `docs/render/compact-contract.py`: derselbe lokale Kandidat zusätzlich
  im echten HA-Frontend am vorhandenen Testdashboard. Browserlokale Montage;
  synthetische Medienantworten und Actions. Native Mode sperrt HTTP-Schreibzugriffe
  sowie mutierende WS-Kommandos vor der Navigation. Finaler Lauf: 68 bestandene Checks, 52 geblockte autonome WS-Schreibversuche,
  0 HTTP-Schreibversuche, 0 PageErrors und 0 unhandled Rejections. Details
  stehen im privaten Report. Kein Dashboard-/Ressourcen-Save
  und keine echte Medienaktion gehören zu diesem Lauf.
- **E05** Native Screenshots von Ergebnissen, Importlisten und Staffelwahl in
  Hell/Dunkel bei allen vier Breiten sowie Fehlerdarstellung wurden angesehen.
  Listen behalten kompakte Poster, eine Textkante, lesbare Statusbadges und
  zurückhaltende Aktionen; Details beginnen eingeklappt. Private Hostbilder
  bleiben außerhalb des Repositories.
- **E07** `docs/render/visual-contract.py`: 28 Prüfgruppen bestanden, aktualisierte
  und angesehene synthetische Baselines für 320/390/480/960 in Hell/Dunkel.
  Das neue editorseitige Seitengrößenfeld erweitert den Vertrag auf 21 Felder.
- **E06** Zentrales `../docs/render/proben/scrim-probe.py`: acht Gegenproben,
  darunter geschützte und absichtlich verletzte Bearbeitung/Bestätigung,
  Altvertrag für Ansichten/Dirty-Formular und mobiles `kein_urteil`.

## Alle 26 Regeln

| ID | Status | Anwendbarkeit, Nachweis und Grenze |
| --- | --- | --- |
| R01 | erfüllt im Änderungsumfang | E01–E05: gleiche kompakten Primitives, DE/EN-Labels, Fehlerdarstellung und Importactions für Sonarr/Radarr. Individueller Titel bleibt erhalten. |
| R02 | erfüllt im Änderungsumfang | E04: sichtbare Checkboxen, Ctrl/Cmd-Umschaltung, Shift-Bereich, Auswahlanzahl und Auswahlimport. Keine Sammelaktion für Medienwünsche erzwungen. |
| R03 | teilweise | E03/E04: Enter an Suche/Ergebnis, native Buttons, Escape, Tab-Zyklus und Fokus. Keine aufklappbare Baumstruktur für Shift+Plus/Minus. Screenreaderprüfung fehlt. |
| R04 | erfüllt im Änderungsumfang | E03/E04/E06: Außenklick ignoriert auch clean; dirty Escape/Back bietet Behalten/Verwerfen, Auswahl bleibt; Focus Trap/inert/Focus Return; laufende Aktion blockiert Abbruch. |
| R05 | teilweise | E03/E04: Back bleibt auf derselben Adresse, eigener Close entfernt aktiven History-Eintrag, Dirty Back schützt. HA-Deep-Link/Refresh/Forward-Routing ist Hostvertrag; kein eigener Kartenrouter. |
| R06 | erfüllt im Änderungsumfang | E03–E05: 320/390/480/960 Hell/Dunkel, keine horizontale Scrollpflicht, sichtbare Touchaktionen mindestens 44 px; mobile Dialoge folgen HACS-Vollbildregel. Keine physische Companion-Geste gemessen. |
| R07 | nicht anwendbar | HA/Companion übernimmt PWA; kein eigenes Manifest oder Installationsversprechen. |
| R08 | erfüllt im Änderungsumfang | E01/E03/E04: zentraler Dialog, errorMarkup, Status-/Bereitschaftslogik, gleicher API-Vertrag je Dienst; Geschäftslogik bleibt im Backend. |
| R09 | teilweise | E02–E05: gemeinsame HA-Tokens, Shell, Status-/Actions, geprüfte Hell/Dunkel-Bilder. Keine vollständige Kontrastmessung jeder geerbten Hostfläche. |
| R10 | erfüllt im Änderungsumfang | E01/E03/E04: Label/Helper für alle Konfigurationsfelder, fehlende Staffelauswahl deaktiviert Anfrage; Candidate-Auswahl bleibt bei Fehler, explizites Dirty-Discard. |
| R11 | erfüllt im Änderungsumfang | E01/E04: Suche/Details laden, Import-/Requestbusy, disabled Aktionen, Ergebnisfeedback und Refresh nach Aktion; langsame doppelte Suche sendet genau einmal. |
| R12 | erfüllt im Änderungsumfang | E01/E04/E05: verständlicher Fehler mit nächster Aktion, Retry, Rohdetails eingeklappt, Eingabe/Dateiauswahl bei Fehler erhalten; stale skipped aktualisiert Dialog und deaktiviert alten Import. |
| R13 | teilweise | E03/E04: Löschbestätigung benennt konkrete Datenwirkung/Objekt, Abbruch erreichbar und Scrim geschützt. Keine tatsächliche Client-/Dateilöschung ausgeführt. |
| R14 | erfüllt im Änderungsumfang | E04: Queue-Pagination (Default 5, editierbar), Ergebnis-/Queueanzahl, Auswahl/Bulk; Weiter/Zurück erhält sichere Auswahl. Backend liest vollständige Queue. Suchergebnisse begrenzt über vorhandenes max_items-Feld. |
| R15 | nicht anwendbar | Kein Drag&Drop in den betroffenen Karten. |
| R16 | teilweise | E03–E05: Semantik, sichtbarer Fokus, Touchgrößen, Reflow bei 320 px, Reduced-Motion-Regel; kein Screenreader und keine echte 200/400-%-Zoom-/Gesamtkontrastabnahme. |
| R17 | erfüllt im Änderungsumfang | E01–E05: selected/disabled/loading/success/error und Warnstatus mit Text; nur fertige relevante Downloads zeigen Kandidatenstatus. |
| R18 | teilweise | E03/E04: leer, voll, laufend, Such-/Queuefehler und Kandidaten-Teilstati; kein separater physischer Offline-/Companion-Test. Bekannte HA-Rechte-/Instanzfehler werden lokal erklärt. |
| R19 | nicht anwendbar | Keine Browserberechtigungsanfrage. |
| R20 | teilweise | E01/E04: Duplikatsperren und 5-Zeilen-Pagination begrenzen unnötige UI-Arbeit. Keine Web-Vitals-Feldmessung. Kandidateninspektion bewusst serverseitig. |
| R21 | erfüllt im Änderungsumfang | E01/E04: Suchtext, Auswahl und Pagination bleiben bei Aktionen/Refresh soweit IDs weiterhin sicher bereit sind. Keine Speicherung sensibler Auswahl über HA-Neustart zugesagt. |
| R22 | erfüllt im Änderungsumfang | E03–E05: Suche, Anfrage, Prüfen/Auswahl, Import, Bulk, Pagination und Löschabbruch sichtbar; Kernfunktionen nicht nur per Hover/Geste. |
| R23 | erfüllt im Änderungsumfang | E03–E05: derselbe Dialog und dieselbe Validierung, Desktop kompakt/mobile Vollbild. |
| R24 | erfüllt im Änderungsumfang | Ausnahmen R07/R15/R19 und Host-/Messgrenzen oben benannt; R04-Konflikt explizit aufgelöst. |
| R25 | teilweise | E02/E03: konfigurierte Titel/Instanz/Dienst/Refresh/Anzahl im vorhandenen ha-form-Editor samt DE/EN-Erklärung; kein neuer Editorflow, bestehende native Editor-Speicherprüfung nicht in diesem Änderungslauf wiederholt. |
| R26 | erfüllt im Änderungsumfang | E01–E05: deutsche UI, DE/EN-Wörterbuch, Sonarr/Radarr/Seer und Quality/Language-Fachdaten bleiben verständlich; kein Raw-JSON im Standardinhalt. |

Die Matrix beansprucht keine vollständige WCAG-/PWA-/Host-Gesamtabnahme. Lokale
Laufzeitberichte und Screenshots sind erzeugte Prüfartefakte; Veröffentlichung,
Installation und tatsächlich installierter Stand werden separat koordiniert.
