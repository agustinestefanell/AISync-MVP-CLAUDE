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

**Estado dual en AgentPanel**: `messages` (display) y `apiMessages` (historial enviado al modelo) son estados separados. Toda función que inyecte mensajes externamente — como `appendUserMessage` — debe actualizar ambos estados. `sendPrompt` los mantiene sincronizados por diseño; las inyecciones imperativas (R&F) deben hacerlo explícitamente.

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

### 9.6 Providers / streaming

El streaming en `/api/chat/route.ts` usa `ReadableStream`. No agregar `await` en el loop de lectura. No modificar el orden de ensamblado del prompt (capas 1→2→3→4→snapshot→history). Groq usa el SDK de OpenAI con `baseURL` cambiada — no es un error.

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

### 10.2 Migraciones clave

**001** — Establece la jerarquía completa. Sin ella, nada funciona.

**003** — Crea `checkpoints`, `checkpoint_messages`, `audit_log`. Base del sistema documental.

**013** — `handoff_packages` con `content_plane = true` y `client_owned = true`. Define semántica de Content Plane.

**019** — `saved_selections`. RLS ownership directo (`user_id = auth.uid()`). Diferencia: no hereda jerarquía como checkpoints.

### 10.3 Riesgos pendientes

Migraciones 016–019 aplicadas en Supabase Dashboard. No hay migraciones pendientes de ejecución a 2026-05-28.

### Checkpoint messages — agent_role

`getDocCheckpoints()` incluye `checkpoint_messages(content, role, position, session_id, agent_sessions(agent_role))`. El campo `agent_role` se mapea por mensaje y se expone en `DocCheckpoint.checkpoint_messages`. `CheckpointDetailPanel` usa este campo para: (1) mostrar labels reales de agente en `MiniChatPreview` via `AGENT_LABEL[msg.agentRole]`; (2) mostrar row `AI Agent` en Secondary Metadata. `agent_sessions` y `session_id` no se exponen en `DocCheckpoint` — solo `agent_role` como dato de UI mínimo.

### Save Selection — agent_role por mensaje

`ChatMessage` incluye `agent_role?: string` como campo opcional. `openSaveSelectionModal()` en WorkspaceShell usa `Object.entries(panelRefs.current)` para obtener `sessionId`, busca la `agent_session` correspondiente y adjunta `agent_role` a cada mensaje via spread. Las Saved Selections nuevas conservan `agent_role` por mensaje; los objetos antiguos sin ese campo mantienen fallback `'AI'` en `MiniChatPreview`. El campo es ignorado por providers y streaming.
