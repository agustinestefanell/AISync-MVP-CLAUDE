# PRODUCT_STATUS.md — AISync MVP Feature Tracker

Last updated: 2026-05-26

---

## Documentation Mode

| Feature | Status | Notes |
|---|---|---|
| Repository View | ✅ Live | Checkpoint list with filters |
| **Structure View — DocumentationMirrorTree** | ✅ Closed | Pan/zoom/drag mirror tree, hierarchy codes, role-based labels — commit 7199eb9 |
| Audit View | ✅ Live | Audit log events with hierarchy codes — commit 6fe8f1f |
| Investigate View | ✅ Live | Document investigation panel |
| Knowledge Map | ✅ Live | ReactFlow graph, intentionally dark |

---

## Teams Module

| Feature | Status | Notes |
|---|---|---|
| MAP view | ✅ Live | ReactFlow, agent cards, pan/zoom |
| Tree view | ✅ Live | Compact node tree, wider boxes — commit 4f0f3dc |
| SAT/MAT badge in ribbon | ✅ Live | commit 7197114 |
| SAT structured context (chat API) | ✅ Live | Layers 1/3/4 — commit 0f40de5 |

---

## Settings

| Feature | Status | Notes |
|---|---|---|
| API Keys (cloud providers) | ✅ Live | Light mode fixed — commit 472caf9 |
| Custom Providers | ✅ Live | Light mode fixed — commit 472caf9 |
| Setup Guide | ✅ Live | |

---

## Workspace

| Feature | Status | Notes |
|---|---|---|
| Agent Panels (SAT/MAT) | ✅ Live | |
| Prompt Library | ✅ Live | Modal in workspace + ribbon entry |
| Context Files | ✅ Live | AppLayout wrapping — commit 20c91cb |
| Add Context File | 🔲 Coming soon | UI stub in AgentPanel |

---

## Migrations pending execution in Supabase

| Migration | Status |
|---|---|
| 016_prompt_library.sql | ⚠️ Pending — must run in Supabase Dashboard |
| 017_context_sources.sql | ⚠️ Pending |
| ALTER TABLE agent_sessions ADD COLUMN description | ⚠️ Pending |

---

## Known deferred items

- MAP Open button: `window.open(..., '_blank')` may be blocked by popup blocker. Future fix: `router.push`.
- Prompt Library: ribbon entry is a modal (temporary). Dedicated `/prompts` page pending.
- Capa 2 (Prompts Library injection in chat): architecture defined, not wired.
- `audit_log` FK to checkpoints: architectural decision pending.
