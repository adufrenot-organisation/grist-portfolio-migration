
const $=id=>document.getElementById(id);
const state={dataOriginal:null,dataWork:null,dataName:null,library:{produit:[],projet:[],autre:[]},family:"produit",mappingId:null,schema:{},simulation:[]};
const BUSINESS_TYPES=["Texte","Nombre","Date","Période","Booléen","Entité","Référence","Liste de références","Statut","Pourcentage","Code"];
const LIBKEY="grist-migration:v27:library", CONNKEY="grist-migration:v27:conn";
function msg(t){const b=$("banner");b.textContent=t;b.classList.remove("hidden");setTimeout(()=>b.classList.add("hidden"),2600)}
function clone(x){return JSON.parse(JSON.stringify(x))}
function slug(s){return String(s||"mapping").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\w]+/g,"_").replace(/^_|_$/g,"").toLowerCase()}
function rowsOf(d){if(Array.isArray(d))return d;if(d&&Array.isArray(d.records))return d.records;if(d&&Array.isArray(d.data))return d.data;if(d&&typeof d==="object")return [d];return []}
function fieldsOf(d){const set=new Set();rowsOf(d).forEach(r=>Object.keys(r||{}).forEach(k=>set.add(k)));return [...set]}
function infer(v){if(v==null)return"null";if(Array.isArray(v))return"array";if(typeof v==="boolean")return"boolean";if(typeof v==="number")return"number";if(/^\d{4}-\d\d-\d\d/.test(String(v)))return"date";return"string"}
function activeMapping(){return (state.library[state.family]||[]).find(m=>m.mapping_id===state.mappingId)||null}
function saveLib(){localStorage.setItem(LIBKEY,JSON.stringify(state.library))}
function normalize(m,f="produit"){m=m||{};m.mapping_type=m.mapping_type||f;m.mapping_id=m.mapping_id||slug(m.name||"mapping");m.name=m.name||m.mapping_id;m.description=m.description||"";m.rules=Array.isArray(m.rules)?m.rules:legacyRules(m);m.targets=Array.isArray(m.targets)?m.targets:[];return m}
function legacyRules(m){const out=[];Object.entries(m.fields||{}).forEach(([src,r])=>out.push({source:src,target_table:r.target_table||m.target?.table||"Fonctionnalites",target_column:r.grist_column||r.target_column||r.column||"",business_type:r.business_type||"Texte",grist_type:r.grist_type||r.target_type||r.type||"",identify:r.identify||"",ref_table:r.ref_table||r.reference?.table||"",ref_match:r.ref_match||r.reference?.lookup_column||r.reference?.match_column||"Nom",create_if_missing:r.create_if_missing??r.reference?.create_if_missing??false}));return out}
function switchView(id){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("hidden",v.id!==id));document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.view===id));if(id==="mappings"){requestAnimationFrame(()=>{renderEditor();requestAnimationFrame(()=>{try{graphDraw()}catch(e){}})})}if(id==="simulate")renderSimulation()}
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>switchView(b.dataset.view));

async function init(){
 try{state.library=JSON.parse(localStorage.getItem(LIBKEY))||state.library}catch(e){}
 for(const f of ["produit","projet","autre"])if(!Array.isArray(state.library[f]))state.library[f]=[];
 if(!state.library.produit.length){try{const r=await fetch("mapping-produit.json?v=2");if(r.ok){let m=normalize(await r.json(),"produit");m.name=m.name||"Mapping Produit de référence";state.library.produit.push(m)}}catch(e){}}
 const c=JSON.parse(localStorage.getItem(CONNKEY)||"{}");$("gristServer").value=c.server||"";$("gristDoc").value=c.doc||"";$("gristKey").value=c.key||"";
 state.mappingId=state.library.produit[0]?.mapping_id||null;renderMappingSelectors();renderData();saveLib();
}
function renderMappingSelectors(){
 for(const [famId,mapId] of [["familySelect","mappingSelect"],["libFamily","libMapping"]]){
  const fs=$(famId),ms=$(mapId);if(!fs||!ms)continue;fs.value=state.family;ms.innerHTML="";
  (state.library[state.family]||[]).forEach(m=>{const o=document.createElement("option");o.value=m.mapping_id;o.textContent=m.name;ms.appendChild(o)});
  if(state.mappingId)ms.value=state.mappingId;
 }
 const m=activeMapping();$("mappingSummary").innerHTML=m?`<b>${m.name}</b><br>${m.rules.length} règle(s) · ${new Set(m.rules.map(r=>r.target_table)).size} table(s) cible(s)`:"Aucun mapping sélectionné.";
 $("goSimBtn").disabled=!(state.dataWork&&m);
}
$("familySelect").onchange=e=>changeFamily(e.target.value);$("libFamily").onchange=e=>changeFamily(e.target.value);
function changeFamily(f){state.family=f;state.mappingId=state.library[f][0]?.mapping_id||null;renderMappingSelectors();renderEditor()}
$("mappingSelect").onchange=e=>{state.mappingId=e.target.value;renderMappingSelectors()};
$("libMapping").onchange=e=>{state.mappingId=e.target.value;renderMappingSelectors();renderEditor()};

$("loadDataBtn").onclick=()=>$("dataFile").click();
$("dataFile").onchange=e=>loadData(e.target.files[0]);
function loadData(file){if(!file)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);state.dataOriginal=clone(d);state.dataWork=clone(d);state.dataName=file.name;renderData();suggestMapping();msg("JSON chargé")}catch(e){msg("JSON invalide : "+e.message)}};r.readAsText(file)}
function renderData(){
 const rows=rowsOf(state.dataWork),fields=fieldsOf(state.dataWork);
 $("dataSummary").textContent=state.dataWork?`${state.dataName||"JSON"} · ${rows.length} enregistrement(s) · ${fields.length} champ(s)`:"Aucun fichier chargé.";
 if(!rows.length){$("dataGrid").innerHTML="";renderMappingSelectors();return}
 let h="<table><thead><tr><th>#</th>"+fields.map(f=>`<th>${f}</th>`).join("")+"</tr></thead><tbody>";
 rows.forEach((r,i)=>{h+=`<tr><td>${i+1}</td>`+fields.map(f=>`<td contenteditable="true" data-row="${i}" data-field="${f}">${r[f]??""}</td>`).join("")+"</tr>"});h+="</tbody></table>";$("dataGrid").innerHTML=h;
 $("dataGrid").querySelectorAll("td[contenteditable]").forEach(td=>td.onblur=()=>{let v=td.textContent;const old=rowsOf(state.dataWork)[+td.dataset.row][td.dataset.field];if(typeof old==="number"&&!isNaN(Number(v)))v=Number(v);if(typeof old==="boolean")v=/^(true|1|oui)$/i.test(v);rowsOf(state.dataWork)[+td.dataset.row][td.dataset.field]=v;suggestMapping()});
 renderMappingSelectors();
}
$("exportWorkBtn").onclick=()=>download(state.dataWork,(state.dataName||"donnees").replace(/\.json$/,"")+"_corrige.json");
function download(obj,name){const a=document.createElement("a"),u=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:"application/json"}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}

function suggestMapping(){
 if(!state.dataWork)return;const m=activeMapping(),targets=allTargets();const suggestions=[];
 fieldsOf(state.dataWork).forEach(s=>{const sn=norm(s);let best=null,score=0;targets.forEach(t=>{const x=similar(sn,norm(t.column));if(x>score){score=x;best=t}});if(best&&score>.45)suggestions.push({s,best,score})});
 $("suggestions").innerHTML=suggestions.length?`<h3>Suggestions intelligentes</h3>`+suggestions.slice(0,8).map(x=>`<div class="summary"><b>${x.s}</b> → ${x.best.table}.${x.best.column} · ${Math.round(x.score*100)}%</div>`).join(""):"";
}
function norm(s){return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[_\s-]/g,"")}
function similar(a,b){if(a===b)return 1;if(a.includes(b)||b.includes(a))return .82;let n=0;for(const c of new Set(a))if(b.includes(c))n++;return n/Math.max(new Set(a).size,new Set(b).size)}
function allTargets(){const arr=[];Object.entries(state.schema).forEach(([table,cols])=>cols.forEach(c=>arr.push({table,column:c.id||c.colId||c.label,type:c.type||""})));const m=activeMapping();(m?.targets||[]).forEach(t=>arr.push(t));return arr}

$("newMappingBtn").onclick=()=>createFromData();$("createBlankBtn").onclick=()=>createMapping(false);
function createFromData(){createMapping(true)}
function createMapping(fromData){
 const name=prompt("Nom du mapping :",fromData?"Mapping depuis "+(state.dataName||"JSON"):"Nouveau mapping");if(!name)return;
 let fam=state.family,id=slug(name),n=2;while(state.library[fam].some(x=>x.mapping_id===id))id=slug(name)+"_"+n++;
 const m=normalize({mapping_id:id,name,mapping_type:fam,description:"",rules:[],targets:[]},fam);
 if(fromData&&state.dataWork)fieldsOf(state.dataWork).forEach(s=>m.rules.push({source:s,target_table:"",target_column:"",business_type:guessBusiness(s,rowsOf(state.dataWork)[0]?.[s]),grist_type:"",identify:"",ref_table:"",ref_match:"Nom",create_if_missing:false}));
 state.library[fam].push(m);state.mappingId=id;saveLib();renderMappingSelectors();switchView("mappings");msg("Mapping créé");
}
function guessBusiness(k,v){const n=norm(k),t=infer(v);if(n.includes("date"))return"Date";if(n.includes("statut"))return"Statut";if(n.includes("id")||n.includes("code"))return"Code";if(t==="number")return"Nombre";if(t==="boolean")return"Booléen";return"Texte"}
$("editMappingBtn").onclick=()=>switchView("mappings");
$("duplicateBtn").onclick=()=>{const m=activeMapping();if(!m)return;const c=clone(m);c.name=m.name+" - copie";c.mapping_id=slug(c.name)+"_"+Date.now().toString().slice(-4);state.library[state.family].push(c);state.mappingId=c.mapping_id;saveLib();renderMappingSelectors();renderEditor()};
$("deleteMapBtn").onclick=()=>{const m=activeMapping();if(!m||!confirm("Supprimer "+m.name+" ?"))return;state.library[state.family]=state.library[state.family].filter(x=>x.mapping_id!==m.mapping_id);state.mappingId=state.library[state.family][0]?.mapping_id||null;saveLib();renderMappingSelectors();renderEditor()};
$("importMapBtn").onclick=()=>$("mapFile").click();
$("exportMapBtn").onclick=()=>{const m=activeMapping();if(m)download(m,slug(m.name)+".json")};


// Métadonnées communes à l'éditeur graphique.
["mapName","mapDescription"].forEach(id=>{
  const node=$(id);
  if(node) node.onchange=()=>{
    const m=activeMapping(); if(!m)return;
    m.name=$("mapName").value;
    m.description=$("mapDescription").value;
    saveLib(); renderMappingSelectors();
  };
});
const applyMappingJsonBtn=$("applyMappingJson");
if(applyMappingJsonBtn) applyMappingJsonBtn.onclick=()=>{
  try{
    const n=normalize(JSON.parse($("mappingJson").value),state.family);
    const arr=state.library[state.family],i=arr.findIndex(x=>x.mapping_id===state.mappingId);
    n.mapping_id=state.mappingId; arr[i]=n; saveLib(); renderEditor(); msg("JSON appliqué");
  }catch(e){msg("JSON invalide : "+e.message)}
};

$("goSimBtn").onclick=()=>{switchView("simulate");runSimulation()};$("runSimulationBtn").onclick=runSimulation;$("backEditBtn").onclick=()=>switchView("workspace");
function runSimulation(){
 const m=activeMapping(),rows=rowsOf(state.dataWork);state.simulation=[];
 if(!m||!rows.length){renderSimulation();return}
 rows.forEach((row,i)=>{const changes=[],errors=[];m.rules.forEach(r=>{if(!r.target_table||!r.target_column)return;const v=row[r.source];if(v===undefined)return;changes.push({source:r.source,target:r.target_table+"."+r.target_column,value:v,business:r.business_type});if((r.business_type==="Date")&&v&&!/^\d{4}-\d\d-\d\d/.test(String(v)))errors.push(`${r.source}: date à vérifier`)});
 state.simulation.push({row:i+1,action:errors.length?"ERROR":"PREVIEW",changes,errors})});
 renderSimulation()
}
function renderSimulation(){
 const s=state.simulation,err=s.filter(x=>x.errors.length).length;$("simStats").innerHTML=[["Lignes",s.length],["Prêtes",s.length-err],["Erreurs",err]].map(x=>`<div class=stat><b>${x[1]}</b>${x[0]}</div>`).join("");
 $("simWarnings").innerHTML=state.schema&&Object.keys(state.schema).length?"":`<div class="warn">Simulation locale : connecte Grist pour comparer avec les enregistrements réels et distinguer CREATE / UPDATE / SAME.</div>`;
 $("simTable").innerHTML=s.length?`<table><thead><tr><th>Ligne</th><th>Action</th><th>Plan</th><th>Erreurs</th></tr></thead><tbody>${s.map(x=>`<tr><td>${x.row}</td><td>${x.action}</td><td>${x.changes.map(c=>`${c.target} ← ${c.source} = ${c.value}`).join("<br>")}</td><td>${x.errors.join("<br>")}</td></tr>`).join("")}</tbody></table>`:"Aucune simulation.";
 $("executeBtn").disabled=err>0||!s.length||!Object.keys(state.schema).length;
}
$("executeBtn").onclick=()=>{if(!confirm("Appliquer réellement ce plan dans Grist ?"))return;msg("Exécution protégée : moteur d'upsert réel à brancher après validation du schéma et des clés de matching.")};

$("saveConnBtn").onclick=saveConn;function saveConn(){localStorage.setItem(CONNKEY,JSON.stringify({server:$("gristServer").value.trim().replace(/\/$/,""),doc:$("gristDoc").value.trim(),key:$("gristKey").value.trim()}));msg("Connexion mémorisée localement")}
$("testConnBtn").onclick=loadSchema;
async function api(path,opt={}){const c=JSON.parse(localStorage.getItem(CONNKEY)||"{}");const r=await fetch(c.server+path,{...opt,headers:{Authorization:"Bearer "+c.key,"Content-Type":"application/json",...(opt.headers||{})}});if(!r.ok)throw new Error("HTTP "+r.status+" "+await r.text());return r.json()}
async function loadSchema(){saveConn();const c=JSON.parse(localStorage.getItem(CONNKEY)||"{}");try{const t=await api(`/api/docs/${encodeURIComponent(c.doc)}/tables`);state.schema={};for(const table of t.tables||[]){const x=await api(`/api/docs/${encodeURIComponent(c.doc)}/tables/${encodeURIComponent(table.id)}/columns?hidden=true`);state.schema[table.id]=x.columns||[]} $("connStatus").textContent=`Connecté · ${Object.keys(state.schema).length} table(s) chargée(s)`;renderEditor();suggestMapping();msg("Schéma Grist chargé")}catch(e){$("connStatus").textContent="Erreur : "+e.message}}
init();

// ===== v2.1 : éditeur graphique multi-table =====
let graphState={selectedRule:-1,dragSource:null,tempPoint:null,displayTable:""};

function graphEsc(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function graphMappingFields(){
  const m=activeMapping(); if(!m)return [];
  return [...new Set([...(m.rules||[]).map(r=>r.source),...fieldsOf(state.dataWork)])];
}
function graphAllTables(){
  const m=activeMapping();
  return [...new Set([
    ...Object.keys(state.schema||{}),
    m?.target?.table,
    ...(m?.targets||[]).map(t=>t.table),
    ...(m?.rules||[]).map(r=>r.target_table)
  ].filter(Boolean))];
}
function graphCurrentTable(){
  const m=activeMapping(),tables=graphAllTables();
  if(graphState.displayTable && tables.includes(graphState.displayTable))return graphState.displayTable;
  return (m?.rules||[]).find(r=>r.target_table)?.target_table || tables[0] || m?.target?.table || "";
}
function graphColumnsForTable(table){
  const cols=(state.schema?.[table]||[]).map(c=>({
    table,
    column:c.id||c.colId||c.label||c.fields?.label,
    type:c.type||c.fields?.type||"",
    label:c.label||c.fields?.label||c.id||c.colId
  })).filter(c=>c.column);
  const m=activeMapping();
  (m?.targets||[]).filter(t=>t.table===table).forEach(t=>{
    if(!cols.some(c=>c.column===t.column))cols.push({table,column:t.column,type:t.type||"",label:t.column});
  });
  (m?.rules||[]).filter(r=>r.target_table===table&&r.target_column).forEach(r=>{
    if(!cols.some(c=>c.column===r.target_column))cols.push({table,column:r.target_column,type:r.grist_type||"",label:r.target_column});
  });
  return cols;
}
function graphRenderTableSelect(){
  const sel=$("targetTableSelect"); if(!sel)return;
  const tables=graphAllTables();
  graphState.displayTable=graphCurrentTable();
  sel.innerHTML=tables.map(t=>`<option value="${graphEsc(t)}">${graphEsc(t)}</option>`).join("");
  if(graphState.displayTable)sel.value=graphState.displayTable;
  if(graphState.displayTable){
    const realCount=(state.schema?.[graphState.displayTable]||[]).length;
    const knownCount=graphColumnsForTable(graphState.displayTable).length;
    $("targetTableCaption").textContent=realCount
      ? `${graphState.displayTable} · ${realCount} colonne(s) du schéma Grist`
      : `${graphState.displayTable} · ${knownCount} colonne(s) connues du mapping · connecte Grist pour afficher le schéma complet`;
  }else $("targetTableCaption").textContent="Connecte Grist ou ajoute une cible manuelle";
}
function graphRender(){
  const m=activeMapping();
  renderMappingSelectors();
  if(!m){$("sourceFields").innerHTML="Aucun mapping";$("targetFields").innerHTML="";return}
  graphRenderTableSelect();
  const table=graphState.displayTable=graphCurrentTable(),sources=graphMappingFields(),rules=m.rules||[];
  $("sourceFields").innerHTML=sources.map(s=>{
    const idxs=rules.map((r,i)=>r.source===s?i:-1).filter(i=>i>=0);
    const isSel=idxs.includes(graphState.selectedRule);
    return `<div class="graph-card ${idxs.length?"mapped":""} ${isSel?"selected":""}">
      <div class="meta"><div class="title">${graphEsc(s)}</div><div class="sub">${infer(rowsOf(state.dataWork)[0]?.[s])}${idxs.length?` · ${idxs.length} liaison(s)`:" · non mappé"}</div></div>
      ${idxs.length?`<span class="mapping-badge">${idxs.length}</span>`:""}
      <span class="port source-port" data-source="${graphEsc(s)}" title="Glisser vers une colonne"></span>
    </div>`;
  }).join("") || "<div class=summary>Aucun champ JSON. Charge un JSON ou ajoute un champ.</div>";

  const cols=graphColumnsForTable(table);
  $("targetFields").innerHTML=cols.map(c=>{
    const used=rules.some(r=>r.target_table===table&&r.target_column===c.column);
    const selected=rules[graphState.selectedRule]?.target_table===table&&rules[graphState.selectedRule]?.target_column===c.column;
    return `<div class="graph-card ${used?"mapped":""} ${selected?"selected":""}">
      <span class="port target-port" data-table="${graphEsc(table)}" data-column="${graphEsc(c.column)}" title="Déposer ici"></span>
      <div class="meta"><div class="title">${graphEsc(c.label||c.column)}</div><div class="sub">${graphEsc(c.column)} · ${graphEsc(c.type||"type inconnu")}</div></div>
      ${used?`<span class="mapping-badge">mappé</span>`:`<span class="sub">non mappé</span>`}
    </div>`;
  }).join("") || "<div class=summary>Aucune colonne disponible pour cette table.</div>";
  setTimeout(graphDraw,0); graphInspector();
}
function graphPoint(rule){
  const sc=[...document.querySelectorAll(".source-port")].find(x=>x.dataset.source===rule.source);
  const tc=[...document.querySelectorAll(".target-port")].find(x=>x.dataset.table===rule.target_table&&x.dataset.column===rule.target_column);
  const wrap=$("graphCanvasWrap"); if(!sc||!tc||!wrap)return null;
  const wr=wrap.getBoundingClientRect(),sr=sc.getBoundingClientRect(),tr=tc.getBoundingClientRect();
  return {x1:sr.left+sr.width/2-wr.left,y1:sr.top+sr.height/2-wr.top,x2:tr.left+tr.width/2-wr.left,y2:tr.top+tr.height/2-wr.top};
}
function graphCurve(p){const dx=Math.max(50,Math.abs(p.x2-p.x1)*.5);return `M ${p.x1} ${p.y1} C ${p.x1+dx} ${p.y1}, ${p.x2-dx} ${p.y2}, ${p.x2} ${p.y2}`}
function graphDraw(){
  const svg=$("mappingSvg"),m=activeMapping(),wrap=$("graphCanvasWrap"); if(!svg||!m||!wrap)return;
  svg.setAttribute("viewBox",`0 0 ${wrap.clientWidth} ${wrap.clientHeight}`); let html="";
  (m.rules||[]).forEach((r,i)=>{if(r.target_table!==graphState.displayTable||!r.target_column)return;const p=graphPoint(r);if(p)html+=`<path class="mapping-path ${i===graphState.selectedRule?"selected":""}" data-rule="${i}" d="${graphCurve(p)}"></path>`});
  if(graphState.dragSource&&graphState.tempPoint){
    const sc=[...document.querySelectorAll(".source-port")].find(x=>x.dataset.source===graphState.dragSource);
    if(sc){const wr=wrap.getBoundingClientRect(),sr=sc.getBoundingClientRect(),p={x1:sr.left+sr.width/2-wr.left,y1:sr.top+sr.height/2-wr.top,x2:graphState.tempPoint.x,y2:graphState.tempPoint.y};html+=`<path class="mapping-path temp" d="${graphCurve(p)}"></path>`}
  }
  svg.innerHTML=html;
  svg.querySelectorAll(".mapping-path:not(.temp)").forEach(p=>{
    p.onclick=()=>{graphState.selectedRule=+p.dataset.rule;graphRender()};
    p.ondblclick=()=>graphRemoveRule(+p.dataset.rule);
    p.oncontextmenu=e=>{e.preventDefault();graphRemoveRule(+p.dataset.rule)};
  });
}
function graphAddConnection(source,table,column){
  const m=activeMapping(); if(!m)return;
  const existing=(m.rules||[]).findIndex(r=>r.source===source&&r.target_table===table&&r.target_column===column);
  if(existing>=0){graphState.selectedRule=existing;graphRender();return}
  const col=graphColumnsForTable(table).find(c=>c.column===column);
  m.rules=m.rules||[];
  m.rules.push({source,target_table:table,target_column:column,business_type:guessBusiness(source,rowsOf(state.dataWork)[0]?.[source]),grist_type:col?.type||"",identify:"",ref_table:(col?.type||"").startsWith("Ref:")?(col.type.split(":")[1]||""):"",ref_match:"Nom",create_if_missing:(col?.type||"").startsWith("Ref:")});
  graphState.selectedRule=m.rules.length-1; saveLib(); graphRender(); msg(`${source} → ${table}.${column}`);
}
function graphRemoveRule(i){
  const m=activeMapping(); if(!m||!m.rules?.[i])return;
  m.rules.splice(i,1);graphState.selectedRule=-1;saveLib();graphRender();msg("Liaison supprimée");
}
function graphInspector(){
  const box=$("ruleInspector"),m=activeMapping(),r=m?.rules?.[graphState.selectedRule]; if(!box)return;
  if(!r){box.innerHTML='<div class="rule-inspector-empty">Sélectionne une liaison pour éditer ses règles.</div>';return}
  const tables=graphAllTables(),cols=graphColumnsForTable(r.target_table);
  box.innerHTML=`<div class="rule-grid">
    <div><label>Champ JSON</label><input id="riSource" value="${graphEsc(r.source)}"></div>
    <div><label>Table cible</label><select id="riTable">${tables.map(t=>`<option ${t===r.target_table?"selected":""}>${graphEsc(t)}</option>`).join("")}</select></div>
    <div><label>Colonne cible</label><select id="riColumn">${cols.map(c=>`<option ${c.column===r.target_column?"selected":""}>${graphEsc(c.column)}</option>`).join("")}</select></div>
    <div><label>Type métier</label><select id="riBusiness">${BUSINESS_TYPES.map(x=>`<option ${x===r.business_type?"selected":""}>${x}</option>`).join("")}</select></div>
    <div><label>Type Grist</label><input id="riGristType" value="${graphEsc(r.grist_type||"")}"></div>
    <div><label>Table de référence</label><input id="riRefTable" value="${graphEsc(r.ref_table||"")}"></div>
    <div><label>Champ de rapprochement Ref</label><input id="riRefMatch" value="${graphEsc(r.ref_match||"Nom")}"></div>
    <div><label>Créer la Ref si absente</label><select id="riCreateRef"><option value="false" ${!r.create_if_missing?"selected":""}>Non</option><option value="true" ${r.create_if_missing?"selected":""}>Oui</option></select></div>
    <div style="grid-column:1/-1"><label>Ce que l'IA doit identifier dans le document</label><textarea id="riIdentify">${graphEsc(r.identify||"")}</textarea></div>
  </div><div class="rule-actions"><button id="riDelete" class="danger">Supprimer la liaison</button><button id="riSave" class="primary">Enregistrer les règles</button></div>`;
  $("riTable").onchange=()=>{r.target_table=$("riTable").value;graphState.displayTable=r.target_table;saveLib();graphRender()};
  $("riSave").onclick=()=>{r.source=$("riSource").value.trim();r.target_table=$("riTable").value;r.target_column=$("riColumn").value;r.business_type=$("riBusiness").value;r.grist_type=$("riGristType").value.trim();r.ref_table=$("riRefTable").value.trim();r.ref_match=$("riRefMatch").value.trim();r.create_if_missing=$("riCreateRef").value==="true";r.identify=$("riIdentify").value;saveLib();graphRender();msg("Règle enregistrée")};
  $("riDelete").onclick=()=>graphRemoveRule(graphState.selectedRule);
}
document.addEventListener("mousedown",e=>{const p=e.target.closest(".source-port");if(p)graphState.dragSource=p.dataset.source});
document.addEventListener("mousemove",e=>{if(!graphState.dragSource)return;const wr=$("graphCanvasWrap")?.getBoundingClientRect();if(!wr)return;graphState.tempPoint={x:e.clientX-wr.left,y:e.clientY-wr.top};graphDraw()});
document.addEventListener("mouseup",e=>{if(!graphState.dragSource)return;const target=e.target.closest(".target-port"),source=graphState.dragSource;graphState.dragSource=null;graphState.tempPoint=null;if(target)graphAddConnection(source,target.dataset.table,target.dataset.column);else graphDraw()});
$("targetTableSelect").onchange=e=>{graphState.displayTable=e.target.value;graphRender()};
$("addManualTargetBtn").onclick=()=>{const m=activeMapping();if(!m)return;const table=prompt("Table cible :",graphState.displayTable||"");if(!table)return;const column=prompt("Colonne cible :");if(!column)return;const type=prompt("Type Grist :","Text")||"Text";m.targets=m.targets||[];m.targets.push({table,column,type});graphState.displayTable=table;saveLib();graphRender()};
$("clearConnectionsBtn").onclick=()=>{const m=activeMapping();if(!m||!confirm("Supprimer toutes les liaisons de ce mapping ?"))return;m.rules=[];graphState.selectedRule=-1;saveLib();graphRender()};
window.addEventListener("resize",()=>setTimeout(graphDraw,0));

// override old editor
renderEditor=function(){
  renderMappingSelectors();
  const m=activeMapping();
  if(!m){$("sourceFields").innerHTML="Aucun mapping";$("targetFields").innerHTML="";return}
  $("mapName").value=m.name;$("mapId").value=m.mapping_id;$("mapDescription").value=m.description||"";
  $("mappingJson").value=JSON.stringify(m,null,2);
  graphRender();
};


// Ajout d'un champ JSON dans l'éditeur graphique.
const graphAddSourceBtn=$("addSourceBtn");
if(graphAddSourceBtn) graphAddSourceBtn.onclick=()=>{
  const m=activeMapping(); if(!m)return;
  const s=prompt("Nom du champ JSON :"); if(!s)return;
  const source=s.trim(); if(!source)return;
  m.rules=m.rules||[];
  if(!m.rules.some(r=>r.source===source)){
    m.unmapped_source_fields=m.unmapped_source_fields||{};
    m.unmapped_source_fields[source]=m.unmapped_source_fields[source]||{json_field:source,identify:""};
  }
  saveLib(); graphRender();
};

// ===== v2.2 : import robuste des mappings historiques =====
function importMappingCompatible(raw){
  if(!raw || typeof raw!=="object") throw new Error("Le fichier ne contient pas un objet JSON.");
  const fam=["produit","projet","autre"].includes(String(raw.mapping_type||"").toLowerCase())
    ? String(raw.mapping_type).toLowerCase() : "autre";

  const converted=clone(raw);
  converted.mapping_type=fam;
  converted.name=converted.name||converted.mapping_id||"Mapping importé";
  converted.mapping_id=converted.mapping_id||slug(converted.name);
  converted.description=converted.description||converted.source?.document_type||"";

  // Format historique : fields = { cle_metier: { json_field, target_column, target_type, reference... } }
  if(!Array.isArray(converted.rules)){
    converted.rules=[];
    Object.entries(converted.fields||{}).forEach(([key,f])=>{
      converted.rules.push({
        source:f.json_field||key,
        target_table:f.target_table||converted.target?.table||"",
        target_column:f.target_column||f.grist_column||"",
        business_type:
          (String(f.target_type||"").startsWith("RefList:")?"Liste de références":
           String(f.target_type||"").startsWith("Ref:")?"Référence":
           f.expected_semantic_type==="Text"?"Texte":
           f.target_type==="Date"?"Date":
           f.target_type==="Bool"?"Booléen":
           f.target_type==="Numeric"?"Nombre":
           f.target_type==="Choice"?"Statut":"Texte"),
        grist_type:f.target_type||f.grist_type||f.type||"",
        identify:f.identify||"",
        ref_table:f.reference?.table||"",
        ref_match:f.reference?.lookup_column||f.reference?.match_column||"Nom",
        create_if_missing:f.reference?.create_if_missing??false,
        required:f.required??false,
        when_missing:f.when_missing||f.when_missing_on_update||"",
        transform:f.transform??null,
        original_field_key:key,
        original_definition:clone(f)
      });
    });
  }

  // Preserve unmapped identified JSON fields and expose them graphically on the left.
  converted.unmapped_source_fields=converted.unmapped_source_fields||{};
  Object.entries(converted.source_fields_without_current_grist_target||{}).forEach(([key,f])=>{
    converted.unmapped_source_fields[f.json_field||key]=clone(f);
  });

  converted.targets=Array.isArray(converted.targets)?converted.targets:[];
  converted.rules.forEach(r=>{
    if(r.target_table&&r.target_column&&!converted.targets.some(t=>t.table===r.target_table&&t.column===r.target_column)){
      converted.targets.push({table:r.target_table,column:r.target_column,type:r.grist_type||""});
    }
  });
  return converted;
}

// Include preserved unmapped fields in the graphical source list.
const _graphMappingFieldsV22=graphMappingFields;
graphMappingFields=function(){
  const m=activeMapping();
  return [...new Set([
    ..._graphMappingFieldsV22(),
    ...Object.keys(m?.unmapped_source_fields||{}),
    ...Object.values(m?.source_fields_without_current_grist_target||{}).map(x=>x.json_field).filter(Boolean)
  ])];
};




// ===== v2.4 : IMPORT UNIQUE, DIAGNOSTIQUE ET COMPATIBLE =====
function importMappingV25(raw){
  if(!raw || Array.isArray(raw) || typeof raw!=="object"){
    throw new Error("racine JSON attendue = objet");
  }
  const famRaw=String(raw.mapping_type||"autre").toLowerCase();
  const fam=["produit","projet","autre"].includes(famRaw)?famRaw:"autre";
  const m=clone(raw);
  m.mapping_type=fam;
  m.mapping_id=m.mapping_id||slug(m.name||"mapping_importe");
  m.name=m.name||m.mapping_id;
  m.description=m.description||m.source?.document_type||"";

  // Convertit le format historique fields -> rules
  if(!Array.isArray(m.rules)){
    m.rules=[];
    for(const [technicalKey,f] of Object.entries(m.fields||{})){
      if(!f || typeof f!=="object") continue;
      const gt=f.target_type||f.grist_type||f.type||"";
      let bt="Texte";
      if(String(gt).startsWith("RefList:")) bt="Liste de références";
      else if(String(gt).startsWith("Ref:")) bt="Référence";
      else if(gt==="Date") bt="Date";
      else if(gt==="Bool") bt="Booléen";
      else if(gt==="Numeric") bt="Nombre";
      else if(gt==="Choice") bt="Statut";
      else if(f.expected_semantic_type==="Text") bt="Texte";

      m.rules.push({
        source:f.json_field||technicalKey,
        target_table:f.target_table||m.target?.table||"",
        target_column:f.target_column||f.grist_column||"",
        business_type:bt,
        grist_type:gt,
        identify:f.identify||"",
        ref_table:f.reference?.table||"",
        ref_match:f.reference?.lookup_column||f.reference?.match_column||"Nom",
        create_if_missing:Boolean(f.reference?.create_if_missing??f.create_if_missing??false),
        required:Boolean(f.required??false),
        when_missing:f.when_missing||f.when_missing_on_update||"",
        transform:f.transform??null,
        original_field_key:technicalKey,
        original_definition:clone(f)
      });
    }
  }

  // Expose aussi les champs identifiés mais non mappés.
  m.unmapped_source_fields=m.unmapped_source_fields||{};
  for(const [k,f] of Object.entries(m.source_fields_without_current_grist_target||{})){
    const jf=(f&&f.json_field)||k;
    m.unmapped_source_fields[jf]=clone(f||{});
  }

  // Reconstruit les cibles connues à partir des règles afin de pouvoir
  // afficher la table et les colonnes AVANT connexion à Grist.
  m.targets=Array.isArray(m.targets)?m.targets:[];
  for(const r of m.rules){
    if(r.target_table && r.target_column &&
       !m.targets.some(t=>t.table===r.target_table && t.column===r.target_column)){
      m.targets.push({table:r.target_table,column:r.target_column,type:r.grist_type||""});
    }
  }
  if(m.target?.table && !m.targets.some(t=>t.table===m.target.table)){
    // Le tableau targets peut être vide pour une table sans colonnes mappées.
    m.targets.push({table:m.target.table,column:"",type:""});
  }

  if(!m.mapping_id) throw new Error("mapping_id absent");
  if(!m.rules.length && !Object.keys(m.unmapped_source_fields).length){
    throw new Error("aucun champ/règle détecté dans fields, rules ou source_fields_without_current_grist_target");
  }
  return m;
}

function installMappingV25(m){
  const fam=m.mapping_type;
  state.library[fam]=state.library[fam]||[];

  let id=m.mapping_id;
  const existing=state.library[fam].findIndex(x=>x.mapping_id===id);
  if(existing>=0){
    const replace=confirm(
      `Le mapping "${id}" existe déjà.\n\n`+
      `OK = remplacer le mapping existant\n`+
      `Annuler = importer comme copie`
    );
    if(replace){
      state.library[fam][existing]=m;
    }else{
      const base=id; let n=2;
      while(state.library[fam].some(x=>x.mapping_id===id)) id=base+"_"+n++;
      m.mapping_id=id;
      m.name=(m.name||base)+" - copie";
      state.library[fam].push(m);
    }
  }else{
    state.library[fam].push(m);
  }

  state.family=fam;
  state.mappingId=m.mapping_id;
  graphState.selectedRule=-1;
  graphState.displayTable=m.target?.table || m.rules.find(r=>r.target_table)?.target_table || "";
  saveLib();

  // IMPORTANT : rendre la vue visible d'abord, puis calculer géométrie et traits.
  switchView("mappings");
  renderMappingSelectors();
  requestAnimationFrame(()=>{
    renderEditor();
    requestAnimationFrame(()=>{
      graphRender();
      graphDraw();
      setTimeout(graphDraw,80);
    });
  });
}

$("mapFile").addEventListener("change", e=>{
  const file=e.target.files && e.target.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const raw=JSON.parse(String(reader.result));
      const m=importMappingV25(raw);
      installMappingV25(m);
      msg(`Mapping chargé : ${m.name} · ${m.rules.length} liaison(s) · cible ${m.target?.table||"multi-table"}`);
      const dbg=$("importDebug");
      if(dbg){
        dbg.className="import-debug ok";
        dbg.textContent=`OK · ${file.name} · ${m.rules.length} liaison(s) · table principale : ${m.target?.table||"—"}`;
      }
    }catch(err){
      console.error("IMPORT MAPPING v2.6",err);
      msg("Import impossible : "+err.message);
      const dbg=$("importDebug");
      if(dbg){
        dbg.className="import-debug error";
        dbg.textContent="Erreur import : "+err.message;
      }
    }finally{
      e.target.value="";
    }
  };
  reader.onerror=()=>{
    msg("Impossible de lire le fichier.");
  };
  reader.readAsText(file,"utf-8");
});

// ===== v2.7 : toutes les colonnes de la table cible =====
graphState.targetFilter=graphState.targetFilter||"all";
graphState.targetSearch=graphState.targetSearch||"";

function hasLoadedSchemaFor(table){
  return Boolean(table && Array.isArray(state.schema?.[table]) && state.schema[table].length);
}
function mappedTargetSet(table){
  const m=activeMapping();
  return new Set((m?.rules||[]).filter(r=>r.target_table===table&&r.target_column).map(r=>r.target_column));
}
function filteredGraphColumns(table){
  const all=graphColumnsForTable(table);
  const mapped=mappedTargetSet(table);
  const q=(graphState.targetSearch||"").trim().toLowerCase();
  return all.filter(c=>{
    const isMapped=mapped.has(c.column);
    if(graphState.targetFilter==="unmapped" && isMapped)return false;
    if(graphState.targetFilter==="mapped" && !isMapped)return false;
    if(q && !(`${c.label||""} ${c.column||""} ${c.type||""}`.toLowerCase().includes(q)))return false;
    return true;
  });
}

const _graphRenderV27=graphRender;
graphRender=function(){
  const m=activeMapping();
  renderMappingSelectors();
  if(!m){$("sourceFields").innerHTML="Aucun mapping";$("targetFields").innerHTML="";return}
  graphRenderTableSelect();
  const table=graphState.displayTable=graphCurrentTable(),sources=graphMappingFields(),rules=m.rules||[];

  $("sourceFields").innerHTML=sources.map(s=>{
    const idxs=rules.map((r,i)=>r.source===s?i:-1).filter(i=>i>=0);
    const isSel=idxs.includes(graphState.selectedRule);
    return `<div class="graph-card ${idxs.length?"mapped":""} ${isSel?"selected":""}">
      <div class="meta"><div class="title">${graphEsc(s)}</div><div class="sub">${infer(rowsOf(state.dataWork)[0]?.[s])}${idxs.length?` · ${idxs.length} liaison(s)`:" · non mappé"}</div></div>
      ${idxs.length?`<span class="mapping-badge">${idxs.length}</span>`:""}
      <span class="port source-port" data-source="${graphEsc(s)}" title="Glisser vers une colonne"></span>
    </div>`;
  }).join("") || "<div class=summary>Aucun champ JSON. Charge un JSON ou ajoute un champ.</div>";

  const allCols=graphColumnsForTable(table);
  const cols=filteredGraphColumns(table);
  const mapped=mappedTargetSet(table);
  $("targetColumnCount").textContent=table?`${cols.length}/${allCols.length} colonne(s)`:"";
  $("targetTableCaption").textContent=table
    ? `${table} · ${hasLoadedSchemaFor(table)?"schéma Grist chargé":"colonnes connues par le mapping seulement"}`
    : "Connecte Grist ou ajoute une cible manuelle";

  const warning=table && !hasLoadedSchemaFor(table)
    ? `<div class="schema-warning">Le schéma complet de <b>${graphEsc(table)}</b> n'est pas encore chargé. Connecte Grist pour afficher aussi toutes les colonnes non présentes dans le mapping.</div>`
    : "";
  $("targetFields").innerHTML=warning + (cols.map(c=>{
    const used=mapped.has(c.column);
    const selected=rules[graphState.selectedRule]?.target_table===table&&rules[graphState.selectedRule]?.target_column===c.column;
    return `<div class="graph-card ${used?"mapped":"targetcard-unmapped"} ${selected?"selected":""}">
      <span class="port target-port" data-table="${graphEsc(table)}" data-column="${graphEsc(c.column)}" title="Déposer ici"></span>
      <div class="meta"><div class="title">${graphEsc(c.label||c.column)}</div><div class="sub">${graphEsc(c.column)} · ${graphEsc(c.type||"type inconnu")}</div></div>
      ${used?`<span class="mapping-badge">mappé</span>`:`<span class="sub">non mappé</span>`}
    </div>`;
  }).join("") || "<div class=summary>Aucune colonne ne correspond au filtre.</div>");
  setTimeout(graphDraw,0); graphInspector();
};

$("targetColumnFilter").onchange=e=>{graphState.targetFilter=e.target.value;graphRender()};
$("targetColumnSearch").oninput=e=>{graphState.targetSearch=e.target.value;graphRender()};

// Après chargement du schéma Grist, revenir immédiatement à l'éditeur graphique
// et montrer toutes les colonnes de la table sélectionnée.
const _loadSchemaV27=loadSchema;
loadSchema=async function(){
  await _loadSchemaV27();
  if(!document.getElementById("mappings").classList.contains("hidden")){
    graphRender();
    setTimeout(graphDraw,60);
  }
};

// Auto-charge le schéma après import si une connexion Grist est déjà mémorisée.
async function autoLoadSchemaForImportedMapping(){
  const table=graphCurrentTable();
  if(hasLoadedSchemaFor(table))return;
  let c={};
  try{c=JSON.parse(localStorage.getItem("grist-migration:v26:conn")||localStorage.getItem("grist-migration:v25:conn")||localStorage.getItem("grist-migration:v2:conn")||"{}")}catch(e){}
  if(c.server&&c.doc&&c.key){
    $("gristServer").value=c.server;$("gristDoc").value=c.doc;$("gristKey").value=c.key;
    try{
      await loadSchema();
      msg(`Schéma Grist chargé · ${Object.keys(state.schema).length} table(s)`);
    }catch(e){
      console.warn("Auto schema",e);
    }
  }
}

const _origInstallMappingV27 = (typeof installMappingV25==="function" ? installMappingV25 :
                                (typeof installMappingV24==="function" ? installMappingV24 : null));
if(_origInstallMappingV27){
  if(typeof installMappingV25==="function"){
    installMappingV25=function(m){_origInstallMappingV27(m);setTimeout(autoLoadSchemaForImportedMapping,120)};
  }else{
    installMappingV24=function(m){_origInstallMappingV27(m);setTimeout(autoLoadSchemaForImportedMapping,120)};
  }
}
