# AISync — Coding Workshop

## Propósito

Repositorio acumulativo de bugs resueltos, causas raíz, procesos de diagnóstico y lecciones técnicas del proyecto AISync MVP. Alimentado desde `handoff.md`. No reemplazar entradas anteriores — agregar al final.

Cada entrada documenta lo que fue difícil, por qué falló, cómo se resolvió y qué no volver a repetir. El objetivo es que un Worker nuevo pueda leer esto antes de tocar zonas sensibles del sistema.

---

## Formato de cada entrada

- **Problema:** qué falló o qué faltaba
- **Causa raíz:** por qué pasó
- **Consecuencia:** qué impacto tuvo
- **Proceso de solución:** qué se intentó, qué funcionó
- **Solución final:** fix exacto aplicado
- **Commit:** hash
- **Lección:** qué aprendimos para el futuro

---

## Entradas

### 1. Scroll chain roto en AppLayout

- **Problema:** Ninguna vista de altura fija (Documentation Mode, Workspace, Audit, Teams) tenía scroll funcional. Las listas de documentos y los paneles de chat no hacían scroll aunque el contenido excedía el viewport.

- **Causa raíz:** `<main>` en `AppLayout` con `scrollable={false}` era un elemento block. Tenía `flex-1 overflow-hidden min-h-0` pero le faltaba `display: flex`. Como `<main>` era block (no flex container), el `flex-1` aplicado a sus hijos directos (`DocClient`, `WorkspaceShell`, etc.) no tenía efecto — nunca resolvía la altura. Los hijos tomaban `height: auto` y crecían indefinidamente sin activar el scroll de sus descendientes.

- **Consecuencia:** El scroll estaba roto en las 5 páginas con `scrollable={false}`. Los usuarios veían contenido cortado o sin scroll. Los intentos de arreglar `min-h-0` en los hijos no solucionaban nada porque el problema estaba un nivel más arriba.

- **Proceso de solución:** Se intentaron múltiples fixes en los hijos (`min-h-0` en DocClient, en las vistas individuales, en los contenedores de lista). Ninguno funcionaba. El diagnóstico final identificó que `flex-1` nunca puede resolver si el padre no es flex. La chain completa se rastreó desde `h-screen` hasta `flex-1 overflow-y-auto` en la lista final.

- **Solución final:** En `AppLayout.tsx`, rama `scrollable=false`:
  ```
  'flex-1 overflow-hidden min-h-0'
  →
  'flex-1 overflow-hidden min-h-0 flex flex-col'
  ```
  Un único `flex flex-col` agregado en `<main>`. Todos los hijos con `flex-1` empezaron a resolver correctamente.

- **Commit:** `3a02366`

- **Lección:** La chain de scroll en Tailwind requiere que **cada nodo flex en la cadena sea explícitamente un flex container**. `flex-1` en un hijo solo funciona si el padre tiene `display: flex`. Cuando el scroll no aparece, ir de arriba hacia abajo verificando que cada nivel tenga el display correcto, no solo los nodos inferiores. El síntoma (scroll roto) estaba en las vistas; la causa estaba en el layout padre.

---

### 2. Light mode: `text-white` hardcodeado en modales

- **Problema:** Al migrar el proyecto de dark a light mode, los textos en modales, inputs, selects y cards eran invisibles (blanco sobre blanco). Afectó al menos 20 componentes: EditTeamModal, ApiKeysManager, ContextFilePanel, PromptLibrary, WorkspaceShell, AuditTimeline, InvestigateView, StructureView, RepositoryView, DocClient, HandoffPackageModal, AdminClient, SMDisambiguationModal, AuditView, IncomingRequestsPanel, ConnectTeamModal, CustomProvidersManager, SetupGuide, ProjectList, LogoutButton, KnowledgeMap.

- **Causa raíz:** El proyecto fue construido inicialmente con clases dark hardcodeadas (`bg-gray-900`, `bg-gray-800`, `text-white`, `text-gray-300`, `border-gray-700`). No usaba el sistema de tokens CSS del proyecto (`var(--color-*)`) que sí respeta el tema. Al cambiar la dirección visual a light mode, todas esas clases se volvieron incorrectas simultáneamente.

- **Consecuencia:** UI completamente ilegible en modo claro. Inputs con texto invisible, tarjetas con contraste 0, badges oscuros sobre fondo blanco.

- **Proceso de solución:** Auditoría sistemática de todos los archivos con `bg-gray-900`, `bg-gray-800`, `text-white` hardcodeado. Tabla de conversión definida:
  ```
  bg-gray-900 → bg-white
  bg-gray-800 → bg-gray-50
  bg-gray-700 → bg-gray-100
  border-gray-700/800 → border-gray-200
  text-white → text-[var(--color-text-primary)]
  text-gray-300 → text-gray-600
  text-gray-200 → text-gray-800
  ```
  KnowledgeMap canvas mantenido oscuro (intencional — ReactFlow).

- **Solución final:** Reemplazo masivo en 20 componentes con la tabla de conversión. Después, migración a tokens semánticos (`--color-text-primary`, `--color-border-default`, `--color-surface`, etc.) en los componentes más críticos (SMPanel, ApiKeysManager, EditTeamModal, ConnectTeamModal, RepositoryView). Tokens nuevos agregados en `src/styles/tokens.css`.

- **Commit:** Multiple commits — `472caf9` (API Keys, Custom Providers), `e68db2f` (Prompt Library, Context Files).

- **Lección:** Nunca usar clases de color hardcodeadas (`bg-gray-900`, `text-white`) en un sistema que tiene tokens CSS. Siempre usar `var(--color-*)`. Los tokens se definen una vez y se cambian en un lugar. Los hardcodes se vuelven deuda técnica que crece con cada componente nuevo.

---

### 3. React setState updater purity — `onSelectionChange` suprimido

- **Problema:** La barra de "Save Selection(s)" en WorkspaceShell nunca aparecía al seleccionar mensajes en AgentPanel. `_totalSelected` permanecía en 0. F12 no mostraba ningún error. Los checkboxes en los mensajes funcionaban visualmente (el estado local del panel era correcto), pero el padre nunca se enteraba.

- **Causa raíz:** `onSelectionChange(next.size)` era llamado **dentro del updater** de `setSelectedIndices`:
  ```typescript
  setSelectedIndices(prev => {
    const next = new Set(prev)
    if (next.has(i)) { next.delete(i) } else { next.add(i) }
    onSelectionChange(next.size)  // ← AQUÍ el problema
    return next
  })
  ```
  React trata los updaters de setState como funciones puras. En Strict Mode y en concurrent features, React puede ejecutar el updater más de una vez o suprimir sus efectos secundarios. Llamar a un setState del padre desde un updater del hijo es un efecto secundario prohibido dentro de esa función. El callback se ejecutaba a veces en desarrollo (no determinístico) pero nunca en producción.

- **Consecuencia:** La feature completa de Save Selection estaba implementada correctamente (migración, API route, modal, handler de guardado), pero era completamente invisible porque la barra nunca aparecía. El user no podía activar el flujo.

- **Proceso de solución:** El bug era silencioso — sin errores, sin warnings, sin console.log visible. El diagnóstico fue por eliminación: (1) confirmar que `_totalSelected > 0` era la condición de la barra, (2) agregar console.log para verificar que `_totalSelected` nunca subía, (3) remontar que `onSelectionChange` sí se llamaba pero en el contexto equivocado.

- **Solución final:** Eliminar `onSelectionChange` del updater y moverlo a un `useEffect`:
  ```typescript
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onSelectionChange(selectedIndices.size) }, [selectedIndices.size])
  ```
  El `eslint-disable` es intencional: incluir `onSelectionChange` como dependencia causaría re-renders infinitos si el padre no memoiza el callback.

- **Commit:** `bd24174`

- **Lección:** Nunca llamar callbacks del padre dentro de setState updaters. Los updaters deben ser funciones puras: solo toman el estado anterior y retornan el nuevo estado. Para notificar al padre de un cambio de estado interno, siempre usar `useEffect`. El eslint-disable en `react-hooks/exhaustive-deps` está justificado cuando incluir la dependencia rompería el invariante de un solo efecto por cambio de valor.

---

### 4. Botón `AgentPanel` sin `onClick` — prop no conectado

- **Problema:** El botón "Save Selection" en la grilla de acciones de AgentPanel cambiaba correctamente a "Selection (N)" al seleccionar mensajes, pero al clickearlo no pasaba nada. Sin error, sin modal, sin respuesta visual.

- **Causa raíz:** El botón existía en el código con el estilo correcto y el label dinámico correcto, pero **no tenía `onClick`**:
  ```tsx
  <button
    disabled={!hasSelection}
    style={{ color: hasSelection ? 'var(--color-accent-strong)' : '...' }}
    // onClick ausente ← el botón era mudo
  >
    {hasSelection ? `Selection (${selectedCount})` : 'Save Selection'}
  </button>
  ```
  Además, `onOpenSaveSelection` nunca fue declarado como prop en la interface de `AgentPanel`. El prop existía en `WorkspaceShell` (`openSaveSelectionModal`) pero nunca fue pasado hacia abajo ni recibido en el panel.

- **Consecuencia:** El usuario clickeaba el único botón visible para Save Selection (el del panel) y no ocurría nada. La barra inferior de WorkspaceShell (el punto de entrada alternativo) estaba invisible si el usuario no sabía buscarla. La feature completa de Save Selection era inutilizable.

- **Proceso de solución:** Diagnóstico por hipótesis: identificar que había DOS botones (el del panel y la barra inferior), que el usuario clickeaba el del panel, y que ese botón no tenía onClick. Verificado con lectura directa del código.

- **Solución final:**
  1. Agregar `onOpenSaveSelection?: () => void` a la interface `Props` de AgentPanel
  2. Destructurar el nuevo prop en el componente
  3. Agregar `onClick={onOpenSaveSelection}` al botón
  4. En WorkspaceShell, pasar `onOpenSaveSelection={openSaveSelectionModal}` en cada `<AgentPanel>`

- **Commit:** `6204de2`

- **Lección:** Cuando un botón tiene estado visual correcto pero no hace nada, verificar primero si tiene `onClick`. Es el error más silencioso posible en React — sin warnings, sin errores, la UI parece correcta. El flujo de conexión prop→handler debe verificarse de extremo a extremo: declarado en interface → destructurado → conectado al botón → pasado desde el padre.

---

### 5. Contaminación de repos DEMO-V2 durante trabajo en MVP

- **Problema:** En algún momento del desarrollo, se realizaron cambios accidentales en repos de referencia (`AISYNC-DEMO-V2` o `AISYNC-DEMO-MVP`) en lugar del repo activo `AISync-MVP-CLAUDE`. Esto generó confusión sobre el estado real del código, pérdida de tiempo y riesgo de mezclar versiones.

- **Causa raíz:** El entorno de trabajo tiene tres repos en `C:\proyectos\AISync\`:
  - `aisync-mvp-claude` — repo activo, donde van todos los cambios
  - `MVP` — demo de referencia, solo lectura
  - `AISYNC-DEMO-V2` — demo alternativa, solo lectura
  
  Sin un ritual de verificación de entorno, es posible operar en la carpeta equivocada, especialmente cuando un LLM ejecuta comandos sin confirmar el working directory.

- **Consecuencia:** Cambios en el repo incorrecto. Tiempo perdido. Riesgo de que la demo de referencia quede corrompida y no sea confiable para el patrón "Demo First".

- **Proceso de solución:** Se estableció una regla de apertura de sesión obligatoria y se documentó en CLAUDE.md.

- **Solución final:** Ritual de apertura de sesión (ahora en `CLAUDE.md`):
  ```bash
  pwd          # confirmar C:\proyectos\AISync\aisync-mvp-claude
  git remote -v  # confirmar repo correcto
  git branch --show-current  # confirmar rama main
  git status --short
  git log --oneline -5
  ```
  Regla: "No tocar AISYNC-DEMO-V2 ni AISYNC-DEMO-MVP bajo ninguna circunstancia."

- **Commit:** No identificado en `handoff.md` — fue una decisión de proceso, no un fix de código.

- **Lección:** Siempre verificar `pwd` y `git remote -v` antes de cualquier operación en un entorno con múltiples repos. Un LLM que ejecuta comandos necesita el ritual de verificación como invariante de seguridad. Codificar el ritual en `CLAUDE.md` para que sea ejecutado automáticamente en cada sesión.

---

### 6. `uniqueTeams` perdía `team_id` — labels sin código jerárquico

- **Problema:** El filtro de equipos en RepositoryView e InvestigateView no mostraba todos los equipos correctamente. Los equipos que solo tenían `handoff_packages` (sin `checkpoints`) no aparecían en el dropdown. Además, los labels de equipos no mostraban el código jerárquico (A-00, A-01, etc.) porque el cálculo de `uniqueTeams` no incluía `team_id`.

- **Causa raíz:** `getHandoffPackages()` en `src/lib/db/documentation.ts` solo traía `workspaces(name)` sin join a `teams`. La interfaz `DocHandoffPackage` no tenía los campos `team_id`, `team_name`, `project_id`, `project_name`. Como resultado:
  1. `uniqueTeams` se calculaba solo desde `checkpoints` — los handoffs con equipos distintos quedaban fuera del filtro
  2. Al calcular `teamCodes` (sistema jerárquico A-00), se necesita `team_id` para mapear el equipo a su código. Sin `team_id` en los handoffs, los labels del filtro eran solo nombres sin código.

- **Consecuencia:** El filtro de equipos en Documentation Mode era incompleto. Un equipo que solo había generado handoffs (sin checkpoints) era invisible en el filtro. Los labels no mostraban el código jerárquico que el usuario esperaba ver.

- **Proceso de solución:** Diagnóstico confirmado leyendo `documentation.ts` y la query de `getHandoffPackages`. La query `workspaces(name)` era la única causa. Fix en la query y extensión de la interfaz.

- **Solución final:**
  - `documentation.ts`: query extendida a `workspaces(name, teams(id, name, projects(id, name)))`. `DocHandoffPackage` extendida con `team_id`, `team_name`, `project_id`, `project_name`. Mapping con `Array.isArray` porque Supabase puede devolver array o objeto en joins anidados.
  - `RepositoryView.tsx` + `InvestigateView.tsx`: `uniqueTeams` cambiado de solo `checkpoints` a `checkpoints + handoffPackages`.
  - `InvestigateView.tsx`: recibe ahora `handoffPackages` como prop desde `DocClient`.

- **Commit:** `71aea80`

- **Lección:** Cuando se agrega un objeto nuevo a una vista que ya tiene filtros, verificar que la query de ese objeto incluya **todos los campos** que los filtros necesitan. En particular, los filtros de entidades relacionadas (team, project) requieren los IDs, no solo los nombres. Un join faltante en la query es invisible en TypeScript si la interfaz tampoco tiene el campo — el tipo simplemente no lo expone y el campo queda ausente en silencio.

### 7. `checkpoint_messages` no tiene `created_at` — el orden canónico es `position`

- **Problema:** OE C pedía agregar `checkpoint_messages(content, role, created_at)` al select de `getDocCheckpoints()` para computar un preview del último mensaje. El campo `created_at` no existe en la tabla.

- **Causa raíz:** `checkpoint_messages` fue diseñada como snapshot inmutable (migración 003). El orden de los mensajes se preserva mediante el campo `position int not null`, no mediante timestamp. La tabla no tiene `created_at` porque el tiempo de creación no es relevante — los mensajes son una copia fija del historial en el momento del checkpoint.

- **Consecuencia:** Si la query hubiera incluido `created_at`, Supabase habría retornado un error en runtime. Se detectó durante la lectura de la migración antes de ejecutar el select, evitando el error.

- **Proceso de solución:** Lectura directa de `supabase/migrations/003_checkpoints.sql` antes de modificar el select. Columnas confirmadas: `id`, `checkpoint_id`, `session_id`, `role`, `content`, `position`. No hay `created_at`.

- **Solución final:** Select con `checkpoint_messages(content, role, position)`. En el mapper, filtrar `role === 'assistant'`, ordenar por `position` ascendente, tomar el último elemento. Commit `98b38ca`.

- **Lección:** Antes de agregar cualquier campo a un select de Supabase en `documentation.ts`, verificar la migración correspondiente. Los tipos TypeScript del proyecto son `unknown` / `as unknown as Raw*` — no hay generación automática de tipos desde el schema. La única fuente de verdad sobre columnas disponibles son los archivos `.sql` en `supabase/migrations/`.

---

### 8. Falso 403 en admin prompts route — lookup de rol con client RLS en route handler

- **Problema:** `POST /api/admin/prompts` devolvía `403` aunque el usuario autenticado tenía `role = 'owner'` en la tabla `accounts`. El Admin Panel cargaba correctamente (server component), pero al intentar guardar un prompt el UI mostraba rojo con Forbidden. Los `updated_at` en DB nunca cambiaban — todas las filas seguían en el timestamp del seed original (`2026-05-10 18:59:50`).

- **Causa raíz:** La route usaba `supabase` (client con cookies del request) para el lookup de rol en `accounts` después de verificar identidad con `supabase.auth.getUser()`. En route handlers de Next.js App Router, el client con cookies no siempre resuelve correctamente el contexto de sesión para queries RLS posteriores a la autenticación. El `SELECT` sobre `accounts` retornaba `null` aunque el usuario existía, el `user.id` era correcto y el registro tenía `role = 'owner'`. La condición `!account || !['owner', 'admin'].includes(account.role)` evaluaba `true` → 403.

- **Consecuencia:** Ningún prompt de sistema había podido ser editado desde Admin. El UI mostraba verde en saves anteriores (si los hubo con otro flujo) o siempre rojo. La feature de admin prompts era completamente no funcional.

- **Proceso de solución:** Diagnóstico por capas: primero se descartó env var faltante (`adminClient` ya funcionaba para el select y el update). Luego se descartó mismatch de `role` values (los roles en DB eran exactamente `manager`, `worker`, etc.). Luego se descartó trigger en la tabla. El 403 apareció en consola de Network → confirmó que el problema era antes del update, en el check de autorización. Lectura directa de la route confirmó que el lookup de `accounts` usaba `supabase` (client con cookies), no `adminClient`.

- **Solución final:** En `src/app/api/admin/prompts/route.ts`, se movió la instanciación de `adminClient = createAdminClient()` antes del lookup de rol, y se reemplazó `supabase.from('accounts')` por `adminClient.from('accounts')`. Se eliminó la segunda instanciación redundante de `adminClient` que existía líneas más abajo. `supabase.auth.getUser()` no fue tocado — sigue siendo el punto de verificación de identidad.

- **Commit:** ver handoff.md — `fix: use adminClient for role lookup in admin prompts route`

- **Lección:** En route handlers de Next.js App Router, no asumir que el client con cookies (`createClient()`) resolverá el contexto RLS de forma confiable para queries posteriores a la autenticación. Para lookups server-side de rol/ownership donde la identidad ya fue verificada con `auth.getUser()`, usar `adminClient` de forma acotada. El patrón seguro: `auth.getUser()` con `supabase` para identidad → `adminClient` para lookup de rol en `accounts` → lógica de autorización en código → operaciones de negocio con `adminClient`.

---

### 9. Admin prompts mostraba datos viejos por cache de Next.js App Router

- **Problema:** La edición de system prompts persistía en DB correctamente, pero al navegar dentro de la app de vuelta a `/admin`, el usuario veía la versión anterior del prompt. El cambio solo era visible después de un hard refresh (F5).

- **Causa raíz:** Next.js App Router cachea server components. Después del save exitoso, la DB quedaba actualizada pero el App Router seguía sirviendo el server component cacheado con los datos viejos. No había ninguna señal para que el router invalidara su caché y re-fetche desde el servidor.

- **Consecuencia:** El sistema daba la impresión de que el guardado no había funcionado. El usuario tenía que hacer hard refresh para ver el cambio, lo que genera desconfianza en la feature.

- **Proceso de solución:** El save funcionaba (la DB lo confirmaba). El problema era post-save: falta de invalidación del router. Solución estándar en Next.js App Router para mutaciones client-side que afectan server components: `router.refresh()` después del éxito.

- **Solución final:** En `src/components/admin/AdminClient.tsx`, en `PromptsSection`: (1) import `useRouter` de `next/navigation`; (2) `const router = useRouter()` al inicio del componente; (3) `router.refresh()` inmediatamente después de `setSaveMsg({ ok: true, text: 'Saved successfully' })`.

- **Commit:** `fix: refresh router after prompt save to bust Next.js cache`

- **Lección:** En Next.js App Router, toda mutación client-side que modifica datos consumidos por server components requiere `router.refresh()` (o `revalidatePath()` desde server actions) para que los cambios sean visibles en navegación interna sin hard refresh. Sin esto, el App Router sirve siempre la versión cacheada.

---

### 10. R&F forwarded context invisible al modelo

- **Problema:** Los mensajes enviados mediante Review & Forward aparecían en la UI del Worker receptor, pero el modelo no los recibía como contexto. El Worker veía "[Forwarded from Manager]" en pantalla pero el modelo respondía sin ese contexto.

- **Causa raíz:** `AgentPanel` mantiene dos estados separados: `messages` (display visual) y `apiMessages` (historial enviado al API del modelo). `appendUserMessage` — el método imperativo usado por `handlePanelForward` en WorkspaceShell — solo actualizaba `messages`. `apiMessages` no se tocaba, por lo que el historial enviado al modelo en el siguiente `sendPrompt` no incluía el mensaje forwarded.

- **Consecuencia:** El forwarded context era invisible al modelo en todos los R&F. El Worker veía el mensaje visualmente pero el modelo respondía como si no existiera.

- **Proceso de solución:** Lectura directa de `AgentPanel.tsx`. Estados `messages` (L134) y `apiMessages` (L147) confirmados como separados. `appendUserMessage` en `useImperativeHandle` (L172) confirmado como actualizando solo `messages`. `setApiMessages` disponible en el mismo scope. Fix: una línea adicional.

- **Solución final:** En `appendUserMessage` dentro de `useImperativeHandle`, agregar `setApiMessages(prev => [...prev, { role: 'user', content }])` inmediatamente después de `setMessages`.

- **Commit:** `fix: sync apiMessages on appendUserMessage for R&F forwarded context`

- **Lección:** Cuando existe separación entre estado visual (`messages`) y estado operativo enviado al modelo (`apiMessages`), toda función que inyecte mensajes debe actualizar ambas capas. `appendUserMessage` es el único punto de entrada externo al panel — cualquier inyección que no pase por `sendPrompt` debe sincronizar ambos estados explícitamente.

---

### 11. Audit Log — navegación Workspace en nueva pestaña

- **Problema:** Audit Log podía desplazar la pestaña actual al abrir Workspace/checkpoint, usando `router.push` internamente. El usuario perdía Audit Log como referencia activa al retomar o revisar trabajo. Además, eventos de tipo `review_forward`, `save_selection`, `lock` y otros no tenían ningún botón de navegación al workspace de origen.

- **Causa raíz:** `retomar(event)` y el botón del modal de detalle usaban `router.push`, que reemplaza la URL de la pestaña actual. El bloque de botones de Day View estaba condicionado por `{cp && (...)}` (solo eventos con `checkpoint_id`), dejando todos los demás tipos de evento sin botón de navegación.

- **Consecuencia:** El usuario perdía Audit Log como contexto al retomar trabajo. Eventos como `review_forward` y `save_selection` no tenían ninguna acción navegable desde Day View.

- **Proceso de solución:** Reemplazo de `router.push` por `window.open` en `retomar()` y en el modal de detalle. Separación de botones: `Open Workspace →` fuera del bloque `cp`, condicionado solo por `workspace_id`; `Check Work →` y `Resume Work →` dentro del bloque `cp` (solo checkpoints). Eliminación de `useRouter` al quedar sin uso.

- **Solución final:**
  - `retomar(event)`: `router.push(...)` → `window.open(..., '_blank', 'noopener,noreferrer')`
  - Modal de detalle L580: mismo reemplazo, sin `closeDetail()` (la pestaña actual preserva el modal)
  - Day View: `Open Workspace →` para todos los eventos con `workspace_id`, fuera del bloque `{cp && (...)}`
  - `Check Work →` y `Resume Work →` permanecen dentro de `{cp && (...)}` — solo para checkpoints
  - `useRouter` eliminado de imports y declaración

- **Commit:** `fix: open workspace in new tab from audit log, add open workspace button to all events`

- **Lección:** Audit Log debe funcionar como superficie de trazabilidad persistente. Las aperturas hacia Workspace deben usar `window.open` para preservar esa superficie. Separar claramente: `Open Workspace →` (solo necesita `workspace_id`) de acciones que requieren `checkpoint_id`. Nunca usar `router.push` desde superficies de trazabilidad que el usuario debe mantener abiertas.

---

### 12. Audit Log — arquitectura final de botones en Day View

- **Problema:** Day View acumuló botones duplicados después de iteraciones sucesivas: `View Details`, `Check Work →` y `Resume Work →` convivían en la lista de eventos con acciones parcialmente solapadas. El usuario veía hasta tres botones para un checkpoint, con dos que hacían lo mismo (`Check Work →` y `Resume Work →` llamaban al mismo handler).

- **Causa raíz:** Las OEs anteriores agregaron botones en pasos separados (`Check Work →` duplicando `retomar`, `Resume Work →` como botón extra) sin consolidar la arquitectura final. `retomar(event)` quedó definido pero terminó sin uso real en la lista — su función ya estaba cubierta por `window.open` directo en el modal.

- **Consecuencia:** La UI de Audit Log mostraba hasta cuatro botones por evento checkpoint: `Open Workspace →`, `View Details`, `Check Work →` y `Resume Work →`. Dos de ellos hacían lo mismo. `retomar` pasó a ser dead code que ESLint rechazaba.

- **Proceso de solución:** Consolidar tres capas claras: (1) lista de eventos, (2) modal de preview, (3) workspace operativo. Eliminar duplicados. Renombrar para que el label indique claramente la intención de cada acción.

- **Solución final:**
  - Day View lista: `Open Workspace →` (todos los eventos con `workspace_id`) + `Check Work` (solo checkpoints, abre modal vía `openDetail`)
  - Modal: `Resume Work →` (única acción de retomar, `window.open` directo)
  - `retomar(event)` renombrado a `_retomar` (dead code marcado por convención ESLint del proyecto)

- **Commit:** `fix: audit log day view button cleanup - rename view details to check work`

- **Lección:** Las acciones de Audit Log deben separarse por nivel: abrir workspace (lista), revisar preview (lista → modal), retomar checkpoint (modal → workspace). Si se mezclan en un solo nivel, la UI pierde claridad operativa y genera dead code. Nunca agregar botones en iteraciones sin revisar si ya existe uno con la misma función.

---

### 13. Audit Log — panel lateral compartido entre Day View y Week View

- **Problema:** Week View ejecutaba correctamente `setSelectedEvent(event)`, pero el panel lateral no aparecía. El estado cambiaba pero ningún DOM mostraba el resultado.

- **Causa raíz:** El JSX del panel lateral (`w-80 shrink-0`) estaba dentro del bloque exclusivo `{viewMode === 'day' && (...)}`. En Week View el estado `selectedEvent` se actualizaba, pero el DOM del panel no existía en ese contexto de render.

- **Consecuencia:** La interacción de Week View parecía rota aunque el setter funcionaba correctamente.

- **Proceso de solución:** Reestructurar el layout para que Week View y Day View compartan el mismo wrapper `flex gap-4`, con el panel lateral a un nivel común por encima de los condicionales de vista específicos.

- **Solución final:** Reemplazar los condicionales separados `{viewMode === 'week' && (...)}` y `{viewMode === 'day' && (...)}` por un único wrapper `{(viewMode === 'week' || viewMode === 'day') && (<div className="flex gap-4">...)}` que contiene: `flex-1 min-w-0` con los condicionales de Week y Day internos, y el panel lateral compartido fuera de esos condicionales pero dentro del flex.

- **Commit:** `fix: make side panel available in week view`

- **Lección:** Cuando un estado es compartido entre vistas, el JSX que lo consume debe estar disponible en el nivel de render correspondiente a todas esas vistas. Si el DOM del panel vive dentro del condicional de una sola vista, las demás pueden actualizar el estado sin efecto visible. La solución es elevar el DOM del panel al nivel del wrapper que las agrupa.

---

## Workspace — auto-response after Review & Forward

### Problema
Cuando un panel recibía un mensaje vía Review & Forward, el mensaje se insertaba en el panel destino pero el agente no respondía automáticamente.

### Causa raíz
`appendUserMessage` actualizaba `messages` y `apiMessages` del panel, pero no disparaba el ciclo de envío. El agente receptor quedaba con el mensaje visible en el chat pero sin iniciar su respuesta.

### Consecuencia
El flujo Agent → Agent quedaba incompleto: el usuario tenía que intervenir manualmente para que el receptor respondiera, rompiendo la continuidad operativa del team.

### Proceso de solución
Verificar que `sendPrompt(content: string)` es la función correcta (acepta contenido directo, maneja inserción + API + streaming). Confirmar que llamar `appendUserMessage` + `sendPrompt` duplicaría mensajes. Diseñar `appendUserMessage` para que con `autoRespond=true` delegue directamente a `sendPrompt(content)` con 50ms de delay.

### Solución final
- Con `autoRespond=true` (default): `appendUserMessage` llama `setTimeout(() => sendPrompt(content), 50)`. `sendPrompt` maneja todo — inserción de mensaje visible, actualización de `apiMessages`, streaming.
- Con `autoRespond=false`: comportamiento original — solo inserta, no envía.
- Indicador `Auto-respond: ON` agregado en header de cada panel.
- No se toca `WorkspaceShell.tsx` — `handlePanelForward` ya llama `appendUserMessage` correctamente.

### Commit
`feat: auto-respond on forward with visible indicator in agent panel`

### Lección
Cuando `sendPrompt` ya maneja la inserción del mensaje Y el envío, no llamar `appendUserMessage` + `sendPrompt` en secuencia — duplica mensajes. La función imperativa debe delegar completamente a `sendPrompt` o manejar todo ella misma. No mezclar ambos. El delay de 50ms antes de `sendPrompt` resuelve el timing sin setear estados intermedios que creen race conditions.

---

## Prompt Library — estado residual después de guardar prompt

### Problema
Después de guardar un prompt, el formulario podía conservar estado residual de edición o contenido anterior.

### Causa raíz
`savePrompt()` cerraba el formulario con `setShowForm(false)`, pero no reseteaba completamente los estados internos `editing`, `formTitle`, `formBody` y `formNotes`.

### Consecuencia
Al abrir nuevamente el formulario, el usuario podía encontrar datos previos, generando confusión y riesgo de editar o crear prompts con contenido residual.

### Proceso de solución
Se agregó reset completo del estado del formulario después del guardado exitoso y antes de recargar datos con `loadData()`.

### Solución final
- `editing` vuelve a `null`.
- `formTitle` vuelve a string vacío.
- `formBody` vuelve a string vacío.
- `formNotes` vuelve a string vacío.
- `loadData()` se mantiene para refrescar el listado.
- Se simplificó el panel derecho de assignments con una advertencia operativa.
- `unassign` preservada con eslint-disable (lógica intacta, UI removida).

### Commit
`fix: prompt library form state reset and ui cleanup`

### Lección
Cerrar una UI de formulario no equivale a limpiar su estado. Cuando un formulario sirve para crear y editar, el cierre posterior al guardado debe resetear explícitamente todos los estados relevantes para evitar residuos entre operaciones.

---

## Prompt Library — panel de assignments eliminado y restaurado

### Problema
Panel "Active in this context" fue eliminado en OE de UI cleanup asumiendo que era redundante.

### Causa raíz
Error de criterio: el panel mostraba información operativa crítica (qué workers y teams tienen cada prompt asignado activo). Sin esa información el usuario no puede gestionar assignments correctamente — no sabe qué está activo, ni puede hacer Unassign desde la interfaz.

### Lección
Antes de eliminar paneles de información, verificar si el contenido es operativamente necesario. En este caso el problema era el diseño, no el contenido. El panel fue restaurado usando `git show HEAD~4` para recuperar el JSX exacto.

---

## Supabase RLS — `checkpoint_messages` ownership gap en producción

### Problema
La política `checkpoint_messages_select` en Supabase producción no incluía filtro `auth.uid()`. Cualquier usuario autenticado con un `checkpoint_id` válido podía leer mensajes de checkpoints ajenos.

### Causa raíz
La política live en producción divergía de `003_checkpoints.sql` — tenía JOINs estructurales (`checkpoints → workspaces → teams → projects`) pero omitía la condición final `p.account_id = auth.uid()`. La causa de la divergencia no fue determinada: posible edición manual directa en Supabase fuera del flujo de migraciones.

### Consecuencia
Brecha de aislamiento de datos: un usuario autenticado podía enumerar mensajes de checkpoints ajenos si conocía o infería el `checkpoint_id`. La ruta `/api/checkpoint/[id]/route.ts` agravaba el problema devolviendo `200 + []` silencioso en lugar de `403` cuando RLS bloqueaba, impidiendo detectar el acceso denegado desde el cliente.

### Proceso de solución
1. Diagnóstico de sesión comparó política live (via `pg_policies`) contra migraciones en repo.
2. Se identificó divergencia: repo tenía la política correcta, producción no.
3. Se descartó usar `teams.account_id` (no existe en schema — ownership va por `projects`).
4. Se creó migración `020_fix_checkpoint_messages_rls.sql` con cadena correcta.
5. Migración aplicada manualmente en Supabase SQL Editor.

### Solución final
```sql
CREATE POLICY checkpoint_messages_select ON checkpoint_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM checkpoints c
      JOIN workspaces w ON w.id = c.workspace_id
      JOIN teams t ON t.id = w.team_id
      JOIN projects p ON p.id = t.project_id
      WHERE c.id = checkpoint_messages.checkpoint_id
      AND p.account_id = auth.uid()
    )
  );
```

### Commit
`fix: correct checkpoint_messages rls migration and mark as applied`

### Lección
1. Las políticas RLS deben cerrar la cadena de ownership contra `auth.uid()`. JOINs estructurales sin filtro de usuario son inválidos como políticas de aislamiento.
2. En el schema de AISync, el ownership de toda entidad anidada bajo `teams` se resuelve siempre vía `projects.account_id` — `teams` no tiene `account_id`.
3. Las políticas en producción pueden divergir de las migraciones en repo si se aplican cambios manuales en el dashboard de Supabase. El estado canónico es la producción, no el repo. Auditar periódicamente con `pg_policies`.

---

## Checkpoint route — 403 explícito para acceso no autorizado

### Problema
Cuando RLS filtraba `checkpoint_messages`, el endpoint respondía `200 + []`, haciendo imposible distinguir entre checkpoint propio vacío y checkpoint ajeno bloqueado por RLS.

### Causa raíz
El route confiaba en el resultado de `checkpoint_messages` sin verificar primero si el checkpoint existía y pertenecía al usuario autenticado.

### Consecuencia
El caller recibía una respuesta ambigua. Un acceso denegado parecía un checkpoint vacío, ocultando el estado real de autorización y dejando abierta enumeración silenciosa de checkpoints ajenos.

### Proceso de solución
Se agregó verificación explícita de ownership del checkpoint antes de retornar mensajes, consultando la cadena `checkpoints → workspaces → teams → projects.account_id`.

### Solución final
- Checkpoint inexistente → `404 { error: 'Not found' }`.
- Checkpoint ajeno → `403 { error: 'Forbidden' }`.
- Checkpoint propio sin mensajes → `200 []`.
- Checkpoint propio con mensajes → `200 [messages]`.

### Commit
`fix: return 403 on unauthorized checkpoint access`

### Lección
RLS protege la base de datos, pero el route handler debe expresar correctamente la semántica HTTP. Un resultado vacío no siempre significa ausencia de datos — puede significar acceso bloqueado. Los routes deben verificar ownership explícitamente y devolver el status code correcto.

---

## Prompt Library — dos instancias con contexto diferente

### Problema
El panel de assignments mostraba "None assigned" en la instancia del BottomRibbon, haciendo pensar al usuario que no tenía prompts asignados cuando en realidad la instancia no tenía contexto de agente.

### Causa raíz
`PromptLibrary` se monta en dos lugares: `BottomRibbon` (acceso global, sin contexto de agente — `sessionId=""`) y `AgentPanel` (con `sessionId` real). La condición original `!sessionId && !teamId` era correcta para el primer render pero el mensaje resultante ("Open a workspace to see active prompts") era confuso — el usuario YA estaba en un workspace.

### Solución final
Condición cambiada a `!sessionId` solo. Mensaje actualizado a: "To manage prompt assignments, open Prompt Library from an agent panel." La instancia de AgentPanel no se ve afectada.

### Lección
Un componente reutilizado en dos contextos con props opcionales vacíos debe comunicar explícitamente qué funcionalidad no está disponible y por qué, en lugar de mostrar estados vacíos ambiguos.

---

## Providers — base multimodal en ChatMessage y Anthropic

### Problema
El contrato `ChatMessage` solo soportaba texto plano, impidiendo transportar imágenes o documentos hacia providers multimodales aunque el SDK de Anthropic ya los soportara nativamente.

### Causa raíz
El sistema de providers no tenía un campo común para adjuntos ni una transformación específica hacia el formato multimodal del SDK Anthropic (`Anthropic.MessageParam` con content blocks).

### Consecuencia
No había base tipada para enviar archivos desde cualquier futuro punto de la UI hacia Anthropic. Cualquier intento de adjuntar un archivo hubiera requerido modificar el contrato y el provider simultáneamente sin base previa.

### Proceso de solución
Se extendió `ChatMessage` con `attachments?: ChatAttachment[]` y se adaptó `AnthropicProvider.stream` para construir `sdkMessages: Anthropic.MessageParam[]` antes de llamar al SDK — transformando solo mensajes `user` con attachments.

### Solución final
- `ChatAttachment`: `type`, `media_type`, `data` (base64), `name?`.
- Mensajes `user` con attachments → content blocks `image`/`document` + bloque `text`.
- Mensajes sin attachments y mensajes `assistant` → `content: string` sin cambio.
- OpenAI, Google, Groq y local no modificados.

### Commit
`feat: add attachment support to ChatMessage type and Anthropic provider`

### Lección
La capacidad multimodal debe introducirse primero en el contrato común de mensajes y luego adaptarse provider por provider. El campo `attachments?` como opcional garantiza retrocompatibilidad total con mensajes existentes.

---

## Workspace — UI de adjuntos en AgentPanel

### Problema
El sistema ya tenía base multimodal en `ChatMessage` y Anthropic Provider, pero `AgentPanel` no tenía superficie UI para seleccionar y enviar archivos.

### Causa raíz
La arquitectura multimodal se habilitó primero en el contrato de mensajes y el provider, pero faltaba conectar la capa de interacción del usuario en el panel de agente.

### Consecuencia
El usuario no podía adjuntar imágenes o PDFs desde el workspace aunque el sistema ya tuviera soporte parcial aguas abajo.

### Proceso de solución
Se agregó estado local `attachments`, `fileInputRef`, `handleFileSelect` con `FileReader`, chips removibles y extensión opcional de `sendPrompt`. Se captura el estado de adjuntos antes de limpiarlo para evitar pasar un array vacío al provider.

### Solución final
- `sendPrompt(content, atts = [])`: parámetro opcional con default `[]`.
- `sendMessage` captura `attachments` antes de limpiar estado.
- Mensaje user API incluye `attachments` solo si hay adjuntos.
- Send habilitado con solo adjuntos (sin texto obligatorio).
- Callers secundarios (`appendUserMessage`, guide prompts) usan default `[]` sin cambios.

### Commit
`feat: add file attachment UI to agent panel`

### Lección
Cuando una función tiene múltiples callers, los nuevos parámetros deben agregarse como opcionales con default seguro. Al extender el estado hacia una llamada async, capturar los valores antes de limpiar el estado — de lo contrario se pasa el valor ya limpio al provider.

---

## Providers — OpenAI image attachments vs PDF Files API

### Problema
`ChatMessage.attachments` ya existía y Anthropic lo usaba, pero OpenAI seguía recibiendo mensajes como texto plano e ignoraba las imágenes adjuntas desde AgentPanel.

### Causa raíz
OpenAI requiere formato provider-specific: imágenes como content parts `image_url` en base64. No es el mismo formato que Anthropic — cada provider tiene su propia traducción.

### Consecuencia
La estructura común `ChatMessage.attachments` no podía funcionar automáticamente en OpenAI sin una transformación específica del provider.

### Proceso de solución
Se agregó `sdkMessages` en `openai.ts` para convertir attachments de imagen a bloques `image_url` y conservar el texto como bloque `text`. PDFs excluidos explícitamente con comentario de limitación.

### Solución final
- Image attachments → `image_url` base64 (`OpenAI.Chat.ChatCompletionContentPart[]`).
- Texto del usuario preservado como bloque `text`.
- Mensajes sin attachments → `content: string` sin cambio.
- PDFs/documentos diferidos para Files API.
- Groq: comentario técnico — attachments ignorados silenciosamente.

### Commit
`feat: add attachment support to openai provider`

### Lección
El contrato común de mensajes puede ser único, pero cada provider exige una traducción propia. Para OpenAI, PDFs requieren la Files API — no pueden enviarse como `image_url`.

---

## Providers — Google Gemini multimodal con inlineData

### Problema
`ChatMessage.attachments` ya existía, pero Google Gemini enviaba solo `lastMessage.content` como texto plano — los adjuntos desde AgentPanel no llegaban al provider.

### Causa raíz
Gemini tiene una arquitectura distinta: separa historial (`history`) del mensaje actual. El mensaje actual se envía via `sendMessageStream` y acepta `(string | Part)[]`, pero el código solo pasaba `lastMessage.content` como string.

### Consecuencia
Los archivos adjuntos no llegaban a Gemini aunque existiera la base multimodal en `ChatMessage`.

### Proceso de solución
Se modificó el envío de `lastMessage` para construir `(string | Part)[]` con `inlineData` cuando hay attachments. El historial no se tocó — su limitación multimodal queda documentada.

### Solución final
- Si `lastMessage` tiene attachments: `parts = [inlineData..., lastMessage.content]`.
- Si no: `sendMessageStream(lastMessage.content)` sin cambio.
- Imágenes y PDFs soportados — Gemini acepta `application/pdf` vía `inlineData`.
- Historial: solo texto. Attachments históricos diferidos como limitación MVP.

### Commit
`feat: add attachment support to google gemini provider`

### Lección
La arquitectura multimodal no es homogénea entre providers. Google separa historial y mensaje actual — el soporte inicial solo puede cubrir el `lastMessage`. Gemini es más permisivo que OpenAI con PDFs: acepta `application/pdf` vía `inlineData` sin necesitar una API dedicada de archivos.

---

## Tools — tool loop inicial en chat route

### Problema
El chat route usaba streaming directo (`provider.stream(messages, model)`), lo que no permitía detenerse para ejecutar una tool y continuar con el resultado.

### Causa raíz
Tool use requiere una fase intermedia no-streaming para detectar tool calls. El flujo existente era unidireccional y no tenía mecanismo para completar, ejecutar herramienta y luego streamear la respuesta final.

### Consecuencia
Aunque existía un registry de tools, ningún provider podía usarlas durante una conversación real.

### Proceso de solución
Se agregó `complete?` opcional al contrato `ChatProvider`, se implementó en Anthropic y se agregó una rama en `chat/route.ts` activada por `webSearchEnabled`. El helper `toAnthropicMessages` fue extraído del método `stream` para ser reutilizado por `complete`.

### Solución final
- Sin `webSearchEnabled`, el flujo anterior sigue intacto.
- Con `webSearchEnabled` y provider compatible, el route llama `complete()`.
- Si hay `toolCalls`, ejecuta la tool desde `toolRegistry` e inyecta los resultados.
- Luego llama `stream()` para la respuesta final.
- Si no hay `toolCalls`, devuelve `first.content` como stream sintético sin llamada extra.
- Anthropic detecta blocks `tool_use` y convierte tools a formato `input_schema`.

### Commit
`feat: add tool loop to chat route with web search support`

### Lección
Tool use y streaming directo requieren arquitecturas distintas. Para mantener estabilidad, la integración debe ser opt-in, conservar el flujo anterior intacto y limitarse a una ronda de tool loop inicial. Hacer `complete?` opcional en el contrato permite que providers sin soporte sigan funcionando sin cambios. — el soporte inicial solo puede cubrir el `lastMessage`. Gemini es más permisivo que OpenAI con PDFs: acepta `application/pdf` vía `inlineData` sin necesitar una API dedicada de archivos.

---

## AgentPanel — sendPrompt bloqueaba attachments sin texto

### Problema
Enviar solo un adjunto sin texto no funcionaba — el modelo no respondía y los attachments no llegaban al payload.

### Causa raíz
La guardia `if (!content || streaming || workspaceLocked)` bloqueaba `sendPrompt` cuando `content` era string vacío, aunque hubiera attachments válidos en `atts`. `sendMessage` ya permitía el caso correctamente (`!content && !attachments.length`), pero `sendPrompt` lo cancelaba antes de construir `userApiMsg`.

### Consecuencia
Los attachments nunca llegaban al `fetch('/api/chat')` — el provider recibía solo mensajes de texto sin `attachments` en el payload.

### Solución
```ts
// Antes
if (!content || streaming || workspaceLocked) return

// Después
if ((!content && !atts.length) || streaming || workspaceLocked) return
```

### Commit
`fix: allow sendPrompt with attachments and empty content`

### Lección
Las guardias de validación deben contemplar todas las formas válidas de input. En un sistema multimodal, un mensaje con content vacío pero con adjuntos es válido.

---

## Providers — complete() en OpenAI y Google para tool use

### Problema
El tool loop de `chat/route.ts` dependía de `provider.complete()`, pero solo Anthropic lo implementaba inicialmente.

### Causa raíz
Cada provider expone tool calling con un formato distinto: OpenAI usa function tools y `tool_calls`; Google usa `functionDeclarations` y `functionCalls()`.

### Proceso de solución
Se agregó `complete()` en OpenAI y Google sin tocar `stream()`. Requirió dos fixes de tipos SDK: union type en OpenAI y `FunctionDeclarationSchema` en Google.

### Solución final
- OpenAI `complete()`: filtra `tc.type === 'function'` antes de acceder a `.function`.
- Google `complete()`: cast `as unknown as FunctionDeclaration['parameters']`; `randomUUID()` para IDs.
- Ejecución de tools centralizada en `chat/route.ts`.

### Commit
`feat: add complete() to openai and google providers for tool use`

### Lección
OpenAI `tool_calls` es union type — siempre filtrar por `tc.type === 'function'`. Google no genera IDs en function calls — generarlos con `randomUUID()`. Anthropic es el más ergonómico de los tres para tool use. En un sistema multimodal, un mensaje con content vacío pero con adjuntos es válido. La inconsistencia entre `sendMessage` (que ya lo permitía) y `sendPrompt` (que lo bloqueaba) fue la causa raíz. Google separa historial y mensaje actual — el soporte inicial solo puede cubrir el `lastMessage`. Gemini es más permisivo que OpenAI con PDFs: acepta `application/pdf` vía `inlineData` sin necesitar una API dedicada de archivos. Multimodal no debe asumirse homogéneo: Anthropic, OpenAI y Google tienen capacidades y formatos distintos. Para OpenAI, PDFs requieren la Files API — no pueden enviarse como `image_url`. Al extender el estado hacia una llamada async, capturar los valores antes de limpiar el estado — de lo contrario se pasa el valor ya limpio al provider. No conviene modificar todos los providers a la vez si solo uno está siendo habilitado y validado. El campo `attachments?` como opcional garantiza retrocompatibilidad total con mensajes existentes. Un resultado vacío no siempre significa ausencia de datos — puede significar acceso bloqueado. Los routes deben verificar ownership explícitamente y devolver el status code correcto. JOINs estructurales sin filtro de usuario son inválidos como políticas de aislamiento.
2. En el schema de AISync, el ownership de toda entidad anidada bajo `teams` se resuelve siempre vía `projects.account_id` — `teams` no tiene `account_id`.
3. Las políticas en producción pueden divergir de las migraciones en repo si se aplican cambios manuales en el dashboard de Supabase. El estado canónico es la producción, no el repo. Auditar periódicamente con `pg_policies`.

---

## Entrada #11 — Chat route — trazabilidad fire-and-forget para attachments y tool calls

### Problema
AISync podía procesar adjuntos y ejecutar tools (web search), pero esos eventos no quedaban trazados en `session_attachments` ni `session_tool_calls`.

### Causa raíz
Las tablas existían (migración 021) pero `chat/route.ts` no insertaba registros. Además, `workspace_id` estaba declarado en el tipo del body pero ausente del destructuring — nunca se extraía del request.

### Consecuencia
El sistema operaba multimodalmente y con web search sin dejar trazabilidad mínima por sesión.

### Proceso de solución
1. Confirmar campos reales de `ChatAttachment` en `types.ts` (`type`, `media_type`, `data`, `name?`).
2. Agregar `workspace_id` al destructuring del body.
3. Insertar trazabilidad de attachments después de ensamblar `messages`, antes del `try {}` principal.
4. Insertar trazabilidad de tool calls después de `tool.execute()` exitoso, dentro del try del tool loop.

### Solución final
- `workspace_id` extraído correctamente del body.
- Attachments registrados en `session_attachments` (sin `att.data` base64).
- Tool calls exitosas registradas en `session_tool_calls` con `result_summary: content.slice(0, 500)`.
- Ambos inserts son fire-and-forget — sin `await`, sin bloquear stream.
- Tool loop, streaming y providers intactos.

### Commit
`feat: trace attachments and tool calls in chat route`

### Lección
La trazabilidad operativa no crítica debe ser no bloqueante. En flujos de streaming, los inserts auxiliares no deben condicionar la respuesta principal del chat. Un campo declarado en el tipo del request no garantiza que esté en el destructuring — verificar ambos. No guardar base64 en tablas de trazabilidad — solo metadata.

---

## Entrada #12 — Anthropic — bloque de texto vacío en mensajes con adjunto

### Problema
Al enviar solo un adjunto sin texto, Anthropic devolvía error 400: "messages: text content blocks must be non-empty".

### Causa raíz
`toAnthropicMessages()` siempre agregaba `{ type: 'text', text: msg.content }` al array de content blocks, aunque `msg.content` fuera string vacío. Anthropic rechaza bloques de texto vacíos.

### Solución
Spread condicional — el bloque de texto solo se agrega si `msg.content` es truthy:
`...(msg.content ? [{ type: 'text', text: msg.content }] : [])`

### Commit
`fix: omit empty text block in anthropic messages with attachments` — hash `3f83786`

### Lección
Al construir arrays de content blocks para providers multimodales, siempre verificar que los campos de texto no sean vacíos antes de incluirlos. Los providers rechazan bloques vacíos aunque la estructura sea válida.

---

## Entrada #13 — Vercel serverless — fire-and-forget no funciona en route handlers

### Problema
Los inserts de trazabilidad en `audit_log`, `session_attachments` y `session_tool_calls` no llegaban a Supabase aunque el código fuera correcto y el insert funcionara directamente desde el Dashboard.

### Causa raíz
En Vercel, los route handlers de Next.js son funciones serverless que se cierran tan pronto como se envía el `Response`. Las Promises sin `await` quedan huérfanas — la función termina antes de que el request HTTP a Supabase llegue a ejecutarse.

### Solución
Usar `Promise.allSettled()` antes de retornar el stream. `allSettled` agrupa todos los inserts, los ejecuta en paralelo, y espera a que todos resuelvan (o fallen) antes de continuar. Un fallo individual no interrumpe el flujo principal.

### Commit
`fix: await traceability inserts before streaming response`

### Lección
En funciones serverless (Vercel, AWS Lambda, Cloudflare Workers), el fire-and-forget no funciona. Toda Promise que debe ejecutarse antes de que la función termine debe ser awaiteada. `Promise.allSettled` es el patrón correcto cuando hay múltiples inserts independientes: paralelismo sin bloqueo por fallo individual.
