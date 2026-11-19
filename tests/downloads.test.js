const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const types=new Map();
class Element {attachShadow(){this.shadowRoot={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[]};}}
vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/arrstack-cards.js','utf8'),{HTMLElement:Element,customElements:{define:(n,t)=>types.set(n,t)},document:{},window:{},navigator:{language:'de'},console:{info(){}},setInterval,clearInterval,setTimeout,clearTimeout});
const make=()=>{const c=new(types.get('arrstack-downloads-card'))();c._config={...c._defaults(),max_items:2};c._hass={locale:{language:'de'}};c._data={service:'sonarr',items:[]};return c;};
const item={id:71,title:'Beispiel Release',parent_title:'Eine lange Beispielserie',episode:'S01E02',status:'completed',tracked_state:'importBlocked',is_problem:true,sizeleft:0,progress:100,messages:['Datei konnte nicht zugeordnet werden. Dateien prüfen.']};
const rowIds=html=>[...html.matchAll(/data-item="(\d+)"/g)].map(match=>Number(match[1]));

test('queue row shows the domain reason directly',()=>{
 const c=make();c._data.items=[item];
 assert(c._row(item).includes('Datei konnte nicht zugeordnet werden.'),'fachlicher Queuegrund direkt sichtbar');
});

test('per-item error stays at its queue row',()=>{
 const c=make();c._data.items=[item];
 c._itemErrors.set(71,{message:'Import bereits übermittelt. Warteschlange aktualisieren.'});
 assert(c._row(item).includes('Import bereits übermittelt.'),'Einzelfehler bleibt direkt an Queuezeile');
});

test('posters are visible by default and the full title stays accessible',()=>{
 const c=make();c._data.items=[item];
 assert(c._defaults().show_posters,'Poster bleiben standardmäßig sichtbar');
 assert(c._row(item).includes('poster'),'Poster werden im Standard gerendert');
 assert(c._row(item).includes('title="Eine lange Beispielserie"'),'voller Titel zugänglich');
});

test('columns keep a valid, unique, configured order',()=>{
 const c=make();
 c._config.columns=['progress','title','invalid','title','status'];
 assert.deepEqual(Array.from(c._columns()),['progress','title','status'],'Spalten behalten gültige eindeutige Reihenfolge');
});

test('page size 200 stays reachable',()=>{
 const c=make();
 c._config.max_items=200;c._data.items=Array.from({length:201},(_,index)=>({...item,id:1000+index}));assert.equal((c._body().match(/class="queue-grid queue-row"/g)||[]).length,200,'Seitengröße200 bleibt erreichbar');
});

test('configured column order decides the rendered order and hidden columns stay hidden',()=>{
 const c=make();c._data.items=[item];
 c._config.columns=['progress','title','invalid','title','status'];
 const html=c._body();assert(html.indexOf('data-column="progress"')<html.indexOf('data-column="title"'),'Konfiguration bestimmt sichtbare Reihenfolge');
 assert(!html.includes('data-column="episode"'),'ausgeblendete Spalte bleibt unsichtbar');
});

test('empty column config falls back to a sensible default',()=>{
 const c=make();
 c._config.columns=[];assert(c._columns().includes('title'),'leere Konfiguration erhält sinnvollen Default');
});

test('second page is reachable and a shrunk queue clamps the page',()=>{
 const c=make();
 c._data.items=[item,{...item,id:72},{...item,id:73}];c._page=1;
 assert(!c._body().includes('data-item="71"'));assert(c._body().includes('data-item="73"'),'zweite Seite erreicht statt abgeschnitten');
 c._data.items=[item];assert(c._body().includes('data-item="71"'),'kleiner gewordene Queue begrenzt Seite');
});

test('single skipped import reports one result, not a contradictory success',async()=>{
 const c=make();c._data.items=[item];
 c._render=()=>{};c._load=async()=>{};c._call=async()=>({...item,queue_item_id:71,status:'skipped',last_error:'Import bereits übermittelt. Warteschlange aktualisieren.'});
 await c._mutate('arrstack/import_item',{queue_item_id:71});
 assert(!c._message.includes('0 Import'),'kein widersprüchlicher Null-Erfolg');
 assert(!c._message.includes('nicht importiert'),'Fehler und skipped werden nicht doppelt gezählt');
 assert(c._message.includes('1'),'ein Ergebnis statt zwei');
});

test('fix card shares the error contract and shows the domain error directly',()=>{
 const c=make();
 const fix=new(types.get('arrstack-fix-card'))();fix._config={};fix._hass=c._hass;fix._itemErrors.set(71,{message:'Import bereits übermittelt. Warteschlange aktualisieren.'});
 const row=fix._row({...item,download_complete:true,import_state:'ready',candidate_count:1});
 assert(row.split('<details')[0].includes('Import bereits übermittelt.'),'geteilter Fixvertrag zeigt fachlichen Fehler direkt');
});

// Sorting: the card must keep the server's queue order; it never re-sorts by title, id or progress.
test('queue keeps the server order across pages',()=>{
 const c=make();
 c._data.items=[{...item,id:9,title:'Zulu',progress:10},{...item,id:3,title:'Alpha',progress:90},{...item,id:7,title:'Mike',progress:50}];
 c._page=0;assert.deepEqual(rowIds(c._body()),[9,3],'first page keeps server order');
 c._page=1;assert.deepEqual(rowIds(c._body()),[7],'second page continues server order');
});

test('show_unknown false hides unknown items without reordering the rest',()=>{
 const c=make();c._config.max_items=10;
 c._data.items=[{...item,id:5},{...item,id:4,unknown:true},{...item,id:6}];
 assert.deepEqual(rowIds(c._body()),[5,4,6],'unknown items visible by default');
 c._config.show_unknown=false;
 assert.deepEqual(rowIds(c._body()),[5,6],'unknown item hidden, order kept');
});

test('rejected callWS on load shows a retryable error and clears the loading flag',async()=>{
 const c=make();c._data=null;c._render=()=>{};
 const failure=Object.assign(new Error('HTTP 502: upstream'),{code:'unknown_error'});
 c._hass={locale:{language:'de'},callWS:async()=>{throw failure;}};
 await c._load();
 assert.equal(c._error,failure,'error is kept');
 assert.equal(c._loading,false,'loading flag is reset');
 assert.equal(c._loaded,true,'card counts as loaded');
 const html=c._body();
 assert(html.includes('role="alert"'),'error is announced');
 assert(html.includes('act-retry'),'retry is offered');
 assert(!html.split('<details')[0].includes('upstream'),'raw message only inside details');
 assert.equal(c._headMeta(),'','no stale count in the header');
});

test('rejected callWS with a known code shows the mapped sentence',async()=>{
 const c=make();c._data=null;c._render=()=>{};
 c._hass={locale:{language:'de'},callWS:async()=>{throw Object.assign(new Error('nope'),{code:'unauthorized'});}};
 await c._load();
 assert(c._body().split('<details')[0].includes(c._t().fehler_rechte),'unauthorized maps to the rights sentence');
});

test('successful load after a rejected callWS clears the error',async()=>{
 const c=make();c._data=null;c._render=()=>{};
 c._hass={locale:{language:'de'},callWS:async()=>{throw new Error('down');}};
 await c._load();
 c._hass={locale:{language:'de'},callWS:async()=>({service:'sonarr',items:[item]})};
 await c._load();
 assert.equal(c._error,null,'error cleared');
 assert(c._body().includes('data-item="71"'),'queue rendered again');
});

test('rejected callWS during import sets an operation error and releases busy',async()=>{
 const c=make();c._data.items=[item];c._render=()=>{};
 let loads=0;c._load=async()=>{loads++;};
 c._hass={locale:{language:'de'},callWS:async()=>{throw new Error('import refused');}};
 await c._mutate('arrstack/import_item',{queue_item_id:71});
 assert.equal(c._operationError.message,'import refused','operation error kept');
 assert.equal(c._busy,null,'busy released');
 assert.equal(c._message,null,'no success message');
 assert.equal(loads,1,'queue reloaded after the failure');
});

// M58 (#1308): a cell's name must not replace its content. Column names come
// from role=columnheader; cells without visible text carry the label on the
// control inside them.
const cellOpenTags=html=>[...html.matchAll(/<[a-z]+\b[^>]*\brole="cell"[^>]*>/g)].map(match=>match[0]);
test('queue cells carry no aria-label, column headers name every column',()=>{
 const c=make();
 c._config.columns=['title','status','episode','timeleft','progress','quality','indexer'];
 c._config.show_posters=true;
 c._data.items=[{...item,poster:'https://image.tmdb.org/t/p/w300/a.jpg',quality:'1080p',indexer:'Beispiel'}];
 c._itemErrors.set(71,{message:'Import bereits übermittelt. Warteschlange aktualisieren.'});
 const html=c._body();
 const cells=cellOpenTags(html);
 assert(cells.length>=c._config.columns.length+2,'Poster-, Daten-, Aktions- und Hinweiszellen gerendert');
 assert.deepEqual(cells.filter(tag=>/\baria-label=/.test(tag)),[],'keine Zelle mit aria-label');
 const headers=[...html.matchAll(/<span role="columnheader"([^>]*)>([^<]*)<\/span>/g)];
 assert.equal(headers.length,c._config.columns.length+2,'Poster-, Spalten- und Aktionskopf');
 for (const [,attributes,text] of headers) assert(text.trim() || /aria-label="[^"]+"/.test(attributes),`Spaltenkopf ohne Namen: ${attributes}`);
 assert.match(html,/<span role="columnheader" aria-label="Poster"><\/span>/,'Posterspalte am Kopf benannt');
 assert.match(html,/<span role="columnheader" aria-label="Aktionen"><\/span>/,'Aktionsspalte am Kopf benannt');
 if (c._canInspect(c._data.items[0])) assert.match(html,/<button class="act-check quiet"[^>]*aria-label="Dateien prüfen: Eine lange Beispielserie"/,'Knopf trägt sein Label selbst');
});

test('the bundle renders no role=cell together with aria-label',()=>{
 const source=fs.readFileSync(__dirname+'/../dist/arrstack-cards.js','utf8');
 assert.deepEqual(cellOpenTags(source),cellOpenTags(source).filter(tag=>!/\baria-label=/.test(tag)),'Quelltext ohne Zelle mit aria-label');
});
