# AISync — Planos Técnicos

Documento de referencia técnica para Workers nuevos o relevos. Basado en lectura directa del código activo, migraciones y handoff.md. No es documentación de marketing.

Última actualización: 2026-07-03

**Documentación interna relacionada:**
- `PromtsOperativos.md`: archivo de referencia operacional que centraliza los prompts vigentes de Claude Code y GPT OE Maker para sesiones de desarrollo y redacción de OEs.
- `CodingWorkshop.md`: registro acumulativo de bugs resueltos, causas raíz y lecciones técnicas.
- `handoff.md`: historial operativo de OEs ejecutadas y decisiones técnicas.
- `PRODUCT_STATUS.md`: estado de features del producto.

---

## 1. Stack y entorno

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14 (App Router) |
| Lenguaje | TypeScript estricto |
| Estilos | Tailwind CSS + CSS variables en `src/styles/tokens.css` |
| Base de datos | Supabase (PostgreSQL + RLS + Auth) |
| Deploy | Vercel |
| Fuentes | IBM Plex Sans (UI) + JetBrains Mono (código) — cargadas en `layout.tsx` |
| Auth | Supabase Auth — middleware en `src/middleware.ts` |

Variables de entorno requeridas:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (usado en `src/lib/supabase/admin.ts`)

URL producción: `https://ai-sync-mvp-claude.vercel.app`

---

## 2. Estructura de carpetas

### 2.1 `src/app`

Rutas Next.js App Router. Cada carpeta es una ruta.

```
src/app/
  layout.tsx                    ← RootLayout: fuentes, metadata, <body>
  page.tsx                      ← Dashboard raíz (ProjectList)
  middleware.ts                 ← Auth guard: /login ↔ rutas protegidas
  actions.ts                    ← Server Actions (auth/logout)

  admin/page.tsx                ← Panel admin (métricas, roles)
  audit/page.tsx                ← Audit Log global con calendario
  context/page.tsx              ← Gestión de Context Files
  documentation/page.tsx        ← Documentation Mode (5 vistas)
  login/page.tsx                ← Login
  settings/page.tsx             ← API Keys + Custom Providers + Setup Guide
  teams/page.tsx                ← Teams Map + Tree
  workspace/[id]/page.tsx       ← Workspace con paneles de agentes

  api/
    active-workspace/route.ts   ← GET workspace activo
    admin/prompts/route.ts      ← Admin prompt management
    audit/route.ts              ← POST audit_log events
    chat/route.ts               ← POST streaming chat (núcleo del sistema)
    checkpoint/route.ts         ← GET/POST checkpoints
    checkpoint/[id]/route.ts    ← GET mensajes de un checkpoint
    connections/route.ts        ← GET/POST team connections
    connections/[id]/route.ts   ← DELETE connection
    context/route.ts            ← GET/POST context_sources
    handoff-package/route.ts    ← POST handoff packages
    messages/route.ts           ← POST mensajes a DB
    save-selection/route.ts     ← POST saved_selections
    settings/keys/route.ts      ← GET/POST/DELETE API keys
    settings/providers/route.ts ← GET/POST/DELETE custom providers
    sm-doc-chat/route.ts        ← POST SM Panel chat (streaming)
    teams/route.ts              ← GET/POST teams
    teams/[id]/route.ts         ← PATCH/DELETE team
    workspace/[id]/lock/route.ts ← POST toggle lock_state
```

### 2.2 `src/components`

Organizados por dominio funcional:

```
components/
  admin/AdminClient.tsx          ← Panel admin client-side
  audit/
    AuditClient.tsx              ← Cliente del Audit Log (dynamic import, ssr:false)
    AuditTimeline.tsx            ← Calendario Month/Week/Day nativo (sin librerías)
  documentation/
    DocClient.tsx                ← Orquestador: SM Panel + 5 tabs
    RepositoryView.tsx           ← Vista principal: lista + filtros + panel detalle
    StructureView.tsx            ← DocumentationMirrorTree (pan/zoom/drag)
    AuditView.tsx                ← Trazabilidad documental
    InvestigateView.tsx          ← Análisis profundo
    KnowledgeMap.tsx             ← Grafo ReactFlow (dynamic import, ssr:false)
    DocumentationMirrorTree.tsx  ← Árbol espejo con canvas
  layout/
    AppLayout.tsx                ← Shell: TopRibbon + <main> + BottomRibbon
    TopRibbon.tsx                ← Barra superior con navegación
    BottomRibbon.tsx             ← Barra inferior con accesos secundarios
  settings/
    ApiKeysManager.tsx           ← CRUD API keys por provider
    CustomProvidersManager.tsx   ← CRUD providers custom
    SetupGuide.tsx               ← Guía de configuración
  sm/
    SMPanel.tsx                  ← Sub-Manager: sidebar con chat IA + contexto documental
    SMDisambiguationModal.tsx    ← Modal cuando SM detecta múltiples documentos mencionados
  teams/
    TeamsClient.tsx              ← Orquestador: Map/Tree + modales
    MapView.tsx                  ← Vista mapa con canvas + cards posicionadas
    TreeView.tsx                 ← Vista árbol jerárquico
    AddTeamModal.tsx             ← Crear team (panel dual MAT/SAT)
    EditTeamModal.tsx            ← Editar team + agentes
    ConnectTeamModal.tsx         ← Conectar equipo externo
    IncomingRequestsPanel.tsx    ← Solicitudes entrantes
    ExternalTeamNode.tsx         ← Nodo de equipo externo en Map
    TeamNode.tsx                 ← Card de team (legado @xyflow)
    CanvasViewport.tsx           ← Viewport con pan/zoom (legado)
    map/TeamAgentCard.tsx        ← Cards de agentes en mapa
    map/AgentCard.tsx            ← Card de agente individual
    map/CanvasViewport.tsx       ← Viewport activo del mapa
  workspace/
    WorkspaceShell.tsx           ← Orquestador del workspace: paneles + modales
    AgentPanel.tsx               ← Panel de chat por agente (forwardRef)
    PromptLibrary.tsx            ← Modal gestión de prompts
    ContextFilePanel.tsx         ← Modal gestión de context files
    HandoffPackageModal.tsx      ← Modal crear handoff package
  LogoutButton.tsx
  ProjectList.tsx
```

### 2.3 `src/lib`

Lógica pura, sin componentes UI.

```
lib/
  context/extractText.ts         ← Extracción de texto de PDF/DOCX/TXT/etc.
  documentation/
    buildMirrorTree.ts           ← Construye árbol espejo para StructureView
    types.ts                     ← Tipos para el árbol documental
  map/
    buildAgentLayout.ts          ← Calcula posiciones de nodos en el mapa
    buildTreeLayout.ts           ← Calcula posiciones del árbol jerárquico
  providers/
    anthropic.ts | openai.ts | google.ts | groq.ts | local.ts
    index.ts                     ← Registry + factory getProvider()
    types.ts                     ← ChatMessage, ChatProvider, ProviderConfig
  storage/contextFiles.ts        ← Upload/signed URL en Supabase Storage
  supabase/
    client.ts                    ← Browser client (createBrowserClient)
    server.ts                    ← Server client (createServerClient + cookies)
    admin.ts                     ← Admin client (service role, sin RLS)
  supabase.ts                    ← Legacy (no usar en código nuevo)
  teams/
    computeTeamCodes.ts          ← Códigos jerárquicos A-00, A-01, A-01-01
    getProjectColor.ts           ← 12 paletas corporativas fijas
```

### 2.4 `src/lib/db`

Módulos de acceso a base de datos. Todos server-side (`createClient()` de server.ts).

| Archivo | Responsabilidad |
|---|---|
| `types.ts` | Tipos TypeScript canónicos (Project, Team, Workspace, AgentSession, etc.) |
| `workspaces.ts` | `getWorkspaceWithAgents()` — workspace + agent_sessions en un fetch |
| `teams.ts` | `getActiveProjectId()`, `getTeamsForProject()` |
| `documentation.ts` | `getDocCheckpoints()`, `getHandoffPackages()`, `getDocAuditEvents()` — Content Plane |
| `audit.ts` | Queries para el Audit Log global |
| `prompts.ts` | `listActivePromptsForContext()` — Prompt Library server-side |
| `context.ts` | CRUD `context_sources` + `getContextSourcesForRuntime()` |
| `messages.ts` | Leer/escribir `messages` por session |
| `system-prompts.ts` | Leer system prompts por team |
| `agent-map.ts` | Construye `AgentNode[]` para el mapa |
| `projects.ts` | Queries de proyectos con jerarquía |
| `log-layers.ts` | Capa de logging estructurado |
| `planes.ts` | Declaración de planos Control/Content |
| `admin-metrics.ts` | Métricas para panel admin |

### 2.5 `src/lib/providers`

```typescript
interface ChatProvider {
  stream(messages: ChatMessage[], model: string): Promise<ReadableStream<Uint8Array>>
}

interface ProviderConfig {
  apiKey?: string    // cloud providers
  endpoint?: string  // IA Local
}
```

Registry en `index.ts`:
```
Anthropic  → AnthropicProvider
OpenAI     → OpenAIProvider
Google     → GoogleProvider
IA Local   → LocalProvider (Ollama/LM Studio compatible)

**Provider retirement (2026-07-10):**
Groq fue removido como provider funcional. Ya no existe `GroqProvider` ni soporte runtime.
Motivo: Groq dio de baja llama-3.3-70b-versatile (único modelo usado en AISync).
Los 21 agent_sessions que usaban Groq fueron migrados a OpenAI/GPT-5.5.
Groq removido de: factory registry, KNOWN_PROVIDERS, chat API, onboarding, ApiKeyRequiredModal.
Referencias cosméticas en badges/labels pendientes de limpieza en Mini-OE B.
```

Función de acceso: `getProvider(name: string, config: ProviderConfig): ChatProvider`

### 2.6 `supabase/migrations`

19 migraciones. Ver sección 10.

---

## 3. Plano de albañilería — árbol de componentes

### 3.1 Layout raíz

```
RootLayout (layout.tsx)          ← Server, carga fuentes
  └── middleware.ts              ← Auth guard antes de cada request
      └── page.tsx / [ruta]/page.tsx
```

### 3.2 AppLayout

```
AppLayout
  scrollable=true  → min-h-screen flex flex-col
  scrollable=false → h-screen flex flex-col overflow-hidden (workspace, docs, teams, audit)

  ├── TopRibbon (shrink-0)
  ├── <main>
  │     scrollable=true  → flex-1 overflow-auto
  │     scrollable=false → flex-1 overflow-hidden min-h-0 flex flex-col  ← crítico
  └── BottomRibbon (shrink-0)
```

**Regla crítica**: toda página que necesita scroll interno debe usar `scrollable={false}` en AppLayout. El `flex flex-col` en `<main>` es lo que permite que `flex-1` en los hijos resuelva la altura.

**Excepción — Documentation Mode**: `DocClient` gestiona su propio layout completo (TopRibbon + main + BottomRibbon) en lugar de delegar a `AppLayout`. Motivo: necesita manejar `pageSubtitleOnClick` para el modal principal "How to use Documentation Mode", lo cual requiere ser un client component con acceso directo a `TopRibbon`. `page.tsx` de Documentation Mode retorna `<DocClient .../>` directamente sin wrapper `AppLayout`.

**Excepción — Audit Log**: `AuditClient` gestiona su propio layout completo (TopRibbon + main + BottomRibbon). Mismo patrón que Documentation Mode. `page.tsx` de Audit Log retorna `<AuditClient pageName="AUDIT LOG" .../>` directamente. Subtítulo superior: `How to use Audit Log` via `pageSubtitleOnClick`.

**Excepción — Main Workspace**: `WorkspaceClient` (thin wrapper creado en esta OE) gestiona layout completo (TopRibbon + main + BottomRibbon). `WorkspaceShell` conserva su interfaz intacta. `page.tsx` retorna `<WorkspaceClient pageName accentColor badge .../>` directamente. Subtítulo superior: `How to work in Workspace` via `pageSubtitleOnClick`. `BottomRibbon` recibe `accentColor` para mantener consistencia visual del ribbon coloreado por team.

**Excepción — Teams Map**: `TeamsClient` gestiona layout completo (TopRibbon + ribbon operativo interno + BottomRibbon). El ribbon interno tiene tres links agrupados junto a la burbuja SAT/MAT: `SAT vs MAT` → `showSatMatGuide`, `How to create or grow Teams` → `showCreateTeamsGuide`, `How to Connect Team` → `showConnectGuide`. El subtítulo del `TopRibbon` superior abre `showMainGuide`. Burbuja SAT/MAT es solo texto plano (sin botón interno). `page.tsx` retorna `<TeamsClient pageName projectName .../>` directamente.

**Teams Map Draft 2 visual contract (2026-07-12 v2 + emergency correction):** Active Teams Map uses bento/masonry-like Project layout via CSS columns (`columns-1 xl:columns-2` with `columnGap: 16px`). Project containers use `break-inside-avoid`. Project names from real `projectName` prop. Teams flow inside Project using `flex flex-wrap`. **Team Card visual contract:** top color header (`backgroundColor: color || '#8E4CC6'` defensive fallback) with white code/name text, white body with provider/model, SAT/MAT text badge, legible metrics (Workspaces/Sessions/Workers: N), Team Members section showing agent_sessions as compact badges (GM, W1-W4, +N overflow), Open/Edit actions. **Workers visibility (2026-07-12 emergency fix):** Workers are NOT separate cards per worker — they appear as (1) legible "Workers: N" label, (2) compact agent_sessions badges showing GM + W1-W4 + overflow counter. This balances visibility with density. **Subteams visual contract:** render under parent, lighter shade (`deriveLighterColor 25%` + defensive fallback), vertical + horizontal connector lines, no provider/model/SAT-MAT, only code/name/metrics/Open-Edit. **Color defensive fallback:** Always apply runtime fallback to prevent gray cards if `resolveTeamColor` fails. **Legend:** 4 exact blocks. Map only view. TreeView/CanvasViewport untouched.

**Patrón reusable — `TopRibbon.pageSubtitleOnClick`**: `TopRibbon` acepta `pageSubtitleOnClick?: () => void`. Prioridad: `pageSubtitleHref` (link) > `pageSubtitleOnClick` (button) > texto plano. Usar este patrón para disparar modales de ayuda por página desde el subtítulo del ribbon. Ver `DECISIONS.md` entrada 2026-06-02.

### 3.3 Workspace

```
WorkspaceShell (Client Component)
  ├── AgentPanel × 3            (forwardRef, panelRefs)
  ├── Save Selection bar        (condicional: _totalSelected > 0)
  ├── Modal: Save Selection     (condicional: showSaveSelectionModal)
  ├── Modal: Save Version       (condicional: showSaveModal)
  └── HandoffPackageModal       (condicional: showHandoffModal)
```

### 3.4 AgentPanel

Secciones internas (de arriba a abajo):

```
AgentPanel (forwardRef → AgentPanelHandle)
  1. Header          ← displayLabel + provider + model + description + selection count
  2. Tools row       ← Prompt Library | Add Context File
  3. Viewport        ← Messages + day markers + streaming indicator
  4. Composer        ← textarea + Send
  5. Forward section ← select destino + Review & Forward + Create Handoff Package
  6. Actions grid    ← Refresh Session | Save Version | Selection(N) | Audit AI
  └── PromptLibrary modal (Fragment, fuera del panel)
  └── ContextFilePanel modal (Fragment, fuera del panel)
```

**Prompt Library modal:** no debe cerrarse por click en backdrop (`onClick={e => e.stopPropagation()}`); el cierre depende solo de acciones explícitas (`CANCEL` o `✕`). El textarea de prompt usa `rows={10}` y `resize-y` para edición extensa.

**Prompt Library — reset de formulario:** `savePrompt()` debe resetear `editing`, `formTitle`, `formBody` y `formNotes` después de `setShowForm(false)` y antes de `await loadData()`. La asignación de prompts a Workers/Teams se gestiona desde las cards de la lista — no desde un panel secundario de assignments.

**Estado dual en AgentPanel**: `messages` (display) y `apiMessages` (historial enviado al modelo) son estados separados. Toda función que inyecte mensajes externamente — como `appendUserMessage` — debe actualizar ambos estados. `sendPrompt` los mantiene sincronizados por diseño; las inyecciones imperativas (R&F) deben hacerlo explícitamente.

**Auto-respond on forward**: `appendUserMessage` delega a `sendPrompt(content)` cuando `autoRespond=true` (default). `sendPrompt` maneja inserción de mensajes + API call — NO llamar los dos en secuencia para evitar duplicación. El delay de 50ms respeta el ciclo de estado de React. `autoRespond=false` mantiene el comportamiento original de solo insertar sin enviar. Cada panel muestra indicador `Auto-respond: ON` en el header. La función real es `sendPrompt(content: string)` — no existe `handleSend` en `AgentPanel`.

**Message attachments AI summary (2026-07-07)**: Cuando un mensaje con adjuntos se guarda vía `/api/messages`, se genera un resumen AI del adjunto de forma fire-and-forget (no bloqueante). El resumen se agrega a `messages.attachment_metadata` con campo retrocompatible `ai_summary: { status, summary?, error?, generated_at, provider, model, source }`. Se usa el helper existente `extractTextFromBuffer` de Context Files para extraer texto. La generación del resumen reutiliza el mismo provider/modelo del agente. Si falla, el mensaje se guarda igual con `status: 'unavailable'`. Se inserta evento `audit_log` tipo `attachment_summary_generated` con metadata completa. NO actualiza el evento `attachment_uploaded` existente (evita race conditions).

**Handle imperativo** (`AgentPanelHandle`):
- `getLastAssistantMessage()` — último mensaje del asistente
- `appendUserMessage(content)` — inyectar mensaje de usuario
- `getAllMessages()` — historial completo
- `restoreMessages(msgs)` — reemplazar historial (Resume Work)
- `getSelectedMessages()` — mensajes con checkbox activo
- `clearSelection()` — limpiar selección

### 3.5 Documentation Mode

```
DocClient (Client)
  ├── SMPanel                   ← sidebar izquierdo (20rem | 52px collapsed)
  └── div.flex-1
      ├── Tab bar               ← Repository | Structure | Audit | Investigate | Knowledge
      └── Vista activa
            repository  → RepositoryView
            structure   → StructureView (DocumentationMirrorTree)
            audit       → AuditView
            investigate → InvestigateView
            knowledge   → KnowledgeMap (dynamic, ssr:false)
```

**How to use guides por vista:** Repository = recuperación rápida y acceso diario. Structure = ubicación y árbol jerárquico. Audit = trazabilidad documental interna (distinta del Audit Log global). Investigate = reconstrucción profunda de temas. Knowledge Map = relaciones visuales entre objetos del repositorio. Los guides viven en el array `TABS` de `DocClient.tsx` como campos `guide` en template literals.

**Flujo de contexto SM**: `DocClient.pageContext` se construye con `filteredCheckpoints` (post-filtros de RepositoryView). `onFilterChange` notifica al padre cuando cambian los filtros. SM busca solo dentro del contexto activo.

**Objetos documentales visibles en Documentation Mode**: `checkpoints`, `handoff_packages` y `saved_selections` son los tres tipos que se listan en Repository View e Investigate View. `saved_selections` se obtiene con `getSavedSelections(user.id)` en el server component y se propaga como prop `savedSelections` por DocClient.

**Reglas de display en Repository View**: los previews de objetos con `messages` usan el último mensaje disponible truncado a 600 caracteres. Los labels de `purpose` se traducen visualmente via `PURPOSE_LABELS` local (sin modificar datos en DB). Handoff Packages exponen `content_preview?: string` calculado server-side en el mapper de `getHandoffPackages()` — `messages[]` completo no se expone al componente. Los badges de objetos `handoff_packages` deben decir `Handoff Package` — el label `Handoff` está reservado para checkpoints con `purpose: 'Handoff'`. Checkpoints exponen `content_preview?: string` y `checkpoint_messages: { role, content, position }[]` ordenados por `position`. Handoff Packages exponen `content_preview?: string` y `messages: { role, content }[]` normalizados. Los detail panels de Repository View usan `MiniChatPreview` (subcomponente local) para mostrar los últimos 8 mensajes del hilo como mini chat con burbujas. `HandoffDetailPanel` y `SavedSelectionDetailPanel` ofrecen `Open Workspace →` para abrir el workspace de origen en nueva pestaña — `Resume Work` queda reservado para checkpoints. `MiniChatPreview` muestra label de actor sobre cada burbuja: `You` para `role === 'user'`, `agentLabel` (default `'AI'`) para el agente — `HandoffDetailPanel` pasa `AGENT_LABEL[hp.from_agent] ?? 'AI'`. `CheckpointDetailPanel` usa layout de dos columnas (`grid-cols-2`): metadata principal a la izquierda, `Secondary Metadata` a la derecha, mini chat y botones en ancho completo debajo. `HandoffDetailPanel` y `SavedSelectionDetailPanel` muestran metadata jerárquica completa en orden Project → Team → Workspace → Created.

**Empty states en Repository View**: distinguir tres casos — (1) `allItems.length === 0`: cuenta vacía, sin objetos documentales — mostrar mensaje orientado a crear desde Workspace; (2) `allItems.length > 0 && displayItems.length === 0 && hasFilter`: filtros o búsqueda activos sin resultados — mostrar mensaje + botón `Clear filters` que resetea todos los filtros y `searchQuery`; (3) edge case sin filtros: mensaje genérico. `hasFilter` se deriva de `filterProject || filterTeam || filterType || filterState || filterDate || searchQuery`.

**Reglas de display en Investigate View**: cuando `filterType === ''` (All Types), la vista base muestra checkpoints agrupados por fecha y, al final, una sección "Saved Selections" con todas las saved_selections. Cuando `filterType === 'Saved Selection'`, muestra solo saved_selections. Los labels de `purpose` se traducen mediante `PURPOSE_LABELS` local (igual que en RepositoryView) — no se modifica la DB.

### 3.6 SMPanel

Estados internos (en localStorage):
- `sm-connection` — provider/model/endpoint activo
- `sm-messages` — historial de mensajes del panel
- `sm-panel-open` — estado abierto/cerrado

Flujo cuando está conectado:
```
connection → ribbon amber (warn si external) → connection badge
          → context indicator (filtered/full)
          → messages scroll
          → input → POST /api/sm-doc-chat (streaming)
```

Función `renderAssistantMessage`: detecta nombres de checkpoints en las respuestas del SM y los convierte en botones clickeables que navegan a ese documento en RepositoryView.

---

## 4. Plano eléctrico — flujo de datos y estado

### 4.1 Props contracts clave

**Markdown rendering in chat messages (2026-07-11):**

AgentPanel y HumanChatPanel renderizan mensajes con Markdown usando `react-markdown@^10.1.0` + `remark-gfm@^4.0.1`. Soporta: tablas estilo GitHub, negritas, cursivas, listas, code inline/block, blockquotes. NO usa `rehype-raw` ni `dangerouslySetInnerHTML` — HTML crudo no se ejecuta (crítico para Connected Teams donde mensajes pueden venir de otra cuenta). Components explícitos con clases Tailwind (sin `@tailwindcss/typography`). copyMessage preserva `msg.content` original. Bundle impact: /workspace/[id] First Load JS aumentó de 20.1 kB a 63.8 kB (+43.7 kB — aceptable para MVP).

**WorkspaceShell → AgentPanel**:

| Prop | Tipo | Descripción |
|---|---|---|
| `session` | `AgentSession` | Datos del agente (id, role, provider, model, description) |
| `initialMessages` | `Message[]` | Historial cargado desde DB al montar |
| `workspaceLocked` | `boolean` | Si true, input y acciones deshabilitadas |
| `onSelectionChange` | `(count: number) => void` | Notifica selección al padre |
| `forwardTargets` | `{ role, label }[]` | Destinos disponibles para Review & Forward |
| `onForward` | `(msgs, targetRole) => void` | Ejecuta el forward |
| `onCreateHandoff` | `() => void` | Abre HandoffPackageModal |
| `onSaveVersion` | `() => void` | Abre modal Save Version |
| `onOpenSaveSelection` | `() => void` | Abre modal Save Selection |
| `teamId` | `string?` | Para inyección de contexto SAT/MAT |
| `teamType` | `'SAT' \| 'MAT'` | Determina si se inyecta snapshot de pares |
| `getOtherPanelsSnapshot` | `() => PanelSnapshot[]` | Snapshot de los otros paneles |

### 4.2 `panelRefs`

```typescript
const panelRefs = useRef<Record<string, AgentPanelHandle | null>>({})
```

Keyed por `session.id`. Permite acceso imperativo a cualquier panel desde WorkspaceShell. Usado por:
- `buildOtherPanelsSnapshot` — lee mensajes de otros paneles
- `openSaveSelectionModal` — recolecta mensajes seleccionados
- `handleResume` — restaura historial desde checkpoint
- `_handleBackup` — exporta historial a JSON
- `handlePanelForward` — inyecta mensaje en panel destino

### 4.3 `onSelectionChange`

Flujo completo:
```
AgentPanel.toggleSelection(i)
  → setSelectedIndices (setState)
  → useEffect([selectedIndices.size])
  → onSelectionChange(selectedIndices.size)        ← prop callback
  → WorkspaceShell.handleSelectionChange(sessionId, count)
  → selectionCounts.current[sessionId] = count
  → setTotalSelected(total)                        ← reactiva la barra
  → {_totalSelected > 0 && <SelectionBar>}
```

**Regla crítica**: nunca llamar `onSelectionChange` dentro de un setState updater. React puede suprimir efectos secundarios en updaters. Siempre usar `useEffect`.

### 4.4 `teamType`

Calculado en WorkspaceShell con `useMemo`:
```typescript
const providers = new Set(workspace.agent_sessions.map(s => s.provider))
return providers.size === 1 ? 'SAT' : 'MAT'
```

Si todos los agentes usan el mismo provider → SAT → se inyecta snapshot de pares en el contexto del chat.

### 4.5 Contexto SM

`pageContext` se construye en `DocClient`:
- Header: "DOCUMENTATION MODE — FULL/FILTERED CONTEXT (N documents)"
- Body: hasta 100 checkpoints filtrados en formato `Name | Project | Team | Workspace | Purpose | State | Date`

Flujo: filtros de RepositoryView → `onFilterChange(filtered)` → `setFilteredCheckpoints` → `pageContext` recalculado → prop `pageContext` de SMPanel actualizado.

### 4.6 Save Version / Checkpoints

```
AgentPanel: botón "Save Version" → onSaveVersion()
WorkspaceShell: openSaveModal()
  → modal: nombre + propósito
  → confirmSave()
  → POST /api/checkpoint
      body: { workspaceId, name, purpose, panels: [{ sessionId, messages[] }] }
  → DB: INSERT checkpoints + checkpoint_messages
  → audit_log: (implícito en la ruta)
```

Resume Work:
```
handleResume(checkpointId)
  → GET /api/checkpoint/[id]
  → rows agrupadas por session_id
  → panelRefs[id].restoreMessages(msgs)  ← imperativo
  → audit_log: resume_work event
```

### 4.7 Save Selection

```
AgentPanel: botón "Selection(N)" → onOpenSaveSelection()
WorkspaceShell: openSaveSelectionModal()
  → itera panelRefs, recolecta getSelectedMessages()
  → si hay mensajes → setPendingSelectionMessages + abre modal
  → handleSaveSelection()
  → POST /api/save-selection
      body: { workspace_id, team_id, project_id: null, name, messages }
  → DB: INSERT saved_selections
  → audit_log: save_selection event (account_id, workspace_id, metadata: { saved_selection_id, name, message_count })
```

---

## 5. Plano sanitario — base de datos

### 5.1 Tablas principales

**Control Plane** (propiedad de AISync):

| Tabla | Descripción |
|---|---|
| `accounts` | Una cuenta = un usuario soberano |
| `projects` | Agrupación de teams |
| `teams` | SAT/MAT, con jerarquía (`parent_id`) |
| `workspaces` | Sala de trabajo de un team |
| `agent_sessions` | Un agente por workspace (manager, worker1, worker2) |
| `audit_log` | Registro inmutable de eventos |
| `user_api_keys` | API keys por usuario/provider |
| `user_custom_providers` | Providers customizados |
| `team_connections` | Conexiones entre teams |
| `prompt_library` | Prompts del usuario |
| `prompt_assignments` | Asignaciones prompt → team/worker |
| `system_prompts` | Prompts de sistema por team (Capa 3) |
| `saved_selections` | Selecciones de mensajes guardadas |

**Content Plane** (propiedad del cliente, migrable):

| Tabla | Descripción |
|---|---|
| `checkpoints` | Snapshots de conversación |
| `checkpoint_messages` | Mensajes inmutables del snapshot |
| `messages` | Historial live por sesión |
| `handoff_packages` | Transferencias formales entre agentes |
| `context_sources` | Archivos de contexto subidos |

### 5.2 Relaciones

```
accounts
  └── projects
        └── teams (parent_id → self)
              └── workspaces
                    └── agent_sessions
                          └── messages
                    └── checkpoints
                          └── checkpoint_messages
                    └── handoff_packages
              └── team_connections
        └── saved_selections (también FK a workspace + team)
accounts (users)
  └── user_api_keys
  └── user_custom_providers
  └── prompt_library
        └── prompt_assignments
  └── context_sources
  └── audit_log
```

### 5.3 RLS

Patrón dominante: verificación a través de la jerarquía hasta `accounts.account_id = auth.uid()`.

Ejemplo (agent_sessions):
```sql
EXISTS (
  SELECT 1 FROM workspaces w
  JOIN teams t ON t.id = w.team_id
  JOIN projects p ON p.id = t.project_id
  WHERE w.id = agent_sessions.workspace_id AND p.account_id = auth.uid()
)
```

Excepciones (ownership directo por `user_id = auth.uid()`):
- `user_api_keys`, `user_custom_providers`
- `prompt_library`, `prompt_assignments`
- `context_sources`
- `handoff_packages`
- `saved_selections`

**Lección RLS crítica (migración 047 — 2026-07-07):**
RLS requiere políticas explícitas para cada operación DML (SELECT, INSERT, UPDATE, DELETE). Tener SELECT+INSERT no implica tener UPDATE. Features que actualizan filas existentes deben auditar políticas UPDATE además de SELECT/INSERT, incluso si el UPDATE ocurre desde el mismo código que hizo el INSERT. El bloqueo por RLS es silencioso desde la perspectiva de la aplicación — Supabase ignora el UPDATE sin lanzar error visible en logs del servidor.

**Caso real:** `messages` tenía SELECT+INSERT desde migración 002, pero Attachment AI Summary (que actualiza `attachment_metadata.ai_summary` post-INSERT) falló silenciosamente hasta agregar política `messages_update` en migración 047.

### 5.4 Migraciones aplicadas vs pendientes

Ver sección 10.

---

## 6. Instalaciones — API routes

### 6.1 Endpoints existentes

| Método | Ruta | Tablas afectadas | Auth |
|---|---|---|---|
| GET | `/api/active-workspace` | workspaces, agent_sessions | Session |
| GET/POST | `/api/audit` | audit_log | Session |
| POST | `/api/chat` | — (streaming, no escribe en DB) | Session |
| GET/POST | `/api/checkpoint` | checkpoints, checkpoint_messages | Session |
| GET | `/api/checkpoint/[id]` | checkpoint_messages | Session |
| GET/POST/DELETE | `/api/connections` | team_connections | Session |
| DELETE | `/api/connections/[id]` | team_connections | Session |
| GET/POST | `/api/context` | context_sources | Session |
| POST | `/api/handoff-package` | handoff_packages | Session |
| POST | `/api/messages` | messages, audit_log (attachment_summary_generated) | Session — fire-and-forget AI summary generation for attachments |
| POST | `/api/save-selection` | saved_selections, audit_log | Session |
| GET/POST/DELETE | `/api/settings/keys` | user_api_keys | Session |
| GET/POST/DELETE | `/api/settings/providers` | user_custom_providers | Session |
| POST | `/api/sm-doc-chat` | — (streaming) | Session |
| GET/POST | `/api/teams` | teams, workspaces, agent_sessions | Session |
| PATCH/DELETE | `/api/teams/[id]` | teams, agent_sessions | Session |
| POST | `/api/workspace/[id]/lock` | workspaces | Session |
| GET/POST | `/api/admin/prompts` | prompt_library | Admin role |

### 6.2 Patrón estándar de route

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  // validar campos requeridos → 400
  // operar en DB
  // retornar NextResponse.json(data, { status: 201 })
}
```

**Patrón admin con doble client:** En routes que requieren verificar rol de admin/owner, usar `supabase.auth.getUser()` para identidad y `adminClient` para el lookup de rol en `accounts`. No usar el client con cookies para queries RLS después de autenticar — puede retornar `null` en route handlers de App Router aunque el usuario y el registro existan. Ver entrada #8 en `CodingWorkshop.md`.

**Save Version modal:** labels visibles deben estar en inglés. `PURPOSES` array: `['Checkpoint', 'Evidence', 'Reuse', 'Handoff', 'Resume Later', 'Documentation', 'Audit Support']`. Los valores `Checkpoint` y `Handoff` se preservan en inglés; los demás se mantienen en inglés para consistencia con la UI. El modal se abre desde `AgentPanel` via `onSaveVersion` → `openSaveModal()` en WorkspaceShell. El payload (`name`, `purpose`, `panels`) no cambia con la traducción de labels.

**Audit Log — panel lateral de evento en Day View y Week View:** el panel lateral (`w-80 shrink-0`) está dentro de un wrapper `flex gap-4` compartido por Week y Day (`{(viewMode === 'week' || viewMode === 'day') && (...)}`). Month View permanece fuera de este wrapper. El estado `selectedEvent` es global al componente — cualquier vista puede actualizarlo y el panel aparece en el flex compartido. click en una card de evento abre un panel lateral derecho (`w-80`) con metadata del evento seleccionado (tipo, nombre, fecha, team, workspace, checkpoint, purpose, message_count, to_agent). El panel tiene botones `Open Workspace →` y `Check Work` (condicionado por `metadata.checkpoint_id`). Convive con el modal de detalle; no lo reemplaza. Estado `selectedEvent: NormalizedEvent | null`. Helper `Row` local para filas de metadata. Los campos `metadata.*` son `unknown` — usar `!!` para condicionales y `String()` para render.

**Audit Log — arquitectura de botones en Day View:** `Open Workspace →` aparece para todos los eventos con `workspace_id` (abre workspace directo en nueva pestaña). `Check Work` aparece solo para eventos con checkpoint y abre el modal de preview via `openDetail`. `Resume Work →` vive exclusivamente dentro del modal y abre workspace/checkpoint en nueva pestaña. Ninguno de los tres botones usa `router.push` — toda navegación es `window.open(..., '_blank', 'noopener,noreferrer')`.

**Audit Log — navegación Month → Day:** los chips del Month View deben navegar al Day View del día correspondiente via `setFocusDate(new Date(event.date)); setViewMode('day')`. El header del contenedor de controles usa `sticky top-0 z-10` para permanecer visible durante scroll. Patrón portado de `PageC.tsx` de la demo (L497–498).

**Cache invalidation en mutaciones client-side:** En Next.js App Router, las mutaciones client-side que afectan datos consumidos por server components deben ejecutar `router.refresh()` después del éxito para invalidar el caché del router. Sin esto, la navegación interna sirve la versión cacheada con datos viejos. Ver entrada #9 en `CodingWorkshop.md`.

---

## 7. Providers de IA

### 7.1 Modelos soportados

| Provider | Modelos configurados |
|---|---|
| Anthropic | Claude Sonnet 4.6, Claude 3 Haiku, Claude 3 Opus |
| OpenAI | GPT-5.5, GPT-4o, GPT-4o Mini, GPT-4 Turbo, o1, o3 Mini |
| Google | Gemini 3.5 Flash, Gemini 1.5 Pro |
| ~~Groq~~ | ~~REMOVED (2026-07-10)~~ |
| IA Local | Cualquier modelo Ollama/LM Studio vía endpoint configurable |

### 7.2 Selección de provider/model

1. Usuario configura provider/model por agente en EditTeamModal o AddTeamModal
2. Se persiste en `agent_sessions.provider` y `agent_sessions.model`
3. WorkspaceShell pasa `session.provider` y `session.model` a AgentPanel
4. AgentPanel los incluye en el body del POST a `/api/chat`
5. `route.ts` llama `getProvider(provider, { apiKey, endpoint })` para obtener la instancia

### 7.3 BYOK / configuración

- Arquitectura BYOK (Bring Your Own Key)
- API keys almacenadas en `user_api_keys` (Supabase, con RLS)
- El sistema las recupera en `/api/chat/route.ts` antes de instanciar el provider
- AISync no paga el uso de IA del cliente

### 7.4 Zonas sensibles

- **No modificar el streaming loop** en `route.ts` sin diagnóstico previo
- **No cambiar el orden de capas** del prompt assembly (rolePrompt → teamPrompt → promptLibrary → contextFiles → snapshot → history)
- **IA Local**: si `connection.isLocal` en SMPanel, los datos NO salen de la infraestructura del usuario. El ribbon amber lo advierte cuando es external.

---

## 8. Patrones y convenciones del proyecto

### 8.0 Patrón: Resolución de nombres sin PostgREST embedding

**Contexto:** Tablas con columnas relacionales TEXT sin Foreign Keys reales (ej: `context_sources.project_id`, `context_sources.team_id`, `context_sources.session_id`) **no soportan PostgREST embedding** tipo `projects:project_id(name)`.

**Solución:** Queries separadas acotadas + Map en memoria para O(1) lookup.

**Aplicación en Context Files (`/context`):**

1. **Traer `context_sources`** con SELECT acotado incluyendo `project_id`, `team_id`, `session_id`
2. **Recolectar IDs distintos** de cada tipo:
   ```typescript
   const projectIds = Array.from(new Set(rawSources.map(s => s.project_id).filter((id): id is string => id != null)))
   const teamIds = Array.from(new Set(rawSources.map(s => s.team_id).filter((id): id is string => id != null)))
   const sessionIds = Array.from(new Set(rawSources.map(s => s.session_id).filter((id): id is string => id != null)))
   ```
3. **Queries separadas acotadas:**
   ```typescript
   const { data: projects } = await supabase.from('projects').select('id,name').in('id', projectIds)
   const { data: teams } = await supabase.from('teams').select('id,name').in('id', teamIds)
   const { data: sessions } = await supabase.from('agent_sessions').select('id,agent_role,provider').in('id', sessionIds)
   ```
4. **Map por id** para evitar loops anidados:
   ```typescript
   const projectMap = new Map(projects?.map(p => [p.id, p]) ?? [])
   const teamMap = new Map(teams?.map(t => [t.id, t]) ?? [])
   const sessionMap = new Map(sessions?.map(s => [s.id, s]) ?? [])
   ```
5. **Enriquecer `rawSources`** con campos resueltos:
   ```typescript
   const enriched = rawSources.map(s => ({
     ...s,
     projectName: s.project_id ? projectMap.get(s.project_id)?.name : undefined,
     teamName: s.team_id ? teamMap.get(s.team_id)?.name : undefined,
     agentRole: s.session_id ? sessionMap.get(s.session_id)?.agent_role : undefined,
   }))
   ```

**Volumen confirmado:** 10-50 archivos por usuario → fallback con Maps es performante.

**Razón:** Si el volumen creciera a miles, considerar agregar FKs reales en una migración futura para habilitar PostgREST embedding.

**Referencia:** `handoff-2026-07.md` OE 1 Context Files tabla unificada

### 8.1 `createClient`

Tres variantes:
- `@/lib/supabase/server` — para Server Components y API routes (usa cookies del request)
- `@/lib/supabase/client` — para Client Components (browser)
- `@/lib/supabase/admin` — para operaciones sin RLS (service role key)

Nunca mezclar: usar server en componentes server, client en componentes client.

### 8.2 `NextResponse`

Todas las API routes retornan `NextResponse.json(data, { status })`. Guard 401 antes de cualquier operación. Guard 400 para campos faltantes.

### 8.3 `useMemo`

Se usa extensivamente para derivar estado sin re-renders innecesarios. Ejemplos: `teamType`, `buildOtherPanelsSnapshot`, `teamCodes`, `pageContext`, `smCheckpoints`, `displayItems` en RepositoryView.

### 8.4 `forwardRef`

`AgentPanel` usa `forwardRef<AgentPanelHandle, Props>`. Permite que WorkspaceShell llame métodos imperativos directamente sobre cada panel. Patrón necesario cuando el padre necesita orquestar hijos sin prop drilling de estado.

### 8.5 Refs imperativos

`panelRefs.current[session.id]` es el punto de acceso a cada panel. Se asigna en el render:
```tsx
ref={el => { panelRefs.current[session.id] = el }}
```

Siempre usar `?.` cuando se accede desde fuera del ciclo de mount: `panelRefs.current[id]?.getAllMessages() ?? []`

### 8.6 Modales inline

Patrón uniforme para todos los modales (Save Version, Save Selection, etc.):
```tsx
{showModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    onClick={e => { if (e.target === e.currentTarget) closeModal() }}
  >
    <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl space-y-5">
      ...
    </div>
  </div>
)}
```

Click fuera del contenedor cierra el modal. No se usa portal, no hay librería de modales.

### 8.7 Migraciones Supabase

La CLI de Supabase no está vinculada al proyecto remoto en este entorno. Toda migración nueva debe:
1. Crearse como archivo `.sql` en `supabase/migrations/`
2. Ejecutarse manualmente en Supabase Dashboard → SQL Editor
3. Documentarse en `PRODUCT_STATUS.md` + `handoff.md`

---

## 9. Zonas sensibles — no tocar sin diagnóstico previo

### 9.1 `WorkspaceShell`

Componente más crítico del sistema. Orquesta 3 paneles, 3 modales, el counter de selección y el sistema de checkpoints. Cualquier cambio puede romper la cadena de selección, el lock state o el flujo de guardado. Diagnóstico previo obligatorio.

### 9.2 `AgentPanel`

`forwardRef` + `useImperativeHandle` + `useEffect` para selección. La regla más importante: **nunca llamar callbacks del padre dentro de setState updaters**. Usar siempre `useEffect`.

### 9.3 `AppLayout` scroll chain

`scrollable={false}` requiere que el `<main>` tenga `flex flex-col` y que todos los descendientes usen `min-h-0` + `flex-1` correctamente. Romper la cadena causa que el scroll desaparezca en todas las vistas de altura fija. Ver historia completa en handoff.md.

### 9.4 RLS

Las policies en Supabase son la única barrera de seguridad entre usuarios. No crear tablas sin RLS. No crear rutas que bypaseen la autenticación. Verificar siempre con `supabase.auth.getUser()`, nunca con la sesión del cliente.

### 9.5 API routes

Todas las rutas verifican autenticación con `supabase.auth.getUser()`. El middleware de Next.js también protege, pero la verificación en route es la última línea de defensa. No eliminar el guard 401.

Los route handlers que leen datos protegidos por RLS deben distinguir explícitamente entre recurso inexistente (`404`), recurso ajeno (`403`) y recurso propio vacío (`200 + []`). Un resultado vacío devuelto por RLS no debe llegar al caller como `200` — oculta el estado real de autorización. En `checkpoint/[id]/route.ts`, el ownership se verifica consultando la cadena `checkpoints → workspaces → teams → projects.account_id` antes de retornar mensajes.

### 9.6 Providers / streaming

El streaming en `/api/chat/route.ts` usa `ReadableStream`. No agregar `await` en el loop de lectura. No modificar el orden de ensamblado del prompt (capas 1→2→3→4→snapshot→history).

`ChatMessage` soporta `attachments` opcionales (`ChatAttachment[]`) como base multimodal. Anthropic transforma mensajes `user` con attachments en content blocks de imagen/documento (`Anthropic.MessageParam[]`) antes de llamar al SDK; mensajes sin attachments conservan `content: string`. Otros providers (OpenAI, Google, local) quedan sin cambios hasta OEs específicas.

`AgentPanel` soporta selección local de imágenes/PDF como `ChatAttachment`, conversión base64 con `FileReader` y envío mediante `sendPrompt(content, atts)`. El parámetro `atts` es opcional con default `[]` — callers secundarios (`appendUserMessage`, guide prompts) conservan compatibilidad. Los adjuntos se muestran como chips removibles sobre el compositor y se limpian después del envío.

OpenAI transforma `ChatMessage.attachments` de tipo image en content parts `image_url` con base64. PDFs/documentos no se envían por `image_url`; requieren Files API en OE futura.

Google Gemini usa `inlineData` para attachments del mensaje actual, incluyendo imágenes y PDFs (`application/pdf`). Los attachments históricos no se reenvían en MVP y quedan como limitación documentada.

### 9.7 Tools / Tool Registry

`src/lib/tools/` es el registry independiente de providers. Las tools, como `web_search`, deben poder ser usadas por cualquier provider sin acoplarse a OpenAI, Anthropic o Google. Tavily requiere `TAVILY_API_KEY` en entorno local y Vercel Dashboard. El registry expone `toolRegistry: Record<string, ToolExecutor>` y `getTool(name)`.

OpenAI y Google soportan `ChatProvider.complete()` para tool use. OpenAI usa function tools (`tool_calls`, filtrando por `tc.type === 'function'`); Google usa `functionDeclarations` y `functionCalls()` con IDs generados por `randomUUID`. La ejecución real de tools permanece centralizada en `chat/route.ts`.

Tool loop inicial: `chat/route.ts` usa `provider.complete()` no-streaming para detectar tool calls cuando `webSearchEnabled` está activo, ejecuta tools desde `toolRegistry`, inyecta resultados como mensaje compatible y luego continúa con `provider.stream()`. El flujo sin tools permanece intacto. `ChatProvider.complete?` es opcional.

Contrato `ToolExecutor`: `execute()` retorna `Promise<ToolExecutionResult>` con `{ content: string, sources?: ToolSource[] }`. `content` alimenta el flujo actual del modelo. `sources` (`{ title, url }`) se persiste en `session_tool_calls.sources jsonb` desde `chat/route.ts`. `web-search.ts` extrae sources de Tavily, filtrando URLs no válidas y deduplicando. El panel lateral del Audit Log lee `event.metadata.sources` directamente — las sources se guardan como snapshot en `audit_log.metadata` al insertar el evento `tool_call_executed`. `session_tool_calls.sources` mantiene la traza del tool call; `audit_log.metadata.sources` alimenta el panel sin fetch secundario ni matching temporal.

---

## 10. Migraciones — estado actual

### 10.1 Orden detectado

| N° | Archivo | Descripción |
|---|---|---|
| 001 | `001_hierarchy.sql` | Tablas base: projects, teams, workspaces, agent_sessions + RLS |
| 002 | `002_messages.sql` | Tabla messages (historial live) |
| 003 | `003_checkpoints.sql` | checkpoints + checkpoint_messages + audit_log |
| 004 | `004_checkpoint_purpose.sql` | Campo purpose en checkpoints |
| 005 | `005_teams_rls_update.sql` | Update de políticas RLS en teams |
| 006 | `006_api_keys.sql` | user_api_keys |
| 007 | `007_custom_providers.sql` | user_custom_providers |
| 008 | `008_team_connections.sql` | team_connections |
| 009 | `009_documentation_metadata.sql` | Campos doc_state, object_type, sensitivity, etc. en checkpoints |
| 010 | `010_content_plane.sql` | Flags content_plane + client_owned en tablas Content Plane |
| 011 | `011_system_prompts.sql` | system_prompts |
| 011b | `011b_system_prompts_seed.sql` | Seed de system prompts |
| 012 | `012_admin_roles.sql` | admin_roles |
| 013 | `013_handoff_packages.sql` | handoff_packages |
| 014 | `014_log_layers.sql` | log_layers |
| 015 | `015_teams_description.sql` | Campo description en teams |
| 016 | `016_prompt_library.sql` | prompt_library + prompt_assignments |
| 017 | `017_context_sources.sql` | context_sources + bucket storage |
| 018 | `018_agent_session_description.sql` | Campo description en agent_sessions |
| 019 | `019_saved_selections.sql` | saved_selections |
| 020 | `020_fix_checkpoint_messages_rls.sql` | Fix RLS checkpoint_messages — filtro account_id correcto |
| 021 | `021_session_attachments_and_tool_calls.sql` | session_attachments + session_tool_calls (trazabilidad efímera) |
| 042 | `042_host_invitee_isolated_teams.sql` | team_connections: host_isolated_team_id + invitee_isolated_team_id (Connected Teams dos edificios) |
| 043 | `043_remove_invitee_rls_policies.sql` | Eliminación de políticas RLS invitee redundantes |
| 044 | `044_drop_scope_isolated_fields.sql` | Eliminación física de scope_isolated_team_id + scope_isolated_workspace_id + 3 políticas RLS legacy |
| 045 | `045_add_extraction_error_field.sql` | context_sources: extraction_error (diagnóstico Context Files) |
| 046 | `046_allow_deleted_context_sources_status.sql` | context_sources status CHECK: permite 'deleted' (Context Files delete real) |
| 047 | `047_add_messages_update_policy.sql` | messages: política UPDATE faltante (requerida por Attachment AI Summary para persistir `attachment_metadata.ai_summary`) |

### 10.2 Migraciones clave

**001** — Establece la jerarquía completa. Sin ella, nada funciona.

**003** — Crea `checkpoints`, `checkpoint_messages`, `audit_log`. Base del sistema documental.

**013** — `handoff_packages` con `content_plane = true` y `client_owned = true`. Define semántica de Content Plane.

**019** — `saved_selections`. RLS ownership directo (`user_id = auth.uid()`). Diferencia: no hereda jerarquía como checkpoints.

### 10.3 Riesgos pendientes

Migraciones 016–020 aplicadas en Supabase Dashboard. Migración 021 pendiente de aplicar manualmente.

### 10.4 Connected Teams — Arquitectura de dos edificios separados

**Estado:** Implementado y validado en producción (2026-06-30)

**Decisión arquitectónica:** Connected Teams usa modelo de "dos edificios separados" — cada usuario (Host e Invitado) tiene su propio team, workspace y Manager en su propia cuenta. La conexión entre ambos es únicamente el chat humano (`human_messages`). **No existe lectura cruzada entre el Manager de un usuario y el del otro**.

**Schema actual (migración 042):**
- `team_connections.host_isolated_team_id` → team/workspace del Manager del Host
- `team_connections.invitee_isolated_team_id` → team/workspace del Manager del Invitado
- `team_connections.scope_isolated_team_id` → **campo legacy ELIMINADO en migración 044**
- `team_connections.scope_isolated_workspace_id` → **campo legacy ELIMINADO en migración 044**

**Políticas RLS legacy eliminadas (migración 044):**
- `"Invitee can read isolated team"` en `teams` (eliminada)
- `"Invitee can read isolated workspace"` en `workspaces` (eliminada)
- `"Invitee can read isolated agent_sessions"` en `agent_sessions` (eliminada)

**Justificación:** Con el modelo de dos edificios, cada usuario accede a sus propios recursos por ownership directo (`p.account_id = auth.uid()`), haciendo las políticas legacy completamente redundantes. Las políticas de ownership normales (migración 001) cubren correctamente a ambos usuarios.

**Referencia:** `DECISIONS.md` 2026-06-26, `handoff-2026-07.md` Etapa 8c

### 10.5 Trazabilidad efímera de sesión — migración 021

`session_attachments` y `session_tool_calls` son tablas de trazabilidad efímera por sesión. Su ownership se valida por RLS mediante `agent_sessions → workspaces → teams → projects → account_id = auth.uid()`. `chat/route.ts` registra eventos de attachments y tool calls mediante inserts fire-and-forget (sin `await`, sin bloquear stream) en `session_attachments` y `session_tool_calls`. Además registra `attachment_uploaded` y `tool_call_executed` en `audit_log` para visibilidad en Audit Log. No se guarda base64 de archivos en DB — solo metadata. La integración desde AgentPanel y providers queda pendiente para OEs futuras.

### 10.5 Attachment metadata en messages — migración 022

`messages.attachment_metadata` persiste solo metadata liviana de attachments (`name`, `media_type`, `type`) para reconstruir chips al recargar el workspace. No guarda base64 ni contenido de archivo. Al cargar `initialMessages`, `AgentPanel` mapea `attachment_metadata` a `attachments` con `data: ''` como placeholder — suficiente para mostrar el chip visual. El placeholder `data: ''` no se re-envía al provider porque los mensajes históricos no pasan por la lógica de envío de adjuntos.

### Checkpoint messages — agent_role

`getDocCheckpoints()` incluye `checkpoint_messages(content, role, position, session_id, agent_sessions(agent_role))`. El campo `agent_role` se mapea por mensaje y se expone en `DocCheckpoint.checkpoint_messages`. `CheckpointDetailPanel` usa este campo para: (1) mostrar labels reales de agente en `MiniChatPreview` via `AGENT_LABEL[msg.agentRole]`; (2) mostrar row `AI Agent` en Secondary Metadata. `agent_sessions` y `session_id` no se exponen en `DocCheckpoint` — solo `agent_role` como dato de UI mínimo.

### Token usage multi-provider

AISync normaliza usage de todos los providers en `TokenUsage` con `input_tokens`/`output_tokens`. OpenAI convierte `prompt_tokens`/`completion_tokens` (capturado del último chunk con `stream_options: { include_usage: true }`). Gemini convierte `usageMetadata.promptTokenCount`/`candidatesTokenCount` (obtenido de `result.response` post-stream o de `response.usageMetadata` en complete). Todos reportan mediante `onUsage`; `chat/route.ts` persiste con `persistUsage` reutilizado.

### Token usage capture pattern

AISync usa callback opcional `onUsage` (en `StreamOptions`) para desacoplar captura de tokens del flujo principal. El provider reporta `TokenUsage` con `input_tokens`/`output_tokens`. `chat/route.ts` persiste en `token_usage` con `capture_method`. Fallos de persistencia nunca interrumpen el stream ni la respuesta al usuario. Implementado primero en Anthropic (Fase 2a). Otros providers pendientes.

Nota técnica: `AnthropicProvider.stream()` usa `client.messages.stream()` (retorna `MessageStream` con `finalMessage()`) en lugar de `client.messages.create({ stream: true })` (que solo retorna `Stream<RawMessageStreamEvent>` sin ese helper).

### Token usage infrastructure

La tabla `token_usage` será la base de persistencia para consumo de tokens por `account_id`, `workspace_id`, `session_id`, `provider` y `model`. La Fase 1 solo crea la migration y el contrato `TokenUsage`. Providers, streaming y `chat/route.ts` integrarán usage en fases posteriores (Fase 2: captura runtime; Fase 3: UI modal).

### Token usage UI — Fase 3

El consumo de tokens del workspace activo se muestra como `rightBadge` opcional en el `TopRibbon`. `TopRibbon` recibe `rightBadge?: React.ReactNode` y lo renderiza en el lado derecho (junto a `rightInfo` si existe). `TokenUsageBadge` es un componente cliente (`'use client'`) que recibe `workspaceId` y consulta `token_usage` al montar filtrando por `workspace_id`. Los registros se agrupan por `provider|model` sumando tokens. Si no hay datos, el badge no se muestra. Click abre mini modal con tabla provider/model/In/Out/Total. Cierra con X o click afuera. El prop `rightBadge` es opcional — páginas que no lo pasen (Audit, Documentation, Teams) quedan sin cambios visuales. El badge no hace polling; dashboard avanzado de consumo es trabajo futuro.

### Context Files — Delete real con Storage cleanup

**Estado:** Implementado y validado en producción (2026-07-02)

**Decisión:** Archive fue reemplazado por Delete real. El usuario puede eliminar físicamente el archivo de Storage, mantener metadata y trazabilidad en DB, e impedir que el archivo siga disponible como contexto de IA.

**Migración 046:** `context_sources.status` acepta `'deleted'` además de `'active'` y `'archived'`. Constraint CHECK actualizado.

**Migración 045:** `context_sources.extraction_error` (TEXT nullable) para diagnóstico de fallos de extracción.

**Módulo compartido:** `src/lib/context/deleteContextSource.ts`
- Función compartida de borrado real de Context Files
- Centraliza lógica usada por DELETE `/api/context/[id]` (user mode con ownership check) y scripts administrativos (admin mode sin ownership check)
- Pasos:
  1. Leer metadata antes de borrar (verificar ownership si userId provisto)
  2. Borrar objeto físico de Storage `context-files` si `file_path` existe
  3. Update DB: `status='deleted'`, `content_text=null`, `extracted_text_available=false`, `updated_at=now()`
  4. Insert audit_log event `context_file_deleted`
  5. **Manejo de fallo parcial crítico:** Si Storage se borra pero DB update falla:
     - Log crítico con metadata completa
     - Audit log event `context_file_delete_inconsistent`
     - Respuesta error 500 con mensaje claro

**Filtro de contexto AI:** `getContextSourcesForRuntime()` filtra por `.eq('status', 'active')` + `.eq('extracted_text_available', true)` + `.not('content_text', 'is', null)`. Archivos deleted NO quedan disponibles como contexto de IA.

**Restore:** No soportado por diseño porque el objeto físico de Storage se elimina.

**Referencia:** `handoff-2026-07.md` OE 2 Context Files Delete real

### Context Files — Extracción PDF con pdf-parse v2

**Estado:** Implementado y validado en producción (2026-07-02)

**Problema:** pdf-parse v2.4.5 cambió su API de función directa a clase `PDFParse` que requiere `CanvasFactory` importado desde `pdf-parse/worker`.

**Solución:** `src/lib/context/extractText.ts` usa el patrón correcto para v2:

```typescript
import { CanvasFactory } from 'pdf-parse/worker'
import { PDFParse } from 'pdf-parse'

const parser = new PDFParse({
  data: new Uint8Array(buffer),
  CanvasFactory,
})

const result = await parser.getText()
await parser.destroy()  // En finally con try/catch interno
```

**Packaging:** `@napi-rs/canvas@0.1.80` como dependencia directa exacta (versión requerida por pdfjs-dist peerDependencies). `next.config.mjs` externaliza con `experimental.serverComponentsExternalPackages: ['@napi-rs/canvas']`.

**Migración 045:** Campo `extraction_error` captura mensajes de fallo reales con logging estructurado.

**Referencia:** `handoff-2026-07.md` Context Files Stage C, `CodingWorkshop.md` entry #25

### Context Files — project inheritance

`WorkspaceShell` pasa `workspace.teams?.project_id` como `projectId` a `AgentPanel`. `AgentPanel` propaga ese valor a `ContextFilePanel`. `ContextFilePanel` no infiere `projectId` por su cuenta — siempre lo recibe como prop desde arriba. El dato de origen es `WorkspaceWithAgents.teams.project_id` (string, disponible en el join de `getWorkspaceWithAgents`).

### Save Selection — agent_role por mensaje

`ChatMessage` incluye `agent_role?: string` como campo opcional. `openSaveSelectionModal()` en WorkspaceShell usa `Object.entries(panelRefs.current)` para obtener `sessionId`, busca la `agent_session` correspondiente y adjunta `agent_role` a cada mensaje via spread. Las Saved Selections nuevas conservan `agent_role` por mensaje; los objetos antiguos sin ese campo mantienen fallback `'AI'` en `MiniChatPreview`. El campo es ignorado por providers y streaming.

### Patrón arquitectural — lookups cross-account con cliente admin

Lookups de existencia cross-account (ej. verificar que un email pertenece a una cuenta en `accounts`) requieren el cliente admin server-side (`createAdminClient()`), porque la RLS limita la lectura a la propia fila del usuario. El cliente admin se usa SOLO para SELECTs de verificación, nunca para writes. Los INSERTs/UPDATEs/DELETEs mantienen el cliente del usuario con RLS activa como primera línea de defensa. Aplicado por primera vez en POST `/api/connections` (Gap 1, 2026-06-11).

### Patrón arquitectural — UPDATEs con verificación de persistencia

Todo UPDATE desde API routes debe: (1) tener política RLS de UPDATE en la tabla destino — deny-by-default hace que un UPDATE sin política afecte 0 filas sin error; (2) ejecutarse con `.select()` y verificar filas afectadas; (3) registrar side-effects (audit_log, eventos) SOLO si el update persistió. Ownership check explícito previo (patrón `checkpoint/[id]`: 404 si no existe, 403 si no pertenece) como primera línea, RLS como segunda. Aplicado por primera vez en `workspace/[id]/lock` (SEC-007, 2026-06-11).

### Smart Lock (post-MVP)

Diseño aprobado que reemplaza al Lock manual cuando la feature vuelva a la UI. Lock deja de ser un botón y pasa a ser un mecanismo automático del workspace:

1. **Auto-lock por inactividad:** una sesión se lockea sola tras ~4 interacciones del workspace sin participar.
2. **Auto-unlock por Review & Forward:** si la sesión lockeada recibe un R&F, se desbloquea automáticamente.
3. **Modal de estado:** una sesión lockeada muestra un modal centrado en su ventana de chat indicando el estado.
4. **Unlock genera checkpoint:** desbloquear una sesión dispara checkpoint y/o backup automático.
5. **Toggle global:** el usuario puede desactivar Lock para toda la sesión ("Lock off") si le genera ruido.

Infraestructura ya lista: `lock/route.ts` con ownership check y verificación de persistencia; política RLS `workspaces_update` (migración 025); `AgentPanel` ya respeta `workspaceLocked` (inputs y forward deshabilitados). Implementar Smart Lock es agregar los triggers automáticos sobre esta base — no reconstruir persistencia. Decisión registrada en `DECISIONS.md` 2026-06-11.

### Patrón arquitectural — resolución de API keys (BYOK estricto)

Orden de resolución de API key en routes de chat: (1) key del usuario en `user_api_keys` (cliente de usuario, RLS activa); (2) solo en `NODE_ENV === 'development'`, fallback a `ENV_KEYS` de plataforma; (3) sin key → 400 con mensaje accionable que apunta a Settings → Providers. En producción la plataforma nunca presta sus credenciales — modelo BYOK (DECISIONS.md 2026-06-11). Toda route nueva que consuma providers debe replicar este patrón.

### Rate limiting architecture

AISync usa una interfaz `RateLimiter` desacoplada del proveedor (`src/lib/rate-limit/types.ts`). La implementación actual es `UpstashRateLimiter` con `Redis.fromEnv()` y `slidingWindow`. Las API routes consumen instancias por route desde `src/lib/rate-limit/index.ts` (chat 30/min, connections 10/min, context 20/min, teams 10/min). La key de rate limit es `route:user.id` y el check se aplica siempre después de auth y antes de la operación pesada, solo en POST. La política ante fallo de infraestructura es fail-open: el cliente se construye lazy dentro de `check()`, así un fallo de Redis (o env vars ausentes en local) se loguea como `[rate-limit] fail-open` y la request continúa. Toda route nueva que necesite rate limit agrega su instancia en `index.ts` y replica este patrón — no crear limiters ad-hoc.

### Provider API key resolution

AISync resuelve API keys mediante `src/lib/providers/resolveApiKey.ts`. `resolveProviderApiKey(supabase, userId, provider)` centraliza: providers conocidos (`KNOWN_PROVIDERS` — incluye Groq), custom providers (devuelve `endpointUrl` + `api_key` nullable), BYOK por `user_api_keys`, y fallback de entorno solo en development. Devuelve `null` si no hay key — la route decide el 400. `'IA Local'` se maneja en la route antes del helper (usa endpoint del request). Las routes chat y sm-doc-chat no deben mantener listas propias de providers — toda route nueva que consuma providers usa este helper.

### API ownership hardening

Routes que insertan datos vinculados a workspace verifican ownership mediante la cadena `workspaces → teams → projects → account_id` antes de ejecutar inserts (patrón `checkpoint/[id]`): 404 si el workspace no existe, 403 si no pertenece al usuario, y los IDs secundarios del body (team_id, project_id) se validan contra la cadena real. `audit_log` ocurre solo después del insert principal exitoso. Aplicado en handoff-package y save-selection (SEC-008, 2026-06-11).

### Streaming traceability rule

En flujos client-side de chat, el `userMsg` debe persistirse antes de iniciar el stream — la acción humana y la generación del assistant no deben depender del mismo paso de persistencia final. Si el stream se interrumpe con contenido parcial, el sistema lo conserva como assistant message marcado como interrumpido (marcador en el content — sobrevive en checkpoints/handoffs). La persistencia previa es fail-open: su falla se loguea y no bloquea el chat. Aplicado en `AgentPanel.sendPrompt()` (ERR-003, 2026-06-11); toda vista de chat nueva con persistencia debe seguir esta regla.

### API Key Storage Architecture (SEC-005)

AISync usa Supabase Vault para las API keys BYOK y de custom providers. `user_api_keys` y `user_custom_providers` guardan solo metadata no sensible: `vault_secret_id` y `key_last4`. Las operaciones sobre secrets pasan por RPCs `SECURITY DEFINER` que validan `auth.uid()` (migración 026): `set/get/delete_provider_key` y `set/get/delete_custom_provider_key`. `resolveProviderApiKey` aplica dual-read — Vault primero, plaintext legacy como fallback durante la transición. Los GET de settings enmascaran desde `key_last4` y nunca devuelven keys reales; el único punto que descifra es `resolveProviderApiKey` en runtime. Convenciones: nombres de provider con su case original (`lower()` solo en nombres de secret: `provider_key_<uid>_<provider>` / `custom_provider_key_<row_id>`); el DELETE siempre borra fila + secret. Fase posterior pendiente: backfill manual → validación → limpieza de plaintext.

### Active Project Architecture (ARC-004)

AISync persiste el proyecto activo en `accounts.active_project_id` (migración 027). La mutación pasa por la RPC `set_active_project` con ownership check (`projects.account_id = auth.uid()` + `status = 'active'`). La lectura centralizada vive en `getActiveProjectId()` (`src/lib/db/teams.ts`): valida la selección persistida y cae al primer proyecto activo si es null, borrada o inactiva — "el primero" es solo fallback, nunca arquitectura principal. `active-workspace` y toda superficie multi-proyecto deben consumir este helper en vez de duplicar lógica. La API client-side es `GET/PATCH /api/projects/active` (GET devuelve `{ projectId, projects }` para selectores de UI). Nota operativa: la lectura usa cliente de usuario sobre `accounts` — si el switch nunca persiste, verificar la recursión RLS de SEC-002.

---

## Backlog diferido — Features pendientes

### KNOWLEDGE MAP — Construcción completa pendiente

Knowledge Map es una de las 5 vistas de Documentation Mode (Repository, Structure, Audit, Investigate, Knowledge). Su objetivo es visualización tipo Obsidian de relaciones entre documentos, checkpoints, handoff packages, saved selections, y otros objetos documentales.

**Estado actual (2026-06-16):**
- Estructura visual básica implementada en `src/components/documentation/KnowledgeMap.tsx`
- Usa ReactFlow para grafo de nodos y edges
- Color scheme actualizado a light mode (bg-*-50, border-*-300, text-*-700)
- Sin contenido real: no hay lógica de construcción de grafo desde datos reales
- Tab "Knowledge Map" visible pero marcado como "under development" en DocClient.tsx línea 91

**Requisitos para implementación completa:**
- OE dedicada con diseño visual aprobado (mockup de nodos, edges, layout)
- Definir qué relaciones se visualizan: checkpoint → handoff package, checkpoint → saved selection, team → workspace → agent session, project → teams, etc.
- Implementar algoritmo de layout automático (jerarquizado, force-directed, o timeline)
- Definir interacciones: click en nodo abre DetailPanel, zoom/pan, filtros por tipo de objeto
- Integrar con datos reales desde `DocClient.tsx` props (checkpoints, projects, handoffPackages, savedSelections)

**No tocar hasta tener spec visual aprobada.** La implementación actual es estructura placeholder — cualquier cambio debe partir de diseño completo, no iteración incremental.

---

## Connected Teams — Shared Workspace Architecture
**Decisión tomada:** Semana 7, sesión 2026-06-13
**Estado:** Diseño aprobado, pendiente de implementación

### Modelo conceptual
El modelo es "sesión anfitrión": Usuario 1 (anfitrión) crea un workspace compartido 
dentro de su propia cuenta. Usuario 2 (invitado) entra a ese workspace específico 
a través de la dinámica de Connected Teams. Al finalizar, el workspace queda en la 
cuenta del anfitrión. El invitado no tiene acceso a ningún otro team o workspace 
del anfitrión.

### Flujo de conexión
1. El anfitrión presiona "Connect Team"
2. AISync crea automáticamente un Scope Isolated Team (visualmente distinto 
   al resto de los teams) y envía la invitación al invitado
3. El invitado recibe la invitación (mismo flujo actual de Connected Teams)
4. El invitado acepta la invitación y accede al Scope Isolated Team
5. El anfitrión recibe notificación de que la invitación fue aceptada

A partir del paso 3, el flujo es idéntico al sistema de Connected Teams actual.

### Scope Isolated Team
- Es un tipo de workspace nuevo, creado automáticamente por AISync
- Visualmente distinto al resto de los teams del anfitrión
- Aislado por diseño: el invitado NO puede ver otros teams o workspaces 
  del anfitrión desde este scope
- NO se usa un workspace existente del anfitrión (evita vulnerabilidades 
  de scope)
- Al desconectar: el team NO se borra — el anfitrión tiene opción de 
  archivarlo

### 3 paneles del workspace compartido
- Panel 1: Agente ↔ Usuario 1 (anfitrión)
- Panel 2: Mismo agente ↔ Usuario 2 (invitado)  
- Panel 3: Chat libre Usuario 1 ↔ Usuario 2 (sin IA)

El agente recibe snapshot de los 3 paneles (extensión del mecanismo SAT existente).

### Gobernanza y trazabilidad cross-cell
**Nota 1 — Metadata package:**
El anfitrión tiene la opción de enviar un paquete de metadata al invitado
para su Doc Mode y Audit Log.

**Nota 2 — Registro en Doc Mode del invitado:**
Doc Mode del invitado registra la conexión y el usuario que lo invitó,
independientemente de si se recibe metadata.

**Nota 3 — Datos de trazabilidad ausentes:**
Si el anfitrión NO envía el paquete de metadata, el evento en Doc Mode 
del invitado mostrará en los detalles:
"Datos de trazabilidad ausentes. Están en cuenta de [Usuario]."
Esto preserva la trazabilidad sin forzar al anfitrión a compartir.

**Nota 4 — Send Checkpoint al invitado:**
En Doc Mode del anfitrión, cada checkpoint de una sesión compartida tiene 
la opción "Send Checkpoint to [Usuario]".
El invitado recibe el checkpoint en su Doc Mode con trazabilidad completa.
Si el checkpoint NO es enviado, aplica la misma regla de Nota 3:
"Datos de trazabilidad ausentes. Están en cuenta de [Usuario]."

### Arquitectura técnica
- Base: mecanismo SAT existente (buildOtherPanelsSnapshot + Capa 4 del prompt stack)
- Sincronización cross-browser: Supabase Realtime
- Persistencia: nueva tabla cross_cell_messages con RLS por connection_id
- Aislamiento: RLS estricto — el invitado solo accede al workspace compartido
- Control: el anfitrión puede cerrar la sesión en cualquier momento

### Gaps a implementar
1. Migración nueva: tabla cross_cell_messages (RLS por connection_id)
2. Supabase Realtime en WorkspaceShell para sincronización cross-browser
3. Refactor de buildOtherPanelsSnapshot para leer desde DB además de panelRefs
4. Modificación de /api/chat para construir snapshot cross-cell desde DB
5. UI: Panel 3 como canal humano persistido
6. Flujo de invitación: U2 recibe notificación dentro de Connected Teams
7. Creación automática de Scope Isolated Team en POST /api/connections
8. UI para envío opcional de metadata package (anfitrión → invitado)
9. Registro de conexión en Doc Mode del invitado con fallback a "datos ausentes"

### Restricciones de diseño
- El invitado DEBE tener cuenta AISync — no hay acceso por link anónimo
- El workspace compartido es propiedad del anfitrión
- El invitado no puede ver otros teams o workspaces del anfitrión
- Todo ocurre dentro de la infraestructura de Connected Teams existente
- Invitados sin cuenta AISync: descartado para MVP y fases futuras cercanas

### Infraestructura existente reutilizable
- team_connections (migración 008): tabla base para verificar conexión válida
- Patrón ownership check cross-account (SEC-008): establecido y funcional
- Rate limiting por route: ya aplicado
- resolveApiKey centralizado: funcional
- SAT snapshot mechanism: reutilizable con extensión para DB

---

## Ideas futuras — Backlog largo plazo

### Integración de agentes de ejecución de código como Worker

**Registrado:** 2026-06-22  
**Estado:** Idea para evaluación futura, no forma parte del roadmap actual del MVP

#### Contexto
GPT OE Maker → Claude Chat (Manager) ya es viable hoy en AISync: ambos son chat completions estándar, se pueden conectar como providers/agentes normales con Review & Forward entre ellos.

Lo que falta es el tercer eslabón: un Worker que sea un agente de ejecución de código real (Claude Code, GPT Code, o similar), con capacidad de leer/escribir archivos y ejecutar comandos — no solo generar texto.

#### Por qué es distinto a un Worker normal
Los Workers actuales (Anthropic, OpenAI, Google, Groq) son chat completions puros: reciben texto, devuelven texto, sin acceso a filesystem.

Claude Code (y herramientas similares) operan distinto: ejecutan un bucle de herramientas (leer archivo, escribir archivo, correr comando, repetir) sobre un repositorio real. No tienen una API de "chat completion" tradicional — requieren modo headless/SDK y un entorno de ejecución con acceso al repo.

#### Preguntas abiertas para evaluar más adelante
1. ¿Dónde correría ese agente? (máquina del usuario, sandbox en servidor de AISync, contenedor efímero)
2. ¿Cómo se captura su output (que incluye acciones sobre archivos, no solo texto) y se muestra en un panel de chat estándar?
3. ¿Qué modelo de seguridad aplica si AISync necesita acceso a un repo de código del cliente?
4. ¿Existe SDK headless de Claude Code u otra herramienta que facilite esto sin construir infraestructura de sandboxing desde cero?

#### Nota arquitectural
Si un agente de este tipo se integrara, debería poder ser tratado como un Worker más en la arquitectura de AISync: visible en Teams Map, asignable en Workspaces, capaz de Review & Forward con otros agentes, visible en Documentation Mode y Audit Log. Su naturaleza de "ejecución sobre filesystem" quedaría encapsulada en su implementación — para el resto de AISync sería un provider más con su propia API contract.

**Revisar cuando Connected Teams y Bloque 3 estén estables.**

---

### Exportación de metadata/checkpoints a Google Drive

**Registrado:** 2026-06-22  
**Estado:** Idea para evaluación futura, no forma parte del roadmap actual

#### Contexto
AISync ya usa Google OAuth para login. Existe la posibilidad de aprovechar ese mismo flujo de autenticación para permitir exportar metadata, checkpoints, documentos y otros artefactos de AISync directamente a Google Drive del usuario.

#### Por qué es relevante
- El login con Google ya está implementado — la fricción de agregar esta feature sería principalmente de scopes de OAuth (Drive API requiere permisos adicionales a los de login)
- Encaja con la doctrina de AISync de "recoverability" — los datos no quedan encerrados solo en AISync
- Posible diferenciador competitivo: exportación nativa sin pasos manuales

#### Preguntas abiertas para evaluar más adelante
1. ¿Qué se exporta exactamente? (checkpoints individuales, todo el Documentation Mode, reportes de Audit Log, handoff packages)
2. ¿Qué formato? (Google Docs nativo, PDF, JSON estructurado)
3. ¿Requiere scope adicional de OAuth (`drive.file` vs `drive.readonly` vs `drive` completo) — implica re-consentimiento del usuario?
4. ¿Es exportación manual (botón "Export to Drive") o sincronización continua?
5. Seguridad: verificar que el scope de Drive solicitado sea el mínimo necesario (`drive.file` es el más restrictivo y seguro — solo archivos creados por la app, no acceso a todo el Drive del usuario)

#### Nota técnica
Google OAuth ya configurado en Supabase Auth. Drive API requiere agregar scope `https://www.googleapis.com/auth/drive.file` al flow de login. La exportación podría implementarse como:
- Server-side: Next.js API route que usa Google Drive SDK con access token del usuario
- Client-side: Botón en Documentation Mode → POST `/api/export/drive` → crea archivo en Drive del usuario
- Formato sugerido inicial: JSON estructurado para checkpoints, PDF para reportes de Audit Log

**Revisar cuando Connected Teams y Documentation Mode estén más maduros.**

## Connected Teams connection context — 2026-06-23

WorkspaceClient recibe estado de conexión para workspaces compartidos asociados a Connected Teams.

**Reglas:**
- **status `active`:** comportamiento actual intacto; Human Chat habilitado.
- **status `cancelled`:** mostrar banner "This connection is no longer active." y deshabilitar input del Human Chat.
- **status `disconnected`:** mostrar banner "This connection is no longer active." y deshabilitar input del Human Chat.
- **connectionContext `undefined`:** no mostrar banner; se interpreta como workspace local normal o workspace sin conexión asociada.
- **status `pending`:** no se contempla como estado visual de workspace compartido porque el workspace se crea recién al aceptar la conexión.

**Regla de arquitectura:**
El estado visual de conexión inactiva debe depender de una lista explícita de estados cerrados/cancelados, no de una comparación negativa contra `active`.

**Implementación:**
```typescript
const isConnectionNoLongerActive = !!(
  connectionStatus &&
  ['cancelled', 'disconnected'].includes(connectionStatus)
)
```

**Por qué lista explícita:**
Connected Teams está cerca de cross-account access y RLS-sensitive behavior. Un futuro status (ej: `paused`, `suspended`) no debe activar banner, input disabling, o alterar shared-workspace behavior por accidente. Cualquier nuevo status requiere decisión explícita de producto/seguridad antes de mapearse a comportamiento UI.

## Patrones técnicos — Realtime reconnection

**Agregado:** 2026-07-06
**Archivo de referencia:** `src/components/workspace/HumanChatPanel.tsx`

### Patrón: Reconexión automática de canal Realtime con backoff progresivo

**Contexto:**
Los canales de Supabase Realtime pueden fallar con estados CHANNEL_ERROR, TIMED_OUT o CLOSED. Sin reconexión automática, el canal queda muerto hasta que el componente se desmonte/remonte o el usuario haga F5.

**Implementación:**

```typescript
// Variables de estado en useEffect
let isMounted = true
let reconnectAttempts = 0
let reconnectTimeout: NodeJS.Timeout | null = null
let currentChannel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null

// Función interna reutilizable
const createAndSubscribeChannel = () => {
  // Limpiar canal anterior
  if (currentChannel) {
    supabase.removeChannel(currentChannel)
    currentChannel = null
  }

  const channel = supabase.channel('name').on(...).subscribe(async (status, err) => {
    if (status === 'SUBSCRIBED') {
      reconnectAttempts = 0  // Reset counter
      // ... refetch logic ...
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      if (!isMounted) return

      reconnectAttempts++
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000)
      
      console.log(`Reconnecting, attempt ${reconnectAttempts} in ${delay}ms`)
      
      reconnectTimeout = setTimeout(() => {
        if (isMounted) createAndSubscribeChannel()
      }, delay)
    }
  })

  currentChannel = channel
}

// Cleanup
return () => {
  isMounted = false
  if (reconnectTimeout) clearTimeout(reconnectTimeout)
  if (currentChannel) supabase.removeChannel(currentChannel)
}
```

**Backoff:**
- 1s → 2s → 4s → 8s, tope 10s
- Sin límite máximo de reintentos

**Estados que disparan reconexión:**
- CHANNEL_ERROR
- TIMED_OUT
- CLOSED

**Reset en SUBSCRIBED:**
`reconnectAttempts = 0`

**Cleanup obligatorio:**
- Limpiar `reconnectTimeout` con `clearTimeout()`
- Limpiar `currentChannel` con `removeChannel()`
- Marcar `isMounted = false` para evitar reconexión post-desmontaje

**Pendiente aplicar en:**
- TeamsClient.tsx (postgres_changes sin reconexión)
- ProjectList.tsx (postgres_changes sin reconexión)

**Lección:**
Comentarios como "will retry..." sin implementación real son deuda técnica que genera falsa seguridad.


---

### Patrón arquitectural — Conditional tool availability prompt layer

**Contexto:**
Cuando una herramienta externa (ej: Web Search) cambia de estado ON/OFF mid-conversación, el modelo puede priorizar consistencia conversacional con sus propias respuestas anteriores en vez de reevaluar la disponibilidad actual de la herramienta.

**Problema:**
Si el modelo dijo en un turno anterior "no tengo acceso a internet" cuando Web Search estaba OFF, y luego el usuario activa Web Search y repite el mismo pedido, el modelo tiende a sostener la negación previa en lugar de usar la herramienta ahora disponible.

**Solución:**
Agregar una capa condicional de system prompt que se activa solo cuando la herramienta está habilitada (`webSearchEnabled === true`).

**Patrón implementado (Web Search como caso inicial):**

```ts
// ── Capa 2: Web search availability instruction (solo si webSearchEnabled) ────
const webSearchInstructionParts: ChatMessage[] = []

if (webSearchEnabled) {
  webSearchInstructionParts.push(
    {
      role: 'user',
      content:
        'Web search access is a hard external switch controlled by the user for security reasons you cannot see. ' +
        'Its state may change between messages in this same conversation. ' +
        'It is currently ENABLED for this message. ' +
        'Never assume it is unavailable based on what you said in earlier turns — if the tool is offered to you now, use it whenever the user\'s request needs current, factual, or up-to-date information. ' +
        'Do not decline to search just because you previously said you could not.',
    },
    { role: 'assistant', content: 'Understood.' },
  )
}

// Insertar en el array final con alta prioridad
const messages: ChatMessage[] = [
  ...rolePromptParts,
  ...webSearchInstructionParts,  // ← Alta prioridad, después de Role
  ...teamPromptParts,
  ...promptLibraryParts,
  // ...
]
```

**Reglas del patrón:**

1. **Condicional estricto:** La capa solo se activa cuando la herramienta está habilitada (no cuando está OFF).
2. **Alta prioridad:** Insertar temprano en el array de messages (después de Role, antes de capas más específicas).
3. **Patrón "Understood.":** Seguir el patrón existente de capas: user instruction + assistant "Understood."
4. **Instrucción explícita:** Informar que el estado puede cambiar mid-conversación y que el modelo debe reevaluar en vez de asumir indisponibilidad por turnos anteriores.
5. **Criterio operativo preservado:** La instrucción debe preservar el criterio de cuándo usar la herramienta (ej: "when the user's request needs current, factual, or up-to-date information").
6. **No forzar uso:** No usar `tool_choice` ni forzar la herramienta — solo clarificar disponibilidad.

**No modificar:**
- Tool definition de la herramienta
- Tool loop
- Capas existentes (Role, Team, Prompt Library)
- Frontend / toggle / payload

**Caso inicial:**
Web Search (src/app/api/chat/route.ts, 2026-07-08)

**Extensibilidad:**
El patrón puede aplicarse a otras herramientas externas con estado ON/OFF controlado por el usuario si se detecta el mismo sesgo de consistencia conversacional.

**Lección arquitectónica:**
Los modelos de lenguaje priorizan consistencia narrativa. Cuando una herramienta externa cambia de estado mid-conversación, el modelo necesita instrucción explícita para reevaluar la disponibilidad actual en lugar de sostener una negación previa. La capa de prompt debe ser condicional, tener alta prioridad, y preservar el criterio operativo sin forzar uso innecesario.

---

## Runtime Grounding Layer — Source fidelity extension (2026-07-09)

**Diagnóstico:**
Se detectó con evidencia real en `session_tool_calls` que el modelo puede ejecutar Web Search, obtener resultados de una fuente confiable, y aun así producir una respuesta final mezclando datos incorrectos de memoria de entrenamiento con los resultados recuperados.

Este problema es distinto de:
- Fabricar fuentes cuando no buscó
- Arrastrar negación previa de disponibilidad de Web Search
- No reevaluar estado actual del toggle

El nuevo problema: el modelo sí busca, pero no trata los resultados recuperados como autoridad exclusiva para claims actuales o verificables.

**Observación del Product Owner:**
El problema fue detectado específicamente con Anthropic en las pruebas realizadas el 2026-07-09. No se observó en OpenAI ni Google durante el mismo período. Esto se documenta como observación, no como conclusión definitiva — no se descarta que el mismo patrón aparezca en otros proveedores con más uso.

**Patrón implementado — Source-fidelity rules 6 and 7:**

**Reglas agregadas al Runtime Grounding Layer:**
- **Regla 6 (source-fidelity):** Cuando Web Search devuelve resultados, esos resultados son autoridad exclusiva para claims actuales o verificables. El modelo puede resumir, organizar o explicar resultados, pero no corregirlos, completarlos ni mezclarlos con memoria de entrenamiento sobre el mismo punto. Si los resultados son parciales, ambiguos o contradictorios, debe declarar qué queda sin verificar en vez de completar con memoria.
- **Regla 7 (source-inference separation):** El modelo debe separar lo que la fuente efectivamente afirma de inferencias propias. Las inferencias deben etiquetarse como razonamiento propio, no como hecho confirmado por la fuente.

**Ubicación:**
`src/app/api/chat/route.ts` — Runtime Grounding Layer (líneas 85-105)

**No se modificó:**
- Reglas 1-5 existentes
- `current_datetime_utc`
- `web_search_available_right_now`
- tool loop
- tool_choice (sigue en modo auto)
- `webSearchTool.definition`
- providers
- frontend

**No se implementó:**
- Evidence Mode
- Clasificación de tipos de pregunta
- Las 5 reglas completas de la segunda propuesta
- tool_choice forzado

**Alcance:**
Solo texto de prompt. No afecta ejecución de Web Search, definición de herramientas, modo auto de tool use, UI, persistencia, audit_log, session_tool_calls, ni providers.

**Observación pendiente:**
Mantener en observación si Anthropic vuelve a mezclar memoria de entrenamiento con fuentes recuperadas después de este cambio. Si el patrón reaparece, evaluar aumentar énfasis de reglas 6-7, o considerar Evidence Mode / clasificación de preguntas (ambos diferidos en esta OE).

**Lección arquitectónica:**
Ejecutar Web Search no garantiza que el modelo use los resultados como autoridad. Los modelos pueden mezclar resultados reales con memoria de entrenamiento sin distinción explícita. Las reglas de source-fidelity deben instruir no solo cuándo buscar, sino cómo tratar los resultados recuperados: como autoridad exclusiva para claims actuales/verificables, no como una fuente más entre varias. La separación entre "lo que la fuente dice" y "lo que yo infiero" debe ser explícita.

---

## MODEL_MAP / Provider routing — Compatibility pattern (2026-07-10)

**Arquitectura:**
- `agent_sessions.model` persiste **etiquetas visibles** (ej: "Claude 3.5 Sonnet", "GPT-4o"), no necesariamente IDs reales de API
- `MODEL_MAP` en cada provider traduce etiqueta visible → ID real de API en runtime
- No existe CHECK constraint sobre `agent_sessions.model` (confirmado en migrations/001_hierarchy.sql línea 36: `model text not null`)
- Etiquetas antiguas persistidas en sesiones existentes deben seguir funcionando

**Regla crítica de compatibilidad:**
Las etiquetas existentes **no deben eliminarse** del MODEL_MAP porque pueden estar persistidas en sesiones reales en producción.

Operaciones seguras:
- ✅ **Actualizar redirección existente:** Cambiar el target de una etiqueta legacy (ej: "Claude 3.5 Sonnet" de `claude-sonnet-4-5` a `claude-sonnet-4-6`)
- ✅ **Agregar nueva etiqueta:** Agregar una etiqueta nueva que antes no existía (ej: "GPT-5.5" → `gpt-5.5`, "Claude Sonnet 4.6" → `claude-sonnet-4-6`)

Operaciones **inseguras:**
- ❌ **Eliminar etiqueta existente:** Rompe sesiones guardadas con esa etiqueta (quedarían sin resolución de modelo)

**Estado actual (2026-07-10):**

**Anthropic:**
```ts
const MODEL_MAP: Record<string, string> = {
  'Claude Sonnet':     'claude-sonnet-4-6',     // actualizado de 4-5
  'Claude 3.5 Sonnet': 'claude-sonnet-4-6',     // actualizado de 4-5
  'Claude 3.7 Sonnet': 'claude-sonnet-4-6',     // actualizado de 4-5
  'Claude Sonnet 4.6': 'claude-sonnet-4-6',     // nueva etiqueta agregada
  'Claude 3 Haiku':    'claude-3-haiku-20240307',  // intacto
  'Claude 3 Opus':     'claude-3-opus-20240229',   // intacto
}
```

**OpenAI:**
```ts
const MODEL_MAP: Record<string, string> = {
  'GPT-5.5':     'gpt-5.5',         // nueva etiqueta agregada
  'GPT-4o':      'gpt-4o',          // intacto (sin redirect — preserva comportamiento)
  'GPT-4o Mini': 'gpt-4o-mini',     // intacto
  'GPT-4 Turbo': 'gpt-4-turbo',     // intacto
  'o1':          'o1',              // intacto
  'o3 Mini':     'o3-mini',         // intacto
}
```

**Google:**
```ts
const MODEL_MAP: Record<string, string> = {
  'Gemini 3.5 Flash':  'gemini-3.5-flash',
  'Gemini 2.5 Flash':  'gemini-2.5-flash',
  // Legacy mappings (deprecated models redirect to 3.5)
  'Gemini 2.0 Flash':  'gemini-3.5-flash',
  'Gemini 2.0':        'gemini-3.5-flash',
  'Gemini 1.5 Pro':    'gemini-3.5-flash',
  'Gemini 1.5 Flash':  'gemini-3.5-flash',
}
```
(No modificado en OE 2026-07-10 — ya estaba correcto)

**Groq:**
Removido de opciones visibles nuevas en AddTeamModal, EditTeamModal y ApiKeysManager (Mini-OE 2026-07-10).
Runtime Groq (groq.ts) no modificado — permanece disponible para compatibilidad con sesiones existentes o legacy.

**Evaluación AISyncPlans.md (5 preguntas obligatorias):**
1. ¿Cambié alguna tabla, columna o migración de DB? → **No** → Sin cambios DB/schema
2. ¿Cambié o agregué alguna API route? → **No** → Sin cambios API routes
3. ¿Cambié algún patrón técnico o convención del proyecto? → **Sí** → Documentado patrón MODEL_MAP como compatibilidad etiqueta→ID
4. ¿Creé o eliminé algún componente estructural? → **No** → Sin cambios árbol de componentes
5. ¿Cambié providers, servicios externos o configuración global? → **Sí** → Documentada actualización de model routing para Anthropic/OpenAI

**Lección arquitectónica:**
El patrón de etiqueta visible → ID real permite que las opciones de modelo mostradas en UI sean legibles para usuarios (ej: "Claude 3.5 Sonnet") mientras que el código real de API puede cambiar por versiones. Este desacoplamiento protege sesiones existentes cuando se actualizan modelos — las etiquetas legacy pueden redirigirse a nuevas versiones sin romper sesiones guardadas. La regla crítica: nunca eliminar una etiqueta del MODEL_MAP sin verificar que no existen sesiones persistidas con esa etiqueta en producción.

**Provider/model selection UI (AddTeamModal, EditTeamModal, ApiKeysManager):**

Actualizado 2026-07-10 para mostrar solo latest visible labels:
- **Anthropic:** Claude Sonnet 4.6
- **OpenAI:** GPT-5.5
- **Google:** Gemini 3.5 Flash

**Groq:** Removido de opciones visibles nuevas en UI de selección y configuración de API keys. Runtime Groq (groq.ts) NO eliminado — permanece para compatibilidad con sesiones existentes o legacy.

**Patrón de fallback legacy en EditTeamModal:**
- Separación estricta entre UI de selección nueva, runtime provider support y valores legacy persistidos.
- EditTeamModal implementa fallback genérico que preserva provider/model actual aunque no esté en opciones visibles nuevas.
- Si `a.provider` no está en `CLOUD_PROVIDERS`, agrega option adicional con label `(legacy)`.
- Si `a.model` no está en `MODELS[provider]`, agrega option adicional con label `(legacy)`.
- Fallback aplica a cualquier provider/model no listado, no solo Groq.
- No fuerza cambios de provider/model al abrir modal ni al guardar si usuario no tocó esos campos.
- Funciona para: Groq, Claude 3.5 Sonnet, GPT-4o, Claude 3 Opus, GPT-4 Turbo, Gemini 2.5 Flash, etc.

**Regla:** Retirar un provider de UI de selección no equivale a eliminar soporte runtime. El runtime permanece funcional para sesiones existentes. La UI nueva solo muestra latest options simplificadas.

---

## 13. Scripts de migración one-time

### 13.1 Patrón de scripts administrativos

Scripts one-time para operaciones administrativas de migración de datos en producción siguen un patrón estricto documentado en:
- `scripts/migrate-archived-to-deleted.ts` (Context Files archived → deleted)
- `scripts/migrate-groq-agents-to-openai.ts` (Groq agents → OpenAI GPT-5.5)

**Características obligatorias:**

1. **Lista cerrada de IDs explícitos** (no WHERE dinámico por criterios de negocio):
   ```ts
   const TARGET_IDS = [
     'uuid-1',
     'uuid-2',
     // ... confirmados por Product Owner
   ] as const
   ```

2. **Cliente admin con justificación**:
   ```ts
   import { createAdminClient } from '../src/lib/supabase/admin'
   // Runs without authenticated user session
   const adminClient = createAdminClient()
   ```

3. **Preflight obligatorio** antes de cualquier write:
   - Confirmar que existen exactamente N filas esperadas
   - Confirmar que todas cumplen criterios esperados (provider/model/status/etc)
   - Listar IDs faltantes si count no coincide
   - Listar filas con valores inesperados
   - Abortar con `process.exit(1)` si cualquier validación falla

4. **Gate de confirmación textual** (para migraciones con alto impacto):
   ```ts
   import * as readline from 'readline'
   // Prompt: Type exactly "[texto específico]" to continue
   // Si no coincide exactamente: abort sin cambios
   ```

5. **UPDATE/operación defensiva**:
   - Lista explícita: `.in('id', TARGET_IDS)`
   - Filtros adicionales defensivos: `.eq('provider', EXPECTED_VALUE)`
   - Nunca WHERE dinámico como criterio único

6. **Verificación posterior**:
   - Re-leer las N filas modificadas
   - Confirmar que todas tienen valores target esperados
   - Abortar si hay discrepancias

7. **Summary detallado**:
   - Total esperado / encontrado / actualizado / verificado
   - NEXT STEPS sugeridos (queries SQL, validación UI, etc)

8. **Conservación histórica**:
   - Script queda versionado en repo (no se borra después de ejecutar)
   - `.gitignore` ignora `scripts/` — agregar con `git add -f <script.ts>`

**Runner:**
```bash
npx tsx scripts/nombre-del-script.ts
```

(tsx@^4.8.1 en package-lock.json)

**Prohibido:**
- Usar WHERE dinámico por criterios de negocio (provider, status, etc) como filtro único del UPDATE
- Ejecutar UPDATE sin preflight
- Ejecutar UPDATE sin gate de confirmación en migraciones de alto impacto
- Modificar filas fuera de la lista cerrada de IDs
- Borrar script después de ejecutar

**Migraciones ejecutadas:**

1. **Context Files archived → deleted** (2026-07-03):
   - 7 filas legacy con `status='archived'` migradas a `status='deleted'`
   - Storage físico borrado + audit_log registrado
   - Patrón base: lista cerrada + preflight + admin client + shared logic (`deleteContextSource`)

2. **Groq agents → OpenAI GPT-5.5** (2026-07-10 — executed successfully):
   - 21 agent_sessions con `provider='Groq'`, `model='llama-3.3-70b-versatile'`
   - Destino: `provider='OpenAI'`, `model='GPT-5.5'`
   - Patrón extendido: lista cerrada + preflight + gate textual + admin client + verificación posterior
   - **Resultado:** Preflight ✅ (21/21), Confirmación ✅, UPDATE ✅ (21/21), Verificación ✅ (21/21)
   - **Scripts versionados:** `.ts` (original) + `.mjs` (ejecutable, con .env.local inline)
   - **Pendiente:** Validación producción (probar agentes, query Supabase)

