# arrstack Cards

Vier Lovelace-Karten zur Integration
[**arrstack**](https://github.com/luukkii123/ha-arrstack-integrations) —
Radarr, Sonarr, SABnzbd und Jellyseerr/Seerr im Dashboard.

![Die Download-Karte mit Fortschritt, Status und Restzeit](docs/preview-downloads.png)

| Karte | Was sie tut |
| --- | --- |
| `arrstack-downloads-card` | Was gerade lädt: Titel, Fortschritt, Status, Restzeit — Sonarr, Radarr oder SABnzbd |
| `arrstack-recent-card` | Zuletzt in die Bibliothek aufgenommen |
| `arrstack-fix-card` | Heruntergeladen, aber nicht importiert — mit Grund und Schnell-Reparatur |
| `arrstack-seer-card` | In Jellyseerr suchen, Staffeln wählen, anfragen |

Jede Karte ist einzeln nutzbar. Wer kein Jellyseerr betreibt, lässt die
Anfrage-Karte weg; wer nur Radarr hat, nimmt die anderen drei.

## Voraussetzung

Home Assistant **2026.9.3 oder neuer** ist die in `hacs.json` angegebene
Mindestversion. Der native Editorlauf wurde mit 2026.9.3 geprüft; ältere
Frontend-Versionen sind für diese Kartenfassung nicht belegt.

Die Integration **arrstack** muss eingerichtet sein. Die Karten sprechen nie
direkt mit Radarr, Sonarr, SABnzbd oder Jellyseerr — jeder Aufruf geht über
`hass.callWS` an die Integration, die ihn serverseitig ausführt. Das ist keine
Bequemlichkeit: Jellyseerr setzt keine CORS-Header, der Browser bräche jede
direkte Anfrage ab, und der API-Schlüssel hätte im Browser nichts verloren.

Ohne Integration melden die Karten „Kein passender arrstack-Dienst
eingerichtet."

## Installation

1. In HACS **Custom Repository** hinzufügen: dieses Repo, Kategorie
   **Dashboard**.
2. Installieren, danach den Browser hart neu laden — sonst hängt die alte
   Datei im Cache.
3. Karte auf ein Dashboard legen. Der Karteneditor bietet die eingerichteten
   arrstack-Instanzen zur Auswahl an.

## Einstellungen

Jedes Feld steht im Karteneditor, jedes hat dort eine Beschriftung **und**
einen erklärenden Satz — deutsch oder englisch, je nach der Sprache in Home
Assistant. YAML zu schreiben ist nirgends nötig.

| Feld | Bedeutung | Standard |
| --- | --- | --- |
| `title` | Überschrift der Karte | Vorgabetitel in der Sprache des Nutzers |
| `entry_id` | welche Instanz. Leer lassen, wenn es nur eine passende gibt | leer |
| `service` | Diensttyp, wenn keine Instanz gewählt ist | leer |
| `refresh_seconds` | wie oft neu geladen wird, `0` = nie | 15 · Zuletzt 120 · Reparatur 60 · Anfragen 0 |
| `max_items` | wie viele Zeilen höchstens | 8–10 |
| `show_posters` | Poster in der Download-Karte | `true` |

Gibt es mehrere passende Instanzen und ist keine gewählt, sagt die Karte das
— sie sucht sich keine aus.

```yaml
type: custom:arrstack-downloads-card
title: Downloads
max_items: 5
```

## Reparatur statt Ratespiel

![Der Dialog „Dateien prüfen" mit gesperrtem Import und Begründung](docs/preview-fix.png)

*Prüfen* öffnet einen Dialog mit den gefundenen Dateien. Der Knopf
*Importieren* ist nur aktiv, wenn die Integration den Import als ungefährlich
einstuft. Ist eine Datei keiner Serie zugeordnet oder nennt die App einen
heiklen Grund, bleibt er gesperrt und der Grund steht darunter.

*Löschen* nimmt den Eintrag aus der Warteschlange **und** löscht die
heruntergeladenen Dateien im Download-Client. Weil das nicht rückgängig zu
machen ist, kommt vorher eine Rückfrage: ein schmaler Dialog mit *Abbrechen*
und einem roten *Löschen*.

## Anfragen mit Staffelauswahl

![Dialog mit Staffelauswahl; verfügbare Staffeln sind gesperrt](docs/preview-seer.png)

Ein Treffer öffnet einen Dialog. Bereits verfügbare Staffeln sind gesperrt und
markiert, fehlende sind vorbelegt — der häufigste Wunsch ist „alles, was noch
fehlt". Bei Serien geht die Staffelliste **immer** mit; ohne sie antwortet
Jellyseerr mit einem Fehler.

## Dialoge, die sich schließen lassen

Jeder Dialog dieser Karten schließt auf **Escape**, auf einen Klick **neben**
den Dialog und auf die **Zurück-Taste** des Browsers beziehungsweise die
Zurück-Geste am Handy — ohne dabei das Dashboard zu verlassen. Dafür legt er
beim Öffnen einen eigenen Verlaufseintrag an und nimmt ihn beim Schließen
wieder mit; sein Schließ-Knopf hinterlässt also keinen verwaisten Eintrag.
Unter 450 px Breite wird der Dialog Vollbild, die Aktionsknöpfe bleiben unten
stehen.

## Mobil und im dunklen Thema

![Alle vier Karten auf 320 px Breite im dunklen Thema](docs/preview-mobil-dunkel.png)

Auf schmalen Karten rutschen die Nebenspalten unter den Inhalt. Lange Titel —
Veröffentlichungsnamen aus dem Usenet sind regelmäßig länger als jede Karte
breit ist — werden einzeilig gekürzt, statt die Karte zu sprengen. Farben,
Abstände und Schriftgrößen kommen aus den Home-Assistant-Variablen, das Thema
des Nutzers gilt also auch hier.

## Das Zeichen des Dienstes

Jede Karte zeigt im Kopf das Logo des Dienstes, auf den sie schaut — Sonarr,
Radarr oder SABnzbd. Fehlt einem Eintrag das Poster, steht das Logo gedämpft
an seiner Stelle statt einer leeren grauen Kachel.

Die Logos werden von **`brands.home-assistant.io`** geladen, Home Assistants
eigener Sammlung: dieselbe Quelle, aus der das Frontend die Zeichen aller
Integrationen holt. Sie liegen also **nicht** in diesem Repo — es sind fremde
Marken. Ohne Internet verschwindet das Bild rückstandslos, die Karte bleibt
vollständig bedienbar.

**Für Jellyseerr gibt es dort kein Zeichen.** Die Adresse antwortet trotzdem
mit HTTP 200 und liefert ein Bild mit der Aufschrift „icon not available" —
am 24.08.2026 nachgemessen: Pixel für Pixel dasselbe wie für einen frei
erfundenen Namen. Ein Statuscode ist hier also kein Beleg. Die Anfrage-Karte
trägt deshalb eine selbst gezeichnete **Qualle** in der Akzentfarbe — erkennbar
und zur Herkunft von Jellyseerr passend, ohne eine fremde Marke nachzuzeichnen.
Das Zeichen von Overseerr zu borgen wäre das falsche Produkt.

Ein blasses graues Strichsymbol reichte dafür übrigens nicht: neben drei
farbigen Logos liest es sich schlicht als fehlend. Eigene Zeichen stehen
deshalb in der Akzentfarbe.

## Kein Build-Schritt

`dist/arrstack-cards.js` ist Quelltext und Auslieferung in einem: reines
Vanilla-JS mit Custom Elements, kein Bundler, keine Abhängigkeit. **Keine
Unterordner** — eine HACS-Dashboard-Ressource liefert genau eine Datei aus,
alles darunter erreicht den Browser nie.

## Geprüft

**Stand 25.09.2026, `CARD_VERSION` 0.4.0** — gemessen gegen die vier
verbindlichen UI-Regeln: Text bleibt in seiner Karte · Popups schließen mit
Escape, Scrim und Zurück · alles im Editor einrichtbar, jedes Feld erklärt,
zweisprachig · Home-Assistant-Design.

Die Bilder oben stammen aus `docs/render/render.py`: Die ausgelieferte Datei
wird in echtem Chromium gerendert, `ha-card`/`ha-icon`/`ha-form` sind
Attrappen, und `callWS` beantwortet die arrstack-Kommandos mit erfundenen
Daten — kein Media-Stack, kein Schlüssel nötig. Die Attrappen-Titel sind
absichtlich zu lang: gekürzt werden muss genau dort.

```bash
node --check dist/arrstack-cards.js

docker run --rm \
  -v "/mnt/user/Data/Claude Projekte/hacs/docs/render:/work" \
  -v "/mnt/user/Data/Claude Projekte/hacs/ha-arrstack-cards:/cards" \
  --entrypoint bash mcr.microsoft.com/playwright/python:v1.62.0-noble \
  -c 'pip install --quiet --break-system-packages playwright==1.62.0 >/dev/null; \
      python3 /cards/docs/render/render.py /cards/dist/arrstack-cards.js \
              /cards/docs/render/ergebnis'
```

**Messumfang und Ergebnis** (`docs/render/ergebnis/report.json`, Exit 0):

| Was | Umfang | Ergebnis |
| --- | --- | --- |
| Regel 1, alle vier Karten | jede im vollen Zustand (die Anfrage-Karte mit Treffern, nicht leer): 320 / 480 / 960 px × hell / dunkel, je einmal mit und ohne die `--ha-space-*`-Variablen — 540 Textelemente | 0 Überlauf, 0 außerhalb der Karte, 0 Überlappung, 0 „kein Urteil"; 70 gewollte Kürzungen |
| Regel 1 in jedem der drei Dialoge | dieselben sechs Fassungen je Dialog, Bezugsrechteck ist das Dialogblatt selbst — 114 Textelemente | 0 Verstöße, 0 „kein Urteil" |
| Regel 2, drei Dialoge (Staffelauswahl, Dateien prüfen, Löschen bestätigen) | Escape · `history.back()` · Schließ-Knopf · `elementFromPoint` · Klick neben den Dialog | 15 von 15 bestanden |
| Regel 2, zusätzlich | Breite 560/320 px, Vollbild unter 450 px, `z-index` | 560 / 320 px, Vollbild 320×1200, `z-index: 100000` |
| Regel 3 am echten Editor | jedes Schemafeld jeder Karte, deutsch und englisch | kein Feld ohne Beschriftung, keines ohne Helper, beide Sprachen verschieden |
| Regel 4 | `scripts/ui-regeln-pruefen.py --repo ha-arrstack-cards` | 0 Verstöße |
| Netz | jede Anfrage protokolliert | 3 Anfragen, 0 Fehlantworten, 0 Konsolenfehler, 0 Seitenfehler, kein Nachladen aus einem Unterordner |

Die Messung selbst wird gegengeprüft: Zwei Sonden werden in die Karte
geschoben — eine fehlerhafte, die gemeldet werden **muss**, und eine korrekt
gekürzte, die **nicht** gemeldet werden darf. Beide Gegenproben schlugen wie
verlangt an. Ohne das wäre ein Lauf mit null Verstößen wertlos.

**Natives HA-Frontend 2026.9.3:** Ein kurzzeitig angelegtes, verstecktes und
adminbeschränktes Testdashboard enthielt vier Panelansichten mit erfundenen
Titeln und einer ungültigen Testinstanz. Das lokale Bundle wurde nur im
Testbrowser unter isolierten Elementnamen geladen. Alle vier echten
`ha-form`-Editoren gaben beim Tippen sofort eine vollständige Konfiguration
aus; Visual→YAML→Visual, Speichern und Wiederöffnen erhielten die Werte.
Ein frisches Rücklesen der Lovelace-Konfiguration bestätigte alle vier Titel
sowie `entry_id` und `refresh_seconds: 0`. Der Test prüfte außerdem
Tastaturereignisse, Instanzoptionen und 24 Editor- sowie 24 Kartenvarianten
bei 320/480/960 px in Hell und Dunkel: keine Seitenfehler und kein
horizontaler Überlauf. Die Screenshots wurden angesehen; das Testdashboard
wurde danach gelöscht und seine Abwesenheit geprüft. Der reproduzierbare
Browserlauf steht in `docs/render/live-ha-native.py`; die synthetische
Dashboard-Konfiguration in `docs/render/live-ha-native-dashboard.json`.
Sie benötigt eine private, außerhalb des Repositories liegende HA-Zugangsdatei.
Das Dashboard muss über die HA-API mit `require_admin: true` und
`show_in_sidebar: false` angelegt und nach dem Lauf gelöscht werden.

**Grenze:** Die drei Instanzkarten zeigten mit der ungültigen Instanz nur den
Fehlerzustand, die Seer-Karte ihre leere Suche. Inhalt, Aktionen und Dialoge
mit erfundenen API-Daten sind im
Renderlauf geprüft; produktive Radarr-, Sonarr-, SABnzbd- und Seerr-Aktionen
wurden nicht ausgelöst.

### Lokale UI-Migration 25.09.2026

Die vier Karten übernehmen den gemeinsamen UI-Vertrag 0.1.0:
44-px-Kopfmedium, lesbare Status mit Text, mobile Anordnung und mindestens
44 px hohe Aktionen. Die Karten- und Editoransichten sind bei 320, 480 und
960 px in Hell und Dunkel als [visuelle Baselines](docs/render/baselines/ui-0.1.0/)
versioniert. Der Vergleich läuft nach dem Renderlauf mit:

```bash
docker run --rm \
  -v "/mnt/user/Data/Claude Projekte/hacs/ha-arrstack-cards:/cards" \
  --entrypoint bash mcr.microsoft.com/playwright/python:v1.62.0-noble \
  -c 'pip install --quiet --break-system-packages playwright==1.62.0 >/dev/null; \
      python3 /cards/docs/render/visual-contract.py /cards/docs/render/ergebnis'
```

Der Vergleich prüft außerdem Lade-, Fehler- und Leerzustände, sechs Statusarten,
fehlende Poster, Tastaturöffnung der Suchtreffer, Fokus, Textgrenzen und
Aktionsflächen. Die Editorbilder verwenden eine sichtbare `ha-form`-Attrappe;
ein echter HA-Editor und ein Speichervorgang sind damit nicht nachgewiesen.

## Lizenz

MIT
