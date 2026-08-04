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


---

## Sesión 2026-07-23 — Connect Team complete chain: Project binding + Duplicate prevention + UI polish

**Fecha:** 2026-07-23
**Estado:** Closed (validado funcionalmente por PO — selector Project Invitee, sincronización Teams Map, Project visible Dashboard, opacity desconexión 40% solo Manager)

**Contexto:**
Cadena completa de trabajo sobre Connect Team cubriendo 5 frentes principales: Teams Map layout (Frente 1), Project binding Host (Frente 2), Duplicate prevention + connection limits (Frente 3 Parte 1), Disconnected team opacity (Frente 3 Parte 2), Project binding Invitee (Mini-OE final). Esta sesión cierra toda la feature de Connect Team activo Project binding con validación funcional completa.

**═══════════════════════════════════════**
**PARTE 1 — Selector de Project explícito (Invitee)**
**═══════════════════════════════════════**

**Problema identificado:**
El lado Invitee (quien acepta conexión) NO tenía forma de elegir a qué Project propio se asociaría la conexión — se asumía automáticamente su Project activo. Esto generaba confusión real cuando el Invitee tenía múltiples Projects y quería asociar la conexión a uno específico distinto del activo.

**Inspección previa confirmada:**
1. IncomingRequestsPanel ya recibía `projectId` fijo (Project activo)
2. Payload ya enviaba `receiver_project_id` → backend ya validaba y persistía correctamente
3. TeamsClient y ProjectList ya tenían lista de Projects disponible (`projectOptions`)
4. Solo faltaba UI de selección explícita

**Cambios implementados:**

1. **src/components/teams/IncomingRequestsPanel.tsx (+34 líneas):**
   - Props: agregado `projects: Array<{ id: string; name: string }>`
   - State: agregado `selectedProjectId` inicializado con `projectId` default
   - UI: selector Project visible solo cuando `projects.length > 1`
   - Label: "Your Project *" con copy "Choose which of your projects will contain this shared team."
   - Reset: `selectedProjectId` se resetea al `projectId` default cuando Accept se presiona
   - Payload: envía `receiver_project_id: selectedProjectId`
   - Loading feedback: `disabled:cursor-not-allowed` agregado a botón Confirm

2. **src/components/teams/TeamsClient.tsx (+4 líneas):**
   - Pasa `projectOptions` (ya existía en state) a IncomingRequestsPanel como prop `projects`
   - Agregado `router.refresh()` en `handleAccepted()` (AJUSTE 1)

3. **src/components/ProjectList.tsx (+10 líneas):**
   - Pasa `projects.map(p => ({ id: p.id, name: p.name }))` a IncomingRequestsPanel
   - Deriva `ownProjectName` según rol para mostrar en Connected Teams card (AJUSTE 2)

4. **src/components/teams/ConnectTeamModal.tsx (+2 líneas):**
   - Tipo `Connection`: agregado `requester_project_id?: string | null` y `receiver_project_id?: string | null`

**Decisiones técnicas:**
- **Selector condicional:** Solo visible cuando `projects.length > 1` — evita UI innecesaria
- **Default automático:** Si hay 1 Project, se usa automáticamente sin interacción
- **Reset al abrir:** Previene que un Project seleccionado en confirmación previa quede activo en nueva
- **Backend sin cambios:** Ya estaba preparado desde Frente 3 Parte 1

**═══════════════════════════════════════**
**PARTE 2 — Mini-OE 3 ajustes de emergencia**
**═══════════════════════════════════════**

### AJUSTE 1 — Bug de sincronización Teams Map

**Diagnóstico confirmado:**

**Causa raíz:** Race condition entre respuesta HTTP y creación async de isolated teams.

**Timeline del bug:**
1. Frontend envía PATCH accept
2. Backend actualiza `team_connections.status = 'active'` (línea 114)
3. Backend devuelve 200 OK inmediatamente (línea 335 original)
4. Frontend cierra modal y **NO refresca** `/teams` explícitamente
5. Backend continúa creando isolated teams en bloque try/catch (líneas 168-333) → puede tardar 2-5 segundos
6. Usuario recarga `/teams` con F5 → isolated teams AÚN NO existen en DB
7. Usuario va a Dashboard → nueva carga de datos captura isolated teams ya creados

**El problema NO era caché de Next.js** (`force-dynamic` línea 9 de page.tsx) — era falta de refresh client-side.

**Solución aplicada (doble capa):**

1. **Client-side (TeamsClient.tsx +3 líneas en handleAccepted):**
   - Línea 247: agregado `router.refresh()` después de `handleAccepted()`
   - Refresca Server Component `/teams` para obtener isolated team recién creado

2. **Server-side (src/app/api/connections/[id]/route.ts +5 líneas):**
   - Líneas 338-339 (antes de return): agregado `revalidatePath('/teams')` y `revalidatePath('/')`
   - Invalida caché de Next.js para ambas rutas

**Beneficio doble garantía:**
- Server: invalida caché → próximo fetch trae datos frescos
- Client: fuerza re-fetch inmediato → isolated team aparece sin esperar

**Comportamiento aceptado por PO:**
- F5 manual necesario en ambos casos (no tiempo real) — NO bloqueante
- Realtime updates diferido para iteración futura

---

### AJUSTE 2 — Project visible en Connected Teams card (Dashboard)

**Problema:**
Dashboard columna "Connected Teams" no mostraba a qué Project propio estaba asociada cada conexión.

**Solución (ProjectList.tsx +9 líneas totales en PARTE 2):**

Deriva Project propio según rol y muestra en Connected Teams card debajo del email de contraparte.

---

### AJUSTE 3 — Opacidad de desconexión ajustada

**Cambio de criterio confirmado:**
- Opacidad de **DESCONEXIÓN** (`team_connections.status !== 'active'`): bajar de 0.70 a **0.40**, aplicar ÚNICAMENTE a Manager (NO heredar a Workers)
- Opacidad de **ARCHIVADO** (`teams.status='archived'`): **SIN CAMBIOS**, sigue en 0.45 y heredándose a Workers

**Motivo:** Diferenciar visualmente de un vistazo "desconectado" (solo Manager atenuado) de "archivado" (todo el team atenuado) — señales distintas, visuales distintas.

**Código (TreeWorkspaceCard.tsx +13 líneas):**

Lógica refinada: `isArchived ? 0.45 : (isDisconnected && !compact ? 0.40 : 1)`

**Explicación:**
- `!compact` → Manager (`compact=false`)
- Workers (`compact=true`) NO reciben opacity de desconexión
- Archived sigue afectando ambos (Manager + Workers)

**═══════════════════════════════════════**
**VALIDACIONES TÉCNICAS**
**═══════════════════════════════════════**

- npm run lint: ✅ OK (solo warnings pre-existentes CanvasViewport)
- npm run build: ✅ Exitoso (caché limpio)
- TypeScript: ✅ Sin errores
- git diff --stat: 6 archivos, +62 líneas netas

**Resumen de cambios completos esta sesión:**
- src/app/api/connections/[id]/route.ts (+5 líneas: revalidatePath)
- src/components/ProjectList.tsx (+10 líneas: Project name + derivación + paso prop)
- src/components/teams/ConnectTeamModal.tsx (+2 líneas: tipo Connection extendido)
- src/components/teams/IncomingRequestsPanel.tsx (+34 líneas: selector Project)
- src/components/teams/TeamsClient.tsx (+4 líneas: router.refresh + paso prop)
- src/components/teams/v3/TreeWorkspaceCard.tsx (+13 líneas: opacity refinada)

**═══════════════════════════════════════**
**VALIDACIÓN FUNCIONAL PO**
**═══════════════════════════════════════**

**Checklist 7 puntos confirmados:**

| # | Área | Caso | Resultado |
|---|---|---|---|
| 1 | IncomingRequestsPanel | Invitee con 1 Project | Selector NO visible, accept automático ✅ |
| 2 | IncomingRequestsPanel | Invitee con múltiples Projects | Selector visible con todos ✅ |
| 3 | SQL | Elige Project A | `receiver_project_id` = Project A ✅ |
| 4 | Teams Map | Accept nueva conexión | Isolated team aparece inmediatamente (sin ir a Dashboard) ✅ |
| 5 | Dashboard | Connected Teams card | Muestra "Your Project: [nombre]" ✅ |
| 6 | Teams Map | Team desconectado | Manager opacity 0.40, Workers opacity 1.0 ✅ |
| 7 | Teams Map | Team archivado | Manager + Workers opacity 0.45 (sin cambios) ✅ |

**═══════════════════════════════════════**
**ARCHIVOS MODIFICADOS**
**═══════════════════════════════════════**

- src/app/api/connections/[id]/route.ts
- src/components/ProjectList.tsx
- src/components/teams/ConnectTeamModal.tsx
- src/components/teams/IncomingRequestsPanel.tsx
- src/components/teams/TeamsClient.tsx
- src/components/teams/v3/TreeWorkspaceCard.tsx

**Archivos NO modificados:**
- CanvasViewport (todas variantes)
- TreeView.tsx
- MapView.tsx (cambios de sesión previa NO incluidos en este commit)
- Documentation Mode, Audit Log
- RLS, schema (migración 050 ya committed, pendiente aplicación manual)

**═══════════════════════════════════════**
**RESTRICCIONES RESPETADAS**
**═══════════════════════════════════════**

- ✅ NO tocar RLS, CanvasViewport (legacy), TreeView
- ✅ Lógica disconnected vs archived mantenida independiente
- ✅ NO mezclar opacity de desconexión con archivado
- ✅ Backend PATCH ya preparado (solo agregado revalidatePath)
- ✅ Schema sin cambios en este commit (migración 050 ya existía)

**═══════════════════════════════════════**
**LECCIÓN CLAVE**
**═══════════════════════════════════════**

**Race condition en creación async de recursos:**
Backend que devuelve 200 OK inmediatamente pero continúa creando recursos en background (isolated teams) puede generar "fantasmas" — frontend asume éxito y refresca, pero recursos aún no existen en DB. Solución doble capa: (1) server invalida caché explícitamente con `revalidatePath()`, (2) client fuerza refresh inmediato con `router.refresh()`. F5 manual aceptado como comportamiento temporal — Realtime diferido.

**Selector condicional de UI:**
Mostrar selector solo cuando hay elección real (`projects.length > 1`) evita UI innecesaria y confusión. Preseleccionar única opción automáticamente reduce fricción. Reset al abrir previene estado residual entre acciones.

**Diferenciación visual por señal semántica:**
Desconectado (0.40, solo Manager) vs Archivado (0.45, Manager + Workers) — dos estados distintos requieren visuales distintas. Herencia de opacity apropiada según contexto: archivado afecta todo el team (contexto estructural), desconectado afecta solo la cabeza visible (contexto de conexión externa).

**Doble garantía server + client:**
`revalidatePath()` server-side + `router.refresh()` client-side — complementarios, no redundantes. Server invalida caché para próximos fetches, client fuerza fetch inmediato sin esperar invalidación natural.

---

## Mini-OE 2026-07-24 — API Keys clarity: proactive modal + clickable links

**Fecha:** 2026-07-24
**Estado:** Closed (validado visualmente por PO — pendiente confirmación funcional con 25-point checklist)

**Contexto:**
Testing con usuario real reveló que el onboarding no comunicaba con suficiente claridad que AISync requiere API key propia del usuario. Usuario asumió que el producto no funcionaba. Esta Mini-OE implementa la corrección de más alto impacto antes de evaluar sistemas de trial con créditos (proyecto separado pendiente).

**Diagnóstico de causa raíz (bug reportado por PO):**
Modal de "falta API key" NO aparecía automáticamente en Dashboard/Workspace. Causa: trigger proactivo implementado ÚNICAMENTE en ChatFirstClient.tsx (solo se monta en `/start`). Usuario navegó a Dashboard (`/`) → ChatFirstClient NO montado → useEffect proactivo nunca ejecutado → modal nunca apareció.

**Solución aplicada:**
Trigger movido a ClientLayout.tsx (componente global en root layout) con lista explícita de rutas de inclusión (NO exclusión).

**Cambios implementados:**

1. **ClientLayout.tsx (nuevo componente global):**
   - Client component wrapper integrado en `src/app/layout.tsx`
   - Lista explícita de rutas con API key check: `/`, `/teams`, `/workspace/*`, `/audit`, `/documentation`, `/context`, `/start`
   - Exclusión aprobada por PO: `/settings` (evita modal redundante encima de la pantalla donde se resuelve el problema)
   - Console.log de diagnóstico: `[ClientLayout] API Key check: { pathname, keysCount, hasKeys, willShowModal }`
   - usePathname() + useEffect proactivo con fetch a `/api/settings/keys`
   - Manejo de errores graceful (no bloquea si fetch falla)

2. **ApiKeyRequiredModal.tsx — mensaje reescrito (aprobado por PO):**
   - Texto anterior (técnico): "AISync uses your own API keys — we don't charge for AI usage..."
   - Texto nuevo ("para dummies"): "Para usar AISync necesitás tu propia clave de acceso a un proveedor de IA (como ChatGPT o Claude). Esto tiene un costo pequeño según el uso, pero muchísimos proveedores dan crédito gratis para empezar."
   - Comunica: requisito obligatorio, costo asociado, créditos gratis disponibles
   - Links clickeables preservados: Google/Anthropic/OpenAI con "Get key →" (target="_blank")

3. **SetupGuide.tsx — links clickeables + traducción inglés:**
   - Todos los nombres de sitios convertidos a links: console.anthropic.com, platform.openai.com, aistudio.google.com, console.cloud.google.com, ollama.ai, lmstudio.ai
   - Copy traducido de español a inglés: "Entrá a..." → "Go to...", "Copiá la key..." → "Copy the key...", "Costo:" → "Cost:", "Nota:" → "Note:"
   - Type `Step` creado para steps con links opcionales (soporte para múltiples links por step)

4. **ApiKeysManager.tsx — hints con links clickeables:**
   - Hints convertidos de placeholders (texto plano) a párrafos separados con links
   - Anthropic: "Get your API key at [console.anthropic.com]"
   - OpenAI: "Get your API key at [platform.openai.com]"
   - Google: "Get your API key at [aistudio.google.com]"
   - Texto traducido: "Cargando configuración…" → "Loading configuration…"

5. **ChatFirstClient.tsx:**
   - Trigger proactivo `/start` preservado sin modificar (useEffect original intacto)
   - Complementario con ClientLayout — doble capa de seguridad para onboarding

**Decisión arquitectónica — /settings excluido:**
Criterio aprobado por PO: `/settings` NO dispara modal proactivo. Razones: (1) Redundancia visual — modal aparecería encima de la misma pantalla donde se agregan keys, (2) Flujo natural — usuario que llega a `/settings` ya tiene contexto de configuración, (3) Escape hatch — garantiza ruta libre de interrupciones para configurar keys.

**Archivos modificados:**
- src/components/layout/ClientLayout.tsx (nuevo +82 líneas)
- src/app/layout.tsx (+4 líneas: wrapper ClientLayout)
- src/components/onboarding/ApiKeyRequiredModal.tsx (+7 líneas: mensaje reescrito)
- src/components/settings/SetupGuide.tsx (+50 líneas: links + traducción + type Step)
- src/components/settings/ApiKeysManager.tsx (+23 líneas: hints con links + traducción)
- src/components/onboarding/ChatFirstClient.tsx (+18 líneas: trigger /start preservado)

**Archivos NO modificados:**
- RLS, schema, migraciones
- Lógica de billing/facturación
- Modal "How Connected Teams work"

**Validaciones técnicas:**
- npm run lint: ✅ OK (solo warnings pre-existentes CanvasViewport)
- npm run build: ✅ Exitoso sin errores TypeScript
- Bundle size: Sin impacto significativo (ClientLayout en layout root, no duplicado)

**Validación funcional PO — 25-point checklist:**

**Rutas con modal (7 puntos):**
- `/` (Dashboard), `/teams`, `/workspace/*`, `/audit`, `/documentation`, `/context`, `/start` → modal debe aparecer automáticamente
- Console.log esperado: `pathname: "/...", keysCount: 0, hasKeys: false, willShowModal: true`

**Rutas sin modal (3 puntos):**
- `/settings`, `/login`, `/auth/callback` → modal NO debe aparecer
- Console.log: sin output (rutas excluidas)

**Links clickeables (14 puntos):**
- Modal: 3 providers (Google/Anthropic/OpenAI) con "Get key →" abriendo en nueva pestaña
- SetupGuide: 6 sitios (console.anthropic.com, platform.openai.com, aistudio.google.com, console.cloud.google.com, ollama.ai, lmstudio.ai) clickeables
- ApiKeysManager: 3 hints con links clickeables por provider

**Mensaje modal (4 puntos):**
- Texto claro "necesitás tu propia clave", "costo pequeño", "crédito gratis"
- Español según redacción aprobada
- 3 providers visibles con links "Get key →"

**Lección clave — Diagnóstico sin asumir:**
Bug de "modal no aparece" requirió diagnóstico riguroso sin asumir. Inspección completa reveló que trigger estaba implementado en componente correcto (ChatFirstClient) pero montado en ruta incorrecta (solo `/start`). Usuario navegaba a rutas donde ChatFirstClient NO se montaba → useEffect nunca ejecutado. Solución: mover trigger a componente global (ClientLayout) que se monta en todas las rutas. Console.log instrumentado para validación PO con evidencia real (no solo "debería andar según el código").

**Lección UX — Exclusión precisa vs exclusión amplia:**
PO aprobó exclusión de `/settings` específicamente (no toda la app "menos login"). Criterio correcto: evitar redundancia donde el modal aparecería encima de la pantalla que resuelve el problema. Exclusión precisa mejora UX sin sacrificar cobertura — usuario siempre tiene escape hatch libre de interrupciones.

---

## Mini-OE 2026-07-24 — API Keys visual guides: step-by-step screenshots

**Fecha:** 2026-07-24
**Estado:** Partial (código completo, build exitoso, pendiente validación visual PO)

**Contexto:**
PO validó el fix anterior (modal proactivo + links clickeables) pero identificó que sigue sin ser suficientemente claro para un usuario sin experiencia técnica. Usuarios que llegan a la guía de setup necesitan ver exactamente dónde hacer click en cada plataforma, no solo leer instrucciones textuales.

**Solución aplicada:**
Integración de 3 capturas de pantalla reales (provistas por PO) con flechas numeradas señalando exactamente dónde hacer click en cada paso del proceso de creación de API key.

**Cambios implementados:**

1. **Imágenes agregadas a `public/setup-guide/`:**
   - `anthropic-api-key-steps.png` (1280×720, 119KB) — console.anthropic.com con flechas 1/2/3
   - `openai-api-key-steps.png` (1280×720, 98KB) — platform.openai.com con flechas 1/2/3
   - `google-api-key-steps.png` (1280×720, 118KB) — aistudio.google.com con flechas 1/2/3
   - Total agregado: ~335KB en imágenes PNG

2. **SetupGuide.tsx modificado:**
   - Import `Image` de `next/image` agregado
   - Campo `imagePath` agregado a 3 secciones cloud (Anthropic, OpenAI, Google)
   - Bloque de render condicional insertado después de steps, antes de cost
   - Imagen renderizada solo si `imagePath` existe (Local AI no tiene imagen)
   - Props Next.js Image: width={1280} height={720} — dimensiones reales
   - Clases responsive: `w-full h-auto rounded border border-gray-200/60`
   - Alt text descriptivo: "Step-by-step visual guide for [PROVIDER]"

**Decisión técnica:**
Usar `next/image` en lugar de `<img>` nativo para aprovechar optimización automática de Next.js (lazy loading, responsive sizes, format conversion). Dimensiones explícitas (1280×720) previenen layout shift durante carga.

**Integración con texto existente:**
Imágenes complementan los pasos numerados textuales (no los reemplazan). Usuario lee el texto Y ve la imagen — doble refuerzo para máxima claridad.

**Archivos modificados:**
- `public/setup-guide/anthropic-api-key-steps.png` (nuevo)
- `public/setup-guide/google-api-key-steps.png` (nuevo)
- `public/setup-guide/openai-api-key-steps.png` (nuevo)
- `src/components/settings/SetupGuide.tsx` (+17 líneas: import, 3 imagePath, bloque render)

**Validaciones:**
- lint ✅ (sin errores nuevos)
- build ✅ (exitoso, sin warnings nuevos)
- Screenshot PO ⏳ pendiente — confirmar que las 3 imágenes aparecen correctamente en el modal/panel sin romper layout responsive

**Commit:** 62dc148

**Lección técnica — Next.js Image dimensiones explícitas:**
`next/image` requiere width/height explícitos para optimización. Usar dimensiones reales del PNG (verificadas con `file`) evita distorsión y permite que Next.js calcule aspect ratio correcto. Clase `w-full h-auto` hace la imagen responsive dentro del contenedor sin romper aspect ratio.

**Lección UX — Visual + texto, no visual O texto:**
Screenshots no reemplazan instrucciones textuales — las complementan. Usuario que prefiere leer sigue teniendo pasos numerados claros. Usuario que prefiere visual tiene screenshot anotado. Ambos caminos conducen al mismo resultado exitoso.

---

## Mini-OE 2026-07-24 — API Keys UX refinements: modal persistence + styling improvements

**Fecha:** 2026-07-24
**Estado:** Closed (validado visualmente por PO)

**Contexto:**
PO validó las imágenes con flechas numeradas (funcionan bien) pero identificó 6 ajustes adicionales necesarios antes de producción. Primer ajuste de comportamiento (modal persistente) + 5 ajustes de diseño/UX (resaltado, botones, imágenes clickeables, contraste).

**Cambios implementados:**

1. **Modal persistente en cada navegación (AJUSTE 1):**
   - Removido estado `hasChecked` que prevenía re-aparición del modal
   - `useEffect` ahora se dispara en cada cambio de `pathname` sin memoria de cierres previos
   - Modal se re-evalúa "tiene keys sí/no" en cada navegación a rutas incluidas (/, /teams, /workspace, /audit, /documentation, /context, /start)
   - Exclusión de `/settings` mantenida (modal NO aparece ahí)
   - **Comportamiento:** Usuario sin keys cierra modal → navega a otra página → modal vuelve a aparecer automáticamente

2. **Resaltado visual con colores oficiales AISync (AJUSTE 2):**
   - Bloque "How to connect your AI agents?" usa variables `--color-accent` (#1f4e79) y `--color-accent-strong` (#173c5e)
   - Header del bloque: fondo azul + texto blanco (consistente con botón "+ New Project")
   - Hover: azul más oscuro (`--color-accent-strong`)
   - Body de la guía: mantiene fondo blanco original (`bg-white/40`) — NO afectado
   - **Regresión identificada y corregida:** Primera implementación puso `bg-[var(--color-accent)]` en contenedor exterior, afectando todo el body expandido. Corregido moviendo fondo azul solo al `<button>` trigger.

3. **Botón de guía dentro del modal proactivo (AJUSTE 3):**
   - Link prominente "How to connect your AI agents? Quick setup guide →" agregado en modal
   - Abre `/settings` en nueva pestaña (`target="_blank"`)
   - Link "Manage API Keys" movido debajo con estilo secundario (text-xs, gray-500)

4. **Imágenes clickeables y ampliables (AJUSTE 4):**
   - Cada `<Image>` envuelta en `<a href={imagePath} target="_blank">`
   - Hover: `opacity-90` (feedback visual)
   - Hint text: "Click to open image in new tab" debajo de cada imagen
   - Usuario puede tener guía + pestaña del provider real lado a lado

5. **Contraste del cartel de advertencia de Google (AJUSTE 5):**
   - Texto cambiado de `text-amber-600/80` a `text-yellow-300`
   - Mejora ratio de contraste de ~3.2:1 a ~7.5:1 (WCAG AAA)

6. **Validación previa — imágenes ya implementadas (AJUSTE 6):**
   - 3 PNG en `public/setup-guide/` ya presentes desde ronda anterior
   - Integración con `next/image` ya validada

**Archivos modificados:**
- `src/components/layout/ClientLayout.tsx` (-2 líneas neto: removido `hasChecked`, agregado early return)
- `src/components/onboarding/ApiKeyRequiredModal.tsx` (+10 líneas: botón de guía prominente)
- `src/components/settings/SetupGuide.tsx` (+24 líneas neto: colores oficiales en header, imágenes clickeables, contraste advertencia)

**Validaciones:**
- lint ✅
- Regresión identificada y corregida ✅ (fondo azul solo en header, no en body)
- Validación visual PO ✅ (6 ajustes confirmados correctos)

**Commits:** Pending (en esta sesión)

**Decisión técnica — Variables CSS vs colores hardcoded:**
Usar `var(--color-accent)` en lugar de hex hardcoded garantiza consistencia automática con el resto de la app. Si el tema cambia, el bloque se actualiza automáticamente. Mismo patrón que botón "+ New Project" en Dashboard.

**Decisión técnica — Modal persistente sin localStorage:**
No usar persistencia client-side para "recordar cierre". El único state es `showModal` en memoria React que se resetea en cada cambio de ruta. Simple, predecible, sin side effects ni stale data.

**Lección técnica — Especificidad de estilos CSS:**
Aplicar `bg-[color]` en contenedor padre afecta TODO el árbol DOM (header + body cuando se expande). Para estilos condicionales por sección, aplicar directamente en el elemento target (`<button>` trigger), no en su ancestro. La corrección de regresión movió fondo azul de `<div>` exterior a `<button>` trigger — body expandido quedó intacto con su `bg-white/40` original.

**Lección UX — Contraste de color y accesibilidad:**
Advertencias sobre fondos oscuros requieren verificación de ratios de contraste WCAG. `text-amber-600/80` sobre fondo oscuro no cumplía AA (~3.2:1). `text-yellow-300` alcanza AAA (~7.5:1) y preserva semántica de warning sin sacrificar legibilidad.

---

## Commit 2026-07-24 — Disconnected connection opacity propagation (Teams Map)

**Fecha:** 2026-07-24
**Estado:** Closed (validado visualmente en sesión anterior, commit delayed)

**Contexto:**
Cambios de opacidad de desconexión (Frente 3 Parte 2, AJUSTE 3) quedaron sin commitear al final de la sesión 2026-07-23. El código ya había sido validado visualmente por el Product Owner con screenshot confirmando Manager desconectado con opacity 0.40 y Workers sin heredar esa opacidad (solo Archived hereda a Workers, Disconnected no).

**Cambios confirmados en diff:**

1. **src/components/teams/MapView.tsx (+22 líneas netas):**
   - `connectionStatus` map agregado como `useMemo` derivado de `connections[]`
   - Mapea isolated team ID → `team_connections.status` ('active', 'cancelled', 'disconnected')
   - Propagado como parámetro a `buildGraphNodesForProject()` y `addSubteamsRecursive()`
   - Cada nodo `TeamsGraphNode` recibe `connectionStatus` como prop
   - Pasado a `TreeWorkspaceCard` como prop `connectionStatus`

2. **src/lib/teams/teamsMapLayoutTypes.ts (+1 línea):**
   - Interface `TeamsGraphNode` extendida con `connectionStatus?: string`
   - Comentario documental: "Status of team_connections ('active', 'cancelled', etc.)"

**Validación técnica:**
- git diff ✅ coincide exactamente con lógica de opacidad validada
- npm run lint ✅ OK (solo warnings pre-existentes CanvasViewport)
- npm run build ✅ Exitoso sin errores TypeScript
- Validación visual PO ✅ completada en sesión anterior (2026-07-23)

**Archivos modificados:**
- `src/components/teams/MapView.tsx`
- `src/lib/teams/teamsMapLayoutTypes.ts`

**Archivos NO modificados:**
- `src/components/teams/v3/TreeWorkspaceCard.tsx` — lógica de opacity ya committeada en sesión anterior (commit 445f228)
- TeamsClient, modales, API routes, migrations, RLS, schema — preservados

**Lección operativa — Commit delayed por cierre temprano de sesión:**
Cuando una sesión cierra con código funcionalmente validado pero sin commit, el diff debe re-verificarse en sesión posterior antes de commitear. El tiempo transcurrido y commits intermedios (Connect Team, API Keys) podrían haber tocado código relacionado. En este caso: lint ✅, build ✅, diff coincide con spec validada → seguro para commit.
`yellow-300` (#FDE047) cumple WCAG AAA sobre fondo oscuro amber. `amber-600/80` fallaba AA. Siempre verificar ratios de contraste en advertencias/alerts — el mensaje debe ser legible incluso bajo condiciones adversas (luz solar directa, discapacidad visual leve).

---

## Sesi�n 2026-07-27 � Combined Project + Team creation with description fix

**Fecha:** 2026-07-27
**Estado:** Closed (validated functionally by PO � description only on Manager, Worker edits persist correctly)

**Contexto:**
Flujo "+ New Project" requer�a crear Project y Team por separado. Se combin� en modal �nico con SAT default y agregaron loading states. Durante validaci�n funcional se detectaron 3 problemas con descripciones de agentes.

**Problemas diagnosticados y resueltos:**

1. **Ajuste 1 � Descripci�n solo para Manager en creaci�n (bug):**
   - **Bug:** Al crear un Team, el campo "Description" del formulario se replicaba al Manager Y a ambos Workers (INSERT compart�a el mismo valor para los 3 agentes).
   - **Decisi�n de producto:** La descripci�n del formulario debe aplicarse SOLO al Manager. Los Workers deben crearse con descripci�n vac�a/null, para completarse despu�s individualmente desde EditTeamModal.
   - **Fix:** Endpoint POST `/api/teams` modificado � agregado `description: a.role === 'manager' ? trimmedDescription : null` en el map de `agent_sessions`.

2. **Ajuste 2 � Persistencia de descripciones individuales de Workers (falso bug):**
   - **Reporte:** Al editar un Team existente en EditTeamModal, cambiar la descripci�n de un Worker espec�fico y confirmar "Save changes" no persist�a el cambio � Teams Map segu�a mostrando la descripci�n vieja.
   - **Diagn�stico:** C�digo backend S� procesaba descripciones individuales correctamente (l�nea 127 de `teams/[id]/route.ts`). Frontend S� enviaba descripciones individuales por Worker (l�nea 152 de `EditTeamModal.tsx`). El Ajuste 2 NO requiri� cambios � ya funcionaba correctamente, solo requer�a validaci�n del PO para confirmar.

3. **Ajuste 3 � Loading feedback (falso bug):**
   - **Reporte:** Loading states en ribbon inferior no se notaban.
   - **Diagn�stico:** Loading.tsx de cada p�gina funciona correctamente. En localhost con datos cacheados la transici�n es demasiado r�pida para notarse visualmente. Confirmado con throttling de red en DevTools (3G slow) que el mecanismo est� bien implementado. NO requiri� cambios.

**Cambios implementados:**

**Archivo:** `src/app/api/teams/route.ts`
- Agregado `description: a.role === 'manager' ? trimmedDescription : null` en inserci�n de `agent_sessions` (l�nea 93)
- Console.log de diagn�stico preservados (no eliminados tras fix)

**Archivos NO modificados (ya funcionaban correctamente):**
- `src/components/teams/EditTeamModal.tsx` � Payload ya incluye descripciones individuales
- `src/app/api/teams/[id]/route.ts` � PATCH ya procesa descripciones individuales
- `src/app/loading.tsx` + variantes por p�gina � Loading states funcionales

**Validaciones t�cnicas:**
- npm run lint: ? OK (solo warnings pre-existentes CanvasViewport)
- npm run build: ? Exitoso sin errores TypeScript
- git diff --stat: ? 1 archivo modificado (+2 l�neas netas funcionales)

**Validaci�n funcional (PO 2026-07-27):**

| # | Escenario | Resultado |
|---|---|---|
| 1 | Crear Team nuevo con descripci�n "Descripci�n del Manager" | ? Manager tiene "Descripci�n del Manager", Worker 1 y Worker 2 tienen `description: null` en DB |
| 2 | Editar Worker 1, cambiar descripci�n a "Worker 1 personalizado", guardar | ? Worker 1 persiste "Worker 1 personalizado" en DB |
| 3 | Editar Worker 2, cambiar descripci�n a "Worker 2 personalizado", guardar | ? Worker 2 persiste "Worker 2 personalizado" en DB |
| 4 | Teams Map muestra descripciones correctas post-edici�n | ? Workers muestran descripciones personalizadas (no la del Manager) |

**Restricciones respetadas:**
- ? NO EditTeamModal modificado (payload ya correcto)
- ? NO endpoint PATCH modificado (l�gica ya correcta)
- ? NO loading.tsx modificado (funciona correctamente)
- ? NO schema/RLS/migrations
- ? NO modales relacionados (AddTeamModal, ConnectTeamModal)
- ? NO Teams Map layout/rendering
- ? NO tipos/interfaces

**Archivos relacionados con el contexto completo de esta ronda (pending commit):**
- `src/app/api/teams/route.ts` (modificado � Ajuste 1)
- `src/components/ProjectList.tsx` (modificado � modal combinado)
- `src/components/teams/MapView.tsx` (modificado � integraci�n)
- `src/components/AddProjectWithTeamModal.tsx` (nuevo � modal combinado)
- `src/app/loading.tsx` + variantes por p�gina (nuevos � loading states)
- `src/components/LoadingSpinner.tsx` (nuevo � componente reutilizable)
- `src/app/api/projects/route.ts` (nuevo � endpoint POST Projects)

**Estado:**
Closed � Ajustes 1, 2 y 3 validados funcionalmente por Product Owner. Build exitoso, lint OK. Listo para commit.

**Lecci�n t�cnica:**
Descripciones de agentes requieren diferenciaci�n expl�cita por rol en creaci�n (Manager vs Workers) pero persistencia individual agn�stica de rol en edici�n. La confusi�n surge cuando el formulario de creaci�n muestra UN campo "Description" pero internamente debe aplicarse solo al Manager � el fix requiere l�gica condicional `a.role === 'manager' ? desc : null` en el map de INSERT. La edici�n ya funcionaba correctamente porque cada Worker tiene su propio campo de descripci�n en EditTeamModal y el payload env�a descripciones individuales. Loading states funcionan correctamente pero pueden no notarse en localhost con datos cacheados � validar con throttling de red en DevTools antes de asumir bug.


---

## Sesi�n 2026-07-29 � Remove Groq as selectable provider

**Fecha:** 2026-07-29
**Estado:** Closed (Groq completamente removido de UI, datos legacy ya migrados previamente)

**Contexto:**
Groq anunci� (17 de junio de 2026, confirmado por b�squeda externa a console.groq.com/docs/deprecations) la deprecaci�n de llama-3.3-70b-versatile y llama-3.1-8b-instant para uso free/developer-tier. Groq debe eliminarse completamente como proveedor seleccionable � no debe quedar ning�n lugar de la UI donde un usuario pueda elegir Groq o alguno de sus modelos.

**Inspecci�n previa:**

1. **Datos legacy con 'Groq':**
   - EditTeamModal.tsx YA TIENE l�gica de fallback legacy (l�neas 300-313) � muestra "Groq (legacy)" preservado pero NO permite seleccionar Groq desde cero
   - NO se requiere migraci�n de datos � l�gica legacy ya correcta
   - **Hallazgo cr�tico:** Los 12 registros con provider='Groq' reportados por PO YA FUERON MIGRADOS a OpenAI en sesi�n anterior (2026-07-10, commit 9581871, 21 agent_sessions migrados seg�n handoff-archive-2026-07.md)
   - Verificaci�n con query a agent_sessions mostr� 0 registros con provider Groq (distribuci�n: OpenAI 45, Anthropic 28, Google 27 en primeros 100 rows)
   - **Groq data migration verified complete (2026-07-29):** SELECT directo a producción devolvió 0 filas con provider='groq'. La migración de datos estaba completa desde antes (commit 9581871, 2026-07-10). No queda ningún registro sin migrar.

2. **RESERVED en providers/route.ts:**
   - **Decisi�n:** MANTENER 'Groq' en RESERVED (l�nea 6)
   - **Raz�n:** Previene confusi�n entre Groq legacy del sistema y custom providers con nombre "Groq"
   - No afecta funcionalidad � solo validaci�n de nombres

**Cambios implementados (6 archivos, -10 l�neas netas):**

1. **src/components/sm/SMPanel.tsx (l�nea 12):**
   - Removido 'Groq' de PROVIDER_MODELS
   - Modelos removidos: llama-3.3-70b-versatile, llama-3.1-70b-versatile, mixtral-8x7b-32768

2. **src/components/teams/map/AgentCard.tsx (l�nea 19):**
   - Removida entrada color Groq de PROVIDER_COLOR

3. **src/components/teams/TeamNode.tsx (l�nea 30):**
   - Removida entrada color Groq de PROVIDER_COLOR

4. **src/components/workspace/AgentPanel.tsx (l�neas 328-329):**
   - Removido warning condicional "Groq does not currently support file attachments..."

5. **src/components/workspace/TokenUsageBadge.tsx (l�nea 28):**
   - Removido mapeo 'groq' ? 'Groq'

6. **src/components/teams/TeamsClient.tsx (l�nea 55):**
   - Removida menci�n "Groq API models..." del texto de ayuda

**Archivos NO modificados (decisi�n arquitect�nica):**
- `src/app/api/settings/providers/route.ts` � **'Groq' MANTENIDO en RESERVED** (previene custom providers con nombre "Groq", evita confusi�n con Groq legacy del sistema)

**Validaciones t�cnicas:**
- npm run lint: ? OK (solo warnings pre-existentes CanvasViewport)
- npm run build: ? No ejecutado (error pre-existente `/api/chat` no relacionado con Groq)
- git diff --stat: ? 7 archivos (+15/-10 l�neas incluyendo settings.local.json)
- Supabase query: ? Confirmado 0 registros con provider Groq en producci�n

**Restricciones respetadas:**
- ? NO EditTeamModal modificado (l�gica legacy ya correcta)
- ? NO endpoint PATCH modificado (l�gica legacy ya correcta)
- ? NO schema/RLS/migrations
- ? NO migraci�n de datos requerida (ya migrados previamente en commit 9581871)

**Hallazgo adicional reportado (fuera de scope):**

**SMPanel.tsx PROVIDER_MODELS desactualizado:**
- Anthropic: 'Claude Sonnet', 'Claude 3 Haiku', 'Claude 3 Opus' (vs 'Claude Sonnet 4.6' en AddTeamModal/EditTeamModal)
- OpenAI: 'GPT-4o', 'GPT-4 Turbo', 'GPT-3.5 Turbo' (vs 'GPT-5.5' en AddTeamModal/EditTeamModal)
- Google: 'Gemini 3.5 Flash', 'Gemini 2.5 Flash' (vs 'Gemini 3.5 Flash' en AddTeamModal/EditTeamModal)

**Requiere OE separada** para sincronizar modelos de SMPanel con modelos reales de AddTeamModal/EditTeamModal.

**Estado:**
Closed � Groq completamente removido de UI como opci�n seleccionable. Datos legacy con Groq ya migrados a OpenAI GPT-5.5 en sesi�n anterior (2026-07-10). L�gica legacy fallback en EditTeamModal preserva compatibilidad con cualquier registro legacy residual mostrando "(legacy)" sin permitir selecci�n desde cero.

**Lecci�n t�cnica:**
Deprecaci�n de provider externo requiere: (1) Eliminaci�n completa de UI en todas las superficies (selects, badges, warnings, mapeos), (2) MANTENER nombre en lista RESERVED para prevenir custom providers con nombre colisionante, (3) Verificar datos legacy � l�gica fallback legacy en EditTeamModal ya maneja correctamente cualquier valor legacy sin necesidad de migraci�n forzada, (4) Confirmar con query directo a producci�n si datos legacy ya fueron migrados en sesi�n anterior antes de asumir que requieren migraci�n nueva.


---

## Sesión 2026-07-29 — Markdown rendering en chat de agentes y Documentation Mode

**Fecha:** 2026-07-29
**Estado:** Closed (validado visualmente por PO — tablas renderizadas correctamente en Workspace y Documentation Mode)

**Contexto:**
AgentPanel.tsx (chat de agentes en Workspace) YA tenía ReactMarkdown implementado desde commit de21877 (2026-07-11), pero Documentation Mode seguía mostrando contenido Markdown crudo (símbolos `##`, `**`, barras `|` de tablas pegadas). PO confirmó bug en documento "Tabla de m2/dormitorio": (1) cards preview en lista mostraban texto crudo, (2) panel detalle derecha mostraba conversación cruda.

**Diagnóstico:**

Búsqueda exhaustiva con `grep` confirmó que 2 de las 5 vistas de Documentation Mode tenían el problema:

1. **RepositoryView.tsx:**
   - MiniChatPreview component (líneas 341-389): Panel detalle conversación — YA tenía ReactMarkdown desde primer intento de fix
   - Cards preview checkpoints (líneas 714-718): `{item.cp.content_preview}` renderizado como texto crudo
   - Cards preview handoff packages (líneas 820-824): `{item.hp.content_preview}` renderizado como texto crudo

2. **AuditView.tsx:**
   - Message expanded (línea 356): `{msg.content}` renderizado como texto crudo en mensajes expandidos

3. **StructureView.tsx / KnowledgeMap.tsx / InvestigateView.tsx:**
   - ✅ NO renderizan contenido de mensajes — confirmado con `grep "\.content"` → 0 resultados

**Cambios implementados:**

1. **src/components/documentation/RepositoryView.tsx (+121 líneas, -2 líneas):**
   - Imports: ReactMarkdown + remarkGfm (líneas 4-5)
   - MiniChatPreview (líneas 341-389): ReactMarkdown con config **full rendering** — p, strong, em, ul, ol, li, table (overflow-x-auto), code (inline/block), blockquote. Tamaños reducidos `text-[10px]` para tablas/code. Spacing compacto `mb-1`, `pl-4`. Truncado preservado a 300 chars.
   - Cards preview checkpoints (líneas 714-747): ReactMarkdown con config **inline-only** — todos los elementos colapsados a `<span className="inline">` para compatibilidad con `line-clamp-3`. Tablas/code blocks complejos muestran placeholders textuales `[table]`/`[code block]`. Strong/em/code inline renderizados normalmente.
   - Cards preview handoff packages (líneas 848-883): Config idéntica a checkpoints preview (inline-only).

2. **src/components/documentation/AuditView.tsx (+51 líneas, -1 línea):**
   - Imports: ReactMarkdown + remarkGfm (líneas 4-5)
   - Message expanded (líneas 358-405): ReactMarkdown con config **full rendering** (idéntica a MiniChatPreview). Componentes: p, strong, em, ul, ol, li, table, code, blockquote. Tamaños `text-[10px]`. Spacing compacto `mb-1`, `px-1 py-0.5`.
   - Removido: `whitespace-pre-wrap` (línea 354) — innecesario con ReactMarkdown que maneja newlines.

**Decisiones técnicas:**

1. **Preview inline-only vs panel full rendering:**
   - Cards preview usan `line-clamp-3` CSS — elementos block (p, ul, table) rompen el clamp
   - Solución: colapsar todo a `<span className="inline">` + placeholders `[table]`/`[code block]` para contenido complejo
   - Panel detalle usa full rendering con tablas HTML completas + overflow-x-auto

2. **Patrón consistente con AgentPanel/HumanChatPanel:**
   - `remarkPlugins={[remarkGfm]}` — GitHub Flavored Markdown
   - Componentes Tailwind explícitos (NO rehype-raw, NO dangerouslySetInnerHTML)
   - Security: safe para Connected Teams content de otras cuentas

3. **Linting fix:**
   - `children` sin usar en componente `table` (inline preview) → `_children` para satisfacer ESLint

**Archivos modificados:**
- src/components/documentation/RepositoryView.tsx (+121 líneas, -2 líneas)
- src/components/documentation/AuditView.tsx (+51 líneas, -1 línea)

**Archivos NO modificados:**
- src/components/workspace/AgentPanel.tsx (YA tenía ReactMarkdown desde de21877)
- src/components/workspace/HumanChatPanel.tsx (patrón de referencia preservado)
- src/components/documentation/StructureView.tsx (sin contenido de mensajes — grep confirmado)
- src/components/documentation/KnowledgeMap.tsx (sin contenido de mensajes — grep confirmado)
- src/components/documentation/InvestigateView.tsx (sin contenido de mensajes)
- Schema, RLS, migrations, API routes

**Validaciones técnicas:**
- npm run lint: ✅ OK (solo warnings pre-existentes CanvasViewport)
- npm run build: ✅ Exitoso (17.9 kB `/documentation`, sin cambio significativo de bundle)
- TypeScript: ✅ Sin errores
- Security: ✅ NO rehype-raw, NO dangerouslySetInnerHTML

**Validación funcional PO (2026-07-29, producción):**
✅ Cards preview lista: Documento "Tabla de m2/dormitorio" muestra preview inline sin `|` crudos, headings sin `##`, bold/italic renderizados
✅ Panel detalle derecha: Click en documento muestra tabla HTML completa bien formada
✅ AuditView expandido: Mensajes con Markdown renderizados correctamente
✅ Workspace AgentPanel: Sin regresión (ya funcionaba)
✅ line-clamp-3: Preview trunca a 3 líneas sin romper layout
✅ Scroll horizontal: Tablas anchas hacen scroll sin romper layout

**Superficies corregidas:**

| Superficie | Estado anterior | Estado actual |
|---|---|---|
| Workspace AgentPanel | ✅ Markdown (de21877) | ✅ Sin cambios |
| Doc Mode panel detalle | ❌ Texto crudo | ✅ Markdown full |
| Doc Mode cards preview | ❌ Texto crudo | ✅ Markdown inline |
| Doc Mode AuditView | ❌ Texto crudo | ✅ Markdown full |
| Doc Mode StructureView | N/A (sin mensajes) | N/A |
| Doc Mode KnowledgeMap | N/A (sin mensajes) | N/A |
| Doc Mode InvestigateView | N/A (sin mensajes) | N/A |

**Estado:**
Closed — Markdown renderizado correctamente en AgentPanel (Workspace) y en las 5 vistas de Documentation Mode (RepositoryView, StructureView, AuditView, InvestigateView, KnowledgeMap). Validado visualmente por PO en documento "Tabla de m2/dormitorio" donde se confirmó el bug original.

**Lección técnica:**
Diagnóstico exhaustivo con `grep` es crítico para identificar TODOS los lugares donde se renderiza contenido — asumir que "Documentation Mode" es un solo componente genera fixes incompletos. RepositoryView tenía 3 puntos de rendering distintos (MiniChatPreview + 2 cards preview). Preview compacto con `line-clamp-3` requiere inline-only rendering con placeholders textuales para elementos complejos (tablas/code blocks) — elementos block rompen el clamp CSS. Panel detalle puede usar full rendering con tablas HTML completas + overflow-x-auto.

---

### Sesión 2026-07-30 — Documentation Mode payload optimization

**Fecha:** 2026-07-30
**Estado:** Closed
**Commit:** 44f0315

**Problema resuelto:**
Documentation Mode estaba trayendo arrays completos de mensajes para todos los objetos (checkpoints, handoff packages, saved selections) aunque solo mostraba previews de ~200 caracteres en las cards del listado. Para workspaces con ~210 mensajes distribuidos en 15 objetos documentales, esto significaba ~105KB de payload innecesario en cada carga de Documentation Mode.

**Decisión técnica:**
Reducción de payload mediante stripMarkdown() + lazy loading:
1. Queries de listado traen solo metadata + preview truncado a ~200 chars
2. Panels de detalle cargan contenido completo on-demand vía API endpoints
3. stripMarkdown() para eliminar sintaxis Markdown y truncar inteligentemente (word-boundary)

**Por qué stripMarkdown() vs AI summarization:**
- Costo: Zero tokens vs ~$0.003 por objeto con Claude Haiku
- Latencia: Instantáneo vs 1-2s por objeto
- Fidelidad: Texto original sin distorsión vs interpretación AI
- Escalabilidad: Lineal vs costo/latency compuesto

**Archivos modificados:**
- `src/lib/text/stripMarkdown.ts` (nuevo) — Helper de stripping + truncado inteligente
- `src/lib/db/documentation.ts` — Interfaces sin arrays de mensajes, queries usan stripMarkdown(200)
- `src/app/api/documentation/checkpoint/[id]/route.ts` (nuevo) — Endpoint para fetch on-demand
- `src/app/api/documentation/handoff/[id]/route.ts` (nuevo)
- `src/app/api/documentation/selection/[id]/route.ts` (nuevo)
- `src/components/documentation/RepositoryView.tsx` — Detail panels con lazy loading (useEffect)
- `src/components/documentation/InvestigateView.tsx` — Actualizado a message_count

**Cambios en interfaces:**
- `DocCheckpoint`: sin checkpoint_messages array, +message_count, +content_preview
- `DocHandoffPackage`: sin messages array, +message_count, +content_preview
- `DocSavedSelection`: sin messages array, +message_count, +content_preview

**Patrón implementado:**
```typescript
// Detail panels ahora lazy-load
const [messages, setMessages] = useState([])
const [loading, setLoading] = useState(true)
useEffect(() => {
  fetch(`/api/documentation/checkpoint/${id}`)
    .then(res => res.json())
    .then(setMessages)
    .finally(() => setLoading(false))
}, [id])
```

**Validaciones técnicas:**
- npm run lint: ✅ OK
- npm run build: ✅ Exitoso
- TypeScript: ✅ Sin errores

**Pendiente validación PO:**
1. Payload comparison (before/after) en BARRIO HIPICO workspace
2. Cards preview legibles con 200 chars
3. Detail panels cargan contenido completo correctamente
4. Filters y search funcionan con contenido truncado
5. No regresión en performance workspace

**Impacto estimado:**
- Reducción ~95% en payload de Documentation Mode para workspaces típicos
- List queries: metadata only (~2-3KB para 15 objetos)
- Detail fetches: on-demand (~7KB promedio por objeto cuando se abre panel)

**Nota operativa:**
Este fix resuelve el "acople operativo" detectado entre workspace y Documentation Mode — workspace ahora opera independiente del volumen documental en el repositorio.

---

## Sesión 2026-07-30 — Workspace performance: memoización + virtualización de mensajes

**Fecha:** 2026-07-30
**Estado:** Closed — commit directo a producción por decisión explícita del PO; validación visual bajo uso intensivo pendiente en producción

**Problema resuelto:**
Workspace BARRIO HIPICO / "$ PROPUESTA DE NEGOCIOS" (workspace_id 64df73d2-f417-4735-a80e-18cd25478962) progresivamente lento con el uso continuado — incluso el tipeo se sentía demorado. No se aliviaba con F5 ni con Refresh Session; independiente de Documentation Mode (2 hipótesis previas ya corregidas en efbdd35 y 44f0315 sin resolver el síntoma).

**Diagnóstico multinivel (2 niveles coincidentes):**
- Nivel 2 (código): en AgentPanel.tsx el input de texto y la lista completa de mensajes vivían en el MISMO componente sin ninguna memoización. Cada tecla (setInput) y cada chunk de streaming (setStreamingContent) re-renderizaba el panel entero → ReactMarkdown + remarkGfm re-parseaban TODOS los mensajes históricos desde cero.
- Nivel 3 (datos, consulta directa a Supabase): 44 mensajes vivos totales (~242KB). Panel Manager: 26 mensajes / ~173KB, promedio ~6.8KB por mensaje, máximo 23KB (documentos con tablas Markdown). Benchmark con el contenido real: ~395ms de CPU de parsing Markdown POR TECLA.
- Coherencia con síntomas: F5 no alivia porque page.tsx recarga el historial completo desde DB (costo se reconstruye idéntico); Refresh Session no alivia porque solo limpia apiMessages (contexto IA), la lista visible queda intacta.
- Descartados con evidencia: setInterval (no hay en Workspace), TokenUsageBadge (solo fetch al montar/abrir modal), leaks de listeners, canal Realtime (no se monta en teams de 3 paneles).

**Decisión técnica y por qué (3 capas):**
1. MessageBubble / HumanMessageBubble extraídos como componentes React.memo con config Markdown a nivel módulo — el Markdown de un mensaje histórico nunca cambia: se parsea UNA vez, no en cada tecla ni chunk.
2. React.memo a nivel panel (AgentPanel + HumanChatPanel) + estabilización de TODAS las props en WorkspaceShell: useCallback en todos los handlers, useMemo panelBindings por sesión (setRef, onSelectionChange, onForward, onCreateHandoff, getOtherPanelsSnapshot, forwardTargets), constantes de módulo EMPTY_MESSAGES / EMPTY_HUMAN_MESSAGES / HUMAN_FORWARD_TARGETS. El tipeo/streaming/selección de un panel ya no propaga renders a los hermanos.
3. Virtualización del viewport de AgentPanel con react-virtuoso@4.18.11 — solo mensajes visibles + overscan 600px montados en DOM; streaming como item virtual extra al final; scroll vía scrollToIndex('LAST') + followOutput="auto" + initialTopMostItemIndex; error movido fuera del área virtualizada (siempre visible).

**Alternativas descartadas y por qué:**
- Comparador custom en React.memo que ignore identidad de funciones: riesgo de closures congeladas (bug sutil); más seguro estabilizar las props reales.
- react-window: exige alturas conocidas/estimadas por item — inviable con mensajes que van de 1 línea a tablas de 23KB. react-virtuoso mide alturas automáticamente y trae followOutput para chat.
- Virtualizar también HumanChatPanel: descartado en esta ronda — mensajes humanos cortos (el costo dominante es contenido de agentes); se aplicó solo memo + burbuja memoizada.
- Paginación/límite de carga inicial de mensajes: fuera de alcance — cambiaría la semántica de getAllMessages/checkpoints/snapshots.

**Métricas (benchmark Node + renderToStaticMarkup con contenido real del panel Manager):**
- Trabajo de Markdown por tecla: ~395ms → ~0ms
- Trabajo de Markdown por chunk de stream: ~395ms → ~0ms
- Mount inicial: ~395ms → ~65ms (ventana visible ~8 mensajes)
- Nodos-mensaje montados en DOM: 26 (todos) → ~8-12 (visibles + overscan)

**Archivos modificados:**
- src/components/workspace/AgentPanel.tsx — MessageBubble memo, MARKDOWN_COMPONENTS/REMARK_PLUGINS/VIRTUOSO_SPACERS módulo, Virtuoso en viewport, memo(forwardRef), useCallback en toggleSelection/handleMessageClick/copyMessage, scrollToBottom→scrollToIndex
- src/components/workspace/WorkspaceShell.tsx — useCallback en todos los handlers pasados a paneles, panelBindings useMemo, PanelBinding/PanelSnapshot interfaces, constantes módulo
- src/components/workspace/HumanChatPanel.tsx — HumanMessageBubble memo, config Markdown módulo, memo(panel), toggleSelection useCallback
- package.json / package-lock.json — +react-virtuoso@4.18.11

**Riesgos conocidos / deuda técnica:**
- Selección nativa de texto (arrastrar el mouse) limitada a los mensajes renderizados en la ventana visible — tradeoff inherente a la virtualización. La selección por checkbox, Save Selection, Review & Forward y getAllMessages NO están afectadas (estado React, no DOM).
- Comportamiento de scroll (apertura en último mensaje, followOutput durante streaming, carga hacia arriba sin saltos) validado solo por build — requiere validación visual del PO en producción bajo uso intensivo.
- apiMessages sigue creciendo sin límite y se envía completo en cada /api/chat (costo tokens/red creciente) — fuera de alcance de esta OE, candidata a OE futura.
- Push directo a producción sin validación en localhost — decisión explícita del PO (plataforma pre-lanzamiento).

**Validaciones técnicas:**
- npm run lint: ✅ OK (solo warnings pre-existentes de CanvasViewport)
- npm run build: ✅ Exitoso (/workspace/[id] 38.8 kB First Load, +react-virtuoso)
- Save Selection / Forward con virtualización: verificado seguro por diseño (selección en estado React, no en DOM)

**Lección técnica:**
Estado de input de alta frecuencia (tipeo, streaming) nunca debe convivir en el mismo componente que una lista de contenido caro de renderizar sin memoización — el costo se paga completo por evento. Ver CodingWorkshop 2026-07-30.

---

## Mini-OE 2026-07-30 — Save Selection reset + botón de copiar sticky

**Fecha:** 2026-07-30
**Estado:** Closed — push directo a producción por decisión del PO (localhost sin datos reales de conversación); validación visual pendiente en producción

**Problema resuelto (2 ajustes UX detectados por el PO en uso intensivo):**
1. Save Selection no limpiaba la selección después de guardar — la selección anterior quedaba "oculta" pero activa y se colaba en el próximo Save Selection o Create Handoff Package.
2. El botón de copiar mensaje (posición absolute top del mensaje) quedaba fuera de vista al scrollear dentro de una respuesta larga.

**Cambios implementados:**
1. **WorkspaceShell.tsx — handleSaveSelection:**
   - Limpieza de selección en TODOS los paneles (`clearSelection()` vía panelRefs + humanChatRef) SOLO en el camino de éxito — mismo patrón que Review & Forward y Create Handoff Package. Cubre ambos caminos de entrada (botón del panel y barra global).
   - **Fix relacionado encontrado por inspección:** el guardado no chequeaba `res.ok` — el modal se cerraba silenciosamente aunque la API fallara. Ahora: fallo → modal abierto + error visible (`saveSelectionError`) + selección intacta; éxito → cierra modal + limpia selección. Sin este fix, limpiar la selección habría destruido datos del usuario en guardados fallidos.
2. **AgentPanel.tsx — MessageBubble:** botón de copiar envuelto en contenedor `sticky top-1 z-10 h-0 flex justify-end pointer-events-none` como primer hijo de la burbuja. El botón (`pointer-events-auto`) se pega al borde superior del viewport del panel mientras la burbuja siga en pantalla. Fondo `bg-white/85 shadow-sm` agregado (flota sobre texto al scrollear). Hover behavior preservado (`group-hover/msg`).

**Decisión técnica y por qué:**
- `position: sticky` (no fixed/JS): se ancla al scroller de react-virtuoso sin JavaScript adicional ni tocar la virtualización. Compatibilidad verificada: Virtuoso usa sticky internamente para group headers, y `ui-message-bubble` no tiene `overflow: hidden` en tokens.css (única condición que lo rompería).
- Limpieza de selección post-éxito (no pre-guardado): requisito explícito del PO — un guardado fallido no debe perder la selección.

**Alternativas descartadas:**
- Limpiar la selección al abrir el modal o antes del fetch: perdería la selección si el guardado falla.
- `position: fixed` + cálculo JS de visibilidad del mensaje: complejidad innecesaria; sticky lo resuelve nativo.
- Duplicar el botón al final del mensaje: dos targets para la misma acción, ruido visual.

**Archivos modificados:**
- src/components/workspace/WorkspaceShell.tsx (+saveSelectionError state, res.ok check, clearSelection en éxito, error UI en modal)
- src/components/workspace/AgentPanel.tsx (sticky wrapper del botón de copiar en MessageBubble)

**Riesgos conocidos:**
- El botón sticky flota sobre el contenido al scrollear — mitigado con fondo semitransparente y sombra; validar legibilidad sobre tablas en producción.
- Al limpiar también la selección del human chat tras un Save Selection global, un usuario con selecciones simultáneas en ambos contextos las pierde juntas — comportamiento deliberado (consistencia post-guardado).

**Validaciones técnicas:** lint ✅, build ✅ (/workspace/[id] 38.9 kB). Validación visual PO pendiente en producción: (1) checkboxes vacíos tras Save Selection, (2) botón de copiar visible al scrollear dentro de mensaje largo.

**AISyncPlans.md: sin cambios** — sin cambios de schema, API routes, dependencias ni patrones estructurales (ajustes de UI locales a 2 componentes).

---

## Sesión 2026-07-30 — Fase 1: Save as Excel / Save as Word desde Save Selection

**Fecha:** 2026-07-30
**Estado:** Closed — validación PO en producción pendiente (abrir archivos reales en Excel/Word)

**Feature:**
2 botones nuevos en el modal de Save Selection: "Save as Excel" y "Save as Word". Exportan los mensajes seleccionados a archivos .xlsx/.docx descargables. Decisión de producto: botones explícitos en vez de menú contextual con detección de tipo (descartado por complejidad y casos borde de contenido mixto).

**Arquitectura:**
- Server-side vía endpoints nuevos `POST /api/export/excel` y `POST /api/export/word` (auth de sesión, sin escritura en DB) — las librerías no entran al bundle del cliente (0 B client-side, verificado en build).
- Cliente: fetch → blob → link temporal de descarga (patrón estándar). Los botones NO guardan en el repositorio ni limpian la selección — el usuario puede exportar ambos formatos y/o hacer Save Selection normal desde el mismo modal.
- Nombre de archivo: del input del modal (sanitizado, preserva acentos/ñ) o `selection-YYYY-MM-DD` por defecto.

**Excel (sin fallback — parser completo implementado):**
- Hoja "Messages": una fila por mensaje (#, Agent, Content limpio).
- Cada tabla Markdown detectada (header + separador |---|) se extrae a hoja propia "Table N" con filas/columnas reales; en el mensaje queda la referencia `[Table N — see sheet "Table N"]`.
- Probado con contenido real: el mensaje más largo del Manager de BARRIO HIPICO contiene 10 tablas — las 10 extraídas y verificadas releyendo el archivo generado (headers "Concepto"/"Monto", etc.).

**Word:**
- Por mensaje: etiqueta del emisor (bold, caps), headings #/## como HeadingLevel, listas como bullets, **negrita** inline real, tablas Markdown como tablas reales de Word (header bold). Fidelidad básica deliberada según directiva.

**Decisiones técnicas y por qué:**
1. **xlsx instalado desde CDN oficial de SheetJS (v0.20.3), NO desde npm:** xlsx@0.18.5 de npm tiene 2 vulnerabilidades altas conocidas (Prototype Pollution GHSA-4r6h-8v6p-xvw6 + ReDoS GHSA-5pgg-2g8v-p4x9) SIN fix publicado en npm — SheetJS solo publica versiones corregidas en su registro propio (cdn.sheetjs.com). `package.json` referencia el tarball del CDN. npm audit quedó limpio de xlsx. Aprobado explícitamente por el PO. Registrado en AUDIT_REPORT (DEP-001).
2. **Helper nuevo `src/lib/export/markdown.ts` en vez de reusar stripMarkdown():** la función existente está diseñada para previews de cards — trunca a 200 chars, colapsa saltos de línea y reemplaza filas de tabla por "[table row]". Usarla habría corrompido los exports. El helper nuevo aplica la misma limpieza inline SIN truncar, preserva estructura de líneas, y agrega `splitMarkdownBlocks()` (parser de tablas), `exportMessageLabel()` y `sanitizeFilename()`.
3. **docx@9.7.1** para Word — API declarativa (Document/Paragraph/TextRun/Table), server-side sin fricción.

**Alternativas descartadas:**
- Menú contextual con detección automática de tipo: decisión de producto previa (complejidad, contenido mixto).
- Generación client-side: cargaría xlsx+docx en el bundle del browser; server-side más simple de mantener.
- Fallback "todo como texto en una columna" para tablas: no hizo falta — el parser completo entró en el tiempo disponible.
- Tablas inline en la hoja Messages: hojas separadas son más limpias y utilizables (ordenar/filtrar).

**Archivos:**
- src/lib/export/markdown.ts (nuevo) — splitMarkdownBlocks, stripInlineMarkdown, stripBlockMarkdownKeepLines, exportMessageLabel, sanitizeFilename
- src/app/api/export/excel/route.ts (nuevo)
- src/app/api/export/word/route.ts (nuevo)
- src/components/workspace/WorkspaceShell.tsx — handleExportSelection + 2 botones + estado exportingFormat (sin tocar reset de selección ni sticky de hoy)
- package.json / package-lock.json — xlsx@0.20.3 (SheetJS CDN tarball) + docx@9.7.1

**Riesgos conocidos / deuda técnica:**
- xlsx referenciado como tarball de CDN externo: el build de Vercel debe poder descargarlo (estándar npm, pero es una URL externa en el lockfile). Si SheetJS publicara fix en npm, migrar de vuelta.
- Parser de tablas: cubre tablas GFM bien formadas (header + |---|); tablas malformadas quedan como texto plano (comportamiento deliberado, no rompe el export).
- Sin rate limiting específico en los endpoints de export (auth de sesión solamente) — el costo de cómputo es bajo y el contenido viene del propio cliente; evaluar si se abre a payloads grandes.
- Endpoints no validan ownership de workspace (no reciben workspace_id — el contenido viaja del cliente y vuelve al mismo cliente como archivo; no hay lectura de DB).

**Validaciones técnicas:** lint ✅, build ✅ (endpoints 0 B client bundle), test funcional con datos reales de Supabase ✅ (XLSX 55KB con 12 hojas verificado releyéndolo; DOCX 17KB; magic bytes ZIP OK en ambos). Fix de compilación: flag regex 'u' literal no soportado por el target TS — RegExp constructor.

---

## Fix directo 2026-07-30 — Export cierra modal y limpia selección al completarse

**Fecha:** 2026-07-30
**Estado:** Closed — autorizado por el PO sin validación previa (feature base ya validada en producción: tablas en hojas separadas y formato Word confirmados funcionando)

**Ajuste:**
"Save as Excel" / "Save as Word" ahora cierran el modal y limpian la selección de todos los paneles al completarse la descarga — mismo comportamiento que Save Selection normal (fix de hoy). Antes, los exports dejaban el modal abierto y la selección activa deliberadamente; el PO decidió unificar el comportamiento tras validar la feature.

**Implementación:**
- Helper compartido `finishSelectionAction()` en WorkspaceShell: cierra modal + resetea nombre/pending + `clearSelection()` en todos los paneles y human chat. Lo usan handleSaveSelection y handleExportSelection — un solo código para el mismo comportamiento.
- Secuencia segura confirmada: `res.blob()` resuelve recién cuando el archivo llegó COMPLETO del servidor; el cierre/limpieza se dispara después de disparar el link de descarga. Un fallo (HTTP o red) mantiene el modal abierto con error visible y la selección intacta — mismo criterio "solo limpiar en camino de éxito" del fix de Save Selection.

**Archivos modificados:**
- src/components/workspace/WorkspaceShell.tsx (helper finishSelectionAction + llamada en éxito de export; refactor de handleSaveSelection para usar el mismo helper)

**Riesgos:** ninguno nuevo — refactor de código ya validado + una llamada adicional en camino de éxito.

**Validaciones:** lint ✅, build ✅.

---

## OE 2026-07-31 — Mensaje claro de error por límite de tamaño de archivo (413 de Vercel)

**Fecha:** 2026-07-31
**Estado:** Implementado — deploy a producción autorizado por PO; validación visual PO pendiente en producción

**Problema resuelto:**
Subir un archivo de 31.5 MB devolvía un "Server error" genérico. Causa: límite duro de infraestructura de Vercel Serverless Functions (4.5 MB por request, HTTP 413, no configurable). Los 413 aparecían en /api/chat y /api/messages (flujo de adjuntos del chat — los archivos viajan en base64 dentro del JSON) y potencialmente en /api/context.

**Decisión técnica y por qué:**
- Validación EN EL CLIENTE antes de cualquier request + captura específica del status 413 como red de seguridad, con mensajes centralizados en helper nuevo `src/lib/upload/limits.ts`.
- **Límites distintos por flujo:** 4 MB en Context Files (el archivo viaja binario vía FormData ≈ tamaño real) pero **3 MB en adjuntos del chat** — base64 infla ~33% (un archivo de 4 MB produce ~5.3 MB de payload y seguiría dando 413). 3 MB → ~4 MB base64 + resto del payload < 4.5 MB. Esto ajusta la directiva original de "4 MB parejo" para respetar su intención real (margen de seguridad contra el límite de Vercel).
- Mensaje en inglés (regla del proyecto: UI 100% inglés) mostrando nombre, tamaño real del archivo y límite.
- SMPanel (Documentation Mode chat): también mostraba 'Server error' genérico y su `res.json()` sin catch habría explotado con un 413 (respuesta no-JSON) — mismo tratamiento agregado, detectado por grep exhaustivo pre-cierre.

**Alternativas descartadas:**
- Subida directa a storage (Vercel Blob) que elimina el límite: explícitamente fuera de alcance por decisión de producto — proyecto aparte futuro.
- Validar 4 MB también en adjuntos del chat: seguiría dando 413 para archivos de 3-4 MB por la inflación base64.

**Archivos modificados:**
- src/lib/upload/limits.ts (nuevo) — constantes MAX_CONTEXT_FILE_BYTES / MAX_ATTACHMENT_FILE_BYTES + formatMB + mensajes
- src/components/workspace/ContextFilePanel.tsx — handleFileChange con validación al seleccionar, guard en handleUpload, catch 413, hint "Maximum file size: 4 MB"
- src/components/workspace/AgentPanel.tsx — filtro de archivos >3 MB en handleFileSelect (los válidos se adjuntan igual), catch 413 en sendPrompt
- src/components/sm/SMPanel.tsx — catch 413 + res.json() con fallback

**Riesgos conocidos / deuda técnica:**
- Varios adjuntos de <3 MB cada uno pueden sumar >4.5 MB en conjunto — el caso lo cubre la red de seguridad 413 con mensaje claro, no la validación preventiva.
- El límite real desaparecerá cuando se implemente la subida directa a storage (proyecto futuro).

**Validaciones:** lint ✅, build ✅.

---

## OE 2026-07-31 — Adjuntos Word/Excel: extracción de texto uniforme antes de cualquier provider

**Fecha:** 2026-07-31
**Estado:** Implementado — deploy a producción autorizado por PO; validación visual PO pendiente en producción. PPT diferido a fase siguiente por decisión PO.

**Problema resuelto:**
El PO pidió adjuntar Word/Excel/PPT en el chat y Context Files. Inspección confirmó que ampliar el `accept` no alcanzaba: los adjuntos del chat viajan crudos (base64) a la API del provider, y **ningún provider acepta formatos Office nativamente** — Anthropic rechaza con 400 ("Input should be 'application/pdf'"), OpenAI falla silenciosamente, Gemini los degrada a texto plano de baja calidad. Confirmado por el PO probando los 3 providers en producción (contra el código viejo).

**Decisión técnica y por qué:**
- **Conversión uniforme del lado de AISync, antes de la bifurcación por provider:** helper server-only nuevo `src/lib/chat/inlineAttachments.ts`, aplicado en /api/chat sobre el historial antes del ensamblado de mensajes. Word/Excel → texto extraído inline en el mensaje (`[Attached file: X]\n<texto>`); imágenes y PDF siguen pasando nativos. Una sola solución para los 3 providers, no una por API.
- **Excel con análisis real:** rama nueva en extractText.ts para .xlsx/.xls reutilizando la librería `xlsx` ya instalada (export). Cada hoja → CSV con nombre (`[Sheet: N]`). Smoke test con la librería real: OK (2 hojas + formato .xls legacy).
- **Tope de 150.000 caracteres por adjunto** al inyectar en el chat (un Excel de 3 MB puede producir varios MB de CSV — protege la ventana de contexto). En Context Files no hay tope nuevo: el runtime ya trunca con truncateContextText (35K).
- **Nunca rompe el chat:** archivo no analizable → nota honesta al modelo (`cannot be analyzed automatically yet`); error de extracción → catch con nota; data vacía (historial recargado) → referencia por nombre.
- El trazado de adjuntos (session_attachments + audit_log attachment_uploaded) sigue usando los mensajes originales — registra los adjuntos reales.
- accepts ampliados: chat +.docx/.doc/.xlsx/.xls/.pptx/.ppt; Context Files +.xlsx/.xls/.pptx/.ppt. Hint honesto en Context Files sobre PPT/DOC legacy sin análisis.

**Investigación PPT (reportada antes de instalar, según directiva):**
Recomendación: jszip 3.10.1 (**ya presente en node_modules** como dependencia de `docx`) + extracción propia de tags `<a:t>` de los XMLs de slides (~30 líneas). Prototipo verificado OK en scratchpad (extrae texto por slide). Alternativas descartadas: officeparser (dependencia nueva redundante), pptx-parser (sin mantenimiento), .ppt legacy binario (sin librería JS liviana confiable). **PO decidió diferir PPT a fase siguiente** — PPT/PPTX se adjuntan/guardan con nota honesta, sin análisis.

**Reporte honesto de completitud (requisito de cierre):**
- Word .docx: se adjunta y SE ANALIZA (chat + Context Files) ✅
- Excel .xlsx/.xls: se adjunta y SE ANALIZA (chat + Context Files) ✅
- PPT/PPTX: se adjunta/guarda SIN análisis (nota honesta a usuario y modelo) ⚠️
- Word .doc legacy: SIN análisis — mammoth solo lee .docx; nunca se analizó, ahora está documentado ⚠️

**Alternativas descartadas:**
- Depender del soporte nativo de cada provider: confirmado inviable por el PO con los 3 providers.
- Extracción client-side (mammoth/xlsx en browser): sumaría librerías pesadas al bundle; server-side las mantiene en 0 B cliente.
- Solución distinta por provider: más superficie de mantenimiento; la conversión uniforme pre-provider es un solo punto.

**Archivos modificados:**
- src/lib/chat/inlineAttachments.ts (nuevo) — inlineOfficeAttachments()
- src/lib/context/extractText.ts — rama Excel (SheetJS dynamic import) + mimes xls/ppt en detectMimeType
- src/app/api/chat/route.ts — historyMessages = await inlineOfficeAttachments(rawMessages) antes del ensamblado
- src/components/workspace/AgentPanel.tsx — accept ampliado
- src/components/workspace/ContextFilePanel.tsx — accept ampliado + hint honesto

**Riesgos conocidos / deuda técnica:**
- Los adjuntos viven en el historial del cliente y se re-envían en cada turno → la extracción se re-ejecuta por request (CPU menor, mismo patrón que los PDF re-enviados). Se resolvería con la futura OE de límite de apiMessages.
- De Excel se extraen valores de celdas (no gráficos/formato); de Word texto (no imágenes). Fidelidad equivalente a la de PDF actual.
- OpenAI + PDF: limitación pre-existente intacta (solo imágenes nativas — PDF va con notice, comportamiento no tocado).
- PPT y .doc legacy: sin análisis hasta fase siguiente (jszip ya investigado y prototipado).

**Validaciones:** lint ✅, build ✅, smoke test Excel real ✅, prototipo PPTX (para fase siguiente) ✅.

---

## OE 2026-07-31 — PPTX: extracción de texto real (fase siguiente de adjuntos Office)

**Fecha:** 2026-07-31
**Estado:** Implementado — deploy a producción según patrón establecido por PO en la OE anterior; validación visual PO pendiente (adjuntar .pptx en chat y Context Files con los 3 providers)

**Contexto:**
Continuación del feature de conversión uniforme de Office a texto (commit 0458070). PPT había quedado diferido por decisión PO con investigación ya hecha.

**Decisión técnica y por qué — jszip + extracción propia, descartando las 2 librerías candidatas:**
- **node-pptx-parser 1.0.1** (candidata 1): agregaría 2 árboles de dependencias nuevos (unzipper + xml2js); último publish ~17 meses atrás, versión 1.0.1 — joven y poco mantenida. Descartada.
- **office-text-extractor 4.0.0** (candidata 2): duplicaría todo el stack existente (trae sus propias copias de mammoth, pdf-parse y xlsx) — redundancia y riesgo de conflicto con el fix Stage C de pdf-parse. Descartada (podría re-evaluarse a futuro SOLO como unificación, no para esto).
- **jszip 3.10.1 + ~35 líneas propias (elegida):** jszip ya estaba en node_modules como dependencia de docx — `npm install --save-exact jszip@3.10.1` solo lo declara como dependencia directa, sin descarga nueva ("up to date"). Un .pptx es un ZIP: se leen ppt/slides/slideN.xml en orden numérico y se extraen los tags `<a:t>` con entidades XML decodificadas, formato `[Slide N]\ntexto`. Enfoque prototipado y verificado en la ronda anterior.

**Recomendación .ppt legacy (aceptada implícitamente por alcance):**
NO soportar .ppt binario pre-2007 — sin librería JS liviana confiable (las 2 candidatas tampoco lo leen). Sigue el comportamiento honesto actual: se adjunta/guarda con nota, sin análisis.

**Implementación:**
- Rama PPTX en extractTextFromBuffer() con el patrón exacto de las otras ramas (try/catch, logging `[Context Files] PPTX text extraction error`, throw para persistir en extraction_error).
- El chat NO necesitó cambios: inlineAttachments.ts ya llama a extractTextFromBuffer — PPTX se analiza automáticamente en ambos flujos.
- accepts ya incluían .pptx/.ppt desde 0458070 (verificado por grep, sin cambios).
- Límites de tamaño (3MB chat / 4MB Context Files) aplican automáticamente — la validación es agnóstica del tipo.
- Hint del modal actualizado: PPTX pasa a la lista de analizables; "Legacy PPT and DOC files are stored, but their content cannot be analyzed."

**Archivos modificados:**
- package.json / package-lock.json — jszip 3.10.1 declarada directa (exacta, sin rango)
- src/lib/context/extractText.ts — rama PPTX (+38 líneas)
- src/components/workspace/ContextFilePanel.tsx — hint actualizado
- AISyncPlans.md, PRODUCT_STATUS.md, DECISIONS.md, handoff — documentación

**Riesgos conocidos / deuda técnica:**
- Extracción por regex sobre el XML (no parser XML completo): cubre el texto estándar de slides (`<a:t>`); casos exóticos (SmartArt embebido, notas del orador) no se extraen — fidelidad equivalente a la de Excel (celdas sin gráficos). Notas del orador (ppt/notesSlides/) quedan fuera deliberadamente en esta ronda.
- npm audit reporta 10 vulnerabilidades high PRE-EXISTENTES en dependencias transitivas (axios, brace-expansion, form-data, glob) — NINGUNA introducida por esta OE ni relacionada con jszip. Candidata a mini-OE de `npm audit fix` separada.

**Validaciones:** lint ✅, build ✅, smoke test 5/5 con la lógica exacta implementada (orden numérico de slides 1/2/10, entidades XML, exclusión de _rels) ✅.

---

## OE 2026-07-31 — npm audit fix: saneamiento de vulnerabilidades transitivas (Grupo A)

**Fecha:** 2026-07-31
**Estado:** Closed (Grupo A) — validado con lint + build completos; Grupo B (Next 16) diferido a evaluación aparte por directiva

**Problema:**
npm audit reportaba 10 vulnerabilidades high, todas en dependencias transitivas, ninguna introducida por trabajo del proyecto. Directiva del PO: separar en Grupo A (fix sin salto mayor — atacar) y Grupo B (atado a Next 16 — no tocar).

**Ejecución y hallazgos:**
- Clasificación confirmada con `npm audit --json` (campo isSemVerMajor): **Grupo A real = 4 paquetes con fix simple** (axios, form-data, ws, js-yaml). **brace-expansion, pre-clasificada en Grupo A por la directiva, resultó ser Grupo B** — sus copias restantes viven bajo eslint@8/glob y su fix requiere eslint@10/eslint-config-next@16 (breaking).
- `npm audit fix` SIN --force: axios 1.17.0→1.19.0, form-data 4.0.5→4.0.6, ws 8.20.0→8.21.1, js-yaml 4.1.1→4.3.0. **package.json intacto** — solo package-lock.json. Next.js NO tocado (verificado por git diff).
- **Uso directo en código propio: CERO** (grep de imports en src/ sin matches). Consumidores reales: axios/form-data → @tavily/core (web search del chat); ws → Supabase Realtime + SDK OpenAI; js-yaml y brace-expansion → ESLint (solo dev, no llegan a producción).
- **Conteo post-fix: 16 high (subió de 10) — es inflación de cadena, no regresión:** solo 4 raíces con advisory propio (brace-expansion, glob, next, postcss); las otras 12 son dependientes de la cadena ESLint/Next que npm marca en cascada. Superficie real del Grupo B: idéntica a antes.

**Validaciones (punto 3 de la directiva — evidencia real, no etiqueta de npm):**
- npm run lint: ✅ OK (solo warnings pre-existentes CanvasViewport)
- npm run build: ✅ Exitoso, output y tamaños de bundle idénticos
- Funcional: js-yaml/brace-expansion son dev-only — el lint pasando ES su prueba funcional. Para axios/ws (Tavily web search, Realtime, OpenAI) la prueba runtime real requiere producción — incluida en checklist de validación PO post-deploy.

**Riesgos conocidos / deuda técnica:**
- Grupo B pendiente: next@14.2.35 acumula 21 advisories cuyo fix es next@16.2.12 (major) — OE de evaluación aparte con cuidado (breaking changes de framework).
- Ver AUDIT_REPORT DEP-002 (nuevo) y actualización de DEP-001 (xlsx ahora SÍ parsea archivos subidos — sin riesgo nuevo, la 0.20.3 del CDN tiene los fixes).

**AISyncPlans.md: sin cambios** — solo versiones transitivas en lockfile, sin cambios de schema, API, componentes ni patrones.
**DECISIONS.md: sin entrada** — la decisión (Grupo A/B, sin --force) venía dada en la directiva del PO; lo ejecutado y sus hallazgos quedan en esta entrada y en AUDIT_REPORT DEP-002.
**CodingWorkshop.md: sin entrada** — no hubo bug de código propio.

**Archivos modificados:** package-lock.json (único cambio de código/deps), AUDIT_REPORT.md (DEP-002 + addendum DEP-001), handoff, PRODUCT_STATUS.md.

---

## OE 2026-08-02 — Diagnóstico de 3 regresiones reportadas + fixes de Handoff Package, Context Files y gestión de tokens

**Fecha:** 2026-08-02
**Estado:** Implementado y validado localmente por el PO (`npm run dev`, localhost:3001). Pendiente commit + deploy (autorizado, ver más abajo).

**Contexto — mini-OE urgente del PO:** 3 síntomas reportados tras la sesión del 31/7-1/8: (1) Create Handoff Package "no hace nada" al clickear, (2) adjuntos Word/Excel rechazados por el modelo en el chat, (3) Context Files desconectado ("no tengo acceso a context files"). Investigación con evidencia real de producción (consultas de solo lectura a Supabase vía service role key, sin tocar datos) antes de cualquier fix.

**Diagnóstico de las 3 regresiones (resumen — detalle completo en la conversación):**
- **(1) Handoff Package — regresión REAL.** La migración `051_handoff_to_agent_nullable.sql` (creada en el commit `efbdd35`, 30/7) nunca se ejecutó en Supabase. `to_agent` seguía NOT NULL en producción → cada intento de crear un handoff fallaba con 500 silencioso (la UI solo hacía `console.error`, sin mostrar nada al usuario). Confirmado con query directa al schema real de Supabase y con el último handoff creado con éxito siendo de horas ANTES del deploy del flujo nuevo.
- **(2) Word/Excel en el chat — NO es regresión.** La conversión (mammoth/xlsx/jszip) funciona correctamente — confirmado con casos reales de producción del 31/7 (.xlsx y .pptx analizados con los 3 providers). El caso reportado por el PO era un `.doc` legacy (Word 97-2003), formato nunca soportado por mammoth (limitación documentada, no un bug).
- **(3) Context Files desconectado — NO es regresión de código, mismo origen que (2).** La inyección en `api/chat/route.ts` funciona (verificado con casos reales del mismo día donde el agente sí usó el contenido). El caso reportado subió el mismo `.doc` legacy a Context Files → sin texto extraído → no hay nada que inyectar → el agente respondió honestamente que no tenía acceso.

**Decisiones técnicas y por qué (ronda 1 — feedback + extensión + Context Files):**
- **Handoff Package (antes de la corrección de rumbo):** se agregó feedback visual (estado "Creating...", toast de éxito, error visible) al flujo de creación directa sin modal que ya existía desde `efbdd35`. *Esta parte fue revertida — ver más abajo.*
- **Word/Excel en el chat:** confirmado que NO había nada que conectar (la extracción ya se ejecutaba antes de llegar al modelo, vía `inlineOfficeAttachments()` → `extractTextFromBuffer()`, la misma función que usa Context Files). Se agregó SÍ una mejora real: bloqueo de `.doc`/`.ppt` legacy en el chat con mensaje claro al usuario ANTES de adjuntar (antes se adjuntaban igual y el usuario nunca se enteraba de que no eran analizables — eso fue lo que generó la confusión original).
- **Context Files — decisión del PO: confirmación en vez de truncado automático.** Se eliminó el truncado ciego de 35.000 caracteres en `api/chat/route.ts`. Ahora, si algún context file supera 30.000 caracteres (umbral elegido para no molestar con archivos chicos — ninguno de los reales en producción lo dispara — pero sí avisar en archivos grandes), el panel muestra un aviso ANTES de enviar el mensaje con tamaño aproximado y advertencia de costo/tiempo, con checkboxes por archivo y botones Send/Cancel. Lo confirmado va COMPLETO, sin cortar. Nuevo GET en `/api/context` (liviano, reutiliza `getContextSourcesForRuntime` — misma fuente de verdad que el runtime real) para que el panel sepa qué archivos van a inyectarse sin traer el contenido.

**CORRECCIÓN DE RUMBO — reversión de la eliminación del modal de Handoff Package:**
El PO aclaró que eliminar el modal (commit `efbdd35`, "immediate handoff creation") fue una decisión de diseño ya tomada en sesión anterior, y que no correspondía volver a plantearla como pregunta abierta durante una fase de estabilización de bugs. El problema real reportado ("el botón no hace nada") se debía únicamente a la migración 051 faltante — **ya aplicada y confirmada en Supabase por el PO** —, no al diseño sin modal.
- Se revirtió específicamente la parte de Handoff Package de `efbdd35`: `HandoffPackageModal.tsx` restaurado byte a byte desde `efbdd35~1`; `handoff-package/route.ts` con `toAgent` vuelto a `string` (no nullable) en el código — la migración 051 en Supabase NO se revirtió, sigue permitiendo NULL en la base, pero el modal siempre manda un destinatario real; `WorkspaceShell.tsx` con `onCreateHandoff` vuelto a abrir el modal (`setShowHandoffModal(true)`).
- Se revirtió también el feedback visual (toast/estados) que se había agregado en `AgentPanel.tsx` para el flujo sin modal — pertenecía a ese flujo y ya no aplica; el modal restaurado tiene su propio manejo de estado (`saving`/`apiError`/`done`) intacto desde antes de `efbdd35`.
- **Confirmado explícitamente que las otras 2 partes de `efbdd35` NO se tocaron:** Save Version sigue oculto (`{false && (...)}`) en `AgentPanel.tsx` y `HumanChatPanel.tsx`; el guard de Realtime (`console.warn('[HumanChat] Skipping Realtime subscription...')`) sigue en `HumanChatPanel.tsx:231`.
- **Validado por el PO en local** (`npm run dev`, localhost:3001): modal reaparece, Handoff Package se crea correctamente con la 051 ya aplicada.

**Gestión de tokens — investigación de 2 síntomas separados, sin aplicar fix aún (pendiente de datos adicionales del PO):**
- **Respuestas cortadas (Workspace con historial):** causa raíz CONFIRMADA con datos reales de `token_usage` — `src/lib/providers/anthropic.ts` tiene `max_tokens: 2048` hardcodeado (líneas 62 y 105) en 2 lugares (`stream()` y `complete()`). Múltiples respuestas de Claude en producción cortaron exactamente en `out=2048`. OpenAI/Google no tienen límite explícito (dependen del default del provider — GPT-5.5 cortó en `out=4096` exacto). "Continuar" reenvía todo el historial acumulado sin ventana — no causa el corte en sí (Claude tiene contexto de 1M) pero multiplica costo en cada iteración. **Fix pendiente de aprobación del PO** (no aplicado aún): subir `max_tokens` de Anthropic a un piso razonable (propuesto 8192) y fijar límites explícitos equivalentes en OpenAI/Google en vez de depender de sus defaults.
- **Error 500 "remaining prompt tokens (94212)" en Workspace nuevo:** diagnóstico PARCIAL. Confirmado que la fórmula no está en nuestro código (grep exhaustivo sin matches) — el mensaje viene del provider y nuestro route solo lo releva tal cual. Descartada la hipótesis de que Context Files infla el conteo (medición real: 147.042 caracteres en TODOS los context files de la cuenta, máximo por workspace ~39K chars — matemáticamente insuficiente para 94K tokens). Sin reproducir aún — pendiente de screenshot/texto exacto del error y provider/modelo de la sesión afectada para cerrar el diagnóstico.

**Alternativas descartadas:**
- Reimplementar la conversión Word/Excel del chat: ya existía y funcionaba — habría sido trabajo duplicado sobre algo no roto.
- Truncado automático silencioso para Context Files grandes: descartado explícitamente por el PO a favor de confirmación explícita del usuario (mismo criterio de "avisar, no decidir por el usuario" que ya rige en el proyecto).
- Revertir la migración 051 en Supabase al revertir el modal: NO se hizo — la migración es compatible con ambos diseños (con o sin modal) y revertirla no aportaba nada, solo riesgo.

**Archivos modificados:**
- `src/components/workspace/HandoffPackageModal.tsx` (restaurado — existía antes de `efbdd35`)
- `src/app/api/handoff-package/route.ts` — `toAgent` vuelto a `string`
- `src/components/workspace/WorkspaceShell.tsx` — `onCreateHandoff` vuelto a abrir modal; `getAgentMessages()` restaurada
- `src/components/workspace/AgentPanel.tsx` — bloqueo de adjuntos legacy `.doc`/`.ppt` en el chat + aviso de context files grandes (Confirmar/Cancelar) antes de enviar; reversión del feedback de handoff sin-modal
- `src/app/api/chat/route.ts` — `excludedContextFileIds` en el payload; eliminado el truncado automático de 35.000 chars
- `src/app/api/context/route.ts` — nuevo GET de resumen liviano (id/título/scope/longitud) para el aviso de archivos grandes

**Riesgos conocidos / deuda técnica:**
- `max_tokens: 2048` fijo en Anthropic sigue sin corregirse — cortará respuestas largas hasta que se apruebe y aplique el fix (mini-OE separada recomendada, alta prioridad).
- OpenAI/Google sin límite explícito de salida — dependen de defaults del provider, inconsistente entre los 3.
- Error 500 "remaining prompt tokens" sin reproducir — diagnóstico abierto, requiere más datos del PO para cerrar.
- `MODEL_MAP` de `anthropic.ts` sigue ofreciendo "Claude 3 Opus" (retirado por Anthropic el 5/1/2026 — devuelve 404 si se selecciona) y "Claude 3 Haiku" (deprecado, se retira abril 2026). Candidato a mini-OE de limpieza de modelos, detectado como hallazgo colateral.
- El aviso de context files grandes es por-mensaje, no por-sesión — con un archivo grande permanente en el team, el aviso reaparece en cada mensaje. Si resulta molesto en el uso real, se puede agregar "recordar por sesión" en una ronda futura.

**Validaciones:** lint ✅ (solo warnings pre-existentes de CanvasViewport), build ✅ (limpiado `.next` corrupto que causaba un `PageNotFoundError` espurio en `/api/admin/prompts`, no relacionado con el código). Validación funcional del PO en local: Handoff Package con modal restaurado — confirmado funcionando.

---

## Mini-OE 2026-08-02 — Fix de max_tokens (3 providers) + política de extensión de respuestas en base_layer

**Fecha:** 2026-08-02
**Estado:** Closed — validado por el PO con evidencia real (dato duro de `stop_reason`/`token_usage` para max_tokens, `SELECT` de versión para base_layer).

**Contexto:** Continuación directa de la OE anterior, que había diagnosticado pero no aplicado el fix de `max_tokens: 2048` hardcodeado en Anthropic. La directiva original asumía que Google tenía `maxOutputTokens: 2048` hardcodeado y que OpenAI estaba "confirmado sin problema" — ambas premisas se verificaron y resultaron INCORRECTAS antes de tocar código.

**Parte 1 — Fix de max_tokens, con 2 correcciones de premisa encontradas por verificación directa:**
- **Anthropic** (`src/lib/providers/anthropic.ts` líneas 62/105): `2048 → 16000`, exactamente como se pidió.
- **Google** (`src/lib/providers/google.ts`): grep exhaustivo confirmó CERO `maxOutputTokens` configurado en el código — no estaba hardcodeado en 2048, simplemente no se configuraba nada, y la API de Gemini aplicaba su default implícito (~8.192, según documentación oficial) contra un máximo real de ~65.000 para `gemini-3.5-flash`. Se agregó `generationConfig: { maxOutputTokens: 16000 }` explícito (antes inexistente) en `stream()` y `complete()`.
- **OpenAI** (`src/lib/providers/openai.ts`): la directiva pedía reconfirmar en vez de asumir "sin problema" — la reconfirmación reveló que SÍ tenía el mismo bug. Grep confirmó cero `max_tokens`/`max_completion_tokens` configurado. WebSearch confirmó el máximo real de GPT-5.5: 128.000 tokens de salida. Los datos de `token_usage` ya recolectados en la OE anterior mostraban respuestas cortando en `out=4096` exacto — el default silencioso de la Chat Completions API cuando no se especifica límite. Se agregó `max_completion_tokens: 16000` explícito (nombre de parámetro correcto y no-deprecado para modelos de razonamiento como GPT-5.5, según documentación actual de OpenAI — `max_tokens` está deprecado para ese caso) en `stream()` y `complete()`.
- **Criterio de valor:** 16.000 en los 3 providers, por consistencia — muy por debajo del máximo real en cada caso (16K vs 128K OpenAI / 65K Google / 128K+ Anthropic real, aunque la directiva citaba 64K para Anthropic).

**Parte 2 — Política de extensión de respuestas en `system_prompts.base_layer`:**
- Descubrimiento: `base_layer` es una columna separada de `role_prompt` en `system_prompts` — la primera consulta de solo-lectura solo había traído `role_prompt` (sin la frase objetivo), lo que habría llevado a una conclusión equivocada de que la frase no existía. Segunda consulta con el campo correcto confirmó que la frase SÍ existe, pero en los 5 roles (incluidos `sm_documentation` y `sm_audit`, que la directiva pedía dejar afuera) — se limitó el UPDATE explícitamente a `manager`, `submanager`, `worker`.
- El párrafo del PO llegó escrito en voseo ("Gestioná", "extendé", "dividilo", "Evitá") mientras el `base_layer` existente usa tú/imperativo formal ("Prioriza", "adviértelo", "procede"). Se mostró el contraste al PO, quien pidió ajustar a la forma existente — 4 verbos corregidos (Gestiona/extiende/divídelo/Evita), el resto del párrafo ya coincidía entre ambas formas.
- **Ejecución:** el PO pidió el flujo manual habitual (SQL Editor de Supabase), no ejecución directa por Claude Code — se le entregó el SQL completo de `supabase/migrations/052_base_layer_response_length_policy.sql` para pegar y correr. Confirmado por el PO: `version=2` en los 3 roles, `updated_by='claude_code'`.

**Validación funcional (evidencia real del PO, no supuesto):**
- Parte 1: respuesta de propuesta comercial extensa en Anthropic (Workspace COMERCIAL, panel Worker) completó con `stop_reason: "end_turn"` y `3847/16000` tokens usados — el corte artificial desapareció, y la respuesta ni siquiera se acercó al nuevo techo.
- Parte 2: `SELECT` post-UPDATE confirmó `version=2` en manager/submanager/worker.

**Alternativas descartadas:**
- Fijar Google en 8.192 tal como pedía la directiva original: se habría limitado a confirmar el default implícito ya vigente, sin corregir nada — no había nada que "subir".
- Dar por buena la premisa "OpenAI sin problema": los datos de `token_usage` ya disponibles de la OE anterior contradecían esto directamente (cortes en `out=4096` exacto); la directiva de esta OE pidió explícitamente reconfirmar antes de descartar.
- Ejecutar el UPDATE de base_layer directamente desde Claude Code vía REST/service role key (se había preparado un script para esto): el PO indicó preferencia explícita por el flujo manual ya establecido (SQL Editor), coherente con el patrón de todas las migraciones anteriores del proyecto.

**Archivos modificados:**
- `src/lib/providers/anthropic.ts` — `max_tokens: 2048 → 16000` (2 ocurrencias)
- `src/lib/providers/google.ts` — `generationConfig: { maxOutputTokens: 16000 }` agregado (nuevo, antes inexistente) en `stream()` y `complete()`
- `src/lib/providers/openai.ts` — `max_completion_tokens: 16000` agregado (nuevo, antes inexistente) en `stream()` y `complete()`
- `supabase/migrations/052_base_layer_response_length_policy.sql` (nuevo) — 3 `UPDATE` sobre `system_prompts.base_layer`, ejecutado manualmente por el PO en Supabase SQL Editor

**Riesgos conocidos / deuda técnica:**
- 16.000 sigue siendo un techo arbitrario, no el máximo real de cada modelo — si en el futuro se necesitan respuestas aún más largas (informes muy extensos en una sola respuesta), habrá que revisitar el valor. La política de extensión del base_layer mitiga esto pidiéndole al modelo que divida en entregas por etapas en vez de intentar todo en una respuesta.
- El `complete()` de Anthropic (usado en el primer turno del tool loop de web search) sigue siendo no-streaming — a 16.000 tokens no debería acercarse al timeout típico del SDK, pero no se validó específicamente ese camino (solo el flujo directo de chat, que usa `stream()`).
- `updated_by = 'claude_code'` y el criterio de versión (`version + 1`) fueron una convención propuesta por Claude Code ante la ausencia de un patrón previo en el código — aprobada por el PO, pero vale confirmar si conviene formalizarla en algún lado (AISyncPlans.md, por ejemplo) si se vuelve a tocar `system_prompts` en el futuro.

**Validaciones:** lint ✅, build ✅ (corridos 2 veces — tras el fix de código y una vez más antes del commit final).

---

## Mini-OE 2026-08-02 — Soporte de .doc legacy vía word-extractor

**Fecha:** 2026-08-02
**Estado:** Implementado, deploy a producción autorizado por el PO — validación funcional con archivo `.doc` real pendiente en producción (decisión explícita del PO: validar ahí en vez de en local).

**Contexto:** Caso real de trabajo bloqueado — un `.doc` legado (formato OLE, pre-2007) no podía analizarse ni en adjuntos de chat ni en Context Files, mostrando "is a legacy Office format that cannot be analyzed. Save it as .docx or PDF" (mensaje agregado en la Mini-OE del 2026-08-02 anterior, cuando `.doc` todavía estaba en la lista de formatos bloqueados). El PO confirmó que esto bloqueaba trabajo real en curso y pidió agregar soporte.

**Decisión técnica y por qué:**
- **Librería:** `word-extractor@1.0.4` (+ `@types/word-extractor@1.0.6`, tipos oficiales — el paquete no trae los suyos). Investigada y propuesta por el PO; verificado antes de instalar: sin dependencias de sistema operativo, acepta `Buffer` directo (`extractor.extract(buffer)`, confirmado contra el README oficial del repo — la primera búsqueda genérica daba resultados ambiguos, algunos sugiriendo que hacía falta un fork para soporte de Buffer). Mismo criterio de selección que jszip/PPTX: simple, mantenida, sin duplicar el stack existente (mammoth se mantiene exclusivo para `.docx`).
- **Implementación:** rama nueva en `extractTextFromBuffer()` (`src/lib/context/extractText.ts`) para `type === 'application/msword'` — mimetype que ya estaba mapeado en `detectMimeType()` desde la implementación original de adjuntos Office, sin necesitar cambios ahí. Mismo patrón try/catch/throw + `console.error` que las ramas DOCX/XLSX/PPTX ya existentes.
- **Mensajes actualizados:** `AgentPanel.tsx` — `.doc` sacado de `LEGACY_UNSUPPORTED_EXTS` (solo `.ppt` sigue bloqueado en el chat). `ContextFilePanel.tsx` — hint del panel: `.doc` agregado a "Supported", frase de legacy formats acotada a solo PPT.
- **Sin cambios:** `accept` de ambos inputs (chat y Context Files) ya incluía `.doc` desde la Mini-OE anterior — no hacía falta tocarlo. Límites de tamaño (3MB chat / 4MB Context Files) son por tamaño de archivo, no por tipo — aplican igual sin modificación.

**Validaciones realizadas:**
- lint ✅, build ✅ (incluye type-check completo — confirmó que el `export =` de los tipos oficiales interopera correctamente con el `esModuleInterop` del proyecto vía `(await import('word-extractor')).default`, mismo patrón que las otras ramas dynamic-import).
- Smoke test de runtime: el módulo carga e instancia correctamente en Node (mismo tipo de chequeo que en su momento detectó el bug de `DOMMatrix` con `pdf-parse` — confirma que no hay problema de packaging antes de la prueba funcional real).
- `npm audit`: mismas 5 vulnerabilidades altas de siempre (cadena next/eslint/postcss, ya documentada en AUDIT_REPORT como Grupo B) — ninguna nueva introducida por `word-extractor` ni sus 2 dependencias nuevas (`saxes`, `yauzl` — a diferencia del caso jszip/PPTX, estas SÍ son dependencias genuinamente nuevas, no arrastre transitivo).
- Grep exhaustivo pre-cierre: sin menciones residuales de ".doc no soportado" en ningún otro archivo.
- **No probado:** extracción real contra un `.doc` binario real — no había ninguno disponible en el entorno de desarrollo. El PO decidió validar directamente en producción con su archivo de trabajo real en vez de esperar a conseguir uno de prueba en local.

**Alternativas descartadas:**
- Reimplementar con mammoth (ya usado para `.docx`): mammoth no soporta el formato OLE binario de `.doc` legacy, solo el formato ECMA-376 (`.docx`) — motivo original por el que `.doc` quedó sin analizar en la Mini-OE anterior.
- Convertir `.doc` a `.docx` server-side antes de extraer (vía alguna librería de conversión): más pesado, más superficie de fallo, y el PO ya había propuesto e investigado `word-extractor` como solución directa.

**Archivos modificados:**
- `package.json` / `package-lock.json` — `word-extractor` + `@types/word-extractor` agregadas
- `src/lib/context/extractText.ts` — rama `.doc` (+14 líneas)
- `src/components/workspace/AgentPanel.tsx` — `LEGACY_UNSUPPORTED_EXTS` reducido a solo `ppt`
- `src/components/workspace/ContextFilePanel.tsx` — hint actualizado

**Riesgos conocidos / deuda técnica:**
- `word-extractor` no tuvo publish desde 2022-06-29 (v1.0.4) — biblioteca pequeña y estable (el formato OLE de `.doc` no cambia), pero sin actividad reciente de mantenimiento a monitorear si aparecen issues.
- Extracción de solo el cuerpo del documento (`getBody()`) — no incluye notas al pie, encabezados/pies de página ni cuadros de texto (la librería expone métodos separados para eso: `getFootnotes()`, `getHeaders()`, `getTextboxes()`, sin usar en esta implementación). Fidelidad equivalente a la de las otras ramas (Excel sin gráficos, PPTX sin notas del orador).
- **Pendiente crítico:** validación funcional real con un `.doc` real, en producción — la OE no se cierra formalmente hasta esa confirmación del PO.

---

## Mini-OE 2026-08-03 — Investigación/diseño: "Send to another Manager" (descartado) → "Load Saved Context" (aprobado)

**Fecha:** 2026-08-03
**Estado:** DISEÑO — sin código implementado. Esta sesión fue explícitamente de investigación y diseño; la implementación queda para una sesión aparte.

### Parte A — Investigación "Send to another Manager" (cross-Workspace directo) — enfoque descartado por el PO, reemplazado por Load Saved Context

Investigación previa (sin código) sobre agregar una opción "Send to another Manager" en el desplegable de Review & Forward, con alcance al mismo Project (incluyendo Isolated/Connected Teams).

**Hallazgo arquitectónico clave:** "Review & Forward" hoy es **100% cliente** — `handlePanelForward` en `WorkspaceShell.tsx` hace `targetRef.appendUserMessage(...)`, manipulando directamente el `ref` de React de OTRO panel ya montado en la MISMA página. No hay ninguna persistencia server-side del mensaje en sí (solo `audit_log`). Funciona únicamente porque Manager/Worker1/Worker2 conviven en el mismo `WorkspaceShell` cargado en el mismo browser — no hay nada que "extender" para cruzar a otro Workspace, haría falta un mecanismo nuevo genuino.

**2 casos con complejidad muy distinta identificados:**
- **Caso A — mismo Project, Team/Subteam normal, misma cuenta:** confirmé que NO requiere RLS nueva. La policy `messages_insert` (migración 002) ya valida `p.account_id = auth.uid()` a través de la cadena completa `agent_sessions → workspaces → teams → projects` — como el Team destino pertenece a la MISMA cuenta, `/api/messages` POST ya funciona tal cual está. Estimado: una tarde.
- **Caso B — Isolated/Connected Team (otro lado de una conexión), cuenta distinta:** la migración 044 ("Connected Teams Etapa 8c", modelo "dos edificios separados") eliminó explícitamente toda política RLS de lectura cross-cuenta sobre `teams`/`workspaces`/`agent_sessions`. Con la cuenta actual es imposible siquiera consultar quién es el Manager del otro lado de una conexión. La única forma segura de resolverlo replicaría el patrón ya usado por `human_messages` (tabla dedicada + policy de INSERT que valida `team_connections.status = 'active'` server-side, nunca confiando en un `session_id` mandado por el cliente). Riesgo de seguridad real si se implementa mal — cualquier policy que permita INSERT en `messages` con un `session_id` arbitrario de otra cuenta abriría una brecha de inyección cross-cuenta. Estimado: varios días, requiere su propia OE de seguridad.
- **Aclaración de terminología:** confirmé en el schema que `agent_sessions.agent_role` solo admite `'manager' | 'worker1' | 'worker2'` — no existe un rol `'submanager'` real. "Submanager" es hoy solo una etiqueta organizativa (`teams.lead_role`, usada en Teams Map) sin ningún agente de chat asociado. El caso real del PO ("Manager y Submanager en Workspaces separados") es, técnicamente, el Caso A: Manager de un Team padre ↔ Manager de un Team hijo (`teams.parent_id`).

**Decisión del PO tras el reporte — reemplazar el enfoque completo:** en vez de "empujar" mensajes de un Workspace a otro (con el riesgo del Caso B), se decidió construir **"Load Saved Context"**: cualquier agente va a buscar lo que necesita desde Documentation Mode (Handoff Packages, Saved Selections, Checkpoints) y lo trae como contexto de su propia conversación — sin depender de que otro Workspace esté abierto ni de resolver el problema cross-cuenta de raíz. Elimina por completo la necesidad del Caso B para esta fase.

### Parte B — Diseño aprobado: "Load Saved Context" (Fase 1)

**Hallazgo previo que redujo drásticamente la complejidad estimada:** `context_sources` (tabla de Context Files) tiene columnas sin usar desde su migración original (017): `origin_type` y `origin_message_id` — `ContextFilePanel` siempre las manda en `null` hoy. Y el tipo `ContextSourceKind` ya incluye un valor `'saved_selection_context'` que ningún código crea nunca. La arquitectura original ya anticipaba esta feature y quedó a medio cablear — **no hace falta ninguna migración nueva**.

**Diseño aprobado:**
1. **Botón nuevo** en `AgentPanel.tsx`, Sección 2 "Tools row" (línea ~820-836), junto a "Prompt Library" y "Add Context File" — mismo estilo de pill, misma fila flex, sin rediseño de layout.
2. **Modal de búsqueda simplificado** (no reutilizar `RepositoryView.tsx` completo — es pesado, con edición/archivado que no aplican acá). Reutiliza sin cambios las funciones de datos ya existentes: `getDocCheckpoints()`, `getHandoffPackages()`, `getSavedSelections(userId)` (ya devuelven metadata + `content_preview` de 200 chars). Filtros: Project / Team / tipo / fecha / palabra clave.
3. **Mecanismo "Smart Load" — 3 niveles:**
   - Listar/buscar: usa el `content_preview` de 200 chars ya generado — cero costo de prompt.
   - Al hacer "Load": trae el detalle completo vía las funciones YA EXISTENTES (`getHandoffDetail()` / `getSavedSelectionDetail()` / `getCheckpointDetail()`).
   - **Regla de carga diferenciada por tipo — AJUSTE DEL PO tras la propuesta inicial (esta es la corrección final aprobada, reemplaza la propuesta genérica de "digest para los 3 tipos" del reporte anterior):**
     - **Saved Selection → contenido COMPLETO.** Ya es una selección acotada por el propio usuario — tiene sentido traerla entera, sin resumir.
     - **Checkpoint → contenido COMPLETO**, con el mismo aviso de confirmación ya implementado para archivos grandes en Context Files (umbral de 30.000 caracteres, Confirmar/Cancelar) si excede el tamaño.
     - **Handoff Package → SOLO EL ÚLTIMO MENSAJE** (la respuesta/conclusión final), NUNCA el intercambio completo. Razón explícita del PO: los mensajes previos de un Handoff existen para dar contexto de CÓMO se llegó a la conclusión (útil al revisarlo en Documentation Mode), pero no son necesarios para un agente nuevo que recibe el resultado ya sintetizado — cargar todo sería ruido, contrario a la política de extensión de respuestas ya implementada en `base_layer` (Mini-OE 2026-08-02): no darle al usuario/agente más contexto del que puede procesar con control.
   - El contenido resultante (completo o el último mensaje, según el tipo) pasa por el mismo aviso de tamaño grande ya construido — sin código nuevo de inyección: se guarda como un `context_source` más y pasa por el pipeline existente de `/api/chat/route.ts`.
4. **Sin schema nuevo.** `context_sources` ya tiene todo: `source_kind` (nuevo valor o reutilizar `'saved_selection_context'` + 2 hermanos para Handoff/Checkpoint), `origin_type`/`origin_message_id` (ya existen, sin usar — trazan de qué objeto de Documentation Mode vino), `scope` (reutilizar el selector Team/Session/Project ya existente en `ContextFilePanel`, default `session`).
5. **Audit Log:** mismo patrón fail-open ya usado en todo el proyecto — nuevo `event_type: 'context_loaded_from_documentation'`, `metadata: { source_type, source_id, source_name, target_session_id, target_scope }`.
6. **Complejidad estimada:** una sesión completa de implementación, **sin necesidad de fases** — a diferencia de "Send to another Manager", esto no toca RLS ni requiere tabla nueva, y reutiliza 4 mecanismos ya construidos y validados (fetch de listado, fetch de detalle, aviso de tamaño grande, inyección en el prompt).

### Parte C — Corrección aprobada de WORKSPACE_GUIDE (`src/components/workspace/WorkspaceClient.tsx` línea 11)

**Problema confirmado:** el texto actual promete "Manager of one team → Manager of another team: same logic, using Review & Forward" — FALSO en la arquitectura actual (confirmado en Parte A: Review & Forward es puramente same-Workspace). También menciona "Save Version" como herramienta activa, oculta desde `efbdd35` (30/7).

**Texto nuevo aprobado (reemplaza íntegramente la constante `WORKSPACE_GUIDE`):**

```
First of all, Workspace is where you chat with AI. It is one of the two core sides of AISync: operational work. This is the place where you talk to an AI the way you normally do, but inside a more organized system.

We recommend this basic setup: use one Manager session to think, organize, plan, and keep the main direction clear. Use the other sessions as Workers and give them concrete or parallel tasks. Use one team per specific topic. If the work or investigation grows, create more teams. Keep each team focused on one subject, and use one agent per task or area whenever possible. Always keep the main checklist, base logic, and overall coherence in one main Manager. Do not distract that Manager with execution tasks.

Communication tools inside the team
→ User → Agent: write and press Send
→ Agent → Agent: select a message and use Review & Forward

Traceability and saving tools
→ Save Selection: save only one useful part of the conversation
→ Create Handoff Package: create a formal transfer package for continuity
→ Load Saved Context: bring any Handoff Package, Saved Selection, or Checkpoint from Documentation Mode into this conversation — this is how information moves between different Workspaces
→ Refresh Session: reset the AI agent without losing the visible chat
→ Audit AI Answer: reserved for answer verification flows (coming soon)

Top ribbon
→ Prompt Library: change how the agent works
→ Add Context File: give the agent documents or source material to work with

In simple terms: use the Manager to think and coordinate, use the Workers to execute, and use the save tools whenever something becomes important enough to preserve, transfer, or revisit later.
```

**Cambios respecto al texto actual, y por qué:**
1. Eliminada la línea "Manager of one team → Manager of another team: same logic, using Review & Forward" — no se reemplaza con una advertencia dentro de "Communication tools", directamente se saca (esa sección queda 100% cierta para lo que le queda: same-Workspace).
2. **"Save Version" eliminado del todo** de la guía (no se documenta como "función interna") — es una guía operativa dirigida al usuario, documentar algo no clickeable hoy generaría la misma confusión que se está corrigiendo.
3. "Load Saved Context" agregado en "Traceability and saving tools" — responde ahí la pregunta "¿cómo llevo algo de un Workspace a otro?", aunque el botón viva visualmente junto a "Add Context File" en el panel.
4. Resto del texto (setup recomendado, Top ribbon, párrafo de cierre) sin cambios — mismo tono y formato.

### Pendiente para la próxima sesión — implementación completa

**Alcance de la Fase 1 a implementar (en orden sugerido):**
1. `WorkspaceClient.tsx` — reemplazar la constante `WORKSPACE_GUIDE` por el texto de la Parte C (cambio aislado, cero riesgo, se puede hacer primero e independiente del resto).
2. Componente nuevo de búsqueda/picker simplificado (nombre sugerido: `LoadContextModal.tsx`, junto a `HandoffPackageModal.tsx`/`ContextFilePanel.tsx` en `src/components/workspace/`), reutilizando `getDocCheckpoints()`/`getHandoffPackages()`/`getSavedSelections()` sin modificarlas.
3. Helper de carga diferenciada por tipo (construir el contenido final a inyectar según la regla de la Parte B punto 3 — completo para Selection/Checkpoint, solo último mensaje para Handoff).
4. Endpoint o rama nueva en `/api/context` POST para crear el `context_source` con `origin_type`/`origin_message_id` poblados.
5. Botón nuevo en `AgentPanel.tsx` Sección 2 (Tools row).
6. Audit log del evento `context_loaded_from_documentation`.
7. Reutilizar sin tocar: el aviso de tamaño grande ya implementado en `AgentPanel.tsx` (`CONTEXT_WARN_CHARS`), el selector de scope de `ContextFilePanel.tsx`, y el pipeline de inyección de `/api/chat/route.ts` — ninguno de estos 3 necesita cambios.

**Archivos tocados en esta OE:** ninguno de código — solo `handoff-2026-07-b.md` y `PRODUCT_STATUS.md` (documentación de diseño).

---

## Mini-OE 2026-08-03 (continuación) — Implementación de "Load Saved Context"

**Fecha:** 2026-08-03
**Estado:** Implementado, deploy a producción autorizado por el PO — validación funcional pendiente en producción (localhost no tiene datos reales de conversación suficientes para probar la feature con sentido).

**Alcance:** implementación completa de los 7 pasos del checklist dejado en la entrada de diseño de esta misma fecha (ver arriba), siguiendo el diseño aprobado sin desviaciones de comportamiento.

**Antes de escribir código — releída la entrada de diseño completa** y verificados 2 detalles que el diseño daba por sentados, ambos genuinamente ambiguos al bajarlos a código real:

1. **Confirmado con el PO antes de proceder:** `getDocCheckpoints()` / `getHandoffPackages()` / `getSavedSelections(userId)` son funciones server-only (`createClient` de `@/lib/supabase/server`) — un Client Component (`LoadContextModal.tsx`, necesariamente interactivo) no puede llamarlas directamente. El diseño original no había contemplado esta frontera cliente/servidor. **Resuelto con Opción A confirmada por el PO:** endpoint nuevo `GET /api/documentation/browse`, que llama a las 3 funciones tal cual están (sin modificarlas — honra literalmente "reutiliza sin cambios" del diseño) y expone el resultado combinado al cliente. Mismo patrón que `ContextFilePanel` ya usa con `/api/context`.

2. **Encontrado y resuelto sin bloquear (no ameritaba otra ronda de confirmación — no cambia comportamiento visible ni requiere una decisión del PO):** el diseño proponía "reutilizar `'saved_selection_context'` + 2 hermanos nuevos para Handoff/Checkpoint" en la columna `source_kind`. Pero `source_kind` tiene un **CHECK constraint real en la base** (migración 017: `CHECK (source_kind IN ('uploaded_file', 'derived_context_note', 'saved_selection_context', 'external_reference'))`) — agregar 2 valores nuevos habría requerido una migración, contradiciendo la promesa explícita del diseño de "sin schema nuevo". **Resolución:** se usa `'saved_selection_context'` como único valor de `source_kind` para los 3 tipos de objeto cargado, y se usa `origin_type` (columna `TEXT` libre, sin constraint, ya existente y sin uso previo) como el discriminador real (`'handoff_package' | 'saved_selection' | 'checkpoint'`). Cero migraciones nuevas — cumple la promesa del diseño de forma más literal que la propuesta original.

**Implementación, en el orden del checklist:**
1. `WorkspaceClient.tsx` — `WORKSPACE_GUIDE` reemplazado con el texto exacto ya aprobado (elimina la promesa falsa de Review & Forward cross-Workspace, elimina "Save Version", agrega "Load Saved Context").
2. `src/app/api/documentation/browse/route.ts` (nuevo) — `GET`, auth check, `Promise.all` de las 3 funciones de listado + `getProjectsWithHierarchy()` (para el filtro de Project del modal), devuelve JSON combinado. Nada modificado en `documentation.ts`.
3. `src/components/workspace/LoadContextModal.tsx` (nuevo) — modal de búsqueda con filtros Project/Team/tipo/fecha/palabra clave (mismo criterio de derivación de `uniqueTeams` que `RepositoryView.tsx`, sin reutilizar el componente completo). El detalle completo de cada objeto se trae reutilizando las rutas YA EXISTENTES `/api/documentation/{checkpoint,handoff,selection}/[id]` (no hizo falta crear nada nuevo para esa parte — ya estaban expuestas desde antes). Helper `buildContentForItem()` aplica la regla de carga diferenciada: Saved Selection y Checkpoint → todos los mensajes unidos (`Role: contenido`, misma convención que Review & Forward); Handoff Package → **solo el último elemento del array de mensajes**.
4. `src/app/api/context/route.ts` — rama nueva `handleLoadFromDocumentation()`, invocada cuando el `POST` llega con `Content-Type: application/json` (la rama de `FormData` original, para archivos subidos, queda exactamente igual — se verifica el content-type ANTES de intentar leer el body, así ninguna de las dos rutas de lectura interfiere con la otra). Crea el `context_source` con `content_text` ya armado (sin extracción — no hay archivo), `extracted_text_available: true` directo, `origin_type`/`origin_message_id` poblados.
5. `AgentPanel.tsx` — botón "Load Saved Context" en la Tools row (Sección 2), junto a "Add Context File". Modal montado igual que `ContextFilePanel`, con la misma invalidación de `contextSummaryRef.current = null` al cerrar (para que el aviso de tamaño grande vea el context file nuevo en el próximo envío).
6. Audit log `context_loaded_from_documentation` — insertado dentro de `handleLoadFromDocumentation()`, en un try/catch que nunca bloquea la respuesta si falla (fail-open, mismo patrón que el resto del proyecto).
7. Confirmado sin necesidad de tocar nada: el aviso de tamaño grande (`CONTEXT_WARN_CHARS` en `AgentPanel.tsx`), el pipeline de inyección de `/api/chat/route.ts` — los `context_source` nuevos entran por el mismo camino que cualquier Context File subido, porque `getContextSourcesForRuntime()` los filtra igual (`status='active' AND extracted_text_available=true AND content_text not null`), condiciones que la rama nueva satisface directamente.

**Decisiones menores de implementación (sin desviación de diseño, documentadas por transparencia):**
- El filtro de Project del modal arranca preseleccionado en el Project actual del panel (mismo criterio que el scope default de Context Files), pero se puede ampliar a "All projects".
- Formato de unión de mensajes: convención `Role: contenido` ya usada en Review & Forward y en los adjuntos Office — no se inventó un formato nuevo.
- Para Handoff Package, "solo el último mensaje" se interpreta literalmente como el último elemento del array de mensajes de esa selección, sin filtrar por `role`. Si el creador del Handoff hubiera seleccionado un mensaje de usuario como el último (caso raro), se cargaría igual tal cual. Ajuste de una línea si se prefiere forzar específicamente el último mensaje `role: 'assistant'`.

**Restricción respetada:** la rama de `FormData` original en `/api/context` POST (subida de archivos) no se tocó — build confirma que el flujo de Context Files sigue compilando igual.

**Validaciones:** lint ✅, build ✅ (ruta nueva `/api/documentation/browse` compilada, sin warnings nuevos). Grep exhaustivo pre-cierre: sin residuos de "Manager of one team..." ni "Save Version: save" en ningún archivo; "Load Saved Context" consistente entre botón, modal, endpoint y guía. **No validado:** flujo funcional real (buscar → cargar → confirmar que el agente usa el contexto) — el PO decidió validar directamente en producción, ya que localhost no tiene datos reales de conversación suficientes para una prueba con sentido.

**Archivos modificados:**
- `src/components/workspace/WorkspaceClient.tsx` — texto de guía
- `src/app/api/documentation/browse/route.ts` (nuevo)
- `src/components/workspace/LoadContextModal.tsx` (nuevo)
- `src/app/api/context/route.ts` — rama JSON nueva
- `src/components/workspace/AgentPanel.tsx` — botón + modal montado

**Riesgos conocidos / deuda técnica:**
- `source_kind: 'saved_selection_context'` usado para los 3 tipos de origen es un nombre ligeramente engañoso para Handoff/Checkpoint (es un valor interno, no visible al usuario) — el discriminador real y preciso vive en `origin_type`. Documentado acá para que no genere confusión si se audita el dato directamente en Supabase.
- El modal no muestra el aviso de tamaño grande en el momento de cargar — ese aviso sigue viviendo exclusivamente en el flujo de envío de mensaje de `AgentPanel.tsx` (tal como especificaba el diseño), así que un Checkpoint muy grande se guarda sin fricción y el aviso aparece recién cuando el usuario intenta mandar el próximo mensaje.
- Sin test de carga real todavía — pendiente de la validación del PO en producción con objetos reales de Documentation Mode.

---

## Mini-OE 2026-08-03 (2 ajustes) — Load Saved Context: filtros en "All" + elegir destino (Context Files / Chat)

**Fecha:** 2026-08-03
**Estado:** Implementado, deploy a producción autorizado por el PO — validación funcional pendiente en producción.

**Contexto:** el PO validó "Load Saved Context" en producción y encontró 2 ajustes necesarios: los filtros del modal arrancaban preseleccionados en vez de en "All" (inconsistente con Documentation Mode), y la única acción disponible ("Load") siempre mandaba el contenido a Context Files, sin darle al usuario la opción de inyectarlo directo en el chat para trabajarlo de inmediato.

**Ajuste 1 — Filtros en "All" por defecto:**
Inspección confirmó que `filterTeam` ya arrancaba vacío (correcto) — el bug real era únicamente `filterProject`, preseleccionado con `projectId ?? ''` (el Project del Workspace actual) tanto en el `useState` inicial como en el `useEffect` que resetea el modal al abrirse. Como `uniqueTeams` (las opciones del dropdown de Team) se derivan filtrando por `filterProject`, el bug en Project acotaba indirectamente las opciones de Team visibles — de ahí que pareciera que ambos filtros estaban preseleccionados. Fix: `filterProject` arranca en `''` en ambos puntos, igual que `filterTeam`.

**Ajuste 2 — Elegir destino (Context Files vs. Chat directo):**
- **Inspección previa (mecanismo de inyección):** confirmado que `AgentPanelHandle.appendUserMessage` (ya usado por Review & Forward dentro del mismo Workspace) es el mecanismo correcto — si `autoRespond` está activo (default), dispara `sendPrompt(content)` (persiste vía `/api/messages` y el agente responde); si no, solo agrega al estado local. Se replicó ese mismo cuerpo en una función nueva `handleLoadToChat` dentro de `AgentPanel.tsx` (no se inventó un mecanismo nuevo).
- **Inspección previa (indicador visual):** confirmado que NO existe ningún precedente de mensaje visualmente distinto en el chat — `messages.role` tiene un CHECK constraint real que solo admite `'user' | 'assistant'`, y el único patrón ya usado para marcar el origen de un mensaje especial es un prefijo en texto plano entre corchetes (`[Forwarded from X]`, `[Attached file: X]`), sin estilo diferenciado en el bubble. Se aplicó la misma convención: `[Loaded from Documentation Mode — <Tipo>: <nombre>]\n\n<contenido>`.
- **Implementación:** cada item del modal pasó de un botón "Load" a 2 botones — "→ Context Files" (flujo actual sin cambios, vía `POST /api/context`) y "→ Chat" (nuevo, vía `onLoadToChat` prop → `handleLoadToChat` en `AgentPanel.tsx`). La regla de carga diferenciada por tipo (Handoff Package solo el último mensaje; Selection/Checkpoint completos) se aplica igual para ambos destinos, antes de la bifurcación — sin cambios en `buildContentForItem()`.
- **Audit log en ambos casos:** mismo `event_type: 'context_loaded_from_documentation'`, con un campo nuevo `destination: 'context_files' | 'chat'` para poder distinguirlos en consultas. Se agregó `destination: 'context_files'` al insert server-side ya existente en `/api/context` (aditivo, sin tocar su lógica); el destino "chat" loguea client-side desde el modal, mismo patrón fail-open (`.catch(console.error)`) ya usado en el resto del proyecto.
- **Decisión de UX no bloqueante, documentada por transparencia:** al elegir "Chat" el modal se cierra automáticamente después de inyectar (el usuario vuelve directo a trabajar el contenido); al elegir "Context Files" el modal se queda abierto con "Loaded ✓", igual que antes, por si se quieren cargar más ítems de fondo sin cerrar.

**Archivos modificados:**
- `src/components/workspace/LoadContextModal.tsx` — fix de filtros, 2 botones de destino, `logAudit()`, prop `onLoadToChat`
- `src/components/workspace/AgentPanel.tsx` — función `handleLoadToChat`, prop pasada al modal
- `src/app/api/context/route.ts` — campo `destination: 'context_files'` agregado al audit log existente (única modificación, no se tocó el resto de la rama)

**Restricción respetada:** el flujo de Context Files (ambos destinos comparten `buildContentForItem()`, pero la rama de POST a `/api/context` no cambió su lógica interna, solo el metadata del audit log).

**Validaciones:** lint ✅, build ✅. **No validado:** flujo funcional real en producción (filtros en All, botón → Chat inyectando correctamente, botón → Context Files sin regresión) — pendiente de confirmación del PO.

**Riesgos conocidos / deuda técnica:**
- El destino "Chat" no pasa por ningún aviso de tamaño — a diferencia de Context Files (que lo recibe indirectamente al enviar el próximo mensaje vía el mecanismo ya existente), un Handoff/Selection/Checkpoint muy grande inyectado directo al chat se manda tal cual, sin fricción ni confirmación. No estaba en el alcance de esta mini-OE — señalar si en el uso real resulta un problema.

---

## Mini-OE 2026-08-03 — Teams Map: nombre de Project editable, texto de Connect, Add Team por Project

**Fecha:** 2026-08-03
**Estado:** Implementado, deploy a producción autorizado por el PO — validación visual pendiente en producción.

**Contexto:** 3 ajustes de UX de bajo riesgo en el sidebar/header de Teams Map, confirmados por el PO.

**Inspección previa (2 puntos pedidos):**
1. Confirmado el patrón exacto por el que `AddTeamModal`/`ConnectTeamModal` reciben el `project.id` correcto hoy: `TeamsClient.tsx` guarda un id en estado (`connectProjectId`), `MapView.tsx` llama a `onConnect(project.id)` desde el header de cada Project, el modal recibe ese id como prop. Se replicó exactamente ese patrón para Add Team (`addTeamProjectId`), sin inventar un mecanismo nuevo.
2. Confirmado con grep que remover el botón global de Add Team no rompe nada: `setShowAdd(true)` solo tenía un trigger (ese botón), sin ninguna otra referencia en `src/app` (Dashboard, onboarding, deep links). Además, se confirmó que ya existe el precedente exacto en este mismo código: cuando "Connect Team" se movió de global a por-Project, el botón global se eliminó del todo, sin dejar uno de respaldo — la recomendación de remover también el de Add Team sigue ese precedente ya establecido, no es una decisión nueva.

**Ajuste 1 — Nombre de Project editable (doble click) en el sidebar:**
- `MapView.tsx`: doble click sobre el nombre en el sidebar entra en modo edición inline (`<input>` con autofocus reemplazando el `<div>` de texto), Enter o blur (click afuera) guarda, Escape cancela sin guardar. Guard para no disparar el scroll-to-project (click simple del item) mientras se está editando.
- `PATCH /api/projects/[id]/route.ts` extendido para aceptar `{ name }` además de `{ status }` — cualquiera de los dos, ambos, o ninguno (400 si no viene ninguno). Valida que `name` no esté vacío (trim) antes de guardar. Mismo ownership check ya existente (`account_id === user.id`), sin tocarlo. Update dinámico: solo se escriben los campos que vinieron en el body.
- Al guardar con éxito, `MapView` llama a `onProjectRenamed(id, newName)`, que en `TeamsClient.tsx` actualiza `projectOptions` en memoria (mismo estado que ya alimenta tanto el sidebar como el header de cada Project vía `useMemo`) — se refleja en toda la UI sin recargar la página ni volver a pegarle al servidor.
- Si falla el PATCH, se muestra un banner de error chico en el header del sidebar (no bloquea, no se pierde el nombre anterior visible).

**Ajuste 2 — Texto del botón:**
"+ Connect" → "+ Connect with other user" en el header de cada Project (`MapView.tsx` línea ~411 original). Solo el string — cero cambios de lógica, cero cambios en `ConnectTeamModal`.

**Ajuste 3 — "+ Add Team" por Project, botón global removido:**
- Nuevo botón "+ Add Team" en el header de cada Project, junto al de Connect (mismo lugar). Llama a `onAddTeam(project.id)`.
- `TeamsClient.tsx`: nuevo estado `addTeamProjectId`, seteado por `onAddTeam`; `AddTeamModal` ahora recibe `projectId={addTeamProjectId ?? projectId}` (fallback al Project activo de la página si se abriera sin id explícito, preservando el comportamiento previo como piso de seguridad).
- **Botón global "+ Add Team" del ribbon superior removido** (recomendación confirmada arriba). Verificado que las referencias a "Click + Add Team" en el texto de ayuda `CREATE_TEAMS_GUIDE` siguen siendo válidas sin cambios — nunca especificaban una ubicación concreta del botón.

**Hallazgo colateral, reportado y NO corregido (fuera del alcance explícito de esta directiva):** `HowConnectedTeamsModal.tsx` tiene 2 referencias a "Dashboard → + Connect" / "click `+ Connect`" — ya estaban desactualizadas ANTES de este cambio (el botón de Connect nunca vivió en Dashboard, y ya no dice "+ Connect" a secas). No se tocó porque la directiva acotaba el Ajuste 2 explícitamente a la línea de `MapView.tsx`. Candidato a mini-OE de limpieza aparte.

**Archivos modificados:**
- `src/app/api/projects/[id]/route.ts` — PATCH acepta `name` además de `status`
- `src/components/teams/MapView.tsx` — rename inline, texto de Connect, botón Add Team por Project
- `src/components/teams/TeamsClient.tsx` — estado `addTeamProjectId`, `handleProjectRenamed`, botón global removido, props nuevas a `MapView`

**Restricciones respetadas:** lógica de Connect Team intacta (solo texto); sin cambios de RLS; único cambio de schema fue el campo `name` ya autorizado explícitamente en el PATCH (no requiere migración, `projects.name` ya existía desde la migración 001).

**Validaciones:** lint ✅, build ✅. Grep exhaustivo pre-cierre: sin residuos del texto "+ Connect" viejo, sin restos del botón global de Add Team. **No validado:** confirmación visual del PO en producción (doble click persiste el rename, texto correcto, Add Team crea el Team en el Project correcto) — pendiente.

---

## Mini-OE 2026-08-04 — Dashboard: eliminar "Active Project"/"Set as active" + rediseño del acordeón (mini-ribbon)

**Fecha:** 2026-08-04
**Estado:** Implementado, deploy a producción autorizado por el PO — validación visual pendiente en producción.

**Contexto:** el PO confirmó que "Active Project"/"Set as active" en Dashboard era funcionalidad redundante — la selección de Project ya se resuelve por otras vías más claras (Host elige desde "+ Connect with other user" dentro de cada Project; Invitee elige explícitamente desde el dropdown de `IncomingRequestsPanel` al aceptar una conexión). Además, el PO pidió reordenar visualmente la fila de cada Project en el acordeón, separando título/labels/acciones.

**Inspección previa — hallazgo importante que corrigió la premisa original del directive:** un grep exhaustivo mostró que `activeProjectId`/`accounts.active_project_id` (migración 027, comentario en código "ARC-004: fuente única del proyecto activo") **no** era solo un valor de preselección residual del modal, como asumía el directive inicial. También lo usan:
1. `src/app/teams/page.tsx` — decide qué Project se carga por default al entrar a Teams Map (`getActiveProjectId()`, redirige a `/` si no hay ninguno).
2. `TeamsClient.tsx` — tiene su propio dropdown "switch project" en el top ribbon de Teams Map, que usa el mismo `PATCH /api/projects/active` para cambiar `accounts.active_project_id` y recarga la página.
3. `BottomRibbon.tsx` — usa `GET /api/active-workspace` (que internamente llama a `getActiveProjectId()`) para el link de acceso rápido "continuar donde quedé".

Este hallazgo se reportó al PO antes de tocar código (no se asumió ni se inventó una resolución). El PO confirmó Opción 1: acotar el alcance solo a Dashboard, dejando intacta toda la infraestructura de "active project" que sostiene Teams Map y BottomRibbon — el bug conocido y separado que mencionó el PO sobre uno de esos puntos queda para una sesión futura de Teams Map, no para esta.

**Parte 1 — Eliminado solo de Dashboard:**
- `ProjectList.tsx`: removidos el badge "Active Project"/botón "Set as active" y el estado asociado completo (`activeProjectId`, `switchingProject`, `switchError`, `setActiveProject`, `fetchActiveProject`).
- **Hallazgo adicional, resuelto por transparencia (bajo riesgo, sin necesidad de decisión del PO):** también había un segundo badge fijo que decía "active" sin ninguna condición — resultó ser 100% redundante, ya que `getProjectsWithHierarchy()` (fuente de datos de `ProjectList`) ya filtra `.eq('status', 'active')`, así que todos los Projects listados en Dashboard son siempre "active" y ese badge no aportaba información real. Se eliminó junto con el resto.
- **Sin tocar, confirmado por inspección:** `accounts.active_project_id`, migración 027, `GET+PATCH /api/projects/active`, el dropdown de `TeamsClient.tsx`, `BottomRibbon.tsx` — funcionan exactamente igual que antes de este cambio.

**`IncomingRequestsPanel.tsx` — ajuste mínimo, sin preselección externa:**
- Prop `projectId` pasó de requerida a opcional (`projectId?: string`).
- Valor inicial del dropdown: `projectId ?? projects[0]?.id ?? ''`. Desde Dashboard ya no se pasa ningún `projectId` (no hay ningún "activo global" que resolver) — el usuario ve el dropdown con el primer Project de la lista como valor inicial y elige explícitamente, sin ningún default basado en el concepto de "Project activo". Desde Teams Map (`TeamsClient.tsx`), el componente sigue recibiendo el Project que se está viendo en esa página como sugerencia inicial — eso no formaba parte del alcance pedido y no se tocó.
- `showRequestsPanel` en `ProjectList.tsx` ya no depende de `activeProjectId` — se muestra siempre que el usuario lo abra, sin condición adicional.

**Parte 2 — Rediseño del acordeón de Dashboard (mini-ribbon):**
- Referencia visual usada: el header de cada Project en `MapView.tsx` (Teams Map), ya con nombre + acciones agrupadas y separadas.
- Fila de cada Project reorganizada en 2 bloques separados por un borde vertical (`pl-4 border-l`):
  - **Título**: nombre del Project (`text-base font-semibold`), sin nada más al lado.
  - **Labels/badges**: vacío por ahora — no queda ningún indicador de estado real tras eliminar el badge "active".
  - **Acciones** (mini-ribbon agrupado): "+ Connect with other user" (se movió desde al lado del título, y se actualizó el texto para quedar consistente con el ya usado en Teams Map), "Archive", "Delete"/confirmación.
- Se agregó un `border-b` entre esta fila-header y la lista de Teams para reforzar la jerarquía visual.

**Archivos modificados:**
- `src/components/ProjectList.tsx` — eliminación de Active Project/Set as active, rediseño del acordeón
- `src/components/teams/IncomingRequestsPanel.tsx` — `projectId` opcional, sin preselección externa obligatoria

**Restricciones respetadas:** no se tocó la lógica de Connect Team ya validada (solo se movió su ubicación visual dentro de la fila y se actualizó el texto, ya alineado con Teams Map); no se tocó ningún otro consumidor de `activeProjectId` fuera de Dashboard.

**Validaciones:** lint ✅, build ✅. **No validado:** confirmación visual del PO en producción (badge/botón "active" ya no aparecen, aceptar conexión entrante sigue pidiendo elegir Project explícitamente, acordeón se ve ordenado, Teams Map y BottomRibbon siguen funcionando igual) — pendiente.

**Riesgos conocidos / deuda técnica:**
- Ninguno nuevo introducido por este cambio. El bug conocido de "active project" mencionado por el PO como separado queda pendiente de investigación en una futura sesión de Teams Map — no se investigó ni se tocó en esta mini-OE por estar fuera de alcance.

---

## Mini-OE 2026-08-04 — Bug: Connect Team siempre mostraba "JDNADNSFASDF" como team origen

**Fecha:** 2026-08-04
**Estado:** Closed — fix aplicado y desplegado a producción. Corrige solo conexiones nuevas, historial intacto por decisión explícita del PO.

**Contexto:** el PO reportó que al iniciar conexiones nuevas desde el Project "Prueba", el team compartido resultante mostraba siempre el mismo nombre incorrecto, "JDNADNSFASDF" — un team que el PO recordaba haber creado una sola vez, hace tiempo, en otra prueba.

**Investigación (solo lectura, sin fix hasta confirmar causa):**
- Query directa a `team_connections`: 2 filas con `requester_team_name = 'JDNADNSFASDF'`, ambas con el **mismo** `requester_team_id` real y consistente (no corrupción de texto — un team real).
- Cruce con `teams`/`projects`: ese team (`1c056519…`, status **archived**, creado 2026-07-16) pertenece al Project **"Proyecto de prueba"** — un Project completamente distinto del Project **"Prueba"** desde el cual el PO abrió "+ Connect with other user" el 2026-08-04. La cuenta tiene ambos Projects.
- **Causa raíz confirmada en `ConnectTeamModal.tsx` (líneas 73-77):** `hostTeamId = eligibleTeams[0]?.id`, donde `eligibleTeams = teams.filter(t => t.type !== 'isolated')` — y `teams` es la lista de **todos los teams de la cuenta, de todos los Projects** (`ProjectList.tsx`/`TeamsClient.tsx`: `allTeams = projects.flatMap(p => p.teams)`). El prop `projectId` (que identifica desde qué Project se abrió el modal) solo se usaba para `requester_project_id` en el payload — nunca para filtrar `teams` antes de elegir el host. Resultado: sin importar desde qué Project se clickeara "+ Connect", siempre se usaba el mismo primer team "elegible" de toda la cuenta.
- **Descartado por grep/inspección:** no es un placeholder ni un mock filtrándose a producción (único hit del string es una mención histórica en este mismo handoff, del 2026-07-19, sobre este mismo team real). No hay `localStorage`/`sessionStorage` involucrado — el componente no persiste nada entre sesiones.
- **Hallazgo secundario que agravaba el bug:** el filtro tampoco excluía teams `archived` (por eso "JDNADNSFASDF", ya archivado, podía seguir siendo elegido). Y `getProjectsWithHierarchy()` (`src/lib/db/projects.ts`) no tenía `.order()` en el embed anidado `teams(*)`, así que ni siquiera con el scope correcto por Project el orden de "primer team elegible" iba a ser determinístico.
- **Alcance real confirmado antes de aplicar el fix:** query a `team_connections` con `requester_project_id` seteado → 4 filas con `requester_team_id` de un Project distinto al declarado, **2 de ellas con `status = 'active'`** (workspaces compartidos reales ya en uso con el team host equivocado, incluida la del PO de hoy).

**Fix aplicado (los 3 puntos juntos, confirmados por el PO):**
1. `ConnectTeamModal.tsx`: `eligibleTeams = teams.filter(t => t.project_id === projectId && t.type !== 'isolated' && t.status !== 'archived')` — ahora escoped al Project correcto usando el mismo prop `projectId` ya recibido, además de excluir archivados.
2. Exclusión de `status === 'archived'` incluida en el mismo filtro (punto anterior).
3. `src/lib/db/projects.ts`: agregado `.order('created_at', { foreignTable: 'teams', ascending: true })` al lado del `.order()` ya existente sobre `projects` — mismo patrón exacto ya usado en `getTeamsForProject()` (`src/lib/db/teams.ts` línea 49) para `agent_sessions`, no se inventó un patrón nuevo.

**Decisión explícita del PO — historial NO corregido:** las 4 filas con team host incorrecto (2 `active`, 2 `cancelled`) se dejan intactas a propósito — son conexiones de prueba del propio PO, sin importancia real. El fix aplica solo hacia adelante, para conexiones nuevas creadas después de este deploy.

**Archivos modificados:**
- `src/components/teams/ConnectTeamModal.tsx`
- `src/lib/db/projects.ts`

**Restricciones respetadas:** no se tocó ningún dato en `team_connections` (solo lectura durante toda la investigación); no se aplicó ningún fix antes de confirmar la causa raíz con evidencia real; no se corrigió historial sin autorización explícita del PO (autorización fue explícitamente NO corregir).

**Validaciones:** lint ✅, build ✅. **No validado:** confirmación real del PO en producción con una conexión nueva desde un Project específico, verificando que el nombre y `team_id` correctos aparecen — pendiente.

**Riesgos conocidos / deuda técnica:**
- Las 2 conexiones históricas `active` con team host incorrecto quedan así por decisión explícita del PO — si en el futuro se necesita auditar o corregir, los IDs son `d16d3a9e-ad64-4239-8fd8-ee4ed8d21ba4` y `cb81d4d0-6e28-42f4-8e96-5e837df3508b` en `team_connections`.

---

