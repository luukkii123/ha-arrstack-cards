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
  window.__fixtures = {PROBLEMS,SEARCH,SEASONS,QUEUE};
  const blockedQueue={...PROBLEMS[0],size:2.1e9,sizeleft:0,is_problem:true,tracked_status:'warning'};
  for(const key of ['queue_item_id','download_complete','import_state','candidate_count','candidates']) delete blockedQueue[key];
  QUEUE.splice(0,QUEUE.length,...[41,42,43,46].map((id,index)=>({...blockedQueue,id,parent_title:'Eine außergewöhnlich lange Beispielserie mit einem vollständigen Titel',episode:'S02E0'+(index+1),episode_title:'Die ausführlich benannte Beispiel-Episode',episode_air_date:'2026-09-20',languages:['Deutsch','Englisch'],quality:'WEB-1080p',custom_formats:['Beispielformat'],custom_format_score:0,protocol:'usenet',indexer:'Beispielindexer',download_client:'Beispielclient',output_path:'/media/examples/episode.mkv',messages:['Import blockiert: Episode konnte nicht automatisch zugeordnet werden. Dateien prüfen.']})),
    {...blockedQueue,id:71,progress:99,sizeleft:200},
    {...blockedQueue,id:72,progress:100,sizeleft:1},
    {...blockedQueue,id:73,status:'downloading'},
    {...blockedQueue,id:74,sizeleft:null});
  window.__wsCalls = [];''')
fixture = fixture.replace("case 'arrstack/queue':\n", "case 'arrstack/queue':\n          if(window.__deferQueue) return new Promise(resolve=>{window.__resolveQueueRead=()=>resolve({service:'sonarr',brand:'sonarr',items:QUEUE,total:QUEUE.length});});\n")
fixture = fixture.replace("case 'arrstack/search':\n", "case 'arrstack/search':\n          if (window.__failSearch) return Promise.reject({message:'HTTP 400: {\\\"message\\\":\\\"raw backend failure\\\"}'});\n")
fixture = fixture.replace("case 'arrstack/request':\n", "case 'arrstack/request':\n          if (window.__failRequest) return Promise.reject({message:'raw request failure'});\n")
fixture = fixture.replace("case 'arrstack/import_item':\n", "case 'arrstack/import_item':\n          if(window.__importBackendError) return Promise.resolve({...PROBLEMS[0],status:'skipped',last_error:'Import bereits übermittelt. Warteschlange aktualisieren.',last_error_code:'already_submitted',last_error_details:{endpoint:'/api/v3/manualimport'}});\n          if(window.__removeQueueOnImport) {QUEUE.splice(QUEUE.findIndex(item=>item.id===msg.queue_item_id),1);return Promise.resolve({...PROBLEMS[0],status:'submitted',imported:1});}\n          if (window.__deferImport) return new Promise(resolve=>{window.__resolveQueueImport=()=>resolve({...PROBLEMS[0],status:'submitted',imported:1});});\n          if (window.__failImport) return Promise.reject({message:'raw import failure'});\n")
fixture = fixture.replace("case 'arrstack/import_item':\n", "case 'arrstack/import_item':\n          if (window.__skipImport) return Promise.resolve({...PROBLEMS[0],status:'skipped',import_state:'no_match',candidate_count:0,candidates:[]});\n")
fixture = fixture.replace("case 'arrstack/refresh_import_queue':\n", "case 'arrstack/refresh_import_queue':\n          if (window.__failQueue) return Promise.reject({message:'queue unavailable'});\n")
fixture = fixture.replace("case 'arrstack/import_ready':\n", "case 'arrstack/import_ready':\n")
source = bundle.read_text().replace('arrstack-', 'codex-arrcompact-')
reports=[]
captures=[]
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
    page.evaluate('''() => {window.__cards={};for(const kind of ['seer','fix','downloads']){
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
    def capture_card(selector, name):
        # Fixed HA mount scrolling can clip a tall locator screenshot and expose
        # the underlying dashboard. Isolate synthetic sibling cards, size the
        # capture viewport to this card, then restore the interactive harness.
        old_viewport=page.viewport_size.copy()
        page.evaluate("""selector=>{const target=document.querySelector('home-assistant')?.shadowRoot.querySelector(selector) || document.querySelector(selector);
          const mount=window.__mount;window.__capture={css:mount.style.cssText,scroll:mount.scrollTop,children:[...mount.children].map(node=>[node,node.style.display])};
          for(const node of mount.children) if(node!==target) node.style.display='none';
          mount.style.bottom='auto';mount.style.height='auto';mount.style.overflow='visible';mount.scrollTop=0;}
        """,selector)
        page.wait_for_timeout(150)
        height=page.locator(selector).evaluate('(node)=>Math.ceil(node.getBoundingClientRect().height)+32')
        page.set_viewport_size({'width':old_viewport['width'],'height':max(old_viewport['height'],height)})
        page.wait_for_timeout(150)
        actual=page.locator(selector).evaluate('(node)=>Math.ceil(node.getBoundingClientRect().height)+32')
        if actual>page.viewport_size['height']:
            page.set_viewport_size({'width':old_viewport['width'],'height':actual})
            page.wait_for_timeout(150)
        metrics=page.locator(selector).evaluate('(node)=>({height:Math.ceil(node.getBoundingClientRect().height),rows:node.shadowRoot?.querySelectorAll(".queue-row").length || 0})')
        captures.append({'name':name,**metrics,'viewport_height':page.viewport_size['height']})
        page.locator(selector).screenshot(path=str(output/name))
        page.set_viewport_size(old_viewport)
        page.evaluate("()=>{const saved=window.__capture;for(const [node,display] of saved.children)node.style.display=display;window.__mount.style.cssText=saved.css;window.__mount.scrollTop=saved.scroll;delete window.__capture;}")

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
            capture_card('codex-arrcompact-downloads-card',f'queue-{width}-{theme}.png')
            page.evaluate("async()=>{await window.__cards.seer._openResult(window.__cards.seer._results[0]);}")
            page.wait_for_function("!!window.__cards.seer.shadowRoot.querySelector('.request-inline')")
            page.wait_for_timeout(100)
            check(f'focus-inline-{width}-{theme}', "() => !!window.__cards.seer.shadowRoot.activeElement?.closest('.request-inline')")
            check(f'compact-inline-{width}-{theme}', "() => !document.querySelector('codex-arrcompact-dialog') && window.__cards.seer.shadowRoot.querySelector('.request-inline').getBoundingClientRect().height<500")
            page.locator('codex-arrcompact-seer-card').screenshot(path=str(output/f'seasons-{width}-{theme}.png'))
            page.locator('codex-arrcompact-seer-card .season[data-season="2"]').click()
            page.wait_for_timeout(100)
            page.keyboard.press('Escape')
            check(f'dirty-escape-{width}-{theme}',"() => !!window.__cards.seer.shadowRoot.querySelector('[data-inline-action=keep]')")
            page.locator('codex-arrcompact-seer-card [data-inline-action=keep]').click()
            check(f'dirty-preserved-{width}-{theme}',"() => !window.__cards.seer._selected.has(2)")
            page.locator('codex-arrcompact-seer-card [data-inline-action=cancel]').click()
            check(f'dirty-cancel-{width}-{theme}',"() => !!window.__cards.seer.shadowRoot.querySelector('[data-inline-action=discard]')")
            page.locator('codex-arrcompact-seer-card [data-inline-action=discard]').click()
            page.wait_for_timeout(100)
            check(f'inline-return-{width}-{theme}',"() => !window.__cards.seer._show && window.__cards.seer.shadowRoot.activeElement?.classList.contains('result')")
            page.locator('codex-arrcompact-fix-card [data-item=\"41\"] .act-check').click()
            page.wait_for_function('!!window.__cards.fix._open?.candidates?.length')
            check(f'candidate-compact-{width}-{theme}',"() => {const s=document.querySelector('codex-arrcompact-dialog').shadowRoot.querySelector('.sheet');const r=s.getBoundingClientRect();return r.height<innerHeight && r.width<=innerWidth && r.top>=0 && r.bottom<=innerHeight;}")
            page.locator('codex-arrcompact-dialog').screenshot(path=str(output/f'candidates-{width}-{theme}.png'))
            page.locator('codex-arrcompact-dialog .scrim').click(position={'x':4,'y':4})
            check(f'candidate-scrim-{width}-{theme}',"() => !!document.querySelector('codex-arrcompact-dialog')")
            page.locator('codex-arrcompact-dialog .candidate-radio').first.check()
            page.keyboard.press('Escape')
            check(f'candidate-dirty-escape-{width}-{theme}',"() => !!document.querySelector('codex-arrcompact-dialog').shadowRoot.querySelector('[data-akt=keep]')")
            page.locator('codex-arrcompact-dialog [data-akt=keep]').click()
            check(f'candidate-preserved-{width}-{theme}',"() => window.__cards.fix._open.candidate_id==='1'")
            close()

    # Explicit card width in a wide viewport proves container, not viewport adaptation.
    page.set_viewport_size({'width':960,'height':1100})
    page.evaluate("()=>{const c=window.__cards.downloads;c.style.width='500px';c._render();}")
    check('queue-compact-row500',"() => {const c=window.__cards.downloads;return Math.max(...[...c.shadowRoot.querySelectorAll('.queue-row')].map(node=>node.getBoundingClientRect().height))<180 && getComputedStyle(c.shadowRoot.querySelector('.queue-fields')).display==='flex';}")
    check('queue-card500-in-viewport960',"() => {const c=window.__cards.downloads;return Math.round(c.getBoundingClientRect().width)===500 && getComputedStyle(c.shadowRoot.querySelector('.queue-header')).display==='none' && c.scrollWidth<=c.clientWidth;}")
    capture_card('codex-arrcompact-downloads-card','queue-card500-viewport960-dark.png')
    page.evaluate("()=>{const c=window.__cards.downloads;c.style.width='';c._config.columns=['title','episode_title','episode_air_date','languages','quality','custom_formats','custom_format_score','protocol','indexer','download_client','release_title','size','output_path'];c._render();}")
    check('queue-optional-fields-real-contract',"() => {const row=window.__cards.downloads.shadowRoot.querySelector('[data-item=\"41\"]');return row.innerText.includes('WEB-1080p') && row.innerText.includes('Deutsch · Englisch') && row.querySelector('[data-column=custom_format_score]').innerText.includes('0') && row.innerText.includes('2026-09-20');}")
    capture_card('codex-arrcompact-downloads-card','queue-optional-960-dark.png')
    page.evaluate("()=>{const c=window.__cards.downloads;delete c._config.columns;c._config.max_items=2;c._render();}")
    page.locator('codex-arrcompact-downloads-card [data-page="1"]').focus()
    page.keyboard.press('Enter')
    check('queue-pager-keyboard',"() => window.__cards.downloads._page===1 && window.__cards.downloads.shadowRoot.querySelectorAll('.queue-row').length===2 && window.__cards.downloads.shadowRoot.querySelector('[data-item=\"43\"]')")
    page.evaluate("()=>{const c=window.__cards.downloads;c._config.max_items=10;c._page=0;c._itemErrors.set(41,{message:'Import bereits übermittelt. Warteschlange aktualisieren.',details:{endpoint:'/api/v3/manualimport'}});c._render();}")
    check('queue-human-error-direct',"() => {const row=window.__cards.downloads.shadowRoot.querySelector('[data-item=\"41\"]');return row.innerText.includes('Import bereits übermittelt.') && !row.innerText.includes('/api/v3/manualimport') && ![...row.querySelectorAll('details')].some(node=>node.open);}")
    capture_card('codex-arrcompact-downloads-card','queue-error-960-dark.png')
    page.locator('codex-arrcompact-downloads-card [data-item="41"] .queue-message summary').click()
    check('queue-diagnostics-explicitly-reachable',"() => window.__cards.downloads.shadowRoot.querySelector('[data-item=\"41\"]').innerText.includes('Episode konnte nicht automatisch')")
    page.locator('codex-arrcompact-downloads-card [data-item="41"] .queue-message summary').click()
    page.evaluate("()=>{const c=window.__cards.downloads;c._itemErrors.clear();c._render()}")
    # The editor is mounted locally with the real HA form/selectors and synthetic instances.
    if len(sys.argv)>3:
        page.evaluate("""async()=>{const helpers=await window.loadCardHelpers();const native=helpers.createCardElement({type:'entities',entities:[]});await native.constructor.getConfigElement();await customElements.whenDefined('ha-form');
          const editor=document.createElement('codex-arrcompact-downloads-card-editor');editor.setConfig({type:'custom:arrstack-downloads-card',show_posters:true,max_items:5,columns:['title','status','episode','timeleft','progress']});
          editor.hass={...document.querySelector('home-assistant').hass,callWS:window.__hass.callWS};
          window.__editor=editor;window.__editorChanges=[];editor.addEventListener('config-changed',event=>window.__editorChanges.push(structuredClone(event.detail.config)));
          window.__mount.appendChild(editor);}
        """)
        page.wait_for_function("!!window.__editor._form?.shadowRoot?.querySelector('ha-selector')")
        check('queue-native-form-multiple',"() => !!customElements.get('ha-form') && window.__editor._form.schema.find(field=>field.name==='columns').selector.select.multiple")
        page.locator('codex-arrcompact-downloads-card-editor').get_by_role('button',name='Sichtbare Spalten',exact=True).click()
        page.get_by_text('Qualität',exact=True).click()
        page.wait_for_function("window.__editor._config.columns.includes('quality')")
        check('queue-native-selector-add-quality',"() => window.__editorChanges.at(-1).columns.includes('quality') && window.__editor._form.data.columns.includes('quality')")
        page.locator('codex-arrcompact-downloads-card-editor ha-input-chip').filter(has_text='Qualität').locator('button.trailing.action').click()
        page.wait_for_function("!window.__editor._config.columns.includes('quality')")
        check('queue-native-selector-remove-quality',"() => !window.__editorChanges.at(-1).columns.includes('quality') && !window.__editor._form.data.columns.includes('quality')")
        check('queue-native-selector-preserves-poster',"() => window.__editorChanges.at(-1).show_posters===true && window.__editor._config.columns.length===5")
        page.locator('codex-arrcompact-downloads-card-editor .queue-column-order summary').click()
        page.locator('codex-arrcompact-downloads-card-editor [data-column=status][data-move="-1"]').focus()
        page.keyboard.press('Enter')
        check('queue-editor-keyboard-order',"() => window.__editor._config.columns[0]==='status' && window.__editorChanges.at(-1).columns[0]==='status'")
        page.locator('codex-arrcompact-downloads-card-editor [data-column=status][data-move="1"]').focus()
        page.evaluate("()=>{const e=window.__editor;e.hass={...e._hass};}")
        check('queue-editor-hass-update-focus',"() => {const e=window.__editor;return e.getRootNode().activeElement===e._order.querySelector('[data-column=status][data-move=\"1\"]');}")
        page.evaluate("()=>window.__editor.setConfig(window.__editorChanges.at(-1))")
        check('queue-editor-echo-focus',"() => {const e=window.__editor;return e.getRootNode().activeElement===e._order.querySelector('[data-column=status][data-move=\"1\"]');}")
        page.keyboard.press('Space')
        check('queue-editor-space-order',"() => window.__editor._config.columns[1]==='status'")
        for width in (320,390,480,960):
            for theme in ('light','dark'):
                page.set_viewport_size({'width':width,'height':1100})
                page.emulate_media(color_scheme=theme)
                page.evaluate("""theme=>{const tokens=theme==='light'?{'--primary-text-color':'#212121','--secondary-text-color':'#727272','--card-background-color':'#fff','--primary-background-color':'#fafafa','--divider-color':'#e0e0e0','--secondary-background-color':'#e5e5e5'}:{'--primary-text-color':'#e1e1e1','--secondary-text-color':'#9b9b9b','--card-background-color':'#1c1c1c','--primary-background-color':'#111','--divider-color':'#474747','--secondary-background-color':'#202020'};for(const mount of [window.__mount,document.body])for(const [key,value] of Object.entries(tokens))mount.style.setProperty(key,value);}""",theme)
                capture_card('codex-arrcompact-downloads-card-editor',f'queue-editor-{width}-{theme}.png')
                check(f'queue-editor-overflow-{width}-{theme}',"() => window.__editor.scrollWidth<=window.__editor.clientWidth+1")
        page.evaluate('window.__editor.remove()')
    page.set_viewport_size({'width':960,'height':1100})
    check('incomplete-no-import' ,"() => !window.__cards.fix.shadowRoot.querySelector('[data-item=\"44\"] .act-import') && !window.__cards.fix.shadowRoot.querySelector('[data-item=\"44\"] .act-check')")
    # Movie confirmation, automatic update and search/request errors.
    page.evaluate("async()=>{window.__failRequest=true;await window.__cards.seer._openResult(window.__cards.seer._results[0]);}")
    page.locator('codex-arrcompact-seer-card [data-inline-action=request]').click()
    page.wait_for_function('!!window.__cards.seer._requestError && !window.__cards.seer._busy')
    check('inline-request-error-kept',"() => window.__cards.seer._selected.has(2) && !!window.__cards.seer.shadowRoot.querySelector('.request-inline') && !window.__cards.seer.shadowRoot.querySelector('[data-inline-action=request]').disabled")
    page.evaluate('window.__failRequest=false')
    page.locator('codex-arrcompact-seer-card [data-inline-action=request]').click()
    page.wait_for_function('!window.__cards.seer._show')

    page.evaluate("async()=>{await window.__cards.seer._openResult(window.__cards.seer._results[1]);}")
    page.locator('codex-arrcompact-seer-card [data-inline-action=request]').click()
    page.wait_for_function("!window.__cards.seer._show")
    check('movie-request',"() => window.__wsCalls.some(call=>call.type==='arrstack/request' && call.media_type==='movie' && !('seasons' in call))")
    page.evaluate("async()=>{window.__failSearch=true;await window.__cards.seer._search('保持 + ü');}")
    check('human-error-details-closed',"() => {const root=window.__cards.seer.shadowRoot;return !root.querySelector('details').open && !root.querySelector('.notice').innerText.includes('raw backend failure') && root.querySelector('input').value==='保持 + ü';}")
    page.locator('codex-arrcompact-seer-card').screenshot(path=str(output/'seer-error.png'))
    page.evaluate('window.__failSearch=false')
    page.locator('codex-arrcompact-seer-card .act-retry').click()
    page.wait_for_function('!window.__cards.seer._error')
    # Import candidate selection remains after error and dirty discard.
    page.locator('codex-arrcompact-fix-card [data-item=\"41\"] .act-check').click()
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
    page.locator('codex-arrcompact-fix-card [data-item=\"41\"] .act-check').click()
    page.wait_for_function('!!window.__cards.fix._open?.candidates?.length')
    page.locator('codex-arrcompact-dialog .candidate-radio').first.check()
    page.evaluate('window.__skipImport=true')
    page.locator('codex-arrcompact-dialog [data-akt=import]').click()
    page.wait_for_function("window.__cards.fix._open?.import_state==='no_match'")
    check('stale-candidate-disabled',"() => !window.__cards.fix._open.candidate_id && document.querySelector('codex-arrcompact-dialog').shadowRoot.querySelector('[data-akt=import]').disabled")
    check('stale-status-visible',"() => document.querySelector('codex-arrcompact-dialog').shadowRoot.querySelector('.dlg-body').innerText.includes('Keine Datei gefunden')")
    page.evaluate('window.__skipImport=false')
    close()

    page.locator('codex-arrcompact-fix-card [data-item=\"41\"] .act-check').click()
    page.wait_for_function('!!window.__cards.fix._open?.candidates?.length')
    # Scrim keeps clean actionable dialog, Tab cycles inside.
    page.locator('codex-arrcompact-dialog .scrim').click(position={'x':4,'y':4})
    check('clean-scrim-protection',"() => !!document.querySelector('codex-arrcompact-dialog')")
    page.evaluate("()=>{const root=document.querySelector('codex-arrcompact-dialog').shadowRoot;[...root.querySelectorAll('button')].filter(node=>!node.disabled).at(-1).focus()}")
    page.keyboard.press('Tab')
    check('focus-trap',"() => document.querySelector('codex-arrcompact-dialog').shadowRoot.activeElement.classList.contains('dlg-close')")
    close()
    # Explicit checkbox works on mobile too; Ctrl and Shift do not need hover.
    page.locator('codex-arrcompact-fix-card [data-item=\"42\"] .item-select').check()
    check('checkbox-selection',"() => window.__cards.fix._selected.has(42)")
    page.locator('codex-arrcompact-fix-card [data-item=\"45\"] .row-title').click(modifiers=['Control'])
    check('ctrl-selection',"() => window.__cards.fix._selected.has(45)")
    page.locator('codex-arrcompact-fix-card [data-item=\"42\"] .row-title').click(modifiers=['Shift'])
    check('shift-range',"() => window.__cards.fix._selected.size===0")
    page.locator('codex-arrcompact-fix-card [data-item=\"42\"] .item-select').check()
    page.locator('codex-arrcompact-fix-card [data-item=\"45\"] .row-title').click(modifiers=['Control'])
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
    check('queue-poll-does-not-steal-new-focus',"async() => {const c=window.__cards.downloads;c.shadowRoot.querySelector('.act-check').focus();await c._load();const input=window.__cards.seer.shadowRoot.querySelector('input');input.focus();await new Promise(resolve=>requestAnimationFrame(resolve));return window.__cards.seer.shadowRoot.activeElement===input;}")
    # Existing visible Queue uses the same protected inspection/import controller.
    check('queue-finished-problem-action',"() => window.__cards.downloads.shadowRoot.querySelectorAll('.act-check').length===4")
    check('queue-unfinished-no-action',"() => [71,72,73,74].every(id=>!window.__cards.downloads.shadowRoot.querySelector(`[data-item=\"${id}\"] .act-check`))")
    page.evaluate("()=>{const c=window.__cards.downloads;c._data.service='sabnzbd';c._render()}")
    check('queue-sab-no-import',"() => !window.__cards.downloads.shadowRoot.querySelector('.act-check')")
    page.evaluate("()=>{const c=window.__cards.downloads;c._data.service='sonarr';c._render();window.__queueCallsBefore=window.__wsCalls.length;c.shadowRoot.querySelector('[data-item=\"41\"] .act-check').focus()}")
    page.locator('codex-arrcompact-downloads-card [data-item=\"41\"] .act-check').focus()
    check('queue-keyboard-focus-before-poll',"() => window.__cards.downloads.shadowRoot.activeElement?.classList.contains('act-check')")
    page.evaluate('async()=>await window.__cards.downloads._load()')
    page.wait_for_function("window.__cards.downloads.shadowRoot.activeElement?.closest('[data-item]')?.dataset.item==='41'")
    check('queue-keyboard-focus-after-poll',"() => window.__cards.downloads.shadowRoot.activeElement?.closest('[data-item]')?.dataset.item==='41'")
    page.evaluate('window.__queueCallsBefore=window.__wsCalls.length')
    page.keyboard.press('Enter')
    page.wait_for_function('!!window.__cards.downloads._open?.candidates?.length')
    check('queue-keyboard-inspection-only',"() => {const calls=window.__wsCalls.slice(window.__queueCallsBefore);return calls.length===1 && calls[0].type==='arrstack/inspect_import' && calls[0].queue_item_id===41;}")
    page.locator('codex-arrcompact-dialog .scrim').click(position={'x':4,'y':4})
    check('queue-scrim-keeps-dialog',"() => !!document.querySelector('codex-arrcompact-dialog')")
    page.evaluate("()=>{const r=document.querySelector('codex-arrcompact-dialog').shadowRoot;[...r.querySelectorAll('button')].filter(b=>!b.disabled).at(-1).focus()}")
    page.keyboard.press('Tab')
    check('queue-dialog-tab-trap',"() => document.querySelector('codex-arrcompact-dialog').shadowRoot.activeElement.classList.contains('dlg-close')")
    page.locator('codex-arrcompact-dialog .candidate-radio').first.check()
    page.keyboard.press('Escape')
    check('queue-dirty-escape',"() => !!document.querySelector('codex-arrcompact-dialog').shadowRoot.querySelector('[data-akt=keep]')")
    page.locator('codex-arrcompact-dialog [data-akt=keep]').click()
    page.evaluate('history.back()')
    page.wait_for_function("!!document.querySelector('codex-arrcompact-dialog')?.shadowRoot.querySelector('[data-akt=keep]')")
    check('queue-dirty-back-preserves',"() => window.__cards.downloads._open.candidate_id==='1'")
    page.locator('codex-arrcompact-dialog [data-akt=keep]').click()
    page.evaluate('window.__failImport=true')
    page.locator('codex-arrcompact-dialog [data-akt=import]').click()
    page.wait_for_function('!!window.__cards.downloads._open?.fehler && !window.__cards.downloads._busy')
    check('queue-error-keeps-selection',"() => window.__cards.downloads._open.candidate_id==='1' && !document.querySelector('codex-arrcompact-dialog').shadowRoot.querySelector('[data-akt=import]').disabled")
    page.evaluate('window.__failImport=false;window.__importBackendError=true')
    page.locator('codex-arrcompact-dialog [data-akt=import]').click()
    page.wait_for_function("!!window.__cards.downloads._open?.fehler?.fachlich && !window.__cards.downloads._busy")
    check('queue-returned-error-one-count',"() => {const c=window.__cards.downloads;return c._message.includes('1 Eintrag') && !c._message.includes('0 Import') && !c._message.includes('nicht importiert');}")
    check('queue-returned-error-no-duplicate',"() => {const r=document.querySelector('codex-arrcompact-dialog').shadowRoot;return r.querySelectorAll('.notice.problem').length===1 && r.querySelector('.notice').innerText.includes('Import bereits übermittelt.') && !r.querySelector('.notice').innerText.includes('/api/v3/manualimport');}")
    page.locator('codex-arrcompact-dialog').screenshot(path=str(output/'queue-dialog-error-960-dark.png'))
    page.evaluate('window.__importBackendError=false;window.__deferImport=true')
    page.locator('codex-arrcompact-dialog [data-akt=import]').click()
    page.wait_for_function('!!window.__resolveQueueImport')
    check('queue-busy-disables',"() => {const r=document.querySelector('codex-arrcompact-dialog').shadowRoot;return [...r.querySelectorAll('.candidate-radio,[data-akt=import],[data-akt=cancel]')].every(b=>b.disabled);}")
    page.keyboard.press('Escape')
    check('queue-busy-escape-protected',"() => !!document.querySelector('codex-arrcompact-dialog') && !!window.__cards.downloads._busy")
    page.evaluate('window.__deferQueue=true;window.__resolveQueueImport();window.__deferImport=false')
    page.wait_for_function('!!window.__resolveQueueRead')
    check('queue-busy-through-post-import-refresh',"() => !!window.__cards.downloads._busy && !!document.querySelector('codex-arrcompact-dialog')")
    page.evaluate('window.__deferQueue=false;window.__resolveQueueRead()')
    page.wait_for_function("!document.querySelector('codex-arrcompact-dialog')")
    check('queue-return-focus-after-refresh',"() => window.__cards.downloads.shadowRoot.activeElement?.closest('[data-item]')?.dataset.item==='41'")
    check('queue-feedback',"() => window.__cards.downloads.shadowRoot.querySelector('[role=status]')?.innerText.includes('1 Importauftrag')")
    page.evaluate("()=>{const c=window.__cards.downloads;c._config.service='radarr';c._data.service='radarr';c._render();c.shadowRoot.querySelector('[data-item=\"41\"] .act-check').focus()}")
    page.locator('codex-arrcompact-downloads-card [data-item=\"41\"] .act-check').focus()
    page.wait_for_function("window.__cards.downloads.shadowRoot.activeElement?.classList.contains('act-check')")
    page.keyboard.press('Space')
    page.wait_for_function('!!window.__cards.downloads._open?.candidates?.length')
    check('queue-radarr-same-contract',"() => window.__wsCalls.at(-1).type==='arrstack/inspect_import' && window.__wsCalls.at(-1).service==='radarr'")
    close()
    page.locator('codex-arrcompact-downloads-card [data-item=\"41\"] .act-check').click()
    page.wait_for_function('!!window.__cards.downloads._open?.candidates?.length')
    page.locator('codex-arrcompact-dialog .candidate-radio').first.check()
    page.evaluate('window.__removeQueueOnImport=true')
    page.locator('codex-arrcompact-dialog [data-akt=import]').click()
    page.wait_for_function("!document.querySelector('codex-arrcompact-dialog')")
    check('queue-removed-item-focus-fallback',"() => !window.__cards.downloads.shadowRoot.querySelector('[data-item=\"41\"]') && window.__cards.downloads.shadowRoot.activeElement?.localName==='ha-card'")
    page.evaluate('window.__removeQueueOnImport=false')
    # TMDB TV/Movie namespaces may share numeric IDs: expand and return to exact media type.
    page.evaluate("async()=>{const c=window.__cards.seer;c._results.push({...c._results[0],media_type:'movie'});await c._openResult(c._results.at(-1));}")
    check('tmdb-namespace-single-inline',"() => window.__cards.seer.shadowRoot.querySelectorAll('.request-inline').length===1")
    page.locator('codex-arrcompact-seer-card [data-inline-action=cancel]').click()
    page.wait_for_timeout(100)
    check('tmdb-namespace-focus-return',"() => window.__cards.seer.shadowRoot.activeElement?.dataset.index===String(window.__cards.seer._results.length-1)")
    blocked_ws=page.evaluate("window.__blockedWrites || []")
    rejections=page.evaluate("window.__rejections || []")
    browser.close()
(output/'compact-report.json').write_text(json.dumps({'native_host':len(sys.argv)>3,'checks':reports,'captures':captures,'page_errors':errors,'blocked_http':blocked_http,'blocked_ws':blocked_ws,'unhandled_rejections':rejections},indent=2,ensure_ascii=False))
print(json.dumps({'checks':len(reports),'all_passed':all(item['passed'] for item in reports),'page_errors':len(errors),'blocked_http':len(blocked_http),'blocked_ws':len(blocked_ws),'unhandled_rejections':len(rejections)}))
assert not errors and not rejections
