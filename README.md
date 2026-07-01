# Hermes Notes V2

**Cross-platform, offline-first notes app — Windows + Android, with email accounts and conflict-safe synchronization through a self-hosted local server.**

![Status](https://img.shields.io/badge/status-prototype%20archived-orange)
![Platforms](https://img.shields.io/badge/platforms-Windows%20%2B%20Android-blue)
![Server](https://img.shields.io/badge/server-Node.js%20zero--dependency-brightgreen)
![Tests](https://img.shields.io/badge/server%20tests-23%2F23%20passing-brightgreen)

> 🇫🇷 La documentation détaillée (architecture, sync, guides de build, dépannage, reprise) est en français dans [`docs/`](docs/).

---

## Why this project matters

Hermes Notes V2 started as a local notes prototype and was transformed into a cross-platform offline-first notes application. The goal was not only to build a notes app, but to test an agentic development workflow where planning, building, testing, critique, documentation, and release preparation were coordinated through Hermes/Fable 5.

The project demonstrates:
- a Windows desktop app;
- an Android APK;
- local-first data storage;
- email-based authentication;
- sync through a self-hosted local server;
- offline editing with automatic sync recovery;
- conflict handling without silent data loss.

## Features

- 📝 Notes with tags, instant full-text search, sorting, pinning
- 📁 Real archive view, 🗑️ trash with restore (30-day retention — nothing is destroyed instantly)
- 👤 Email + password accounts (scrypt hashing, JWT sessions, strict per-user data isolation)
- ✈️ **Offline-first**: the app is 100% usable without a network; changes queue locally
- 🔄 **Automatic sync**: on start, after every change, every 60 s, and when the network comes back
- ⚔️ **Conflict-safe**: concurrent edits produce a visible *conflict copy* — both versions always survive
- 📤 JSON & Markdown export, JSON import (including the V1 prototype format), rolling local backups
- 🌙 Dark, clean, responsive UI (desktop sidebar ↔ mobile bottom navigation)

## Architecture

```
┌────────────────┐        ┌────────────────┐
│  Windows (EXE)  │        │ Android (APK)  │     One single web codebase
│  Electron       │        │ Capacitor 6    │     (client/) embedded in
│  client/ (www)  │        │ client/ (www)  │     both native shells
└───────┬────────┘        └───────┬────────┘
        │     local IndexedDB = source of truth (offline-first)
        └────────────┬─────────────┘
                     ▼   revision-based push/pull + server-side conflict detection
           ┌──────────────────────┐
           │  Sync server          │  Node.js, ZERO dependencies
           │  server/server.js     │  (node:http, node:sqlite, node:crypto)
           │  Email auth + JWT     │  SQLite (WAL) + automatic backups
           └──────────────────────┘
```

## How it works

Every user action is written to the local IndexedDB first (flagged `dirty`) — the UI never waits for the network. A sync pass sends dirty notes with their last known server revision (`baseRev`) and pulls everything newer than the local cursor, all in a single request and a single SQLite transaction. Per-user integer revisions arbitrate everything; timestamps are display-only.

## Offline-first sync

If the server is unreachable, nothing changes for the user: notes remain readable and editable, and the pending queue is shown in the status pill (`offline (2 pending)`). When the network returns, the queue is pushed, remote changes are pulled and merged.

**Conflicts:** if two devices edited the same note offline, the first push wins the original note; the second device's version becomes a timestamped **conflict copy** (tagged `conflit`) that syncs everywhere. No silent overwrite, ever. Full protocol: [`docs/SYNC_DESIGN.md`](docs/SYNC_DESIGN.md).

## Windows app

Portable Electron EXE (~70 MB), no installation. Built with `electron-builder` — see [`docs/BUILD_WINDOWS.md`](docs/BUILD_WINDOWS.md). Also usable from any browser at `http://127.0.0.1:8787` when the server runs with `--static`.

## Android app

Capacitor 6 APK (~3.6 MB, `be.hermes.notes`, Android 5.1+). Build guide: [`docs/BUILD_ANDROID.md`](docs/BUILD_ANDROID.md). On the phone, point the app to the PC's LAN address (e.g. `http://192.168.1.10:8787`).

## Local sync server

A single zero-dependency file (`server/server.js`, Node ≥ 23.4): email registration/login, JWT, per-user revisions, conflict detection, rate limiting, automatic SQLite backups, optional static hosting of the web client. **This is a self-hosted local server — Hermes Notes is not (yet) a public cloud app.** Setup, firewall, IP, data reset: [`docs/SERVER_SETUP.md`](docs/SERVER_SETUP.md).

```powershell
cd server
node server.js --static ../client     # → http://127.0.0.1:8787
```

## Current status

Hermes Notes V2 is currently archived as a working prototype.

- Windows EXE: built and tested on PC.
- Local sync server: built and tested on PC.
- Authentication by email: tested on PC.
- Offline-first behavior: tested in browser/device simulations.
- Android APK: built and validated, but not yet tested on a physical Android phone.

The next milestone is to install the APK on a real Android device and verify synchronization with the Windows app through the local server.

Full status: [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) · Test evidence: [`docs/TEST_REPORT.md`](docs/TEST_REPORT.md) · Final report: [`docs/FINAL_REPORT.md`](docs/FINAL_REPORT.md)

## Roadmap

1. **Real-device Android test** — checklist ready in [`docs/ANDROID_TEST_TODO.md`](docs/ANDROID_TEST_TODO.md)
2. Password recovery & email verification (requires SMTP)
3. Release-signed APK and signed EXE with custom icon
4. Standalone server executable (no Node required on the host)
5. HTTPS / remote hosting option (reverse proxy documented) for sync over the internet

## Known limitations

- The Android APK has **not yet been tested on a physical phone** (built, `aapt`-validated, attached to the release).
- No password recovery / email verification yet (no SMTP).
- Server speaks HTTP — fine on a LAN; put a TLS reverse proxy in front for internet exposure.
- EXE is unsigned (SmartScreen may warn on first launch); APK uses a debug signature.
- The V2 replaces the V1 Python/tkinter prototype, which could not produce an Android app (V1 is kept in `src/` for reference).

## Resume later

To resume this project later:

1. Clone the repository.
2. Checkout the `v2-cross-platform-sync` branch.
3. Read `docs/RESUME_LATER.md`.
4. Start the local sync server.
5. Run or rebuild the Windows app.
6. Install the APK on an Android phone.
7. Test PC ↔ Android synchronization.
8. Continue improvements from the roadmap.

Binaries from 2026-07-01 (EXE + APK + final report) are attached to the **`v2.0.0-prototype`** GitHub release.

## Repository layout

```
client/    single web codebase (vanilla JS + IndexedDB + sync engine)
server/    zero-dependency sync server + 23 integration tests
desktop/   Electron shell → Windows portable EXE
mobile/    Capacitor 6 shell → Android APK
scripts/   build helpers
docs/      all documentation (architecture, sync design, guides, status, reports)
src/       V1 prototype (Python/tkinter), kept as historical reference
```

## Documentation index

| Doc | Content |
|---|---|
| [PROJECT_STATUS.md](docs/PROJECT_STATUS.md) | Current state, what's tested, freeze date, resume point |
| [RESUME_LATER.md](docs/RESUME_LATER.md) | Step-by-step guide to pick the project back up |
| [SERVER_SETUP.md](docs/SERVER_SETUP.md) | Local server: run, verify, firewall, phone connection, data |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Real incidents (server unreachable on first launch) + diagnostics |
| [ANDROID_TEST_TODO.md](docs/ANDROID_TEST_TODO.md) | Checklist for the real-device Android test |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack decision, components, security |
| [SYNC_DESIGN.md](docs/SYNC_DESIGN.md) | Revisions, conflict policy, protocol |
| [OFFLINE_MODE.md](docs/OFFLINE_MODE.md) | Offline behavior and queue |
| [BUILD_WINDOWS.md](docs/BUILD_WINDOWS.md) / [BUILD_ANDROID.md](docs/BUILD_ANDROID.md) | Build guides |
| [TEST_REPORT.md](docs/TEST_REPORT.md) | 23 server tests + 17 E2E scenarios, bugs found & fixed |
| [FINAL_REPORT.md](docs/FINAL_REPORT.md) | Full delivery report (A→H, verdict) |
| [ARCHIVE_NOTE.md](docs/ARCHIVE_NOTE.md) | Why and how the project was paused |

---

## History: the V1 prototype & the Hermes multi-instance experiment

This repository began as an experiment testing whether Hermes could use its Kanban dashboard as a control center — giving itself orders through role-based tasks (Supervisor, Architect, Developer, Tester, Critic, Synthesis). True multi-instance execution was not fully confirmed (coordination was simulated via `delegate_task`), yet the workflow produced a working V1 app and a consolidated report. V2 then fixed every defect that workflow identified and turned the prototype into the cross-platform product documented above.

- [📊 Experiment report](docs/EXPERIMENT_REPORT.md) · [🎯 Prompt used](PROMPT.md) · [🔧 Why it worked](docs/WHY_IT_WORKED.md) · [📋 V1 test report](TEST_REPORT.md)
