# PRODUCT_STATUS.md — AISync MVP Feature Tracker

Last updated: 2026-05-28 (Repository View search + sort — commit daeb732)

---

## Documentation Mode

| Feature | Status | Notes |
|---|---|---|
| Repository View | ✅ Live | Search bar + sort (newest/oldest/name) + unified uniqueTeams — commit daeb732 |
| **Structure View — DocumentationMirrorTree** | ✅ Closed | Pan/zoom/drag mirror tree + search/project filter — commit 2ba4a49 |
| Audit View | ✅ Live | Ficha documental + team filter con códigos jerárquicos — commit 5fd5863 |
| Investigate View | ✅ Live | Nivel 1 cards + Investigation Context + unified uniqueTeams (checkpoints+handoffs) — commit 71aea80 |
| Knowledge Map | ✅ Live | ReactFlow graph, intentionally dark |

---

## Teams Module

| Feature | Status | Notes |
|---|---|---|
| MAP view | ✅ Live | Sorted by hierarchy code — commit 16a6840 |
| Tree view | ✅ Live | Sorted by hierarchy code — commit 16a6840 |
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
| Agent Panels (SAT/MAT) | ✅ Live | Day markers + timestamps en chat — commit d1382f3 |
| **SMPanel (Documentation Mode)** | ✅ Live | Fused amber ribbon (hint + external warning) + accent top line — commit 8ad6a98 |
| Prompt Library | ✅ Live | Light mode fixed — commit e68db2f |
| Context Files | ✅ Live | Light mode fixed — commit e68db2f |
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
