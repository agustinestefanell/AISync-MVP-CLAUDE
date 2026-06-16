# BYOK User Flow Audit — Usuario nuevo sin API keys

**Fecha:** 2026-06-15  
**Alcance:** Mapeo completo del flujo de usuario nuevo que entra a AISync sin API keys configuradas

---

## 🎯 Resumen Ejecutivo

### Hallazgo principal:
Existe una **página Chat-First completa en la demo** (`PageJ.tsx`) que resuelve el 80% del problema de onboarding. No fue portada al MVP.

### Estado actual (sin onboarding):
- ❌ Usuario nuevo cae al dashboard vacío sin guía
- ❌ Debe crear Project → Team → Workspace manualmente
- ❌ Error de API key solo aparece DESPUÉS de enviar primer mensaje
- ✅ Error es claro y accionable cuando aparece

### Estado propuesto (con Chat-First):
- ✅ Usuario nuevo va directo a `/start` (página guiada)
- ✅ Describe su goal en textarea grande
- ✅ Validación de API key ANTES de crear estructura
- ✅ Submit crea Project + Team + Workspace automáticamente
- ✅ Llega al workspace funcional con primer mensaje ya enviado

### Componentes a portar:
1. **UI de PageJ.tsx** (3-column layout, textarea, sidebars informativos)
2. **Backend `/api/onboarding/start`** (crear estructura completa en una llamada)
3. **Migración 032** (`accounts.onboarding_completed` flag)
4. **Redirect logic** (si onboarding incompleto → `/start`)
5. **Validación pre-flight** de API key

### Esfuerzo estimado:
- **2 sesiones** (vs 1 sesión original de "BYOK verification")
- Sesión 1: Portar UI + migración + validación
- Sesión 2: Backend auto-create + redirect logic + testing

### Dependencias críticas:
- ⚠️ **Migración 026 (Vault) DEBE aplicarse antes** — risk de 500 al guardar primera API key
- ⚠️ **Chat-First requiere llamada a `/api/chat`** — BYOK estricto ya implementado (SEC-006)

### Alternativas descartadas:
- Modal wizard multi-step → más fricción que Chat-First
- Validación reactiva en workspace vacío → trata síntoma, no causa
- Dashboard empty state mejorado → no resuelve fricción de setup manual

---

## 1. Estado actual del error handling

### 1.1 Chat API route — Error cuando no hay key
**Archivo:** `src/app/api/chat/route.ts:242-251`

```typescript
const resolved = await resolveProviderApiKey(supabase, user.id, provider)

if (!resolved) {
  return Response.json(
    {
      error: KNOWN_PROVIDERS.has(provider)
        ? `No API key configured for ${provider}. Add your key in Settings → Providers.`
        : `Provider "${provider}" not found. Configure it in Settings → Custom Providers.`,
    },
    { status: 400 }
  )
}
```

**Estado:** ✅ Error claro y accionable  
**Problema:** Solo se muestra DESPUÉS de que el usuario intenta enviar un mensaje

### 1.2 Resolución de API keys — Orden de fallback
**Archivo:** `src/lib/providers/resolveApiKey.ts`

**Orden actual:**
1. Provider custom → `user_custom_providers` (Vault primero, plaintext legacy fallback)
2. Provider conocido → Vault RPC (`get_provider_key`)
3. Fallback legacy → `user_api_keys.api_key` (plaintext)
4. **Solo en development** → `ENV_KEYS` de plataforma
5. Sin key → `return null` (dispara el error 400)

**Estado:** ✅ BYOK estricto implementado (SEC-006)  
**Diferencia dev vs prod:**
- Development: fallback a ENV_KEYS (Anthropic/OpenAI/Google desde .env.local)
- Production: sin fallback → error 400 accionable

---

## 2. Flujo de usuario nuevo — Paso a paso

### Escenario A: Flujo actual (sin onboarding)

| Paso | Pantalla | Estado actual | Gap detectado |
|------|----------|---------------|---------------|
| 1 | Login / Sign up | ✅ Supabase Auth funcional | — |
| 2 | Dashboard (sin proyectos) | ✅ Empty state: "There are no projects yet." | No menciona API keys |
| 3 | Usuario crea primer proyecto | ✅ Modal "New Project" funcional | — |
| 4 | Usuario crea primer team | ✅ Modal "Add Team" funcional | — |
| 5 | Usuario abre workspace | ✅ Workspace carga sin API key | — |
| 6 | Usuario intenta enviar mensaje | ❌ Error 400: "No API key configured for Anthropic. Add your key in Settings → Providers." | Error aparece solo después de submit |
| 7 | Usuario va a Settings → Providers | ✅ Página existe (`/settings`) | — |
| 8 | Usuario agrega API key | ✅ `ApiKeysManager` funcional | — |
| 9 | Usuario vuelve al workspace y envía mensaje | ✅ Funciona correctamente | — |

### Escenario B: Flujo propuesto (Chat-First onboarding — existe en demo)

| Paso | Pantalla | Estado propuesto | Ventaja |
|------|----------|------------------|---------|
| 1 | Login / Sign up | ✅ Supabase Auth funcional | — |
| 2 | Redirect a `/start` | Nueva página (portar de `PageJ.tsx` demo) | Guía inmediata, no dashboard vacío |
| 3 | Validación de API key | Si no hay key → modal "Configure your API key first" | Previene crear estructura sin poder usarla |
| 4 | Usuario va a Settings → Providers | Link directo desde modal | Path accionable |
| 5 | Usuario vuelve a `/start` y describe goal | Textarea grande + "Start with the General Manager" | UX natural, describe intent antes de estructura |
| 6 | Submit crea todo automáticamente | Backend: crear Project + Team + Workspace + 3 sessions | Elimina fricción de setup manual |
| 7 | Navega a workspace con primer mensaje | Workspace funcional desde el inicio | Usuario productivo inmediatamente |

### Gaps identificados:

1. ✅ **Solucionado con Chat-First:** Validación proactiva de API key antes de crear estructura
2. ✅ **Solucionado con Chat-First:** Onboarding guiado con copy claro ("Start your project with the General Manager")
3. ⚠️ **Parcialmente solucionado:** Empty state del dashboard (si usuario skipea onboarding o crea segundo proyecto)
4. ✅ **Solucionado con Chat-First:** No hay workspace vacío — el primer mensaje ya está enviado al llegar

---

## 3. Análisis de componentes clave

### 3.1 Settings — API Keys Manager
**Archivo:** `src/components/settings/ApiKeysManager.tsx`

**Providers soportados:**
- Anthropic (orange)
- OpenAI (green)
- Google (blue)
- Groq (amber)

**UI actual:**
- Cards por provider con input de API key
- Hint text: "Get your API key at console.anthropic.com"
- Masked display de keys guardadas (last 4 chars)
- Botones Save / Delete

**Estado:** ✅ Funcional  
**Gap:** No hay indicador de "required" o "you need at least one provider"

### 3.2 Setup Guide
**Archivo:** `src/components/settings/SetupGuide.tsx`

**Estado:** ✅ Existe  
**Gap:** No verificado si este componente se muestra en el flujo actual

### 3.3 Workspace — Agent Panel
**Archivo:** `src/components/workspace/AgentPanel.tsx`

**Estado actual:**
- Panel carga sin validación de API key
- Usuario puede escribir mensaje
- Error solo aparece al recibir respuesta del POST /api/chat

**Gap:** No hay validación preventiva antes de submit

---

## 4. Errores posibles — Matriz completa

| Escenario | Error actual | Status | Mensaje accionable? |
|-----------|--------------|--------|---------------------|
| Usuario sin key para provider conocido | `No API key configured for ${provider}. Add your key in Settings → Providers.` | 400 | ✅ Sí |
| Usuario sin key para provider custom | `Provider "${provider}" not found. Configure it in Settings → Custom Providers.` | 400 | ✅ Sí |
| Rate limit excedido | `Too many requests. Please wait a moment before trying again.` | 429 | ✅ Sí |
| Usuario no autenticado | `Unauthorized.` | 401 | ⚠️ Genérico |
| Vault secret no encontrado (migración 026 no aplicada) | _(No rompe — fallback a plaintext legacy)_ | — | — |
| Guardar key con migración 026 pendiente | 500 (ventana conocida) | 500 | ❌ No — error técnico |

---

## 5. Comparación: Development vs Production

### Development (`NODE_ENV === 'development'`)
- Fallback a `ENV_KEYS` activo
- Usuario puede enviar mensajes sin configurar nada (usa keys del .env.local)
- **Efecto:** El flujo de "usuario sin keys" NO se prueba en local

### Production (`NODE_ENV === 'production'`)
- Sin fallback a ENV_KEYS
- Usuario DEBE configurar su propia API key
- **Efecto:** Error 400 garantizado si no hay key

**Consecuencia:** El gap de UX (falta de validación proactiva) es más crítico en producción

---

## 6. Recomendaciones — Bloque 2 (BYOK verification)

### 6.1 Validación proactiva en Workspace
**Prioridad:** Alta  
**Dónde:** `AgentPanel.tsx` — antes de habilitar el input

**Opción 1 (preventivo):**
- Deshabilitar input si no hay API key para el provider del panel
- Mostrar banner: "Configure your Anthropic API key in Settings to start chatting"
- Link directo a `/settings`

**Opción 2 (reactivo mejorado):**
- Mantener input habilitado
- Interceptar error 400 con pattern "No API key configured"
- Mostrar modal con botón directo a Settings (no solo toast)

### 6.2 Dashboard — Empty state mejorado
**Prioridad:** Media  
**Dónde:** `ProjectList.tsx:300`

**Modificación:**
```
There are no projects yet.

Before you start:
1. Configure at least one AI provider in Settings
2. Create your first project
3. Add teams and start working
```

### 6.3 Onboarding mínimo — Chat-First approach
**Prioridad:** Alta (existe en demo, no portado)  
**Dónde:** Nueva página `/start` o `/chat-first` (basado en `PageJ.tsx` de la demo)

**Flujo detectado en demo:**
1. Página "Chat-First Preview" con textarea grande
2. Título: "Start your project with the General Manager"
3. Usuario describe goal/task en el textarea
4. Botón: "Start with the General Manager"
5. Action: crea workspace con manager + 2 workers automáticamente
6. Lleva directo al workspace (Page A) con primer mensaje del usuario + respuesta simulada del manager

**Adaptación para MVP:**
1. Detectar primer login (flag en `accounts.onboarding_completed`)
2. Redirect automático a `/start` (en vez de dashboard vacío)
3. UI de PageJ.tsx:
   - Left sidebar: "Project structure" (muestra que se creará 1 GM + 2 Workers)
   - Center: Textarea grande + botón "Start with the General Manager"
   - Right sidebar: "What happens next" + "How the team supports the work"
4. Al submit:
   - **Validación:** Si no hay API key configurada → modal "Configure your API key first" con link a Settings
   - Si hay key → crear Project + Team + Workspace + 3 sessions automáticamente
   - Navegar a `/workspace/[id]` con primer mensaje ya enviado
5. Flag `onboarding_completed = true` para no volver a mostrar esta página

**Ventajas:**
- Resuelve el gap de "usuario sin estructura" — se crea automáticamente
- Resuelve el gap de "validación de API key" — se valida ANTES de crear estructura
- UX onboarding natural: usuario describe goal → sistema prepara todo → empieza a trabajar
- Ya existe en demo — solo portar y adaptar

### 6.4 Settings — Indicador de "at least one required"
**Prioridad:** Baja  
**Dónde:** `ApiKeysManager.tsx`

**Modificación:**
- Badge "At least one provider required" en el header
- Highlight visual si ningún provider tiene key guardada

---

## 7. Textos residuales en español

**Detectados en:**
- `ApiKeysManager.tsx:20` — `hint: 'Empieza con sk-…'` (OpenAI)

**Pendiente:** Audit completo de strings residuales (Bloque 2 — PRODUCT_STATUS.md)

---

## 8. Migración 026 — Estado de API key encryption

**Estado:** ⏳ Pendiente de aplicación manual en Supabase  
**Impacto en UX:**
- **Antes de 026:** Guardar keys funciona normal (plaintext)
- **Entre 026 y backfill:** Dual-read (Vault primero, plaintext fallback)
- **Ventana conocida:** Guardar keys nuevas da 500 hasta aplicar la 026

**Consecuencia para BYOK verification:**
- Si se implementa validación proactiva ANTES de aplicar 026 → risk de 500 al guardar key
- Recomendación: aplicar 026 ANTES de implementar Bloque 2

---

## 9. Casos edge detectados

### 9.1 Usuario crea workspace pero no tiene team con agents configurados
**Estado:** No verificado  
**Riesgo:** Workspace vacío sin panels

### 9.2 Usuario tiene key guardada pero es inválida (revocada, typo)
**Estado:** Error del provider (401/403)  
**Handling actual:** Error genérico del stream  
**Gap:** No se distingue entre "no key" vs "invalid key"

### 9.3 Usuario en plan free sin créditos (futuro)
**Estado:** N/A (MVP no tiene billing)  
**Nota:** BYOK evita este problema — el usuario paga directo al provider

---

## 10. Métricas sugeridas (post-implementación)

- % usuarios que completan onboarding vs abandonan en step 1 (API keys)
- Tiempo promedio entre signup → primer mensaje enviado
- % errores 400 por "No API key" antes vs después de mejoras UX
- % usuarios que configuran >1 provider

---

## 11. Próximos pasos (Bloque 2)

**Orden recomendado (actualizado con Chat-First discovery):**

### Fase 1: Pre-requisitos (antes de implementar Chat-First)
1. ✅ Aplicar migración 026 en Supabase (eliminar risk de 500 al guardar keys)
2. Traducir textos residuales en español (`ApiKeysManager.tsx:20` — "Empieza con sk-…")

### Fase 2: Chat-First onboarding (alta prioridad — ya existe en demo)
3. **Portar PageJ.tsx** de la demo como `/start` o `/chat-first`
   - UI completa: left sidebar (structure), center (textarea + button), right sidebar (what happens next)
   - Adaptaciones:
     - Validación de API key ANTES de `startWithGeneralManager()`
     - Backend: crear Project + Team + Workspace + 3 sessions automáticamente
     - Navegar a workspace real (no mock)
4. **Migración 032: `accounts.onboarding_completed`** (boolean default false)
5. **Redirect lógico:**
   - Si `onboarding_completed = false` → redirect a `/start`
   - Si `onboarding_completed = true` → dashboard normal
6. **Botón "Skip" opcional** (lleva al dashboard, marca `onboarding_completed = true`)

### Fase 3: Validaciones complementarias
7. Implementar validación preventiva en Workspace para usuarios que skipean onboarding (Opción 1: deshabilitar input + banner)
8. Mejorar empty state del Dashboard (mencionar API keys como requisito)

### Fase 4: Error handling avanzado (post-MVP beta)
9. Audit completo de error handling por provider (invalid key vs no key)
10. Modal específico para "invalid API key" (distinguir de "no API key")

**Estimación Bloque 2:**  
- Original: 1 sesión  
- **Ajuste con Chat-First:** 2 sesiones
  - Sesión 1: Migración 026 + 032, traducción español, portar PageJ + validación API key
  - Sesión 2: Backend auto-create (Project/Team/Workspace/Sessions), validaciones complementarias

**Dependencias críticas:**
- Migración 026 DEBE estar aplicada antes de implementar Chat-First (riesgo de 500 al guardar primera API key)

---

## 12. Análisis técnico — PageJ.tsx (Chat-First de la demo)

### Código fuente: `C:\proyectos\AISync\MVP\src\pages\PageJ.tsx`

**Componentes clave:**

1. **Left sidebar** (estructural — solo informativo)
   ```tsx
   structureItems = [
     { label: 'Project context', value: 'AISync Demo Project' },
     { label: 'Team base already created', value: 'One GM and two workers...' },
     { label: 'General Manager', value: 'Your entry point...' },
     { label: 'Worker 1', value: 'Available when...' },
     { label: 'Worker 2', value: 'Available when...' },
   ]
   ```

2. **Center panel** (funcional)
   - Textarea: `placeholder="Describe your goal, task, or context..."`
   - Validación: `if (!initialIntent) setValidationMessage('Please describe your goal before starting.')`
   - Button: "Start with the General Manager" (disabled mientras `isStarting`)

3. **Right sidebar** (educacional)
   - Section 1: "What happens next"
   - Section 2: "How the team supports the work"

4. **Action handler** (`startWithGeneralManager()`)
   ```tsx
   const userMessage = createPreviewMessage('user', initialIntent, 'User');
   const managerMessage = createPreviewMessage('agent', 
     `I understand the goal: ${initialIntent}\n\n...`, 
     'AI General Manager'
   );
   
   // Simula navegación a Page A (Main Workspace)
   window.history.pushState({}, '', '/?page=A');
   dispatch({ type: 'START_CHAT_FIRST_WORKSPACE', userMessage, managerMessage });
   ```

### Adaptaciones necesarias para MVP:

| Aspecto | Demo | MVP adaptado |
|---------|------|--------------|
| **Ruta** | `/?page=J` | `/start` o `/chat-first` |
| **Validación inicial** | Solo valida que textarea no esté vacío | **+ Validar API key:** `fetch('/api/settings/keys')` → si empty → modal |
| **Creación de estructura** | Mock dispatch (`START_CHAT_FIRST_WORKSPACE`) | **Backend real:** `POST /api/onboarding/start` → crea Project/Team/Workspace/Sessions |
| **Navegación** | `pushState('/?page=A')` | `router.push('/workspace/[id]')` con workspace_id real |
| **Mensajes iniciales** | Mock messages en contexto React | **Persistir en DB:** `messages` table con primer user message + manager response |
| **Manager response** | Hardcoded template | **Llamar a API real:** `POST /api/chat` con el `initialIntent` |
| **Onboarding flag** | No existe | **Marcar completado:** `PATCH /api/accounts` → `onboarding_completed = true` |

### Nuevos endpoints requeridos:

1. **`POST /api/onboarding/start`**
   - Input: `{ initialIntent: string }`
   - Validación: usuario autenticado + API key configurada
   - Acción:
     1. Crear Project (nombre: "My First Project" o derivado de `initialIntent`)
     2. Crear Team SAT (1 GM + 2 Workers, provider default Anthropic)
     3. Crear Workspace
     4. Crear 3 agent_sessions (manager, worker1, worker2)
     5. Insertar primer mensaje del usuario en `messages`
     6. **Llamar a chat API** para generar respuesta del manager
     7. Marcar `accounts.onboarding_completed = true`
   - Output: `{ workspaceId: string }`

2. **`GET /api/onboarding/status`**
   - Output: `{ completed: boolean, hasApiKey: boolean }`
   - Usado en middleware para decidir redirect

### Migración requerida:

```sql
-- 032_onboarding_flag.sql
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

COMMENT ON COLUMN accounts.onboarding_completed IS
'Tracks whether user has completed Chat-First onboarding. 
Used to redirect first-time users to /start instead of dashboard.';
```

### Middleware de redirect:

```typescript
// src/middleware.ts o en page.tsx
const { data: account } = await supabase
  .from('accounts')
  .select('onboarding_completed')
  .eq('id', user.id)
  .single();

if (!account?.onboarding_completed) {
  redirect('/start');
}
```

### UI tokens a portar de PageJ:

- `rounded-[16px]` — cards de estructura
- `bg-[#eef2f5]` — fondo de página
- `shadow-xl shadow-slate-900/10` — sombra del panel central
- `text-[clamp(1.35rem,2.05vw,2.35rem)]` — título responsive
- Layout grid: `lg:grid-cols-[240px_minmax(0,1fr)_260px]`

### Copy a traducir/adaptar:

- Título: "Start your project with the General Manager" ✅ (ya en inglés)
- Placeholder: "Describe your goal, your task, or the context of your project." ✅
- Validation: "Please describe your goal before starting." ✅
- Button label: "Start with the General Manager" ✅
- Sidebars: ya en inglés, solo ajustar nombres de workers (Worker 1, Worker 2)

**Conclusión:** PageJ es 90% portable. Solo requiere:
- Backend `/api/onboarding/start` con creación real de estructura
- Validación de API key pre-flight
- Migración 032 para flag de onboarding
- Redirect logic en page.tsx principal
