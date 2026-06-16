# Chat-First — Schema Summary

**Fecha:** 2026-06-15  
**Fuente:** Análisis de `supabase/migrations/001_hierarchy.sql`, `src/lib/db/types.ts`, `src/app/api/teams/route.ts`

---

## Schema confirmado (campos que SÍ existen)

### accounts
```sql
id            uuid PRIMARY KEY
email         text NOT NULL
name          text
role          text  -- 'owner' | 'admin' | 'user'
created_at    timestamptz
-- ⚠️ onboarding_completed — agregar con migración 032
```

### projects
```sql
id            uuid PRIMARY KEY
account_id    uuid NOT NULL REFERENCES accounts(id)
name          text NOT NULL
status        text DEFAULT 'active' CHECK (status IN ('active', 'archived'))
created_at    timestamptz
```

### teams
```sql
id            uuid PRIMARY KEY
project_id    uuid NOT NULL REFERENCES projects(id)
name          text NOT NULL
type          text CHECK (type IN ('SAT', 'MAT', 'isolated'))
parent_id     uuid REFERENCES teams(id)
description   text NULL
lead_role     text  -- 'manager' | 'submanager' | 'worker'
tags          text[]
color         text NULL
created_at    timestamptz
-- ❌ NO tiene account_id (ownership via RLS → projects.account_id)
```

### workspaces
```sql
id            uuid PRIMARY KEY
team_id       uuid NOT NULL REFERENCES teams(id)
name          text NOT NULL
lock_state    text DEFAULT 'unlocked' CHECK (lock_state IN ('unlocked', 'locked'))
created_at    timestamptz
-- ❌ NO tiene account_id (ownership via RLS → teams → projects.account_id)
-- ❌ NO tiene description (solo name)
```

### agent_sessions
```sql
id            uuid PRIMARY KEY
workspace_id  uuid NOT NULL REFERENCES workspaces(id)
agent_role    text CHECK (agent_role IN ('manager', 'worker1', 'worker2'))
provider      text NOT NULL
model         text NOT NULL
config        jsonb NULL
description   text NULL  -- agregado en migración 018
created_at    timestamptz
-- ❌ NO tiene account_id (ownership via RLS → workspaces → teams → projects.account_id)
-- ❌ NO tiene agent_label (labels se derivan de agent_role en frontend)
-- ❌ NO tiene team_id (se obtiene via join workspaces.team_id)
```

### messages
```sql
id                   uuid PRIMARY KEY
session_id           uuid NOT NULL REFERENCES agent_sessions(id)
role                 text CHECK (role IN ('user', 'assistant'))
content              text NOT NULL
attachment_metadata  jsonb NULL  -- agregado en migración 022
created_at           timestamptz
-- ❌ NO tiene account_id (ownership via RLS → agent_sessions → ... → projects.account_id)
-- ❌ NO tiene workspace_id como columna física (se deriva del join)
```

---

## Campos derivados en frontend (no en DB)

### agent_label
**No existe en schema** — se calcula en tiempo de renderizado:

```typescript
// src/components/workspace/AgentPanel.tsx
const AGENT_ROLES = {
  manager: { displayLabel: 'AI General Manager', accentColor: '#3b82f6' },
  worker1: { displayLabel: 'Worker 1', accentColor: '#14b8a6' },
  worker2: { displayLabel: 'Worker 2', accentColor: '#f97316' },
}

const role = AGENT_ROLES[session.agent_role]
// role.displayLabel → "AI General Manager"
```

### team_id en agent_sessions
**No existe como columna** — se obtiene via join:

```typescript
// src/app/api/teams/route.ts (GET)
const { data } = await supabase
  .from('teams')
  .select('*, workspaces(*, agent_sessions(*))')
  .eq('project_id', projectId)

// El team_id está disponible via teams.id, no agent_sessions.team_id
```

---

## RLS policies (ownership chain)

Todas las tablas usan **RLS pura** — sin columna `account_id`:

```sql
-- projects: ownership directo
projects.account_id = auth.uid()

-- teams: ownership via project
teams → projects.account_id = auth.uid()

-- workspaces: ownership via team → project
workspaces → teams → projects.account_id = auth.uid()

-- agent_sessions: ownership via workspace → team → project
agent_sessions → workspaces → teams → projects.account_id = auth.uid()

-- messages: ownership via agent_sessions → workspace → team → project
messages → agent_sessions → workspaces → teams → projects.account_id = auth.uid()
```

**Consecuencia:**
- Solo `projects` tiene columna `account_id`
- El resto valida ownership via joins en las RLS policies
- No necesitamos persistir `account_id` en teams/workspaces/agent_sessions/messages

---

## Implicaciones para `/api/onboarding/start`

### ✅ Lo que SÍ necesitamos persistir:

```typescript
// 1. Project
{ 
  name: 'My First Project',
  account_id: user.id,  // ← único lugar donde va account_id
  status: 'active' 
}

// 2. Team
{ 
  project_id: project.id,
  name: 'Main Team',
  type: 'SAT',
  parent_id: null 
}

// 3. Workspace
{ 
  team_id: team.id,
  name: 'First workspace',
  lock_state: 'unlocked' 
}

// 4. Agent sessions (3 inserts)
[
  { 
    workspace_id: workspace.id,
    agent_role: 'manager',
    provider: 'Anthropic',  // del user_api_keys[0].provider
    model: 'claude-3-5-sonnet-20241022',
    config: null,
    description: null
  },
  { 
    workspace_id: workspace.id,
    agent_role: 'worker1',
    provider: 'Anthropic',
    model: 'claude-3-5-sonnet-20241022',
    config: null,
    description: null
  },
  { 
    workspace_id: workspace.id,
    agent_role: 'worker2',
    provider: 'Anthropic',
    model: 'claude-3-5-sonnet-20241022',
    config: null,
    description: null
  }
]

// 5. Message inicial (user)
{ 
  session_id: managerSession.id,
  role: 'user',
  content: initialIntent  // texto del textarea
}
```

### ❌ Lo que NO necesitamos:
- `account_id` en teams/workspaces/agent_sessions/messages — validado via RLS
- `agent_label` — se deriva de `agent_role` en frontend
- `team_id` en agent_sessions — se obtiene via join a workspaces
- `workspace_id` en messages como columna física — se deriva de session_id → workspace_id

---

## Verificación final de types.ts

```typescript
// src/lib/db/types.ts

export interface AgentSession {
  id: string
  workspace_id: string      // ✅ existe
  agent_role: AgentRole     // ✅ existe ('manager' | 'worker1' | 'worker2')
  provider: string          // ✅ existe
  model: string             // ✅ existe
  config: Record<string, unknown> | null  // ✅ existe
  description: string | null              // ✅ existe (migración 018)
  created_at: string
  // ❌ agent_label — NO existe
  // ❌ team_id — NO existe
}

export interface Workspace {
  id: string
  team_id: string           // ✅ existe
  name: string              // ✅ existe
  lock_state: LockState     // ✅ existe ('unlocked' | 'locked')
  created_at: string
  // ❌ description — NO existe (solo name)
}

export interface Message {
  id: string
  session_id: string        // ✅ existe
  role: 'user' | 'assistant'  // ✅ existe
  content: string           // ✅ existe
  created_at: string
  attachment_metadata?: ... // ✅ existe (migración 022)
  // ❌ workspace_id como columna — NO existe (se deriva del join)
}
```

---

## SQL de creación completo (para onboarding backend)

```typescript
// Paso 1: Crear project
const { data: project } = await supabase
  .from('projects')
  .insert({
    name: 'My First Project',
    account_id: user.id,
    status: 'active',
  })
  .select('id')
  .single()

// Paso 2: Crear team
const { data: team } = await supabase
  .from('teams')
  .insert({
    project_id: project.id,
    name: 'Main Team',
    type: 'SAT',
    parent_id: null,
  })
  .select('id')
  .single()

// Paso 3: Crear workspace
const { data: workspace } = await supabase
  .from('workspaces')
  .insert({
    team_id: team.id,
    name: 'First workspace',
    lock_state: 'unlocked',
  })
  .select('id')
  .single()

// Paso 4: Crear 3 agent sessions
const { data: sessions } = await supabase
  .from('agent_sessions')
  .insert([
    {
      workspace_id: workspace.id,
      agent_role: 'manager',
      provider: defaultProvider,
      model: defaultModel,
      config: null,
      description: null,
    },
    {
      workspace_id: workspace.id,
      agent_role: 'worker1',
      provider: defaultProvider,
      model: defaultModel,
      config: null,
      description: null,
    },
    {
      workspace_id: workspace.id,
      agent_role: 'worker2',
      provider: defaultProvider,
      model: defaultModel,
      config: null,
      description: null,
    },
  ])
  .select('id, agent_role')

const managerSession = sessions.find(s => s.agent_role === 'manager')

// Paso 5: Insertar mensaje inicial
await supabase.from('messages').insert({
  session_id: managerSession.id,
  role: 'user',
  content: initialIntent,
})

// Paso 6: Marcar onboarding completado
await supabase
  .from('accounts')
  .update({ onboarding_completed: true })
  .eq('id', user.id)
```

---

## Checklist de verificación pre-implementación

- [x] ✅ Schema de tables confirmado (001_hierarchy.sql)
- [x] ✅ RLS policies confirmadas (sin account_id en teams/workspaces/agent_sessions)
- [x] ✅ Types de TypeScript confirmados (src/lib/db/types.ts)
- [x] ✅ Route de teams revisado (pattern de insert correcto)
- [x] ❌ `agent_label` NO existe como columna — derivar de `agent_role`
- [x] ❌ `team_id` en agent_sessions NO existe — obtener via join
- [x] ❌ `description` en workspaces NO existe — usar `name`
- [ ] ⚠️ Verificar si migración 026 (Vault) está aplicada en producción
- [ ] ⚠️ Confirmar que `/api/settings/keys` devuelve array con provider correcto

---

## Decisión final: workspace.name

**Opciones:**
1. Usar nombre hardcoded: `"First workspace"`
2. Derivar del intent: `"Workspace: ${initialIntent.slice(0, 50)}..."`
3. Usar nombre genérico: `"Main Workspace"`

**Recomendación:** **Opción 3** — "Main Workspace"
- Consistente con UX de TeamsMap
- No requiere parsing del initialIntent
- Familiar para usuarios (patrón de "Main Team" ya usado)

---

## Provider y model defaults

```typescript
// Obtener provider del usuario
const { data: keys } = await supabase
  .from('user_api_keys')
  .select('provider')
  .eq('account_id', user.id)
  .limit(1)

const defaultProvider = keys[0]?.provider ?? 'Anthropic'

// Model por provider
const defaultModel = 
  defaultProvider === 'Anthropic' ? 'claude-3-5-sonnet-20241022' :
  defaultProvider === 'OpenAI'    ? 'gpt-4o' :
  defaultProvider === 'Google'    ? 'gemini-1.5-pro-latest' :
  defaultProvider === 'Groq'      ? 'llama-3.1-70b-versatile' :
  'claude-3-5-sonnet-20241022'  // fallback
```

**Nota:** Si el usuario tiene custom provider, no está en `user_api_keys` sino en `user_custom_providers` → chat-first solo soporta providers conocidos en MVP.
