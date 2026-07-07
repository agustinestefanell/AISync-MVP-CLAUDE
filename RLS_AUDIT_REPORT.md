# RLS Coverage Audit Report — AISync MVP

**Fecha de auditoría:** 2026-07-06  
**Alcance:** Todas las tablas del proyecto según migraciones en `supabase/migrations/*.sql`  
**Total de migraciones auditadas:** 47

---

## Resumen ejecutivo

**Tablas totales identificadas:** 25  
**Tablas con RLS habilitado:** 25 (100%)  
**Tablas con cobertura completa (SELECT + INSERT + UPDATE + DELETE):** 8  
**Tablas con gaps de cobertura:** 17

**Tablas de alto riesgo con gaps:**
- `audit_log` — falta UPDATE, DELETE (**correcto por diseño** — append-only inmutable)
- `token_usage` — falta UPDATE, DELETE (**correcto por diseño** — billing append-only)
- `session_attachments` — falta UPDATE, DELETE (**sin endpoints activos** — append-only por ahora)
- `session_tool_calls` — falta UPDATE, DELETE (**sin endpoints activos** — append-only por ahora)
- `checkpoint_messages` — falta UPDATE, DELETE (**sin endpoints activos** — append-only por ahora)
- `checkpoints` — falta UPDATE, DELETE (**sin endpoints activos** — pendiente feature "Delete Version")

---

## Inventario completo por tabla

### 1. **accounts**
- **RLS habilitado:** ✅ Sí (migración 000)
- **Políticas:**
  - SELECT: ✅ `"Users read own account"` (migración 012) — `auth.uid() = id`
  - SELECT: ✅ `"Admins read all accounts"` (migración 012) — admin role check
  - INSERT: ❌ Falta
  - UPDATE: ❌ Falta
  - DELETE: ❌ Falta
- **Nivel de riesgo:** ⚠️ **MEDIO** — tabla sensible (contiene datos de usuario), pero creación vía Supabase Auth (no vía app), updates no implementados en UI
- **Comentario:** Creación y actualización de accounts maneja Supabase Auth directamente, no la app. La falta de INSERT/UPDATE/DELETE es arquitecturalmente correcta.

---

### 2. **projects**
- **RLS habilitado:** ✅ Sí (migración 001)
- **Políticas:**
  - SELECT: ✅ `"projects_select"` (migración 001) — `account_id = auth.uid()`
  - INSERT: ✅ `"projects_insert"` (migración 001) — `account_id = auth.uid()`
  - UPDATE: ✅ `"projects_update"` (migración 001) — `account_id = auth.uid()`
  - DELETE: ✅ `"projects_delete"` (migración 034) — `account_id = auth.uid()`
- **Nivel de riesgo:** ✅ **BAJO** — cobertura completa
- **Comentario:** Cobertura RLS completa. Arquitectura 1 Account = 1 User = 1 Sovereign Cell correctamente protegida.

---

### 3. **teams**
- **RLS habilitado:** ✅ Sí (migración 001)
- **Políticas:**
  - SELECT: ✅ `"teams_select"` (migración 001) — ownership via `projects.account_id`
  - INSERT: ✅ `"teams_insert"` (migración 001) — ownership via `projects.account_id`
  - UPDATE: ✅ `"teams_update"` (migración 005) — ownership via `projects.account_id`
  - DELETE: ✅ `"teams_delete"` (migración 005) — ownership via `projects.account_id`
- **Nivel de riesgo:** ✅ **BAJO** — cobertura completa
- **Comentario:** Cobertura RLS completa tras migración 005 (agregó UPDATE/DELETE). Confirmado en PRODUCT_STATUS.md como resuelto.

---

### 4. **workspaces**
- **RLS habilitado:** ✅ Sí (migración 001)
- **Políticas:**
  - SELECT: ✅ `"workspaces_select"` (migración 001) — ownership via `teams → projects.account_id`
  - INSERT: ✅ `"workspaces_insert"` (migración 001) — ownership via `teams → projects.account_id`
  - UPDATE: ✅ `"workspaces_update"` (migración 025) — ownership via `teams → projects.account_id`
  - DELETE: ✅ `"workspaces_delete"` (migración 005) — ownership via `teams → projects.account_id`
- **Nivel de riesgo:** ✅ **BAJO** — cobertura completa
- **Comentario:** Cobertura RLS completa. UPDATE agregado en migración 025 (SEC-007 Workspace Lock fix).

---

### 5. **agent_sessions**
- **RLS habilitado:** ✅ Sí (migración 001)
- **Políticas:**
  - SELECT: ✅ `"agent_sessions_select"` (migración 001) — ownership via `workspaces → teams → projects.account_id`
  - INSERT: ✅ `"agent_sessions_insert"` (migración 001) — ownership via `workspaces → teams → projects.account_id`
  - UPDATE: ✅ `"agent_sessions_update"` (migración 005) — ownership via `workspaces → teams → projects.account_id`
  - DELETE: ✅ `"agent_sessions_delete"` (migración 005) — ownership via `workspaces → teams → projects.account_id`
- **Nivel de riesgo:** ✅ **BAJO** — cobertura completa
- **Comentario:** Cobertura RLS completa. Políticas Invitee redundantes eliminadas en migración 043 (arquitectura "dos edificios").

---

### 6. **messages**
- **RLS habilitado:** ✅ Sí (migración 002)
- **Políticas:**
  - SELECT: ✅ `"messages_select"` (migración 002) — ownership via `agent_sessions → workspaces → teams → projects.account_id`
  - INSERT: ✅ `"messages_insert"` (migración 002) — ownership via `agent_sessions → workspaces → teams → projects.account_id`
  - UPDATE: ❌ Falta
  - DELETE: ❌ Falta
- **Nivel de riesgo:** ⚠️ **MEDIO** — mensajes de chat no se editan/eliminan en flujo normal, pero UPDATE/DELETE deberían existir para operaciones de limpieza o corrección
- **Comentario:** Políticas Invitee redundantes eliminadas en migración 043. UPDATE/DELETE no implementados porque mensajes son append-only en diseño actual.

---

### 7. **checkpoints**
- **RLS habilitado:** ✅ Sí (migración 003)
- **Políticas:**
  - SELECT: ✅ `"checkpoints_select"` (migración 003) — ownership via `workspaces → teams → projects.account_id`
  - INSERT: ✅ `"checkpoints_insert"` (migración 003) — ownership via `workspaces → teams → projects.account_id`
  - UPDATE: ❌ Falta
  - DELETE: ❌ Falta
- **Nivel de riesgo:** ⚠️ **MEDIO** — gaps no activos hoy (ver re-evaluación)
- **Comentario:** Marcado como pendiente en PRODUCT_STATUS.md (RLS Connected Teams audit). Políticas Invitee agregadas en migración 041, eliminadas en migración 043 tras arquitectura "dos edificios".
- **Re-evaluación 2026-07-06 (Director Técnico + Product Owner):** Se confirmó por lectura de código que `/api/checkpoint/[id]/route.ts` solo implementa GET. No existe hoy ningún endpoint activo de DELETE/PATCH/PUT que dependa de las políticas faltantes. Conclusión: no es vulnerabilidad activa hoy — es hueco preventivo de cara a features futuras que aún no existen (ej. futuro "Delete Version" de checkpoints). Prioridad bajada de "Alto — antes de usuarios reales" a "Documentar como append-only por ahora — agregar política recién cuando se construya la primera feature real que la necesite".

---

### 8. **checkpoint_messages**
- **RLS habilitado:** ✅ Sí (migración 003)
- **Políticas:**
  - SELECT: ✅ `"checkpoint_messages_select"` (migración 003, corregida en migración 020) — ownership via `checkpoints → workspaces → teams → projects.account_id`
  - INSERT: ✅ `"checkpoint_messages_insert"` (migración 003) — ownership via `checkpoints → workspaces → teams → projects.account_id`
  - UPDATE: ❌ Falta
  - DELETE: ❌ Falta
- **Nivel de riesgo:** ⚠️ **MEDIO** — gaps no activos hoy (ver re-evaluación)
- **Comentario:** Marcado como pendiente en PRODUCT_STATUS.md (RLS Connected Teams audit). SELECT corregida en migración 020 (SEC-003 fix). Políticas Invitee agregadas en migración 041, eliminadas en migración 043.
- **Re-evaluación 2026-07-06 (Director Técnico + Product Owner):** Se confirmó por lectura de código que no existe hoy ningún endpoint activo de DELETE/PATCH/PUT que dependa de las políticas faltantes. checkpoint_messages se escribe una vez vía `/api/checkpoint` POST, sin modificación posterior. Conclusión: no es vulnerabilidad activa hoy — es hueco preventivo de cara a features futuras que aún no existen. Prioridad bajada de "Alto — antes de usuarios reales" a "Documentar como append-only por ahora — agregar política recién cuando se construya la primera feature real que la necesite".

---

### 9. **audit_log**
- **RLS habilitado:** ✅ Sí (migración 003)
- **Políticas:**
  - SELECT: ✅ `"audit_log_select"` (migración 003) — `account_id = auth.uid()`
  - INSERT: ✅ `"audit_log_insert"` (migración 003) — `account_id = auth.uid()`
  - UPDATE: ❌ Falta
  - DELETE: ❌ Falta
- **Nivel de riesgo:** 🔴 **ALTO** — tabla de auditoría crítica, no debe permitirse edición/eliminación por usuarios
- **Comentario:** Marcado como pendiente en PRODUCT_STATUS.md (RLS Connected Teams audit). UPDATE/DELETE intencionalmente ausentes — audit log debe ser append-only e inmutable. **Decisión correcta arquitecturalmente.**

---

### 10. **user_api_keys**
- **RLS habilitado:** ✅ Sí (migración 006)
- **Políticas:**
  - SELECT: ✅ `"api_keys_select"` (migración 006) — `account_id = auth.uid()`
  - INSERT: ✅ `"api_keys_insert"` (migración 006) — `account_id = auth.uid()`
  - UPDATE: ✅ `"api_keys_update"` (migración 006) — `account_id = auth.uid()`
  - DELETE: ✅ `"api_keys_delete"` (migración 006) — `account_id = auth.uid()`
- **Nivel de riesgo:** ✅ **BAJO** — cobertura completa
- **Comentario:** Cobertura RLS completa. Migración 026 (Vault encryption) no modificó políticas RLS.

---

### 11. **user_custom_providers**
- **RLS habilitado:** ✅ Sí (migración 007)
- **Políticas:**
  - SELECT: ✅ `"custom_providers_select"` (migración 007) — `account_id = auth.uid()`
  - INSERT: ✅ `"custom_providers_insert"` (migración 007) — `account_id = auth.uid()`
  - UPDATE: ✅ `"custom_providers_update"` (migración 007) — `account_id = auth.uid()`
  - DELETE: ✅ `"custom_providers_delete"` (migración 007) — `account_id = auth.uid()`
- **Nivel de riesgo:** ✅ **BAJO** — cobertura completa
- **Comentario:** Cobertura RLS completa.

---

### 12. **team_connections**
- **RLS habilitado:** ✅ Sí (migración 008)
- **Políticas:**
  - SELECT: ✅ `"connections_requester_select"` (migración 008) — `requester_account_id = auth.uid()`
  - SELECT: ✅ `"connections_receiver_select"` (migración 008) — `receiver_account_id = auth.uid() OR receiver_email = jwt email`
  - INSERT: ✅ `"connections_insert"` (migración 008) — `requester_account_id = auth.uid()`
  - UPDATE: ✅ `"connections_update"` (migración 008) — `requester_account_id = auth.uid() OR receiver_account_id = auth.uid()`
  - DELETE: ✅ `"connections_delete"` (migración 008) — `requester_account_id = auth.uid()`
- **Nivel de riesgo:** ✅ **BAJO** — cobertura completa con dual SELECT correcta
- **Comentario:** Cobertura RLS completa. Dual SELECT policy correcto — requester y receiver ambos pueden leer. DELETE solo requester (arquitecturalmente correcto — receiver usa PATCH reject). Migraciones 028-030, 035, 039, 042-044 agregaron campos sin modificar RLS.

---

### 13. **system_prompts**
- **RLS habilitado:** ✅ Sí (migración 011)
- **Políticas:**
  - ALL: ✅ `"Admin only"` (migración 011) — `FOR ALL USING (false)` — solo acceso via service role
- **Nivel de riesgo:** ✅ **BAJO** — policy correcta para tabla read-only system
- **Comentario:** Cobertura correcta — usuarios NO deben poder modificar system prompts. Acceso vía service role en backend.

---

### 14. **admin_events**
- **RLS habilitado:** ✅ Sí (migración 012)
- **Políticas:**
  - ALL: ✅ `"Admin only events"` (migración 012) — admin role check
- **Nivel de riesgo:** ✅ **BAJO** — policy correcta para tabla admin-only
- **Comentario:** Cobertura correcta — solo admins pueden acceder.

---

### 15. **handoff_packages**
- **RLS habilitado:** ✅ Sí (migración 013)
- **Políticas:**
  - ALL: ✅ `"Users manage own handoff packages"` (migración 013) — `auth.uid() = user_id`
- **Nivel de riesgo:** ✅ **BAJO** — cobertura completa via FOR ALL
- **Comentario:** Cobertura RLS completa usando FOR ALL (incluye SELECT, INSERT, UPDATE, DELETE).

---

### 16. **system_log**
- **RLS habilitado:** ✅ Sí (migración 014)
- **Políticas:**
  - ALL: ✅ `"Admin only system_log"` (migración 014) — admin role check
- **Nivel de riesgo:** ✅ **BAJO** — policy correcta para tabla admin-only
- **Comentario:** Cobertura correcta — solo admins pueden acceder.

---

### 17. **provenance_log**
- **RLS habilitado:** ✅ Sí (migración 014)
- **Políticas:**
  - ALL: ✅ `"Admin only provenance_log"` (migración 014) — admin role check
- **Nivel de riesgo:** ✅ **BAJO** — policy correcta para tabla admin-only
- **Comentario:** Cobertura correcta — solo admins pueden acceder.

---

### 18. **prompt_library**
- **RLS habilitado:** ✅ Sí (migración 016)
- **Políticas:**
  - SELECT: ✅ `"prompt_library_select"` (migración 016) — `user_id = auth.uid()`
  - INSERT: ✅ `"prompt_library_insert"` (migración 016) — `user_id = auth.uid()`
  - UPDATE: ✅ `"prompt_library_update"` (migración 016) — `user_id = auth.uid()`
  - DELETE: ❌ Falta
- **Nivel de riesgo:** ⚠️ **MEDIO** — falta DELETE, debería existir para que usuarios puedan eliminar sus propios prompts
- **Comentario:** SELECT/INSERT/UPDATE cubiertas. DELETE pendiente — feature no implementada en UI aún.

---

### 19. **prompt_assignments**
- **RLS habilitado:** ✅ Sí (migración 016)
- **Políticas:**
  - SELECT: ✅ `"prompt_assignments_select"` (migración 016) — ownership via `prompt_library.user_id`
  - INSERT: ✅ `"prompt_assignments_insert"` (migración 016) — ownership via `prompt_library.user_id`
  - UPDATE: ✅ `"prompt_assignments_update"` (migración 016) — ownership via `prompt_library.user_id`
  - DELETE: ❌ Falta
- **Nivel de riesgo:** ⚠️ **MEDIO** — falta DELETE (unassign debería ser posible)
- **Comentario:** SELECT/INSERT/UPDATE cubiertas. DELETE pendiente — unassign implementado en UI pero falta policy RLS.

---

### 20. **context_sources**
- **RLS habilitado:** ✅ Sí (migración 017)
- **Políticas:**
  - ALL: ✅ `"Users own context sources"` (migración 017) — `FOR ALL USING (user_id = auth.uid())`
- **Nivel de riesgo:** ✅ **BAJO** — cobertura completa via FOR ALL
- **Comentario:** Cobertura RLS completa usando FOR ALL. Migraciones 045-046 agregaron campos sin modificar RLS. Storage policies (`context_files_select`, `context_files_insert`, `context_files_delete`) correctamente implementadas en migración 017.

---

### 21. **saved_selections**
- **RLS habilitado:** ✅ Sí (migración 019)
- **Políticas:**
  - ALL: ✅ `"Users can manage their own saved selections"` (migración 019) — `FOR ALL USING (auth.uid() = user_id)`
- **Nivel de riesgo:** ✅ **BAJO** — cobertura completa via FOR ALL
- **Comentario:** Cobertura RLS completa usando FOR ALL.

---

### 22. **session_attachments**
- **RLS habilitado:** ✅ Sí (migración 021)
- **Políticas:**
  - SELECT: ✅ `"session_attachments_select"` (migración 021) — ownership via `agent_sessions → workspaces → teams → projects.account_id`
  - INSERT: ✅ `"session_attachments_insert"` (migración 021) — ownership via `agent_sessions → workspaces → teams → projects.account_id`
  - UPDATE: ❌ Falta
  - DELETE: ❌ Falta
- **Nivel de riesgo:** ⚠️ **MEDIO** — gaps no activos hoy (ver re-evaluación)
- **Comentario:** Marcado como pendiente en PRODUCT_STATUS.md (RLS Connected Teams audit). UPDATE/DELETE no implementados.
- **Re-evaluación 2026-07-06 (Director Técnico + Product Owner):** Se confirmó por lectura de código que session_attachments solo se escribe una vez vía POST fire-and-forget en `/api/chat/route.ts`, sin ningún endpoint de modificación posterior. No existe hoy ningún endpoint activo de DELETE/PATCH/PUT que dependa de las políticas faltantes. Conclusión: no es vulnerabilidad activa hoy — es hueco preventivo de cara a features futuras que aún no existen. Prioridad bajada de "Alto — antes de usuarios reales" a "Documentar como append-only por ahora — agregar política recién cuando se construya la primera feature real que la necesite".

---

### 23. **session_tool_calls**
- **RLS habilitado:** ✅ Sí (migración 021)
- **Políticas:**
  - SELECT: ✅ `"session_tool_calls_select"` (migración 021) — ownership via `agent_sessions → workspaces → teams → projects.account_id`
  - INSERT: ✅ `"session_tool_calls_insert"` (migración 021) — ownership via `agent_sessions → workspaces → teams → projects.account_id`
  - UPDATE: ❌ Falta
  - DELETE: ❌ Falta
- **Nivel de riesgo:** ⚠️ **MEDIO** — gaps no activos hoy (ver re-evaluación)
- **Comentario:** Marcado como pendiente en PRODUCT_STATUS.md (RLS Connected Teams audit). UPDATE/DELETE no implementados.
- **Re-evaluación 2026-07-06 (Director Técnico + Product Owner):** Se confirmó por lectura de código que session_tool_calls solo se escribe una vez vía POST fire-and-forget en `/api/chat/route.ts`, sin ningún endpoint de modificación posterior. No existe hoy ningún endpoint activo de DELETE/PATCH/PUT que dependa de las políticas faltantes. Conclusión: no es vulnerabilidad activa hoy — es hueco preventivo de cara a features futuras que aún no existen. Prioridad bajada de "Alto — antes de usuarios reales" a "Documentar como append-only por ahora — agregar política recién cuando se construya la primera feature real que la necesite".

---

### 24. **token_usage**
- **RLS habilitado:** ✅ Sí (migración 023)
- **Políticas:**
  - SELECT: ✅ `"Users can view their own token usage"` (migración 023) — `account_id = auth.uid()`
  - INSERT: ✅ `"Users can insert their own token usage"` (migración 023) — `account_id = auth.uid()`
  - UPDATE: ❌ Falta
  - DELETE: ❌ Falta
- **Nivel de riesgo:** 🔴 **ALTO** — tabla de billing crítica, cruza cuentas en Connected Teams
- **Comentario:** Marcado como pendiente en PRODUCT_STATUS.md (RLS Connected Teams audit). UPDATE/DELETE no implementados — tabla debería ser append-only (UPDATE/DELETE intencionalmente ausentes por diseño).

---

### 25. **human_messages**
- **RLS habilitado:** ✅ Sí (migración 037)
- **Políticas:**
  - SELECT: ✅ `"human_messages_select"` (migración 037) — `from_account_id = auth.uid() OR to_account_id = auth.uid()`
  - INSERT: ✅ `"human_messages_insert"` (migración 037) — `from_account_id = auth.uid()` + EXISTS check
  - UPDATE: ❌ Falta
  - DELETE: ❌ Falta
- **Nivel de riesgo:** ⚠️ **MEDIO** — tabla de chat humano cross-account, pero UPDATE/DELETE no implementados en flujo normal (mensajes append-only)
- **Comentario:** Políticas Invitee redundantes eliminadas en migración 043 (re-creadas idénticas para clarity). UPDATE/DELETE no implementados porque mensajes son append-only.

---

## Análisis de riesgo por nivel

### 🔴 Alto riesgo (2 tablas con gaps correctos por diseño)

1. **audit_log** — falta UPDATE/DELETE — **CORRECTO POR DISEÑO** (append-only inmutable)
2. **token_usage** — falta UPDATE/DELETE — **CORRECTO POR DISEÑO** (billing append-only)

### ⚠️ Medio riesgo (10 tablas con gaps no activos hoy)

**Re-evaluadas y bajadas de prioridad (2026-07-06):**
1. **checkpoints** — falta UPDATE/DELETE — sin endpoints activos hoy, append-only por ahora
2. **checkpoint_messages** — falta UPDATE/DELETE — sin endpoints activos hoy, append-only por ahora
3. **session_attachments** — falta UPDATE/DELETE — sin endpoints activos hoy, append-only por ahora
4. **session_tool_calls** — falta UPDATE/DELETE — sin endpoints activos hoy, append-only por ahora

**Otras tablas medio riesgo:**
5. **messages** — falta UPDATE/DELETE — append-only por diseño
6. **prompt_library** — falta DELETE — feature pendiente
7. **prompt_assignments** — falta DELETE — unassign sin policy
8. **human_messages** — falta UPDATE/DELETE — append-only por diseño
9. **accounts** — falta INSERT/UPDATE/DELETE — manejo vía Supabase Auth

### ✅ Bajo riesgo (15 tablas con cobertura completa)

Todas las demás tablas tienen cobertura RLS completa para sus operaciones requeridas.

---

## Recomendaciones prioritarias

### ✅ Prioridad 1 — Ya resuelto (re-evaluación 2026-07-06)

**Tablas previamente marcadas como "Alto riesgo — implementar antes de usuarios reales":**
- `checkpoints`, `checkpoint_messages`, `session_attachments`, `session_tool_calls`

**Re-evaluación:** Se confirmó por lectura de código (Director Técnico + Product Owner) que ninguna de estas 4 tablas tiene hoy un endpoint activo de DELETE/PATCH/PUT que dependa de las políticas faltantes. Son huecos preventivos de cara a features futuras que aún no existen (ej. futuro "Delete Version" de checkpoints). **No son vulnerabilidades activas hoy.**

**Decisión:** Prioridad bajada a "Documentar como append-only por ahora — agregar política recién cuando se construya la primera feature real que la necesite".

### Prioridad 2 — Post-MVP (cuando se implemente feature correspondiente)

1. **checkpoints + checkpoint_messages UPDATE/DELETE:**
   - Agregar políticas cuando se construya feature "Delete Version" o edición de checkpoints
   - Usar mismo patrón de ownership que SELECT/INSERT existente

2. **session_attachments + session_tool_calls UPDATE/DELETE:**
   - Agregar políticas cuando se construya feature de edición/eliminación de attachments o tool calls
   - Documentar explícitamente que son append-only hasta entonces

3. **prompt_library DELETE:**
   - Implementar cuando feature de eliminación de prompts se agregue a UI

4. **prompt_assignments DELETE:**
   - Corregir discrepancia: unassign existe en UI pero falta policy RLS

### Prioridad 3 — Documentar como correcto por diseño

1. **audit_log** — documentar explícitamente que UPDATE/DELETE ausentes por diseño (inmutabilidad)
2. **token_usage** — documentar explícitamente que UPDATE/DELETE ausentes por diseño (billing integrity)
3. **messages, human_messages** — documentar append-only arquitecturalmente

---

## Tablas sin RLS habilitado (ninguna detectada)

✅ Todas las tablas identificadas tienen `ENABLE ROW LEVEL SECURITY`.

---

## Notas metodológicas

- Auditoría realizada mediante lectura sistemática de 47 migraciones en `supabase/migrations/*.sql`
- No se ejecutó SQL contra base de datos
- No se modificaron archivos de código ni migraciones
- Políticas Invitee eliminadas en migración 043 tras arquitectura "dos edificios" (host_isolated_team_id + invitee_isolated_team_id) — confirmadas como redundantes y correctamente removidas
- Storage policies (`context_files_*`) auditadas como parte de context_sources

---

**Fin del reporte**
