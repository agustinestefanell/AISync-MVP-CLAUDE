# AUDIT_DOCUMENTATION_INTEGRITY.md

**Fecha:** 2026-08-19
**Tipo:** Auditoría de solo lectura — sin cambios de código, sin commit.
**Objetivo:** Verificar qué trazabilidad documental está realmente construida hoy (vs. solo visible en vivo o inferible) en Documentation Mode, Audit Log y objetos derivados (Checkpoint, Handoff Package, Saved Selection, Context Files, Prompt Assignments).
**Alcance:** `src/`, `supabase/migrations/`. Todo lo reportado fue verificado contra migraciones reales y código actual — nada es supuesto.

---

## PILAR 1 — INFORMATION AUDIT

**1a. Context Files activos en un momento pasado (Team/Session)**
NO existe — solo estado ACTUAL. `context_sources` (migración 017) tiene `status` (`'active'`/`'deleted'`) y `updated_at`, pero no hay tabla de versionado ni snapshot por mensaje. Lo único reconstruible indirectamente: `created_at` de la fila + evento `context_file_deleted` en `audit_log` (con timestamp) si fue borrado — permite acotar "estuvo activo entre X e Y", pero no es una funcionalidad ya construida, es una inferencia manual cruzando dos tablas.

**1b. Prompts asignados a Worker/Team en un momento dado**
NO existe historial temporal confiable — solo asignación actual. `prompt_assignments` (migración 016) usa soft-delete (`is_active boolean`, comentario en el schema: "Desactivar con is_active=false; no eliminar"), así que las filas viejas no se borran — pero no hay columna `updated_at`/`deactivated_at`. Si una asignación se reactiva, reutiliza la fila con el `created_at` original. Resultado: se puede ver que una asignación existió alguna vez, pero no reconstruir con certeza qué estaba activo en una fecha pasada específica. Cero eventos en `audit_log` para altas/bajas de asignación (confirmado por grep: `PromptLibrary.tsx` líneas 210-265 hace el update/insert directo, sin ningún insert a `audit_log`).

**1c. Modelo/agente que trabajó en cada mensaje — consultable, no solo visible en vivo**
Parcial, con gap real. `messages` (migración 002 + 022) NO tiene columna `model`/`provider` — solo `session_id`. El modelo se infiere hoy vía `agent_sessions.provider`/`agent_sessions.model` (mismo id para siempre, no se recrea en Refresh Session — confirmado en `AgentPanel.tsx` línea 457-468). Problema: si el usuario cambia el modelo del agente en `EditTeamModal` (`teams/[id]/route.ts` línea 120-129), ese UPDATE sobreescribe `provider`/`model` sin dejar rastro — los mensajes viejos "heredan" el valor actual, que puede no ser el que realmente los generó. La única fuente con snapshot histórico real es `token_usage` (migración 023): tiene `provider`+`model`+`created_at` por cada llamada a la API, pero sin FK a `messages.id` — solo cruzable por `session_id` + proximidad de timestamp, no por join directo.

**1d. Vínculo explícito Checkpoint ↔ objetos que lo alimentaron**
NO existe. `checkpoint_messages` (migración 003 + 038) copia `role`/`content`/`position` — es una copia desnormalizada, sin FK a `messages.id`. Mismo patrón en `saved_selections.messages` (JSONB, migración 019) y `handoff_packages.messages` (JSONB, migración 013): ambos reciben el array ya armado desde el cliente, sin IDs de mensaje. Ningún objeto documental referencia qué Context Files o Prompts estaban activos al momento de crearlo. Todo se infiere por cercanía temporal/workspace.

---

## PILAR 2 — AUDIT TRAIL

**2a. `checkpoint.created`/`checkpoint.loaded` como eventos distinguibles, con timestamp**
SÍ, pero con nombres reales distintos a los de la consigna:
- `checkpoint.created` → `event_type: 'save_version'` — `src/app/api/checkpoint/route.ts` línea 97, `metadata: { checkpoint_id, name, purpose, message_count }`.
- `checkpoint.loaded` → `event_type: 'resume_work'` — `src/components/workspace/WorkspaceShell.tsx` línea 543, `metadata: { checkpoint_id, name }`.
Ambos con `created_at timestamptz` real (columna de `audit_log`, migración 003).

**2b. Campo estable de "workspace/session lineage"**
SÍ, dos niveles, ninguno se llama literalmente "lineage":
- `workspace_id` (tabla `workspaces`) — agrupa los 3 paneles (manager/worker1/worker2) de un team. Presente en `checkpoints`, `handoff_packages`, `saved_selections`, `audit_log` y `messages` (vía `session_id` → `agent_sessions.workspace_id`).
- `agent_sessions.id` — identifica un panel específico. Es permanente: "Refresh Session" solo limpia el estado local del historial que ve el modelo (`AgentPanel.tsx` línea 458 `setApiMessages([])`), NO borra ni recrea la fila de `agent_sessions`.

**2c. Enumeración de eventos — grep exhaustivo de `event_type:` en todo `src/`**

| Evento de la consigna | ¿Existe? | Nombre real / evidencia |
|---|---|---|
| file.uploaded | Parcial | `attachment_uploaded` — SOLO adjuntos de chat (`chat/route.ts:250`). Subida de Context Files (`/api/context` POST, rama FormData) no genera ningún evento — `createContextSource`/`extractAndSaveText` no tocan `audit_log`. |
| context_file.loaded | NO | No hay evento cuando un Context File se inyecta en un envío de mensaje — inyección silenciosa (`getContextSourcesForRuntime` en `chat/route.ts:164`, sin insert a `audit_log`). |
| saved_context.loaded | SÍ | `context_loaded_from_documentation` — `LoadContextModal.tsx:177` (destino chat) y `context/route.ts:105` (destino Context Files), con `metadata.destination: 'context_files' \| 'chat'`. |
| save_selection.created | SÍ | `save_selection` — `save-selection/route.ts:62`. |
| handoff.created | SÍ | `handoff_package.created` — `handoff-package/route.ts:56`. |
| handoff.received | NO | No existe ningún endpoint que transicione `handoff_packages.status` de `'sent'`→`'received'`. Las 4 rutas bajo `api/documentation/` (browse, checkpoint, handoff, selection) son solo GET. El CHECK constraint de `status` permite `'received'` pero nada en el código lo escribe. |
| review_forward.created | SÍ | `review_forward` — `WorkspaceShell.tsx` líneas 223, 260, 289 (3 variantes de destino). |
| checkpoint.created | SÍ | `save_version` (ver 2a). |
| cambios de prompt/modelo asignado | NO | `teams/[id]/route.ts`, rama de update normal (líneas 108-130, incluye el loop que actualiza `agent_sessions.provider`/`model`) no inserta nada en `audit_log` — solo la rama `action: 'archive'` lo hace (línea 53-70). Cambiar el modelo de un agente hoy es 100% silencioso. |

**2d. Mensajes de chat clave dentro de un tramo — ¿vienen del Audit Log o hay que cruzar tabla aparte?**
Hay que cruzar tabla aparte, siempre. No existe ningún evento tipo "message_sent" en `audit_log` — el envío normal de un mensaje de chat no genera fila de auditoría. Para traer mensajes de un tramo hay que consultar `messages` (o `human_messages` para chat humano) filtrando por `session_id`/`workspace_id` + rango `created_at`, y cruzar por timestamp con los eventos de `audit_log` del mismo tramo.

---

## PILAR 3 — CHAIN OF CUSTODY

**3a. `handoff.received` — ¿se registra la recepción?**
NO existe. Ver 2c — no hay ninguna ruta que escriba ese evento ni que cambie `status` a `'received'`.

**3b. "Load Saved Context" — ¿guarda referencia (FK/ID) al objeto original?**
Depende del destino, verificado en `LoadContextModal.tsx`:
- Destino "→ Context Files": SÍ. Se crea una fila en `context_sources` con `origin_type` (`'handoff_package'` \| `'saved_selection'` \| `'checkpoint'`) y `origin_message_id` = el ID del objeto (no de un mensaje puntual — el nombre de columna es engañoso, ya documentado como deuda técnica en `handoff-2026-07-b.md` 2026-08-03). Código: `LoadContextModal.tsx:220` (`originMessageId: item.id`) → `context/route.ts:90-91` (persistido). Esto SÍ permite "esto se volvió a usar después" hacia adelante desde ese objeto.
- Destino "→ Chat": NO hay FK. El contenido se inyecta como texto plano con prefijo `[Loaded from Documentation Mode — Tipo: nombre]` (`LoadContextModal.tsx:200`) directo en `messages.content` — `messages` no tiene ninguna columna para guardar la proveniencia. Solo queda un rastro no estructurado en `audit_log.metadata.source_id` (JSON, no FK real).

**3c. FK explícita objeto → objeto nuevo derivado (ej. Handoff → Checkpoint)**
NO existe, en ningún caso, salvo el 3b (Context Files). No hay ninguna tabla de relaciones objeto-objeto. Todo lo demás (Handoff derivando en Checkpoint, Saved Selection citada en otro objeto, etc.) se infiere por cercanía temporal/workspace — confirmado también por 1d.

---

## PILAR 4 — HISTORIAL DE NOMBRES

**4a. Project — ¿el nombre anterior queda guardado al editar?**
NO, se pierde sin rastro. `projects/[id]/route.ts` PATCH (línea 55: `updates.name = name.trim()`) sobreescribe directo. Sin tabla de historial, sin `audit_log` insert en toda la ruta.

**4b. Team y Session — mismo chequeo**
- Team: mismo resultado que Project. `teams/[id]/route.ts`, rama de update normal (línea 111: `name: name.trim()`) sobreescribe sin historial y sin evento de auditoría (solo la rama de archive audita, y ni siquiera esa registra el nombre anterior).
- Session: la pregunta no aplica como está planteada — `agent_sessions` no tiene columna `name`. Lo único editable ahí es `description` (migración 018), sin historial tampoco.

---

## Resumen ejecutivo para diseñar la próxima OE

**Lo que ya existe y es sólido para construir el nuevo Audit View:** los eventos `save_version`/`resume_work` con `checkpoint_id` en metadata, `workspace_id`/`session_id` como campos de scope estables, y el FK real `origin_type`/`origin_message_id` en `context_sources` para Load Saved Context → Context Files.

**Lo que falta construir por completo (candidato a entrar en el contrato de la próxima OE):**
1. Evento de recepción de Handoff (`handoff.received`).
2. Evento para cambios de modelo/prompt asignado.
3. Evento para upload/injection de Context Files.
4. Cualquier forma de reconstrucción histórica de "qué estaba activo cuándo" (Context Files por scope, Prompts por asignación) — el hueco más grande.

Los primeros 3 no requieren decisiones de diseño complejas: son adiciones de `audit_log.insert()` siguiendo el mismo patrón fail-open ya usado en todo el proyecto. El historial de nombres (Project/Team) y la reconstrucción histórica del punto 4 sí necesitarían tabla nueva, no solo un evento — ameritan su propia OE de diseño antes de tocar código.

**Riesgo para la Regla Cero:** ninguno de estos hallazgos requiere tocar `main` ni producción hoy — es 100% diagnóstico.
