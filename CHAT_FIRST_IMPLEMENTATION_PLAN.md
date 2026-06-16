# Chat-First Onboarding — Implementation Plan

**Origen:** Portación de `PageJ.tsx` de la demo (`C:\proyectos\AISync\MVP`)  
**Objetivo:** Onboarding guiado para usuario nuevo con validación de API key pre-flight  
**Estimación:** 2 sesiones

---

## Fase 1: Migración y UI (Sesión 1)

### 1.1 Migración 032 — Onboarding flag

**Archivo:** `supabase/migrations/032_onboarding_flag.sql`

```sql
-- Onboarding completion tracking
-- Required for Chat-First flow redirect logic

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

COMMENT ON COLUMN accounts.onboarding_completed IS
'Tracks whether user has completed Chat-First onboarding flow.
New users (false) are redirected to /start.
Users who complete onboarding or skip it are marked true.';
```

**Aplicación:** Manual en Supabase SQL Editor después del deploy

---

### 1.2 Página `/start` — Chat-First UI

**Archivo:** `src/app/(main)/start/page.tsx`

**Estructura base:**
```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatFirstClient from '@/components/onboarding/ChatFirstClient'
import AppLayout from '@/components/layout/AppLayout'

export default async function ChatFirstPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check if already completed
  const { data: account } = await supabase
    .from('accounts')
    .select('onboarding_completed')
    .eq('id', user.id)
    .single()

  if (account?.onboarding_completed) {
    redirect('/') // Ya completó onboarding → dashboard
  }

  return (
    <AppLayout
      pageName="START"
      pageSubtitle="Chat-First — begin with the General Manager"
    >
      <ChatFirstClient />
    </AppLayout>
  )
}
```

---

### 1.3 Componente ChatFirstClient

**Archivo:** `src/components/onboarding/ChatFirstClient.tsx`

**Portar de:** `C:\proyectos\AISync\MVP\src\pages\PageJ.tsx`

**Diferencias clave vs demo:**

| Aspecto | Demo | MVP |
|---------|------|-----|
| **State management** | `useApp()` context | Local state + fetch |
| **Validation** | Solo textarea vacío | + Validar API key |
| **Action** | Mock dispatch | `POST /api/onboarding/start` |
| **Navigation** | `pushState` | `router.push('/workspace/[id]')` |
| **Messages** | Mock en memoria | Persistir en DB via API |

**Estructura completa:**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const structureItems = [
  { label: 'Project context', value: 'Your first AISync project' },
  { label: 'Team base', value: 'One General Manager and two workers ready to begin.' },
  { label: 'General Manager', value: 'Your entry point for defining and organizing the work.' },
  { label: 'Worker 1', value: 'Available when the work needs execution support.' },
  { label: 'Worker 2', value: 'Available when the work needs documentation support.' },
]

export default function ChatFirstClient() {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [validationMessage, setValidationMessage] = useState('')
  const [isStarting, setIsStarting] = useState(false)
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)

  const startWithGeneralManager = async () => {
    const initialIntent = message.trim()

    if (!initialIntent) {
      setValidationMessage('Please describe your goal before starting.')
      return
    }

    setValidationMessage('')
    setIsStarting(true)

    // Pre-flight: validar API key
    const keysRes = await fetch('/api/settings/keys')
    const keys = await keysRes.json()
    
    if (!Array.isArray(keys) || keys.length === 0) {
      setShowApiKeyModal(true)
      setIsStarting(false)
      return
    }

    // Crear estructura completa
    try {
      const res = await fetch('/api/onboarding/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialIntent }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => null)
        setValidationMessage(error?.error ?? 'Failed to start workspace.')
        setIsStarting(false)
        return
      }

      const { workspaceId } = await res.json()
      router.push(`/workspace/${workspaceId}`)
    } catch {
      setValidationMessage('Network error. Please try again.')
      setIsStarting(false)
    }
  }

  return (
    <>
      {/* 3-column layout — portar de PageJ.tsx */}
      <div className="app-page-shell h-full min-h-0 bg-[#eef2f5] px-2 py-2 sm:px-3 sm:py-3">
        <div className="mx-auto grid h-full min-h-0 w-full max-w-[1600px] gap-3 lg:grid-cols-[240px_minmax(0,1fr)_260px] xl:grid-cols-[260px_minmax(0,1fr)_280px]">
          
          {/* Left sidebar — structure info */}
          <aside className="ui-surface hidden lg:flex lg:flex-col rounded-[16px] bg-white/72 px-4 py-4 shadow-sm">
            {/* ... portar estructura de PageJ ... */}
          </aside>

          {/* Center — main textarea + button */}
          <main className="ui-surface rounded-[16px] bg-white shadow-md">
            {/* ... portar main panel de PageJ ... */}
          </main>

          {/* Right sidebar — what happens next */}
          <aside className="ui-surface hidden lg:block rounded-[16px] bg-white/56 px-4 py-4">
            {/* ... portar right sidebar de PageJ ... */}
          </aside>

        </div>
      </div>

      {/* Modal API Key */}
      {showApiKeyModal && (
        <ApiKeyRequiredModal 
          onClose={() => setShowApiKeyModal(false)}
          onGoToSettings={() => router.push('/settings')}
        />
      )}
    </>
  )
}
```

---

### 1.4 Modal de API key requerida

**Archivo:** `src/components/onboarding/ApiKeyRequiredModal.tsx`

```tsx
'use client'

interface Props {
  onClose: () => void
  onGoToSettings: () => void
}

export default function ApiKeyRequiredModal({ onClose, onGoToSettings }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900">
          API key required
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Before you can start working with AISync, you need to configure at least 
          one AI provider API key. AISync uses your own API keys — we don't charge 
          for AI usage.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onGoToSettings}
            className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700"
          >
            Go to Settings
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## Fase 2: Backend y Auto-creation (Sesión 2)

### 2.1 API route — Onboarding start

**Archivo:** `src/app/api/onboarding/start/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface OnboardingPayload {
  initialIntent: string
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { initialIntent }: OnboardingPayload = await req.json()

  if (!initialIntent?.trim()) {
    return NextResponse.json(
      { error: 'Initial intent is required.' },
      { status: 400 }
    )
  }

  // ── Step 1: Verificar API key ────────────────────────────────────────────
  const { data: keys } = await supabase
    .from('user_api_keys')
    .select('provider')
    .eq('account_id', user.id)
    .limit(1)

  if (!keys || keys.length === 0) {
    return NextResponse.json(
      { error: 'No API key configured. Add your key in Settings → Providers.' },
      { status: 400 }
    )
  }

  // ── Step 2: Crear Project ────────────────────────────────────────────────
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      name: 'My First Project',
      account_id: user.id,
      status: 'active',
    })
    .select('id')
    .single()

  if (projectError || !project) {
    return NextResponse.json(
      { error: 'Failed to create project.' },
      { status: 500 }
    )
  }

  // ── Step 3: Crear Team SAT ───────────────────────────────────────────────
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .insert({
      name: 'Main Team',
      type: 'SAT',
      project_id: project.id,
      account_id: user.id,
    })
    .select('id')
    .single()

  if (teamError || !team) {
    return NextResponse.json(
      { error: 'Failed to create team.' },
      { status: 500 }
    )
  }

  // ── Step 4: Crear Workspace ──────────────────────────────────────────────
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({
      description: 'First workspace',
      team_id: team.id,
      account_id: user.id,
      locked: false,
    })
    .select('id')
    .single()

  if (workspaceError || !workspace) {
    return NextResponse.json(
      { error: 'Failed to create workspace.' },
      { status: 500 }
    )
  }

  // ── Step 5: Crear 3 agent sessions (manager + 2 workers) ────────────────
  const defaultProvider = keys[0].provider // Usar el provider que tiene key
  const defaultModel = defaultProvider === 'Anthropic' 
    ? 'claude-3-5-sonnet-20241022' 
    : 'gpt-4o'

  const sessions = [
    { agent_role: 'manager', agent_label: 'AI General Manager' },
    { agent_role: 'worker1', agent_label: 'Worker 1' },
    { agent_role: 'worker2', agent_label: 'Worker 2' },
  ]

  const { data: createdSessions, error: sessionsError } = await supabase
    .from('agent_sessions')
    .insert(
      sessions.map((s) => ({
        workspace_id: workspace.id,
        team_id: team.id,
        account_id: user.id,
        agent_role: s.agent_role,
        agent_label: s.agent_label,
        provider: defaultProvider,
        model: defaultModel,
      }))
    )
    .select('id, agent_role')

  if (sessionsError || !createdSessions) {
    return NextResponse.json(
      { error: 'Failed to create agent sessions.' },
      { status: 500 }
    )
  }

  const managerSession = createdSessions.find((s) => s.agent_role === 'manager')

  if (!managerSession) {
    return NextResponse.json(
      { error: 'Manager session not found.' },
      { status: 500 }
    )
  }

  // ── Step 6: Insertar primer mensaje del usuario ─────────────────────────
  const { error: userMsgError } = await supabase.from('messages').insert({
    session_id: managerSession.id,
    workspace_id: workspace.id,
    account_id: user.id,
    role: 'user',
    content: initialIntent,
  })

  if (userMsgError) {
    return NextResponse.json(
      { error: 'Failed to save initial message.' },
      { status: 500 }
    )
  }

  // ── Step 7: Generar respuesta del manager via chat API ──────────────────
  // Nota: esto dispara la llamada real al provider
  const chatRes = await fetch(`${req.url.split('/api')[0]}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: req.headers.get('Cookie') ?? '', // Propagar auth cookies
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: initialIntent }],
      provider: defaultProvider,
      model: defaultModel,
      agentRole: 'manager',
      team_id: team.id,
      panel_id: managerSession.id,
      session_id: managerSession.id,
      workspace_id: workspace.id,
      project_id: project.id,
    }),
  })

  if (!chatRes.ok) {
    // No bloqueante — el workspace ya está creado
    console.error('[onboarding] Failed to generate manager response')
  } else {
    // Stream la respuesta y persistirla
    // (Simplificación MVP: el frontend hará el fetch de mensajes al cargar)
  }

  // ── Step 8: Marcar onboarding completado ─────────────────────────────────
  await supabase
    .from('accounts')
    .update({ onboarding_completed: true })
    .eq('id', user.id)

  return NextResponse.json({ workspaceId: workspace.id })
}
```

---

### 2.2 Redirect logic en dashboard

**Modificar:** `src/app/page.tsx`

```typescript
export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── Check onboarding status ────────────────────────────────────────────
  const { data: account } = await supabase
    .from('accounts')
    .select('name, email, role, onboarding_completed')
    .eq('id', user.id)
    .single()

  if (!account?.onboarding_completed) {
    redirect('/start') // Usuario nuevo → Chat-First
  }

  // ── Dashboard normal para usuarios con onboarding completado ───────────
  const projects = await getProjectsWithHierarchy()
  const userName = account.name ?? user.email?.split('@')[0]

  return (
    <AppLayout pageName="DASHBOARD" pageSubtitle="Your projects and activity" userName={userName}>
      {/* ... dashboard normal ... */}
    </AppLayout>
  )
}
```

---

### 2.3 Botón "Skip onboarding" (opcional)

**En ChatFirstClient.tsx:**

```tsx
const skipOnboarding = async () => {
  await fetch('/api/onboarding/skip', { method: 'POST' })
  router.push('/')
}

// En UI:
<button onClick={skipOnboarding} className="text-sm text-gray-500 underline">
  Skip and go to dashboard
</button>
```

**Nuevo route:** `src/app/api/onboarding/skip/route.ts`

```typescript
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  await supabase
    .from('accounts')
    .update({ onboarding_completed: true })
    .eq('id', user.id)

  return NextResponse.json({ success: true })
}
```

---

## Fase 3: Testing y validación

### Checklist de pruebas:

- [ ] Usuario nuevo sin API key → redirect a `/start`
- [ ] `/start` muestra modal "API key required" al submit
- [ ] Usuario configura API key en Settings
- [ ] Vuelve a `/start` y describe goal
- [ ] Submit crea Project + Team + Workspace + 3 sessions
- [ ] Navega al workspace con primer mensaje visible
- [ ] Manager responde correctamente (llamada real a provider)
- [ ] Flag `onboarding_completed` marcado como `true`
- [ ] Usuario con onboarding completado va directo al dashboard
- [ ] Botón "Skip" funciona y marca flag

### Testing en local (con migración 026 pendiente):

- ⚠️ Guardar API key puede dar 500 hasta aplicar 026
- Workaround temporal: aplicar 026 en local primero o usar .env.local keys

---

## Fase 4: Deploy y migración en producción

### Orden de ejecución:

1. Deploy código de Chat-First a Vercel
2. **Aplicar migración 026 (Vault)** en Supabase production
3. **Aplicar migración 032 (onboarding flag)** en Supabase production
4. Verificar en cuenta de prueba:
   - Crear usuario nuevo
   - Validar redirect a `/start`
   - Completar flujo completo
5. Backfill de `onboarding_completed = true` para usuarios existentes:
   ```sql
   UPDATE accounts SET onboarding_completed = true WHERE created_at < '2026-06-15';
   ```

---

## Alternativas consideradas y descartadas

| Alternativa | Motivo de descarte |
|-------------|-------------------|
| Modal wizard multi-step | Más fricción que Chat-First; requiere clicks adicionales |
| Validación reactiva en workspace vacío | Trata síntoma, no causa; no elimina fricción de setup manual |
| Dashboard empty state mejorado | No resuelve el gap de "cómo empezar"; solo informa |
| Auto-crear estructura al primer login | Sin validación de API key → estructura inútil sin keys |
| Skip onboarding por defecto | Genera confusión; mejor guiar al usuario nuevo |

---

## Decisiones de producto

### ¿Qué pasa con usuarios que ya tienen proyectos?

- Si `onboarding_completed = false` pero tienen proyectos → marcar como completado automáticamente en próximo login
- Lógica adicional en `page.tsx`:
  ```typescript
  if (!account?.onboarding_completed && projects.length > 0) {
    await supabase.from('accounts').update({ onboarding_completed: true }).eq('id', user.id)
  }
  ```

### ¿Permitir múltiples onboardings?

- No — el flag es permanente
- Si usuario quiere crear otro proyecto, lo hace desde dashboard normalmente

### ¿Qué provider por defecto si tiene múltiples keys?

- Usar el primero que aparezca en `user_api_keys` (ordenado por `created_at`)
- Preferencia futura: permitir selección en `/start` (dropdown "Choose your AI provider")

---

## Métricas de éxito

Post-implementación:

- % usuarios que completan onboarding vs abandonan
- Tiempo promedio signup → primer mensaje enviado
- % errores 400 "No API key" (debería ser ~0% con Chat-First)
- % usuarios que usan "Skip" vs completan flujo
