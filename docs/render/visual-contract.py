#!/usr/bin/env python3
"""Shared UI contract 0.1.0: card/editor geometry and reviewed PNG baselines.

Run after render.py: python3 visual-contract.py <render-output> [--record]
The ha-form renderer is a visual stand-in; editor behavior has a separate test.
"""

import hashlib
import http.server
import json
import pathlib
import shutil
import sys
import threading

from playwright.sync_api import sync_playwright


out = pathlib.Path(sys.argv[1]).resolve()
record = "--record" in sys.argv[2:]
baseline = pathlib.Path(__file__).parent / "baselines" / "ui-0.1.0"
files = [f"alle-{width}-{theme}.png" for width in (320, 480, 960) for theme in ("light", "dark")]
files += [f"editoren-{width}-{theme}.png" for width in (320, 480, 960) for theme in ("light", "dark")]


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(out / "serve"), **kwargs)

    def log_message(self, *_args):
        pass


server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
findings = []
checks = {}

try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": 320, "height": 1200}, device_scale_factor=1, locale="de-DE")
        page.goto(f"http://127.0.0.1:{server.server_port}/page.html", wait_until="load")
        page.wait_for_function("window.__cards?.downloads?.shadowRoot?.querySelector('.rows')")
        page.evaluate("""async () => {
          await window.__cards.seer._search('beispiel');
          const fix = window.__cards.fix;
          fix._message = fix._t().gesperrt.replace('{grund}',
            'unknownSeries; Keine Serie und kein Film zugeordnet, und dieser Hinweis ist absichtlich laenger als jede Kartenbreite');
          fix._render();
          const wrap=document.getElementById('wrap');wrap.style.maxWidth='none';wrap.style.width='auto';
        }""")
        page.wait_for_timeout(200)
        for width in (320, 480, 960):
            for theme in ("light", "dark"):
                page.set_viewport_size({"width": width, "height": 1200})
                page.evaluate("theme => document.documentElement.dataset.theme=theme", theme)
                page.wait_for_timeout(100)
                metrics = page.evaluate("""() => {
                  const cards=Object.values(window.__cards);
                  const controls=cards.flatMap(card => [...card.shadowRoot.querySelectorAll('button,.row.result')]
                    .filter(el => el.getBoundingClientRect().width)
                    .map(el => ({card:card.localName,kind:el.className,
                      width:Math.round(el.getBoundingClientRect().width),
                      height:Math.round(el.getBoundingClientRect().height)})));
                  const badges=cards.flatMap(card => [...card.shadowRoot.querySelectorAll('.status-badge')]
                    .map(el => ({card:card.localName,text:el.textContent.trim(),tone:[...el.classList].at(-1)})));
                  const media=cards.map(card=>({card:card.localName,
                    width:Math.round(card.shadowRoot.querySelector('.head-media').getBoundingClientRect().width),
                    fallback:card.shadowRoot.querySelectorAll('.poster-fallback').length}));
                  return {controls,badges,media,pageWidth:document.documentElement.scrollWidth,
                    viewport:innerWidth};
                }""")
                checks[f"cards-{width}-{theme}"] = metrics
                if metrics["pageWidth"] > width:
                    findings.append(f"Karten {width}/{theme}: horizontale Seitenverschiebung")
                for control in metrics["controls"]:
                    if control["height"] < 44 or ("go" in control["kind"] and control["width"] < 44):
                        findings.append(f"Karten {width}/{theme}: Aktionsfläche zu klein: {control}")
                if len(metrics["badges"]) < 5 or any(not badge["text"] for badge in metrics["badges"]):
                    findings.append(f"Karten {width}/{theme}: Status ohne Text")
                if any(media["width"] < 40 for media in metrics["media"]):
                    findings.append(f"Karten {width}/{theme}: Kartenkopf zu klein")
                page.evaluate("""async () => {const card=window.__cards.seer;
                  await card._openResult(card._results[0])}""")
                dialog = page.evaluate("""() => {
                  const root=document.querySelector('arrstack-dialog').shadowRoot;
                  return [...root.querySelectorAll('.dlg-close,.dlg-foot button,.season')]
                    .map(button=>({kind:button.className,
                      width:Math.round(button.getBoundingClientRect().width),
                      height:Math.round(button.getBoundingClientRect().height)}));
                }""")
                checks[f"dialog_actions-{width}-{theme}"] = dialog
                if any(button["height"] < 44 or (button["kind"] == "dlg-close" and button["width"] < 44)
                       for button in dialog):
                    findings.append(f"Dialog {width}/{theme}: Aktionsfläche zu klein: {dialog}")
                page.keyboard.press("Escape")
                page.wait_for_function("!document.querySelector('arrstack-dialog')")
        keyboard = page.evaluate("""() => {const row=window.__cards.seer.shadowRoot.querySelector('.result');
          row.focus();row.dispatchEvent(new KeyboardEvent('keydown',
            {key:'Enter',bubbles:true,composed:true,cancelable:true}));
          return {role:row.getAttribute('role'),tabIndex:row.tabIndex};}""")
        page.wait_for_function("!!document.querySelector('arrstack-dialog')")
        keyboard["opened"] = True
        page.keyboard.press("Escape")
        page.wait_for_function("!document.querySelector('arrstack-dialog')")
        checks["keyboard_result"] = keyboard
        if keyboard["role"] != "button" or keyboard["tabIndex"] != 0:
            findings.append(f"Suchergebnis nicht per Tastatur erreichbar: {keyboard}")
        # Lade-, Fehler- und Leerzustand je Karte ohne Netzwerk- oder HA-Zugriff.
        states = page.evaluate("""() => {
          const result={};
          for (const [name,card] of Object.entries(window.__cards)) {
            const original={data:card._data,error:card._error,results:card._results,message:card._message};
            card._error=null;card._message=null;card._data=null;card._results=null;card._render();
            const loading=!!card.shadowRoot.querySelector('.notice,.empty');
            card._error=new Error('offline');card._render();
            const error=!!card.shadowRoot.querySelector('.notice.problem');
            card._error=null;card._data={items:[]};card._results=[];card._render();
            const empty=!!card.shadowRoot.querySelector('.empty');
            Object.assign(card,{_data:original.data,_error:original.error,
              _results:original.results,_message:original.message});card._render();
            result[name]={loading,error,empty};
          }
          return result;
        }""")
        checks["states"] = states
        for name, state in states.items():
            if not all(state.values()):
                findings.append(f"{name}: Lade-/Fehler-/Leerzustand fehlt: {state}")
        tones = page.evaluate("""() => {
          const downloads=window.__cards.downloads,original=downloads._data;
          downloads._data={brand:null,items:[
            {title:'Running',status:'running'},
            {title:'Warning',status:'warning'},
            {title:'Failed',status:'failed'},
            {title:'Paused',status:'paused'},
            {title:'Unavailable',status:'downloadClientUnavailable'},
            {title:'Mystery',status:'mystery'},
          ]};downloads._render();
          const result=[...downloads.shadowRoot.querySelectorAll('.status-badge')]
            .map(badge=>({text:badge.textContent.trim(),tone:[...badge.classList].at(-1)}));
          downloads._data=original;downloads._render();return result;
        }""")
        checks["status_tones"] = tones
        if [item["tone"] for item in tones] != [
            "success", "warning", "error", "neutral", "unavailable", "unknown"
        ] or any(not item["text"] for item in tones):
            findings.append(f"Statuszuordnung oder Text fehlt: {tones}")
        page.evaluate("""() => {
          const card=window.__cards.downloads;card._visualOriginalData=card._data;
          card._data={brand:null,items:[{title:'Ohne Bild',poster:'/missing-poster.png',status:'queued'}]};
          card._render();
        }""")
        page.wait_for_function("""() => !!window.__cards.downloads.shadowRoot
          .querySelector('.poster-fallback:not([hidden])')""")
        checks["missing_poster"] = True
        page.evaluate("""() => {const card=window.__cards.downloads;
          card._data=card._visualOriginalData;delete card._visualOriginalData;card._render()}""")

        # Sichtbare ha-form-Attrappe mit denselben Schema-, Label- und Helperdaten.
        page.evaluate("""() => {
          const Form=customElements.get('ha-form');
          const draw=function(){
            if(!this._schema||!this._data)return;
            this.replaceChildren();
            for(const field of this._schema){
              const row=document.createElement('div');row.className='form-row';
              const label=document.createElement('label');
              const labelText=document.createElement('span');labelText.className='field-label';
              labelText.textContent=this.computeLabel(field);label.append(labelText);
              const helper=document.createElement('small');helper.textContent=this.computeHelper(field);
              let control;
              if(field.selector?.select){
                control=document.createElement('select');
                const empty=document.createElement('option');empty.textContent='—';empty.value='';control.append(empty);
                for(const option of field.selector.select.options||[]){const item=document.createElement('option');
                  item.value=option.value;item.textContent=option.label;control.append(item);}
                control.value=this._data[field.name]||'';
              }else{
                control=document.createElement('input');
                control.type=field.selector?.number?'number':field.selector?.boolean?'checkbox':'text';
                if(control.type==='checkbox')control.checked=!!this._data[field.name];
                else control.value=this._data[field.name]??'';
              }
              label.append(control);row.append(label,helper);this.append(row);
            }
          };
          Object.defineProperties(Form.prototype,{
            schema:{get(){return this._schema},set(value){this._schema=value;draw.call(this)}},
            data:{get(){return this._data},set(value){this._data=value;draw.call(this)}},
            hass:{get(){return this._hass},set(value){this._hass=value;draw.call(this)}}
          });
          const style=document.createElement('style');style.textContent=`
            #editor-wrap{display:grid;gap:16px}
            .editor-panel{display:block;padding:var(--ha-space-4,16px);min-width:0}
            .editor-panel h2{font-size:18px;margin:0 0 16px;color:var(--primary-text-color)}
            #editor-wrap ha-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr));gap:12px;min-width:0}
            .form-row{display:grid;gap:4px;min-width:0}
            .form-row label{display:grid;gap:4px;font-size:14px;color:var(--primary-text-color)}
            .field-label{overflow-wrap:anywhere}
            .form-row small{font-size:12px;line-height:1.4;color:var(--secondary-text-color);overflow-wrap:anywhere}
            .form-row input,.form-row select{box-sizing:border-box;width:100%;min-width:0;min-height:44px;
              padding:8px;border:1px solid var(--divider-color);border-radius:8px;
              background:var(--card-background-color);color:var(--primary-text-color);font:inherit;caret-color:transparent}
            .form-row input:focus-visible,.form-row select:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}
          `;document.head.append(style);
          document.getElementById('wrap').style.display='none';
          const wrap=document.createElement('div');wrap.id='editor-wrap';document.body.append(wrap);
          for(const tag of ['arrstack-downloads-card','arrstack-recent-card','arrstack-fix-card','arrstack-seer-card']){
            const card=document.createElement(tag),panel=document.createElement('ha-card');panel.className='editor-panel';
            const title=document.createElement('h2');title.textContent=tag;panel.append(title);
            const editor=card.constructor.getConfigElement();editor.setConfig({...card.constructor.getStubConfig(),title:'Sehr langer Beispielkartenname für das schmale Dashboard'});
            editor.hass={locale:{language:'de'},states:{},callWS:async()=>({instances:[
              {service:'sonarr',entry_id:'sonarr-1',title:'Sonarr Beispielinstanz'},
              {service:'radarr',entry_id:'radarr-1',title:'Radarr Beispielinstanz'},
              {service:'seerr',entry_id:'seerr-1',title:'Seerr Beispielinstanz'}]})};
            panel.append(editor);wrap.append(panel);
          }
        }""")
        page.wait_for_timeout(100)
        for width in (320, 480, 960):
            for theme in ("light", "dark"):
                page.set_viewport_size({"width": width, "height": 1200})
                page.evaluate("theme => document.documentElement.dataset.theme=theme", theme)
                page.wait_for_timeout(100)
                page.evaluate("""() => {document.activeElement?.blur();
                  document.querySelectorAll('#editor-wrap input').forEach(input=>input.scrollLeft=0)}""")
                name = f"editoren-{width}-{theme}.png"
                page.screenshot(path=str(out / name), full_page=True)
                metrics = page.evaluate("""() => {
                  const fields=[...document.querySelectorAll('#editor-wrap .form-row')];
                  const controls=fields.map(row=>row.querySelector('input,select'));
                  const within=fields.every(row=>{
                    const panel=row.closest('.editor-panel').getBoundingClientRect(),r=row.getBoundingClientRect();
                    return r.left>=panel.left-1&&r.right<=panel.right+1;
                  });
                  const collides=fields.some((row,i)=>fields.slice(i+1).some(other=>{
                    if(row.closest('.editor-panel')!==other.closest('.editor-panel'))return false;
                    const a=row.getBoundingClientRect(),b=other.getBoundingClientRect();
                    return Math.min(a.right,b.right)>Math.max(a.left,b.left)+1&&
                      Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)+1;
                  }));
                  const textOverflow=fields.some(row=>[row.querySelector('.field-label'),row.querySelector('small')]
                    .some(el=>el.scrollWidth>el.clientWidth+1));
                  const helpers=fields.every(row=>!!row.querySelector('small').textContent.trim());
                  const options=[...document.querySelectorAll('#editor-wrap select')]
                    .map(select=>select.options.length);
                  controls[0]?.focus();
                  return {fields:fields.length,within,collides,textOverflow,helpers,options,
                    minimumHeight:Math.min(...controls.map(el=>el.getBoundingClientRect().height)),
                    outline:getComputedStyle(controls[0]).outlineStyle,
                    pageWidth:document.documentElement.scrollWidth,viewport:innerWidth};
                }""")
                checks[f"editors-{width}-{theme}"] = metrics
                if (metrics["pageWidth"] > width or not metrics["within"] or metrics["collides"]
                        or metrics["textOverflow"] or not metrics["helpers"]
                        or metrics["minimumHeight"] < 44 or metrics["outline"] == "none"
                        or metrics["fields"] != 20 or min(metrics["options"]) < 2):
                    findings.append(f"Editoren {width}/{theme}: {metrics}")
        browser.close()
finally:
    server.shutdown()
    server.server_close()

if record and not findings:
    baseline.mkdir(parents=True, exist_ok=True)
    for name in files:
        shutil.copy2(out / name, baseline / name)
else:
    for name in files:
        if not (baseline / name).exists():
            findings.append(f"Baseline fehlt: {name}")
        elif (out / name).read_bytes() != (baseline / name).read_bytes():
            current = hashlib.sha256((out / name).read_bytes()).hexdigest()[:12]
            findings.append(f"Bildabweichung: {name} ({current})")

report = {"contract": "0.1.0", "checks": checks, "findings": findings}
(out / "visual-contract.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))
print(f"UI-Vertrag 0.1.0: {len(checks)} Prüfgruppen, {len(findings)} Befunde")
for finding in findings:
    print("FEHLER:", finding)
if findings:
    sys.exit(1)
