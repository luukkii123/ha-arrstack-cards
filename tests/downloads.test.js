const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const types=new Map();
class Element {attachShadow(){this.shadowRoot={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[]};}}
vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/arrstack-cards.js','utf8'),{HTMLElement:Element,customElements:{define:(n,t)=>types.set(n,t)},document:{},window:{},navigator:{language:'de'},console:{info(){}},setInterval,clearInterval,setTimeout,clearTimeout});
const make=()=>{const c=new(types.get('arrstack-downloads-card'))();c._config={...c._defaults(),max_items:2};c._hass={locale:{language:'de'}};c._data={service:'sonarr',items:[]};return c;};
const item={id:71,title:'Beispiel Release',parent_title:'Eine lange Beispielserie',episode:'S01E02',status:'completed',tracked_state:'importBlocked',is_problem:true,sizeleft:0,progress:100,messages:['Datei konnte nicht zugeordnet werden. Dateien prüfen.']};
async function run(){
 const c=make();c._data.items=[item];
 assert(c._row(item).includes('Datei konnte nicht zugeordnet werden.'),'fachlicher Queuegrund direkt sichtbar');
 c._itemErrors.set(71,{message:'Import bereits übermittelt. Warteschlange aktualisieren.'});
 assert(c._row(item).includes('Import bereits übermittelt.'),'Einzelfehler bleibt direkt an Queuezeile');
 assert(c._defaults().show_posters,'Poster bleiben standardmäßig sichtbar');
 assert(c._row(item).includes('poster'),'Poster werden im Standard gerendert');
 assert(c._row(item).includes('title="Eine lange Beispielserie"'),'voller Titel zugänglich');
 c._config.columns=['progress','title','invalid','title','status'];
 assert.deepEqual(Array.from(c._columns()),['progress','title','status'],'Spalten behalten gültige eindeutige Reihenfolge');
 c._config.max_items=200;c._data.items=Array.from({length:201},(_,index)=>({...item,id:1000+index}));assert.equal((c._body().match(/class="queue-grid queue-row"/g)||[]).length,200,'Seitengröße200 bleibt erreichbar');c._config.max_items=2;c._data.items=[item];
 const html=c._body();assert(html.indexOf('data-column="progress"')<html.indexOf('data-column="title"'),'Konfiguration bestimmt sichtbare Reihenfolge');
 assert(!html.includes('data-column="episode"'),'ausgeblendete Spalte bleibt unsichtbar');
 c._config.columns=[];assert(c._columns().includes('title'),'leere Konfiguration erhält sinnvollen Default');
 c._data.items=[item,{...item,id:72},{...item,id:73}];c._page=1;
 assert(!c._body().includes('data-item="71"'));assert(c._body().includes('data-item="73"'),'zweite Seite erreicht statt abgeschnitten');
 c._data.items=[item];assert(c._body().includes('data-item="71"'),'kleiner gewordene Queue begrenzt Seite');
 c._render=()=>{};c._load=async()=>{};c._call=async()=>({...item,queue_item_id:71,status:'skipped',last_error:'Import bereits übermittelt. Warteschlange aktualisieren.'});
 await c._mutate('arrstack/import_item',{queue_item_id:71});
 assert(!c._message.includes('0 Import'),'kein widersprüchlicher Null-Erfolg');
 assert(!c._message.includes('nicht importiert'),'Fehler und skipped werden nicht doppelt gezählt');
 assert(c._message.includes('1'),'ein Ergebnis statt zwei');
 const fix=new(types.get('arrstack-fix-card'))();fix._config={};fix._hass=c._hass;fix._itemErrors.set(71,{message:'Import bereits übermittelt. Warteschlange aktualisieren.'});
 const row=fix._row({...item,download_complete:true,import_state:'ready',candidate_count:1});
 assert(row.split('<details')[0].includes('Import bereits übermittelt.'),'geteilter Fixvertrag zeigt fachlichen Fehler direkt');
 console.log('Downloads-Spalten-/Fehlervertrag bestanden');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
