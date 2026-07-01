/**
 * Hermes Notes V2 — couche de stockage local (IndexedDB).
 * Fonctionne dans Chrome/Edge, Electron (renderer) et Android WebView (Capacitor).
 * Scripts classiques (pas d'ESM) pour compatibilité file:// dans Electron.
 */
'use strict';

(function () {
  const DB_NAME = 'hermes-notes-v2';
  const DB_VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('backups')) db.createObjectStore('backups', { keyPath: 'ts' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(store, mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const result = fn(s);
      t.oncomplete = () => resolve(result && result.__req ? result.__req.result : result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('transaction_aborted'));
    }));
  }

  function reqToPromise(store, mode, makeReq) {
    return open().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const req = makeReq(t.objectStore(store));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  }

  window.DB = {
    // Notes
    getAllNotes: () => reqToPromise('notes', 'readonly', s => s.getAll()),
    getNote: id => reqToPromise('notes', 'readonly', s => s.get(id)),
    putNote: note => reqToPromise('notes', 'readwrite', s => s.put(note)),
    /**
     * Lecture + modification + écriture dans UNE transaction IndexedDB.
     * Indispensable contre les courses entre l'auto-save et le moteur de sync :
     * le mutator (synchrone) reçoit la version stockée (ou null) et renvoie
     * l'objet à écrire, ou null pour ne rien écrire.
     */
    mutateNote: (id, mutator) => open().then(db => new Promise((resolve, reject) => {
      const t = db.transaction('notes', 'readwrite');
      const s = t.objectStore('notes');
      const g = s.get(id);
      let out = null;
      g.onsuccess = () => {
        try {
          out = mutator(g.result || null);
          if (out) s.put(out);
        } catch (e) { try { t.abort(); } catch { /* déjà terminée */ } reject(e); }
      };
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('transaction_aborted'));
    })),
    putNotes: notes => tx('notes', 'readwrite', s => { notes.forEach(n => s.put(n)); }),
    deleteNote: id => reqToPromise('notes', 'readwrite', s => s.delete(id)),
    clearNotes: () => reqToPromise('notes', 'readwrite', s => s.clear()),

    // Meta (session, réglages, curseur de sync, journal)
    metaGet: key => reqToPromise('meta', 'readonly', s => s.get(key)).then(r => (r ? r.value : undefined)),
    metaSet: (key, value) => reqToPromise('meta', 'readwrite', s => s.put({ key, value })),
    metaDelete: key => reqToPromise('meta', 'readwrite', s => s.delete(key)),

    // Backups locaux (instantanés roulants)
    addBackup: snapshot => reqToPromise('backups', 'readwrite', s => s.put(snapshot)),
    getBackups: () => reqToPromise('backups', 'readonly', s => s.getAll()),
    deleteBackup: ts => reqToPromise('backups', 'readwrite', s => s.delete(ts)),
  };
})();
