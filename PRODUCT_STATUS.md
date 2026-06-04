# PRODUCT_STATUS.md — AISync MVP Feature Tracker

Last updated: 2026-05-29 (Decisions registry + evidence audit — OE documental)

---

## Estado Legend

| Estado | Significado |
|---|---|
| `✅ Live` | Implementado y activo en producción. |
| `✅ Closed` | Implementado y validado según alcance definido. Cerrado como tarea de desarrollo. |
| `Partial` | Implementado parcialmente; falta una parte funcional o documental. |
| `UI-only` | Existe en interfaz, pero no tiene implementación funcional completa detrás. |
| `Broken` | Implementado pero falla o no cumple su función esperada. |
| `Needs Review` | Requiere revisión técnica o visual antes de considerarse cerrado. |
| `🔲 Coming soon` | Pendiente de implementación. |

---

## Documentation Mode

| Feature | Estado | Evidencia | Notas |
|---|---|---|---|
| Repository View | ✅ Live | commit ec30d6f | How to use guides updated for all 5 views (Repository, Structure, Audit, Investigate, Knowledge Map). |
| Documentation Mode — How to use guides | ✅ Live | `src/components/documentation/DocClient.tsx` | Search bar + sort (newest/oldest/name) + unified uniqueTeams — commit daeb732. Saved Selections integrated as third document type — commit 4ec8d2d. Purpose labels translated, preview uses last message 600 chars — commit 91b72fa. Handoff Package content_preview added — commit 708980c. Handoff vs Handoff Package labels distinguished — commit d227cc1. Checkpoint content_preview added — commit 98b38ca. Mini chat preview in detail panels — commit 0ec5b85. Open Workspace navigation in Handoff and Saved Selection panels — commit 8971d28. Actor labels (You/AI/agentLabel) in MiniChatPreview bubbles — commit 0da77ce. CheckpointDetailPanel two-column layout — commit d23ee93. Hierarchical metadata (Project/Team) in Handoff and Saved Selection panels — commit 20c42b8. Agent role labels in checkpoint MiniChatPreview and Secondary Metadata — commit ec30d6f. Bifurcated empty states: empty account / active filter + Clear filters / edge case. |
| **Structure View — DocumentationMirrorTree** | ✅ Closed | commit 2ba4a49 | Pan/zoom/drag mirror tree + search/project filter — commit 2ba4a49 |
| Audit View | ✅ Live | commit 5fd5863 | Ficha documental + team filter con códigos jerárquicos — commit 5fd5863 |
| Investigate View | ✅ Live | commit 71aea80 | Nivel 1 cards + Investigation Context + unified uniqueTeams (checkpoints+handoffs) — commit 71aea80. Saved Selections filter + render added — commit 4ec8d2d. Saved Selections visible in default view — commit 91b72fa. Purpose labels translated to English — commit dacfa11 |
| Knowledge Map | ✅ Live | `src/components/documentation/KnowledgeMap.tsx` | ReactFlow graph, intentionally dark |
| Cross Verification (full scope) | Needs Review | `DECISIONS.md` | Scope diferido; requiere capítulo propio de diseño, modelo de datos y criterios de verificación antes de implementar. |
| Page subtitle modal system — `TopRibbon.pageSubtitleOnClick` | ✅ Closed | commit feat: add page subtitle modal system and documentation mode guide | `TopRibbon` soporta `pageSubtitleOnClick` como patrón reusable para modales de ayuda por página. `pageSubtitleHref` mantiene prioridad. Documentation Mode usa el subtítulo como disparador del modal principal "How to use Documentation Mode". `DocClient` toma el rol de layout completo (TopRibbon + BottomRibbon). |

---

## Teams Module

| Feature | Estado | Evidencia | Notas |
|---|---|---|---|
| MAP view | ✅ Live | commit 16a6840 | Sorted by hierarchy code — commit 16a6840 |
| Tree view | ✅ Live | commit 16a6840 | Sorted by hierarchy code — commit 16a6840 |
| Teams Map — How to use modal | ✅ Closed | commit feat: add how to use modal to teams map | Modal principal `How to use Teams Map` accesible desde subtítulo superior via `pageSubtitleOnClick`. `TeamsClient` gestiona layout completo (TopRibbon + BottomRibbon). Tree View, Map View, React Flow intactos. |
| Teams Map — Ribbon buttons + SAT/MAT + Create Teams modals | ✅ Closed | commit fix: teams map ribbon links out of bubble and grouped | Layout final: [Left: título + burbuja SAT/MAT (texto plano) + tres links subrayados agrupados] [Right: controles]. Burbuja sin botón. Wiring de modales intacto. |
| Teams Map — Connect Team modal | ✅ Closed | commit fix: rename connect team ribbon button label | Modal `How to Connect Team` con copy completo. Botón ribbon: "How to CONNECT with other users". |
| SAT/MAT badge in ribbon | ✅ Live | commit 7197114 | commit 7197114 |
| Review & Forward — forwarded context | ✅ Live | `src/components/workspace/AgentPanel.tsx` | Fix: `appendUserMessage` ahora sincroniza `messages` y `apiMessages`. El contexto forwarded llega al modelo. |
| Review & Forward — auto-respond | ✅ Closed | commit feat: auto-respond on forward with visible indicator in agent panel | `appendUserMessage` dispara `sendPrompt(content)` automáticamente cuando `autoRespond=true` (default). Sin duplicación de mensajes. Indicador `Auto-respond: ON` visible en header de cada panel. |
| SAT structured context (chat API) | ✅ Live | commit 0f40de5 | Layers 1/3/4 — commit 0f40de5 |

---

## Settings

| Feature | Estado | Evidencia | Notas |
|---|---|---|---|
| API Keys (cloud providers) | ✅ Live | commit 472caf9 | Light mode fixed — commit 472caf9 |
| Custom Providers | ✅ Live | commit 472caf9 | Light mode fixed — commit 472caf9 |
| Setup Guide | ✅ Live | `src/components/settings/SetupGuide.tsx` | |

---

## Workspace

| Feature | Estado | Evidencia | Notas |
|---|---|---|---|
| Agent Panels (SAT/MAT) | ✅ Live | commit d1382f3 | Day markers + timestamps en chat — commit d1382f3 |
| Main Workspace — How to work modal | ✅ Closed | commit feat: add how to use modal to main workspace | Modal principal `How to work in Workspace` accesible desde subtítulo superior via `pageSubtitleOnClick`. Creado `WorkspaceClient.tsx` como thin wrapper (TopRibbon + BottomRibbon + modal). `WorkspaceShell` intacto. |
| Save Version modal — english labels | ✅ Live | `src/components/workspace/WorkspaceShell.tsx` | Modal translated to English; API error container replaced dark mode residual with light-safe tokens. Purpose dropdown uses English labels (Evidence, Reuse, Resume Later, Documentation, Audit Support). |
| **Save Selection** | ✅ Live | commit 904a429 | Migration 019 + POST route + UI in WorkspaceShell — commit c3e880b. Audit log event `save_selection` added — commit d29c439. Visual display in Audit Timeline + Audit View (amber badge) — commit fcb9029. Agent role preserved in messages — commit 904a429 |
| **SMPanel (Documentation Mode)** | ✅ Live | commit 8ad6a98 | Fused amber ribbon (hint + external warning) + accent top line — commit 8ad6a98 |
| Prompt Library | ✅ Live | commit e68db2f | Light mode fixed — commit e68db2f. Modal no cierra por click en backdrop; textarea ampliado a rows=10 con resize-y. |
| Prompt Library — How to use modal | ✅ Closed | commit feat: add how to use modal to prompt library | Link "How to use Prompt Library" en header del modal principal. Modal de guía con copy aprobado. |
| Prompt Library — Form state reset + assignments panel | ✅ Closed | commit fix: restore assignments panel in prompt library | Reset completo de formulario después de guardar. Panel "Active in this context" restaurado (Assigned to Worker + Inherited from Team + Unassign). Modal de guía `bg-[#f0f0f0]`. |
| Context Files | ✅ Live | commit e68db2f | Light mode fixed — commit e68db2f |
| Add Context File | Partial | `src/components/workspace/AgentPanel.tsx` | Button in AgentPanel opens ContextFilePanel — implemented OE B (2026-05-21). Upload and Team/Session scopes functional. Project scope always empty: `project_id` not passed in prop chain workspace → AgentPanel → ContextFilePanel. Migration 017 applied in Supabase. |

---

## Admin

| Feature | Estado | Evidencia | Notas |
|---|---|---|---|
| Audit Log — Day view UX + Month navigation | ✅ Live | `src/components/audit/AuditTimeline.tsx` | Day View: `Open Workspace →` (all events w/ workspace_id) + `Check Work` (opens modal, checkpoint only). `Resume Work →` lives inside modal only. Sticky header, Month chip → Day nav, light-safe nav buttons. All workspace navigation uses `window.open` (_blank). Event detail side panel: click on card (Day + Week) → side panel with metadata + actions. Week + Day share flex layout with panel; Month View unchanged. |
| Audit Log — How to use modal | ✅ Closed | commit feat: add how to use modal to audit log | Modal principal `How to use Audit Log` accesible desde subtítulo superior via `pageSubtitleOnClick`. `AuditClient` gestiona layout completo (TopRibbon + BottomRibbon). Subtítulo `(click here)` eliminado. |
| Admin prompts route — role lookup | ✅ Live | `src/app/api/admin/prompts/route.ts` | Fix: lookup de `accounts.role` usa `adminClient` en vez de client con cookies. Falso 403 para usuarios `owner` resuelto. Ver CodingWorkshop.md entrada #8. |
| Admin prompts — cache post-save | ✅ Live | `src/components/admin/AdminClient.tsx` | Fix: `router.refresh()` después de save exitoso. Evita que App Router sirva datos cacheados al navegar de vuelta a `/admin`. Ver CodingWorkshop.md entrada #9. |

---

## Migrations pending execution in Supabase

| Migration | Status |
|---|---|
| 016_prompt_library.sql | ✅ Applied |
| 017_context_sources.sql | ✅ Applied |
| 018_agent_session_description.sql | ✅ Applied |
| 019_saved_selections.sql | ✅ Applied |
| 020_fix_checkpoint_messages_rls.sql | ✅ Applied — 2026-06-04, manually via Supabase SQL Editor |

---

## Security fixes

| Fix | Status | Applied |
|---|---|---|
| `checkpoint_messages` RLS — ownership guard via `p.account_id = auth.uid()` | ✅ Closed | 2026-06-04, migration 020, manually applied in Supabase production |
| `checkpoint/[id]` route — explicit 403 on unauthorized access | ✅ Closed | 2026-06-04, `src/app/api/checkpoint/[id]/route.ts` |
| Prompt Library — assignments panel context message in BottomRibbon | ✅ Closed | 2026-06-04, `src/components/workspace/PromptLibrary.tsx` |
| Multimodal — ChatMessage attachments + Anthropic provider base | Partial | 2026-06-04, `types.ts` + `anthropic.ts` — UI de adjuntos en AgentPanel pendiente |
| Multimodal — UI de adjuntos en AgentPanel | Partial | 2026-06-04, `AgentPanel.tsx` — validación runtime con Anthropic pendiente |
| Multimodal — Drag & drop en AgentPanel | ✅ Closed | 2026-06-04, `AgentPanel.tsx` |

---

## Known deferred items

- Deferred: Token counters — captura real de uso por provider (Anthropic, OpenAI, Groq, Gemini). Requiere modificar providers de streaming. 3 fases: DB + contrato → captura por provider → modal UI. Diferido post-backlog estructural.
- MAP Open button: `window.open(..., '_blank')` may be blocked by popup blocker. Future fix: `router.push`.
- Prompt Library: ribbon entry is a modal (temporary). Dedicated `/prompts` page pending.
- Capa 2 (Prompts Library injection in chat): architecture defined, not wired.
- `audit_log` FK to checkpoints: architectural decision pending.
- Add Context File: `project_id` not passed in prop chain — Project-scope files always show empty. See `Partial` status in Workspace table.
- Cross Verification: full scope deferred. See `Needs Review` in Documentation Mode table and `DECISIONS.md`.
