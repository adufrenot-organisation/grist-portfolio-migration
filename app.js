
const $ = id => document.getElementById(id);
function esc(value){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
let _bannerTimer=null;
function msg(text){
  const b=$("banner");
  if(!b){ console.log(text); return; }
  b.textContent=text;
  b.classList.remove("hidden");
  clearTimeout(_bannerTimer);
  _bannerTimer=setTimeout(()=>b.classList.add("hidden"),3500);
}

// -----------------------------------------------------------------------------
// IMPORT / EXPORT — Mapping Produit
// -----------------------------------------------------------------------------
const MAPPING_STORAGE_KEY="grist-migration:mapping-produit:v1";
let mappingState=null;
let mappingSelectedSource=null;
let mappingPendingSource=null;
let mappingExtraTargets=[];
let mappingDragPoint=null;
// Schéma complet de la table cible Fonctionnalites. Cette liste est indépendante
// des liaisons actives : délier un champ JSON ne doit jamais masquer une colonne Grist.
const MAPPING_TARGET_SCHEMA=[
  {id:"Parent",type:"Ref:Projects",reference:{table:"Projects",lookup_column:"nom"}},
  {id:"Stade",type:"Ref:Stades_Fonctionnalite",reference:{table:"Stades_Fonctionnalite",lookup_column:"Nom"}},
  {id:"Nom",type:"Numeric"},
  {id:"Code",type:"Text"},
  {id:"Priorite",type:"Choice"},
  {id:"Description",type:"Any"},
  {id:"Progression",type:"Numeric"},
  {id:"Date_Cible",type:"Date"},
  {id:"Responsable",type:"Ref:Team",reference:{table:"Team",lookup_column:"nom"}},
  {id:"Actif",type:"Bool"},
  {id:"Date_Debut",type:"Date"},
  {id:"Date_Fin",type:"Date"}
];

function mappingClone(v){return JSON.parse(JSON.stringify(v))}
function mappingEsc(v){return esc(v??"")}
function mappingAllEntries(){
  if(!mappingState)return[];
  const out=[];
  Object.entries(mappingState.fields||{}).forEach(([key,cfg])=>out.push({section:"fields",key,cfg}));
  Object.entries(mappingState.source_fields_without_current_grist_target||{}).forEach(([key,cfg])=>out.push({section:"unmapped",key,cfg}));
  return out;
}
function mappingEntryByJson(jsonField){return mappingAllEntries().find(x=>x.cfg?.json_field===jsonField)||null}
function mappingTargetMeta(){
  const map=new Map();
  // Toujours commencer par le schéma complet de la table cible.
  MAPPING_TARGET_SCHEMA.forEach(c=>map.set(c.id,{type:c.type||"",reference:c.reference||null}));
  // Les métadonnées du mapping peuvent enrichir le schéma, mais ne déterminent
  // jamais si une colonne est visible ou non.
  mappingAllEntries().forEach(({cfg})=>{
    if(!cfg?.target_column)return;
    const base=map.get(cfg.target_column)||{type:"",reference:null};
    map.set(cfg.target_column,{type:cfg.target_type||base.type||"",reference:cfg.reference||base.reference||null});
  });
  mappingExtraTargets.forEach(x=>{if(!map.has(x))map.set(x,{type:"",reference:null})});
  return map;
}
function mappingSourceRows(){
  return mappingAllEntries().sort((a,b)=>String(a.cfg.json_field||a.key).localeCompare(String(b.cfg.json_field||b.key),'fr'));
}
function mappingSave(){
  if(!mappingState)return;
  localStorage.setItem(MAPPING_STORAGE_KEY,JSON.stringify(mappingState));
  mappingSyncRaw();
}
async function loadDefaultMapping(){
  const saved=localStorage.getItem(MAPPING_STORAGE_KEY);
  if(saved){try{mappingState=JSON.parse(saved);return}catch(e){console.warn(e)}}
  const r=await fetch('mapping-produit.json?v=1.0.0',{cache:'no-store'});
  if(!r.ok)throw new Error('mapping-produit.json introuvable');
  mappingState=await r.json();
  mappingSave();
}
function mappingSyncRaw(){
  const el=$("mappingRawJson");
  if(el&&mappingState)el.value=JSON.stringify(mappingState,null,2);
}
function mappingStatsData(){
  const all=mappingAllEntries(), mapped=all.filter(x=>x.cfg.target_column), refs=all.filter(x=>String(x.cfg.target_type||'').startsWith('Ref:'));
  return {all:all.length,mapped:mapped.length,unmapped:all.length-mapped.length,refs:refs.length};
}
function renderMappingStats(){
  if(!mappingState)return;
  const s=mappingStatsData();
  $("mappingStats").innerHTML=`<div class="kpi"><b>${s.all}</b><small>Champs à identifier</small></div><div class="kpi"><b>${s.mapped}</b><small>Champs mappés</small></div><div class="kpi"><b>${s.unmapped}</b><small>Non mappés</small></div><div class="kpi"><b>${s.refs}</b><small>Références Ref</small></div>`;
}
function mappingBadge(cfg){
  if(!cfg.target_column)return '<span class="mapping-badge warning">Non mappé</span>';
  if(String(cfg.target_type||'').startsWith('Ref:'))return '<span class="mapping-badge ref">Ref</span>';
  return `<span class="mapping-badge">${mappingEsc(cfg.target_type||'champ')}</span>`;
}
function renderMapping(){
  if(!mappingState){loadDefaultMapping().then(renderMapping).catch(e=>msg('Erreur mapping : '+e.message));return}
  const sources=mappingSourceRows();
  $("mappingSources").innerHTML=sources.map(({cfg})=>`<div class="mapping-node source-node ${cfg.target_column?'mapped':'unmapped'} ${mappingSelectedSource===cfg.json_field?'selected':''}" data-source="${mappingEsc(cfg.json_field)}" tabindex="0"><div class="mapping-port source-port" data-port-source="${mappingEsc(cfg.json_field)}" title="Glisser vers une colonne Grist">●</div><div class="mapping-node-body"><strong>${mappingEsc(cfg.json_field)}</strong><small>${mappingEsc(cfg.identify||'Information à identifier dans le document')}</small><span class="mapping-target-chip ${cfg.target_column?'':'unmapped'}">${cfg.target_column?'→ '+mappingEsc(cfg.target_column):'Non mappé'}${cfg.target_column?`<button class="mapping-chip-remove" data-unlink="${mappingEsc(cfg.json_field)}" title="Supprimer cette liaison" aria-label="Supprimer la liaison">×</button>`:''}</span></div>${mappingBadge(cfg)}</div>`).join('');
  const targets=mappingTargetMeta();
  const linkedTargets=new Set(mappingAllEntries().filter(e=>e.cfg.target_column).map(e=>e.cfg.target_column));
  $("mappingTargets").innerHTML=[...targets.entries()].sort((a,b)=>a[0].localeCompare(b[0],'fr')).map(([name,meta])=>`<div class="mapping-node target-node ${linkedTargets.has(name)?'mapping-target-node-linked':''}" data-target="${mappingEsc(name)}"><div class="mapping-port target-port" data-port-target="${mappingEsc(name)}" title="Cible Grist">●</div><div class="mapping-node-body"><strong>${mappingEsc(name)}</strong><small>${mappingEsc(meta.type||'Colonne cible')}</small></div>${String(meta.type||'').startsWith('Ref:')?'<span class="mapping-badge ref">Ref</span>':''}</div>`).join('');
  bindMappingNodes();renderMappingStats();mappingSyncRaw();requestAnimationFrame(drawMappingLines);
  if(mappingSelectedSource)renderMappingRuleEditor(mappingSelectedSource);
}
function bindMappingNodes(){
  document.querySelectorAll('[data-source]').forEach(n=>{
    n.onclick=e=>{if(e.target.closest('.source-port')||e.target.closest('[data-unlink]'))return;selectMappingSource(n.dataset.source)};
    n.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectMappingSource(n.dataset.source)};if((e.key==='Delete'||e.key==='Backspace')&&mappingEntryByJson(n.dataset.source)?.cfg?.target_column){e.preventDefault();disconnectMapping(n.dataset.source)}};
  });
  document.querySelectorAll('[data-unlink]').forEach(b=>{
    b.onclick=e=>{e.preventDefault();e.stopPropagation();disconnectMapping(b.dataset.unlink)};
  });
  document.querySelectorAll('[data-port-source]').forEach(p=>{
    p.onpointerdown=e=>{e.preventDefault();e.stopPropagation();mappingPendingSource=p.dataset.portSource;mappingDragPoint={x:e.clientX,y:e.clientY};selectMappingSource(mappingPendingSource);document.body.classList.add('mapping-connecting');p.setPointerCapture?.(e.pointerId);requestAnimationFrame(drawMappingLines)};
    p.onclick=e=>{e.stopPropagation();mappingPendingSource=p.dataset.portSource;selectMappingSource(mappingPendingSource)};
  });
  document.querySelectorAll('[data-target]').forEach(n=>{
    n.onclick=()=>{if(mappingPendingSource)connectMapping(mappingPendingSource,n.dataset.target)};
  });
  document.querySelectorAll('[data-port-target]').forEach(p=>{
    p.onclick=e=>{e.stopPropagation();if(mappingPendingSource)connectMapping(mappingPendingSource,p.dataset.portTarget)};
  });
}
window.addEventListener('pointermove',e=>{if(!mappingPendingSource||!document.body.classList.contains('mapping-connecting'))return;mappingDragPoint={x:e.clientX,y:e.clientY};requestAnimationFrame(drawMappingLines)});
window.addEventListener('pointerup',e=>{
  if(mappingPendingSource&&document.body.classList.contains('mapping-connecting')){
    const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('[data-target]');
    if(hit){connectMapping(mappingPendingSource,hit.dataset.target);return}
  }
  mappingDragPoint=null;document.body.classList.remove('mapping-connecting');requestAnimationFrame(drawMappingLines);
});
window.addEventListener('resize',()=>requestAnimationFrame(drawMappingLines));
function selectMappingSource(jsonField){
  mappingSelectedSource=jsonField;mappingPendingSource=jsonField;
  document.querySelectorAll('[data-source]').forEach(x=>x.classList.toggle('selected',x.dataset.source===jsonField));
  renderMappingRuleEditor(jsonField);
}
function ensureMappedEntry(jsonField,target){
  let e=mappingEntryByJson(jsonField);if(!e)return null;
  if(e.section==='unmapped'){
    const old=e.cfg;
    delete mappingState.source_fields_without_current_grist_target[e.key];
    const key=e.key==='statut_source'?'statut':e.key;
    mappingState.fields=mappingState.fields||{};
    mappingState.fields[key]={...old};
    delete mappingState.fields[key].status;delete mappingState.fields[key].action;
    e={section:'fields',key,cfg:mappingState.fields[key]};
  }
  e.cfg.target_column=target;
  const targetInfo=mappingTargetMeta().get(target);
  // Un remapping doit reprendre les métadonnées de la nouvelle colonne cible,
  // sinon une ancienne Ref/Date pourrait rester attachée à la nouvelle liaison.
  if(targetInfo?.type)e.cfg.target_type=targetInfo.type;
  if(targetInfo?.reference)e.cfg.reference=mappingClone(targetInfo.reference);
  else if(targetInfo?.type&&!String(targetInfo.type).startsWith('Ref:'))delete e.cfg.reference;
  return e;
}
function connectMapping(jsonField,target){
  const e=ensureMappedEntry(jsonField,target);if(!e)return;
  mappingPendingSource=null;document.body.classList.remove('mapping-connecting');mappingSave();renderMapping();msg(`${jsonField} → ${target}`);
}
function disconnectMapping(jsonField){
  const e=mappingEntryByJson(jsonField);if(!e||!e.cfg.target_column)return;
  const cfg=mappingClone(e.cfg);delete cfg.target_column;delete cfg.target_type;delete cfg.reference;
  delete mappingState.fields[e.key];
  mappingState.source_fields_without_current_grist_target=mappingState.source_fields_without_current_grist_target||{};
  mappingState.source_fields_without_current_grist_target[e.key]={...cfg,status:'identified_but_unmapped',action:'preserve_in_extraction_json'};
  mappingSave();renderMapping();msg(`${jsonField} n'est plus mappé.`);
}
function drawMappingLines(){
  const svg=$("mappingLines"), board=$("mappingBoard");if(!svg||!board||!mappingState)return;
  const r=board.getBoundingClientRect();svg.setAttribute('viewBox',`0 0 ${r.width} ${r.height}`);svg.innerHTML='';
  mappingAllEntries().filter(e=>e.cfg.target_column).forEach(({cfg})=>{
    const a=document.querySelector(`[data-port-source="${CSS.escape(cfg.json_field)}"]`),b=document.querySelector(`[data-port-target="${CSS.escape(cfg.target_column)}"]`);if(!a||!b)return;
    const ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();
    const x1=ar.left+ar.width/2-r.left,y1=ar.top+ar.height/2-r.top,x2=br.left+br.width/2-r.left,y2=br.top+br.height/2-r.top,dx=Math.max(60,(x2-x1)*.42);
    const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',`M ${x1} ${y1} C ${x1+dx} ${y1}, ${x2-dx} ${y2}, ${x2} ${y2}`);p.setAttribute('class','mapping-link'+(mappingSelectedSource===cfg.json_field?' selected':''));p.dataset.source=cfg.json_field;p.style.pointerEvents='stroke';p.onclick=()=>selectMappingSource(cfg.json_field);p.ondblclick=e=>{e.preventDefault();e.stopPropagation();disconnectMapping(cfg.json_field)};p.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();if(confirm(`Supprimer la liaison ${cfg.json_field} → ${cfg.target_column} ?`))disconnectMapping(cfg.json_field)};svg.appendChild(p);
  });
  if(mappingPendingSource&&mappingDragPoint&&document.body.classList.contains('mapping-connecting')){
    const a=document.querySelector(`[data-port-source="${CSS.escape(mappingPendingSource)}"]`);if(a){const ar=a.getBoundingClientRect();const x1=ar.left+ar.width/2-r.left,y1=ar.top+ar.height/2-r.top,x2=mappingDragPoint.x-r.left,y2=mappingDragPoint.y-r.top,dx=Math.max(50,Math.abs(x2-x1)*.35);const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',`M ${x1} ${y1} C ${x1+dx} ${y1}, ${x2-dx} ${y2}, ${x2} ${y2}`);p.setAttribute('class','mapping-link mapping-link-preview');svg.appendChild(p)}}
}
function ruleField(label,html,help=''){return `<label class="mapping-rule-field"><span>${label}</span>${html}${help?`<small>${mappingEsc(help)}</small>`:''}</label>`}
function mappingTargetOptions(current){
  const targets=[...mappingTargetMeta().keys()].sort((a,b)=>a.localeCompare(b,'fr'));
  if(current&&!targets.includes(current))targets.unshift(current);
  return `<select data-map-edit="target_column"><option value="">— Non mappé —</option>${targets.map(t=>`<option value="${mappingEsc(t)}" ${t===current?'selected':''}>${mappingEsc(t)}</option>`).join('')}</select>`;
}
function renderMappingRuleEditor(jsonField){
  const e=mappingEntryByJson(jsonField);if(!e)return;
  const c=e.cfg;$("mappingRuleSubtitle").textContent=`${c.json_field}${c.target_column?' → '+c.target_column:' · non mappé'}`;
  $("mappingDisconnectBtn").classList.toggle('hidden',!c.target_column);$("mappingDisconnectBtn").onclick=()=>disconnectMapping(jsonField);
  const ref=c.reference||{};
  $("mappingRuleEditor").innerHTML=`
    ${ruleField('Champ JSON',`<input data-map-edit="json_field" value="${mappingEsc(c.json_field)}">`,'Nom stable attendu dans le JSON extrait.')}
    ${ruleField('Colonne Grist',mappingTargetOptions(c.target_column||''),'Choisissez une autre colonne pour remapper. Sélectionnez « Non mappé » pour supprimer la liaison.')}
    ${ruleField('Type cible',`<input data-map-edit="target_type" value="${mappingEsc(c.target_type||'')}" placeholder="Text, Date, Ref:…">`)}
    ${ruleField('À identifier dans le document',`<textarea data-map-edit="identify" rows="5">${mappingEsc(c.identify||'')}</textarea>`,'Instruction donnée à l’IA. Une information non trouvée doit rester null.')}
    <div class="mapping-rule-grid">
      ${ruleField('Obligatoire',`<select data-map-edit="required"><option value="false" ${!c.required?'selected':''}>Non</option><option value="true" ${c.required?'selected':''}>Oui</option></select>`)}
      ${ruleField('Si absent',`<input data-map-edit="when_missing" value="${mappingEsc(c.when_missing||c.when_missing_on_update||'')}">`)}
    </div>
    ${ruleField('Exemples',`<input data-map-edit="examples" value="${mappingEsc((c.examples_from_current_pdf||[]).join(' | '))}">`,'Séparer les exemples par |.')}
    <div class="mapping-ref-box ${String(c.target_type||'').startsWith('Ref:')?'':'hidden'}" id="mappingRefBox">
      <strong>Résolution de référence</strong>
      ${ruleField('Table référente',`<input data-map-ref="table" value="${mappingEsc(ref.table||String(c.target_type||'').replace('Ref:',''))}">`)}
      ${ruleField('Colonne de recherche',`<input data-map-ref="lookup_column" value="${mappingEsc(ref.lookup_column||'Nom')}">`)}
      ${ruleField('Créer si absent',`<select data-map-ref="create_if_missing"><option value="true" ${ref.create_if_missing!==false?'selected':''}>Oui</option><option value="false" ${ref.create_if_missing===false?'selected':''}>Non</option></select>`)}
    </div>
    ${c.transform?`<details class="mapping-advanced"><summary>Transformation</summary><textarea id="mappingTransformEditor" rows="8">${mappingEsc(typeof c.transform==='string'?JSON.stringify(c.transform):JSON.stringify(c.transform,null,2))}</textarea><button id="mappingApplyTransformBtn">Appliquer la transformation</button></details>`:''}
  `;
  document.querySelectorAll('[data-map-edit]').forEach(el=>el.onchange=()=>updateMappingRule(jsonField,el));
  document.querySelectorAll('[data-map-ref]').forEach(el=>el.onchange=()=>updateMappingRef(jsonField,el));
  const tf=$("mappingApplyTransformBtn");if(tf)tf.onclick=()=>{try{const e=mappingEntryByJson(jsonField);let v=JSON.parse($("mappingTransformEditor").value);e.cfg.transform=v;mappingSave();msg('Transformation mise à jour.')}catch(err){msg('JSON transformation invalide : '+err.message)}};
}
function updateMappingRule(jsonField,el){
  let e=mappingEntryByJson(jsonField);if(!e)return;
  const k=el.dataset.mapEdit;
  if(k==='required')e.cfg.required=el.value==='true';
  else if(k==='examples')e.cfg.examples_from_current_pdf=el.value.split('|').map(x=>x.trim()).filter(Boolean);
  else if(k==='target_column'){
    const target=el.value.trim();if(target){ensureMappedEntry(jsonField,target);if(!mappingTargetMeta().has(target))mappingExtraTargets.push(target)}else{disconnectMapping(jsonField);return}
  } else if(k==='json_field'){
    const nv=el.value.trim();if(!nv){msg('Le champ JSON ne peut pas être vide.');return}e.cfg.json_field=nv;mappingSelectedSource=nv;mappingPendingSource=nv;
  } else e.cfg[k]=el.value;
  mappingSave();renderMapping();
}
function updateMappingRef(jsonField,el){
  const e=mappingEntryByJson(jsonField);if(!e)return;e.cfg.reference=e.cfg.reference||{};
  const k=el.dataset.mapRef;e.cfg.reference[k]=k==='create_if_missing'?(el.value==='true'):el.value;
  mappingSave();
}
function validateMapping(show=true){
  const errors=[],warnings=[];if(!mappingState)return {errors:['Mapping non chargé'],warnings};
  const seen=new Set();mappingAllEntries().forEach(({cfg})=>{
    if(!cfg.json_field)errors.push('Un champ JSON est vide.');
    if(seen.has(cfg.json_field))errors.push(`Champ JSON dupliqué : ${cfg.json_field}`);seen.add(cfg.json_field);
    if(cfg.required&&!cfg.identify)warnings.push(`${cfg.json_field} est obligatoire sans règle identify.`);
    if(String(cfg.target_type||'').startsWith('Ref:')){if(!cfg.reference?.table)errors.push(`${cfg.json_field} : table de référence absente.`);if(!cfg.reference?.lookup_column)errors.push(`${cfg.json_field} : colonne de recherche absente.`)}
  });
  if(!mappingState.target?.table)errors.push('Table cible absente.');
  const box=$("mappingValidation");if(show&&box){box.classList.remove('hidden','ok','bad');box.classList.add(errors.length?'bad':'ok');box.innerHTML=`<strong>${errors.length?'Mapping invalide':'Mapping valide'}</strong><div>${errors.length?errors.map(x=>'• '+mappingEsc(x)).join('<br>'):'Aucune erreur bloquante.'}</div>${warnings.length?`<div class="mapping-warnings">${warnings.map(x=>'⚠ '+mappingEsc(x)).join('<br>')}</div>`:''}`}
  return {errors,warnings};
}
function exportMapping(){
  const v=validateMapping(true);if(v.errors.length){msg('Corrigez les erreurs avant export.');return}
  const blob=new Blob([JSON.stringify(mappingState,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='mapping-produit.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);msg('mapping-produit.json exporté.');
}
async function importMappingFile(file){
  try{const parsed=JSON.parse(await file.text());if(!parsed.fields||!parsed.target)throw new Error('Structure de mapping non reconnue');mappingState=parsed;mappingSelectedSource=null;mappingPendingSource=null;mappingExtraTargets=[];mappingSave();renderMapping();validateMapping(true);msg('Mapping importé.')}catch(e){msg('Import impossible : '+e.message)}
}
async function resetMapping(){
  if(!confirm('Réinitialiser le mapping Produit à la version fournie avec l’application ?'))return;
  localStorage.removeItem(MAPPING_STORAGE_KEY);mappingState=null;mappingSelectedSource=null;mappingPendingSource=null;mappingExtraTargets=[];await loadDefaultMapping();renderMapping();msg('Mapping réinitialisé.');
}
function initMappingUi(){
  if(!$("mappingImportBtn"))return;
  $("mappingImportBtn").onclick=()=>$("mappingFileInput").click();
  $("mappingFileInput").onchange=e=>{const f=e.target.files?.[0];if(f)importMappingFile(f);e.target.value=''};
  $("mappingExportBtn").onclick=exportMapping;$("mappingValidateBtn").onclick=()=>validateMapping(true);$("mappingResetBtn").onclick=resetMapping;
  $("mappingAddTargetBtn").onclick=()=>{const v=$("mappingNewTarget").value.trim();if(!v)return;if(!mappingExtraTargets.includes(v))mappingExtraTargets.push(v);$("mappingNewTarget").value='';renderMapping()};
  $("mappingApplyRawBtn").onclick=()=>{try{mappingState=JSON.parse($("mappingRawJson").value);mappingSave();mappingSelectedSource=null;renderMapping();validateMapping(true);msg('JSON brut appliqué.')}catch(e){msg('JSON invalide : '+e.message)}};
}
initMappingUi();
loadDefaultMapping().then(renderMapping).catch(e=>msg('Erreur mapping : '+e.message));
