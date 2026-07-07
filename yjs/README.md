# yjs — collaborative editing relay

Standalone WebSocket relay for real-time collaborative editing of entity descriptions (BlockNote) via the Yjs CRDT protocol.

> This document covers the relay worker and the full collaborative editing flow end to end. For the surrounding sync engine (CDC, SSE, offline queue, HLC merge) see [SYNC_ENGINE.md](../cella/SYNC_ENGINE.md).

Clients connect with an HMAC-signed token. The relay verifies the token, authorizes the edit **locally** using the shared permission engine (`shared/src/permissions`) against an RLS-scoped DB read — no backend round-trip — and relays binary Yjs sync and awareness messages between peers. During editing it never parses document content: it stores and forwards raw `Uint8Array` state. The one exception is **seeding**: when a fresh session starts, the relay converts the entity's stored `description` into an initial Y.Doc server-side, so clients never seed.

## TL;DR

```text
User opens a task description
        ▼
WS connect to relay (token + async entity authz)
        ▼
Fresh session? Relay seeds Y.Doc from entity.description
        ▼
Keystrokes merge via CRDT, fan out to peers instantly
        ▼
Author's client PUTs description + derived fields (1s debounce)
        ▼
Backend re-derives, Postgres commits
        ▼
CDC → SSE → non-editing viewers update
        ▼
Last client leaves → 5 min grace → session state deleted
(entity.description remains the durable record)
```

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      Collaborative editing architecture                      │
├──────────────────────────────────────────────────────────────────────────────┤
│   Browser A (author)                        Browser B (peer)                 │
│  ┌──────────────────────────┐          ┌──────────────────────────┐          │
│  │ BlockNote editor         │          │ BlockNote editor         │          │
│  │   └ Y.Doc (CRDT)         │          │   └ Y.Doc (CRDT)         │          │
│  │ derived-fields sender    │          │ remote changes filtered  │          │
│  │ (1s debounce, author-    │          │ — peers never PUT each   │          │
│  │  only PUT)               │          │ other's edits            │          │
│  └───┬───────────────┬──────┘          └────────────┬─────────────┘          │
│      │               │  WS: y-protocols sync + awareness (cursors)           │
│      │               ▼                              ▼                        │
│      │  ┌─────────────────────────────────────────────────────────┐          │
│      │  │                 Yjs relay worker (yjs/)                 │          │
│      │  │                                                         │          │
│      │  │  upgrade   HMAC token check, then async entity authz    │          │
│      │  │            (shared permission engine, RLS-scoped read); │          │
│      │  │            sync messages buffered until verified        │          │
│      │  │  relay     binary fan-out to peers, awareness           │          │
│      │  │            rate-limited (2/s per client)                │          │
│      │  │  storage   debounced state save (3s) to Postgres        │          │
│      │  │  seeding   fresh session → read description column →    │          │
│      │  │            blocksToYDoc → initial doc state             │          │
│      │  └──────────────┬──────────────────────┬───────────────────┘          │
│      │                 ▼                      ▼                              │
│      │      ┌───────────────────┐   ┌───────────────────────┐                │
│      │      │ yjs_documents     │   │ entity table          │                │
│      │      │ (session state,   │   │ description column    │                │
│      │      │  ephemeral)       │   │ (read for seeding)    │                │
│      │      └───────────────────┘   └───────────▲───────────┘                │
│      │                                          │                            │
│      ▼  PUT /:entity/:id — description + derived fields                      │
│  ┌───────────────────────────────────────────────────────────┐               │
│  │ API backend — re-derives authoritative fields, HLC merge  │               │
│  └──────────────────────────┬────────────────────────────────┘               │
│                             ▼                                                │
│   Postgres commit → CDC worker → SSE → non-editing viewers update            │
│   (Yjs-owned fields suppressed on clients with an active editor)             │
└──────────────────────────────────────────────────────────────────────────────┘
```

Two data paths run in parallel, on purpose:

- **The CRDT path** (left) is the live truth during a session: keystrokes merge character-level and reach peers in milliseconds, with no server-side document parsing.
- **The REST path** (bottom) materializes the session into the entity's `description` column plus server-derived fields (summary, checkbox counts, keywords). Only the *author* of a change sends it — remote echoes are filtered — and it travels through the standard mutation pipeline, inheriting squashing, the offline queue, HLC merge, and idempotency for free.

## What a user goes through

| # | What the user sees | What happens underneath |
|---|--------------------|-------------------------|
| 1 | Opens a project or workspace | `YjsTokenFetcher` pre-fetches an HMAC edit token per entity type + tenant (30 min TTL, refreshed at 25 min and on tab wake) |
| 2 | Clicks a task card to edit | Client checks collab eligibility (relay configured, online, token present, unconditional update permission), then opens a ref-counted WS connection for that task |
| 3 | A brief faded preview (≤3 s) | Relay verifies the token at upgrade and authorizes entity access asynchronously — sync messages are buffered until verified. If the first sync doesn't land within 3 s, the client falls back to a standalone editor with a toast |
| 4 | Existing description appears | Fresh session: the relay seeds the Y.Doc from the stored description server-side. Rejoining an active session: stored session state syncs down |
| 5 | Types; sees peers' cursors | Edits merge via CRDT and broadcast to all peers; cursor/presence via awareness messages (rate-limited) |
| 6 | Pauses typing (~1 s) | The author's client sends description + derived fields through the standard task mutation; the backend re-derives authoritative values; CDC → SSE updates everyone *not* editing |
| 7 | A colleague opens the same task | They sync the identical doc from the relay and appear as a cursor. Their client never re-PUTs the author's edits |
| 8 | Presses Escape or clicks away | Card returns to expanded view; any pending change is flushed through the mutation before SSE suppression is lifted |
| 9 | Navigates away / closes | Client keeps the connection 30 s (instant remount on return). The relay keeps the doc 5 min after the last client leaves, then deletes the session row — `entity.description` remains the durable record |

## Server-side seeding

Fresh sessions are seeded by the relay, not by clients. In `handleSyncStep1`, when no `yjs_documents` row exists (only reachable after entity authorization), the relay loads the entity's `description` column — via the same fork-agnostic `information_schema` introspection as `permissions.ts`, so any entity table with a `description` column participates — converts it with `@blocknote/server-util`'s `blocksToYDoc` into the `document-store` fragment, and inserts it as the row's initial state.

Two guarantees make this safe:

- **Schema parity.** The relay builds its BlockNote schema from the same React-free configs the frontend editor uses (`shared/blocknote-schema-configs`), so the ProseMirror node specs are identical — verified by round-trip tests covering every custom block type.
- **One canonical seed.** Concurrent first-connectors each generate a seed, but the insert is `ON CONFLICT DO NOTHING` and every connector re-loads the row afterwards — everyone adopts the winner's seed. (Merging two independently generated seeds would duplicate content; converging on one prevents that by construction.)

Because the seed reaches clients as a remote Yjs change, it can never pollute anyone's undo history and never triggers a redundant PUT — the client-side seeding hook and its handshake no longer exist.

## Preventing data loss

The durability model has three layers with different jobs. The **Y.Doc** is the live truth while a session runs — every connected client holds a complete copy, so the content survives any single participant (or the relay) disappearing. The **relay's Postgres row** provides session continuity: state is saved on a 3 s debounce and kept for 5 min after the last client leaves, so refreshes, reconnects, and brief outages resume exactly where the doc was. The **entity's `description` column** is the durable record: the author's client materializes it on a 1 s typing pause through the standard mutation pipeline — meaning it inherits the offline queue (IndexedDB persistence, replay after reconnect), idempotent retries, and HLC merge like every other field. These layers overlap deliberately: for typed content to be truly lost, all three have to fail inside the same narrow window.

| Scenario | How it's handled | Worst case |
|----------|------------------|------------|
| Two people type in the same paragraph | Character-level CRDT merge — both edits survive, no overwrites | None |
| Author closes the editor normally (blur, Escape, navigate) | Pending changes are flushed through the mutation before SSE suppression is lifted; the route-leave hook double-checks in solo mode | None |
| Author's tab is killed mid-typing | `beforeunload` fires a best-effort flush; peers and the relay still hold the full doc; reopening within 5 min resumes it exactly. The next author-side edit re-PUTs the complete doc | Hard crash + no peers + no reconnect within 5 min: the last ≤1 s of typing (one debounce window) misses the durable record |
| Network drops mid-session | Editor falls back to solo mode; the unmount flush lands in the offline mutation queue and replays after reconnect (upstream catchup first) | None — edits wait in IndexedDB |
| The description PUT fails | React Query pauses the mutation and replays it with the same `mutationId` — the server treats replays idempotently | None |
| SSE update arrives while someone is editing | Yjs-owned fields (description + derived counts) are stripped from incoming SSE writes while an editor is registered; suppression lifts only after the final flush settles | None |
| SSE races an in-flight save | Remote cache writes are skipped for entities with pending mutations; the mutation's own `onSuccess` reconciles | None |
| Relay restarts mid-session | Clients hold complete local docs; y-websocket reconnects with backoff and pushes back anything the relay hadn't saved (≤3 s window) — state converges | None |
| Relay unreachable for one user while others collaborate | That user edits solo via REST; the collab session's next materialization supersedes their description version | Known rarity: solo edits made *during* an active collab session don't enter the shared doc — they persist to the row until the next collab PUT overwrites it |
| Task is deleted while someone edits | Flush guards check the cache and skip the PUT instead of resurrecting the entity | None |
| Edit token expires mid-session | Provider picks up refreshed tokens automatically on reconnect; after 5 consecutive token failures a circuit breaker disables collab with a toast and the editor falls back to solo mode | None — content persists via REST either way |
| Stale session state vs. newer description | Sessions are ephemeral by design: the row is deleted 5 min after the last leave, and the next session re-seeds from the durable description — the two stores can't drift for long | None |

## Connection lifecycle

1. Client connects: `ws://host:port/{entityId}?token=...&entityType=...&tenantId=...`
2. Relay verifies the HMAC token at upgrade (bad credentials are rejected before the WS handshake, keeping client backoff intact)
3. Entity-level access is authorized asynchronously (shared permission engine over an RLS-scoped read); sync messages are buffered until verified, awareness passes through
4. Fresh doc → server-side seed from the entity's description (see above)
5. Sync/update messages are relayed to peers and debounce-saved to Postgres
6. Awareness (cursor/presence) messages are rate-limited and broadcast
7. On last disconnect, a grace period runs before the session row is deleted

**WS close codes:** `4001` invalid token · `4003` access denied · `4400` bad request / missing entity scope · `4503` authorization unavailable (DB/resolver error)

## Tuning defaults

| Knob | Value | Where |
|------|-------|-------|
| Author PUT debounce | 1 s | `frontend .../use-derived-fields-sender.ts` |
| Client connection grace (instant remount) | 30 s | `frontend .../yjs-connections.ts` |
| Sync wait before solo fallback | 3 s | `frontend .../task-update-form.tsx` |
| Edit token TTL / refresh | 30 min / 25 min | backend + `yjs-token-fetcher.tsx` |
| Relay state save debounce | 3 s | `src/constants.ts` |
| Relay doc grace after last leave | 5 min | `src/constants.ts` |
| Awareness rate limit | 2/s per client | `src/constants.ts` |
| Token-failure circuit breaker | 5 consecutive | `frontend .../yjs-connections.ts` |

## File structure

```
yjs/src
├── yjs-worker.ts                Entry point
├── constants.ts                 Tuning defaults + DocContext
├── env.ts                       Zod env variables
├── server
│   ├── ws-server.ts             HTTP + WS server lifecycle
│   ├── upgrade.ts               WS upgrade (param validation, auth, access)
│   ├── auth.ts                  HMAC token verification
│   └── health.ts                HTTP health endpoint
├── sync
│   ├── relay.ts                 Binary y-protocols message relay + seeding hook
│   └── session-manager.ts       Active connections per doc, cleanup timers
├── data
│   ├── permissions.ts           Local entity authorization via shared permission engine
│   ├── entity-content.ts        Description-column loader for server-side seeding
│   ├── storage.ts               Y.Doc state CRUD against yjs_documents table
│   └── db.ts                    PG pool with RLS context helper
├── lib
│   ├── blocknote-seed.ts        Server-side BlockNote schema + blocks ↔ Y.Doc conversion
│   ├── pino.ts                  Structured logger
│   └── tracing.ts               OpenTelemetry SDK + health metrics
└── tests/                       Unit + integration tests (incl. seed round-trip)
```

## Scripts

```sh
pnpm dev          # Development with watch mode
pnpm build        # Production build via tsup
pnpm start        # Run production build
pnpm start:dev    # Run with tsx (no build)
pnpm ts           # Type-check
pnpm test         # Run tests
pnpm test:watch   # Run tests in watch mode
```
