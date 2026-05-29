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
