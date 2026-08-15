
const $=id=>document.getElementById(id);
const state={dataOriginal:null,dataWork:null,dataName:null,library:{produit:[],projet:[],autre:[]},family:"produit",mappingId:null,schema:{},simulation:[]};
const BUSINESS_TYPES=["Texte","Nombre","Date","Période","Booléen","Entité","Référence","Liste de références","Statut","Pourcentage","Code"];
const LIBKEY="grist-migration:v2:library", CONNKEY="grist-migration:v2:conn";
function msg(t){const b=$("banner");b.textContent=t;b.classList.remove("hidden");setTimeout(()=>b.classList.add("hidden"),2600)}
function clone(x){return JSON.parse(JSON.stringify(x))}
function slug(s){return String(s||"mapping").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\w]+/g,"_").replace(/^_|_$/g,"").toLowerCase()}
function rowsOf(d){if(Array.isArray(d))return d;if(d&&Array.isArray(d.records))return d.records;if(d&&Array.isArray(d.data))return d.data;if(d&&typeof d==="object")return [d];return []}
function fieldsOf(d){const set=new Set();rowsOf(d).forEach(r=>Object.keys(r||{}).forEach(k=>set.add(k)));return [...set]}
function infer(v){if(v==null)return"null";if(Array.isArray(v))return"array";if(typeof v==="boolean")return"boolean";if(typeof v==="number")return"number";if(/^\d{4}-\d\d-\d\d/.test(String(v)))return"date";return"string"}
function activeMapping(){return (state.library[state.family]||[]).find(m=>m.mapping_id===state.mappingId)||null}
function saveLib(){localStorage.setItem(LIBKEY,JSON.stringify(state.library))}
function normalize(m,f="produit"){m=m||{};m.mapping_type=m.mapping_type||f;m.mapping_id=m.mapping_id||slug(m.name||"mapping");m.name=m.name||m.mapping_id;m.description=m.description||"";m.rules=Array.isArray(m.rules)?m.rules:legacyRules(m);m.targets=Array.isArray(m.targets)?m.targets:[];return m}
function legacyRules(m){const out=[];Object.entries(m.fields||{}).forEach(([src,r])=>out.push({source:src,target_table:r.target_table||m.target?.table||"Fonctionnalites",target_column:r.grist_column||r.target_column||r.column||"",business_type:r.business_type||"Texte",grist_type:r.grist_type||r.type||"",identify:r.identify||"",ref_table:r.ref_table||r.reference?.table||"",ref_match:r.ref_match||r.reference?.match_column||"Nom",create_if_missing:r.create_if_missing??r.reference?.create_if_missing??false}));return out}
function switchView(id){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("hidden",v.id!==id));document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.view===id));if(id==="mappings")renderEditor();if(id==="simulate")renderSimulation()}
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
$("importMapBtn").onclick=()=>$("mapFile").click();$("mapFile").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{let m=normalize(JSON.parse(r.result),state.family);let fam=["produit","projet","autre"].includes(m.mapping_type)?m.mapping_type:"autre";m.mapping_type=fam;if(state.library[fam].some(x=>x.mapping_id===m.mapping_id))m.mapping_id+="_"+Date.now().toString().slice(-4);state.library[fam].push(m);state.family=fam;state.mappingId=m.mapping_id;saveLib();renderMappingSelectors();renderEditor()}catch(x){msg("Mapping invalide")}};r.readAsText(f)};
$("exportMapBtn").onclick=()=>{const m=activeMapping();if(m)download(m,slug(m.name)+".json")};

function renderEditor(){
 renderMappingSelectors();const m=activeMapping();if(!m){$("sourceFields").innerHTML="Aucun mapping.";$("rules").innerHTML="";$("targetFields").innerHTML="";return}
 $("mapName").value=m.name;$("mapId").value=m.mapping_id;$("mapDescription").value=m.description||"";
 const src=[...new Set(m.rules.map(r=>r.source))];$("sourceFields").innerHTML=src.map(s=>`<div class="fieldcard"><b>${s}</b><small>${infer(rowsOf(state.dataWork)[0]?.[s])}</small></div>`).join("")||"<div class=summary>Ajoute un champ source.</div>";
 $("rules").innerHTML=m.rules.map((r,i)=>ruleHtml(r,i)).join("")||"<div class=summary>Aucune liaison. Ajoute un champ source.</div>";
 const targets=allTargets();$("targetFields").innerHTML=targets.map(t=>`<div class="targetcard"><b>${t.table}.${t.column}</b><small>${t.type||"type non chargé"}</small></div>`).join("")||"<div class=summary>Connecte Grist ou ajoute une cible manuelle.</div>";
 $("mappingJson").value=JSON.stringify(m,null,2);
}
function ruleHtml(r,i){const tables=[...new Set(["",...Object.keys(state.schema),r.target_table].filter(x=>x!=null))];const cols=(state.schema[r.target_table]||[]).map(c=>c.id||c.colId||c.label);if(r.target_column&&!cols.includes(r.target_column))cols.push(r.target_column);return `<div class="rulecard" data-i="${i}">
<input class="r-source" value="${esc(r.source)}" placeholder="champ JSON">
<select class="r-table">${tables.map(x=>`<option ${x===r.target_table?"selected":""}>${esc(x)}</option>`).join("")}</select>
<select class="r-col"><option></option>${cols.map(x=>`<option ${x===r.target_column?"selected":""}>${esc(x)}</option>`).join("")}</select>
<select class="r-business">${BUSINESS_TYPES.map(x=>`<option ${x===r.business_type?"selected":""}>${x}</option>`).join("")}</select>
<button class="danger r-del">×</button></div>`}
function esc(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
$("rules").onchange=e=>{const card=e.target.closest(".rulecard");if(!card)return;const i=+card.dataset.i,m=activeMapping(),r=m.rules[i];r.source=card.querySelector(".r-source").value;r.target_table=card.querySelector(".r-table").value;r.target_column=card.querySelector(".r-col").value;r.business_type=card.querySelector(".r-business").value;saveLib();renderEditor()};
$("rules").onclick=e=>{if(!e.target.classList.contains("r-del"))return;const i=+e.target.closest(".rulecard").dataset.i;activeMapping().rules.splice(i,1);saveLib();renderEditor()};
$("addSourceBtn").onclick=()=>{const m=activeMapping();if(!m)return;const s=prompt("Champ JSON :");if(s){m.rules.push({source:s,target_table:"",target_column:"",business_type:"Texte",grist_type:"",identify:"",ref_table:"",ref_match:"Nom",create_if_missing:false});saveLib();renderEditor()}};
$("addTargetBtn").onclick=()=>{const m=activeMapping();if(!m)return;const table=prompt("Table cible :");if(!table)return;const column=prompt("Colonne cible :");if(!column)return;const type=prompt("Type Grist :","Text")||"Text";m.targets.push({table,column,type});saveLib();renderEditor()};
["mapName","mapDescription"].forEach(id=>$(id).onchange=()=>{const m=activeMapping();if(!m)return;m.name=$("mapName").value;m.description=$("mapDescription").value;saveLib();renderMappingSelectors()});
$("applyMappingJson").onclick=()=>{try{const n=normalize(JSON.parse($("mappingJson").value),state.family),arr=state.library[state.family],i=arr.findIndex(x=>x.mapping_id===state.mappingId);n.mapping_id=state.mappingId;arr[i]=n;saveLib();renderEditor();msg("JSON appliqué")}catch(e){msg("JSON invalide")}}

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
