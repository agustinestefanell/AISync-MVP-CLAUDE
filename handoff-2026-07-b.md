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

---

## Sesión 2026-07-15 — Archived Teams Fase 1A + Mini-OE bug fix

**Fecha:** 2026-07-15
**Estado:** Closed (validado funcionalmente por PO — team padre y subteam archivados correctamente)

**Contexto:**
Primera OE de Archived Teams feature + diagnóstico y fix de bug crítico detectado durante validación funcional. Esta fase implementa solo estado estructural base — status manda, tags son secundarios. Archive no borra datos relacionados. Restore/Unarchive no se expone. Teams Map archived UX pendiente para Fase 1B. Audit log events pendiente para Fase 1C.

**Inspección previa confirmada:**
- teams.status: ❌ NO existía → Creado en migración 049
- archived_at/by/reason: ❌ NO existían → Creados en migración 049
- tags: ✅ SÍ existía (migración 015 aplicada previamente)
- RLS UPDATE policy: ✅ **CONFIRMADA EN SUPABASE REAL** por Product Owner (query ejecutada directamente en producción 2026-07-15)
- audit_log.metadata: ✅ JSONB existente, ya se usa, **NO requiere migración para Fase 1C**

**Cambios implementados (Fase 1A):**

1. **Migración 049_add_team_archive_state.sql:**
   - `teams.status TEXT NOT NULL DEFAULT 'active'`
   - Constraint: `CHECK (status IN ('active', 'archived'))`
   - `teams.archived_at TIMESTAMPTZ`
   - `teams.archived_by UUID REFERENCES accounts(id) ON DELETE SET NULL` (FK con SET NULL, no CASCADE)
   - `teams.archive_reason TEXT`
   - Comments SQL documentando cada campo

2. **src/lib/db/types.ts:**
   - Agregado tipo `TeamStatus = 'active' | 'archived'`
   - Extendida interface `Team` con: status, archived_at, archived_by, archive_reason

3. **src/app/api/teams/[id]/route.ts:**
   - Archive implementado dentro del PATCH existente (no endpoint separado)
   - Payload diferenciado: `{ action: 'archive', archive_reason?: string }`
   - **FIX CRÍTICO:** Agregado `.select()` al UPDATE + verificación de filas afectadas (ver Mini-OE bug fix abajo)
   - Handler archive ejecuta:
     - `status = 'archived'`
     - `archived_at = new Date().toISOString()`
     - `archived_by = user.id`
     - `archive_reason = trim(reason) || null`
   - NO borra workspaces/agent_sessions/messages/checkpoints
   - NO emite audit_log events (diferido Fase 1C)
   - Ownership validado por RLS policy existente

4. **src/components/teams/EditTeamModal.tsx:**
   - Botón "Archive Team" en footer izquierdo (entre "Add Sub Team" y "Erase Team")
   - Confirmación double-click (patrón de Erase Team)
   - Estado `confirmingArchive` + `archiveReason` local
   - Sección de confirmación amber expandible en body del modal:
     - Warning "Archive this team?"
     - Mensaje preservación de datos
     - Textarea opcional `archive_reason` (2 rows, placeholder)
   - Handler `handleArchive()` envía PATCH con action='archive'
   - Modal cierra automáticamente post-success
   - `onUpdated()` callback refresca UI parent

**Mini-OE Bug Fix — Archive no persistía en DB (2026-07-15):**

**Bug reportado:**
Archivado de teams no persistía en DB. Team padre "Prueba 25" (8e2c556b-...) y subteam "Prueba archive subteam" (1572061d-...) mostraban status='active', archived_at=null en queries SQL directas a pesar de que flujo UI funcionaba aparentemente (modal cerraba, team desaparecía visualmente en primera carga, reaparecía tras hard refresh).

**Diagnóstico ejecutado:**
1. ✅ Código creación de teams verificado — `project_id` heredado correctamente en subteams
2. ✅ Queries SQL PO confirmaron datos perfectos: `t.project_id` poblado, `p.id` existe, `p.account_id` coincide con usuario autenticado (6a4ef0f9-...), `p.status='active'`
3. ✅ RLS policy confirmada aplicada y correcta
4. ✅ Cliente Supabase instanciado idénticamente en POST (funciona) y PATCH (fallaba)

**Hipótesis descartadas con evidencia:**
- Hipótesis A (project_id NULL): ❌ Descartada — project_id poblado correctamente
- Hipótesis B (usuario sin permiso): ❌ Descartada — p.account_id coincide con auth.uid()
- Hipótesis C (project archivado): ❌ Descartada — p.status='active'
- Hipótesis D (bug RLS con subqueries): ❌ Descartada — validación funcional confirmó que RLS NO bloqueaba

**Causa raíz confirmada:**
El UPDATE original (líneas 22-30 previas) ejecutaba sin `.select()` y sin verificar filas afectadas:
```typescript
const { error: archiveErr } = await supabase
  .from('teams')
  .update({ status: 'archived', ... })
  .eq('id', params.id)
```

Supabase devuelve `error: null` y `data` no poblado cuando el UPDATE no devuelve filas. Sin `.select()`, no hay forma de saber cuántas filas se afectaron. El endpoint devolvía 200 OK incluso cuando el UPDATE no modificaba ninguna fila (ej. por team no encontrado, o cualquier fallo silencioso). El frontend cerraba el modal asumiendo éxito, pero DB quedaba intacta.

**Fix aplicado:**
```typescript
const { data: updatedData, error: archiveErr } = await supabase
  .from('teams')
  .update({ status: 'archived', ... })
  .eq('id', params.id)
  .select()  // ← Agregado

if (archiveErr) { /* manejo error */ }

if (!updatedData || updatedData.length === 0) {  // ← Verificación agregada
  console.error('[PATCH /api/teams/[id]] Archive blocked - no rows affected', {...})
  return NextResponse.json({
    error: 'Failed to archive team. You may not have permission...'
  }, { status: 403 })
}
```

**Validación funcional (2026-07-15):**
✅ Team padre "Prueba 25" (8e2c556b-...): archivado correctamente — status='archived', archived_at poblado, archived_by='6a4ef0f9-...', rowsAffected=1 en logs
✅ Subteam "Prueba archive subteam" (1572061d-...): archivado correctamente — status='archived', archived_at poblado, archived_by='6a4ef0f9-...', rowsAffected=1 en logs
✅ Query SQL post-archive confirmó persistencia real en DB
✅ Crear team nuevo: sin regresión
✅ Editar team activo: sin regresión
✅ Abrir team activo: sin regresión

**Archivos modificados:**
- supabase/migrations/049_add_team_archive_state.sql (nuevo)
- src/lib/db/types.ts (+5 líneas: TeamStatus type + 4 campos Team)
- src/app/api/teams/[id]/route.ts (+21 líneas netas: archive action handler + .select() + verificación filas)
- src/components/teams/EditTeamModal.tsx (+65 líneas: Archive button + confirmation + handler)
- handoff-2026-07-b.md (esta entrada)
- PRODUCT_STATUS.md (entrada Teams module + fecha actualizada)
- AISyncPlans.md (contrato Archived Teams al inicio)

**Archivos NO tocados:**
- MapView.tsx, TeamsClient.tsx, CanvasViewport (todas variantes), TreeView.tsx
- Documentation Mode, Audit Log UI
- Modales: AddTeamModal, ConnectTeamModal, IncomingRequestsPanel
- API routes: connections, context, messages, otros

**Validaciones técnicas:**
- npm run lint: ✅ OK (solo warnings pre-existentes CanvasViewport)
- npm run build: ✅ Exitoso sin errores TypeScript
- grep Restore/Unarchive: ✅ 0 resultados
- grep audit_log events: ✅ 0 resultados en archivos modificados
- git diff --check: ✅ OK

**RLS gap cerrado oficialmente:**
Policy `teams_update` confirmada aplicada en Supabase real por Product Owner (query ejecutada directamente en producción 2026-07-15). Definición exacta aplicada: `FOR UPDATE USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = teams.project_id AND p.account_id = auth.uid()))`. Este hallazgo cierra el RLS gap documentado previamente. Actualizado en handoff/PRODUCT_STATUS/AISyncPlans para evitar re-marcado como pendiente.

**Lección clave — Verificación de filas afectadas obligatoria:**
Supabase (y PostgreSQL en general) NO reporta error cuando un UPDATE no afecta ninguna fila. `error: null` solo significa que la query SQL era sintácticamente correcta, NO que haya modificado datos. **SIEMPRE agregar `.select()` a UPDATE/DELETE y verificar `data.length > 0`** antes de asumir éxito. Sin esta verificación, RLS blocks, teams no encontrados, o cualquier fallo silencioso pueden pasar desapercibidos y el frontend asume éxito erróneamente. Este patrón debe aplicarse consistentemente en todos los endpoints de mutación del proyecto.

---

## Sesión 2026-07-12 — Teams Map v2 emergency correction after PO screenshot

**Fecha:** 2026-07-12
**Estado:** Partial (código corregido, build exitoso, pendiente screenshot PO validation)

**Diagnóstico:**
La OE v2 commit 8786866 fue reportada con regresiones visuales por el Product Owner. Análisis del diff y código actual reveló:
- **Colores:** El código SÍ aplicaba `backgroundColor: color` correctamente (líneas 311, 418), pero sin fallback defensive
- **Workers:** Cambiaron de `Workers: {workers}` (legible) a `WRK:{workers}` (compacto menos legible). NO había evidencia de workers individuales como cards en versión anterior — siempre fueron contador
- **Connected Teams:** Código actual ya los renderiza como cards normales dentro del mosaico (líneas 206-224), NO como panel gigante
- **Overflow:** Ya tenía `overflow-auto` en línea 194

**Correcciones aplicadas:**

1. **Workers legibilidad restaurada:**
   - Main Team Card: `WRK:{workers}` → `Workspaces: {workspaces}`, `Sessions: {sessions}`, `Workers: {workers}` (formato completo)
   - Agregada sección "Team Members" mostrando agent_sessions individuales como badges compactos (GM, W1, W2, etc.) + contador "+N" si hay más de 4
   - Subteam Card: `WS:{workspaces}` → `W: {workspaces}`, `WRK:{workers}` → `Workers: {workers}` (más legible)

2. **Color defensive fallback:**
   - Team header: `backgroundColor: color` → `backgroundColor: color || '#8E4CC6'` (fallback hardcoded si falla resolveTeamColor)
   - Subteam header: `backgroundColor: color` → `backgroundColor: color || '#C8A8E1'` (fallback hardcoded)

3. **Connected Teams:** SIN CAMBIOS — código actual ya correcto (box normal dentro del mosaico)

4. **Overflow:** SIN CAMBIOS — ya tenía scroll vertical normal

**Decisión técnica clave:**
Workers individuales como agent_sessions no aparecían como cards separadas en NINGUNA de las dos versiones (before/after 8786866). La "pérdida de visibilidad" era el cambio de formato `Workers: N` a `WRK:N`. Implementada mejora mostrando mini-badges de agent_sessions individuales (GM, W1-W4, +N) para cumplir expectativa de "workers visibles individualmente" sin crear cards gigantes por cada worker.

**Archivos modificados:**
- src/components/teams/MapView.tsx (+29 líneas netas)

**Archivos NO tocados:**
- TeamsClient.tsx (sin cambios necesarios)
- assignTeamColor.ts (sin cambios necesarios — lógica correcta)
- deriveTeamColor.ts (sin cambios necesarios)
- CanvasViewport, TreeView, modales, tipos, DB, RLS, migraciones (preservados)

**Validaciones técnicas:**
- npm run lint: ✅ OK
- npm run build: ✅ Exitoso
- grep PROJECT UNKNOWN: ✅ 0 resultados
- grep CanvasViewport MapView: ✅ 0 resultados
- grep resolveTeamColor/backgroundColor: ✅ Aplicado con fallback defensive

**Validación funcional:**
⏳ PENDIENTE — Requiere nuevo screenshot PO confirmando:
1. Colores visibles en Team Cards (con fallback defensive agregado)
2. Workers visibles como badges individuales + label legible "Workers: N"
3. Connected Teams compactos dentro del mosaico
4. Overflow sin problemas visuales

**Restricciones respetadas:**
- ✅ NO TreeView reintroducido
- ✅ NO CanvasViewport reintroducido
- ✅ NO Map/Tree toggle reintroducido
- ✅ NO modales/tipos/DB/RLS/migraciones tocados

**Estado:**
Partial — correcciones aplicadas basándose en análisis de diff before/after 8786866 y feedback del Manager. Pendiente screenshot PO validando colores visibles, workers individuales como badges, layout compacto sin overflow. La OE v2 anterior (8786866) NO debe marcarse Closed hasta validar esta corrección.

**Lección clave:**
Cuando no hay acceso directo al screenshot del PO, el diagnóstico debe basarse en análisis riguroso del diff before/after + evidencia del código + feedback textual del Manager. Workers "visibles individualmente" podía significar (a) cards separadas por worker (no había evidencia en versiones anteriores) o (b) mejora de formato legible + badges individuales (implementado). Defensive fallbacks en color críticos para prevenir cards grises por fallas de runtime en resolveTeamColor.

---

## Sesión 2026-07-12 — Add Team project selector

**Fecha:** 2026-07-12
**Estado:** Closed (code complete, build successful, pending PO validation)

**Diagnóstico:**
El flujo de creación de teams asumía un Project default/original. En cuentas con múltiples Projects, el usuario no podía elegir a qué Project pertenecería el nuevo team. El problema afectaba:
- **Teams Map:** AddTeamModal invocado desde TeamsClient (+ Add Team button)
- **Dashboard:** NO — Dashboard solo muestra/edita teams existentes vía EditTeamModal, no crea teams raíz
- **EditTeamModal:** Crear subteams desde "Edit Team" modal

**Causa raíz:**
AddTeamModal recibía `projectId` fijo como prop y lo enviaba en el payload sin permitir selección. TeamsClient tenía acceso a `projectOptions` (obtenidos de `/api/projects/active`) pero NO los pasaba a AddTeamModal.

**Archivos modificados:**

1. **src/components/teams/AddTeamModal.tsx:**
   - Props: agregado `projects: Array<{ id: string; name: string }>`
   - State: agregado `selectedProjectId` inicializado con `projectId` default
   - UI: selector Project visible solo cuando `projects.length > 1`
   - Payload: envía `selectedProjectId` en lugar de `projectId` fijo
   - Selector con label "Project *" + copy "Choose where this team will belong."
   - Si hay 1 solo Project: NO muestra selector, usa automáticamente ese project_id

2. **src/components/teams/TeamsClient.tsx:**
   - Paso `projectOptions` a AddTeamModal
   - Paso `projectOptions` a EditTeamModal
   - TeamsClient ya tenía `projectOptions` state poblado desde `/api/projects/active`

3. **src/components/teams/EditTeamModal.tsx:**
   - Props: agregado `projects?: Array<{ id: string; name: string }>` (opcional)
   - Paso `projects` a AddTeamModal cuando se crea subteam
   - Fallback: si `projects` no llega, genera `[{ id: team.project_id, name: 'Current Project' }]`

4. **src/components/ProjectList.tsx:**
   - Paso `projects` a EditTeamModal (Dashboard scenario)
   - Map de `projects` a formato simplificado `{ id, name }`

**Decisiones técnicas clave:**

- **Selector condicional:** Solo visible cuando `projects.length > 1` — evita UI innecesaria en cuentas con 1 solo Project
- **Default automático:** Si hay 1 Project, `selectedProjectId` se inicializa con ese único Project — no requiere interacción del usuario
- **Fallback defensive:** EditTeamModal genera proyecto default si `projects` prop no llega — previene crashes en flujos edge
- **Payload explícito:** AddTeamModal siempre envía `projectId` explícito — el endpoint ya valida y persiste correctamente
- **NO tocar endpoint:** `/api/teams/route.ts` POST ya acepta `projectId` y lo persiste como `project_id` — NO requiere cambios
- **NO tocar schema/RLS/migraciones:** `teams.project_id` ya existe — solo faltaba UI de selección

**Restricciones respetadas:**
- ✅ NO MapView layout
- ✅ NO TreeView
- ✅ NO CanvasViewport
- ✅ NO modales no relacionados (ConnectTeamModal, HowConnectedTeamsModal, IncomingRequestsPanel intocados)
- ✅ NO schema
- ✅ NO RLS
- ✅ NO migraciones
- ✅ Provider/model defaults sin cambios

**Validaciones técnicas:**
- npm run lint: ✅ OK (warnings pre-existentes en CanvasViewport)
- npm run build: ✅ Exitoso
- grep selectedProjectId: ✅ Usado correctamente en state, selector value, payload
- git diff --check: ✅ OK

**Validación funcional:**
⏳ PENDIENTE — Requiere screenshot PO confirmando:
1. Account con 1 solo Project: selector NO visible, team creado automáticamente en ese Project
2. Account con múltiples Projects: selector visible con todos los Projects disponibles
3. Crear team eligiendo Project A: team persiste con `project_id` de Project A
4. Crear team eligiendo Project B: team persiste con `project_id` de Project B
5. Teams Map muestra team en contenedor correcto según Project elegido
6. Crear subteam desde Edit Team: selector funciona igual
7. Provider/model defaults: sin regresión
8. SAT/MAT: sin regresión

**Superficies afectadas:**
- ✅ Teams Map — + Add Team button invoca AddTeamModal con selector
- ✅ Edit Team — + Add Sub-Team invoca AddTeamModal con selector
- ❌ Dashboard — NO crea teams raíz (solo muestra/edita existentes)

**Lección técnica:**
TeamsClient ya tenía `projectOptions` disponibles via `/api/projects/active` (línea 192-196) pero NO los pasaba a AddTeamModal. El fix fue threading: pasar la lista existente desde TeamsClient → AddTeamModal/EditTeamModal → AddTeamModal (subteams). NO fue necesario agregar nuevos fetches ni modificar lógica de persistencia — solo UI de selección faltante.

**Riesgo mitigado:**
Si `projects` prop llega vacía a AddTeamModal, el selector NO se muestra (condición `projects.length > 1`) y `selectedProjectId` usa el `projectId` default pasado como prop. Esto previene crear team sin `project_id` o mostrar selector vacío.

---

## Sesión 2026-07-14 — Teams Map v3: Hierarchical org chart replacing bento mosaic

**Fecha:** 2026-07-14
**Estado:** Closed (validated visually in production localhost:3000/teams with real data)

**Diagnóstico:**
Teams Map v2 (bento/masonry layout con CSS columns) no representaba correctamente la jerarquía organizacional del producto. El Product Owner confirmó que el diseño aprobado era un organigrama jerárquico tipo árbol con Executive Team sintético, no un mosaico de proyectos. La confusión surgió porque los assets de referencia (Draft 2 de Teams Map) correspondían al Dashboard (Project cards en grilla), no a Teams Map.

**Decisión arquitectónica:**
Teams Map debe mostrar estructura de organigrama completo con jerarquía visual de teams/subteams/workers, acordeón por Project, y nodos posicionados algorítmicamente. El layout correcto es árbol vertical con Executive Team sintético como raíz cuando hay múltiples Projects.

**Implementación v3:**

1. **Arquitectura de layout:**
   - Acordeón por Project (collapsible containers con header + chevron animado)
   - Árbol jerárquico vertical por cada Project
   - Executive Team sintético cuando `projects.length > 1` (raíz visual unificadora)
   - Algoritmo recursivo `buildTreeLayout()` calcula posiciones x/y de todos los nodos
   - Canvas con pan (click izquierdo + drag) y zoom (wheel)
   - Máximo 2 Workers por Manager/Submanager (regla de dominio estricta)

2. **Componentes nuevos:**
   - `src/lib/teams/buildTreeLayout.ts`: Algoritmo recursivo de posicionamiento jerárquico
   - `src/lib/teams/teamsMapLayoutTypes.ts`: Tipos `LayoutNode`, `LayoutTree`, `ProjectTree`
   - `src/lib/teams/teamsMapLayoutHelpers.ts`: Helpers `createLayoutNode`, `positionChildren`, `calculateTreeBounds`
   - `src/components/teams/v3/`: Carpeta con componentes de rendering (TeamCard, WorkerBox, ConnectorLines, LegendBlock)

3. **MapView.tsx (reescrito completo v3):**
   - Pan/zoom state con `useRef` para `isPanning`, `panStart`, `panOffset`, `zoomLevel`
   - Event handlers: `onWheel` (zoom con clamp 0.25-2.0), `onMouseDown/Move/Up` (pan), `onMouseLeave` (cleanup)
   - Acordeón Projects con estado `expandedProjects` (Set de project IDs)
   - Render de nodos desde `LayoutNode[]` devuelto por `buildTreeLayout()`
   - TeamCard con franja superior de color + código jerárquico + nombre
   - WorkerBox (máximo 2) con etiquetas W1/W2 + provider badge
   - Shared Team con banner negro "Shared with [email]"
   - Conectores SVG padre→hijos (líneas verticales + horizontales)
   - Legend con 4 bloques explicativos

4. **TeamsClient.tsx:**
   - Eliminado view toggle Map/Tree (solo Map view)
   - Agregado Project selector en ribbon (proyecto activo destacado)
   - Ribbon buttons: Add Team / Connect / Requests sin cambios
   - SAT/MAT badge preservado
   - Props `projectName` pasada a MapView

5. **Colores y estilos:**
   - Team colors desde `team.color` con fallback determinístico hash-based
   - Subteams con tono derivado 25% más claro (`deriveLighterColor`)
   - Executive Team sintético con color #6B46C1 (púrpura institucional)
   - Acordeón headers con fondo #F8FAFC + borde #E2E8F0
   - Canvas fondo #FEFEFE
   - Conectores SVG #D1D5DB (stroke-width 2px)

6. **Datos y lógica:**
   - `buildTreeLayout()` recibe `projects[]`, `teams[]`, `workspaces[]`, `agent_sessions[]`
   - Construye `ProjectTree[]` con Executive Team sintético cuando `projects.length > 1`
   - Detecta manager session de cada team para determinar provider/model
   - Calcula workers reales (agent_sessions con role worker1/worker2)
   - Respeta constraint de dominio: máximo 2 workers por team
   - Connected Teams integrados con `scope_connections` y `partner_email` desde context

7. **Validaciones técnicas:**
   - npm run lint: ✅ OK
   - npm run build: ✅ Exitoso
   - TypeScript: ✅ Sin errores de tipos
   - grep CanvasViewport: ✅ Componente legacy preservado sin tocar
   - grep TreeView: ✅ Componente deprecado preservado sin tocar

**Validación funcional (2026-07-14, localhost:3000/teams con datos reales):**
✅ 1. Organigrama jerárquico (no bento/mosaico)
✅ 2. Acordeón por Project funcional (expand/collapse con chevron animado)
✅ 3. Executive Team sintético visible cuando hay múltiples Projects
✅ 4. Teams/Subteams/Workers en árbol correcto con posiciones calculadas
✅ 5. Colores distintos por team desde `team.color`
✅ 6. Máximo 2 Workers por team respetado (constraint de dominio)
✅ 7. Códigos jerárquicos correctos (A-00, A-01, A-01-01)
✅ 8. Shared Team integrado al árbol con banner "Shared with agustinestefanell@gmail.com"
✅ 9. Header ribbon con Project selector real funcionando
✅ 10. Wheel zoom sin conflicto (rango 0.25-2.0)
✅ 11. Pan con click izquierdo funcionando
✅ 12. Open/Edit probados y funcionando (abren workspace/modal real)
✅ 13. Add Team/Connect/Requests sin regresión
✅ 14. SAT/MAT badge preservado

**Archivos modificados:**
- src/components/teams/MapView.tsx (reescrito completo v3 +640 líneas netas)
- src/components/teams/TeamsClient.tsx (eliminado Map/Tree toggle, agregado Project selector)
- src/lib/teams/buildTreeLayout.ts (nuevo +320 líneas)
- src/lib/teams/teamsMapLayoutTypes.ts (nuevo +45 líneas)
- src/lib/teams/teamsMapLayoutHelpers.ts (nuevo +85 líneas)
- src/components/teams/v3/ (carpeta nueva con componentes de rendering)

**Archivos NO tocados:**
- CanvasViewport activo/legacy (preservado)
- TreeView.tsx (deprecado pero preservado)
- Modales (AddTeamModal, EditTeamModal, ConnectTeamModal, IncomingRequestsPanel)
- API routes, migrations, RLS, schema

**Restricciones respetadas:**
- ✅ NO bento/mosaico (implementado organigrama jerárquico)
- ✅ NO Map/Tree toggle (solo Map view)
- ✅ Máximo 2 Workers por Manager (constraint de dominio estricto)
- ✅ Executive Team sintético solo cuando projects.length > 1
- ✅ Pan/zoom sin conflicto con scroll de página
- ✅ Conectores visuales padre→hijos
- ✅ Legend con 4 bloques explicativos
- ✅ Shared Teams integrados al árbol (no aislados)
- ✅ Códigos jerárquicos A-00/A-01/A-01-01 correctos
- ✅ Provider/model desde manager session
- ✅ Open/Edit funcionando
- ✅ Add Team/Connect/Requests sin regresión

**Lección clave:**
Los assets de referencia (Draft 2, dashboard-2.svg, teams-map.json) correspondían al Dashboard, no a Teams Map. El diseño correcto de Teams Map es organigrama jerárquico tipo árbol con Executive Team sintético, acordeón por Project, y posicionamiento algorítmico. Cuando hay confusión entre specs visuales de módulos distintos (Dashboard vs Teams Map), validar con el Product Owner antes de implementar. La validación visual en producción local (localhost:3000 con datos reales) es el gate definitivo de aprobación, no los assets estáticos.

---

## Mini-OE 2026-07-14 — Teams Map v3 accordion project grouping fix

**Fecha:** 2026-07-14
**Estado:** Closed (validated visually in localhost:3000/teams by Product Owner)

**Bug reportado:**
Teams Map v3 acordeón solo mostraba 1 Project ("Mi Primer Proyecto") en vez de los 4 Projects reales de la cuenta (Mi Primer Proyecto, Proyecto 2, agustinestefanell+arenaglirsas, Proyecto Europa), confirmados existentes y con 1 team cada uno en Dashboard.

**Causa raíz identificada:**
MapView.tsx línea 395 usaba navegación incorrecta `team.workspaces?.[0]?.teams?.project_id ?? projectId` para agrupar teams por Project. El campo `team.workspaces[0].teams` no existe en el tipo `TeamWithWorkspaces` (workspaces es `WorkspaceWithAgents[]`, sin campo `.teams`), por lo que siempre devolvía `undefined` y todos los teams caían bajo el `projectId` activo por el fallback `??`. Esto agrupaba todos los teams de los 4 Projects bajo un solo Project en el acordeón.

**Solución aplicada:**
Reemplazada navegación incorrecta por acceso directo a `team.project_id` (campo que existe en tipo `Team`, heredado por `TeamWithWorkspaces`). El `project_id` ya viene poblado del SELECT de `getProjectsWithHierarchy()` server-side. No requiere fallback porque es NOT NULL en schema.

**Cambios:**
- MapView.tsx línea 395: `const pid = team.workspaces?.[0]?.teams?.project_id ?? projectId` → `const pid = team.project_id`
- Removida dependencia `projectId` de `useMemo` dependencies (línea 410)
- Removida prop `projectId` de interfaz `MapViewProps` (quedó sin uso tras el fix)
- Removido paso de prop `projectId` en TeamsClient.tsx (línea 434)

**Código muerto detectado y removido:**
Función `buildNodesForProject` en MapView.tsx (líneas 50-70) no era llamada desde ningún lugar tras refactor v3 — contenía las únicas referencias a la prop `projectId` que impedían su eliminación.

**Validaciones:**
- npm run lint: ✅ OK
- npm run build: ✅ Exitoso
- Validación visual PO (localhost:3000/teams): ✅ Los 4 Projects aparecen correctamente en acordeón

**Archivos modificados:**
- src/components/teams/MapView.tsx
- src/components/teams/TeamsClient.tsx

**Sin cambios:** Schema, RLS, migraciones, API routes, tipos, modales.

**Lección técnica:**
Navegación de tipos debe validarse contra la estructura real del tipo, no asumir por convención de nombres. `team.workspaces[0].teams.project_id` sugiere una relación que no existe — `workspaces` es array de `WorkspaceWithAgents`, no de objetos con campo `.teams`. TypeScript no detectó el error en tiempo de compilación porque el optional chaining `?.` silencia el tipo `undefined`. El Dashboard mostraba los 4 Projects correctamente porque usa `getProjectsWithHierarchy()` que trae TODOS los Projects activos de la cuenta — el problema estaba exclusivamente en la agrupación client-side del acordeón, no en el fetch server-side.

---

## Sesión 2026-07-15 — Archived Teams Fase 1A: Estado estructural y contrato base

**Fecha:** 2026-07-15
**Estado:** Partial (código completo, build exitoso, pendiente validación PO)

**Contexto:**
Primera OE de Archived Teams feature. Esta fase implementa solo estado estructural base — status manda, tags son secundarios. Archive no borra datos relacionados. Restore/Unarchive no se expone. Teams Map archived UX pendiente para Fase 1B. Audit log events pendiente para Fase 1C.

**Inspección previa confirmada:**

1. **Schema teams actual:**
   - status: ❌ NO existía
   - archived_at: ❌ NO existía
   - archived_by: ❌ NO existía
   - archive_reason: ❌ NO existía
   - tags: ✅ SÍ (migración 015 aplicada previamente)

2. **RLS UPDATE policy:**
   - Migración 005_teams_rls_update.sql: ✅ Existe en repo
   - Policy `teams_update`: ✅ **CONFIRMADA EN SUPABASE REAL** por Product Owner (query ejecutada directamente en producción)
   - Definición exacta aplicada: `FOR UPDATE USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = teams.project_id AND p.account_id = auth.uid()))`
   - **RLS gap oficialmente cerrado** — NO se creó policy nueva en esta OE

3. **Auth pattern:**
   - Patrón real: `supabase.auth.getUser()` → `user.id`
   - Ownership: RLS automática via policy existente
   - archived_by poblado con: `user.id` (UUID del usuario autenticado)

4. **audit_log.metadata:**
   - Tipo confirmado: `Record<string, unknown> | null` (línea 67 de types.ts)
   - Ya existe como JSONB en DB
   - Ya se usa activamente en eventos de conexión
   - **NO requiere migración para Fase 1C** (snapshot liviano futuro)

**Cambios implementados:**

1. **Migración 049_add_team_archive_state.sql:**
   - `teams.status TEXT NOT NULL DEFAULT 'active'`
   - Constraint: `CHECK (status IN ('active', 'archived'))`
   - `teams.archived_at TIMESTAMPTZ`
   - `teams.archived_by UUID` (sin FK formal a auth.users — patrón del proyecto)
   - `teams.archive_reason TEXT`
   - Comments SQL para documentación

2. **src/lib/db/types.ts:**
   - Agregado tipo `TeamStatus = 'active' | 'archived'`
   - Extendida interface `Team` con 4 campos: status, archived_at, archived_by, archive_reason

3. **src/app/api/teams/[id]/route.ts:**
   - Lógica archive agregada al PATCH existente (no endpoint separado)
   - Payload diferenciado: `{ action: 'archive', archive_reason?: string }`
   - Archive ejecuta:
     - `status = 'archived'`
     - `archived_at = now()`
     - `archived_by = user.id`
     - `archive_reason = trim(reason) || null`
   - NO borra workspaces, agent_sessions, chats, checkpoints
   - NO emite audit_log events (diferido a Fase 1C)
   - Ownership validado por RLS policy existente

4. **src/components/teams/EditTeamModal.tsx:**
   - Botón "Archive Team" agregado en footer izquierdo (entre "Add Sub Team" y "Erase Team")
   - Confirmación doble-click (patrón existente de Erase Team)
   - Estado `confirmingArchive` local
   - Sección de confirmación muestra:
     - Warning "Archive this team?"
     - Mensaje preservación de datos
     - Campo opcional `archive_reason` (textarea 2 rows)
   - Handler `handleArchive()` envía PATCH con `action: 'archive'`
   - Modal cierra automáticamente post-archive exitoso
   - `onUpdated()` callback refresca UI parent

**Decisiones técnicas:**

1. **Archive como PATCH action vs endpoint separado:**
   - Elegido: PATCH con `action: 'archive'`
   - Razón: Patrón consistente del proyecto (todas las mutaciones de teams usan PATCH/DELETE existentes)
   - Archive es update de estado, no acción destructiva separada

2. **archived_by sin FK formal:**
   - UUID almacenado sin constraint FK a auth.users
   - Razón: Patrón del proyecto (no usa FKs formales a auth.users en otras tablas)
   - Documentado en comments SQL y handoff

3. **Confirmation pattern:**
   - Reutilizado patrón de Erase Team (double-click + visual state change)
   - Amber color scheme para diferenciar de Delete (red)
   - Sección expandible en body del modal (no modal aparte)

4. **Idempotencia:**
   - Si team ya está archived: PATCH sobrescribe archived_at/by/reason
   - No rompe, no devuelve error
   - Permite re-archivar con nuevo motivo si necesario

**Restricciones respetadas:**

- ✅ NO Restore/Unarchive visible
- ✅ NO Teams Map UX modificado
- ✅ NO MapView.tsx tocado
- ✅ NO TeamsClient.tsx tocado
- ✅ NO CanvasViewport tocado
- ✅ NO TreeView tocado
- ✅ NO Documentation Mode tocado
- ✅ NO Audit Log UI tocado
- ✅ NO audit_log events emitidos (diferido Fase 1C)
- ✅ NO snapshots creados (diferido Fase 2)
- ✅ NO datos relacionados borrados (workspaces/sessions/chats/checkpoints preservados)

**Validaciones técnicas:**

- npm run lint: ✅ OK (solo warnings pre-existentes en CanvasViewport)
- npm run build: ✅ Exitoso sin errores TypeScript
- grep Restore/Unarchive: ✅ 0 resultados
- grep audit_log events: ✅ 0 resultados en archivos modificados
- grep MapView/TeamsClient: ✅ 0 resultados en archivos modificados
- git diff --check: ✅ OK (solo warnings CRLF normales Windows)

**Archivos modificados:**
- supabase/migrations/049_add_team_archive_state.sql (nuevo)
- src/lib/db/types.ts (+5 líneas: TeamStatus type + 4 campos Team)
- src/app/api/teams/[id]/route.ts (+34 líneas: archive action handler)
- src/components/teams/EditTeamModal.tsx (+65 líneas: Archive button + confirmation + handler)

**Archivos NO tocados:**
- MapView.tsx, TeamsClient.tsx, CanvasViewport (todas variantes), TreeView.tsx
- Documentation Mode, Audit Log UI
- Modales: AddTeamModal, ConnectTeamModal, IncomingRequestsPanel
- API routes: connections, context, messages, otros

**Validación funcional:**
⏳ PENDIENTE — Requiere confirmación Product Owner con validación funcional/DB:

1. Migración 049 aplicada manualmente en Supabase real
2. Team puede archivarse desde EditTeamModal
3. Confirmación doble-click funciona (no archive accidental)
4. archive_reason opcional persiste correctamente
5. DB status = 'archived' post-archive
6. DB archived_at poblado con timestamp correcto
7. DB archived_by poblado con user.id correcto
8. DB archive_reason poblado o NULL según input
9. Workspaces/agent_sessions/chats/checkpoints intactos post-archive
10. No existe UI de Restore/Unarchive
11. Crear team nuevo: sin regresión
12. Editar team activo: sin regresión
13. Abrir team activo: sin regresión

**Observaciones importantes:**

1. **RLS gap cerrado:**
   - Policy `teams_update` confirmada aplicada en Supabase real por PO
   - Query ejecutada directamente en producción (no solo archivo repo)
   - Este hallazgo cierra oficialmente el RLS gap pendiente documentado previamente
   - Actualizar memoria/tracking para que no se vuelva a marcar como pendiente

2. **audit_log.metadata confirmado:**
   - Existe como JSONB
   - Ya se usa activamente
   - NO requiere migración para Fase 1C snapshot liviano
   - Documentado explícitamente para evitar redescubrimiento en próxima OE

3. **Fase 1B pendiente:**
   - Teams Map archived visibility/UX
   - Ocultar archived por defecto
   - Toggle "Show archived teams"
   - Visual atenuado / badge / borde punteado
   - Deshabilitar CTAs operativos

4. **Fase 1C pendiente:**
   - audit_log events (team_archived)
   - Snapshot liviano en audit_log.metadata (no tabla nueva)

**Estado:**
Partial — Código completo, build exitoso, lint OK, documentación actualizada. Pendiente: aplicación migración 049 en Supabase + validación funcional PO con 13-point checklist.

**Lección clave:**
Confirmación explícita de RLS policy aplicada en producción (no solo archivo repo) previene duplicados y documenta state real del sistema. El patrón de archive como PATCH action (no endpoint separado) mantiene consistencia con arquitectura existente del proyecto. audit_log.metadata pre-existente elimina necesidad de migración futura para snapshots livianos (Fase 1C).

---

## Sesión 2026-07-16 — Archived Teams Fase 1B: Teams Map visibility

**Fecha:** 2026-07-16
**Estado:** Closed (validado visualmente por PO — opacity 0.45 en Managers/Workers archivados, badge legible, Open/Edit funcionales)

**Contexto:**
Fase 1A estructural ya en producción (commit fc9964b). Fase 1B implementa visibilidad en Teams Map. Status estructural (`teams.status`) sigue siendo fuente de verdad. Tags no determinan archive state. Restore/Unarchive no se expone. Audit Log events y snapshots pendientes para Fase 1C.

**Inspección previa:**

1. **MapView.tsx:**
   - rootTeams: línea 71 `teams.filter(t => !t.parent_id)` dentro de `buildGraphNodesForProject()`
   - subteams: línea 127 `subteams.forEach(subteam => {...})` dentro de `addSubteamsRecursive()`
   - projectGroups: línea 389-408 `useMemo(() => { teams.forEach(team => { const pid = team.project_id ...})})`
   - Mejor punto de filtrado: ANTES de `buildGraphNodesForProject()` en MapView principal
   - Riesgo de nodos huérfanos: Alto si solo filtramos archived directamente sin verificar cadena parent-child

2. **TeamsClient.tsx:**
   - Contador Teams/Workers: línea 370-376 badge con `Teams {teams.length} / Workers {workerCount}`
   - Selector Project: línea 311-329 con `projectId` value
   - All Projects: NO existe — scope es siempre el Project seleccionado
   - Ubicación Show archived: después del contador Teams/Workers, antes de zoom controls

3. **Conteo archived:**
   - `teams.filter(t => t.status === 'archived').length`
   - Los `teams` ya vienen filtrados por Project desde page server-side
   - N incluye root teams y subteams archived

4. **Team Card:**
   - Componente: `TreeWorkspaceCard` (src/components/teams/v3/TreeWorkspaceCard.tsx)
   - Llamado desde MapView línea 244-338
   - Badge Archived: patrón similar a SAT badge (línea 104-115), positioned absolute right-3
   - Color preservado: NO tocar `ribbonColor`, `softColor`, `borderColor`, `accentColor`
   - Open/Edit preservados: NO tocar `onPrimaryAction` / `onSecondaryAction`

5. **Tipos:**
   - TeamWithWorkspaces hereda `status: TeamStatus` desde `Team` interface (types.ts línea 26-29)
   - NO requiere ajustes — tipos correctos desde Fase 1A

**Cambios implementados:**

1. **src/components/teams/TeamsClient.tsx (+20 líneas netas):**
   - Estado local: `const [showArchivedTeams, setShowArchivedTeams] = useState(false)`
   - Conteo archived: `const archivedCount = teams.filter(t => t.status === 'archived').length`
   - Control Show archived: botón secundario visible solo cuando `archivedCount > 0`
   - Label dinámico: `Show archived (${archivedCount})` / `Hide archived`
   - Ubicación: después de contador Teams/Workers, antes de zoom controls (línea ~382-395)
   - Prop a MapView: `showArchivedTeams={showArchivedTeams}`

2. **src/components/teams/MapView.tsx (+37 líneas netas):**
   - Función `filterArchivedTeams()`: filtra archived respetando jerarquía parent-child
   - Regla: si parent archived está oculto, sus hijos también se ocultan para evitar nodos huérfanos
   - `visibleTeams = useMemo(() => filterArchivedTeams(teams, showArchivedTeams), [teams, showArchivedTeams])`
   - `teamCodes` y `projectGroups` construidos desde `visibleTeams` (no desde `teams` originales)
   - Prop `isArchived = realTeam?.status === 'archived'` pasada a `TreeWorkspaceCard` (línea 313)
   - Prop `showArchivedTeams: boolean` agregada a `MapViewProps`

3. **src/components/teams/v3/TreeWorkspaceCard.tsx (+18 líneas netas):**
   - Prop `isArchived?: boolean` agregada a interface
   - Badge Archived: absolute right-3, z-10, amber background (#FEF3C7), amber border (#D97706)
   - Posición dinámica: `top: isSat && !isConnected ? '48px' : '12px'` (abajo del SAT badge si ambos presentes)
   - Label: "Archived" en text-amber-800
   - Coexiste sin solaparse con SAT badge
   - NO toca colores del team (ribbon/soft/border/accent preservados)
   - NO toca handlers Open/Edit (preservados intactos)

**Decisiones técnicas:**

1. **Filtrado antes de buildGraphNodesForProject():**
   - Evita que archived lleguen a construcción del árbol
   - Aplicado en MapView principal vía `useMemo` antes de `teamCodes` y `projectGroups`

2. **Manejo jerárquico padre archived / hijo active:**
   - Cuando `showArchived=false`: si parent archived está oculto, hijos también ocultos (previene nodos huérfanos)
   - Implementado con `activeIds.has(team.parent_id)` check en `filterArchivedTeams()`

3. **Manejo padre active / hijo archived:**
   - Cuando `showArchived=false`: padre active se muestra, hijo archived se oculta
   - Cuando `showArchived=true`: ambos se muestran, hijo archived lleva badge Archived

4. **Badge Archived posicionamiento:**
   - Usa position absolute como SAT badge
   - Top dinámico para evitar overlap cuando ambos badges presentes
   - SAT arriba (top: 12px), Archived abajo (top: 48px) si coexisten

5. **No modo All Projects:**
   - Conteo N siempre sobre el Project seleccionado actual
   - Los `teams` ya vienen scopeados por Project desde page server-side

**Restricciones respetadas:**

- ✅ NO Restore/Unarchive visible
- ✅ NO Teams Map layout modificado (organigrama jerárquico preservado)
- ✅ NO CanvasViewport modificado (solo referenciado)
- ✅ NO TreeView modificado (deprecado, preservado)
- ✅ NO Documentation Mode tocado
- ✅ NO Audit Log UI tocado
- ✅ NO audit_log events emitidos (diferido Fase 1C)
- ✅ NO snapshots creados (diferido Fase 1C)
- ✅ NO schema/RLS/migrations
- ✅ NO colores de team modificados
- ✅ NO Open/Edit deshabilitados (preservados funcionales)
- ✅ NO provider/model logic tocado
- ✅ NO acordeón por Project modificado
- ✅ NO Executive Team sintético modificado
- ✅ NO códigos jerárquicos modificados
- ✅ NO Shared Teams modificados

**Validaciones técnicas:**

- npm run lint: ✅ OK (solo warnings pre-existentes en CanvasViewport)
- npm run build: ✅ Exitoso sin errores TypeScript
- grep showArchived/Show archived/Hide archived: ✅ Encontrados en TeamsClient/MapView/TreeWorkspaceCard
- grep Restore/Unarchive: ✅ 0 resultados
- grep CanvasViewport MapView: ✅ Solo import + uso normal (NO modificado)
- grep TreeView MapView: ✅ 0 resultados
- git diff --stat: ✅ 4 archivos (+107 líneas netas, -5 líneas)
- git diff --check: ✅ OK (solo warnings CRLF normales Windows)

**Archivos modificados:**
- src/components/teams/TeamsClient.tsx (+20 líneas: estado + control + conteo)
- src/components/teams/MapView.tsx (+37 líneas: filtrado + prop isArchived)
- src/components/teams/v3/TreeWorkspaceCard.tsx (+18 líneas: badge Archived)

**Archivos NO tocados:**
- CanvasViewport (todas variantes: v3, preview, legacy)
- TreeView.tsx
- AddTeamModal.tsx, EditTeamModal.tsx, ConnectTeamModal.tsx, IncomingRequestsPanel.tsx
- Documentation Mode, Audit Log UI
- API routes, migrations, RLS, schema
- Provider/model logic
- Acordeón, Executive Team, códigos jerárquicos, Shared Teams

**Validación funcional:**
⏳ PENDIENTE — Requiere screenshot PO confirmando:

| #  | Caso                                        | Resultado esperado                                          |
|----|---------------------------------------------|-------------------------------------------------------------|
| 1  | Hay archived teams                          | Aparece botón `Show archived (N)` con conteo correcto       |
| 2  | No hay archived teams                       | No aparece botón                                            |
| 3  | showArchived=false (default)                | Teams archived no aparecen                                  |
| 4  | Click Show archived                         | Cambia a `Hide archived`                                    |
| 5  | showArchived=true                           | Archived aparecen en posición normal del árbol              |
| 6  | Archived visible                            | Badge `Archived` claro (amber)                              |
| 7  | Archived visible                            | Color de team intacto                                       |
| 8  | Archived visible                            | Open funciona                                               |
| 9  | Archived visible                            | Edit funciona                                               |
| 10 | Click Hide archived                         | Archived vuelven a ocultarse                                |
| 11 | Active teams                                | Sin regresión                                               |
| 12 | Parent archived + child active (hidden)     | Child no queda huérfano cuando archived oculto              |
| 13 | Parent active + child archived              | Child se oculta hasta activar toggle                        |
| 14 | Project específico                          | N cuenta archivados de ese Project                          |
| 15 | SAT badge + Archived badge en mismo team    | Ambos badges visibles sin solaparse                         |

**Estado:**
Partial — código completo, build exitoso, lint OK, documentación actualizada. Pendiente: validación visual Product Owner con screenshot confirmando 15-point checklist.

**Ajuste visual post-validación (2026-07-16):**

Después de validación visual PO exitosa de funcionalidad base (hidden default, toggle, badge, colores, Open/Edit), se aplicaron ajustes visuales adicionales solicitados:

**Primera iteración (opacity 0.65):**
- TreeWorkspaceCard aplicaba `opacity: 0.65` a card completa cuando `isArchived === true`
- Badge "Archived" con `opacity: 1` explícita para legibilidad
- PO detectó dos problemas: (1) Workers NO heredaban atenuación de su team padre archivado, (2) opacity 0.65 insuficiente para diferenciación rápida

**Segunda iteración (correcciones aplicadas):**

1. **Workers heredan opacity de team padre archivado:**
   - Worker cards ahora calculan `isWorkerArchived = realTeam?.status === 'archived'` (MapView línea 288-289)
   - Prop `isArchived={isWorkerArchived}` pasada a TreeWorkspaceCard del Worker (línea 304)
   - Workers de team archivado ahora se atenúan igual que su Manager/Team padre
   - **Bug fix crítico:** `realTeam` era `undefined` para Workers porque el código buscaba por `node.id` (ID sintético del nodo Worker) en lugar de `node.teamId` (ID real del team padre). Corregido a `teams.find(t => t.id === node.teamId)`.
   - Lógica: Workers son `agent_sessions` dentro del workspace del team, no filas separadas de `teams` — heredan status del team por `node.teamId`

2. **Opacity reforzada de 0.65 a 0.45:**
   - TreeWorkspaceCard ahora aplica `opacity: 0.45` (40-50% range solicitado por PO) a card completa cuando `isArchived === true`
   - Diferenciación visual más marcada entre teams activos (opacity 1.0) y archivados (opacity 0.45)
   - Badge "Archived" preserva `opacity: 1` explícita para legibilidad completa

3. **Consistencia visual completa:**
   - Manager/Team archivado: opacity 0.45
   - Workers de team archivado: opacity 0.45 (heredada)
   - Badge "Archived" en ambos: opacity 1.0
   - Open/Edit funcionales en ambos (opacity NO afecta pointer-events)
   - Colores de identidad preservados (opacity atenúa, no reemplaza color)

**Archivos modificados (ajuste visual completo):**
- src/components/teams/MapView.tsx (+3 líneas: Worker opacity inheritance)
- src/components/teams/v3/TreeWorkspaceCard.tsx (+2 líneas: opacity 0.45 en card, opacity 1 en badge)

**Validaciones:**
- npm run build: ✅ Exitoso
- Worker opacity inheritance: ✅ Implementado via realTeam?.status check
- pointer-events: ✅ Preservados (opacity no afecta clickeabilidad)
- badge legibilidad: ✅ Preservada con opacity 1 explícita
- color identidad: ✅ Preservado (solo opacidad general, no cambio de color)
- opacity level: ✅ 0.45 (40-50% range solicitado)

**Validación funcional PO (2026-07-16):**
✅ Confirmado con evidencia de consola y screenshot visual: Managers y Workers de teams archivados se ven consistentemente atenuados al 45%. Diagnostic logs confirmaron `isWorkerArchived: true`, `workerRealTeamFound: true`, `workerRealTeamStatus: "archived"`. Diferenciación visual marcada respecto a teams activos (opacity 1.0). Badge "Archived" legible. Open/Edit clickeables. Console.log temporal removido post-validación.

**Lección técnica:**
Filtrado de jerarquías requiere verificación de cadena parent-child completa para evitar nodos huérfanos. El patrón `activeIds.has(team.parent_id)` garantiza que un team solo se muestra si su parent también es visible. Badge positioning dinámico (`top: condition ? '48px' : '12px'`) permite coexistencia limpia de múltiples badges sin overlap. Estado local de visibilidad (`useState(false)`) es suficiente para toggle secundario — no requiere persistencia en DB/localStorage. Opacidad general (`opacity: 0.65` en container, `opacity: 1` en badge) permite atenuación visual de archived teams sin afectar legibilidad de identificadores críticos ni clickeabilidad de acciones.

---

## Sesión 2026-07-19 — Documentation Mode archived filter bug fix

**Fecha:** 2026-07-19
**Estado:** Closed (validado funcionalmente por PO — Handoff Package archivado aparece/desaparece correctamente con filtro)

**Contexto:**
Product Owner confirmó con queries SQL directas que el dato en base era correcto:
- Team "JDNADNSFASDF" tiene `status = 'archived'`
- Handoff Package "Prueba con un archivado" vinculado correctamente via `handoff_packages.workspace_id → workspaces.team_id → teams.status`

Sin embargo, en Repository View, el filtro "Archived teams" NO funcionaba — el Handoff Package seguía apareciendo siempre, sin importar el filtro seleccionado (Active/Archived/All).

**Diagnóstico:**

1. **Inspección `documentation.ts`:**
   - ✅ `getHandoffPackages()` YA tenía normalización defensiva correcta (línea 171):
     ```ts
     const team = Array.isArray(r.workspaces?.teams) ? r.workspaces?.teams[0] : r.workspaces?.teams
     ```
   - ✅ `team_status` se normalizaba correctamente desde `team?.status`
   - ✅ `getSavedSelections()` tenía la misma normalización defensiva
   - ⚠️ `getDocAuditEvents()` accedía directo `r.workspaces?.teams?.status` sin normalización array (no causaba problema en práctica)

2. **Inspección `RepositoryView.tsx`:**
   - ❌ **Bug encontrado:** El filtro `filterArchiveStatus` SOLO se aplicaba a Checkpoints (línea 429)
   - ❌ Handoff Packages salían del filtro sin verificar `team_status` (líneas 414-417)
   - ❌ Saved Selections salían del filtro sin verificar `team_status` (líneas 419-421)
   - ✅ `AuditView.tsx` NO tenía el bug — el filtro ya estaba correctamente aplicado a todos los eventos (línea 102)

3. **Causa raíz confirmada:**
   - DB: ✅ Correcta
   - Data mapping (`documentation.ts`): ✅ Correcto desde antes
   - UI filtering (`RepositoryView.tsx`): ❌ **Omisión de filtrado** en Handoffs y Saved Selections

**Cambios implementados:**

1. **src/components/documentation/RepositoryView.tsx (+8 líneas netas):**
   - Agregado filtro `filterArchiveStatus` para Handoff Packages (líneas 414-420):
     ```ts
     if (item.kind === 'handoff') {
       const h = item.hp
       if (filterType && filterType !== 'Handoff Package') return false
       if (filterArchiveStatus && h.team_status !== filterArchiveStatus) return false
       return true
     }
     ```
   - Agregado filtro `filterArchiveStatus` para Saved Selections (líneas 422-427):
     ```ts
     if (item.kind === 'saved_selection') {
       const s = item.ss
       if (filterType && filterType !== 'Saved Selection') return false
       if (filterArchiveStatus && s.team_status !== filterArchiveStatus) return false
       return true
     }
     ```

2. **Logging temporal (removido antes del commit):**
   - Agregado `console.log` en `getHandoffPackages()` para confirmar runtime shape
   - PO validó en producción: `team_status: 'archived'` llegaba correctamente
   - Log removido post-validación — no quedaron logs temporales en código final

**Decisiones técnicas:**

1. **No se modificó `documentation.ts`:**
   - La normalización defensiva de `workspaces → teams` ya era correcta desde antes
   - `team_status` llegaba correctamente a `RepositoryView.tsx`
   - El bug era exclusivamente de omisión de filtrado en UI

2. **No se modificó `AuditView.tsx`:**
   - El filtro `filterArchiveStatus` ya estaba correctamente aplicado a todos los eventos
   - No requería fix

3. **Patrón aplicado:**
   - Mismo patrón de filtrado que Checkpoints: `if (filterArchiveStatus && item.team_status !== filterArchiveStatus) return false`
   - Aplicado consistentemente a las tres superficies documentales (Checkpoints, Handoff Packages, Saved Selections)

**Archivos modificados:**
- src/components/documentation/RepositoryView.tsx (+8 líneas: filtro Archived para Handoffs y Saved Selections)
- handoff-2026-07-b.md (esta entrada)
- PRODUCT_STATUS.md (entrada Documentation Mode)
- AISyncPlans.md (contrato filtrado Archived en Documentation Mode)

**Archivos NO modificados:**
- src/lib/db/documentation.ts (normalización ya correcta desde antes)
- src/components/documentation/AuditView.tsx (filtro ya correcto)
- src/components/documentation/StructureView.tsx (sin filtro Archived activo)
- src/components/documentation/InvestigateView.tsx (sin filtro Archived activo)
- src/components/documentation/KnowledgeMap.tsx (sin filtro Archived activo)
- Schema, RLS, migrations, Teams Map, Audit Log UI, endpoint archive

**Validaciones técnicas:**
- npm run lint: ✅ OK (solo warnings pre-existentes CanvasViewport)
- npm run build: ✅ Exitoso sin errores TypeScript
- grep TEMP_DOCMODE_DEBUG: ✅ 0 resultados (log temporal removido)
- git diff --check: ✅ OK

**Validación funcional (2026-07-19, PO confirmado):**

| # | Caso                                     | Resultado esperado                 | Estado |
|---|------------------------------------------|------------------------------------|--------|
| 1 | Handoff Package sin filtro               | Aparece                            | ✅     |
| 2 | Handoff Package con "Active teams"       | NO aparece                         | ✅     |
| 3 | Handoff Package con "Archived teams"     | Aparece                            | ✅     |
| 4 | Saved Selections con archived team       | Filtrado funciona igual            | ✅     |
| 5 | Checkpoints con archived team            | Sin regresión (ya funcionaba)      | ✅     |
| 6 | AuditView eventos con archived team      | Sin regresión (ya funcionaba)      | ✅     |
| 7 | Active team docs                         | Siguen filtrando como Active       | ✅     |
| 8 | team_status null legítimo                | No rompe render                    | ✅     |

**Restricciones respetadas:**
- ✅ NO Teams Map
- ✅ NO archive endpoint
- ✅ NO schema/RLS/migrations
- ✅ NO Audit Log UI externa
- ✅ NO modificación de normalización de datos (ya era correcta)
- ✅ NO parches visuales (fix estructural en filtrado)

**Lección clave:**
Cuando un filtro UI falla pero el dato en DB es correcto, confirmar primero si el mapeo de datos es correcto antes de asumir problema de shape. En este caso, `documentation.ts` ya tenía normalización defensiva correcta para joins anidados — el bug real era omisión de aplicación del filtro en RepositoryView para tipos documentales Handoff Package y Saved Selection. AuditView no tenía el bug porque su filtro se aplicaba a todos los eventos sin discriminación por tipo. La causa NO fue un problema de `workspaces.teams` como objeto vs array — fue simplemente que el filtro `filterArchiveStatus` no se verificaba para dos de los tres tipos de documentos.

---

## Sesión 2026-07-20 — AgentPanel native text selection bugfix

**Fecha:** 2026-07-20
**Estado:** Partial (código completo, build exitoso, pendiente validación PO)

**Contexto:**
Product Owner reportó que al intentar seleccionar una frase específica dentro de un mensaje de agente en el Workspace para copiarla, la interacción se interpretaba incorrectamente como un click de selección/deselección del mensaje completo. Efectos observados: (1) menú nativo de copiar del navegador no llegaba a aparecer, (2) selección de texto se perdía, (3) re-render provocado por toggleSelection descartaba la selección.

**Inspección previa:**

1. **AgentPanel.tsx:**
   - Ubicación del bug: línea 648, contenedor `div.relative.max-w-[88%].cursor-pointer` del mensaje
   - onClick problemático: `onClick={() => toggleSelection(i)}` sin verificación de selección de texto activa
   - toggleSelection existente: línea 173, función correcta que actualiza `selectedIndices` Set
   - copyMessage existente: línea 254, copia mensaje completo al clipboard
   - Causa raíz confirmada: el `onClick` se dispara SIEMPRE al hacer click en el bubble, incluso cuando el usuario está completando una selección de texto — no hay verificación de `window.getSelection()` antes de togglear

2. **HumanChatPanel.tsx (solo lectura):**
   - Patrón de selección: checkbox separado (`<input type="checkbox">` línea 472-477)
   - Checkbox desacoplado: ✅ Sí — el checkbox está separado del texto del mensaje
   - Texto del mensaje (línea 480-523): NO tiene `onClick` que dispare `toggleSelection`
   - toggleSelection se dispara exclusivamente por `onChange` del checkbox
   - ❌ HumanChatPanel NO comparte el bug — NO requiere modificación

**Cambios implementados:**

1. **src/components/workspace/AgentPanel.tsx (+10 líneas netas):**
   - Agregado helper `handleMessageClick(i: number)` después de `toggleSelection` (línea 182-188)
   - Lógica del helper:
     ```ts
     function handleMessageClick(i: number) {
       const selection = window.getSelection()
       if (selection && selection.toString().length > 0) {
         return  // Preserva selección nativa del navegador
       }
       toggleSelection(i)  // Click limpio → comportamiento normal
     }
     ```
   - Actualizado `onClick` del contenedor del mensaje (línea 657): `onClick={() => toggleSelection(i)}` → `onClick={() => handleMessageClick(i)}`
   - toggleSelection: ✅ Intacto (no modificado)
   - copyMessage: ✅ Intacto (no modificado)
   - HumanChatPanel: ✅ NO modificado (checkbox separado, no comparte bug)

**Decisiones técnicas:**

1. **Helper local vs global:**
   - Elegido: helper local en AgentPanel
   - Razón: el bug es específico de AgentPanel (HumanChatPanel usa checkbox separado). No justifica helper compartido.

2. **window.getSelection() vs preventDefault:**
   - Elegido: `window.getSelection()` reactivo post-click
   - Descartado: `preventDefault` — bloquearía selección nativa y menú contextual del navegador
   - Razón: el helper verifica si YA hay selección activa cuando se dispara el click. Si hay selección, retorna sin togglear. Si no hay selección, es click limpio y togglea normalmente.

3. **Verificación selection.toString().length > 0:**
   - Detecta selección activa de texto (cualquier cantidad de caracteres)
   - Click limpio sin selección → `length === 0` → togglea mensaje completo
   - Click con selección → `length > 0` → preserva selección nativa

4. **No usar timers ni debounce:**
   - La verificación es instantánea y sincrónica
   - Sin race conditions, sin interferencia con comportamiento nativo del navegador

**Archivos modificados:**
- src/components/workspace/AgentPanel.tsx (+10 líneas: helper handleMessageClick + actualización onClick)

**Archivos NO modificados:**
- src/components/workspace/HumanChatPanel.tsx (patrón correcto, checkbox separado)
- src/components/workspace/WorkspaceShell.tsx
- src/app/workspace/[id]/page.tsx
- Otros componentes del Workspace
- APIs, migrations, RLS, schema

**Validaciones técnicas:**
- npm run lint: ✅ OK (solo warnings pre-existentes CanvasViewport)
- npm run build: ✅ Exitoso sin errores TypeScript
- grep handleMessageClick: ✅ 2 resultados (definición línea 182, uso línea 657)
- git diff --check: ✅ OK (solo warning CRLF normal Windows)

**Validación funcional:**
⏳ PENDIENTE — Requiere confirmación Product Owner con validación en producción:

| # | Caso | Resultado esperado | Estado |
|---|---|---|---|
| 1 | Seleccionar frase dentro de mensaje de agente | NO togglea mensaje completo | ⏳ |
| 2 | Selección de texto activa | Se respeta selección nativa | ⏳ |
| 3 | Menú contextual / copiar nativo | Funciona normalmente | ⏳ |
| 4 | Click limpio sobre mensaje (sin selección) | Sigue toggleando selección completa | ⏳ |
| 5 | Selección/deselección repetida | Sin regresión | ⏳ |
| 6 | HumanChatPanel checkbox | Sin regresión | ⏳ |
| 7 | Copy message existente (botón) | Sin regresión | ⏳ |
| 8 | Markdown rendering en mensajes | Sin regresión | ⏳ |
| 9 | Attachment chips en mensajes | Sin regresión | ⏳ |
| 10 | Forward/Save Version/Save Selection | Sin regresión | ⏳ |

**Restricciones respetadas:**
- ✅ NO HumanChatPanel modificado (checkbox separado, no comparte bug)
- ✅ NO toggleSelection modificado (intacto)
- ✅ NO copyMessage modificado (intacto)
- ✅ NO estructura visual modificada
- ✅ NO APIs/migrations/RLS/schema
- ✅ NO librerías nuevas agregadas
- ✅ NO preventDefault sobre selección nativa
- ✅ NO bloqueo de menú nativo del navegador

**Estado:**
Partial — código completo, build exitoso, lint OK. Pendiente: validación Product Owner confirmando que seleccionar una frase específica dentro de un mensaje ya no togglea la selección del mensaje completo, el menú/comportamiento nativo de copiar funciona normalmente, y un click normal sin selección sigue toggleando la selección del mensaje como antes.

**Lección clave:**
`onClick` en contenedores de texto clickeables debe verificar `window.getSelection().toString().length > 0` antes de ejecutar acciones de selección/toggle para preservar el comportamiento nativo del navegador de selección de texto y menú contextual. HumanChatPanel no tenía este problema porque usa checkbox separado — la selección se dispara por `onChange` del checkbox, no por click en el texto. El patrón correcto para mensajes clickeables es: (1) verificar selección activa, (2) si hay selección retornar sin action, (3) si no hay selección ejecutar action normal (toggle/select/etc).
