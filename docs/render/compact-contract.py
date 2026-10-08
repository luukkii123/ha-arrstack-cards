#!/usr/bin/env python3
"""Compact ARR contract in Chromium and optionally the real HA frontend.

Usage: compact-contract.py bundle output [private-credentials.json]
The optional real host mounts candidates only in this browser tab. All media
responses/actions are synthetic; no dashboard/resource is saved or installed.
"""
import ast
import http.server
import json
from pathlib import Path
import sys
import threading
from playwright.sync_api import sync_playwright

bundle, output = Path(sys.argv[1]), Path(sys.argv[2])
output.mkdir(parents=True, exist_ok=True)
script = Path(__file__).with_name('render.py').read_text()
module = ast.parse(script)
html = next(ast.literal_eval(node.value) for node in module.body if isinstance(node, ast.Assign) and any(isinstance(target,ast.Name) and target.id=='PAGE' for target in node.targets))
fixture = html[html.index('  /* ── erfundene Daten'):html.index('</script>',html.index('  /* ── erfundene Daten'))]
# Fixture deliberately includes both good and ambiguous imports. Duplicate a
# ready item to exercise Ctrl/Shift selection and bulk feedback.
fixture = fixture.replace('  window.__wsCalls = [];', '''
  PROBLEMS.push({...PROBLEMS[1],id:45,queue_item_id:45,title:'Zweiter bereiter Film'});
  window.__fixtures = {PROBLEMS,SEARCH,SEASONS};
  window.__wsCalls = [];''')
fixture = fixture.replace("case 'arrstack/search':\n", "case 'arrstack/search':\n          if (window.__failSearch) return Promise.reject({message:'HTTP 400: {\\\"message\\\":\\\"raw backend failure\\\"}'});\n")
fixture = fixture.replace("case 'arrstack/request':\n", "case 'arrstack/request':\n          if (window.__failRequest) return Promise.reject({message:'raw request failure'});\n")
fixture = fixture.replace("case 'arrstack/import_item':\n", "case 'arrstack/import_item':\n          if (window.__failImport) return Promise.reject({message:'raw import failure'});\n")
fixture = fixture.replace("case 'arrstack/import_item':\n", "case 'arrstack/import_item':\n          if (window.__skipImport) return Promise.resolve({...PROBLEMS[0],status:'skipped',import_state:'no_match',candidate_count:0,candidates:[]});\n")
fixture = fixture.replace("case 'arrstack/refresh_import_queue':\n", "case 'arrstack/refresh_import_queue':\n          if (window.__failQueue) return Promise.reject({message:'queue unavailable'});\n")
fixture = fixture.replace("case 'arrstack/import_ready':\n", "case 'arrstack/import_ready':\n")
source = bundle.read_text().replace('arrstack-', 'codex-arrcompact-')
reports=[]
errors=[]
blocked_http=[]
guard = r"""
window.__blockedWrites=[];window.__rejections=[];
addEventListener('unhandledrejection',event=>__rejections.push({code:event.reason?.code,type:event.reason?.name}));
const originalSend=WebSocket.prototype.send;
WebSocket.prototype.send=function(raw){
 let message;try{message=JSON.parse(raw)}catch{}
 const type=message?.type;
 if(type){
  const mutation=/call_service|\/update$|\/create$|\/delete$|\/remove$|\/set_|\/save$|\/download$|\/install$|\/start$|\/stop$|\/restart$|\/execute$|\/press$|\/turn_/.test(type);
  const supervisor=type==='supervisor/api'&&!['get','head'].includes(String(message.method||'get').toLowerCase());
  const protectedWrite=/^(?:config\/(?:entity|device|area|floor|label)_registry\/|config_entries\/|lovelace\/resources\/|frontend\/)/.test(type)&&!/(?:\/(?:get|list|subscribe)(?:_|$)|frontend\/(?:get|subscribe)_)/.test(type);
  const mediaWrite=/^arrstack\/(?:import_|request$|queue_remove$|manual_import$)/.test(type);
  if(mutation||supervisor||protectedWrite||mediaWrite){
   __blockedWrites.push({transport:'ws',type});
   if(message.id!==undefined)queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({id:message.id,type:'result',success:false,error:{code:'acceptance_blocked',message:'Read-only browser acceptance blocks writes'}})})));
   return;
  }
 }
 return originalSend.call(this,raw);
};
"""

with sync_playwright() as pw:
    browser=pw.chromium.launch(args=['--no-sandbox'])
    context=browser.new_context(ignore_https_errors=True,viewport={'width':960,'height':1100},locale='de-DE')
    page=context.new_page()
    page.on('pageerror',lambda error: errors.append(type(error).__name__))
    if len(sys.argv)>3:
        private=json.loads(Path(sys.argv[3]).read_text())
        base=private['base_url'].rstrip('/')
        auth={'hassUrl':base,'clientId':base+'/','expires':4102444800000,'expires_in':315360000,'refresh_token':'','access_token':private['token']}
        context.add_init_script(script=guard)
        def route(request):
            if request.request.method not in ("GET","HEAD","OPTIONS"):
                blocked_http.append({"method":request.request.method})
                request.fulfill(status=403,content_type="application/json",body='{"error":"acceptance_blocks_writes"}')
            else:
                request.continue_()
        context.route("**/*",route)
        context.add_init_script(script='localStorage.setItem("hassTokens",JSON.stringify(%s));'%json.dumps(auth))
        page.goto(base+'/dashboard-hacs-test',wait_until='domcontentloaded')
        page.wait_for_function("!!document.querySelector('home-assistant')?.hass",timeout=30000)
        page.evaluate('''() => {const ha=document.querySelector('home-assistant');
          const main=document.createElement('div');main.id='compact-test';
          main.style.cssText='position:fixed;inset:0;z-index:9999;overflow:auto;padding:16px;background:var(--primary-background-color);box-sizing:border-box';
          ha.shadowRoot.appendChild(main);window.__mount=main;}''')
    else:
        page.set_content(html[:html.index('<script>')].replace('MAXWIDTH','928').replace('<div id="wrap"></div>','<div id="compact-test"></div>'))
        page.evaluate("window.__mount=document.getElementById('compact-test')")
        page.evaluate("customElements.define('ha-card',class extends HTMLElement{});customElements.define('ha-form',class extends HTMLElement{})")
    page.add_script_tag(content=source)
    page.add_script_tag(content=fixture)
    page.evaluate('''() => {window.__cards={};for(const kind of ['seer','fix']){
      const card=document.createElement(`codex-arrcompact-${kind}-card`);
      card.setConfig({type:`custom:arrstack-${kind}-card`,service:kind==='seer'?'seerr':'sonarr',refresh_seconds:0});
      window.__mount.appendChild(card);card.hass=window.__hass;window.__cards[kind]=card;}}''')
    page.wait_for_function('window.__cards.fix._data?.items?.length')
    def check(name,expression):
        value=page.evaluate(expression)
        reports.append({'name':name,'passed':bool(value)})
        if not value: raise AssertionError(name)
    def close():
        page.evaluate("document.querySelector('codex-arrcompact-dialog')?.close(true)")
        page.wait_for_timeout(350)
    for width in (320,390,480,960):
        for theme in ('light','dark'):
            page.set_viewport_size({'width':width,'height':1100})
            page.emulate_media(color_scheme=theme)
            page.evaluate("theme=>{document.documentElement.dataset.theme=theme;document.querySelector('home-assistant')?.style.setProperty('color-scheme',theme);}",theme)
            if len(sys.argv)>3:
                page.evaluate('''theme=>{const mount=window.__mount;
                  const tokens=theme==='light'?{'--primary-text-color':'#212121','--secondary-text-color':'#727272','--card-background-color':'#fff','--primary-background-color':'#fafafa','--divider-color':'#e0e0e0','--secondary-background-color':'#e5e5e5'}:{'--primary-text-color':'#e1e1e1','--secondary-text-color':'#9b9b9b','--card-background-color':'#1c1c1c','--primary-background-color':'#111','--divider-color':'#474747','--secondary-background-color':'#202020'};
                  for(const [key,value] of Object.entries(tokens)){mount.style.setProperty(key,value);document.body.style.setProperty(key,value);}}''',theme)
            page.evaluate("async()=>{window.__failSearch=false;await window.__cards.seer._search('Beispiel & ü + #');}")
            page.wait_for_timeout(100)
            check(f'overflow-{width}-{theme}', '''() => Object.values(window.__cards).every(card=>card.getBoundingClientRect().right<=innerWidth && card.scrollWidth<=card.clientWidth+1)''')
            check(f'touch-{width}-{theme}', '''() => Object.values(window.__cards).every(card=>[...card.shadowRoot.querySelectorAll('button')].filter(node=>node.getClientRects().length).every(node=>node.getBoundingClientRect().height>=44))''')
            page.locator('codex-arrcompact-seer-card').screenshot(path=str(output/f'seer-{width}-{theme}.png'))
            page.locator('codex-arrcompact-fix-card').screenshot(path=str(output/f'import-{width}-{theme}.png'))
            page.evaluate("async()=>{await window.__cards.seer._openResult(window.__cards.seer._results[0]);}")
            page.wait_for_function("!!document.querySelector('codex-arrcompact-dialog')")
            check(f'focus-in-dialog-{width}-{theme}', "() => !!document.querySelector('codex-arrcompact-dialog').shadowRoot.activeElement")
            page.locator('codex-arrcompact-dialog').screenshot(path=str(output/f'seasons-{width}-{theme}.png'))
            # Toggle season 2: dirty escape prompts, keep restores selection.
            page.locator('codex-arrcompact-dialog .season[data-season="2"]').click()
            page.keyboard.press('Escape')
            check(f'dirty-escape-{width}-{theme}',"() => !!document.querySelector('codex-arrcompact-dialog')?.shadowRoot.querySelector('[data-akt=keep]')")
            page.locator('codex-arrcompact-dialog [data-akt=keep]').click()
            check(f'dirty-preserved-{width}-{theme}',"() => !window.__cards.seer._selected.has(2)")
            # Back protects edited selection and stays on same page.
            before=page.url
            page.evaluate('history.back()')
            page.wait_for_timeout(250)
            check(f'dirty-back-{width}-{theme}',"() => !!document.querySelector('codex-arrcompact-dialog')?.shadowRoot.querySelector('[data-akt=discard]')")
            assert before==page.url
            page.locator('codex-arrcompact-dialog [data-akt=discard]').click()
            page.wait_for_function("!document.querySelector('codex-arrcompact-dialog')")
    page.set_viewport_size({'width':960,'height':1100})
    check('incomplete-no-import',"() => !window.__cards.fix.shadowRoot.querySelector('[data-item=\"44\"] .act-import') && !window.__cards.fix.shadowRoot.querySelector('[data-item=\"44\"] .act-check')")
    # Movie confirmation, automatic update and search/request errors.
    page.evaluate("async()=>{await window.__cards.seer._openResult(window.__cards.seer._results[1]);}")
    page.locator('codex-arrcompact-dialog [data-akt=request]').click()
    page.wait_for_function("!document.querySelector('codex-arrcompact-dialog')")
    check('movie-request',"() => window.__wsCalls.some(call=>call.type==='arrstack/request' && call.media_type==='movie' && !('seasons' in call))")
    page.evaluate("async()=>{window.__failSearch=true;await window.__cards.seer._search('保持 + ü');}")
    check('human-error-details-closed',"() => {const root=window.__cards.seer.shadowRoot;return !root.querySelector('details').open && !root.querySelector('.notice').innerText.includes('raw backend failure') && root.querySelector('input').value==='保持 + ü';}")
    page.locator('codex-arrcompact-seer-card').screenshot(path=str(output/'seer-error.png'))
    page.evaluate('window.__failSearch=false')
    page.locator('codex-arrcompact-seer-card .act-retry').click()
    page.wait_for_function('!window.__cards.seer._error')
    # Import candidate selection remains after error and dirty discard.
    page.locator('codex-arrcompact-fix-card [data-item="41"] .act-check').click()
    page.wait_for_function('!!window.__cards.fix._open?.candidates?.length')
    page.locator('codex-arrcompact-dialog .candidate-radio').first.check()
    page.evaluate('window.__failImport=true')
    page.locator('codex-arrcompact-dialog [data-akt=import]').click()
    page.wait_for_function('!!window.__cards.fix._open?.fehler')
    check('import-error-selection-kept',"() => window.__cards.fix._open.candidate_id==='1' && document.querySelector('codex-arrcompact-dialog').shadowRoot.querySelector('.candidate-radio').checked")
    page.evaluate('window.__failImport=false')
    page.locator('codex-arrcompact-dialog [data-akt=import]').click()
    page.wait_for_function("!document.querySelector('codex-arrcompact-dialog')")
    check('explicit-candidate-contract',"() => window.__wsCalls.some(call=>call.type==='arrstack/import_item' && call.queue_item_id===41 && call.candidate_id==='1')")
    check('focus-return-after-import',"() => !!window.__cards.fix.shadowRoot.activeElement")
    page.locator('codex-arrcompact-fix-card [data-item="41"] .act-check').click()
    page.wait_for_function('!!window.__cards.fix._open?.candidates?.length')
    page.locator('codex-arrcompact-dialog .candidate-radio').first.check()
    page.evaluate('window.__skipImport=true')
    page.locator('codex-arrcompact-dialog [data-akt=import]').click()
    page.wait_for_function("window.__cards.fix._open?.import_state==='no_match'")
    check('stale-candidate-disabled',"() => !window.__cards.fix._open.candidate_id && document.querySelector('codex-arrcompact-dialog').shadowRoot.querySelector('[data-akt=import]').disabled")
    check('stale-status-visible',"() => document.querySelector('codex-arrcompact-dialog').shadowRoot.querySelector('.dlg-body').innerText.includes('Keine Datei gefunden')")
    page.evaluate('window.__skipImport=false')
    close()

    page.evaluate("async()=>{await window.__cards.seer._openResult(window.__cards.seer._results[0]);}")
    # Scrim keeps clean actionable dialog, Tab cycles inside.
    page.locator('codex-arrcompact-dialog .scrim').click(position={'x':4,'y':4})
    check('clean-scrim-protection',"() => !!document.querySelector('codex-arrcompact-dialog')")
    page.evaluate("()=>{const root=document.querySelector('codex-arrcompact-dialog').shadowRoot;[...root.querySelectorAll('button')].filter(node=>!node.disabled).at(-1).focus()}")
    page.keyboard.press('Tab')
    check('focus-trap',"() => document.querySelector('codex-arrcompact-dialog').shadowRoot.activeElement.classList.contains('dlg-close')")
    close()
    # Explicit checkbox works on mobile too; Ctrl and Shift do not need hover.
    page.locator('codex-arrcompact-fix-card [data-item="42"] .item-select').check()
    check('checkbox-selection',"() => window.__cards.fix._selected.has(42)")
    page.locator('codex-arrcompact-fix-card [data-item="45"] .row-title').click(modifiers=['Control'])
    check('ctrl-selection',"() => window.__cards.fix._selected.has(45)")
    page.locator('codex-arrcompact-fix-card [data-item="42"] .row-title').click(modifiers=['Shift'])
    check('shift-range',"() => window.__cards.fix._selected.size===0")
    page.locator('codex-arrcompact-fix-card [data-item="42"] .item-select').check()
    page.locator('codex-arrcompact-fix-card [data-item="45"] .row-title').click(modifiers=['Control'])
    page.locator('codex-arrcompact-fix-card .act-selected').click()
    page.wait_for_function("window.__wsCalls.some(call=>call.type==='arrstack/import_selected')")
    check('safe-selected-contract',"() => {const call=window.__wsCalls.find(call=>call.type==='arrstack/import_selected');return call.queue_item_ids.length===2 && call.queue_item_ids.every(id=>[42,45].includes(id));}")
    page.locator('codex-arrcompact-fix-card .act-bulk').click()
    page.wait_for_function("window.__wsCalls.some(call=>call.type==='arrstack/import_ready')")
    check('bulk-contract',"() => window.__wsCalls.some(call=>call.type==='arrstack/import_ready')")
    page.evaluate("async()=>{window.__cards.fix._config.service='radarr';await window.__cards.fix._load()}")
    check('radarr-same-contract',"() => window.__wsCalls.some(call=>call.type==='arrstack/refresh_import_queue' && call.service==='radarr') && window.__cards.fix._data.service==='radarr'")
    page.evaluate("async()=>{window.__failQueue=true;await window.__cards.fix._load()}")
    check('queue-error-retry',"() => !!window.__cards.fix.shadowRoot.querySelector('.act-retry') && !window.__cards.fix.shadowRoot.querySelector('details').open")
    page.evaluate('window.__failQueue=false')
    page.locator('codex-arrcompact-fix-card .act-retry').click()
    page.wait_for_function('!window.__cards.fix._error')
    page.evaluate("()=>{const card=window.__cards.fix;card._data.items=[...card._data.items,...Array.from({length:12},(_,index)=>({...card._data.items[1],id:100+index,queue_item_id:100+index}))];card._render()}")
    page.locator('codex-arrcompact-fix-card .act-next').click()
    check('compact-pagination',"() => window.__cards.fix._page===1 && window.__cards.fix.shadowRoot.querySelectorAll('.import-row').length===5")
    page.locator('codex-arrcompact-fix-card .act-prev').click()
    check('pagination-preserves-selection',"() => window.__cards.fix._selected.has(42) && window.__cards.fix._selected.has(45)")
    page.evaluate("()=>window.__cards.fix._fragLoeschen(41,'Synthetischer Titel')")
    page.locator('codex-arrcompact-dialog .scrim').click(position={'x':4,'y':4})
    check('confirmation-scrim-protected',"() => !!document.querySelector('codex-arrcompact-dialog')")
    close()
    blocked_ws=page.evaluate("window.__blockedWrites || []")
    rejections=page.evaluate("window.__rejections || []")
    browser.close()
(output/'compact-report.json').write_text(json.dumps({'native_host':len(sys.argv)>3,'checks':reports,'page_errors':errors,'blocked_http':blocked_http,'blocked_ws':blocked_ws,'unhandled_rejections':rejections},indent=2,ensure_ascii=False))
print(json.dumps({'checks':len(reports),'all_passed':all(item['passed'] for item in reports),'page_errors':len(errors),'blocked_http':len(blocked_http),'blocked_ws':len(blocked_ws),'unhandled_rejections':len(rejections)}))
assert not errors and not rejections
