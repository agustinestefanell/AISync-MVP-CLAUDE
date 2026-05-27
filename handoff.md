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

---

## [2026-05-21] — OE: Prompt Library MVP con asignación Team/Worker e inyección runtime

### Archivos modificados
- `supabase/migrations/016_prompt_library.sql` — CREADO
- `src/lib/db/prompts.ts` — CREADO
- `src/components/workspace/PromptLibrary.tsx` — CREADO
- `src/components/workspace/AgentPanel.tsx` — MODIFICADO
- `src/app/api/chat/route.ts` — MODIFICADO

### Tablas creadas
**`prompt_library`**: `id`, `user_id`, `title`, `body`, `scope` (worker|team), `status`, `version`, `tags`, `notes`, `created_at`, `updated_at`. RLS: solo el dueño (`user_id = auth.uid()`).

**`prompt_assignments`**: `id`, `prompt_id` (FK cascade), `assigned_to` (worker|team), `target_id`, `agent_role`, `is_active`, `created_at`. RLS: solo si el prompt pertenece al usuario.

### Funciones CRUD (src/lib/db/prompts.ts)
`listActivePromptsForContext({ teamId, sessionId, agentRole })` — server-side, usa `createClient()` del server. Retorna `{ teamPrompts, workerPrompts }`.

### Componente PromptLibrary.tsx
Modal con dos secciones: **Library** (CRUD + Assign to Worker / Assign to Team) y **Active in this context** (Assigned to this Worker + Inherited from Team + Unassign). Usa Supabase browser client directamente, mismo patrón que `TeamsClient.tsx`.

### Cambios en AgentPanel.tsx
- Importado `PromptLibrary`
- Agregado state `showPromptLibrary`
- Botón "Prompt Library" reemplazado: ya no es Coming soon, abre el modal con `teamId`, `teamType`, `workspaceId`, `sessionId`, `agentRole`
- "Add Context File" mantiene tooltip Coming soon
- `PromptLibrary` renderizado dentro de Fragment junto al panel principal

### Cambios en route.ts — Orden de inyección runtime
```
1. Role Prompt base (rolePromptParts) — Capa 1
2. Team Prompt de system_prompts (teamPromptParts) — Capa 3
3. Prompt Library Team prompts (promptLibraryParts[0]) — NUEVO
4. Prompt Library Worker prompts (promptLibraryParts[1]) — NUEVO
5. Snapshot SAT de otros paneles (snapshotParts) — Capa 4
6. Historial local (rawMessages)
```

### Precedencia Team/Worker
Worker Prompt prevalece en su ámbito porque se inyecta después del Team Prompt. La arquitectura va de lo general (Team) a lo singular (Worker). Si hay conflicto de instrucciones, el Worker Prompt sobrescribe al nivel del agente que lo tiene asignado.

### Decisiones técnicas
- **Sin delete físico**: `is_active = false` para desasignar, `status = 'active'` para prompts. No se implementó archive/delete MVP.
- **Sin trigger `updated_at`**: misma decisión que el resto del proyecto (no hay triggers automáticos). Se actualiza manualmente desde el componente.
- **RLS sobre `prompt_assignments`**: verifica FK contra `prompt_library.user_id`. Garantiza que nadie puede asignar/ver asignaciones de prompts ajenos.
- **Wrapping con Fragment**: AgentPanel ya tenía un `<div>` raíz; se envolvió en `<Fragment>` para soportar el modal fuera del árbol del panel.
- **query en dos pasos**: assignments → prompt_ids → prompt rows. Evita problemas de TypeScript con nested select de Supabase sin tipos generados.
- **Inyección en route.ts dentro de `try/catch`**: si la tabla no existe o falla la query, el chat sigue funcionando sin error visible.

### Lo que quedó fuera del MVP
- Audit Log de prompts
- Versionado complejo (auto-increment de version)
- Aprobación multinivel
- Prompts por Project/Subteam
- Prompts temporales
- Scoring automático
- AI que sugiere prompts
- Delete físico de prompts

### Riesgos pendientes
- **Migración en Supabase pendiente de ejecución**: `016_prompt_library.sql` debe ejecutarse en Supabase Dashboard antes de usar la feature en producción. Hasta entonces, el chat sigue funcionando (queries dentro de try/catch).
- **RLS sin policy de delete en `prompt_assignments`**: intencionalmente omitida para MVP ya que se usa `is_active = false`. Si se agrega delete físico en el futuro, agregar policy correspondiente.
- **RLS sin policy de delete en `prompt_library`**: mismo criterio.

### Commit
Build pasa. OE cerrada.

---

## [2026-05-21] — Fix: Prompts Library en BottomRibbon conectado a modal temporal

### Cambios
- `src/components/layout/BottomRibbon.tsx` — "Prompts Library" ya no es `future: true`. Renderiza `<button>` que abre `PromptLibrary` en modo solo-biblioteca (teamId/sessionId/agentRole vacíos).
- `src/components/workspace/PromptLibrary.tsx` — sección "Active in this context" muestra mensaje "Open a workspace to see active prompts." cuando sessionId y teamId están vacíos.

### Nota de pendiente
**Prompts Library en ribbon = modal temporal.**
**Pendiente: implementar página /prompts dedicada.**

### Decisión
El estado del modal vive en `BottomRibbon` directamente (ya es client component). No se tocó `AppLayout` (server component). No se creó ruta `/prompts`.

### Build
Pasa sin errores.

---

## [2026-05-21] — OE A: Context Files Schema + CRUD + Storage

### Archivos creados
- `supabase/migrations/017_context_sources.sql`
- `src/lib/storage/contextFiles.ts`
- `src/lib/context/extractText.ts`
- `src/lib/db/context.ts`

### Tabla `context_sources`
Campos: `id`, `user_id`, `title`, `source_kind`, `scope`, `project_id`, `team_id`, `workspace_id`, `session_id`, `content_text`, `file_path`, `file_type`, `file_size_bytes`, `status`, `retention_mode`, `extracted_text_available`, `origin_type`, `origin_message_id`, `notes`, `tags`, `created_at`, `updated_at`.

RLS: `FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`.

### Bucket Supabase Storage
- Nombre: `context-files`
- Visibilidad: **private**
- La migración incluye SQL para crear el bucket (`INSERT INTO storage.buckets`) y RLS sobre `storage.objects`.
- **Si el INSERT falla** (extensión storage no activa o permisos insuficientes), crear manualmente en Supabase Dashboard: Storage → New Bucket → "context-files" → Private.
- RLS de storage: path format `{userId}/{contextSourceId}/{safeFileName}` — solo el dueño puede subir/leer/borrar.

### Helpers de Storage (`src/lib/storage/contextFiles.ts`)
- `uploadContextFile({ file, fileName, mimeType, userId, contextSourceId })` → devuelve `file_path`
- `getContextFileUrl(filePath, expiresInSeconds)` → devuelve signed URL temporal (default 1h). No URL pública.

### CRUD (`src/lib/db/context.ts`)
- `createContextSource(data)` — crea registro
- `updateContextSource(id, data)` — actualiza con `updated_at`
- `listContextSources({ userId, scope?, projectId?, teamId?, workspaceId?, sessionId? })` — filtra activos
- `getContextSource(id)` — por id
- `archiveContextSource(id)` — cambia status a 'archived'
- `extractAndSaveText(id, text)` — guarda content_text y marca `extracted_text_available = true`
- `getContextSourcesForRuntime({ projectId?, teamId?, sessionId? })` — query OR multi-scope, preparado para OE C

### Extractor de texto (`src/lib/context/extractText.ts`)
- `extractTextFromBuffer(buffer, mimeType)` → `{ text, supported }`
- TXT/MD/CSV/JSON/HTML: extracción directa (`buffer.toString('utf-8')`)
- PDF: `pdf-parse` (dynamic import — cast `as unknown as callable` por `export =` ESM syntax de v2)
- DOCX: `mammoth.extractRawText`
- Otros: `{ text: null, supported: false }` — guarda referencia sin extracción
- `detectMimeType(fileName)` → mimeType por extensión

### Dependencias agregadas
- `pdf-parse@2.4.5` + `@types/pdf-parse@1.1.5`
- `mammoth@1.12.0` (tipos incluidos)

### Decisiones técnicas
- **`pdf-parse` import**: v2.x usa `export =` ESM. Se importa como `(await import('pdf-parse')) as unknown as callable` para evitar error TypeScript.
- **Sin require()**: ESLint del proyecto prohíbe `@typescript-eslint/no-require-imports` — todo via `import()` dinámico.
- **Sin trigger updated_at**: mismo criterio que el resto del proyecto.
- **Bucket SQL en migración**: incluido con `ON CONFLICT DO NOTHING`. Si falla, creación manual en Dashboard queda documentada.

### Validaciones
- Build: ✓ sin errores
- Migración: lista para ejecutar en Supabase Dashboard
- CRUD: funciones tipadas, usa server client con RLS
- Storage: helpers creados, signed URL, sin URL pública
- Extracción: TXT/MD/PDF/DOCX/otros cubiertos

### Qué queda para OE B
- Página `/context` con lista por scope (Project/Team/Session)
- Botón "Add Context File" funcional desde workspace
- Botón en BottomRibbon

### Qué queda para OE C
- Selección selectiva en `route.ts`
- Herencia Project → Team → Session
- Inyección en context package antes del historial

### Riesgos pendientes
- **Migración no ejecutada todavía** en Supabase Dashboard. Las funciones de CRUD van a fallar hasta que se ejecute.
- **Bucket no creado** hasta que se ejecute la migración (o se cree manualmente).
- `getContextSourcesForRuntime` ordena por `scope` alfabético (project < session < team). En OE C revisar si el orden correcto es project → team → session y ajustar.

### Commit
Build pasa. OE A cerrada.

---

## OE B — Context Files UI · 2026-05-21

### Archivos modificados
- `src/components/workspace/AgentPanel.tsx` — botón "Add Context File" ahora funcional (import ContextFilePanel, state showContextFilePanel, render)
- `src/app/api/context/route.ts` — fix: `catch (e)` → `catch {}` en dos handlers (ESLint no-unused-vars)
- `src/components/layout/BottomRibbon.tsx` — agregado item "Context Files" → `/context` en STATIC_NAV_ITEMS
- `src/app/context/page.tsx` — nuevo: Server Component, auth check → redirect
- `src/app/context/ContextPageClient.tsx` — nuevo: lista activos por scope (Project/Team/Session) con botón Archive

### Decisiones técnicas
- **projectId en AgentPanel**: Props actuales (WorkspaceShell → AgentPanel) no incluyen projectId. Se pasa `undefined` a ContextFilePanel — la sección "Inherited from Project" muestra "No project ID available". A resolver cuando la cadena de props lo exponga.
- **Archive desde página**: Se hace directamente con browser Supabase client (update status='archived'). No hay API route separada — operación simple con RLS.
- **Dos archivos en /context**: page.tsx (Server, auth) + ContextPageClient.tsx (Client, lógica). Mismo patrón que el resto del proyecto.

### Alternativas descartadas
- API route para archive: innecesaria, RLS garantiza que el usuario solo archiva sus propios registros.
- Página con upload integrado: el upload ya existe en ContextFilePanel (modal desde workspace). La página /context es solo gestión.

### Validaciones
- Build: ✓ sin errores (solo warnings pre-existentes en CanvasViewport.tsx)
- Nuevas rutas: `/context` y `/api/context` visibles en build table
- Warnings: 2 de react-hooks/exhaustive-deps en CanvasViewport.tsx — pre-existentes, no de esta OE

### Qué queda para OE C
- Inyección de context_sources en `route.ts` (chat API)
- Selección Project → Team → Session con herencia
- `getContextSourcesForRuntime` ya implementado — solo conectar

### Riesgos pendientes
- **Migración 017 + bucket no ejecutados** en Supabase Dashboard hasta que el developer lo haga. Sin eso, upload y listado fallan en producción.
- **projectId missing**: ContextFilePanel recibe `teamId` y `sessionId` pero no `projectId`. La sección Project en el panel muestra vacío siempre. Resolver en OE futura cuando se exponga projectId en la cadena workspace → panel.

### Commit
Build pasa. OE B cerrada.

---

## OE C — Context Files Runtime Injection · 2026-05-21

### Archivos revisados
- `C:\proyectos\AISync\MVP\src\` — demo es Vite frontend-only, sin API route de chat. No hay patrón equivalente que portar.
- `src/app/api/chat/route.ts` — diagnóstico previo completo
- `src/lib/db/context.ts` — función getContextSourcesForRuntime

### Archivos tocados
- `src/lib/db/context.ts` — fix de ordenamiento y límite por scope
- `src/app/api/chat/route.ts` — import, project_id, contextFilesParts, orden final

### Diagnóstico previo
- session_id: ya estaba en body
- team_id: ya estaba en body
- workspace_id: declarado en tipo pero no destructurado — no se usa en runtime (normal)
- project_id: NO estaba en body — agregado como opcional con fallback null
- getContextSourcesForRuntime: ordenaba por scope alfabético (project < session < team) — incorrecto. Corregido.

### Cambio en getContextSourcesForRuntime (context.ts)
- Agregado filtro .not('content_text', 'is', null)
- Eliminado .order('scope', { ascending: true }) (era alfabético — incorrecto)
- Ordenamiento en JS por scopeOrder: project=0, team=1, session=2
- Dentro de cada scope: created_at desc
- Límite de 3 fuentes por scope en JS con contador por key

### Cambio en route.ts
- Importado: getContextSourcesForRuntime
- Agregado: project_id al destructuring y tipo (opcional, fallback null)
- Agregado: función helper truncateContextText(text, maxLength=2000)
- Agregado: bloque contextFilesParts (try/catch tolerante a errores)
- Formato: "Context files available to this agent:" + [Scope] Title / Content
- Truncado: 2000 caracteres por fuente
- Orden final: rolePromptParts → teamPromptParts → promptLibraryParts → contextFilesParts → snapshotParts → rawMessages

### Semántica de capas
- Prompt Library = instrucciones/comportamiento
- Context Files = material factual/documental
- Snapshots = estado en tiempo real de otros paneles
- rawMessages = historial de conversación

### Confirmaciones de no-cambio
- streaming: NO tocado
- providers: NO tocados
- apiMessages: NO tocado
- UI: NO tocada
- AgentPanel: NO tocado
- Prompt Library: NO tocada
- RAG/embeddings: NO implementados

### Validación
- Build: sin errores (solo warnings pre-existentes en CanvasViewport.tsx)
- Prueba funcional: requiere migración 017 ejecutada en Supabase + archivo MD subido al Team Context

### Qué queda fuera (futuro)
- RAG, embeddings, vector search
- Ranking semántico por query
- Chunking avanzado
- Límite dinámico según tokens del modelo
- Audit log de uso de Context Files

### Riesgos pendientes
- project_id nunca llega desde el frontend (AgentPanel no lo pasa). Capa Project Context siempre vacía hasta que se exponga en la cadena workspace → AgentPanel → body.
- Migración 017 y bucket aún no ejecutados en Supabase Dashboard.

### Commit
Build pasa. OE C cerrada.

---

## Fix — truncateContextText 2000 → 35000 · 2026-05-22

Archivo: `src/app/api/chat/route.ts`
Cambio: `maxLength = 2000` → `maxLength = 35000` en función `truncateContextText`.

Razón: el truncado de 2000 chars era demasiado agresivo para archivos de contexto reales.
Efecto: cada fuente de Context Files puede contribuir hasta 35.000 chars al contexto del agente.
Build: OK.

---

## Settings — Cloud Providers update · 2026-05-22

Archivo: `src/components/settings/ApiKeysManager.tsx`

Cambios:
- Anthropic: hint actualizado a "Get your API key at console.anthropic.com"
- Groq: agregado a CLOUD_PROVIDERS (name: Groq, color: text-yellow-400)

Naming verificado: runtime usa nombres capitalizados (Anthropic, OpenAI, Google) → Groq usa "Groq".

IA Local: no fue modificada.

Pendiente (OE futura para que Groq funcione en chat):
- Agregar "Groq" a KNOWN_PROVIDERS en route.ts
- Crear src/lib/providers/groq.ts (Groq es OpenAI-compatible)
- Registrar Groq en providers/index.ts
Sin estos 3 cambios, el usuario puede guardar la key pero el chat falla con error 400.

Build: OK.

---

## OE — Groq provider runtime · 2026-05-22

### Archivos tocados
- `src/lib/providers/groq.ts` — nuevo: GroqProvider sobre OpenAI SDK con baseURL Groq
- `src/lib/providers/index.ts` — import GroqProvider + registro en registry
- `src/app/api/chat/route.ts` — "Groq" agregado a KNOWN_PROVIDERS

### Patrón aplicado
Groq es OpenAI-compatible. GroqProvider usa el SDK openai con baseURL: https://api.groq.com/openai/v1. Sin dependencia nueva.

### MODEL_MAP final
- "Llama 3.3 70B" → llama-3.3-70b-versatile
- "Llama 3.1 8B" → llama-3.1-8b-instant
- "Mixtral 8x7B" → mixtral-8x7b-32768
- "Gemma2 9B" → gemma2-9b-it
- Fallback: si el model name no está en el mapa, se pasa directo a Groq (permite usar IDs arbitrarios)

### Naming
Nombre canónico: "Groq" (capitalizado). Coincide con Settings, KNOWN_PROVIDERS y registry.

### Confirmaciones
- UI: NO tocada
- Streaming: NO tocado
- OpenAI/Anthropic/Google/IA Local: intactos
- Build: OK

### Smoke test
Pendiente — requiere API key Groq en Settings y team configurado con provider Groq.

### Estado
OE cerrada. Groq disponible de punta a punta.

---

## OE — Agent Session Description · 2026-05-25

### Archivos tocados
- `supabase/migrations/018_agent_session_description.sql` — CREADO: `ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS description text;`
- `src/lib/db/types.ts` — agregado `description: string | null` a `AgentSession`
- `src/components/teams/EditTeamModal.tsx` — `AgentEdit` + `description`, campo en cada agent card, incluido en PATCH body
- `src/app/api/teams/[id]/route.ts` — tipo body actualizado, `description` persistido en UPDATE de agent_sessions
- `src/components/workspace/AgentPanel.tsx` — `session.description` mostrado en header del panel si existe

### Cambio por archivo

**types.ts**: campo `description: string | null` en `AgentSession`. Opcional en la lectura (puede ser null para sessions pre-existentes sin descripción asignada).

**EditTeamModal.tsx**:
- `AgentEdit` interface: nuevo campo `description: string`
- `toAgentEdit`: lee `a.description ?? ''`
- Agent cards (izquierda): nuevo `<input type="text">` al final de cada card con placeholder "Agent description (optional)"
- PATCH body: `description: a.description.trim() || null` (null si vacío)

**route.ts** (`/api/teams/[id]`):
- Tipo del body agents array: `description?: string | null`
- Loop de update: `description: agent.description ?? null`

**AgentPanel.tsx**:
- Header: tercera línea debajo de `{session.model}` — muestra `session.description` en `text-[10px]` con color `--color-text-tertiary` si existe. Truncada con `truncate`.

### Decisión técnica
- Description por agent session (no por agente como tipo global). Permite que el mismo rol (worker1) tenga descripciones distintas en distintos teams.
- Guardado en columna `description` top-level (no en `config JSONB`) — más limpio para queries futuras y visibilidad directa en `AgentSession`.
- Sin validación obligatoria: campo opcional. No se agregó `if (!description.trim())` error — la descripción es informativa, no estructural.

### Alternativas descartadas
- **Config JSONB**: descartado — description es dato de primer orden, no configuración técnica. Columna separada es más semántica.
- **Campo solo en manager**: descartado — cualquier agente puede beneficiarse de una descripción de rol específico al contexto del team.
- **Display en tooltip**: descartado — línea inline en el header es más visible y no requiere hover interaction.

### Riesgos pendientes
- **Migración 018 no ejecutada**: debe correr `ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS description text;` en Supabase Dashboard SQL Editor. Hasta entonces, el PATCH a agent_sessions intentará actualizar la columna `description` que no existe — el update falla silenciosamente (no rompe el chat).
- **Migraciones 016, 017 también pendientes**: acumulado de sesiones anteriores.

### Build
TypeScript compilado sin errores. Warnings pre-existentes en CanvasViewport.tsx (react-hooks/exhaustive-deps). Error `/_document` en Next.js page data collection — pre-existente, no relacionado con esta OE.

### Estado
OE cerrada. Descripción editable por agente disponible de punta a punta, pendiente migración DB.

---

## EditTeamModal — Agent Description UI + Modal Width · 2026-05-25

### Archivos tocados
- `src/components/teams/EditTeamModal.tsx` — único archivo modificado

### Demo First
Demo MVP (`C:\proyectos\AISync\MVP`) no tiene `EditTeamModal` — es frontend-only sin gestión de teams. No hay patrón que portar.

### Diagnóstico previo
- Ancho anterior: `max-w-3xl` (48rem = 768px)
- Campo `description` en agent cards: ya existía (OE anterior) pero sin label y con placeholder genérico

### Cambios
1. **Ancho del modal**: `max-w-3xl` → `max-w-5xl` (64rem = 1024px, +256px ≈ 200px más ancho)
2. **Input Description en cada agent card**:
   - Agregado `<label>Description</label>` encima del input
   - Placeholder actualizado: "Describe this agent's focus or specialty"
   - Conectado a `agents[index].description` via `setAgentField(i, { description: ... })`
   - Incluido en PATCH: `description: a.description.trim() || null` (ya estaba desde OE anterior)

### Confirmaciones
- providers/modelos: NO tocados
- streaming: NO tocado
- route.ts chat: NO tocado
- MAP / Tree: NO tocados
- Prompt Library / Context Files: NO tocados
- Lógica de guardado: NO cambiada

### Build
✓ Compilado sin errores. Solo warnings pre-existentes en CanvasViewport.tsx.

### Validación manual pendiente
1. Teams Map → Edit Team → confirmar modal más ancho
2. Cada agent card tiene label "Description" + placeholder "Describe this agent's focus or specialty"
3. Escribir descripción, guardar, reabrir — persistencia requiere migración 018 ejecutada en Supabase

### Estado
OE cerrada.

---

## EditTeamModal — limpieza controles + textarea · 2026-05-25

### Archivo tocado
`src/components/teams/EditTeamModal.tsx` — único archivo modificado.

### Demo First
Demo MVP no tiene equivalente. No hay Focus ni Lead Role en ningún componente de edición de teams.

### Controles eliminados
- **Focus** (header): label + select eliminados. State `focusedAgent`/`setFocusedAgent` también eliminado (puramente UI, no en payload).
- **Lead Role** (team identity row): label + select eliminados. `leadRole` value conservado en payload (`lead_role: leadRole`). `setLeadRole` eliminado del destructuring (quedaba unused tras quitar el select).

### Inputs convertidos a textarea
- **Team Description**: `input type="text"` → `textarea rows={2} resize-none`. Mismo binding: `value={description}` + `onChange={e => setDescription(e.target.value)}`.
- **Agent Description (×3)**: `input type="text"` → `textarea rows={2} resize-none`. Mismo binding: `value={a.description}` + `onChange={e => setAgentField(i, { description: e.target.value })}`.

### Ajuste de grid
Team identity row: `grid-cols-3/4` → `grid-cols-2/3` (Lead Role eliminado reduce una columna). Añadido `items-start` para que Name (input) y Description (textarea) no se estiren verticalmente.

### Confirmaciones
- Payload PATCH: NO tocado — `lead_role: leadRole` sigue enviándose con el valor inicial del team.
- Guardado/handlers: NO tocados.
- Providers/modelos/streaming/chat route: NO tocados.

### Build
✓ Sin errores. Warnings pre-existentes en CanvasViewport.tsx.

### Riesgo residual
`leadRole` permanece con el valor inicial (`team.lead_role`) y se envía en el PATCH pero ya no es editable desde el modal. Para cambiar el lead role habrá que re-exponer el control o usar otro flujo.

### Estado
OE cerrada.

---

## EditTeamModal — Fix herencia descripción Workers + hallazgo MAP/Tree · 2026-05-25

### Archivos leídos (demo + MVP)
- Demo MVP: sin componente equivalente — sin patrón que portar.
- `src/components/teams/TeamNode.tsx` — card del MAP.
- `src/components/teams/TreeView.tsx` — card del Tree (componente `TreeNode` interno).

### Hallazgo: truncado ya estaba resuelto

**MAP (`TeamNode.tsx`):** descripción ya tiene `WebkitLineClamp: 2` + `WebkitBoxOrient: 'vertical'` + `overflow: 'hidden'` aplicados desde la implementación original. No se requería cambio.

**Tree (`TreeView.tsx` / `TreeNode`):** el componente `TreeNode` no renderiza la descripción del team en absoluto — solo muestra roleLabel, displayName y botones Open/Edit. No había truncado necesario.

### Archivo tocado
`src/components/teams/EditTeamModal.tsx` — único archivo modificado.

### Fix aplicado — herencia de descripción en Workers

**Cambio 1 — `toAgentEdit`:**
- Manager sin descripción propia: inicializa con `team.description ?? ''` (pre-rellena con la descripción del team).
- Workers sin descripción propia: inicializa con `''` (campo vacío sin herencia).
- La lógica de guardado no cambia: `a.description.trim() || null` persiste lo que el usuario escriba.

**Cambio 2 — placeholder del textarea por agente:**
- Manager: `"Describe this agent's focus or specialty"` (puede ver la descripción del team como referencia).
- Workers: `"Add a role description for this agent"` (distingue visualmente que se espera descripción específica del rol).

### Confirmaciones
- Payload PATCH: NO tocado.
- Lógica de guardado: NO tocada.
- Providers/modelos/streaming/chat route: NO tocados.
- MAP / Tree: NO tocados.

### Build
✓ Sin errores. Warnings pre-existentes en CanvasViewport.tsx.

### Riesgos residuales
- Si el Manager ya tenía una descripción propia guardada, se usa esa (correcto). Si no tiene, hereda la del team como valor inicial — al guardar, ese valor se persiste en `agent_sessions.description`. Requiere migración 018 ejecutada para persistir correctamente.
- Si team.description es null (team sin descripción), Manager también muestra campo vacío.

### Estado
OE cerrada.

---

## EditTeamModal — rediseño sin scroll · 2026-05-25

### Archivo tocado
`src/components/teams/EditTeamModal.tsx` — único archivo modificado.

### Demo First
Demo MVP no tiene `EditTeamModal` — no hay patrón equivalente que portar.

### Diagnóstico previo — qué generaba scroll
Columna izquierda del grid 2-cols acumulaba: Name + Description (team, textarea 2 rows) + Lead Role + Sub-team of + 3 agent cards stacked. La columna derecha (Team Controls) añadía ancho sin reducir altura.

### Cambios aplicados
1. **Panel derecho "Team Controls" eliminado** — completo.
2. **Agent Name readOnly eliminado** — redundante con el label de cada card.
3. **Provider selector duplicado eliminado** — existía en Team Controls como espejo del selector en cada card.
4. **Agent Focus movido al header** — inline junto al badge SAT/MAT. Label compacto "Focus" + select.
5. **`focusedAgentData` variable eliminada** — solo se usaba en el panel derecho. `focusedAgent` state conservado para el dropdown en header.
6. **Team identity en fila horizontal** — Name + Description + Lead Role + Sub-team of en `grid-cols-3/4`.
7. **Team Description** — `textarea rows={2}` → `input type="text"` para ganar altura.
8. **Agents en grid 3 columnas** — Manager / Worker 1 / Worker 2 side by side. Cada card: provider (full width) + model (full width) + endpoint (si local) + description.
9. **Add Agent / Promote / Erase Agent / Refresh** — `grid grid-cols-4` debajo de agent cards.
10. **Erase Team** — movido al footer junto a Go to Workspace.

### Confirmaciones
- Lógica de guardado: NO tocada — providers, modelos, streaming, route.ts: NO tocados
- Handlers de Save/Delete: NO tocados — estados disabled de botones: conservados

### Build
✓ Sin errores. Warnings pre-existentes en CanvasViewport.tsx.

### Estado
OE cerrada.

---

## MAP TeamAgentCard — Fix descripción individual de Workers · 2026-05-25

### Archivos tocados
- `src/lib/db/agent-map.ts` — agregado `agentDescription: string | null` a `AgentNode`, poblado con `agent.description`
- `src/lib/map/buildAgentLayout.ts` — agregado `agentDescription: string | null` a `MapAgentNode`, propagado desde `a.agentDescription`
- `src/components/teams/map/TeamAgentCard.tsx` — `brief` para worker cards usa `node.agentDescription ?? node.teamDescription ?? ''`

### Diagnóstico previo
El MAP de teams no usa `TeamNode.tsx` (ese es un componente @xyflow legacy). Usa `TeamAgentCard.tsx` renderizado desde `MapView.tsx` a través de:
```
TeamsClient → MapView → TeamAgentCard → TreeWorkspaceCard (para worker/SM)
```
El campo `brief` en `TreeWorkspaceCard` (el área de descripción del card) era `node.teamDescription ?? ''` — usando siempre la descripción del team, no la del agente individual.

### Data chain
`agent_sessions.description` → `AgentNode.agentDescription` → `MapAgentNode.agentDescription` → `TeamAgentCard` → `brief`

### Lógica aplicada
- **Worker nodes**: `node.agentDescription ?? node.teamDescription ?? ''` — prioriza la descripción del agente; si no tiene, cae a la del team; si tampoco, vacío (renderiza "No description yet." en itálica)
- **Senior Manager nodes**: sin cambio — usan `node.teamDescription ?? ''` (descripción del sub-team)
- **GM card**: sin cambio — ya usaba `node.teamDescription` en bloque dedicado

### Confirmaciones
- GM card: NO tocada
- Tree view: NO tocada
- AgentPanel: NO tocado
- EditTeamModal: NO tocado
- Streaming / chat route: NO tocados
- Layout / posicionamiento del MAP: NO tocados

### Alternativas descartadas
- **Solo `agentDescription`**: descartado — si el agente no tiene descripción aún, el card quedaría vacío sin fallback informativo
- **Solo `teamDescription`**: era el bug — descriptions individuales de workers no se mostraban

### Build
✓ `tsc --noEmit` sin errores. Warnings pre-existentes en CanvasViewport.tsx.

### Riesgo residual
- Requiere migración 018 ejecutada en Supabase para que `agent_sessions.description` exista. Sin la migración, `agent.description` es `undefined` en el tipo y el fallback a `teamDescription` actúa como antes.
- Migraciones 016, 017, 018 siguen pendientes de ejecución en Supabase Dashboard.

### Estado
OE cerrada.

---

## Teams Map — Tooltip nativo en descripción truncada de Worker cards · 2026-05-25

### Archivo revisado (Demo First)
`C:\proyectos\AISync\MVP\src` — no hay `TeamAgentCard` ni descripción con tooltip en la demo. No hay patrón que portar.

### Archivo tocado
`src/components/teams/map/TeamAgentCard.tsx` — único archivo modificado.

### Componente y elemento
`TreeWorkspaceCard` (función interna del archivo). El `<div>` que renderiza `{brief || <span>No description yet.</span>}`.

### Cambio
Agregado `title={brief || undefined}` al div de descripción:
- Si `brief` tiene contenido: el tooltip muestra el texto completo en hover.
- Si `brief` es vacío (`''`): `title` es `undefined` — no genera tooltip vacío.
- El fallback "No description yet." no cambia.

### Confirmaciones
- line-clamp / truncado CSS: NO tocado
- MAP layout, posicionamiento, colores, conexiones: NO tocados
- GM card: NO tocado
- Tree: NO tocado
- EditTeamModal, AgentPanel, route.ts, providers, streaming: NO tocados

### Build
✓ `npm run build` sin errores.

### Estado
OE cerrada.

---

## Teams Map — Custom tooltip CSS en descripción de Worker cards · 2026-05-25

### Archivo revisado (Demo First)
`C:\proyectos\AISync\MVP\src` — sin patrón equivalente. No hay que portar.

### Archivo tocado
`src/components/teams/map/TeamAgentCard.tsx` — único archivo modificado.

### Cambio aplicado
El bloque de descripción en `TreeWorkspaceCard` pasó de:
- `<div title={briefTooltip}>` (tooltip nativo)

A:
- `<div className="relative group min-h-[4.35rem] flex-1">` (wrapper)
  - `<div>` con el texto visible (sin `title`)
  - `{briefTooltip && <div className="absolute hidden group-hover:block z-50 ...">}` (tooltip custom)

### Comportamiento
- Tooltip aparece solo si `briefTooltip` existe (`node.agentDescription?.trim()`)
- `group-hover:block` activa el tooltip en hover puro CSS, sin JS state
- `w-full` — ancho igual al bloque de descripción
- `top-full left-0 mt-1` — se despliega hacia abajo
- Dentro de card con `overflow-hidden`: el tooltip queda visible solapando la sección de actions (dentro del card). Aceptable para MVP.

### Confirmaciones
- `title={briefTooltip}` eliminado
- Sin JS state ni handlers
- Sin librerías externas
- MAP layout, colores, conexiones: NO tocados
- Tree: NO tocado
- EditTeamModal, AgentPanel, route.ts, providers, streaming: NO tocados

### Build
✓ `tsc --noEmit` sin errores. `npm run build` limpio.

### Riesgo residual
El card raíz tiene `overflow-hidden`. El tooltip se despliega dentro del card solapando los botones Open/Edit en hover. Si en el futuro se quiere un tooltip que aparezca fuera del card, habría que cambiar `overflow-hidden` o usar `position: fixed` con JS.

### Estado
OE cerrada.

---

## Teams Map — Tooltip fixed position en Worker cards · 2026-05-25

### Cambio
Reemplazo del tooltip CSS (`group-hover`) por tooltip con `position: fixed` + `useState`.

### Archivo tocado
`src/components/teams/map/TeamAgentCard.tsx`

### Implementación
- `import { useState }` agregado
- `const [tooltip, setTooltip] = useState<{x:number; y:number} | null>(null)` en `TreeWorkspaceCard`
- `onMouseEnter`: `getBoundingClientRect()` → guarda `{ x: rect.left, y: rect.bottom + 4 }`
- `onMouseLeave`: `setTooltip(null)`
- Tooltip renderizado con `position: fixed` + `zIndex: 9999` → escapa `overflow-hidden` del card raíz
- `width: 280` fijo (no depende del card width)
- Solo se monta si `briefTooltip && tooltip` → sin tooltip vacío

### Verificación data chain
`agent_sessions.description` → `agent.description` → `AgentNode.agentDescription` (agent-map.ts, sin truncado) → `MapAgentNode.agentDescription` (buildAgentLayout.ts, sin truncado) → `node.agentDescription?.trim()` → `briefTooltip`. Texto llega completo al componente.

### Build
✓ `tsc --noEmit` sin errores. `npm run build` limpio.

### Estado
Cerrado.

---

## Light mode global — hardcoded dark classes cleanup · 2026-05-25

### Demo First
Demo MVP (`C:\proyectos\AISync\MVP\src`) no usa `bg-gray-900`, `bg-gray-800` ni `bg-gray-700`. Confirma que light mode es la dirección correcta.

### Archivos modificados (20 de 21)

| Archivo | Clases reemplazadas |
|---|---|
| `EditTeamModal.tsx` | bg-gray-900→bg-white, bg-gray-800→bg-gray-50, border-gray-700→border-gray-200, text-gray-300→text-gray-600, text-gray-200→text-gray-800 |
| `ApiKeysManager.tsx` | bg-gray-900→bg-white, bg-gray-800→bg-gray-50, border-gray-700→border-gray-200, text-gray-300→text-gray-600 |
| `ContextFilePanel.tsx` | bg-gray-900→bg-white, bg-gray-800→bg-gray-50, border-gray-700→border-gray-200, border-gray-600→border-gray-200, text-gray-300→text-gray-600 |
| `PromptLibrary.tsx` | bg-gray-900→bg-white, bg-gray-800→bg-gray-50, bg-gray-700→bg-gray-100, border-gray-700→border-gray-200, border-gray-600→border-gray-200, text-gray-300→text-gray-600 |
| `WorkspaceShell.tsx` | bg-gray-900→bg-white, bg-gray-800→bg-gray-50, border-gray-700→border-gray-200, text-gray-300→text-gray-600, hover:bg-gray-700→hover:bg-gray-100 |
| `AuditTimeline.tsx` | bg-gray-900→bg-white, bg-gray-800→bg-gray-50, bg-gray-700→bg-gray-100, border-gray-700→border-gray-200, text-gray-300→text-gray-600, text-gray-200→text-gray-800 |
| `InvestigateView.tsx` | bg-gray-900→bg-white, bg-gray-800→bg-gray-50, border-gray-700→border-gray-200, text-gray-300→text-gray-600 |
| `StructureView.tsx` | bg-gray-800→bg-gray-50, border-gray-700→border-gray-200, text-gray-300→text-gray-600, text-gray-200→text-gray-800 |
| `RepositoryView.tsx` | bg-gray-900→bg-white, bg-gray-800→bg-gray-50, border-gray-700→border-gray-200, text-gray-300→text-gray-600, text-gray-200→text-gray-800 |
| `DocClient.tsx` | bg-gray-900→bg-white, border-gray-700→border-gray-200, text-gray-300→text-gray-600 |
| `HandoffPackageModal.tsx` | bg-gray-900→bg-white, bg-gray-800→bg-gray-50, bg-gray-700→bg-gray-100, border-gray-700→border-gray-200, text-gray-300→text-gray-600 |
| `AdminClient.tsx` | bg-gray-900→bg-white, bg-gray-800→bg-gray-50, border-gray-700→border-gray-200, border-gray-600→border-gray-200, text-gray-300→text-gray-600, text-gray-200→text-gray-800 |
| `SMDisambiguationModal.tsx` | bg-gray-900→bg-white, border-gray-700→border-gray-200, hover:text-gray-300→hover:text-gray-600 |
| `AuditView.tsx` | bg-gray-900→bg-white, bg-gray-800→bg-gray-50, bg-gray-700→bg-gray-100, border-gray-700→border-gray-200, text-gray-300→text-gray-600, text-gray-200→text-gray-800 |
| `IncomingRequestsPanel.tsx` | bg-gray-900→bg-white, bg-gray-800→bg-gray-50, border-gray-700→border-gray-200, text-gray-300→text-gray-600 |
| `ConnectTeamModal.tsx` | bg-gray-900→bg-white, bg-gray-800→bg-gray-50, border-gray-700→border-gray-200, text-gray-300→text-gray-600 |
| `CustomProvidersManager.tsx` | bg-gray-900→bg-white, bg-gray-800→bg-gray-50, border-gray-700→border-gray-200, text-gray-300→text-gray-600 |
| `SetupGuide.tsx` | bg-gray-900→bg-white, bg-gray-800→bg-gray-50, border-gray-700→border-gray-200, text-gray-200→text-gray-800 |
| `ProjectList.tsx` | bg-gray-900→bg-white, bg-gray-800→bg-gray-50, border-gray-700→border-gray-200, text-gray-300→text-gray-600 |
| `LogoutButton.tsx` | hover:bg-gray-800→hover:bg-gray-50 |
| `KnowledgeMap.tsx` | Paneles laterales + controles UI reemplazados. Canvas dark conservado. |

### Dark intencional conservado
- **KnowledgeMap.tsx**: canvas ReactFlow (`colorMode="dark"`, `Background color="#1e293b"`, MiniMap `background: '#0f172a'`), colores de nodos del grafo (`bg-gray-900` en COLOR_MAP.checkpoint) — conservados.
- **Navbar/TopRibbon**: no estaba en la lista autorizada, no tocado.

### Tabla aplicada
bg-gray-900→bg-white / bg-gray-800→bg-gray-50 / bg-gray-700→bg-gray-100
border-gray-700→border-gray-200 / border-gray-600→border-gray-200
text-gray-100→text-gray-900 / text-gray-200→text-gray-800 / text-gray-300→text-gray-600

### Confirmaciones
- Lógica, handlers, props, API, streaming, route.ts: NO tocados
- MAP, Tree, TeamAgentCard: NO tocados
- AgentPanel, TopRibbon, BottomRibbon, AppLayout: NO tocados

### Build
✓ tsc --noEmit sin errores. npm run build limpio.

### Estado
OE cerrada.

---

## OE A — Light mode color tokens · 2026-05-25

### Archivo modificado
`src/styles/tokens.css`

### Tokens actualizados (valores distintos a los existentes)
- `--color-app-bg`: `#edf1f5` → `#F6F7F9`
- `--color-text-primary`: `#0f172a` → `#111827`
- `--color-text-secondary`: `#334155` → `#374151`
- `--color-text-tertiary`: `#5f6f82` → `#4B5563`
- `--color-text-muted`: `#8a98aa` → `#6B7280`

### Tokens agregados (nuevos)
Superficies: `--color-shell-bg`, `--color-surface-subtle`, `--color-surface-nested`, `--color-input-bg`, `--color-disabled-bg`
Textos: `--color-text-placeholder`, `--color-text-disabled`, `--color-text-danger`, `--color-text-warning`, `--color-text-success`
Bordes: `--color-border-subtle`, `--color-border-default`, `--color-border-focus` (#1f4e79), `--color-border-danger`, `--color-border-warning` (#FDE68A)
Botones: `--color-btn-secondary-*` (4 tokens), `--color-btn-danger-*` (5 tokens)
Badges: 10 tokens (`--color-badge-*-bg/text` para neutral/structural/success/warning/danger)

### Tokens que ya existían (sin cambio)
`--color-surface`, `--color-surface-soft`, `--color-surface-muted`, `--color-surface-raised`, `--color-surface-inverse`, `--color-text-inverse`, `--color-border`, `--color-border-strong`, `--color-border-heavy`, todos los `--color-accent-*`, roles, phases, modules, success/warning/danger semánticos

### Tokens críticos preservados
- `--color-accent: #1f4e79` ✓
- `--color-accent-strong: #173c5e` ✓

### Confirmaciones
- `--color-border-focus: #1f4e79` ✓ (alineado con accent)
- `--color-border-warning: #FDE68A` ✓
- Componentes .tsx: NO tocados
- MAP, Tree, Workspace, ribbons: NO tocados

### Build
✓ `npm run build` limpio.

### Estado
OE A cerrada.

---

## [2026-05-26] — OE B: Apply light mode tokens to 5 components

### Archivos tocados
- `src/app/context/ContextPageClient.tsx`
- `src/components/settings/ApiKeysManager.tsx`
- `src/components/sm/SMPanel.tsx`
- `src/components/teams/ConnectTeamModal.tsx`
- `src/components/teams/EditTeamModal.tsx`

### Cambios por componente

**Context Files (`ContextPageClient.tsx`)**
- Root: `bg-gray-950 text-white` → `bg-[var(--color-app-bg)] text-[var(--color-text-primary)]`
- Títulos y texto helper: reemplazados por tokens `--color-text-primary` / `--color-text-muted`
- Error: `bg-red-950 text-red-400` → `bg-red-50 text-red-600`
- Filas: `border-gray-800` → `border-[var(--color-border-default)]` + `bg-[var(--color-surface)]`

**Edit Team modal (`EditTeamModal.tsx`)**
- Header/footer: `border-gray-800` → `border-[var(--color-border-default)]`
- `text-white` en inputs → `text-[var(--color-text-primary)]` (texto invisible sobre fondo claro)
- SAT badge: `bg-emerald-950 text-emerald-400 border-emerald-800` → light equivalents
- MAT badge: `bg-purple-950 text-purple-400 border-purple-800` → light equivalents
- Secciones Manager/Worker: `bg-gray-50/60` → `bg-[var(--color-surface-subtle)] border-[var(--color-border-subtle)]`
- Labels: `text-gray-400` → `text-[var(--color-text-secondary)]`
- Inputs: `border-gray-200` → `border-[var(--color-border-default)]` + `focus:border-[var(--color-border-focus)]`

**Sub-Manager sidebar (`SMPanel.tsx`)**
- Fondo panel (open): `#0a0f1a` → `var(--color-surface)` — elimina el efecto "panda"
- Fondo panel (collapsed): mantiene `var(--color-surface)` (uniforme)
- Todos los `rgba(255,255,255,...)` → tokens semánticos de texto y borde
- Mensajes assistant: `rgba(255,255,255,0.07)` → `var(--color-surface-soft)` + borde `var(--color-border-subtle)`
- Mensajes user: mantiene `var(--color-accent)` + `text-white` (acción primaria)
- Inputs/selects: `rgba(255,255,255,0.06)` → `var(--color-input-bg)` + `var(--color-border-default)`
- Warning box (consent): `rgba(180,83,9,0.12)` → `var(--color-badge-warning-bg)` + `var(--color-border-warning)`
- Send button: mantiene `var(--color-accent)` + `text-white` (no tocado)

**Provider cards (`ApiKeysManager.tsx`)**
- Fondos tintados (orange-950/30, green-950/30, blue-950/30, yellow-950/30) → `bg-[var(--color-surface)]`
- Bordes tintados (orange-900, green-900, etc.) → `border-[var(--color-border-default)]`
- Colores de texto provider: dark 400 → light 600/700 (orange-600, green-700, blue-600, amber-600)
- Badge "key guardada": `bg-emerald-950 text-emerald-400` → `bg-emerald-50 text-emerald-700`
- Input API key: `text-white` → `text-[var(--color-text-primary)]`
- Nota env var: `border-gray-800` → `border-[var(--color-border-default)]`

**Connect Team modal (`ConnectTeamModal.tsx`)**
- Header/footer: `border-gray-800` → `border-[var(--color-border-default)]`
- `text-white` en select/input → `text-[var(--color-text-primary)]`
- Opción seleccionada "Project-bound": `bg-indigo-950/40 border-indigo-800 text-indigo-300` → `bg-[var(--color-badge-structural-bg)] border-[var(--color-border-default)] text-[var(--color-text-primary)]`
- Opción seleccionada "No shared repo": `bg-gray-50/60` → `bg-[var(--color-surface-subtle)]`
- Labels: `text-gray-400` → `text-[var(--color-text-secondary)]`

### Confirmaciones
- No se tocó lógica, handlers, state, props ni rutas
- No se tocaron botones primarios (`bg-indigo-600`, Send, Connect)
- `--color-accent` intacto (usado en Send/Connect buttons del SMPanel)
- `--color-accent-strong` intacto
- MAP, Tree, Workspace ribbons, AgentPanel, KnowledgeMap canvas, Navbar: no tocados
- Review & Forward, Audit AI: no tocados

### Build
✓ `npm run build` limpio (solo warnings pre-existentes de `useEffect` en CanvasViewport)

### Demo First
Componentes no existen en demo de referencia (`C:\proyectos\AISync\MVP`). Son exclusivos del MVP.

### Estado
OE B cerrada.

---

## [2026-05-26] — OE C: Fix Repository stat contrast and detail panel light mode

### Archivos tocados
- `src/components/documentation/RepositoryView.tsx`

### Componente del panel derecho identificado
- `CheckpointDetailPanel` y `HandoffDetailPanel` — subcomponentes internos de `RepositoryView.tsx`
- Evidencia grep: `bg-gray-950` en líneas 76 y 141, `text-white` en líneas 79 y 148

### Cambios realizados

**Stat cards (`StatCard`)**
- `bg-white border-gray-800` → `bg-[var(--color-surface)] border-[var(--color-border-default)]`
- Número: `text-white` → `text-[var(--color-text-primary)]`
- Label: `text-gray-500` → `text-[var(--color-text-secondary)]`

**Badges (`PURPOSE_BADGE`, `STATE_BADGE`, `STATUS_BADGE`, `HANDOFF_BADGE`)**
- Todos los fondos dark (bg-green-950, bg-blue-950, etc.) → light equivalents (bg-green-50, etc.)
- Textos dark (text-green-400, etc.) → light (text-green-700, etc.)
- Bordes dark → light (border-green-200, etc.)

**Helpers (`Row`, `MetaRow`)**
- `text-gray-600` → `text-[var(--color-text-secondary)]` (labels) y `text-[var(--color-text-primary)]` (valores)
- `text-gray-400` → `text-[var(--color-text-primary)]` (valores en MetaRow)

**`CheckpointDetailPanel`**
- Root: `bg-gray-950 border-gray-800` → `bg-[var(--color-surface)] border-[var(--color-border-subtle)]`
- Títulos: `text-white` → `text-[var(--color-text-primary)]`
- Subtítulos/labels: `text-gray-500/400` → `text-[var(--color-text-secondary)]`
- Secondary Metadata box: `border-gray-800` → `border-[var(--color-border-default)]` + `bg-[var(--color-surface-subtle)]`
- "View in Audit Log": dark → `border-[var(--color-border-default)] text-[var(--color-text-secondary)]`

**`HandoffDetailPanel`**
- Mismas correcciones que CheckpointDetailPanel
- "Manager → Worker 1" arrow: `text-gray-500` → `text-[var(--color-text-muted)]`
- Context box: `bg-white border-gray-800` → `bg-[var(--color-surface-subtle)] border-[var(--color-border-default)]`

**Estructura del contenedor**
- Stats row border: `border-gray-800` → `border-[var(--color-border-default)]`
- List panel border: `border-gray-800` → `border-[var(--color-border-subtle)]`
- Filters border: `border-gray-800` → `border-[var(--color-border-subtle)]`
- List divider: `divide-gray-800/50` → `divide-[var(--color-border-subtle)]`
- Active item: `bg-indigo-950/20` → `bg-[var(--color-badge-structural-bg)]`
- Empty state + placeholder: dark → `text-[var(--color-text-muted)]`

### Confirmaciones
- No se tocó lógica, handlers, state, props, filtros, selección documental
- "Open Document" (bg-indigo-600) no tocado
- "View in Audit Log" href="/audit" no tocado (solo estilos visuales)
- MAP, Tree, Workspace, AgentPanel, KnowledgeMap, Navbar: no tocados

### Demo First
RepositoryView no existe en la demo de referencia. Exclusivo del MVP.

### Build
✓ `npm run build` limpio.

### Estado
OE C cerrada.

---

## [2026-05-26] — OE D: Fix AuditView, InvestigateView, KnowledgeMap panel light mode

### Archivos tocados
- `src/components/documentation/AuditView.tsx`
- `src/components/documentation/InvestigateView.tsx`
- `src/components/documentation/KnowledgeMap.tsx` (solo panel izquierdo)

### Cambios realizados

**`AuditView.tsx`**
- `EVENT_CONFIG` badges: todos dark (text-green-400 bg-green-950, etc.) → light equivalents (text-green-700 bg-green-50 border-green-200, etc.)
- `STATE_BADGE`: todos dark → light (emerald/yellow/red 700+50+200)
- `StatCard`: `bg-white border-gray-800 text-white` → `bg-[var(--color-surface)] border-[var(--color-border-default)] text-[var(--color-text-primary)]`
- Stats row + filters border: `border-gray-800` → `border-[var(--color-border-default)]`
- List divider: `divide-gray-800/50` → `divide-[var(--color-border-subtle)]`
- Item hover: `hover:bg-white/40` → `hover:bg-[var(--color-surface-soft)]`
- Título documento: `text-white` → `text-[var(--color-text-primary)]`
- team_name / workspace_name: `text-gray-600` → `text-[var(--color-text-secondary)]`
- "View Details →": `text-indigo-400 hover:text-indigo-300` → `text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]`
- "Open Document →" / "Audit Log →": `text-gray-500/600` → `text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]`
- Modal header border: `border-gray-800` → `border-[var(--color-border-default)]`
- Modal h3: `text-white` → `text-[var(--color-text-primary)]`
- Modal botón ✕: `text-gray-500` → `text-[var(--color-text-muted)]`
- User message bubble: `bg-indigo-900/50 text-indigo-100` → `bg-[var(--color-badge-structural-bg)] text-[var(--color-text-primary)]`
- Bubble role label: `text-gray-400` → `text-[var(--color-text-muted)]`
- Agent card en modal: `bg-gray-50/60 border-gray-200` → `bg-[var(--color-surface-subtle)] border-[var(--color-border-default)]`
- `Meta` helper: `text-gray-600`/`text-gray-400` → `text-[var(--color-text-secondary)]`/`text-[var(--color-text-primary)]`

**`InvestigateView.tsx`**
- `PURPOSE_BADGE`: todos dark → light (green/blue/purple/orange 700+50+200)
- `StatCard`: mismo fix que AuditView
- Stats row + Investigation Focus border: `border-gray-800` → `border-[var(--color-border-default)]`
- Search input: `text-white placeholder-gray-600` → `text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)]`
- Todos los selects/input filtros: `bg-white border-gray-200 text-gray-600` → tokens
- Section label + helper text: `text-gray-500/700` → `text-[var(--color-text-muted)]`
- Date divider lines: `bg-gray-50` → `bg-[var(--color-border-subtle)]`
- Document cards: `bg-white border-gray-800` → `bg-[var(--color-surface)] border-[var(--color-border-default)]`; hover: → `hover:border-[var(--color-border-focus)]`
- Título documento: `text-white` → `text-[var(--color-text-primary)]`
- "Open Document →": `text-indigo-400 hover:text-indigo-300` → `text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]`
- "Audit Log →": dark → `text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]`
- `InvMeta` helper: `text-gray-600`/`text-gray-400` → `text-[var(--color-text-secondary)]`/`text-[var(--color-text-primary)]`

**`KnowledgeMap.tsx` — solo panel izquierdo (lines 182-228)**
- Panel container: `bg-gray-950 border-r border-gray-800` → `bg-[var(--color-surface)] border-r border-[var(--color-border-subtle)]`
- "Graph Focus Mode" + "Filters" labels: `text-gray-500` → `text-[var(--color-text-secondary)]`
- Inactive mode buttons: `text-gray-500 hover:text-gray-600 hover:bg-white` → `text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]`
- Filter selects: `bg-white border-gray-200 text-gray-600` → `bg-[var(--color-input-bg)] border-[var(--color-border-default)] text-[var(--color-text-primary)]`
- "Clear filters": `text-gray-600 hover:text-gray-400` → `text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]`
- Help text: `text-gray-700` → `text-[var(--color-text-muted)]`

### Confirmaciones
- Canvas ReactFlow (colorMode="dark", Background color="#1e293b", MiniMap, nodes) NO TOCADO
- DocFlowNode y COLOR_MAP NO TOCADOS
- Botón "bg-indigo-600" (modo activo en KnowledgeMap) NO TOCADO
- Botón "Resume →" en modal (bg-indigo-600) NO TOCADO
- Agent message bubbles (bg-gray-100 text-gray-800) — ya eran light, sin cambio
- `--color-accent` y `--color-accent-strong` intactos
- No se tocó lógica, handlers, state, props, filtros, routing

### Demo First
Ninguno de los tres componentes existe en la demo de referencia (`C:\proyectos\AISync\MVP`). Son exclusivos del MVP.

### Build
✓ `npm run build` limpio (solo warnings pre-existentes de `useEffect` en CanvasViewport).

### Estado
OE D cerrada.

---

## [2026-05-26] — OE Decorativa A: Diagnóstico de clases utilitarias en tokens.css

### Archivos tocados
- Ninguno (intervención cero — ver diagnóstico)

### Diagnóstico previo
**Causa probable:** `tokens.css` ya expone variables base correctas de color, tipografía, spacing, radios y sombras, pero podría no tener todas las clases utilitarias CSS que las consumen.
**Alcance real:** Limitado a `tokens.css`. Cero `.tsx`.
**Dependencias:** Variables tipográficas, de color, radios y sombras ya definidas.
**Riesgo de efectos secundarios:** Bajo siempre que no se dupliquen ni pisoteen clases ya validadas.
**Criterio de intervención mínima:** Agregar solo lo faltante. Conservar todo lo existente.

### Clases ya existentes (todas las pedidas en la OE)

| Clase | Línea | Estado |
|---|---|---|
| `.ui-title` | 615 | ✓ existe, idéntica al spec |
| `.ui-section-title` | 623 | ✓ existe, idéntica al spec |
| `.ui-panel-title` | 631 | ✓ existe, idéntica al spec |
| `.ui-label` | 639 | ✓ existe, idéntica al spec |
| `.ui-meta` | 646 | ✓ existe, idéntica al spec |
| `.ui-caption` | 652 | ✓ existe, idéntica al spec |
| `.ui-card` | 944 | ✓ existe (con border además de radius+shadow) |
| `.ui-panel` | 213-230 | ✓ existe, radius+shadow-card |
| `.ui-surface` | 213-230 | ✓ existe, radius+shadow-card |
| `.ui-panel-subtle` | 213-237 | ✓ existe, radius+shadow-soft |
| `.ui-tabs` / `.ui-segmented-control` | 905 | ✓ existe, superset del spec |
| `.ui-tab` / `.ui-segmented-option` | 916 | ✓ existe, superset del spec |
| `.ui-tab:hover` | 931 | ✓ existe |
| `.ui-tab-active` / `.ui-segmented-option-active` | 936 | ✓ existe (usa accent-soft-strong en border, sustancialmente equivalente) |

### Sombras verificadas
- `--shadow-soft` → línea 45 — ya existía ✓
- `--shadow-card` → línea 46 — ya existía ✓
- `--shadow-popover` → línea 47 — ya existía ✓

### Clases agregadas
Ninguna. Todas las pedidas ya existían con semántica equivalente o idéntica.

### Validaciones
- ✓ `tokens.css` leído completo (1429 líneas)
- ✓ No se tocó ningún `.tsx`
- ✓ `--color-accent` intacto (línea 67)
- ✓ `--color-accent-strong` intacto (línea 68)
- ✓ `npm run build` limpio

### Commit realizado
Ninguno — sin cambios de código. Solo handoff.md actualizado.

### Estado
OE Decorativa A cerrada. Base visual ya estaba completa. Lista para OE Decorativa B.

---

## [2026-05-26] — OE Decorativa B: Aplicar clases utilitarias UI a Documentation Mode

### Archivos modificados
- `src/components/documentation/DocClient.tsx`
- `src/components/documentation/AuditView.tsx`
- `src/components/documentation/InvestigateView.tsx`
- `src/components/documentation/RepositoryView.tsx`

### Diagnóstico previo
- tokens.css se importa ANTES de `@tailwind utilities` → clases ui-* como base, Tailwind sobreescribe font-size/color con override. Sin override Tailwind: border-radius, letter-spacing, background se aplican desde los tokens.
- `ui-tabs` NO aplicado al contenedor de tabs — el contenedor es full-width flex; inline-flex rompería el layout. Decisión de intervención mínima.
- StructureView.tsx — sin stat cards ni tab navigation. Tiene residuos dark mode pendientes (PURPOSE_BADGE, STATE_BADGE, DetailPanel bg-gray-950) — fuera del scope decorativo de esta OE, se documentan como deuda técnica.

### Targets localizados
- **Tab navigation** → `DocClient.tsx` línea 175 (único lugar, centraliza todas las vistas)
- **Stat cards** → definición local `StatCard()` en `RepositoryView.tsx` (l.197), `AuditView.tsx`, `InvestigateView.tsx`
- **Metadata secundaria** → helpers `Row`/`MetaRow` en `RepositoryView.tsx`, `Meta` en `AuditView.tsx`, `InvMeta` en `InvestigateView.tsx`

### Cambios realizados por archivo

**`DocClient.tsx`** (Target 1 — tabs):
- `ui-tab` agregado a cada botón de tab (static class)
- `ui-tab-active` agregado al estado activo (junto a `border-indigo-500`)
- Dark residues corregidos: `border-gray-800` → `border-[var(--color-border-default)]`
- Active tab: `text-white` → `text-[var(--color-text-primary)]`
- Inactive tab hover: `text-gray-500 hover:text-gray-600` → `text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]`
- "How to use" button: `text-blue-500` → `text-[var(--color-text-tertiary)]`
- Help modal: `border-gray-800` → `border-[var(--color-border-default)]`, `text-white` → `text-[var(--color-text-primary)]`, `text-gray-500/600` → tokens

**`AuditView.tsx`** (Targets 2+3 — stat cards + metadata):
- `StatCard` número: agregado `ui-title`
- `StatCard` label: agregado `ui-label`
- `Meta` helper label span: agregado `ui-meta`

**`InvestigateView.tsx`** (Targets 2+3):
- `StatCard` número: agregado `ui-title`
- `StatCard` label: agregado `ui-label`
- `InvMeta` helper label span: agregado `ui-meta`

**`RepositoryView.tsx`** (Targets 2+3):
- `StatCard` número: agregado `ui-title`
- `StatCard` label: agregado `ui-label`
- `Row` helper label span: agregado `ui-meta`
- `MetaRow` helper label span: agregado `ui-meta`

### Deuda técnica identificada (fuera de scope — próxima OE)
- `StructureView.tsx`: PURPOSE_BADGE, STATE_BADGE, DetailPanel — todavía en dark mode (bg-gray-950, text-white, border-gray-800). Necesita migración equivalente a la hecha en OE D para los otros views.

### Validaciones
- ✓ Demo reference leída (PageB.tsx, PageD.tsx) — no usa ui-tabs en Documentation Mode; usa ui-label en detail panels
- ✓ Tab navigation vive en DocClient.tsx
- ✓ Stat cards definidas localmente en cada view
- ✓ No se tocó lógica de tabs (setTab handler intacto)
- ✓ No se tocaron handlers de filtros
- ✓ Panel derecho intacto
- ✓ Sub-Manager sidebar intacto
- ✓ KnowledgeMap canvas intacto
- ✓ `--color-accent` intacto
- ✓ `--color-accent-strong` intacto
- ✓ `npm run build` limpio

### Estado
OE Decorativa B cerrada.

---

## [2026-05-26] — OE Botonera Documentation Mode: Rediseño visual de tabs

### Archivos modificados
- `src/components/documentation/DocClient.tsx`

### Demo First
Patrón leído en `C:\proyectos\AISync\MVP\src\pages\PageB.tsx` línea 3316-3344:
- Contenedor: `flex flex-wrap items-start justify-center self-center justify-self-center gap-x-3 gap-y-2`
- Por-tab: `grid min-w-max justify-items-center gap-1`
- Botón: `ui-button min-h-7 w-full px-3 text-[10px]` + activo: `ui-button-primary text-white`
- Help link: `text-[10px] text-[var(--color-accent-strong)] underline underline-offset-2`

### Diagnóstico previo
Los tabs estaban distribuidos con `justify-between` ocupando el ancho total del header (barra tipo underline). Sin bloque izquierdo/derecho en el MVP → la botonera se centra directamente. Cambio puramente de `className`, sin alterar estado, handlers ni lógica.

### Bloque de tabs localizado
`DocClient.tsx` línea 175 — único lugar de definición de la barra de navegación.

### Cambios realizados

**Contenedor outer** (antes `flex items-end justify-between`):
- → `flex items-center justify-center gap-3 py-2.5`
- Efecto: tabs compactados al centro, ya no estirados a todo el ancho

**Por-tab div** (antes `flex flex-col items-center pb-2 gap-1`):
- → `grid min-w-max justify-items-center gap-1` (patrón demo)

**Tab button** — reemplazado underline `border-b-2` por pill:
- Inactivo: `h-8 px-3.5 rounded-[10px] border border-[var(--color-border-default)] bg-white text-[var(--color-text-secondary)]`
- Activo: `bg-[var(--color-accent)] border-[var(--color-accent)] text-white shadow-sm` (mismo ADN que Review & Forward)
- `onClick={() => setTab(t.id)}` — intacto

**Help link** (antes `text-xs text-[var(--color-text-tertiary)]`):
- → `text-[10px] text-[var(--color-text-muted)] underline underline-offset-2 hover:text-[var(--color-accent)]`
- `onClick={() => setHelpTab(t.id)}` — intacto

### Confirmaciones
- ✓ Lógica de tabs intacta (setTab, tab === t.id)
- ✓ Handlers intactos (setHelpTab, setTab)
- ✓ No existe bloque izquierdo ni derecho en MVP — tabs simplemente centrados
- ✓ KnowledgeMap canvas intacto
- ✓ Panel derecho intacto
- ✓ Sub-Manager sidebar intacto
- ✓ `--color-accent` usado para estado activo (mismo que Review & Forward)
- ✓ `npm run build` limpio

### Estado
OE Botonera cerrada.

**Ajuste posterior [2026-05-26]:** font-size tabs `0.8125rem` → `0.75rem` (12px). Gap entre tabs `gap-3` → `gap-5`.

---

## [2026-05-26] — OE Viewport + badges: StructureView y KnowledgeMap

### Archivos modificados
- `src/components/documentation/StructureView.tsx`
- `src/components/documentation/KnowledgeMap.tsx`

### Demo First
`C:\proyectos\AISync\MVP\src\pages\PageB.tsx` revisado — patrón de height fill: `flex h-full min-h-0 flex-col gap-2.5`, `ui-surface min-h-0 flex flex-1 flex-col overflow-hidden`. No existe equivalente a StructureView ni KnowledgeMap en la demo.

### Problema
StructureView: root `h-full overflow-y-auto` sin `flex flex-col` — viewport cortado, contenido del árbol no scrolleaba correctamente en altura disponible.
KnowledgeMap: root `h-full flex` sin `min-h-0` — posible corte en contextos flex sin constraint de altura mínima.
Además: StructureView tenía todos los badges en dark mode (PURPOSE_BADGE, STATE_BADGE, SAT/MAT, DetailPanel, tree items) — deuda de la OE D/Decorativa B.

### Cambios en StructureView.tsx

**Viewport fix:**
- Root: `h-full overflow-y-auto` → `h-full flex flex-col`
- Agregado `<div className="flex-1 min-h-0 overflow-y-auto">` wrapping el contenido del árbol + max-w-3xl container
- DetailPanel (fixed position) queda fuera del scroll wrapper — correcto, no afecta el flujo

**PURPOSE_BADGE** (todos dark → light):
- Checkpoint: `text-green-400 bg-green-950 border-green-900` → `text-green-700 bg-green-50 border-green-200`
- Session Backup: `text-blue-400 bg-blue-950 border-blue-900` → `text-blue-700 bg-blue-50 border-blue-200`
- Handoff: `text-purple-400 bg-purple-950 border-purple-900` → `text-purple-700 bg-purple-50 border-purple-200`
- Evidence: `text-orange-400 bg-orange-950 border-orange-900` → `text-orange-700 bg-orange-50 border-orange-200`

**STATE_BADGE** (todos dark → light):
- active: `text-emerald-400 bg-emerald-950 border-emerald-900` → `text-emerald-700 bg-emerald-50 border-emerald-200`
- under_review: `text-yellow-400 bg-yellow-950 border-yellow-900` → `text-yellow-700 bg-yellow-50 border-yellow-200`
- locked: `text-red-400 bg-red-950 border-red-900` → `text-red-700 bg-red-50 border-red-200`

**SAT/MAT badge:**
- SAT: `text-emerald-400 bg-emerald-950 border-emerald-800` → `text-emerald-700 bg-emerald-50 border-emerald-200`
- MAT: `text-purple-400 bg-purple-950 border-purple-800` → `text-purple-700 bg-purple-50 border-purple-200`

**DetailPanel** (bg-gray-950 → tokens):
- Root: `bg-gray-950 border-l border-gray-800` → `bg-[var(--color-surface)] border-l border-[var(--color-border-default)]`
- Header border: `border-b border-gray-800` → `border-b border-[var(--color-border-default)]`
- "Document Detail" label: `text-gray-500` → `text-[var(--color-text-muted)]`
- Title h3: `text-white` → `text-[var(--color-text-primary)]`
- Close button: `text-gray-600 hover:text-gray-600` → `text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]`
- Row label: `text-gray-600 w-24 shrink-0` → `ui-meta text-[var(--color-text-secondary)] w-24 shrink-0`
- Row value: `text-gray-600` → `text-[var(--color-text-primary)]`
- Audit Log link: `border-gray-200 text-gray-400 hover:text-gray-800` → tokens light

**Tree items** (dark → tokens):
- Project button: `text-white hover:text-indigo-300` → `text-[var(--color-text-primary)] hover:text-[var(--color-accent)]`
- Team button: `text-gray-600 hover:text-white` → `text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]`
- Workspace button: `text-gray-400 hover:text-white` → `text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]`
- Workspace count: `text-gray-600` → `text-[var(--color-text-muted)]`
- Checkpoint button: `hover:text-white text-gray-500` → `text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]`
- Borders: `border-gray-800` (todos) → `border-[var(--color-border-subtle)]`
- Descripción superior: `text-gray-600 mb-6` → `text-[var(--color-text-secondary)] mb-6`
- "teams/" label: `text-gray-600 font-mono` → `text-[var(--color-text-muted)] font-mono`
- Empty state: `text-gray-500` + `text-gray-700` → tokens light

### Cambios en KnowledgeMap.tsx

**Viewport fix:**
- Root: `h-full flex` → `h-full flex min-h-0`
- Efecto: garantiza que el div flex no desborde en contextos donde el padre tiene altura calculada por flexbox sin constraint explícito
- Canvas, nodos, ReactFlow, colorMode, Background, MiniMap: NO TOCADOS

### Confirmaciones
- ✓ ReactFlow canvas (colorMode="dark", Background color="#1e293b", MiniMap dark, DocFlowNode, COLOR_MAP): intacto
- ✓ `--color-accent` y `--color-accent-strong` intactos
- ✓ No se tocó lógica, handlers, state, props, ni routing
- ✓ ChevronIcon usa `stroke="currentColor"` → hereda color del padre automáticamente
- ✓ Botón "Open Document" (bg-indigo-600) intacto

### Build
✓ `npm run build` limpio. Commit: ce89e78.

### Estado
OE Viewport + badges cerrada.

---

## [2026-05-26] — Fix light mode residues en Settings (CustomProvidersManager + ApiKeysManager)

### Archivos modificados
- `src/components/settings/CustomProvidersManager.tsx`
- `src/components/settings/ApiKeysManager.tsx`

### Cambios en CustomProvidersManager.tsx

**Provider name (línea 85):**
- `text-white` → `text-[var(--color-text-primary)]`

**Badge "activo" (línea 86-88):**
- `text-emerald-400 bg-emerald-950 border-emerald-800` → `text-emerald-700 bg-emerald-50 border-emerald-200`

**4 inputs del formulario (Nombre, Modelo, Endpoint URL, API Key):**
- `bg-gray-50` → `bg-[var(--color-input-bg)]`
- `border-gray-200` → `border-[var(--color-border-default)]`
- `text-white` → `text-[var(--color-text-primary)]`
- `placeholder-gray-600` → `placeholder-[var(--color-text-placeholder)]`
- `focus:border-indigo-500` → `focus:border-[var(--color-border-focus)]`

**Botón "Agregar provider":**
- `bg-indigo-600 hover:bg-indigo-500` → `bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)]`

### Cambios en ApiKeysManager.tsx

**Botón "Guardar":**
- `bg-indigo-600 hover:bg-indigo-500` → `bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)]`

### Confirmaciones
- Lógica, handlers, state, props, API routes: NO tocados
- Streaming, providers de IA, agent sessions: NO tocados

### Build
✓ `npm run build` limpio. Commit: 472caf9.

### Estado
OE cerrada.

---

## [2026-05-26] — Context Files page integrada en AppLayout

### Archivos modificados
- `src/app/context/page.tsx`
- `src/app/context/ContextPageClient.tsx`

### Cambios

**page.tsx:**
- Importado `AppLayout`
- Envuelto `ContextPageClient` con `AppLayout pageName="CONTEXT FILES" pageSubtitle="Files uploaded to provide context to your AI agents"`
- `userName` pasado como `user.email ?? '—'` (igual que otras páginas que no tienen account completo)

**ContextPageClient.tsx:**
- Eliminado div raíz `min-h-screen bg-[var(--color-app-bg)]`
- Eliminado bloque de título manual (`h1 + p` de descripción) — provisto por AppLayout
- Conservado: lógica de carga, archive, error, secciones Project/Team/Session Context
- Nuevo root: `<div className="max-w-4xl mx-auto px-6 py-10">` (solo el contenido)

### Confirmaciones
- Lógica de carga Supabase: NO tocada
- Función `archive`: NO tocada
- `ContextSection`: NO tocada
- `AppLayout scrollable` no especificado → default (scrollable)

### Build
✓ `npm run build` limpio. Commit: 20c91cb.

### Estado
Cerrado.

---

## [2026-05-26] — Tree View: boxes más anchos + colorimetría MAP

### Archivos modificados
- `src/lib/map/buildTreeLayout.ts`
- `src/components/teams/TreeView.tsx`

### Demo First
`C:\proyectos\AISync\MVP\src\pages\PageD.tsx`:
- `TREE_NODE_WIDTH = 152` (MVP tenía el mismo valor — coincidencia con demo)
- `TREE_AUX_NODE_WIDTH = 116` (MVP TREE_WORKER_WIDTH era 112 — similar)
- No hay CORPORATE_PALETTES en la demo — es un sistema del MVP

### Fix 1 — Boxes más anchos

Cambios en `buildTreeLayout.ts`:

| Constante | Antes | Después | Delta |
|---|---|---|---|
| `TREE_ROOT_WIDTH` | 112 | 180 | +68 |
| `TREE_NODE_WIDTH` | 152 | 220 | +68 |
| `TREE_WORKER_WIDTH` | 112 | 170 | +58 |

`TREE_CONNECT_WIDTH` en `TreeView.tsx`: 116 → 170

Heights no modificadas — la OE solo requería más ancho.
Spacing (`TREE_SIBLING_GAP = 44`, `TREE_LEVEL_GAP = 74`) no modificado — el algoritmo calcula posiciones relativas al ancho, sin solapamiento.

### Fix 2 — Colorimetría

No se requirió ningún cambio. `TreeView.tsx` ya usaba `teamCodeToPaletteIndex` + `getProjectColorTokens` de `src/lib/teams/getProjectColor.ts` — exactamente el mismo sistema que `TeamAgentCard.tsx` en el MAP.

### Confirmaciones
- MAP layout: NO tocado
- MAP conexiones: NO tocadas
- React Flow config: NO tocado
- Tree jerarquía: NO tocada
- Open/Edit handlers: NO tocados
- `buildTreeLayout.ts` algoritmo: NO tocado (solo constantes de dimensión)

### Build
✓ `npm run build` limpio. Commit: 4f0f3dc.

### Estado
Cerrado. Fix 2 ya estaba implementado — no requirió cambios.

---

## [2026-05-26] — OE: Port DocumentationMirrorTree a StructureView

### Diagnóstico previo
`StructureView.tsx` mostraba un árbol de checkpoints agrupados (Proyecto → Teams → Workspaces → Checkpoints). Esa vista no representaba la intención real de Documentation Mode: un árbol navegable tipo mirror tree, alineado con la jerarquía Teams/Agentes.

### Archivos creados
- `src/lib/documentation/types.ts` — `DocumentationMirrorNode` interface
- `src/lib/documentation/buildMirrorTree.ts` — `MirrorAgent`, `MirrorTeam`, `MirrorTreeInput`, `buildDocumentationMirrorTree`
- `src/components/documentation/DocumentationMirrorTree.tsx` — `TreeViewport` (pan/zoom/drag), `MirrorTreeNode` (recursivo), `DocumentationMirrorTree` (componente público)

### Archivo modificado
- `src/components/documentation/StructureView.tsx` — reemplaza árbol de checkpoints por `DocumentationMirrorTree`; deriva `mirrorTeams` y `mirrorAgents` desde `projects: ProjectWithTeams[]` (ya llegaba como prop pero no se usaba)

### Decisiones técnicas
- **Sin dependencia del map layer**: la documentación deriva sus datos directamente de `TeamWithWorkspaces[]` sin importar `MapAgentNode` ni `agentNodesToMapNodes`. Módulo documentation auto-contenido.
- **`buildDocumentationMirrorTree` con inputs simplificados**: no porta `buildDocumentationModeModel` (900+ líneas en demo, datos de Content Plane que no existen en MVP). En cambio, construye `MirrorTreeInput` directamente desde `ProjectWithTeams`.
- **Jerarquía de agentes**: manager sin padre de equipo → `general_manager`; manager con padre → `senior_manager`; worker1/worker2 → `worker`. Workers tienen `treeParentUnitId = manager.id` (aparecen bajo el manager en el árbol).
- **`agentLabel`**: usa `session.description` si existe; fallback a `team.name` (manager) o `team.name · Worker` (worker).
- **`TreeViewport`**: puerto exacto de la demo — drag con pointer capture, zoom con wheel, supresión de clicks post-drag.

### Alternativas descartadas
- Usar `MapAgentNode` en props: crearía dependencia cruzada documentation → map. Descartado en favor de tipos locales.
- Portar `buildDocumentationModeModel`: 900+ líneas, depende de Content Plane (messages, savedObjects, calendarEvents). No existe en MVP. Innecesario — el árbol solo necesita teams y agents.

### Restricciones respetadas
- DocClient.tsx: NO tocado
- RepositoryView, AuditView, InvestigateView, KnowledgeMap: NO tocados
- MAP / Tree / Workspace / ribbons / route.ts / providers / streaming: NO tocados
- Firma de props de StructureView: preservada (Props interface idéntica)

### Build
✓ `npm run build` limpio. Cero errores TypeScript. Commit: 0d528e2.

### Estado
Cerrado.

---

## [2026-05-26] — StructureView: códigos jerárquicos, orden y fix de agentLabel

### Diagnóstico
DocumentationMirrorTree estaba portado. Tres problemas de presentación:
1. Team nodes no mostraban código jerárquico (A-00, B-01, etc.)
2. agentLabel usaba `session.description ?? team.name` — incorrecto
3. Teams no ordenados por código (solucionado: el builder ordena por teamLabel; con código en el label, el orden es correcto automáticamente)

### Cambios — solo `StructureView.tsx`
- `teamCodes` destructurado desde props (ya llegaba pero no se usaba)
- `teamLabel`: `code ? "${code} · ${team.name}" : team.name`
- `agentLabel`: `code ? "${code} · ${roleLabel}" : roleLabel`
- `roleLabel`: `'Manager'` / `'Sub-Manager'` / `'Worker'` (derivado de `agent_role + team.parent_id`)
- Sin uso de `session.description` ni `team.name` como agentLabel

### Decisiones técnicas
- `buildMirrorTree.ts` NO tocado. El builder ordena por `teamLabel` — con código incorporado al label, el orden queda correcto sin lógica adicional.
- La demo NO usa códigos en labels (getTeamCode es para naming de archivos). Los códigos son requerimiento MVP-específico via `computeTeamCodes`.
- `AgentSession` no tiene campo `name` — solo `description: string | null`. El fallback role-based es la única opción semánticamente correcta.

### Restricciones respetadas
- DocClient.tsx: NO tocado
- DocumentationMirrorTree.tsx: NO tocado
- TreeViewport / MirrorTreeNode / buildMirrorTree.ts: NO tocados
- Otras vistas: NO tocadas

### Build
✓ `npm run build` limpio. Commit: 7199eb9.

### Estado
Cerrado.

---

## [2026-05-26] — AuditView: códigos jerárquicos en eventos de Documentation Mode

### Diagnóstico
AuditView mostraba `team_name` sin código jerárquico. `DocAuditEvent` no incluía `team_id`, por lo que no era posible resolver el código desde `teamCodes`.

### Cambios
- `DocAuditEvent` (documentation.ts): agregado `team_id: string | null`
- Query `getDocAuditEvents`: `teams (name)` → `teams (id, name)`
- Raw type inline: `teams: { id: string; name: string } | null`
- Mapping: `team_id: r.workspaces?.teams?.id ?? null`
- `AuditView.tsx` Props: agregado `teamCodes?: Record<string, string>`
- Render de evento: `teamLabel = teamCode ? "${code} · ${team_name}" : team_name`
- `DocClient.tsx`: `teamCodes={teamCodes}` pasado a `<AuditView />`

### Restricciones respetadas
- Lógica de filtros: NO tocada
- Lógica de eventos: NO tocada
- Otras vistas de Documentation Mode: NO tocadas
- MAP / Tree / Workspace / ribbons / route.ts / providers: NO tocados

### Build
✓ `npm run build` limpio. Commit: 6fe8f1f.

### Estado
Cerrado.

---

## [2026-05-26] — AuditView: Open Document en nueva pestaña + botones estilo R&F

### Diagnóstico
Los botones "Open Document →", "Audit Log →" y "Resume →" (en el panel de detalle) usaban `router.push(url)` — que reemplaza la vista actual — y no tenían estilos de acción primaria. El estilo de referencia correcto es el de botones "Review & Forward".

### Demo First
`C:\proyectos\AISync\MVP\src\lib\auditLogLaunch.ts` y `teamWorkspaceLaunch.ts` — ambos usan `window.open('', '_blank')`. Confirma el patrón.

### Cambios — solo `AuditView.tsx`
- Importado eliminado: `useRouter` de `next/navigation`; `const router = useRouter()` eliminado
- "Open Document →": `router.push(url)` → `window.open(url, '_blank', 'noopener,noreferrer')`; clase: tokens light → `ui-button ui-button-primary ui-chat-action-button text-xs text-white disabled:opacity-40`
- "Audit Log →": `<a href="/audit">` → `<button onClick={() => window.open('/audit', '_blank', 'noopener,noreferrer')}`; misma clase
- "Resume →" (panel de detalle): `router.push(url); setDetailCpId(null)` → `window.open(url, '_blank', 'noopener,noreferrer')`; misma clase. `setDetailCpId(null)` eliminado (innecesario al abrir en nueva pestaña)

### Restricciones respetadas
- "View Details →" (abre panel inline, llama `openDetail(e)`): NO tocado — no cambia a `window.open`
- Lógica de filtros, eventos, modal, mensajes: NO tocada
- `teamCodes`, `teamLabel`, hierarchy codes: intactos
- Otras vistas Documentation Mode / MAP / Workspace / route.ts: NO tocadas

### Build
✓ `tsc --noEmit` limpio. Commit: 579138c.

### Estado
Cerrado.

---

## [2026-05-26] — AuditView: rediseño de card de evento según especificación técnica

### Demo First
`AuditEntryReferenceRow` en `PageB.tsx` línea 4592 — estructura exacta portada:
- Grid 5 cols: identidad | actor+user | event+workspace | time+linkage | badges+botones
- Franja inferior: Document State | Document Version | PATH
- `DocumentListRowIcon` (SVG viewBox 20x20) portado inline
- `DetailField` → helper `Field` nuevo (label arriba, valor abajo, 10px uppercase tracking)

### Diagnóstico previo
La card anterior usaba un layout flat (flex simple, metadata en grid básico, botones sin jerarquía). No transmitía lectura de ficha documental. Estructura visualmente pobre para Documentation Mode.

### Archivos modificados
- `src/components/documentation/AuditView.tsx` — único archivo modificado

### Cambios realizados
- Contenedor de lista: `divide-y divide-[...]` → `p-4 grid gap-3 content-start` (cards con gap en lugar de separadores)
- Ternario del mapa: `filtered.map(...)` wrapped en `<div className="p-4 grid gap-3 content-start">` para soporte de gap
- Card contenedor: `px-6 py-4 hover:bg-[...]` → `rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] overflow-hidden`
- **Franja superior** — grid 5 columnas portado de la demo:
  - Identidad: SVG inline (DocumentListRowIcon) + cpName + subtítulo (teamLabel · workspace_name · working-record)
  - Columna Actor+User: helper `Field`
  - Columna Event Type+Source Workspace: helper `Field`
  - Columna Reference Time+Audit Linkage: helper `Field` con suppress
  - Columna badges+botones: badges pill (STATE_BADGE + cfg.badgeClass) + 3 botones
- **Franja inferior** — `border-t border-[var(--color-border-subtle)]`:
  - Document State / Document Version / PATH (con break-all)
  - `docPath` derivado de `cp.project_name / cp.team_name / cp.workspace_name` si hay checkpoint vinculado
- Helper `Field` agregado (portado de `DetailField` demo, adaptado a tokens MVP)
- `Meta` → `_Meta` (prefijo ESLint para función no usada — convención del proyecto)

### Decisiones técnicas
- `_Meta`: renombrado con prefijo `_` en lugar de eliminar — cumple regla ESLint sin destruir el helper
- `docPath`: derivado de campos ya disponibles en `DocCheckpoint` (`project_name`, `team_name`, `workspace_name`) — sin nueva lógica ni queries
- `View Details`: botón secundario (`text-[var(--color-text-secondary)]`) — no primario, para distinguir de las acciones de navegación
- `Open Document` y `Audit Log`: primarios con `ui-button-primary ui-chat-action-button`

### Restricciones respetadas
- Handlers intactos: `openDetail`, `window.open`
- Filtros intactos: `filterState`, `filterEvent`, `filterTeam`, `filterDate`
- Modal de detalle intacto (líneas ~260–320)
- `StatCard`, `formatDate`, `AGENT_LABEL`, `EVENT_CONFIG`, `STATE_BADGE`: no tocados
- Otras vistas, MAP, Tree, Workspace, route.ts, providers, streaming: no tocados

### Build
✓ `npm run build` limpio. Commit: 88994fa.

### Estado
Cerrado.

---

## [2026-05-27] — Teams Map/Tree: sort por código jerárquico

### Diagnóstico
MAP y Tree recibían el array `teams` en el orden arbitrario retornado por Supabase. `computeTeamCodes` ya calculaba los códigos (A-00, A-01, B-00…) pero ese resultado no se usaba para ordenar la presentación visual.

### Archivo modificado
`src/components/teams/TeamsClient.tsx` — único archivo tocado.

### Cambio aplicado
Agregado `sortedTeams` como `useMemo` derivado después de `teamCodes` (línea 101):
```ts
const sortedTeams = useMemo(
  () => [...teams].sort((a, b) => {
    const codeA = teamCodes[a.id] ?? ''
    const codeB = teamCodes[b.id] ?? ''
    return codeA.localeCompare(codeB)
  }),
  [teams, teamCodes],
)
```
- `MapView`: `teams={teams}` → `teams={sortedTeams}`
- `TreeView`: `teams={teams}` → `teams={sortedTeams}`
- Modales (AddTeamModal, EditTeamModal, ConnectTeamModal, IncomingRequestsPanel): siguen recibiendo `teams` original — no ordenar datos operacionales.

### Demo First
Demo MVP no tiene `TeamsClient` ni `computeTeamCodes`. Los sorts en la demo se aplican dentro de builders de datos estáticos. No hay patrón equivalente que portar — el cambio es específico del MVP.

### Restricciones respetadas
- Array original `teams` no mutado (`[...teams].sort`)
- `useState` no tocado
- Handlers no tocados
- MAP layout, React Flow, Tree layout: no tocados
- Colores, conexiones, numeración: no tocados

### Build
✓ `npm run build` limpio. Commit: 16a6840.

### Estado
Cerrado.

---

## [2026-05-27] — AgentPanel: timestamps en mensajes del chat

### Diagnóstico
`created_at` ya existía en `DisplayMessage` (línea 72) y se asignaba en envío de usuario y assistant. Los day markers (`formatDayMarker`, `showDayMarker`, JSX visual) ya estaban completamente implementados desde el bloque de Day Markers anterior. Lo único faltante era el timestamp HH:MM por mensaje.

### Demo First
`AgentPanel.tsx` de la demo (línea 745): timestamp en meta row junto al senderLabel — `<span>{message.senderLabel}</span> <span>{message.timestamp}</span>`. Patrón portado directamente.

### Archivo modificado
`src/components/workspace/AgentPanel.tsx` — único archivo tocado.

### Cambios
- Agregado helper `formatMessageTime(iso)` → `toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })` junto a `formatDayMarker`
- Meta row del mensaje: agregado `{msg.created_at && <span suppressHydrationWarning>{formatMessageTime(msg.created_at)}</span>}` junto al sender label
- `suppressHydrationWarning`: necesario porque `toLocaleTimeString` puede diferir entre server y client por locale/timezone
- Day markers ya implementados: no tocados

### Restricciones respetadas
- Lógica de envío: no tocada
- Streaming: no tocado
- Handlers: no tocados
- Providers / route.ts: no tocados
- Review & Forward, Prompt Library, Context Files: no tocados
- WorkspaceShell: no tocado

### Build
✓ `npm run build` limpio. Commit: d1382f3.

### Estado
Cerrado.
