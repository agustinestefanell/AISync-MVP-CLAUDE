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
