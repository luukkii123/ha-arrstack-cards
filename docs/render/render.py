#!/usr/bin/env python3
"""Rendert arrstack-cards.js in echtem Chromium und schießt Screenshots.

Aufruf:  python3 render.py <pfad/arrstack-cards.js> <ausgabeordner> [breite] [thema]

Warum überhaupt: Reine Logiktests sehen nichts. Erst ein echter Browser zeigt,
ob eine Zeile umbricht, ob Text abgeschnitten wird und ob die Container-Query
bei schmaler Karte greift.

Die Datei wird über einen **eigenen HTTP-Server** ausgeliefert statt per
`file://`. Nur so wäre ein Nachladeversuch auf einen Unterordner ein echter
404 — und nur so lässt sich belegen, dass keiner stattfindet. Jede Netzanfrage
landet in `report.json`.

`ha-card`, `ha-icon` und `ha-form` werden durch schlanke Attrappen ersetzt,
`hass.callWS` beantwortet die `arrstack/*`-Kommandos mit erfundenen Daten —
es wird kein Media-Stack gebraucht und kein Schlüssel.

Durchgespielt werden auch die Zustände, die man sonst nie sieht: Leerzustand,
aufgeklappte Reparatur, Suchergebnis und Staffelauswahl.
"""
import json
import pathlib
import shutil
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

JS = pathlib.Path(sys.argv[1])
OUT = pathlib.Path(sys.argv[2])
WIDTH = int(sys.argv[3]) if len(sys.argv) > 3 else 620
THEME = sys.argv[4] if len(sys.argv) > 4 else "light"
OUT.mkdir(parents=True, exist_ok=True)
SERVE = OUT / "serve"
SERVE.mkdir(exist_ok=True)
shutil.copy(JS, SERVE / "arrstack-cards.js")
PORT = 8098

DARK = THEME == "dark"
PAGE_BG = "#111418" if DARK else "#f2f4f7"
CARD_BG = "#1c2025" if DARK else "#ffffff"
TEXT = "#e8eaed" if DARK else "#212121"
MUTED = "#9aa0a6" if DARK else "#727272"
SURFACE = "rgba(255,255,255,.08)" if DARK else "rgba(0,0,0,.06)"
LINE = "rgba(255,255,255,.18)" if DARK else "rgba(0,0,0,.14)"

PAGE = """<!doctype html>
<meta charset="utf-8">
<title>arrstack-cards render</title>
<style>
  body {{ margin: 0; padding: 16px; background: {page_bg}; font-family: Roboto, sans-serif;
         --primary-text-color: {text}; --secondary-text-color: {muted};
         --primary-color: #1c76be; --text-primary-color: #fff;
         --secondary-background-color: {surface}; --divider-color: {line};
         --error-color: #db4437; }}
  #wrap {{ max-width: {card_max}px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }}
  ha-card {{ display: block; background: {card_bg}; border-radius: 12px;
            box-shadow: 0 2px 6px rgba(0,0,0,.15); }}
</style>
<div id="wrap"></div>
<script>
  /* ── Attrappen für die Home-Assistant-Elemente ─────────────────────────── */
  class HaCard extends HTMLElement {{}}
  customElements.define('ha-card', HaCard);
  class HaIcon extends HTMLElement {{
    connectedCallback() {{ this.style.display = 'inline-block';
      this.style.width = '24px'; this.style.height = '24px'; }}
  }}
  customElements.define('ha-icon', HaIcon);
  class HaForm extends HTMLElement {{}}
  customElements.define('ha-form', HaForm);

  /* ── erfundene Daten ───────────────────────────────────────────────────── */
  const now = Date.now();
  const ago = (h) => new Date(now - h * 3600000).toISOString();

  const QUEUE = [
    {{ id: 1, download_id: 'a1', title: 'Beispielserie.S03E04.1080p', parent_title: 'Beispielserie',
       episode: 'S03E04', poster: null, size: 2.4e9, sizeleft: 6.1e8, timeleft: '00:07:20',
       progress: 74.6, status: 'downloading', tracked_state: 'downloading', messages: [] }},
    {{ id: 2, download_id: 'b2', title: 'Ein sehr langer Filmtitel der garantiert nicht in eine Zeile passt 2026',
       parent_title: 'Ein sehr langer Filmtitel der garantiert nicht in eine Zeile passt',
       episode: null, poster: null, size: 8.2e9, sizeleft: 5.9e9, timeleft: '01:12:00',
       progress: 28.0, status: 'downloading', tracked_state: 'downloading', messages: [] }},
    {{ id: 3, download_id: 'c3', title: 'Kurzfilm.2024.720p', parent_title: 'Kurzfilm',
       episode: null, poster: null, size: 9.0e8, sizeleft: 0, timeleft: null,
       progress: 100, status: 'completed', tracked_state: 'importing', messages: [] }},
  ];

  const PROBLEMS = [
    {{ id: 41, download_id: 'x9', title: 'Unbekannte.Serie.S02E05.1080p', parent_title: null,
       tracked_state: 'importPending', unknown: true,
       messages: ['Unbekannte.Serie.S02E05.1080p: Unknown series'] }},
    {{ id: 42, download_id: 'y7', title: 'Beispielserie.S01E09.1080p', parent_title: 'Beispielserie',
       tracked_state: 'importBlocked', unknown: false,
       messages: ['Beispielserie.S01E09: Existing file is better'] }},
  ];

  const RECENT = [
    {{ id: 1, title: 'Beispielserie', subtitle: 'S03E03', added: ago(2), quality: 'WEBDL-1080p', poster: null }},
    {{ id: 2, title: 'Ein Film mit langem Titel', subtitle: '2025', added: ago(27), quality: 'Bluray-1080p', poster: null }},
    {{ id: 3, title: 'Noch eine Serie', subtitle: 'S01E01', added: ago(70), quality: 'HDTV-720p', poster: null }},
  ];

  const SEARCH = [
    {{ id: 1399, media_type: 'tv', title: 'Beispielserie', date: '2011-04-17',
       poster: null, status: 'partially_available', status_code: 4 }},
    {{ id: 550, media_type: 'movie', title: 'Beispielfilm', date: '1999-10-15',
       poster: null, status: 'unknown', status_code: 1 }},
    {{ id: 66732, media_type: 'tv', title: 'Serie mit einem außergewöhnlich langen Titel',
       date: '2016-07-15', poster: null, status: 'available', status_code: 5 }},
  ];

  const SEASONS = {{
    id: 1399, title: 'Beispielserie', poster: null, status: 'partially_available',
    seasons: [
      {{ season: 0, name: 'Specials', episodes: 3, specials: true, status: 'unknown', status_code: 1 }},
      {{ season: 1, name: 'Staffel 1', episodes: 10, status: 'available', status_code: 5 }},
      {{ season: 2, name: 'Staffel 2', episodes: 10, status: 'unknown', status_code: 1 }},
      {{ season: 3, name: 'Staffel 3', episodes: 10, status: 'unknown', status_code: 1 }},
    ],
  }};

  window.__wsCalls = [];
  const hass = {{
    locale: {{ language: 'de' }},
    states: {{}},
    callWS(msg) {{
      window.__wsCalls.push(msg);
      switch (msg.type) {{
        case 'arrstack/queue':
          return Promise.resolve({{ service: 'sonarr', brand: 'sonarr',
                                   items: window.__emptyQueue ? [] : QUEUE,
                                   total: window.__emptyQueue ? 0 : QUEUE.length, speed: 5.4e6 }});
        case 'arrstack/recent':
          return Promise.resolve({{ service: 'sonarr', brand: 'sonarr', items: RECENT }});
        case 'arrstack/import_problems':
          return Promise.resolve({{ service: 'sonarr', brand: 'sonarr', items: PROBLEMS }});
        case 'arrstack/manual_import':
          return Promise.resolve({{
            service: 'sonarr', can_auto_import: false,
            reasons: ['unknownSeries', 'Keine Serie/kein Film zugeordnet'],
            candidates: [{{ name: 'Unbekannte.Serie.S02E05.1080p.mkv', size: 2.1e9,
                           quality: 'WEBDL-1080p', parent: null, episodes: [],
                           rejections: ['unknownSeries'] }}],
          }});
        case 'arrstack/search':
          return Promise.resolve({{ results: SEARCH, page: 1, total_pages: 1 }});
        case 'arrstack/tv_seasons':
          return Promise.resolve(SEASONS);
        case 'arrstack/instances':
          return Promise.resolve({{ instances: [
            {{ entry_id: 'e1', title: 'Sonarr (beispiel)', service: 'sonarr', brand: 'sonarr' }},
          ] }});
        default:
          return Promise.reject({{ code: 'unknown_command', message: msg.type }});
      }}
    }},
    callService() {{ return Promise.resolve(); }},
  }};
  window.__hass = hass;
</script>
<script src="/arrstack-cards.js"></script>
<script>
  window.__cards = {{}};
  window.__ready = (async () => {{
    const wrap = document.getElementById('wrap');
    const make = (tag, config) => {{
      const card = document.createElement(tag);
      card.setConfig({{ type: 'custom:' + tag, refresh_seconds: 0, ...config }});
      wrap.appendChild(card);
      card.hass = window.__hass;
      return card;
    }};
    window.__cards.downloads = make('arrstack-downloads-card', {{ title: 'Downloads' }});
    window.__cards.recent = make('arrstack-recent-card', {{ title: 'Zuletzt hinzugefügt' }});
    window.__cards.fix = make('arrstack-fix-card', {{ title: 'Nicht importiert' }});
    window.__cards.seer = make('arrstack-seer-card', {{ title: 'Anfragen' }});
    return true;
  }})();
</script>
"""

PAGE = PAGE.format(
    page_bg=PAGE_BG,
    card_bg=CARD_BG,
    text=TEXT,
    muted=MUTED,
    surface=SURFACE,
    line=LINE,
    # Eine Lovelace-Spalte ist auch auf einem breiten Bildschirm schmal —
    # 1248 px breite Karten wären ein Bild, das es so nie gibt.
    card_max=min(WIDTH - 32, 560),
)
(SERVE / "page.html").write_text(PAGE, encoding="utf-8")

server = subprocess.Popen(
    [sys.executable, "-m", "http.server", str(PORT), "--directory", str(SERVE)],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
time.sleep(1.5)

requests, responses, failures, console, errors = [], [], [], [], []
probe = {}
tag = f"{WIDTH}-{THEME}"
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=["--no-sandbox"])
        page = browser.new_page(
            viewport={"width": WIDTH, "height": 1000},
            device_scale_factor=2,
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

        page.screenshot(path=str(OUT / f"alle-{tag}.png"), full_page=True)
        for name in ("downloads", "recent", "fix", "seer"):
            page.locator(f"arrstack-{'seer' if name == 'seer' else name}-card").screenshot(
                path=str(OUT / f"{name}-{tag}.png")
            )

        # Leerzustand der Download-Karte — der häufigste erste Eindruck.
        page.evaluate(
            "async () => { window.__emptyQueue = true;"
            " await window.__cards.downloads._load(); }"
        )
        page.wait_for_timeout(300)
        page.locator("arrstack-downloads-card").screenshot(
            path=str(OUT / f"downloads-leer-{tag}.png")
        )
        page.evaluate(
            "async () => { window.__emptyQueue = false;"
            " await window.__cards.downloads._load(); }"
        )

        # Reparatur aufklappen: „Prüfen" auf dem ersten Eintrag.
        page.evaluate(
            "() => window.__cards.fix.shadowRoot.querySelector('.check').click()"
        )
        page.wait_for_function(
            "window.__cards.fix.shadowRoot.querySelector('.import')", timeout=10000
        )
        page.wait_for_timeout(300)
        page.locator("arrstack-fix-card").screenshot(
            path=str(OUT / f"fix-offen-{tag}.png")
        )

        # Suche und Staffelauswahl.
        page.evaluate("async () => { await window.__cards.seer._search('beispiel'); }")
        page.wait_for_timeout(300)
        page.locator("arrstack-seer-card").screenshot(
            path=str(OUT / f"seer-treffer-{tag}.png")
        )
        page.evaluate(
            "() => window.__cards.seer.shadowRoot.querySelector('.result').click()"
        )
        page.wait_for_function(
            "window.__cards.seer.shadowRoot.querySelector('.season')", timeout=10000
        )
        page.wait_for_timeout(300)
        page.locator("arrstack-seer-card").screenshot(
            path=str(OUT / f"seer-staffeln-{tag}.png")
        )

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
                    fontSizes: [...new Set([...sr.querySelectorAll('*')]
                      .filter(el => el.offsetParent !== null || el === sr.firstElementChild)
                      .map(el => getComputedStyle(el).fontSize))].sort(),
                    overflowing: [...sr.querySelectorAll('.row-title, .row-meta')]
                      .filter(el => el.scrollWidth > el.clientWidth + 1).length,
                    emojiInMarkup: /[\\u{1F300}-\\u{1FAFF}\\u{2700}-\\u{27BF}]/u.test(sr.innerHTML),
                    svgIcons: sr.querySelectorAll('svg.icon').length,
                    logos: sr.querySelectorAll('img.logo').length,
                    logosLoaded: [...sr.querySelectorAll('img.logo')]
                      .filter(el => el.complete && el.naturalWidth > 0).length,
                  };
                }
                out.wsCalls = [...new Set(window.__wsCalls.map(c => c.type))];
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
    "theme": THEME,
    "requests": requests,
    "subfolder_requests": [u for u in requests if "/vendor/" in u or "hacsfiles" in u],
    "bad_responses": [r for r in responses if r[0] >= 400],
    "request_failures": failures,
    "console_errors": [c for c in console if c[0] == "error"],
    "page_errors": errors,
    "probe": probe,
}
(OUT / f"report-{tag}.json").write_text(
    json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8"
)
print(json.dumps(report, indent=2, ensure_ascii=False)[:5000])
