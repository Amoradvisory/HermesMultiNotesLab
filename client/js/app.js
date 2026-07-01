/**
 * Hermes Notes V2 — application (UI + actions).
 * Offline-first : chaque action écrit d'abord dans IndexedDB (flag dirty),
 * puis le moteur de sync pousse vers le serveur quand le réseau le permet.
 */
'use strict';

(function () {
  const VERSION = '2.0.0';
  const TRASH_RETENTION_DAYS = 30;
  const BACKUPS_KEPT = 10;

  // ------------------------------------------------------------------
  // État
  // ------------------------------------------------------------------
  const state = {
    session: null,          // {token, user:{id,email}, serverUrl, clientId}
    notes: [],              // cache mémoire, source = IndexedDB
    view: 'all',            // all | pinned | archived | trash
    search: '',
    tagFilter: null,
    sortBy: 'updated',
    editingId: null,
    editingPersisted: false,
    autosaveTimer: null,
  };

  const $ = id => document.getElementById(id);
  const nowIso = () => new Date().toISOString();

  const POSITIVE_MESSAGES = [
    '✨ Organisation inspirante pour vos idées',
    '🌟 Chaque note est une étape vers la clarté',
    '💭 Pensez librement, organisez intelligemment',
    '🚀 Transformez vos idées en actions',
  ];

  // ------------------------------------------------------------------
  // Utilitaires UI
  // ------------------------------------------------------------------
  let toastTimer = null;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function download(filename, text, mime = 'application/octet-stream') {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ------------------------------------------------------------------
  // Données
  // ------------------------------------------------------------------
  async function reloadNotes() {
    state.notes = await DB.getAllNotes();
  }

  function isPurged(n) { return !!n.deletedAt && !n.title && !n.content; }

  async function persistNote(note) {
    const saved = await DB.mutateNote(note.id, cur => {
      // L'objet en mémoire (éditeur) peut être périmé : la révision serveur
      // ne doit JAMAIS régresser, sinon le prochain push part avec un baseRev
      // obsolète et fabrique un faux conflit.
      const rev = Math.max(cur ? cur.rev || 0 : 0, note.rev || 0);
      return { ...note, rev, dirty: true };
    });
    note.rev = saved.rev;
    note.dirty = true;
    await reloadNotes();
    render();
    SyncEngine.notifyLocalChange();
    SyncEngine.scheduleSync();
  }

  function visibleNotes() {
    let list = state.notes.filter(n => !isPurged(n));
    if (state.view === 'all') list = list.filter(n => !n.archivedAt && !n.deletedAt);
    if (state.view === 'pinned') list = list.filter(n => n.pinned && !n.archivedAt && !n.deletedAt);
    if (state.view === 'archived') list = list.filter(n => n.archivedAt && !n.deletedAt);
    if (state.view === 'trash') list = list.filter(n => n.deletedAt);
    if (state.tagFilter) list = list.filter(n => (n.tags || []).includes(state.tagFilter));
    if (state.search) {
      const q = state.search.toLowerCase();
      list = list.filter(n =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q) ||
        (n.tags || []).some(t => t.toLowerCase().includes(q)));
    }
    const cmp = {
      updated: (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''),
      created: (a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''),
      title: (a, b) => (a.title || '').localeCompare(b.title || '', 'fr', { sensitivity: 'base' }),
    }[state.sortBy];
    list.sort(cmp);
    if (state.view !== 'trash') {
      // Épinglées en tête (sauf dans la corbeille)
      list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    }
    return list;
  }

  // ------------------------------------------------------------------
  // Rendu
  // ------------------------------------------------------------------
  const VIEW_TITLES = { all: 'Notes', pinned: 'Épinglées', archived: 'Archivées', trash: 'Corbeille' };

  function render() {
    const list = visibleNotes();
    $('view-title').textContent = VIEW_TITLES[state.view];
    $('btn-empty-trash').hidden = !(state.view === 'trash' && list.length > 0);

    const banner = $('active-tag-banner');
    if (state.tagFilter) {
      banner.hidden = false;
      banner.innerHTML = `Tag : <strong>${escapeHtml(state.tagFilter)}</strong> <button id="btn-clear-tag">✕ retirer le filtre</button>`;
      banner.querySelector('#btn-clear-tag').onclick = () => { state.tagFilter = null; render(); };
    } else banner.hidden = true;

    const grid = $('notes-grid');
    grid.innerHTML = '';
    for (const n of list) {
      const card = document.createElement('div');
      card.className = 'note-card' + ((n.tags || []).includes('conflit') ? ' is-conflict' : '');
      card.innerHTML = `
        <div class="note-card-title">${n.pinned ? '<span class="pin">📌</span>' : ''}${escapeHtml(n.title || 'Sans titre')}</div>
        <div class="note-card-snippet">${escapeHtml((n.content || '').slice(0, 300))}</div>
        ${(n.tags || []).length ? `<div class="note-card-tags">${n.tags.map(t => `<span class="note-tag" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        <div class="note-card-meta">
          <span>${fmtDate(n.updatedAt)}</span>
          ${n.dirty ? '<span class="dirty-dot" title="En attente de synchronisation">●</span>' : ''}
          ${n.archivedAt && state.view !== 'archived' ? '<span>📁</span>' : ''}
        </div>`;
      card.addEventListener('click', e => {
        const tagEl = e.target.closest('.note-tag');
        if (tagEl) { state.tagFilter = tagEl.dataset.tag; state.view = 'all'; syncNav(); render(); e.stopPropagation(); return; }
        openEditor(n.id);
      });
      grid.appendChild(card);
    }

    const empty = $('empty-state');
    empty.hidden = list.length > 0;
    if (list.length === 0) {
      $('empty-text').textContent = {
        all: state.search || state.tagFilter ? 'Aucune note ne correspond à la recherche.' : 'Aucune note pour l\'instant. Créez votre première note !',
        pinned: 'Aucune note épinglée.',
        archived: 'Aucune note archivée.',
        trash: 'La corbeille est vide.',
      }[state.view];
    }

    renderTags();
  }

  function renderTags() {
    const tags = new Set();
    state.notes.filter(n => !n.deletedAt && !isPurged(n)).forEach(n => (n.tags || []).forEach(t => tags.add(t)));
    const wrap = $('tags-list');
    wrap.innerHTML = '';
    [...tags].sort((a, b) => a.localeCompare(b, 'fr')).forEach(t => {
      const b = document.createElement('button');
      b.className = 'tag-chip' + (state.tagFilter === t ? ' active' : '');
      b.textContent = '# ' + t;
      b.onclick = () => { state.tagFilter = state.tagFilter === t ? null : t; render(); };
      wrap.appendChild(b);
    });
    $('tags-section').style.display = tags.size ? '' : 'none';
  }

  function syncNav() {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
  }

  function renderSyncPill(s) {
    const pill = $('sync-pill');
    pill.className = 'sync-pill status-' + (s.status === 'idle' ? 'offline' : s.status);
    const labels = {
      offline: navigator.onLine ? 'hors ligne (serveur injoignable)' : 'hors ligne',
      syncing: 'synchronisation…',
      synced: 'synchronisé',
      error: s.lastError === 'session_expiree' ? 'session expirée' : 'erreur de sync',
      idle: 'en attente',
    };
    let label = labels[s.status] || s.status;
    if (s.pendingCount > 0 && s.status !== 'syncing') label += ` (${s.pendingCount} en attente)`;
    $('sync-label').textContent = label;
  }

  function renderJournal() {
    const s = SyncEngine.getState();
    const wrap = $('journal-list');
    wrap.innerHTML = s.log.length ? '' : '<p class="modal-hint">Aucune synchronisation pour l\'instant.</p>';
    for (const e of s.log) {
      const div = document.createElement('div');
      div.className = 'journal-entry';
      div.innerHTML = e.ok
        ? `<span class="ok">✓ ${escapeHtml(e.reason)}</span><span>↑${e.pushed} ↓${e.pulled}${e.conflicts ? ' ⚠' + e.conflicts : ''}</span><span>${fmtDate(e.at)}</span>`
        : `<span class="fail">✗ ${escapeHtml(e.reason)}</span><span>${escapeHtml(e.detail || '')}</span><span>${fmtDate(e.at)}</span>`;
      wrap.appendChild(div);
    }
  }

  // ------------------------------------------------------------------
  // Éditeur
  // ------------------------------------------------------------------
  function blankNote() {
    return {
      id: crypto.randomUUID(),
      title: '', content: '', tags: [], pinned: false,
      createdAt: nowIso(), updatedAt: nowIso(),
      archivedAt: null, deletedAt: null,
      rev: 0, dirty: true,
    };
  }

  let editingNote = null;

  function openEditor(id) {
    editingNote = id ? state.notes.find(n => n.id === id) : blankNote();
    if (!editingNote) return;
    state.editingId = editingNote.id;
    state.editingPersisted = !!id;

    $('editor-title').value = editingNote.title || '';
    $('editor-content').value = editingNote.content || '';
    $('editor-tags').value = (editingNote.tags || []).join(', ');
    updateEditorChrome();
    $('editor-overlay').hidden = false;
    if (!id) $('editor-title').focus();
  }

  function updateEditorChrome() {
    const n = editingNote;
    $('btn-editor-pin').classList.toggle('active', !!n.pinned);
    $('btn-editor-archive').classList.toggle('active', !!n.archivedAt);
    $('btn-editor-archive').title = n.archivedAt ? 'Désarchiver' : 'Archiver';
    const inTrash = !!n.deletedAt;
    $('btn-editor-trash').style.display = inTrash ? 'none' : '';
    $('btn-editor-restore').hidden = !inTrash;
    $('btn-editor-purge').hidden = !inTrash;
    $('editor-title').disabled = inTrash;
    $('editor-content').disabled = inTrash;
    $('editor-tags').disabled = inTrash;
    $('editor-meta').textContent =
      `Créée : ${fmtDate(n.createdAt)}  ·  Modifiée : ${fmtDate(n.updatedAt)}` +
      (n.archivedAt ? `  ·  Archivée : ${fmtDate(n.archivedAt)}` : '') +
      (n.deletedAt ? `  ·  Dans la corbeille depuis : ${fmtDate(n.deletedAt)}` : '') +
      `  ·  id ${n.id.slice(0, 8)}`;
  }

  function collectEditorFields() {
    const title = $('editor-title').value.trim();
    const content = $('editor-content').value;
    const tags = $('editor-tags').value.split(',').map(t => t.trim()).filter(Boolean);
    return { title, content, tags };
  }

  async function autosaveEditor() {
    if (!editingNote || editingNote.deletedAt) return;
    const { title, content, tags } = collectEditorFields();
    const changed = title !== editingNote.title || content !== editingNote.content ||
      JSON.stringify(tags) !== JSON.stringify(editingNote.tags || []);
    if (!changed) return;
    if (!state.editingPersisted && !title && !content) return; // ne pas créer une note vide
    editingNote.title = title;
    editingNote.content = content;
    editingNote.tags = tags;
    editingNote.updatedAt = nowIso();
    state.editingPersisted = true;
    await persistNote(editingNote);
  }

  function scheduleAutosave() {
    clearTimeout(state.autosaveTimer);
    state.autosaveTimer = setTimeout(autosaveEditor, 700);
  }

  async function closeEditor() {
    clearTimeout(state.autosaveTimer);
    await autosaveEditor();
    $('editor-overlay').hidden = true;
    editingNote = null;
    state.editingId = null;
  }

  // ------------------------------------------------------------------
  // Actions sur les notes
  // ------------------------------------------------------------------
  async function togglePin() {
    editingNote.pinned = !editingNote.pinned;
    editingNote.updatedAt = nowIso();
    state.editingPersisted = true;
    await persistNote(editingNote);
    updateEditorChrome();
    toast(editingNote.pinned ? 'Note épinglée' : 'Note désépinglée');
  }

  async function toggleArchive() {
    editingNote.archivedAt = editingNote.archivedAt ? null : nowIso();
    editingNote.updatedAt = nowIso();
    state.editingPersisted = true;
    await persistNote(editingNote);
    updateEditorChrome();
    toast(editingNote.archivedAt ? 'Note archivée' : 'Note désarchivée');
  }

  async function trashNote() {
    editingNote.deletedAt = nowIso();
    editingNote.updatedAt = nowIso();
    await persistNote(editingNote);
    toast('Note mise à la corbeille (restaurable)');
    await closeEditor();
  }

  async function restoreNote() {
    editingNote.deletedAt = null;
    editingNote.updatedAt = nowIso();
    await persistNote(editingNote);
    updateEditorChrome();
    toast('Note restaurée');
  }

  async function purgeNote(note) {
    note.title = '';
    note.content = '';
    note.tags = [];
    note.deletedAt = note.deletedAt || nowIso();
    note.updatedAt = nowIso();
    await persistNote(note);
  }

  async function emptyTrash() {
    const trash = state.notes.filter(n => n.deletedAt && !isPurged(n));
    if (!trash.length) return;
    if (!confirm(`Supprimer définitivement ${trash.length} note(s) de la corbeille ? Cette action est irréversible.`)) return;
    for (const n of trash) await purgeNote(n);
    toast('Corbeille vidée');
  }

  async function purgeExpiredTrash() {
    const cutoff = Date.now() - TRASH_RETENTION_DAYS * 86400000;
    for (const n of state.notes) {
      if (n.deletedAt && !isPurged(n) && new Date(n.deletedAt).getTime() < cutoff) {
        await purgeNote(n);
      }
    }
  }

  // ------------------------------------------------------------------
  // Export / import / backups
  // ------------------------------------------------------------------
  function exportJson() {
    const notes = state.notes.filter(n => !isPurged(n));
    const payload = {
      app: 'Hermes Notes',
      version: VERSION,
      exportedAt: nowIso(),
      user: state.session.user.email,
      totalNotes: notes.length,
      notes,
    };
    download(`hermes_notes_export_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`,
      JSON.stringify(payload, null, 2), 'application/json');
    toast('Export JSON téléchargé');
  }

  function exportMarkdown() {
    const notes = visibleNotes().length ? visibleNotes() : state.notes.filter(n => !n.deletedAt && !isPurged(n));
    const lines = [`# Hermes Notes — export du ${fmtDate(nowIso())}`, ''];
    for (const n of notes) {
      lines.push(`## ${n.title || 'Sans titre'}`);
      lines.push(`*Créée : ${fmtDate(n.createdAt)} · Modifiée : ${fmtDate(n.updatedAt)}${(n.tags || []).length ? ' · Tags : ' + n.tags.join(', ') : ''}*`);
      lines.push('');
      lines.push(n.content || '');
      lines.push('');
      lines.push('---');
      lines.push('');
    }
    download(`hermes_notes_export_${new Date().toISOString().slice(0, 10)}.md`, lines.join('\n'), 'text/markdown');
    toast('Export Markdown téléchargé');
  }

  /** Import JSON : format V2, ou format du prototype V1 (created_at/updated_at). */
  async function importJson(file) {
    let data;
    try { data = JSON.parse(await file.text()); }
    catch { toast('Fichier JSON invalide'); return; }

    let rawNotes = Array.isArray(data) ? data : (data.notes || []);
    if (!Array.isArray(rawNotes) || !rawNotes.length) { toast('Aucune note trouvée dans ce fichier'); return; }

    let added = 0, skipped = 0;
    for (const raw of rawNotes) {
      const isV1 = 'created_at' in raw;
      const note = {
        id: (typeof raw.id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(raw.id) && !isV1) ? raw.id : crypto.randomUUID(),
        title: String(raw.title || ''),
        content: String(raw.content || ''),
        tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
        pinned: !!raw.pinned,
        createdAt: raw.createdAt || raw.created_at || nowIso(),
        updatedAt: raw.updatedAt || raw.updated_at || nowIso(),
        archivedAt: raw.archivedAt || (raw.archived ? nowIso() : null),
        deletedAt: raw.deletedAt || null,
        rev: 0,
        dirty: true,
      };
      const existing = await DB.getNote(note.id);
      if (existing) { skipped++; continue; } // jamais d'écrasement à l'import
      await DB.putNote(note);
      added++;
    }
    await reloadNotes();
    render();
    SyncEngine.scheduleSync('import');
    toast(`Import terminé : ${added} ajoutée(s)${skipped ? `, ${skipped} déjà présente(s)` : ''}`);
  }

  async function createBackup(auto = false) {
    const notes = state.notes.filter(n => !isPurged(n));
    if (!notes.length) return;
    await DB.addBackup({ ts: nowIso(), auto, count: notes.length, notes });
    const backups = (await DB.getBackups()).sort((a, b) => a.ts.localeCompare(b.ts));
    while (backups.length > BACKUPS_KEPT) await DB.deleteBackup(backups.shift().ts);
    if (!auto) toast('Sauvegarde locale créée');
  }

  async function renderBackups() {
    const wrap = $('backups-list');
    const backups = (await DB.getBackups()).sort((a, b) => b.ts.localeCompare(a.ts));
    wrap.innerHTML = backups.length ? '' : '<p class="modal-hint">Aucune sauvegarde pour l\'instant.</p>';
    for (const b of backups) {
      const div = document.createElement('div');
      div.className = 'journal-entry';
      div.innerHTML = `<span>${fmtDate(b.ts)}${b.auto ? ' (auto)' : ''}</span><span>${b.count} notes</span>`;
      const btn = document.createElement('button');
      btn.className = 'btn btn-small';
      btn.textContent = 'Restaurer';
      btn.onclick = async () => {
        let restored = 0;
        for (const n of b.notes) {
          if (!(await DB.getNote(n.id))) { await DB.putNote({ ...n, rev: 0, dirty: true }); restored++; }
        }
        await reloadNotes();
        render();
        SyncEngine.scheduleSync('restauration');
        toast(restored ? `${restored} note(s) restaurée(s)` : 'Rien à restaurer : toutes les notes existent déjà');
      };
      div.appendChild(btn);
      wrap.appendChild(div);
    }
  }

  // ------------------------------------------------------------------
  // Session / authentification
  // ------------------------------------------------------------------
  async function loadSession() {
    const token = await DB.metaGet('token');
    const user = await DB.metaGet('user');
    let serverUrl = await DB.metaGet('serverUrl');
    let clientId = await DB.metaGet('clientId');
    if (!clientId) { clientId = crypto.randomUUID(); await DB.metaSet('clientId', clientId); }
    if (!serverUrl) serverUrl = API.defaultServerUrl();
    return token && user ? { token, user, serverUrl, clientId } : null;
  }

  async function saveSession(session) {
    await DB.metaSet('token', session.token);
    await DB.metaSet('user', session.user);
    await DB.metaSet('serverUrl', session.serverUrl);
    state.session = session;
  }

  async function handleAuth(kind) {
    const email = $('login-email').value.trim();
    const password = $('login-password').value;
    const serverUrl = API.normalizeUrl($('login-server').value || API.defaultServerUrl());
    const errBox = $('login-error');
    errBox.hidden = true;

    if (!email || !password) { errBox.textContent = 'Email et mot de passe requis.'; errBox.hidden = false; return; }

    try {
      const fn = kind === 'register' ? API.register : API.login;
      const res = await fn(serverUrl, email, password);
      const clientId = (await DB.metaGet('clientId')) || crypto.randomUUID();
      await DB.metaSet('clientId', clientId);

      // Changement d'utilisateur sur cet appareil -> on repart d'un stockage local vierge
      const owner = await DB.metaGet('ownerUserId');
      if (owner && owner !== res.user.id) {
        await DB.clearNotes();
        await DB.metaSet('lastRev', 0);
        await DB.metaSet('syncLog', []);
      }
      await DB.metaSet('ownerUserId', res.user.id);

      await saveSession({ token: res.token, user: res.user, serverUrl, clientId });
      await enterApp();
      toast(kind === 'register' ? 'Compte créé, bienvenue !' : 'Connecté');
    } catch (err) {
      const messages = {
        invalid_email: 'Adresse email invalide.',
        password_too_short: 'Mot de passe trop court (8 caractères minimum).',
        email_already_registered: 'Un compte existe déjà avec cet email. Utilisez « Se connecter ».',
        invalid_credentials: 'Email ou mot de passe incorrect.',
        network_unreachable: 'Serveur injoignable. Vérifiez l\'adresse du serveur et votre connexion.',
        network_timeout: 'Le serveur ne répond pas (délai dépassé).',
        too_many_attempts: 'Trop de tentatives. Réessayez dans une minute.',
      };
      errBox.textContent = messages[err.message] || `Erreur : ${err.message}`;
      errBox.hidden = false;
    }
  }

  async function logout() {
    if (!confirm('Se déconnecter ? Vos notes restent sur cet appareil et sur le serveur.')) return;
    await DB.metaDelete('token');
    state.session = null;
    $('app-screen').hidden = true;
    $('login-screen').hidden = false;
  }

  // ------------------------------------------------------------------
  // Démarrage
  // ------------------------------------------------------------------
  async function enterApp() {
    $('login-screen').hidden = true;
    $('app-screen').hidden = false;
    $('menu-email').textContent = state.session.user.email;
    $('menu-server').textContent = state.session.serverUrl;
    $('menu-version').textContent = 'v' + VERSION;

    await reloadNotes();
    await purgeExpiredTrash();
    render();

    SyncEngine.init({
      getSession: () => state.session,
      onNotesChanged: async () => { await reloadNotes(); render(); },
    });
    SyncEngine.onChange(renderSyncPill);
    SyncEngine.syncNow('démarrage');
    createBackup(true);
    setInterval(() => createBackup(true), 10 * 60 * 1000);

    const msg = POSITIVE_MESSAGES[Math.floor(Math.random() * POSITIVE_MESSAGES.length)];
    $('positive-message').textContent = msg;
  }

  function wireEvents() {
    // Connexion
    $('login-form').addEventListener('submit', e => { e.preventDefault(); handleAuth('login'); });
    $('btn-register').addEventListener('click', () => handleAuth('register'));
    $('btn-test-server').addEventListener('click', async () => {
      const out = $('server-test-result');
      out.textContent = '…';
      try {
        const url = API.normalizeUrl($('login-server').value || API.defaultServerUrl());
        const h = await API.health(url);
        out.textContent = `✓ serveur ok (v${h.version})`;
        out.style.color = 'var(--green)';
      } catch { out.textContent = '✗ injoignable'; out.style.color = 'var(--red)'; }
    });

    // Navigation
    document.querySelectorAll('.nav-item').forEach(b => b.addEventListener('click', () => {
      state.view = b.dataset.view;
      syncNav();
      render();
    }));
    $('search-input').addEventListener('input', e => { state.search = e.target.value; render(); });
    $('sort-select').addEventListener('change', e => { state.sortBy = e.target.value; render(); });
    $('btn-empty-trash').addEventListener('click', emptyTrash);

    // Éditeur
    $('btn-new-note').addEventListener('click', () => openEditor(null));
    $('btn-editor-back').addEventListener('click', closeEditor);
    $('editor-overlay').addEventListener('click', e => { if (e.target === $('editor-overlay')) closeEditor(); });
    ['editor-title', 'editor-content', 'editor-tags'].forEach(id => $(id).addEventListener('input', scheduleAutosave));
    $('btn-editor-pin').addEventListener('click', togglePin);
    $('btn-editor-archive').addEventListener('click', toggleArchive);
    $('btn-editor-trash').addEventListener('click', trashNote);
    $('btn-editor-restore').addEventListener('click', restoreNote);
    $('btn-editor-purge').addEventListener('click', async () => {
      if (!confirm('Supprimer définitivement cette note ? Cette action est irréversible.')) return;
      await purgeNote(editingNote);
      toast('Note supprimée définitivement');
      await closeEditor();
    });

    // Menus / modales
    $('btn-user').addEventListener('click', () => { $('menu-overlay').hidden = false; });
    $('sync-pill').addEventListener('click', () => { renderJournal(); $('journal-overlay').hidden = false; });
    $('btn-journal').addEventListener('click', () => { $('menu-overlay').hidden = true; renderJournal(); $('journal-overlay').hidden = false; });
    document.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', () => { $(b.dataset.close).hidden = true; }));
    ['menu-overlay', 'journal-overlay', 'backups-overlay', 'settings-overlay'].forEach(id =>
      $(id).addEventListener('click', e => { if (e.target === $(id)) $(id).hidden = true; }));

    $('btn-sync-now').addEventListener('click', async () => {
      $('menu-overlay').hidden = true;
      const r = await SyncEngine.syncNow('manuel');
      if (r && !r.skipped) toast(`Sync : ↑${r.pushed || 0} envoyées, ↓${r.pulled || 0} reçues${r.conflicts ? `, ${r.conflicts} conflit(s) résolu(s) par copie` : ''}`);
    });
    $('btn-export-json').addEventListener('click', () => { $('menu-overlay').hidden = true; exportJson(); });
    $('btn-export-md').addEventListener('click', () => { $('menu-overlay').hidden = true; exportMarkdown(); });
    $('btn-import-json').addEventListener('click', () => $('import-file').click());
    $('import-file').addEventListener('change', e => {
      if (e.target.files[0]) { $('menu-overlay').hidden = true; importJson(e.target.files[0]); e.target.value = ''; }
    });
    $('btn-backups').addEventListener('click', async () => { $('menu-overlay').hidden = true; await renderBackups(); $('backups-overlay').hidden = false; });
    $('btn-backup-now').addEventListener('click', async () => { await createBackup(false); await renderBackups(); });
    $('btn-logout').addEventListener('click', () => { $('menu-overlay').hidden = true; logout(); });

    // Réglages serveur
    $('btn-settings').addEventListener('click', () => {
      $('menu-overlay').hidden = true;
      $('settings-server').value = state.session.serverUrl;
      $('settings-overlay').hidden = false;
    });
    $('btn-settings-test').addEventListener('click', async () => {
      const out = $('settings-test-result');
      out.textContent = '…';
      try {
        const h = await API.health(API.normalizeUrl($('settings-server').value));
        out.textContent = `✓ serveur ok (v${h.version})`;
        out.style.color = 'var(--green)';
      } catch { out.textContent = '✗ injoignable'; out.style.color = 'var(--red)'; }
    });
    $('btn-settings-save').addEventListener('click', async () => {
      const url = API.normalizeUrl($('settings-server').value);
      if (!url) { toast('Adresse invalide'); return; }
      state.session.serverUrl = url;
      await DB.metaSet('serverUrl', url);
      $('menu-server').textContent = url;
      $('settings-overlay').hidden = true;
      toast('Serveur enregistré');
      SyncEngine.syncNow('changement de serveur');
    });

    // Raccourcis clavier
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (!$('editor-overlay').hidden) { closeEditor(); return; }
        ['menu-overlay', 'journal-overlay', 'backups-overlay', 'settings-overlay'].forEach(id => { $(id).hidden = true; });
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && $('editor-overlay').hidden && !$('app-screen').hidden) {
        e.preventDefault();
        openEditor(null);
      }
    });
  }

  async function boot() {
    wireEvents();
    state.session = await loadSession();
    if (state.session) {
      await enterApp();
    } else {
      $('login-server').value = API.defaultServerUrl();
      $('login-screen').hidden = false;
    }
  }

  boot().catch(err => {
    console.error('Erreur de démarrage', err);
    alert('Erreur au démarrage de Hermes Notes : ' + err.message);
  });
})();
