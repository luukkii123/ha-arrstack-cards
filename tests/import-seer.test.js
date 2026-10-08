const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const types = new Map();
class Element { attachShadow() { this.shadowRoot={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null}; } }
const context={HTMLElement:Element,customElements:{define:(name,type)=>types.set(name,type)},document:{},window:{},navigator:{language:'de'},console:{info(){}},setTimeout,clearTimeout,setInterval,clearInterval};
vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/arrstack-cards.js','utf8'),context);
async function run() {
 const fix=new (types.get('arrstack-fix-card'))(); fix._config={}; fix._hass={locale:{language:'de'}};
 for(const progress of [20,50,99,100]) {
   const row=fix._row({id:1,title:'Beispiel',progress,download_complete:progress===100,import_state:'not_applicable',candidate_count:1,candidates:[{valid:true}]});
   assert(!row.includes('act-import'), `${progress}% ohne Importbereitschaft`);
   assert(!row.includes('Datei gefunden'), `${progress}% ohne Kandidatenstatus`);
 }
 const ready={id:2,queue_item_id:2,title:'Bereit',progress:100,download_complete:true,import_state:'ready',candidate_count:1};
 assert(fix._row(ready).includes('act-import'),'eindeutig fertiger Import ist direkt erreichbar');
 assert(fix._row({...ready,download_complete:false,progress:99}).includes('act-import')===false,'99% gewinnt über veralteten Importstatus');
 const calls=[]; fix._call=async(type,params)=>{calls.push({type,...params});return {results:[{queue_item_id:2,status:'submitted'}]};};
 fix._render=()=>{};fix._load=async()=>{};fix._data={items:[ready,{...ready,id:3,queue_item_id:3,candidate_count:2,import_state:'selection_required'}]};
 await fix._importReady(); assert.equal(calls[0].type,'arrstack/import_ready');
 fix._open={...ready,candidates:[{candidate_id:'old',valid:true}],candidate_id:'old'};
 const dialog={isConnected:true,_model:{},close(){throw new Error('Stale result must stay visible');}};
 fix._call=async()=>({...ready,status:'skipped',import_state:'no_match',candidate_count:0,candidates:[]});
 await fix._mutate('arrstack/import_item',{queue_item_id:2,candidate_id:'old'},dialog);
 assert.equal(fix._open.import_state,'no_match','frisches skipped ersetzt alten ready Stand');
 assert.equal(fix._open.candidate_id,null,'veraltete Dateiauswahl verworfen');
 assert.equal(fix._dialogAktionen().find(action=>action.id==='import').aus,true,'kein Importknopf bei no_match');
 const seer=new (types.get('arrstack-seer-card'))();seer._config={};seer._hass={locale:{language:'de'}};
 seer._error={message:'HTTP 400: {"secret":"backend JSON"}'};
 assert(!seer._body().split('<details')[0].includes('backend JSON'),'Rohfehler standardmäßig unsichtbar');
 assert(seer._body().includes('<details'),'technische Details einklappbar');
 seer._render=()=>{};
 let resolveSearch;let requests=0;
 seer._call=async()=>{requests++;return new Promise(resolve=>{resolveSearch=resolve;});};
 const firstSearch=seer._search('a & ü');
 await seer._search('duplicate');
 assert.equal(requests,1,'langsame Suche verhindert doppelte Requests');
 resolveSearch({results:[]});await firstSearch;
 assert.equal(seer._query,'a & ü','normale Suchzeichen bleiben erhalten');
 console.log('Import-/Seer-Vertrag bestanden');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
