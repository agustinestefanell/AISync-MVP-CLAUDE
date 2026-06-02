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
