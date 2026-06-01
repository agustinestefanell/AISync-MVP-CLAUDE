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

---

## [2026-05-27] — RepositoryView: document card item redesign Nivel 1

### Diagnóstico
RepositoryView mostraba objetos documentales como lista plana con `divide-y`. Cada item era un `div` con `px-4 py-4` sin tarjeta. La especificación Nivel 1 exigía convertir solo los items del listado izquierdo en cards documentales sobrias — sin reconstruir la pantalla completa ni agregar metadata inexistente.

### Demo First
`RepositoryItemCard` en `PageB.tsx:4721` — `rounded-[14px] border border-neutral-200 bg-white/80 px-3 py-2`, `ring-2 ring-[var(--color-accent)]` cuando selected, `DocumentListRowIcon` SVG inline, pills para typeLabel/teamLabel, bottom strip con metadata (state/version/updated/owner/sensitivity) + botones (`ui-button ui-button-primary text-white`). Patrón portado directamente.

### Archivo modificado
`src/components/documentation/RepositoryView.tsx` — único archivo tocado.

### Cambios
- Contenedor de lista: `divide-y divide-[var(--color-border-subtle)]` → `grid gap-3 content-start` dentro de `p-4`
- Cada item: `div` plano → `article` con `rounded-[14px] border bg-[var(--color-surface)] overflow-hidden cursor-pointer`
- Estado seleccionado: `border-l-2 border-indigo-500` → `border-indigo-500 ring-1 ring-indigo-500` (borde + ring, sin invertir colores)
- Agregado SVG icon documental inline (20x20, mismo que AuditView)
- Checkpoint card: title semibold + badges (STATE_BADGE + version_label) top-right + pills (purpose, team sky, workspace) + bottom strip (Owner, Sensitivity, Created + botones)
- Handoff card: HANDOFF badge + title + status badge top-right + pills (agents, workspace) + bottom strip (Messages, Created + botón)
- `View Details` y `Audit Log →`: clase cambiada a `ui-button ui-button-primary ui-chat-action-button text-xs text-white disabled:opacity-40` (misma clase para ambos, sin jerarquía secundario/primario)

### Restricciones respetadas
- Lógica, filtros, handlers: no tocados
- Stats bar: no tocada
- Filters row: no tocada
- Detail panel derecho (CheckpointDetailPanel, HandoffDetailPanel): no tocados
- AuditView, StructureView, InvestigateView, KnowledgeMap: no tocados
- MAP, Tree, Workspace, ribbons, route.ts, providers, streaming: no tocados
- No se agregaron campos inexistentes ni bloques de compliance

### Build
✓ `npm run build` limpio. Solo warnings pre-existentes en CanvasViewport.tsx. Commit: 2ea0413.

### Estado
Cerrado.

---

## [2026-05-27] — InvestigateView: Nivel 1 + Investigation Context

### Diagnóstico
InvestigateView ya tenía filtros, stats bar y agrupación por día funcionales. Faltaba mejorar visualmente las cards del listado y agregar una card compacta de contexto investigativo calculada en frontend. Investigation Context debía calcularse sobre `filtered` (el set activo filtrado), no sobre el total de checkpoints.

### Demo First
`InvestigationThreadCard` en `PageB.tsx:3685` — `rounded-[14px] border border-neutral-200 bg-white/80 px-3 py-2.5`, `DocumentListRowIcon` inline, título semibold, subtítulo project·team·workspace, grid metadata 2-4 cols, inner box para Related Actors/Timeline Range, botones `ui-button ui-button-primary text-white`. Investigation Context en demo: `investigateContextSummary` con Focus/Related actors/Related pieces/Timeline span en `ui-surface-subtle rounded-[18px]`. Patrón adaptado al MVP.

### Archivo modificado
`src/components/documentation/InvestigateView.tsx` — único archivo tocado.

### Cambios
- Agregados helpers frontend: `getTimelineSpan(items)`, `getRelatedPieces(items)`, `getRelatedActors(items)`
- `getTimelineSpan`: min/max `created_at` del set filtrado, formato `d Mon YYYY → d Mon YYYY`
- `getRelatedPieces`: count de items del set filtrado que comparten `team_id` o `workspace_id` con `filtered[0]` como anchor
- `getRelatedActors`: `Set` de únicos de `responsible` en el set filtrado
- `investigationContext` useMemo dependiente de `filtered` (reactivo a cambios de filtros)
- Agregada card `Investigation Context` con 3 campos (Timeline Span, Related Pieces, Related Actors), `rounded-[14px]`, entre filtros y listado
- Cards del listado: `rounded-xl` → `rounded-[14px]`, `px-5 py-4` → `px-4 py-3`
- Agregado icono documental SVG inline (20x20, mismo que AuditView/RepositoryView)
- Subtítulo reubicado debajo del título: `project · team · workspace`
- PURPOSE_BADGE pill → `rounded-full` en top-right
- Metadata grid existente: intacto, añadido `mt-2` para separación
- Bottom strip con `border-t` para separar botones de metadata
- Botones `Open Document →` y `Audit Log →`: texto plano → `ui-button ui-button-primary ui-chat-action-button text-xs text-white disabled:opacity-40` (ambos primarios, sin jerarquía)
- `router.push` preservado en Open Document handler

### Restricciones respetadas
- Lógica de filtros, handlers, agrupación por día, stats bar: no tocados
- AuditView, RepositoryView, StructureView, KnowledgeMap: no tocados
- MAP, Tree, Workspace, ribbons, route.ts, providers, streaming: no tocados
- No se agregaron Investigative Sequence, Investigation Focus nuevo, ni métricas no calculables

### Build
✓ `npm run build` limpio. Solo warnings pre-existentes en CanvasViewport.tsx. Commit: eca16d6.

### Estado
Cerrado.

---

## [2026-05-27] — Documentation Mode: navegación nueva pestaña + Investigation Context scroll fix

### Diagnóstico
- InvestigateView usaba `router.push` y `<a href>` para navegación externa — reemplazaba la vista actual.
- RepositoryView mantenía `<a href>` en detail panels y cards — mismo problema.
- Investigation Context (nuevo `shrink-0`) empujaba el `flex-1 overflow-y-auto` y podía romper scroll por falta de `min-h-0` en el contenedor principal.

### Archivos modificados
- `src/components/documentation/InvestigateView.tsx`
- `src/components/documentation/RepositoryView.tsx`

### Cambios — InvestigateView
- Eliminado `import { useRouter }` y `const router = useRouter()`
- `router.push(...)` → `window.open(url, '_blank', 'noopener,noreferrer')` en "Open Document →"
- `<a href="/audit">Audit Log →</a>` → `<button onClick={() => window.open(...)}>View in Audit Log →</button>`
- Contenedor principal: `h-full flex flex-col` → `h-full flex flex-col min-h-0` (patrón demo: `flex h-full min-h-0 flex-col`)

### Cambios — RepositoryView
- CheckpointDetailPanel "Open Document": `<a href=...>` → `<button onClick={() => window.open(...)>`
- CheckpointDetailPanel "View in Audit Log": `<a href="/audit">` → `<button onClick={() => window.open(...)>`
- HandoffDetailPanel "View in Audit Log": `<a href="/audit">` → `<button onClick={() => window.open(...)>`; `block` → `w-full` para conservar ancho
- Cards list "Audit Log →": `<a href="/audit" onClick={e => e.stopPropagation()}>` → `<button onClick={e => { e.stopPropagation(); window.open(...) }}>` + texto → "View in Audit Log →"

### Restricciones respetadas
- Lógica de filtros, handlers, agrupación por día, stats bar, detail panels: no tocados
- AuditView, StructureView, KnowledgeMap: no tocados
- MAP, Tree, Workspace, route.ts, providers, streaming: no tocados

### Build
✓ `npm run build` limpio. Solo warnings pre-existentes en CanvasViewport.tsx. Commit: 962bf32.

### Estado
Cerrado.

---

## [2026-05-27] — Documentation Mode: polish AuditView/RepositoryView buttons, scroll

### Diagnóstico
- AuditView conservaba texto "Audit Log →" inconsistente con el resto de la plataforma.
- RepositoryView tenía botones "View in Audit Log" en los detail panels sin la clase visual R&F primaria.
- Contenedores `h-full flex flex-col` en AuditView (L117) y RepositoryView (L291, L76, L143) faltaban `min-h-0`.
- Fix 4 (uniqueTeams desde handoffPackages): descartado — `DocHandoffPackage` no tiene `team_id` en la interfaz; el campo existe en la DB pero no se incluye en la query de `getHandoffPackages`. No se modifica el tipo ni la query (fuera de alcance). `uniqueTeams` queda calculado solo desde `checkpoints`.

### Archivos modificados
- `src/components/documentation/AuditView.tsx`
- `src/components/documentation/RepositoryView.tsx`

### Cambios — AuditView
- L117: `h-full flex flex-col` → `h-full min-h-0 flex flex-col`
- L238: texto "Audit Log →" → "View in Audit Log →"

### Cambios — RepositoryView
- L76 (CheckpointDetailPanel): `h-full flex flex-col border-l...` → `h-full min-h-0 flex flex-col border-l...`
- L143 (HandoffDetailPanel): mismo cambio
- L291 (main): `h-full flex flex-col` → `h-full min-h-0 flex flex-col`
- L131 (CheckpointDetailPanel "View in Audit Log"): clase `border text-secondary...` → `ui-button ui-button-primary ui-chat-action-button text-xs text-white disabled:opacity-40`
- L189 (HandoffDetailPanel "View in Audit Log"): mismo cambio
- uniqueTeams: sin cambio (DocHandoffPackage no expone team_id en su interfaz)

### Restricciones respetadas
- Filtros, handlers, queries, data model: no tocados
- Navegación ya validada: no tocada
- Cards documentales, stats bar: no tocados
- Todas las demás vistas: no tocadas

### Build
✓ `npm run build` limpio. Commit: 6517233.

### Estado
Cerrado. Fix 4 (uniqueTeams) diferido — requiere extender `DocHandoffPackage` y `getHandoffPackages` query para incluir teams join.

---

## [2026-05-27] — RepositoryView: min-h-0 en panel izquierdo

### Diagnóstico
`RepositoryView.tsx` L302 tenía `flex flex-col` sin `min-h-0` en el contenedor del panel izquierdo (list + filters). CSS por defecto da `min-height: auto` a flex children, lo que impide que `flex-1 overflow-y-auto` (L340) calcule su altura y scrollee. AuditView no tiene este problema — su chain es lineal sin intermediario.

### Archivos modificados
- `src/components/documentation/RepositoryView.tsx`

### Cambio
- L302: `flex flex-col ${...} min-w-0` → `flex flex-col min-h-0 ${...} min-w-0`

### Chain resultante
```
L291  h-full min-h-0 flex flex-col     ← root
L300    flex-1 min-h-0 flex            ← content row
L302      flex flex-col min-h-0 ...    ← left panel ✅
L340        flex-1 overflow-y-auto     ← lista scrolleable
```

### AuditView
No necesita fix. Chain: `root (min-h-0) → shrink-0 stats → shrink-0 filters → flex-1 overflow-y-auto` (directo, sin intermediario flex-col).

### Build
✓ `npm run build` limpio. Commit: 6992760.

### Estado
Cerrado.

---

## [2026-05-27] — Scroll fix: h-full → flex-1 en raíz de vistas Documentation

### Diagnóstico
Repository, Audit e Investigate views no scrolleaban — la lista de documentos no permitía bajar. El parent en DocClient L199 es `flex flex-col`. En ese contexto, `h-full` (= `height: 100%`) en el hijo es poco confiable: el browser no siempre puede resolver el porcentaje contra una altura determinada por flex layout. El scroll nunca se activaba porque el contenedor no estaba correctamente restringido en altura.

### Archivos modificados
- `src/components/documentation/RepositoryView.tsx` (L291)
- `src/components/documentation/AuditView.tsx` (L117)
- `src/components/documentation/InvestigateView.tsx` (L124)

### Cambio
Las tres vistas: `h-full min-h-0 flex flex-col` → `flex-1 min-h-0 flex flex-col`

### Por qué funciona
`flex-1` le dice al flex layout que el componente debe crecer para llenar el espacio disponible. El browser resuelve la altura vía el algoritmo flex (que sí tiene altura definida desde `h-screen`), y el hijo `flex-1 overflow-y-auto` dentro de cada vista puede calcular su propia altura y activar el scroll.

### Build
✓ `npm run build` limpio. Commit: 28b549a.

### Estado
Cerrado.

---

## [2026-05-27] — HandoffPackageModal: inputs text color + botón accent

### Archivos modificados
- `src/components/workspace/HandoffPackageModal.tsx`

### Cambios
- Fix 1 — inputs Name, From (select), To (select), Context (textarea): `text-white` → `text-[var(--color-text-primary)]`, `focus:border-purple-500` → `focus:border-[var(--color-border-focus)]`
- Fix 2 — botón submit: `bg-purple-700 hover:bg-purple-600` → `bg-[var(--color-accent)] hover:bg-[var(--color-accent-strong)]`

### Restricciones respetadas
- Lógica del modal, handlers, validación: no tocados

### Build
✓ `npm run build` limpio. Commit: e89e1ae.

### Estado
Cerrado.

---

## [2026-05-27] — Scroll fix definitivo: AppLayout main flex flex-col

### Diagnóstico raíz
`<main>` en AppLayout con `scrollable=false` era un elemento block (`flex-1 overflow-hidden min-h-0` sin `display: flex`). `flex-1` solo funciona cuando el padre es un flex container. Como `<main>` era block, `flex-1` en DocClient no tenía efecto y DocClient nunca tenía altura definida — el scroll nunca se activaba en ninguna vista. Afectaba: documentation, workspace, audit, teams, admin (todas las páginas con `scrollable={false}`).

### Archivos modificados
- `src/components/layout/AppLayout.tsx`

### Cambio
- `'flex-1 overflow-hidden min-h-0'` → `'flex-1 overflow-hidden min-h-0 flex flex-col'` (solo en rama `scrollable=false`)

### Chain completo resultante
```
AppLayout outer:  h-screen flex flex-col overflow-hidden
  main:           flex-1 overflow-hidden min-h-0 flex flex-col  ← fix
    DocClient:    flex-1 min-h-0 flex overflow-hidden            ← flex-1 ahora resuelve
      L173:       flex-1 min-h-0 flex flex-col overflow-hidden
        L199:     flex-1 min-h-0 flex flex-col overflow-hidden
          Vista:  flex-1 min-h-0 flex flex-col
            Lista: flex-1 overflow-y-auto  ← scrollea ✓
```

### Sobre los filtros/datos
Frontend no está desconectado del backend. Queries correctas, RLS correcto. La BD probablemente solo tiene datos de prueba de un team/día. Si se crean checkpoints en otros workspaces van a aparecer.

### Build
✓ `npm run build` limpio. Commit: 3a02366.

### Estado
Cerrado.

---

## [2026-05-27] — Handoff packages: team data + uniqueTeams unificado

### Diagnóstico
`getHandoffPackages()` solo traía `workspaces(name)` sin join a teams. `DocHandoffPackage` no tenía `team_id/team_name/project_id/project_name`. `uniqueTeams` en RepositoryView e InvestigateView usaba solo checkpoints, dejando equipos de handoffs fuera del filtro.

### Archivos tocados
- `src/lib/db/documentation.ts`
- `src/components/documentation/RepositoryView.tsx`
- `src/components/documentation/InvestigateView.tsx`
- `src/components/documentation/DocClient.tsx` — solo para pasar `handoffPackages` como prop a InvestigateView (excepción controlada)

### Cambios

**documentation.ts:**
- Query: `workspaces(name)` → `workspaces(name, teams(id, name, projects(id, name)))`
- `RawHandoffPackage`: extendido con campo `teams` anidado en workspaces
- `DocHandoffPackage`: agregados `team_id/team_name/project_id/project_name` (todos `string | null`)
- Mapping: normalización con Array.isArray (por si Supabase devuelve array), luego asignación de team/project data

**RepositoryView.tsx:**
- `uniqueTeams`: de solo `checkpoints` → `checkpoints + handoffPackages`

**InvestigateView.tsx:**
- Import: agregado `DocHandoffPackage`
- Props: agregado `handoffPackages: DocHandoffPackage[]`
- Destructuring: agregado `handoffPackages`
- `uniqueTeams`: de solo `checkpoints` → `checkpoints + handoffPackages`

**DocClient.tsx:**
- Render de InvestigateView: agregado `handoffPackages={handoffPackages}`

### Restricciones respetadas
- UI no tocada. Cards no tocadas. Handlers no tocados.
- Ninguna otra query modificada. Ninguna otra vista tocada.

### Demo First
Demo (Vite SPA) no tiene `getHandoffPackages` ni queries a Supabase — usa datos estáticos. No hay patrón de referencia; se procedió con ingeniería directa.

### Build
✓ `npm run build` limpio. Commit: 71aea80.

### Estado
Cerrado.

---

## [2026-05-27] — OE: SMPanel visual upgrade — hint card a spec de producción

### Diagnóstico
El hint card existía (OE anterior) pero con `rounded-xl`, sin icono circular, sin título en `#92400e` y sin línea superior de acento. La OE llevó el card al nivel visual exacto de la spec.

### Archivos tocados
- `src/components/sm/SMPanel.tsx`

### Cambio 1 — Hint card reemplazado
- Anterior: `rounded-xl`, sin icono, título en `--color-text-primary`, layout columna.
- Nuevo: `rounded-[14px]`, flex horizontal con icono circular (`w-11 h-11 rounded-full bg-white border`) + SVG inline (lupa + sparkle en `#92400e`) + texto en columna (`gap-1`). Título `text-sm font-semibold text-[#92400e]`. Dos líneas descriptivas en `--color-text-secondary`.
- El bloque es `shrink-0` y está posicionado en el área connected, antes de `{/* Messages */}`.

### Cambio 2 — Línea superior de acento agregada
- No existía en el contenedor raíz del panel.
- Agregada como primera línea: `<div className="h-1 w-full rounded-t-xl bg-[#92400e] shrink-0" />` inmediatamente dentro del `<div>` raíz del panel, antes del `{!open ? ...}`.

### Restricciones respetadas
- Lógica de chat, endpoint `/api/sm-doc-chat`, props, estado, input, submit, mensajes: no tocados.
- Ningún otro bloque fuera del hint card y la línea de acento fue modificado.
- No se abrieron refactors laterales.

### Build
✅ Limpio.

### Commit
`3da2f72` — feat: upgrade SMPanel hint card to production spec

### Riesgos pendientes
- Validación visual en navegador (icono, acento marrón, layout del card).

---

## [2026-05-27] — OE: Hint card en SMPanel — Documentation Mode search guide

### Diagnóstico
SMPanel opera como agente de búsqueda documental vía `/api/sm-doc-chat`, pero la UI no informaba al usuario cómo consultar ni qué resultado esperar. Se agregó un hint card estático sin tocar lógica.

### Demo First
La demo no tiene `SMPanel` ni `sm-doc-chat`. No hay patrón que portar.

### Archivos tocados
- `src/components/sm/SMPanel.tsx`

### Ubicación del card
Insertado entre el bloque de `contextStatus` (filtrado/full) y el bloque `{/* Messages */}` — como `shrink-0`, siempre visible por encima del scroll del historial.

### Cambios realizados
- Bloque JSX estático agregado: `shrink-0 px-4 pt-3 pb-1` wrapper + card `rounded-xl` con `border: 1px solid var(--color-border)` + `background: var(--color-surface)`.
- Texto exacto: "Search-optimized agent" / "Type a document name, version, checkpoint, or any keyword." / "The agent will return a direct link to the matching item."
- No se agregó estado, condicionales, handlers ni imports.
- `/api/sm-doc-chat` (línea 155): no tocado.

### Restricciones respetadas
- Lógica de chat: no tocada.
- Props: no tocadas.
- Estado del panel: no tocado.
- Otras vistas, workspace, route.ts, providers: no tocados.
- No se abrieron refactors laterales.

### Build
✅ Limpio. Solo warnings pre-existentes en CanvasViewport.tsx.

### Commit
`379d9c7` — fix: add sm panel documentation search hint

### Riesgos pendientes
- Validación manual en navegador (confirmar card visible en panel abierto, chat funcional).

---

## [2026-05-27] — OE: Search bar + Project filter en Structure View

### Diagnóstico
`StructureView` pasaba `mirrorTeams` y `mirrorAgents` directamente a `DocumentationMirrorTree` sin capa de filtrado. La vista no tenía search ni filtro de proyecto.

### Demo First
La demo tiene `DocumentationMirrorTree` sin filtros de búsqueda ni proyecto. No hay patrón que portar. Fix específico del MVP.

### Archivos tocados
- `src/components/documentation/StructureView.tsx`

### Cambios realizados
- `useState` agregado al import de React.
- `searchQuery` y `filterProject` como estado local.
- `teamProjectMap`: `Map<teamId, projectId>` derivado de `projects` (sin campos inventados).
- `filteredMirrorTeams`: filtra por proyecto (AND) y por búsqueda en `teamLabel` (case-insensitive).
- `filteredTeamIds`: `Set<string>` de ids filtrados para lookup O(1).
- `filteredMirrorAgents`: solo agentes cuyos `teamId` está en `filteredTeamIds` — evita agentes huérfanos en el árbol.
- Barra de filtros: input `Search teams or agents...` + select de proyectos (visible solo si `projects.length > 1`) + botón "Reset Search".
- Estado vacío bajo filtros: "No teams match your search."
- `DocumentationMirrorTree` recibe `filteredMirrorTeams` y `filteredMirrorAgents`.
- Layout: `h-full` → `h-full flex flex-col`; tree container: `flex-1 min-h-0`.

### Campos reales usados
- `team.teamLabel` para búsqueda de teams (campo existente en `mirrorTeams`)
- `agent.teamId` para relación agente → team (campo existente en `mirrorAgents`)
- `project.id` y `project.name` para dropdown y lookup (campos existentes en `ProjectWithTeams`)

### Restricciones respetadas
- `DocumentationMirrorTree`: no tocado.
- Props del componente: no tocadas.
- `mirrorTeams` y `mirrorAgents` originales: no modificados (solo se crean derivados filtrados).
- Filtro SAT/MAT: no implementado (campo `team_type` no confirmado en el data model).
- Otras vistas de Documentation Mode: no tocadas.
- No se abrieron refactors laterales.

### Hallazgo SAT/MAT
`ProjectWithTeams` → `TeamWithWorkspaces` → no expone `team_type` en su interface. El filtro SAT/MAT queda diferido hasta que se confirme el campo.

### Build
✅ Limpio. Solo warnings pre-existentes en CanvasViewport.tsx.

### Commit
`2ba4a49` — fix: add structure view search and project filter

### Riesgos pendientes
- Validación manual en navegador (búsqueda, filtro de proyecto, estado vacío, reset).
- Filtro SAT/MAT diferido — requiere confirmar campo `team_type` en `TeamWithWorkspaces`.

---

## [2026-05-27] — OE: Sort alfabético de teams en dropdowns de Documentation Mode

### Diagnóstico
Los dropdowns de teams en AuditView, RepositoryView e InvestigateView construían `uniqueTeams` en orden de inserción (determinado por el orden de los datos de origen). Con códigos jerárquicos disponibles en `teamCodes`, el orden correcto es alfabético por código.

### Demo First
La demo no tiene filtros de teams con dropdown en Documentation Mode. No hay patrón que portar. Fix específico del MVP.

### Archivos tocados
- `src/components/documentation/AuditView.tsx`
- `src/components/documentation/RepositoryView.tsx`
- `src/components/documentation/InvestigateView.tsx`

### Cambios realizados
- `AuditView`: `.sort((a, b) => (teamCodes?.[a.id] ?? a.name).localeCompare(...))` al final del Array.from. `teamCodes` agregado a deps del useMemo.
- `RepositoryView`: `.sort(([idA, nameA], [idB, nameB]) => ...)` al final del Array.from(m.entries()). `teamCodes` agregado a deps.
- `InvestigateView`: mismo patrón que RepositoryView.
- Fallback: si no hay `teamCodes` para el id, ordena por `name`.

### Restricciones respetadas
- Lógica de filtrado: no tocada en ninguno de los tres archivos.
- Props: no tocadas.
- `value` de los options: no cambiado.
- KnowledgeMap, StructureView, DocClient: no tocados.
- No se abrieron refactors laterales.

### Validaciones ejecutadas
- Grep post-cambio: `localeCompare` presente en los tres archivos ✅
- `teamCodes` en deps de cada useMemo ✅
- `npm.cmd run build`: limpio, sin errores TypeScript.
- Validación manual pendiente en navegador.

### Build
✅ Limpio. Solo warnings pre-existentes en CanvasViewport.tsx.

### Commit
`e6e9cc6` — fix: sort documentation team dropdowns by team code

### Riesgos pendientes
- Validación visual en navegador pendiente (confirmar orden A-00, A-01, B-00… en los tres dropdowns).

---

## [2026-05-27] — OE: AuditView filtro Teams — labels con código jerárquico

### Diagnóstico
`uniqueTeams` se construía solo con `team_name`, perdiendo `team_id`. Eso impedía usar `teamCodes` para mostrar códigos jerárquicos en el dropdown del filtro de teams de Audit View.

### Demo First
La demo (`C:\proyectos\AISync\MVP\src`) no tiene filtro de teams con dropdown ni `uniqueTeams` — solo referencias a `team_id` como campo de datos en strings. No hay patrón que portar. Fix específico del MVP.

### Archivos tocados
- `src/components/documentation/AuditView.tsx`

### Cambios realizados
1. `uniqueTeams` ahora conserva `{ id: string, name: string }` — filtra eventos donde `team_id` Y `team_name` existen; usa `Map` keyed por `team_id` para deduplicar.
2. El `<option>` del filtro de teams usa `key={t.id}`, `value={t.name}` (preserva filtrado existente) y muestra `teamCodes[id] · name` cuando existe código jerárquico.
3. Fix TypeScript: `e.team_id` puede ser `null` — se añadió `e.team_id` al filter y se castea como `string` en el map, eliminando el error de tipo.

### Restricciones respetadas
- Lógica de filtrado (línea 77: `e.team_name !== filterTeam`): no tocada.
- `value` del option mantiene `t.name` — el filtrado sigue funcionando por nombre.
- Props, tipos, imports: no tocados.
- Ninguna otra vista de Documentation Mode tocada.
- No se abrieron refactors laterales.

### Validaciones ejecutadas
- Grep post-cambio: `key={t.id}` ✅, `value={t.name}` ✅, `teamCodes?.[t.id]` ✅
- `npm.cmd run build`: limpio, sin errores TypeScript.
- Validación manual pendiente en navegador (no hay server local corriendo).

### Build
✅ Limpio. Solo warnings pre-existentes en CanvasViewport.tsx.

### Commit
`5fd5863` — fix: show team codes in audit view filter

### Riesgos pendientes
- Validación manual en navegador pendiente (confirmar que el dropdown muestra `A-01 · Nombre del Team` y que el filtrado sigue funcionando).

---

## [2026-05-27] — OE: Light mode — modals, Dashboard, Edit Team

### Archivos modificados
- `src/components/workspace/PromptLibrary.tsx`
- `src/components/workspace/ContextFilePanel.tsx`
- `src/components/workspace/WorkspaceShell.tsx`
- `src/components/ProjectList.tsx`
- `src/components/teams/EditTeamModal.tsx`

### Decisión técnica
Reemplazar todos los tokens de color hardcodeados de dark mode (`text-white`, `bg-indigo-*`, `bg-purple-*`, `focus:border-indigo-500`) por tokens CSS del sistema de diseño (`text-[var(--color-text-primary)]`, `bg-[var(--color-accent)]`, `hover:bg-[var(--color-accent-strong)]`, `focus:border-[var(--color-border-focus)]`).

Alcance por archivo:
- **PromptLibrary**: header h2, close button, `+ New Prompt` btn, form inputs/textarea, Create/Update btn, prompt titles en lista, `+ Worker` y `+ Team` buttons (de dark indigo/purple → tokens de superficie neutral)
- **ContextFilePanel**: header h2, close button, Title input, Notes textarea, Upload btn, source title en lista
- **WorkspaceShell** (solo modal "Guardar checkpoint"): h2, Name input, Purpose select, Guardar btn
- **ProjectList**: "Mis Proyectos" h2, "Nuevo Proyecto" + "Crear" buttons, project name input, project name h3, "Abrir →" Link (de dark indigo → accent tokens con text-white)
- **EditTeamModal**: "Save changes" button

### Alternativas descartadas
No aplica — fix de consistencia directo sin ambigüedad.

### Riesgos o deuda técnica
Ninguno. Los tokens CSS están definidos globalmente en `globals.css` y se aplican en light y dark mode según la variable.

### Build
✓ `npm run build` limpio. Commit: e68db2f.

### Estado
Cerrado.

---

## [2026-05-27] — OE: AuditView — Filtro Teams con código jerárquico

### Archivos modificados
- `src/components/documentation/AuditView.tsx`

### Cambios
- `uniqueTeams` reescrito de `Set<string>` a `Map` keyed por `team_id`, preservando id y name para cada opción.
- Sort alfabético por `teamCodes?.[id] ?? name`.
- `<option>` usa `value={t.name}` (filtrado por nombre, sin romper el filtro existente) y label `code · name`.

### Fix técnico
TypeScript rechazaba `e.team_id` como Map key porque puede ser `null`. Se resolvió con `.filter(e => e.team_name && e.team_id)` + cast `as string` en el `.map()`.

### Build
✓ limpio. Commit: `5fd5863`.

### Estado
Cerrado.

---

## [2026-05-27] — OE: Sort alfabético de teams en dropdowns (Documentation Mode)

### Archivos modificados
- `src/components/documentation/RepositoryView.tsx`
- `src/components/documentation/InvestigateView.tsx`

### Cambios
Mismo patrón de sort en ambos archivos: `uniqueTeams` derivado de Map, ordenado por `teamCodes?.[idA] ?? nameA` con `localeCompare`. Se agregó `teamCodes` a las deps de `useMemo`.

### Build
✓ limpio. Commit incluido en `5fd5863` (AuditView batch).

### Estado
Cerrado.

---

## [2026-05-27] — OE: Structure View — Search bar + Project filter

### Archivos modificados
- `src/components/documentation/StructureView.tsx`

### Cambios
- Reescritura de 77 → ~140 líneas. Agrega capa de filtros antes de `DocumentationMirrorTree`.
- Estado: `searchQuery`, `filterProject`.
- `teamProjectMap`: Map `team_id → project_id` derivado de `projects` prop.
- `filteredMirrorTeams`: filtra por proyecto y query de texto sobre `teamLabel`.
- `filteredMirrorAgents`: filtra por `filteredTeamIds` — sin agentes huérfanos.
- `DocumentationMirrorTree` recibe los conjuntos filtrados.
- Filter bar visual consistente con AuditView/RepositoryView.
- Empty state: "No teams match your search."

### Alternativas descartadas
Filtrar agentes directamente por texto/proyecto — descartado porque los agentes no tienen nombre propio significativo; el filtro correcto es por team.

### Build
✓ limpio. Commit: `2ba4a49`.

### Estado
Cerrado.

---

## [2026-05-27] — OE: SMPanel — Hint card + visual upgrade + accent top line

### Archivos modificados
- `src/components/sm/SMPanel.tsx`

### Cambios (dos OEs consecutivas)
1. **Hint card (producción)**: bloque insertado entre `contextStatus` y la lista de mensajes (dentro del bloque `{connection && ...}`). Icono circular con SVG de lupa + estrella en `#92400e`, título en `#92400e`, dos líneas de texto secundario.
2. **Accent top line**: `<div className="h-1 w-full rounded-t-xl bg-[#92400e] shrink-0" />` como primer hijo del panel raíz.
3. La hint card ya tenía spec de producción desde el inicio (no hubo versión intermedia en prod).

### Decisión técnica
Color `#92400e` (amber-800) alineado con la paleta amber del producto. Icono en SVG inline para evitar dependencia de librería. Posición dentro de `{connection && ...}` para que solo aparezca cuando hay agente activo.

### Build
✓ limpio. Commits: incluidos en `9bd59f2`.

### Estado
Cerrado.

---

## [2026-05-28] — OE: SMPanel — External provider warning banner

### Archivos modificados
- `src/components/sm/SMPanel.tsx`

### Cambios
Banner amarillo condicional insertado entre el bloque de Connection badge y el bloque `{/* Context indicator */}`:

```tsx
{!connection.isLocal && (
  <div className="mx-3 mb-1 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 shrink-0">
    <span className="shrink-0 mt-0.5">⚠️</span>
    <span>External agent active — document context shared with provider.</span>
  </div>
)}
```

### Decisión técnica
`!connection.isLocal` (no `!isLocal`) porque el punto de inserción ya está dentro del bloque `{connection && (...)}`. `connection` es el objeto completo de la conexión activa — `isLocal` es su propiedad booleana que distingue providers locales (Ollama, LM Studio) de externos (Anthropic, OpenAI, etc.).

### Alternativas descartadas
- Mostrar nombre del provider en el banner: descartado — demasiada info en una zona ya cargada.
- Warning persistente fuera del bloque connection: descartado — sin conexión no aplica el riesgo.

### Riesgos o deuda técnica
Ninguno. El banner es solo visual, no afecta el flujo de chat.

### Build
✓ `npm run build` limpio. Commit: `fe972e4`.

### Estado
Cerrado.

---

## [2026-05-28] — OE: SMPanel fused amber ribbon

### Diagnóstico
SMPanel tenía dos bloques informativos separados: hint card de búsqueda documental (bg surface, borde neutro, icono circular) y warning banner externo (bg amber-50, border amber-200, condicionado por `!connection.isLocal`). Ambos explicaban aspectos del mismo agente pero generaban repetición visual y fragmentación de lectura.

### Archivos revisados
- `src/components/sm/SMPanel.tsx`
- Demo: `C:\proyectos\AISync\MVP\src\components\TeamSubManagerPanel.tsx` — no tiene equivalente funcional (solo usa `ribbon` como color de borde, no como bloque informativo)

### Archivos tocados
- `src/components/sm/SMPanel.tsx`
- `handoff.md`
- `PRODUCT_STATUS.md`

### Cambios realizados
- Se eliminó el warning banner separado (`{!connection.isLocal && <div className="mx-3 mb-1...">}`).
- Se eliminó el hint card separado (`<div className="mx-3 mb-2 rounded-[14px] border border-[var(--color-border)]...">`).
- Se insertó un único ribbon amber fusionado al inicio del bloque `{connection && (...)}`, antes del connection badge.
- Estructura resultante: ribbon → divider line → connection badge → context indicator → messages.
- El warning interno (`⚠️ External agent active...`) se mantiene condicionado por `!connection.isLocal` con un `border-t border-amber-200` como separador interno.
- El bloque `Search-optimized agent` es siempre visible cuando hay conexión activa.

### Restricciones respetadas
- `isLocal` no tocado.
- Connection badge intacto.
- Context indicator intacto.
- Mensajes y input intactos.
- Lógica de chat, endpoint `/api/sm-doc-chat`, props y estado: sin cambios.
- No se abrieron refactors laterales.

### Build
✓ `npm.cmd run build` limpio. Commit: `8ad6a98`.

### Estado
Cerrado.

---

## [2026-05-28] — OE: Search bar + Sort en Repository View

### Diagnóstico
Repository View tenía filtros estructurados por dropdown pero sin búsqueda textual ni ordenamiento. Se agregaron como transformación final sobre el array ya filtrado, preservando dropdowns existentes, detail panel y SM context.

### Archivos revisados
- `src/components/documentation/RepositoryView.tsx`
- Demo MVP: `DocumentationTree.tsx` — sin equivalente de search/sort. Implementación propia.

### Archivos tocados
- `src/components/documentation/RepositoryView.tsx`
- `handoff.md`
- `PRODUCT_STATUS.md`

### Cambios realizados
- Se agregó `searchQuery` (useState '') y `sortOrder` (useState 'newest').
- Se agregó `displayItems` useMemo: búsqueda textual sobre `filtered` + sort. Campos de checkpoint: `name`, `workspace_name`, `team_name`, `responsible`, `project_name`. Campos de handoff: `name`, `workspace_name`, `team_name`.
- Sort por `newest` (fecha desc), `oldest` (fecha asc), `name` (nombre asc). Usa `itemDate()` existente.
- Se agregaron controles UI en la barra de filtros: input con placeholder "Search by title, actor, workspace, or keyword..." y select con "Newest first / Oldest first / Name A–Z".
- `resetFilters` actualizado para limpiar `searchQuery` y resetear `sortOrder` a 'newest'.
- `hasFilter` actualizado para incluir `searchQuery`.
- Render del listado cambia `filtered` por `displayItems`.
- Estado vacío cambia a "No documents match your search."
- `stats.results` sigue usando `filtered.length` (refleja total de dropdowns, no del search).

### Decisión técnica
Pipeline: dropdowns → searchQuery → sortOrder → render. `displayItems` es derivado de `filtered`, no lo reemplaza. `stats` sigue mostrando el conteo pre-search para mantener coherencia con SM context (`onFilterChange` sigue recibiendo `filtered`).

### Restricciones respetadas
- Dropdowns existentes sin tocar.
- Detail panel sin tocar.
- SM context / `onFilterChange` sin tocar.
- Props sin tocar.
- Sin refactors laterales.

### Build
✓ `npm.cmd run build` limpio. Commit: `daeb732`.

### Estado
Cerrado.

---

## [2026-05-28] — OE A: DB migration saved_selections

### Diagnóstico
Save Selection requiere persistencia propia. Se creó migración `019_saved_selections.sql` con tabla, RLS y policy de ownership por `auth.uid()`.

### Archivos revisados
- `supabase/migrations/` — último número era `018`, `019` confirmado libre.
- Demo MVP: sin directorio `supabase/` — sin referencia.
- Patrón RLS del proyecto activo confirmado en migraciones 001–018.

### Archivos tocados
- `supabase/migrations/019_saved_selections.sql` (creado)
- `handoff.md`
- `PRODUCT_STATUS.md`

### Cambios realizados
- Tabla `saved_selections`: `id`, `user_id` (FK auth.users CASCADE), `workspace_id` (FK workspaces CASCADE), `team_id` (FK teams CASCADE nullable), `project_id` (FK projects CASCADE nullable), `name`, `messages` (jsonb default '[]'), `created_at`.
- RLS habilitado.
- Policy `"Users can manage their own saved selections"` — FOR ALL, USING + WITH CHECK `auth.uid() = user_id`.

### Supabase db push
`npx supabase db push` falló: "Cannot find project ref. Have you run supabase link?" — CLI no enlazada al proyecto remoto en este entorno. La migración local está correcta. **Acción requerida:** ejecutar el SQL manualmente en Supabase Dashboard → SQL Editor antes de usar OEs B y C.

### Dashboard confirmado
Pendiente — ejecutar SQL manual en Dashboard.

### Restricciones respetadas
- No se tocó código de aplicación.
- No se tocaron componentes ni API routes.
- No se modificaron migraciones anteriores.
- Sin refactors laterales.

### Build
✓ `npm.cmd run build` limpio. Commit: `ea138a3`.

### Estado
Parcial — migración local creada y pusheada. Aplicación en Supabase pendiente de ejecución manual en Dashboard.

---

## [2026-05-28] — OE B: API route save-selection

### Diagnóstico
Save Selection necesitaba un endpoint backend para persistir selecciones autenticadas en `saved_selections`. Se creó route `POST` aislada.

### Archivos revisados
- `src/app/api/` — todas las routes existentes para confirmar patrones
- Patrón confirmado: `createClient` de `@/lib/supabase/server`, `supabase.auth.getUser()`, `NextResponse`

### Archivos tocados
- `src/app/api/save-selection/route.ts` (creado)
- `handoff.md`
- `PRODUCT_STATUS.md`

### Cambios realizados
- `POST /api/save-selection`: obtiene usuario autenticado, valida `workspace_id`/`name`/`messages`, inserta en `saved_selections` con `user_id: user.id`, retorna registro con status 201.
- Guard 401 si no hay sesión. Guard 400 si faltan campos requeridos.
- Solo método POST. Sin GET/PUT/PATCH/DELETE.

### Restricciones respetadas
- Sin métodos adicionales.
- Sin código UI ni componentes.
- Sin tocar providers, streaming ni chat route.
- Sin modificar migraciones.
- Sin refactors laterales.

### Validación API manual
No ejecutada — requiere sesión autenticada activa. Build confirma que la route existe y compila correctamente.

### Build
✓ `npm.cmd run build` limpio. `/api/save-selection` aparece en el output. Commit: `5b4e872`.

### Estado
Cerrado.

---

## [2026-05-28] — OE C: Save Selection UI

### Diagnóstico
La tabla `saved_selections` y la route `/api/save-selection` ya estaban listas. WorkspaceShell no tenía UI para tomar los mensajes seleccionados de los paneles, pedir un nombre y persistirlos.

### Archivos revisados
- `src/components/workspace/WorkspaceShell.tsx` — estados, handlers, modales, patrón Save Version.
- Demo MVP: `AgentPanel.tsx` tiene Save Selection dentro del panel. MVP activo lo ubica en WorkspaceShell — diferencia arquitectural consciente.

### Archivos tocados
- `src/components/workspace/WorkspaceShell.tsx`
- `handoff.md`
- `PRODUCT_STATUS.md`

### Cambios realizados
- Estados: `showSaveSelectionModal`, `saveSelectionName`, `pendingSelectionMessages: ChatMessage[]`, `savingSelection`.
- `openSaveSelectionModal()`: itera `panelRefs.current`, recolecta `getSelectedMessages()`, abre modal si hay mensajes.
- `handleSaveSelection()`: POST a `/api/save-selection` con `workspace_id`, `team_id`, `project_id: null`, `name`, `messages`.
- Barra de acción (`_totalSelected > 0`): muestra conteo y botón `Save Selection` al pie del workspace.
- Modal inline: patrón visual idéntico a Save Version (overlay, contenedor, input, botones accent/cancel). Botón disabled sin nombre o durante guardado.
- Fix TypeScript: `any[]` → `ChatMessage[]` (tipo real de `AgentPanelHandle.getSelectedMessages()`).

### Restricciones respetadas
- `Save Version` intacto (verificado con grep).
- `AgentPanel` no tocado.
- Routing, otros modales, providers, streaming: sin cambios.
- Sin refactors laterales.

### Build
✓ `npm.cmd run build` limpio (primer intento falló por `any` — corregido a `ChatMessage[]`). Commit: `c3e880b`.

### Validación manual
Pendiente en navegador — confirmar barra de selección, modal, payload y POST.

### Estado
Cerrado.

---

## [2026-05-28] — MINI OE: Save Selection(s) label fix

### Diagnóstico
Botón en la barra de acción y botón confirm del modal decían "Save Selection". El producto gestiona múltiples mensajes seleccionados (cruce de paneles), por lo que el plural es correcto.

### Archivos tocados
- `src/components/workspace/WorkspaceShell.tsx`

### Cambios realizados
- Barra de acción: `Save Selection` → `Save Selection(s)`
- Modal confirm button (idle): `Save Selection` → `Save Selection(s)`
- Modal confirm button (loading): `Saving...` sin cambio.

### Restricciones respetadas
- Lógica de guardado: no tocada.
- Modal, states, handlers: no tocados.
- Sin refactors laterales.

### Build
✓ Commit: `e653806`.

### Estado
Cerrado.

---

## [2026-05-28] — Bug fix: Save Selection bar nunca aparecía (React setState updater purity)

### Diagnóstico
La barra de "Save Selection(s)" no aparecía al seleccionar mensajes. F12 no mostraba errores. `_totalSelected` en WorkspaceShell permanecía siempre en 0, aunque la selección en AgentPanel funcionaba visualmente (checkboxes).

### Causa raíz
`toggleSelection` en `AgentPanel.tsx` llamaba `onSelectionChange(next.size)` **dentro** del updater de `setSelectedIndices`. React trata los updaters como funciones puras — los efectos secundarios (como llamar a un `setState` del padre) pueden ser suprimidos silenciosamente, especialmente en StrictMode o concurrent features. El efecto se ejecutaba a veces en desarrollo pero nunca en producción ni consistentemente.

### Archivos tocados
- `src/components/workspace/AgentPanel.tsx`

### Cambios realizados
- Se eliminó `onSelectionChange(next.size)` del interior del updater de `setSelectedIndices`.
- Se agregó `useEffect(() => { onSelectionChange(selectedIndices.size) }, [selectedIndices.size])` con `// eslint-disable-next-line react-hooks/exhaustive-deps` (dependencia intencional — solo `selectedIndices.size`, no la función callback).

### Por qué useEffect
Es el patrón correcto para notificar al padre de un cambio de estado interno. El estado ya fue aplicado cuando el efecto corre, garantizando que `onSelectionChange` recibe el valor definitivo, no el intermedio del updater.

### Alternativas descartadas
- Mover `onSelectionChange` fuera del updater pero en el mismo handler: podría ejecutarse antes de que React aplique el nuevo estado (race condition con closures).
- Refactorizar a estado controlado (padre controla selectedIndices): cambio arquitectural mayor sin justificación en el MVP.

### Riesgos o deuda técnica
El `eslint-disable` es necesario porque la regla `exhaustive-deps` pediría incluir `onSelectionChange` como dependencia, pero hacerlo causaría re-renders infinitos si el padre no memoiza el callback. La supresión está documentada y es intencional.

### Build
✓ `npm run build` limpio. Commit: `bd24174`.

### Estado
Cerrado.

---

## [2026-05-28] — Bug fix: botón "Selection (N)" en AgentPanel sin onClick

### Diagnóstico
El botón que cambia a `Selection (N)` dentro de AgentPanel (línea ~655) no tenía `onClick`. El usuario lo clickeaba y no pasaba nada. La barra inferior de WorkspaceShell (`_totalSelected > 0`) era el punto de entrada correcto pero invisible — el usuario no llegaba a verla porque interactuaba con el botón del panel, no la barra.

### Causa raíz
`onOpenSaveSelection` nunca fue definido como prop en AgentPanel. El botón estaba visualmente habilitado cuando había selección pero era funcionalmente mudo.

### Archivos tocados
- `src/components/workspace/AgentPanel.tsx` — prop `onOpenSaveSelection?: () => void` agregado a interface y destructuring; `onClick={onOpenSaveSelection}` conectado al botón
- `src/components/workspace/WorkspaceShell.tsx` — `onOpenSaveSelection={openSaveSelectionModal}` pasado en el render de cada AgentPanel

### Restricciones respetadas
- Lógica de `openSaveSelectionModal` sin tocar.
- Barra inferior de WorkspaceShell intacta.
- Otros props de AgentPanel sin tocar.
- Sin refactors laterales.

### Build
✓ `npm run build` limpio. Commit: `6204de2`.

### Estado
Cerrado.

---

## [2026-05-28] — OE: Audit log event para Save Selection

### Diagnóstico
`/api/save-selection/route.ts` insertaba en `saved_selections` pero no registraba ningún evento en `audit_log`. Los otros flujos principales (`save_version`, `handoff_package.created`, `lock`/`unlock`) ya tenían cobertura. `save_selection` era el gap.

### Demo First
La demo (`C:\proyectos\AISync\MVP`) es una SPA Vite sin API routes. No hay patrón equivalente que portar. Patrón de referencia tomado de `src/app/api/checkpoint/route.ts` (campo `account_id: user.id`, no `user_id`).

### Archivos tocados
- `src/app/api/save-selection/route.ts`

### Cambios realizados
Insertado bloque `try/catch` no-bloqueante después del insert exitoso en `saved_selections`:
```typescript
try {
  await supabase.from('audit_log').insert({
    account_id:   user.id,
    workspace_id,
    event_type:   'save_selection',
    metadata:     {
      saved_selection_id: data.id,
      name,
      message_count: Array.isArray(data.messages) ? data.messages.length : 0,
    },
  })
} catch {
  // Audit log failure must not block saved selection creation.
}
```

### Decisión técnica
- `try/catch` no-bloqueante: si el audit log falla (tabla no existe, RLS error, etc.), el guardado de selección igualmente retorna 201. El audit log es observabilidad, no funcionalidad crítica.
- `account_id` = `user.id`: patrón canónico del proyecto (no `user_id`).
- `message_count`: se calcula desde `data.messages` (respuesta del insert) con guard `Array.isArray` — más confiable que calcular desde el body original.

### Alternativas descartadas
- **`await` fuera de try/catch**: descartado — un error de audit log rompería el endpoint principal.
- **Fire-and-forget sin await**: descartado — deja promesas flotantes que TypeScript/ESLint detectan como antipatrón.

### Documentación actualizada
- `AISyncPlans.md` §6.1: `/api/save-selection` ahora lista `saved_selections, audit_log`.
- `PRODUCT_STATUS.md`: entrada Save Selection actualizada con nota de audit event.

### Build
✓ `npm.cmd run build` limpio. Commit: `d29c439`.

### Estado
Cerrado.

---

## [2026-05-28] — Fix: display de `save_selection` en Audit Timeline y Audit View

### Diagnóstico
El event type `save_selection` ya existía en `audit_log` (commit d29c439) pero no tenía entrada en `EVENT_CONFIG` en ninguna de las dos vistas de auditoría. En `AuditTimeline.tsx` aparecía con fallback raw string y no figuraba en el dropdown de filtros. En `AuditView.tsx` aparecía con estilo gris genérico.

### Demo First
La demo (`C:\proyectos\AISync\MVP`) es una SPA Vite sin audit log estructurado. No tiene `EVENT_CONFIG` ni patrón equivalente de configuración visual de eventos. No aplica portación. Referencia tomada del patrón existente en ambos archivos.

### Archivos tocados
- `src/components/audit/AuditTimeline.tsx` — agregado `save_selection` a `EVENT_CONFIG` (línea 70)
- `src/components/documentation/AuditView.tsx` — agregado `save_selection` a `EVENT_CONFIG` (línea 13)
- `AISyncPlans.md` — sección 4.7: flujo de save_selection actualizado con evento audit_log

### Cambios realizados
`AuditTimeline.tsx`: `save_selection: { label: 'Save Selection', badgeClass: 'text-amber-400 bg-amber-950 border-amber-900' }`
`AuditView.tsx`: `save_selection: { label: 'Save Selection', dotColor: 'bg-amber-500', badgeClass: 'text-amber-700 bg-amber-50 border-amber-200' }`

### Decisión técnica
- Amber para `save_selection`: visualmente diferenciado de verde (checkpoint), azul (backup), indigo (resume), rojo (lock), purple (forward).
- `AuditView.tsx` tiene campo extra `dotColor` (light theme) vs `AuditTimeline.tsx` (dark theme sin dotColor). Ambas entradas respetan la estructura exacta de su propio `EVENT_CONFIG`.
- No se agregaron handlers de subtitle en `AuditTimeline.tsx` — el fallback `return e.event_type` (línea 94) es suficiente para MVP; agregar handlers de título/subtítulo está fuera del scope.

### Alternativas descartadas
- Subtitle handler para `save_selection` en `AuditTimeline.tsx`: fuera de scope, no solicitado.
- Unificar los dos `EVENT_CONFIG` en un módulo compartido: refactor lateral, sin justificación en esta OE.

### Restricciones respetadas
- Lógica de filtrado sin tocar.
- Queries y fetch sin tocar.
- Otros event types sin tocar.
- `CodingWorkshop.md` no modificado (ajuste visual/documental, no bug técnico).

### Build
✓ `npm.cmd run build` limpio.

### Estado
Cerrado.

---

## [2026-05-28] — Feature: Saved Selections en Documentation Mode

### Diagnóstico
`saved_selections` existía como tabla y tenía route POST y evento audit_log, pero Documentation Mode no la consumía. Repository View e Investigate View solo mostraban checkpoints y handoff packages.

### Demo First
La demo (`C:\proyectos\AISync\MVP`) no tiene Documentation Mode ni RepositoryView/InvestigateView. No hay patrón equivalente que portar. La integración se diseñó siguiendo el patrón existente de `DocHandoffPackage` en ambas vistas.

### Archivos tocados
- `src/lib/db/documentation.ts` — interfaz `DocSavedSelection` + función `getSavedSelections(userId)`
- `src/app/documentation/page.tsx` — import + `getSavedSelections` en `Promise.all` + prop `savedSelections` a DocClient
- `src/components/documentation/DocClient.tsx` — import tipo, prop en interface, pass-through a RepositoryView e InvestigateView
- `src/components/documentation/RepositoryView.tsx` — ListItem extendido a 3 tipos; `itemId`/`itemDate` actualizados; `allItems`/`uniqueTeams`/`filtered`/`displayItems`/sort extendidos; filtro 'Saved Selection' agregado; `SavedSelectionDetailPanel`; card render; detail panel render
- `src/components/documentation/InvestigateView.tsx` — prop `savedSelections`; 'Saved Selection' en filtro; render condicional cuando `filterType === 'Saved Selection'`

### Decisiones técnicas
- `getSavedSelections` sigue el patrón de `getHandoffPackages` con `as unknown as RawSavedSelection[]` para el typing del join de Supabase.
- `DocSavedSelection.messages: unknown[]` en lugar de `any[]` — más estricto, compatible con el typecheck.
- En InvestigateView: render condicional separado del timeline de checkpoints (cuando `filterType === 'Saved Selection'`), no mezclado en el grupo por fecha — evita refactorizar la lógica de grouping que opera sobre `DocCheckpoint[]`.
- `getMessagePreview` helper extraído como función pura en RepositoryView — accede a `messages[0].content` con cast defensivo `as Record<string, unknown>`.
- Badge amber en ambas vistas: `text-amber-700 bg-amber-50 border-amber-200` (light) consistente con `save_selection` en AuditTimeline.

### Alternativas descartadas
- Mezclar saved_selections en el grouping por fecha de InvestigateView: requería refactorizar `filtered`, `grouped`, `investigationContext` para manejar union type — cambio arquitectural fuera de scope.
- `messages: any[]` en el tipo: descartado para evitar violaciones de TypeScript strict.

### Restricciones respetadas
- `AuditView`, `StructureView`, `KnowledgeMap`: sin tocar.
- Routes API, Supabase, migrations: sin tocar.
- Lógica de filtrado existente: sin modificar, solo extendida.
- `CodingWorkshop.md`: no modificado (feature nueva, no bug).

### Build
✓ `npm.cmd run build` limpio. 1 error TypeScript resuelto en el sort de `displayItems` (ternario de 3 ramas).

### Estado
Cerrado.

---

## [2026-05-29] — Grupo A fixes: Repository preview + purpose labels + Investigate default view

### Diagnóstico
Tres desajustes post-integración de Saved Selections en Documentation Mode:
1. `getMessagePreview` usaba `messages[0]` (primer mensaje, corto, poco relevante) y truncaba a 200 chars.
2. Valores de `purpose` guardados en español (`'Documentación'`, `'Retomar después'`, etc.) aparecían crudos en la UI.
3. `InvestigateView` con `filterType === ''` no mostraba saved selections.

### Demo First
La demo no tiene Documentation Mode ni vistas equivalentes. No aplica portación.

### Archivos tocados
- `src/components/documentation/RepositoryView.tsx`
  - `getMessagePreview`: cambiado de `messages[0]` a `messages[messages.length - 1]`, truncado de 200 a 600 chars.
  - `PURPOSE_LABELS` agregado como mapa de traducción local.
  - Render de `cp.purpose` e `item.cp.purpose` envuelto con `PURPOSE_LABELS[...] ?? purpose`.
- `src/components/documentation/InvestigateView.tsx`
  - Timeline reestructurado: cuando `filterType === ''`, muestra checkpoint groups + sección "Saved Selections" al final.
  - `SavedSelectionCard` extraído como subcomponente para reutilización entre vista base y filtro explícito.
  - Empty state actualizado: solo aparece cuando no hay checkpoints NI saved selections que mostrar.

### Decisiones técnicas
- `messages[messages.length - 1]`: el último mensaje es el más relevante como preview (típicamente la respuesta del asistente).
- `PURPOSE_LABELS` local en RepositoryView: no en DB, no en documentation.ts — solo transformación visual en el componente que lo necesita.
- `SavedSelectionCard` como subcomponente inline: evita duplicar el JSX entre el bloque `filterType === 'Saved Selection'` y la sección base. No es un refactor arquitectural.
- Sección "Saved Selections" al final del timeline con el mismo separador de línea/texto que los date headers — consistencia visual sin diseño nuevo.

### Alternativas descartadas
- Mezclar saved_selections en el grouping por fecha: requería refactorizar tipos del grouping (`DocCheckpoint[]` → union type). Fuera de scope.
- Agregar `PURPOSE_LABELS` a `documentation.ts`: innecesario, es una transformación de display, no de datos.

### Restricciones respetadas
- `DocClient`, `documentation.ts`, `page.tsx`, `AuditView`, `StructureView`, `KnowledgeMap`: sin tocar.
- Lógica de filtros del dropdown: sin tocar.
- `CodingWorkshop.md`: no modificado (fixes visuales/funcionales, no bugs técnicos).

### Build
✓ `npm.cmd run build` limpio. 0 errores TypeScript.

### Estado
Cerrado.

---

## [2026-05-29] — OE A: InvestigateView purpose labels en inglés

### Diagnóstico
`InvestigateView` mostraba `{c.purpose}` crudo en dos puntos: el badge de propósito y la metadata "Document Type". Checkpoints con purpose guardado en español (`Documentación`, `Retomar después`, etc.) aparecían en la UI sin traducir.

### Demo First
La demo no tiene vistas equivalentes a InvestigateView ni patrón `PURPOSE_LABELS`. No aplica portación.

### Archivos tocados
- `src/components/documentation/InvestigateView.tsx`
  - `PURPOSE_LABELS` agregado junto a `PURPOSE_BADGE` (línea 14).
  - Línea 274: `{c.purpose}` → `{PURPOSE_LABELS[c.purpose] ?? c.purpose}` (badge).
  - Línea 281: `value={c.purpose}` → `value={PURPOSE_LABELS[c.purpose] ?? c.purpose}` (InvMeta "Document Type").

### Decisión técnica
Mismo patrón que `RepositoryView.tsx`: mapa local en el componente, fallback al valor raw si la key no existe. La lógica de filtro en línea 115 (`c.purpose !== filterType`) queda intacta — compara valores raw, correcto.

### Restricciones respetadas
- Filtros: sin tocar.
- `PURPOSE_BADGE`: sin tocar (sigue usando valor raw como key de estilos).
- `RepositoryView`, `DocClient`, `documentation.ts`, `page.tsx`: sin tocar.
- `CodingWorkshop.md`: no modificado (ajuste de label visible, no bug técnico).

### Build
✓ `npm.cmd run build` limpio.

### Estado
Cerrado.

---

## [2026-05-29] — OE B: Handoff Package content_preview en Repository View

### Diagnóstico
Las cards de Handoff Package en Repository View mostraban nombre, agentes, workspace, message_count y fecha, pero ningún preview del contenido. Los mensajes ya estaban disponibles en la query (`messages` incluido en el select de `getHandoffPackages`), pero el mapper solo extraía el conteo y descartaba el resto.

### Demo First
La demo no tiene `getHandoffPackages`, `DocHandoffPackage` ni vistas equivalentes. No aplica portación.

### Archivos tocados
- `src/lib/db/documentation.ts`
  - `DocHandoffPackage`: agregado `content_preview?: string` (línea 112).
  - Mapper de `getHandoffPackages()`: IIFE que extrae `last.content ?? last.text ?? last.message`, trunca a 600 chars, retorna `undefined` si no hay contenido. No modifica la query — `messages` ya estaba en el select.
- `src/components/documentation/RepositoryView.tsx`
  - Card de handoff: bloque condicional `{item.hp.content_preview && <p className="line-clamp-3">}` insertado entre las pills y el bottom strip.

### Decisión técnica
- IIFE en el mapper (server-side): el preview se calcula en el DB layer, no en el componente. `DocHandoffPackage` no expone `messages[]` completo — solo el string truncado.
- `as Record<string, unknown>` en lugar de `as any`: consistente con el patrón de `getMessagePreview` en RepositoryView.
- `line-clamp-3`: 3 líneas visibles, igual que el patrón de Saved Selection pero con más líneas dado que el handoff tiende a tener mensajes más densos.
- `content.length > 600 ? '…'`: mismo carácter que `getMessagePreview`.

### Alternativas descartadas
- Exponer `messages: unknown[]` en `DocHandoffPackage`: descartado — el componente no necesita el array completo, solo el preview.
- `getMessagePreview` reutilizado en el componente: descartado — el mapper server-side es el lugar correcto para esta transformación en handoffs.

### Restricciones respetadas
- `InvestigateView`, `AuditView`, `DocClient`, `page.tsx`: sin tocar.
- `messages[]` no expuesto en `DocHandoffPackage`.
- Filtros, sorting, otros tipos: sin tocar.
- `CodingWorkshop.md`: no modificado.

### Build
✓ `npm.cmd run build` limpio. 0 errores TypeScript.

### Estado
Cerrado.

---

## [2026-05-29] — Fix: labels Handoff vs Handoff Package en Repository View

### Diagnóstico
`RepositoryView` usaba el label `Handoff`/`HANDOFF` para los objetos de `handoff_packages`, confundiéndolo con checkpoints que tienen `purpose: 'Handoff'`. Dos puntos de render afectados: el badge en el detail panel (`HandoffDetailPanel`) y el badge en la card de la lista.

### Archivos tocados
- `src/components/documentation/RepositoryView.tsx`
  - Línea 173 (`HandoffDetailPanel`): `Handoff` → `Handoff Package`
  - Línea 616 (card badge en lista): `HANDOFF` → `HANDOFF PACKAGE`

### Restricciones respetadas
- Dropdown: sin tocar — línea 447 ya decía `Handoff Package` correctamente.
- `PURPOSE_BADGE['Handoff']` y `PURPOSE_LABELS['Handoff']`: sin tocar — son para checkpoints con purpose `'Handoff'`.
- Lógica de filtros, queries, sorting: sin tocar.

### Build
✓ `npm.cmd run build` limpio.

### Estado
Cerrado.

---

## [2026-05-29] — OE C: Checkpoint content_preview en Repository View

### Diagnóstico
`getDocCheckpoints()` no traía mensajes de `checkpoint_messages`. Las cards de checkpoint en Repository View no podían mostrar preview de contenido. La columna `content` existe en `checkpoint_messages` como `text not null`; la columna de orden es `position` (no `created_at` — ese campo no existe en `checkpoint_messages`).

### Demo First
La demo no tiene `getDocCheckpoints`, `DocCheckpoint` ni vistas equivalentes. No aplica portación.

### Desviación de la OE
La OE especificaba `checkpoint_messages(content, role, created_at)`. La tabla no tiene `created_at` — solo `position`. Se usó `checkpoint_messages(content, role, position)` y se ordena por `position` en el mapper.

### Archivos tocados
- `src/lib/db/documentation.ts`
  - `DocCheckpoint`: agregado `content_preview?: string`.
  - `RawCheckpoint`: agregado `checkpoint_messages: { content, role, position }[] | null`.
  - `.select()`: agregado `checkpoint_messages(content, role, position)`.
  - Mapper: filtra `role === 'assistant'`, ordena por `position`, toma el último, trunca a 600 chars.
- `src/components/documentation/RepositoryView.tsx`
  - Card de checkpoint: `{item.cp.content_preview && <p className="line-clamp-3">}` insertado entre pills y bottom strip.

### Decisiones técnicas
- `position` en lugar de `created_at`: `checkpoint_messages` no tiene timestamp.
- Solo `role === 'assistant'`: preview del contenido del agente, no del usuario.
- `checkpoint_messages[]` no expuesto en `DocCheckpoint`: solo el string truncado.

### Restricciones respetadas
- `InvestigateView`, `AuditView`, `DocClient`, `page.tsx`: sin tocar.
- `CodingWorkshop.md`: no modificado.

### Build
✓ `npm.cmd run build` limpio.

### Estado
Cerrado.

---

## [2026-05-29] — Mini chat preview en Repository View detail panels

### Diagnóstico
Los detail panels de Repository View solo mostraban metadata y un preview de texto plano. Los usuarios no podían leer el hilo conversacional del objeto documental sin salir al workspace. El campo `content_preview` daba el último mensaje truncado, pero no el intercambio completo.

### Demo First
La demo no tiene `MiniChatPreview`, `CheckpointDetailPanel`, `HandoffDetailPanel` ni `SavedSelectionDetailPanel`. No aplica portación.

### Archivos tocados
- `src/lib/db/documentation.ts`
  - `DocCheckpoint`: agregado `checkpoint_messages: { role, content, position }[]`.
  - `getDocCheckpoints()` mapper: expone `checkpoint_messages` ordenados por `position`.
  - `DocHandoffPackage`: agregado `messages: { role, content }[]`.
  - `getHandoffPackages()` mapper: normaliza `messages` desde `r.messages` (raw unknown[]) a `{ role, content }[]` usando `Record<string, unknown>[]` cast.
- `src/components/documentation/RepositoryView.tsx`
  - `MiniChatPreview`: subcomponente local. Últimos 8 mensajes, burbujas user/assistant, truncado a 300 chars cada burbuja, max-h-64 overflow scroll.
  - `CheckpointDetailPanel`: sección "Conversation" con `MiniChatPreview` si hay mensajes.
  - `HandoffDetailPanel`: sección "Conversation" con `MiniChatPreview` si hay mensajes.
  - `SavedSelectionDetailPanel`: reemplazado `getMessagePreview` + bloque de texto plano por `MiniChatPreview` con cast `{ role?, content? }[]`.

### Decisiones técnicas
- `slice(-8)`: últimos 8 mensajes para no abrumar el panel lateral.
- Burbujas `bg-[var(--color-accent)] text-white` para user, `bg-[var(--color-surface-subtle)] border` para assistant — consistente con el sistema de tokens del proyecto.
- `max-h-64 overflow-y-auto`: el mini chat es scrollable dentro del panel, sin romper el layout.
- Render condicional `{hp.messages.length > 0 && ...}`: no muestra sección vacía.
- `as { role?: string; content?: string }[]` para `ss.messages`: tipado conservador sobre `unknown[]`.
- `getMessagePreview` no fue eliminado — sigue usándose en las cards de la lista para el preview de Saved Selections.

### Alternativas descartadas
- Mostrar todos los mensajes sin límite: descartado — el panel lateral es estrecho.
- Crear componente externo: descartado — OE prohíbe archivos nuevos.
- Exponer `messages[]` raw en `DocHandoffPackage` sin normalizar: descartado por seguridad de tipos.

### Restricciones respetadas
- `InvestigateView`, `AuditView`, `DocClient`, `page.tsx`: sin tocar.
- Filtros, sorting, cards existentes: sin tocar.
- `content_preview` en ambos tipos: sin eliminar.
- `CodingWorkshop.md`: no modificado.

### Build
✓ `npm.cmd run build` limpio. 0 errores TypeScript.

### Estado
Cerrado.

---

## [2026-05-29] — Open Workspace en Repository View detail panels

### Diagnóstico
`HandoffDetailPanel` solo tenía `View in Audit Log` (ancho completo, `w-full`). `SavedSelectionDetailPanel` no tenía ningún botón de navegación. `CheckpointDetailPanel` tenía `Open Document` + `View in Audit Log` en flex row — el estándar del proyecto.

### Demo First
La demo no tiene detail panels equivalentes. No aplica portación.

### Archivos tocados
- `src/components/documentation/RepositoryView.tsx`
  - `HandoffDetailPanel`: cambiado de `<div className="pt-1">` con botón único `w-full` a `<div className="flex gap-2 pt-1">` con dos botones: `Open Workspace →` (`bg-indigo-600`) + `View in Audit Log` (clase `ui-button-primary`). Mismo layout que `CheckpointDetailPanel`.
  - `SavedSelectionDetailPanel`: agregado `<div className="flex gap-2 pt-1">` con botón `Open Workspace →` antes del cierre del scrollable div.

### Decisiones técnicas
- `hp.workspace_id` y `ss.workspace_id` son `string` en sus tipos — sin guard condicional necesario.
- Clase `bg-indigo-600 hover:bg-indigo-500` idéntica a `Open Document` de checkpoint para consistencia visual.
- `noopener,noreferrer` presente en ambos.
- `CheckpointDetailPanel`: sin tocar.

### Restricciones respetadas
- Filtros, sorting, cards, MiniChatPreview, previews: sin tocar.
- `documentation.ts`: sin tocar.
- `CodingWorkshop.md`: no modificado.

### Build
✓ `npm.cmd run build` limpio.

### Estado
Cerrado.

---

## [2026-05-29] — Actor labels en MiniChatPreview

### Diagnóstico
`MiniChatPreview` mostraba burbujas con alineación visual pero sin identificar el actor. En handoff packages es especialmente relevante saber qué agente emitió cada mensaje.

### Demo First
La demo no tiene `MiniChatPreview` ni detail panels documentales equivalentes. No aplica portación.

### Archivos tocados
- `src/components/documentation/RepositoryView.tsx`
  - `MiniChatPreview`: firma extendida con `agentLabel?: string` (default `'AI'`). Cada burbuja ahora muestra un label de actor encima: `'You'` para `role === 'user'`, `agentLabel` para el resto. El layout externo (`flex justify-end/start`) se preserva; el label y la burbuja quedan en un `flex flex-col items-end/start gap-0.5`.
  - `HandoffDetailPanel`: pasa `agentLabel={AGENT_LABEL[hp.from_agent as keyof typeof AGENT_LABEL] ?? 'AI'}` — reutiliza la constante ya existente en el archivo.

### Decisiones técnicas
- `AGENT_LABEL` ya existía en línea 40 (`manager → 'Manager'`, `worker1 → 'Worker 1'`, `worker2 → 'Worker 2'`). No se creó mapa nuevo.
- `agentLabel = 'AI'` como default: checkpoint y saved selection no tienen agente específico identificable en el contrato actual — `'AI'` es el fallback correcto.
- Label sobre la burbuja (no dentro): mantiene el texto de la burbuja limpio y el label distinguible visualmente.
- `max-w-full` en la burbuja interior en lugar de `max-w-[85%]` (el límite lo impone el contenedor externo `flex justify-end/start`).

### Alternativas descartadas
- Label dentro de la burbuja: reduce espacio útil para contenido y mezcla metadata con mensaje.
- Pasar `agentLabel` a checkpoint y saved selection: `checkpoint_messages` no tiene info de agente específico en el contrato actual — el default `'AI'` es correcto.

### Restricciones respetadas
- `documentation.ts`: sin tocar.
- Filtros, sorting, cards: sin tocar.
- `CheckpointDetailPanel`, `SavedSelectionDetailPanel`: sin tocar (usan default).
- `CodingWorkshop.md`: no modificado.

### Build
✓ `npm.cmd run build` limpio. 0 errores TypeScript.

### Estado
Cerrado.

---

## [2026-05-29] — Two-column layout CheckpointDetailPanel

### Diagnóstico
`CheckpointDetailPanel` tenía metadata principal y metadata secundaria en columna única, haciendo el panel más largo de lo necesario. Con mini chat y botones, el scroll era excesivo para un panel lateral.

### Demo First
La demo no tiene `CheckpointDetailPanel` ni detail panels documentales. No aplica portación.

### Archivos tocados
- `src/components/documentation/RepositoryView.tsx`
  - Contenedor cambiado de `space-y-5` a `flex flex-col gap-5`.
  - Metadata principal (todos los `Row` hasta Purpose) → columna izquierda de `grid grid-cols-2 gap-4`.
  - Bloque `Secondary Metadata` → columna derecha del mismo grid.
  - `MiniChatPreview` → full width debajo del grid.
  - Botones de acción → full width debajo del mini chat.

### Restricciones respetadas
- `HandoffDetailPanel`, `SavedSelectionDetailPanel`: sin tocar.
- Contenido de Row, handlers, labels: sin tocar.
- Filtros, sorting, cards: sin tocar.
- `CodingWorkshop.md`: no modificado.

### Build
✓ `npm.cmd run build` limpio.

### Estado
Cerrado.

---

## [2026-05-29] — Metadata jerárquica en Handoff y Saved Selection detail panels

### Diagnóstico
`HandoffDetailPanel` mostraba From/To, Status, Created, Messages y Workspace, pero no Project ni Team aunque ambos campos estaban disponibles en `DocHandoffPackage`. `SavedSelectionDetailPanel` mostraba Messages, Created, Workspace y Team (condicional), pero tampoco mostraba Project.

### Demo First
La demo no tiene detail panels equivalentes. No aplica portación.

### Archivos tocados
- `src/components/documentation/RepositoryView.tsx`
  - `HandoffDetailPanel`: agregados `<Row label="Project">` y `<Row label="Team">` antes de `<Row label="Workspace">`. Orden final: From→To, Status, Created, Messages, **Project, Team**, Workspace.
  - `SavedSelectionDetailPanel`: agregado `<Row label="Project">`. Team normalizado de condicional `{ss.team_name && ...}` a siempre visible con fallback `'—'`. Orden reordenado: Messages, **Project, Team**, Workspace, Created.

### Decisiones técnicas
- `hp.project_name ?? '—'` / `ss.project_name ?? '—'`: ambos campos son `string | null` en sus tipos.
- `SavedSelectionDetailPanel` Team: cambio de `{ss.team_name && ...}` a `{ss.team_name ? teamLabel(...) : '—'}` — consistente con el patrón de los otros panels.
- `CheckpointDetailPanel`: sin tocar — ya tiene Project y Team en Secondary Metadata.

### Restricciones respetadas
- `CheckpointDetailPanel`: sin tocar.
- `documentation.ts`, filtros, sorting, cards: sin tocar.
- `CodingWorkshop.md`: no modificado.

### Build
✓ `npm.cmd run build` limpio.

### Estado
Cerrado.

---

## [2026-05-29] — Agent role en checkpoint messages

### Diagnóstico
`MiniChatPreview` en checkpoints mostraba `'AI'` como label genérico para todos los mensajes de assistant. El join `checkpoint_messages → agent_sessions` es directo vía `session_id` FK, lo que permite obtener `agent_role` por mensaje.

### Demo First
La demo tiene `agent_role` en su modelo de datos pero sin join equivalent a `checkpoint_messages → agent_sessions`. No aplica portación.

### Archivos tocados
- `src/lib/db/documentation.ts`
  - `RawCheckpoint.checkpoint_messages`: agregados `session_id: string | null` y `agent_sessions: { agent_role: string } | null`.
  - `.select()`: cambiado de `checkpoint_messages(content, role, position)` a `checkpoint_messages(content, role, position, session_id, agent_sessions(agent_role))`.
  - `DocCheckpoint.checkpoint_messages`: extendido con `agent_role?: string`.
  - Mapper: `checkpoint_messages` ahora mapea `agent_role: m.agent_sessions?.agent_role ?? undefined` por mensaje.
- `src/components/documentation/RepositoryView.tsx`
  - `MiniChatPreview`: tipo de `messages` extendido con `agentRole?: string`.
  - Label de burbuja: `agentLabel` → `AGENT_LABEL[msg.agentRole ?? ''] ?? agentLabel`.
  - `CheckpointDetailPanel`: `MiniChatPreview` recibe `messages={cp.checkpoint_messages.map(m => ({ ...m, agentRole: m.agent_role }))}`.
  - `CheckpointDetailPanel` Secondary Metadata: IIFE que agrega `MetaRow label="AI Agent"` cuando existe `agent_role` en el primer mensaje assistant.

### Decisiones técnicas
- `agent_role` en `DocCheckpoint.checkpoint_messages` es `?: string` — opcional porque checkpoints sin mensajes o sin join existente devuelven `undefined`.
- IIFE `(() => { ... })()` en JSX para el MetaRow de AI Agent: evita variable de estado o lógica innecesaria fuera del render.
- `agent_sessions` y `session_id` no se exponen en `DocCheckpoint` — solo `agent_role` como dato de UI mínimo.
- `content_preview` no fue afectado — usa el raw array de Supabase antes del mapper.

### Restricciones respetadas
- `HandoffDetailPanel`, `SavedSelectionDetailPanel`: sin tocar.
- Filtros, sorting, cards: sin tocar.
- `CodingWorkshop.md`: no modificado.

### Build
✓ `npm.cmd run build` limpio. 0 errores TypeScript.

### Estado
Cerrado.

---

## [2026-05-29] — Agent role en Saved Selection messages

### Diagnóstico
`openSaveSelectionModal()` en WorkspaceShell usaba `Object.values(panelRefs.current)` — sin el `sessionId`, por lo que no había forma de resolver qué `agent_session` correspondía a cada panel y adjuntar `agent_role` a los mensajes guardados. `SavedSelectionDetailPanel` tampoco pasaba `agentRole` a `MiniChatPreview`.

### Demo First
La demo no tiene `openSaveSelectionModal`, `MiniChatPreview` ni `SavedSelectionDetailPanel`. No aplica portación.

### Archivos tocados
- `src/lib/providers/types.ts`: `ChatMessage` extendido con `agent_role?: string`.
- `src/components/workspace/WorkspaceShell.tsx`: `openSaveSelectionModal()` — `Object.values` → `Object.entries` para obtener `sessionId`; por cada panel se busca la `agent_session` correspondiente y se adjunta `agent_role` a cada mensaje vía spread `{ ...m, agent_role: agentRole }`.
- `src/components/documentation/RepositoryView.tsx`: `SavedSelectionDetailPanel` — cast extendido a `{ role?, content?, agent_role? }[]`; `agentRole: m.agent_role ?? undefined` pasado a `MiniChatPreview`.

### Decisiones técnicas
- `agent_role` es `?: string` en `ChatMessage` — campos opcionales para no romper mensajes ya guardados ni el contrato de streaming.
- `Object.entries` en lugar de `Object.values`: necesario para obtener `sessionId` que actúa como key del `panelRefs.current` map.
- `workspace.agent_sessions?.find(s => s.id === sessionId)`: lookup exacto por ID de sesión — cada panel tiene su propia sesión.
- Los saves anteriores sin `agent_role` en sus mensajes continúan funcionando con fallback `'AI'`.
- Streaming no afectado: `agent_role` es un campo extra ignorado por los providers.

### Restricciones respetadas
- `documentation.ts`: sin tocar.
- `CheckpointDetailPanel`, `HandoffDetailPanel`: sin tocar.
- Save Selection API route: sin tocar.
- `CodingWorkshop.md`: no modificado.

### Build
✓ `npm.cmd run build` limpio. 0 errores TypeScript.

### Estado
Cerrado.

---

## [2026-05-29] — OE Documental: DECISIONS.md + PRODUCT_STATUS.md evidence audit

### Archivos leídos
- `handoff.md` (completo)
- `AISyncPlans.md` (completo)
- `PRODUCT_STATUS.md` (completo)

### Archivos creados
- `DECISIONS.md`

### Archivos modificados
- `PRODUCT_STATUS.md`

### Archivos no modificados
- `handoff.md`, `AISyncPlans.md`, `PromtsOperativos.md`, `CodingWorkshop.md`, código fuente.

### Cambios realizados en `DECISIONS.md`
10 decisiones registradas:
1. Repo activo vs repos de demo (2026-05-17)
2. SAT vs MAT como atributos operativos reales (2026-05-20)
3. Control Plane vs Content Plane (2026-05-20)
4. Save Version vs Session Backup vs Saved Selection (2026-05-28)
5. project_id = null en Saved Selections — MVP (2026-05-28)
6. Handoff vs Handoff Package — semántica y labels (2026-05-29)
7. Agent labels via session_id en checkpoint messages (2026-05-29)
8. "Show less power, not less truth" — registro documental (2026-05-29)
9. "Albañilería before terminaciones" — registro documental (2026-05-29)
10. Scope de Cross Verification diferido — registro documental (2026-05-29)

### Cambios realizados en `PRODUCT_STATUS.md`
- `Last updated` actualizado a 2026-05-29.
- Sección `Estado Legend` agregada con 7 estados definidos.
- Columna `Evidencia` agregada a todas las tablas (commit hash o ruta verificable).
- `Add Context File`: estado cambiado de `🔲 Coming soon` a `Partial` — evidencia: OE B 2026-05-21 (handoff.md) + migración 017 aplicada.
- `Cross Verification (full scope)`: nueva fila con estado `Needs Review` y evidencia `DECISIONS.md`.
- `Known deferred items`: actualizados con referencias a `DECISIONS.md` y tabla Workspace.

### Decisiones técnicas
- Decisiones sin fecha explícita en documentos fuente: registradas con fecha 2026-05-29 como "fecha de registro documental" con nota explícita en el archivo.
- `Add Context File` no se bajó de estado sin evidencia: la evidencia es handoff.md OE B ("botón ahora funcional") + migración 017 aplicada. Estado `Partial` por `project_id` missing en cadena de props.
- No se inventaron commits. Todos los hashes provienen del PRODUCT_STATUS.md anterior o de handoff.md.

### Alternativas descartadas
- Convertir `DECISIONS.md` en roadmap — descartado. Solo decisiones ya tomadas.
- Degradar features sin evidencia — descartado. Solo se cambió `Add Context File` con evidencia documentada en handoff.md.
- Incluir `.claude/settings.local.json` en el commit — descartado. No es parte del scope.

### Riesgos o deuda técnica
- `DECISIONS.md` crecerá con el tiempo. Si se vuelve muy largo, considerar splitting por dominio.
- Los estados `UI-only` y `Broken` están en la leyenda pero sin features asignadas actualmente.

### Build
No ejecutado. OE documental pura.

### Commit
`da9ec77` — docs: add decisions registry and update product status evidence

### Estado
Cerrado.

---

## [2026-05-29] — Fix: Falso 403 en admin prompts route por lookup de rol

### Diagnóstico
`POST /api/admin/prompts` devolvía `403` aunque el usuario autenticado tenía `role = 'owner'`. Los `updated_at` en `system_prompts` mostraban el timestamp del seed original — ninguna edición había persistido. Network tab confirmó 403, no un problema silencioso de DB.

### Demo First
La demo (`C:\proyectos\AISync\MVP`) no tiene routes API ni `adminClient`. No aplica portación.

### Causa raíz
La route usaba `supabase` (client con cookies) para el lookup de rol en `accounts` después de verificar identidad con `supabase.auth.getUser()`. En route handlers de Next.js App Router, el client con cookies no resuelve confiablemente el contexto RLS para queries posteriores. El SELECT sobre `accounts` retornaba `null` → condición `!account` evaluaba `true` → 403.

### Archivos tocados
- `src/app/api/admin/prompts/route.ts`
  - `adminClient = createAdminClient()` movido antes del lookup de rol.
  - `supabase.from('accounts')` → `adminClient.from('accounts')`.
  - Segunda instanciación redundante de `adminClient` (línea 42 original) eliminada.
  - `supabase.auth.getUser()`: sin tocar.
  - Lógica de autorización, update, audit event: sin tocar.

### Decisiones técnicas
- `auth.getUser()` con `supabase` para identidad — correcto, sigue igual.
- `adminClient` para lookup de rol — bypasea RLS de forma acotada, después de que la identidad ya fue verificada.
- No se tocaron otras routes. El patrón queda documentado en `AISyncPlans.md` §6.2 y `CodingWorkshop.md` entrada #8 para referencia futura.

### Alternativas descartadas
- Agregar policy RLS que permita self-read en `accounts` — descartado. Requeriría migración y cambio de arquitectura. El fix con `adminClient` es más directo y seguro.
- Cambiar el guard de autorización — descartado. La lógica es correcta, el problema era el cliente.

### Riesgos o deuda técnica
- Otras routes que usan `supabase` para lookups en `accounts` o tablas RLS-protegidas pueden tener el mismo problema silencioso. No se revisaron en esta OE — fuera de scope.

### Build
✓ `npm.cmd run build` limpio. 0 errores TypeScript.

### Commit
`fix: use adminClient for role lookup in admin prompts route`

### Validación manual
No disponible en esta sesión. Build y revisión de route validados. La verificación funcional requiere usuario con `role = 'owner'` en producción.

### Estado
Cerrado.

---

## [2026-05-29] — Fix: Admin prompts cache — router.refresh() después de save exitoso

### Diagnóstico
La edición de system prompts persistía en DB (confirmado: `updated_at` actualizaba correctamente). Pero al navegar de vuelta a `/admin`, el usuario veía la versión anterior del prompt. Solo un hard refresh (F5) mostraba el valor actualizado. El save era funcional — el problema era post-save.

### Demo First
La demo (`C:\proyectos\AISync\MVP`) es Vite SPA, no usa Next.js App Router ni `useRouter`. No aplica portación.

### Causa raíz
Next.js App Router cachea server components. Sin una señal de invalidación post-mutación, el router servía la versión cacheada de `/admin` al navegar dentro de la app.

### Archivos tocados
- `src/components/admin/AdminClient.tsx`
  - Import `useRouter` de `next/navigation` agregado (línea 4).
  - `const router = useRouter()` al inicio de `PromptsSection` (línea 197).
  - `router.refresh()` inmediatamente después de `setSaveMsg({ ok: true, text: 'Saved successfully' })` (línea 226).

### Archivos no tocados
- `src/app/api/admin/prompts/route.ts`: sin tocar.
- Lógica de save, validaciones, permisos: sin tocar.
- Otros componentes: sin tocar.

### Decisiones técnicas
- `router.refresh()` solo en el branch de éxito (`else { ... }`): no se llama en error ni en el bloque `finally`.
- No se usó `revalidatePath()` — requeriría un server action; `router.refresh()` desde el client component es el patrón correcto para este caso.

### Build
✓ `npm.cmd run build` limpio. 0 errores TypeScript.

### Commit
`fix: refresh router after prompt save to bust Next.js cache`

### Validación manual
No disponible en esta sesión. Requiere navegación real en `/admin` con usuario `owner`.

### Estado
Cerrado.
