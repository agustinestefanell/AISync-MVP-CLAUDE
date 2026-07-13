# PRODUCT_STATUS.md — AISync MVP Feature Tracker

Last updated: 2026-07-03 (Dashboard visual redesign — ⚠️ Partial, code complete, pending visual validation)

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
| **Dashboard visual redesign** | ✅ Closed | Pending commit | **Complete UI redesign from approved design assets.** Paleta nueva (#F5F8FC page bg, #FFFFFF surface, #DDE6F1 borders, #0C1733 text primary), typography actualizada (28px Welcome, 18px headers, Inter font), layout grid xl:grid-cols-[1.7fr_1fr] gap-6. **Proyectos como accordion:** Container unificado border-radius 18px, filas colapsables 56px altura, chevron animado, badge "Open" verde, metadata card interna Archive/Delete. **Badge Active Project accionable:** Azul si activo, gris clickeable "Set as active" si no activo, ejecuta setActiveProject. **Connected Teams rediseñado:** Avatares circulares con iniciales (2 letras), 6 colores hash-based, unread badge rojo absoluto, cards 18px radius shadow suave, Host/Invitee badges. Funcionalidad preservada completa: setActiveProject + estados, Realtime updates, unread calculation, Archive/Delete, Edit Team, Connect/Disconnect. Validaciones: lint ✅, build ✅, TypeScript ✅, page.tsx sin cambios ✅. Ver handoff-2026-07.md 2026-07-03. |
| Archive y Delete proyectos | ✅ Closed | commits 65939e5 → 130d68f | Archive y Delete funcionales. Botones inline con confirmación doble en Delete. Archive sin confirmación (soft delete, status → 'archived'). Delete permanente (hard delete + cascade). API `/api/projects/[id]` con PATCH/DELETE + ownership check. Migración 033 (archive) + 034 (delete policy) pendientes aplicación manual. Debug session: 6 commits diagnóstico (04fd03f → 35994bd) — Delete funcionaba correctamente, confusión por borrado manual en DB durante testing. Logs de debug limpiados en 130d68f. |
| Light mode cleanup | ✅ Closed | commit feat: dashboard light mode redesign and connected teams column | `border-gray-800` → `border-gray-200`, `border-indigo-800` → `border-indigo-300`, worker colors `text-blue/teal/orange-400` → `text-gray-600`. Badges actualizados a light: active (green-50/700), free (gray-50/600), locked (amber-50/700). |
| Textos en inglés | ✅ Closed | commit feat: dashboard light mode redesign and connected teams column | My Projects, New Project, Create/Cancel, Open →, active/free/locked, empty states en inglés. |
| Jerarquía visual de teams | ✅ Closed | commit feat: dashboard light mode redesign and connected teams column | Team names con `font-semibold`. Separadores `border-t border-gray-100` entre team blocks. Workers en `text-gray-600`. |
| Connected Teams column | ✅ Closed | commit feat: dashboard light mode redesign and connected teams column | Layout `grid-cols-[1fr_360px]`. Consume `GET /api/connections` client-side, filtra `status === 'active'`. Muestra team name, partner email, badge outgoing/incoming, botón Open → `/teams`. Empty state "There are no connected teams yet." |
| Connected Teams — + Connect button | ✅ Closed | commit feat: complete connected teams - open, incoming requests, disconnect | Botón `+ Connect` en header abre `ConnectTeamModal`. Re-fetch post-connect. |
| ConnectTeamModal — team codes en dropdown | ✅ Closed | commit fix: show team codes in ConnectTeamModal host team dropdown | `computeTeamCodes` + `useMemo` + sort por código + `{code} · {name}`. Mismo patrón que `AddTeamModal`. |
| Connected Teams — Requests panel | ✅ Closed | commit feat: complete connected teams - open, incoming requests, disconnect | Botón `Requests` con badge rojo (count incoming pendientes). Abre `IncomingRequestsPanel`. Accept automático (isolated team creado por backend). Reject. Re-fetch post-action. **IncomingRequestsPanel cleanup (2026-07-06):** Sección redundante "Active connections (incoming)" eliminada — conexiones activas permanecen visibles en Dashboard / Connected Teams panel con mejor jerarquía visual (avatares, badges Host/Invitee) y acciones completas. Modal ahora enfocado únicamente en pending requests. Validado visualmente en producción (2026-07-06): modal con 1 solicitud pendiente muestra Accept/Reject correctamente; modal sin solicitudes muestra "No pending requests." limpio, sin restos de la sección eliminada. |
| **Connected Teams — Mini OE post OE-A fixes** | ✅ Closed | Mini OE 2026-06-13 | 3 fixes: (1) Isolated team card badge → fondo negro con letras blancas; (2) "Open →" en dashboard navega a workspace del isolated team cuando existe; (3) Modal accept invitado sin selector de team + mensaje informativo. Incluye modificación de backend para hacer receiver_team_id opcional. Ver handoff.md para detalle completo. |
| **ConnectTeamModal redesign + Shared Session visual** | ✅ Closed | Mini OE 2026-06-13 | ConnectTeamModal simplificado: no host team selector (auto-usa primer team), descripción obligatoria, paleta de 8 colores. Migration 030: description/color en team_connections. Dashboard muestra descripción. TeamAgentCard: Shared Session full-card black background, white text, labels personalizados (Host + AI, Guest + AI, Host ↔ Guest). |
| Connected Teams — Disconnect | ✅ Closed | commit feat: complete connected teams - open, incoming requests, disconnect | Botón Disconnect inline → confirmación con email del partner → botón rojo confirm + Cancel. Usa `PATCH { action: 'reject' }` (no DELETE — solo para pending+requester). |
| Connected Teams — IncomingRequestsPanel light mode | ✅ Closed | commit feat: complete connected teams - open, incoming requests, disconnect | 7 clases dark reemplazadas: borders, títulos, emails, labels, select, botones Confirm/Accept/Reject todos en light tokens. |
| API error strings — English | ✅ Closed | commit feat: complete connected teams - open, incoming requests, disconnect | 5 strings en español en `connections/route.ts` y `connections/[id]/route.ts` traducidos al inglés. |
| Connected Teams — "How it works" link | ✅ Closed | commit fix: replace ? button with how connected teams work link | Link de texto `How Connected Teams work` debajo del título de la columna. Abre `HowConnectedTeamsModal`. |
| Connected Teams — How it works modal (v2) | ✅ Closed | commit docs: update how connected teams work modal with approved content | 6 secciones aprobadas + tabla quick reference (5 filas: send/accept/view/map/disconnect). Modal ampliado a `max-w-2xl`. |
| Connected Teams — Realtime updates | Partial | commit b9d4b72 | Dashboard connections: realtime ✅. Pending badge: realtime ✅. Disconnect en cuenta pasiva: pendiente OE B completo. |
| **Connected Teams — Dashboard "Open" button fix** | ✅ Closed | commit da4042e | Dashboard botón "Open" usaba `scope_isolated_workspace_id` sin dual-read → invitees navegaban al workspace del host. Fix: nueva función `getUserIsolatedWorkspaceId()` en `connections.ts` (dual-read host/invitee con fallback legacy). ProjectList.tsx actualizado. Invitees ahora navegan a su propio workspace. Ver handoff.md 2026-06-29. |
| **Connected Teams — Teams Map deduplication** | ✅ Closed | commit 65c06d7 | Invitees veían dos tarjetas idénticas del mismo isolated team (aparecía en `projects.flatMap()` Y `isolatedTeams`). Fix: deduplicar `allTeams` por `team.id` usando Map en `teams/page.tsx`. Una sola tarjeta por team ahora. Ver handoff.md 2026-06-29. |
| **Chat-First Onboarding** | ✅ Closed | Commits 5721d17, 5ee3b70, 01aca2c, 464a661, e22ec23, 373853c, ff56050 | Usuario nuevo redirigido a /start. Layout 3 columnas portado de PageJ.tsx demo. Modal provider (Groq, Gemini, Anthropic, OpenAI). Validación pre-flight API key. **Campos Project name y Team name editables** (defaults: My First Project / My First Team, feat 373853c). Auto-creación: Project + Team SAT + Workspace + 3 sessions. **Groq default model actualizado** a llama-3.3-70b-versatile (fix ff56050). initialIntent como **prefill del input** (no autostart) — Usuario ve su texto pre-llenado en el Manager y presiona Send cuando quiera. Autostart eliminado (fix e22ec23: -50 líneas netas, mejor UX, sin timing issues). Skip setup disponible. Dashboard redirect si onboarding_completed=false. Manual migration 032 pending in Supabase. |
| **Start Page — Sober Visual Translation** | ✅ Closed | OE-S8-002, 2026-06-17 | Rediseño visual de /start de colorido a sobrio monocromático institucional. Paleta reducida a grises + blanco + azul solo en CTA. Contenido y nomenclatura preservados 100% (Main AI Session, Research/Review, badge AI, 4 nodos jerárquicos). Sombras mínimas, bordes finos uniformes, ilustraciones simplificadas. Lógica funcional intacta (handlers, validación, API key flow, routing). Ver handoff.md 2026-06-17. |

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
| MAP view | ⏳ Partial | Pending commit | **Draft 2 literal reconstruction v2 + emergency correction applied.** Teams Map rebuilt to match approved Draft 2 design. Project layout uses bento/masonry column flow. Team Cards use top color header with white code/name text. Defensive color fallback added (`backgroundColor: color \|\| '#8E4CC6'`) to prevent gray cards. Workers now visible as: (1) legible labels "Workspaces/Sessions/Workers: N" instead of "WS:N/SES:N/WRK:N", (2) individual agent_sessions rendered as compact badges (GM, W1-W4, +N). Team Members section shows first 4 sessions with overflow counter. Subteams render below parent with visual connectors. Legend with 4 blocks. Map only view. TreeView/CanvasViewport untouched. **Emergency correction (2026-07-12):** After PO screenshot regression feedback, restored workers legibility + added agent_sessions badges + defensive color fallback. **Validations:** lint ✅, build ✅. **Pending:** PO screenshot validation of colors visible, workers as badges, compact layout. |
| Tree view | ✅ Live | commit 16a6840 | **TreeView.tsx deprecated but preserved.** The Map/Tree toggle was removed from UI. TreeView is no longer actively imported in TeamsClient (import commented with deprecation note). File remains for potential future reactivation. Sorted by hierarchy code — commit 16a6840. |
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
| **MODEL_MAP / Provider routing (2026-07-10)** | ✅ Closed | Commit 8e68846 | **Anthropic MODEL_MAP:** Sonnet legacy labels (Claude Sonnet, Claude 3.5 Sonnet, Claude 3.7 Sonnet) now redirect to `claude-sonnet-4-6` (updated from `claude-sonnet-4-5`). New label added: Claude Sonnet 4.6. Claude 3 Haiku and Claude 3 Opus remain unchanged. **OpenAI MODEL_MAP:** New label added: GPT-5.5 → `gpt-5.5`. Existing OpenAI labels (GPT-4o, GPT-4o Mini, GPT-4 Turbo, o1, o3 Mini) remain unchanged to preserve behavior of existing sessions. **No labels deleted** — preserves compatibility with sessions that have legacy labels persisted in `agent_sessions.model`. Google and Groq were not changed. **Validated in production (2026-07-10):** Existing sessions with legacy labels (Claude 3.5 Sonnet, GPT-4o) confirmed working correctly after MODEL_MAP update. |
| **Provider/Model selection UI cleanup (2026-07-10)** | ✅ Closed | Commit dc6d3de | **AddTeamModal and EditTeamModal** now expose only Anthropic, OpenAI and Google for new selections. **Visible latest labels:** Anthropic: Claude Sonnet 4.6, OpenAI: GPT-5.5, Google: Gemini 3.5 Flash. **Groq removed** from Add Team, Edit Team visible provider lists, and ApiKeysManager. **Runtime Groq support** was NOT removed — groq.ts, MODEL_MAP and existing agents untouched. **Generic legacy fallback** implemented in EditTeamModal to preserve existing/manually created legacy/Groq agent values without forcing changes. Editing a legacy/Groq agent shows current value with "(legacy)" label when applicable and allows preservation without forced update. **Validated visually in production (2026-07-10):** Edit Team with Groq test agent confirmed working without breakage or forced changes. Fallback confirmed working for multiple providers (Groq, Claude 3.5 Sonnet legacy). No MODEL_MAP, providers runtime, agent_sessions, migrations or RLS modified. |
| **Groq agents migration to OpenAI (2026-07-10)** | ⚠️ Partial | Commits 9581871, pending | **One-time data migration script** added and executed successfully. 21 explicitly listed Groq agent_sessions migrated to OpenAI / GPT-5.5. Uses closed ID list (not dynamic WHERE provider='Groq'), preflight validation (21/21 pass), textual confirmation gate (confirmed), UPDATE (21/21 success), post-update verification (21/21 confirmed). **Executed:** Preflight ✅, Confirmation ✅, UPDATE ✅, Verification ✅. **Pending:** Production validation (test 1-2 migrated agents, Supabase query, selectivity check). Scripts conserved (.ts + .mjs). No MODEL_MAP, modals, groq.ts, schema or RLS modified. |
| **Groq functional provider removal (2026-07-10)** | ⚠️ Partial | Pending commit | **Mini-OE A: Core functional support removed.** `src/lib/providers/groq.ts` deleted. GroqProvider removed from factory registry. 'Groq' removed from KNOWN_PROVIDERS. groqProvider removed from chat API (tool loop + direct stream). Rama Groq removed from onboarding default model selection. Groq removed from ApiKeyRequiredModal. **Active functional providers:** Anthropic, OpenAI, Google, IA Local. **Validations:** lint ✅, build ✅, grep GroqProvider/groqProvider: 0 results ✅. **Pending:** Functional validation with real chat using existing provider (Anthropic/OpenAI/Google). **Out of scope (Mini-OE B):** Cosmetic cleanup in TeamsClient, AgentCard, TeamNode, AgentPanel, TokenUsageBadge, SMPanel; decision on RESERVED set in settings/providers/route.ts. |

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
| Context Files extraction diagnostics — Stage A | ✅ Closed | Migration 045 + logging | Instrumented error capture: extraction_error field, logging in extractText.ts + route.ts. Revealed "DOMMatrix is not defined" in logs. See handoff-2026-07.md + CodingWorkshop #24. |
| Context Files PDF extraction — Stage B | ✅ Closed | Commits 7479b21, 93c89d7 | Fixed runtime packaging: @napi-rs/canvas@0.1.80 + serverComponentsExternalPackages + outputFileTracingIncludes. Validated binario presente en build. Stage B necesario pero no suficiente — problema era API v1 vs v2, no packaging. See handoff-2026-07.md + CodingWorkshop #25. |
| Context Files PDF extraction — Stage C | ✅ Closed — validated in production | Commit 41bcd84 | **Fix de API:** Migrated extractText.ts to pdf-parse v2 API. Import CanvasFactory from pdf-parse/worker (before PDFParse), instantiate PDFParse class with data + CanvasFactory, call .getText(), destroy in finally. Preserved { text, supported } return shape, Stage A logging, Stage B packaging, DOCX block. Build local ✅ OK. Merged to main by Product Owner override (no preview validation — plataforma pre-lanzamiento). **Production validation 2026-07-02 02:05:** PDF (CASA - ISOPANEL.pdf) extracted_text_available=true, extraction_error=null ✅. DOCX (CASA 1000 U$S por m2.docx) extracted_text_available=true, extraction_error=null ✅. Stage C confirmed working in production. See handoff-2026-07.md + CodingWorkshop #25. |
| **Context Files — Lote A: Modal/Page polish** | ✅ Closed | Commit 40f3a3e | **UI polish for modal "Add Context File" and /context page.** Implemented: (1) Cancel button visible alongside Upload in modal, (2) Archive button per row in "Active in this context" list, porting existing pattern from ContextPageClient, (3) notes field displayed in modal, (4) scope labels (Project/Team/Session) using existing scope field with getScopeLabel() mapping + indigo badge. **Architectural limitation:** No separate file_name column exists — title can be custom (user input) or default (file.name from upload). Without adding original_filename column (out of scope), cannot distinguish custom vs. original. Display shows title as primary + enhanced metadata (file_type, size, extraction, notes, scope). **Not implemented:** title + original filename dual display (requires migration), scope reassignment, archived view, search/filter, duplicate detection, SELECT expansion with team_id/session_id/project_id, scope inference by IDs. **Validations:** lint ✅, build ✅, visual validation ⚠️ pending. **Files modified:** ContextFilePanel.tsx, ContextPageClient.tsx, handoff-2026-07.md, PRODUCT_STATUS.md. See handoff-2026-07.md for full detail. |
| **Context Files — Upload title simplification** | ✅ Closed | Commit 7cf5f17 | **Removed Title (optional) input from Add Context File modal.** New uploads now send `title = file.name` directly. No longer allows manual title override. **Not modified:** title column in schema, existing files with custom titles, /api/context backend, RLS/storage policies. **Validations:** lint ✅, build ✅, visual validation ✅ confirmed by Product Owner with screenshot from production (ai-sync-mvp-claude.vercel.app), 2026-07-02. Verified: Cancel + Upload buttons visible, Title field absent, scope badges (Team) visible per file, Notes visible when present, Archive functioning per row. **Files modified:** ContextFilePanel.tsx (-15 lines), handoff-2026-07.md, PRODUCT_STATUS.md. |
| **Context Files — OE 1: Unified table in /context** | ✅ Closed | Commits e63564f, 05e7eef | **Replaced three separate sections (Project/Team/Session Context) with unified table.** Uses fallback with separate queries strategy (not PostgREST embedding) because project_id/team_id/session_id are TEXT columns without real FKs. Table shows 8 columns: File Name, Type, Size, Team Location, Project, Scope, Status, Actions. Agent column hidden (logic preserved for future reactivation). Team Location empty for project scope. Notes and extraction status preserved from Lote A below filename. Archive button unchanged. **Filters:** Status (dynamic dropdown from real values, default 'active') + Team (dynamic dropdown from real teams, default 'All teams'). Both filters apply simultaneously (AND logic). Project-scoped files visible when Team='All teams'. **Validations:** lint ✅, build ✅, visual validation ✅ confirmed by Product Owner with screenshot from production (ai-sync-mvp-claude.vercel.app/context), 2026-07-02. Verified: 8-column table without Agent, Status="Active" + Team="Prueba por la noche" dropdowns functioning together with AND logic, filtering correctly to selected team rows. **Not modified:** ContextFilePanel.tsx modal, API routes, migrations, RLS, Storage. |
| **Context Files — OE 2: Delete real replaces Archive** | ⚠️ Partial | Pending commit | **Archive replaced by real Delete for Context Files.** Delete removes the original object from the `context-files` Storage bucket when file_path exists. context_sources keeps metadata and traceability with status='deleted'. Deleted files clear content_text and set extracted_text_available=false. audit_log records context_file_deleted with metadata. A critical inconsistency path is handled if Storage deletion succeeds but DB update fails (logs critical error, inserts audit_log context_file_delete_inconsistent, returns error 500 to client). Deleted files are no longer available as AI context (getContextSourcesForRuntime filters by status='active' + extracted_text_available=true + content_text not null). **Restore is not supported by design** because the original Storage object is deleted. **Destructive confirmation modal** with exact text approved by Product Owner. Deleted files show "Deleted from storage" instead of "no text" to distinguish from extraction failure. **Storage client decision:** Normal client with RLS session — admin client NOT needed (storage policies allow DELETE when auth.uid matches path owner). **Migration 046:** Applied manually in production by Product Owner on 2026-07-02, result "Success". **Validations:** lint ✅, build ✅, functional validation ⏳ pending with real file. **Files modified:** migrations/046, api/context/[id]/route.ts (new DELETE endpoint), ContextPageClient.tsx, ContextFilePanel.tsx. |
| **Context Files — Cleanup legacy archived** | ✅ Closed | Commit d006b71 | **Legacy `archived` context_sources migrated to `deleted` — 2026-07-03.** 7 legacy rows created before OE 2 (when Archive button existed) were migrated to the new Delete real flow. **Refactor:** Delete logic extracted to shared function `deleteContextSource()` in `src/lib/context/deleteContextSource.ts`. DELETE endpoint refactored to delegate to shared function (-113 lines net). **Migration:** One-time script `scripts/migrate-archived-to-deleted.mjs` executed successfully. Script used admin client (justified: runs without authenticated user session). **Closed list:** Migration limited to 7 explicit Product Owner-confirmed IDs (not dynamic WHERE status='archived'). **Preflight:** Script validates all 7 IDs exist with status='archived' before processing; aborts entire batch if preflight fails. **Results:** 7/7 success, 0 errors. All files: Storage deleted ✅, DB updated ✅ (status='deleted', content_text=null, extracted_text_available=false), audit_log ✅ (context_file_deleted). **Validation confirmed:** Query 1 (DB status) ✅ 7/7 rows status='deleted' + content_text_is_null=true + extracted_text_available=false. Query 2 (audit_log) ✅ 7/7 entries event_type='context_file_deleted', 0 inconsistent. Visual ✅ Status dropdown shows only Active/Deleted/All — "Archived" disappeared (no rows with that value). **No RLS/schema/migration changes introduced.** See handoff-2026-07.md for full detail. |
| **Markdown rendering in chat messages (2026-07-11)** | ✅ Closed | Commits de21877, docs pending | **AgentPanel and HumanChatPanel now render Markdown.** Installed react-markdown@^10.1.0 + remark-gfm@^4.0.1. AgentPanel (line 676) and HumanChatPanel (line 495) now use ReactMarkdown with explicit Tailwind components for: p, strong, em, ul, ol, li, table, thead, th, td, code (inline/block), blockquote. **Security:** NO rehype-raw, NO dangerouslySetInnerHTML — safe for Connected Teams content from other accounts. **Copy preserved:** copyMessage still copies original msg.content, not rendered HTML. **Bundle impact:** /workspace/[id] First Load JS increased from 20.1 kB to 63.8 kB (+43.7 kB). **Validations:** lint ✅, build ✅, grep rehype-raw/dangerouslySetInnerHTML: 0 results ✅. **Validated visually in production (2026-07-11):** Comparative table, bold text, and list rendered correctly in AgentPanel. Runtime Grounding Layer source-fidelity rules (6-7) confirmed working alongside Markdown rendering. |

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
| 029_isolated_workspace_id.sql | ⏳ PENDING — aplicar manualmente en Supabase SQL Editor (OE A extended); agrega team_connections.scope_isolated_workspace_id |
| 030_connection_description_color.sql | ⏳ PENDING — aplicar manualmente en Supabase SQL Editor (Mini OE 2026-06-13); agrega description/color a team_connections |
| 035_connection_welcome_flag.sql | ⏳ PENDING — aplicar manualmente en Supabase SQL Editor (OE B.3); agrega welcome_viewed_by_invitee a team_connections |
| 037_human_messages.sql | ⏳ PENDING — aplicar manualmente en Supabase SQL Editor (OE B.4); tabla human_messages + RLS para chat humano |
| 038_checkpoint_messages_human_support.sql | ⏳ PENDING — aplicar manualmente en Supabase SQL Editor (OE B.4); extend checkpoint_messages con message_type para soportar mensajes humanos |
| 039_welcome_viewed_by_requester.sql | ⏳ PENDING — aplicar manualmente en Supabase SQL Editor (2026-06-22); agrega welcome_viewed_by_requester a team_connections para welcome bilateral |
| **PENDIENTES PARA PRÓXIMA SESIÓN** | |
| **BUGS DETECTADOS** | |
| Título triplicado en workspace compartido | Bug detectado ("SHARED: SHARED: SHARED...") no diagnosticado ni corregido |
| Botón "Today" en Audit Log | No funciona (pospuesto) |
| **FEATURES DISCUTIDAS NO IMPLEMENTADAS** | |
| Web Search default ON + alerta visual | ✅ **RESUELTO DE OTRA FORMA** — Propuesta original (default ON + alerta visual roja cuando OFF) fue descartada. Implementación final (2026-07-07): Web Search permanece en default OFF, pero el botón OFF ahora es visualmente distintivo (fondo negro, texto blanco, palabra ON/OFF en negrita) para que el usuario lo encuentre cuando el AI le indica activarlo. ON queda neutro. Primera versión con ámbar+pulse fue reemplazada por diseño más sobrio. Validado visualmente en las tres columnas del workspace. Commit 1af4c0a. |
| **REALTIME GAPS** | |
| WorkspaceShell chat humano | ✅ **RESUELTO** — Race condition T0→T1 (SSR → Realtime mount) mitigado con refetch incremental post-SUBSCRIBED. HumanChatPanel ahora refetchea mensajes cuando canal confirma `SUBSCRIBED`, mergeando con estado local vía dedup por `message.id`. Sin polling continuo. Commit pendiente 2026-06-23. |
| OE B.1/B.2 | Realtime general + buildOtherPanelsSnapshot cross-cell siguen diferidos |
| **CONNECTED TEAMS (OE C) DIFERIDOS** | |
| Piezas 3 y 4 | Metadata package + Send Checkpoint diferidos — alto riesgo arquitectural |

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
| Welcome screen for shared workspace | ✅ Closed | OE B.3 — Modal on first invitee visit (commit df105c8, migration 035 pending). Extended 2026-06-22: bilateral welcome (host + invitee) with differentiated content by role (commit e5177df, migration 039 pending). |
| **Human-to-human chat (Panel 1)** | ✅ Closed | OE B.4 — HumanChatPanel with Realtime, day markers, selection support (commit 5654c51, migrations 037+038 pending). Fix crítico 2026-06-18: React hydration errors resueltos (commits 829abdd + 7a3a3f7) — mensajes ahora aparecen sin necesidad de F5. Trazabilidad implementada (commit 8bcb9b6) — Save Version y Save Selection funcionales para mensajes humanos. UX fix (commit 34e94b6) — reordenamiento de secciones (Input → Forward → Actions) y CSS portado de AgentPanel para pixel-perfect match. **Reconnection hardening 2026-07-06:** HumanChatPanel Realtime channel now reconnects automatically after CHANNEL_ERROR, TIMED_OUT or CLOSED. Reconnection uses progressive backoff (1s→2s→4s→8s, 10s cap) with no max retry limit. Existing post-SUBSCRIBED refetch and message dedupe behavior preserved. Similar Realtime reconnect hardening remains pending for TeamsClient.tsx and ProjectList.tsx. |
| **Manager panel (Panel 2)** | ✅ Closed | OE B.4 — Shows first agent_session (manager) with all normal controls |
| **2-panel Connected Teams layout** | ✅ Closed | OE B.4 — Conditional grid in WorkspaceShell for isolated teams |
| **Audit log events: connection lifecycle** | ✅ Closed | OE C completo — 3 eventos registrados: (1) `connection_accepted` bilateral (host + invitee, commits 5b2203f + 0f76bae), (2) `connection_disconnected` bilateral con metadata `disconnected_by` (commit c038fab), (3) `connection_cancelled` unilateral (solo requester, commit c038fab). Metadata completo: partner_email, partner_team_name, description, viewer_role, traceability_note. |
| **Render connection events in Audit Views** | ✅ Closed | OE C Pieza 3 + gaps — EVENT_CONFIG agregado para los 3 eventos en AuditTimeline + AuditView. Fix team_name fallback para eventos con workspace_id=null (commit 7362c57). eventTitle diferenciado por viewer_role: host ve receiver_email, invitee ve requester_email. Build exitoso 2026-06-22. |
| **Audit Log redesigned filters** | ✅ Closed | OE C gaps (commit c038fab) — Filtro rediseñado en AuditTimeline basado en Structure View: search box texto libre + filtro proyecto (condicional) + filtro team + filtro fecha (input date) + orden newest/oldest + reset button. Reemplaza filtro anterior "All states"/"All event types". AuditView mantiene su filtro independiente (divergencia intencional). |
| **Audit Log filter improvements** | ✅ Closed | 2026-06-22 (commit e5919a4) — AJUSTE 1: Shared teams (isolated) ahora aparecen en dropdown "All teams" usando synthetic IDs (metadata:${team_name}). AJUSTE 2: Nuevo filtro "All types" con categorías de eventos (Checkpoint Saved, Resume Work, Web Search, Connections, etc.) — convive con search box (AND logic). AJUSTE 3: Metadata viewer_role agregado a eventos de conexión (host/invitee) → títulos muestran rol explícito ("Connected with [email] — As Invitee"). |
| **Teams Map/Tree View — Isolated teams fix** | ✅ Closed | 2026-06-22 (commit 5718f32) — FIX 1 (agent-map.ts): Nodo worker sintético para isolated teams. Manager genera 2 nodos: (1) GM top node (role: manager) + (2) worker box (role: worker1 sintético). Ambos apuntan al mismo workspace. Verificación de riesgo confirmó agentId solo usado para React key, no navegación. FIX 2 (EditTeamModal.tsx): Filtrar agents a solo manager + grid adaptativo (1 columna vs 3). Resultado: isolated teams muestran 1 GM + 1 caja worker (antes mostraban 1 GM + 0 cajas). |
| **Welcome screen bilateral** | ✅ Closed | 2026-06-22 (commit e5177df, migration 039 pending) — Host (requester) ahora ve pantalla de bienvenida en primera visita al shared workspace ("You can now open their shared workspace..."). Evento welcome_viewed_by_requester registrado en team_connections. Invitee welcome ya existía (welcome_viewed_by_invitee). Contenido diferenciado por rol. |
| **Inactive connection state** | ✅ Closed | 2026-06-23 — Workspaces vinculados a conexiones `cancelled` o `disconnected` ahora muestran banner "This connection is no longer active." y deshabilitan input del chat humano. Query de connectionContext eliminó filtro `status = 'active'` para distinguir entre conexión inexistente vs inactiva. Lista explícita de estados inactivos `['cancelled', 'disconnected']` en lugar de negación. Panel IA propia sigue funcionando normal. Conexiones `active` y workspaces locales sin cambios. **UX refinement:** Server-known inactive connections show only upper inactive-state banner. Stale-open workspace send failure shows only composer-level notice (no duplication). Header del chat humano ahora consistente (email de contraparte en ambos lados). |
| Review & Forward en isolated teams | ✅ Closed | Manager panel en isolated teams ahora ofrece como target de Review & Forward al usuario humano del otro lado de la conexión (email de la contraparte). El dropdown no muestra Worker 1/Worker 2 (ocultos en UX). Envío usa `/api/human-chat` existente. **Follow-up aplicado 2026-06-24:** Sender-side update usa mensaje real devuelto por endpoint via `HumanChatPanel.appendMessage()` para actualización local inmediata (el emisor no recibe Realtime por `broadcast: { self: false }`). Audit log con metadata extendida. Teams normales sin cambios. Commits `aaf0b6e` + follow-up pending. |
| **RLS fix: Invitee messages access** | ✅ Closed | **2026-06-24** — Migration 040 applied to production. RLS policies extended to allow invitee (receiver) of active Connected Teams connections to read and insert messages in agent sessions of the shared isolated workspace. Host policies preserved. AgentPanel.tsx now checks `res.ok` on all 3 POSTs to `/api/messages` (eliminates silent failure). Live validation with authenticated Host/Invitee/third-party accounts pending execution by Product Owner. Other tables from RLS audit (checkpoints, token_usage, session_attachments, audit_log) require separate OEs. Migration 040, commit pending. |
| **ConnectTeamModal isolated team exclusion** | ✅ Closed | **2026-07-06** — ConnectTeamModal now excludes isolated/shared teams from the automatic host team selection used to start a new connection. Filters `teams.filter(t => t.type !== 'isolated')` before selecting hostTeamId. This prevents new connections from being created from an already shared team and avoids names like "Shared: Shared: ...". If no eligible team available, shows error: "No eligible team available to connect from. Isolated (shared) teams cannot be used to start new connections." Existing corrupted legacy team names are not corrected retroactively. Only ConnectTeamModal.tsx modified (+5 lines). No changes to accept backend, Teams Map, RLS, or migrations. **Validación en producción (2026-07-06):** Flujo normal (team nuevo) confirmado sin nombres corruptos. El escenario que requeriría reproducir el caso #4 literalmente (conectar desde un team ya isolated) no es alcanzable en el flujo normal del producto — la arquitectura fuerza que cada conexión cree un team nuevo, y un team isolated huérfano está destinado a archivarse (ver deuda pendiente 'Archived Teams' en checklist), no a reutilizarse. El fix de ConnectTeamModal actúa como segunda capa de seguridad ante ese escenario, aunque no sea alcanzable hoy vía UI normal. |
| Edición de team conectado (Host/Invitee) | ⏳ Pending | Edición de team isolated desde EditTeamModal no es independiente entre Host e Invitado — el Invitado replica los cambios del Host. Pendiente confirmar si es bug de código o decisión de arquitectura no resuelta (el team isolated pertenece estructuralmente solo al Host). |
| Metadata package (host → invitee) | Pending | Post-MVP — optional governance sharing |

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
| Attachment AI summary (2026-07-07) | ✅ **Closed** | Message attachments now generate a short AI summary (2-4 lines) after being saved. The summary is stored in `attachment_metadata.ai_summary` and logged as `attachment_summary_generated` audit event. Fire-and-forget execution (non-blocking). Uses same provider/model as agent. Reuses `extractTextFromBuffer` helper from Context Files. Graceful degradation if summary fails. **RLS Fix (047):** Missing UPDATE policy on `messages` was identified and fixed — `messages_update` policy added with same ownership chain as `messages_select/insert`. Migration 047 executed successfully in production. **Validated visually in production (2026-07-07):** `attachment_metadata.ai_summary` confirmed with real coherent summary (PDF "Costeando Ideas"), status: available, model/provider/timestamp correct. Attachment deletion after 8 hours remains pending for future OE. Commits: c32e9c1, 09fa3d2, 4a5ca3e. |
| Attachment transparency text (2026-07-08) | ✅ **Closed** | Attachment chips now include a small transparency note below the chip area explaining that file content is analyzed but not stored — only metadata and AI summary are kept. The note appears once per message with attachments (not repeated per chip). No attachment upload, metadata, audit_log or storage behavior was changed. **Validated visually in production (2026-07-08):** chip + transparency text confirmed in real message with attachment. Commit cba1695. |

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
| Web Search toggle en AgentPanel | ✅ Closed | `AgentPanel.tsx` — badge clicable, envía `webSearchEnabled`. **Visual emphasis (2026-07-07):** Web Search still defaults to OFF. The OFF state is now visually prominent (amber background with pulse animation) so users can find the toggle when the AI instructs them to enable search. ON state remains visually neutral. No behavior, payload or persistence changes were introduced. |
| Runtime Tavily con API key real | Pending | Agregar `TAVILY_API_KEY` en Vercel Dashboard |
| Tool loop multi-ronda | Deferred | Post-MVP |
| Web search traceability + sources | ✅ Closed | `session_tool_calls.sources` persiste trazabilidad. `audit_log.metadata.sources` alimenta render determinista del panel lateral. Links clickeables en Audit Log. |
| Runtime Grounding Layer with Web Search persistence (2026-07-09) | ✅ Closed | **Runtime Grounding Layer always present.** Includes: `current_datetime_utc` (real UTC timestamp), `web_search_available_right_now: YES/NO` (reflects current toggle state). **7 rules enforced:** (1) Runtime state prevails over prior turns, (2) Anti-fabrication of sources, (3) Claim-by-claim verification not by category, (4) Prefer "I don't know" over guessing, (5) Explicit user instruction when OFF, (6) **Source-fidelity:** Retrieved results are exclusive authority for current/verifiable claims — no blending with training memory, (7) **Source-inference separation:** Label own reasoning separately from source facts. Web Search toggle persists per agent to `agent_sessions.web_search_enabled` (default: true). Migration 048 applied. tool_choice remains auto. Evidence Mode and question classification not implemented. **Observation:** Issue of mixing real search results with training memory detected specifically with Anthropic (2026-07-09), not observed in OpenAI/Google same period — documented as observation, not provider-wide conclusion. Behavior under observation. |

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
- UI strings en español: ✅ Closed — 3 fixes directos 2026-06-16. (1) LogoutButton + ApiKeysManager: 3 strings. (2) Settings: 16 strings. (3) Settings residuales: 5 strings (placeholders, labels, hints). Total: 24 strings. Settings 100% inglés confirmado.
- /start visual redesign: ✅ Closed — Implementación completa desde assets de referencia (SVG + JSON spec) 2026-06-16. Layout exacto 365px/918px/365px, gradiente de fondo oficial, typography del JSON (44px headline, 21px panel title, 16px card title, 15px body, 13px label, 18px button), colores exactos, shadow/radius del JSON, split connector SVG path, mini-cards ilustrativas, copy exacto, IBM Plex Sans mantenida. Bundle optimizado: 5.61kB → 4.66kB (-950 bytes).
- Auth / Session hygiene: ✅ Closed — 2026-06-26. Google login now forces account selection via OAuth `prompt: select_account`. Logout now clears residual SMPanel localStorage keys (`sm-connection`, `sm-messages`, `sm-panel-open`). Middleware, SSR cookies, and Supabase signOut scope unchanged.
- Connected Teams / Dashboard unread badge: ✅ Closed — 2026-06-26. Connected team boxes now show a client-side unread badge for human chat messages. Last seen state is stored locally per connection using `human-chat-last-seen-{connectionId}`. Badge uses the same visual style as Requests. Limitation: unread state is browser-local and does not sync across devices. Server-side read receipts remain future work.

---

## RLS Connected Teams — Checkpoint Tables Fix (2026-06-26)

### Tabla de doble validación: `checkpoints` + `checkpoint_messages`

| Ítem de validación | Tipo | Lógica SQL ✓ | Prueba viva ⏳ | Notas |
|---|---|---|---|---|
| **HOST puede guardar checkpoint en workspace compartido** | Funcional | ✅ | ⏳ | Policy permite `p.account_id = auth.uid()` (ownership directo) |
| **HOST puede leer checkpoints propios en workspace compartido** | Funcional | ✅ | ⏳ | Policy SELECT con ownership directo |
| **INVITEE puede guardar checkpoint en workspace compartido** | Funcional | ✅ | ⏳ | Policy INSERT con cláusula invitee via `team_connections.receiver_account_id` |
| **INVITEE puede leer checkpoints del workspace compartido** | Funcional | ✅ | ⏳ | Policy SELECT con cláusula invitee |
| **INVITEE puede leer checkpoint_messages del workspace compartido** | Funcional | ✅ | ⏳ | Policy SELECT transitiva via checkpoint accesible |
| **TERCERO (no owner, no invitee) NO puede guardar checkpoint** | Seguridad | ✅ | ⏳ | RLS deny-by-default — auth.uid() no match en ninguna cláusula |
| **TERCERO NO puede leer checkpoints ajenos** | Seguridad | ✅ | ⏳ | RLS deny-by-default |
| **TERCERO NO puede leer checkpoint_messages ajenos** | Seguridad | ✅ | ⏳ | RLS deny-by-default transitivo |
| **Conexión CANCELLED no da acceso al invitee** | Seguridad | ✅ | ⏳ | Policy filtrada por `tc.status = 'connected'` |
| **Conexión DISCONNECTED no da acceso al invitee** | Seguridad | ✅ | ⏳ | Policy filtrada por `tc.status = 'connected'` |
| **AgentPanel verifica res.ok antes de parsear** | Resiliencia | ✅ | ✅ | Código agregado en WorkspaceShell.tsx confirmSave() línea ~388-392 |
| **Error RLS loguea status y detalles en consola** | Resiliencia | ✅ | ⏳ | `console.error` con res.status + errText |
| **Frontend muestra error accionable (no silent fail)** | UX | ✅ | ⏳ | setSaveModalError con mensaje de error |

**Estado de validación:**
- ✅ Lógica SQL: Todas las policies revisadas y confirmadas correctas
- ✅ Build: Exitoso sin errores (warnings pre-existentes en CanvasViewport no relacionados)
- ✅ Migración 041: Aplicada exitosamente en Supabase por el Product Owner
- ⏳ Prueba viva: Pendiente de ejecución con cuentas autenticadas (Host/Invitee/Tercero)

**Archivos modificados:**
- `supabase/migrations/041_invitee_checkpoints_access.sql`
- `src/components/workspace/WorkspaceShell.tsx`

**Lección arquitectónica:**
Confirmación del patrón establecido en fix de `messages` (#21): cada tabla de content plane con FK a `workspace_id` debe extender sus políticas RLS para contemplar acceso indirecto del invitee via `team_connections.status = 'connected'`. No hay herencia transitiva de RLS — cada tabla requiere políticas explícitas.

