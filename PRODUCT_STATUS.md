# PRODUCT_STATUS.md — AISync MVP Feature Tracker

Last updated: 2026-06-13 (Mini OE: 3 fixes post OE-A Scope Isolated Team — cerrada)

---

## MVP-READY PLANNING — Pre-lanzamiento beta

Orden recomendado: Bloque 1 → Bloque 2 → Bloque 3. Total estimado: 5-6 sesiones.

### 🔴 Bloque 1 — Seguridad y estabilidad (no negociable antes de usuarios reales)

| Tarea | Detalle | Estimación | Estado |
|---|---|---|---|
| Connect Team — Gap 1 y 3 | Revisar DECISIONS.md y cerrar los dos gaps de seguridad identificados | 1 sesión | ✅ Closed — Gap 1: verify receiver email in accounts before insert (fix 2026-06-11: lookup con admin client — la versión original usaba cliente de usuario y la RLS de accounts lo bloqueaba; estado funcional restaurado para usuarios no-admin). Gap 3: PATCH requires receiver_email match, DELETE requires requester_account_id match. |
| Workspace Lock — SEC-007 | Lock/Unlock no persistía (sin política UPDATE en workspaces) y el audit log registraba eventos no persistidos | 1 sesión | ✅ Closed — route con ownership check + verificación de filas afectadas; migración 025 aplicada 2026-06-11. UI sin botón Lock por decisión de producto (ver DECISIONS.md — Smart Lock post-MVP) |
| BYOK estricto — SEC-006 | Fallback a ENV_KEYS de plataforma consumía la cuenta de AISync para usuarios sin key propia | 1 sesión | ✅ Closed — fallback condicionado a NODE_ENV development en chat y sm-doc-chat; en producción, 400 accionable. Ver DECISIONS.md 2026-06-11 |
| Rate limiting en API routes — SEC-009 | Proteger endpoints críticos (chat, connections, context, teams) contra abuso | 1 sesión | ✅ Closed — Upstash Redis + interfaz RateLimiter desacoplada, fail-open. Ver sección Rate limiting y DECISIONS.md 2026-06-11 |
| RLS multi-usuario | Crear segunda cuenta de prueba y verificar aislamiento real de datos | 1 sesión | ⏳ Pendiente |

### 🟡 Bloque 2 — Experiencia de usuario nuevo

| Tarea | Detalle | Estimación | Estado |
|---|---|---|---|
| BYOK verification | Usuario nuevo sin API keys — mapear todos los errores posibles y manejarlos gracefully | 1 sesión | ⏳ Pendiente |
| Onboarding mínimo | Welcome flow: primer login → crear proyecto → crear team → abrir workspace | 1 sesión | ⏳ Pendiente |
| Textos residuales en español | "Welcome", "Cerrar sesión" y cualquier string visible en español | Mini OE | ⏳ Pendiente |

### 🟢 Bloque 3 — Limpieza pre-lanzamiento

| Tarea | Detalle | Estimación | Estado |
|---|---|---|---|
| Migraciones 023+024 | Confirmar aplicadas en Supabase (ya están, solo documentar) | 5 min | ✅ Done |
| TAVILY_API_KEY en Vercel | Confirmar configurada (ya está) | 5 min | ⏳ Pendiente |
| Audit de páginas | Recorrer toda la app como usuario nuevo y anotar friction points | 1 sesión | ⏳ Pendiente |

### ⚪ Diferido — Post primera beta

- Rate limiting avanzado
- Audit de seguridad externo
- Migración a AISyncteam.com
- `/prompts` página dedicada

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

## Dashboard

| Feature | Estado | Evidencia | Notas |
|---|---|---|---|
| Dashboard en `/` (arquitectura simple) | ✅ Closed | commit 6f30555 | Dashboard directo en `/` sin lógica de onboarding. Refactor de "intelligent router" (commit 983bdc1) revertido en 6f30555 — sobrecomplicado, rompía links del ribbon. Arquitectura simple: `/` = dashboard, `/start` = onboarding, logo → `/start`, link Dashboard → `/`. KISS principle aplicado. |
| Archive y Delete proyectos | ✅ Closed | commits 65939e5 → 130d68f | Archive y Delete funcionales. Botones inline con confirmación doble en Delete. Archive sin confirmación (soft delete, status → 'archived'). Delete permanente (hard delete + cascade). API `/api/projects/[id]` con PATCH/DELETE + ownership check. Migración 033 (archive) + 034 (delete policy) pendientes aplicación manual. Debug session: 6 commits diagnóstico (04fd03f → 35994bd) — Delete funcionaba correctamente, confusión por borrado manual en DB durante testing. Logs de debug limpiados en 130d68f. |
| Light mode cleanup | ✅ Closed | commit feat: dashboard light mode redesign and connected teams column | `border-gray-800` → `border-gray-200`, `border-indigo-800` → `border-indigo-300`, worker colors `text-blue/teal/orange-400` → `text-gray-600`. Badges actualizados a light: active (green-50/700), free (gray-50/600), locked (amber-50/700). |
| Textos en inglés | ✅ Closed | commit feat: dashboard light mode redesign and connected teams column | My Projects, New Project, Create/Cancel, Open →, active/free/locked, empty states en inglés. |
| Jerarquía visual de teams | ✅ Closed | commit feat: dashboard light mode redesign and connected teams column | Team names con `font-semibold`. Separadores `border-t border-gray-100` entre team blocks. Workers en `text-gray-600`. |
| Connected Teams column | ✅ Closed | commit feat: dashboard light mode redesign and connected teams column | Layout `grid-cols-[1fr_360px]`. Consume `GET /api/connections` client-side, filtra `status === 'active'`. Muestra team name, partner email, badge outgoing/incoming, botón Open → `/teams`. Empty state "There are no connected teams yet." |
| Connected Teams — + Connect button | ✅ Closed | commit feat: complete connected teams - open, incoming requests, disconnect | Botón `+ Connect` en header abre `ConnectTeamModal`. Re-fetch post-connect. |
| ConnectTeamModal — team codes en dropdown | ✅ Closed | commit fix: show team codes in ConnectTeamModal host team dropdown | `computeTeamCodes` + `useMemo` + sort por código + `{code} · {name}`. Mismo patrón que `AddTeamModal`. |
| Connected Teams — Requests panel | ✅ Closed | commit feat: complete connected teams - open, incoming requests, disconnect | Botón `Requests` con badge rojo (count incoming pendientes). Abre `IncomingRequestsPanel`. Accept automático (isolated team creado por backend). Reject. Re-fetch post-action. |
| **Connected Teams — Mini OE post OE-A fixes** | ✅ Closed | Mini OE 2026-06-13 | 3 fixes: (1) Isolated team card badge → fondo negro con letras blancas; (2) "Open →" en dashboard navega a workspace del isolated team cuando existe; (3) Modal accept invitado sin selector de team + mensaje informativo. Incluye modificación de backend para hacer receiver_team_id opcional. Ver handoff.md para detalle completo. |
| **ConnectTeamModal redesign + Shared Session visual** | ✅ Closed | Mini OE 2026-06-13 | ConnectTeamModal simplificado: no host team selector (auto-usa primer team), descripción obligatoria, paleta de 8 colores. Migration 030: description/color en team_connections. Dashboard muestra descripción. TeamAgentCard: Shared Session full-card black background, white text, labels personalizados (Host + AI, Guest + AI, Host ↔ Guest). |
| Connected Teams — Disconnect | ✅ Closed | commit feat: complete connected teams - open, incoming requests, disconnect | Botón Disconnect inline → confirmación con email del partner → botón rojo confirm + Cancel. Usa `PATCH { action: 'reject' }` (no DELETE — solo para pending+requester). |
| Connected Teams — IncomingRequestsPanel light mode | ✅ Closed | commit feat: complete connected teams - open, incoming requests, disconnect | 7 clases dark reemplazadas: borders, títulos, emails, labels, select, botones Confirm/Accept/Reject todos en light tokens. |
| API error strings — English | ✅ Closed | commit feat: complete connected teams - open, incoming requests, disconnect | 5 strings en español en `connections/route.ts` y `connections/[id]/route.ts` traducidos al inglés. |
| Connected Teams — "How it works" link | ✅ Closed | commit fix: replace ? button with how connected teams work link | Link de texto `How Connected Teams work` debajo del título de la columna. Abre `HowConnectedTeamsModal`. |
| Connected Teams — How it works modal (v2) | ✅ Closed | commit docs: update how connected teams work modal with approved content | 6 secciones aprobadas + tabla quick reference (5 filas: send/accept/view/map/disconnect). Modal ampliado a `max-w-2xl`. |
| Connected Teams — Realtime updates | Partial | commit b9d4b72 | Dashboard connections: realtime ✅. Pending badge: realtime ✅. Disconnect en cuenta pasiva: pendiente OE B completo. |
| **Chat-First Onboarding** | ✅ Closed | Commits 5721d17, 5ee3b70, 01aca2c, 464a661, e22ec23, 373853c, ff56050 | Usuario nuevo redirigido a /start. Layout 3 columnas portado de PageJ.tsx demo. Modal provider (Groq, Gemini, Anthropic, OpenAI). Validación pre-flight API key. **Campos Project name y Team name editables** (defaults: My First Project / My First Team, feat 373853c). Auto-creación: Project + Team SAT + Workspace + 3 sessions. **Groq default model actualizado** a llama-3.3-70b-versatile (fix ff56050). initialIntent como **prefill del input** (no autostart) — Usuario ve su texto pre-llenado en el Manager y presiona Send cuando quiera. Autostart eliminado (fix e22ec23: -50 líneas netas, mejor UX, sin timing issues). Skip setup disponible. Dashboard redirect si onboarding_completed=false. Manual migration 032 pending in Supabase. |

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
| Add Team — parent dropdown con códigos jerárquicos | ✅ Closed | commit c24694e | `computeTeamCodes` importado en `AddTeamModal`. Dropdown ordenado por código. Cada option muestra `A-01 · Team Name`. Fallback `—` para teams sin código. Autocontenido — sin cambios al componente padre. |

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
| Agent Panels (SAT/MAT) | ✅ Live | commit d1382f3 | Day markers + timestamps en chat — commit d1382f3. Scroll al final al cargar mensajes históricos — behavior: instant. |
| Main Workspace — How to work modal | ✅ Closed | commit feat: add how to use modal to main workspace | Modal principal `How to work in Workspace` accesible desde subtítulo superior via `pageSubtitleOnClick`. Creado `WorkspaceClient.tsx` como thin wrapper (TopRibbon + BottomRibbon + modal). `WorkspaceShell` intacto. |
| User email en workspace TopRibbon | ✅ Closed | commit ff56050 | Email del usuario activo visible en TopRibbon derecha, entre TokenUsageBadge y borde. Pasado desde workspace page → WorkspaceClient → TopRibbon como `userName` prop. Útil para identificar sesión en screenshots y debugging. |
| Save Version modal — english labels | ✅ Live | `src/components/workspace/WorkspaceShell.tsx` | Modal translated to English; API error container replaced dark mode residual with light-safe tokens. Purpose dropdown uses English labels (Evidence, Reuse, Resume Later, Documentation, Audit Support). |
| **Save Selection** | ✅ Live | commit 904a429 | Migration 019 + POST route + UI in WorkspaceShell — commit c3e880b. Audit log event `save_selection` added — commit d29c439. Visual display in Audit Timeline + Audit View (amber badge) — commit fcb9029. Agent role preserved in messages — commit 904a429 |
| **SMPanel (Documentation Mode)** | ✅ Live | commit 8ad6a98 | Fused amber ribbon (hint + external warning) + accent top line — commit 8ad6a98 |
| Prompt Library | ✅ Live | commit e68db2f | Light mode fixed — commit e68db2f. Modal no cierra por click en backdrop; textarea ampliado a rows=10 con resize-y. |
| Prompt Library — How to use modal | ✅ Closed | commit feat: add how to use modal to prompt library | Link "How to use Prompt Library" en header del modal principal. Modal de guía con copy aprobado. |
| Prompt Library — Form state reset + assignments panel | ✅ Closed | commit fix: restore assignments panel in prompt library | Reset completo de formulario después de guardar. Panel "Active in this context" restaurado (Assigned to Worker + Inherited from Team + Unassign). Modal de guía `bg-[#f0f0f0]`. |
| Prompt Library — Tags UI | ✅ Closed | commit feat: add tags input and display to prompt library | Input comma-separated de tags en el form. Parser a `string[]`. Persistencia en `insert`/`update`. Chips en prompt cards. Pre-populación al editar. Prompts sin tags no rompen UI. |
| Prompt Library — Tags UX mejorado | ✅ Closed | commit feat: improve tags UX with chip input, suggestions and filter | Chip input (Space/Enter/comma para materializar). X en chips para remover. Suggestions dropdown con tags existentes. Tag filter bar sobre la lista. Tags en cards como botones de filtro. Clear filter. Input con borde visible. Click en tag del filter bar agrega al form si está abierto. |
| Context Files | ✅ Live | commit e68db2f | Light mode fixed — commit e68db2f |
| Add Context File | ✅ Closed | `src/components/workspace/AgentPanel.tsx` | Upload, Team, Session, and Project scopes functional. `projectId` now propagated from WorkspaceShell → AgentPanel → ContextFilePanel via `workspace.teams?.project_id`. Migration 017 applied in Supabase. |

---

## Admin

| Feature | Estado | Evidencia | Notas |
|---|---|---|---|
| Audit Log — Day view UX + Month navigation | ✅ Live | `src/components/audit/AuditTimeline.tsx` | Day View: `Open Workspace →` (all events w/ workspace_id) + `Check Work` (opens modal, checkpoint only). `Resume Work →` lives inside modal only. Sticky header, Month chip → Day nav, light-safe nav buttons. All workspace navigation uses `window.open` (_blank). Event detail side panel: click on card (Day + Week) → side panel with metadata + actions. Week + Day share flex layout with panel; Month View unchanged. Badges `File Attached` (blue) y `Web Search` (purple) para eventos multimodal y tool calls. Side panel muestra sección `Sources` con links clickeables para eventos `tool_call_executed` desde `audit_log.metadata.sources`. |
| Audit Log — How to use modal | ✅ Closed | commit feat: add how to use modal to audit log | Modal principal `How to use Audit Log` accesible desde subtítulo superior via `pageSubtitleOnClick`. `AuditClient` gestiona layout completo (TopRibbon + BottomRibbon). Subtítulo `(click here)` eliminado. |
| Admin prompts route — role lookup | ✅ Live | `src/app/api/admin/prompts/route.ts` | Fix: lookup de `accounts.role` usa `adminClient` en vez de client con cookies. Falso 403 para usuarios `owner` resuelto. Ver CodingWorkshop.md entrada #8. |
| Admin prompts — cache post-save | ✅ Live | `src/components/admin/AdminClient.tsx` | Fix: `router.refresh()` después de save exitoso. Evita que App Router sirva datos cacheados al navegar de vuelta a `/admin`. Ver CodingWorkshop.md entrada #9. |

---

## Migrations pending execution in Supabase

| Migration | Status |
|---|---|
| 000_accounts_baseline.sql | 📄 Documental — schema y trigger de accounts creados a mano pre-001; YA aplicada en producción, NO ejecutar (SEC-003) |
| 032_onboarding_flag.sql | ⏳ PENDING — agregar accounts.onboarding_completed para Chat-First |
| 033_project_archive.sql | ⏳ PENDING — agregar projects.status para Archive/Delete feature |
| 016_prompt_library.sql | ✅ Applied |
| 017_context_sources.sql | ✅ Applied |
| 018_agent_session_description.sql | ✅ Applied |
| 019_saved_selections.sql | ✅ Applied |
| 020_fix_checkpoint_messages_rls.sql | ✅ Applied — 2026-06-04, manually via Supabase SQL Editor |
| 021_session_attachments_and_tool_calls.sql | ✅ Applied — 2026-06-05, manually via Supabase SQL Editor |
| 022_messages_attachment_metadata.sql | ✅ Applied — 2026-06-05, manually via Supabase SQL Editor |
| 023_token_usage.sql | ✅ Applied — 2026-06-10, manually via Supabase SQL Editor |
| 024_token_usage_capture_method.sql | ✅ Applied — 2026-06-10, manually via Supabase SQL Editor |
| 025_workspaces_update_policy.sql | ✅ Applied — 2026-06-11, manually via Supabase SQL Editor (SEC-007) |
| 026_vault_api_keys.sql | ⏳ PENDING — aplicar manualmente en Supabase SQL Editor inmediatamente después del deploy (SEC-005); luego backfill manual (SQL en handoff.md 2026-06-12) |
| 027_active_project.sql | ⏳ PENDING — aplicar manualmente en Supabase SQL Editor (ARC-004 Switch Project); su prueba post-aplicación verifica además SEC-002 |
| 028_scope_isolated_team.sql | ⏳ PENDING — aplicar manualmente en Supabase SQL Editor (OE A Scope Isolated Team); extiende constraint teams_type_check + agrega scope_isolated_team_id + RLS policies para invitee |

---

## Connected Teams — Shared Workspace (OE A — 2026-06-13)

| Feature | Status | Notes |
|---|---|---|
| Scope Isolated Team creation on accept | ✅ Closed | Migration 028 + accept flow + Teams Map badge |
| `team_connections.scope_isolated_team_id` | ✅ Closed | Links active connection to isolated team (FK to teams ON DELETE SET NULL) |
| `teams.type` supports `'isolated'` | ✅ Closed | Constraint `teams_type_check` updated: `('SAT', 'MAT', 'isolated')` |
| Isolated workspace RLS for invitee | ✅ Closed | Policy "Invitee can read isolated workspace" + "Invitee can read isolated agent_sessions" |
| Teams Map badge "Shared Session" | ✅ Closed | Orange badge (`#c2410c`) for `type === 'isolated'` — GM and SM/Worker cards |
| Accept creates team/workspace/3 sessions | ✅ Closed | Fail-open implementation — accept succeeds even if isolated team creation fails |
| Provider/model resolution | ✅ Closed | Resolved from requester team's agent_sessions; defaults to Anthropic/Claude 3.5 Sonnet |
| Duplicate protection | ✅ Closed | Checks `scope_isolated_team_id` before creating new isolated team |
| Supabase Realtime sync | Pending | OE B — cross-browser synchronization |
| Panel 3 functional (U1↔U2 chat) | Pending | OE B — human-to-human channel |
| Welcome screen for shared workspace | Pending | OE B — onboarding UX |
| Metadata package (host → invitee) | Pending | OE B — optional governance sharing |

---

## Switch Project (2026-06-12)

- `accounts.active_project_id` definido vía migración 027 (FK ON DELETE SET NULL)
- RPC `set_active_project` con ownership check creada en repo
- `getActiveProjectId()` lee la selección persistida con fallback al primer proyecto activo
- `active-workspace` consume el helper centralizado (lógica duplicada eliminada)
- Dashboard: badge "active" real + botón "Set active" por proyecto
- Teams Map: dropdown de proyecto en el ribbon operativo
- ⏳ Aplicación manual de la 027 pendiente — hasta entonces el switch devuelve error y todo opera como antes (primer proyecto)

---

## Security fixes

| Fix | Status | Applied |
|---|---|---|
| `checkpoint_messages` RLS — ownership guard via `p.account_id = auth.uid()` | ✅ Closed | 2026-06-04, migration 020, manually applied in Supabase production |
| `checkpoint/[id]` route — explicit 403 on unauthorized access | ✅ Closed | 2026-06-04, `src/app/api/checkpoint/[id]/route.ts` |
| Prompt Library — assignments panel context message in BottomRibbon | ✅ Closed | 2026-06-04, `src/components/workspace/PromptLibrary.tsx` |
| Rate limiting por usuario en chat/connections/context/teams — SEC-009 | ✅ Closed | 2026-06-11, `src/lib/rate-limit/` + 4 routes, Upstash Redis fail-open |

---

## Rate limiting

- Implementado con Upstash Redis (SEC-009, 2026-06-11)
- Interfaz `RateLimiter` desacoplada del proveedor (`src/lib/rate-limit/`)
- chat: 30 req/min por usuario
- connections: 10 req/min por usuario
- context: 20 req/min por usuario
- teams: 10 req/min por usuario
- Política fail-open ante fallo de Upstash (verificada sin env vars: la request continúa y se loguea)
- Pendiente futuro: LocalRateLimiter / NoopRateLimiter si se requiere entorno offline; extender a sm-doc-chat y demás routes de escritura

---

## API Hardening 2 (2026-06-11)

- handoff-package protegido con workspace ownership check (SEC-008)
- save-selection protegido con workspace ownership check + validación de team_id/project_id contra la cadena real (SEC-008)
- `resolveProviderApiKey` centraliza BYOK, custom providers y dev fallback (`src/lib/providers/resolveApiKey.ts`, ARC-001)
- Groq incluido en KNOWN_PROVIDERS compartido — sm-doc-chat gana soporte Groq
- active-workspace marcado force-dynamic (ARC-003; estaba siendo prerenderizada en build)
- API error strings normalizados a inglés — 20 strings en 12 routes (ARC-002)
- Pendiente: helper `requireUser()` evaluado y diferido a OE separada (tocaría 18 routes)

---

## Error Handling / Streaming (2026-06-11)

- AgentPanel persiste userMsg antes de iniciar el stream (fail-open) — ERR-003
- Flujo exitoso persiste solo assistantMsg, sin duplicar userMsg
- Stream interrumpido conserva el contenido parcial en pantalla y en DB, marcado "⚠️ Response interrupted"
- Error visible accionable: "The response was interrupted. Your message has been saved." (solo con tokens parciales reales; los 400/429 conservan su mensaje)
- Pendientes: ERR-001 (Anthropic lazy stream init — errores pre-token inconsistentes) y ERR-002 (sin try/catch en for await de providers — sin log server-side), ambos zona providers, OEs dedicadas
- SMPanel fuera de scope (efímero, no persiste mensajes)

---

## SEC-005 / API key encryption (2026-06-12)

- Supabase Vault habilitado (pgsodium 3.1.8, supabase_vault 0.3.1) y soportado
- Migración 026 creada en repo — ⏳ aplicación manual pendiente
- `user_api_keys` y `user_custom_providers` preparados con `vault_secret_id`/`key_last4`
- Nuevas escrituras van a Vault vía RPCs SECURITY DEFINER (set/get/delete × 2 tablas)
- Runtime lee Vault primero, plaintext legacy como fallback (dual-read)
- GET settings muestra `key_last4` — nunca la API key real
- DELETE borra fila + secret en Vault (sin secrets huérfanos)
- ⚠️ Ventana conocida: guardar keys nuevas da 500 hasta aplicar la 026 (deliberado — sin fallback plaintext)
- Backfill manual pendiente (SQL en handoff.md 2026-06-12)
- Limpieza de plaintext legacy → fase posterior, tras validar Vault-first en producción

---

## Multimodal — File Attachments

| Feature | Status | Notes |
|---|---|---|
| `ChatAttachment` type + `ChatMessage.attachments?` | ✅ Closed | `types.ts` — campo opcional, retrocompatible |
| Anthropic — image + document blocks | ✅ Closed | `anthropic.ts` — `sdkMessages` con content blocks |
| OpenAI — image attachments via `image_url` | ✅ Closed | `openai.ts` — solo imágenes; PDF fallback con mensaje informativo |
| OpenAI — PDF via Files API | Deferred | Requiere Files API OE futura |
| Google Gemini — inlineData en lastMessage | ✅ Closed | `google.ts` — imágenes + PDFs; attachments históricos limitación MVP |
| Groq — attachments | ✅ Closed | Provider sanitiza payload antes de llamar a la API (solo `role`+`content`), previniendo error 400. AgentPanel muestra warning informativo al adjuntar. |
| AgentPanel UI — clip button + chips + drag & drop | ✅ Closed | `AgentPanel.tsx` — input file oculto, chips removibles, drag & drop |
| AgentPanel — sendPrompt guard fix | ✅ Closed | `AgentPanel.tsx` — `(!content && !atts.length)` permite envío solo-adjunto |
| Attachment traceability | ✅ Closed | Migración 021 + 022 aplicadas. `session_attachments` + `audit_log` events via `Promise.allSettled`. `attachment_metadata jsonb` en `messages`. Chips de adjunto visibles post-reload. |

---

## Tools / Web Search

| Feature | Status | Notes |
|---|---|---|
| Tool registry — `src/lib/tools/` | ✅ Closed | `ToolDefinition`, `ToolExecutor`, `toolRegistry`, `getTool()` |
| Tavily `webSearchTool` | ✅ Closed | `web-search.ts` — requiere `TAVILY_API_KEY` en Vercel |
| `ChatProvider.complete?` — contrato opcional | ✅ Closed | `types.ts` — no rompe providers sin implementación |
| Anthropic `complete()` | ✅ Closed | `anthropic.ts` — detecta `tool_use`, convierte tools a `input_schema` |
| OpenAI `complete()` | ✅ Closed | `openai.ts` — function tools, filtra `tc.type === 'function'` |
| Google `complete()` | ✅ Closed | `google.ts` — `functionDeclarations`, `functionCalls()`, `randomUUID()` |
| Tool loop en `chat/route.ts` | ✅ Closed | Una ronda: `complete()` → execute tool → `stream()` final |
| Web Search toggle en AgentPanel | ✅ Closed | `AgentPanel.tsx` — badge clicable, envía `webSearchEnabled` |
| Runtime Tavily con API key real | Pending | Agregar `TAVILY_API_KEY` en Vercel Dashboard |
| Tool loop multi-ronda | Deferred | Post-MVP |
| Web search traceability + sources | ✅ Closed | `session_tool_calls.sources` persiste trazabilidad. `audit_log.metadata.sources` alimenta render determinista del panel lateral. Links clickeables en Audit Log. |

---

## Ephemeral Traceability

| Feature | Status | Notes |
|---|---|---|
| `session_attachments` table | ✅ Closed | Migración 021 + 022 aplicadas. `chat/route.ts` registra en `session_attachments` y `audit_log` (`attachment_uploaded`) via `Promise.allSettled`. Audit Log UI + AuditView muestran filename. Chat muestra chip en historial post-reload. Fix Anthropic empty content post-reload. |
| `session_tool_calls` table | ✅ Closed | Migración 021 aplicada. `chat/route.ts` registra tool calls + sources en `session_tool_calls` y `audit_log.metadata.sources` via `Promise.allSettled`. Audit Log side panel muestra sources como links clickeables. Render determinista desde metadata snapshot. |

---

## Known deferred items

- Token Counters Fase 1 — ✅ tabla `token_usage` + `TokenUsage` type. Migraciones 023 + 024 aplicadas en Supabase.
- Token Counters Fase 2a — ✅ Anthropic: `stream()` captura via `finalMessage()`, `complete()` via `response.usage`. `onUsage` desacoplado — fallo no interrumpe stream.
- Token Counters Fase 2b — ✅ OpenAI/Groq/Gemini: `stream_options: { include_usage: true }` en OpenAI/Groq. `usageMetadata` en Gemini stream + complete. Nomenclatura normalizada a `input_tokens/output_tokens`. Persistencia via `persistUsage` reutilizado.
- Token Counters Fase 3 — ✅ `TopRibbon` acepta `rightBadge?: React.ReactNode`. `TokenUsageBadge` muestra chips por provider en el ribbon (Claude 26.9k / OpenAI 7.7k / etc). Cada chip abre el modal con desglose por provider/model. Badge no se muestra si no hay datos. Dashboard avanzado de consumo sigue pendiente.
- MAP Open button: `window.open(..., '_blank')` may be blocked by popup blocker. Future fix: `router.push`.
- Prompt Library: ribbon entry is a modal (temporary). Dedicated `/prompts` page pending.
- Capa 2 (Prompts Library injection in chat): architecture defined, not wired.
- `audit_log` FK to checkpoints: architectural decision pending.
- Add Context File: ✅ Closed — `project_id` now passed through WorkspaceShell → AgentPanel → ContextFilePanel. All three scopes (Session, Team, Project) functional.
- Cross Verification: full scope deferred. See `Needs Review` in Documentation Mode table and `DECISIONS.md`.
- OpenAI PDF support: requiere Files API. Diferido.
- Google multimodal en historial: solo `lastMessage` soporta `inlineData`. Limitación MVP documentada.
- UI strings en español: ✅ Closed — fix directo 2026-06-16. LogoutButton.tsx ("Sign out"), ApiKeysManager.tsx ("Save", "Delete"). 100% inglés en UI confirmado.
