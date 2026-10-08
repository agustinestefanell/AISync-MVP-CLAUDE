# AUDIT_LOCAL_DEPLOYMENT.md

**Fecha:** 2026-08-10
**Tipo:** Auditoría de solo lectura — sin cambios de código, sin commit.
**Objetivo:** Mapear el acoplamiento actual a Supabase Cloud / Vercel / Tavily de cara a una eventual Etapa 2 de despliegue local (self-hosted / air-gapped).
**Alcance:** Codebase completo (`src/`, `supabase/migrations/`, `package.json`, `.env.local`, `next.config.js`). No se tocó ningún archivo.

---

## Resumen ejecutivo

| Punto | Nivel de acoplamiento |
|---|---|
| 1. Supabase Cloud | Mayormente portable — un par de puntos de adaptación menor |
| 2. Vercel | Prácticamente nulo — no hay dependencia real |
| 3. ChatProvider / LocalProvider | Portable pero funcionalmente incompleto (no rediseño, sí trabajo) |
| 4. Tavily / Web Search | Aislado a 1 archivo, requiere adaptación menor en 5-6 puntos de UI |
| 5. Autenticación | Requiere rediseño si el objetivo es air-gapped real |
| 6. Variables de entorno | Inventario simple, 6 variables activas + 3 ausentes que ya son necesarias hoy |

Ningún hallazgo obliga a tocar `main` ni la app en producción — todo lo que sigue es diagnóstico para planificar la Etapa 2, no una lista de fixes urgentes.

---

## 1. SUPABASE CLOUD

### Client init (3 clientes separados, patrón correcto)
- `src/lib/supabase/client.ts` — `createBrowserClient` (`@supabase/ssr`), usa `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `src/lib/supabase/server.ts` — `createServerClient` (`@supabase/ssr`) con manejo de cookies, para Server Components / API routes.
- `src/lib/supabase/admin.ts` — `createClient` de `@supabase/supabase-js` con `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS, server-only).
- `src/middleware.ts` — mismo patrón `createServerClient`, protege rutas no públicas.
- `src/lib/supabase.ts` — barrel que re-exporta los dos primeros.

**Nivel: portable tal cual.** Los tres usan `@supabase/ssr` / `@supabase/supabase-js`, que hablan con Supabase por HTTP/Postgres estándar — funcionan igual contra una instancia self-hosted (Supabase CE) con solo cambiar `NEXT_PUBLIC_SUPABASE_URL` a la URL local. No hay ninguna llamada a un endpoint exclusivo de Supabase Cloud (no hay Management API, no hay dependencia del dashboard).

### RLS Policies
28 archivos de migración contienen `CREATE POLICY` / `ENABLE ROW LEVEL SECURITY` (de 52 migraciones totales). Es RLS de Postgres estándar (`auth.uid()`, `USING`, `WITH CHECK`).

**Nivel: portable tal cual.** RLS es una feature nativa de Postgres — Supabase Cloud y Supabase CE self-hosted corren el mismo motor Postgres con la misma extensión `pgjwt`/`auth` schema. Las 52 migraciones en `supabase/migrations/` se aplican igual en ambos entornos vía `supabase db push` o SQL directo.

### Realtime
Solo 3 archivos usan `supabase.channel()` + `postgres_changes`:
- `src/components/teams/TeamsClient.tsx` (línea ~181, canal `team-connections-realtime` sobre tabla `team_connections`)
- `src/components/ProjectList.tsx`
- `src/components/workspace/HumanChatPanel.tsx`

Los tres ya tienen **fallback de polling cada 15s** implementado junto al canal (`TeamsClient.tsx` línea 188: `setInterval(fetchConnections, 15000)` con el comentario explícito "in case realtime misses cross-account events") — esto ya reduce el riesgo de una falla silenciosa de Realtime.

**Hallazgo relevante:** ninguna migración contiene `ALTER PUBLICATION supabase_realtime ADD TABLE ...`. Esto significa que la tabla `team_connections` (y cualquier otra que dependa de Realtime) fue agregada a la publicación manualmente desde el dashboard de Supabase Cloud, **no** vía migración versionada.

**Nivel: requiere adaptación menor.** El contenedor `realtime` es parte del stack self-hosted de Supabase CE (docker-compose oficial lo incluye), así que la feature en sí es portable. Pero como el `ALTER PUBLICATION` no está en el repo, en una instancia local nueva Realtime no funcionará hasta que alguien lo configure a mano — mitigado hoy por el polling fallback, pero conviene versionar ese `ALTER PUBLICATION` en una migración antes de migrar.

### Storage
- `src/lib/storage/contextFiles.ts` — `supabase.storage.from('context-files').upload()` y `.createSignedUrl()`.
- `src/lib/context/deleteContextSource.ts` — mismo bucket, borrado.
- Bucket y policies **sí están versionados**: `supabase/migrations/017_context_sources.sql` líneas 49-75 — `INSERT INTO storage.buckets (...)` + `CREATE POLICY` sobre `storage.objects` (insert/select/delete, scoped por `auth.uid()` vía `storage.foldername(name)[1]`).

**Nivel: portable tal cual.** Storage API (`storage-api` container) es parte del stack self-hosted oficial de Supabase CE, y a diferencia de Realtime, la creación del bucket y sus RLS policies ya están en una migración SQL — se replican automáticamente al aplicar `017_context_sources.sql` en cualquier instancia nueva. El backend físico (filesystem local vs S3) es configurable en el `docker-compose.yml` de Supabase CE, sin cambios de código en la app.

### Vault (encriptación de API keys de usuario)
- `supabase/migrations/026_vault_api_keys.sql` (264 líneas) — funciones `SECURITY DEFINER` (`set_provider_key`, `get_provider_key`, y equivalentes para custom providers) que usan `vault.create_secret`, `vault.update_secret`, `vault.secrets` — schema `vault` (extensión `pgsodium`).
- Consumido desde `src/lib/providers/resolveApiKey.ts` vía `supabase.rpc('get_provider_key', ...)` / `get_custom_provider_key`, con fallback dual-read a texto plano en `user_api_keys.api_key` si el RPC no existe (comentario explícito: "si la migración 026 no está aplicada, todo cae a legacy sin romper").

**Nivel: requiere adaptación menor.** `pgsodium`/Vault está disponible en la imagen de Postgres que usa el stack self-hosted de Supabase CE, pero **no viene activada por defecto igual que en Cloud** — self-hosted requiere habilitar la extensión y configurar una root encryption key (`vault.secrets_key`) en el `docker-compose`/`.env` de la instancia Postgres. Si esa key no está seteada, las funciones de la migración 026 fallan y el sistema ya tiene el fallback a texto plano diseñado para ese caso — es decir, el propio código ya contempla el peor caso, pero conviene confirmarlo explícitamente antes de dar la migración por cerrada en el entorno local.

### Auth (cubierto en detalle en punto 5)
`supabase.auth.getUser()` (middleware), `signInWithOAuth()` (login), `exchangeCodeForSession()` (callback) — usa GoTrue, que es parte de CE self-hosted. El acoplamiento real no es a Supabase sino a los providers OAuth externos (Google/GitHub) — ver punto 5.

### Edge Functions
**No se encontró ningún uso.** No existe carpeta `supabase/functions/`. Cero acoplamiento en este punto — nada que migrar ni rediseñar.

---

## 2. VERCEL

Búsqueda exhaustiva de: `export const runtime`, `@vercel/kv`, `@vercel/blob`, `VERCEL_*`, `EdgeRuntime`, archivo `vercel.json` → **cero resultados en todo `src/`**, y no existe `vercel.json` en la raíz del repo.

`next.config.js` solo tiene configuración genérica de Next.js (`serverComponentsExternalPackages: ['@napi-rs/canvas']`, `outputFileTracingIncludes` para el módulo nativo de canvas usado en `/api/context`) — nada específico de Vercel.

**Nivel: portable tal cual — no hay dependencia real de Vercel.** La app es un Next.js estándar sin Edge Runtime, sin KV, sin Blob Storage, sin variables `VERCEL_*` leídas en código. El único ajuste esperable al migrar a un host propio (ej. Docker + Node) es reemplazar el output de Vercel por `next build && next start` o un adapter equivalente — trabajo de infraestructura, no de código de aplicación.

**Riesgo:** ninguno identificado para la Regla Cero. Este punto es el más simple de los seis.

---

## 3. CHATPROVIDER / LOCALPROVIDER

Arquitectura en `src/lib/providers/`: `types.ts` (interfaz `ChatProvider`), `index.ts` (registry/factory), y una clase por provider (`anthropic.ts`, `openai.ts`, `google.ts`, `local.ts`).

### Nivel real de aislamiento

`LocalProvider` (`src/lib/providers/local.ts`) reutiliza el SDK de `openai` apuntando a un `baseURL` custom (`http://localhost:11434/v1` por default, Ollama-style), con `apiKey: 'local'` como placeholder. Arquitectónicamente está bien aislado — no depende de Anthropic/OpenAI/Google en absoluto, solo comparte el cliente HTTP porque Ollama/LM Studio exponen una API compatible con OpenAI.

**Pero funcionalmente es la implementación más pobre de las cuatro** — comparado con `anthropic.ts`, `openai.ts` y `google.ts`:

| Capacidad | Anthropic | OpenAI | Google | **Local** |
|---|---|---|---|---|
| `stream()` | ✅ | ✅ | ✅ | ✅ |
| `complete()` (tool calling / function calling) | ✅ | ✅ | ✅ | ❌ **no implementado** |
| Captura de `TokenUsage` (`onUsage`) | ✅ | ✅ | ✅ | ❌ **no implementado** |
| Manejo de attachments (imágenes/PDFs) | ✅ | ✅ (solo imágenes) | ✅ | ❌ **ChatMessage se pasa tal cual — attachments se descartan silenciosamente** |
| Timeout configurable | usa default del SDK | usa default del SDK | usa default del SDK | usa default del SDK (`OpenAI` client, ~10 min) |
| Manejo de errores de conexión (servidor local caído/lento) | — | — | — | **ninguno** — sin try/catch, sin mensaje claro al usuario |

Consecuencia directa comprobada en `src/app/api/chat/route.ts` línea 320: el tool loop de Web Search (`if (webSearchEnabled && providerInstance.complete)`) **se salta automáticamente para IA Local** porque `complete` es `undefined` — no hay error visible, pero tampoco hay forma de que un agente con provider Local use `web_search` aunque el usuario active el toggle. Esto no está comunicado en la UI (el toggle "Web search: ON/OFF" en `AgentPanel.tsx` no distingue por provider).

### Qué falta concretamente para "robustecer" la conexión a IA local

1. **Manejo de errores** — si Ollama/LM Studio no está corriendo o el modelo no existe, hoy el error cruza tal cual desde el SDK de `openai` (mensaje técnico tipo `ECONNREFUSED` o 404) hasta el usuario final, sin traducción a un mensaje accionable (comparar con el patrón ya usado en `resolveApiKey.ts` para BYOK: error 400 accionable).
2. **Timeouts** — no hay timeout explícito; un modelo local colgado deja el request abierto indefinidamente en vez de fallar rápido con un mensaje claro.
3. **Streaming** — funciona (`stream()` implementado correctamente, mismo patrón `ReadableStream` que los otros tres), no requiere cambios.
4. **Formato de respuesta / attachments** — `LocalProvider` no transforma `ChatMessage.attachments` a `image_url` (como sí hace `openai.ts`) antes de mandarlo al cliente OpenAI-compatible — si un usuario adjunta una imagen a un agente Local, el adjunto se pierde sin aviso.
5. **Tool calling / `complete()`** — no implementado. Esto no solo bloquea Web Search: bloquea cualquier feature futura que dependa del tool loop genérico.
6. **Captura de `TokenUsage`** — no implementado, por lo que el consumo de tokens de un agente Local nunca aparece en `TokenUsageBadge.tsx` ni en el audit log de uso (aunque para modelos locales el "costo" es distinto, sigue siendo útil para observabilidad).

**Nivel: portable tal cual en su diseño (correctamente desacoplado de los providers cloud), pero requiere trabajo real de "hardening" antes de tratarlo como un provider de primera clase** — no es un problema de arquitectura, es una implementación deliberadamente mínima (el comentario en el archivo lo confirma: "Sirve tanto para IA Local... Si no se pasa apiKey usa 'local' como placeholder").

---

## 4. TAVILY / WEB SEARCH

### Punto de invocación real (uno solo)
`src/lib/tools/web-search.ts` — única llamada al SDK `@tavily/core`. Lee `process.env.TAVILY_API_KEY`, y si no está configurada **lanza una excepción** (`throw new Error('TAVILY_API_KEY not configured')`) — sin manejo gracioso, sin mensaje de UI dedicado.

### Puntos donde su presencia está asumida (aparte de la implementación)
1. **`src/lib/tools/index.ts`** — registry de tools (`toolRegistry = { web_search: webSearchTool }`); si se quisiera desactivar Tavily del todo, este es el punto central donde quitar/reemplazar la entrada.
2. **`src/app/api/chat/route.ts`** línea 320-333 — el tool loop llama `webSearchTool.definition` y ejecuta `getTool(call.name)` cuando el modelo decide invocar la tool. Si `TAVILY_API_KEY` falta, el error solo aparece en este punto, en tiempo de ejecución, después de que el LLM ya decidió usar la tool.
3. **`src/components/workspace/AgentPanel.tsx`** — toggle de UI "Web search: ON/OFF" por sesión de agente (línea ~350, ~800-820), y el system prompt inyecta `web_search_available_right_now: YES/NO` (líneas ~94-100) instruyendo al modelo qué decirle al usuario si está OFF. **El toggle está disponible siempre, independientemente de si `TAVILY_API_KEY` está configurada en el entorno** — no hay chequeo de disponibilidad real de la key antes de mostrar el botón.
4. **`src/lib/db/types.ts`** línea 49 — campo `web_search_enabled?: boolean` en el tipo de `agent_sessions` (persistido, columna agregada en `supabase/migrations/048_add_web_search_enabled_to_agent_sessions.sql`).
5. **`src/components/audit/AuditTimeline.tsx`** línea 138 — renderiza eventos `tool_call_executed` en el Audit Log mostrando `tool_name ?? 'web_search'` como fallback — asume que si no hay `tool_name` explícito, probablemente fue una llamada a `web_search` (es el único tool registrado hoy).

### Para desactivarlo sin romper nada
Los puntos 1-2 son los únicos con impacto funcional real. Con `TAVILY_API_KEY` ausente del `.env`, el sistema ya "casi" degrada solo — el toggle sigue visible y el usuario puede activarlo, pero cualquier intento de uso real falla con una excepción no capturada dentro del tool loop (no verificado el manejo exacto del error en el chat, pero no hay try/catch dedicado alrededor de `tool.execute()` en el fragmento revisado — **candidato a revisar antes de un despliegue sin Tavily**, para asegurar un mensaje de error legible en vez de un fallo genérico).

**Nivel: requiere adaptación menor.** Aislado a un solo archivo de implementación (bueno), pero con 5 puntos secundarios en UI/tipos/audit que asumen su existencia de forma soft (fallbacks, toggles sin chequeo de disponibilidad). Para un despliegue local sin acceso a internet, lo mínimo es: ocultar o deshabilitar el toggle cuando `TAVILY_API_KEY` no está configurada, y envolver `tool.execute()` en el chat route con un mensaje de error claro.

---

## 5. AUTENTICACIÓN

### Mecanismo actual
- `src/middleware.ts` — protege todas las rutas excepto `/login` y `/auth/*`, vía `supabase.auth.getUser()` (cookies, GoTrue).
- `src/app/login/page.tsx` — **únicamente dos opciones: `signInWithOAuth({ provider: 'google' })` y `signInWithOAuth({ provider: 'github' })`.** No hay login por email/password, no hay magic link, no hay ningún proveedor self-hosted.
- `src/app/auth/callback/route.ts` — `exchangeCodeForSession(code)`, y en el primer login crea la fila en `accounts` + un proyecto demo (`createDemoProject`).

### Qué tan atada está a servicios externos
- **GoTrue (motor de Auth de Supabase):** portable — es parte del stack self-hosted de Supabase CE, corre como contenedor propio, no depende de la nube de Supabase.
- **Los providers OAuth en sí (Google, GitHub):** **no son portables a un entorno air-gapped.** Cada login real hace un round-trip contra `accounts.google.com` / `github.com` — esto es una dependencia de red externa inherente al mecanismo de login elegido, no algo que resida "en Supabase". Ni self-hosting Supabase CE ni nada del lado de AISync cambia esto: sin salida a internet, **nadie puede iniciar sesión**, sin importar dónde corra el backend.

### Nivel: requiere rediseño (si el objetivo es air-gapped real)
Si la Etapa 2 apunta a un despliegue completamente aislado de internet, el login vía Google/GitHub OAuth es el bloqueante más duro de los seis puntos de esta auditoría — no es un tema de configuración, es un cambio de mecanismo. Las alternativas típicas (todas requieren trabajo de diseño, no solo config):
- Email + password (GoTrue lo soporta nativamente, solo falta la UI en `login/page.tsx`).
- Un proveedor OIDC/SAML propio, autohospedado en la misma red.
- Login "local" simplificado si el despliegue es de un solo usuario/instancia por cliente (dado el modelo 1 Account = 1 User = 1 Sovereign Cell de AISync, esto podría ser más simple que en un producto multi-tenant típico).

Si el despliegue local **sí tiene salida a internet** (self-hosted pero no air-gapped), este punto baja a "portable tal cual" — es la variable clave a confirmar con el usuario antes de dimensionar el trabajo real de Etapa 2.

---

## 6. VARIABLES DE ENTORNO

### Inventario actual (`.env.local`, 6 variables activas)

| Variable | Uso | Cloud-only / agnóstica / necesita equivalente local |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase (browser + server) | Agnóstica — solo cambia el valor a la URL de la instancia self-hosted |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key pública | Agnóstica — self-hosted Supabase CE genera su propia anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypass de RLS server-side (`admin.ts`) | Agnóstica — mismo mecanismo en self-hosted |
| `ANTHROPIC_API_KEY` | Fallback dev-only en `resolveApiKey.ts` (solo si `NODE_ENV=development`) | Agnóstica — sigue siendo válida en local (llama a la API cloud de Anthropic igual, con o sin Supabase Cloud) |
| `OPENAI_API_KEY` | Ídem, fallback dev-only | Agnóstica |
| `TAVILY_API_KEY` | Requerida para Web Search (ver punto 4) | Agnóstica, pero **requiere internet siempre** — no tiene equivalente "local" real (es un servicio de búsqueda web) |

### Variables referenciadas en código pero **ausentes** de `.env.local` hoy

| Variable | Dónde se usa | Impacto de que falte |
|---|---|---|
| `GOOGLE_AI_API_KEY` | `resolveApiKey.ts` línea 11 — fallback dev-only para provider Google | Sin esto, el fallback dev de Google simplemente no aplica (no rompe nada, solo hay que usar BYOK real) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | `Redis.fromEnv()` en `src/lib/rate-limit/upstash.ts` línea 25 (leídas implícitamente por el SDK de Upstash) | Rate limiting **ya está diseñado fail-open** (`upstash.ts` líneas 43-52: cualquier error de Upstash devuelve `success: true`) — sin estas vars, hoy en local el rate limiting simplemente no aplica, sin errores visibles. Para producción real (cloud o self-hosted) esto es una brecha de seguridad silenciosa, ya marcada como pendiente en el propio diseño |

**Nivel: portable tal cual.** No hay ninguna variable de entorno con nombre o valor exclusivo de Vercel (`VERCEL_*` no se usa, confirmado en punto 2). Todo el `.env` es agnóstico de dónde corre el backend — la única variable que **no tiene sentido en un entorno air-gapped** es `TAVILY_API_KEY`, porque el servicio que representa (búsqueda web) requiere internet por definición, independientemente de dónde esté desplegado el resto del stack.

**Nota sobre `@upstash/redis` / `@upstash/ratelimit`:** son servicios cloud gestionados (Upstash), no self-hosteables directamente — para un despliegue local persistente con rate limiting real habría que reemplazar por Redis autohospedado (mismo SDK `@upstash/redis` no aplica; se necesitaría `ioredis` u otro cliente Redis estándar). Hoy esto es de bajo riesgo porque el sistema ya fail-opens sin esas vars, pero es un punto a rediseñar si el rate limiting se considera crítico en el entorno local.

---

## Riesgos identificados para la Regla Cero (no romper main/producción)

1. **Ninguno de los hallazgos de esta auditoría requiere tocar código hoy** — es 100% diagnóstico. El riesgo aparece recién cuando arranque la implementación de Etapa 2.
2. **El mayor riesgo de ruptura futura es el de Realtime (punto 1):** si al migrar se olvida recrear el `ALTER PUBLICATION supabase_realtime ADD TABLE team_connections` (que hoy no está versionado en ninguna migración), Realtime queda roto en la instancia nueva. Bajo impacto real gracias al polling fallback ya existente, pero conviene versionarlo en una migración antes de tocar nada, para no depender de que alguien lo recuerde a mano.
3. **El punto de mayor esfuerzo de diseño (no de riesgo inmediato) es Autenticación (punto 5):** si el objetivo final es air-gapped, reemplazar OAuth Google/GitHub es un cambio de flujo de usuario completo (nueva UI de login, posible migración de cuentas existentes) — amerita su propia OE de diseño antes de tocar código, no un fix directo.
4. **Vault (punto 1) es el único punto donde una migración podría fallar silenciosamente en una instancia self-hosted nueva** si `pgsodium`/`vault.secrets_key` no está configurado — mitigado porque el propio código ya tiene fallback a texto plano diseñado para ese escenario exacto.
5. **Rate limiting fail-open (punto 6)** ya es una brecha conocida y aceptada en el diseño actual (documentada en el propio código) — no es nueva de esta auditoría, pero se vuelve más relevante en un despliegue local sin Upstash configurado, porque ahí el fail-open pasa de ser "caso raro" a ser "estado normal".

---

## Preguntas abiertas para decidir alcance de Etapa 2 (no requieren respuesta inmediata)

- ¿El despliegue local debe ser **air-gapped real** (sin internet) o **self-hosted con salida a internet** (Supabase CE + servidor propio, pero igual llamando a Anthropic/OpenAI/Google/Tavily/Google OAuth por API)? Esto cambia radicalmente el alcance de los puntos 3, 4 y 5.
- Si es air-gapped: Tavily (búsqueda web) y los providers cloud de IA (Anthropic/OpenAI/Google) quedan fuera de alcance por definición — solo IA Local tendría sentido, lo que hace prioritario el "hardening" de `LocalProvider` (punto 3).
- Si es self-hosted-con-internet: el trabajo real se reduce a Supabase CE (setup de Storage bucket, Vault, Realtime publication) + reemplazar el hosting de Vercel — ambos de bajo-medio esfuerzo según lo relevado acá.
