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

---

## Sesión 2026-07-12 — Teams Map Draft 2 literal reconstruction v2

**Fecha:** 2026-07-12
**Estado:** Partial (código completo, build exitoso, pendiente screenshot PO)

**Diagnóstico:**
La implementación anterior (commit db47127) resolvió la grilla por proyecto, pero no respetó literalmente el diseño aprobado Draft 2. Errores identificados:
- PROJECT UNKNOWN aparecía por falta de `projectName` prop en MapView
- Layout usaba `grid-cols-1 xl:grid-cols-2` (grilla uniforme) en vez de `columns-1 xl:columns-2` (mosaico tipo bento)
- Team Card usaba borde lateral 4px de color en vez de franja superior de color
- Texto code/name NO era blanco sobre color
- Cuerpo de Team Card preservado correctamente en blanco
- Subteams correctamente bajo padre, pero sin conector visual horizontal explícito
- Legend ausente
- Map/Tree toggle correctamente eliminado, TreeView correctamente deprecado

**Cambio realizado:**

1. **src/lib/teams/assignTeamColor.ts (nuevo):**
   - `resolveTeamColor(team)`: Usa `team.color` si existe, sino fallback determinístico desde palette 11 colores por hash de `team.id`
   - Reemplaza `getFallbackTeamColor` inline en MapView anterior con helper dedicado

2. **src/components/teams/MapView.tsx (reescrito v2):**
   - **Layout principal:** `columns-1 xl:columns-2` con `columnGap: 16px` — NO grid uniforme
   - **ProjectContainer:** `break-inside-avoid` + fondo #FBFDFF + borde #BED7F7 + radio 16px
   - **Project header:** Nombre real en mayúsculas/bold + 4 contadores (Teams/Subteams/Sessions/Workers)
   - **Project teams:** `flex flex-wrap` horizontal
   - **Team Card:** Franja superior de color (backgroundColor) con code/name en blanco
   - **Team Card body:** Fondo blanco con provider/model (bold/normal), SAT/MAT text badge, métricas WS:N SES:N WRK:N, Open/Edit
   - **Subteams:** Bajo padre con `border-l-2 border-slate-300` vertical + conector horizontal `h-px w-3` por subteam
   - **Subteam Card:** Franja superior con `deriveLighterColor(parentColor, 0.25)` + code/name blanco, body blanco con métricas/Open/Edit, sin provider/model/SAT-MAT
   - **Legend:** 4 bloques exactos (Project=Container, Team=Color, Subteam=Lighter Shade, Workspace/Sessions=Compact Metadata) con texto literal aprobado

3. **src/components/teams/TeamsClient.tsx:**
   - Agregada prop `projectName={projectName}` al render de MapView línea ~412
   - Sin otros cambios — Map/Tree toggle ya estaba eliminado, TreeView ya estaba deprecado

**Decisiones técnicas:**

1. **Column-count vs grid:** CSS columns produce mosaico tipo bento real con altura variable por proyecto. Grid uniforme producía columnas percibidas de igual ancho/alto artificial.

2. **Franja superior vs borde lateral:** Draft 2 especifica literalmente franja superior de color con texto blanco. Borde lateral fue arquitectura anterior que no se alineaba con diseño aprobado.

3. **Conector horizontal explícito:** Agregado `div` con `h-px w-3 bg-slate-300` como línea horizontal desde vertical border hacia cada subteam card.

4. **Project name resolution:** `projectName` ya llegaba como prop opcional a TeamsClient desde page.tsx. Fix fue pasar prop a MapView. Fallback: `'Untitled Project'` si falta (nunca `PROJECT UNKNOWN`).

5. **Subteams tono claro:** `deriveLighterColor(parentColor, 0.25)` — 25% lighten (ajustado desde 40% anterior para balance visual mejor con franja superior).

6. **Legend texto literal:** Copiado exactamente del spec de OE. No traducido, no resumido, no parafraseado.

**Archivos modificados:**
- src/lib/teams/assignTeamColor.ts (creado)
- src/components/teams/MapView.tsx (reescrito v2)
- src/components/teams/TeamsClient.tsx (1 línea: prop projectName)

**Archivos NO tocados:**
- CanvasViewport activo/huérfano (preservados)
- TreeView.tsx (preservado/deprecado)
- deriveTeamColor.ts (sin cambios — deriveLighterColor ya existía)
- Modales, tipos, DB, RLS, migraciones (sin cambios)

**Validaciones técnicas:**
- npm run lint: ✅ OK (solo warnings preexistentes CanvasViewport)
- npm run build: ✅ Exitoso
- grep PROJECT UNKNOWN: ✅ 0 resultados
- grep CanvasViewport MapView: ✅ 0 resultados
- grep zoom: ✅ 0 resultados en MapView/TeamsClient
- grep TreeView TeamsClient: ✅ Solo comentario de deprecación

**Validación funcional:**
⏳ PENDIENTE — Requiere screenshot PO mostrando:
1. Project con nombre real (no PROJECT UNKNOWN ni Project [id])
2. Mosaico tipo bento con columnas de altura variable (no grilla uniforme)
3. Team Cards con franja superior de color (no borde lateral)
4. Code/name en blanco sobre franja de color
5. Subteams bajo su padre específico con conector horizontal visible
6. Subteam con tono claro derivado del padre
7. Legend con 4 bloques exactos visible al final
8. Open/Edit funcionando
9. Add Team/Connect/Requests sin regresión

**Restricciones respetadas:**
- ✅ NO posiciones absolutas x/y/w/h
- ✅ NO grid uniforme principal
- ✅ NO borde lateral color (franja superior implementada)
- ✅ NO subteams al final (bajo padre específico)
- ✅ NO Map/Tree toggle
- ✅ NO CanvasViewport activo modificado
- ✅ NO TreeView modificado
- ✅ NO modales/tipos/DB/RLS/migraciones

**Estado:**
Partial — código completo, build exitoso, lint OK, documentación actualizada pendiente — screenshot PO pendiente mostrando franja superior color, mosaico bento, conector horizontal subteams, project name correcto, legend visible.

**Lección clave:**
Cuando el ejecutor no puede ver imágenes, la especificación visual debe traducirse con precisión quirúrgica: "franja superior de color con texto blanco" ≠ "borde lateral de color", "mosaico tipo bento" ≠ "grilla uniforme", "4 bloques exactos de legend con texto literal" ≠ "explicación resumida". La implementación debe respetar literalmente cada elemento visual especificado, no interpretaciones aproximadas.
