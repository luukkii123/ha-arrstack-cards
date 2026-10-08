# Geprüft — 08.10.2026 · Warteschlangen-Reparatur 0.5.1

Die sichtbare Downloads-Karte hatte bisher keine Importaktion; nur die
separate Fix-Karte war angebunden. Fertige problematische Sonarr-/Radarr-
Einträge bieten jetzt **Dateien prüfen**. Diese Aktion öffnet denselben
inhaltshohen geschützten Dialog und führt ausschließlich `inspect_import`
aus. Erst die ausdrückliche Importaktion schreibt über `import_item`.

Der Einzelimport-Controller ist aus der Fix-Karte in eine gemeinsame Basis
verschoben, einschließlich DE/EN-Texten, Kandidatenwahl, Fehlern, Busy und
frischer Backend-Revalidierung. Kein Pfad-/Dateinamensraten und kein zweiter
Importalgorithmus. Die Sichtbarkeit braucht positive Queue-ID, Arr-Dienst,
`completed`, ausdrücklich `sizeleft == 0`, mindestens 100 % und das bereits
serverseitig gelieferte `is_problem`. Gerundete 100 % mit Restbytes, fehlende
Restgröße, laufende Downloads und SABnzbd bekommen keinen Prüfknopf.

Der offene Importdialog bindet seine Instanz vor der ersten Anfrage; eine
spätere Kartenkonfiguration kann gleiche numerische Queue-IDs nicht auf eine
andere Instanz umlenken. Busy gilt bis zur Queue-Aktualisierung, dann wird der
Erfolgsdialog geschlossen. Polling erhält den Fokus am erneuerten Prüfknopf
nach dem DOM-Layout und verdrängt keinen zwischenzeitlich gesetzten Fokus.
Verschwindet der erfolgreiche Eintrag, kehrt der Fokus zur Karte zurück.

## Nachweise

- Node: Syntax, `tests/editor.test.js`, `tests/import-seer.test.js`, grün.
  Der fehlende Queuebutton und die Instanzumleitung waren zuerst rot.
- Native Queue-Gegenproben: Pollfokus, Fokusdiebstahl und Busy während einer
  verzögerten Queue-Aktualisierung waren zuerst rot; nach gezielten Fixes grün.
  Die entfernte Queuezeile besitzt einen eigenen Rückfokus-Gegenfall.
- `docs/render/render.py`: alle vier Karten und die neue problematische
  Queuezeile, 320/390/480/960 Hell/Dunkel, mit/ohne HA-Tokens; 0 Textverstöße,
  zehn Popupchecks grün. Selbsttest und DE/EN-Editorvertrag grün.
- `docs/render/compact-contract.py`: vorhandenes echtes HA-Testdashboard,
  umbenannter Browserkandidat, ausschließlich erfundene Medien/Actions,
  HTTP-/WS-Schreibschutz vor Navigation. Queue-Enter/Space prüft ausschließlich,
  fertige/unfertige/gerundete100/SAB/Entry-only- und Radarr-Verträge,
  Scrim/Tab/Dirty-Escape/Back, Fehlerauswahl, Busy, Slowreload und Fokusrückgabe.
  Finaler Lauf: 138/138 Checks, 0 PageErrors, 0 Rejections, 0 HTTP-Schreibversuche; 42 autonome WS-Schreibversuche wurden geblockt. Der Report steht privat in `queue-ui-native/compact-report.json`.
- Allgemeiner Textbericht privat in `queue-ui-render/report.json`; keine
  privaten Artefakte werden veröffentlicht. Native 390-Hell/320-Dunkel wurden
  vom Autor und unabhängig vom Hauptagenten angesehen. Prüfknöpfe verwenden
  Themeflächen und Textfarbe, keine Reihe primärer Akzentaktionen.
- Visualvertrag: die acht Queue enthaltenden Gesamtbilder wurden wegen der
  neuen problematischen Fixturezeile gezielt aktualisiert. Repräsentative
  Ansichten 320-Hell, 390-Dunkel, 480-Dunkel und 960-Hell wurden angesehen;
  die Geometrie aller acht Ansichten wurde gemessen. Die acht Editorbilder
  bleiben bytegleich. Der abschließende Vergleich besteht mit 28 Funktionsgruppen und 0 Befunden.
- Unabhängiges Quellreview bestätigt Instanzbindung, konservatives Queuegate
  und gemeinsam verwendeten Importvertrag. Datenschutzprüfung vor Commit.

## Alle 26 Regeln — vor der Reparatur auf Anwendbarkeit geprüft

Zentrale vollständige Designrichtlinien, Projektglossar, Bestandsaudit und
Webdesign-Regeln gelten wie im [vorigen Audit](design-audit-2026-10-08-arrcompact.md).
Diese Matrix beurteilt ausschließlich die gezielte Queue-Anbindung.

| ID | Anwendung und Beleg / Grenze |
| --- | --- |
| R01 | Anwendbar: ein gemeinsamer Importcontroller/Dialog für Queue und Fix-Karte. |
| R02 | Kein neuer Bulk-Vertrag; vorhandene Fix-Checkboxen unverändert weitergeprüft. |
| R03 | Anwendbar: native Enter/Space, Tab/Shift-Tab, Escape, Pollfokus und Fokusrückgabe. |
| R04 | Anwendbar: gleicher geschützter Scrim, Dirty Escape/Back, Busy bis Slowreload fertig. |
| R05 | Anwendbar: bestehende Dialoghistory; gepinnte Instanz schützt laufenden Dialog bei Configwechsel. |
| R06 | Anwendbar: neue Queueaktion bei 320/390/480/960 Hell/Dunkel gemessen und nativ aufgenommen. |
| R07 | Nicht anwendbar: keine eigene PWA, HA ist Host. |
| R08 | Anwendbar: Methoden und Texte geteilt; Geschäftslogik bleibt im Backend. |
| R09 | Anwendbar: vorhandene Themefarben, ruhige sichtbare Prüfknöpfe; keine neue Palette. |
| R10 | Teilweise: keine neuen Editorfelder; Entry-only und Configwechsel getestet, keine neue native Editor-Speichersuite. |
| R11 | Anwendbar: Ladezustand, Busy, Ergebnisfeedback, Erfolg erst nach Reload und ausdrücklicher Import. |
| R12 | Anwendbar: verständliche Dialogfehler, Auswahl bleibt und Retry ist möglich. |
| R13 | Kein neuer destruktiver Vertrag: Queuebutton liest; Import ist eine zweite explizite Aktion. |
| R14 | Kein neuer Paging-Vertrag; vorhandenes max_items begrenzt die Downloads-Karte. |
| R15 | Nicht anwendbar: kein Drag-and-Drop. |
| R16 | Teilweise: Semantik, Tastatur, Touch und Reflow geprüft; kein Screenreader-/Gesamtkontrast-/400%-Zoomnachweis. |
| R17 | Anwendbar: Prüfknopf, Loading, Busy und Kandidatenzustände; aktive Downloads haben keinen Importknopf. |
| R18 | Teilweise: vorhandene Status-/Fehlerfixtures plus synthetisch verzögerte Queue; kein physischer Offline-Test. |
| R19 | Nicht anwendbar: keine Browserberechtigung. |
| R20 | Teilweise: Kandidaten werden erst bei Prüfung geladen; keine Web-Vitals-Feldmessung. |
| R21 | Anwendbar: Kandidatenauswahl bei Fehler, Route im Dialog und Fokus über Queueupdates erhalten. |
| R22 | Anwendbar: klare sichtbare native Prüfaktion, keine Hover-/Shortcutpflicht. |
| R23 | Anwendbar: derselbe kompakte Dialog auf allen Breiten. |
| R24 | Anwendbar: lokale Prüflimits und verbleibender Poll-Randfall ausdrücklich benannt. |
| R25 | Kein Settings-Eingriff; bestehende Optionsfelder bleiben. |
| R26 | Anwendbar: vorhandene gemeinsame DE/EN-Importtexte, Dateipfade nur in Details. |

## Grenzen

Eine schon laufende Poll-Abfrage kann den unmittelbaren erneuten `_load()`
wegen dessen bestehender Duplikatsperre zusammenfassen; eine möglicherweise
ältere Queueanzeige wird mit dem nächsten Poll erneuert. Dieser bestehende
Race-Randfall wird hier nicht als behoben behauptet. Importbereitschaft und
Instanz-/Kandidatenzuordnung werden unabhängig davon serverseitig vor jedem
Schreibzugriff frisch geprüft. Kein realer Import, keine Installation,
Veröffentlichung oder HA-Neustart gehört zu dieser lokalen Reparaturabnahme.
