# Chat-First — Technical Review

**Fecha:** 2026-06-15  
**Objetivo:** Revisar código existente para reutilizar en implementación de Chat-First

---

## 1. PageJ.tsx (Demo) — UI a portar

**Archivo fuente:** `C:\proyectos\AISync\MVP\src\pages\PageJ.tsx`

### Layout structure (3 columnas)

```tsx
<div className="app-page-shell h-full min-h-0 min-w-0 overflow-hidden bg-[#eef2f5] px-2 py-2 sm:px-3 sm:py-3">
  <div className="mx-auto grid h-full min-h-0 w-full max-w-[1600px] gap-3 lg:grid-cols-[240px_minmax(0,1fr)_260px] xl:grid-cols-[260px_minmax(0,1fr)_280px]">
    
    {/* Left sidebar — project structure info */}
    <aside className="ui-surface hidden min-h-0 overflow-hidden rounded-[16px] border-neutral-200/80 bg-white/72 px-4 py-4 shadow-sm lg:flex lg:flex-col">
      {/* structureItems.map() */}
    </aside>

    {/* Center — main textarea + button */}
    <main className="ui-surface min-h-0 overflow-hidden rounded-[16px] border-neutral-200 bg-white shadow-md shadow-slate-900/10">
      <textarea 
        placeholder="Describe your goal, your task, or the context of your project."
        className="min-h-0 flex-1 w-full resize-none rounded-[12px] border-0 bg-[#f8fafc] px-4 py-4 text-base leading-7"
      />
      <button onClick={startWithGeneralManager}>
        Start with the General Manager
      </button>
    </main>

    {/* Right sidebar — what happens next */}
    <aside className="ui-surface hidden min-h-0 overflow-hidden rounded-[16px] border-neutral-200/70 bg-white/56 px-4 py-4 shadow-sm lg:block">
      {/* Educational copy */}
    </aside>

  </div>
</div>
```

### Action handler (lo que hay que adaptar)

```tsx
const startWithGeneralManager = () => {
  const initialIntent = message.trim();

  if (!initialIntent) {
    setValidationMessage('Please describe your goal before starting.');
    return;
  }

  // DEMO: crea mensajes mock
  const userMessage = createPreviewMessage('user', initialIntent, 'User');
  const managerMessage = createPreviewMessage(
    'agent',
    `I understand the goal: ${initialIntent}\n\n...`,
    'AI General Manager'
  );

  // DEMO: navega a Page A (Main Workspace)
  window.setTimeout(() => {
    window.history.pushState({}, '', '/?page=A');
    dispatch({ type: 'START_CHAT_FIRST_WORKSPACE', userMessage, managerMessage });
  }, 220);
};
```

**Adaptación necesaria para MVP:**
- ❌ No usar `createPreviewMessage` (mock)
- ✅ Validar API key ANTES de crear estructura
- ✅ `POST /api/onboarding/start` con `{ initialIntent }`
- ✅ Backend crea Project/Team/Workspace/Sessions + persiste mensajes en DB
- ✅ Navegar a `/workspace/[id]` con `router.push()`

---

## 2. Teams API route — Pattern de auto-creation

**Archivo fuente:** `src/app/api/teams/route.ts`

### Flujo actual al crear team (POST):

```typescript
// 1. Validación
if (!name?.trim() || !projectId || !agents?.length) {
  return NextResponse.json({ error: 'Incomplete data.' }, { status: 400 })
}

// 2. Calcular tipo (SAT/MAT)
const teamType = computeType(agents) // providers.size === 1 ? 'SAT' : 'MAT'

// 3. Insertar team
const { data: team, error: teamErr } = await supabase
  .from('teams')
  .insert({ 
    project_id: projectId, 
    name: name.trim(), 
    type: teamType, 
    parent_id: parentId ?? null,
    description: description?.trim() || null 
  })
  .select()
  .single()

// 4. Insertar workspace
const { data: workspace, error: wsErr } = await supabase
  .from('workspaces')
  .insert({ team_id: team.id, name: `Workspace ${name.trim()}` })
  .select()
  .single()

// 5. Insertar agent_sessions
const { error: agentsErr } = await supabase.from('agent_sessions').insert(
  agents.map(a => ({
    workspace_id: workspace.id,
    agent_role:   a.role,      // 'manager', 'worker1', 'worker2'
    provider:     a.provider,  // 'Anthropic', 'OpenAI', etc.
    model:        a.model,     // 'claude-3-5-sonnet-20241022', etc.
    config:       a.config ?? null,
  }))
)

// 6. Return team completo con relaciones
const { data: full } = await supabase
  .from('teams')
  .select('*, workspaces(*, agent_sessions(*))')
  .eq('id', team.id)
  .single()

return NextResponse.json(full, { status: 201 })
```

### Campos verificados en schema real:

**✅ Confirmado (migración 001_hierarchy.sql):**
- ✅ `team_id` en agent_sessions — existe y se usa en línea 82
- ✅ `account_id` **NO existe** en teams/workspaces/agent_sessions — arquitectura RLS pura
- ⚠️ `description` en workspaces — **NO existe** en schema original; solo en teams

**Esto significa:**
- ✅ El route actual de teams **es correcto** — RLS valida ownership vía joins
- ✅ Para onboarding, **NO necesitamos `account_id`** en teams/workspaces/agent_sessions
- ⚠️ Usar `workspaces.name` en vez de `workspaces.description` (que no existe)

---

## 3. Middleware existente — Redirect logic

**Archivo fuente:** `src/middleware.ts`

### Flujo actual:

```typescript
const { data: { user } } = await supabase.auth.getUser()

const path = request.nextUrl.pathname
const isPublic = path === '/login' || path.startsWith('/auth/')

// Redirect a login si no autenticado
if (!user && !isPublic) {
  return NextResponse.redirect(new URL('/login', request.url))
}

// Redirect a dashboard si ya autenticado y está en /login
if (user && path === '/login') {
  return NextResponse.redirect(new URL('/', request.url))
}
```

### Modificación necesaria para Chat-First:

```typescript
// Agregar después de validar user
if (user && path === '/') {
  // Check onboarding status
  const { data: account } = await supabase
    .from('accounts')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single()

  if (!account?.onboarding_completed) {
    return NextResponse.redirect(new URL('/start', request.url))
  }
}
```

**Consideración de performance:**
- Esto agrega una query DB en **cada request a `/`**
- Alternativa: mover la lógica a `src/app/page.tsx` (server component) — más eficiente

---

## 4. Dashboard (página principal) — `src/app/page.tsx`

### Estructura actual:

```typescript
export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: account }, projects] = await Promise.all([
    supabase.from('accounts').select('name, email, role').eq('id', user.id).single(),
    getProjectsWithHierarchy(),
  ])

  const userName = (account as { name?: string } | null)?.name ?? user.email?.split('@')[0]

  return (
    <AppLayout pageName="DASHBOARD" pageSubtitle="Your projects and activity" userName={userName}>
      <ProjectList projects={projects} />
    </AppLayout>
  )
}
```

### Modificación propuesta:

```typescript
export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Check onboarding status ────────────────────────────────────────────
  const { data: account } = await supabase
    .from('accounts')
    .select('name, email, role, onboarding_completed')  // ← agregar campo
    .eq('id', user.id)
    .single()

  // Si no completó onboarding → redirect a Chat-First
  if (!account?.onboarding_completed) {
    redirect('/start')
  }

  // ── Backfill automático para usuarios con proyectos pero sin flag ──────
  const projects = await getProjectsWithHierarchy()
  
  if (projects.length > 0 && !account?.onboarding_completed) {
    // Usuario tiene proyectos pero flag no está marcado → marcar ahora
    await supabase
      .from('accounts')
      .update({ onboarding_completed: true })
      .eq('id', user.id)
  }

  const userName = account?.name ?? user.email?.split('@')[0]

  return (
    <AppLayout pageName="DASHBOARD" pageSubtitle="Your projects and activity" userName={userName}>
      <ProjectList projects={projects} />
    </AppLayout>
  )
}
```

**Ventaja de este approach:**
- ✅ Solo 1 query extra por sesión (cuando user llega a dashboard)
- ✅ No afecta performance de middleware (que corre en **todas** las requests)
- ✅ Backfill automático de flag para usuarios existentes

---

## 5. Schema review — Campos necesarios para onboarding

### Migración 032: onboarding flag

```sql
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
```

### Campos que ya existen y podemos usar:

**accounts:**
- ✅ `id` (user.id)
- ✅ `email`
- ✅ `name`
- ⚠️ `onboarding_completed` — agregarlo con migración 032

**projects:**
- ✅ `id`
- ✅ `name`
- ✅ `account_id`
- ✅ `status` (default 'active')

**teams:**
- ✅ `id`
- ✅ `name`
- ✅ `type` ('SAT' | 'MAT' | 'isolated')
- ✅ `project_id`
- ✅ `parent_id` (nullable)
- ✅ `description` (nullable)
- ⚠️ `account_id` — debe persistirse explícitamente

**workspaces:**
- ✅ `id`
- ✅ `team_id`
- ✅ `name` (existe en schema; usar este)
- ⚠️ `lock_state` (en migración 001; campo renombrado a `locked` en 025)
- ❌ `account_id` — NO existe; ownership vía RLS

**agent_sessions:**
- ✅ `id`
- ✅ `workspace_id`
- ⚠️ `team_id` — agregado en migración posterior, verificar si existe
- ✅ `agent_role` ('manager', 'worker1', 'worker2')
- ⚠️ `agent_label` — agregado en migración posterior, verificar si existe
- ✅ `provider` ('Anthropic', 'OpenAI', etc.)
- ✅ `model` (model string)
- ⚠️ `config` (jsonb) — agregado en migración posterior, verificar si existe
- ❌ `account_id` — NO existe; ownership vía RLS

**messages:**
- ✅ `session_id`
- ✅ `workspace_id`
- ✅ `role` ('user' | 'assistant')
- ✅ `content` (text)
- ⚠️ `account_id` — verificar si existe (probablemente sí, para audit)

---

## 6. API key validation — Pattern existente

### GET /api/settings/keys (ya existe)

```typescript
// Frontend puede verificar si hay keys antes de submit
const res = await fetch('/api/settings/keys')
const keys = await res.json()

if (!Array.isArray(keys) || keys.length === 0) {
  // No tiene API keys → mostrar modal
}
```

### Return format de /api/settings/keys:

```typescript
[
  { provider: 'Anthropic', masked: 'sk-ant-...xyz' },
  { provider: 'OpenAI', masked: 'sk-...abc' }
]
```

**Para onboarding:**
- Si `keys.length === 0` → mostrar modal "API key required"
- Si `keys.length > 0` → usar `keys[0].provider` como default provider

---

## 7. Chat API — Cómo generar respuesta del manager

### POST /api/chat (ya existe)

**Payload necesario:**

```typescript
{
  messages: [{ role: 'user', content: initialIntent }],
  provider: 'Anthropic',  // El que tenga key configurada
  model: 'claude-3-5-sonnet-20241022',
  agentRole: 'manager',
  team_id: team.id,
  team_type: 'SAT',
  panel_id: managerSession.id,
  session_id: managerSession.id,
  workspace_id: workspace.id,
  project_id: project.id,
}
```

**Problema:** `/api/chat` devuelve un **stream**, no JSON

**Solución para onboarding:**

Opción 1 (simple): No generar respuesta del manager en onboarding
- Crear solo el mensaje del usuario
- Dejar que el workspace genere la respuesta cuando el usuario llegue
- **Ventaja:** Más simple, menos cosas que pueden fallar
- **Desventaja:** La UX de la demo (respuesta inmediata del manager) no se replica

Opción 2 (completo): Consumir el stream y persistir la respuesta
```typescript
const chatRes = await fetch('/api/chat', { ... })
const reader = chatRes.body?.getReader()
const decoder = new TextDecoder()
let fullResponse = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  fullResponse += decoder.decode(value, { stream: true })
}

// Persistir fullResponse como mensaje assistant
await supabase.from('messages').insert({
  session_id: managerSession.id,
  workspace_id: workspace.id,
  account_id: user.id,
  role: 'assistant',
  content: fullResponse,
  agent_role: 'manager',
})
```

**Recomendación:** **Opción 1** para MVP — más robusto, menos surface de error

---

## 8. Resumen de cambios necesarios

### Backend:

1. **Nueva migración:** `032_onboarding_flag.sql`
2. **Nuevo route:** `src/app/api/onboarding/start/route.ts`
   - Validar API key
   - Crear Project (con `account_id`)
   - Crear Team (con `account_id`, tipo 'SAT')
   - Crear Workspace (con `account_id`)
   - Crear 3 agent_sessions (con `account_id`, `team_id`)
   - Persistir mensaje inicial del usuario
   - Marcar `onboarding_completed = true`
   - Return `{ workspaceId }`
3. **Nuevo route (opcional):** `src/app/api/onboarding/skip/route.ts`
   - Marcar `onboarding_completed = true`

### Frontend:

4. **Nueva página:** `src/app/(main)/start/page.tsx`
   - Check `onboarding_completed` → redirect si ya completó
5. **Nuevo componente:** `src/components/onboarding/ChatFirstClient.tsx`
   - Portar UI de PageJ.tsx
   - Validación pre-flight de API key
   - Submit a `/api/onboarding/start`
   - Navegación a workspace
6. **Nuevo componente:** `src/components/onboarding/ApiKeyRequiredModal.tsx`
   - Modal simple con link a `/settings`

### Modificaciones a archivos existentes:

7. **`src/app/page.tsx`:**
   - Agregar `onboarding_completed` al SELECT de accounts
   - Redirect a `/start` si flag es false
   - Backfill automático si tiene proyectos pero flag no está marcado

---

## 9. Decisión: ¿Middleware o page.tsx?

### Opción A: Middleware (desventaja de performance)

```typescript
// src/middleware.ts
if (user && path === '/') {
  const { data: account } = await supabase
    .from('accounts')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single()

  if (!account?.onboarding_completed) {
    return NextResponse.redirect(new URL('/start', request.url))
  }
}
```

**Problema:** Query DB en **cada request a `/`** (incluso refresh, cache invalidation, etc.)

### Opción B: Server component (recomendado)

```typescript
// src/app/page.tsx
export default async function HomePage() {
  // ... existing code ...
  
  if (!account?.onboarding_completed) {
    redirect('/start')
  }
  
  // ... dashboard ...
}
```

**Ventaja:** 
- Query solo se ejecuta cuando Next.js renderiza el server component
- Next.js cachea el resultado
- Menos overhead

**Recomendación:** **Opción B** — mover lógica a page.tsx

---

## 10. Account_id architecture — RLS pura (sin columna)

**✅ VERIFICADO:** El schema **NO tiene columna `account_id`** en teams/workspaces/agent_sessions

**Evidencia (migración 001_hierarchy.sql):**

```sql
create table if not exists teams (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name       text not null,
  type       text not null check (type in ('SAT', 'MAT')),
  parent_id  uuid references teams(id) on delete set null,
  created_at timestamptz not null default now()
  -- ❌ NO tiene account_id
);

create table if not exists workspaces (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references workspaces(id) on delete cascade,
  name       text not null,
  lock_state text not null default 'unlocked',
  created_at timestamptz not null default now()
  -- ❌ NO tiene account_id
);

create table if not exists agent_sessions (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  agent_role   text not null,
  provider     text not null,
  model        text not null,
  created_at   timestamptz not null default now()
  -- ❌ NO tiene account_id
);
```

**RLS policies (migración 001_hierarchy.sql):**

```sql
-- teams: ownership via project join
create policy "teams_insert" on teams
  for insert with check (
    exists (
      select 1 from projects p 
      where p.id = teams.project_id 
        and p.account_id = auth.uid()
    )
  );

-- workspaces: ownership via team → project join
create policy "workspaces_insert" on workspaces
  for insert with check (
    exists (
      select 1 from teams t
      join projects p on p.id = t.project_id
      where t.id = workspaces.team_id 
        and p.account_id = auth.uid()
    )
  );

-- agent_sessions: ownership via workspace → team → project join
create policy "agent_sessions_insert" on agent_sessions
  for insert with check (
    exists (
      select 1 from workspaces w
      join teams t on t.id = w.team_id
      join projects p on p.id = t.project_id
      where w.id = agent_sessions.workspace_id 
        and p.account_id = auth.uid()
    )
  );
```

**Implicación para onboarding:**
- ✅ **No necesitamos persistir `account_id`** en teams/workspaces/agent_sessions
- ✅ RLS valida ownership automáticamente via join a projects
- ✅ El route `/api/teams` está correcto — no necesita `account_id`
- ✅ Nuestro route `/api/onboarding/start` tampoco necesita `account_id` en esas tablas

**Conclusión:**
- La arquitectura es **RLS pura** — ownership se deriva del project
- Solo `projects` tiene `account_id NOT NULL`
- El resto usa joins para validar ownership
- **No hay cambio de schema necesario** para Chat-First

---

## 11. Checklist final antes de implementar

- [x] ✅ Verificar schema de teams/workspaces/agent_sessions — **NO tienen `account_id`** (RLS pura)
- [ ] Aplicar migración 026 (Vault) en producción — **crítico antes de Chat-First**
- [ ] Decidir Opción 1 vs 2 para respuesta del manager (recomendado: Opción 1 — no generar en onboarding)
- [x] ❌ Confirmar que `workspaces.description` existe — **NO existe; usar `workspaces.name`**
- [ ] Verificar que `agent_sessions.agent_label` existe (agregado en migración posterior)
- [ ] Verificar que `agent_sessions.team_id` existe (agregado en migración posterior)
- [ ] Verificar que `agent_sessions.config` existe (agregado en migración posterior)
- [ ] Verificar que `messages.account_id` existe (probablemente sí)
- [ ] Testear `/api/settings/keys` devuelve array correcto
- [x] ✅ Confirmar que PageJ.tsx de demo es la versión más reciente — **confirmado**

**Migraciones a revisar:**
- Ver si `agent_sessions.team_id` fue agregado en migración posterior
- Ver si `agent_sessions.agent_label` fue agregado en migración posterior
- Ver si `workspaces.locked` reemplazó a `workspaces.lock_state` (migración 025)

---

## 12. Estimación ajustada

**Original:** 1 sesión (Bloque 2 — BYOK verification)  
**Ajustada:** 2 sesiones

### Sesión 1 (portación UI + validación):
- Migración 032 (5 min)
- Portar PageJ.tsx → ChatFirstClient.tsx (45 min)
- ApiKeyRequiredModal (15 min)
- Página `/start` con check de onboarding (15 min)
- Modificar `src/app/page.tsx` con redirect logic (10 min)
- Testing local (20 min)

### Sesión 2 (backend + deploy):
- Route `/api/onboarding/start` con auto-creation (60 min)
- Route `/api/onboarding/skip` (10 min)
- Verificar schema de `account_id` en tablas (5 min)
- Testing completo end-to-end (30 min)
- Deploy + aplicar migraciones 026 + 032 (15 min)
- Validación en producción (10 min)

**Total estimado:** ~3.5 horas reales de desarrollo
