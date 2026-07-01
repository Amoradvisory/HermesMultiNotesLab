/**
 * Hermes Notes V2 — moteur de synchronisation offline-first.
 *
 * Principes :
 *  - IndexedDB est la source de vérité immédiate : toute action utilisateur est
 *    d'abord écrite localement (flag dirty = file d'attente de changements).
 *  - La sync pousse les notes dirty avec leur baseRev (dernière révision serveur
 *    connue) puis tire les nouveautés (rev > lastRev).
 *  - Conflit (baseRev obsolète) : le serveur garde sa version ; le client crée
 *    une « copie de conflit » avec la version locale. AUCUNE perte silencieuse.
 *  - Déclencheurs : démarrage, après chaque changement (debounce), toutes les
 *    60 s, événement window 'online', bouton manuel.
 */
'use strict';

(function () {
  const state = {
    status: 'offline',        // offline | syncing | synced | error | idle
    lastError: null,
    lastSyncAt: null,
    syncing: false,
    pendingAgain: false,
    log: [],                  // {at, reason, pushed, pulled, conflicts, ok, detail}
    listeners: [],
    timer: null,
    debounceTimer: null,
    getSession: null,         // () => {token, serverUrl, clientId}
    onNotesChanged: null,     // callback UI après application de changements distants
  };

  const nowIso = () => new Date().toISOString();

  function notify() { state.listeners.forEach(fn => { try { fn(publicState()); } catch { /* listener UI défaillant */ } }); }

  function publicState() {
    return {
      status: state.status,
      lastError: state.lastError,
      lastSyncAt: state.lastSyncAt,
      pendingCount: state.pendingCount || 0,
      log: state.log.slice(),
    };
  }

  async function loadLog() {
    state.log = (await DB.metaGet('syncLog')) || [];
  }

  async function addLog(entry) {
    state.log.unshift({ at: nowIso(), ...entry });
    state.log = state.log.slice(0, 30);
    await DB.metaSet('syncLog', state.log);
  }

  function wireFormat(note) {
    return {
      id: note.id,
      baseRev: note.rev || 0,
      title: note.title,
      content: note.content,
      tags: note.tags || [],
      pinned: !!note.pinned,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      archivedAt: note.archivedAt || null,
      deletedAt: note.deletedAt || null,
    };
  }

  function sameContent(a, b) {
    return a.title === b.title && a.content === b.content &&
      JSON.stringify(a.tags || []) === JSON.stringify(b.tags || []) &&
      !!a.pinned === !!b.pinned &&
      (a.archivedAt || null) === (b.archivedAt || null) &&
      (a.deletedAt || null) === (b.deletedAt || null);
  }

  function conflictCopy(local) {
    const stamp = new Date();
    const label = stamp.toLocaleDateString('fr-FR') + ' ' + stamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return {
      id: crypto.randomUUID(),
      title: `${local.title || 'Sans titre'} (copie de conflit ${label})`,
      content: local.content,
      tags: (local.tags || []).concat(['conflit']),
      pinned: !!local.pinned,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      archivedAt: local.archivedAt || null,
      deletedAt: null,
      rev: 0,
      dirty: true,
      conflictOf: local.id,
    };
  }

  async function computePendingCount() {
    const notes = await DB.getAllNotes();
    state.pendingCount = notes.filter(n => n.dirty).length;
  }

  /**
   * Une passe de synchronisation complète (push + pull + résolution de conflits).
   * Sérialisée entre onglets/fenêtres via Web Locks : sans ce verrou, deux
   * onglets pousseraient la même note avec le même baseRev -> faux conflits.
   */
  async function syncNow(reason = 'manuel') {
    if (navigator.locks && navigator.locks.request) {
      return navigator.locks.request('hermes-notes-sync', () => doSync(reason));
    }
    return doSync(reason);
  }

  async function doSync(reason) {
    const session = state.getSession ? state.getSession() : null;
    if (!session || !session.token || !session.serverUrl) return { skipped: true };

    if (state.syncing) { state.pendingAgain = true; return { queued: true }; }
    state.syncing = true;
    state.status = 'syncing';
    notify();

    let pushed = 0, pulled = 0, conflicts = 0;
    try {
      const allNotes = await DB.getAllNotes();
      const dirty = allNotes.filter(n => n.dirty);
      // Instantané de ce qui part : si la note bouge pendant la requête, elle reste dirty.
      const sentSnapshot = new Map(dirty.map(n => [n.id, n.updatedAt]));
      const lastRev = (await DB.metaGet('lastRev')) || 0;

      const res = await API.sync(session.serverUrl, session.token, {
        clientId: session.clientId,
        lastRev,
        changes: dirty.slice(0, 400).map(wireFormat),
      });

      // 1) Changements acceptés -> baseRev à jour, dirty levé (si non re-modifiée
      //    entre-temps). Transaction atomique : l'auto-save peut écrire en parallèle.
      for (const ap of res.applied || []) {
        const updated = await DB.mutateNote(ap.id, cur => {
          if (!cur) return null;
          cur.rev = ap.rev;
          if (sentSnapshot.get(ap.id) === cur.updatedAt) cur.dirty = false;
          return cur;
        });
        if (updated) pushed++;
      }

      // 2) Conflits -> copie de conflit locale + adoption de la version serveur
      for (const cf of res.conflicts || []) {
        const server = cf.server;
        const local = await DB.getNote(cf.id);
        if (!local) { await DB.putNote({ ...server, dirty: false }); continue; }
        if (sameContent(local, server)) {
          // Même contenu des deux côtés : rien à copier, on aligne la révision.
          await DB.mutateNote(cf.id, cur => (cur ? { ...cur, rev: server.rev, dirty: false } : null));
          continue;
        }
        conflicts++;
        if (!local.deletedAt || server.deletedAt) {
          // La version locale a de la valeur -> copie de conflit (sera poussée au prochain tour)
          await DB.putNote(conflictCopy(local));
        }
        // Adoption de la version serveur pour la note d'origine
        await DB.mutateNote(cf.id, () => ({ ...server, dirty: false }));
      }

      // 3) Nouveautés du serveur (autres appareils) -> appliquées si la note locale n'est pas dirty
      for (const ch of res.changes || []) {
        const written = await DB.mutateNote(ch.id, cur => {
          if (!cur) return { ...ch, dirty: false };
          if (!cur.dirty && (cur.rev || 0) < ch.rev) return { ...ch, dirty: false };
          return null; // locale dirty : le prochain push tranchera (conflit contrôlé)
        });
        if (written) pulled++;
      }

      await DB.metaSet('lastRev', res.serverRev);
      state.lastSyncAt = nowIso();
      state.status = 'synced';
      state.lastError = null;
      await addLog({ reason, ok: true, pushed, pulled, conflicts });
    } catch (err) {
      state.status = err.offline ? 'offline' : 'error';
      state.lastError = err.message;
      if (err.status === 401) state.lastError = 'session_expiree';
      await addLog({ reason, ok: false, detail: err.message });
    } finally {
      await computePendingCount();
      state.syncing = false;
      notify();
      if (state.pendingAgain || state.pendingCount > 0 && state.status === 'synced') {
        const again = state.pendingAgain;
        state.pendingAgain = false;
        // Copies de conflit fraîchement créées ou changements arrivés pendant la sync
        if (again || state.pendingCount > 0) setTimeout(() => syncNow('suite'), 800);
      }
    }
    if (pulled > 0 || conflicts > 0) {
      if (state.onNotesChanged) state.onNotesChanged();
      broadcast('notes-changed'); // rafraîchir les autres onglets/fenêtres
    }
    return { pushed, pulled, conflicts };
  }

  // Canal inter-onglets : un onglet qui modifie/synchronise prévient les autres.
  let channel = null;
  function broadcast(type) {
    try { if (channel) channel.postMessage({ type }); } catch { /* canal fermé */ }
  }

  function scheduleSync(reason = 'changement') {
    computePendingCount().then(notify);
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => syncNow(reason), 1500);
  }

  function init({ getSession, onNotesChanged }) {
    state.getSession = getSession;
    state.onNotesChanged = onNotesChanged;
    loadLog().then(() => notify());

    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel('hermes-notes');
      channel.onmessage = ev => {
        if (ev.data && ev.data.type === 'notes-changed' && state.onNotesChanged) state.onNotesChanged();
      };
    }

    window.addEventListener('online', () => syncNow('retour en ligne'));
    window.addEventListener('offline', () => { state.status = 'offline'; notify(); });

    clearInterval(state.timer);
    state.timer = setInterval(() => syncNow('périodique'), 60000);
  }

  window.SyncEngine = {
    init,
    syncNow,
    scheduleSync,
    notifyLocalChange: () => broadcast('notes-changed'),
    onChange: fn => state.listeners.push(fn),
    getState: publicState,
    conflictCopy, // exposé pour les tests
  };
})();
