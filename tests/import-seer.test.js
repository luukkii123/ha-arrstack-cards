const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const types = new Map();
class Element { attachShadow() { this.shadowRoot={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null}; } }
const context={HTMLElement:Element,customElements:{define:(name,type)=>types.set(name,type)},document:require('./_html.cjs').markupDocument(),window:{},navigator:{language:'de'},console:{info(){}},setTimeout,clearTimeout,setInterval,clearInterval};
vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/arrstack-cards.js','utf8'),context);

const ready={id:2,queue_item_id:2,title:'Bereit',progress:100,download_complete:true,import_state:'ready',candidate_count:1};
const blocked={id:71,title:'Blockierter Download',status:'completed',tracked_status:'warning',tracked_state:'importBlocked',is_problem:true,sizeleft:0,progress:100};
const makeFix=()=>{const fix=new (types.get('arrstack-fix-card'))(); fix._config={}; fix._hass={locale:{language:'de'}}; return fix;};
const makeDownloads=(service='sonarr')=>{const downloads=new (types.get('arrstack-downloads-card'))();downloads._config={};downloads._hass={locale:{language:'de'}};downloads._data={service};return downloads;};
const makeSeer=()=>{const seer=new (types.get('arrstack-seer-card'))();seer._config={};seer._hass={locale:{language:'de'}};return seer;};
const badge=(seer,status)=>{seer._results=[{id:1,media_type:'movie',title:'Film',status}];seer._error=null;return seer._body().match(/<span class="status-badge[^"]*"[^>]*><span class="lbl">([^<]*)<\/span>/)[1];};

test('fix card: unfinished downloads offer no import and no candidate status', () => {
 const fix=makeFix();
 for(const progress of [20,50,99,100]) {
   const row=fix._row({id:1,title:'Beispiel',progress,download_complete:progress===100,import_state:'not_applicable',candidate_count:1,candidates:[{valid:true}]});
   assert(!row.includes('act-import'), `${progress}% ohne Importbereitschaft`);
   assert(!row.includes('Datei gefunden'), `${progress}% ohne Kandidatenstatus`);
 }
});

test('fix card: a clearly ready import is reachable and 99% beats a stale ready state', () => {
 const fix=makeFix();
 assert(fix._row(ready).includes('act-import'),'eindeutig fertiger Import ist direkt erreichbar');
 assert(fix._row({...ready,download_complete:false,progress:99}).includes('act-import')===false,'99% gewinnt über veralteten Importstatus');
});

test('fix card: bulk import calls arrstack/import_ready', async () => {
 const fix=makeFix();
 const calls=[]; fix._call=async(type,params)=>{calls.push({type,...params});return {results:[{queue_item_id:2,status:'submitted'}]};};
 fix._render=()=>{};fix._load=async()=>{};fix._data={items:[ready,{...ready,id:3,queue_item_id:3,candidate_count:2,import_state:'selection_required'}]};
 await fix._importReady(); assert.equal(calls[0].type,'arrstack/import_ready');
});

test('fix card: fresh skipped result replaces a stale ready dialog state', async () => {
 const fix=makeFix();fix._render=()=>{};fix._load=async()=>{};
 fix._open={...ready,candidates:[{candidate_id:'old',valid:true}],candidate_id:'old'};
 const dialog={isConnected:true,_model:{},close(){throw new Error('Stale result must stay visible');}};
 fix._call=async()=>({...ready,status:'skipped',import_state:'no_match',candidate_count:0,candidates:[]});
 await fix._mutate('arrstack/import_item',{queue_item_id:2,candidate_id:'old'},dialog);
 assert.equal(fix._open.import_state,'no_match','frisches skipped ersetzt alten ready Stand');
 assert.equal(fix._open.candidate_id,null,'veraltete Dateiauswahl verworfen');
 assert.equal(fix._dialogAktionen().find(action=>action.id==='import').aus,true,'kein Importknopf bei no_match');
});

test('fix card: rejected callWS during a dialog import keeps the dialog open with the error', async () => {
 const fix=makeFix();fix._render=()=>{};fix._load=async()=>{};
 fix._open={...ready,candidates:[{candidate_id:'c1',valid:true}],candidate_id:'c1'};
 let closed=0;const dialog={isConnected:true,_model:{},close(){closed++;}};
 fix._hass={locale:{language:'de'},callWS:async()=>{throw new Error('arr unreachable');}};
 await fix._mutate('arrstack/import_item',{queue_item_id:2,candidate_id:'c1'},dialog);
 assert.equal(fix._open.fehler.message,'arr unreachable','error shown inside the dialog');
 assert.equal(fix._operationError,null,'no card-level error for a dialog failure');
 assert.equal(closed,0,'dialog stays open');
 assert.equal(fix._busy,null,'busy released');
});

test('fix card: rejected callWS on load shows the import status error', async () => {
 const fix=makeFix();fix._render=()=>{};fix._selected=new Set([2]);
 fix._hass={locale:{language:'de'},callWS:async()=>{throw new Error('refresh failed');}};
 await fix._load();
 assert.equal(fix._error.message,'refresh failed');
 assert.equal(fix._loading,false,'loading flag is reset');
 const html=fix._body([]);
 assert(html.includes('role="alert"')&&html.includes(fix._t().import_status),'import status error is rendered');
});

test('downloads: finished blocked download offers the check, unfinished variants do not', () => {
 const downloads=makeDownloads();
 assert(downloads._row(blocked).includes('act-check'),'fertiger blockierter Download bietet Dateien prüfen');
 for(const item of [{...blocked,progress:99},{...blocked,progress:99.9,sizeleft:1},{...blocked,status:'downloading'},{...blocked,sizeleft:1},{...blocked,sizeleft:null},{...blocked,is_problem:false}])
   assert(!downloads._row(item).includes('act-check'),'unfertig/gerundete100/fehlendeRestgröße/keinProblem bietet keine Importaktion');
});

test('downloads: only Sonarr and Radarr offer the Arr import check', () => {
 const downloads=makeDownloads('sabnzbd');
 assert(!downloads._row(blocked).includes('act-check'),'SABnzbd bietet keinen Arr-Import');
 downloads._data.service='radarr';assert(downloads._row(blocked).includes('Dateien prüfen'),'Radarr nutzt dieselbe Aktion');
});

test('downloads: busy disables a repeated check', () => {
 const downloads=makeDownloads('radarr');
 downloads._busy='arrstack/import_item';assert(downloads._row(blocked).match(/<button[^>]*act-check[^>]*>/)[0].includes('disabled'),'Busy sperrt erneute Prüfung');
});

test('downloads: queue check shares the fix controller and only reads', async () => {
 const downloads=makeDownloads('radarr');const fix=makeFix();
 assert.equal(downloads._check,fix._check,'derselbe Einzelimport-Controller für Queue und Fixkarte');
 const readCalls=[];downloads._oeffneDialog=model=>({isConnected:true,_model:model});
 downloads._call=async(type,params)=>{readCalls.push({type,...params});return {...ready,queue_item_id:71,candidates:[]};};
 await downloads._check(71);
 assert.equal(readCalls.length,1);assert.equal(readCalls[0].type,'arrstack/inspect_import','Queueprüfung schreibt/importiert nicht');
 assert.equal(readCalls[0].queue_item_id,71,'Queue-ID wird statt Dateiname verwendet');
});

test('downloads: an open dialog stays routed to its original instance', async () => {
 const downloads=makeDownloads('radarr');downloads._oeffneDialog=model=>({isConnected:true,_model:model});
 const routeCalls=[];downloads._config={entry_id:'entry-a'};
 assert(downloads._row(blocked).includes('act-check'),'Entry-only Karte nutzt Dienst aus Queueantwort');
 downloads._render=()=>{};downloads._load=async()=>{};
 downloads._hass={locale:{language:'de'},callWS:async msg=>{routeCalls.push(msg);return {...ready,queue_item_id:71,status:'skipped',candidates:[]};}};
 await downloads._check(71);
 downloads._config={entry_id:'entry-b'};
 await downloads._import(71,null,{isConnected:true,_model:{},close(){}});
 assert(routeCalls.every(msg=>msg.entry_id==='entry-a'),'Instanzwechsel darf alten Dialog nicht auf gleiche QueueID anderer Instanz umlenken');
});

test('downloads: rejected inspect callWS keeps the dialog with the error', async () => {
 const downloads=makeDownloads('radarr');
 let dialog;downloads._oeffneDialog=model=>(dialog={isConnected:true,_model:model});
 downloads._hass={locale:{language:'de'},callWS:async()=>{throw new Error('inspect failed');}};
 await downloads._check(71);
 assert.equal(downloads._open.fehler.message,'inspect failed','error kept for the dialog');
 assert.equal(downloads._open.loading,false,'dialog leaves the loading state');
 assert(downloads._dialogKoerper().includes('role="alert"'),'dialog body shows the error');
 assert.equal(downloads._dialogAktionen().find(action=>action.id==='import').aus,true,'no import after a failed check');
 assert(dialog.model,'dialog model refreshed');
});

test('seer: raw backend error is hidden behind collapsible details', () => {
 const seer=makeSeer();
 seer._error={message:'HTTP 400: {"secret":"backend JSON"}'};
 assert(!seer._body().split('<details')[0].includes('backend JSON'),'Rohfehler standardmäßig unsichtbar');
 assert(seer._body().includes('<details'),'technische Details einklappbar');
});

test('seer: slow search prevents duplicate requests and keeps search characters', async () => {
 const seer=makeSeer();seer._render=()=>{};
 let resolveSearch;let requests=0;
 seer._call=async()=>{requests++;return new Promise(resolve=>{resolveSearch=resolve;});};
 const firstSearch=seer._search('a & ü');
 await seer._search('duplicate');
 assert.equal(requests,1,'langsame Suche verhindert doppelte Requests');
 resolveSearch({results:[]});await firstSearch;
 assert.equal(seer._query,'a & ü','normale Suchzeichen bleiben erhalten');
});

test('seer: rejected search callWS shows the search error and unlocks the search', async () => {
 const seer=makeSeer();seer._render=()=>{};
 seer._hass={locale:{language:'de'},callWS:async()=>{throw new Error('seerr down');}};
 await seer._search('Serie');
 assert.equal(seer._error.message,'seerr down');
 assert.equal(seer._searching,false,'search unlocked');
 assert(seer._body().includes(seer._t().fehler_suche),'search error heading shown');
 seer._hass={locale:{language:'de'},callWS:async()=>({results:[{id:1,media_type:'movie',title:'Film',status:'available'}]})};
 await seer._search('Film');
 assert.equal(seer._error,null,'next search clears the error');
 assert.equal(seer._results.length,1);
});

test('seer: rejected request callWS keeps the draft and shows the error inline', async () => {
 const seer=makeSeer();seer._render=()=>{};
 seer._show={id:7,media_type:'tv',title:'Serie',seasons:[{season:1,episodes:8}]};seer._selected=new Set([1]);
 seer._hass={locale:{language:'de'},callWS:async()=>{throw new Error('request refused');}};
 await seer._request();
 assert.equal(seer._requestError.message,'request refused');
 assert.equal(seer._busy,false,'busy released');
 assert(seer._show,'draft kept');
 assert(seer._dialogKoerper().includes('role="alert"'),'error inline in the draft');
});

test('seer: season selection stays inline, keyed by media type, with dirty close guard', () => {
 const seer=makeSeer();seer._render=()=>{};
 seer._show={id:7,media_type:'tv',title:'Serie',seasons:[{season:1,episodes:8}]};
 seer._results=[seer._show];seer._error=null;seer._selected=new Set([1]);
 seer._oeffneDialog=()=>{throw new Error('Staffelauswahl muss inline bleiben');};
 seer._oeffneDetail();
 assert(seer._body().includes('request-inline'),'Staffeln im Karteninhalt statt Vollbild');
 assert(seer._body().includes('data-inline-action="request"'),'sichtbare Anfrageaktion inline');
 seer._results.push({...seer._show,media_type:'movie'});
 assert.equal((seer._body().match(/class="request-inline"/g)||[]).length,1,'Movie/TV gleicher TMDB-ID bleiben getrennt');
 seer._busy=true;
 assert(seer._dialogKoerper().match(/<button[^>]*data-season="1"[^>]*>/)[0].includes('disabled'),'Staffelchips bei Request busy deaktiviert');
 seer._busy=false;
 seer._selected.clear();seer._closeInline();
 assert(seer._discardInline,'Dirty Escape/Abbruch braucht ausdrückliche Wahl');
 assert(seer._show,'Entwurf bleibt erhalten');
 seer._closeInline(true);assert.equal(seer._show,null);
});

test('seer: requested seasons are sent sorted numerically', async () => {
 const seer=makeSeer();seer._render=()=>{};
 seer._show={id:7,media_type:'tv',title:'Serie',seasons:[]};seer._selected=new Set([10,2,1]);
 const calls=[];seer._call=async(type,params)=>{calls.push({type,...params});return {request_id:5};};
 await seer._request();
 assert.equal(calls[0].type,'arrstack/request');
 assert.deepEqual(Array.from(calls[0].seasons),[1,2,10],'numeric, not lexical order');
});

test('seer: a movie request sends no seasons', async () => {
 const seer=makeSeer();seer._render=()=>{};
 seer._show={id:8,media_type:'movie',title:'Film',seasons:[]};seer._selected=new Set();
 const calls=[];seer._call=async(type,params)=>{calls.push({type,...params});return {request_id:6};};
 await seer._request();
 assert.equal(calls.length,1);
 assert.equal('seasons' in calls[0],false,'movie request without seasons');
});

test('seer: the same selection in another order is not a dirty draft', () => {
 const seer=makeSeer();seer._render=()=>{};
 seer._show={id:7,media_type:'tv',title:'Serie',seasons:[]};seer._selected=new Set([3,1,2]);
 seer._oeffneDetail();
 seer._selected=new Set([2,3,1]);
 seer._closeInline();
 assert.equal(seer._discardInline,false,'order of picks does not matter');
 assert.equal(seer._show,null,'draft closes directly');
});

test('seer_status: every known status maps to its own label', () => {
 const seer=makeSeer();const labels=seer._t().seer_status;
 for(const status of ['pending','processing','partially_available','available','blocklisted','deleted'])
   assert.equal(badge(seer,status),labels[status],status);
});

test('seer_status: unknown, missing or numeric status falls back to "not requested"', () => {
 const seer=makeSeer();const fallback=seer._t().seer_status.unknown;
 for(const status of ['surprise',undefined,null,'',5,'AVAILABLE'])
   assert.equal(badge(seer,status),fallback,String(status));
});

test('seer_status: labels follow the HA language', () => {
 const seer=makeSeer();seer._hass={locale:{language:'en'}};
 assert.equal(badge(seer,'partially_available'),'partly available');
 assert.equal(badge(seer,'surprise'),'not requested');
});

// M19 rest (#1302): status values come from Seerr and the *arr queue; property names of
// Object.prototype must not read as labels ("function Object() …", "[object Object]").
const PROTO_KEYS=['constructor','__proto__','toString','hasOwnProperty','valueOf'];

test('seer_status: Object.prototype names fall back to "not requested"', () => {
 const seer=makeSeer();const fallback=seer._t().seer_status.unknown;
 for(const status of PROTO_KEYS) assert.equal(badge(seer,status),fallback,status);
});

test('queue status: Object.prototype names in status, tracked_state and import_state show the raw value', () => {
 const downloads=makeDownloads();const fix=makeFix();const t=downloads._t();
 for(const value of PROTO_KEYS) {
   const status=downloads._row({id:1,title:'X',status:value,tracked_state:value,progress:10}).match(/<span class="status-badge[^"]*"[^>]*><span class="lbl">([^<]*)<\/span>/)[1];
   assert.equal(status,value,`downloads ${value}`);
   assert.equal(fix._stateLabel({status:value,tracked_state:value,import_state:value}),value,`fix ${value}`);
 }
 assert.equal(downloads._row({id:1,title:'X',status:'downloading',progress:10}).includes(t.zustaende.downloading),true,'known status keeps its label');
});
