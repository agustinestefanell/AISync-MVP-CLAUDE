# AISync — Decisions Registry

Registro de decisiones de producto y arquitectura tomadas durante el desarrollo del MVP.

Este archivo no es roadmap.
Este archivo no reemplaza `AISyncPlans.md`, `PRODUCT_STATUS.md` ni `handoff.md`.

Su función es preservar decisiones ya tomadas para evitar discusiones repetidas, contradicciones futuras o pérdida de contexto entre sesiones.

Regla: no documentar como decisión nada que no esté respaldado por `handoff.md`, `AISyncPlans.md` o `PRODUCT_STATUS.md`.

---

## 2026-05-17 — Repo activo vs repos de demo

- **Decisión:** El repo activo del MVP es `C:\proyectos\AISync\aisync-mvp-claude`. Los repos de demo (`AISYNC-DEMO-V2`, `AISYNC-DEMO-MVP`, `C:\proyectos\AISync\MVP`) se usan exclusivamente como referencia de portación — no se modifican bajo ninguna circunstancia.
- **Motivo:** Preservar la integridad de la demo como referencia visual y funcional estable. Si la demo se modifica, se pierde la referencia canónica de portación.
- **Alternativas descartadas:** Modificar la demo para experimentar — descartado. Implementar sin leer la demo — descartado porque genera rework y reproduce errores ya resueltos.
- **Consecuencia:** Toda OE comienza con "Demo First": leer el código equivalente en la demo antes de implementar. Si no hay equivalente en la demo, se implementa directo en el MVP sin portación. La regla Demo First está codificada en `CLAUDE.md` y `PromtsOperativos.md`.

---

## 2026-05-20 — SAT vs MAT como atributos operativos reales del team

- **Decisión:** SAT (Single Agent Type) y MAT (Multi Agent Type) son atributos calculados del team basados en los providers de sus agentes, no filtros visuales ni toggles cosméticos. Se calculan con `useMemo` en `WorkspaceShell`: si todos los agentes usan el mismo provider → SAT; si hay providers distintos → MAT.
- **Motivo:** SAT determina si se inyecta snapshot de contexto de pares en el chat (Capa 4 del ensamblado de prompt). MAT no recibe snapshot porque cada agente puede tener provider distinto y rol independiente — inyección ciega podría confundir modelos con contexto irrelevante.
- **Alternativas descartadas:** Snapshot para MAT — diferido sin fecha. Sin un flag confiable de "MAT coordinado", la inyección sería arbitraria. Pendiente revisión cuando MAT tenga casos de uso definidos con suficiente semántica.
- **Consecuencia:** El badge SAT/MAT en workspace ribbon es informativo, no interactivo. La lógica de snapshot activa solo en SAT. Calculado como `providers = new Set(workspace.agent_sessions.map(s => s.provider)); return providers.size === 1 ? 'SAT' : 'MAT'`.

---

## 2026-05-20 — Control Plane vs Content Plane

- **Decisión:** El sistema de datos se divide en dos planos arquitectónicos. **Control Plane** (propiedad de AISync): `accounts`, `projects`, `teams`, `workspaces`, `agent_sessions`, `audit_log`, `user_api_keys`, `user_custom_providers`, `team_connections` — datos de gobernanza y trazabilidad. **Content Plane** (propiedad del cliente, migrable): `checkpoints`, `checkpoint_messages`, `messages`, `handoff_packages`, `context_sources` — datos operativos del cliente.
- **Motivo:** Separa lo que pertenece a AISync (control y gobernanza) de lo que pertenece al cliente (contenido operativo). Permite diseñar el Content Plane como migrable a otra plataforma si el cliente lo requiere. Formalizado como Bloque 13.
- **Alternativas descartadas:** Tratar todo como base de datos de AISync — descartado porque mezcla propiedad y hace imposible la migración futura del contenido del cliente.
- **Consecuencia:** Todo objeto de Content Plane debe diseñarse como migrable. Nunca tratarlo como base canónica de AISync. Código de referencia: `src/lib/db/planes.ts`. Flags `content_plane = true` y `client_owned = true` aplicados en migraciones 010 y 013.

---

## 2026-05-28 — Save Version vs Session Backup vs Saved Selection

- **Decisión:** Son tres objetos distintos con semánticas distintas. (1) **Save Version** es el nombre de la acción en UI; el objeto resultante es un `checkpoint` en DB con `purpose` configurable por el usuario (Documentation, Handoff, Session Backup, Evidence). (2) **Session Backup** es un valor del campo `purpose` dentro de la tabla `checkpoints` — indica backup informal de una sesión sin intención de handoff formal. (3) **Saved Selection** es un objeto separado (`saved_selections`) que guarda mensajes específicos seleccionados por el usuario de uno o más paneles, sin ser un snapshot completo de la sesión.
- **Motivo:** Los tres nombres se usaban intercambiablemente en conversaciones y código, generando confusión sobre qué se guardaba, dónde y con qué estructura de datos.
- **Alternativas descartadas:** Unificar en un solo tipo de objeto — descartado porque tienen casos de uso distintos. Save Version/checkpoint preserva el estado completo de una sesión para retomar (`Resume Work`). Saved Selection preserva fragmentos seleccionados para referencia documental cruzada.
- **Consecuencia:** `checkpoints` y `saved_selections` son tablas separadas en DB. Los detail panels de Repository View los muestran de forma distinta. `Resume Work` solo aplica a checkpoints. `Open Workspace →` aplica a handoffs y saved selections. Los badges en Repository View distinguen: `Handoff Package`, `Checkpoint`, `Saved Selection`.

---

## 2026-05-28 — project_id = null en Saved Selections (MVP)

- **Decisión:** En el MVP, `project_id` se persiste como `null` en `saved_selections`. La cadena de props `workspace → WorkspaceShell → AgentPanel` no expone `project_id` al nivel donde se ejecuta `openSaveSelectionModal()`, por lo que el POST a `/api/save-selection` envía `project_id: null` explícitamente.
- **Motivo:** Extender la cadena de props para exponer `project_id` requería cambios en `WorkspaceShell`, `AgentPanel` y la route — fuera del scope de la OE de Save Selection. La tabla tiene la columna nullable (`project_id UUID REFERENCES projects ON DELETE CASCADE` nullable) — se acepta null como valor temporal de MVP.
- **Alternativas descartadas:** Inventar `project_id` desde el contexto del workspace vía query adicional — descartado. No inventar project si la relación no es verificable en el punto de ejecución.
- **Consecuencia:** Los `saved_selections` creados en MVP tienen `project_id = null`. `SavedSelectionDetailPanel` muestra `'—'` en la row Project. La UI soporta el fallback con `ss.project_name ?? '—'`. Cuando se exponga `project_id` en la cadena, el POST podrá enviarlo. Las selecciones antiguas quedan con null sin retroactividad.

---

## 2026-05-29 — Handoff vs Handoff Package (semántica y labels)

- **Decisión:** `Handoff` es un valor del campo `purpose` en la tabla `checkpoints` — indica que ese checkpoint tiene intención de transferencia formal entre agentes. `Handoff Package` es un objeto independiente en la tabla `handoff_packages` con estructura propia: `from_agent`, `to_agent`, `context`, `messages[]`, `status`. No son intercambiables semánticamente ni en la UI.
- **Motivo:** Repository View usaba el label `Handoff` para objetos de `handoff_packages`, confundiéndolo con checkpoints que tienen `purpose: 'Handoff'`. Generaba ambigüedad para el usuario y para los workers de documentación.
- **Alternativas descartadas:** Unificar bajo un único término — descartado porque tienen estructuras de datos, casos de uso y metadata distintos. Un checkpoint `purpose: Handoff` no tiene `from_agent/to_agent`; un Handoff Package no tiene `purpose` ni `doc_state`.
- **Consecuencia:** `PURPOSE_BADGE['Handoff']` y `PURPOSE_LABELS['Handoff']` aplican a checkpoints. El badge de `handoff_packages` debe decir `Handoff Package`. Regla aplicada en `RepositoryView.tsx` — badge del detail panel (línea 173) y badge de la card en la lista (línea 616).

---

## 2026-05-29 — Agent labels via session_id en checkpoint messages

- **Decisión:** Los labels de agente en `MiniChatPreview` de checkpoints se resuelven via join `checkpoint_messages → agent_sessions` usando la FK `session_id`. El campo `agent_role` (string) se expone por mensaje en `DocCheckpoint.checkpoint_messages` como campo opcional `agent_role?: string`. No se expone `session_id` ni el objeto `agent_sessions` completo en `DocCheckpoint` — solo el dato de UI mínimo.
- **Motivo:** Sin el join, `MiniChatPreview` mostraba `'AI'` genérico para todos los mensajes de assistant en checkpoints, sin identificar qué agente (Manager, Worker 1, Worker 2) emitió cada mensaje.
- **Alternativas descartadas:** Exponer `session_id` y `agent_sessions` completo en `DocCheckpoint` — descartado por encapsulamiento y por el principio de exposición mínima necesaria en el tipo de UI.
- **Consecuencia:** `getDocCheckpoints()` incluye `checkpoint_messages(content, role, position, session_id, agent_sessions(agent_role))`. `CheckpointDetailPanel` muestra label real via `AGENT_LABEL[msg.agentRole]` y añade row `AI Agent` en Secondary Metadata. Checkpoints sin join existente retornan `undefined` en `agent_role` — se muestra `'AI'` como fallback válido.

---

## 2026-05-29 — "Show less power, not less truth"

Fecha usada como fecha de registro documental, no como fecha original de decisión.

- **Decisión:** El MVP no debe guardar menos información sobre lo que ocurrió en las sesiones de trabajo. El sistema debe registrar y conservar la información completa. Lo que se muestra al usuario según su plan o etapa del producto es una decisión de packaging y monetización — no una razón para empobrecerla persistencia de datos.
- **Motivo:** Principio de producto para evitar deuda de datos futura. Si se guarda menos ahora, retroalimentar el sistema con datos históricos completos es costoso o imposible. El sistema documental de AISync solo tiene valor si los datos son completos y confiables.
- **Alternativas descartadas:** No documentadas explícitamente en los archivos fuente.
- **Consecuencia:** `audit_log`, `checkpoint_messages`, `saved_selections`, `messages` se guardan completos. La capa de presentación decide qué mostrar según contexto y plan del usuario — nunca la capa de persistencia decide guardar menos.

---

## 2026-05-29 — "Albañilería before terminaciones"

Fecha usada como fecha de registro documental, no como fecha original de decisión.

- **Decisión:** Priorizar estructura de datos, migraciones, API routes, árbol de componentes y trazabilidad antes que polish visual (CSS, animaciones, transiciones, rediseños decorativos). No usar terminaciones para ocultar una base funcional débil.
- **Motivo:** Regla de ejecución para evitar que el sistema se vea bien pero falle en el fondo. Un bug de arquitectura no resuelto no desaparece con una interfaz pulida. El costo de deshacer terminaciones mal aplicadas sobre una base rota es mayor que construir la base primero.
- **Alternativas descartadas:** No documentadas explícitamente en los archivos fuente.
- **Consecuencia:** Las OEs Decorativas (A y B) para Documentation Mode se ejecutaron después de que las cinco vistas estuvieran funcionalmente completas. El light mode global se aplicó después de que la arquitectura de componentes estuviera estable. Los bloques de albañilería (migraciones 001–019, API routes, Content/Control Plane) precedieron a cualquier OE decorativa.

---

## 2026-05-29 — Scope de Cross Verification diferido

Fecha usada como fecha de registro documental, no como fecha original de decisión.

- **Decisión:** Cross Verification (verificación cruzada entre agentes, entre versiones de documentos, entre checkpoints de distintos workspaces) es un concepto del sistema documental que está diferido sin fecha. No se implementó en ninguno de los Bloques 1–20. Requiere su propio capítulo de diseño con scope, modelo de datos y criterios de verificación antes de implementarse.
- **Motivo:** El scope de Cross Verification no estaba definido con suficiente precisión para implementarlo dentro de los bloques de Documentation Mode existentes. Mezclarlo como fix menor dentro de Repository View o Investigate View generaría deuda arquitectural difícil de deshacer.
- **Alternativas descartadas:** Implementarlo dentro de fixes menores de Documentation Mode — descartado porque requiere diseño de modelo de datos propio, queries dedicadas y UI específica. No es un toggle en un componente existente.
- **Consecuencia:** No hay tablas, queries ni UI para Cross Verification en el MVP actual. El estado en `PRODUCT_STATUS.md` es `Needs Review`. Pendiente de OE propia con definición explícita de scope, modelo de datos y criterios de verificación aceptable.

---

## 2026-06-02 — Token counters: versión correcta por fases

- **Decisión:** implementar captura real de tokens desde el stream, no aproximaciones.
- **Motivo:** el dato de consumo es una métrica de confianza. Un valor aproximado daña credibilidad y contamina la base para costos futuros (por sesión, por team, por plan).
- **Alternativas descartadas:** (A) usar `max_tokens` como estimación — demasiado bruto, mide techo no uso real. (B) request separado sin streaming — artificial, caro y arquitectónicamente sucio.
- **Consecuencia:** feature diferido hasta cerrar backlog estructural. Se implementará en 3 fases: tabla + contrato → captura por provider → UI modal.

---

## 2026-06-02 — Page subtitle actions for page-level help modals

- **Decisión:** `TopRibbon` debe soportar `pageSubtitleOnClick` como patrón estándar para abrir modales de ayuda por página. Si existe `pageSubtitleHref`, el link tiene prioridad sobre el callback.
- **Motivo:** Permite reutilizar el subtítulo superior como punto de acceso consistente a guías de página sin crear botones secundarios dispersos. Para Documentation Mode específicamente, la única forma válida de conectar el callback con el modal es que el client component (`DocClient`) maneje su propio `TopRibbon` y `BottomRibbon`, dado que `page.tsx` es un server component y no puede pasar funciones como props.
- **Alternativas descartadas:** Crear botones de ayuda específicos y distintos por página — descartado, genera inconsistencia visual. Usar solo links externos — descartado, los modales in-page son más contextuales. Pasar callback desde server component — inválido en Next.js. Modificar `AppLayout` para pasar `pageSubtitleOnClick` — no resuelve el problema raíz.
- **Consecuencia:** Main Workspace, Audit Log, Teams Map y futuras páginas pueden usar el subtítulo como disparador de ayuda contextual en OEs futuras. Para cada una, el client component principal de la página deberá gestionar su propio `TopRibbon` o se deberá evaluar si `AppLayout` puede recibir el callback desde un client wrapper. Documentation Mode ya implementa este patrón: `DocClient` gestiona `TopRibbon` + `BottomRibbon` directamente.


---

## 2026-06-02 — Visión estratégica: AISync + Claude Code via VS Code

- **Decisión:** Registrar como visión estratégica confirmada la integración de Claude Code (VS Code) como Worker real dentro de un Team de AISync.
- **Concepto:** Un Manager redacta una OE en el Workspace, la envía via Review & Forward al Worker Claude Code. Claude Code la recibe, la ejecuta en el repositorio y devuelve el reporte al panel del Manager. Todo queda trazado en Audit Log con checkpoints vinculados a cambios reales en el repo.
- **Habilitadores ya disponibles:** R&F funcionando, Context Files en AISync, ProjectStartProtocol.docx, Claude Code como agente real via MCP.
- **Lo que falta:** Bridge técnico entre panel de Worker en AISync y Claude Code en VS Code — webhook o MCP server que escuche mensajes del panel y los reenvíe al terminal.
- **Acelerador clave:** ProjectStartProtocol pre-cargado como Context File en el Worker Claude Code — garantiza estándares operativos desde el primer mensaje sin ramp-up manual.
- **Alternativas descartadas:** Integración via copy-paste manual entre AISync y VS Code — no escala, no es trazable, rompe el flujo de gobernanza.
- **Consecuencia:** AISync pasa de ser gobernanza sobre chat a ser gobernanza sobre trabajo real de código. Es la demostración más concreta de la propuesta de valor del producto.
- **Estado:** Diferido — Fase 3+. Requiere bridge técnico. Registrado como visión estratégica confirmada.

---

## 2026-06-04 — Connect Team: seguridad conocida y gaps diferidos

- **Decisión:** Activar Connect Team en MVP con seguridad básica existente. Gaps de seguridad identificados y diferidos conscientemente para etapa post-MVP.
- **Seguridad implementada hoy:** RLS activo en `team_connections`. Solo el requester puede crear conexiones. Receptor ve solicitud por email antes de aceptar. Solo las partes involucradas pueden ver sus conexiones. Solo requester o receiver pueden actualizar status.
- **Gaps diferidos:**
  1. No se verifica que el email receptor sea una cuenta AISync real antes de enviar solicitud.
  2. No hay límite de solicitudes por cuenta — riesgo de spam.
  3. Lookup email→account_id no está protegido contra suplantación.
  4. Los objetos compartidos no tienen RLS propio — alcance de visibilidad del externo no definido.
  5. No hay expiración de solicitudes pendientes.
- **Alternativas descartadas:** Bloquear Connect Team hasta resolver todos los gaps — descartado porque el flujo de solicitud/aceptación es funcional y los riesgos son bajos en contexto MVP de una cuenta por usuario.
- **Consecuencia:** Antes de activar Connect Team en producción multi-cuenta real, resolver gaps 1 y 3 como mínimo. Los demás son mejoras de hardening.
- **Estado:** Diferido post-MVP. Registrado como deuda de seguridad conocida.

---

## 2026-06-04 — checkpoint_messages RLS: política live no coincidía con migración base

- **Decisión:** Aplicar parche correctivo `020_fix_checkpoint_messages_rls.sql` en producción y registrarlo como migración canónica.
- **Hallazgo:** La política live en Supabase para `checkpoint_messages_select` tenía solo JOINs estructurales sin filtrar por `auth.uid()`. La migración `003_checkpoints.sql` sí incluía `p.account_id = auth.uid()` — la divergencia implica que la política en producción fue modificada o sobrescrita fuera del control de migraciones en algún punto.
- **Fix aplicado:** Cadena completa `checkpoint_messages → checkpoints → workspaces → teams → projects` con `p.account_id = auth.uid()`. El ownership correcto es `projects.account_id`, no `teams.account_id` — `teams` no tiene columna `account_id` en el schema de AISync.
- **Lección crítica:** La tabla `teams` no tiene `account_id` directo. El ownership de toda entidad debajo de `teams` (workspaces, agent_sessions, checkpoints, checkpoint_messages) se resuelve siempre a través de `teams → projects → projects.account_id`. Cualquier OE o política RLS que asuma `teams.account_id` está equivocada.
- **Alternativas descartadas:** Modificar `003_checkpoints.sql` directamente — descartado porque alteraría la historia de migraciones. La migración 020 actúa como parche documentado y trazable.
- **Estado:** Cerrado — migración aplicada en producción el 2026-06-04.

---

## 2026-06-04 — Trazabilidad de adjuntos: evento siempre, documento solo si promoción

- **Decisión:** Todo adjunto genera evento de trazabilidad automático. No todo adjunto crea objeto documental en Documentation Mode.
- **Fórmula:** cada adjunto = evento / save/checkpoint = referencia estructurada / promoción explícita = objeto documental
- **Capas:**
  - Capa A (siempre): evento automático con filename, mime_type, size, hash, session_id, workspace_id, provider, created_at
  - Capa B (si Save Version): checkpoint referencia adjuntos que participaron sin crear documento nuevo
  - Capa C (solo si promoción explícita): adjunto pasa a Source Document Reference u objeto canónico en Doc Mode
- **Arquitectura:** tabla propia `session_attachments` o `message_attachments` — no en `checkpoint_messages`
- **Campos mínimos:** attachment_id, message_id, session_id, workspace_id, account_id, filename, mime_type, size, hash, provider, provider_file_id, created_at, expires_at, status
- **Alternativas descartadas:** (A) solo trazar al hacer Save Version — deja ciego todo adjunto que se usó pero no se checkpointó. (B) cada adjunto crea documento automático en Doc Mode — llena Documentation Mode de basura automática.
- **Estado:** Diferido — implementar después de cerrar capítulo de búsqueda en internet.

---

## 2026-06-05 — Token usage como tabla separada

- **Decisión:** El consumo de tokens se modela en tabla dedicada `token_usage`, no como metadata embebida en `audit_log` ni en `messages`.
- **Razón:** Requiere trazabilidad independiente por `account_id`/`workspace_id`/`session_id`/`provider`/`model` para métricas, límites y billing readiness futuro. Embebido en `audit_log` mezcla capas (control vs. billing); embebido en `messages` no captura llamadas sin mensaje persistido (tool calls, etc.).
- **Estructura:** `id`, `account_id`, `workspace_id`, `session_id`, `provider`, `model`, `input_tokens`, `output_tokens`, `total_tokens`, `created_at`. RLS por `account_id = auth.uid()` directo.
- **Estado:** Accepted — Fase 1 crea migración `023_token_usage.sql` y contrato TypeScript `TokenUsage`. Aplicación en Supabase manual pendiente. Fases 2 y 3 (captura runtime + UI) diferidas.
- **Alternativas descartadas:** Metadata en `audit_log` — mezcla responsabilidades; metadata en `messages` — no cubre tool calls ni requests sin mensaje.

---

## 2026-06-04 — Trazabilidad de búsquedas web

- **Decisión:** Toda búsqueda web ejecutada por el tool loop debe generar evento de trazabilidad, incluyendo los links fuente utilizados.
- **Qué registrar:** query enviada a Tavily, timestamp, provider del agente que la solicitó, session_id, workspace_id, resultados (o referencia a ellos), sources: [{title, url}].
- **Cuándo:** en el momento de ejecución del tool loop en `chat/route.ts`, antes o después de llamar `tool.execute()`.
- **Dónde:** misma arquitectura que attachment traceability — evento en `audit_log` o tabla propia `session_tool_calls`.
- **Campos mínimos:** tool_call_id, tool_name, query, session_id, workspace_id, account_id, provider, model, created_at, result_summary, sources: [{title, url}].
- **Cambio de contrato requerido:** `ToolExecutor.execute()` debe retornar `{ content: string, sources?: {title: string, url: string}[] }` en lugar de solo `string`. Afecta `src/lib/tools/types.ts`, `src/lib/tools/web-search.ts` y `src/app/api/chat/route.ts`.
- **Alternativas descartadas:** no trazar búsquedas ni links — deja ciego el uso de herramientas externas y la fuente real de información usada por el modelo.
- **Estado:** Diferido — implementar junto con trazabilidad de adjuntos post-capítulo de búsqueda.
