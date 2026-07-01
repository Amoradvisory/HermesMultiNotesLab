#!/usr/bin/env node
/**
 * Tests d'intégration du serveur de sync Hermes Notes V2.
 * Zéro dépendance : démarre le serveur sur un port de test avec des données
 * temporaires, exécute les scénarios, affiche PASS/FAIL, code retour != 0 si échec.
 *
 * Scénarios couverts :
 *  1. health
 *  2. inscription (validation email / mot de passe court / doublon)
 *  3. connexion (ok / mauvais mot de passe)
 *  4. /api/me avec et sans token
 *  5. push initial + pull incrémental (2 appareils simulés A et B)
 *  6. modification offline sur A puis sync -> B la reçoit
 *  7. CONFLIT : A et B modifient la même note hors ligne -> le 2e push est
 *     rejeté avec base_rev_mismatch et la version serveur est renvoyée
 *  8. suppression (tombstone deletedAt) propagée à l'autre appareil
 *  9. isolation : l'utilisateur 2 ne voit jamais les notes de l'utilisateur 1
 * 10. requête sync sans token -> 401
 */
'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const PORT = 8891;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-sync-test-'));

let passed = 0, failed = 0;
function check(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${detail}`); }
}

async function api(method, route, body, token) {
  const res = await fetch(BASE + route, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* réponse vide */ }
  return { status: res.status, json };
}

function newNote(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    baseRev: 0,
    title: 'Note de test',
    content: 'Contenu',
    tags: ['test'],
    pinned: false,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

async function waitForServer(retries = 50) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return true;
    } catch { /* pas encore prêt */ }
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
}

async function main() {
  console.log(`Démarrage serveur de test (port ${PORT}, data ${DATA})`);
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js'), '--port', String(PORT), '--data', DATA], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', d => process.stderr.write(`[server] ${d}`));

  try {
    check('serveur démarré', await waitForServer());

    // 1. health
    const health = await api('GET', '/api/health');
    check('health ok', health.status === 200 && health.json.ok === true);

    // 2. inscription
    const badEmail = await api('POST', '/api/auth/register', { email: 'pas-un-email', password: 'motdepasse' });
    check('email invalide rejeté', badEmail.status === 400);
    const shortPw = await api('POST', '/api/auth/register', { email: 'amor@test.local', password: 'court' });
    check('mot de passe court rejeté', shortPw.status === 400);
    const reg1 = await api('POST', '/api/auth/register', { email: 'amor@test.local', password: 'motdepasse1' });
    check('inscription ok', reg1.status === 201 && !!reg1.json.token);
    const dup = await api('POST', '/api/auth/register', { email: 'amor@test.local', password: 'motdepasse1' });
    check('email en double rejeté (409)', dup.status === 409);

    // 3. connexion
    const badLogin = await api('POST', '/api/auth/login', { email: 'amor@test.local', password: 'mauvais-mdp' });
    check('mauvais mot de passe rejeté (401)', badLogin.status === 401);
    const login = await api('POST', '/api/auth/login', { email: 'amor@test.local', password: 'motdepasse1' });
    check('connexion ok', login.status === 200 && !!login.json.token);
    const T1 = login.json.token; // utilisateur 1 (tokens pour appareils A et B identiques)

    // 4. /api/me
    const meNo = await api('GET', '/api/me');
    check('me sans token -> 401', meNo.status === 401);
    const me = await api('GET', '/api/me', null, T1);
    check('me avec token ok', me.status === 200 && me.json.user.email === 'amor@test.local');

    // 5. push initial appareil A + pull appareil B
    const noteA = newNote({ title: 'Créée sur Windows', content: 'Bonjour depuis le PC' });
    const pushA = await api('POST', '/api/sync', { clientId: 'device-A', lastRev: 0, changes: [noteA] }, T1);
    check('push A appliqué', pushA.status === 200 && pushA.json.applied.length === 1 && pushA.json.conflicts.length === 0);
    const revAfterCreate = pushA.json.applied[0].rev;

    const pullB = await api('POST', '/api/sync', { clientId: 'device-B', lastRev: 0, changes: [] }, T1);
    check('pull B reçoit la note créée sur A', pullB.status === 200 &&
      pullB.json.changes.some(n => n.id === noteA.id && n.title === 'Créée sur Windows'));
    const lastRevB = pullB.json.serverRev;

    // 6. modification "offline" sur A puis sync
    const editA = { ...noteA, baseRev: revAfterCreate, content: 'Modifié hors ligne sur le PC', updatedAt: new Date().toISOString() };
    const pushA2 = await api('POST', '/api/sync', { clientId: 'device-A', lastRev: revAfterCreate, changes: [editA] }, T1);
    check('modification A appliquée', pushA2.json.applied.length === 1);
    const revAfterEdit = pushA2.json.applied[0].rev;

    const pullB2 = await api('POST', '/api/sync', { clientId: 'device-B', lastRev: lastRevB, changes: [] }, T1);
    check('B reçoit la modification de A', pullB2.json.changes.some(n => n.id === noteA.id && n.content === 'Modifié hors ligne sur le PC'));

    // 7. conflit : A et B modifient la même note à partir de la même base
    const editFromA = { ...noteA, baseRev: revAfterEdit, content: 'Version A (gagne : première arrivée)', updatedAt: new Date().toISOString() };
    const editFromB = { ...noteA, baseRev: revAfterEdit, content: 'Version B (arrive après : conflit)', updatedAt: new Date().toISOString() };
    const pushConflictA = await api('POST', '/api/sync', { clientId: 'device-A', lastRev: revAfterEdit, changes: [editFromA] }, T1);
    check('push A (1er) appliqué', pushConflictA.json.applied.length === 1);
    const pushConflictB = await api('POST', '/api/sync', { clientId: 'device-B', lastRev: revAfterEdit, changes: [editFromB] }, T1);
    check('push B (2e) détecté en CONFLIT', pushConflictB.json.conflicts.length === 1 &&
      pushConflictB.json.conflicts[0].reason === 'base_rev_mismatch');
    check('le conflit renvoie la version serveur (A)',
      pushConflictB.json.conflicts[0].server.content === 'Version A (gagne : première arrivée)');
    check('la version B n\'a PAS écrasé la version A', (await api('POST', '/api/sync', { clientId: 'device-C', lastRev: 0, changes: [] }, T1))
      .json.changes.find(n => n.id === noteA.id).content === 'Version A (gagne : première arrivée)');

    // 8. suppression (tombstone) propagée
    const serverNote = pushConflictB.json.conflicts[0].server;
    const del = { ...serverNote, baseRev: serverNote.rev, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const pushDel = await api('POST', '/api/sync', { clientId: 'device-B', lastRev: serverNote.rev, changes: [del] }, T1);
    check('suppression (corbeille) appliquée', pushDel.json.applied.length === 1);
    const pullA3 = await api('POST', '/api/sync', { clientId: 'device-A', lastRev: pushConflictA.json.serverRev, changes: [] }, T1);
    check('A reçoit le tombstone de suppression', pullA3.json.changes.some(n => n.id === noteA.id && !!n.deletedAt));

    // 9. isolation entre utilisateurs
    const reg2 = await api('POST', '/api/auth/register', { email: 'autre@test.local', password: 'motdepasse2' });
    const T2 = reg2.json.token;
    const pullUser2 = await api('POST', '/api/sync', { clientId: 'device-X', lastRev: 0, changes: [] }, T2);
    check('utilisateur 2 ne voit AUCUNE note de l\'utilisateur 1', pullUser2.json.changes.length === 0);
    const noteU2 = newNote({ title: 'Note privée utilisateur 2' });
    await api('POST', '/api/sync', { clientId: 'device-X', lastRev: 0, changes: [noteU2] }, T2);
    const pullUser1 = await api('POST', '/api/sync', { clientId: 'device-A', lastRev: 0, changes: [] }, T1);
    check('utilisateur 1 ne voit pas la note de l\'utilisateur 2', !pullUser1.json.changes.some(n => n.id === noteU2.id));

    // 10. sync sans token
    const syncNoAuth = await api('POST', '/api/sync', { clientId: 'x', lastRev: 0, changes: [] });
    check('sync sans token -> 401', syncNoAuth.status === 401);

  } finally {
    server.kill();
    try { fs.rmSync(DATA, { recursive: true, force: true }); } catch { /* fichiers verrouillés sous Windows : sans gravité, dossier temp */ }
  }

  console.log(`\nRésultat : ${passed} PASS, ${failed} FAIL`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
