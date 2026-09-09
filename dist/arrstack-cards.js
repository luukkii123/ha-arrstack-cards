/**
 * arrstack Cards — Lovelace-Karten zur Integration `arrstack`.
 *
 * Vier Karten für Radarr, Sonarr, SABnzbd und Jellyseerr/Seerr:
 * laufende Downloads, zuletzt aufgenommen, hängende Importe samt Reparatur
 * und eine Suche mit Staffelauswahl zum Anfragen.
 *
 * Bewusst ohne Build-Schritt: eine einzelne Datei, reines Vanilla-JS mit
 * Custom Elements. Was hier steht, ist genau das, was ausgeliefert wird.
 *
 * Neue Karte hinzufügen: Klasse schreiben, `customElements.define(...)`,
 * Eintrag in `window.customCards` — alles in dieser Datei. **Keine
 * Unterordner:** Eine HACS-Dashboard-Ressource liefert genau eine Datei aus,
 * alles darunter erreicht den Browser nie.
 *
 * Die Karten brauchen die Integration `arrstack`; ohne sie melden sie
 * „Kein passender arrstack-Dienst eingerichtet". Umgekehrt läuft die
 * Integration auch ganz ohne diese Karten.
 *
 * Seit 09.09.2026 gilt `hacs/docs/ui-regeln.md`:
 *  - Regel 1: jeder einzeilige Textcontainer kürzt, jeder mehrzeilige bricht.
 *  - Regel 2: was die Karte überlagert, ist ein Dialog mit eigenem
 *    Verlaufseintrag — Escape, Scrim, Zurück-Taste und Schließ-Knopf.
 *  - Regel 3: jedes Konfigurationsfeld hat Label und Helper, deutsch und
 *    englisch, in genau einem Wörterbuch je Karte.
 *  - Regel 4: Farben, Abstände und Schriftgrößen nur über Theme-Variablen.
 */

const CARD_VERSION = "0.3.0";

const DOCS_URL = "https://github.com/luukkii123/ha-arrstack-cards";

console.info(
  `%c ARRSTACK-CARDS %c v${CARD_VERSION} `,
  "color: white; background: #1c76be; font-weight: 700;",
  "color: #1c76be; background: white; font-weight: 700;"
);

window.customCards = window.customCards || [];

/* ═══════════════════════════════════════════════════════════════════════════
 * arrstack — vier Karten zur gleichnamigen Integration.
 *
 * Keine Karte spricht je direkt mit Sonarr, Radarr, SABnzbd oder Jellyseerr.
 * Jellyseerr setzt keine CORS-Header, der Browser bräche jedes `fetch` ab —
 * und der API-Schlüssel hätte im Browser ohnehin nichts verloren. Alles läuft
 * über `hass.callWS({ type: "arrstack/…" })`; die Integration macht den Aufruf.
 *
 * Jede Karte ist für sich nutzbar: Wer nur Radarr betreibt, legt sich die
 * Download-, die Zuletzt- und die Reparatur-Karte hin und lässt die
 * Seerr-Karte weg. Keine Karte setzt eine andere voraus.
 * ═══════════════════════════════════════════════════════════════════════════ */

/* ── Sprache ────────────────────────────────────────────────────────────────
 *
 * Zwei Quellen, weil es zwei Zeitpunkte gibt: der `window.customCards`-Eintrag
 * entsteht beim Laden der Datei, lange bevor irgendein `hass` bekannt ist —
 * dort entscheidet `navigator.language`. In Karte und Editor entscheidet
 * `hass.locale.language`, also die Sprache, die der Nutzer in Home Assistant
 * eingestellt hat.
 */

/** `de-AT` → `de`, alles andere → `en`. */
function sprachSchluessel(code) {
  return String(code || "en").toLowerCase().startsWith("de") ? "de" : "en";
}

/** Sprache für den `customCards`-Eintrag; `hass` gibt es dort noch nicht. */
const BROWSER_SPRACHE = sprachSchluessel(
  typeof navigator !== "undefined" ? navigator.language : "en"
);

/** Ein Satz Strichsymbole (Lucide-Linienführung), 24er-Raster, `currentColor`.
 *
 * Bewusst SVG statt Emoji: Emoji rendern je Betriebssystem anders, bringen
 * eigene Farben mit und sitzen auf einer anderen Grundlinie als der Text.
 */
const ARR_ICON_PATHS = {
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  film: '<rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 2v20"/><path d="M17 2v20"/><path d="M2 12h20"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  listPlus: '<path d="M11 12H3"/><path d="M16 6H3"/><path d="M16 18H3"/><path d="M18 9v6"/><path d="M21 12h-6"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  jellyfish:
    '<path d="M4 12a8 8 0 0 1 16 0"/><path d="M4 12h16"/>' +
    '<path d="M7.5 12c0 2.5-1.5 3.5-1.5 5.5S7 20 7 20"/>' +
    '<path d="M12 12v8"/>' +
    '<path d="M16.5 12c0 2.5 1.5 3.5 1.5 5.5S17 20 17 20"/>',
};

/** Wo die echten Dienst-Logos herkommen.
 *
 * `brands.home-assistant.io` ist Home Assistants eigene Sammlung — dieselbe,
 * aus der das Frontend die Zeichen aller Integrationen holt. Die Logos werden
 * deshalb **verwiesen, nicht mitgeliefert**: es sind fremde Marken.
 * Lädt das Bild nicht (kein Netz), verschwindet es rückstandslos.
 */
const BRAND_BASE = "https://brands.home-assistant.io/_/";

/** Zeichen eines Dienstes: das echte Logo, sonst ein eigenes Strichsymbol.
 *
 * **Für Jellyseerr gibt es bei Home Assistant kein Markenbild.** Die Adresse
 * antwortet mit HTTP 200 und liefert ein Bild mit der Aufschrift „icon not
 * available" — nachgemessen am 24.08.2026, Pixel für Pixel dasselbe wie für
 * einen erfundenen Namen. Deshalb schickt die Integration für Seerr gar keine
 * Kennung, und hier steht dann ein eigenes Zeichen.
 */
function serviceSymbol(brand, fallback = "inbox", size = 22) {
  return brand ? serviceLogo(brand, size) : arrIcon(fallback, size);
}

/** Das Logo eines Dienstes als `<img>`; ohne Kennung nichts. */
function serviceLogo(brand, size = 22) {
  if (!brand) return "";
  return `<img class="logo" src="${BRAND_BASE}${encodeURIComponent(brand)}/icon.png"
    alt="" loading="lazy" style="width: ${size}px; height: ${size}px"
    onerror="this.remove()">`;
}

/** Ein Symbol als SVG-Zeichenkette. */
function arrIcon(name, size = 18) {
  const paths = ARR_ICON_PATHS[name] || "";
  return `<svg class="icon" viewBox="0 0 24 24" width="${size}" height="${size}"
    fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Wörterbücher (Regel 3, vereinbarte Form aus scripts/ui-regeln-pruefen.py)
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Was alle vier Karten an nutzersichtbarem Text teilen.
 *
 * Wird per Spread in das `texte` jeder Karte übernommen, damit jede Karte
 * genau **ein** Wörterbuch hat und keine Zeichenkette im Code steht. Die
 * Zustandswörter sind Übersetzungstische für rohe API-Werte: Sonarr, Radarr
 * und SABnzbd liefern ihre Zustände englisch und technisch
 * (`downloadClientUnavailable`) — auf einer Karte im Wohnzimmer hat das
 * nichts zu suchen.
 */
const TEXTE_ARRSTACK_BASIS = {
  de: {
    laden: "Lade …",
    schliessen: "Schließen",
    abbrechen: "Abbrechen",
    fehler_nicht_gefunden: "Kein passender arrstack-Dienst eingerichtet.",
    fehler_mehrdeutig: "Mehrere Instanzen vorhanden — im Karteneditor eine auswählen.",
    fehler_nicht_unterstuetzt: "Dieser Dienst kann das nicht.",
    fehler_rechte: "Dafür fehlen die Rechte — Administrator nötig.",
    fehler_allgemein: "Daten konnten nicht geladen werden.",
    einheiten: ["B", "KB", "MB", "GB", "TB"],
    zahlformat: "de-DE",
    zeit_jetzt: "gerade eben",
    zeit_min: "vor {n} Min.",
    zeit_std: "vor {n} Std.",
    zeit_tage: "vor {n} Tagen",
    dauer_std: "{h} Std. {m} Min.",
    dauer_min: "{m} Min.",
    zustaende: {
      downloading: "lädt",
      queued: "wartet",
      paused: "pausiert",
      completed: "fertig",
      failed: "fehlgeschlagen",
      warning: "Warnung",
      delay: "verzögert",
      downloadclientunavailable: "Client nicht erreichbar",
      fallback: "Ausweichquelle",
      grabbing: "wird geholt",
      fetching: "wird geholt",
      checking: "wird geprüft",
      verifying: "wird geprüft",
      repairing: "wird repariert",
      extracting: "wird entpackt",
      moving: "wird verschoben",
      running: "Nachbearbeitung",
      propagating: "wartet auf Freigabe",
      idle: "bereit",
    },
    verfolgt: {
      importPending: "Import steht aus",
      importBlocked: "Import blockiert",
      importing: "wird importiert",
      imported: "importiert",
      failedPending: "fehlgeschlagen",
      failed: "fehlgeschlagen",
      ignored: "übergangen",
    },
  },
  en: {
    laden: "Loading …",
    schliessen: "Close",
    abbrechen: "Cancel",
    fehler_nicht_gefunden: "No matching arrstack service configured.",
    fehler_mehrdeutig: "Several instances exist — pick one in the card editor.",
    fehler_nicht_unterstuetzt: "This service cannot do that.",
    fehler_rechte: "Not allowed — this needs an administrator.",
    fehler_allgemein: "Could not load the data.",
    einheiten: ["B", "KB", "MB", "GB", "TB"],
    zahlformat: "en-US",
    zeit_jetzt: "just now",
    zeit_min: "{n} min ago",
    zeit_std: "{n} h ago",
    zeit_tage: "{n} days ago",
    dauer_std: "{h} h {m} min",
    dauer_min: "{m} min",
    zustaende: {
      downloading: "downloading",
      queued: "queued",
      paused: "paused",
      completed: "done",
      failed: "failed",
      warning: "warning",
      delay: "delayed",
      downloadclientunavailable: "client unreachable",
      fallback: "fallback source",
      grabbing: "grabbing",
      fetching: "fetching",
      checking: "checking",
      verifying: "verifying",
      repairing: "repairing",
      extracting: "extracting",
      moving: "moving",
      running: "post-processing",
      propagating: "waiting for release",
      idle: "idle",
    },
    verfolgt: {
      importPending: "import pending",
      importBlocked: "import blocked",
      importing: "importing",
      imported: "imported",
      failedPending: "failed",
      failed: "failed",
      ignored: "ignored",
    },
  },
};

/* ── Karte 1: laufende Downloads ────────────────────────────────────────── */

const SCHEMA_ARRSTACK_DOWNLOADS_CARD = [
  { name: "title", selector: { text: {} } },
  { name: "entry_id", selector: { select: { options: [], mode: "dropdown", custom_value: false } } },
  { name: "service", selector: { select: { options: [], mode: "dropdown", custom_value: false } } },
  { name: "refresh_seconds", selector: { number: { min: 0, max: 600, mode: "box", unit_of_measurement: "s" } } },
  { name: "max_items", selector: { number: { min: 1, max: 50, mode: "box" } } },
  { name: "show_posters", selector: { boolean: {} } },
];

const TEXTE_ARRSTACK_DOWNLOADS_CARD = {
  de: {
    name: "arrstack Downloads",
    description: "Was gerade lädt — Sonarr, Radarr oder SABnzbd.",
    labels: {
      title: "Überschrift",
      entry_id: "Instanz",
      service: "Dienst",
      refresh_seconds: "Neu laden alle",
      max_items: "Einträge",
      show_posters: "Poster zeigen",
    },
    helpers: {
      title: "Überschrift der Karte. Vorgabe: Downloads.",
      entry_id: "Welche eingerichtete arrstack-Instanz die Karte abfragt. Vorgabe: die einzige passende.",
      service: "Diensttyp, wenn keine Instanz gewählt ist. Vorgabe: die Integration entscheidet.",
      refresh_seconds: "Sekunden zwischen zwei Abfragen. 0 schaltet das Nachladen ab. Vorgabe 15.",
      max_items: "Wie viele Zeilen die Karte höchstens zeigt. Vorgabe 10.",
      show_posters: "Zeigt links neben jeder Zeile das Poster. Vorgabe an.",
    },
    texte: {
      ...TEXTE_ARRSTACK_BASIS.de,
      kartentitel: "Downloads",
      leer: "Nichts in der Warteschlange.",
    },
  },
  en: {
    name: "arrstack downloads",
    description: "What is downloading right now — Sonarr, Radarr or SABnzbd.",
    labels: {
      title: "Title",
      entry_id: "Instance",
      service: "Service",
      refresh_seconds: "Reload every",
      max_items: "Entries",
      show_posters: "Show posters",
    },
    helpers: {
      title: "Heading of the card. Default: Downloads.",
      entry_id: "Which configured arrstack instance the card queries. Default: the only matching one.",
      service: "Service type when no instance is picked. Default: the integration decides.",
      refresh_seconds: "Seconds between two queries. 0 turns reloading off. Default 15.",
      max_items: "How many rows the card shows at most. Default 10.",
      show_posters: "Shows the poster left of every row. Default on.",
    },
    texte: {
      ...TEXTE_ARRSTACK_BASIS.en,
      kartentitel: "Downloads",
      leer: "Nothing in the queue.",
    },
  },
};

/* ── Karte 2: zuletzt hinzugefügt ───────────────────────────────────────── */

const SCHEMA_ARRSTACK_RECENT_CARD = [
  { name: "title", selector: { text: {} } },
  { name: "entry_id", selector: { select: { options: [], mode: "dropdown", custom_value: false } } },
  { name: "service", selector: { select: { options: [], mode: "dropdown", custom_value: false } } },
  { name: "refresh_seconds", selector: { number: { min: 0, max: 600, mode: "box", unit_of_measurement: "s" } } },
  { name: "max_items", selector: { number: { min: 1, max: 50, mode: "box" } } },
];

const TEXTE_ARRSTACK_RECENT_CARD = {
  de: {
    name: "arrstack Zuletzt",
    description: "Zuletzt in die Bibliothek aufgenommen.",
    labels: {
      title: "Überschrift",
      entry_id: "Instanz",
      service: "Dienst",
      refresh_seconds: "Neu laden alle",
      max_items: "Einträge",
    },
    helpers: {
      title: "Überschrift der Karte. Vorgabe: Zuletzt hinzugefügt.",
      entry_id: "Welche eingerichtete arrstack-Instanz die Karte abfragt. Vorgabe: die einzige passende.",
      service: "Diensttyp, wenn keine Instanz gewählt ist. Vorgabe: die Integration entscheidet.",
      refresh_seconds: "Sekunden zwischen zwei Abfragen. 0 schaltet das Nachladen ab. Vorgabe 120.",
      max_items: "Wie viele Zeilen die Karte höchstens zeigt. Vorgabe 8.",
    },
    texte: {
      ...TEXTE_ARRSTACK_BASIS.de,
      kartentitel: "Zuletzt hinzugefügt",
      leer: "Noch nichts aufgenommen.",
    },
  },
  en: {
    name: "arrstack recent",
    description: "Most recently added to the library.",
    labels: {
      title: "Title",
      entry_id: "Instance",
      service: "Service",
      refresh_seconds: "Reload every",
      max_items: "Entries",
    },
    helpers: {
      title: "Heading of the card. Default: Recently added.",
      entry_id: "Which configured arrstack instance the card queries. Default: the only matching one.",
      service: "Service type when no instance is picked. Default: the integration decides.",
      refresh_seconds: "Seconds between two queries. 0 turns reloading off. Default 120.",
      max_items: "How many rows the card shows at most. Default 8.",
    },
    texte: {
      ...TEXTE_ARRSTACK_BASIS.en,
      kartentitel: "Recently added",
      leer: "Nothing added yet.",
    },
  },
};

/* ── Karte 3: heruntergeladen, aber nicht importiert ────────────────────── */

const SCHEMA_ARRSTACK_FIX_CARD = [
  { name: "title", selector: { text: {} } },
  { name: "entry_id", selector: { select: { options: [], mode: "dropdown", custom_value: false } } },
  { name: "service", selector: { select: { options: [], mode: "dropdown", custom_value: false } } },
  { name: "refresh_seconds", selector: { number: { min: 0, max: 600, mode: "box", unit_of_measurement: "s" } } },
];

const TEXTE_ARRSTACK_FIX_CARD = {
  de: {
    name: "arrstack Import-Fix",
    description: "Heruntergeladen, aber nicht importiert — mit Schnell-Reparatur.",
    labels: {
      title: "Überschrift",
      entry_id: "Instanz",
      service: "Dienst",
      refresh_seconds: "Neu laden alle",
    },
    helpers: {
      title: "Überschrift der Karte. Vorgabe: Nicht importiert.",
      entry_id: "Welche eingerichtete arrstack-Instanz die Karte abfragt. Vorgabe: die einzige passende.",
      service: "Diensttyp, wenn keine Instanz gewählt ist. Vorgabe: die Integration entscheidet.",
      refresh_seconds: "Sekunden zwischen zwei Abfragen. 0 schaltet das Nachladen ab. Vorgabe 60.",
    },
    texte: {
      ...TEXTE_ARRSTACK_BASIS.de,
      kartentitel: "Nicht importiert",
      leer: "Alles importiert.",
      offen: "{n} offen",
      pruefen: "Prüfen",
      loeschen: "Löschen",
      importieren: "Importieren",
      dialog_pruefen: "Dateien prüfen",
      dialog_loeschen: "Endgültig löschen",
      pruefe: "Prüfe Dateien …",
      keine_datei: "Keine Datei gefunden.",
      gesperrt: "Automatischer Import gesperrt: {grund}",
      gesperrt_ohne_grund: "keine Zuordnung gefunden",
      ohne_kennung: "Dieser Eintrag hat keine Download-Kennung.",
      importiert: "{n} Datei(en) importiert.",
      geloescht: "Eintrag gelöscht.",
      loeschen_frage:
        "Der Eintrag wird aus der Warteschlange genommen und die heruntergeladenen " +
        "Dateien werden im Download-Client gelöscht. Das lässt sich nicht rückgängig machen.",
    },
  },
  en: {
    name: "arrstack import fix",
    description: "Downloaded but never imported — with a one-click repair.",
    labels: {
      title: "Title",
      entry_id: "Instance",
      service: "Service",
      refresh_seconds: "Reload every",
    },
    helpers: {
      title: "Heading of the card. Default: Not imported.",
      entry_id: "Which configured arrstack instance the card queries. Default: the only matching one.",
      service: "Service type when no instance is picked. Default: the integration decides.",
      refresh_seconds: "Seconds between two queries. 0 turns reloading off. Default 60.",
    },
    texte: {
      ...TEXTE_ARRSTACK_BASIS.en,
      kartentitel: "Not imported",
      leer: "Everything imported.",
      offen: "{n} open",
      pruefen: "Check",
      loeschen: "Delete",
      importieren: "Import",
      dialog_pruefen: "Check files",
      dialog_loeschen: "Delete for good",
      pruefe: "Checking files …",
      keine_datei: "No file found.",
      gesperrt: "Automatic import blocked: {grund}",
      gesperrt_ohne_grund: "nothing could be matched",
      ohne_kennung: "This entry has no download id.",
      importiert: "{n} file(s) imported.",
      geloescht: "Entry deleted.",
      loeschen_frage:
        "The entry is taken out of the queue and the downloaded files are deleted " +
        "in the download client. This cannot be undone.",
    },
  },
};

/* ── Karte 4: Serie oder Film anfragen (Jellyseerr/Seerr) ───────────────── */

const SCHEMA_ARRSTACK_SEER_CARD = [
  { name: "title", selector: { text: {} } },
  { name: "entry_id", selector: { select: { options: [], mode: "dropdown", custom_value: false } } },
  { name: "service", selector: { select: { options: [], mode: "dropdown", custom_value: false } } },
  { name: "refresh_seconds", selector: { number: { min: 0, max: 600, mode: "box", unit_of_measurement: "s" } } },
  { name: "max_items", selector: { number: { min: 1, max: 20, mode: "box" } } },
];

const TEXTE_ARRSTACK_SEER_CARD = {
  de: {
    name: "arrstack Anfragen",
    description: "In Jellyseerr suchen, Staffeln wählen, anfragen.",
    labels: {
      title: "Überschrift",
      entry_id: "Instanz",
      service: "Dienst",
      refresh_seconds: "Neu laden alle",
      max_items: "Einträge",
    },
    helpers: {
      title: "Überschrift der Karte. Vorgabe: Anfragen.",
      entry_id: "Welche eingerichtete arrstack-Instanz die Karte abfragt. Vorgabe: die einzige passende.",
      service: "Diensttyp, wenn keine Instanz gewählt ist. Vorgabe: die Integration entscheidet.",
      refresh_seconds: "Sekunden zwischen zwei Abfragen. 0 schaltet das Nachladen ab. Vorgabe 0 — die Karte lädt auf Zuruf.",
      max_items: "Wie viele Treffer die Karte höchstens zeigt. Vorgabe 8.",
    },
    texte: {
      ...TEXTE_ARRSTACK_BASIS.de,
      kartentitel: "Anfragen",
      platzhalter: "Serie oder Film suchen",
      suchbegriff: "Suchbegriff",
      suchen: "Suchen",
      leer: "Titel eintippen und suchen.",
      nichts_gefunden: "Nichts gefunden.",
      serie: "Serie",
      film: "Film",
      specials: "Specials",
      staffel: "Staffel {n}",
      staffel_da: "{name} — bereits verfügbar",
      dialog_anfragen: "Anfragen",
      anfragen: "Anfragen",
      staffel_waehlen: "Mindestens eine Staffel wählen.",
      angefragt: "Angefragt (Nr. {n}).",
      seer_status: {
        unknown: "nicht angefragt",
        pending: "offen",
        processing: "in Arbeit",
        partially_available: "teilweise da",
        available: "verfügbar",
        blocklisted: "gesperrt",
        deleted: "gelöscht",
      },
    },
  },
  en: {
    name: "arrstack requests",
    description: "Search in Jellyseerr, pick seasons, request.",
    labels: {
      title: "Title",
      entry_id: "Instance",
      service: "Service",
      refresh_seconds: "Reload every",
      max_items: "Entries",
    },
    helpers: {
      title: "Heading of the card. Default: Requests.",
      entry_id: "Which configured arrstack instance the card queries. Default: the only matching one.",
      service: "Service type when no instance is picked. Default: the integration decides.",
      refresh_seconds: "Seconds between two queries. 0 turns reloading off. Default 0 — this card loads on demand.",
      max_items: "How many results the card shows at most. Default 8.",
    },
    texte: {
      ...TEXTE_ARRSTACK_BASIS.en,
      kartentitel: "Requests",
      platzhalter: "Search a show or movie",
      suchbegriff: "Search term",
      suchen: "Search",
      leer: "Type a title and search.",
      nichts_gefunden: "Nothing found.",
      serie: "Show",
      film: "Movie",
      specials: "Specials",
      staffel: "Season {n}",
      staffel_da: "{name} — already available",
      dialog_anfragen: "Request",
      anfragen: "Request",
      staffel_waehlen: "Pick at least one season.",
      angefragt: "Requested (no. {n}).",
      seer_status: {
        unknown: "not requested",
        pending: "pending",
        processing: "processing",
        partially_available: "partly available",
        available: "available",
        blocklisted: "blocklisted",
        deleted: "deleted",
      },
    },
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
 * Marken und Grundformen
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Die Skala. Jeder Wert hängt an einer HA-Variablen, der Pixelwert ist nur
 * der Rückfall — Regel 4 verlangt Theme-Variablen, kein eigenes Maßsystem.
 *
 * Die Sprünge sind gewollt groß (8 innerhalb einer Gruppe, 24 zwischen
 * Gruppen); ähnliche Abstände liest niemand als Trennung.
 *
 * `container-type` sitzt auf `:host`, nicht auf `ha-card`: das Element liegt
 * im Shadow DOM und ist ohne Home Assistants Styles `display: inline` — an
 * einem inline dargestellten Element ist `container-type` wirkungslos.
 */
const ARRSTACK_TOKENS = `
  :host {
    --arr-space-1: var(--ha-space-1, 4px);
    --arr-space-2: var(--ha-space-2, 8px);
    --arr-space-3: var(--ha-space-3, 12px);
    --arr-space-4: var(--ha-space-4, 24px);
    --arr-radius-1: 6px;
    --arr-radius-2: var(--ha-card-border-radius, 12px);
    --arr-font-sm: var(--ha-font-size-s, 0.8125rem);
    --arr-font-md: var(--ha-font-size-m, 0.9375rem);
    --arr-font-lg: var(--ha-font-size-l, 1.125rem);
    --arr-weight-bold: var(--ha-font-weight-bold, 600);
    --arr-poster-w: 44px;
    --arr-poster-h: 66px;
    --arr-thumb: 36px;
    --arr-bar: 6px;
    --arr-logo: 22px;
    --arr-text: var(--primary-text-color, #212121);
    --arr-muted: var(--secondary-text-color, #727272);
    --arr-accent: var(--primary-color, #03a9f4);
    --arr-surface: var(--secondary-background-color, rgba(127, 127, 127, 0.12));
    --arr-line: var(--divider-color, rgba(127, 127, 127, 0.25));
    --arr-danger: var(--error-color, #db4437);
    display: block;
    container-type: inline-size;
  }
`;

/** Ein einzeiliger Textcontainer nach Regel 1 — alle vier Eigenschaften.
 *
 * Das min-width: 0 ist Pflicht in Flex- und Grid-Kindern: ohne es wächst der
 * Container über seinen Elternteil hinaus, statt zu kürzen.
 */
const ARRSTACK_EINZEILIG = `
  .title, .head-meta, .row-title, .row-meta, .row-side .lead, .row-side .sub,
  .chip, .lbl, .dlg-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
`;

/** Formen, die Karte und Dialog teilen. Der Dialog liegt am
 * `document.body` und hat sein eigenes Shadow-Root — er sieht von den
 * Kartenformen nichts, wenn sie ihm nicht mitgegeben werden. Genau das
 * war am 09.09.2026 der Befund: die Knöpfe im Dialog standen ohne jede
 * Form da, und ihre Beschriftungen waren inline, also ohne Kastenmaß. */
const ARRSTACK_GEMEINSAM = `

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--arr-space-3);
    margin-bottom: var(--arr-space-4);
  }
  .head-title {
    display: flex;
    align-items: center;
    gap: var(--arr-space-2);
    min-width: 0;
    flex: 1 1 auto;
  }
  .title {
    font-size: var(--arr-font-lg);
    font-weight: var(--arr-weight-bold);
    color: var(--arr-text);
  }
  .head-meta {
    font-size: var(--arr-font-sm);
    color: var(--arr-muted);
    flex: 0 1 auto;
  }
  /* Das echte Logo des Dienstes — es sagt auf einen Blick, ob die Karte auf
     Radarr, Sonarr, SABnzbd oder Jellyseerr schaut. */
  .logo { flex: none; border-radius: var(--arr-radius-1); object-fit: contain; }
  .head-title .icon { flex: none; color: var(--arr-accent); }

  /* Trennung zuerst über Abstand: Zeilen liegen frei, das Vorschaubild gibt
     den Takt. Eine graue Fläche je Zeile ergab eine Leiter aus Balken — der
     häufigste Grund, warum solche Karten gebastelt aussehen. */
  .rows { display: flex; flex-direction: column; gap: var(--arr-space-3); }
  .row {
    display: flex;
    align-items: center;
    gap: var(--arr-space-3);
    border-radius: var(--arr-radius-1);
  }
  .row.wrap { flex-wrap: wrap; }
  .row-main { flex: 1 1 auto; min-width: 0; }
  /* Regel 1, Prüfung 1 misst scrollHeight gegen clientHeight. Ein
     zweizeiliger Klemmkasten (-webkit-line-clamp) meldet dort die volle
     Inhaltshöhe und gilt als Überlauf — Dateinamen aus dem Usenet werden
     deshalb einzeilig gekürzt, nicht auf zwei Zeilen geklemmt. */
  .row-title {
    font-size: var(--arr-font-md);
    color: var(--arr-text);
  }
  .row-meta {
    font-size: var(--arr-font-sm);
    color: var(--arr-muted);
    margin-top: var(--arr-space-1);
  }
  .row-side {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--arr-space-1);
    flex: 0 1 auto;
    min-width: 0;
    max-width: 45%;
  }
  /* In einer Spalte mit align-items: flex-end wächst ein Kind über den
     Container hinaus — nach links, mitten in die Textspalte daneben. Bei
     480 px hat genau das die Restzeit über den Zustand geschoben (gemessen
     am 09.09.2026: 6,2 px Überdeckung). max-width bindet es an den
     Container, und die Kürzung greift statt des Überstands. */
  .row-side > * { max-width: 100%; text-align: right; }
  .row-side .lead {
    font-size: var(--arr-font-md);
    color: var(--arr-text);
    font-variant-numeric: tabular-nums;
  }
  .row-side .sub { font-size: var(--arr-font-sm); color: var(--arr-muted); }

  .poster {
    width: var(--arr-poster-w);
    height: var(--arr-poster-h);
    flex: none;
    object-fit: cover;
    border-radius: var(--arr-radius-1);
    background: var(--arr-surface);
  }
  .poster-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--arr-muted);
  }
  /* Fehlt ein Poster, steht das Dienst-Logo gedämpft an seiner Stelle —
     eine leere graue Kachel sagt nichts. */
  .poster-fallback .logo { width: 60%; height: auto; opacity: 0.45; }

  .thumb {
    width: var(--arr-thumb);
    height: var(--arr-thumb);
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--arr-radius-1);
    background: var(--arr-surface);
    color: var(--arr-muted);
  }
  .thumb.warn { color: var(--warning-color, #ffa600); }

  .bar {
    height: var(--arr-bar);
    margin-top: var(--arr-space-2);
    border-radius: var(--arr-bar);
    background: var(--arr-surface);
    overflow: hidden;
  }
  .bar > i {
    display: block;
    height: 100%;
    border-radius: var(--arr-bar);
    background: var(--arr-accent);
    transition: width 0.4s ease;
  }

  /* Genau eine gefüllte Akzentfläche je Ansicht: der primäre Knopf. */
  button {
    font: inherit;
    font-size: var(--arr-font-sm);
    display: inline-flex;
    align-items: center;
    gap: var(--arr-space-1);
    padding: var(--arr-space-2) var(--arr-space-3);
    border: none;
    border-radius: var(--arr-radius-1);
    background: none;
    color: var(--arr-accent);
    cursor: pointer;
    min-width: 0;
    max-width: 100%;
  }
  button .icon { flex: none; }
  button:hover { background: var(--arr-surface); }
  button[disabled] { color: var(--arr-muted); cursor: default; }
  button.primary {
    background: var(--arr-accent);
    color: var(--text-primary-color, #fff);
    font-weight: var(--arr-weight-bold);
  }
  button.primary[disabled] {
    background: var(--arr-line);
    color: var(--arr-muted);
  }
  button.quiet { color: var(--arr-muted); }
  /* Endgültige Aktionen sind rot (Design Gallery, Remove/Delete). */
  button.danger { color: var(--arr-danger); }
  button.danger.primary {
    background: var(--arr-danger);
    color: var(--text-primary-color, #fff);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--arr-space-2);
    flex: none;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--arr-space-2);
    padding: var(--arr-space-4) 0;
    color: var(--arr-muted);
    font-size: var(--arr-font-sm);
    text-align: center;
  }
  .empty .icon { opacity: 0.6; }
  .empty-text { overflow-wrap: anywhere; max-width: 100%; }

  .notice {
    font-size: var(--arr-font-sm);
    color: var(--arr-muted);
    padding: var(--arr-space-2);
    border-radius: var(--arr-radius-1);
    background: var(--arr-surface);
    overflow-wrap: anywhere;
  }
  .notice.problem { color: var(--arr-danger); }

  .chip {
    font-size: var(--arr-font-sm);
    padding: var(--arr-space-1) var(--arr-space-2);
    border-radius: var(--arr-radius-2);
    background: var(--arr-surface);
    color: var(--arr-muted);
    flex: 0 1 auto;
  }

`;

/** Nur die Karte: ha-card, Kopfzeile und die Container-Query. */
const ARRSTACK_STYLES = ARRSTACK_TOKENS + ARRSTACK_EINZEILIG + ARRSTACK_GEMEINSAM + `
  ha-card { padding: var(--arr-space-4); }

  /* Schmale Karte: Nebenspalten unter den Inhalt, statt Text abzuschneiden. */
  @container (max-width: 380px) {
    ha-card { padding: var(--arr-space-3); }
    .row { flex-wrap: wrap; }
    .row-side { max-width: 100%; }
    .actions { width: 100%; }
  }
`;

/* ═══════════════════════════════════════════════════════════════════════════
 * Dialog (Regel 2)
 *
 * Warum ein eigenes Element am `document.body` und keine Ansicht in der Karte:
 * `:host` der Karten trägt `container-type: inline-size`. Das bedeutet
 * `contain: layout` — die Karte wird damit zum enthaltenden Block für jedes
 * `position: fixed` darin und macht einen eigenen Stapelkontext auf. Ein
 * Overlay innerhalb der Karte könnte die Seite also gar nicht überdecken und
 * käme mit keinem `z-index` über eine Leaflet-Karte. Das ist derselbe Weg,
 * den `ha-busch-lightcards` geht.
 *
 * Der Verlaufseintrag ist dem Dialog-Manager von Home Assistant nachgebaut
 * (`src/dialogs/make-dialog-manager.ts`, `addHistory`): beim Öffnen ein
 * `pushState`, ein `popstate`-Listener schließt, der Schließ-Knopf nimmt den
 * eigenen Eintrag mit `history.back()` wieder weg. Ohne das verlässt die
 * Zurück-Geste am Handy das ganze Dashboard.
 * ═══════════════════════════════════════════════════════════════════════════ */

const DIALOG_TAG = "arrstack-dialog";

const DIALOG_STYLES = ARRSTACK_TOKENS + ARRSTACK_EINZEILIG + ARRSTACK_GEMEINSAM + `
  :host {
    position: fixed;
    inset: 0;
    /* Leaflet vergibt seinen Ebenen 400 und seinen Bedienelementen 1000.
       Ein Dialog auf z-index: 10 verliert gegen jede Landkarte. */
    z-index: 100000;
    container-type: normal;
  }
  .scrim {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
  }
  .sheet {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(560px, calc(100vw - 2 * var(--arr-space-4)));
    max-height: calc(100vh - 4 * var(--arr-space-4));
    display: flex;
    flex-direction: column;
    background: var(--card-background-color, #fff);
    color: var(--arr-text);
    border-radius: var(--arr-radius-2);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }
  /* Bestätigungsdialoge sind schmal (Spec: 320 px). */
  .sheet.schmal { width: min(320px, calc(100vw - 2 * var(--arr-space-4))); }

  .dlg-head {
    display: flex;
    align-items: center;
    gap: var(--arr-space-2);
    padding: var(--arr-space-3) var(--arr-space-4);
    border-bottom: 1px solid var(--arr-line);
    flex: none;
  }
  /* Schließen-X oben links (Design Gallery, Dialogs). */
  .dlg-close { flex: none; padding: var(--arr-space-1); color: var(--arr-muted); }
  .dlg-title {
    font-size: var(--arr-font-lg);
    font-weight: var(--arr-weight-bold);
    color: var(--arr-text);
    flex: 1 1 auto;
  }

  .dlg-body {
    padding: var(--arr-space-4);
    overflow: auto;
    flex: 1 1 auto;
    font-size: var(--arr-font-md);
  }
  .dlg-text { overflow-wrap: anywhere; color: var(--arr-text); }
  .dlg-sub {
    overflow-wrap: anywhere;
    color: var(--arr-muted);
    font-size: var(--arr-font-sm);
    margin-top: var(--arr-space-2);
  }

  /* Aktionsknöpfe unten rechts; am Handy bleiben sie unten stehen. */
  .dlg-foot {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: var(--arr-space-2);
    padding: var(--arr-space-3) var(--arr-space-4);
    border-top: 1px solid var(--arr-line);
    background: var(--card-background-color, #fff);
    flex: none;
  }

  /* Staffelauswahl der Seerr-Karte. Sie steht nur im Dialog, gehört aber
     hierher und nicht in einen Stilblock mitten im Inhalt: ein Stilblock im
     Körper würde bei jedem Nachzeichnen neu geparst. */
  .seasons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--arr-space-2);
    margin-top: var(--arr-space-3);
  }
  .season {
    font-size: var(--arr-font-sm);
    padding: var(--arr-space-1) var(--arr-space-3);
    border-radius: var(--arr-radius-2);
    background: var(--arr-surface);
    color: var(--arr-muted);
  }
  /* Gewählte Staffeln sind ein Zustand, keine zweite Hauptaktion: getönt
     statt gefüllt. Gefüllt bleibt allein der Anfragen-Knopf. */
  .season[aria-pressed="true"] {
    background: color-mix(in srgb, var(--arr-accent) 18%, transparent);
    color: var(--arr-accent);
    font-weight: var(--arr-weight-bold);
  }
  .season[disabled] { cursor: default; opacity: 0.55; }

  /* Unter 450 px Breite oder 500 px Höhe: Vollbild. */
  @media (max-width: 450px), (max-height: 500px) {
    .sheet, .sheet.schmal {
      left: 0;
      top: 0;
      right: 0;
      bottom: 0;
      transform: none;
      width: auto;
      max-height: none;
      border-radius: 0;
    }
  }
`;

/** Ein Dialog nach der Anatomie aus `docs/ui-regeln.md`, Regel 2.
 *
 * Das Modell ist bewusst schlicht, weil beide Fälle dieser Datei damit
 * auskommen: eine Detailansicht mit einer Hauptaktion und ein
 * Bestätigungsdialog.
 */
class ArrstackDialog extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._model = null;
    // Liegt unser eigener Verlaufseintrag noch oben?
    this._pushed = false;
    this._closing = false;
    this._closed = false;
    this._onKey = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      this.close();
    };
    this._onPop = () => {
      if (this._closing) {
        this._closing = false;
        this._dismiss();
        return;
      }
      // Der eigene Eintrag ist verschwunden — also die Zurück-Taste.
      this._pushed = false;
      this._dismiss();
    };
  }

  set model(model) {
    this._model = model;
    if (this.isConnected) this._render();
  }

  connectedCallback() {
    document.addEventListener("keydown", this._onKey);
    window.addEventListener("popstate", this._onPop);
    this._push();
    this._render();
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this._onKey);
    window.removeEventListener("popstate", this._onPop);
  }

  /** Ein Verlaufseintrag, die Adresse bleibt, wie sie ist. */
  _push() {
    try {
      history.pushState({ arrstackDialog: true }, "");
      this._pushed = true;
    } catch (error) {
      // Private Fenster und Ratenbegrenzungen lehnen das ab. Escape, Scrim
      // und der Schließ-Knopf gehen weiter; nur die Zurück-Geste fehlt dann.
      this._pushed = false;
    }
  }

  /** Schließen über Knopf, Escape oder Scrim — ohne verwaisten Eintrag. */
  close() {
    if (this._pushed) {
      this._pushed = false;
      this._closing = true;
      history.back();
      // Sicherung: kommt kein popstate, darf der Dialog nicht stehen bleiben.
      setTimeout(() => {
        if (this.isConnected) this._dismiss();
      }, 300);
      return;
    }
    this._dismiss();
  }

  _dismiss() {
    if (this._closed) return;
    this._closed = true;
    if (this._model && this._model.beimSchliessen) this._model.beimSchliessen();
    this.remove();
  }

  /** Von außen aufrufbar, wenn sich der Inhalt geändert hat. */
  aktualisieren() {
    this._render();
  }

  _render() {
    const model = this._model;
    if (!model) return;
    const aktionen = model.aktionen || [];
    this.shadowRoot.innerHTML = `<style>${DIALOG_STYLES}</style>
      <div class="scrim"></div>
      <div class="sheet ${model.schmal ? "schmal" : ""}" role="dialog" aria-modal="true"
        aria-label="${escapeHtml(model.titel)}">
        <div class="dlg-head">
          <button class="dlg-close" aria-label="${escapeHtml(model.schliessen)}"
            title="${escapeHtml(model.schliessen)}">${arrIcon("close", 20)}</button>
          <div class="dlg-title">${escapeHtml(model.titel)}</div>
        </div>
        <div class="dlg-body">${model.koerper()}</div>
        ${
          aktionen.length
            ? `<div class="dlg-foot">${aktionen
                .map(
                  (aktion) => `<button class="${aktion.art || "quiet"}"
                    data-akt="${escapeHtml(aktion.id)}" ${aktion.aus ? "disabled" : ""}>
                    ${aktion.icon ? arrIcon(aktion.icon) : ""}
                    <span class="lbl">${escapeHtml(aktion.text)}</span>
                  </button>`
                )
                .join("")}</div>`
            : ""
        }
      </div>`;
    this.shadowRoot.querySelector(".scrim").addEventListener("click", () => this.close());
    this.shadowRoot
      .querySelector(".dlg-close")
      .addEventListener("click", () => this.close());
    this.shadowRoot.querySelectorAll(".dlg-foot button").forEach((knopf) => {
      knopf.addEventListener("click", () => {
        if (model.beiAktion) model.beiAktion(knopf.dataset.akt, this);
      });
    });
    if (model.binden) model.binden(this.shadowRoot, this);
  }
}

/** Dialog öffnen. Rückgabe: das Element, damit der Aufrufer nachziehen kann. */
function oeffneDialog(model) {
  const dialog = document.createElement(DIALOG_TAG);
  dialog.model = model;
  document.body.appendChild(dialog);
  return dialog;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Gemeinsame Basis der vier Karten
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Was alle vier Karten teilen: Konfiguration, Laden, Fehlertexte, Takt. */
class ArrstackCardBase extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._timer = null;
    this._loading = false;
    this._error = null;
    this._dialog = null;
  }

  /** Das Wörterbuch dieser Karte; jede Unterklasse setzt es. */
  static get woerterbuch() {
    return null;
  }

  /** Standardwerte; Unterklassen ergänzen über `_defaults()`. */
  setConfig(config) {
    this._config = { refresh_seconds: 15, ...this._defaults(), ...(config || {}) };
    this._render();
    // Der Takt hängt an der Konfiguration — wird sie im Editor geändert,
    // muss der laufende Timer mit, sonst gilt weiter der alte Wert.
    if (this.isConnected) this._startTimer();
    if (this._hass) this._load();
  }

  _defaults() {
    return {};
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first && this._config) this._load();
  }

  /** `de` oder `en` — die Sprache, die der Nutzer in HA eingestellt hat. */
  _sprache() {
    return sprachSchluessel(
      (this._hass && this._hass.locale && this._hass.locale.language) ||
        (typeof navigator !== "undefined" ? navigator.language : "en")
    );
  }

  /** Der nutzersichtbare Teil des Wörterbuchs dieser Karte. */
  _t() {
    const wb = this.constructor.woerterbuch;
    return wb[this._sprache()].texte;
  }

  /** Überschrift: aus der Konfiguration, sonst der Vorgabetitel der Sprache. */
  _titel() {
    const eigen = this._config && this._config.title;
    return eigen != null && eigen !== "" ? eigen : this._t().kartentitel;
  }

  connectedCallback() {
    this._startTimer();
    if (this._config && this._hass && !this._loaded) this._load();
  }

  disconnectedCallback() {
    this._stopTimer();
    this._schliesseDialog();
  }

  _startTimer() {
    this._stopTimer();
    const seconds = Number(this._config && this._config.refresh_seconds);
    if (!seconds || seconds <= 0) return;
    this._timer = setInterval(() => {
      if (this._hass && this._config) this._load();
    }, seconds * 1000);
  }

  _stopTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  /** Genau ein Dialog je Karte; ein zweiter würde den Verlauf verschachteln. */
  _oeffneDialog(model) {
    this._schliesseDialog();
    const eigen = { ...model };
    const weiter = model.beimSchliessen;
    eigen.beimSchliessen = () => {
      this._dialog = null;
      if (weiter) weiter();
    };
    this._dialog = oeffneDialog(eigen);
    return this._dialog;
  }

  _schliesseDialog() {
    if (this._dialog) {
      const dialog = this._dialog;
      this._dialog = null;
      dialog.close();
    }
  }

  /** Ein WS-Aufruf mit der in der Karte eingestellten Instanz. */
  _call(type, params = {}) {
    const message = { type, ...params };
    if (this._config.entry_id) message.entry_id = this._config.entry_id;
    else if (this._config.service) message.service = this._config.service;
    return this._hass.callWS(message);
  }

  /** Fehlercodes der Integration in Sätze, die weiterhelfen. */
  _errorText(error) {
    const t = this._t();
    const code = error && error.code;
    if (code === "not_found") return t.fehler_nicht_gefunden;
    if (code === "ambiguous_instance") return t.fehler_mehrdeutig;
    if (code === "unsupported_service") return t.fehler_nicht_unterstuetzt;
    if (code === "unauthorized") return t.fehler_rechte;
    return (error && error.message) || t.fehler_allgemein;
  }

  /** Leerzustand als Entwurf, nicht als Restfläche. */
  _empty(icon, text) {
    return `<div class="empty">${arrIcon(icon, 28)}
      <div class="empty-text">${escapeHtml(text)}</div></div>`;
  }

  /** Kopfzeile mit Logo, Titel und optionaler Nebenauskunft. */
  _head(icon, meta = "") {
    return `<div class="head">
      <div class="head-title">
        ${serviceSymbol(this._data && this._data.brand, icon, 22)}
        <span class="title">${escapeHtml(this._titel())}</span>
      </div>
      ${meta ? `<span class="head-meta">${escapeHtml(meta)}</span>` : ""}
    </div>`;
  }

  getCardSize() {
    return 4;
  }

  /** Sections-Layout: Spalten in Vielfachen von 3 (Regel 3). */
  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }
}

/** Was in der Zeile als Zustand steht.
 *
 * Der Importzustand schlägt den Download-Status, sobald er vom Normalfall
 * abweicht — „Import blockiert" ist die Auskunft, die zählt, nicht „fertig".
 */
function queueStatusText(item, t) {
  const tracked = t.verfolgt[item.tracked_state];
  if (tracked) return tracked;
  const key = String(item.status || "").toLowerCase();
  return t.zustaende[key] || item.status || "";
}

/** Platzhalter der Form `{n}` füllen. */
function fuelle(vorlage, werte) {
  return String(vorlage || "").replace(/\{(\w+)\}/g, (treffer, name) =>
    Object.prototype.hasOwnProperty.call(werte, name) ? String(werte[name]) : treffer
  );
}

/** Text sicher in HTML einsetzen — Titel kommen aus fremden Quellen. */
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

/** `1234567890` Bytes → `1,15 GB`. */
function formatBytes(bytes, t) {
  const value = Number(bytes) || 0;
  const units = t.einheiten;
  if (value <= 0) return `0 ${units[0]}`;
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  const scaled = value / 1024 ** exponent;
  const digits = scaled >= 100 || exponent === 0 ? 0 : 1;
  // Deutsches Zahlenformat: 5,1 GB, nicht 5.1 GB.
  const text = scaled.toLocaleString(t.zahlformat, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${text} ${units[exponent]}`;
}

/** `00:12:30` → `12 Min.`; unbekannte Formate bleiben, wie sie sind. */
function formatTimeleft(value, t) {
  if (!value) return "";
  const parts = String(value).split(":").map((part) => Number(part));
  if (parts.length < 2 || parts.some((part) => Number.isNaN(part))) return String(value);
  const [hours, minutes] = parts.length === 3 ? parts : [0, parts[0]];
  if (hours >= 1) {
    return fuelle(t.dauer_std, { h: hours, m: String(minutes).padStart(2, "0") });
  }
  return fuelle(t.dauer_min, { m: minutes });
}

/** Zeitpunkt als „vor 3 Std." — bei älteren Einträgen als Datum. */
function formatSince(value, t) {
  if (!value) return "";
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return "";
  const seconds = (Date.now() - then.getTime()) / 1000;
  if (seconds < 90) return t.zeit_jetzt;
  if (seconds < 5400) return fuelle(t.zeit_min, { n: Math.round(seconds / 60) });
  if (seconds < 172800) return fuelle(t.zeit_std, { n: Math.round(seconds / 3600) });
  if (seconds < 2592000) return fuelle(t.zeit_tage, { n: Math.round(seconds / 86400) });
  return then.toLocaleDateString(t.zahlformat);
}

/** Poster oder ersatzweise ein Symbol — nie ein kaputtes Bild. */
function posterMarkup(url, brand = null, icon = "film") {
  if (!url) {
    // Kein Poster: das Dienst-Logo gedämpft, sonst das Strichsymbol.
    const inner = brand ? serviceLogo(brand, 24) : arrIcon(icon, 20);
    // `brand` ist absichtlich leer, wo es kein Markenbild gibt (Seerr).
    return `<div class="poster poster-fallback">${inner}</div>`;
  }
  // Lädt das Bild nicht (TMDB nicht erreichbar), bleibt die Fläche stehen —
  // ein kaputtes Bildsymbol wäre lauter als die leere Kachel.
  return `<img class="poster" src="${escapeHtml(url)}" alt="" loading="lazy"
    onerror="this.removeAttribute('src')">`;
}

/* ── Editor: eine Instanz auswählen ─────────────────────────────────────── */

/** Gemeinsamer Editor. Die Auswahl kommt aus `arrstack/instances`.
 *
 * Ohne Auswahl bleibt die Karte gültig — die Integration löst dann selbst
 * auf, solange es genau eine passende Instanz gibt.
 *
 * Label und Helper stammen aus dem Wörterbuch der jeweiligen Karte; die
 * Sprache aus `hass.locale.language`.
 */
class ArrstackCardEditor extends HTMLElement {
  constructor() {
    super();
    this._instances = null;
    this._services = ["sonarr", "radarr", "sabnzbd", "seerr"];
    this._basisSchema = [];
    this._woerterbuch = null;
  }

  /** Von den Unterklassen gesetzt: Dienste, Schema und Wörterbuch. */
  static forServices(services, schema, woerterbuch) {
    return class extends ArrstackCardEditor {
      constructor() {
        super();
        this._services = services;
        this._basisSchema = schema;
        this._woerterbuch = woerterbuch;
      }
    };
  }

  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._instances) this._loadInstances();
    this._render();
  }

  _sprache() {
    return sprachSchluessel(
      (this._hass && this._hass.locale && this._hass.locale.language) ||
        (typeof navigator !== "undefined" ? navigator.language : "en")
    );
  }

  async _loadInstances() {
    this._instances = [];
    try {
      const result = await this._hass.callWS({ type: "arrstack/instances" });
      this._instances = (result.instances || []).filter((instance) =>
        this._services.includes(instance.service)
      );
    } catch (error) {
      this._instances = [];
    }
    this._render();
  }

  /** Das feste Schema der Karte, nur die Auswahllisten werden gefüllt. */
  _schema() {
    const instanzen = (this._instances || []).map((instance) => ({
      value: instance.entry_id,
      label: `${instance.title}`,
    }));
    const dienste = this._services.map((service) => ({ value: service, label: service }));
    return this._basisSchema.map((feld) => {
      if (feld.name === "entry_id") {
        return {
          ...feld,
          selector: { select: { options: instanzen, mode: "dropdown", custom_value: false } },
        };
      }
      if (feld.name === "service") {
        return {
          ...feld,
          selector: { select: { options: dienste, mode: "dropdown", custom_value: false } },
        };
      }
      return feld;
    });
  }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (schema) => {
        const wb = this._woerterbuch[this._sprache()];
        return wb.labels[schema.name] || schema.name;
      };
      this._form.computeHelper = (schema) => {
        const wb = this._woerterbuch[this._sprache()];
        return wb.helpers[schema.name] || "";
      };
      this._form.addEventListener("value-changed", (event) => {
        event.stopPropagation();
        this.dispatchEvent(
          new CustomEvent("config-changed", {
            detail: { config: { ...this._config, ...event.detail.value } },
            bubbles: true,
            composed: true,
          })
        );
      });
      this.appendChild(this._form);
    }
    this._form.schema = this._schema();
    this._form.hass = this._hass;
    this._form.data = this._config;
  }
}

/* ── Karte 1: laufende Downloads ────────────────────────────────────────── */

/** Was gerade lädt — Sonarr, Radarr oder SABnzbd, eine Instanz je Karte. */
class ArrstackDownloadsCard extends ArrstackCardBase {
  static get woerterbuch() {
    return TEXTE_ARRSTACK_DOWNLOADS_CARD;
  }

  static getConfigElement() {
    return document.createElement("arrstack-downloads-card-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:arrstack-downloads-card",
      refresh_seconds: 15,
      max_items: 10,
      show_posters: true,
    };
  }

  _defaults() {
    return { max_items: 10, show_posters: true };
  }

  async _load() {
    if (this._loading) return;
    this._loading = true;
    try {
      const result = await this._call("arrstack/queue");
      this._data = result;
      this._error = null;
    } catch (error) {
      this._error = error;
    } finally {
      this._loading = false;
      this._loaded = true;
      this._render();
    }
  }

  _render() {
    if (!this._config) return;
    this.shadowRoot.innerHTML = `<style>${ARRSTACK_STYLES}</style>
      <ha-card>
        ${this._head("download", this._headMeta())}
        ${this._body()}
      </ha-card>`;
  }

  _headMeta() {
    if (this._error || !this._data) return "";
    const t = this._t();
    const speed = this._data.speed ? `${formatBytes(this._data.speed, t)}/s` : "";
    const total = this._data.total ?? (this._data.items || []).length;
    return speed ? `${total} · ${speed}` : `${total}`;
  }

  _body() {
    const t = this._t();
    if (this._error) {
      return `<div class="notice problem">${escapeHtml(this._errorText(this._error))}</div>`;
    }
    if (!this._data) {
      return `<div class="notice">${escapeHtml(t.laden)}</div>`;
    }
    const items = (this._data.items || []).slice(0, Number(this._config.max_items) || 10);
    if (!items.length) {
      return this._empty("download", t.leer);
    }
    return `<div class="rows">${items.map((item) => this._row(item)).join("")}</div>`;
  }

  _row(item) {
    const t = this._t();
    // SABnzbd liefert `percentage`/`mbleft`, die *arr-Apps `progress`/`sizeleft`.
    const progress =
      item.progress != null ? Number(item.progress) : Number(item.percentage) || 0;
    // Restgröße nur, solange etwas übrig ist — „0 B" unter einem fertigen
    // Download liest sich wie ein Fehler.
    const leftBytes =
      item.sizeleft != null
        ? Number(item.sizeleft)
        : item.mbleft != null
          ? Number(item.mbleft) * 1024 * 1024
          : 0;
    const remaining = leftBytes > 0 ? formatBytes(leftBytes, t) : "";
    const title = item.parent_title || item.title || "";
    const meta = [item.episode, queueStatusText(item, t), item.category]
      .filter(Boolean)
      .join(" · ");
    const poster = this._config.show_posters
      ? posterMarkup(item.poster, this._data && this._data.brand, "download")
      : "";
    const rest = formatTimeleft(item.timeleft, t) || remaining;
    return `<div class="row">
      ${poster}
      <div class="row-main">
        <div class="row-title">${escapeHtml(title)}</div>
        <div class="row-meta">${escapeHtml(meta)}</div>
        <div class="bar"><i style="width: ${Math.max(0, Math.min(100, progress))}%"></i></div>
      </div>
      <div class="row-side">
        <span class="lead">${Math.round(progress)} %</span>
        ${rest ? `<span class="sub">${escapeHtml(rest)}</span>` : ""}
      </div>
    </div>`;
  }
}

/* ── Karte 2: zuletzt hinzugefügt ───────────────────────────────────────── */

/** Was zuletzt in der Bibliothek gelandet ist (Sonarr oder Radarr). */
class ArrstackRecentCard extends ArrstackCardBase {
  static get woerterbuch() {
    return TEXTE_ARRSTACK_RECENT_CARD;
  }

  static getConfigElement() {
    return document.createElement("arrstack-recent-card-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:arrstack-recent-card",
      refresh_seconds: 120,
      max_items: 8,
    };
  }

  _defaults() {
    return { max_items: 8, refresh_seconds: 120 };
  }

  async _load() {
    if (this._loading) return;
    this._loading = true;
    try {
      this._data = await this._call("arrstack/recent");
      this._error = null;
    } catch (error) {
      this._error = error;
    } finally {
      this._loading = false;
      this._loaded = true;
      this._render();
    }
  }

  _render() {
    if (!this._config) return;
    this.shadowRoot.innerHTML = `<style>${ARRSTACK_STYLES}</style>
      <ha-card>
        ${this._head("download")}
        ${this._body()}
      </ha-card>`;
  }

  _body() {
    const t = this._t();
    if (this._error) {
      return `<div class="notice problem">${escapeHtml(this._errorText(this._error))}</div>`;
    }
    if (!this._data) return `<div class="notice">${escapeHtml(t.laden)}</div>`;
    const items = (this._data.items || []).slice(0, Number(this._config.max_items) || 8);
    if (!items.length) {
      return this._empty("film", t.leer);
    }
    return `<div class="rows">${items
      .map(
        (item) => `<div class="row">
          ${posterMarkup(item.poster, this._data && this._data.brand)}
          <div class="row-main">
            <div class="row-title">${escapeHtml(item.title || "")}</div>
            <div class="row-meta">${escapeHtml(
              [item.subtitle, item.quality].filter(Boolean).join(" · ")
            )}</div>
          </div>
          <div class="row-side">
            <span class="sub">${escapeHtml(formatSince(item.added, t))}</span>
          </div>
        </div>`
      )
      .join("")}</div>`;
  }
}

/* ── Karte 3: heruntergeladen, aber nicht importiert ────────────────────── */

/** Die Liste der hängenden Importe — mit Grund und Schnell-Reparatur.
 *
 * Der Ein-Klick-Import wird **nur** angeboten, wenn die Integration ihn als
 * ungefährlich einstuft. Sonst steht dort der Grund, und der Nutzer entscheidet
 * selbst. Blind importieren ordnet Dateien der falschen Serie zu.
 *
 * Beide Ansichten sind Dialoge (Regel 2): das Prüfergebnis, weil es die Karte
 * sonst überlagern würde, und die Rückfrage vor dem Löschen, weil dabei
 * heruntergeladene Dateien verschwinden.
 */
class ArrstackFixCard extends ArrstackCardBase {
  static get woerterbuch() {
    return TEXTE_ARRSTACK_FIX_CARD;
  }

  static getConfigElement() {
    return document.createElement("arrstack-fix-card-editor");
  }

  static getStubConfig() {
    return { type: "custom:arrstack-fix-card", refresh_seconds: 60 };
  }

  _defaults() {
    return { refresh_seconds: 60 };
  }

  constructor() {
    super();
    this._open = null;
    this._busy = null;
    this._message = null;
  }

  async _load() {
    if (this._loading) return;
    this._loading = true;
    try {
      this._data = await this._call("arrstack/import_problems");
      this._error = null;
    } catch (error) {
      this._error = error;
    } finally {
      this._loading = false;
      this._loaded = true;
      this._render();
    }
  }

  _render() {
    if (!this._config) return;
    const t = this._t();
    const items = (this._data && this._data.items) || [];
    this.shadowRoot.innerHTML = `<style>${ARRSTACK_STYLES}</style>
      <ha-card>
        ${this._head("download", items.length ? fuelle(t.offen, { n: items.length }) : "")}
        ${this._message ? `<div class="notice">${escapeHtml(this._message)}</div>` : ""}
        ${this._body(items)}
      </ha-card>`;
    this._bind();
  }

  _body(items) {
    const t = this._t();
    if (this._error) {
      return `<div class="notice problem">${escapeHtml(this._errorText(this._error))}</div>`;
    }
    if (!this._data) return `<div class="notice">${escapeHtml(t.laden)}</div>`;
    if (!items.length) {
      return this._empty("check", t.leer);
    }
    return `<div class="rows">${items.map((item) => this._row(item)).join("")}</div>`;
  }

  _row(item) {
    const t = this._t();
    const reason = (item.messages && item.messages[0]) || item.tracked_state || "";
    return `<div class="row wrap" data-download="${escapeHtml(item.download_id || "")}"
        data-item="${escapeHtml(item.id ?? "")}">
      <div class="thumb warn">${arrIcon("alert", 20)}</div>
      <div class="row-main">
        <div class="row-title">${escapeHtml(item.parent_title || item.title)}</div>
        <div class="row-meta">${escapeHtml(reason)}</div>
      </div>
      <div class="actions">
        <button class="act-check quiet" ${this._busy ? "disabled" : ""}>
          ${arrIcon("search")}<span class="lbl">${escapeHtml(t.pruefen)}</span>
        </button>
        <button class="act-delete danger" ${this._busy ? "disabled" : ""}>
          ${arrIcon("trash")}<span class="lbl">${escapeHtml(t.loeschen)}</span>
        </button>
      </div>
    </div>`;
  }

  _bind() {
    this.shadowRoot.querySelectorAll(".row").forEach((row) => {
      const downloadId = row.dataset.download;
      const itemId = Number(row.dataset.item);
      const titel = row.querySelector(".row-title").textContent.trim();
      const check = row.querySelector(".act-check");
      if (check) check.addEventListener("click", () => this._check(downloadId));
      const del = row.querySelector(".act-delete");
      if (del) del.addEventListener("click", () => this._fragLoeschen(itemId, titel));
    });
  }

  /** Prüfergebnis als Dialog: Titel, X, eine Hauptaktion, Abbrechen. */
  async _check(downloadId) {
    const t = this._t();
    if (!downloadId) {
      this._message = t.ohne_kennung;
      this._render();
      return;
    }
    this._open = { downloadId, loading: true };
    this._message = null;
    this._render();
    const dialog = this._oeffneDialog({
      titel: t.dialog_pruefen,
      schliessen: t.schliessen,
      koerper: () => this._dialogKoerper(),
      aktionen: this._dialogAktionen(),
      beiAktion: (id, dlg) => {
        if (id === "import") {
          dlg.close();
          this._import(downloadId);
          return;
        }
        dlg.close();
      },
      beimSchliessen: () => {
        this._open = null;
      },
    });
    try {
      const result = await this._call("arrstack/manual_import", {
        download_id: downloadId,
        action: "candidates",
      });
      this._open = { downloadId, ...result, loading: false };
    } catch (error) {
      this._open = { downloadId, loading: false, fehler: this._errorText(error) };
    }
    if (dialog.isConnected) {
      dialog.model = {
        ...dialog._model,
        koerper: () => this._dialogKoerper(),
        aktionen: this._dialogAktionen(),
      };
    }
  }

  _dialogKoerper() {
    const t = this._t();
    const info = this._open;
    if (!info) return "";
    if (info.loading) return `<div class="dlg-text">${escapeHtml(t.pruefe)}</div>`;
    if (info.fehler) return `<div class="dlg-text">${escapeHtml(info.fehler)}</div>`;
    const candidates = info.candidates || [];
    const list = candidates.length
      ? candidates
          .map(
            (candidate) => `<div class="dlg-text">${escapeHtml(
              [
                candidate.name,
                candidate.parent,
                (candidate.episodes || []).join(", "),
                (candidate.rejections || []).join("; "),
              ]
                .filter(Boolean)
                .join(" · ")
            )}</div>`
          )
          .join("")
      : `<div class="dlg-text">${escapeHtml(t.keine_datei)}</div>`;
    const grund = info.can_auto_import
      ? ""
      : `<div class="dlg-sub">${escapeHtml(
          fuelle(t.gesperrt, {
            grund: (info.reasons || []).join("; ") || t.gesperrt_ohne_grund,
          })
        )}</div>`;
    return list + grund;
  }

  /** Höchstens zwei Knöpfe, einer davon Abbrechen (Design Gallery). */
  _dialogAktionen() {
    const t = this._t();
    const info = this._open || {};
    return [
      { id: "cancel", text: t.abbrechen, art: "quiet" },
      {
        id: "import",
        text: t.importieren,
        art: "primary",
        icon: "check",
        aus: !info.can_auto_import,
      },
    ];
  }

  /** Rückfrage vor dem Löschen: schmaler Dialog, rote Endaktion. */
  _fragLoeschen(itemId, titel) {
    const t = this._t();
    if (!itemId) return;
    this._oeffneDialog({
      titel: t.dialog_loeschen,
      schliessen: t.schliessen,
      schmal: true,
      koerper: () =>
        `<div class="dlg-text">${escapeHtml(t.loeschen_frage)}</div>
         <div class="dlg-sub">${escapeHtml(titel)}</div>`,
      aktionen: [
        { id: "cancel", text: t.abbrechen, art: "quiet" },
        { id: "delete", text: t.loeschen, art: "danger primary", icon: "trash" },
      ],
      beiAktion: (id, dlg) => {
        dlg.close();
        if (id === "delete") this._delete(itemId);
      },
    });
  }

  async _import(downloadId) {
    const t = this._t();
    this._busy = downloadId;
    this._message = null;
    this._render();
    try {
      const result = await this._call("arrstack/manual_import", {
        download_id: downloadId,
        action: "import",
      });
      this._message = fuelle(t.importiert, { n: result.imported });
      this._open = null;
    } catch (error) {
      this._message = this._errorText(error);
    }
    this._busy = null;
    await this._load();
  }

  async _delete(itemId) {
    const t = this._t();
    if (!itemId) return;
    this._busy = itemId;
    this._message = null;
    this._render();
    try {
      await this._call("arrstack/queue_remove", {
        item_id: itemId,
        remove_from_client: true,
        blocklist: false,
      });
      this._message = t.geloescht;
      this._open = null;
    } catch (error) {
      this._message = this._errorText(error);
    }
    this._busy = null;
    await this._load();
  }
}

/* ── Karte 4: Serie oder Film anfragen (Jellyseerr/Seerr) ───────────────── */

/** Suchen, Staffeln wählen, anfragen — ohne die Seerr-Oberfläche zu öffnen.
 *
 * Die Detailansicht war bis 09.09.2026 eine Inline-Ansicht mit einem
 * „Zurück"-Knopf. Die Zurück-Taste des Browsers verließ dort das Dashboard,
 * Escape tat nichts. Jetzt ist sie ein Dialog mit eigenem Verlaufseintrag.
 */
class ArrstackSeerCard extends ArrstackCardBase {
  static get woerterbuch() {
    return TEXTE_ARRSTACK_SEER_CARD;
  }

  static getConfigElement() {
    return document.createElement("arrstack-seer-card-editor");
  }

  static getStubConfig() {
    return { type: "custom:arrstack-seer-card", refresh_seconds: 0, max_items: 8 };
  }

  _defaults() {
    // Diese Karte lädt auf Zuruf, nicht im Takt — sonst würde jede Suche
    // nach ein paar Sekunden von selbst verschwinden.
    return { refresh_seconds: 0, max_items: 8 };
  }

  constructor() {
    super();
    this._query = "";
    this._results = null;
    this._show = null;
    this._selected = new Set();
    this._message = null;
    this._busy = false;
  }

  /** Die Suche wird ausgelöst, nicht gepollt. */
  _load() {
    this._loaded = true;
    this._render();
  }

  _render() {
    if (!this._config) return;
    const t = this._t();
    this.shadowRoot.innerHTML = `<style>${ARRSTACK_STYLES}
      .search { display: flex; gap: var(--arr-space-2); margin-bottom: var(--arr-space-4); }
      .search input {
        flex: 1 1 auto;
        min-width: 0;
        font: inherit;
        font-size: var(--arr-font-md);
        color: var(--arr-text);
        padding: var(--arr-space-2) var(--arr-space-3);
        border: none;
        border-radius: var(--arr-radius-1);
        background: var(--arr-surface);
      }
      .row.result { cursor: pointer; }
      </style>
      <ha-card>
        ${this._head("jellyfish")}
        <div class="search">
          <input type="search" placeholder="${escapeHtml(t.platzhalter)}"
            value="${escapeHtml(this._query)}" aria-label="${escapeHtml(t.suchbegriff)}">
          <button class="go quiet" aria-label="${escapeHtml(t.suchen)}"
            title="${escapeHtml(t.suchen)}">${arrIcon("search")}</button>
        </div>
        ${this._message ? `<div class="notice">${escapeHtml(this._message)}</div>` : ""}
        ${this._body()}
      </ha-card>`;
    this._bind();
  }

  /** Die Kopfzeile trägt kein Dienst-Logo: für Jellyseerr gibt es keins. */
  _head(icon) {
    return `<div class="head">
      <div class="head-title">
        ${serviceSymbol(null, icon, 22)}
        <span class="title">${escapeHtml(this._titel())}</span>
      </div>
    </div>`;
  }

  _body() {
    const t = this._t();
    if (this._error) {
      return `<div class="notice problem">${escapeHtml(this._errorText(this._error))}</div>`;
    }
    if (this._results === null) {
      return this._empty("search", t.leer);
    }
    if (!this._results.length) {
      return this._empty("search", t.nichts_gefunden);
    }
    return `<div class="rows">${this._results
      .slice(0, Number(this._config.max_items) || 8)
      .map(
        (item, index) => `<div class="row result" data-index="${index}">
          ${posterMarkup(item.poster)}
          <div class="row-main">
            <div class="row-title">${escapeHtml(item.title || "")}</div>
            <div class="row-meta">${escapeHtml(
              [
                item.media_type === "tv" ? t.serie : t.film,
                (item.date || "").slice(0, 4),
              ]
                .filter(Boolean)
                .join(" · ")
            )}</div>
          </div>
          <span class="chip">${escapeHtml(statusLabel(item.status, t))}</span>
        </div>`
      )
      .join("")}</div>`;
  }

  /** Dialoginhalt: bei Serien die Staffeln, bei Filmen nur der Titel. */
  _dialogKoerper() {
    const t = this._t();
    const show = this._show;
    if (!show) return "";
    const seasons = show.seasons || [];
    const chips = seasons
      .map((season) => {
        const available = season.status_code === 5;
        const pressed = this._selected.has(season.season);
        const label =
          season.season === 0 ? t.specials : fuelle(t.staffel, { n: season.season });
        return `<button class="season" data-season="${season.season}"
          aria-pressed="${pressed}" ${available ? "disabled" : ""}
          title="${escapeHtml(available ? fuelle(t.staffel_da, { name: label }) : label)}">
          <span class="lbl">${escapeHtml(label)}</span>${available ? arrIcon("check", 14) : ""}
        </button>`;
      })
      .join("");
    return `<div class="row">
        ${posterMarkup(show.poster)}
        <div class="row-main">
          <div class="row-title">${escapeHtml(show.title || "")}</div>
          <div class="row-meta">${escapeHtml(statusLabel(show.status, t))}</div>
        </div>
      </div>
      ${seasons.length ? `<div class="seasons">${chips}</div>` : ""}`;
  }

  _dialogAktionen() {
    const t = this._t();
    return [
      { id: "cancel", text: t.abbrechen, art: "quiet" },
      { id: "request", text: t.anfragen, art: "primary", icon: "download", aus: this._busy },
    ];
  }

  /** Der Dialog bringt eigene Formen mit — er liegt außerhalb der Karte. */
  _oeffneDetail() {
    const t = this._t();
    return this._oeffneDialog({
      titel: t.dialog_anfragen,
      schliessen: t.schliessen,
      koerper: () => this._dialogKoerper(),
      aktionen: this._dialogAktionen(),
      binden: (root, dialog) => {
        root.querySelectorAll(".season").forEach((chip) => {
          chip.addEventListener("click", () => {
            const season = Number(chip.dataset.season);
            if (this._selected.has(season)) this._selected.delete(season);
            else this._selected.add(season);
            dialog.aktualisieren();
          });
        });
      },
      beiAktion: (id, dialog) => {
        if (id === "request") {
          this._request(dialog);
          return;
        }
        dialog.close();
      },
      beimSchliessen: () => {
        this._show = null;
      },
    });
  }

  _bind() {
    const input = this.shadowRoot.querySelector("input");
    if (input) {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") this._search(input.value);
      });
    }
    const go = this.shadowRoot.querySelector(".go");
    if (go) go.addEventListener("click", () => this._search(input && input.value));
    this.shadowRoot.querySelectorAll(".result").forEach((row) => {
      row.addEventListener("click", () =>
        this._openResult(this._results[Number(row.dataset.index)])
      );
    });
  }

  async _search(query) {
    this._query = String(query || "").trim();
    this._message = null;
    this._schliesseDialog();
    this._show = null;
    if (!this._query) return;
    try {
      const result = await this._call("arrstack/search", { query: this._query });
      this._results = result.results || [];
      this._error = null;
    } catch (error) {
      this._error = error;
    }
    this._render();
  }

  async _openResult(item) {
    if (!item) return;
    this._message = null;
    if (item.media_type === "movie") {
      this._show = { ...item, seasons: [] };
      this._selected = new Set();
      this._oeffneDetail();
      return;
    }
    try {
      const show = await this._call("arrstack/tv_seasons", { tmdb_id: item.id });
      // Fehlende Staffeln vorbelegt, vorhandene nicht — der häufigste Wunsch
      // ist „alles, was noch fehlt".
      this._selected = new Set(
        (show.seasons || [])
          .filter((season) => season.status_code !== 5 && season.season !== 0)
          .map((season) => season.season)
      );
      this._show = { ...show, media_type: "tv", id: item.id };
      this._error = null;
      this._oeffneDetail();
      return;
    } catch (error) {
      this._error = error;
    }
    this._render();
  }

  async _request(dialog) {
    const t = this._t();
    const show = this._show;
    if (!show) return;
    const seasons = [...this._selected].sort((a, b) => a - b);
    if (show.media_type === "tv" && !seasons.length) {
      this._message = t.staffel_waehlen;
      dialog.close();
      this._render();
      return;
    }
    this._busy = true;
    try {
      const result = await this._call("arrstack/request", {
        media_type: show.media_type,
        media_id: show.id,
        ...(show.media_type === "tv" ? { seasons } : {}),
      });
      this._message = fuelle(t.angefragt, { n: result.request_id });
    } catch (error) {
      this._message = this._errorText(error);
    }
    this._busy = false;
    dialog.close();
    this._render();
  }
}

/** Statuszahlen von Seerr in Worte (Enum aus Jellyseerr/Seerr). */
function statusLabel(status, t) {
  return t.seer_status[status] || t.seer_status.unknown;
}

/* ── Anmeldung ──────────────────────────────────────────────────────────── */

customElements.define(DIALOG_TAG, ArrstackDialog);

customElements.define("arrstack-downloads-card", ArrstackDownloadsCard);
customElements.define("arrstack-recent-card", ArrstackRecentCard);
customElements.define("arrstack-fix-card", ArrstackFixCard);
customElements.define("arrstack-seer-card", ArrstackSeerCard);

customElements.define(
  "arrstack-downloads-card-editor",
  ArrstackCardEditor.forServices(
    ["sonarr", "radarr", "sabnzbd"],
    SCHEMA_ARRSTACK_DOWNLOADS_CARD,
    TEXTE_ARRSTACK_DOWNLOADS_CARD
  )
);
customElements.define(
  "arrstack-recent-card-editor",
  ArrstackCardEditor.forServices(
    ["sonarr", "radarr"],
    SCHEMA_ARRSTACK_RECENT_CARD,
    TEXTE_ARRSTACK_RECENT_CARD
  )
);
customElements.define(
  "arrstack-fix-card-editor",
  ArrstackCardEditor.forServices(
    ["sonarr", "radarr"],
    SCHEMA_ARRSTACK_FIX_CARD,
    TEXTE_ARRSTACK_FIX_CARD
  )
);
customElements.define(
  "arrstack-seer-card-editor",
  ArrstackCardEditor.forServices(
    ["seerr"],
    SCHEMA_ARRSTACK_SEER_CARD,
    TEXTE_ARRSTACK_SEER_CARD
  )
);

/* Der Eintrag entsteht beim Laden der Datei — `hass` gibt es da noch nicht.
   Name und Beschreibung richten sich deshalb nach `navigator.language`. */
window.customCards.push(
  {
    type: "arrstack-downloads-card",
    name: TEXTE_ARRSTACK_DOWNLOADS_CARD[BROWSER_SPRACHE].name,
    description: TEXTE_ARRSTACK_DOWNLOADS_CARD[BROWSER_SPRACHE].description,
    preview: true,
    documentationURL: DOCS_URL,
  },
  {
    type: "arrstack-recent-card",
    name: TEXTE_ARRSTACK_RECENT_CARD[BROWSER_SPRACHE].name,
    description: TEXTE_ARRSTACK_RECENT_CARD[BROWSER_SPRACHE].description,
    preview: true,
    documentationURL: DOCS_URL,
  },
  {
    type: "arrstack-fix-card",
    name: TEXTE_ARRSTACK_FIX_CARD[BROWSER_SPRACHE].name,
    description: TEXTE_ARRSTACK_FIX_CARD[BROWSER_SPRACHE].description,
    preview: true,
    documentationURL: DOCS_URL,
  },
  {
    type: "arrstack-seer-card",
    name: TEXTE_ARRSTACK_SEER_CARD[BROWSER_SPRACHE].name,
    description: TEXTE_ARRSTACK_SEER_CARD[BROWSER_SPRACHE].description,
    preview: true,
    documentationURL: DOCS_URL,
  }
);
