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
 */

const CARD_VERSION = "0.2.0";

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

/** Gemeinsame Marken und Grundformen aller vier Karten.
 *
 * Alle Abstände, Radien und Schriftgrößen kommen aus dieser Skala — im
 * Kartencode steht keine nackte Zahl mehr. Die Sprünge sind gewollt groß
 * (8 innerhalb einer Gruppe, 24 zwischen Gruppen); ähnliche Abstände liest
 * niemand als Trennung.
 *
 * `container-type` sitzt auf `:host`, nicht auf `ha-card`: das Element liegt
 * im Shadow DOM und ist ohne Home Assistants Styles `display: inline` — an
 * einem inline dargestellten Element ist `container-type` wirkungslos.
 */
const ARRSTACK_STYLES = `
  :host {
    --arr-space-1: 4px;
    --arr-space-2: 8px;
    --arr-space-3: 12px;
    --arr-space-4: 24px;
    --arr-radius-1: 6px;
    --arr-radius-2: 10px;
    --arr-font-sm: 0.8125rem;
    --arr-font-md: 0.9375rem;
    --arr-font-lg: 1.125rem;
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
    display: block;
    container-type: inline-size;
  }

  ha-card { padding: var(--arr-space-4); }

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
  }
  .title {
    font-size: var(--arr-font-lg);
    font-weight: 600;
    color: var(--arr-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .head-meta {
    font-size: var(--arr-font-sm);
    color: var(--arr-muted);
    white-space: nowrap;
  }
  /* Das echte Logo des Dienstes — es sagt auf einen Blick, ob die Karte auf
     Radarr, Sonarr, SABnzbd oder Jellyseerr schaut. */
  .logo { flex: none; border-radius: var(--arr-radius-1); object-fit: contain; }
  .head-title .icon { flex: none; color: var(--arr-muted); }

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
  .row-main { flex: 1; min-width: 0; }
  /* Lange Titel brechen auf zwei Zeilen um, statt abgeschnitten zu werden —
     Dateinamen aus dem Usenet sind regelmäßig länger als jede Karte breit
     ist, und die Mitte des Namens ist der Teil, der die Folge benennt. */
  .row-title, .row-meta {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    overflow-wrap: anywhere;
  }
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
    flex: none;
    white-space: nowrap;
  }
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
  }
  button:hover { background: var(--arr-surface); }
  button[disabled] { color: var(--arr-muted); cursor: default; }
  button.primary {
    background: var(--arr-accent);
    color: var(--text-primary-color, #fff);
    font-weight: 600;
  }
  button.primary[disabled] {
    background: var(--arr-line);
    color: var(--arr-muted);
  }
  button.quiet { color: var(--arr-muted); }

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

  .notice {
    font-size: var(--arr-font-sm);
    color: var(--arr-muted);
    padding: var(--arr-space-2);
    border-radius: var(--arr-radius-1);
    background: var(--arr-surface);
  }
  .notice.problem { color: var(--error-color, #db4437); }

  .chip {
    font-size: var(--arr-font-sm);
    padding: var(--arr-space-1) var(--arr-space-2);
    border-radius: var(--arr-radius-2);
    background: var(--arr-surface);
    color: var(--arr-muted);
    white-space: nowrap;
  }

  /* Schmale Karte: Nebenspalten unter den Inhalt, statt Text abzuschneiden. */
  @container (max-width: 380px) {
    ha-card { padding: var(--arr-space-3); }
    .row { flex-wrap: wrap; }
    .actions { width: 100%; }
  }
`;

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

  connectedCallback() {
    this._startTimer();
    if (this._config && this._hass && !this._loaded) this._load();
  }

  disconnectedCallback() {
    this._stopTimer();
  }

  _startTimer() {
    this._stopTimer();
    const seconds = Number(this._config?.refresh_seconds);
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

  /** Ein WS-Aufruf mit der in der Karte eingestellten Instanz. */
  _call(type, params = {}) {
    const message = { type, ...params };
    if (this._config.entry_id) message.entry_id = this._config.entry_id;
    else if (this._config.service) message.service = this._config.service;
    return this._hass.callWS(message);
  }

  /** Fehlercodes der Integration in Sätze, die weiterhelfen. */
  _errorText(error) {
    const code = error?.code;
    if (code === "not_found") {
      return "Kein passender arrstack-Dienst eingerichtet.";
    }
    if (code === "ambiguous_instance") {
      return "Mehrere Instanzen vorhanden — im Karteneditor eine auswählen.";
    }
    if (code === "unsupported_service") {
      return "Dieser Dienst kann das nicht.";
    }
    if (code === "unauthorized") {
      return "Dafür fehlen die Rechte — Administrator nötig.";
    }
    return error?.message || "Daten konnten nicht geladen werden.";
  }

  /** Leerzustand als Entwurf, nicht als Restfläche. */
  _empty(icon, text) {
    return `<div class="empty">${arrIcon(icon, 28)}<span>${escapeHtml(text)}</span></div>`;
  }

  getCardSize() {
    return 4;
  }
}

/** Rohe API-Wörter in deutsche.
 *
 * Sonarr, Radarr und SABnzbd liefern ihre Zustände englisch und technisch
 * (`downloadClientUnavailable`). Auf einer Karte, die im Wohnzimmer hängt,
 * hat das nichts zu suchen.
 */
const QUEUE_STATUS_LABELS = {
  downloading: "lädt",
  queued: "wartet",
  paused: "pausiert",
  completed: "fertig",
  failed: "fehlgeschlagen",
  warning: "Warnung",
  delay: "verzögert",
  downloadclientunavailable: "Client nicht erreichbar",
  fallback: "Ausweichquelle",
  // SABnzbd
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
};

const TRACKED_STATE_LABELS = {
  importPending: "Import steht aus",
  importBlocked: "Import blockiert",
  importing: "wird importiert",
  imported: "importiert",
  failedPending: "fehlgeschlagen",
  failed: "fehlgeschlagen",
  ignored: "übergangen",
};

/** Was in der Zeile als Zustand steht.
 *
 * Der Importzustand schlägt den Download-Status, sobald er vom Normalfall
 * abweicht — „Import blockiert" ist die Auskunft, die zählt, nicht „fertig".
 */
function queueStatusText(item) {
  const tracked = TRACKED_STATE_LABELS[item.tracked_state];
  if (tracked) return tracked;
  const key = String(item.status || "").toLowerCase();
  return QUEUE_STATUS_LABELS[key] || item.status || "";
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
function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  const scaled = value / 1024 ** exponent;
  const digits = scaled >= 100 || exponent === 0 ? 0 : 1;
  // Deutsches Zahlenformat: 5,1 GB, nicht 5.1 GB.
  const text = scaled.toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${text} ${units[exponent]}`;
}

/** `00:12:30` → `12 Min.`; unbekannte Formate bleiben, wie sie sind. */
function formatTimeleft(value) {
  if (!value) return "";
  const parts = String(value).split(":").map((part) => Number(part));
  if (parts.length < 2 || parts.some((part) => Number.isNaN(part))) return String(value);
  const [hours, minutes] = parts.length === 3 ? parts : [0, parts[0]];
  if (hours >= 1) return `${hours} Std. ${String(minutes).padStart(2, "0")} Min.`;
  return `${minutes} Min.`;
}

/** Zeitpunkt als „vor 3 Std." — bei älteren Einträgen als Datum. */
function formatSince(value) {
  if (!value) return "";
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return "";
  const seconds = (Date.now() - then.getTime()) / 1000;
  if (seconds < 90) return "gerade eben";
  if (seconds < 5400) return `vor ${Math.round(seconds / 60)} Min.`;
  if (seconds < 172800) return `vor ${Math.round(seconds / 3600)} Std.`;
  if (seconds < 2592000) return `vor ${Math.round(seconds / 86400)} Tagen`;
  return then.toLocaleDateString();
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
 */
class ArrstackCardEditor extends HTMLElement {
  constructor() {
    super();
    this._instances = null;
    this._services = ["sonarr", "radarr", "sabnzbd", "seerr"];
  }

  /** Von den Unterklassen gesetzt: welche Dienste diese Karte bedienen kann. */
  static forServices(services, extraSchema = []) {
    return class extends ArrstackCardEditor {
      constructor() {
        super();
        this._services = services;
        this._extraSchema = extraSchema;
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

  _schema() {
    const options = (this._instances || []).map((instance) => ({
      value: instance.entry_id,
      label: `${instance.title}`,
    }));
    return [
      { name: "title", selector: { text: {} } },
      {
        name: "entry_id",
        selector: { select: { options, mode: "dropdown", custom_value: false } },
      },
      {
        name: "refresh_seconds",
        selector: { number: { min: 0, max: 600, mode: "box", unit_of_measurement: "s" } },
      },
      ...(this._extraSchema || []),
    ];
  }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (schema) =>
        ({
          title: "Überschrift",
          entry_id: "Instanz",
          refresh_seconds: "Neu laden alle (0 = nie)",
          max_items: "Höchstens so viele Einträge",
          show_posters: "Poster zeigen",
        }[schema.name] || schema.name);
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
  static getConfigElement() {
    return document.createElement("arrstack-downloads-card-editor");
  }

  static getStubConfig() {
    return { type: "custom:arrstack-downloads-card" };
  }

  _defaults() {
    return { title: "Downloads", max_items: 10, show_posters: true };
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
        <div class="head">
          <div class="head-title">
            ${serviceSymbol(this._data?.brand, "download", 22)}
            <span class="title">${escapeHtml(this._config.title)}</span>
          </div>
          <span class="head-meta">${escapeHtml(this._headMeta())}</span>
        </div>
        ${this._body()}
      </ha-card>`;
  }

  _headMeta() {
    if (this._error || !this._data) return "";
    const speed = this._data.speed ? `${formatBytes(this._data.speed)}/s` : "";
    const total = this._data.total ?? (this._data.items || []).length;
    return speed ? `${total} · ${speed}` : `${total}`;
  }

  _body() {
    if (this._error) {
      return `<div class="notice problem">${escapeHtml(this._errorText(this._error))}</div>`;
    }
    if (!this._data) {
      return `<div class="notice">Lade …</div>`;
    }
    const items = (this._data.items || []).slice(0, Number(this._config.max_items) || 10);
    if (!items.length) {
      return this._empty("download", "Nichts in der Warteschlange.");
    }
    return `<div class="rows">${items.map((item) => this._row(item)).join("")}</div>`;
  }

  _row(item) {
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
    const remaining = leftBytes > 0 ? formatBytes(leftBytes) : "";
    const title = item.parent_title || item.title || "";
    const meta = [item.episode, queueStatusText(item), item.category]
      .filter(Boolean)
      .join(" · ");
    const poster = this._config.show_posters
      ? posterMarkup(item.poster, this._data?.brand, "download")
      : "";
    const rest = formatTimeleft(item.timeleft) || remaining;
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
  static getConfigElement() {
    return document.createElement("arrstack-recent-card-editor");
  }

  static getStubConfig() {
    return { type: "custom:arrstack-recent-card" };
  }

  _defaults() {
    return { title: "Zuletzt hinzugefügt", max_items: 8, refresh_seconds: 120 };
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
        <div class="head">
          <div class="head-title">
            ${serviceSymbol(this._data?.brand, "download", 22)}
            <span class="title">${escapeHtml(this._config.title)}</span>
          </div>
        </div>
        ${this._body()}
      </ha-card>`;
  }

  _body() {
    if (this._error) {
      return `<div class="notice problem">${escapeHtml(this._errorText(this._error))}</div>`;
    }
    if (!this._data) return `<div class="notice">Lade …</div>`;
    const items = (this._data.items || []).slice(0, Number(this._config.max_items) || 8);
    if (!items.length) {
      return this._empty("film", "Noch nichts aufgenommen.");
    }
    return `<div class="rows">${items
      .map(
        (item) => `<div class="row">
          ${posterMarkup(item.poster, this._data?.brand)}
          <div class="row-main">
            <div class="row-title">${escapeHtml(item.title || "")}</div>
            <div class="row-meta">${escapeHtml(
              [item.subtitle, item.quality].filter(Boolean).join(" · ")
            )}</div>
          </div>
          <div class="row-side">
            <span class="sub">${escapeHtml(formatSince(item.added))}</span>
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
 */
class ArrstackFixCard extends ArrstackCardBase {
  static getConfigElement() {
    return document.createElement("arrstack-fix-card-editor");
  }

  static getStubConfig() {
    return { type: "custom:arrstack-fix-card" };
  }

  _defaults() {
    return { title: "Nicht importiert", refresh_seconds: 60 };
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
    const items = (this._data?.items || []);
    this.shadowRoot.innerHTML = `<style>${ARRSTACK_STYLES}</style>
      <ha-card>
        <div class="head">
          <div class="head-title">
            ${serviceSymbol(this._data?.brand, "download", 22)}
            <span class="title">${escapeHtml(this._config.title)}</span>
          </div>
          <span class="head-meta">${items.length ? `${items.length} offen` : ""}</span>
        </div>
        ${this._message ? `<div class="notice">${escapeHtml(this._message)}</div>` : ""}
        ${this._body(items)}
      </ha-card>`;
    this._bind();
  }

  _body(items) {
    if (this._error) {
      return `<div class="notice problem">${escapeHtml(this._errorText(this._error))}</div>`;
    }
    if (!this._data) return `<div class="notice">Lade …</div>`;
    if (!items.length) {
      return this._empty("check", "Alles importiert.");
    }
    return `<div class="rows">${items.map((item) => this._row(item)).join("")}</div>`;
  }

  _row(item) {
    const open = this._open && this._open.downloadId === item.download_id;
    const reason = item.messages?.[0] || item.tracked_state || "";
    return `<div class="row" data-download="${escapeHtml(item.download_id || "")}"
        data-item="${escapeHtml(item.id ?? "")}" style="flex-wrap: wrap;">
      <div class="thumb warn">${arrIcon("alert", 20)}</div>
      <div class="row-main">
        <div class="row-title">${escapeHtml(item.parent_title || item.title)}</div>
        <div class="row-meta">${escapeHtml(reason)}</div>
      </div>
      <div class="actions">
        <button class="check" ${this._busy ? "disabled" : ""}>
          ${arrIcon("search")}<span>Prüfen</span>
        </button>
      </div>
      ${open ? this._details(item) : ""}
    </div>`;
  }

  /** Aufgeklappte Kandidatenliste. Genau ein primärer Knopf, und der ist
   * nicht das Löschen — Entfernen bleibt bewusst zurückhaltend. */
  _details(item) {
    const info = this._open;
    if (info.loading) {
      return `<div class="notice" style="width: 100%;">Prüfe Dateien …</div>`;
    }
    const candidates = info.candidates || [];
    const list = candidates.length
      ? candidates
          .map(
            (candidate) => `<div class="row-meta">${escapeHtml(
              [candidate.name, candidate.parent, candidate.episodes?.join(", "),
                (candidate.rejections || []).join("; ")]
                .filter(Boolean)
                .join(" · ")
            )}</div>`
          )
          .join("")
      : `<div class="row-meta">Keine Datei gefunden.</div>`;

    return `<div class="notice" style="width: 100%;">
      ${list}
      <div class="actions" style="margin-top: var(--arr-space-3);">
        <button class="import primary" ${info.can_auto_import ? "" : "disabled"}>
          ${arrIcon("check")}<span>Importieren</span>
        </button>
        <button class="remove quiet">${arrIcon("trash")}<span>Entfernen</span></button>
      </div>
      ${
        info.can_auto_import
          ? ""
          : `<div class="row-meta" style="margin-top: var(--arr-space-2);">
              Automatischer Import gesperrt: ${escapeHtml(
                (info.reasons || []).join("; ") || "keine Zuordnung gefunden"
              )}
            </div>`
      }
    </div>`;
  }

  _bind() {
    this.shadowRoot.querySelectorAll(".row").forEach((row) => {
      const downloadId = row.dataset.download;
      const itemId = Number(row.dataset.item);
      row.querySelector(".check")?.addEventListener("click", () =>
        this._check(downloadId)
      );
      row.querySelector(".import")?.addEventListener("click", () =>
        this._import(downloadId)
      );
      row.querySelector(".remove")?.addEventListener("click", () =>
        this._remove(itemId)
      );
    });
  }

  async _check(downloadId) {
    if (!downloadId) {
      this._message = "Dieser Eintrag hat keine Download-Kennung.";
      this._render();
      return;
    }
    this._open = { downloadId, loading: true };
    this._message = null;
    this._render();
    try {
      const result = await this._call("arrstack/manual_import", {
        download_id: downloadId,
        action: "candidates",
      });
      this._open = { downloadId, ...result, loading: false };
    } catch (error) {
      this._open = null;
      this._message = this._errorText(error);
    }
    this._render();
  }

  async _import(downloadId) {
    this._busy = downloadId;
    this._message = null;
    this._render();
    try {
      const result = await this._call("arrstack/manual_import", {
        download_id: downloadId,
        action: "import",
      });
      this._message = `${result.imported} Datei(en) importiert.`;
      this._open = null;
    } catch (error) {
      this._message = this._errorText(error);
    }
    this._busy = null;
    await this._load();
  }

  async _remove(itemId) {
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
      this._message = "Eintrag entfernt.";
      this._open = null;
    } catch (error) {
      this._message = this._errorText(error);
    }
    this._busy = null;
    await this._load();
  }
}

/* ── Karte 4: Serie oder Film anfragen (Jellyseerr/Seerr) ───────────────── */

/** Suchen, Staffeln wählen, anfragen — ohne die Seerr-Oberfläche zu öffnen. */
class ArrstackSeerCard extends ArrstackCardBase {
  static getConfigElement() {
    return document.createElement("arrstack-seer-card-editor");
  }

  static getStubConfig() {
    return { type: "custom:arrstack-seer-card" };
  }

  _defaults() {
    // Diese Karte lädt auf Zuruf, nicht im Takt — sonst würde jede Suche
    // nach ein paar Sekunden von selbst verschwinden.
    return { title: "Anfragen", refresh_seconds: 0, max_items: 8 };
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
    this.shadowRoot.innerHTML = `<style>${ARRSTACK_STYLES}
      .search { display: flex; gap: var(--arr-space-2); margin-bottom: var(--arr-space-4); }
      .search input {
        flex: 1;
        min-width: 0;
        font: inherit;
        font-size: var(--arr-font-md);
        color: var(--arr-text);
        padding: var(--arr-space-2) var(--arr-space-3);
        border: none;
        border-radius: var(--arr-radius-1);
        background: var(--arr-surface);
      }
      .seasons {
        display: flex;
        flex-wrap: wrap;
        gap: var(--arr-space-2);
        margin: var(--arr-space-3) 0;
      }
      .season {
        font: inherit;
        font-size: var(--arr-font-sm);
        padding: var(--arr-space-1) var(--arr-space-3);
        border: none;
        border-radius: var(--arr-radius-2);
        background: var(--arr-surface);
        color: var(--arr-muted);
        cursor: pointer;
      }
      /* Gewählte Staffeln sind ein Zustand, keine zweite Hauptaktion: getönt
         statt gefüllt. Gefüllt bleibt allein „Anfragen". */
      .season[aria-pressed="true"] {
        background: color-mix(in srgb, var(--arr-accent) 18%, transparent);
        color: var(--arr-accent);
        font-weight: 600;
      }
      .season[disabled] { cursor: default; opacity: 0.55; }
      .foot { display: flex; justify-content: flex-end; gap: var(--arr-space-2); margin-top: var(--arr-space-4); }
      </style>
      <ha-card>
        <div class="head">
          <div class="head-title">
            ${serviceSymbol(null, "listPlus", 22)}
            <span class="title">${escapeHtml(this._config.title)}</span>
          </div>
        </div>
        <div class="search">
          <input type="search" placeholder="Serie oder Film suchen"
            value="${escapeHtml(this._query)}" aria-label="Suchbegriff">
          <button class="go quiet" aria-label="Suchen">${arrIcon("search")}</button>
        </div>
        ${this._message ? `<div class="notice">${escapeHtml(this._message)}</div>` : ""}
        ${this._body()}
      </ha-card>`;
    this._bind();
  }

  _body() {
    if (this._error) {
      return `<div class="notice problem">${escapeHtml(this._errorText(this._error))}</div>`;
    }
    if (this._show) return this._detail();
    if (this._results === null) {
      return this._empty("search", "Titel eintippen und suchen.");
    }
    if (!this._results.length) {
      return this._empty("search", "Nichts gefunden.");
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
                item.media_type === "tv" ? "Serie" : "Film",
                (item.date || "").slice(0, 4),
              ]
                .filter(Boolean)
                .join(" · ")
            )}</div>
          </div>
          <span class="chip">${escapeHtml(statusLabel(item.status))}</span>
        </div>`
      )
      .join("")}</div>`;
  }

  /** Detailansicht: bei Serien die Staffeln, bei Filmen nur der Knopf. */
  _detail() {
    const show = this._show;
    const seasons = show.seasons || [];
    const chips = seasons
      .map((season) => {
        const available = season.status_code === 5;
        const pressed = this._selected.has(season.season);
        const label = season.season === 0 ? "Specials" : `Staffel ${season.season}`;
        return `<button class="season" data-season="${season.season}"
          aria-pressed="${pressed}" ${available ? "disabled" : ""}
          title="${escapeHtml(available ? label + " — bereits verfügbar" : label)}">
          ${escapeHtml(label)}${available ? arrIcon("check", 14) : ""}
        </button>`;
      })
      .join("");

    return `<div class="row">
        ${posterMarkup(show.poster)}
        <div class="row-main">
          <div class="row-title">${escapeHtml(show.title || "")}</div>
          <div class="row-meta">${escapeHtml(statusLabel(show.status))}</div>
        </div>
      </div>
      ${seasons.length ? `<div class="seasons">${chips}</div>` : ""}
      <div class="foot">
        <button class="back quiet">Zurück</button>
        <button class="request primary" ${this._busy ? "disabled" : ""}>
          ${arrIcon("download")}<span>Anfragen</span>
        </button>
      </div>`;
  }

  _bind() {
    const input = this.shadowRoot.querySelector("input");
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") this._search(input.value);
    });
    this.shadowRoot.querySelector(".go")?.addEventListener("click", () =>
      this._search(input?.value)
    );
    this.shadowRoot.querySelectorAll(".result").forEach((row) => {
      row.addEventListener("click", () =>
        this._openResult(this._results[Number(row.dataset.index)])
      );
    });
    this.shadowRoot.querySelectorAll(".season").forEach((chip) => {
      chip.addEventListener("click", () => {
        const season = Number(chip.dataset.season);
        if (this._selected.has(season)) this._selected.delete(season);
        else this._selected.add(season);
        this._render();
      });
    });
    this.shadowRoot.querySelector(".back")?.addEventListener("click", () => {
      this._show = null;
      this._render();
    });
    this.shadowRoot.querySelector(".request")?.addEventListener("click", () =>
      this._request()
    );
  }

  async _search(query) {
    this._query = String(query || "").trim();
    this._message = null;
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
      this._render();
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
    } catch (error) {
      this._error = error;
    }
    this._render();
  }

  async _request() {
    const show = this._show;
    if (!show) return;
    const seasons = [...this._selected].sort((a, b) => a - b);
    if (show.media_type === "tv" && !seasons.length) {
      this._message = "Mindestens eine Staffel wählen.";
      this._render();
      return;
    }
    this._busy = true;
    this._render();
    try {
      const result = await this._call("arrstack/request", {
        media_type: show.media_type,
        media_id: show.id,
        ...(show.media_type === "tv" ? { seasons } : {}),
      });
      this._message = `Angefragt (Nr. ${result.request_id}).`;
      this._show = null;
    } catch (error) {
      this._message = this._errorText(error);
    }
    this._busy = false;
    this._render();
  }
}

/** Statuszahlen von Seerr in Worte (Enum aus Jellyseerr/Seerr). */
function statusLabel(status) {
  return {
    unknown: "nicht angefragt",
    pending: "offen",
    processing: "in Arbeit",
    partially_available: "teilweise da",
    available: "verfügbar",
    blocklisted: "gesperrt",
    deleted: "gelöscht",
  }[status] || "nicht angefragt";
}

/* ── Anmeldung ──────────────────────────────────────────────────────────── */

customElements.define("arrstack-downloads-card", ArrstackDownloadsCard);
customElements.define("arrstack-recent-card", ArrstackRecentCard);
customElements.define("arrstack-fix-card", ArrstackFixCard);
customElements.define("arrstack-seer-card", ArrstackSeerCard);

customElements.define(
  "arrstack-downloads-card-editor",
  ArrstackCardEditor.forServices(["sonarr", "radarr", "sabnzbd"], [
    { name: "max_items", selector: { number: { min: 1, max: 50, mode: "box" } } },
    { name: "show_posters", selector: { boolean: {} } },
  ])
);
customElements.define(
  "arrstack-recent-card-editor",
  ArrstackCardEditor.forServices(["sonarr", "radarr"], [
    { name: "max_items", selector: { number: { min: 1, max: 50, mode: "box" } } },
  ])
);
customElements.define(
  "arrstack-fix-card-editor",
  ArrstackCardEditor.forServices(["sonarr", "radarr"])
);
customElements.define(
  "arrstack-seer-card-editor",
  ArrstackCardEditor.forServices(["seerr"], [
    { name: "max_items", selector: { number: { min: 1, max: 20, mode: "box" } } },
  ])
);

window.customCards.push(
  {
    type: "arrstack-downloads-card",
    name: "arrstack Downloads",
    description: "Was gerade lädt — Sonarr, Radarr oder SABnzbd.",
    preview: true,
    documentationURL: "https://github.com/luukkii123/ha-arrstack-cards",
  },
  {
    type: "arrstack-recent-card",
    name: "arrstack Zuletzt",
    description: "Zuletzt in die Bibliothek aufgenommen.",
    preview: true,
    documentationURL: "https://github.com/luukkii123/ha-arrstack-cards",
  },
  {
    type: "arrstack-fix-card",
    name: "arrstack Import-Fix",
    description: "Heruntergeladen, aber nicht importiert — mit Schnell-Reparatur.",
    preview: true,
    documentationURL: "https://github.com/luukkii123/ha-arrstack-cards",
  },
  {
    type: "arrstack-seer-card",
    name: "arrstack Anfragen",
    description: "In Jellyseerr suchen, Staffeln wählen, anfragen.",
    preview: true,
    documentationURL: "https://github.com/luukkii123/ha-arrstack-cards",
  }
);
