/*
 * access-identity.js v1.0.0
 * Adaptateur identité pour les widgets sans presence.js.
 * Lit l'utilisateur courant depuis la table SESSIONS_UTILISATEURS si disponible,
 * en privilégiant la session la plus récente. En contexte PMO, cette table est
 * alimentée par les autres widgets avec les formules user.Email / user.Name.
 */
(() => {
  if (window.PmoPresence?.currentUser) return;
  function rows(data){
    if(!data||!Array.isArray(data.id))return[];
    const keys=Object.keys(data);
    return data.id.map((_,i)=>Object.fromEntries(keys.map(k=>[k,Array.isArray(data[k])?data[k][i]:data[k]])));
  }
  async function currentUser(){
    // L'API d'accès peut renvoyer l'utilisateur courant explicitement selon version Grist.
    try{
      const t=await grist.docApi.getAccessToken({readOnly:true});
      if(t?.baseUrl&&t?.token){
        const r=await fetch(`${String(t.baseUrl).replace(/\/+$/,"")}/access?auth=${encodeURIComponent(t.token)}`);
        if(r.ok){
          const b=await r.json();
          const users=Array.isArray(b?.users)?b.users:[];
          const me=users.find(u=>u.isCurrentUser||u.is_current_user||u.currentUser||u.self);
          if(me?.email)return {email:me.email,name:me.name||me.email};
        }
      }
    }catch(e){console.warn("[Migration identity] /access",e)}
    return {email:"",name:""};
  }
  window.PmoPresence={currentUser};
})();