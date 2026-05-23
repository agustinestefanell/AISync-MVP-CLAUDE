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
