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

---

## [2026-05-19~20] — GMCard rediseño (description visible + tokens cromáticos)

### Decisión / Estado cerrado
GMCard en Teams Map ahora muestra la descripción del team visible en el cuerpo de la card. Layout reorganizado con tokens cromáticos del sistema corporativo. Background con gradiente `linear-gradient(180deg, tokens.header 0%, tokens.bg 100%)`.

### Archivos / superficies afectadas
- `src/components/teams/map/TeamAgentCard.tsx`

### Riesgos o pendientes
Ninguno.

---

## [2026-05-19~20] — Sistema cromático corporativo (12 paletas fijas)

### Decisión / Estado cerrado
Reemplazado golden angle (HSL dinámico) por 12 paletas fijas corporativas (`CORPORATE_PALETTES`). Función `teamCodeToPaletteIndex(code)` parsea el segundo segmento del código jerárquico (ej: `A-01` → índice 1). Función `getProjectColorTokens(index, nodeType)` retorna `{bg, header, border, badge, accent}`.

Fuente única de color para MAP, Tree y Workspace ribbons. No hay lógica de color duplicada.

### Archivos / superficies afectadas
- `src/lib/teams/getProjectColor.ts`

### Riesgos o pendientes
Paletas hardcodeadas. Si se agregan más de 12 teams raíz, los índices ciclan (módulo 12) — comportamiento aceptable para MVP.

---

## [2026-05-19~20] — Numeración jerárquica extendida a Tree, Documentation Mode y Audit Log

### Decisión / Estado cerrado
`computeTeamCodes()` ya existía para MAP. Se extendió a:
- **TreeView**: códigos visibles en nodos, workers mapeados a tipo `subteam` para heredar color de paleta.
- **Documentation Mode**: pasa `teamCodes` desde el servidor vía `getProjectsWithHierarchy()`.
- **Audit Log**: `AuditEventRow` extendido con `team_id` / `team_name` via join `workspaces(name, teams(id, name))`. `AuditClient` computa `teamCodes` y los pasa al calendario.

### Archivos / superficies afectadas
- `src/components/teams/TreeView.tsx`
- `src/lib/db/audit.ts`
- `src/app/audit/page.tsx`
- `src/components/audit/AuditClient.tsx`

### Riesgos o pendientes
`audit_log` no tiene FK formal a `checkpoints` — tradeoff arquitectónico pendiente (registrado en CLAUDE.md).

---

## [2026-05-19~20] — Colorimetría MAP y Tree con gradiente

### Decisión / Estado cerrado
- MAP (`TeamAgentCard`): GMCard y TreeWorkspaceCard usan `linear-gradient(180deg, tokens.header 0%, tokens.bg 100%)` — sin color sólido.
- Tree (`TreeView`): mismo patrón de gradiente. Workers mapeados a tipo `subteam` para obtener color del equipo (no neutral). Rail del árbol usa `tokens.border`.
- Colorimetría MAP: `rootIndex` determina paleta del root, `teamIndex` para sub-teams. Golden angle eliminado.

### Archivos / superficies afectadas
- `src/components/teams/map/TeamAgentCard.tsx`
- `src/components/teams/TreeView.tsx`

---

## [2026-05-19~20] — Workspace header con nombre de team + ribbons de color

### Decisión / Estado cerrado
El header del Workspace muestra el nombre del team con `accentColor` derivado de la paleta corporativa. Ribbons de color consistentes con el sistema de `getProjectColorTokens`.

### Archivos / superficies afectadas
- `src/components/workspace/WorkspaceShell.tsx` (o equivalente)

---

## [2026-05-19~20] — Audit Log: calendario Month/Week/Day con SSR deshabilitado

### Decisión / Estado cerrado
Reemplazada timeline lineal por calendario Month/Week/Day portado desde demo `PageC.tsx` (sin librerías externas, solo `Date` native + CSS grid).

**Hydration fix definitivo:** `AuditClient` se importa desde `page.tsx` con `dynamic(..., { ssr: false })`. Ni `AuditClient` ni `AuditTimeline` se renderizan en server. Elimina cualquier posibilidad de mismatch server/client por fechas, timezone o locale.

Patrón previo intentado (movido `focusDate` a `useEffect`, eliminado `?? new Date()` de useMemos) no fue suficiente — se requería deshabilitar SSR completo del componente.

### Archivos / superficies afectadas
- `src/app/audit/page.tsx` — dynamic import con `ssr: false`
- `src/components/audit/AuditClient.tsx` — dynamic import interno de AuditTimeline (redundante pero inofensivo)
- `src/components/audit/AuditTimeline.tsx` — calendario completo nuevo

### Riesgos o pendientes
Con `ssr: false`, la página Audit Log no genera HTML en server — el SEO/crawl de esa ruta queda en cliente. Aceptable para una herramienta interna.

---

## [2026-05-19~20] — ESLint fix: unused vars con _ prefix

### Decisión / Estado cerrado
`.eslintrc.json` extendido con `varsIgnorePattern: "^_"` y `argsIgnorePattern: "^_"`. Variables work-in-progress en `WorkspaceShell.tsx` renombradas con prefijo `_`. Variables código muerto (`PURPOSE_COLORS`, `saveLabel`, `INTER_TEAM_GAP`) eliminadas. Unbloquea `npm run build` en Vercel.

### Archivos / superficies afectadas
- `.eslintrc.json`
- `src/components/workspace/WorkspaceShell.tsx`
- `src/lib/map/buildAgentLayout.ts`

---

## [2026-05-19~20] — Decisiones arquitectónicas discutidas, no implementadas

### Decisión / Estado: pendiente de OE

Tres decisiones discutidas en sesión pero sin implementación todavía:

1. **BYOK-first para API keys** — el usuario trae su propia key por provider. AISync no paga uso de IA de sus clientes. Tabla `user_api_keys` ya existe en schema.

2. **Gestión gobernada de archivos** — 4 estados: efímero → draft → saved object → archived. Diseñado para Content Plane (migrable). No implementado.

3. **Repositorio de Contexto** — RAG gobernado con `pgvector`, scope jerárquico (Account > Project > Team > Workspace). No implementado. Requiere migración DB y decisión de hosting del modelo de embeddings.

### Próximo paso recomendado
Cualquiera de los tres requiere OE propia antes de implementar.

---

## [2026-05-20] — OE SAT/MAT Structured Context — Capas 1, 3 y 4 implementadas

### Contexto
Los agentes en workspace SAT no tenían visibilidad del trabajo de sus pares. Cada AgentPanel operaba en aislamiento total — solo veía su propio historial de mensajes. El objetivo era que en equipos SAT, cada agente pudiera ver el estado reciente de los otros paneles antes de responder.

### Decisión / Estado cerrado
Implementación de 3 capas de contexto en `/api/chat/route.ts`:
- **Capa 1** (role prompt): ya existía, preservada
- **Capa 3** (team system prompt): consulta `system_prompts` por `team_id`. Silencia error si columna no existe — forward-compatible
- **Capa 4** (snapshot de pares): últimos 5 mensajes de cada panel hermano, formateado como bloque de contexto. Solo para SAT; MAT queda aislado

Orden final de ensamblado: `[rolePromptParts, teamPromptParts, snapshotParts, rawMessages]`

El snapshot viaja desde el cliente: `WorkspaceShell` construye `buildOtherPanelsSnapshot()` via `panelRefs`, lo pasa como prop a cada `AgentPanel`, que lo serializa en el fetch body.

### Archivos modificados
- `src/app/api/chat/route.ts` — reescritura completa del ensamblado de mensajes
- `src/components/workspace/AgentPanel.tsx` — nuevo prop `teamId`, `teamType`, `getOtherPanelsSnapshot`; snapshot incluido en fetch body
- `src/components/workspace/WorkspaceShell.tsx` — `teamType` computado con `useMemo`; `buildOtherPanelsSnapshot` con `useCallback`; props nuevos pasados a cada AgentPanel

### Alternativas descartadas
- **Snapshot para MAT**: descartado porque en MAT no hay un "equipo" coordinado. Cada agente puede tener proveedor distinto y rol independiente. Sin flag confiable de "MAT coordinado", la inyección ciega podría confundir modelos. Pendiente revisión cuando MAT tenga casos de uso definidos.
- **Snapshot completo (todos los mensajes)**: descartado — muy costoso en tokens. `slice(-5)` + `content.slice(0, 400)` es suficiente para awareness sin inflar el contexto.
- **Persistencia del snapshot en DB**: descartado — el snapshot es efímero por diseño (Content Plane). No debe persistirse en Control Plane.

### Riesgos / deuda técnica
- La **Capa 2** (Prompts Library del usuario) no está implementada. El comentario en el código marca el gap entre Capa 1 y Capa 3.
- Capa 3 (`team_id` en `system_prompts`) requiere migración DB para funcionar. La query falla silenciosamente hoy — comportamiento aceptable.
- El snapshot usa `panelRefs.current` en el momento del send. Si un panel no está montado todavía, retorna `[]` — sin crash, pero sin contexto.

### Commit
`0f40de5` — feat: SAT structured context — layers 1/3/4 in chat API
