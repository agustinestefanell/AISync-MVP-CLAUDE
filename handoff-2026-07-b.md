# handoff-2026-07-b.md — Memoria operativa del proyecto AISync MVP

**Archivo activo desde:** 2026-07-12 (rotación proactiva desde handoff-archive-2026-07-a.md)

Este archivo es la continuación de `handoff-archive-2026-07-a.md` (cerrado a los 168KB).

## Reglas de rotación de archivos handoff

**Regla 1 — Archivo activo por fecha:**
La fecha que figura al inicio de cada archivo de handoff marca desde cuándo está activo ese archivo. Las entradas nuevas se agregan en el archivo cuya fecha de inicio es la más reciente antes de la fecha actual, no en archivos anteriores.

**Regla 2 — Rotación por tamaño:**
Cuando el archivo de handoff activo alcance aproximadamente 400KB de tamaño, se debe crear un archivo nuevo siguiendo el mismo patrón de nombre (`handoff-YYYY-MM-b.md`, `handoff-YYYY-MM-c.md`, etc. usando el mes en que se hace el corte + sufijo secuencial), dejar una nota de continuidad al final del archivo que se cierra, y actualizar la referencia en CLAUDE.md (o donde corresponda) para que las sesiones futuras escriban en el archivo correcto.

---

Registro canónico acumulativo de decisiones importantes, estados cerrados, hallazgos técnicos y pendientes.
**No reemplazar entradas anteriores. Agregar nuevas al final.**

---

## Resumen de continuidad — Últimas OEs del archivo anterior

### Sesión 2026-07-09 — Runtime Grounding Layer with Web Search persistence

**Fecha:** 2026-07-09
**Estado:** Closed

**Cambio implementado:**
Runtime Grounding Layer siempre presente en chat API (Anthropic/OpenAI/Google). Incluye: `current_datetime_utc` (timestamp UTC real), `web_search_available_right_now: YES/NO` (refleja toggle actual). 7 reglas enforced: (1) Runtime state prevails, (2) Anti-fabrication sources, (3) Claim-by-claim verification, (4) Prefer "I don't know" over guessing, (5) Explicit user instruction when OFF, (6) **Source-fidelity:** Retrieved results exclusive authority for current/verifiable claims — no blending with training memory, (7) **Source-inference separation:** Label own reasoning separately from source facts.

Web Search toggle persiste por agente en `agent_sessions.web_search_enabled` (default: true). Migration 048 aplicada. tool_choice remains auto. Evidence Mode y question classification not implemented.

**Observación:** Issue de mixing real search results con training memory detectado específicamente con Anthropic (2026-07-09), no observado en OpenAI/Google mismo periodo — documentado como observación, no conclusión provider-wide. Behavior under observation.

**Archivos:** migrations/048, chat/route.ts, AgentPanel.tsx. Commit c32e9c1.

---

### Sesión 2026-07-10 — Groq provider cleanup

**Fecha:** 2026-07-10
**Estado:** Partial (Mini-OE A Core removal Closed, Mini-OE B Cosmetic cleanup Pending)

**Mini-OE A — Core functional support removed:**
- `src/lib/providers/groq.ts` deleted
- GroqProvider removed from factory registry
- 'Groq' removed from KNOWN_PROVIDERS
- groqProvider removed from chat API (tool loop + direct stream)
- Rama Groq removed from onboarding default model selection
- Groq removed from ApiKeyRequiredModal

**Active functional providers:** Anthropic, OpenAI, Google, IA Local.

**Validations:** lint ✅, build ✅, grep GroqProvider/groqProvider: 0 results ✅.

**Pending Mini-OE B:** Cosmetic cleanup in TeamsClient, AgentCard, TeamNode, AgentPanel, TokenUsageBadge, SMPanel; decision on RESERVED set in settings/providers/route.ts.

**Archivos:** groq.ts (deleted), index.ts, resolveApiKey.ts, chat/route.ts, onboarding/start/route.ts, ApiKeyRequiredModal.tsx. Commit 73d94f7.

---

### Sesión 2026-07-11 — Markdown rendering in chat messages

**Fecha:** 2026-07-11
**Estado:** Closed

**Cambio implementado:**
AgentPanel y HumanChatPanel ahora renderizan Markdown. Installed react-markdown@^10.1.0 + remark-gfp@^4.0.1. AgentPanel (line 676) y HumanChatPanel (line 495) usan ReactMarkdown con componentes Tailwind explícitos para: p, strong, em, ul, ol, li, table, thead, th, td, code (inline/block), blockquote.

**Security:** NO rehype-raw, NO dangerouslySetInnerHTML — safe para Connected Teams content desde otras cuentas.

**Copy preserved:** copyMessage copia original msg.content, no HTML renderizado.

**Bundle impact:** /workspace/[id] First Load JS: 20.1 kB → 63.8 kB (+43.7 kB).

**Validations:** lint ✅, build ✅, grep rehype-raw/dangerouslySetInnerHTML: 0 results ✅. Validado visualmente en producción 2026-07-11: tabla comparativa, texto en negrita, lista renderizados correctamente en AgentPanel.

**Archivos:** AgentPanel.tsx, HumanChatPanel.tsx, package.json, package-lock.json. Commits de21877, 4820fbd (docs).

---

### Sesión 2026-07-12 — Teams Map rebuilt as project grid layout

**Fecha:** 2026-07-12
**Estado:** Partial (código completo, build exitoso, pendiente screenshot PO)

**Cambio implementado:**
Teams Map rebuilt desde cero como grilla CSS flexible (`grid-cols-1 xl:grid-cols-2 auto-rows-min`) organizada por proyecto. Arquitectura anterior eliminada: CanvasViewport, pan/zoom, posiciones absolutas, buildTreeLayout, SVG connectors.

**Componentes:**
- `src/lib/teams/deriveTeamColor.ts` (nuevo): Helper para derivar color más claro de subteams + fallback determinístico desde paleta 8 colores
- `src/components/teams/MapView.tsx` (reescrito completo): Grilla responsive, agrupación por project_id, subteams por parent_id, provider/model desde manager session
- `src/components/teams/TeamsClient.tsx` (modificado): Eliminados view state, zoom states, toggle Map/Tree, derivación externalConnections

**Arquitectura nueva:**
- Projects = contenedores visuales con métricas agregadas (totalTeams/totalSessions/totalWorkers)
- Teams = cards con borde izquierdo 4px color team (team.color o fallback)
- Subteams = cards anidados con borde 3px tono derivado más claro (deriveLighterColor 40%)
- SAT/MAT = badge textual (teal/purple), NO color estructural
- Isolated teams = badge negro "Shared"

**TreeView:** Deprecado pero preservado — import comentado en TeamsClient, archivo sin tocar.

**CanvasViewport:** Activo y huérfano NO tocados (candidatos a limpieza futura).

**Validations:** lint ✅, build ✅, TypeScript ✅. Pendiente screenshot PO mostrando grilla completa, proyectos múltiples teams, colores distintos, subteam tono derivado.

**Archivos:** deriveTeamColor.ts (nuevo), MapView.tsx (reescrito), TeamsClient.tsx, handoff-archive-2026-07-a.md, PRODUCT_STATUS.md, AISyncPlans.md. Commit db47127.

**Lección clave:** Reemplazo canvas→grilla requiere: eliminar deps zoom sin romper handlers, transformar lista plana parent_id→estructura agrupada, derivar datos tipos anidados correctamente (project_id desde workspace.teams.project_id), deprecar imports sin usarlos activamente, usar Array.from(map.entries()) para iterar Map, separar color estructural de badge semántico.

---
