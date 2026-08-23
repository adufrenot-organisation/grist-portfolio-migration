(function(){
  const el=id=>document.getElementById(id);
  function norm(v){return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().replace(/\s+/g," ").toLowerCase()}
  function sourceName(r){return r?.json_field||r?.source||r?.original_definition?.json_field||r?.original_field_key||""}
  function schemaCol(t,c){return (state.schema?.[t]||[]).find(x=>(x.id||x.colId)===c)||null}
  function cachedRows(t){return tableDataToRows(state.gristTableData?.[t])}
  function cmp(v){return v==null?"":Array.isArray(v)?JSON.stringify(v):String(v)}
  function same(row,fields){return Object.entries(fields).every(([k,v])=>cmp(row?.[k])===cmp(v))}
  function dateValue(v,r){
    if(v==null||v==="")return null;
    if(typeof v==="number")return v>1e12?Math.floor(v/1000):Math.floor(v);
    const s=String(v).trim(),m=s.match(/^(\d{4})-T([1-4])$/i);
    if(m){
      const y=+m[1],q=+m[2],qr=r?.transform?.quarter_rule||"end_of_quarter";
      if(qr==="start_of_quarter")return Math.floor(Date.UTC(y,(q-1)*3,1)/1000);
      const month=q*3,day=new Date(Date.UTC(y,month,0)).getUTCDate();
      return Math.floor(Date.UTC(y,month-1,day)/1000);
    }
    const ms=Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(s)?s+"T00:00:00Z":s);
    return Number.isFinite(ms)?Math.floor(ms/1000):null;
  }
  function transform(v,r){
    if(v==="__CLEAR__")return null;
    if(v==null||v==="")return v;
    try{if(typeof v29ApplyTransform==="function"&&r?.transform){const x=v29ApplyTransform(v,r.transform);if(x!==undefined)return x}}catch(_){}
    const t=String(r?.grist_type||""),bt=String(r?.business_type||""),tr=typeof r?.transform==="string"?r.transform:(r?.transform?.type||"");
    if(tr==="to_string")return String(v);
    if(tr==="normalize_percentage_or_number"||bt==="Pourcentage"){let n=typeof v==="string"&&v.includes("%")?parseFloat(v.replace(",",".").replace("%",""))/100:Number(v);if(Number.isFinite(n)&&n>1&&n<=100)n/=100;return Number.isFinite(n)?n:null}
    if(t==="Numeric"||bt==="Nombre"){const n=Number(String(v).replace(",","."));return Number.isFinite(n)?n:null}
    if(t==="Bool"||bt==="Booléen"){if(typeof v==="boolean")return v;return /^(1|true|oui|yes|actif)$/i.test(String(v).trim())}
    if(t==="Date"||bt==="Date"||tr==="period_to_date")return dateValue(v,r);
    return v;
  }

  function setMode(mode){
    graphState.editorMode=mode;
    [["graphicalMappingView","graph"],["manualMappingView","table"],["rawMappingView","json"]].forEach(([id,k])=>el(id)?.classList.toggle("hidden",k!==mode));
    [["mappingViewGraph","graph"],["mappingViewTable","table"],["mappingViewJson","json"]].forEach(([id,k])=>el(id)?.classList.toggle("active",k===mode));
    if(mode==="graph"){graphRender();requestAnimationFrame(()=>requestAnimationFrame(()=>graphDraw()))}
    else if(mode==="table")renderManualMapping();
    else{syncRawV28();const st=el("rawJsonStatus");if(st){st.textContent="Synchronisé avec le mapping courant";st.className="raw-json-ok"}}
  }
  window.setMappingMode=setMode;
  if(el("mappingViewGraph"))el("mappingViewGraph").onclick=()=>setMode("graph");
  if(el("mappingViewTable"))el("mappingViewTable").onclick=()=>setMode("table");
  if(el("mappingViewJson"))el("mappingViewJson").onclick=()=>setMode("json");

  const raw=el("rawMappingEditor");
  if(raw){
    raw.oninput=()=>{const st=el("rawJsonStatus");try{JSON.parse(raw.value);if(st){st.textContent="JSON valide — non appliqué";st.className="raw-json-ok"}}catch(e){if(st){st.textContent="JSON invalide : "+e.message;st.className="raw-json-error"}}};
    raw.onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();el("rawApplyBtn")?.click()}};
  }

  let drag=null,clickSource=null;
  function point(e){const w=el("graphCanvasWrap");if(!w)return null;const r=w.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
  document.addEventListener("pointerdown",e=>{const p=e.target.closest?.(".source-port");if(!p)return;drag=p.dataset.source;graphState.dragSource=drag;graphState.tempPoint=point(e);document.body.classList.add("mapping-dragging");e.preventDefault()},true);
  document.addEventListener("pointermove",e=>{if(!drag)return;graphState.tempPoint=point(e);graphDraw()},true);
  document.addEventListener("pointerup",e=>{if(!drag)return;const s=drag;drag=null;graphState.dragSource=null;graphState.tempPoint=null;document.body.classList.remove("mapping-dragging");const t=document.elementFromPoint(e.clientX,e.clientY)?.closest?.(".target-port");if(t)graphAddConnection(s,t.dataset.table,t.dataset.column);else graphDraw()},true);
  document.addEventListener("click",e=>{const sp=e.target.closest?.(".source-port");if(sp){clickSource=sp.dataset.source;document.querySelectorAll(".source-port").forEach(x=>x.classList.toggle("armed",x===sp));return}const tp=e.target.closest?.(".target-port");if(tp&&clickSource){graphAddConnection(clickSource,tp.dataset.table,tp.dataset.column);clickSource=null;document.querySelectorAll(".source-port").forEach(x=>x.classList.remove("armed"))}},true);

  const addBase=graphAddConnection;
  graphAddConnection=function(s,t,c){addBase(s,t,c);try{renderManualMapping()}catch(_){}try{syncRawV28()}catch(_){}};

  function resolveColumnId(table,wanted){
    const cols=state.schema?.[table]||[];
    const raw=String(wanted||"").trim();
    if(!raw)return raw;

    // Exact technical ID first.
    let c=cols.find(x=>(x.id||x.colId)===raw);
    if(c)return c.id||c.colId;

    // Case-insensitive technical ID.
    c=cols.find(x=>norm(x.id||x.colId)===norm(raw));
    if(c)return c.id||c.colId;

    // Then label, useful when a mapping was produced from a display label.
    c=cols.find(x=>norm(x.label||"")===norm(raw));
    if(c)return c.id||c.colId;

    return null;
  }

  function normalizeCreateFields(table,fields){
    const out={},unknown=[];
    for(const [key,value] of Object.entries(fields||{})){
      const resolved=resolveColumnId(table,key);
      if(!resolved)unknown.push(key);
      else out[resolved]=value;
    }
    return {fields:out,unknown};
  }

  async function resolveRef(value,r,mode="simulate"){
    if(value==null||value==="")return{value:null};

    const table=r.ref_table||String(r.grist_type||"").split(":")[1]||r.reference?.table||"";
    if(!table)return{error:`${sourceName(r)} : table de référence inconnue`};

    try{await ensureGristTableLoaded(table)}
    catch(e){return{error:`${table} : ${e.message}`}}

    const requestedLookup=r.ref_match||r.reference?.lookup_column||r.reference?.match_column||"Nom";
    const lookup=resolveColumnId(table,requestedLookup);
    if(!lookup){
      const available=(state.schema?.[table]||[]).map(c=>c.id||c.colId).filter(Boolean).join(", ");
      return{error:`${table} : colonne de rapprochement "${requestedLookup}" introuvable. Colonnes : ${available}`};
    }

    const rows=cachedRows(table);
    const hits=rows.filter(x=>norm(x[lookup])===norm(value));

    if(hits.length===1)return{
      value:hits[0].id,
      detail:`${table}.${lookup}="${value}" → #${hits[0].id}`
    };
    if(hits.length>1)return{
      error:`${table}.${lookup} : plusieurs correspondances pour "${value}"`
    };

    const allow=r.create_if_missing??r.reference?.create_if_missing??false;
    if(!allow)return{
      error:`${table}.${lookup} : "${value}" introuvable et création interdite`
    };

    const rawCreateFields={};
    const tpl=r.reference?.create_fields||{};
    if(Object.keys(tpl).length){
      Object.entries(tpl).forEach(([k,v])=>rawCreateFields[k]=v==="$value"?value:v);
    }else{
      rawCreateFields[lookup]=value;
    }

    const normalized=normalizeCreateFields(table,rawCreateFields);
    if(normalized.unknown.length){
      return{
        error:`${table} : champ(s) de création inconnu(s) : ${normalized.unknown.join(", ")}`
      };
    }

    // Ensure the lookup itself is always populated on a newly created reference.
    if(!Object.prototype.hasOwnProperty.call(normalized.fields,lookup)){
      normalized.fields[lookup]=value;
    }

    const payloadText=Object.entries(normalized.fields)
      .map(([k,v])=>`${k}=${JSON.stringify(v)}`).join(", ");

    if(mode==="simulate"){
      return{
        pending:{
          table,
          lookup,
          sourceValue:value,
          createFields:normalized.fields
        },
        detail:`${table}.${lookup}="${value}" absent → CREATE ${table} (${payloadText})`
      };
    }

    try{
      await grist.docApi.applyUserActions([["AddRecord",table,null,normalized.fields]]);
    }catch(e){
      throw new Error(`CREATE ${table} impossible [${payloadText}] : ${e?.message||e}`);
    }

    state.gristTableData[table]=await grist.docApi.fetchTable(table);

    const created=cachedRows(table).filter(x=>norm(x[lookup])===norm(value));
    if(created.length!==1){
      return{error:`Référence créée dans ${table}, mais impossible de retrouver ${lookup}="${value}"`};
    }

    return{
      value:created[0].id,
      detail:`CREATE ${table} #${created[0].id}`
    };
  }

  function normalizeRefListInput(value){
    if(value==null||value==="")return [];
    if(Array.isArray(value))return value.filter(v=>v!==null&&v!=="");
    if(typeof value==="string"){
      const s=value.trim();
      if(!s)return [];
      // JSON array string.
      if(s.startsWith("[")&&s.endsWith("]")){
        try{
          const arr=JSON.parse(s);
          if(Array.isArray(arr))return arr.filter(v=>v!==null&&v!=="");
        }catch(_){}
      }
      // Common separators for imported data.
      return s.split(/\s*[;|]\s*/).filter(Boolean);
    }
    return [value];
  }

  async function resolveRefList(value,r,mode="simulate"){
    const values=normalizeRefListInput(value);
    const ids=[],pending=[],details=[],errors=[];

    for(const item of values){
      const rr=await resolveRef(item,r,mode);
      if(rr.error){errors.push(rr.error);continue}
      if(rr.pending){
        pending.push({...rr.pending,sourceValue:item});
        details.push(rr.detail||`${item} → création prévue`);
      }else{
        ids.push(rr.value);
        details.push(rr.detail||`${item} → #${rr.value}`);
      }
    }

    return {
      value: ids,
      pending,
      details,
      errors
    };
  }

  function matchGroups(m,rules,fields){
    const out=[];
    for(const g of [m?.matching?.preferred_key,m?.matching?.fallback_key]){
      if(!Array.isArray(g)||!g.length)continue;
      const cols=[];
      for(const key of g){const nk=norm(key),r=rules.find(x=>norm(x.original_field_key)===nk||norm(sourceName(x))===nk||norm(x.target_column)===nk);if(r&&Object.prototype.hasOwnProperty.call(fields,r.target_column))cols.push(r.target_column)}
      if(cols.length===g.length)out.push(cols);
    }
    if(out.length)return out;
    const code=rules.find(r=>/^(code|id)$/i.test(String(r.target_column||""))&&fields[r.target_column]!=null);if(code)return[[code.target_column]];
    const name=rules.find(r=>/^(nom|name|titre|libelle)$/i.test(String(r.target_column||""))&&fields[r.target_column]!=null);return name?[[name.target_column]]:[];
  }
  function findMatch(table,fields,groups){
    const rows=cachedRows(table);
    for(const keys of groups){const hits=rows.filter(row=>keys.every(k=>norm(row[k])===norm(fields[k])));if(hits.length===1)return{row:hits[0],keys};if(hits.length>1)return{ambiguous:true,keys}}
    return{row:null,keys:groups[0]||[]}
  }
  async function preload(m){const tabs=[...new Set((m.rules||[]).flatMap(r=>[r.target_table,r.ref_table,r.reference?.table]).filter(Boolean))];for(const t of tabs){try{await ensureGristTableLoaded(t)}catch(e){console.warn("Préchargement",t,e)}}}
  async function buildPlan(){
    const m=activeMapping(),rows=rowsOf(state.dataWork);if(!m||!rows.length)return[];if(!state.gristReady)throw new Error("Contexte Grist non chargé.");await preload(m);
    const tables=[...new Set((m.rules||[]).map(r=>r.target_table).filter(Boolean))],plan=[];
    for(let i=0;i<rows.length;i++){
      for(const table of tables){
        const rules=(m.rules||[]).filter(r=>r.target_table===table&&r.target_column);if(!rules.length)continue;
        const fields={},trace=[],errors=[],pendingRefs=[];
        for(const r of rules){
          const src=sourceName(r),raw=r.source_type==="fixed_value"?r.fixed_value:rows[i][src];
          if(raw===undefined||raw===null||raw===""){if(r.required||/error/i.test(String(r.when_missing||"")))errors.push(`${src||r.target_column} : valeur obligatoire manquante`);continue}
          const col=schemaCol(table,r.target_column);if(!col){errors.push(`${table}.${r.target_column} : colonne absente`);continue}
          const colType=String(col.type||r.grist_type||"");
          const hasFormula=Boolean(col.isFormula)&&String(col.formula||"").trim()!=="";
          if(hasFormula && !colType.startsWith("Ref:") && !colType.startsWith("RefList:")){
            errors.push(`${table}.${r.target_column} : formule calculée non modifiable`);
            continue
          }
          let value=transform(raw,{...r,grist_type:col.type||r.grist_type});
          let refDetail="";
          const effectiveType=String(col.type||r.grist_type||"");
          if(effectiveType.startsWith("Ref:")){
            const rr=await resolveRef(value,{...r,grist_type:effectiveType},"simulate");
            if(rr.error)errors.push(rr.error);
            if(rr.pending)pendingRefs.push({column:r.target_column,kind:"Ref",...rr.pending});
            else value=rr.value;
            refDetail=rr.detail||"";
          }else if(effectiveType.startsWith("RefList:")){
            const rr=await resolveRefList(value,{...r,grist_type:effectiveType},"simulate");
            rr.errors.forEach(e=>errors.push(e));
            rr.pending.forEach(p=>pendingRefs.push({column:r.target_column,kind:"RefList",...p}));
            value=rr.value;
            refDetail=rr.details.join(" ; ");
          }
          fields[r.target_column]=value;
          trace.push({source:r.source_type==="fixed_value"?"[FIXE]":src,target:`${table}.${r.target_column}`,raw,refDetail})
        }
        const groups=matchGroups(m,rules,fields),match=findMatch(table,fields,groups);let action="CREATE",rowId=null;
        if(match.ambiguous){action="ERROR";errors.push(`${table} : rapprochement ambigu sur ${match.keys.join("+")}`)}else if(match.row){rowId=match.row.id;action=same(match.row,fields)?"SAME":"UPDATE"}if(errors.length)action="ERROR";
        plan.push({sourceRow:i+1,table,fields,trace,pendingRefs,matchKeys:match.keys||[],rowId,action,errors});
      }
    }
    return plan;
  }

  window.runSimulation=async function(){try{state.simulation=await buildPlan();renderSimulation()}catch(e){console.error(e);state.simulation=[];renderSimulation();msg("Simulation impossible : "+(e.message||e))}};
  window.renderSimulation=function(){
    const s=state.simulation||[],count=a=>s.filter(x=>x.action===a).length,err=s.filter(x=>x.errors?.length).length;
    el("simStats").innerHTML=[["Plans",s.length],["CREATE",count("CREATE")],["UPDATE",count("UPDATE")],["SAME",count("SAME")],["Erreurs",err]].map(([k,v])=>`<div class=stat><b>${v}</b>${k}</div>`).join("");
    {
      const pending=s.reduce((n,x)=>n+(x.pendingRefs?.length||0),0);
      el("simWarnings").innerHTML=`<div class="runtime-ok">✓ Moteur d'application réel v3.4.5 chargé</div>`+
        (pending?'<div class="warn">Des références absentes seront créées à l’application si autorisé.</div>':"");
    }
    el("simTable").innerHTML=s.length?`<table><thead><tr><th>Ligne</th><th>Table</th><th>Action</th><th>Clé / ID</th><th>Plan</th><th>Erreurs</th></tr></thead><tbody>${s.map(x=>`<tr><td>${x.sourceRow}</td><td>${graphEsc(x.table)}</td><td><b>${x.action}</b></td><td>${x.rowId?`#${x.rowId}`:(x.matchKeys||[]).map(k=>`${graphEsc(k)}=${graphEsc(x.fields[k])}`).join("<br>")||"nouveau"}</td><td>${x.trace.map(c=>`${graphEsc(c.target)} ← ${graphEsc(c.source)} = ${graphEsc(c.raw)}${c.refDetail?`<br><span class="sim-ref-detail">↳ ${graphEsc(c.refDetail)}</span>`:""}`).join("<br>")}</td><td>${(x.errors||[]).map(graphEsc).join("<br>")}</td></tr>`).join("")}</tbody></table>`:"Aucune simulation.";
    el("executeBtn").disabled=!s.length||err>0||!state.gristReady;
  };
  async function materialize(entry){
    const m=activeMapping();
    const rules=(m.rules||[]).filter(r=>r.target_table===entry.table&&r.target_column);
    const fields={...entry.fields};

    // Regroup pending references per target column.
    const grouped=new Map();
    for(const p of entry.pendingRefs||[]){
      if(!grouped.has(p.column))grouped.set(p.column,[]);
      grouped.get(p.column).push(p);
    }

    for(const [column,items] of grouped.entries()){
      const r=rules.find(x=>x.target_column===column);
      if(!r)throw new Error(`Règle de référence introuvable pour ${entry.table}.${column}`);

      const kind=items[0]?.kind||"Ref";

      if(kind==="Ref"){
        const p=items[0];
        const enriched={...r,reference:{...(r?.reference||{}),create_fields:p.createFields||r?.reference?.create_fields}};
        const rr=await resolveRef(p.sourceValue,enriched,"apply");
        if(rr.error)throw new Error(rr.error);
        fields[column]=rr.value;
      }else{
        // Preserve already-resolved IDs from simulation, then create/resolve missing ones.
        const resolved=Array.isArray(fields[column])?[...fields[column]]:[];
        for(const p of items){
          const enriched={...r,reference:{...(r?.reference||{}),create_fields:p.createFields||r?.reference?.create_fields}};
          const rr=await resolveRef(p.sourceValue,enriched,"apply");
          if(rr.error)throw new Error(rr.error);
          resolved.push(rr.value);
        }
        fields[column]=[...new Set(resolved.filter(v=>v!==null&&v!==""))];
      }
    }
    return fields;
  }
  window.applySimulation=async function(){
    const p=state.simulation||[];if(!state.gristReady){msg("Contexte Grist non chargé.");return}if(!p.length){msg("Lance d'abord la simulation.");return}if(p.some(x=>x.errors?.length)){msg("Corrige les erreurs avant d'appliquer.");return}
    const c=p.filter(x=>x.action==="CREATE").length,u=p.filter(x=>x.action==="UPDATE").length,s=p.filter(x=>x.action==="SAME").length;
    if(!confirm(`Appliquer ce plan dans Grist ?\n\n${c} création(s)\n${u} mise(s) à jour\n${s} inchangé(s)`))return;
    let done=0;el("executeBtn").disabled=true;
    try{for(const e of p){if(e.action==="SAME")continue;const fields=await materialize(e);await grist.docApi.applyUserActions([[e.action==="CREATE"?"AddRecord":"UpdateRecord",e.table,e.action==="CREATE"?null:e.rowId,fields]]);state.gristTableData[e.table]=await grist.docApi.fetchTable(e.table);done++}msg(`${done} opération(s) appliquée(s).`);await runSimulation()}
    catch(e){console.error(e);msg("Application interrompue : "+(e.message||e));await runSimulation()}
    finally{el("executeBtn").disabled=false}
  };

  if(el("goSimBtn")){
    el("goSimBtn").onclick=null;
    el("goSimBtn").addEventListener("click",()=>{switchView("simulate");runSimulation()});
  }
  if(el("runSimulationBtn")){
    el("runSimulationBtn").onclick=null;
    el("runSimulationBtn").addEventListener("click",()=>runSimulation());
  }
  if(el("executeBtn")){
    el("executeBtn").onclick=null;
    el("executeBtn").addEventListener("click",()=>applySimulation());
    el("executeBtn").dataset.runtime="3.4.1";
    el("executeBtn").title="Exécution réelle active — runtime 3.4.1";
  }

  window.addEventListener("resize",()=>{if(graphState.editorMode==="graph")graphDraw()});
  // Indicateur visible immédiatement, indépendant de la simulation.
  const boot=document.getElementById("runtimeBootStatus");
  if(boot){
    boot.textContent="✓ Runtime migration v3.4.5 chargé";
    boot.className="runtime-boot-ok";
  }

  // Capture des clics : empêche un ancien handler legacy de reprendre la main.
  document.addEventListener("click",e=>{
    const b=e.target.closest?.("#runSimulationBtn");
    if(!b)return;
    e.preventDefault();e.stopImmediatePropagation();
    window.runSimulation();
  },true);
  document.addEventListener("click",e=>{
    const b=e.target.closest?.("#executeBtn");
    if(!b)return;
    e.preventDefault();e.stopImmediatePropagation();
    window.applySimulation();
  },true);

  console.info("GRIST Migration PMO v3.4.5 runtime chargé");
})();
