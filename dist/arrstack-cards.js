/* BEGIN BUSCH SHARED UI 0.5.3 sha256:0c02d26db175145327cecc2ee2db5a44fef850a8bb7af07c913af77f977d386f */
/** Busch UI 0.5.3 — standalone Vanilla source. Synchronized verbatim, never imported at runtime. */
const BuschUI = (() => {
  const sourceVersion = '0.5.3';
  const cloneConfig = value => Array.isArray(value) ? value.map(cloneConfig)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key,item]) => [key,cloneConfig(item)])) : value;
  function configsEqual(a,b) {
    if (Object.is(a,b)) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a)!==Array.isArray(b)) return false;
    if (Array.isArray(a) && a.length!==b.length) return false;
    const keys=Object.keys(a);
    return keys.length===Object.keys(b).length && keys.every(key=>Object.hasOwn(b,key)&&configsEqual(a[key],b[key]));
  }
  const validKey = key => !['__proto__','prototype','constructor'].includes(String(key));
  function updateConfig(config,patch) {
    const next=cloneConfig(config||{});
    for (const [key,value] of Object.entries(patch||{})) {
      if (!validKey(key)) throw new Error('Invalid editor config key');
      if (value===undefined) delete next[key]; else next[key]=cloneConfig(value);
    }
    return next;
  }
  function updateConfigPath(config,path,value) {
    const parts=Array.isArray(path)?path:String(path).split('.');
    if (!parts.length || parts.some(key=>!String(key)||!validKey(key))) throw new Error('Invalid editor config path');
    const next=cloneConfig(config||{});let node=next;
    for (let i=0;i<parts.length-1;i++) {const key=parts[i];if (!Object.hasOwn(node,key)||!node[key]||typeof node[key]!=='object') node[key]=typeof parts[i+1]==='number'?[]:{};node=node[key];}
    const key=parts.at(-1);
    if (value===undefined) {if (Array.isArray(node)&&typeof key==='number') node.splice(key,1);else delete node[key];} else node[key]=cloneConfig(value);
    return next;
  }
  const deleteConfigPath=(config,path)=>updateConfigPath(config,path,undefined);
  const editorEchoStates=new WeakMap();
  function editorEchoState(editor) {let state=editorEchoStates.get(editor);if(!state){state=createEchoState();editorEchoStates.set(editor,state);}return state;}
  function emitConfigChanged(editor,config,{echo=true}={}) {
    if(echo)queueEcho(editorEchoState(editor),config);
    editor.dispatchEvent(new CustomEvent('config-changed',{detail:{config:cloneConfig(config)},bubbles:true,composed:true}));
  }
  function guardEditorKeys(root) {
    root.addEventListener?.('keydown',event=>event.stopPropagation());
    root.addEventListener?.('keyup',event=>event.stopPropagation());
  }
  class EditorBase extends (typeof HTMLElement==='undefined'?class{}:HTMLElement) {
    constructor() {super();guardEditorKeys(this);}
    _acceptConfig(config,normalize=cloneConfig,{echo=true}={}) {
      const result=validateConfig(config,{normalize});
      if(!result.ok)throw result.error;
      const next=result.value;
      if (echo?!acceptEcho(editorEchoState(this),next,this._config):configsEqual(next,this._config)) return false;
      this._config=next;return true;
    }
    _publishConfig(config,options) {
      const next=cloneConfig(config);this._config=next;emitConfigChanged(this,next,options);return next;
    }
  }
  // HA supplies no echo ID: match the earliest unacknowledged equal snapshot.
  const createEchoState=()=>({pending:[],received:new Set(),stale:[]});
  function queueEcho(state,config) {state.pending.push(cloneConfig(config));}
  function acceptEcho(state,next,current) {
    const pending=state.pending.findIndex(value=>!state.received.has(value)&&configsEqual(value,next));
    if (pending!==-1) {
      if (pending<state.pending.length-1) {state.received.add(state.pending[pending]);return false;}
      state.stale.push(...state.pending.slice(0,-1).filter(value=>!state.received.has(value)));
      state.pending=[];state.received.clear();
    } else {
      if (configsEqual(current,next)||state.pending.some(value=>state.received.has(value)&&configsEqual(value,next))) return false;
      const stale=state.stale.findIndex(value=>configsEqual(value,next));
      if (stale!==-1) {state.stale.splice(stale,1);return false;}
      state.pending=[];state.received.clear();state.stale=[];
    }
    return !configsEqual(current,next);
  }
  function resolveMedia(config={},metadata={},defaultIcon='mdi:devices') {
    // Allow list (S7.2): http(s), scheme-less relative or same-origin paths, raster data images.
    // Browsers drop tab/newline inside URLs and leading control characters, so the scheme is checked without them.
    const safe=value=>{if(typeof value!=='string'||!value.trim())return null;const url=value.trim(),bare=url.replace(/[\t\n\r]/g,'').replace(/^[\u0000-\u0020]+/,'');
      return !/^[a-z][a-z0-9+.-]*:/i.test(bare)||/^(?:https?:|data:image\/(?:png|jpeg|webp|gif)[;,])/i.test(bare)?url:null;};
    const available=[metadata.entity_picture,metadata.device_picture,metadata.picture].map(safe).filter(Boolean),custom=safe(config.image),mode=config.display_mode||'auto';
    const images=mode==='icon'?[]:[...new Set((mode==='image'?[custom,...available]:[...available,custom]).filter(Boolean))];
    return {image:images[0]||null,images,icon:config.icon||metadata.icon||defaultIcon};
  }
  /** Card-side action gate (M16/M17). 'user' always may act; 'admin' only when the card opts in with admin_actions: true. Not a security boundary. */
  function mayAct(hass,config,level='admin') {
    if (level==='user') return true;
    return !(config?.admin_actions===true&&hass?.user?.is_admin!==true);
  }
  function media(config,metadata,defaultIcon,className='card-icon') {
    const resolved=resolveMedia(config,metadata,defaultIcon),holder=document.createElement('span');
    holder.className='busch-media '+className;holder.setAttribute('aria-hidden','true');let index=0;
    const next=()=>{
      if (index>=resolved.images.length) {const icon=ha.icon(resolved.icon);holder.replaceChildren(icon);return;}
      const img=document.createElement('img');img.setAttribute('src',resolved.images[index++]);img.setAttribute('alt','');img.setAttribute('loading','lazy');
      img.addEventListener('error',next,{once:true});holder.replaceChildren(img);
    };
    next();return holder;
  }
  // Own keys only (M19 remainder): 'constructor' or '__proto__' must not reach a class name.
  const STATUS_SEMANTICS=Object.freeze({success:'success',running:'success',online:'success',connected:'success',on:'success',idle:'warning',warning:'warning',partial:'warning',starting:'warning',stopping:'warning',paused:'warning',blocked:'warning',suspended:'warning',error:'error',failed:'error',neutral:'neutral',stopped:'neutral',offline:'neutral',disconnected:'neutral',off:'neutral',unavailable:'unavailable',unknown:'unknown'});
  function statusSemantic(status) {
    return typeof status==='string'&&Object.hasOwn(STATUS_SEMANTICS,status)?STATUS_SEMANTICS[status]:'unknown';
  }
  function statusBadge(status,text,classPrefix='status-') {
    const badge=document.createElement('span');badge.className='status-badge '+classPrefix+statusSemantic(status);badge.textContent=text;return badge;
  }
  // M67: one formatter per locale and options (building one costs far more than formatting).
  const numberFormats=new Map(),DEFAULT_NUMBER='{"maximumFractionDigits":1}';
  function numberFormat(locale,options) {
    const key=locale+'\u0000'+(options===undefined?DEFAULT_NUMBER:JSON.stringify(options));let format=numberFormats.get(key);
    if(!format){if(numberFormats.size>=64)numberFormats.clear();format=new Intl.NumberFormat(locale,options??{maximumFractionDigits:1});numberFormats.set(key,format);}
    return format;
  }
  function formatNumber(value,locale,options) {
    return !['number','string'].includes(typeof value)||(typeof value==='string'&&!value.trim())||!Number.isFinite(Number(value))?null:numberFormat(locale||'en',options).format(Number(value));
  }
  function metric(label,value,ratio) {
    const node=document.createElement('div');node.className='metric';
    const caption=document.createElement('span');caption.className='metric-label';caption.textContent=label;
    const text=document.createElement('strong');text.className='metric-value';text.textContent=value;node.appendChild(caption);node.appendChild(text);
    if (ratio!==undefined&&Number.isFinite(ratio)) {const bar=document.createElement('progress');bar.max=100;bar.value=Math.min(100,Math.max(0,ratio*100));bar.setAttribute('aria-label',label);node.appendChild(bar);}return node;
  }
  let helperPromise=null;
  const ha = {
    form() {
      const form=document.createElement('ha-form');
      // HA lazy-loads ha-form. Retain its real selector contract and replay
      // properties after upgrade; a free-text replacement would lose selectors.
      if (typeof customElements!=='undefined' && customElements.get && !customElements.get('ha-form') && customElements.whenDefined) {
        customElements.whenDefined('ha-form').then(()=>{
          const props=['hass','schema','data','computeLabel','computeHelper','computeError','disabled'].filter(key=>Object.hasOwn(form,key)).map(key=>[key,form[key]]);
          for (const [key] of props) delete form[key];
          customElements.upgrade?.(form);
          for (const [key,value] of props) form[key]=value;
        });
      }
      return form;
    },
    input({native=false}={}) {return document.createElement(!native&&typeof customElements!=='undefined'&&customElements.get?.('ha-input')?'ha-input':'input');},
    icon(name) {const icon=document.createElement('ha-icon');icon.setAttribute('icon',name);return icon;},
    async cardHelpers({requireRow=false}={}) {
      if (!helperPromise) {
      if (typeof window==='undefined'||typeof window.loadCardHelpers!=='function') return null;
      helperPromise=Promise.resolve().then(()=>window.loadCardHelpers()).then(helpers=>helpers&&typeof helpers.createCardElement==='function'?helpers:null).catch(()=>null);
      }
      const helpers=await helperPromise;
      if(!helpers||(requireRow&&typeof helpers.createRowElement!=='function')){helperPromise=null;return null;}
      return helpers;
    },
  };
  const tokens=Object.freeze({space1:'var(--ha-space-1, 4px)',space2:'var(--ha-space-2, 8px)',space3:'var(--ha-space-3, 12px)',space4:'var(--ha-space-4, 16px)',mediaRadius:'var(--ha-card-border-radius, 12px)',controlMinHeight:'44px',
    // M63: the single inner radius step and the type scale, as --busch-* hooks over the HA tokens.
    radiusInner:'var(--busch-radius-inner,var(--ha-border-radius-md,8px))',fontSizeS:'var(--busch-font-size-s,var(--ha-font-size-s,12px))',
    fontSizeM:'var(--busch-font-size-m,var(--ha-font-size-m,14px))',fontSizeL:'var(--busch-font-size-l,var(--ha-font-size-l,16px))',
    // #1320: focus ring colour, hook --busch-focus-color, default theme colour 60 % with the text colour (>= 3:1 on card and
    // secondary surface, light/dark: #03a9f4 5.30/8.24 on the card, 4.21/7.88 on the secondary surface; blue alone was 2.63).
    focusColor:'var(--busch-focus-color,color-mix(in srgb,var(--primary-color,#03a9f4) 60%,var(--primary-text-color,#212121)))'});
  function language(hass,{legacy=false,browser=true}={}) {
    const code=hass?.locale?.language||(legacy&&hass?.language)||(browser&&typeof navigator!=='undefined'&&navigator.language)||'en';
    return String(code).toLowerCase().startsWith('de')?'de':'en';
  }
  const dictionary=(table,hass,options)=>table[language(hass,options)]||table.en;
  function fieldText(table,hass,name,options) {
    const words=dictionary(table,hass,options),fallback=table.en||{};
    return {label:words?.labels?.[name]??fallback.labels?.[name]??name,helper:words?.helpers?.[name]??fallback.helpers?.[name]??''};
  }
  function validateConfig(input,{parse=false,normalize=cloneConfig,validate}={}) {
    try {
      const copied=cloneConfig(parse?JSON.parse(input):input);
      const error=validate?.(copied);
      if(error) return {ok:false,error:error instanceof Error?error:new Error(String(error))};
      return {ok:true,value:cloneConfig(normalize(copied))};
    } catch(error) {return {ok:false,error};}
  }
  const addClass=(node,name)=>{if(!String(node.className||'').split(/\s+/).includes(name))node.className=((node.className||'')+' '+name).trim();};
  // M61: level 1 opts the title into the HA card header step (family typography otherwise stays in charge).
  function header({node=document.createElement('div'),titleNode,subtitleNode,label,level}={}) {
    addClass(node,'busch-ui-header');node.setAttribute('role','group');
    const name=label??titleNode?.textContent;if(name)node.setAttribute('aria-label',name);
    if(titleNode){if(!/^H[1-6]$/.test(titleNode.tagName||'')){titleNode.setAttribute('role','heading');titleNode.setAttribute('aria-level','2');}addClass(titleNode,'busch-ui-title');
      if(level!==undefined)titleNode.setAttribute('data-level',String(level));}
    if(subtitleNode)addClass(subtitleNode,'busch-ui-subtitle');
    return node;
  }
  // The single level-2 step for section headings inside a card (below the card title, aria level 3).
  function sectionHeading({node=document.createElement('div'),text}={}) {
    if(!/^H[1-6]$/.test(node.tagName||'')){node.setAttribute('role','heading');node.setAttribute('aria-level','3');}
    addClass(node,'busch-ui-heading2');if(text!==undefined)node.textContent=text;return node;
  }
  const actionBindings=new WeakMap();
  function action({node=document.createElement('button'),label,text,icon,disabled,variant='secondary',onClick}={}) {
    if(!label)throw new Error('Action requires an accessible label');
    addClass(node,'busch-ui-action');node.type='button';node.setAttribute('aria-label',label);node.setAttribute('data-variant',variant);
    if(disabled!==undefined)node.disabled=disabled;
    let binding=actionBindings.get(node);
    if(!binding){
      binding={};actionBindings.set(node,binding);
      // Keep native keyboard activation and owning tablist arrow navigation.
      for(const type of ['keydown','keyup'])node.addEventListener(type,event=>{if(event.key==='Enter'||event.key===' ')event.stopPropagation();});
      node.addEventListener('click',event=>{event.stopPropagation();if(!node.disabled)binding.onClick?.(event);});
    }
    binding.onClick=onClick;
    if(text!==undefined){node.textContent=text;binding.icon=null;}
    if(icon){if(!binding.icon){binding.icon=ha.icon(icon);binding.icon.setAttribute('aria-hidden','true');node.appendChild(binding.icon);}else binding.icon.setAttribute('icon',icon);}
    if(icon||text===undefined){if(!node.title||node.title===binding.tooltip){node.title=label;binding.tooltip=label;}}
    return node;
  }

  function section({title,content,open=false}={}) {
    const node=document.createElement('details');
    addClass(node,'busch-ui-section');node.open=open;
    const summary=document.createElement('summary');summary.textContent=title;node.appendChild(summary);
    if(content)node.appendChild(content);return node;
  }
  // M42: double-load safe registration. A second copy of a module (two resource URLs, a cache parameter) keeps
  // the first class instead of throwing NotSupportedError, and the card picker entry is added only once.
  function register(name,cls,card) {
    if(!name)throw new Error('register requires an element name');if(typeof cls!=='function')throw new Error('register requires an element class');
    const existing=customElements.get(name);if(!existing)customElements.define(name,cls);
    if(card){const list=window.customCards||(window.customCards=[]);if(!list.some(entry=>entry?.type===card.type))list.push(card);}
    return existing||cls;
  }
  // M28: one history entry per dialog (ui-regeln Regel 2, steps 1-4). Key buschUiDialog, never `dialog`:
  // HA reads history.state.dialog itself. history.state is a copy, so the own entry is recognised by id.
  let dialogSerial=0;
  function dialogHistory({name='dialog',onClose}={}) {
    const id=String(++dialogSerial)+'-'+Math.random().toString(36).slice(2),history=window.history;let pushed=false,active=true;
    try{history.pushState({buschUiDialog:{id,name}},'');pushed=true;}catch{/* private mode or rate limit: Escape/close still work */}
    const onTop=()=>history.state?.buschUiDialog?.id===id;
    const stop=()=>{active=false;window.removeEventListener('popstate',onPop);};
    // Back gesture or navigation: the own entry is gone (or there never was one).
    function onPop(){if(!active||(pushed&&onTop()))return;stop();onClose?.('back');}
    window.addEventListener('popstate',onPop);
    return {get active(){return active},get pushed(){return pushed},id,
      close(){if(!active)return;stop();if(pushed&&onTop())history.back();}};
  }
  // M28/R04: Tab and Shift+Tab cycle inside root, stray focus is pulled back, focus returns on release.
  const FOCUSABLE='button,[href],input,select,textarea,summary,[tabindex],ha-icon-button,ha-button,ha-switch,ha-checkbox,ha-textfield,ha-select,ha-input,ha-slider';
  function deepActive(start=document.activeElement){let active=start;while(active?.shadowRoot?.activeElement)active=active.shadowRoot.activeElement;return active;}
  function focusTrap(root,{initial}={}) {
    const previous=deepActive();let live=true;
    const items=()=>[...root.querySelectorAll(FOCUSABLE)].filter(el=>!el.disabled&&!el.hidden&&el.getAttribute?.('tabindex')!=='-1'&&el.getAttribute?.('type')!=='hidden'&&(typeof el.getClientRects!=='function'||el.getClientRects().length>0));
    const current=()=>root.getRootNode?.()?.activeElement??document.activeElement;
    const inside=event=>event.composedPath?.().includes(root)??root.contains?.(event.target);
    const onKey=event=>{if(event.key!=='Tab')return;const list=items();if(!list.length)return;event.preventDefault();
      const at=list.indexOf(current()),step=event.shiftKey?-1:1;(at<0?list[event.shiftKey?list.length-1:0]:list[(at+step+list.length)%list.length]).focus();};
    const onFocus=event=>{if(!inside(event))items()[0]?.focus();};
    document.addEventListener('keydown',onKey,true);document.addEventListener('focusin',onFocus,true);
    (initial||items()[0])?.focus?.();
    return {items,release({returnFocus=true}={}){if(!live)return;live=false;document.removeEventListener('keydown',onKey,true);document.removeEventListener('focusin',onFocus,true);
      if(returnFocus&&previous&&previous.isConnected!==false)previous.focus?.();}};
  }
  // M27: one state block for loading/empty/error/offline. The node is a live region from creation;
  // passing it back updates it in place so the change is announced. Texts come from the card dictionary.
  const STATE_KINDS=Object.freeze({loading:{role:'status',live:'polite',icon:'mdi:timer-sand'},empty:{role:'status',live:'polite',icon:'mdi:inbox-outline'},
    offline:{role:'status',live:'polite',icon:'mdi:lan-disconnect'},error:{role:'alert',live:'assertive',icon:'mdi:alert-circle-outline'}});
  function stateBlock({node=document.createElement('div'),kind='empty',icon,title,hint,action:act}={}) {
    const spec=STATE_KINDS[kind];if(!spec)throw new Error('Unknown state kind: '+kind);
    if(!title)throw new Error('State block requires a title');
    addClass(node,'busch-state');node.setAttribute('role',spec.role);node.setAttribute('aria-live',spec.live);node.setAttribute('data-kind',kind);
    if(kind==='loading')node.setAttribute('aria-busy','true');else node.removeAttribute?.('aria-busy');
    const symbol=ha.icon(icon||spec.icon);symbol.setAttribute('aria-hidden','true');symbol.className='busch-state-icon';
    const text=document.createElement('div');text.className='busch-state-text';
    const heading=document.createElement('div');heading.className='busch-state-title';heading.textContent=title;text.appendChild(heading);
    if(hint){const small=document.createElement('div');small.className='busch-state-hint';small.textContent=hint;text.appendChild(small);}
    const parts=[symbol,text];if(act)parts.push(action({variant:'secondary',...act}));
    node.replaceChildren(...parts);return node;
  }
  // M62/M63: opt-in base components. --busch-* tokens live on the opt-in classes (no :host: editor styles may sit
  // in a light DOM style element) and fall back to HA tokens; :where keeps family rules in front. Inner radius: one step, 8 px
  // (HA --ha-border-radius-md), below the 12 px card radius so nested surfaces read as inside the card.
  // M26/E6: filled primary and destructive are a tonal fill (theme colour 50 % with the card surface) with the text colour,
  // destructive text is the error colour mixed 70 % with the text colour: >= 4.5:1 in light and dark for #03a9f4 and #1c76be
  // (white on #03a9f4 was 2.6:1, #212121 on #1c76be 3.4:1, filled red 4.3/3.8:1). HA blue and red stay as surface and border.
  // #1320/M79: coloured symbols reach 3:1 on their surface (WCAG 1.4.11): notice icons are the tone colour 60 % with the text
  // colour on the notice surface (light/dark info 4.72/7.25, warning 3.34/9.53, error 6.03/5.90; were 2.44, 1.56, 3.41), the text
  // button is the theme colour 60 % with the text colour on the card (5.30/8.24, #1c76be 7.98/6.15; was 2.63, #1c76be dark 3.56).
  const styles=`
:where(.busch-btn,.busch-chip,.busch-notice,.busch-kv,.busch-state,.busch-dialog){--busch-space-1:var(--ha-space-1,4px);--busch-space-2:var(--ha-space-2,8px);--busch-space-3:var(--ha-space-3,12px);--busch-space-4:var(--ha-space-4,16px);--busch-font-size-s:var(--ha-font-size-s,12px);--busch-font-size-m:var(--ha-font-size-m,14px);--busch-font-size-l:var(--ha-font-size-l,16px);--busch-radius-inner:var(--ha-border-radius-md,8px);--busch-font-weight-medium:var(--ha-font-weight-medium,500)}
:where(.busch-btn){display:inline-flex;align-items:center;justify-content:center;gap:var(--busch-space-2,8px);box-sizing:border-box;min-height:44px;min-width:44px;max-width:100%;padding:0 var(--busch-space-3,12px);border:1px solid transparent;border-radius:var(--busch-radius-inner,8px);background:transparent;color:var(--primary-text-color,#212121);font:inherit;font-weight:var(--busch-font-weight-medium,500);cursor:pointer}
:where(.busch-btn):focus-visible{outline:2px solid ${tokens.focusColor};outline-offset:2px}
:where(.busch-btn[data-variant=primary]){background:color-mix(in srgb,var(--primary-color,#03a9f4) 50%,var(--card-background-color,#ffffff));color:var(--primary-text-color,#212121)}
:where(.busch-btn[data-variant=secondary]){border:1px solid var(--divider-color,#e0e0e0);background:transparent;color:var(--primary-text-color,#212121)}
:where(.busch-btn[data-variant=text]){background:transparent;color:color-mix(in srgb,var(--primary-color,#03a9f4) 60%,var(--primary-text-color,#212121))}
:where(.busch-btn[data-variant=destructive]),:where(.busch-btn[data-variant=danger]){border:1px solid var(--error-color,#db4437);background:transparent;color:color-mix(in srgb,var(--error-color,#db4437) 70%,var(--primary-text-color,#212121))}
:where(.busch-btn[data-variant=destructive][data-filled]),:where(.busch-btn[data-variant=danger][data-filled]){background:color-mix(in srgb,var(--error-color,#db4437) 50%,var(--card-background-color,#ffffff));color:var(--primary-text-color,#212121)}
:where(.busch-btn):disabled{cursor:default;opacity:0.5}
:where(.busch-chip){display:inline-flex;align-items:center;gap:var(--busch-space-1,4px);box-sizing:border-box;min-height:28px;min-width:0;max-width:100%;padding:0 var(--busch-space-2,8px);border-radius:var(--ha-border-radius-pill,9999px);background:var(--secondary-background-color,#eeeeee);color:var(--primary-text-color,#212121);font-size:var(--busch-font-size-s,12px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
:where(button.busch-chip){min-height:44px;border:0;font-family:inherit;cursor:pointer}
:where(.busch-chip[data-tone=success]){background:color-mix(in srgb,var(--success-color,#43a047) 18%,transparent)}
:where(.busch-chip[data-tone=warning]){background:color-mix(in srgb,var(--warning-color,#ffa600) 18%,transparent)}
:where(.busch-chip[data-tone=error]){background:color-mix(in srgb,var(--error-color,#db4437) 18%,transparent)}
:where(.busch-chip[data-tone=info]){background:color-mix(in srgb,var(--info-color,#039be5) 18%,transparent)}
:where(.busch-notice){display:flex;align-items:flex-start;gap:var(--busch-space-2,8px);box-sizing:border-box;min-width:0;padding:var(--busch-space-2,8px) var(--busch-space-3,12px);border:1px solid var(--divider-color,#e0e0e0);border-radius:var(--busch-radius-inner,8px);background:var(--secondary-background-color,#eeeeee);color:var(--primary-text-color,#212121)}
:where(.busch-notice-icon){--mdc-icon-size:20px;flex:none;color:var(--secondary-text-color,#727272)}
:where(.busch-notice-text){min-width:0;overflow-wrap:anywhere}
:where(.busch-notice[data-tone=info]){border-color:var(--info-color,#039be5)}:where(.busch-notice[data-tone=info]) .busch-notice-icon{color:color-mix(in srgb,var(--info-color,#039be5) 60%,var(--primary-text-color,#212121))}
:where(.busch-notice[data-tone=warning]){border-color:var(--warning-color,#ffa600)}:where(.busch-notice[data-tone=warning]) .busch-notice-icon{color:color-mix(in srgb,var(--warning-color,#ffa600) 60%,var(--primary-text-color,#212121))}
:where(.busch-notice[data-tone=error]){border-color:var(--error-color,#db4437)}:where(.busch-notice[data-tone=error]) .busch-notice-icon{color:color-mix(in srgb,var(--error-color,#db4437) 60%,var(--primary-text-color,#212121))}
:where(.busch-kv){display:flex;align-items:baseline;justify-content:space-between;gap:var(--busch-space-3,12px);min-width:0;padding:var(--busch-space-1,4px) 0}
:where(.busch-kv-key){min-width:0;color:var(--secondary-text-color,#727272);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
:where(.busch-kv-value){min-width:0;color:var(--primary-text-color,#212121);text-align:end;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
:where(.busch-dialog){display:flex;flex-direction:column;box-sizing:border-box;width:calc(100vw - 32px);max-width:560px;max-height:calc(100vh - 32px);border-radius:var(--ha-dialog-border-radius,var(--ha-card-border-radius,12px));background:var(--card-background-color,#ffffff);color:var(--primary-text-color,#212121);overflow:hidden}
:where(.busch-dialog[data-size=confirm]){max-width:320px}
:where(.busch-dialog-head){display:flex;align-items:center;gap:var(--busch-space-2,8px);min-width:0;padding:var(--busch-space-2,8px) var(--busch-space-4,16px) var(--busch-space-2,8px) var(--busch-space-2,8px)}
:where(.busch-dialog-close){order:-1;flex:none}
:where(.busch-dialog-title){flex:1;min-width:0;margin:0;font-size:var(--busch-font-size-l,var(--ha-font-size-l,16px));font-weight:var(--busch-font-weight-medium,500);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
:where(.busch-dialog-content){flex:1 1 auto;min-height:0;overflow:auto;padding:0 var(--busch-space-4,16px);overflow-wrap:anywhere}
:where(.busch-dialog-foot){display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:var(--busch-space-2,8px);padding:var(--busch-space-3,12px) var(--busch-space-4,16px)}
:where(.busch-dialog-foot) :where(.busch-btn){text-transform:none}
:where(.busch-dialog-foot) :where([data-variant=destructive]:not(:last-child)){margin-inline-end:auto}
@media (max-width:449px),(max-height:499px){:where(.busch-dialog){width:100%;max-width:none;min-height:90vh;max-height:100vh;border-radius:var(--ha-card-border-radius,12px) var(--ha-card-border-radius,12px) 0 0}:where(.busch-dialog-foot){margin-top:auto}}
`;
  // Scoped bases: family layout/grid/padding and domain presentation override
  // these fundamentals. No global selectors or services in shared primitives.
  // The action base comes before the base components: an element with both classes (BuschUI.action on a .busch-btn) gets
  // the busch-btn frame, radius and surface (all :where rules have zero specificity, so source order decides).
  const actionStyles=`
:where(.busch-ui-action){border:0;border-radius:var(--ha-card-border-radius,12px);padding:var(--ha-space-2,8px) var(--ha-space-3,12px);color:var(--primary-text-color,#212121);background:var(--secondary-background-color,#eeeeee);box-sizing:border-box;min-height:44px;min-width:44px;max-width:100%;font:inherit;cursor:pointer}
:where(.busch-ui-action):focus-visible{outline:2px solid ${tokens.focusColor};outline-offset:2px}
:where(.busch-ui-action[data-variant=primary]){background:color-mix(in srgb,var(--primary-color,#03a9f4) 50%,var(--card-background-color,#ffffff));color:var(--primary-text-color,#212121)}
:where(.busch-ui-action[data-variant=secondary]){background:var(--secondary-background-color,#eeeeee);color:var(--primary-text-color,#212121)}
:where(.busch-ui-action[data-variant=destructive]),:where(.busch-ui-action[data-variant=danger]){color:color-mix(in srgb,var(--error-color,#db4437) 70%,var(--primary-text-color,#212121))}
:where(.busch-ui-action[data-variant=quiet]),:where(.busch-ui-action[data-variant=icon-only]),:where(.busch-ui-action[data-variant=overflow]){background:transparent}
:where(.busch-ui-action):disabled{cursor:default;opacity:0.5}
`;
  // M26/E6: error and offline state icons mix the status colour 70 % with the text colour like the destructive text:
  // error 6.56/5.46:1, offline 3.42/9.60:1 on the card (light/dark render themes).
  const cardStyles=actionStyles+styles+`
.busch-ui-header{min-width:0}.busch-ui-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
:where(.busch-ui-title[data-level="1"]){font-size:var(--ha-card-header-font-size,var(--ha-font-size-2xl,24px));font-weight:var(--ha-font-weight-medium,500);color:var(--primary-text-color,#212121)}
:where(.busch-ui-subtitle){font-size:var(--busch-font-size-s,var(--ha-font-size-s,12px));color:var(--secondary-text-color,#727272)}
:where(.busch-ui-heading2){margin:0;font-size:var(--busch-font-size-m,var(--ha-font-size-m,14px));font-weight:var(--ha-font-weight-medium,500);color:var(--primary-text-color,#212121);text-transform:none;letter-spacing:normal;overflow-wrap:anywhere}
.busch-state{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--ha-space-2,8px);padding:var(--ha-space-4,16px);text-align:center;min-width:0;box-sizing:border-box;color:var(--primary-text-color,#212121)}
.busch-state-icon{--mdc-icon-size:24px;color:var(--secondary-text-color,#727272)}
.busch-state[data-kind=error] .busch-state-icon{color:color-mix(in srgb,var(--error-color,#db4437) 70%,var(--primary-text-color,#212121))}.busch-state[data-kind=offline] .busch-state-icon{color:color-mix(in srgb,var(--warning-color,#ffa600) 70%,var(--primary-text-color,#212121))}
.busch-state-text{display:flex;flex-direction:column;gap:var(--ha-space-1,4px);min-width:0;max-width:100%}
.busch-state-title{font-weight:var(--ha-font-weight-medium,500);overflow-wrap:anywhere}
.busch-state-hint{color:var(--secondary-text-color,#727272);font-size:var(--ha-font-size-s,12px);overflow-wrap:anywhere}
`;
  // #1320 (Etappe I): the validation text is the error colour 70 % with the text colour like the destructive text, >= 4.5:1 on
  // the card and the secondary surface in light and dark (light/dark card 6.56/5.46; red alone was 4.29/3.97).
  const editorStyles=cardStyles+`
:host(.busch-ui-editor),.busch-ui-editor{display:block;min-width:0;color:var(--primary-text-color,#212121);font:inherit}
:host(.busch-ui-editor) ha-form,.busch-ui-editor ha-form{display:block;min-width:0}.busch-ui-section{min-width:0}
.busch-ui-section>summary{cursor:pointer;min-height:44px;box-sizing:border-box;overflow-wrap:anywhere;font-weight:var(--ha-font-weight-medium,500)}
.busch-ui-section>summary:focus-visible{outline:2px solid ${tokens.focusColor};outline-offset:2px}
.busch-ui-validation{color:color-mix(in srgb,var(--error-color,#db4437) 70%,var(--primary-text-color,#212121));overflow-wrap:anywhere;font-size:var(--ha-font-size-s,12px)}
`;
  return Object.freeze({sourceVersion,EditorBase,cloneConfig,configsEqual,updateConfig,updateConfigPath,deleteConfigPath,emitConfigChanged,guardEditorKeys,createEchoState,queueEcho,acceptEcho,resolveMedia,media,mayAct,statusSemantic,statusBadge,metric,formatNumber,ha,tokens,language,dictionary,fieldText,validateConfig,header,sectionHeading,action,section,stateBlock,dialogHistory,focusTrap,register,styles,cardStyles,editorStyles});
})();
/* END BUSCH SHARED UI */

/**
 * arrstack Cards — Lovelace cards for the `arrstack` integration
 * (Radarr, Sonarr, SABnzbd and Jellyseerr/Seerr).
 *
 * Cards (one line per `window.customCards` entry, registered at the end of
 * this file; tests/kopfkommentar.test.js compares this list with the entries):
 *  - `arrstack-downloads-card` — running downloads of Sonarr, Radarr and SABnzbd.
 *  - `arrstack-recent-card` — what Sonarr and Radarr added to the library last.
 *  - `arrstack-fix-card` — downloads that were never imported, with a repair.
 *  - `arrstack-seer-card` — Seerr search with season picker and request.
 * Each card has an editor `<type>-editor`; `arrstack-dialog` is the shared
 * dialog of the import repair.
 *
 * Deliberately without a build step: one file, plain vanilla JS with custom
 * elements. What is here is exactly what ships. **No subfolders:** a HACS
 * dashboard resource serves exactly one file. A new card is a class plus a
 * `BuschUI.register(tag, Class, { type, name, description, preview: false,
 * documentationURL })` at the end of this file and a line in the list above.
 *
 * The cards need the `arrstack` integration; without it they report that no
 * matching arrstack service is set up. The integration also runs without them.
 *
 * `hacs/docs/ui-regeln.md` applies (since 09.09.2026):
 *  - Rule 1: every single-line text container truncates, every multi-line one wraps.
 *  - Rule 2: whatever covers the card is a dialog with its own history entry —
 *    Escape, scrim, the back button and the close button.
 *  - Rule 3: every config field has a label and a helper, German and English,
 *    in exactly one dictionary per card.
 *  - Rule 4: colours, spacing and font sizes only through theme variables.
 */

const CARD_VERSION = "0.10.1";

const DOCS_URL = "https://github.com/luukkii123/ha-arrstack-cards";

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

/* ── Sprache ────────────────────────────────────────────────────────────────
 *
 * Zwei Quellen, weil es zwei Zeitpunkte gibt: der `window.customCards`-Eintrag
 * entsteht beim Laden der Datei, lange bevor irgendein `hass` bekannt ist —
 * dort entscheidet `navigator.language`. In Karte und Editor entscheidet
 * `hass.locale.language`, also die Sprache, die der Nutzer in Home Assistant
 * eingestellt hat.
 */

/** `de-AT` → `de`, alles andere → `en`. */
function sprachSchluessel(code) {
  return String(code || "en").toLowerCase().startsWith("de") ? "de" : "en";
}

/** Sprache für den `customCards`-Eintrag; `hass` gibt es dort noch nicht. */
const BROWSER_SPRACHE = sprachSchluessel(
  typeof navigator !== "undefined" ? navigator.language : "en"
);

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
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  circleAlert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  unplug: '<path d="m19 5 3-3"/><path d="m2 22 3-3"/><path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z"/><path d="M7.5 13.5 10 11"/><path d="M10.5 16.5 13 14"/><path d="m12 6 6 6 2.3-2.3a2.4 2.4 0 0 0 0-3.4l-2.6-2.6a2.4 2.4 0 0 0-3.4 0Z"/>',
  jellyfish:
    '<path d="M4 12a8 8 0 0 1 16 0"/><path d="M4 12h16"/>' +
    '<path d="M7.5 12c0 2.5-1.5 3.5-1.5 5.5S7 20 7 20"/>' +
    '<path d="M12 12v8"/>' +
    '<path d="M16.5 12c0 2.5 1.5 3.5 1.5 5.5S17 20 17 20"/>',
};

/** Wo die echten Dienst-Logos herkommen.
 *
 * `brands.home-assistant.io` ist Home Assistants eigene Sammlung — dieselbe,
 * aus der das Frontend die Zeichen aller Integrationen holt. Die Logos werden
 * deshalb **verwiesen, nicht mitgeliefert**: es sind fremde Marken.
 * Lädt das Bild nicht (kein Netz), verschwindet es rückstandslos
 * (`bindImageFallbacks`).
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
  return brand && brand !== "seerr"
    ? `<span class="symbol-pair">${serviceLogo(brand, size)}<span hidden>${arrIcon(fallback, size)}</span></span>`
    : arrIcon(fallback, size);
}

/** Das Logo eines Dienstes als `<img>`; ohne Kennung nichts. */
function serviceLogo(brand, size = 22) {
  if (!brand) return "";
  return `<img class="logo" src="${BRAND_BASE}${encodeURIComponent(brand)}/icon.png"
    alt="" loading="lazy" style="width: ${size}px; height: ${size}px">`;
}

/** Image fallback without inline handlers (M47): a poster or logo that fails
 * to load reveals the placeholder right after it and removes itself, as the
 * former inline `onerror` did. Called after every markup insertion; each image
 * is bound once, also when a patch keeps it. */
const IMAGE_FALLBACK_BOUND = new WeakSet();
function bindImageFallbacks(root) {
  root.querySelectorAll("img.poster, img.logo").forEach((img) => {
    if (IMAGE_FALLBACK_BOUND.has(img)) return;
    IMAGE_FALLBACK_BOUND.add(img);
    img.addEventListener("error", () => {
      let fallback = img.nextSibling;
      while (fallback && fallback.nodeType !== 1) fallback = fallback.nextSibling;
      if (fallback) fallback.hidden = false;
      img.remove();
    });
  });
}

/** The same pictures as mdi names for BuschUI.stateBlock (M27); its own default per kind otherwise. */
const ARR_STATE_ICONS = { download: "mdi:download", film: "mdi:filmstrip", check: "mdi:check-circle-outline", search: "mdi:magnify" };

/** Ein Symbol als SVG-Zeichenkette. */
function arrIcon(name, size = 18) {
  const paths = ARR_ICON_PATHS[name] || "";
  return `<svg class="icon" viewBox="0 0 24 24" width="${size}" height="${size}"
    fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Wörterbücher (Regel 3, vereinbarte Form aus scripts/ui-regeln-pruefen.py)
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Was alle vier Karten an nutzersichtbarem Text teilen.
 *
 * Wird per Spread in das `texte` jeder Karte übernommen, damit jede Karte
 * genau **ein** Wörterbuch hat und keine Zeichenkette im Code steht. Die
 * Zustandswörter sind Übersetzungstische für rohe API-Werte: Sonarr, Radarr
 * und SABnzbd liefern ihre Zustände englisch und technisch
 * (`downloadClientUnavailable`) — auf einer Karte im Wohnzimmer hat das
 * nichts zu suchen.
 */
const TEXTE_ARRSTACK_BASIS = {
  de: {
    treffer: '{n} Treffer',
    vorherige: 'Zurück',
    naechste: 'Weiter',
    seite: 'Seite {n} von {total}',
    bereit: 'Bereit',
    erneut: 'Erneut versuchen',
    details: 'Technische Details',
    fehler_kurz: 'Die Anfrage konnte nicht verarbeitet werden. Eingaben bleiben erhalten. Bitte erneut versuchen.',
    fehler_suche: 'Suche fehlgeschlagen',
    aenderungen: 'Auswahl verwerfen?',
    aenderungen_hinweis: 'Die geänderte Auswahl bleibt erhalten, bis du sie ausdrücklich verwirfst.',
    verwerfen: 'Verwerfen',
    behalten: 'Weiter bearbeiten',
    laden: "Lade …",
    automatisch: "Automatisch",
    schliessen: "Schließen",
    abbrechen: "Abbrechen",
    fehler_nicht_gefunden: "Kein passender arrstack-Dienst eingerichtet.",
    fehler_mehrdeutig: "Mehrere Instanzen vorhanden — im Karteneditor eine auswählen.",
    fehler_nicht_unterstuetzt: "Dieser Dienst kann das nicht.",
    fehler_rechte: "Dafür fehlen die Rechte — Administrator nötig.",
    fehler_allgemein: "Daten konnten nicht geladen werden.",
    fehler_zeit: "Keine Antwort in der Zeitgrenze.",
    fehler_zeit_schreiben: "Keine Antwort in der Zeitgrenze. Ob die Aktion ausgeführt wurde, ist offen – erst den aktuellen Stand prüfen, dann erneut versuchen.",
    stand_alt: "Stand vor {n} Min.",
    einheiten: ["B", "KB", "MB", "GB", "TB"],
    zahlformat: "de-DE",
    zeit_jetzt: "gerade eben",
    zeit_min: "vor {n} Min.",
    zeit_std: "vor {n} Std.",
    zeit_tage: "vor {n} Tagen",
    dauer_std: "{h} Std. {m} Min.",
    dauer_min: "{m} Min.",
    zustaende: {
      downloading: "lädt",
      queued: "wartet",
      paused: "pausiert",
      completed: "fertig",
      failed: "fehlgeschlagen",
      warning: "Warnung",
      delay: "verzögert",
      downloadclientunavailable: "Client nicht erreichbar",
      fallback: "Ausweichquelle",
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
    },
    verfolgt: {
      importPending: "Import steht aus",
      importBlocked: "Import blockiert",
      importing: "wird importiert",
      imported: "importiert",
      failedPending: "fehlgeschlagen",
      failed: "fehlgeschlagen",
      ignored: "übergangen",
    },
  },
  en: {
    treffer: '{n} results',
    vorherige: 'Previous',
    naechste: 'Next',
    seite: 'Page {n} of {total}',
    bereit: 'Ready',
    erneut: 'Retry',
    details: 'Technical details',
    fehler_kurz: 'The request could not be processed. Your input is kept. Please retry.',
    fehler_suche: 'Search failed',
    aenderungen: 'Discard selection?',
    aenderungen_hinweis: 'Your changed selection is kept until you explicitly discard it.',
    verwerfen: 'Discard',
    behalten: 'Keep editing',
    laden: "Loading …",
    automatisch: "Automatic",
    schliessen: "Close",
    abbrechen: "Cancel",
    fehler_nicht_gefunden: "No matching arrstack service configured.",
    fehler_mehrdeutig: "Several instances exist — pick one in the card editor.",
    fehler_nicht_unterstuetzt: "This service cannot do that.",
    fehler_rechte: "Not allowed — this needs an administrator.",
    fehler_allgemein: "Could not load the data.",
    fehler_zeit: "No answer within the time limit.",
    fehler_zeit_schreiben: "No answer within the time limit. Whether the action ran is unknown – check the current state before trying again.",
    stand_alt: "As of {n} min ago",
    einheiten: ["B", "KB", "MB", "GB", "TB"],
    zahlformat: "en-US",
    zeit_jetzt: "just now",
    zeit_min: "{n} min ago",
    zeit_std: "{n} h ago",
    zeit_tage: "{n} days ago",
    dauer_std: "{h} h {m} min",
    dauer_min: "{m} min",
    zustaende: {
      downloading: "downloading",
      queued: "queued",
      paused: "paused",
      completed: "done",
      failed: "failed",
      warning: "warning",
      delay: "delayed",
      downloadclientunavailable: "client unreachable",
      fallback: "fallback source",
      grabbing: "grabbing",
      fetching: "fetching",
      checking: "checking",
      verifying: "verifying",
      repairing: "repairing",
      extracting: "extracting",
      moving: "moving",
      running: "post-processing",
      propagating: "waiting for release",
      idle: "idle",
    },
    verfolgt: {
      importPending: "import pending",
      importBlocked: "import blocked",
      importing: "importing",
      imported: "imported",
      failedPending: "failed",
      failed: "failed",
      ignored: "ignored",
    },
  },
};

/* ── Karte 1: laufende Downloads ────────────────────────────────────────── */

const ARRSTACK_QUEUE_COLUMNS = {
  title: ['Serie / Film', 'Series / movie'], status: ['Status', 'Status'],
  episode: ['Episode', 'Episode'], timeleft: ['Restzeit', 'Time left'],
  progress: ['Fortschritt', 'Progress'], episode_title: ['Episodentitel', 'Episode title'],
  episode_air_date: ['Ausstrahlung', 'Air date'], languages: ['Sprachen', 'Languages'],
  quality: ['Qualität', 'Quality'], custom_formats: ['Custom Formats', 'Custom formats'],
  custom_format_score: ['Formatwertung', 'Format score'], protocol: ['Protokoll', 'Protocol'],
  indexer: ['Indexer', 'Indexer'], download_client: ['Downloadclient', 'Download client'],
  release_title: ['Release-Titel', 'Release title'], size: ['Größe', 'Size'],
  output_path: ['Ausgabepfad', 'Output path'],
};
const ARRSTACK_QUEUE_DEFAULT_COLUMNS = ['title','status','episode','timeleft','progress'];
function queueColumns(value) {
  const valid = Array.isArray(value) ? [...new Set(value.filter(key=>Object.hasOwn(ARRSTACK_QUEUE_COLUMNS,key)))] : [];
  return valid.length ? valid : [...ARRSTACK_QUEUE_DEFAULT_COLUMNS];
}
function queueColumnLabel(key,language) { return ARRSTACK_QUEUE_COLUMNS[key]?.[language==='de' ? 0 : 1] || key; }

const SCHEMA_ARRSTACK_DOWNLOADS_CARD = [
  { name: "title", selector: { text: {} } },
  { name: "entry_id", selector: { select: { options: [], mode: "dropdown", custom_value: false } } },
  { name: "service", selector: { select: { options: [], mode: "dropdown", custom_value: false } } },
  { name: "refresh_seconds", selector: { number: { min: 0, max: 600, mode: "box", unit_of_measurement: "s" } } },
  { name: "max_items", selector: { number: { min: 1, max: 200, mode: "box" } } },
  { name: "show_posters", selector: { boolean: {} } },
  { name: "show_unknown", selector: { boolean: {} } },
  { name: "columns", selector: { select: { options: [], multiple: true, mode: "dropdown", custom_value: false } } },
];

const TEXTE_ARRSTACK_DOWNLOADS_CARD = {
  de: {
    name: "arrstack Downloads",
    description: "Zeigt, was gerade in Sonarr, Radarr oder SABnzbd lädt.",
    labels: {
      title: "Überschrift",
      entry_id: "Instanz",
      service: "Dienst",
      refresh_seconds: "Neu laden alle",
      max_items: "Einträge pro Seite",
      show_posters: "Poster zeigen",
      show_unknown: "Unbekannte Titel zeigen",
      columns: "Sichtbare Spalten",
    },
    helpers: {
      title: "Überschrift der Karte. Vorgabe: Downloads.",
      entry_id: "Welche eingerichtete arrstack-Instanz die Karte abfragt. Vorgabe: die einzige passende.",
      service: "Diensttyp, wenn keine Instanz gewählt ist. Vorgabe: die Integration entscheidet.",
      refresh_seconds: "Sekunden zwischen zwei Abfragen. 0 schaltet das Nachladen ab. Vorgabe 15.",
      max_items: "Wie viele Zeilen eine Seite zeigt. Vorgabe 10; weitere Einträge sind über den Seitenwechsel erreichbar.",
      show_posters: "Zeigt links neben jeder Zeile das Poster. Vorgabe an.",
      show_unknown: "Zeigt auch nicht zugeordnete Filme oder Serien. Vorgabe an, damit Importprobleme sichtbar bleiben.",
      columns: "Welche Informationen die Warteschlange zeigt. Die Reihenfolge lässt sich darunter mit Hoch und Runter ändern.",
    },
    texte: {
      ...TEXTE_ARRSTACK_BASIS.de,
      kartentitel: "Downloads",
      spaltenreihenfolge: "Spaltenreihenfolge", hoch: "Hoch", runter: "Runter",
      spalten_keine: "Keine Spalte gewählt. Die Karte zeigt die Vorgabespalten: {spalten}.",
      nach_oben: "nach oben", nach_unten: "nach unten", poster: "Poster", aktionen: "Aktionen", import_hinweise: "Importhinweise",
      leer: "Nichts in der Warteschlange.",
    },
  },
  en: {
    name: "arrstack downloads",
    description: "Shows what is downloading right now in Sonarr, Radarr or SABnzbd.",
    labels: {
      title: "Title",
      entry_id: "Instance",
      service: "Service",
      refresh_seconds: "Reload every",
      max_items: "Items per page",
      show_posters: "Show posters",
      show_unknown: "Show unknown titles",
      columns: "Visible columns",
    },
    helpers: {
      title: "Heading of the card. Default: Downloads.",
      entry_id: "Which configured arrstack instance the card queries. Default: the only matching one.",
      service: "Service type when no instance is picked. Default: the integration decides.",
      refresh_seconds: "Seconds between two queries. 0 turns reloading off. Default 15.",
      max_items: "How many rows a page shows. Default 10; further items are available using page navigation.",
      show_posters: "Shows the poster left of every row. Default on.",
      show_unknown: "Includes movies or shows that could not be matched. Default on so import problems stay visible.",
      columns: "Which queue information is shown. Change its order below with Up and Down.",
    },
    texte: {
      ...TEXTE_ARRSTACK_BASIS.en,
      kartentitel: "Downloads",
      spaltenreihenfolge: "Column order", hoch: "Up", runter: "Down",
      spalten_keine: "No column chosen. The card shows the default columns: {spalten}.",
      nach_oben: "up", nach_unten: "down", poster: "Poster", aktionen: "Actions", import_hinweise: "Import notes",
      leer: "Nothing in the queue.",
    },
  },
};

/* ── Karte 2: zuletzt hinzugefügt ───────────────────────────────────────── */

const SCHEMA_ARRSTACK_RECENT_CARD = [
  { name: "title", selector: { text: {} } },
  { name: "entry_id", selector: { select: { options: [], mode: "dropdown", custom_value: false } } },
  { name: "service", selector: { select: { options: [], mode: "dropdown", custom_value: false } } },
  { name: "refresh_seconds", selector: { number: { min: 0, max: 600, mode: "box", unit_of_measurement: "s" } } },
  { name: "max_items", selector: { number: { min: 1, max: 50, mode: "box" } } },
];

const TEXTE_ARRSTACK_RECENT_CARD = {
  de: {
    name: "arrstack Zuletzt",
    description: "Zeigt, was zuletzt in die Bibliothek aufgenommen wurde.",
    labels: {
      title: "Überschrift",
      entry_id: "Instanz",
      service: "Dienst",
      refresh_seconds: "Neu laden alle",
      max_items: "Einträge",
    },
    helpers: {
      title: "Überschrift der Karte. Vorgabe: Zuletzt hinzugefügt.",
      entry_id: "Welche eingerichtete arrstack-Instanz die Karte abfragt. Vorgabe: die einzige passende.",
      service: "Diensttyp, wenn keine Instanz gewählt ist. Vorgabe: die Integration entscheidet.",
      refresh_seconds: "Sekunden zwischen zwei Abfragen. 0 schaltet das Nachladen ab. Vorgabe 120.",
      max_items: "Wie viele Zeilen die Karte höchstens zeigt. Vorgabe 8.",
    },
    texte: {
      ...TEXTE_ARRSTACK_BASIS.de,
      kartentitel: "Zuletzt hinzugefügt",
      leer: "Noch nichts aufgenommen.",
    },
  },
  en: {
    name: "arrstack recent",
    description: "Shows what was most recently added to the library.",
    labels: {
      title: "Title",
      entry_id: "Instance",
      service: "Service",
      refresh_seconds: "Reload every",
      max_items: "Entries",
    },
    helpers: {
      title: "Heading of the card. Default: Recently added.",
      entry_id: "Which configured arrstack instance the card queries. Default: the only matching one.",
      service: "Service type when no instance is picked. Default: the integration decides.",
      refresh_seconds: "Seconds between two queries. 0 turns reloading off. Default 120.",
      max_items: "How many rows the card shows at most. Default 8.",
    },
    texte: {
      ...TEXTE_ARRSTACK_BASIS.en,
      kartentitel: "Recently added",
      leer: "Nothing added yet.",
    },
  },
};

/* ── Karte 3: heruntergeladen, aber nicht importiert ────────────────────── */

const SCHEMA_ARRSTACK_FIX_CARD = [
  { name: "title", selector: { text: {} } },
  { name: "entry_id", selector: { select: { options: [], mode: "dropdown", custom_value: false } } },
  { name: "service", selector: { select: { options: [], mode: "dropdown", custom_value: false } } },
  { name: "refresh_seconds", selector: { number: { min: 0, max: 600, mode: "box", unit_of_measurement: "s" } } },
  { name: "max_items", selector: { number: { min: 1, max: 50, mode: "box" } } },
];

const TEXTE_ARRSTACK_FIX_CARD = {
  de: {
    name: "arrstack Import-Fix",
    description: "Zeigt Heruntergeladenes, das nicht importiert wurde, mit Schnell-Reparatur.",
    labels: {
      max_items: 'Einträge pro Seite',
      title: "Überschrift",
      entry_id: "Instanz",
      service: "Dienst",
      refresh_seconds: "Neu laden alle",
    },
    helpers: {
      max_items: 'Wie viele Queue-Einträge eine Seite zeigt. Vorgabe 5. Weiterblättern erhält die Auswahl.',
      title: "Überschrift der Karte. Vorgabe: Import / Probleme.",
      entry_id: "Welche eingerichtete arrstack-Instanz die Karte abfragt. Vorgabe: die einzige passende.",
      service: "Diensttyp, wenn keine Instanz gewählt ist. Vorgabe: die Integration entscheidet.",
      refresh_seconds: "Sekunden zwischen zwei Abfragen. 0 schaltet das Nachladen ab. Vorgabe 60.",
    },
    texte: {
      ...TEXTE_ARRSTACK_BASIS.de,
      eine_datei: '1 Datei gefunden',
      auswahl_noetig: 'Auswahl nötig',
      bulk: 'Bereite importieren',
      auswahl_importieren: 'Auswahl importieren',
      auswaehlen: 'Auswählen',
      auswahl_nicht_bereit: 'Nur importbereite Einträge lassen sich auswählen.',
      ausgewaehlt: '{n} ausgewählt',
      uebermittelt: '{n} Importauftrag/-aufträge übermittelt.',
      teilfehler: '{n} Eintrag/Einträge fehlgeschlagen. Bitte Details prüfen.',
      uebersprungen: '{n} Eintrag/Einträge nicht importiert. Aktuellen Status prüfen.',
      import_fehler: 'Import fehlgeschlagen',
      import_status: 'Importprüfung fehlgeschlagen',
      auswahl_datei: 'Datei auswählen',
      datei_ungueltig: 'Nicht importierbar',
      keine_importe: 'Keine bereiten Einträge.',
      neu_laden: 'Aktualisieren',
      kartentitel: "Import / Probleme",
      leer: "Alles importiert.",
      offen: "{n} offen",
      pruefen: "Prüfen",
      loeschen: "Löschen",
      importieren: "Importieren",
      dialog_pruefen: "Dateien prüfen",
      dialog_loeschen: "Endgültig löschen",
      pruefe: "Prüfe Dateien …",
      keine_datei: "Keine Datei gefunden.",
      gesperrt: "Automatischer Import gesperrt: {grund}",
      gesperrt_ohne_grund: "keine Zuordnung gefunden",
      ohne_kennung: "Dieser Eintrag hat keine Download-Kennung.",
      importiert: "{n} Datei(en) importiert.",
      geloescht: "Eintrag gelöscht.",
      loeschen_frage:
        "Der Eintrag wird aus der Warteschlange genommen und die heruntergeladenen " +
        "Dateien werden im Download-Client gelöscht. Das lässt sich nicht rückgängig machen.",
    },
  },
  en: {
    name: "arrstack import fix",
    description: "Shows downloads that were never imported, with a one-click repair.",
    labels: {
      max_items: 'Items per page',
      title: "Title",
      entry_id: "Instance",
      service: "Service",
      refresh_seconds: "Reload every",
    },
    helpers: {
      max_items: 'How many queue items one page shows. Default 5. Paging keeps the selection.',
      title: "Heading of the card. Default: Import / problems.",
      entry_id: "Which configured arrstack instance the card queries. Default: the only matching one.",
      service: "Service type when no instance is picked. Default: the integration decides.",
      refresh_seconds: "Seconds between two queries. 0 turns reloading off. Default 60.",
    },
    texte: {
      ...TEXTE_ARRSTACK_BASIS.en,
      eine_datei: '1 file found',
      auswahl_noetig: 'Selection required',
      bulk: 'Import ready',
      auswahl_importieren: 'Import selected',
      auswaehlen: 'Select',
      auswahl_nicht_bereit: 'Only items ready to import can be selected.',
      ausgewaehlt: '{n} selected',
      uebermittelt: '{n} import command(s) submitted.',
      teilfehler: '{n} item(s) failed. Please check details.',
      uebersprungen: '{n} item(s) were not imported. Check the current status.',
      import_fehler: 'Import failed',
      import_status: 'Import inspection failed',
      auswahl_datei: 'Select file',
      datei_ungueltig: 'Not importable',
      keine_importe: 'No ready items.',
      neu_laden: 'Refresh',
      kartentitel: "Import / problems",
      leer: "Everything imported.",
      offen: "{n} open",
      pruefen: "Check",
      loeschen: "Delete",
      importieren: "Import",
      dialog_pruefen: "Check files",
      dialog_loeschen: "Delete for good",
      pruefe: "Checking files …",
      keine_datei: "No file found.",
      gesperrt: "Automatic import blocked: {grund}",
      gesperrt_ohne_grund: "nothing could be matched",
      ohne_kennung: "This entry has no download id.",
      importiert: "{n} file(s) imported.",
      geloescht: "Entry deleted.",
      loeschen_frage:
        "The entry is taken out of the queue and the downloaded files are deleted " +
        "in the download client. This cannot be undone.",
    },
  },
};

/* ── Karte 4: Serie oder Film anfragen (Jellyseerr/Seerr) ───────────────── */

const SCHEMA_ARRSTACK_SEER_CARD = [
  { name: "title", selector: { text: {} } },
  { name: "entry_id", selector: { select: { options: [], mode: "dropdown", custom_value: false } } },
  { name: "service", selector: { select: { options: [], mode: "dropdown", custom_value: false } } },
  { name: "refresh_seconds", selector: { number: { min: 0, max: 600, mode: "box", unit_of_measurement: "s" } } },
  { name: "max_items", selector: { number: { min: 1, max: 20, mode: "box" } } },
];

const TEXTE_ARRSTACK_SEER_CARD = {
  de: {
    name: "arrstack Anfragen",
    description: "Sucht in Jellyseerr, wählt Staffeln und stellt Anfragen.",
    labels: {
      title: "Überschrift",
      entry_id: "Instanz",
      service: "Dienst",
      refresh_seconds: "Neu laden alle",
      max_items: "Einträge",
    },
    helpers: {
      title: "Überschrift der Karte. Vorgabe: Seer.",
      entry_id: "Welche eingerichtete arrstack-Instanz die Karte abfragt. Vorgabe: die einzige passende.",
      service: "Diensttyp, wenn keine Instanz gewählt ist. Vorgabe: die Integration entscheidet.",
      refresh_seconds: "Sekunden zwischen zwei Abfragen. 0 schaltet das Nachladen ab. Vorgabe 0 — die Karte lädt auf Zuruf.",
      max_items: "Wie viele Treffer die Karte höchstens zeigt. Vorgabe 8.",
    },
    texte: {
      ...TEXTE_ARRSTACK_BASIS.de,
      kartentitel: "Seer",
      platzhalter: "Serie oder Film suchen",
      suchbegriff: "Suchbegriff",
      suchen: "Suchen",
      leer: "Titel eintippen und suchen.",
      nichts_gefunden: "Nichts gefunden.",
      serie: "Serie",
      film: "Film",
      specials: "Specials",
      staffel: "Staffel {n}",
      staffel_da: "{name} — bereits verfügbar",
      dialog_anfragen: "Anfragen",
      anfragen: "Anfragen",
      staffel_waehlen: "Mindestens eine Staffel wählen.",
      angefragt: "Angefragt (Nr. {n}).",
      seer_status: {
        unknown: "nicht angefragt",
        pending: "offen",
        processing: "in Arbeit",
        partially_available: "teilweise da",
        available: "verfügbar",
        blocklisted: "gesperrt",
        deleted: "gelöscht",
      },
    },
  },
  en: {
    name: "arrstack requests",
    description: "Searches Jellyseerr, picks seasons and sends requests.",
    labels: {
      title: "Title",
      entry_id: "Instance",
      service: "Service",
      refresh_seconds: "Reload every",
      max_items: "Entries",
    },
    helpers: {
      title: "Heading of the card. Default: Seer.",
      entry_id: "Which configured arrstack instance the card queries. Default: the only matching one.",
      service: "Service type when no instance is picked. Default: the integration decides.",
      refresh_seconds: "Seconds between two queries. 0 turns reloading off. Default 0 — this card loads on demand.",
      max_items: "How many results the card shows at most. Default 8.",
    },
    texte: {
      ...TEXTE_ARRSTACK_BASIS.en,
      kartentitel: "Seer",
      platzhalter: "Search a show or movie",
      suchbegriff: "Search term",
      suchen: "Search",
      leer: "Type a title and search.",
      nichts_gefunden: "Nothing found.",
      serie: "Show",
      film: "Movie",
      specials: "Specials",
      staffel: "Season {n}",
      staffel_da: "{name} — already available",
      dialog_anfragen: "Request",
      anfragen: "Request",
      staffel_waehlen: "Pick at least one season.",
      angefragt: "Requested (no. {n}).",
      seer_status: {
        unknown: "not requested",
        pending: "pending",
        processing: "processing",
        partially_available: "partly available",
        available: "available",
        blocklisted: "blocklisted",
        deleted: "deleted",
      },
    },
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
 * Marken und Grundformen
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Die Skala. Jeder Wert hängt an einer HA-Variablen, der Pixelwert ist nur
 * der Rückfall — Regel 4 verlangt Theme-Variablen, kein eigenes Maßsystem.
 *
 * Die Sprünge sind gewollt groß (8 innerhalb einer Gruppe, 24 zwischen
 * Gruppen); ähnliche Abstände liest niemand als Trennung.
 *
 * `container-type` sitzt auf `:host`, nicht auf `ha-card`: das Element liegt
 * im Shadow DOM und ist ohne Home Assistants Styles `display: inline` — an
 * einem inline dargestellten Element ist `container-type` wirkungslos.
 */
/* Shared UI contract 0.1.0: standalone Arrstack shell, header, status and actions. */
const ARRSTACK_TOKENS = `
  :host {
    --arr-space-1: var(--ha-space-1, 4px);
    --arr-space-2: var(--ha-space-2, 8px);
    --arr-space-3: var(--ha-space-3, 12px);
    --arr-space-4: ${BuschUI.tokens.space4};
    /* M63: one inner radius step (8 px, below the 12 px card radius) and the
       type scale of Shared UI, each with its HA token in front. */
    --arr-radius-1: ${BuschUI.tokens.radiusInner};
    --arr-radius-2: var(--ha-card-border-radius, 12px);
    --arr-font-sm: ${BuschUI.tokens.fontSizeS};
    --arr-font-md: ${BuschUI.tokens.fontSizeM};
    --arr-font-lg: ${BuschUI.tokens.fontSizeL};
    --arr-weight-bold: var(--ha-font-weight-bold, 600);
    --arr-poster-w: 44px;
    --arr-poster-h: 66px;
    --arr-thumb: 36px;
    --arr-bar: 6px;
    --arr-logo: 22px;
    --arr-media: 44px;
    --arr-text: var(--primary-text-color, #212121);
    --arr-muted: var(--secondary-text-color, #727272);
    --arr-accent: var(--primary-color, #03a9f4);
    --arr-surface: var(--secondary-background-color, rgba(127, 127, 127, 0.12));
    --arr-line: var(--divider-color, rgba(127, 127, 127, 0.25));
    --arr-danger: var(--error-color, #db4437);
    --arr-success: var(--success-color, var(--primary-color, #03a9f4));
    --arr-warning: var(--warning-color, var(--primary-color, #03a9f4));
    display: block;
    container-type: inline-size;
  }
`;

/** Ein einzeiliger Textcontainer nach Regel 1 — alle vier Eigenschaften.
 *
 * Das min-width: 0 ist Pflicht in Flex- und Grid-Kindern: ohne es wächst der
 * Container über seinen Elternteil hinaus, statt zu kürzen.
 */
const ARRSTACK_EINZEILIG = `
  .head-meta, .row-title, .row-meta,
  .lbl, .dlg-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
`;

/** Formen, die Karte und Dialog teilen. Der Dialog liegt am
 * `document.body` und hat sein eigenes Shadow-Root — er sieht von den
 * Kartenformen nichts, wenn sie ihm nicht mitgegeben werden. Genau das
 * war am 09.09.2026 der Befund: die Knöpfe im Dialog standen ohne jede
 * Form da, und ihre Beschriftungen waren inline, also ohne Kastenmaß. */
const ARRSTACK_GEMEINSAM = `

  /* Shared UI contract 0.1.0: 44 px medium, one title line and optional status. */
  .head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--arr-space-3);
    margin-bottom: var(--arr-space-4);
  }
  /* M61 (#1331): symbol 44 px, then 12 px to the title like Lightcards and Unraid. */
  .head-title {
    display: flex;
    align-items: center;
    gap: var(--arr-space-3);
    min-width: 0;
    flex: 1 1 auto;
  }
  .head-media {
    width: var(--arr-media);
    height: var(--arr-media);
    flex: 0 0 var(--arr-media);
    display: grid;
    place-items: center;
    border-radius: var(--arr-radius-1);
    background: var(--arr-surface);
    /* M79 (#1320): accent 60 % with the text colour, >= 3:1 on the grey tile (HA blue was 2.09:1). */
    color: color-mix(in srgb, var(--arr-accent) 60%, var(--arr-text));
  }
  .symbol-pair { display: inline-flex; align-items: center; justify-content: center; }
  [hidden] { display: none !important; }
  /* Kartentitel: Stufe 1 aus BuschUI.header (M61). Er darf auf zwei Zeilen
     umbrechen und kürzt danach (ui-regeln Regel 1, Ausnahme E12); der volle
     Titel steht im title-Attribut. */
  .head .title {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .head-side { display: flex; justify-content: flex-end; min-width: 0; max-width: 100%; }
  .head-meta {
    font-size: var(--arr-font-sm);
    color: var(--arr-muted);
    flex: 0 1 auto;
  }
  .head-meta.status-badge { max-width: 100%; }
  .head-meta.busch-chip { color: var(--arr-text); }
  /* Das echte Logo des Dienstes — es sagt auf einen Blick, ob die Karte auf
     Radarr, Sonarr, SABnzbd oder Jellyseerr schaut. */
  .logo { flex: none; border-radius: var(--arr-radius-1); object-fit: contain; }
  /* M79 (#1320): accent 60 % with the text colour, >= 3:1 on the card (HA blue was 2.63:1). */
  .head-title .icon { flex: none; color: color-mix(in srgb, var(--arr-accent) 60%, var(--arr-text)); }

  /* Trennung zuerst über Abstand: Zeilen liegen frei, das Vorschaubild gibt
     den Takt. Eine graue Fläche je Zeile ergab eine Leiter aus Balken — der
     häufigste Grund, warum solche Karten gebastelt aussehen. */
  .rows { display: flex; flex-direction: column; gap: var(--arr-space-3); }
  /* Ein Zeilenraster für alle Listen (M59): links das Poster, rechts eine
     Spalte mit allem Übrigen — Titel, Meta (samt Zeit), Fortschritt, Status,
     Hinweise und Aktionen. So steht kein Poster über seinem Titel und keine
     Zeit als eigene Zeile darunter, auch bei 320 px nicht. */
  .row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    column-gap: var(--arr-space-3);
    border-radius: var(--arr-radius-1);
  }
  .row > .poster { grid-column: 1; }
  .row-main { grid-column: 2; min-width: 0; }
  /* Regel 1, Prüfung 1 misst scrollHeight gegen clientHeight. Ein
     zweizeiliger Klemmkasten (-webkit-line-clamp) meldet dort die volle
     Inhaltshöhe und gilt als Überlauf — Dateinamen aus dem Usenet werden
     deshalb einzeilig gekürzt, nicht auf zwei Zeilen geklemmt. */
  .row-title {
    font-size: var(--arr-font-md);
    color: var(--arr-text);
  }
  .row-meta {
    font-size: var(--arr-font-sm);
    color: var(--arr-muted);
    margin-top: var(--arr-space-1);
  }
  /* Meta mit Zeitpunkt: die Zeit steht am Ende derselben Zeile und kürzt
     zuletzt; davor kürzt die übrige Auskunft. */
  .row-meta.split { display: flex; gap: var(--arr-space-2); }
  .row-meta.split > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row-meta.split > .meta-text { flex: 0 1 auto; }
  .row-meta.split > .meta-time { flex: 0 0 auto; max-width: 100%; margin-inline-start: auto; font-variant-numeric: tabular-nums; }
  .row-main > .status-badge { margin-top: var(--arr-space-2); }
  .row-main > .actions { margin-top: var(--arr-space-2); }

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
  /* M79 (#1320): warning 60 % with the text colour, >= 3:1 on the grey thumb (was 1.56:1). */
  .thumb.warn { color: color-mix(in srgb, var(--warning-color, #ffa600) 60%, var(--arr-text)); }

  .bar {
    height: var(--arr-bar);
    margin-top: var(--arr-space-2);
    border-radius: var(--arr-bar);
    background: var(--arr-surface);
    overflow: hidden;
  }
  /* #1320 (WCAG 1.4.11): the fill is the accent 60 % with the text colour, >= 3:1 on the card and the track
     (HA blue light was 2.63/2.09:1, #1c76be keeps more). */
  .bar > i {
    display: block;
    height: 100%;
    border-radius: var(--arr-bar);
    background: color-mix(in srgb, var(--arr-accent) 60%, var(--arr-text));
    transition: width 0.4s ease;
  }

  /* Knöpfe, Chips und Hinweise sind die Grundbausteine aus Shared UI (M62):
     .busch-btn (secondary, primary, destructive), .busch-chip, .busch-notice.
     Genau eine gefüllte Akzentfläche je Ansicht: der primäre Knopf. Hier steht
     nur, was die Familie dazu festlegt: Schriftstufe, Hover, Abstand. */
  .busch-btn { font-size: var(--arr-font-md); }
  .busch-btn .icon { flex: none; }
  /* M26, E6: the error colour as text reaches only 4.3:1 on a light and 4.0:1
     on a dark card. Mixed with the text colour it gets darker in light and
     lighter in dark (6.1 and 5.1:1 with the HA default themes); the border
     keeps the plain error colour. */
  .busch-btn[data-variant=destructive]:not([data-filled]) {
    color: color-mix(in srgb, var(--error-color, #db4437) 75%, var(--primary-text-color, #212121));
  }
  .busch-btn:is(:not([data-variant]), [data-variant=secondary], [data-variant=destructive]:not([data-filled])):hover:not(:disabled) {
    background: var(--arr-surface);
  }
  .row.result:focus-visible, .search input:focus-visible {
    outline: 2px solid ${BuschUI.tokens.focusColor};
    outline-offset: 2px;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--arr-space-2);
    flex-wrap: wrap;
    flex: 0 1 auto;
    min-width: 0;
  }

  /* Laden, Leer, Fehler: BuschUI.stateBlock (M27), dieselbe Form in allen Kartenfamilien. */
  .busch-state details { align-self: stretch; text-align: start; }

  .busch-notice .notice-heading { font-weight: var(--busch-font-weight-medium, 500); }
  /* Technische Details: Zeile mit 44 px Ziel, Rohtext bricht um statt zu ragen. */
  summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; }
  pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; user-select: text; }
  .busch-notice details { margin-top: var(--arr-space-1); }
  .busch-notice + .rows, .busch-notice + .busch-state, .busch-notice + .queue-table,
  .busch-notice + .busch-notice { margin-top: var(--arr-space-3); }

  /* Status als Chip: Bedeutung über Tönung (data-tone), Text in der Textfarbe. */
  .status-badge { flex: 0 1 auto; }

`;

/** Nur die Karte: ha-card, Kopfzeile und die Container-Query. */
const ARRSTACK_STYLES = BuschUI.cardStyles + ARRSTACK_TOKENS + ARRSTACK_EINZEILIG + ARRSTACK_GEMEINSAM + `
  ha-card { padding: var(--arr-space-4); }

  /* Status und Aktionen stehen unter dem Titel, sobald die Karte eng wird. */
  @container (max-width: 440px) {
    .head { grid-template-columns: minmax(0, 1fr); gap: var(--arr-space-2); }
    .head-side { grid-column: 1; justify-self: start; margin-inline-start: calc(var(--arr-media) + var(--arr-space-3)); }
    .actions { flex: 1 1 100%; width: 100%; }
  }
`;

/** Compact request/import variants preserve the shared dashboard shell. */
const ARRSTACK_COMPACT = `
  /* Staffelauswahl der Seerr-Karte. Sie steht inline, gehört aber
     hierher und nicht in einen Stilblock mitten im Inhalt: ein Stilblock im
     Körper würde bei jedem Nachzeichnen neu geparst. */
  .seasons {
    display: flex;
    flex-wrap: wrap;
    gap: var(--arr-space-2);
    margin-top: var(--arr-space-3);
  }
  /* Staffeln sind Chips (button.busch-chip, 44 px). Gewählte Staffeln sind
     ein Zustand, keine zweite Hauptaktion: getönt statt gefüllt. Gefüllt
     bleibt allein der Anfragen-Knopf. */
  .season { padding: 0 var(--arr-space-3); }
  /* #1320: the tint alone was 1.2:1, so the chosen state also carries a 2 px inset frame in the checkbox mix,
     >= 3:1 against the surface and the tint (light/dark #1c76be 6.34/5.88 on the surface, #03a9f4 4.21/7.88). */
  .season[aria-pressed="true"] {
    background: color-mix(in srgb, var(--arr-accent) 18%, transparent);
    box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--arr-accent) 60%, var(--arr-text));
    font-weight: var(--arr-weight-bold);
  }
  .season[disabled] { cursor: default; opacity: 0.55; }


  .head { margin-bottom: var(--arr-space-3); }
  details summary { color: var(--arr-text); }
  .head-media { width: 44px; height: 44px; }
  .import-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--arr-space-2); margin: var(--arr-space-3) 0; }
  .select-label { display: inline-flex; align-items: center; gap: var(--arr-space-2); min-height: 44px; cursor: pointer; }
  /* M59: every import row shows its selection in the same slot; a row that cannot be
     selected keeps the slot with a disabled box and says why in the title. */
  .select-label[aria-disabled=true] { cursor: default; color: var(--arr-muted); }
  /* #1320: the checked box in the same mix, >= 3:1 on the card (HA blue light was 2.63:1). */
  input[type=checkbox], input[type=radio] { accent-color: color-mix(in srgb, var(--arr-accent) 60%, var(--arr-text)); }
  details:not([open]) > :not(summary) { display: none; }
  .select-label > .dlg-text { display: block; min-width: 0; }
  .candidate + .candidate { margin-top: var(--arr-space-3); }
  details { overflow-wrap: anywhere; min-width: 0; font-size: var(--arr-font-sm); }
  summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; color: var(--arr-muted); }
  @container (max-width: 440px) {
    .head { grid-template-columns: minmax(0,1fr) auto; }
    .head-side { grid-column: auto; margin-inline-start: 0; }
  }
  @media (prefers-reduced-motion: reduce) { .bar > i { transition: none; } }
`;

/* ═══════════════════════════════════════════════════════════════════════════
 * Dialog (Regel 2)
 *
 * Warum ein eigenes Element am `document.body` und keine Ansicht in der Karte:
 * `:host` der Karten trägt `container-type: inline-size`. Das bedeutet
 * `contain: layout` — die Karte wird damit zum enthaltenden Block für jedes
 * `position: fixed` darin und macht einen eigenen Stapelkontext auf. Ein
 * Overlay innerhalb der Karte könnte die Seite also gar nicht überdecken und
 * käme mit keinem `z-index` über eine Leaflet-Karte. Das ist derselbe Weg,
 * den `ha-busch-lightcards` geht.
 *
 * Verlaufseintrag, Fokusfalle und Gerüst kommen aus Shared UI (M28), wie in
 * den übrigen Kartenfamilien: `BuschUI.dialogHistory` legt beim Öffnen genau
 * einen eigenen Eintrag an (dem Dialog-Manager von Home Assistant nachgebaut,
 * `addHistory`), die Zurück-Geste schließt, Schließ-Knopf und Escape nehmen
 * den Eintrag wieder weg, nur wenn er obenauf liegt. `BuschUI.focusTrap` hält
 * Tab im Dialog und gibt den Fokus zurück. Ohne den Eintrag verließe die
 * Zurück-Geste am Handy das ganze Dashboard.
 * ═══════════════════════════════════════════════════════════════════════════ */

const DIALOG_TAG = "arrstack-dialog";

const DIALOG_STYLES = BuschUI.cardStyles + ARRSTACK_TOKENS + ARRSTACK_EINZEILIG + ARRSTACK_GEMEINSAM + ARRSTACK_COMPACT + `
  :host {
    position: fixed;
    inset: 0;
    /* Leaflet vergibt seinen Ebenen 400 und seinen Bedienelementen 1000.
       Ein Dialog auf z-index: 10 verliert gegen jede Landkarte. */
    z-index: 100000;
    container-type: normal;
  }
  .scrim {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
  }
  .sheet {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(560px, calc(100vw - 2 * var(--arr-space-4)));
    max-height: calc(100vh - 4 * var(--arr-space-4));
    display: flex;
    flex-direction: column;
    background: var(--card-background-color, #fff);
    color: var(--arr-text);
    border-radius: var(--arr-radius-2);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }
  /* Bestätigungsdialoge sind schmal (Spec: 320 px). */
  .sheet.schmal { width: min(320px, calc(100vw - 2 * var(--arr-space-4))); }

  .dlg-head {
    display: flex;
    align-items: center;
    gap: var(--arr-space-2);
    padding: var(--arr-space-3) var(--arr-space-4);
    border-bottom: 1px solid var(--arr-line);
    flex: none;
  }
  /* Schließen-X oben links (Design Gallery, Dialogs). */
  .dlg-close { flex: none; width: 44px; height: 44px; justify-content: center; padding: 0; color: var(--arr-muted); }
  /* Titeltypografie aus dem Gerüst (.busch-dialog-title). */

  .dlg-body {
    padding: var(--arr-space-4);
    overflow: auto;
    flex: 1 1 auto;
    font-size: var(--arr-font-md);
  }
  .dlg-text { overflow-wrap: anywhere; color: var(--arr-text); }
  .dlg-sub {
    overflow-wrap: anywhere;
    color: var(--arr-muted);
    font-size: var(--arr-font-sm);
    margin-top: var(--arr-space-2);
  }

  /* Aktionsknöpfe unten rechts; am Handy bleiben sie unten stehen. */
  .dlg-foot {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: var(--arr-space-2);
    padding: var(--arr-space-3) var(--arr-space-4);
    border-top: 1px solid var(--arr-line);
    background: var(--card-background-color, #fff);
    flex: none;
  }
  /* In einer Bestätigung ist die endgültige Aktion die Hauptaktion: sie bleibt
     rechts neben Abbrechen (Regel 2, Aktionen unten rechts). Das Gerüst rückt
     eine destruktive Nebenaktion nach links; die gibt es hier nicht (R24). */
  .dlg-foot [data-variant=destructive] { margin-inline-end: 0; }

  /* Unter 450 px Breite oder 500 px Höhe: Vollbild. */
  @media (max-width: 450px), (max-height: 500px) {
    .sheet, .sheet.schmal {
      left: 0;
      top: 0;
      right: 0;
      bottom: 0;
      transform: none;
      width: auto;
      max-height: none;
      border-radius: 0;
    }
  }
  @media (max-width: 450px), (max-height: 500px) {
    .sheet.kompakt {
      left: var(--arr-space-2); right: var(--arr-space-2);
      top: 50%; bottom: auto; transform: translateY(-50%);
      width: auto; max-height: calc(100dvh - 4 * var(--arr-space-2));
      min-height: 0;
      border-radius: var(--arr-radius-2);
    }
  }

`;

/** Ein Dialog nach der Anatomie aus `docs/ui-regeln.md`, Regel 2.
 *
 * Das Modell ist bewusst schlicht, weil beide Fälle dieser Datei damit
 * auskommen: eine Detailansicht mit einer Hauptaktion und ein
 * Bestätigungsdialog.
 */
class ArrstackDialog extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._model = null;
    this._closed = false;
    this._history = null;
    this._trap = null;
    // Escape closes; Tab and Shift+Tab are BuschUI.focusTrap's.
    this._onKey = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      this.close();
    };
  }

  set model(model) {
    this._model = model;
    if (this.isConnected) this._render();
  }

  connectedCallback() {
    // Before the background turns inert and before the first render: the trap
    // remembers the opener as the focus to return to.
    this._trap = BuschUI.focusTrap(this.shadowRoot);
    this._returnFocus = document.activeElement;
    while (this._returnFocus?.shadowRoot?.activeElement) this._returnFocus = this._returnFocus.shadowRoot.activeElement;
    const originRoot = this._returnFocus?.getRootNode();
    this._returnRoot = originRoot?.host ? originRoot : null;
    const originRow = this._returnFocus?.closest?.('[data-index],[data-item]');
    this._returnSelector = originRow?.dataset.index != null ? `[data-index="${originRow.dataset.index}"]` :
      originRow?.dataset.item != null ? `[data-item="${originRow.dataset.item}"] button` : '.go';
    this._background = [...document.body.children].filter(node => node !== this).map(node => [node, node.inert]);
    this._background.forEach(([node]) => { node.inert = true; });
    document.addEventListener("keydown", this._onKey, true);
    this._guard();
    this._render();
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this._onKey, true);
    this._history?.close();
    this._background?.forEach(([node, inert]) => { node.inert = inert; });
    // The opener may have been re-rendered meanwhile: then its row, else the card.
    const back = !!this._returnFocus?.isConnected;
    this._trap?.release({ returnFocus: back });
    if (!back && this._returnRoot) {
      const target = this._returnRoot.querySelector(this._returnSelector) || this._returnRoot.querySelector('ha-card');
      if (target?.localName === 'ha-card') target.tabIndex = -1;
      target?.focus();
    }
  }

  /** One own history entry. The back gesture closes; a busy or changed dialog keeps itself, a new entry, and asks. */
  _guard() {
    this._history = BuschUI.dialogHistory({
      name: DIALOG_TAG,
      onClose: () => {
        if (this._closed) return;
        if (this._blocked()) { this._guard(); this._confirmDiscard(); return; }
        this._dismiss();
      },
    });
  }

  _blocked() { return this._model?.busy?.() || this._model?.dirty?.(); }

  _confirmDiscard() {
    if (this._model?.busy?.()) return;
    this._discardPrompt = true;
    this._render();
  }

  /** Schließen über Knopf, Escape oder Aktion — ohne verwaisten Eintrag. */
  close(force = false) {
    if (!force && this._blocked()) { this._confirmDiscard(); return; }
    this._dismiss();
  }

  _dismiss() {
    if (this._closed) return;
    this._closed = true;
    this._history?.close();
    if (this._model && this._model.beimSchliessen) this._model.beimSchliessen();
    this.remove();
  }

  /** Von außen aufrufbar, wenn sich der Inhalt geändert hat. */
  aktualisieren() {
    this._render();
  }

  _render() {
    const model = this._model;
    if (!model) return;
    const active = this.shadowRoot.activeElement;
    const focusKey = active?.dataset?.season ?? active?.dataset?.candidate ?? active?.dataset?.akt;
    const aktionen = this._discardPrompt ? [
      {id:"keep",text:model.texte.behalten,art:"quiet"},
      {id:"discard",text:model.texte.verwerfen,art:"primary"}
    ] : model.aktionen || [];
    this.shadowRoot.innerHTML = `<style>${DIALOG_STYLES}</style>
      <div class="scrim"></div>
      <div class="sheet busch-dialog ${model.schmal ? "schmal" : ""} ${model.kompakt ? "kompakt" : ""}"${model.schmal ? ' data-size="confirm"' : ""} role="dialog" aria-modal="true"
        aria-label="${escapeHtml(model.titel)}">
        <div class="dlg-head busch-dialog-head">
          <button class="dlg-close busch-btn busch-dialog-close" aria-label="${escapeHtml(model.schliessen)}"
            title="${escapeHtml(model.schliessen)}">${arrIcon("close", 20)}</button>
          <h2 class="dlg-title busch-dialog-title">${escapeHtml(model.titel)}</h2>
        </div>
        <div class="dlg-body busch-dialog-content">${this._discardPrompt
          ? `<div class="dlg-text">${escapeHtml(model.texte.aenderungen_hinweis)}</div>`
          : model.koerper()}</div>
        ${
          aktionen.length
            ? `<div class="dlg-foot busch-dialog-foot">${aktionen
                .map(
                  (aktion) => `<button ${buttonKind(aktion.art)}
                    data-akt="${escapeHtml(aktion.id)}" ${aktion.aus ? "disabled" : ""}>
                    ${aktion.icon ? arrIcon(aktion.icon) : ""}
                    <span class="lbl">${escapeHtml(aktion.text)}</span>
                  </button>`
                )
                .join("")}</div>`
            : ""
        }
      </div>`;
    // R04: actionable dialogs never dismiss through the backdrop.
    this.shadowRoot.querySelector(".scrim").addEventListener("click", event => event.stopPropagation());
    this.shadowRoot
      .querySelector(".dlg-close")
      .addEventListener("click", () => this.close());
    this.shadowRoot.querySelectorAll(".dlg-foot button").forEach((knopf) => {
      knopf.addEventListener("click", () => {
        const id = knopf.dataset.akt;
        if (id === "keep") { this._discardPrompt = false; this._render(); return; }
        if (id === "discard") { this.close(true); return; }
        if (model.beiAktion) model.beiAktion(id, this);
      });
    });
    if (model.binden && !this._discardPrompt) model.binden(this.shadowRoot, this);
    const candidates = this._trap ? this._trap.items() : [];
    const previous = candidates.find(node => [node.dataset.season,node.dataset.candidate,node.dataset.akt].includes(focusKey));
    (previous || candidates[0])?.focus();
  }
}

/** Dialog öffnen. Rückgabe: das Element, damit der Aufrufer nachziehen kann. */
function oeffneDialog(model) {
  const dialog = document.createElement(DIALOG_TAG);
  dialog.model = model;
  document.body.appendChild(dialog);
  return dialog;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Gemeinsame Basis der vier Karten
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Longest pause between timer fetches after repeated errors (M13, N5.4). */
const ARRSTACK_MAX_BACKOFF_MS = 600000;

/** Time limits for callWS (M34, N9): lists 15 s; import scans and writes 30 s. */
const ARRSTACK_LIST_TIMEOUT_MS = 15000;
const ARRSTACK_SLOW_TIMEOUT_MS = 30000;
/** Writes are never repeated after a time-out; the outcome is unknown, the card reads anew. */
const ARRSTACK_WRITES = new Set(["arrstack/import_item", "arrstack/import_ready", "arrstack/import_selected", "arrstack/queue_remove", "arrstack/request"]);
/** Reads that ask the *arr service for import candidates, one file scan per entry. */
const ARRSTACK_SCANS = new Set(["arrstack/refresh_import_queue", "arrstack/inspect_import"]);

/** Rejects with an error carrying `code` when `promise` has not settled after `ms`. */
function withTimeout(promise, ms, code = "timeout") {
  let timer;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`${code}: no answer after ${ms} ms`), { code })), ms);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

/**
 * Reads shared by every card on the page, keyed by type and instance (M13, P5.2).
 * An entry joins concurrent reads and serves a settled answer for half the
 * caller's tick; write actions drop the entries of their instance.
 */
const ARRSTACK_READS = new Map();

function arrstackForgetReads(instance) {
  for (const key of [...ARRSTACK_READS.keys()]) if (key.endsWith(`|${instance}`)) ARRSTACK_READS.delete(key);
}

/** Was alle vier Karten teilen: Konfiguration, Laden, Fehlertexte, Takt. */
class ArrstackCardBase extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._timer = null;
    this._loading = false;
    this._loadSeq = 0;
    this._failures = 0;
    this._retryAt = 0;
    this._missedTick = false;
    this._error = null;
    this._dialog = null;
    this._onVisibility = () => {
      if (document.hidden || !this._missedTick || !this._timer || this._busy) return;
      this._missedTick = false;
      this._load({ shared: true });
    };
  }

  /** Das Wörterbuch dieser Karte; jede Unterklasse setzt es. */
  static get woerterbuch() {
    return null;
  }

  /** Standardwerte; Unterklassen ergänzen über `_defaults()`. */
  setConfig(config) {
    this._config = { refresh_seconds: 15, ...this._defaults(), ...(config || {}) };
    this._render();
    // Der Takt hängt an der Konfiguration — wird sie im Editor geändert,
    // muss der laufende Timer mit, sonst gilt weiter der alte Wert.
    if (this.isConnected) this._startTimer();
    if (this._hass) this._load({ shared: true });
  }

  _defaults() {
    return {};
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first && this._config) this._load({ shared: true });
  }

  /**
   * Loads the card's data. Each call starts a new generation; only the newest
   * one may set the state, so an older timer read can never overwrite the
   * result of a write action (M13, N4). `shared` (first display, timer,
   * return to the tab) skips while a load runs and may join another card's
   * read; without it (buttons, after a write) a fresh read always starts.
   */
  async _load({ shared = false } = {}) {
    if (shared && this._loading) return;
    const seq = ++this._loadSeq;
    this._loading = true;
    try {
      const data = await this._fetch(shared);
      if (seq !== this._loadSeq) return;
      this._accept(data);
      this._error = null;
      this._lastOk = Date.now();
      this._failures = 0;
      this._retryAt = 0;
    } catch (error) {
      if (seq !== this._loadSeq) return;
      this._error = error;
      this._failures += 1;
      this._retryAt = Date.now() + Math.min(ARRSTACK_MAX_BACKOFF_MS, this._refreshMs() * 2 ** (this._failures - 1));
    } finally {
      if (seq === this._loadSeq) {
        this._loading = false;
        this._loaded = true;
        this._render();
      }
    }
  }

  /** The card's read; `shared` as in `_load`. Cards without a read render only. */
  async _fetch() {
    return null;
  }

  /** Takes over the answer of the newest read. */
  _accept(data) {
    this._data = data;
  }

  /** Makes every running read stale and drops shared reads of this instance; call before a write. */
  _invalidateLoads() {
    this._loadSeq += 1;
    arrstackForgetReads(this._instanceKey());
  }

  _instanceKey(route = null) {
    const instance = route || this._config || {};
    return instance.entry_id ? `entry:${instance.entry_id}` : `service:${instance.service || ""}`;
  }

  _refreshMs() {
    const seconds = Number(this._config && this._config.refresh_seconds);
    return seconds > 0 ? seconds * 1000 : 0;
  }

  /** A list read through ARRSTACK_READS; `shared` false always starts a new request. */
  _read(type, { shared = false } = {}) {
    const key = `${type}|${this._instanceKey()}`;
    const hit = ARRSTACK_READS.get(key);
    if (shared && hit && (hit.pending || Date.now() - hit.at <= this._refreshMs() / 2)) return hit.promise;
    const entry = { pending: true, at: Date.now(), promise: null };
    entry.promise = Promise.resolve(this._call(type)).then(
      (value) => { entry.pending = false; entry.at = Date.now(); return value; },
      (error) => { if (ARRSTACK_READS.get(key) === entry) ARRSTACK_READS.delete(key); throw error; }
    );
    ARRSTACK_READS.set(key, entry);
    return entry.promise;
  }

  /** `de` oder `en` — die Sprache, die der Nutzer in HA eingestellt hat. */
  _sprache() {
    return BuschUI.language(this._hass);
  }

  /** Der nutzersichtbare Teil des Wörterbuchs dieser Karte. */
  _t() {
    const wb = this.constructor.woerterbuch;
    return wb[this._sprache()].texte;
  }

  /** Überschrift: aus der Konfiguration, sonst der Vorgabetitel der Sprache. */
  _titel() {
    const eigen = this._config && this._config.title;
    return eigen != null && eigen !== "" ? eigen : this._t().kartentitel;
  }

  connectedCallback() {
    this._startTimer();
    document.removeEventListener?.("visibilitychange", this._onVisibility);
    document.addEventListener?.("visibilitychange", this._onVisibility);
    if (this._config && this._hass && !this._loaded) this._load({ shared: true });
  }

  disconnectedCallback() {
    this._stopTimer();
    document.removeEventListener?.("visibilitychange", this._onVisibility);
    this._schliesseDialog();
  }

  _startTimer() {
    this._stopTimer();
    const ms = this._refreshMs();
    if (!ms) return;
    this._timer = setInterval(() => this._tick(), ms);
  }

  /** One timer step: nothing in a hidden tab, during a write or inside the error pause (M13). */
  _tick() {
    if (!this._hass || !this._config || this._busy) return;
    if (document.hidden) { this._missedTick = true; return; }
    if (Date.now() < this._retryAt) return;
    this._load({ shared: true });
  }

  _stopTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  /** Genau ein Dialog je Karte; ein zweiter würde den Verlauf verschachteln. */
  _oeffneDialog(model) {
    this._schliesseDialog();
    const eigen = { texte: this._t(), ...model };
    const weiter = model.beimSchliessen;
    eigen.beimSchliessen = () => {
      this._dialog = null;
      if (weiter) weiter();
    };
    this._dialog = oeffneDialog(eigen);
    return this._dialog;
  }

  _schliesseDialog() {
    if (this._dialog) {
      const dialog = this._dialog;
      this._dialog = null;
      dialog.close();
    }
  }

  /** Ein WS-Aufruf mit der in der Karte eingestellten Instanz. */
  _call(type, params = {}, route = null) {
    const message = { type, ...params };
    const instance = route || this._config;
    if (instance.entry_id) message.entry_id = instance.entry_id;
    else if (instance.service) message.service = instance.service;
    const write = ARRSTACK_WRITES.has(type);
    const ms = write || ARRSTACK_SCANS.has(type) ? ARRSTACK_SLOW_TIMEOUT_MS : ARRSTACK_LIST_TIMEOUT_MS;
    return withTimeout(this._hass.callWS(message), ms, write ? "write_timeout" : "timeout");
  }

  /** Fehlercodes der Integration in Sätze, die weiterhelfen. */
  _errorText(error) {
    const t = this._t();
    const code = error && error.code;
    if (code === "not_found") return t.fehler_nicht_gefunden;
    if (code === "ambiguous_instance") return t.fehler_mehrdeutig;
    if (code === "unsupported_service") return t.fehler_nicht_unterstuetzt;
    if (code === "unauthorized") return t.fehler_rechte;
    if (code === "timeout") return t.fehler_zeit;
    if (code === "write_timeout") return t.fehler_zeit_schreiben;
    return (error && error.message) || t.fehler_allgemein;
  }

  /** Known codes get their sentence, anything else the short notice; the raw message stays in the details. */
  _errorHint(error) {
    const known = ["not_found","ambiguous_instance","unsupported_service","unauthorized","timeout","write_timeout"].includes(error?.code);
    return known ? this._errorText(error) : this._t().fehler_kurz;
  }

  /** An error next to content (operation, dialog, draft): a notice, the view stays. */
  _errorMarkup(error, heading) {
    const t = this._t();
    return noticeMarkup("error", `<div class="notice-heading">${escapeHtml(heading || t.fehler_allgemein)}</div>
      <div>${escapeHtml(this._errorHint(error))}</div>
      <details><summary>${escapeHtml(t.details)}</summary><pre>${escapeHtml(error?.message || String(error || ""))}</pre></details>`);
  }

  /**
   * A view state (M27): BuschUI.stateBlock, the shared block of all card families
   * (icon, title, hint, optional action; role=status or role=alert from creation).
   * The block is built as DOM and enters the card markup as outerHTML, like the
   * head. The retry button keeps its class `act-retry`; `_render` binds it.
   * `detail` goes into closed technical details below the block's text.
   */
  _stateMarkup(kind, title, { hint, icon, retry = false, detail } = {}) {
    const t = this._t();
    const action = retry
      ? { node: Object.assign(document.createElement("button"), { className: "act-retry" }), label: t.erneut, text: t.erneut }
      : undefined;
    const node = BuschUI.stateBlock({ kind, title, hint, icon: ARR_STATE_ICONS[icon], action });
    if (detail) {
      const details = document.createElement("details"), summary = document.createElement("summary"), pre = document.createElement("pre");
      summary.textContent = t.details;
      pre.textContent = detail;
      details.append(summary, pre);
      node.appendChild(details);
    }
    return node.outerHTML;
  }

  /** The view failed to load: error block with cause, retry and technical details. */
  _errorState(error, heading) {
    return this._stateMarkup("error", heading || this._t().fehler_allgemein, {
      hint: this._errorHint(error), retry: true, detail: error?.message || String(error || ""),
    });
  }

  /** Leerzustand als Entwurf, nicht als Restfläche. */
  _empty(icon, text) {
    return this._stateMarkup("empty", text, { icon });
  }

  /** Erster Abruf läuft. */
  _loadingState() {
    return this._stateMarkup("loading", this._t().laden);
  }

  /** „Stand vor N Min." once the last successful read is older than two ticks (M34, N9.2). */
  _staleMeta() {
    const tick = this._refreshMs();
    if (!tick || !this._lastOk) return "";
    const age = Date.now() - this._lastOk;
    return age > 2 * tick ? fuelle(this._t().stand_alt, { n: Math.max(1, Math.floor(age / 60000)) }) : "";
  }

  /** Kopfzeile mit Logo, Titel und optionaler Nebenauskunft. */
  _head(icon, meta = "", tone = "") {
    meta = [meta, this._staleMeta()].filter(Boolean).join(" · ");
    const node = document.createElement("div"), lead = document.createElement("div");
    const media = document.createElement("span"), title = document.createElement("span");
    node.className = "head";
    lead.className = "head-title";
    media.className = "head-media";
    // serviceSymbol: fixed markup, the brand is URI-encoded.
    media.innerHTML = serviceSymbol(this._data?.brand || this._data?.service || this._config?.service, icon, 24);
    title.className = "title";
    title.textContent = title.title = this._titel();
    lead.append(media, title);
    node.append(lead);
    if (meta) {
      const side = document.createElement("span");
      side.className = "head-side";
      side.innerHTML = tone ? statusChip(tone, meta, " head-meta") : `<span class="head-meta">${escapeHtml(meta)}</span>`;
      node.append(side);
    }
    // M61: the card title is title step 1 of the family (HA card header size, medium weight).
    return BuschUI.header({ node, titleNode: title, level: 1 }).outerHTML;
  }

  getCardSize() {
    return 4;
  }

  /** Sections-Layout: Spalten in Vielfachen von 3 (Regel 3). */
  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }
}

/** Was in der Zeile als Zustand steht.
 *
 * Der Importzustand schlägt den Download-Status, sobald er vom Normalfall
 * abweicht — „Import blockiert" ist die Auskunft, die zählt, nicht „fertig".
 */
function queueStatusText(item, t) {
  const tracked = ownLabel(t.verfolgt, item.tracked_state);
  if (tracked) return tracked;
  const key = String(item.status || "").toLowerCase();
  return ownLabel(t.zustaende, key) || item.status || "";
}

/** A label table entry for a value from outside; names of Object.prototype are no entry (M19). */
function ownLabel(table, key) {
  return table && Object.hasOwn(table, key) ? table[key] : undefined;
}

/** Gemeinsame Statussemantik 0.1.0; der übersetzte Text bleibt fachlich. */
function queueTone(item) {
  const tracked = String(item.tracked_state || "").toLowerCase();
  const status = String(item.status || "").toLowerCase();
  if (["failed", "failedpending", "importblocked"].includes(tracked) || status === "failed") return BuschUI.statusSemantic("error");
  if (tracked === "importpending" || ["warning", "delay"].includes(status)) return BuschUI.statusSemantic("warning");
  if (status.includes("unavailable")) return BuschUI.statusSemantic("unavailable");
  if (["downloading", "running", "completed"].includes(status) || ["importing", "imported"].includes(tracked)) return BuschUI.statusSemantic("success");
  if (["queued", "paused", "idle"].includes(status)) return BuschUI.statusSemantic("neutral");
  return BuschUI.statusSemantic("unknown");
}

function seerTone(status) {
  const value = String(status || "").toLowerCase();
  if (value === "available") return BuschUI.statusSemantic("success");
  if (value === "partially_available" || value === "processing") return BuschUI.statusSemantic("warning");
  if (value === "blocklisted") return BuschUI.statusSemantic("error");
  if (value === "pending" || value === "deleted") return BuschUI.statusSemantic("neutral");
  return BuschUI.statusSemantic("unknown");
}

/** Status semantics → tone of the shared chip (M62); neutral and unknown stay untinted. */
const ARR_CHIP_TONES = { success: "success", warning: "warning", error: "error", unavailable: "error" };
/** Status symbol per semantics (M59): meaning never by colour alone (R17). */
const ARR_CHIP_ICONS = { success: "check", warning: "alert", error: "circleAlert", unavailable: "unplug", neutral: "clock", unknown: "help" };

/** A status as BuschUI chip: tint carries the meaning, the text keeps the text colour (M62, M26). */
function statusChip(tone, text, extra = "") {
  const chipTone = ARR_CHIP_TONES[tone];
  return `<span class="status-badge busch-chip${extra} ${tone}"${chipTone ? ` data-tone="${chipTone}"` : ""} title="${escapeHtml(text)}">${arrIcon(ARR_CHIP_ICONS[tone] || "help", 14)}<span class="lbl">${escapeHtml(text)}</span></span>`;
}

const ARR_NOTICE_ICONS = { info: "info", warning: "alert", error: "alert" };

/** A message as BuschUI notice (M62). `inner` is markup whose texts are already escaped. */
function noticeMarkup(tone, inner) {
  return `<div class="busch-notice" data-tone="${tone}" role="${tone === "error" ? "alert" : "status"}"><span class="busch-notice-icon">${arrIcon(ARR_NOTICE_ICONS[tone], 20)}</span><div class="busch-notice-text">${inner}</div></div>`;
}

/** Button kind of a dialog or draft action → class and variant of the shared button (M62). */
function buttonKind(art) {
  if (art === "primary") return 'class="busch-btn" data-variant="primary"';
  if (art === "destructive") return 'class="busch-btn" data-variant="destructive" data-filled';
  return 'class="busch-btn" data-variant="secondary"';
}

/** Platzhalter der Form `{n}` füllen. */
function fuelle(vorlage, werte) {
  return String(vorlage || "").replace(/\{(\w+)\}/g, (treffer, name) =>
    Object.prototype.hasOwnProperty.call(werte, name) ? String(werte[name]) : treffer
  );
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
function formatBytes(bytes, t) {
  const value = Number(bytes) || 0;
  const units = t.einheiten;
  if (value <= 0) return `0 ${units[0]}`;
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  const scaled = value / 1024 ** exponent;
  const digits = scaled >= 100 || exponent === 0 ? 0 : 1;
  // Deutsches Zahlenformat: 5,1 GB, nicht 5.1 GB.
  const text = BuschUI.formatNumber(scaled,t.zahlformat, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${text} ${units[exponent]}`;
}

/** `00:12:30` → `12 Min.`; unbekannte Formate bleiben, wie sie sind. */
function formatTimeleft(value, t) {
  if (!value) return "";
  const parts = String(value).split(":").map((part) => Number(part));
  if (parts.length < 2 || parts.some((part) => Number.isNaN(part))) return String(value);
  const [hours, minutes] = parts.length === 3 ? parts : [0, parts[0]];
  if (hours >= 1) {
    return fuelle(t.dauer_std, { h: hours, m: String(minutes).padStart(2, "0") });
  }
  return fuelle(t.dauer_min, { m: minutes });
}

/** Zeitpunkt als „vor 3 Std." — bei älteren Einträgen als Datum. */
function formatSince(value, t) {
  if (!value) return "";
  const then = new Date(value);
  if (Number.isNaN(then.getTime())) return "";
  const seconds = (Date.now() - then.getTime()) / 1000;
  if (seconds < 90) return t.zeit_jetzt;
  if (seconds < 5400) return fuelle(t.zeit_min, { n: Math.round(seconds / 60) });
  if (seconds < 172800) return fuelle(t.zeit_std, { n: Math.round(seconds / 3600) });
  if (seconds < 2592000) return fuelle(t.zeit_tage, { n: Math.round(seconds / 86400) });
  return then.toLocaleDateString(t.zahlformat);
}

/** Poster oder ersatzweise ein Symbol — nie ein kaputtes Bild. */
function posterMarkup(url, brand = null, icon = "film") {
  url=BuschUI.resolveMedia({display_mode:'image',image:url},{},'mdi:movie').image;
  const symbol = serviceSymbol(brand, icon, 24);
  if (!url) {
    return `<div class="poster poster-fallback">${symbol}</div>`;
  }
  // Bei einem fehlenden TMDB-Bild erscheint der gleiche fachliche Platzhalter.
  // bindImageFallbacks reveals it once the markup is in the card.
  return `<img class="poster" src="${escapeHtml(url)}" alt="" loading="lazy"><div class="poster poster-fallback" hidden>${symbol}</div>`;
}

/* ── Editor: eine Instanz auswählen ─────────────────────────────────────── */

/** Lovelace-Konfigurationen sind JSON-Werte; interne und externe Daten trennen. */
function cloneEditorValue(value){return BuschUI.cloneConfig(value);}

function editorValuesEqual(a,b){return BuschUI.configsEqual(a,b);}

/** Gemeinsamer Editor. Die Auswahl kommt aus `arrstack/instances`.
 *
 * Ohne Auswahl bleibt die Karte gültig — die Integration löst dann selbst
 * auf, solange es genau eine passende Instanz gibt.
 *
 * Label und Helper stammen aus dem Wörterbuch der jeweiligen Karte; die
 * Sprache aus `hass.locale.language`.
 */
class ArrstackCardEditor extends BuschUI.EditorBase {
  constructor() {
    super();
    this._instances = null;
    this._services = ["sonarr", "radarr", "sabnzbd", "seerr"];
    this._basisSchema = [];
    this._woerterbuch = null;
    this._echoState = BuschUI.createEchoState();
    // HA-Dashboard-Shortcuts dürfen beim Tippen im Editor nicht mitlaufen.
    // Die Standardaktion (Zeichen eingeben, Auswahl bedienen) bleibt erhalten.
  }

  /** Von den Unterklassen gesetzt: Dienste, Schema und Wörterbuch. */
  static forServices(services, schema, woerterbuch) {
    return class extends ArrstackCardEditor {
      constructor() {
        super();
        this._services = services;
        this._basisSchema = schema;
        this._woerterbuch = woerterbuch;
      }
    };
  }

  setConfig(config) {
    const next = this._normalizeConfig(BuschUI.validateConfig(config || {}).value);
    if (!BuschUI.acceptEcho(this._echoState,next,this._config)) return;
    this._config = next;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._instances) this._loadInstances();
    this._render();
  }

  _sprache() {
    return BuschUI.language(this._hass);
  }

  async _loadInstances() {
    this._instances = [];
    try {
      const result = await this._hass.callWS({ type: "arrstack/instances" });
      this._instances = (result.instances || []).filter((instance) =>
        this._services.includes(instance.service)
      );
    } catch (error) {
      // Null hält einen fehlgeschlagenen Abruf für das nächste hass-Update retrybar.
      this._instances = null;
    }
    this._render();
  }

  _normalizeConfig(config) { return config; }
  _afterFormChange() {}

  /** Das feste Schema der Karte, nur die Auswahllisten werden gefüllt. */
  _schema() {
    // An empty value means "let the integration pick" (M32): name it instead of
    // leaving a blank select; value-changed drops the empty key again.
    const automatisch = { value: "", label: this._woerterbuch[this._sprache()].texte.automatisch };
    const instanzen = [automatisch, ...(this._instances || []).map((instance) => ({
      value: instance.entry_id,
      label: `${instance.title}`,
    }))];
    const dienste = [automatisch, ...this._services.map((service) => ({ value: service, label: service }))];
    return this._basisSchema.map((feld) => {
      if (feld.name === "entry_id") {
        return {
          ...feld,
          selector: { select: { options: instanzen, mode: "dropdown", custom_value: false } },
        };
      }
      if (feld.name === "service") {
        return {
          ...feld,
          selector: { select: { options: dienste, mode: "dropdown", custom_value: false } },
        };
      }
      return feld;
    });
  }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = BuschUI.ha.form();
      this._form.computeLabel = (schema) => {
        return BuschUI.fieldText(this._woerterbuch,this._hass,schema.name).label;
      };
      this._form.computeHelper = (schema) => {
        return BuschUI.fieldText(this._woerterbuch,this._hass,schema.name).helper;
      };
      this._form.addEventListener("value-changed", (event) => {
        event.stopPropagation();
        const raw = event.detail.value || {};
        const next = { ...this._config, ...cloneEditorValue(raw) };
        for (const key of ["entry_id", "service"]) if (next[key] === "") delete next[key];
        this._config = this._normalizeConfig(next);
        BuschUI.queueEcho(this._echoState,this._config);
        // ha-form besitzt den gerade editierten Zustand bereits. Kein
        // data-Reset während einer Tastatureingabe oder beim HA-Echo.
        this._renderedConfig = this._config;
        BuschUI.emitConfigChanged(this,this._config,{echo:false});
        this._afterFormChange(raw);
      });
      const style=document.createElement('style');style.textContent=BuschUI.editorStyles;this.classList?.add('busch-ui-editor');
      this.appendChild(this._form);this.appendChild(style);
    }
    const language = this._sprache();
    if (this._renderedInstances !== this._instances || this._renderedLanguage !== language) {
      this._form.schema = this._schema();
      this._renderedInstances = this._instances;
      this._renderedLanguage = language;
    }
    this._form.hass = this._hass;
    if (this._renderedConfig !== this._config) {
      this._form.data = cloneEditorValue(this._config);
      this._renderedConfig = this._config;
    }
  }
}

/* ── Karte 1: laufende Downloads ────────────────────────────────────────── */

class ArrstackDownloadsEditor extends ArrstackCardEditor {
  constructor() {super();this._services=['sonarr','radarr','sabnzbd'];this._basisSchema=SCHEMA_ARRSTACK_DOWNLOADS_CARD;this._woerterbuch=TEXTE_ARRSTACK_DOWNLOADS_CARD;}
  _normalizeConfig(config) { return {show_posters:true,show_unknown:true,max_items:10,...config,columns:queueColumns(config.columns)}; }
  _schema() {
    return super._schema().map(field=>field.name==='columns' ? {...field,selector:{select:{multiple:true,custom_value:false,mode:'dropdown',options:Object.keys(ARRSTACK_QUEUE_COLUMNS).map(key=>({value:key,label:queueColumnLabel(key,this._sprache())}))}}} : field);
  }
  setConfig(config) {
    const before=this._config;super.setConfig(config);
    // Only a config that reaches the form refills the multi-select; HA's echo does not.
    if (this._config!==before) {this._columnsChosen=true;this._renderOrder();}
  }
  _render() { super._render(); this._renderOrder(); }
  /** ha-form keeps an emptied multi-select empty while the card falls back to its default columns. */
  _afterFormChange(raw) {
    this._columnsChosen=Array.isArray(raw.columns) && raw.columns.some(key=>Object.hasOwn(ARRSTACK_QUEUE_COLUMNS,key));
    this._renderOrder();
  }
  _moveColumn(key,direction) {
    const columns=queueColumns(this._config.columns),index=columns.indexOf(key),next=index+direction;
    if (index<0 || next<0 || next>=columns.length) return;
    [columns[index],columns[next]]=[columns[next],columns[index]];
    this._config={...this._config,columns}; BuschUI.queueEcho(this._echoState,this._config);
    this._form.data=cloneEditorValue(this._config); this._renderedConfig=this._config;
    BuschUI.emitConfigChanged(this,this._config,{echo:false});this._renderOrder();
    const controls=this._order?.querySelectorAll?.('button') || [];
    const target=Array.from(controls).find(button=>button.dataset.column===key && Number(button.dataset.move)===direction && !button.disabled) || Array.from(controls).find(button=>button.dataset.column===key && !button.disabled);
    target?.focus();
  }
  _renderOrder() {
    if (!this._form || !this._config) return;
    if (!this._order) {
      this._order=document.createElement('details');this._order.className='queue-column-order';this.appendChild(this._order);
      this._orderHint=document.createElement('p');this._orderHint.className='queue-order-hint';this.appendChild(this._orderHint);
    }
    const chosen=this._columnsChosen!==false;
    this._order.hidden=!chosen;this._orderHint.hidden=chosen;
    const renderKey=JSON.stringify([queueColumns(this._config.columns),this._sprache(),chosen]);
    if(this._orderKey===renderKey) return;
    this._orderKey=renderKey;
    let active=document.activeElement;
    while(active?.shadowRoot?.activeElement) active=active.shadowRoot.activeElement;
    const focus=this._order.querySelectorAll?.('button') ? Array.from(this._order.querySelectorAll('button')).find(button=>button===active) : null;
    const key=focus?.dataset.column,move=focus?.dataset.move;
    const columns=queueColumns(this._config.columns),t=this._woerterbuch[this._sprache()].texte;
    const order=columns.map(key=>queueColumnLabel(key,this._sprache())).join(' · ');
    this._orderHint.textContent=t.spalten_keine.replace('{spalten}',order);
    this._order.innerHTML=`<summary><span>${escapeHtml(t.spaltenreihenfolge)}</span><small class="queue-order-summary">${escapeHtml(order)}</small></summary><div role="status" aria-live="polite" class="queue-order-status">${escapeHtml(order)}</div>${columns.map((key,index)=>`<div class="queue-order-row"><span>${escapeHtml(queueColumnLabel(key,this._sprache()))}</span><button type="button" class="busch-btn" data-variant="secondary" data-column="${key}" data-move="-1" aria-label="${escapeHtml(`${queueColumnLabel(key,this._sprache())} ${t.nach_oben}`)}" ${index===0 ? 'disabled' : ''}>${escapeHtml(t.hoch)}</button><button type="button" class="busch-btn" data-variant="secondary" data-column="${key}" data-move="1" aria-label="${escapeHtml(`${queueColumnLabel(key,this._sprache())} ${t.nach_unten}`)}" ${index===columns.length-1 ? 'disabled' : ''}>${escapeHtml(t.runter)}</button></div>`).join('')}`;
    this._order.querySelectorAll?.('button').forEach(button=>button.addEventListener('click',()=>this._moveColumn(button.dataset.column,Number(button.dataset.move))));
    if (key) Array.from(this._order.querySelectorAll('button')).find(button=>button.dataset.column===key && button.dataset.move===move)?.focus();
    if (!this._orderStyle) {this._orderStyle=document.createElement('style');this._orderStyle.textContent=`.queue-column-order{margin-top:var(--ha-space-6,24px);color:var(--primary-text-color)}.queue-column-order summary{cursor:pointer;min-height:44px;display:flex;flex-direction:column;justify-content:center;min-width:0}.queue-order-summary,.queue-order-hint{font-size:${BuschUI.tokens.fontSizeS};color:var(--secondary-text-color);overflow-wrap:anywhere}.queue-column-order[open] .queue-order-summary{display:none}.queue-order-hint{margin:var(--ha-space-6,24px) 0 0}.queue-order-status{font-size:${BuschUI.tokens.fontSizeS};overflow-wrap:anywhere;margin-bottom:var(--ha-space-2,8px)}.queue-order-row{display:flex;align-items:center;gap:var(--ha-space-2,8px)}.queue-order-row span{flex:1;min-width:0;overflow-wrap:anywhere}`;this.appendChild(this._orderStyle);}
  }
}

/** Gemeinsamer Einzelimport-Controller: Queue und Reparatur verwenden denselben Dialog/API-Vertrag. */
class ArrstackImportCardBase extends ArrstackCardBase {
  constructor() {
    super();
    this._open = null;
    this._busy = null;
    this._message = null;
    this._itemErrors = new Map();
    this._operationError = null;
  }

  _t() {
    return {...TEXTE_ARRSTACK_FIX_CARD[this._sprache()].texte,...super._t()};
  }

  _importErrorMarkup(error,heading) {
    const details=error?.details;
    return noticeMarkup("error", `<div class="notice-heading">${escapeHtml(heading || this._t().import_fehler)}</div><div>${escapeHtml(error?.message || this._t().fehler_kurz)}</div>${details ? `<details><summary>${escapeHtml(this._t().details)}</summary><pre>${escapeHtml(typeof details==='string' ? details : JSON.stringify(details,null,2))}</pre></details>` : ''}`);
  }

  _stateLabel(item) {
    const t=this._t();
    return ownLabel({ready:t.eine_datei,no_match:t.keine_datei,selection_required:t.auswahl_noetig,error:t.import_status},item.import_state) || queueStatusText(item,t);
  }

  _id(item) { return Number(item.queue_item_id ?? item.id); }
  _ready(item) {
    return item.download_complete === true && Number(item.progress) >= 100 &&
      item.import_state === "ready" && item.candidate_count === 1;
  }
  _relevant(item) { return item.download_complete === true && Number(item.progress) >= 100 && item.import_state !== "not_applicable"; }

  async _check(queueItemId) {
    if (this._busy || this._open?.loading || this._dialog?.isConnected || !queueItemId) return;
    const route = this._config.entry_id ? {entry_id:this._config.entry_id} : {service:this._config.service || this._data?.service};
    this._open = {queue_item_id:queueItemId,loading:true,candidate_id:null,route};
    const t = this._t();
    const dialog = this._oeffneDialog({
      titel:t.dialog_pruefen,schliessen:t.schliessen,kompakt:true,
      dirty:()=>!!this._open?.candidate_id,busy:()=>!!this._busy,
      koerper:()=>this._dialogKoerper(),aktionen:this._dialogAktionen(),
      binden:(root,dlg)=>root.querySelectorAll(".candidate-radio").forEach(input=>input.addEventListener("change",()=>{
        this._open.candidate_id = input.dataset.candidate;
        dlg.model = {...dlg._model,aktionen:this._dialogAktionen()};
      })),
      beiAktion:(id,dlg)=>{ if(id==="import") this._import(queueItemId,this._open?.candidate_id,dlg); else dlg.close(); },
      beimSchliessen:()=>{this._open=null;}
    });
    try {
      const result = await this._call("arrstack/inspect_import",{queue_item_id:queueItemId},route);
      if (!dialog.isConnected) return;
      this._open = {...result,queue_item_id:queueItemId,loading:false,candidate_id:null,route};
    } catch (error) {
      if (!dialog.isConnected) return;
      this._open = {queue_item_id:queueItemId,loading:false,fehler:error,route};
    }
    dialog.model = {...dialog._model,aktionen:this._dialogAktionen()};
  }

  _dialogKoerper() {
    const info = this._open, t = this._t();
    if (!info) return "";
    if (info.loading) return this._stateMarkup("loading", t.pruefe);

    const candidates = info.candidates || [];
    return `${info.fehler ? (info.fehler.fachlich ? this._importErrorMarkup(info.fehler,t.import_fehler) : this._errorMarkup(info.fehler,t.import_fehler)) : ""}<div class="dlg-text">${escapeHtml(info.parent_title || info.title || "")}</div>
      <div class="dlg-sub">${escapeHtml(this._stateLabel(info))}</div>
      ${info.last_error && info.last_error!==info.fehler?.message ? this._importErrorMarkup({message:info.last_error,details:info.last_error_details},t.import_status) : ""}
      ${candidates.length ? candidates.map(candidate=>`<div class="candidate">
        <label class="select-label">
          <input class="candidate-radio" type="radio" name="candidate" data-candidate="${escapeHtml(candidate.candidate_id)}" ${info.candidate_id===candidate.candidate_id ? "checked" : ""} ${!candidate.valid || this._busy ? "disabled" : ""}>
          <span class="dlg-text">${escapeHtml(candidate.filename || candidate.name || "")}</span>
        </label>
        <div class="dlg-sub">${escapeHtml([formatBytes(candidate.size,t),candidate.quality,...(candidate.languages||[]),candidate.release_group,...(candidate.custom_formats||[])].filter(Boolean).join(" · "))}</div>
        ${!candidate.valid ? `<div class="dlg-sub">${escapeHtml(t.datei_ungueltig)}</div>` : ""}
        <details><summary>${escapeHtml(t.details)}</summary><div class="dlg-text">${escapeHtml(candidate.path || "")}</div><div class="dlg-sub">${escapeHtml((candidate.rejections||[]).join(" · "))}</div></details>
      </div>`).join("") : `<div class="dlg-sub">${escapeHtml(t.keine_datei)}</div>`}`;
  }

  _dialogAktionen() {
    const info = this._open || {}, t = this._t();
    const candidate = (info.candidates || []).find(candidate=>candidate.candidate_id===info.candidate_id && candidate.valid);
    return [{id:"cancel",text:t.abbrechen,art:"quiet",aus:!!this._busy},
      {id:"import",text:t.importieren,art:"primary",icon:"check",aus:!!this._busy || (!this._ready(info) && !(this._relevant(info) && candidate))}];
  }

  async _mutate(type,params={},dialog=null) {
    if (this._busy) return;
    this._busy = type; this._message = null; this._operationError = null;
    this._invalidateLoads();
    this._render();
    if (dialog) { if (this._open) this._open.fehler=null; dialog.model = {...dialog._model,aktionen:this._dialogAktionen()}; }
    let closeAfterRefresh = false;
    try {
      const result = await this._call(type,params,dialog ? this._open?.route : null);
      const results = result.results || [result];
      if (dialog && this._open && result.status === "skipped") {
        const selected = this._open.candidate_id;
        this._open = {...this._open,...result,candidate_id:null,fehler:null};
        if (result.candidates?.some(candidate=>candidate.valid && candidate.candidate_id===selected)) this._open.candidate_id=selected;
      }
      const submitted = results.filter(item=>item.status==="submitted").length;
      const skipped = results.filter(item=>item.status==="skipped" && !item.last_error).length;
      const errors = results.filter(item=>item.status==="error" || (item.status==="skipped" && item.last_error));
      if (dialog && errors.length && this._open) this._open.fehler={message:errors[0].last_error,details:errors[0].last_error_details,fachlich:true};
      results.forEach(item=>{if(item.status==="error" || (item.status==="skipped" && item.last_error))this._itemErrors.set(Number(item.queue_item_id),{message:item.last_error,details:item.last_error_details});else this._itemErrors.delete(Number(item.queue_item_id));});
      this._message = [submitted ? fuelle(this._t().uebermittelt,{n:submitted}) : "",skipped ? fuelle(this._t().uebersprungen,{n:skipped}) : "",errors.length ? fuelle(this._t().teilfehler,{n:errors.length}) : ""].filter(Boolean).join(" ");
      closeAfterRefresh = !!(dialog && !errors.length && submitted);
    } catch(error) {
      if (dialog && this._open) this._open.fehler = error;
      else this._operationError = error;
    } finally {
      await this._load();
      this._busy = null;
      this._render();
      if (dialog?.isConnected) {
        if (closeAfterRefresh) dialog.close(true);
        else dialog.model = {...dialog._model,aktionen:this._dialogAktionen()};
      }
    }
  }
  _import(queueItemId,candidateId,dialog) { return this._mutate("arrstack/import_item",{queue_item_id:queueItemId,...(candidateId ? {candidate_id:candidateId} : {})},dialog); }

}

/** Aktualisiert das Queue-Markup, ohne stabile Zeilen und Controls auszutauschen. */
function patchQueueChildren(target, source) {
  const wanted = [...source.childNodes];
  let index = 0;
  for (const next of wanted) {
    let current = target.childNodes[index];
    const key = next.nodeType === 1 ? next.getAttribute("data-item") : null;
    const matches = node => node && node.nodeType === next.nodeType &&
      (node.nodeType !== 1 || (node.localName === next.localName &&
        ((node.getAttribute("data-item") || null) === key) &&
        ((node.id || null) === (next.id || null)) &&
        ((node.classList[0] || null) === (next.classList[0] || null))));
    if (!matches(current)) {
      const later = [...target.childNodes].slice(index).find(node => matches(node));
      if (later) {
        target.insertBefore(later, current || null);
        current = later;
      } else {
        current = next.cloneNode(true);
        target.insertBefore(current, target.childNodes[index] || null);
      }
    }
    if (current.nodeType === 3 || current.nodeType === 8) {
      if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
    } else if (current.nodeType === 1) {
      const detailsOpen = current.localName === "details" && current.open;
      for (const attribute of [...current.attributes]) {
        if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
      }
      for (const attribute of [...next.attributes]) {
        if (current.getAttribute(attribute.name) !== attribute.value) {
          current.setAttribute(attribute.name, attribute.value);
        }
      }
      if (current.localName === "input" && ["checkbox", "radio"].includes(current.type)) {
        current.checked = next.checked;
      }
      if (current.localName === "details") current.open = next.open || detailsOpen;
      patchQueueChildren(current, next);
    }
    index += 1;
  }
  while (target.childNodes.length > index) target.lastChild.remove();
}

function patchQueueMarkup(root, markup) {
  const focused = root.activeElement;
  const template = document.createElement("template");
  template.innerHTML = markup;
  patchQueueChildren(root, template.content);
  bindImageFallbacks(root);
  // Moving a keyed row can blur its active descendant even though the node is
  // still connected. Restore only when focus fell back to an ancestor of this
  // card; a dialog or another control outside the card must keep its focus.
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  let hostAncestor = root.host;
  let focusStayedOnHostChain = false;
  while (hostAncestor) {
    if (hostAncestor === active) {
      focusStayedOnHostChain = true;
      break;
    }
    hostAncestor = hostAncestor.parentNode;
    if (hostAncestor instanceof ShadowRoot) hostAncestor = hostAncestor.host;
  }
  if (focused?.isConnected && root.activeElement === null && focusStayedOnHostChain) {
    focused.focus({preventScroll:true});
  }
}

const ARRSTACK_DOWNLOADS_STYLES = `
  .queue-table { --queue-columns:minmax(0,1fr); --queue-poster: var(--arr-poster-w); --queue-action: 44px; }
  .queue-grid { display:grid; grid-template-columns:var(--queue-columns); align-items:center; gap:var(--arr-space-3); min-width:0; }
  .queue-header { color:var(--arr-muted); font-size:var(--arr-font-sm); padding-bottom:var(--arr-space-2); border-bottom:1px solid var(--arr-line); }
  .queue-row { padding-block:var(--arr-space-3); }
  .queue-row + .queue-row { border-top:1px solid var(--arr-line); }
  .queue-fields { display:contents; }
  .queue-cell { min-width:0; font-size:var(--arr-font-sm); }
  .queue-value { display:block; min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
  .queue-label { display:none; color:var(--arr-muted); }
  .queue-cell[data-column=title] .queue-value { font-size:var(--arr-font-md); color:var(--arr-text); }
  .queue-progress { font-variant-numeric:tabular-nums; }
  .queue-progress .bar { width:100%; }
  .queue-action { align-self:start; }
  .queue-action button { width:var(--queue-action); min-width:var(--queue-action); height:var(--queue-action); padding:0; justify-content:center; color:var(--arr-text); }
  .queue-reasons { grid-column:1 / -1; margin:0; }
  .queue-reasons .busch-notice + .busch-notice, .queue-reasons .busch-notice + .queue-message { margin-top:var(--arr-space-2); }
  .queue-reasons p { margin:0; overflow-wrap:anywhere; color:var(--arr-muted); font-size:var(--arr-font-sm); }
  .queue-message summary { min-height:44px;display:flex;align-items:center;gap:var(--arr-space-2);cursor:pointer;color:var(--arr-muted);font-size:var(--arr-font-sm); }
  .queue-message summary:focus-visible { outline:2px solid ${BuschUI.tokens.focusColor};outline-offset:2px; }
  .queue-message[open] summary { color:var(--arr-text); }
  .queue-pages { display:flex; align-items:center; justify-content:space-between; gap:var(--arr-space-2); margin-top:var(--arr-space-3); }
  .queue-page-label { font-size:var(--arr-font-sm); color:var(--arr-muted); min-width:0; text-align:center; }
  .queue-table.expanded .queue-header { display:none; }
  .queue-table.expanded .queue-row { grid-template-columns:var(--queue-poster) minmax(0,1fr) var(--queue-action); align-items:start; }
  .queue-table.expanded .queue-cell { grid-column:2 / -1; display:grid; grid-template-columns:minmax(0,1fr) minmax(0,2fr); gap:var(--arr-space-2); }
  .queue-table.expanded .queue-label { display:block; }
  .queue-table.expanded .queue-cell[data-column=title] { grid-column:2; display:block; }
  .queue-table.expanded .queue-cell[data-column=title] .queue-label { display:none; }
  .queue-table.expanded .queue-poster { grid-column:1; grid-row:1 / span 2; }
  .queue-table.expanded .queue-action { grid-column:3; grid-row:1; }
  .queue-table.expanded .queue-value { white-space:normal; overflow-wrap:anywhere; }
  .queue-table.expanded .queue-cell[data-column=title] .queue-value { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }
  @container (max-width: 620px) {
    .queue-header { display:none; }
    .queue-row { grid-template-columns:var(--queue-poster) minmax(0,1fr) var(--queue-action); align-items:start; }
    .queue-cell { grid-column:2 / -1; display:grid; grid-template-columns:minmax(0,1fr) minmax(0,2fr); gap:var(--arr-space-2); }
    .queue-label { display:block; }
    .queue-cell[data-column=title] { grid-column:2; display:block; }
    .queue-cell[data-column=title] .queue-label { display:none; }
    .queue-poster { grid-column:1; grid-row:1 / span 2; }
    .queue-action { grid-column:3; grid-row:1; }
    .queue-value { white-space:normal; overflow-wrap:anywhere; }
    .queue-cell[data-column=title] .queue-value { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }
    .queue-reasons { grid-column:2 / -1; }
    /* M59: the fields stay in the content column; the action column keeps the check button alone.
       Row gap 4 px: with the 28 px chip the row stays compact (< 180 px, compact-contract). */
    .queue-table:not(.expanded) .queue-fields { display:flex;flex-wrap:wrap;align-items:center;gap:var(--arr-space-1) var(--arr-space-2);grid-column:2;grid-row:1;min-width:0; }
    .queue-table:not(.expanded) .queue-cell { display:flex;align-items:center;gap:var(--arr-space-1);flex:0 1 auto;max-width:100%; }
    .queue-table:not(.expanded) .queue-cell[data-column=title] { flex:1 1 100%;min-height:var(--queue-action); }
    .queue-table:not(.expanded) .queue-cell[data-column=progress] { flex:1 1 100%; }
    .queue-table:not(.expanded) .queue-cell[data-column=status] .queue-label,
    .queue-table:not(.expanded) .queue-cell[data-column=progress] .queue-label { display:none; }
    .queue-table:not(.expanded) .queue-cell .queue-value { white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0; }
    .queue-table:not(.expanded) .queue-progress { display:flex;align-items:center;gap:var(--arr-space-2);width:100%; }
    .queue-table:not(.expanded) .queue-progress .bar { flex:1;min-width:0;margin-top:0; }
  }
`;

/** Was gerade lädt — Sonarr, Radarr oder SABnzbd, eine Instanz je Karte. */
class ArrstackDownloadsCard extends ArrstackImportCardBase {
  static get woerterbuch() {
    return TEXTE_ARRSTACK_DOWNLOADS_CARD;
  }

  static getConfigElement() {
    return document.createElement("arrstack-downloads-card-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:arrstack-downloads-card",
      refresh_seconds: 15,
      max_items: 10,
      show_posters: true,
      show_unknown: true,
      columns: [...ARRSTACK_QUEUE_DEFAULT_COLUMNS],
    };
  }

  _defaults() {
    return { max_items: 10, show_posters: true, show_unknown: true };
  }

  _fetch(shared) {
    return this._read("arrstack/queue", { shared });
  }

  _render() {
    if (!this._config) return;
    const active = this.shadowRoot.activeElement;
    const focusedItem = active?.classList.contains('act-check') ? active.closest('[data-item]')?.dataset.item : null;
    patchQueueMarkup(this.shadowRoot, `<style>${ARRSTACK_STYLES}${ARRSTACK_DOWNLOADS_STYLES}</style>
      <ha-card>
        ${this._head("download", this._headMeta())}
        ${this._message ? noticeMarkup("info", escapeHtml(this._message)) : ""}
        ${this._operationError ? this._errorMarkup(this._operationError,this._t().import_fehler) : ""}
        ${this._body()}
      </ha-card>`);
    const retry = this.shadowRoot.querySelector(".act-retry");
    if (retry) retry.onclick = () => this._load();
    this.shadowRoot.querySelectorAll(".act-check").forEach(button=>button.onclick=()=>this._check(Number(button.closest('[data-item]').dataset.item)));
    this.shadowRoot.querySelectorAll('[data-page]').forEach(button=>button.onclick=()=>{
      const direction=Number(button.dataset.page); this._page=(this._page||0)+direction;
      this._render(); this.shadowRoot.querySelector(`[data-page="${direction}"]:not([disabled])`)?.focus();
    });
    if (focusedItem && !this._dialog?.isConnected) requestAnimationFrame(()=>{
      if (!this.isConnected || this._dialog?.isConnected) return;
      let current = document.activeElement;
      while (current?.shadowRoot?.activeElement) current = current.shadowRoot.activeElement;
      if (current?.isConnected && ![document.body,document.documentElement,this,this.getRootNode().host].includes(current)) return;
      const button = this.shadowRoot.querySelector(`[data-item="${focusedItem}"] .act-check:not([disabled])`);
      const target = button || this.shadowRoot.querySelector('ha-card');
      if (target && !button) target.tabIndex = -1;
      target?.focus();
    });
  }

  _headMeta() {
    if (this._error || !this._data) return "";
    const t = this._t();
    const speed = this._data.speed ? `${formatBytes(this._data.speed, t)}/s` : "";
    const total = this._data.total ?? (this._data.items || []).length;
    return speed ? `${total} · ${speed}` : `${total}`;
  }

  _columns() { return queueColumns(this._config.columns); }

  _body() {
    const t = this._t();
    if (this._error) return this._errorState(this._error,t.fehler_allgemein);
    if (!this._data) return this._loadingState();
    const items=(this._data.items || []).filter(item=>this._config.show_unknown!==false || !item.unknown);
    if (!items.length) return this._empty("download",t.leer);
    const pageSize=Math.max(1,Math.min(200,Number(this._config.max_items)||10));
    const pages=Math.ceil(items.length/pageSize);
    this._page=Math.max(0,Math.min(pages-1,this._page||0));
    const columns=this._columns();
    const widths=columns.map(key=>key==='title' ? 'minmax(0,3fr)' : 'minmax(0,1fr)');
    if (this._config.show_posters) widths.unshift('var(--queue-poster)');
    widths.push('var(--queue-action)');
    const pageLabel=fuelle(t.seite,{n:this._page+1,total:pages});
    return `<div role="table" aria-label="${escapeHtml(t.kartentitel)}" class="queue-table${columns.length>6 ? ' expanded' : ''}${this._config.show_posters ? '' : ' no-posters'}" style="--queue-columns:${widths.join(' ')};${this._config.show_posters ? '' : '--queue-poster:0px;'}">
      <div class="queue-grid queue-header" role="row">${this._config.show_posters ? `<span role="columnheader" aria-label="${escapeHtml(t.poster)}"></span>` : ''}${columns.map(key=>`<span role="columnheader" class="queue-cell" data-column="${key}">${escapeHtml(queueColumnLabel(key,this._sprache()))}</span>`).join('')}<span role="columnheader" aria-label="${escapeHtml(t.aktionen)}"></span></div>
      ${items.slice(this._page*pageSize,(this._page+1)*pageSize).map(item=>this._row(item)).join('')}</div>
      ${pages>1 ? `<div class="queue-pages"><button class="busch-btn" data-variant="secondary" data-page="-1" ${this._page===0 || this._busy ? 'disabled' : ''}>${escapeHtml(t.vorherige)}</button><span class="queue-page-label" role="status">${escapeHtml(pageLabel)} · ${items.length}</span><button class="busch-btn" data-variant="secondary" data-page="1" ${this._page===pages-1 || this._busy ? 'disabled' : ''}>${escapeHtml(t.naechste)}</button></div>` : ''}`;
  }

  _canInspect(item) {
    const service = this._data?.service || this._config?.service;
    // Nur die Sichtbarkeit der Prüfaktion; fachliche Bereitschaft entscheidet frisch der Server.
    return ["sonarr","radarr"].includes(service) && Number.isInteger(this._id(item)) && this._id(item)>0 &&
      String(item.status).toLowerCase()==="completed" && item.sizeleft != null && Number(item.sizeleft)===0 &&
      Number(item.progress)>=100 && item.is_problem === true;
  }

  _row(item) {
    const t=this._t(),title=item.parent_title || item.title || '';
    const progress=Math.max(0,Math.min(100,Number(item.progress ?? item.percentage)||0));
    const leftBytes=item.sizeleft!=null ? Number(item.sizeleft) : Number(item.mbleft||0)*1024*1024;
    const values={...item,title,release_title:item.title,timeleft:formatTimeleft(item.timeleft,t) || (leftBytes>0 ? formatBytes(leftBytes,t) : ''),size:item.size!=null ? formatBytes(item.size,t) : ''};
    const cells=this._columns().map(key=>{
      let value=values[key];
      if (Array.isArray(value)) value=value.join(' · ');
      let markup;
      if (key==='status') markup=statusChip(queueTone(item),queueStatusText(item,t) || '—');
      else if (key==='progress') markup=`<div class="queue-progress"><span>${Math.round(progress)} %</span><div class="bar" role="progressbar" aria-label="${escapeHtml(queueColumnLabel(key,this._sprache()))}" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><i style="width:${progress}%"></i></div></div>`;
      else markup=`<span class="queue-value" title="${escapeHtml(value ?? '')}">${escapeHtml(value==null || value==='' ? '—' : value)}</span>`;
      // M58: no aria-label on a cell, it would replace the value; the column header names it.
      return `<div role="cell" class="queue-cell" data-column="${key}"><span class="queue-label">${escapeHtml(queueColumnLabel(key,this._sprache()))}</span>${markup}</div>`;
    }).join('');
    const problem=this._itemErrors.get(this._id(item));
    const reasons=(item.messages || []).filter(message=>typeof message==='string' && message.trim());
    return `<div role="row" class="queue-grid queue-row" data-item="${this._id(item)}">
      ${this._config.show_posters ? `<div role="cell" class="queue-poster">${posterMarkup(item.poster,this._data?.brand,'download')}</div>` : ''}
      <div class="queue-fields">${cells}</div>
      <div role="cell" class="queue-action">${this._canInspect(item) ? `<button class="act-check busch-btn" title="${escapeHtml(t.dialog_pruefen)}" aria-label="${escapeHtml(`${t.dialog_pruefen}: ${title}`)}" ${this._busy ? 'disabled' : ''}>${arrIcon('search')}</button>` : ''}</div>
      ${problem || reasons.length ? `<div role="cell" class="queue-reasons">${problem ? this._importErrorMarkup(problem,t.import_fehler) : ''}${reasons.length ? `<details class="queue-message"><summary>${arrIcon("alert")}<span>${escapeHtml(t.import_hinweise)} (${reasons.length})</span></summary>${reasons.map(reason=>`<p>${escapeHtml(reason)}</p>`).join('')}</details>` : ''}</div>` : ''}
    </div>`;
  }

}

/* ── Karte 2: zuletzt hinzugefügt ───────────────────────────────────────── */

/** Was zuletzt in der Bibliothek gelandet ist (Sonarr oder Radarr). */
class ArrstackRecentCard extends ArrstackCardBase {
  static get woerterbuch() {
    return TEXTE_ARRSTACK_RECENT_CARD;
  }

  static getConfigElement() {
    return document.createElement("arrstack-recent-card-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:arrstack-recent-card",
      refresh_seconds: 120,
      max_items: 8,
    };
  }

  _defaults() {
    return { max_items: 8, refresh_seconds: 120 };
  }

  _fetch(shared) {
    return this._read("arrstack/recent", { shared });
  }

  _render() {
    if (!this._config) return;
    const markup = `<style>${ARRSTACK_STYLES}</style>
      <ha-card>
        ${this._head("download")}
        ${this._body()}
      </ha-card>`;
    // Same markup as last time: keep the DOM, posters and focus (M13, P5.3).
    if (markup === this._markup) return;
    this._markup = markup;
    // sink-ok: constant styles plus _head()/_body() markup, which escape every text field (tests/xss.test.js)
    this.shadowRoot.innerHTML = markup;
    bindImageFallbacks(this.shadowRoot);
    this.shadowRoot.querySelector(".act-retry")?.addEventListener("click",()=>this._load());
  }

  _body() {
    const t = this._t();
    if (this._error) {
      return this._errorState(this._error,t.fehler_allgemein);
    }
    if (!this._data) return this._loadingState();
    const items = (this._data.items || []).slice(0, Number(this._config.max_items) || 8);
    if (!items.length) {
      return this._empty("film", t.leer);
    }
    return `<div class="rows">${items
      .map(
        (item) => `<div class="row">
          ${posterMarkup(item.poster, this._data && this._data.brand)}
          <div class="row-main">
            <div class="row-title">${escapeHtml(item.title || "")}</div>
            <div class="row-meta split"><span class="meta-text">${escapeHtml(
              [item.subtitle, item.quality].filter(Boolean).join(" · ")
            )}</span><span class="meta-time">${escapeHtml(formatSince(item.added, t))}</span></div>
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
 *
 * Beide Ansichten sind Dialoge (Regel 2): das Prüfergebnis, weil es die Karte
 * sonst überlagern würde, und die Rückfrage vor dem Löschen, weil dabei
 * heruntergeladene Dateien verschwinden.
 */
class ArrstackFixCard extends ArrstackImportCardBase {
  static get woerterbuch() { return TEXTE_ARRSTACK_FIX_CARD; }
  static getConfigElement() { return document.createElement("arrstack-fix-card-editor"); }
  static getStubConfig() { return { type: "custom:arrstack-fix-card", refresh_seconds: 60, max_items: 5 }; }
  _defaults() { return { refresh_seconds: 60, max_items: 5 }; }

  _titel() {
    if (this._config?.title) return this._config.title;
    const service = this._data?.service || this._config?.service;
    const name = service === "radarr" ? "Radarr" : service === "sonarr" ? "Sonarr" : "";
    return name ? `${name} · ${this._t().kartentitel}` : this._t().kartentitel;
  }

  constructor() {
    super();
    this._selected = new Set();
    this._lastSelected = null;
    this._page = 0;
  }

  /**
   * The import scan (`refresh_import_queue`) asks the *arr service for import
   * candidates of every problem entry, a file scan each (N5). It runs on first
   * display, on the refresh/retry buttons, after a write and for a new finished
   * problem entry; timer ticks only read the cheap queue and keep the last
   * inspection of each entry. `arrstack/queue` has no page parameter and holds
   * the first page only (200 entries, `total` counts all); while it is cut off,
   * the tick scans, since only the scan reads every page.
   */
  async _fetch(shared) {
    if (!shared || !this._inspected) return { scan: await this._read("arrstack/refresh_import_queue", { shared }) };
    const queue = await this._read("arrstack/queue", { shared });
    const items = queue.items || [];
    if (Number(queue.total) > items.length || items.some(item => this._newProblem(item))) return { scan: await this._read("arrstack/refresh_import_queue", { shared }) };
    return { queue };
  }

  _accept({ scan, queue }) {
    if (scan) {
      this._inspected = new Map((scan.items || []).map(item => [this._id(item), item]));
      this._data = scan;
    } else {
      this._data = { ...this._data, service: queue.service || this._data?.service, brand: queue.brand, items: (queue.items || []).map(item => this._fromQueue(item)) };
    }
    const readyIds = new Set((this._data.items || []).filter(item => this._ready(item)).map(item => this._id(item)));
    this._selected = new Set([...this._selected].filter(id => readyIds.has(id)));
  }

  _queueProblem(item) {
    return String(item.status).toLowerCase() === "completed" && item.sizeleft != null && Number(item.sizeleft) === 0 && item.is_problem === true;
  }

  /** A finished problem entry the last scan has not inspected. */
  _newProblem(item) {
    if (!this._queueProblem(item)) return false;
    const known = this._inspected.get(this._id(item));
    return !known || known.import_state === "not_applicable";
  }

  /** A queue entry in the shape of the scan: inspection kept for problems, `not_applicable` otherwise (as the integration does). */
  _fromQueue(item) {
    const id = this._id(item), complete = String(item.status).toLowerCase() === "completed" && item.sizeleft != null && Number(item.sizeleft) === 0;
    const known = this._inspected.get(id);
    if (known && this._queueProblem(item)) return { ...known, ...item, queue_item_id: id, download_complete: true };
    return { ...item, queue_item_id: id, download_complete: complete, import_state: "not_applicable", candidate_count: null, candidates: [], last_error: null };
  }

  _render() {
    if (!this._config) return;
    const t = this._t();
    const items = this._data?.items || [];
    const ready = items.filter(item => this._ready(item));
    const pageSize = Math.max(1,Number(this._config.max_items)||5);
    const pages = Math.max(1,Math.ceil(items.length/pageSize));
    this._page = Math.min(this._page,pages-1);
    const visible = items.slice(this._page*pageSize,(this._page+1)*pageSize);
    patchQueueMarkup(this.shadowRoot, `<style>${ARRSTACK_STYLES}${ARRSTACK_COMPACT}</style><ha-card>
      ${this._head("download", items.length ? fuelle(t.offen, {n:items.length}) : "", "warning")}
      ${this._message ? noticeMarkup("info", escapeHtml(this._message)) : ""}
      ${this._operationError ? this._errorMarkup(this._operationError,t.import_fehler) : ""}
      ${this._body(visible)}
      ${pages > 1 ? `<div class="import-toolbar">
        <button class="act-prev busch-btn" data-variant="secondary" ${this._page===0 ? "disabled" : ""}>${escapeHtml(t.vorherige)}</button>
        <span class="busch-chip"><span class="lbl">${escapeHtml(fuelle(t.seite,{n:this._page+1,total:pages}))}</span></span>
        <button class="act-next busch-btn" data-variant="secondary" ${this._page===pages-1 ? "disabled" : ""}>${escapeHtml(t.naechste)}</button>
      </div>` : ""}
      ${items.length ? `<div class="import-toolbar">
        <button class="act-bulk busch-btn" data-variant="secondary" ${this._busy || !ready.length ? "disabled" : ""}><span class="lbl">${escapeHtml(t.bulk)}</span></button>
        <button class="act-refresh busch-btn" data-variant="secondary" ${this._loading || this._busy ? "disabled" : ""}>${escapeHtml(t.neu_laden)}</button>
        ${this._selected.size ? `<span class="busch-chip"><span class="lbl">${escapeHtml(fuelle(t.ausgewaehlt,{n:this._selected.size}))}</span></span><button class="act-selected busch-btn" data-variant="secondary" ${this._busy ? "disabled" : ""}>${escapeHtml(t.auswahl_importieren)}</button>` : ""}
      </div>` : ""}</ha-card>`);
    this._bind();
  }

  _body(items) {
    if (this._error) return this._errorState(this._error, this._t().import_status);
    if (!this._data) return this._loadingState();
    if (!items.length) return this._empty("check", this._t().leer);
    return `<div class="rows">${items.map(item => this._row(item)).join("")}</div>`;
  }

  _row(item) {
    const t = this._t(), id = this._id(item), complete = this._relevant(item), ready = this._ready(item);
    const status = complete ? this._stateLabel(item) : queueStatusText(item,t);
    const problem = this._itemErrors.get(id) || (complete && item.last_error ? {message:item.last_error} : null);
    return `<div class="row import-row" data-item="${id}">
      ${posterMarkup(item.poster || item.image)}
      <div class="row-main">
        <div class="row-title">${escapeHtml(item.parent_title || item.title || "")}</div>
        <div class="row-meta">${escapeHtml(item.episode || item.title || "")}</div>
        <div class="bar" role="progressbar" aria-valuenow="${Math.max(0,Math.min(100,Number(item.progress)||0))}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(t.fortschritt || t.kartentitel)}"><i style="width:${Math.max(0,Math.min(100,Number(item.progress)||0))}%"></i></div>
        ${statusChip(complete ? (ready ? "success" : "warning") : queueTone(item), `${Math.round(Number(item.progress)||0)} % · ${status}`)}
        ${problem ? this._importErrorMarkup(problem,t.import_fehler) : ""}
        <div class="actions">
          <label class="select-label"${ready ? "" : ` aria-disabled="true" title="${escapeHtml(t.auswahl_nicht_bereit)}"`}><input type="checkbox" class="item-select" aria-label="${escapeHtml(`${t.auswaehlen}: ${item.parent_title || item.title}`)}" ${ready && this._selected.has(id) ? "checked" : ""} ${this._busy || !ready ? "disabled" : ""}><span class="lbl">${escapeHtml(t.auswaehlen)}</span></label>
          ${ready ? `<button class="act-import busch-btn" data-variant="secondary" ${this._busy ? "disabled" : ""}>${escapeHtml(t.importieren)}</button>` : ""}
          ${complete ? `<button class="act-check busch-btn" data-variant="secondary" ${this._busy ? "disabled" : ""}>${escapeHtml(item.import_state === "selection_required" ? t.auswahl_datei : t.pruefen)}</button>` : ""}
          <button class="act-delete busch-btn" data-variant="destructive" ${this._busy ? "disabled" : ""}>${escapeHtml(t.loeschen)}</button>
        </div>
      </div>
    </div>`;
  }

  _bind() {
    const bind = (selector,callback) => { const node=this.shadowRoot.querySelector(selector); if(node) node.onclick=callback; };
    bind(".act-retry",()=>this._load());
    bind(".act-refresh",()=>this._load());
    bind(".act-prev",()=>{this._page=Math.max(0,this._page-1);this._render();this.shadowRoot.querySelector('.act-prev')?.focus();});
    bind(".act-next",()=>{this._page+=1;this._render();this.shadowRoot.querySelector('.act-next')?.focus();});
    bind(".act-bulk",()=>this._importReady());
    bind(".act-selected",()=>this._importSelected());
    this.shadowRoot.querySelectorAll(".row.import-row").forEach(row => {
      const id = Number(row.dataset.item), item = this._data.items.find(item => this._id(item) === id);
      const importButton=row.querySelector(".act-import");
      if(importButton) importButton.onclick=()=>this._import(id);
      const checkButton=row.querySelector(".act-check");
      if(checkButton) checkButton.onclick=()=>this._check(id);
      const deleteButton=row.querySelector(".act-delete");
      if(deleteButton) deleteButton.onclick=()=>this._fragLoeschen(id,item.parent_title || item.title);
      const toggle = event => {
        if (this._busy || !this._ready(item)) return;
        const checked = !this._selected.has(id);
        const ids = this._data.items.filter(item=>this._ready(item)).map(item=>this._id(item));
        const range = event.shiftKey && this._lastSelected != null ? ids.slice(Math.min(ids.indexOf(id),ids.indexOf(this._lastSelected)),Math.max(ids.indexOf(id),ids.indexOf(this._lastSelected))+1) : [id];
        range.forEach(key => checked ? this._selected.add(key) : this._selected.delete(key));
        this._lastSelected = id;
        this._render();
        this.shadowRoot.querySelector(`.row[data-item="${id}"] input`)?.focus();
      };
      const checkbox=row.querySelector(".item-select");
      if(checkbox) checkbox.onclick=toggle;
      row.onclick=event=>{ if ((event.ctrlKey || event.metaKey || event.shiftKey) && !event.target.closest("button,input,label")) toggle(event); };
    });
  }

  _fragLoeschen(itemId,titel) {
    if (!itemId || this._busy) return;
    const t = this._t();
    this._oeffneDialog({titel:t.dialog_loeschen,schliessen:t.schliessen,schmal:true,
      koerper:()=>`<div class="dlg-text">${escapeHtml(t.loeschen_frage)}</div><div class="dlg-sub">${escapeHtml(titel)}</div>`,
      aktionen:[{id:"cancel",text:t.abbrechen,art:"quiet"},{id:"delete",text:t.loeschen,art:"destructive",icon:"trash"}],
      beiAktion:(id,dlg)=>{dlg.close();if(id==="delete")this._delete(itemId);}});
  }

  _importReady() { return this._mutate("arrstack/import_ready"); }
  _importSelected() {
    const ids=(this._data?.items || []).filter(item=>this._ready(item) && this._selected.has(this._id(item))).map(item=>this._id(item));
    if (ids.length) return this._mutate("arrstack/import_selected",{queue_item_ids:ids});
  }
  async _delete(itemId) {
    if (this._busy) return;
    this._busy = itemId; this._invalidateLoads(); this._render();
    try { await this._call("arrstack/queue_remove",{item_id:itemId,remove_from_client:true,blocklist:false}); this._message=this._t().geloescht; }
    catch(error) { this._operationError=error; }
    finally { this._busy=null; await this._load(); }
  }
}

/* ── Karte 4: Serie oder Film anfragen (Jellyseerr/Seerr) ───────────────── */

/** Suchen, Staffeln wählen, anfragen — ohne die Seerr-Oberfläche zu öffnen.
 *
 * Die Detailansicht war bis 09.09.2026 eine Inline-Ansicht mit einem
 * „Zurück"-Knopf. Die Zurück-Taste des Browsers verließ dort das Dashboard,
 * Escape tat nichts. Jetzt ist sie ein Dialog mit eigenem Verlaufseintrag.
 */
class ArrstackSeerCard extends ArrstackCardBase {
  static get woerterbuch() {
    return TEXTE_ARRSTACK_SEER_CARD;
  }

  static getConfigElement() {
    return document.createElement("arrstack-seer-card-editor");
  }

  static getStubConfig() {
    return { type: "custom:arrstack-seer-card", refresh_seconds: 0, max_items: 8 };
  }

  _defaults() {
    // Diese Karte lädt auf Zuruf, nicht im Takt — sonst würde jede Suche
    // nach ein paar Sekunden von selbst verschwinden.
    return { refresh_seconds: 0, max_items: 8 };
  }

  constructor() {
    super();
    this._query = "";
    this._results = null;
    this._show = null;
    this._selected = new Set();
    this._message = null;
    this._busy = false;
    this._searching = false;
    this._opening = false;
    this._initialSelection = "";
    this._requestError = null;
  }

  /** Die Suche wird ausgelöst, nicht gepollt. */
  _load() {
    this._loaded = true;
    this._render();
  }

  _render() {
    if (!this._config) return;
    const t = this._t();
    const active = this.shadowRoot.activeElement;
    const focusSelector = active?.dataset.season ? `.season[data-season="${active.dataset.season}"]` : active?.dataset.inlineAction ? `[data-inline-action="${active.dataset.inlineAction}"]` : null;
    this.shadowRoot.innerHTML = `<style>${ARRSTACK_STYLES}${ARRSTACK_COMPACT}
      .search { display: flex; gap: var(--arr-space-2); margin-bottom: var(--arr-space-4); }
      .search input {
        flex: 1 1 auto;
        min-width: 0;
        min-height: 44px;
        font: inherit;
        font-size: var(--arr-font-md);
        color: var(--arr-text);
        padding: var(--arr-space-2) var(--arr-space-3);
        border: none;
        border-radius: var(--arr-radius-1);
        background: var(--arr-surface);
      }
      /* Chromium's native clear glyph is white on this field in the light theme (M26 image
         review H): drawn here in the secondary text colour, 3:1 against --arr-surface. */
      .search input::-webkit-search-cancel-button {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        margin-inline-start: var(--arr-space-2);
        cursor: pointer;
        background-color: var(--arr-muted);
        -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='M18 6 6 18M6 6l12 12'/%3E%3C/svg%3E") center / contain no-repeat;
        mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='M18 6 6 18M6 6l12 12'/%3E%3C/svg%3E") center / contain no-repeat;
      }
      .search .go { flex: 0 0 44px; width: 44px; display: inline-flex; align-items: center; justify-content: center; padding: 0; }
      .row.result { cursor: pointer; min-height: 66px; }
      .request-inline { padding: var(--arr-space-3); background: var(--arr-surface); }
      .inline-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--arr-space-2); margin-top: var(--arr-space-3); }
      </style>
      <ha-card>
        ${this._head("jellyfish", this._searching ? t.laden : this._results?.length ? fuelle(t.treffer,{n:this._results.length}) : t.bereit, "neutral")}
        <div class="search">
          <input type="search" placeholder="${escapeHtml(t.platzhalter)}"
            value="${escapeHtml(this._query)}" aria-label="${escapeHtml(t.suchbegriff)}" ${this._show ? "disabled" : ""}>
          <button class="go busch-ui-action" data-variant="icon-only" aria-label="${escapeHtml(t.suchen)}"
            title="${escapeHtml(t.suchen)}" ${this._searching || this._opening || this._show ? "disabled" : ""}>${arrIcon("search")}</button>
        </div>
        ${this._message ? noticeMarkup("info", escapeHtml(this._message)) : ""}
        ${this._body()}
      </ha-card>`;
    bindImageFallbacks(this.shadowRoot);
    this._bind();
    if (focusSelector) setTimeout(()=>this.shadowRoot.querySelector(focusSelector)?.focus(),0);
  }

  _body() {
    const t = this._t();
    if (this._error) {
      return this._errorState(this._error, t.fehler_suche);
    }
    if (this._searching || this._opening) return this._loadingState();
    if (this._results === null) {
      return this._empty("search", t.leer);
    }
    if (!this._results.length) {
      return this._empty("search", t.nichts_gefunden);
    }
    return `<div class="rows">${this._results
      .slice(0, Number(this._config.max_items) || 8)
      .map(
        (item, index) => `<div class="row result" data-index="${index}" role="button" tabindex="0"
          aria-label="${escapeHtml(item.title || "")}">
          ${posterMarkup(item.poster)}
          <div class="row-main">
            <div class="row-title">${escapeHtml(item.title || "")}</div>
            <div class="row-meta">${escapeHtml(
              [
                item.media_type === "tv" ? t.serie : t.film,
                (item.date || "").slice(0, 4),
              ]
                .filter(Boolean)
                .join(" · ")
            )}</div>
            ${statusChip(seerTone(item.status), statusLabel(item.status, t))}
          </div>
        </div>${this._show?.id === item.id && this._show?.media_type === item.media_type ? this._inlineMarkup() : ""}`
      )
      .join("")}</div>`;
  }

  /** Inline-Inhalt: Titel und Poster stehen bereits im zugehörigen Treffer. */
  _dialogKoerper() {
    const t = this._t();
    const show = this._show;
    if (!show) return "";
    const seasons = (show.seasons || []).filter(season => Number.isInteger(season.season) && Number(season.episodes) > 0);
    const chips = seasons
      .map((season) => {
        const available = season.status_code === 5;
        const pressed = this._selected.has(season.season);
        const label =
          season.season === 0 ? t.specials : fuelle(t.staffel, { n: season.season });
        return `<button class="season busch-chip" data-season="${season.season}"
          aria-pressed="${pressed}" ${available || this._busy ? "disabled" : ""}
          title="${escapeHtml(available ? fuelle(t.staffel_da, { name: label }) : label)}">
          <span class="lbl">${escapeHtml(label)}</span>${available ? arrIcon("check", 14) : ""}
        </button>`;
      })
      .join("");
    return `${this._requestError ? this._errorMarkup(this._requestError, t.fehler_allgemein) : ""}
      ${seasons.length ? `<div class="seasons">${chips}</div>` : ""}`;
  }

  _dialogAktionen() {
    const t = this._t();
    return [
      { id: "cancel", text: t.abbrechen, art: "quiet", aus: this._busy },
      { id: "request", text: t.anfragen, art: "primary", icon: "download", aus: this._busy || (this._show?.media_type === "tv" && !this._selected.size) || this._show?.status === "available" },
    ];
  }

  /** Kompakte Auswahl im Ergebnis: kein Overlay oder zusätzlicher Historyeintrag. */
  _oeffneDetail() {
    this._initialSelection = [...this._selected].sort((a,b)=>a-b).join(",");
    this._discardInline = false;
    this._render();
    setTimeout(()=>this.shadowRoot.querySelector(".request-inline button:not([disabled])")?.focus(),0);
  }

  _closeInline(force = false) {
    if (this._busy && !force) return;
    if (!force && [...this._selected].sort((a,b)=>a-b).join(",") !== this._initialSelection) {
      this._discardInline = true;
      this._render();
      setTimeout(()=>this.shadowRoot.querySelector('[data-inline-action="keep"]')?.focus(),0);
      return;
    }
    const id = this._show?.id, mediaType = this._show?.media_type;
    this._show = null;
    this._discardInline = false;
    this._render();
    const index = this._results?.findIndex(item=>item.id === id && item.media_type === mediaType);
    setTimeout(()=>this.shadowRoot.querySelector(`.result[data-index="${index}"]`)?.focus(),0);
  }

  _inlineMarkup() {
    const t = this._t();
    if (this._discardInline) return `<section class="request-inline" aria-label="${escapeHtml(t.aenderungen)}">
      ${noticeMarkup("info", escapeHtml(t.aenderungen_hinweis))}
      <div class="inline-actions"><button ${buttonKind("quiet")} data-inline-action="keep">${escapeHtml(t.behalten)}</button>
      <button ${buttonKind("primary")} data-inline-action="discard">${escapeHtml(t.verwerfen)}</button></div></section>`;
    return `<section class="request-inline" aria-label="${escapeHtml(t.dialog_anfragen)}">
      ${this._dialogKoerper()}<div class="inline-actions">${this._dialogAktionen().map(action=>
        `<button ${buttonKind(action.art)} data-inline-action="${action.id}" ${action.aus ? "disabled" : ""}>${escapeHtml(action.text)}</button>`).join("")}</div></section>`;
  }

  _bind() {
    this.shadowRoot.querySelector(".request-inline")?.addEventListener("keydown",event=>{
      if (event.key === "Escape") {event.preventDefault();event.stopPropagation();this._closeInline();}
    });
    this.shadowRoot.querySelectorAll(".season").forEach(chip=>chip.addEventListener("click",()=>{
      const season=Number(chip.dataset.season);
      if (this._selected.has(season)) this._selected.delete(season); else this._selected.add(season);
      this._render();setTimeout(()=>this.shadowRoot.querySelector(`.season[data-season="${season}"]`)?.focus(),0);
    }));
    this.shadowRoot.querySelectorAll("[data-inline-action]").forEach(button=>button.addEventListener("click",()=>{
      const action=button.dataset.inlineAction;
      if (action === "request") this._request();
      else if (action === "keep") {this._discardInline=false;this._render();setTimeout(()=>this.shadowRoot.querySelector(".season:not([disabled]), [data-inline-action=request]")?.focus(),0);}
      else this._closeInline(action === "discard");
    }));
    const input = this.shadowRoot.querySelector("input");
    if (input) {
      input.addEventListener("input",()=>{this._query=input.value;});
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") this._search(input.value);
      });
    }
    this.shadowRoot.querySelector(".act-retry")?.addEventListener("click",()=>this._search(this._query));
    const go = this.shadowRoot.querySelector(".go");
    if (go) BuschUI.action({node:go,label:go.getAttribute("aria-label")||go.title||go.textContent,variant:"icon-only",onClick:() => this._search(input && input.value)});
    this.shadowRoot.querySelectorAll(".result").forEach((row) => {
      const open = () => this._openResult(this._results[Number(row.dataset.index)]);
      row.addEventListener("click", open);
      row.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        open();
      });
    });
  }

  async _search(query) {
    if (this._searching || this._opening || this._show) return;
    this._query = String(query || "").trim();
    if (!this._query) return;
    this._message = null; this._error = null;
    this._searching = true; this._render();
    try {
      const result = await this._call("arrstack/search", {query:this._query});
      this._results = result.results || [];
    } catch(error) { this._error=error; }
    finally {
      this._searching=false; this._render();
      this.shadowRoot.querySelector("input")?.focus();
    }
  }

  async _openResult(item) {
    if (!item || this._opening || this._busy) return;
    if (this._show) { this._closeInline(); return; }
    this._requestError = null;
    this._message = null;
    if (item.media_type === "movie") {
      this._show = { ...item, seasons: [] };
      this._selected = new Set();
      this._oeffneDetail();
      return;
    }
    this._opening = true;
    try {
      const show = await this._call("arrstack/tv_seasons", { tmdb_id: item.id });
      // Fehlende Staffeln vorbelegt, vorhandene nicht — der häufigste Wunsch
      // ist „alles, was noch fehlt".
      this._selected = new Set(
        (show.seasons || [])
          .filter((season) => season.status_code !== 5 && season.season !== 0 && Number(season.episodes) > 0)
          .map((season) => season.season)
      );
      this._show = { ...show, media_type: "tv", id: item.id };
      this._opening = false;
      this._error = null;
      this._oeffneDetail();
      return;
    } catch (error) {
      this._error = error;
    } finally { this._opening = false; }
    this._render();
  }

  async _request(dialog = null) {
    if (!dialog) {
      const card = this;
      dialog = {get isConnected(){return !!card._show;},get _model(){return {};},set model(value){card._render();},close(){card._closeInline(true);}};
    }
    const t = this._t(), show = this._show;
    if (!show || this._busy) return;
    const seasons=[...this._selected].sort((a,b)=>a-b);
    if (show.media_type === "tv" && !seasons.length) return;
    this._busy=true; this._requestError=null;
    dialog.model={...dialog._model,aktionen:this._dialogAktionen()};
    try {
      const result=await this._call("arrstack/request",{media_type:show.media_type,media_id:show.id,...(show.media_type === "tv" ? {seasons} : {})});
      this._message=fuelle(t.angefragt,{n:result.request_id});
      const resultItem=this._results?.find(item=>item.id===show.id && item.media_type===show.media_type);
      if (resultItem) resultItem.status="pending";
      dialog.close(true);
    } catch(error) { this._requestError=error; }
    finally {
      this._busy=false;
      if (dialog.isConnected) dialog.model={...dialog._model,aktionen:this._dialogAktionen()};
      this._render();
    }
  }

}

/** Statuszahlen von Seerr in Worte (Enum aus Jellyseerr/Seerr). */
function statusLabel(status, t) {
  return ownLabel(t.seer_status, status) || t.seer_status.unknown;
}

/* ── Anmeldung ──────────────────────────────────────────────────────────── */

/* Registrierung doppelt-ladefest (M42): wird die Datei ein zweites Mal geladen
   (zweite Ressourcen-URL, Cache-Parameter), behält BuschUI.register die erste
   Klasse, wirft kein NotSupportedError und trägt jede Karte nur einmal in
   `window.customCards` ein. Der Eintrag entsteht beim Laden der Datei — `hass`
   gibt es da noch nicht; Name und Beschreibung richten sich deshalb nach
   `navigator.language`. */
BuschUI.register(DIALOG_TAG, ArrstackDialog);

BuschUI.register("arrstack-downloads-card", ArrstackDownloadsCard, {
  type: "arrstack-downloads-card",
  name: TEXTE_ARRSTACK_DOWNLOADS_CARD[BROWSER_SPRACHE].name,
  description: TEXTE_ARRSTACK_DOWNLOADS_CARD[BROWSER_SPRACHE].description,
  preview: false,
  documentationURL: DOCS_URL,
});
BuschUI.register("arrstack-recent-card", ArrstackRecentCard, {
  type: "arrstack-recent-card",
  name: TEXTE_ARRSTACK_RECENT_CARD[BROWSER_SPRACHE].name,
  description: TEXTE_ARRSTACK_RECENT_CARD[BROWSER_SPRACHE].description,
  preview: false,
  documentationURL: DOCS_URL,
});
BuschUI.register("arrstack-fix-card", ArrstackFixCard, {
  type: "arrstack-fix-card",
  name: TEXTE_ARRSTACK_FIX_CARD[BROWSER_SPRACHE].name,
  description: TEXTE_ARRSTACK_FIX_CARD[BROWSER_SPRACHE].description,
  preview: false,
  documentationURL: DOCS_URL,
});
BuschUI.register("arrstack-seer-card", ArrstackSeerCard, {
  type: "arrstack-seer-card",
  name: TEXTE_ARRSTACK_SEER_CARD[BROWSER_SPRACHE].name,
  description: TEXTE_ARRSTACK_SEER_CARD[BROWSER_SPRACHE].description,
  preview: false,
  documentationURL: DOCS_URL,
});

BuschUI.register("arrstack-downloads-card-editor", ArrstackDownloadsEditor);
BuschUI.register("arrstack-recent-card-editor",
  ArrstackCardEditor.forServices(["sonarr", "radarr"], SCHEMA_ARRSTACK_RECENT_CARD, TEXTE_ARRSTACK_RECENT_CARD));
BuschUI.register("arrstack-fix-card-editor",
  ArrstackCardEditor.forServices(["sonarr", "radarr"], SCHEMA_ARRSTACK_FIX_CARD, TEXTE_ARRSTACK_FIX_CARD));
BuschUI.register("arrstack-seer-card-editor",
  ArrstackCardEditor.forServices(["seerr"], SCHEMA_ARRSTACK_SEER_CARD, TEXTE_ARRSTACK_SEER_CARD));
