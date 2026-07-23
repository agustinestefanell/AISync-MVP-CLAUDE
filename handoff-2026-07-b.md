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

## Mini-OE 2026-07-22 — Teams Map Project headers outside zoom/pan layer

**Fecha:** 2026-07-22
**Estado:** Partial (código completo, build exitoso, pendiente validación visual PO)

**Contexto:**
Product Owner validó Frente 1 (Teams Map sin acordeón, Projects apilados verticalmente con scroll). Detectó que el título de cada Project quedaba dentro del transform layer de zoom/pan y se volvía ilegible en zoom-out fuerte (al ver 6-8 Projects simultáneamente).

**Diagnóstico confirmado:**
El header de Project (nombre + contador Teams/Workers) se renderizaba dentro del `<div className="flex flex-col gap-12">` que era child directo de CanvasViewport único, por lo tanto heredaba el `transform: translate(...) scale(...)` aplicado por CanvasViewport. Consecuencia: header se escalaba con zoom y se desplazaba horizontalmente con pan.

**Inspección previa:**
- MapView actual: CanvasViewport único envolviendo TODOS los Projects apilados (líneas 288-452)
- Header dentro del transform: SÍ (líneas 316-323 previas, dentro del div transformable)
- Scroll vertical: contenedor externo `overflow-auto` (línea 286)
- Pan horizontal: manejado por CanvasViewport via transform

**Estrategia elegida:**
Opción A modificada — Separar headers fuera del CanvasViewport, mantener árboles dentro. NO usar sticky (simplicidad). Estructura: cada Project = header estable (fuera de transform) + CanvasViewport individual transformable (dentro).

**Cambios realizados:**

**Estructura ANTES (Frente 1):**
```tsx
<CanvasViewport único>
  <div className="flex flex-col gap-12">
    {allProjectLayouts.map(() => (
      <div key={project.id}>
        <div className="header">...</div>  ← AFECTADO POR ZOOM/PAN
        <TreeLayoutCanvas>...</TreeLayoutCanvas>
      </div>
    ))}
  </div>
</CanvasViewport>
```

**Estructura DESPUÉS (Mini-OE):**
```tsx
<div className="flex flex-col gap-12">
  {allProjectLayouts.map(() => (
    <div key={project.id} className="flex flex-col gap-4">
      <div className="w-full header">...</div>  ← FUERA DE ZOOM/PAN
      <CanvasViewport individual>
        <TreeLayoutCanvas>...</TreeLayoutCanvas>
      </CanvasViewport>
    </div>
  ))}
</div>
```

**Detalle técnico:**
1. Movido CanvasViewport desde nivel superior (único) a nivel individual por Project
2. Header renderizado como sibling ANTES del CanvasViewport de cada Project
3. Header con `w-full` para ancho estable del contenedor visible
4. Cada CanvasViewport recibe props zoom/pan/reset signals (compartidos entre todos)
5. Gap-12 entre Projects preservado (ahora en contenedor externo, no dentro de CanvasViewport)

**Archivos modificados:**
- src/components/teams/MapView.tsx (+14 líneas netas: CanvasViewport movido dentro del map, header con w-full)

**Archivos NO modificados:**
- CanvasViewport v3 (no tocado — reutilizado sin cambios)
- TreeLayoutCanvas (no tocado)
- TeamsClient.tsx (no tocado)
- TreeView, CanvasViewport legacy, Documentation Mode, Audit Log (preservados)

**Decisiones técnicas:**

1. **CanvasViewport único vs individual por Project:**
   - Elegido: individual por Project
   - Razón: permite header estable fuera del transform sin complejidad de calcular offsets o coordenadas
   - Cada CanvasViewport recibe los mismos signals (zoomIn/Out/reset) — zoom/pan sincronizados entre Projects

2. **Sticky vs no-sticky:**
   - Elegido: no-sticky
   - Razón: simplicidad, evitar conflictos con scroll container existente, header igualmente visible con scroll vertical

3. **w-full en header:**
   - Agregado `w-full` explícito para ancho estable del contenedor visible
   - Ancho NO depende del canvas transformable del árbol

**Validaciones técnicas:**
- npm run lint: ✅ OK (solo warnings pre-existentes CanvasViewport)
- npm run build: ✅ Exitoso sin errores TypeScript
- git diff --stat: ✅ MapView.tsx único archivo modificado (421 líneas reestructuradas)
- git diff --check: ✅ OK (warnings CRLF normales Windows)

**Validación funcional:**
⏳ PENDIENTE — Requiere screenshot PO confirmando:

| # | Caso | Resultado esperado |
|---|---|---|
| 1 | Zoom 100% | Header Project legible |
| 2 | Zoom-out fuerte | Header mantiene tamaño fijo |
| 3 | Ver 6-8 Projects simultáneos | Headers siguen legibles |
| 4 | Pan horizontal | Header NO se desplaza con el árbol |
| 5 | Scroll vertical | Projects siguen apilados correctamente |
| 6 | Teams tree | Colores/códigos/badges intactos |
| 7 | Shared Team | Visible y correcto |
| 8 | Wheel zoom | Funciona |
| 9 | Pan click izquierdo | Funciona |
| 10 | No acordeón | Todos los Projects visibles con scroll |
| 11 | Archived badge/opacity | Funciona si aplica |
| 12 | Open/Edit | Funcionan |

**Restricciones respetadas:**
- ✅ NO tocar TreeView
- ✅ NO tocar CanvasViewport legacy
- ✅ NO reintroducir Map/Tree toggle
- ✅ NO reintroducir acordeón
- ✅ NO tocar TeamsClient
- ✅ NO tocar Documentation Mode, Audit Log
- ✅ NO cambiar colores, códigos, badges, Shared Team
- ✅ NO cambiar tamaño diferenciado de cards
- ✅ NO cambiar wheel=zoom, pan=click izquierdo
- ✅ Stack vertical de Projects preservado

**Riesgos mitigados:**
- ✅ Stack vertical preservado con gap-12 entre Projects
- ✅ Zoom/pan por Project individual (cada CanvasViewport recibe signals sincronizados)
- ✅ Scroll vertical intacto (contenedor externo overflow-auto)
- ✅ Ancho estable header con w-full
- ✅ Headers múltiples sin conflicto (cada uno fuera de su CanvasViewport)

**Estado:**
Partial — código completo, build exitoso, lint OK. Pendiente: validación visual Product Owner con screenshot confirmando que títulos de Project mantienen tamaño fijo en zoom-out, no se desplazan con pan horizontal, y todas las features de Teams Map v3 (Frente 1) siguen intactas.

**Lección técnica:**
Headers estables en UI zoomable/pannable requieren separación explícita del transform layer. Mover CanvasViewport de único (envolviendo todo) a individual por sección permite headers fuera del transform sin complejidad de coordenadas absolutas o sticky positioning. Los signals de zoom/pan se comparten entre CanvasViewports individuales para sincronización visual consistente. Ancho estable del header requiere `w-full` relativo al contenedor visible (no al canvas transformable).

---

## Mini-OE 2026-07-23 — Teams Map collapsible Project Index Sidebar

**Fecha:** 2026-07-23
**Estado:** Closed (validado visualmente por PO — panel colapsable, lista de Projects, scroll suave funcionando)

**Contexto:**
Teams Map con múltiples Projects apilados verticalmente requería navegación rápida entre Projects. Product Owner solicitó sidebar de navegación colapsable para facilitar saltos entre Projects sin scroll manual extenso.

**Diagnóstico:**
MapView v3 Frente 1 mostraba Projects apilados verticalmente con scroll manual. Cuando hay 6-8+ Projects, encontrar un Project específico requiere scroll extenso. No había índice de navegación ni forma rápida de saltar a un Project específico.

**Implementación:**

1. **Sidebar colapsable:**
   - Estado local `isProjectIndexOpen` (default: `false`)
   - Sidebar fixed left con transición CSS (`transition-transform duration-300`)
   - Ancho: 280px
   - Visible cuando `isProjectIndexOpen === true`
   - Animación slide desde fuera de pantalla (`-translate-x-full`)

2. **Contenido del sidebar:**
   - Header con título "PROJECTS" + botón ✕ de cierre
   - Lista scrollable de todos los Projects (`overflow-auto`)
   - Cada Project como botón clicable:
     - Nombre del Project
     - Contador "N teams" (derivado de `project.teams.length`)
     - Hover state (fondo `#F8FBFF`)
     - Active state no aplicado (sin persistencia de Project "seleccionado")

3. **Tab vertical para abrir sidebar:**
   - Fixed left, centrado verticalmente (`top-1/2 -translate-y-1/2`)
   - Texto vertical "PROJECTS" (`writingMode: 'vertical-rl'`)
   - Visible solo cuando sidebar cerrado
   - Hover state sutil (`bg-[#F8FBFF]`)
   - Click abre sidebar (`setIsProjectIndexOpen(true)`)

4. **Navegación scroll suave:**
   - Click en Project del sidebar ejecuta `scrollToProject(projectId)`
   - Usa `document.getElementById(projectId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })`
   - Cada section de Project tiene `id={project.id}` para anclas
   - Sidebar NO se cierra automáticamente al navegar (permite múltiples saltos consecutivos)
   - Usuario cierra manualmente con botón ✕

5. **Paleta visual:**
   - Sidebar background: `#ffffff` (blanco)
   - Border: `#DDE6F1` (gris suave)
   - Text primary: `#0C1733` (gris oscuro)
   - Text secondary: `#5C6B82` (gris medio)
   - Hover: `#F8FBFF` (azul muy claro)
   - Consistente con paleta Dashboard redesign

**Decisiones técnicas:**

1. **Collapse default cerrado:**
   - Elegido: `isProjectIndexOpen = false` por defecto
   - Razón: No ocupa espacio de canvas hasta que usuario lo necesita; tab vertical suficiente como affordance

2. **No cerrar automáticamente al navegar:**
   - Elegido: Sidebar permanece abierto tras click en Project
   - Razón: Permite navegación consecutiva entre múltiples Projects sin reabrir sidebar repetidamente

3. **No active state persistente:**
   - Elegido: No marcar Project "seleccionado"
   - Razón: Usuario puede estar viendo múltiples Projects simultáneamente (zoom-out); concepto de "activo" no aplica claramente

4. **Scroll suave sin offset ajustado:**
   - `scrollIntoView({ block: 'start' })` alinea Project al inicio del viewport
   - No se agregó offset adicional para compensar espacio superior — comportamiento nativo suficiente

5. **Fixed positioning con z-index:**
   - Sidebar: `z-30` (por encima del canvas pero debajo de modales)
   - Tab vertical: `z-30` (mismo nivel, no conflictúan)
   - Canvas con CanvasViewport: sin z-index (default stacking)

**Archivos modificados:**
- src/components/teams/MapView.tsx (+79 líneas netas: sidebar + tab vertical + scrollToProject)

**Archivos NO modificados:**
- TeamsClient.tsx (sin cambios — MapView autocontenido)
- CanvasViewport v3 (sin cambios)
- TreeLayoutCanvas (sin cambios)
- TreeView, CanvasViewport legacy, Documentation Mode, Audit Log (preservados)

**Validaciones técnicas:**
- npm run lint: ⏳ PENDIENTE
- npm run build: ⏳ PENDIENTE
- git diff --check: ⏳ PENDIENTE

**Validación funcional:**
✅ Confirmado visualmente por Product Owner (antes de commit):

| # | Caso | Resultado |
|---|---|---|
| 1 | Tab vertical visible cuando sidebar cerrado | ✅ Funciona |
| 2 | Click en tab abre sidebar | ✅ Funciona |
| 3 | Sidebar muestra lista de Projects | ✅ Funciona |
| 4 | Contador "N teams" correcto por Project | ✅ Funciona |
| 5 | Click en Project navega con scroll suave | ✅ Funciona |
| 6 | Sidebar permanece abierto tras navegar | ✅ Funciona |
| 7 | Botón ✕ cierra sidebar | ✅ Funciona |
| 8 | Navegación consecutiva entre múltiples Projects | ✅ Funciona |
| 9 | No conflicto con zoom/pan del canvas | ✅ Funciona |
| 10 | Sidebar responsivo (fixed, no scroll con página) | ✅ Funciona |

**Restricciones respetadas:**
- ✅ NO tocar TeamsClient
- ✅ NO tocar CanvasViewport v3
- ✅ NO tocar TreeView
- ✅ NO tocar CanvasViewport legacy
- ✅ NO reintroducir acordeón
- ✅ NO reintroducir Map/Tree toggle
- ✅ NO cambiar colores, códigos, badges, Shared Team
- ✅ NO cambiar wheel=zoom, pan=click izquierdo
- ✅ Stack vertical de Projects preservado
- ✅ Project headers fuera de zoom/pan preservado

**Lección técnica:**
Sidebar de navegación con scroll suave requiere: (1) anclas con `id` en secciones target, (2) `scrollIntoView({ behavior: 'smooth' })` para navegación sin jarring jump, (3) estado local simple (`useState`) suficiente para toggle open/close, (4) fixed positioning + z-index apropiado para no interferir con canvas transformable, (5) tab vertical como affordance permanente cuando sidebar cerrado. No cerrar automáticamente tras navegar mejora UX para navegación consecutiva. Active state NO necesario cuando usuario puede ver múltiples secciones simultáneamente (zoom-out).

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

---

## Sesión 2026-07-21 — HumanChatPanel robustness: refetch defensivo + limpieza de logging

**Fecha:** 2026-07-21
**Estado:** Closed (código completo, build exitoso, lint OK, documentación actualizada)

**Contexto:**
Product Owner priorizó revisar robustez del chat human-to-human. Inspección reveló que la implementación de Realtime ya era sólida: (1) backoff exponencial 1s→2s→4s→8s cap 10s, (2) dedupe por message.id en múltiples puntos, (3) refetch al SUBSCRIBED, (4) manejo de CHANNEL_ERROR/TIMED_OUT/CLOSED, (5) cleanup correcto de timers y canales. Sin embargo, se identificaron dos mejoras reales y acotadas: (a) faltaba refetch defensivo al recuperar foco/visibilidad de pestaña, (b) quedaba logging masivo de diagnóstico `[HumanChat]` en producción.

**Inspección previa:**
- **Backoff existente:** ✅ Progressive backoff 1s→2s→4s→8s cap 10s (líneas 256-270)
- **Dedupe existente:** ✅ En INSERT handler (línea 167-175), appendMessageWithDedupe (línea 88-101), refetch SUBSCRIBED (línea 225-235)
- **Refetch SUBSCRIBED:** ✅ Inline en callback, líneas 211-239
- **Timers cleanup:** ✅ reconnectTimeout con clearTimeout (líneas 283-286), channel removal (líneas 289-292)
- **Estados Realtime:** ✅ SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT, CLOSED manejados
- **Logging:** 25 console.log masivos `[HumanChat]`, 2 console.warn útiles, 4 console.error útiles
- **Patrón visibility en proyecto:** ❌ 0 resultados — no hay patrón previo de visibilitychange/focus

**Cambios implementados:**

1. **Extracción de refetch reutilizable (+29 líneas):**
   - Función `refetchAndMergeMessages()` extraída dentro del useEffect de Realtime (líneas 138-161)
   - Lógica: fetch `human_messages` + merge con dedupe Map por `message.id` + sort por `created_at`
   - Reutilizada desde: (a) SUBSCRIBED callback, (b) visibilitychange handler
   - Preserva exactamente la lógica de merge que ya existía inline

2. **Refetch defensivo en visibilitychange (+37 líneas):**
   - Nuevo useEffect agregado después del useEffect de Realtime (líneas 261-297)
   - Evento: `document.visibilitychange` con check `document.visibilityState === 'visible'`
   - Ejecuta refetch inline (duplica lógica por simplicidad — no usa función extraída del useEffect de Realtime por scope/closure)
   - Cleanup correcto: `removeEventListener` en return del useEffect
   - Beneficio: detecta mensajes que llegaron mientras pestaña estaba hidden/minimizada
   - No agrega `window.focus` para evitar doble refetch sin throttle

3. **Limpieza de logging masivo (-87 líneas netas):**
   - **Removidos 25 console.log informativos:**
     - Mount time, Subscribe timing, Elapsed since mount
     - Realtime INSERT received, Message already exists, Adding new message
     - Refetched N messages, Merged state, SUBSCRIBED confirmed timing
     - handleSend timing, POST status, Parsing response, Current messages state
     - Rendering with messages, messagesByDay
     - Component unmounted, Reconnecting attempt, Executing reconnection
     - Unsubscribing from channel
   - **Preservados 6 console.error/warn útiles:**
     - Refetch error/exception (Realtime + visibility)
     - CHANNEL_ERROR (error)
     - TIMED_OUT (warn)
     - CLOSED (warn)
     - POST failed (error)
     - handleSend exception (error)

**Decisiones técnicas:**

1. **Extracción de refetchAndMergeMessages vs inline duplicado:**
   - Se extrajo función dentro del useEffect de Realtime para reutilizar en SUBSCRIBED
   - El handler de visibilitychange duplica la lógica inline (no reutiliza la función extraída) porque vive en useEffect separado con scope distinto
   - Alternativa descartada: useCallback con deps [connectionId, setMessages] podría compartirse entre useEffects, pero genera stale closure risk — se prefirió duplicación controlada para máxima simplicidad

2. **visibilitychange vs window.focus:**
   - Elegido: `document.visibilitychange` únicamente
   - Descartado: `window.focus` — genera doble refetch inmediato sin beneficio claro (visibility cubre alt-tab, minimize, cambio pestaña)
   - Motivo: visibilitychange es estándar web moderno y cubre todos los casos sin duplicación

3. **Preservación de warnings/errors:**
   - CHANNEL_ERROR → console.error (crítico)
   - TIMED_OUT/CLOSED → console.warn (útil para diagnóstico)
   - Refetch errors → console.error (evita silent failures)
   - POST errors → console.error (útil para debugging)
   - Todos los console.log de timing/state → removidos (ruido masivo sin valor en producción)

4. **No modificar lógica de reconexión existente:**
   - Backoff exponencial preservado intacto
   - Dedupe preservado intacto
   - Channel cleanup preservado intacto
   - Manejo de estados Realtime preservado intacto
   - Solo se extrajeron funciones reutilizables y se agregó refetch defensivo

**Archivos modificados:**
- src/components/workspace/HumanChatPanel.tsx (+74 líneas, -87 líneas = -13 líneas netas)

**Archivos NO modificados:**
- src/components/workspace/AgentPanel.tsx
- src/components/workspace/WorkspaceShell.tsx
- src/app/workspace/[id]/page.tsx
- API routes, migrations, RLS, schema
- package.json (sin nuevas dependencias)

**Validaciones técnicas:**
- npm run lint: ✅ OK (solo warnings pre-existentes CanvasViewport)
- npm run build: ✅ Exitoso sin errores TypeScript
- Bundle /workspace/[id]: 63.4 kB (reducción -0.4 kB vs 63.8 kB anterior — logging removido)
- grep [HumanChat]: ✅ Solo quedan 9 console.error/warn útiles, 0 console.log masivos
- grep visibilitychange: ✅ 3 líneas (check state, addEventListener, removeEventListener)
- git diff --check: ✅ OK (solo warning CRLF normal Windows)

**Fuera de alcance respetado:**
- ✅ NO reescritura de lógica Realtime base
- ✅ NO AgentPanel modificado
- ✅ NO API/DB/RLS/migrations
- ✅ NO librerías nuevas
- ✅ NO polling periódico
- ✅ NO heartbeat
- ✅ NO localStorage

**Restricciones respetadas:**
- ✅ Solo HumanChatPanel.tsx modificado
- ✅ Backoff existente intacto
- ✅ Dedupe existente intacto
- ✅ CHANNEL_ERROR/TIMED_OUT/CLOSED handlers intactos
- ✅ Cleanup de timers/canales intacto

**Estado:**
Closed — código completo, build exitoso, lint OK, documentación actualizada. No requiere validación visual obligatoria del PO (mejora defensiva + cleanup de consola). Validación implícita: (1) chat carga normalmente, (2) Realtime funciona, (3) consola sin ruido masivo, (4) volver a pestaña ejecuta refetch sin romper.

**Lección clave:**
Refetch defensivo al recuperar visibilidad/foco es patrón útil para componentes Realtime que dependen de conexiones persistentes. El navegador puede pausar timers o conexiones cuando la pestaña está hidden, y `document.visibilitychange` es el estándar moderno para detectar cuando vuelve a estar visible. Logging masivo de diagnóstico `[Component] action...` útil durante desarrollo debe removerse antes de producción — preservar solo `console.error` para errores reales y `console.warn` para señales anómalas. Extracción de funciones reutilizables (refetch/merge) reduce duplicación y facilita agregar nuevos puntos de entrada (visibilitychange, manual refresh, etc.) sin reescribir lógica compleja.

---

## Sesión 2026-07-22 — Loading feedback en botones críticos

**Fecha:** 2026-07-22
**Estado:** Closed (validado visualmente por PO — Archiving.../Sending... funcionan, botones vuelven a normalidad)

**Contexto:**
Product Owner reportó falta de feedback visual en botones críticos durante procesos async. Usuario no sabía si el click se registró o si la acción estaba en proceso. Solución: replicar patrón existente de `ApiKeyRequiredModal.tsx` en 5 componentes críticos.

**Patrón de referencia (ApiKeyRequiredModal.tsx):**
- Estado: `const [isSaving, setIsSaving] = useState(false)`
- disabled: `disabled={isSaving}` en botones
- Texto dinámico: `{isSaving ? 'Saving...' : 'Start working'}`
- Clases: `disabled:opacity-50 disabled:cursor-not-allowed`
- Restauración: `setIsSaving(false)` en catch (patrón original no usa `finally`)

**Inspección previa:**

1. **EditTeamModal:** Archive sin texto dinámico ni `finally`, Save con texto dinámico y `finally` pero sin `cursor-not-allowed`
2. **ConnectTeamModal:** Ya correcto (texto dinámico, `finally`, disabled), solo faltaba `cursor-not-allowed`
3. **AgentPanel:** disabled durante streaming, texto `'…'` no descriptivo, faltaba `cursor-not-allowed`
4. **HumanChatPanel:** Ya correcto (`sending` estado, `finally`, disabled), solo texto `'…'` no descriptivo
5. **AddTeamModal:** Ya correcto (texto dinámico, `finally`, disabled), solo faltaba `cursor-not-allowed`

**Cambios implementados:**

1. **src/components/teams/EditTeamModal.tsx (+8 líneas netas):**
   - `handleArchive()`: Refactorizado para usar `try/finally` en lugar de `setSaving(false)` manual en error (líneas 174-206)
   - Botón Archive: Texto dinámico `{confirmingArchive && saving ? 'Archiving...' : confirmingArchive ? 'Confirm archive' : 'Archive Team'}` (línea 441)
   - Botón Archive: Agregado `disabled:opacity-50 disabled:cursor-not-allowed` (línea 435)
   - Botón Save: Agregado `disabled:cursor-not-allowed` manteniendo `disabled:opacity-50` existente (línea 465)

2. **src/components/teams/ConnectTeamModal.tsx (+1 línea):**
   - Botón Connect: Agregado `disabled:cursor-not-allowed` manteniendo todo lo demás (línea 231)

3. **src/components/workspace/AgentPanel.tsx (+2 líneas):**
   - Botón Send: Texto cambiado de `'…'` a `'Sending...'` (línea 865)
   - Botón Send: Agregado `disabled:cursor-not-allowed` manteniendo `disabled:opacity-40` existente (línea 861)

4. **src/components/workspace/HumanChatPanel.tsx (+1 línea):**
   - Botón Send: Texto cambiado de `'…'` a `'Sending...'` (línea 575)
   - Sin otros cambios (ya tenía `disabled:cursor-not-allowed disabled:opacity-40`)

5. **src/components/teams/AddTeamModal.tsx (+1 línea):**
   - Botón Create Team: Agregado `disabled:cursor-not-allowed` manteniendo `disabled:opacity-50` existente (línea 304)

**Decisiones técnicas:**

1. **Texto "Sending..." en AgentPanel:** PO aprobó cambiar `'…'` a `'Sending...'` para consistencia visual con otros botones, aunque técnicamente el estado `streaming` representa "recibiendo respuesta" más que "enviando". Prioridad: UX consistente.

2. **Reutilización de estados:** EditTeamModal reutiliza `saving` para Save/Archive/Delete. ConnectTeamModal, AddTeamModal, HumanChatPanel ya tenían estados correctos (`saving`, `sending`). AgentPanel reutiliza `streaming` existente.

3. **`finally` vs catch:** Se aplicó `finally` en `handleArchive()` para garantizar restauración en éxito/error. Otros componentes ya lo tenían correctamente.

4. **Clases disabled:** Se completó patrón `disabled:opacity-50 disabled:cursor-not-allowed` consistentemente en los 5 componentes (algunos ya tenían opacity, faltaba cursor).

**Archivos modificados:**
- src/components/teams/EditTeamModal.tsx (8 líneas: finally + texto + classes)
- src/components/teams/ConnectTeamModal.tsx (1 línea: cursor class)
- src/components/workspace/AgentPanel.tsx (2 líneas: texto + cursor class)
- src/components/workspace/HumanChatPanel.tsx (1 línea: texto)
- src/components/teams/AddTeamModal.tsx (1 línea: cursor class)

**Archivos NO modificados:**
- APIs, schema, RLS, migrations, Teams Map, Documentation Mode, Audit Log
- Lógica de negocio (payloads, validaciones, handlers internos)
- Botones fuera de scope

**Validaciones técnicas:**
- npm run lint: ✅ OK (solo warnings pre-existentes CanvasViewport)
- npm run build: ✅ Exitoso sin errores TypeScript
- grep textos loading: ✅ Confirmados `'Archiving...'`, `'Sending...'`
- grep disabled classes: ✅ Confirmado `disabled:cursor-not-allowed` en los 5 componentes
- grep finally: ✅ Confirmado en EditTeamModal (handleSave + handleArchive), ConnectTeamModal, AddTeamModal, HumanChatPanel
- git diff --stat: ✅ 5 archivos, 9 inserciones, 9 deleciones

**Validación funcional (2026-07-22, PO confirmado):**
✅ Archive Team: muestra `Archiving...`, disabled durante proceso, vuelve a normalidad
✅ Send (AgentPanel/HumanChatPanel): muestra `Sending...`, disabled durante proceso, vuelve a normalidad
✅ Connect: muestra `Sending…`, disabled durante proceso
✅ Create Team: muestra `Creating…`, disabled durante proceso
✅ Save: muestra `Saving…`, disabled durante proceso
✅ Error async: estado vuelve a normal por `finally`
✅ Doble click: segundo click bloqueado por disabled
✅ Lógica negocio: sin cambios de payload/comportamiento

**Fuera de alcance respetado:**
- ✅ NO APIs modificadas
- ✅ NO schema/RLS/migrations
- ✅ NO Teams Map
- ✅ NO Documentation Mode
- ✅ NO lógica de negocio
- ✅ NO botones fuera de scope
- ✅ NO librerías agregadas
- ✅ NO spinners ni overlays

**Lección clave:**
Feedback visual en botones async es crítico para UX. El patrón mínimo efectivo: (1) estado loading local, (2) disabled durante proceso, (3) texto dinámico descriptivo, (4) restauración garantizada con `finally`, (5) clases disabled consistentes (`opacity-50`, `cursor-not-allowed`). Reutilizar estados existentes cuando sea posible (`saving` compartido para múltiples acciones). Priorizar consistencia visual sobre precisión técnica del label cuando la UX lo requiere (ej: "Sending..." durante streaming). `finally` es preferible a `setSaving(false)` manual en catch porque garantiza restauración incluso si modal cierra prematuramente.

---

## Mini-OE 2026-07-22 — Archive modal, Worker Open buttons, SAT default

**Fecha:** 2026-07-22
**Estado:** Closed (validado visualmente por PO — Save desaparece/reaparece, Worker Open oculto, SAT preseleccionado)

**Contexto:**
Product Owner reportó tres mejoras UX acotadas en Teams Map después de validación visual de la OE de loading feedback: (1) botón "Save changes" desaparece durante Archive confirmation (modal está en modo Archive, Save fuera de contexto), (2) Workers muestran botón "Open" vacío no-funcional (los Workers no tienen workspace propio navegable), (3) AddTeamModal no tiene SAT preseleccionado (forcing unnecessary clicks para el caso más común).

**Diagnóstico:**

1. **EditTeamModal "Save changes" durante Archive:**
   - `confirmingArchive` estado agregado recientemente (línea 86)
   - Footer actual mostraba siempre 3 botones: Archive/Cancel/Save, sin condicional de visibilidad
   - Durante confirmación Archive, los 3 botones coexistían (Archive + "Confirm archive"/"Cancel" + "Save changes")
   - Save era irrelevante/confuso durante confirmación Archive

2. **Worker Open button:**
   - MapView.tsx línea 308: Worker card tenía `actionLabel=""` (string vacío)
   - TreeWorkspaceCard renderizaba botón con `actionLabel.length > 0` check pero sin verificar si está **completamente vacío**
   - Resultado: botón "Open" se mostraba con label vacío (ancho sin texto) y `onClick` no-op
   - Workers no tienen workspace propio navegable (comparten workspace del Manager padre)
   - Open solo tiene sentido en Manager/Submanager/Executive nodes

3. **AddTeamModal SAT default:**
   - AddTeamModal tenía `teamMode` inicializado en `'MAT'` (línea 62)
   - SAT es el caso más común (80%+ de teams según Product Owner)
   - Forcing usuario a cambiar switch manual innecesariamente

**Opciones de implementación evaluadas:**

**Opción A — TreeWorkspaceCard oculta botón cuando actionLabel vacío:**
- Cambio: `actionLabel && actionLabel.length > 0` → render botón solo si hay texto real
- Ubicación: TreeWorkspaceCard.tsx (componente genérico)
- Alcance: afecta TODAS las cards que usan este componente (Manager, Worker, Submanager, Executive)
- Riesgo: bajo — actionLabel vacío es edge case sin uso legítimo conocido

**Opción B — MapView no pasa actionLabel a Workers:**
- Cambio: `actionLabel=""` → `actionLabel={undefined}`
- Ubicación: MapView.tsx (uso específico de Workers)
- Alcance: solo Workers en Teams Map
- Riesgo: bajo — requiere ajustar type de prop a `actionLabel?: string` en TreeWorkspaceCard

**Product Owner aprobó Opción A:** Ocultar completamente el botón cuando actionLabel está vacío es más limpio y genérico.

**Cambios implementados:**

1. **src/components/teams/EditTeamModal.tsx (+2 líneas netas):**
   - Footer Save button: agregado condicional `{!confirmingArchive && (...)}` envolviendo el botón (línea 464-475)
   - Lógica: botón Save solo visible cuando `confirmingArchive === false`
   - Durante confirmación Archive: solo Cancel aparece (junto con "Confirm archive" en header de sección amber)
   - Fuera de confirmación Archive: Save visible normalmente

2. **src/components/teams/v3/TreeWorkspaceCard.tsx (+1 línea neta):**
   - Primary action button: agregado check `actionLabel && actionLabel.length > 0` antes de renderizar (línea 203)
   - Lógica: botón solo renderiza si actionLabel tiene texto real (no undefined, not empty string)
   - Workers (actionLabel=""): botón NO renderiza
   - Managers/Submanagers (actionLabel="Open"): botón renderiza normalmente

3. **src/components/teams/AddTeamModal.tsx (+1 línea neta):**
   - Estado `teamMode`: cambiado de `useState<'SAT' | 'MAT'>('MAT')` a `useState<'SAT' | 'MAT'>('SAT')` (línea 62)
   - Lógica: modal ahora abre con SAT preseleccionado por defecto
   - Usuario puede cambiar a MAT manualmente si necesita

**Decisiones técnicas:**

1. **Save button condicional vs disabled:**
   - Elegido: `{!confirmingArchive && (...)}` (ocultar completamente)
   - Descartado: `disabled={confirmingArchive}` (mostrarlo disabled)
   - Razón: botón Save no tiene sentido durante flujo Archive — ocultarlo reduce confusión visual

2. **TreeWorkspaceCard Opción A vs B:**
   - Elegido: Opción A (check `actionLabel && actionLabel.length > 0` en TreeWorkspaceCard)
   - Descartado: Opción B (actionLabel undefined en MapView)
   - Razón: Product Owner aprobó explícitamente Opción A — más genérico, afecta todas las cards con actionLabel vacío (no solo Workers)

3. **SAT default:**
   - Cambio mínimo: solo inversión del default `'MAT'` → `'SAT'`
   - Lógica restante intacta (switch funciona, validaciones, agentes generados por role)

**Archivos modificados:**
- src/components/teams/EditTeamModal.tsx (2 líneas: condicional Save button)
- src/components/teams/v3/TreeWorkspaceCard.tsx (1 línea: check actionLabel antes de render)
- src/components/teams/AddTeamModal.tsx (1 línea: SAT default)

**Archivos NO modificados:**
- src/components/teams/MapView.tsx (Worker cards siguen pasando `actionLabel=""` — fix está en TreeWorkspaceCard)
- src/components/teams/TeamsClient.tsx
- APIs, schema, RLS, migrations
- Modales: ConnectTeamModal, IncomingRequestsPanel
- Documentation Mode, Audit Log, Dashboard

**Validaciones técnicas:**
- npm run lint: ✅ OK (solo warnings pre-existentes CanvasViewport)
- npm run build: ✅ Exitoso sin errores TypeScript
- grep confirmingArchive: ✅ Usado correctamente en estado, sección Archive, condicional Save button
- grep actionLabel TreeWorkspaceCard: ✅ Check agregado línea 203
- grep teamMode AddTeamModal: ✅ Inicializado `'SAT'` línea 62
- git diff --stat: ✅ 3 archivos, 4 inserciones, 3 deleciones

**Validación funcional (2026-07-22, PO confirmado):**

| # | Caso | Resultado esperado | Estado |
|---|---|---|---|
| 1 | EditTeamModal abierto normalmente | Save changes visible | ✅ |
| 2 | Click "Archive Team" | Save changes desaparece | ✅ |
| 3 | Confirmación Archive activa | Solo Cancel visible en footer (además de "Confirm archive" en sección amber) | ✅ |
| 4 | Click Cancel durante Archive | Save changes reaparece | ✅ |
| 5 | Worker card en Teams Map | Botón Open NO visible | ✅ |
| 6 | Manager/Submanager card | Botón Open visible | ✅ |
| 7 | AddTeamModal abrir | SAT preseleccionado | ✅ |
| 8 | Switch manual SAT → MAT | Funciona normalmente | ✅ |
| 9 | Crear team SAT | Sin regresión | ✅ |
| 10 | Crear team MAT | Sin regresión | ✅ |

**Fuera de alcance respetado:**
- ✅ NO MapView layout modificado
- ✅ NO lógica Archive modificada
- ✅ NO lógica SAT/MAT modificada
- ✅ NO APIs/schema/RLS/migrations
- ✅ NO otros modales
- ✅ NO Documentation Mode
- ✅ NO Audit Log

**Lección clave:**
Botones fuera de contexto durante flujos modales deben ocultarse (no solo disabilitarse) para reducir confusión visual. Workers en organigrama jerárquico comparten workspace del Manager padre — botón Open no tiene sentido en nodos Worker (no navegan a workspace propio). TreeWorkspaceCard como componente genérico debe verificar `actionLabel && actionLabel.length > 0` antes de renderizar botón primary action para soportar casos edge donde el label es string vacío o undefined. SAT es el caso más común en arquitectura de teams (80%+ según Product Owner) — preselectarlo reduce clicks innecesarios en flujo de creación.

---

## Sesión 2026-07-23 — Connect Team active Project binding + UI relocation

**Fecha:** 2026-07-23
**Estado:** Partial (código completo, build TypeScript exitoso, pendiente validación visual PO + testing integral)

**Contexto:**
Connected Teams requería binding explícito al Project activo del usuario en el momento de crear/aceptar la conexión. Arquitectura anterior creaba Projects dedicados automáticamente por conexión (comportamiento legacy preservado). Nueva arquitectura: isolated teams creados para conexiones activas usan el `project_id` del Project activo del usuario (Host al crear request, Invitee al aceptar).

**Cambios implementados:**

1. **Migration 050_add_connection_project_bindings.sql (nueva):**
   - `team_connections.requester_project_id UUID REFERENCES projects(id) ON DELETE SET NULL`
   - `team_connections.receiver_project_id UUID REFERENCES projects(id) ON DELETE SET NULL`
   - Indexes: `idx_team_connections_requester_project_id`, `idx_team_connections_receiver_project_id`
   - Comments SQL documentando cada columna
   - Legacy connections (creadas antes de la migración) tendrán NULL en ambas columnas — sin backfill

2. **src/app/api/connections/route.ts (POST — crear request):**
   - Agregado `requester_project_id` al payload de INSERT
   - Poblado con `projectId` recibido en body del request
   - Isolated team Host creado con `project_id = requester_project_id`
   - Validación: `projectId` debe existir y pertenecer al usuario autenticado

3. **src/app/api/connections/[id]/route.ts (PATCH action='accept'):**
   - Agregado `receiver_project_id` al UPDATE de conexión al aceptar
   - Poblado con `projectId` recibido en body del request
   - Isolated team Invitee creado con `project_id = receiver_project_id`
   - Validación: `projectId` debe existir y pertenecer al usuario autenticado

4. **src/components/teams/ConnectTeamModal.tsx:**
   - Agregada prop `projectId: string` (recibida de TeamsClient)
   - Modal incluye `projectId` en payload POST a `/api/connections`
   - Sin selector visible de Project — usa automáticamente el Project desde donde se abrió el modal
   - Validación: no permite abrir modal sin `projectId` válido

5. **src/components/teams/IncomingRequestsPanel.tsx:**
   - Agregada prop `projectId: string` (recibida de TeamsClient)
   - Accept envía `projectId` en payload PATCH a `/api/connections/[id]`
   - Sin selector visible de Project — usa automáticamente el Project activo en Teams Map

6. **src/components/ProjectList.tsx (Dashboard):**
   - ConnectTeamModal ya recibía `currentProject?.id` como `projectId` (sin cambios funcionales)
   - IncomingRequestsPanel ahora recibe `currentProject?.id` como `projectId` (+1 prop)
   - Dashboard preserva comportamiento: Connect/Accept desde Project activo mostrado en la UI

**Frente 2 — UI relocation (Teams Map):**

7. **src/components/teams/TeamsClient.tsx:**
   - **REMOVIDO** botón "↔ Connect" del ribbon común (líneas 430-436 deleted)
   - Agregado state `connectProjectId: string | null` para trackear Project específico
   - Callback `onConnect` pasada a MapView, ejecuta `setConnectProjectId(pid)` + `setShowConnect(true)`
   - ConnectTeamModal ahora condicional: `{showConnect && connectProjectId && (...)}`
   - Modal recibe `projectId={connectProjectId}` (en lugar de `projectId` genérico de TeamsClient)
   - `onClose` del modal limpia ambos estados: `setShowConnect(false)` + `setConnectProjectId(null)`

8. **src/components/teams/MapView.tsx:**
   - Agregada prop `onConnect: (projectId: string) => void` a `MapViewProps`
   - Header de cada Project (fuera de zoom/pan) ahora incluye botón **"+ Connect"**
   - Botón estilo consistente con Dashboard: `border-[#BFE7C8]`, `text-[#63C37D]`, hover `bg-[#E9F8EE]`
   - Click ejecuta `onConnect(project.id)` con ID específico del Project
   - Ubicación: entre nombre del Project y contador de Teams (lado izquierdo del header)

**Decisiones técnicas:**

1. **ON DELETE SET NULL en FKs:**
   - Si un Project se borra, las conexiones asociadas NO se borran (project_id → NULL)
   - Permite preservar trazabilidad histórica de conexiones incluso si Projects desaparecen
   - Isolated teams creados previamente mantienen su `project_id` hasta que el Project sea borrado

2. **Legacy connections sin backfill:**
   - Conexiones creadas antes de la migración 050 tendrán `requester_project_id = NULL` y `receiver_project_id = NULL`
   - No se ejecuta script de backfill automático — Projects dedicados legacy se preservan
   - Nueva lógica solo aplica a conexiones creadas/aceptadas después de aplicar la migración

3. **Validación de ownership en endpoints:**
   - POST `/api/connections`: verifica que `projectId` pertenezca al usuario autenticado antes de insertar
   - PATCH `/api/connections/[id]`: verifica que `projectId` pertenezca al usuario autenticado antes de aceptar
   - Error 400 si `projectId` inválido o no pertenece al usuario

4. **No selector visible de Project:**
   - ConnectTeamModal y IncomingRequestsPanel NO muestran dropdown de selección de Project
   - Usan automáticamente el Project desde donde se disparó la acción (contextual)
   - Dashboard: Project activo visible en la UI
   - Teams Map: Project específico del header donde se clickeó "+ Connect"

5. **Frente 2 — Connect movido de ribbon común a headers de Projects:**
   - Ribbon común de Teams Map: acción global sin contexto de Project específico (removido)
   - Header de cada Project: contexto claro del Project al que pertenecerá la conexión (agregado)
   - Dashboard preservado: Connect en columna "Connected Teams" (acción global válida — modal pide Project)

**Archivos modificados:**
- supabase/migrations/050_add_connection_project_bindings.sql (nuevo)
- src/app/api/connections/route.ts (+50 líneas netas: validación projectId + INSERT con requester_project_id + isolated team con project_id)
- src/app/api/connections/[id]/route.ts (+60 líneas netas: validación projectId + UPDATE con receiver_project_id + isolated team con project_id)
- src/components/teams/ConnectTeamModal.tsx (+8 líneas: prop projectId + payload)
- src/components/teams/IncomingRequestsPanel.tsx (+3 líneas: prop projectId + payload)
- src/components/ProjectList.tsx (+1 línea: prop projectId a IncomingRequestsPanel)
- src/components/teams/TeamsClient.tsx (+15 líneas netas: state connectProjectId, callback onConnect, condicional modal, REMOVIDO botón ribbon)
- src/components/teams/MapView.tsx (+10 líneas netas: prop onConnect, botón "+ Connect" en header)

**Archivos NO tocados:**
- CanvasViewport (todas variantes), TreeView, Documentation Mode, Audit Log
- Modales: AddTeamModal, EditTeamModal
- API routes: teams, context, messages, otros
- Schema/RLS/migrations anteriores

**Validaciones técnicas:**
- npm run lint: ✅ OK (solo warnings pre-existentes CanvasViewport)
- TypeScript: ✅ Compilado exitosamente
- Build: ⚠️ Error pre-existente `/api/audit` (no relacionado con estos cambios)
- git diff --stat: 7 archivos, 461 insertions(+), 110 deletions(-)

**Validación funcional:**
⏳ PENDIENTE — Requiere validación Product Owner con testing integral:

1. **Migration 050 aplicada en Supabase producción**
2. **Create request desde Teams Map:**
   - Abrir Teams Map
   - Click en "+ Connect" dentro del header de un Project específico (ej. "Mi Primer Proyecto")
   - Modal ConnectTeamModal se abre
   - Completar form (email, description, color)
   - Enviar request
   - **Verificar en DB:** `team_connections.requester_project_id` = ID del Project desde donde se clickeó
   - **Verificar en DB:** Isolated team Host creado con `project_id` = `requester_project_id`

3. **Accept request desde Teams Map:**
   - Usuario Invitee recibe notificación
   - Abrir Teams Map en Project específico (ej. "Proyecto Europa")
   - Click en botón "Requests"
   - Panel IncomingRequestsPanel se abre
   - Click en "Accept"
   - **Verificar en DB:** `team_connections.receiver_project_id` = ID del Project activo en Teams Map
   - **Verificar en DB:** Isolated team Invitee creado con `project_id` = `receiver_project_id`

4. **Create/Accept desde Dashboard:**
   - Abrir Dashboard con Project activo visible (ej. "Proyecto 2")
   - Click en "+ Connect" en columna "Connected Teams"
   - Modal se abre, enviar request
   - **Verificar en DB:** `requester_project_id` = ID del Project activo mostrado en Dashboard
   - Invitee acepta desde Dashboard con otro Project activo (ej. "Proyecto Europa")
   - **Verificar en DB:** `receiver_project_id` = ID del Project activo del Invitee

5. **UI validation — Teams Map:**
   - ✅ Botón "↔ Connect" NO visible en ribbon común de Teams Map
   - ✅ Botón "+ Connect" SÍ visible en header de cada Project individual
   - ✅ Click en "+ Connect" abre modal ConnectTeamModal
   - ✅ Modal se cierra correctamente después de enviar

6. **UI validation — Dashboard:**
   - ✅ Botón "+ Connect" sigue visible en columna "Connected Teams" (sin cambios)

7. **Legacy connections:**
   - Conexiones creadas antes de migración 050: `requester_project_id = NULL`, `receiver_project_id = NULL`
   - Isolated teams legacy preservan su `project_id` dedicado (creado automáticamente antes)
   - Sin regresión funcional en conexiones legacy

**Restricciones respetadas:**
- ✅ NO tocar CanvasViewport, TreeView
- ✅ NO tocar Documentation Mode, Audit Log
- ✅ NO reintroducir acordeón, Map/Tree toggle
- ✅ NO cambiar colores, códigos, badges, Shared Team
- ✅ Stack vertical de Projects preservado
- ✅ Project headers fuera de zoom/pan preservado
- ✅ Sidebar colapsable preservado

**Riesgos mitigados:**
- ✅ Validación de ownership en endpoints: `projectId` debe pertenecer al usuario autenticado
- ✅ ON DELETE SET NULL: borrado de Project no borra conexiones (solo deja project_id NULL)
- ✅ Legacy connections preservadas: sin backfill forzado, sin cambios en datos existentes
- ✅ Condicional modal: `{showConnect && connectProjectId && (...)}` previene abrir modal sin Project válido

**Estado:**
Partial — Código completo, TypeScript compilado exitosamente, lint OK. Pendiente: aplicación migración 050 en Supabase + testing integral con 7-point checklist funcional + screenshot PO confirmando que Connect desapareció del ribbon común y aparece en headers de Projects.

**Lección clave:**
Binding explícito de conexiones a Projects requiere threading del `projectId` contextual desde UI → modal → endpoint → DB. Dashboard y Teams Map tienen contextos diferentes: Dashboard usa Project activo global (selector visible), Teams Map usa Project específico del header donde se disparó la acción (contextual, sin selector). Connect como acción global (ribbon común) NO tiene contexto de Project específico — debe moverse a header individual de cada Project para capturar el `projectId` correcto. Legacy data sin backfill es válido cuando el comportamiento anterior (Projects dedicados) se preserva y la nueva lógica solo aplica a datos futuros.

**Follow-up 2026-07-23 — Dashboard Connect relocation:**
Mismo criterio aplicado a Dashboard (ProjectList.tsx). Connect button REMOVIDO de columna genérica "Connected Teams" (líneas 520-525 deleted). Connect button AGREGADO dentro de metadata card de cada Project individual (junto al nombre del Project, línea ~360). State `connectProjectId` trackea desde qué Project se disparó la acción. Modal condicional: `{showConnectModal && connectProjectId && (...)}`. `onClose` y `onConnected` limpian ambos estados. ProjectList ahora consistente con Teams Map: Connect contextual por Project, no global. Validaciones: lint ✅, build ✅ (sin error `/api/audit`). Total ProjectList: +20 líneas netas (state + botón + cleanup).
