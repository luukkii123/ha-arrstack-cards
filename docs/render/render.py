#!/usr/bin/env python3
"""Rendert arrstack-cards.js in echtem Chromium und misst die UI-Regeln.

Aufruf:  python3 render.py <pfad/arrstack-cards.js> <ausgabeordner> [breite]

Warum überhaupt: Reine Logiktests sehen nichts. Erst ein echter Browser zeigt,
ob eine Zeile umbricht, ob Text abgeschnitten wird, ob die Container-Query bei
schmaler Karte greift — und ob die Zurück-Taste einen Dialog schließt, statt
das Dashboard zu verlassen.

Gemessen wird gegen `hacs/docs/ui-regeln.md`:

* **Regel 1** (`regeln.messe_text`) an allen vier Karten — jede vorher in
  ihren vollen Zustand gebracht, die Seerr-Karte also mit Treffern statt mit
  ihrem Leerzustand —, bei 320, 480 und
  960 px, im hellen und im dunklen Thema — und das doppelt: einmal mit den
  HA-Abstandsvariablen (`--ha-space-*`), einmal ohne, also auf dem
  Rückfallpfad. Beide Fassungen kommen bei einem Nutzer vor, je nach Theme.
* **Regel 2** (`regeln.messe_popup`) an **drei** Dialogen: der Staffelauswahl
  der Seerr-Karte, dem Prüfergebnis der Reparatur-Karte und der Rückfrage vor
  dem Löschen. Die Messung öffnet sie über denselben Weg, den ein Nutzer
  nimmt.

  `popup_selektor` ist **`.sheet`**, das sichtbare Blatt — nicht der Host
  `arrstack-dialog`. Der ist `position: fixed; inset: 0`, sein Rechteck also
  das ganze Fenster: die Scrim-Messung fände keinen Punkt „neben" dem Popup
  und bliebe ohne Urteil, und Regel 1, Prüfung 2 („liegt im Rechteck") wäre
  am Dialog leer, weil alles im Fenster liegt.
* **Regel 1 in jedem der drei Dialoge**: derselbe Texttest mit `.sheet` als
  Bezug, ebenfalls bei allen drei Breiten in beiden Themen. Bezugsrechteck
  ist damit das Blatt selbst; ein Text, der darüber hinausragt, wird gemeldet.
  `messe_popup` misst nur Regel 2; ein geöffnetes Popup bliebe für Regel 1
  sonst ungemessen.
* **Gegenprobe** (`regeln.selbsttest`): schlägt die Messung überhaupt an, und
  meldet sie eine gewollte Kürzung *nicht* fälschlich als Verstoß?

Die Datei wird über einen **eigenen HTTP-Server** ausgeliefert statt per
`file://`. Nur so wäre ein Nachladeversuch auf einen Unterordner ein echter
404 — und nur so lässt sich belegen, dass keiner stattfindet. Jede Netzanfrage
landet in `report.json`.

`ha-card`, `ha-icon` und `ha-form` werden durch schlanke Attrappen ersetzt,
`hass.callWS` beantwortet die `arrstack/*`-Kommandos mit erfundenen Daten —
es wird kein Media-Stack gebraucht und kein Schlüssel. Die Attrappen-Titel
sind absichtlich zu lang: gekürzt werden muss genau dort.
"""
import json
import os
import pathlib
import shutil
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

# `/work` ist der Mount von `hacs/docs/render` (docker-run-Zeile in
# `docs/karten.md`). Das Messmodul liegt daneben; dieses Skript liegt im Repo
# und wird über `/cards` eingehängt.
sys.path.insert(0, "/work")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import regeln  # noqa: E402

JS = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(sys.argv[2])
WIDTH = int(sys.argv[3]) if len(sys.argv) > 3 else 620
OUT.mkdir(parents=True, exist_ok=True)
SERVE = OUT / "serve"
SERVE.mkdir(exist_ok=True)
shutil.copy(JS, SERVE / "arrstack-cards.js")
PORT = 8098

#: Die vier Karten, wie sie auf der Prüfseite liegen.
KARTEN = {
    "downloads": "arrstack-downloads-card",
    "recent": "arrstack-recent-card",
    "fix": "arrstack-fix-card",
    "seer": "arrstack-seer-card",
}

PAGE = """<!doctype html>
<meta charset="utf-8">
<title>arrstack-cards render</title>
<style id="regeln-thema">
  /* Die Karten nutzen ausschließlich HA-eigene CSS-Variablen. Ohne sie bliebe
     jede Fläche farblos — das wäre ein Fehler der Attrappe, nicht der Karte.
     Werte aus dem hellen und dem dunklen Standardtheme von Home Assistant.

     Die Kennung `regeln-thema` ist ein Vertrag mit `regeln.py`: eine Seite,
     die ihn trägt, bringt beide Themen selbst mit, und `lauf_breiten` legt
     nur noch `data-theme` am <html> um. Fehlt die Kennung, schiebt
     `regeln.py` seine eigenen Werte nach. */
  :root, :root[data-theme="light"] {
    color-scheme: light;
    --primary-color: #1c76be;
    --accent-color: #ff9800;
    --primary-text-color: #212121;
    --secondary-text-color: #727272;
    --disabled-text-color: #bdbdbd;
    --divider-color: #e0e0e0;
    --error-color: #db4437;
    --warning-color: #ffa600;
    --card-background-color: #fff;
    --ha-card-background: #fff;
    --primary-background-color: #fafafa;
    --secondary-background-color: #e5e5e5;
    --text-primary-color: #fff;
    --ha-card-border-radius: 12px;
    --seite-hintergrund: #f2f4f7;
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --primary-text-color: #e1e1e1;
    --secondary-text-color: #9b9b9b;
    --disabled-text-color: #6f6f6f;
    --divider-color: #474747;
    --card-background-color: #1c1c1c;
    --ha-card-background: #1c1c1c;
    --primary-background-color: #111;
    --secondary-background-color: #202020;
    --text-primary-color: #212121;
    --seite-hintergrund: #111418;
  }

  /* Die Abstands- und Schriftskala von Home Assistant. Sie wird für den
     zweiten Durchgang zugeschaltet: die Karten schreiben
     `var(--ha-space-4, 24px)`, und beide Seiten dieses Rückfalls kommen bei
     einem Nutzer vor — je nachdem, wie alt sein Theme ist. */
  :root.ha-tokens {
    --ha-space-1: 4px;
    --ha-space-2: 8px;
    --ha-space-3: 12px;
    --ha-space-4: 16px;
    --ha-space-5: 20px;
    --ha-space-6: 24px;
    --ha-font-size-s: 12px;
    --ha-font-size-m: 14px;
    --ha-font-size-l: 20px;
    --ha-font-weight-bold: 700;
  }
</style>
<style>
  body { margin: 0; padding: 16px; background: var(--seite-hintergrund);
         font-family: Roboto, sans-serif; color: var(--primary-text-color); }
  #wrap { max-width: MAXWIDTHpx; margin: 0 auto; display: flex;
          flex-direction: column; gap: 16px; }
  ha-card { display: block; background: var(--card-background-color);
            border-radius: var(--ha-card-border-radius);
            box-shadow: 0 2px 6px rgba(0,0,0,.15); }
</style>
<div id="wrap"></div>
<script>
  /* ── Attrappen für die Home-Assistant-Elemente ─────────────────────────── */
  class HaCard extends HTMLElement {}
  customElements.define('ha-card', HaCard);
  class HaIcon extends HTMLElement {
    connectedCallback() { this.style.display = 'inline-block';
      this.style.width = '24px'; this.style.height = '24px'; }
  }
  customElements.define('ha-icon', HaIcon);
  class HaForm extends HTMLElement {}
  customElements.define('ha-form', HaForm);

  /* ── erfundene Daten ───────────────────────────────────────────────────── */
  /* Absichtlich lange Titel: gekürzt werden muss genau dort, und ein
     Attrappen-Titel von acht Zeichen belegt gar nichts. */
  const now = Date.now();
  const ago = (h) => new Date(now - h * 3600000).toISOString();
  const LANG = 'Beispielserie.S03E04.German.DL.1080p.WEB.h264.INTERNAL-Eine.sehr.lange.Veroeffentlichungskennung';

  const QUEUE = [
    { id: 1, download_id: 'a1', title: LANG, parent_title: 'Beispielserie mit einem ungewoehnlich langen Namen',
      episode: 'S03E04', poster: null, size: 2.4e9, sizeleft: 6.1e8, timeleft: '00:07:20',
      progress: 74.6, status: 'downloading', tracked_state: 'downloading', messages: [] },
    { id: 2, download_id: 'b2', title: 'Ein sehr langer Filmtitel der garantiert nicht in eine Zeile passt 2026',
      parent_title: 'Ein sehr langer Filmtitel der garantiert nicht in eine Zeile passt',
      episode: null, poster: null, size: 8.2e9, sizeleft: 5.9e9, timeleft: '01:12:00',
      progress: 28.0, status: 'downloading', tracked_state: 'downloading', messages: [] },
    { id: 3, download_id: 'c3', title: 'Kurzfilm.2024.720p', parent_title: 'Kurzfilm',
      episode: null, poster: null, size: 9.0e8, sizeleft: 0, timeleft: null,
      progress: 100, status: 'completed', tracked_state: 'importing', messages: [] },
  ];

  const PROBLEMS = [
    { id: 41, download_id: 'x9', title: LANG, parent_title: null,
      tracked_state: 'importPending', unknown: true,
      messages: ['Unbekannte.Serie.S02E05.1080p: Unknown series, and a rather long explanation why'] },
    { id: 42, download_id: 'y7', title: 'Beispielserie.S01E09.1080p', parent_title: 'Beispielserie',
      tracked_state: 'importBlocked', unknown: false,
      messages: ['Beispielserie.S01E09: Existing file is better'] },
  ];

  const RECENT = [
    { id: 1, title: 'Beispielserie mit einem ungewoehnlich langen Namen', subtitle: 'S03E03',
      added: ago(2), quality: 'WEBDL-1080p', poster: null },
    { id: 2, title: 'Ein Film mit langem Titel', subtitle: '2025', added: ago(27),
      quality: 'Bluray-1080p', poster: null },
    { id: 3, title: 'Noch eine Serie', subtitle: 'S01E01', added: ago(70),
      quality: 'HDTV-720p', poster: null },
  ];

  const SEARCH = [
    { id: 1399, media_type: 'tv', title: 'Beispielserie mit einem ungewoehnlich langen Namen',
      date: '2011-04-17', poster: null, status: 'partially_available', status_code: 4 },
    { id: 550, media_type: 'movie', title: 'Beispielfilm', date: '1999-10-15',
      poster: null, status: 'unknown', status_code: 1 },
    { id: 66732, media_type: 'tv', title: 'Serie mit einem ausserordentlich langen Titel, der nirgends hineinpasst',
      date: '2016-07-15', poster: null, status: 'available', status_code: 5 },
  ];

  const SEASONS = {
    id: 1399, title: 'Beispielserie mit einem ungewoehnlich langen Namen', poster: null,
    status: 'partially_available',
    seasons: [
      { season: 0, name: 'Specials', episodes: 3, specials: true, status: 'unknown', status_code: 1 },
      { season: 1, name: 'Staffel 1', episodes: 10, status: 'available', status_code: 5 },
      { season: 2, name: 'Staffel 2', episodes: 10, status: 'unknown', status_code: 1 },
      { season: 3, name: 'Staffel 3', episodes: 10, status: 'unknown', status_code: 1 },
    ],
  };

  window.__wsCalls = [];
  window.__ergebnisse = { imported: 0, geloescht: 0, angefragt: 0 };
  const hass = {
    locale: { language: 'de' },
    states: {},
    callWS(msg) {
      window.__wsCalls.push(msg);
      switch (msg.type) {
        case 'arrstack/queue':
          return Promise.resolve({ service: 'sonarr', brand: 'sonarr',
                                   items: window.__emptyQueue ? [] : QUEUE,
                                   total: window.__emptyQueue ? 0 : QUEUE.length, speed: 5.4e6 });
        case 'arrstack/recent':
          return Promise.resolve({ service: 'sonarr', brand: 'sonarr', items: RECENT });
        case 'arrstack/import_problems':
          return Promise.resolve({ service: 'sonarr', brand: 'sonarr', items: PROBLEMS });
        case 'arrstack/manual_import':
          if (msg.action === 'import') {
            window.__ergebnisse.imported += 1;
            return Promise.resolve({ imported: 1 });
          }
          return Promise.resolve({
            service: 'sonarr', can_auto_import: false,
            reasons: ['unknownSeries', 'Keine Serie/kein Film zugeordnet'],
            candidates: [{ name: 'Unbekannte.Serie.S02E05.1080p.German.DL.WEB.h264-LANGERNAME.mkv',
                           size: 2.1e9, quality: 'WEBDL-1080p', parent: null, episodes: [],
                           rejections: ['unknownSeries'] }],
          });
        case 'arrstack/queue_remove':
          window.__ergebnisse.geloescht += 1;
          return Promise.resolve({ ok: true });
        case 'arrstack/search':
          return Promise.resolve({ results: SEARCH, page: 1, total_pages: 1 });
        case 'arrstack/tv_seasons':
          return Promise.resolve(SEASONS);
        case 'arrstack/request':
          window.__ergebnisse.angefragt += 1;
          return Promise.resolve({ request_id: 7 });
        case 'arrstack/instances':
          return Promise.resolve({ instances: [
            { entry_id: 'e1', title: 'Sonarr (beispiel)', service: 'sonarr', brand: 'sonarr' },
          ] });
        default:
          return Promise.reject({ code: 'unknown_command', message: msg.type });
      }
    },
    callService() { return Promise.resolve(); },
  };
  window.__hass = hass;
</script>
<script src="/arrstack-cards.js"></script>
<script>
  window.__cards = {};
  window.__ready = (async () => {
    const wrap = document.getElementById('wrap');
    const make = (tag, config) => {
      const card = document.createElement(tag);
      card.setConfig({ type: 'custom:' + tag, refresh_seconds: 0, ...config });
      wrap.appendChild(card);
      card.hass = window.__hass;
      return card;
    };
    window.__cards.downloads = make('arrstack-downloads-card', {});
    window.__cards.recent = make('arrstack-recent-card', {});
    window.__cards.fix = make('arrstack-fix-card', {});
    window.__cards.seer = make('arrstack-seer-card', {});
    return true;
  })();
</script>
"""

# Eine Lovelace-Spalte ist auch auf einem breiten Bildschirm schmal —
# 1248 px breite Karten wären ein Bild, das es so nie gibt.
PAGE = PAGE.replace("MAXWIDTH", str(min(WIDTH - 32, 560)))
(SERVE / "page.html").write_text(PAGE, encoding="utf-8")

server = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(PORT), "--directory", str(SERVE)],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
time.sleep(1.5)

requests, responses, failures, console, errors = [], [], [], [], []
probe = {}
ui_ohne_tokens = ui_mit_tokens = selbst = None
popups = {}
ui_dialog = {}
eigen = {}


def dialog_offen(page):
    return page.evaluate("() => !!document.querySelector('arrstack-dialog')")


def alles_zu(page):
    """Vor jeder Messung: kein Dialog offen, kein Verlaufseintrag hängen."""
    for _ in range(4):
        if not dialog_offen(page):
            return
        page.keyboard.press("Escape")
        page.wait_for_timeout(250)


try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=["--no-sandbox"])
        page = browser.new_page(
            viewport={"width": WIDTH, "height": 1200},
            device_scale_factor=1,
            locale="de-DE",
        )
        page.on("request", lambda r: requests.append(r.url))
        page.on("response", lambda r: responses.append((r.status, r.url)))
        page.on("requestfailed", lambda r: failures.append((r.url, str(r.failure))))
        page.on("console", lambda m: console.append((m.type, m.text)))
        page.on("pageerror", lambda e: errors.append(str(e)))

        page.goto(f"http://127.0.0.1:{PORT}/page.html", wait_until="load")
        page.wait_for_function(
            "window.__cards && window.__cards.downloads "
            "&& window.__cards.downloads.shadowRoot.querySelector('.rows, .empty')",
            timeout=20000,
        )
        page.wait_for_timeout(400)

        # ── Screenshots bei der übergebenen Breite ───────────────────────────
        page.screenshot(path=str(OUT / f"alle-{WIDTH}-light.png"), full_page=True)
        for name, tag in KARTEN.items():
            page.locator(tag).screenshot(path=str(OUT / f"{name}-{WIDTH}-light.png"))

        # Leerzustand der Download-Karte — der häufigste erste Eindruck.
        page.evaluate(
            "async () => { window.__emptyQueue = true;"
            " await window.__cards.downloads._load(); }"
        )
        page.wait_for_timeout(300)
        page.locator("arrstack-downloads-card").screenshot(
            path=str(OUT / f"downloads-leer-{WIDTH}-light.png")
        )
        page.evaluate(
            "async () => { window.__emptyQueue = false;"
            " await window.__cards.downloads._load(); }"
        )
        page.wait_for_timeout(200)

        # ── Regel 1 an drei Breiten in beiden Themen ─────────────────────────
        # Erst `#wrap` freigeben, sonst hinge jede Karte an `max-width` und
        # alle drei Breiten ergäben dasselbe Bild.
        page.evaluate("""() => {
            const w = document.getElementById('wrap');
            w.style.maxWidth = 'none'; w.style.width = 'auto';
        }""")
        alles_zu(page)

        # Jede Karte in ihren vollen Zustand bringen, sonst misst der Lauf
        # Leerflächen: die Seerr-Karte zeigte sonst nur „Titel eintippen und
        # suchen" — die langen Treffertitel und die Statuschips, also genau
        # das, was kürzen muss, wären nie unter das Messgerät gekommen.
        page.evaluate("""async () => {
            await window.__cards.seer._search('beispiel');
            const t = window.__cards.fix._t();
            window.__cards.fix._message = t.gesperrt.replace('{grund}',
              'unknownSeries; Keine Serie und kein Film zugeordnet, und dieser '
              + 'Hinweis ist absichtlich laenger als jede Kartenbreite');
            window.__cards.fix._render();
        }""")
        page.wait_for_timeout(400)

        def messe_alle(p):
            return {name: regeln.messe_text(p, tag) for name, tag in KARTEN.items()}

        page.evaluate("() => document.documentElement.classList.remove('ha-tokens')")
        ui_ohne_tokens = regeln.lauf_breiten(page, messung=messe_alle)

        page.evaluate("() => document.documentElement.classList.add('ha-tokens')")
        ui_mit_tokens = regeln.lauf_breiten(page, messung=messe_alle)
        page.evaluate("() => document.documentElement.classList.remove('ha-tokens')")

        # Screenshots aus dem Regel-1-Lauf, damit jemand hineinsehen kann.
        for breite in (320, 480, 960):
            for thema in ("light", "dark"):
                page.set_viewport_size({"width": breite, "height": 1200})
                page.evaluate("(t) => { document.documentElement.dataset.theme = t; }", thema)
                page.wait_for_timeout(250)
                page.screenshot(path=str(OUT / f"alle-{breite}-{thema}.png"), full_page=True)

        # ── Gegenprobe: schlägt die Messung überhaupt an? ────────────────────
        page.set_viewport_size({"width": WIDTH, "height": 1200})
        page.evaluate("() => { document.documentElement.dataset.theme = 'light'; }")
        page.wait_for_timeout(300)
        selbst = regeln.selbsttest(page, "arrstack-downloads-card")

        # ── Regel 2 an den drei Dialogen ─────────────────────────────────────
        # Alle drei sind `arrstack-dialog` und liegen am document.body; die
        # Karten tragen `container-type: inline-size`, also `contain: layout`,
        # und wären für ein `position: fixed` darin der enthaltende Block.
        # Unter 450 px ist das Blatt Vollbild — dann gäbe es keinen Punkt
        # neben dem Popup, und die Scrim-Messung bliebe ohne Urteil. Gemessen
        # wird deshalb bei 960 px, wo Scrim und Blatt beide Fläche haben.
        page.set_viewport_size({"width": 960, "height": 1200})
        page.wait_for_timeout(200)
        alles_zu(page)
        popups["seer_staffeln"] = regeln.messe_popup(
            page,
            oeffnen=lambda: page.evaluate("""async () => {
                const c = window.__cards.seer;
                await c._search('beispiel');
                const row = c.shadowRoot.querySelector('.result');
                if (row) row.click();
            }"""),
            popup_selektor=".sheet",
            schliessen_knopf_selektor=".dlg-close")

        alles_zu(page)
        popups["fix_pruefen"] = regeln.messe_popup(
            page,
            oeffnen=lambda: page.evaluate(
                "() => { const b = window.__cards.fix.shadowRoot"
                "          .querySelector('.act-check'); if (b) b.click(); }"),
            popup_selektor=".sheet",
            schliessen_knopf_selektor=".dlg-close")

        alles_zu(page)
        popups["fix_loeschen"] = regeln.messe_popup(
            page,
            oeffnen=lambda: page.evaluate(
                "() => { const b = window.__cards.fix.shadowRoot"
                "          .querySelector('.act-delete'); if (b) b.click(); }"),
            popup_selektor=".sheet",
            schliessen_knopf_selektor=".dlg-close")

        # ── Regel 1 im Dialog ────────────────────────────────────────────────
        # Bezugsrechteck ist `.sheet`, das sichtbare Blatt — NICHT der Host
        # `arrstack-dialog`. Der ist `position: fixed; inset: 0` und damit so
        # gross wie das Fenster; gaebe man ihn als Bezug an, laege jeder Text
        # per Definition „im Rechteck" und Pruefung 2 waere leer (siehe Kopf
        # dieser Datei). Unter 450 px wird der Dialog Vollbild — dann fallen
        # Blatt und Fenster zusammen, das Blatt bleibt trotzdem der Bezug.
        alles_zu(page)

        # Je Dialog eine Öffnerfunktion; `vor_messung` sorgt dafür, dass er
        # nach jeder Größenänderung wieder offen ist.
        OEFFNER = {
            "seer_staffeln": """async () => {
                const c = window.__cards.seer;
                if (!c._results) await c._search('beispiel');
                const row = c.shadowRoot.querySelector('.result');
                if (row) row.click();
            }""",
            "fix_pruefen": """async () => {
                const b = window.__cards.fix.shadowRoot.querySelector('.act-check');
                if (b) b.click();
            }""",
            "fix_loeschen": """async () => {
                const b = window.__cards.fix.shadowRoot.querySelector('.act-delete');
                if (b) b.click();
            }""",
        }

        def macher(js):
            def auf(p):
                if not dialog_offen(p):
                    p.evaluate(js)
                    p.wait_for_timeout(500)
            return auf

        dialog_auf = macher(OEFFNER["seer_staffeln"])

        ui_dialog = {}
        for name, js in OEFFNER.items():
            alles_zu(page)
            auf = macher(js)
            auf(page)
            ui_dialog[name] = regeln.lauf_breiten(
                page,
                messung=lambda p: regeln.messe_text(p, ".sheet"),
                vor_messung=auf)
            alles_zu(page)
        dialog_auf(page)

        # Screenshots der Dialoge — Vollbild am Handy, Blatt am Schirm.
        for breite, thema in ((320, "light"), (WIDTH, "light"), (960, "dark")):
            page.set_viewport_size({"width": breite, "height": 1200})
            page.evaluate("(t) => { document.documentElement.dataset.theme = t; }", thema)
            dialog_auf(page)
            page.wait_for_timeout(300)
            page.screenshot(path=str(OUT / f"dialog-seer-{breite}-{thema}.png"))
        alles_zu(page)

        page.set_viewport_size({"width": WIDTH, "height": 1200})
        page.evaluate("() => { document.documentElement.dataset.theme = 'light'; }")
        page.evaluate(
            "() => { const b = window.__cards.fix.shadowRoot"
            "          .querySelector('.act-delete'); if (b) b.click(); }")
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / f"dialog-loeschen-{WIDTH}-light.png"))
        alles_zu(page)

        # Das Prüfergebnis der Reparatur-Karte: gesperrter Import mit Grund.
        page.evaluate(
            "() => { const b = window.__cards.fix.shadowRoot"
            "          .querySelector('.act-check'); if (b) b.click(); }")
        page.wait_for_function(
            "() => { const d = document.querySelector('arrstack-dialog');"
            "        return d && d.shadowRoot.querySelector('.dlg-sub'); }",
            timeout=10000)
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT / f"dialog-pruefen-{WIDTH}-light.png"))
        alles_zu(page)

        # ── Was regeln.py nicht misst, die Spec aber verlangt ────────────────
        # Scrim-Klick, Vollbildgrenze, Dialogbreite, z-index — und der
        # Editorvertrag aus Regel 3, an den echten Editor-Elementen abgefragt.
        alles_zu(page)
        eigen = {}

        page.set_viewport_size({"width": 960, "height": 1200})
        page.wait_for_timeout(200)
        laenge_vorher = page.evaluate("() => history.length")
        page.evaluate("""async () => {
            const c = window.__cards.seer;
            await c._search('beispiel');
            const row = c.shadowRoot.querySelector('.result');
            if (row) row.click();
        }""")
        page.wait_for_timeout(400)
        eigen["breit_960"] = page.evaluate("""() => {
            const d = document.querySelector('arrstack-dialog');
            const s = d.shadowRoot.querySelector('.sheet');
            const h = getComputedStyle(d);
            return { sheetBreite: Math.round(s.getBoundingClientRect().width),
                     zIndex: h.zIndex, position: h.position,
                     pointerEvents: h.pointerEvents };
        }""")
        # Scrim: ein Klick neben das Blatt schließt, ohne Eintrag zu hinterlassen.
        page.evaluate("""() => {
            const d = document.querySelector('arrstack-dialog');
            d.shadowRoot.querySelector('.scrim').click();
        }""")
        page.wait_for_timeout(400)
        eigen["scrim"] = {
            "danach_offen": dialog_offen(page),
            "history_length_vorher": laenge_vorher,
            "history_length_nachher": page.evaluate("() => history.length"),
            "href": page.evaluate("() => location.href"),
        }

        alles_zu(page)
        page.set_viewport_size({"width": 320, "height": 1200})
        page.wait_for_timeout(200)
        dialog_auf(page)
        eigen["vollbild_320"] = page.evaluate("""() => {
            const d = document.querySelector('arrstack-dialog');
            const r = d.shadowRoot.querySelector('.sheet').getBoundingClientRect();
            return { breite: Math.round(r.width), hoehe: Math.round(r.height),
                     viewportBreite: window.innerWidth, viewportHoehe: window.innerHeight };
        }""")
        alles_zu(page)

        page.set_viewport_size({"width": 960, "height": 1200})
        page.wait_for_timeout(200)
        page.evaluate(
            "() => { const b = window.__cards.fix.shadowRoot"
            "          .querySelector('.act-delete'); if (b) b.click(); }")
        page.wait_for_timeout(400)
        eigen["bestaetigung_960"] = page.evaluate("""() => {
            const d = document.querySelector('arrstack-dialog');
            const s = d.shadowRoot.querySelector('.sheet');
            return { sheetBreite: Math.round(s.getBoundingClientRect().width),
                     knoepfe: [...s.querySelectorAll('.dlg-foot button')]
                       .map(b => b.textContent.trim()),
                     rot: [...s.querySelectorAll('.dlg-foot button')]
                       .map(b => getComputedStyle(b).backgroundColor) };
        }""")
        alles_zu(page)

        # Regel 3 am echten Editor: jedes Schemafeld, beide Sprachen.
        eigen["editoren"] = page.evaluate("""async () => {
            const paare = {
              'arrstack-downloads-card': 'arrstack-downloads-card-editor',
              'arrstack-recent-card': 'arrstack-recent-card-editor',
              'arrstack-fix-card': 'arrstack-fix-card-editor',
              'arrstack-seer-card': 'arrstack-seer-card-editor',
            };
            const out = {};
            for (const [karte, editorTag] of Object.entries(paare)) {
              const ed = document.createElement(editorTag);
              document.body.appendChild(ed);
              ed.setConfig({ type: 'custom:' + karte });
              ed.hass = { ...window.__hass, locale: { language: 'de' } };
              await new Promise(r => setTimeout(r, 60));
              const form = ed.querySelector('ha-form');
              const schema = form.schema;
              const lese = (sprache) => {
                ed.hass = { ...window.__hass, locale: { language: sprache } };
                return schema.map(f => ({
                  name: f.name,
                  label: form.computeLabel(f),
                  helper: form.computeHelper(f),
                }));
              };
              const de = lese('de'), en = lese('en');
              out[karte] = {
                felder: schema.map(f => f.name),
                de, en,
                ohneLabel: [...de, ...en].filter(f => !f.label || f.label === f.name)
                  .map(f => f.name),
                ohneHelper: [...de, ...en].filter(f => !f.helper).map(f => f.name),
                helferMitPunkt: [...de, ...en].every(f => /[.!?]$/.test(f.helper)),
                labelOhnePunkt: [...de, ...en].every(f => !/[.]$/.test(f.label)),
                gleich: JSON.stringify(de) === JSON.stringify(en),
                instanzOptionen: (schema.find(f => f.name === 'entry_id') || {})
                  .selector.select.options.length,
              };
              ed.remove();
            }
            return out;
        }""")

        # ── Beschaffenheit, die kein Bild zeigt ──────────────────────────────
        page.wait_for_timeout(200)
        probe = page.evaluate(
            """() => {
                const out = {};
                for (const [name, card] of Object.entries(window.__cards)) {
                  const sr = card.shadowRoot;
                  const host = getComputedStyle(card);
                  out[name] = {
                    containerType: host.containerType,
                    display: host.display,
                    rows: sr.querySelectorAll('.row').length,
                    // Gezählt wird, was wirklich flächig in der Akzentfarbe
                    // liegt — ein getönter Chip ist ein Zustand, keine
                    // konkurrierende Hauptaktion.
                    filledAccents: [...sr.querySelectorAll('button, .season, .chip')]
                      .filter(el => el.offsetParent !== null)
                      .filter(el => {
                        const bg = getComputedStyle(el).backgroundColor;
                        const m = bg.match(/rgba?\\(([^)]+)\\)/);
                        if (!m) return false;
                        const [r, g, b, a = '1'] = m[1].split(',').map(v => parseFloat(v));
                        return a > 0.85 && !(r === g && g === b);
                      }).length,
                    buttons: sr.querySelectorAll('button').length,
                    // Regel 1: jeder einzeilige Textcontainer trägt alle vier.
                    einzeiligOhneEllipsis: [...sr.querySelectorAll('*')]
                      .filter(el => {
                        const s = getComputedStyle(el);
                        return s.whiteSpace === 'nowrap' &&
                               !(s.textOverflow || '').startsWith('ellipsis');
                      }).map(el => el.localName + '.' + el.className),
                    emojiInMarkup: /[\\u{1F300}-\\u{1FAFF}\\u{2700}-\\u{27BF}]/u.test(sr.innerHTML),
                    svgIcons: sr.querySelectorAll('svg.icon').length,
                    logos: sr.querySelectorAll('img.logo').length,
                    logosLoaded: [...sr.querySelectorAll('img.logo')]
                      .filter(el => el.complete && el.naturalWidth > 0).length,
                  };
                }
                // Zweisprachigkeit: dieselbe Karte, andere Sprache.
                const seer = window.__cards.seer;
                const vorher = seer.shadowRoot.querySelector('.title').textContent;
                seer.hass = { ...window.__hass, locale: { language: 'en' } };
                seer._render();
                const nachher = seer.shadowRoot.querySelector('.title').textContent;
                const platzhalter = seer.shadowRoot.querySelector('input').placeholder;
                seer.hass = window.__hass;
                seer._render();
                out.sprache = { de: vorher, en: nachher, en_platzhalter: platzhalter };
                out.customCards = (window.customCards || [])
                  .filter(c => String(c.type).startsWith('arrstack-'))
                  .map(c => ({ type: c.type, name: c.name, description: c.description,
                               preview: c.preview, doc: !!c.documentationURL }));
                out.kartenMethoden = Object.fromEntries(
                  Object.entries(window.__cards).map(([n, card]) => [n, {
                    getConfigElement: typeof card.constructor.getConfigElement,
                    getStubConfig: typeof card.constructor.getStubConfig,
                    stub: card.constructor.getStubConfig(),
                    getCardSize: card.getCardSize(),
                    getGridOptions: card.getGridOptions(),
                  }]));
                out.wsCalls = [...new Set(window.__wsCalls.map(c => c.type))];
                out.ergebnisse = window.__ergebnisse;
                out.dialogeOffen = document.querySelectorAll('arrstack-dialog').length;
                out.pageScrollWidth = document.documentElement.scrollWidth;
                out.viewportWidth = window.innerWidth;
                return out;
            }"""
        )
        browser.close()
finally:
    server.terminate()

report = {
    "viewport": WIDTH,
    "requests": requests,
    "vendor_requests": [u for u in requests if "/vendor/" in u or "hacsfiles" in u],
    "bad_responses": [r for r in responses if r[0] >= 400],
    "request_failures": failures,
    "console_errors": [c for c in console if c[0] == "error"],
    "page_errors": errors,
    "probe": probe,
    "ui_regeln_ohne_ha_tokens": ui_ohne_tokens,
    "ui_regeln_mit_ha_tokens": ui_mit_tokens,
    "ui_regeln_dialog": ui_dialog,
    "ui_zaehlung": {
        "karten_ohne_ha_tokens": regeln.zaehle(ui_ohne_tokens),
        "karten_mit_ha_tokens": regeln.zaehle(ui_mit_tokens),
        "dialog": regeln.zaehle(ui_dialog),
    },
    "ui_selbsttest": selbst,
    "ui_popups": popups,
    "eigene_pruefungen": eigen,
}
(OUT / "report.json").write_text(
    json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8"
)
print(json.dumps(report["ui_zaehlung"], indent=2, ensure_ascii=False))
print("Selbsttest:", json.dumps({k: v for k, v in selbst.items() if k != "befund"},
                                ensure_ascii=False))
for name, messung in popups.items():
    print("Popup %-14s %s" % (
        name, json.dumps({k: v["ergebnis"] for k, v in messung.items()},
                         ensure_ascii=False)))
print("Eigene Prüfungen:", json.dumps(
    {"scrim_schliesst": eigen.get("scrim", {}).get("danach_offen") is False,
     "scrim_ohne_waisen": eigen.get("scrim", {}).get("history_length_vorher")
                          == eigen.get("scrim", {}).get("history_length_nachher"),
     "sheet_960": eigen.get("breit_960", {}).get("sheetBreite"),
     "z_index": eigen.get("breit_960", {}).get("zIndex"),
     "vollbild_320": eigen.get("vollbild_320"),
     "bestaetigung_breite": eigen.get("bestaetigung_960", {}).get("sheetBreite"),
     "editor_ohne_label": {k: v["ohneLabel"] for k, v in eigen.get("editoren", {}).items()},
     "editor_ohne_helper": {k: v["ohneHelper"] for k, v in eigen.get("editoren", {}).items()},
     "editor_zweisprachig": {k: not v["gleich"] for k, v in eigen.get("editoren", {}).items()}},
    ensure_ascii=False))
print("Netz:", len(requests), "Anfragen,",
      len(report["bad_responses"]), "schlechte Antworten,",
      len(report["console_errors"]), "Konsolenfehler,",
      len(report["page_errors"]), "Seitenfehler")

# Ein Verstoß gegen Regel 1 oder 2 ist ein Fehler, kein Hinweis
# (docs/ui-regeln.md). Der Selbsttest zählt nicht mit — er ist die Gegenprobe
# am Werkzeug, nicht ein Befund an der Karte. Schlägt er nicht an oder meldet
# er eine gewollte Kürzung, taugt der ganze Lauf nichts; dann ebenfalls Exit 1.
schlecht = (regeln.bewerte(ui_ohne_tokens) or regeln.bewerte(ui_mit_tokens)
            or regeln.bewerte(ui_dialog) or regeln.bewerte(popups))
if not (selbst["ueberlauf_erkannt"] and selbst["ausserhalb_erkannt"]):
    print("FEHLER: Die Gegenprobe hat nicht angeschlagen — die Messung ist blind.")
    schlecht = 1
if not (selbst["ellipsis_nicht_gemeldet"] and selbst["ellipsis_als_gekuerzt_gezaehlt"]):
    print("FEHLER: Die Messung meldet gewollte Kürzung als Verstoß — überempfindlich.")
    schlecht = 1
# Die Spec verlangt mehr, als das Modul misst: Scrim, Vollbildgrenze,
# Dialogbreite und der Editorvertrag. Ein Fehlschlag dort ist derselbe Fehler.
if eigen.get("scrim", {}).get("danach_offen") is not False:
    print("FEHLER: Der Klick neben den Dialog schließt ihn nicht.")
    schlecht = 1
if eigen.get("scrim", {}).get("history_length_vorher") != \
        eigen.get("scrim", {}).get("history_length_nachher"):
    print("FEHLER: Der Scrim-Klick hinterlässt einen verwaisten Verlaufseintrag.")
    schlecht = 1
if eigen.get("breit_960", {}).get("sheetBreite", 9999) > 560:
    print("FEHLER: Der Dialog ist breiter als 560 px.")
    schlecht = 1
if eigen.get("bestaetigung_960", {}).get("sheetBreite", 9999) > 320:
    print("FEHLER: Der Bestätigungsdialog ist breiter als 320 px.")
    schlecht = 1
vb = eigen.get("vollbild_320", {})
if vb and (vb["breite"] < vb["viewportBreite"] or vb["hoehe"] < vb["viewportHoehe"]):
    print("FEHLER: Unter 450 px ist der Dialog nicht Vollbild.")
    schlecht = 1
for karte, befund in eigen.get("editoren", {}).items():
    if befund["ohneLabel"] or befund["ohneHelper"]:
        print("FEHLER: %s — Felder ohne Label/Helper: %s / %s"
              % (karte, befund["ohneLabel"], befund["ohneHelper"]))
        schlecht = 1
    if befund["gleich"]:
        print("FEHLER: %s — deutsch und englisch sind identisch." % karte)
        schlecht = 1
    if not befund["helferMitPunkt"]:
        print("FEHLER: %s — ein Helper endet nicht mit einem Punkt." % karte)
        schlecht = 1
    if not befund["labelOhnePunkt"]:
        print("FEHLER: %s — ein Label endet mit einem Punkt." % karte)
        schlecht = 1
if report["page_errors"] or report["console_errors"]:
    print("FEHLER: Die Seite hat Fehler protokolliert.")
    schlecht = 1
sys.exit(schlecht)
