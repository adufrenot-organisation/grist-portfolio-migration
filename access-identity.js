/*
 * access-identity.js v1.1.0
 * Adaptateur d'identité autonome pour les widgets PMO sans presence.js.
 *
 * Ordre de résolution :
 *  1. tente l'API /access si Grist marque explicitement l'utilisateur courant ;
 *  2. sinon crée une ligne-sonde dans SESSIONS_UTILISATEURS. Les colonnes
 *     Utilisateur_Email / Utilisateur_Nom doivent être alimentées par les
 *     trigger formulas Grist user.Email / user.Name à la création ;
 *  3. relit cette ligne et retourne l'identité réellement fournie par Grist.
 *
 * Cela évite de dépendre d'un autre widget Presence déjà ouvert.
 */
(() => {
  "use strict";

  const VERSION = "1.1.0";
  const SESSION_TABLE = "SESSIONS_UTILISATEURS";

  // Si un vrai presence.js est déjà chargé, ne pas l'écraser.
  if (window.PmoPresence?.currentUser && !window.PmoPresence.__identityAdapter) return;

  function rows(data) {
    if (!data || !Array.isArray(data.id)) return [];
    const keys = Object.keys(data);
    return data.id.map((_, i) => Object.fromEntries(
      keys.map(k => [k, Array.isArray(data[k]) ? data[k][i] : data[k]])
    ));
  }

  function first(obj, names) {
    for (const name of names) {
      const v = obj?.[name];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return "";
  }

  function sessionId() {
    try {
      const key = "pmo.migration.identitySessionId";
      let id = sessionStorage.getItem(key);
      if (!id) {
        id = `migration-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        sessionStorage.setItem(key, id);
      }
      return id;
    } catch (_) {
      return `migration-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  async function fromAccessEndpoint() {
    try {
      const t = await grist.docApi.getAccessToken({readOnly: true});
      if (!t?.baseUrl || !t?.token) return null;
      const url = `${String(t.baseUrl).replace(/\/+$/, "")}/access?auth=${encodeURIComponent(t.token)}`;
      const r = await fetch(url, {method: "GET", credentials: "omit"});
      if (!r.ok) return null;
      const b = await r.json();
      const users = Array.isArray(b?.users) ? b.users : [];
      const me = users.find(u => u.isCurrentUser || u.is_current_user || u.currentUser || u.self || u.isSelf);
      if (!me?.email) return null;
      return {email: me.email, name: me.name || me.email, source: "access"};
    } catch (e) {
      console.warn("[Migration identity] /access indisponible", e);
      return null;
    }
  }

  async function fromSessionProbe() {
    try {
      const tables = await grist.docApi.listTables();
      if (!tables.includes(SESSION_TABLE)) {
        console.warn(`[Migration identity] Table ${SESSION_TABLE} absente`);
        return null;
      }

      let data = await grist.docApi.fetchTable(SESSION_TABLE);
      const columns = new Set(Object.keys(data || {}));
      if (!columns.has("Session_ID")) {
        console.warn(`[Migration identity] Colonne ${SESSION_TABLE}.Session_ID absente`);
        return null;
      }

      const sid = sessionId();
      let row = rows(data).find(r => String(r.Session_ID || "") === sid);

      if (!row) {
        const fields = {Session_ID: sid};
        // N'envoyer que des colonnes réellement présentes dans le document.
        if (columns.has("Module")) fields.Module = "MIGRATION";
        if (columns.has("Widget_Code")) fields.Widget_Code = "MIGRATION";
        if (columns.has("Widget_Version")) fields.Widget_Version = "identity-1.1.0";
        if (columns.has("Contexte")) fields.Contexte = "Contrôle d'accès";
        if (columns.has("Page")) fields.Page = "Contrôle d'accès";
        if (columns.has("Actif")) fields.Actif = true;
        if (columns.has("Derniere_Activite")) fields.Derniere_Activite = Math.floor(Date.now() / 1000);

        await grist.docApi.applyUserActions([["AddRecord", SESSION_TABLE, null, fields]]);
        // Les trigger formulas sont calculées côté Grist : relire la table.
        data = await grist.docApi.fetchTable(SESSION_TABLE);
        row = rows(data).find(r => String(r.Session_ID || "") === sid);
      }

      if (!row) return null;
      const email = first(row, ["Utilisateur_Email", "Email", "email"]);
      const name = first(row, ["Utilisateur_Nom", "Nom", "name", "Name"]);
      if (!email) {
        console.warn(
          "[Migration identity] La ligne de session a été créée mais Utilisateur_Email est vide. " +
          "Vérifier la trigger formula user.Email à la création."
        );
        return null;
      }
      return {email: String(email).trim(), name: String(name || email).trim(), source: "session-probe"};
    } catch (e) {
      console.warn("[Migration identity] Sonde SESSIONS_UTILISATEURS indisponible", e);
      return null;
    }
  }

  async function currentUser() {
    const accessUser = await fromAccessEndpoint();
    if (accessUser?.email) return accessUser;

    const sessionUser = await fromSessionProbe();
    if (sessionUser?.email) return sessionUser;

    return {email: "", name: "", source: "unresolved"};
  }

  window.PmoPresence = {
    ...(window.PmoPresence || {}),
    VERSION,
    __identityAdapter: true,
    currentUser
  };
})();
