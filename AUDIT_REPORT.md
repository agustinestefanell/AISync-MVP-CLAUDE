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

### SEC-002 🟡 OPEN — Posible recursión en política RLS "Admins read all accounts"

- **Descripción:** La política `"Admins read all accounts"` (migración 012) es una política sobre `accounts` cuyo `USING` hace `EXISTS (SELECT 1 FROM accounts a2 ...)` — consulta la misma tabla que protege. En Postgres este patrón suele producir el error `infinite recursion detected in policy for relation "accounts"` al evaluar cualquier SELECT sobre la tabla. Es un pitfall conocido de Supabase.
- **Indicio adicional:** `api/admin/prompts/route.ts` usa el cliente admin para leer `accounts` "to bypass RLS" — posible workaround de este mismo problema.
- **Impacto potencial:** Si la recursión está activa, ningún SELECT a `accounts` con cliente de usuario funciona — ni siquiera "leer mi propia cuenta". Todo acceso a `accounts` queda forzado a pasar por service role.
- **Verificación pendiente:** Ejecutar contra la base real, con sesión de usuario normal: `select * from accounts where id = auth.uid()`. Si da error de recursión, el fix estándar es una función `security definer` (ej. `is_admin()`) que consulta `accounts` sin disparar RLS, y usarla en la política.
- **Nota:** Las políticas "Admin only" de `admin_events`, `system_prompts`, `system_log` y `provenance_log` usan la misma estructura pero NO son recursivas (consultan `accounts` desde otra tabla).
- **Estado:** OPEN.

### SEC-003 🟡 OPEN — Tabla accounts sin migración versionada

- **Descripción:** `accounts` es la tabla raíz del sistema (toda la jerarquía la referencia por FK desde la migración 001), pero ningún archivo en `supabase/migrations/` contiene su `CREATE TABLE`. Fue creada a mano en Supabase antes de la 001.
- **Impacto:** (1) Si hay que recrear la base desde las migraciones, falla en la 001 — no existe registro del schema de la tabla más fundamental. (2) Tampoco está versionado el mecanismo que crea la fila de `accounts` al registrarse un usuario (presumiblemente un trigger sobre `auth.users` creado a mano) — sin él, los usuarios nuevos no obtienen cuenta.
- **Resolución sugerida:** Exportar el schema real de `accounts` y su trigger desde Supabase (SQL Editor / `pg_dump`) y consolidarlos en una migración `000_accounts.sql` documental, marcada como "ya aplicada".
- **Estado:** OPEN.

### SEC-004 🟢 OPEN — Tablas sin políticas UPDATE/DELETE

- **Descripción:** `messages`, `checkpoints` (sin update/delete), `audit_log` (solo select/insert), `token_usage` (solo select/insert) y `prompt_library` (sin delete) no definen políticas UPDATE/DELETE. Por deny-by-default de RLS esto es **restrictivo** — no es un hueco de seguridad — pero significa que un usuario no puede modificar ni borrar su propio contenido.
- **Tensión de producto:** El content plane (checkpoints, messages) se define como "del cliente, migrable" (Bloque 13); que el dueño no pueda borrarlo es una decisión de producto pendiente, no un descuido técnico. Para `audit_log` y `token_usage` la inmutabilidad es probablemente deseable y conviene declararla explícita.
- **Resolución sugerida:** Decisión de producto en `DECISIONS.md`: qué tablas son inmutables por diseño y cuáles necesitan políticas UPDATE/DELETE para el dueño.
- **Estado:** OPEN.

### SEC-005 🟡 OPEN — API keys en texto plano en DB

- **Descripción:** `user_api_keys.api_key` y `user_custom_providers.api_key` se guardan sin cifrar (`settings/keys/route.ts` hace upsert de `key.trim()` directo). La RLS protege el acceso vía API, pero cualquiera con acceso a la base las lee completas: dashboard de Supabase, leak de la service role key o un backup filtrado expondrían todas las API keys de todos los clientes — credenciales de pago de terceros (Anthropic, OpenAI, Google).
- **Lo que SÍ está bien:** la exposición vía API está correctamente manejada — GET `/api/settings/keys` y `/api/settings/providers` devuelven solo versión enmascarada (últimos 4 caracteres); la key real nunca viaja al cliente. En runtime (`chat`, `sm-doc-chat`) se lee server-side con doble filtro (`account_id` + RLS) y no se devuelve en la respuesta.
- **Mitigación futura:** Supabase Vault (o cifrado a nivel aplicación).
- **Decisión pendiente:** riesgo aceptado para beta vs. cifrado antes de usuarios reales.
- **Estado:** OPEN.

### SEC-006 🟡 OPEN — Fallback a ENV_KEYS de plataforma activo en producción

- **Descripción:** `chat/route.ts` y `sm-doc-chat/route.ts` hacen `const apiKey = keyRow?.api_key ?? ENV_KEYS[provider]`: si el usuario no configuró key propia, se usa la key de AISync desde variables de entorno. Contradice el principio "AISync no paga el uso de IA de sus clientes": cualquier usuario autenticado sin key propia consume la cuenta de AISync — costo no acotado, agravado mientras no exista rate limiting (Gap 2).
- **Decisión de producto pendiente:** cortesía beta (mantener fallback, acotarlo con límites) vs. BYOK estricto (eliminar fallback en producción; las env keys quedan solo para desarrollo local).
- **Verificación pendiente:** confirmar qué `ENV_KEYS` están seteadas en Vercel producción.
- **Decisión tomada (2026-06-11):** BYOK estricto — eliminar el fallback en producción; las env keys quedan solo para desarrollo local. Fix pendiente como OE propia.
- **Estado:** OPEN.

### SEC-007 🔴 CLOSED — Lock/Unlock de workspace silenciosamente roto (sin política UPDATE en workspaces)

- **Descripción:** `workspaces` tenía políticas RLS de SELECT, INSERT y DELETE pero ninguna de UPDATE (la migración 005 la omitió deliberadamente: "update ya no se necesita para este bloque" — y nunca se agregó). Con RLS deny-by-default, el UPDATE de `lock/route.ts` afectaba 0 filas sin error, la route devolvía `{ ok: true }`, y la UI optimista (`WorkspaceShell`) mostraba el candado cerrado — pero al recargar, el estado revertía. **Lock nunca persistió.**
- **Agravante de integridad:** la route insertaba el evento `lock`/`unlock` en `audit_log` aunque el update no hubiera persistido — el audit trail registraba bloqueos que nunca ocurrieron. Crítico para un producto que se define como control layer.
- **Resolución:**
  1. Migración `025_workspaces_update_policy.sql` — política `workspaces_update` espejando la cadena de ownership de select/insert/delete. **Requiere aplicación manual en Supabase Dashboard → SQL Editor.**
  2. `lock/route.ts` — ownership check explícito antes del update (patrón `checkpoint/[id]`: 404 si no existe, 403 si no es del usuario); UPDATE con `.select()` y verificación de filas afectadas; el insert en `audit_log` solo ocurre si el cambio persistió; validación runtime de `lock_state`.
- **Lección registrada:** `CodingWorkshop.md` Entrada #17.
- **Estado:** CLOSED — commit pendiente de referencia en este mismo cambio; migración 025 pendiente de aplicación manual (validar: Lock → recargar página → debe persistir).

### SEC-008 🟢 OPEN — IDs referenciados sin validar ownership en handoff-package y save-selection

- **Descripción:** `handoff-package/route.ts` y `save-selection/route.ts` insertan filas propias (`user_id: user.id`, protegido por RLS) pero toman `workspace_id`, `team_id` y `project_id` del body sin verificar que pertenezcan al usuario. Un usuario autenticado puede crear handoff packages, saved selections y entradas de `audit_log` que referencian workspaces de otras cuentas. No expone datos ajenos (las lecturas siguen filtradas por RLS) — afecta integridad referencial y limpieza del audit trail, no confidencialidad.
- **Patrón de fix definido:** replicar el ownership check de `checkpoint/[id]/route.ts` (cadena workspace → team → project → `account_id === user.id`, 403 si no pertenece) antes del insert. La route de lock ya lo aplica desde SEC-007.
- **Planificación:** OE propia post-auditoría. No bloquea beta.
- **Estado:** OPEN.
