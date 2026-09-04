# AISync — Technical Audit Report

Started: 2026-06-11
Auditor: Claude (Director Técnico) + Claude Code (inspección)

## Methodology

5 áreas: Seguridad / Arquitectura / Manejo de errores / Performance / UX técnico
Severidad: 🔴 crítico · 🟡 importante · 🟢 menor
Estado: OPEN / CLOSED (con commit de referencia)

Cada hallazgo registra: descripción, evidencia (archivo/línea o migración), impacto y resolución (si está cerrado). Los hallazgos no se borran — un hallazgo resuelto pasa a CLOSED con su commit de referencia.

## Findings

### SEC-001 🔴 CLOSED — Gap 1 fix roto por RLS de accounts

- **Descripción:** El fix de seguridad del Gap 1 (commit `eedffe0`, 2026-06-09) verificaba que `receiver_email` perteneciera a una cuenta real consultando `accounts` con el cliente del usuario. La RLS de `accounts` (migración 012) solo permite leer la propia fila, por lo que el lookup devolvía `null` para todo usuario no-admin y POST `/api/connections` respondía siempre `400 "No AISync account found with that email"`. Connect Team funcionalmente roto en producción para usuarios beta.
- **Causa raíz:** SELECT cross-account ejecutado con cliente sujeto a RLS. No se detectó en pruebas porque la cuenta de pruebas es `owner` y la política "Admins read all accounts" le permite leer todas las filas.
- **Evidencia:** `src/app/api/connections/route.ts` (lookup Gap 1) + `supabase/migrations/012_admin_roles.sql` (políticas SELECT de `accounts`).
- **Resolución:** Lookup con `createAdminClient()` (service role, SELECT-only); el INSERT y el resto de la route mantienen cliente de usuario con RLS activa. Tradeoff de enumeración de emails aceptado y registrado en `DECISIONS.md` (2026-06-11). Lección registrada en `CodingWorkshop.md` Entrada #16.
- **Estado:** CLOSED — commit `013c2a0` (2026-06-11).

### SEC-002 🟢 CLOSED — Recursión infinita en política RLS "Admins read all accounts" (confirmada y corregida, 2026-09-04)

- **Descripción:** La política `"Admins read all accounts"` (migración 012) es una política sobre `accounts` cuyo `USING` hace `EXISTS (SELECT 1 FROM accounts a2 ...)` — consulta la misma tabla que protege. En Postgres este patrón produce el error `infinite recursion detected in policy for relation "accounts"` al evaluar cualquier SELECT sobre la tabla. Es un pitfall conocido de Supabase.
- **Indicio adicional (ya documentado en la apertura):** `api/admin/prompts/route.ts` usa el cliente admin para leer `accounts` "to bypass RLS" — confirmado como workaround real de este mismo problema, no solo indicio.
- **Verificación ejecutada (2026-09-04):** confirmado con evidencia real contra producción (sesión real vía magic link + anon key, no service role) — `select * from accounts where id = auth.uid()` y toda variante probada (directa y embebida vía JOIN desde `audit_log`) devuelven `42P17`. **El impacto real confirmado es mayor al "potencial" descrito en la apertura:** no solo Audit View/Investigate View/Audit Log global (2 pantallas originalmente investigadas), sino Switch Project (`getActiveProjectId()`, cae siempre al fallback "primer proyecto") y el nombre real de usuario en 6 pantallas más (Settings, Context Files, Teams Map, `/start`, Documentation Mode) — 9 lugares de la app en total con manejo de error silencioso (`data ?? []`/`?? null`/`?? user.email`) que enmascaraban el fallo. Detalle completo: `handoff-2026-07-c.md` OE 2026-09-04.
- **Fix aplicado:** función `is_admin(uid uuid) SECURITY DEFINER` (mismo patrón ya usado en 026/027) que evalúa el rol sin volver a disparar RLS — la policy pasa a `USING (is_admin(auth.uid()))`. Migración `060_fix_accounts_admin_policy_recursion.sql`. Los 9 call sites con manejo silencioso ganaron chequeo de `error` + `console.error()` (defensa en profundidad — no dependen de la policy para dejar de fallar en silencio ante un futuro problema distinto).
- **Nota:** Las políticas "Admin only" de `admin_events`, `system_prompts`, `system_log` y `provenance_log` usan la misma estructura pero NO son recursivas (consultan `accounts` desde otra tabla) — confirmado por grep exhaustivo de todas las policies de `accounts` en el historial de migraciones (solo existen 2, ninguna otra recursiva).
- **Estado:** CLOSED — commit pendiente de esta OE (2026-09-04). **Diferido 3 meses desde su apertura** (2026-06-11/12) a la tarea "RLS multi-usuario" del Bloque 1 (`PRODUCT_STATUS.md`, sigue `⏳ Pendiente`) — se cerró de forma independiente y adelantada al confirmarse como causa raíz de un bug funcional real, sin esperar a esa tarea más grande. Queda nota para evaluar si el resto de ese bloque sigue bien planteado a la luz de este hallazgo.

### SEC-003 🟡 CLOSED — Tabla accounts sin migración versionada

- **Descripción:** `accounts` es la tabla raíz del sistema (toda la jerarquía la referencia por FK desde la migración 001), pero ningún archivo en `supabase/migrations/` contiene su `CREATE TABLE`. Fue creada a mano en Supabase antes de la 001.
- **Impacto:** (1) Si hay que recrear la base desde las migraciones, falla en la 001 — no existe registro del schema de la tabla más fundamental. (2) Tampoco está versionado el mecanismo que crea la fila de `accounts` al registrarse un usuario (trigger `on_auth_user_created` → `handle_new_user()` sobre `auth.users`, creado a mano) — sin él, los usuarios nuevos no obtienen cuenta.
- **Resolución aplicada:** Migración documental `supabase/migrations/000_accounts_baseline.sql` — schema de `accounts`, función `handle_new_user()` (security definer, con fallbacks de nombre desde metadata y `on conflict do nothing`) y trigger `on_auth_user_created`. Marcada como **YA APLICADA EN PRODUCCIÓN — NO EJECUTAR**. Columnas verificadas contra producción con service role (id, email, name, created_at, plan, role, status); `role`/`status` provienen de la 012 (`ADD COLUMN IF NOT EXISTS` — replay seguro) y se incluyen para reflejar el estado actual.
- **Estado:** CLOSED — commit `docs: add accounts baseline migration to version control (SEC-003)` (2026-06-11).

### SEC-004 🟢 OPEN — Tablas sin políticas UPDATE/DELETE

- **Descripción:** `messages`, `checkpoints` (sin update/delete), `audit_log` (solo select/insert), `token_usage` (solo select/insert) y `prompt_library` (sin delete) no definen políticas UPDATE/DELETE. Por deny-by-default de RLS esto es **restrictivo** — no es un hueco de seguridad — pero significa que un usuario no puede modificar ni borrar su propio contenido.
- **Tensión de producto:** El content plane (checkpoints, messages) se define como "del cliente, migrable" (Bloque 13); que el dueño no pueda borrarlo es una decisión de producto pendiente, no un descuido técnico. Para `audit_log` y `token_usage` la inmutabilidad es probablemente deseable y conviene declararla explícita.
- **Resolución sugerida:** Decisión de producto en `DECISIONS.md`: qué tablas son inmutables por diseño y cuáles necesitan políticas UPDATE/DELETE para el dueño.
- **Estado:** OPEN.

### SEC-005 🟡 CLOSED (repo) — API keys en texto plano en DB

- **Descripción:** `user_api_keys.api_key` y `user_custom_providers.api_key` se guardan sin cifrar (`settings/keys/route.ts` hace upsert de `key.trim()` directo). La RLS protege el acceso vía API, pero cualquiera con acceso a la base las lee completas: dashboard de Supabase, leak de la service role key o un backup filtrado expondrían todas las API keys de todos los clientes — credenciales de pago de terceros (Anthropic, OpenAI, Google).
- **Lo que SÍ está bien:** la exposición vía API está correctamente manejada — GET `/api/settings/keys` y `/api/settings/providers` devuelven solo versión enmascarada (últimos 4 caracteres); la key real nunca viaja al cliente. En runtime (`chat`, `sm-doc-chat`) se lee server-side con doble filtro (`account_id` + RLS) y no se devuelve en la respuesta.
- **Decisión tomada (2026-06-12):** Supabase Vault con RPCs `SECURITY DEFINER` + transición dual-read. Vault habilitado en el proyecto (pgsodium 3.1.8, supabase_vault 0.3.1).
- **Resolución aplicada:** Migración `026_vault_api_keys.sql` — columnas `vault_secret_id`/`key_last4` en ambas tablas + 6 RPCs `SECURITY DEFINER` (set/get/delete por tabla) que validan `auth.uid()`, usan `vault.create_secret()`/`vault.update_secret()` y revocan EXECUTE de PUBLIC. Las settings routes escriben vía RPC (nunca más plaintext nuevo; el delete borra fila + secret para no dejar secrets huérfanos). Los GET enmascaran desde `key_last4` (fallback transicional a `api_key` legacy solo para calcular last4 — nunca devuelven la key). `resolveProviderApiKey` lee Vault primero y cae a plaintext legacy; como `supabase.rpc()` no lanza ante función inexistente, el código es deployable antes de aplicar la migración.
- **Estado operativo:** migración creada en repo — **aplicación manual pendiente** (Dashboard → SQL Editor); **backfill manual pendiente** (SQL en handoff-archive-2026-06.md 2026-06-12); limpieza de plaintext legacy en fase posterior, tras validar runtime Vault-first.
- **Ventana conocida:** entre el deploy de este commit y la aplicación manual de la 026, guardar keys nuevas devuelve 500 (sin fallback plaintext, deliberado). Lecturas y chat no se afectan (dual-read). Aplicar la migración inmediatamente después del deploy.
- **Estado:** CLOSED (repo) — commit `feat: encrypt api keys with supabase vault (SEC-005)` (2026-06-12). Cierre operativo total al completar migración + backfill.

### SEC-006 🟡 OPEN — Fallback a ENV_KEYS de plataforma activo en producción

- **Descripción:** `chat/route.ts` y `sm-doc-chat/route.ts` hacen `const apiKey = keyRow?.api_key ?? ENV_KEYS[provider]`: si el usuario no configuró key propia, se usa la key de AISync desde variables de entorno. Contradice el principio "AISync no paga el uso de IA de sus clientes": cualquier usuario autenticado sin key propia consume la cuenta de AISync — costo no acotado, agravado mientras no exista rate limiting (Gap 2).
- **Decisión de producto pendiente:** cortesía beta (mantener fallback, acotarlo con límites) vs. BYOK estricto (eliminar fallback en producción; las env keys quedan solo para desarrollo local).
- **Decisión tomada (2026-06-11):** BYOK estricto — el fallback solo opera en desarrollo; las env keys quedan solo para desarrollo local (pueden permanecer en Vercel, el código las ignora en producción).
- **Resolución:** fallback condicionado a `NODE_ENV === 'development'` en ambas routes; en producción, usuario sin key recibe 400 accionable ("Add your key in Settings → Providers"). Verificado que AgentPanel y SMPanel muestran el error visiblemente (no se traga). Registrado en `DECISIONS.md` y `CodingWorkshop.md` Entrada #19.
- **Estado:** CLOSED — commit `fix: restrict platform key fallback to development only (BYOK strict)` (2026-06-11).

### SEC-007 🔴 CLOSED — Lock/Unlock de workspace silenciosamente roto (sin política UPDATE en workspaces)

- **Descripción:** `workspaces` tenía políticas RLS de SELECT, INSERT y DELETE pero ninguna de UPDATE (la migración 005 la omitió deliberadamente: "update ya no se necesita para este bloque" — y nunca se agregó). Con RLS deny-by-default, el UPDATE de `lock/route.ts` afectaba 0 filas sin error, la route devolvía `{ ok: true }`, y la UI optimista (`WorkspaceShell`) mostraba el candado cerrado — pero al recargar, el estado revertía. **Lock nunca persistió.**
- **Agravante de integridad:** la route insertaba el evento `lock`/`unlock` en `audit_log` aunque el update no hubiera persistido — el audit trail registraba bloqueos que nunca ocurrieron. Crítico para un producto que se define como control layer.
- **Resolución:**
  1. Migración `025_workspaces_update_policy.sql` — política `workspaces_update` espejando la cadena de ownership de select/insert/delete. **Requiere aplicación manual en Supabase Dashboard → SQL Editor.**
  2. `lock/route.ts` — ownership check explícito antes del update (patrón `checkpoint/[id]`: 404 si no existe, 403 si no es del usuario); UPDATE con `.select()` y verificación de filas afectadas; el insert en `audit_log` solo ocurre si el cambio persistió; validación runtime de `lock_state`.
- **Lección registrada:** `CodingWorkshop.md` Entrada #17.
- **Hallazgo derivado durante la validación:** el botón Lock no existe en la UI — fue removido el 2026-05-14 (commit `1903306`, rediseño de workspace) y el handler huérfano quedó silenciado con prefijo `_` el 2026-05-19 (`97b7aea`) para pasar ESLint. La remoción se formalizó retroactivamente como decisión de producto en `DECISIONS.md` (2026-06-11), junto con el diseño "Smart Lock" aprobado para post-MVP (auto-lock por inactividad, auto-unlock por R&F, modal de estado, checkpoint en unlock, toggle global). Lección de proceso en `CodingWorkshop.md` Entrada #18.
- **Estado:** CLOSED — persistencia arreglada: route corregida (commit `934ae51`) + migración 025 aplicada en Supabase (2026-06-11). UI deliberadamente removida del MVP por decisión de producto — ver DECISIONS.md. Cuando Lock vuelva, se implementa Smart Lock, no el botón manual.

### SEC-008 🟢 CLOSED — IDs referenciados sin validar ownership en handoff-package y save-selection

- **Descripción:** `handoff-package/route.ts` y `save-selection/route.ts` insertan filas propias (`user_id: user.id`, protegido por RLS) pero toman `workspace_id`, `team_id` y `project_id` del body sin verificar que pertenezcan al usuario. Un usuario autenticado puede crear handoff packages, saved selections y entradas de `audit_log` que referencian workspaces de otras cuentas. No expone datos ajenos (las lecturas siguen filtradas por RLS) — afecta integridad referencial y limpieza del audit trail, no confidencialidad.
- **Patrón de fix definido:** replicar el ownership check de `checkpoint/[id]/route.ts` (cadena workspace → team → project → `account_id === user.id`, 403 si no pertenece) antes del insert. La route de lock ya lo aplica desde SEC-007.
- **Resolución aplicada (OE API Hardening 2):** Ambas routes verifican ownership con la cadena `workspaces → teams → projects → account_id` antes del INSERT (patrón `checkpoint/[id]`): 404 si el workspace no existe, 403 si no pertenece al usuario. En `save-selection`, además, `team_id` y `project_id` del body se validan contra la cadena real del workspace (400 si no coinciden) — sin esto el hallazgo quedaba abierto para esos dos campos. El insert de `audit_log` permanece posterior al insert principal exitoso en ambas.
- **Estado:** CLOSED — commit `refactor: api hardening 2 - ownership checks, shared key resolution, i18n errors` (2026-06-11).

### SEC-009 🟠 CLOSED — Falta de rate limiting en API routes críticas

- **Severidad:** 🟠 High
- **Fecha:** 2026-06-11
- **Área:** API / Security / Rate Limiting
- **Detectado en:** Auditoría de seguridad AISync (registrado previamente como Gap 2)
- **Descripción:** AISync no tenía rate limiting en API routes críticas, dejando endpoints autenticados expuestos a abuso por usuario.
- **Impacto:** Riesgo de consumo excesivo de recursos, abuso de providers, spam de connections/context/teams y degradación de servicio.
- **Resolución aplicada:** Rate limiting por usuario con Upstash Redis mediante interfaz desacoplada `RateLimiter` (`src/lib/rate-limit/`). Las routes chat, connections, context y teams tienen límites específicos por minuto, aplicados después de auth y antes de la operación pesada, solo en POST. Política fail-open ante fallo de Upstash, verificada funcionalmente sin env vars (la request continúa y se loguea el error).
- **Límites aplicados:** POST `/api/chat` 30 req/min; POST `/api/connections` 10 req/min; POST `/api/context` 20 req/min; POST `/api/teams` 10 req/min.
- **Pendiente derivado:** `sm-doc-chat` y demás routes de escritura siguen sin límite — extensión del mismo patrón en OE futura.
- **Estado:** CLOSED — commit `feat: add rate limiting with upstash redis and decoupled RateLimiter interface` (2026-06-11).

### SEC-010 🔴 CLOSED — Disconnect roto por colisión de semánticas en PATCH connections/[id]

- **Severidad:** 🔴 High (funcionalidad core rota silenciosamente en producción)
- **Fecha:** 2026-06-11
- **Área:** API / Connections / Regresión de hardening
- **Detectado en:** Investigación de un 404 reportado por el Product Owner al clickear Disconnect
- **Descripción:** El botón Disconnect de la UI (`ProjectList.tsx`) reutilizaba el action `'reject'` del PATCH para terminar conexiones **activas**. Al cerrar Gap 3 (2026-06-11) se agregó al handler un lookup con filtro `status = 'pending'` y un check "solo receiver" — correcto para rechazar solicitudes pendientes, pero rompió la segunda semántica que ese mismo action transportaba: desconectar una conexión activa pasó a dar **404 siempre** (y 403 si el requester rechazaba una pendiente). La UI tragaba el error (`catch {}` sin mirar `res.ok`), así que la regresión fue invisible.
- **Impacto:** Imposible desconectar conexiones activas entre teams desde la UI; el usuario no recibía ningún feedback del fallo.
- **Resolución aplicada:**
  1. `connections/[id]/route.ts` — action `'disconnect'` separado: opera solo sobre `status = 'active'`, autorizado para **cualquiera de las dos puntas** (requester por `account_id`, receiver por `account_id` o email); setea `status = 'cancelled'` (valor ya permitido por el CHECK de la migración 008 — sin tocar schema) con verificación de persistencia (patrón SEC-007: `.select()` + filas afectadas). `'reject'`/`'accept'` quedan como estaban: solo pending, solo receiver.
  2. `ProjectList.tsx` — `handleDisconnect` usa `action: 'disconnect'`, verifica `res.ok` y muestra el error en el bloque de confirmación en vez de tragarlo.
- **Lección registrada:** `CodingWorkshop.md` Entrada #21 — reutilizar una acción API para dos semánticas distintas rompe una cuando hardeneás la otra.
- **Nota:** el 404 puntual que disparó la investigación tenía además una segunda causa: la conexión clickeada ya no existía en la DB (verificado con service role) — la lista de la UI estaba vieja. Ambas causas eran reales y apiladas.
- **Estado:** CLOSED — commit `fix: add disconnect action to separate from reject in connections PATCH` (2026-06-11).

### ARC-001 🟡 CLOSED — Duplicación de resolución de keys con drift real

- **Severidad:** 🟡 Medium
- **Fecha:** 2026-06-11
- **Área:** Architecture / Providers / API Keys
- **Detectado en:** Auditoría técnica de arquitectura 2026-06-11
- **Descripción:** La lógica de resolución de provider API keys (custom providers → BYOK → fallback dev) estaba duplicada entre `chat/route.ts` y `sm-doc-chat/route.ts`, con listas `KNOWN_PROVIDERS` ya divergentes: chat incluía Groq, sm-doc-chat no.
- **Impacto:** Drift confirmado, no teórico — un usuario con Groq en el SM panel caía al camino de custom providers y fallaba con el error equivocado. Todo provider nuevo requería tocar dos archivos.
- **Resolución aplicada:** `src/lib/providers/resolveApiKey.ts` con `KNOWN_PROVIDERS` unificado (incluye Groq) y `resolveProviderApiKey()` compartido: custom providers (preserva `endpoint_url` y `api_key` nullable — Ollama no requiere key), BYOK por `user_api_keys`, fallback a ENV solo en development. Ambas routes consumen el helper; sm-doc-chat gana soporte Groq como alineación estructural.
- **Estado:** CLOSED — commit `refactor: api hardening 2 - ownership checks, shared key resolution, i18n errors` (2026-06-11).

### ARC-002 🟢 CLOSED — Strings de error en español en API routes

- **Severidad:** 🟢 Low
- **Fecha:** 2026-06-11
- **Área:** API / Consistency / i18n
- **Detectado en:** Auditoría técnica de arquitectura 2026-06-11
- **Descripción:** 20 strings de error en español en 12 API routes (`'No autorizado'` ×10, `'workspaceId requerido'`, `'Datos incompletos'`, etc.) — violaban la regla "UI 100% inglés" porque AgentPanel y SMPanel renderizan estos errores.
- **Resolución aplicada:** Traducidos al inglés sin cambiar status codes ni shape JSON. Grep de verificación post-cambio: cero strings en español en `src/app/api`.
- **Estado:** CLOSED — commit `refactor: api hardening 2 - ownership checks, shared key resolution, i18n errors` (2026-06-11).

### ARC-003 🟢 CLOSED — force-dynamic faltante en active-workspace

- **Severidad:** 🟢 Low
- **Fecha:** 2026-06-11
- **Área:** API / Next.js Runtime
- **Detectado en:** Auditoría técnica de arquitectura 2026-06-11
- **Descripción:** `active-workspace/route.ts` (GET dependiente de sesión) no declaraba `force-dynamic` — era la única route GET sin la declaración explícita; dependía del efecto colateral de leer cookies.
- **Resolución aplicada:** `export const dynamic = 'force-dynamic'` agregado. Evidencia en build: las páginas estáticas generadas bajaron de 16 a 15 — la route estaba siendo prerenderizada en build.
- **Estado:** CLOSED — commit `refactor: api hardening 2 - ownership checks, shared key resolution, i18n errors` (2026-06-11).

### ERR-001 🟡 OPEN — Anthropic lazy stream init: errores pre-token no producen 500 JSON homogéneo

- **Severidad:** 🟡 Medium
- **Fecha:** 2026-06-11
- **Área:** Error Handling / Providers / Streaming
- **Detectado en:** Auditoría técnica de manejo de errores 2026-06-11
- **Descripción:** `AnthropicProvider.stream()` usa `client.messages.stream()` sin await (`anthropic.ts:59`) — la llamada de red real arranca recién al iterar, dentro del `start()` del ReadableStream, después de que la route ya devolvió 200. OpenAI/Groq/Google awaitean la creación (`openai.ts:47`), así que sus errores pre-token (key inválida, 429, modelo inexistente) llegan al catch de la route como 500 JSON con mensaje real.
- **Impacto:** Para Anthropic, hasta una key inválida se manifiesta como corte de stream con error genérico de red en el cliente, en vez del 500 JSON accionable que dan los demás providers. Comportamiento inconsistente por provider para la misma falla.
- **Resolución requerida:** Normalizar la inicialización del stream de Anthropic para que los errores pre-token suban al catch de la route. Toca `providers/anthropic.ts` (zona streaming) — OE dedicada con prueba real.
- **Estado:** OPEN.

### ERR-002 🟢 OPEN — Sin try/catch en for await de providers: errores mid-stream no logueados server-side

- **Severidad:** 🟢 Low
- **Fecha:** 2026-06-11
- **Área:** Error Handling / Providers / Server Logging
- **Detectado en:** Auditoría técnica de manejo de errores 2026-06-11
- **Descripción:** Los loops `for await` que bombean tokens en los cuatro providers no tienen try/catch (`anthropic.ts:67-74`, `openai.ts:56-74`, equivalentes en google/groq). Un error mid-stream rechaza el `start()` del ReadableStream y aborta la response sin log estructurado server-side — el catch de la route nunca se entera porque la response ya salió.
- **Impacto:** Errores de stream visibles solo del lado cliente (y como genérico de red); observabilidad server-side nula para cortes mid-stream. `token_usage` tampoco se registra en streams cortados.
- **Resolución requerida:** try/catch homogéneo alrededor de los loops con log estructurado, sin romper streaming. OE separada (zona providers).
- **Estado:** OPEN.

### ERR-003 🟡 CLOSED — Pérdida de userMsg y contenido parcial en stream interrumpido

- **Severidad:** 🟡 Medium
- **Fecha:** 2026-06-11
- **Área:** Error Handling / Client Persistence / Traceability
- **Detectado en:** Auditoría técnica de manejo de errores 2026-06-11
- **Descripción:** `AgentPanel.sendPrompt()` persistía `[userMsg, assistantMsg]` juntos, solo al final del stream exitoso. Un corte mid-stream descartaba el contenido parcial (el `finally` limpiaba `streamingContent`) y **tampoco persistía el mensaje del usuario** — al recargar, la conversación retrocedía como si el usuario nunca hubiera escrito.
- **Impacto:** Pérdida de trazabilidad de la acción humana y del trabajo parcial generado. Para una capa de control con trazabilidad como propuesta de valor, el hallazgo más relevante de esta auditoría de errores.
- **Resolución aplicada:** Persistencia separada en tres momentos: (1) `userMsg` se persiste antes de iniciar `POST /api/chat` (fail-open con log si falla); (2) el flujo exitoso persiste solo `[assistantMsg]` — sin duplicar userMsg; (3) si el stream se corta con `fullContent` no vacío, el parcial se conserva en pantalla y se persiste como assistant message con sufijo `⚠️ Response interrupted — the connection was lost mid-stream.`, y el error visible pasa a `The response was interrupted. Your message has been saved.`. Los errores pre-stream (400 sin key, 429) conservan su mensaje accionable real.
- **Fuera de scope (deliberado):** SMPanel (efímero, no persiste mensajes — solo pierde el parcial de pantalla).
- **Estado:** CLOSED — commit `fix: persist userMsg before stream and preserve partial content on interruption` (2026-06-11).

### ARC-004 🟡 CLOSED (repo) — Active project hardcodeado al primer proyecto

- **Severidad:** 🟡 Medium
- **Fecha:** 2026-06-12
- **Área:** Architecture / Multi-project / State
- **Detectado en:** Auditoría funcional multi-proyecto (pre-diseño de Switch Project)
- **Descripción:** Multi-proyecto existía a nivel de datos (N proyectos por cuenta, mapa multi-proyecto con atenuado de inactivos), pero "proyecto activo" era un ghost: `getActiveProjectId()` devolvía siempre el primer proyecto por `created_at`, sin setter en todo el codebase, y `active-workspace/route.ts` duplicaba esa lógica hardcodeada. El badge "active" del Dashboard estaba hardcodeado en todas las cards.
- **Impacto:** El usuario no podía cambiar de proyecto activo (el activo era siempre el más viejo) y distintas rutas podían divergir en el criterio de selección.
- **Resolución aplicada:** Migración `027_active_project.sql` — `accounts.active_project_id` (FK `ON DELETE SET NULL`) + RPC `set_active_project` SECURITY DEFINER con ownership check (`projects.account_id = auth.uid()` + `status = 'active'`), REVOKE de PUBLIC. `getActiveProjectId()` lee la selección persistida validándola y cae al primer proyecto activo (deployable pre-migración: el select de la columna inexistente falla silencioso al fallback). `active-workspace` consume el helper — muere la lógica duplicada. Route `GET/PATCH /api/projects/active`. Dashboard: badge real + botón "Set active". Teams Map: dropdown de proyecto en el ribbon operativo.
- **Interacción con SEC-002:** la lectura de `accounts.active_project_id` con cliente de usuario es exactamente el SELECT que SEC-002 sospecha roto por recursión RLS. **La prueba post-migración del switch duplica como verificación de SEC-002:** si el switch nunca persiste (siempre vuelve al primer proyecto), la recursión está confirmada y el fix de SEC-002 (función `is_admin()` security definer en la política) pasa a bloquear esta feature.
- **Estado:** CLOSED (repo) — commit `feat: add active project switching with persistent selection` (2026-06-12). Aplicación manual de la 027 pendiente.

### DEP-001 🟡 CLOSED — xlsx de npm con 2 vulnerabilidades altas sin fix en el registro

- **Severidad:** 🟡 Medium (mitigada antes de llegar a producción)
- **Fecha:** 2026-07-30
- **Área:** Dependencies / Supply Chain / Export
- **Detectado en:** npm audit al instalar xlsx para la feature Save as Excel (Fase 1 de export)
- **Descripción:** `xlsx@0.18.5` (última versión publicada en npm) tiene 2 advisories altos sin fix disponible en el registro: Prototype Pollution (GHSA-4r6h-8v6p-xvw6) y ReDoS (GHSA-5pgg-2g8v-p4x9). SheetJS abandonó npm como canal de distribución — las versiones corregidas solo se publican en su registro propio (cdn.sheetjs.com).
- **Impacto potencial:** Los advisories afectan principalmente el PARSEO de archivos no confiables. AISync solo GENERA archivos desde JSON propio (no parsea spreadsheets subidos), por lo que la superficie real era baja — pero 11 findings high en npm audit permanentes son ruido que enmascara alertas futuras.
- **Resolución aplicada:** Instalación desde el tarball oficial de SheetJS: `npm install https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. `package.json` referencia la URL del CDN. npm audit quedó limpio de xlsx. Aprobado explícitamente por el PO (2026-07-30).
- **Deuda residual:** El lockfile depende de una URL externa (cdn.sheetjs.com) para builds — si SheetJS retomara la publicación en npm con fix, migrar de vuelta al registro estándar.
- **Actualización 2026-07-31:** Desde la OE de adjuntos Office, AISync SÍ parsea spreadsheets subidos por usuarios (`XLSX.read()` en extractText.ts) — el argumento "solo genera, no parsea" ya no aplica. Sin riesgo nuevo: la 0.20.3 instalada del CDN contiene los fixes de ambos advisories (por eso se eligió esa versión). Se deja constancia para que la evaluación de superficie siga siendo correcta.
- **Estado:** CLOSED — mismo commit de la feature (feat: add Save as Excel and Save as Word export from Save Selection).

### DEP-002 🟡 PARTIAL — npm audit: 10 high transitivas; Grupo A saneado, Grupo B atado a Next 16

- **Severidad:** 🟡 Medium (todas transitivas, ninguna con uso directo en código propio)
- **Fecha:** 2026-07-31
- **Área:** Dependencies / Supply Chain
- **Detectado en:** npm audit durante la OE de PPTX (2026-07-31) — ninguna vulnerabilidad introducida por trabajo del proyecto
- **Descripción y clasificación (confirmada con npm audit --json):**
  - **Grupo A — fix simple sin salto mayor (RESUELTO en esta OE):** axios 1.17.0→1.19.0, form-data 4.0.5→4.0.6, ws 8.20.0→8.21.1, js-yaml 4.1.1→4.3.0. Aplicado con `npm audit fix` (SIN --force). Todas 100% transitivas: axios/form-data vía @tavily/core (web search), ws vía Supabase Realtime + SDK OpenAI, js-yaml vía ESLint (dev-only). Cero imports directos en src/ (verificado por grep).
  - **Grupo B — requiere salto mayor, NO tocado (evaluación aparte):** next@14.2.35 (21 advisories, fix = next@16.2.12), postcss (bundled en next), glob (vía @next/eslint-plugin-next), brace-expansion (copias 1.1.18/2.1.4 bajo eslint@8 — su fix requiere eslint@10/eslint-config-next@16). **Nota:** brace-expansion estaba pre-clasificada en Grupo A por la directiva, pero la inspección real la reclasificó a Grupo B.
- **Sobre el conteo post-fix (16 > 10):** npm audit reporta ahora 16 high, pero solo 4 son raíces con advisory propio (brace-expansion, glob, next, postcss) — las otras 12 son inflación de cadena (npm marca vulnerable a cada dependiente de la cadena ESLint/Next: eslint, minimatch, rimraf, flat-cache, etc.). Superficie real de Grupo B: la misma de antes, nada nuevo.
- **Validación:** lint ✅ y build ✅ completos post-fix con output idéntico. package.json intacto — solo package-lock.json (versiones transitivas). Next.js NO tocado.
- **Estado:** PARTIAL — Grupo A CLOSED; Grupo B pendiente de la evaluación de upgrade a Next 16 (OE aparte con más cuidado — incluye los 21 advisories de next).
