# AISync — Planos Técnicos

Documento de referencia técnica para Workers nuevos o relevos. Basado en lectura directa del código activo, migraciones y handoff.md. No es documentación de marketing.

Última actualización: 2026-05-28

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
Groq       → GroqProvider (OpenAI-compatible, baseURL: api.groq.com/openai/v1)
IA Local   → LocalProvider (Ollama/LM Studio compatible)
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
| POST | `/api/messages` | messages | Session |
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
| Anthropic | Claude Sonnet, Claude 3 Haiku, Claude 3 Opus |
| OpenAI | GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo |
| Google | Gemini 2.5 Flash, Gemini 1.5 Pro |
| Groq | Llama 3.3 70B, Llama 3.1 8B, Mixtral 8x7B, Gemma2 9B |
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

El streaming en `/api/chat/route.ts` usa `ReadableStream`. No agregar `await` en el loop de lectura. No modificar el orden de ensamblado del prompt (capas 1→2→3→4→snapshot→history). Groq usa el SDK de OpenAI con `baseURL` cambiada — no es un error.

`ChatMessage` soporta `attachments` opcionales (`ChatAttachment[]`) como base multimodal. Anthropic transforma mensajes `user` con attachments en content blocks de imagen/documento (`Anthropic.MessageParam[]`) antes de llamar al SDK; mensajes sin attachments conservan `content: string`. Otros providers (OpenAI, Google, Groq, local) quedan sin cambios hasta OEs específicas.

`AgentPanel` soporta selección local de imágenes/PDF como `ChatAttachment`, conversión base64 con `FileReader` y envío mediante `sendPrompt(content, atts)`. El parámetro `atts` es opcional con default `[]` — callers secundarios (`appendUserMessage`, guide prompts) conservan compatibilidad. Los adjuntos se muestran como chips removibles sobre el compositor y se limpian después del envío.

OpenAI transforma `ChatMessage.attachments` de tipo image en content parts `image_url` con base64. PDFs/documentos no se envían por `image_url`; requieren Files API en OE futura. Groq no soporta visión/adjuntos — el provider sanitiza los mensajes antes de llamar a la API enviando solo `role` y `content`; si el mensaje era solo adjunto, usa `[file attached — vision not supported by Groq]` como fallback. AgentPanel muestra warning informativo al adjuntar con Groq.

Google Gemini usa `inlineData` para attachments del mensaje actual, incluyendo imágenes y PDFs (`application/pdf`). Los attachments históricos no se reenvían en MVP y quedan como limitación documentada.

### 9.7 Tools / Tool Registry

`src/lib/tools/` es el registry independiente de providers. Las tools, como `web_search`, deben poder ser usadas por cualquier provider sin acoplarse a OpenAI, Anthropic, Google o Groq. Tavily requiere `TAVILY_API_KEY` en entorno local y Vercel Dashboard. El registry expone `toolRegistry: Record<string, ToolExecutor>` y `getTool(name)`.

OpenAI y Google soportan `ChatProvider.complete()` para tool use. OpenAI usa function tools (`tool_calls`, filtrando por `tc.type === 'function'`); Google usa `functionDeclarations` y `functionCalls()` con IDs generados por `randomUUID`. La ejecución real de tools permanece centralizada en `chat/route.ts`.

Tool loop inicial: `chat/route.ts` usa `provider.complete()` no-streaming para detectar tool calls cuando `webSearchEnabled` está activo, ejecuta tools desde `toolRegistry`, inyecta resultados como mensaje compatible y luego continúa con `provider.stream()`. El flujo sin tools permanece intacto. `ChatProvider.complete?` es opcional — OpenAI, Google y Groq no lo implementan todavía.

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

### 10.2 Migraciones clave

**001** — Establece la jerarquía completa. Sin ella, nada funciona.

**003** — Crea `checkpoints`, `checkpoint_messages`, `audit_log`. Base del sistema documental.

**013** — `handoff_packages` con `content_plane = true` y `client_owned = true`. Define semántica de Content Plane.

**019** — `saved_selections`. RLS ownership directo (`user_id = auth.uid()`). Diferencia: no hereda jerarquía como checkpoints.

### 10.3 Riesgos pendientes

Migraciones 016–020 aplicadas en Supabase Dashboard. Migración 021 pendiente de aplicar manualmente.

### 10.4 Trazabilidad efímera de sesión — migración 021

`session_attachments` y `session_tool_calls` son tablas de trazabilidad efímera por sesión. Su ownership se valida por RLS mediante `agent_sessions → workspaces → teams → projects → account_id = auth.uid()`. `chat/route.ts` registra eventos de attachments y tool calls mediante inserts fire-and-forget (sin `await`, sin bloquear stream) en `session_attachments` y `session_tool_calls`. Además registra `attachment_uploaded` y `tool_call_executed` en `audit_log` para visibilidad en Audit Log. No se guarda base64 de archivos en DB — solo metadata. La integración desde AgentPanel y providers queda pendiente para OEs futuras.

### 10.5 Attachment metadata en messages — migración 022

`messages.attachment_metadata` persiste solo metadata liviana de attachments (`name`, `media_type`, `type`) para reconstruir chips al recargar el workspace. No guarda base64 ni contenido de archivo. Al cargar `initialMessages`, `AgentPanel` mapea `attachment_metadata` a `attachments` con `data: ''` como placeholder — suficiente para mostrar el chip visual. El placeholder `data: ''` no se re-envía al provider porque los mensajes históricos no pasan por la lógica de envío de adjuntos.

### Checkpoint messages — agent_role

`getDocCheckpoints()` incluye `checkpoint_messages(content, role, position, session_id, agent_sessions(agent_role))`. El campo `agent_role` se mapea por mensaje y se expone en `DocCheckpoint.checkpoint_messages`. `CheckpointDetailPanel` usa este campo para: (1) mostrar labels reales de agente en `MiniChatPreview` via `AGENT_LABEL[msg.agentRole]`; (2) mostrar row `AI Agent` en Secondary Metadata. `agent_sessions` y `session_id` no se exponen en `DocCheckpoint` — solo `agent_role` como dato de UI mínimo.

### Token usage multi-provider

AISync normaliza usage de todos los providers en `TokenUsage` con `input_tokens`/`output_tokens`. OpenAI y Groq convierten `prompt_tokens`/`completion_tokens` (capturado del último chunk con `stream_options: { include_usage: true }`). Gemini convierte `usageMetadata.promptTokenCount`/`candidatesTokenCount` (obtenido de `result.response` post-stream o de `response.usageMetadata` en complete). Todos reportan mediante `onUsage`; `chat/route.ts` persiste con `persistUsage` reutilizado.

### Token usage capture pattern

AISync usa callback opcional `onUsage` (en `StreamOptions`) para desacoplar captura de tokens del flujo principal. El provider reporta `TokenUsage` con `input_tokens`/`output_tokens`. `chat/route.ts` persiste en `token_usage` con `capture_method`. Fallos de persistencia nunca interrumpen el stream ni la respuesta al usuario. Implementado primero en Anthropic (Fase 2a). Otros providers pendientes.

Nota técnica: `AnthropicProvider.stream()` usa `client.messages.stream()` (retorna `MessageStream` con `finalMessage()`) en lugar de `client.messages.create({ stream: true })` (que solo retorna `Stream<RawMessageStreamEvent>` sin ese helper).

### Token usage infrastructure

La tabla `token_usage` será la base de persistencia para consumo de tokens por `account_id`, `workspace_id`, `session_id`, `provider` y `model`. La Fase 1 solo crea la migration y el contrato `TokenUsage`. Providers, streaming y `chat/route.ts` integrarán usage en fases posteriores (Fase 2: captura runtime; Fase 3: UI modal).

### Token usage UI — Fase 3

El consumo de tokens del workspace activo se muestra como `rightBadge` opcional en el `TopRibbon`. `TopRibbon` recibe `rightBadge?: React.ReactNode` y lo renderiza en el lado derecho (junto a `rightInfo` si existe). `TokenUsageBadge` es un componente cliente (`'use client'`) que recibe `workspaceId` y consulta `token_usage` al montar filtrando por `workspace_id`. Los registros se agrupan por `provider|model` sumando tokens. Si no hay datos, el badge no se muestra. Click abre mini modal con tabla provider/model/In/Out/Total. Cierra con X o click afuera. El prop `rightBadge` es opcional — páginas que no lo pasen (Audit, Documentation, Teams) quedan sin cambios visuales. El badge no hace polling; dashboard avanzado de consumo es trabajo futuro.

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
