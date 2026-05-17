# handoff.md — Memoria operativa del proyecto AISync MVP

Registro canónico acumulativo de decisiones importantes, estados cerrados, hallazgos técnicos y pendientes.
**No reemplazar entradas anteriores. Agregar nuevas al final.**

---

## [2026-05-17 ~11:00] — GAP_BETWEEN_ROOT_TREES no tiene efecto visual aparente

### Contexto
Se sospechaba que `GAP_BETWEEN_ROOT_TREES = 150` no funcionaba en MapView.

### Decisión / Estado cerrado
El gap funciona correctamente en el cálculo. El efecto visual no es perceptible porque `CanvasViewport` aplica auto-fit que escala el canvas completo (4966px de ancho) al viewport disponible. El gap de 150px queda invisible a esa escala. Decisión: dejar en 150, no modificar.

### Razón
Console logs confirmaron que `xOffset` acumula correctamente `layout.width + 150` por cada root. El problema era de percepción visual por el zoom de auto-fit, no un bug de cálculo.

### Archivos / superficies afectadas
- `src/lib/map/buildTreeLayout.ts`
- `src/components/teams/MapView.tsx`

### Riesgos o pendientes
Ninguno. El gap está correcto. Si se desea separación visual real entre proyectos, habría que aumentar mucho el valor o revisar fitFloor.

### Próximo paso recomendado
Ninguno sobre este punto.

---

## [2026-05-17 ~11:30] — Constantes MAP ajustadas a proporción de la demo

### Contexto
Las constantes internas de MAP en `buildTreeLayout.ts` estaban severamente subestimadas respecto a la demo. Los gaps internos al árbol eran ~22% del valor de la demo, aunque las cards estaban al 84%.

### Decisión / Estado cerrado
Ajuste proporcional al 84% de los valores demo:
- `MAP_SIBLING_GAP`: 20 → 77 (demo=92)
- `MAP_WORKER_GAP`: 35 → 77 (demo=92)
- `MAP_FAMILY_BREAK_GAP`: 40 → 148 (demo=176)

Valores actuales en `buildTreeLayout.ts` son canónicos para MVP.

### Razón
Demo usa `MAP_ROOT_WIDTH=760`, MVP usa `MAP_ROOT_WIDTH=640` (84%). Todos los gaps deben escalar a la misma proporción para mantener coherencia visual.

### Archivos / superficies afectadas
- `src/lib/map/buildTreeLayout.ts`

### Riesgos o pendientes
Si el tamaño de cards cambia, los gaps deberán re-escalarse proporcionalmente.

### Próximo paso recomendado
Ninguno. Valores estables para MVP.

---

## [2026-05-17 ~12:00] — Connect Team unificado como box único al final de la fila GM

### Contexto
`Connect Team` aparecía repetido por cada GM en MAP (dentro de cada card) y por cada GM en TREE. Debía ser un único elemento standalone al final de la fila de GMs.

### Decisión / Estado cerrado
- MAP: `ConnectTeamBox` es un único `<div>` absoluto renderizado después del loop de placements, a la derecha del último árbol.
- TREE: `TreeConnectTeamBox` ídem. Eliminado de `TreeNode` GM case.
- Cálculo de posición: `connectTeamLeft = baseWidth - PADDING_X + CONNECT_GAP`
- Dimensiones MAP: `CONNECT_TEAM_GAP=84`, `CONNECT_TEAM_WIDTH=300`, `CONNECT_TEAM_HEIGHT=179`
- Dimensiones TREE: `TREE_CONNECT_GAP=56`, `TREE_CONNECT_WIDTH=116`, `TREE_CONNECT_HEIGHT=84`

### Razón
El diseño de la demo muestra un único botón Connect Team para todo el proyecto, no uno por cada equipo raíz.

### Archivos / superficies afectadas
- `src/components/teams/MapView.tsx`
- `src/components/teams/TreeView.tsx`

### Riesgos o pendientes
El botón Connect Team abre `ConnectTeamModal`. Si hay múltiples proyectos, el modal debe manejar la selección de equipo correctamente.

### Próximo paso recomendado
Ninguno sobre layout. Funcionalidad de Connect Team modal es separada.

---

## [2026-05-17 ~13:00] — AddTeamModal reemplazado por diseño MAT/SAT de la demo

### Contexto
`AddTeamModal` tenía un diseño oscuro con 3 agentes individuales y badge SAT/MAT computado. La demo usa panel dual MAT/SAT con provider buttons por worker.

### Decisión / Estado cerrado
`AddTeamModal.tsx` reescrito completamente. Diseño final:
- Panel dual lado a lado: MAT (izquierda) | SAT (derecha)
- Panel activo: opacity-100, borde neutral-300, fondo blanco
- Panel inactivo: opacity-45, borde neutral-200, fondo neutral-50
- Workers MAT: proveedor independiente por cada uno (W1, W2, W3)
- SAT: proveedor único replicado a los 3 agentes
- Default models: Anthropic→Claude 3.5 Sonnet, OpenAI→GPT-4o, Google→Gemini 2.0
- Custom providers cargados desde `/api/settings/providers`
- Campos comunes: Team Name * + Description * + Sub-team selector (opcional)
- Validación: nombre requerido + descripción requerida

### Razón
Demo first — la demo usa este diseño. El diseño anterior era dark theme y estructuralmente diferente.

### Archivos / superficies afectadas
- `src/components/teams/AddTeamModal.tsx`

### Riesgos o pendientes
Ninguno estructural. El flujo POST a `/api/teams` es compatible.

### Próximo paso recomendado
Ninguno. Modal estable.

---

## [2026-05-17 ~14:00] — Fix: Save Changes en Edit Team no persistía cambios

### Contexto
`Edit Team → Save Changes` no persistía. El usuario veía que los cambios no aparecían en MAP/TREE después de guardar.

### Decisión / Estado cerrado
Dos bugs corregidos:

**Bug 1 (causa principal)**: `POST /api/teams` no extraía ni guardaba `description` del body. Todos los teams creados tenían `description = null` en DB. `EditTeamModal` inicializaba `description = ''` (de `null ?? ''`). La validación `!description.trim()` bloqueaba el guardado con "Description is required." — error visible solo al fondo del form.

**Bug 2 (crash silencioso)**: `PATCH /api/teams/[id]` no verificaba si el refetch `full` era null. Si fallaba el SELECT, retornaba `200` con body `null`. `handleUpdated(null)` intentaba `null.id` → TypeError → estado no se actualizaba, modal no cerraba.

### Razón
- POST: `description` no estaba en el destructuring ni en el insert de Supabase.
- PATCH: faltaba `error: fullErr` en el destructuring y guard `if (fullErr || !full) return 500`.

### Archivos / superficies afectadas
- `src/app/api/teams/route.ts` (POST — añadido `description` al insert)
- `src/app/api/teams/[id]/route.ts` (PATCH — añadido null check en refetch)

### Riesgos o pendientes
Teams ya existentes en DB con `description = null` seguirán requiriendo que el usuario ingrese descripción en EditTeamModal la primera vez que editen. No hay retroactividad sin migración.

### Próximo paso recomendado
Si se quiere limpiar los teams existentes sin description, crear migración SQL `UPDATE teams SET description = name WHERE description IS NULL`. Decisión pendiente del manager.

---

## [2026-05-17 ~14:30] — handoff.md establecido como memoria operativa formal

### Contexto
Decisiones importantes quedaban dispersas en chat y contexto temporal. Sin registro persistente en el repositorio.

### Decisión / Estado cerrado
`handoff.md` en la raíz del proyecto es el registro canónico acumulativo de decisiones importantes. Reglas:
- Agregar al final. Nunca reemplazar.
- Registrar al momento de la decisión, no al final de la sesión.
- Solo decisiones con continuidad futura. No microajustes.
- Si una decisión vieja queda superada, agregar nueva entrada marcando cuál criterio previo cae.

### Razón
Preservar contexto entre sesiones, evitar repetición de decisiones, facilitar relevos.

### Archivos / superficies afectadas
- `handoff.md` (este archivo)

### Riesgos o pendientes
El archivo se vuelve inútil si se llena de ruido. Mantener disciplina de registro selectivo.

### Próximo paso recomendado
Revisar este archivo al inicio de cada sesión importante o relevo.

---

## [2026-05-17 ~15:00] — Numeración jerárquica de teams en MAP cards

### Contexto
Las cards en Teams Map no mostraban ningún código de identificación. La demo usa códigos estáticos hardcodeados. Se requería un sistema dinámico y jerárquico basado en la estructura real de teams.

### Decisión / Estado cerrado
Implementación client-side pura. Sin cambios en DB ni schema.

- `src/lib/teams/computeTeamCodes.ts`: función pura nueva.
  - Formato: root = `A-00`, hijos = `A-01`/`A-02`, nietos = `A-01-01`
  - Orden: siempre por `created_at` ASC. Nunca alfabético.
  - Múltiples roots: A-00, B-00, C-00 (hasta ZZ)
- `MapView.tsx`: `useMemo(() => computeTeamCodes(teams), [teams])` → pasa `teamCode` prop a `TeamAgentCard`
- `TeamAgentCard.tsx`:
  - GMCard: badge pequeño junto al label "General Manager"
  - TreeWorkspaceCard: título prefijado `${teamCode} · ${node.teamName}`

### Razón
Demo first — la demo muestra códigos en las cards. El MVP necesita versión dinámica porque la demo es estática.

### Archivos / superficies afectadas
- `src/lib/teams/computeTeamCodes.ts` (nuevo)
- `src/components/teams/MapView.tsx`
- `src/components/teams/map/TeamAgentCard.tsx`

### Riesgos o pendientes
Si se implementan team codes en TreeView también, reutilizar `computeTeamCodes` — no duplicar la lógica.

### Próximo paso recomendado
Evaluar si TreeView debe mostrar los mismos códigos (OE separada).
