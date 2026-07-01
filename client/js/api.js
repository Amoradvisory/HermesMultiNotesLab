/**
 * Hermes Notes V2 — client REST vers le serveur de synchronisation.
 */
'use strict';

(function () {
  function normalizeUrl(url) {
    let u = String(url || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'http://' + u;
    return u.replace(/\/+$/, '');
  }

  /** URL serveur par défaut selon l'environnement d'exécution. */
  function defaultServerUrl() {
    const isCapacitor = !!window.Capacitor;
    const isHttp = location.protocol === 'http:' || location.protocol === 'https:';
    if (!isCapacitor && isHttp && !location.origin.includes('localhost:517')) {
      return location.origin; // servi par le serveur de sync lui-même
    }
    return 'http://127.0.0.1:8787'; // Electron (file://) ; à adapter sur Android
  }

  async function request(serverUrl, route, { method = 'GET', body, token, timeoutMs = 15000 } = {}) {
    const base = normalizeUrl(serverUrl);
    if (!base) throw Object.assign(new Error('server_url_missing'), { code: 'server_url_missing' });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(base + route, {
        method,
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      let json = null;
      try { json = await res.json(); } catch { /* réponse non-JSON */ }
      if (!res.ok) {
        const err = new Error((json && json.error) || ('http_' + res.status));
        err.status = res.status;
        err.payload = json;
        throw err;
      }
      return json;
    } catch (e) {
      if (e.name === 'AbortError') {
        const err = new Error('network_timeout');
        err.offline = true;
        throw err;
      }
      if (e instanceof TypeError) { // fetch failed = réseau/serveur injoignable
        const err = new Error('network_unreachable');
        err.offline = true;
        throw err;
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  window.API = {
    normalizeUrl,
    defaultServerUrl,
    health: url => request(url, '/api/health', { timeoutMs: 6000 }),
    register: (url, email, password) => request(url, '/api/auth/register', { method: 'POST', body: { email, password } }),
    login: (url, email, password) => request(url, '/api/auth/login', { method: 'POST', body: { email, password } }),
    me: (url, token) => request(url, '/api/me', { token, timeoutMs: 8000 }),
    sync: (url, token, payload) => request(url, '/api/sync', { method: 'POST', body: payload, token, timeoutMs: 30000 }),
  };
})();
