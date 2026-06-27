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
  1. ~~No se verifica que el email receptor sea una cuenta AISync real antes de enviar solicitud.~~ **Resuelto 2026-06-09:** `POST /api/connections` ahora consulta `accounts` por email antes del INSERT. Requests a emails sin cuenta AISync devuelven 400 `No AISync account found with that email.`
  2. No hay límite de solicitudes por cuenta — riesgo de spam. *(hardening pendiente)*
  3. ~~Lookup email→account_id no está protegido contra suplantación.~~ **Resuelto 2026-06-09:** `PATCH /api/connections/[id]` verifica que `connection.receiver_email === user.email` antes de accept/reject. `DELETE` verifica que `connection.requester_account_id === user.id`. Terceros con UUID no pueden actuar sobre conexiones ajenas.
  4. Los objetos compartidos no tienen RLS propio — alcance de visibilidad del externo no definido. *(hardening pendiente)*
  5. No hay expiración de solicitudes pendientes. *(hardening pendiente)*
- **Alternativas descartadas:** Bloquear Connect Team hasta resolver todos los gaps — descartado porque el flujo de solicitud/aceptación es funcional y los riesgos son bajos en contexto MVP de una cuenta por usuario.
- **Consecuencia:** Gaps 1 y 3 resueltos. Gaps 2, 4, 5 siguen siendo mejoras de hardening post-primera beta.
- **Estado:** Gaps 1 y 3 cerrados (2026-06-09). Gaps 2, 4, 5 diferidos post-beta.

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

## 2026-06-05 — Token usage: callback onUsage desacoplado del provider

- **Decisión:** Token usage se captura mediante callback opcional `onUsage` en `StreamOptions`, no acoplando DB persistence directamente dentro del provider.
- **Razón:** El provider debe reportar usage sin conocer Supabase. `chat/route.ts` conserva responsabilidad de persistencia. Evita que fallos de DB rompan streaming.
- **Forma:** `StreamOptions.onUsage?: (usage: TokenUsage) => void | Promise<void>` — pasado como `options` en `stream()` o `complete()`. Provider ejecuta en `try/catch`; fallo se loguea, no se lanza.
- **Anthropic stream:** usa `client.messages.stream()` (no `messages.create({ stream: true })`) para obtener `MessageStream` con `finalMessage()`. `finalMessage()` retorna usage acumulado del stream completo.
- **Estado:** Accepted — aplicado en Anthropic (Fase 2a). OpenAI/Groq/Gemini diferidos.

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

---

## 2026-06-11 — Email enumeration tradeoff — accepted risk

- **Decisión:** El lookup de `receiver_email` en POST `/api/connections` usa cliente admin (service role, SELECT-only) y devuelve error explícito `No AISync account found with that email.` Esto permite enumeración de emails: un tercero autenticado puede probar emails y saber cuáles tienen cuenta AISync.
- **Contexto:** El fix original del Gap 1 (2026-06-09) usaba el cliente del usuario; la RLS de `accounts` (solo lectura de la propia fila) hacía que el lookup fallara siempre para usuarios no-admin — Connect Team roto en producción. Detectado en auditoría de seguridad 2026-06-11.
- **Riesgo aceptado porque:** (1) AISync es B2B — el usuario que conecta ya conoce el email del receptor; (2) será mitigado con rate limiting Upstash (Gap 2, en curso); (3) UX clara es prioritaria en esta etapa.
- **Regla derivada:** El cliente admin se usa SOLO para SELECTs de verificación server-side, nunca para writes. Los writes mantienen el cliente del usuario con RLS activa.
- **Revisión:** Reevaluar si el producto se abre a self-service masivo.
- **Estado:** Accepted.

---

## 2026-06-11 — Lock removido de la UI del MVP — decisión formalizada retroactivamente

- **Decisión:** Lock fue removido de la UI el 2026-05-14 (commit `1903306`, rediseño de workspace Fase 3 OE2-OE3) por decisión de producto para reducir complejidad del MVP. La decisión no quedó registrada en su momento — se formaliza ahora. La infraestructura queda funcional sin disparador visual: `lock/route.ts` corregido (ownership check + verificación de persistencia, SEC-007) y política RLS UPDATE aplicada (migración 025).
- **Diseño futuro aprobado — "Smart Lock" (post-MVP):** Lock manual demostró ser débil. El rediseño aprobado por el Product Owner convierte Lock en un mecanismo automático:
  1. **Auto-lock por inactividad:** una sesión se lockea sola tras ~4 interacciones del workspace sin participar.
  2. **Auto-unlock por Review & Forward:** si la sesión lockeada recibe un R&F, se desbloquea automáticamente.
  3. **Modal de estado:** una sesión lockeada muestra un modal centrado en su ventana de chat indicando el estado.
  4. **Unlock genera checkpoint:** desbloquear una sesión dispara checkpoint y/o backup automático.
  5. **Toggle global:** el usuario puede desactivar Lock para toda la sesión ("Lock off") si le genera ruido.
- **Razón del registro:** este diseño existe para evitar re-work futuro — cuando Lock vuelva, se implementa Smart Lock, no el botón manual.
- **Estado:** Accepted.

---

## 2026-06-11 — BYOK estricto en producción

- **Decisión:** El fallback a keys de plataforma (`ENV_KEYS`) en `chat/route.ts` y `sm-doc-chat/route.ts` solo opera en `NODE_ENV === 'development'`. En producción, un usuario sin key propia recibe error 400 accionable: `No API key configured for {provider}. Add your key in Settings → Providers to use this agent.`
- **Razón:** Modelo de negocio BYOK declarado — AISync no absorbe costos de IA de clientes. El fallback incondicional permitía que cualquier usuario autenticado sin key consumiera la cuenta de AISync (costo no acotado, sin rate limiting aún). Hallazgo SEC-006 de la auditoría de seguridad.
- **Operativa:** Las ENV vars pueden permanecer en Vercel sin riesgo — el código las ignora en producción. El flujo de desarrollo local no cambia.
- **Alternativas descartadas:** Eliminar `ENV_KEYS` por completo — rompía el flujo de desarrollo diario sin beneficio de seguridad adicional. Mantener el fallback con límites de consumo — requiere infraestructura de metering que no existe aún; reevaluable como "cortesía beta" si el onboarding lo justifica.
- **Estado:** Accepted — aplicado en ambas routes.

---

## 2026-06-11 — Rate limiting con interfaz RateLimiter desacoplada (Upstash Redis)

- **Decisión:** Rate limiting se implementa mediante interfaz `RateLimiter` desacoplada (`src/lib/rate-limit/types.ts`), con `UpstashRateLimiter` como implementación inicial (`Redis.fromEnv()` + sliding window). Las API routes consumen singletons por route desde `src/lib/rate-limit/index.ts` con key `route:user.id`.
- **Razón:** AISync necesita proteger API routes críticas sin acoplar el sistema a un proveedor específico. La abstracción permite reemplazo futuro por LocalRateLimiter, NoopRateLimiter u otra implementación sin tocar las routes.
- **Límites:** POST `/api/chat` 30 req/min; POST `/api/connections` 10 req/min; POST `/api/context` 20 req/min; POST `/api/teams` 10 req/min — siempre por usuario, después de auth y antes de la operación pesada.
- **Política:** Fail-open. Si Upstash Redis falla (o faltan las env vars en local), la request continúa y se registra el error — el rate limiting nunca bloquea usuarios por fallo de infraestructura. Implementado con inicialización lazy dentro de `check()` para que incluso un fallo de construcción del cliente caiga dentro del fail-open.
- **Alternativas descartadas:** middleware global (corre antes de auth y afecta routes no previstas); rate limit por IP (castiga redes compartidas y no refleja 1 account = 1 user); fail-closed (punto único de falla).
- **Estado:** Accepted / Implemented.

---

## 2026-06-11 — Resolución de API keys centralizada en resolveProviderApiKey

- **Decisión:** Toda resolución de provider API keys vive en `src/lib/providers/resolveApiKey.ts`. `resolveProviderApiKey()` centraliza known providers, custom providers, BYOK y fallback de entorno solo en development. Las routes no mantienen listas propias de providers ni lógica duplicada.
- **Razón:** La duplicación entre `chat` y `sm-doc-chat` ya había generado drift real (Groq presente en una lista y ausente en la otra). Una fuente única elimina la clase de bug y reduce el costo de agregar providers.
- **Detalle de diseño:** el helper devuelve un discriminated union (`isCustom: true` incluye `endpointUrl` y `apiKey` nullable — Ollama no requiere key; `isCustom: false` garantiza `apiKey: string`). `'IA Local'` se resuelve en las routes antes del helper porque usa el endpoint del request, no keys.
- **Estado:** Accepted / Implemented — chat y sm-doc-chat usan el helper.

---

## 2026-06-11 — Ownership check obligatorio antes de INSERT vinculado a workspace

- **Decisión:** Toda route que inserta entidades vinculadas a workspace debe verificar ownership mediante la cadena `workspaces → teams → projects → account_id` antes del INSERT (patrón `checkpoint/[id]`): 404 si no existe, 403 si no pertenece. `audit_log` solo después del insert principal exitoso. IDs secundarios del body (team_id, project_id) se validan contra la cadena real del workspace.
- **Razón:** Evita que un usuario autenticado cree registros (y eventos de audit trail) asociados a workspaces ajenos — integridad del audit log como activo central del producto.
- **Estado:** Accepted / Implemented en handoff-package y save-selection (SEC-008).

---

## 2026-06-11 — Persistir userMsg antes de iniciar streams en AgentPanel

- **Decisión:** En `AgentPanel.sendPrompt()`, el mensaje del usuario se persiste en `/api/messages` antes de iniciar `POST /api/chat`. El flujo exitoso persiste solo `assistantMsg`. Si el stream se corta con contenido parcial, el parcial se conserva y persiste como assistant message marcado como interrumpido.
- **Razón:** AISync es una capa de control y trazabilidad. Con la persistencia acoplada a un único punto de éxito posterior al stream, cualquier interrupción eliminaba tanto la acción humana como la respuesta parcial (ERR-003).
- **Detalles:** la persistencia previa es fail-open (si falla, el chat continúa y se loguea). El marcador de interrupción va en el content (la tabla `messages` no tiene columna de flags y el schema está congelado) — así sobrevive en checkpoints y handoffs, coherente con trazabilidad. Los errores pre-stream (400 sin key, 429) conservan su mensaje accionable — el texto "interrupted" solo aparece cuando hubo tokens parciales reales.
- **Estado:** Accepted / Implemented for AgentPanel. SMPanel fuera de scope (no persiste mensajes).

---

## 2026-06-12 — API keys cifradas con Supabase Vault vía RPCs SECURITY DEFINER

- **Decisión:** Las API keys BYOK y de custom providers se almacenan en Supabase Vault. Las tablas `user_api_keys` y `user_custom_providers` conservan solo metadata no sensible (`vault_secret_id`, `key_last4`). Toda escritura/lectura/borrado de secrets pasa por RPCs `SECURITY DEFINER` que validan `auth.uid()` (migración 026).
- **Razón:** Plaintext en tablas de aplicación expone todas las keys de todos los clientes ante acceso a la base, leak de service role o backup filtrado (SEC-005). Vault aísla los secrets y las RPCs encapsulan el privilegio de descifrado en funciones auditadas — sin exponer service role al cliente.
- **Detalles:** el enmascarado de settings sale de `key_last4` (los GET nunca tocan Vault ni devuelven la key); solo `resolveProviderApiKey` descifra, en runtime. El DELETE borra fila + secret (sin huérfanos). Los nombres de provider se conservan con su case original — `lower()` solo en nombres de secret.
- **Estado:** Accepted / Implemented in repo — migración y backfill manuales pendientes.

---

## 2026-06-12 — Dual-read hasta completar backfill

- **Decisión:** `resolveProviderApiKey` lee Vault primero y cae a `api_key` plaintext legacy. Los GET de settings calculan last4 desde `key_last4` con fallback a la columna legacy. El fallback no se elimina hasta validar que todas las filas tienen `vault_secret_id`.
- **Razón:** Ignorar el plaintext inmediatamente rompería BYOK para toda key existente antes del backfill. `supabase.rpc()` no lanza ante función inexistente, así que el código dual-read es deployable incluso antes de aplicar la migración.
- **Ventana aceptada:** guardar keys nuevas falla con 500 entre el deploy y la aplicación manual de la 026 — sin fallback plaintext deliberadamente (una key nueva nunca más toca plaintext).
- **Estado:** Accepted.

---

## 2026-06-12 — Proyecto activo persistido en accounts.active_project_id

- **Decisión:** El proyecto activo se persiste en `accounts.active_project_id` y se muta únicamente vía RPC `set_active_project` (SECURITY DEFINER, ownership check contra `projects.account_id` + `status = 'active'`). La lectura centralizada vive en `getActiveProjectId()` con fallback al primer proyecto activo si la selección es null, borrada o inactiva.
- **Razón:** Multi-proyecto no puede depender de elegir siempre el primer proyecto (ARC-004). El proyecto activo es estado del producto por usuario — debe sobrevivir reloads y dispositivos, y tener ownership check server-side. Se eligió columna en DB sobre cookie/localStorage por coherencia con la filosofía control-layer (estado auditable, no preferencia de navegador).
- **Detalles:** `ON DELETE SET NULL` en la FK — borrar el proyecto activo degrada limpio al fallback. `active-workspace` consume el helper en vez de duplicar la lógica. El Dashboard activa por botón explícito "Set active" (no click en card — las cards tienen Links anidados y el click-card garantizaba activaciones accidentales).
- **Estado:** Accepted / Implemented in repo — migración 027 manual pendiente.

---

## DEC-XXX — Connected Teams: Shared Workspace como canal operativo cross-cell
**Fecha:** 2026-06-13
**Estado:** Aprobado
**Área:** Producto + Arquitectura

**Decisión:**
El canal operativo entre teams conectados se implementa como "Shared Workspace 
(Sesión Anfitrión)": un workspace en la cuenta del anfitrión al que el invitado 
accede con scope aislado, sincronizado via Supabase Realtime.

**Razón:**
- Evita sincronización bidireccional compleja entre cuentas
- Mantiene ownership claro (workspace = propiedad del anfitrión)
- Reutiliza mecanismo SAT existente
- Alineado con modelo de célula soberana de AISync
- Más seguro: el invitado opera dentro del perímetro del anfitrión, no en paralelo

**Alternativas descartadas:**
- Cross-cell messaging (tabla forward_messages): más complejo, sin ownership claro
- Email via R&F (OpenClaude): descartado — infraestructura innecesaria
- Invitados sin cuenta AISync: descartado — riesgo de seguridad

**Impacto:** WorkspaceShell, /api/chat, nueva migración, Supabase Realtime

---

## 2026-06-15 — Intelligent root router + dedicated dashboard route [REVERTIDO]

- **Decisión ORIGINAL:** Root `/` es un router inteligente puro que solo decide redirección según `onboarding_completed`. Dashboard vive en ruta dedicada `/dashboard` sin lógica de onboarding.
- **Razón ORIGINAL:** Separar routing logic de UI logic hace el código más mantenible y elimina redirects.
- **RESULTADO REAL:** El router inteligente **rompió todos los links del ribbon**. Sobrecomplicó la arquitectura sin beneficio concreto. Agregó una ruta extra (`/dashboard`) innecesaria.
- **REVERT:** Commit 6f30555 revirtió completamente este refactor.
- **Arquitectura FINAL (después del revert):**
  ```
  / (root)          → Dashboard directo (sin routing logic)
  /start            → Chat-First Onboarding
  Logo AISync       → /start (directo)
  Link "Dashboard"  → / (directo)
  ```
- **Lección REAL:** **KISS (Keep It Simple, Stupid).** El refactor "inteligente" fue sobreingeniería. Dos rutas simples son mejores que tres rutas con lógica de routing intermedia. La simplicidad gana sobre la "elegancia arquitectónica" cuando no hay problema concreto que resolver. No agregar abstracciones sin beneficio demostrable.
- **Estado:** Reverted — commit 983bdc1 implementado, commit 6f30555 lo revirtió completamente

---

## 2026-06-15 — Prefill vs autostart para Chat-First Onboarding (prefill ganó)

- **Decisión:** El initialIntent de Chat-First Onboarding se pasa como pre-fill del input del Manager via query param `?prefill=<encodedText>`. El usuario llega al workspace, ve su texto ya escrito en el input, y presiona Send cuando quiera. **No hay autostart automático, no hay timing issues, no hay debug logs.**
- **Razón:** El autostart implementado originalmente (commits 01aca2c + 464a661) era funcional pero innecesariamente complejo: timing race conditions con delay empírico de 1500ms, console.logs de debug en producción, trigger vía `useImperativeHandle`, y UX subóptima — el usuario no veía su mensaje antes de que el Manager respondiera automáticamente. El usuario identificó: "Es más simple y más natural. El usuario llega al workspace, ve su texto ya escrito en el input del Manager, y presiona Send. No hay autostart, no hay timing issues, no hay debug. Además es mejor UX — el usuario tiene control de lo que va a enviar antes de dispararlo."
- **Alternativas descartadas:**
  - Autostart automático con timing mejorado: descartado — el problema no era solo timing, era complejidad y UX
  - Generar respuesta del manager en `/api/onboarding/start`: descartado — requiere streaming server-side, duplica lógica de chat
  - Persistir initialIntent como mensaje en DB antes de abrir workspace: descartado — genera mensaje "fantasma" que el usuario no envió conscientemente
- **Impacto en código:** -81 líneas (autostart + debug logs eliminados), +31 líneas (prefill limpio), **neto: -50 líneas**
- **Detalles técnicos:** `AgentPanel` recibe `initialInput?: string` prop y usa `useEffect` simple para pre-llenar el input. No hay trigger automático, no hay refs, no hay delay. El query param `?prefill` se consume al cargar — el texto aparece en el input inmediatamente sin persistir en DB.
- **Lección clave:** El usuario debe tener control sobre lo que envía. Autostart automático sacrificaba UX por "magia". Prefill da transparencia sin perder flujo. Una solución más simple casi siempre es mejor que una solución "inteligente" con timing issues.
- **Estado:** Implemented — commit e22ec23 (fix: use prefill input instead of autostart for onboarding initial message). Build exitoso, push exitoso, autostart completamente eliminado.

---

## 2026-06-18 — Flags de UX user-specific en team_connections (no en accounts ni localStorage)

- **Decisión:** Los flags de UX específicos de usuario relacionados con conexiones cross-account (ej: `welcome_viewed_by_invitee`) deben vivir en `team_connections`, no en `accounts` ni en `localStorage`.
- **Razón:** (1) Un usuario puede ser invitado a múltiples conexiones — el flag es específico de cada conexión, no del usuario globalmente. (2) Persistencia cross-dispositivo: `localStorage` se pierde al borrar caché y no sincroniza entre dispositivos. (3) `team_connections` ya tiene toda la metadata necesaria (requester, receiver, description, color) y está diseñada para estado relacional cross-account. (4) Evita contaminar `accounts` con flags específicos de features que no escalan — `accounts` es control-layer puro (role, active_project_id, onboarding_completed).
- **Alternativas descartadas:**
  - `localStorage`: no persiste cross-dispositivo, se pierde al borrar caché, no hay control desde backend
  - Nueva tabla `user_preferences`: overengineering para un solo flag, requiere joins adicionales, `team_connections` ya tiene el contexto relacional
  - Columna en `accounts`: contamina tabla core con flags feature-specific, no escala cuando hay múltiples conexiones (un usuario puede estar en N connections)
- **Caso de uso concreto:** `welcome_viewed_by_invitee` en OE B.3 — cuando un invitado acepta conexión y entra al isolated workspace, ve bienvenida solo la primera vez. El flag persiste por conexión (no globalmente) y cross-dispositivo automáticamente.
- **Patrón reutilizable:** Server-side check en page.tsx (detecta contexto + flag) → pasar metadata a client component → renderizar modal condicionalmente → API endpoint marca flag como visto. Extensible a otros onboardings contextuales: `first_checkpoint_created`, `admin_panel_first_visit`, `prompt_library_first_use`.
- **Lección clave:** Los flags de estado de UX deben vivir cerca de su contexto relacional. Si el flag es específico de una relación (conexión, workspace, team), debe vivir en la tabla de esa relación. `accounts` es para estado global del usuario, no para estado contextual de features.
- **Estado:** Implemented en OE B.3 (commit df105c8), documentado en handoff.md 2026-06-18


---

## 2026-06-18 — Modelo de Workspace para Connected Teams: 3 paneles con espejo de solo lectura

**Contexto:**
Se evaluó cómo debe funcionar el workspace compartido cuando dos cuentas (Host e Invitado) están conectadas vía Connected Teams. El objetivo era decidir si los tokens/costos de IA se comparten o se mantienen separados por cuenta, y cómo se visualiza la colaboración.

**Alternativas evaluadas:**

1. **Espejo de lectura bidireccional** (elegida): cada usuario mantiene su propio panel de IA con sus propias keys/tokens. Además, cada usuario ve un panel "espejo" de solo lectura mostrando en tiempo real lo que el otro usuario está haciendo con su propio agente. Un tercer panel central permite chat humano directo entre ambos.

2. **Panel de IA único compartido** (descartada): un solo agente de IA compartido entre ambos usuarios, donde cualquiera puede escribir y ambos ven la misma conversación. Descartada porque no permite separar el costo de tokens por cuenta — el Host terminaría pagando por el uso del Invitado.

3. **Control remoto real** (descartada en fase de definición): que un usuario pueda operar directamente el panel de IA del otro. Descartada por implicancias de seguridad y de costos (¿quién paga esa interacción?).

**Decisión final:**
Modelo de 3 paneles para workspace tipo Connected Team:
1. **Panel propio + IA** (interactivo, tokens propios)
2. **Panel Usuario-Usuario / chat humano** (centro, interactivo para ambos)
3. **Panel del otro usuario + su IA** (solo lectura, espejo en tiempo real vía Realtime, sin inputs ni controles)

La analogía de referencia es "ver el escritorio remoto de alguien mientras trabaja" — se observa pero no se opera.

**Por qué:**
- Mantiene separación clara de costos: cada cuenta paga sus propios tokens
- Refuerza la doctrina de trazabilidad de AISync: cada acción de IA queda atribuida inequívocamente a quien la generó
- Reutiliza un patrón de UI ya familiar (3 columnas), reduciendo carga cognitiva nueva para el usuario
- Evita los problemas de un agente compartido (atribución de costo ambigua)

**Implicancias arquitectónicas:**
- Requiere columna `owner_account_id` en `agent_sessions` para distinguir "session del host" vs "session del invitee"
- Cambio en creación de isolated team: de 3 sessions genéricas (manager/worker1/worker2) a 2 sessions con owner explícito
- RLS de `messages` debe permitir lectura cross-account bidireccional (ambos lados de la conexión pueden leer todos los mensajes del workspace compartido)
- Nueva tabla `human_messages` para chat humano directo (no reutilizar `messages` porque su FK a `agent_sessions` no aplica)
- Componente nuevo `ConnectedWorkspaceShell` separado de `WorkspaceShell` (layout y lógica distintos)
- AgentPanel extendido con prop `readOnly: boolean` para renderizar panel espejo sin controles interactivos
- Supabase Realtime bidireccional: cada lado suscribe a mensajes del otro + canal compartido para chat humano

**Riesgos / pendientes:**
- Requiere Realtime bidireccional (más complejo que un canal único)
- RLS debe permitir lectura cross-account — sin esto, panel espejo estará vacío
- Conexiones existentes con 3 sessions deben migrarse o recrearse (estrategia de migración pendiente)
- Modelo de `owner_account_id` en agent_sessions es breaking change para isolated teams existentes

**Estado:** Decisión de producto cerrada 2026-06-18. Implementación pendiente (OE B completo).

---

## 2026-06-22 — OE C: Implementación parcial (Piezas 1 y 2), Piezas 3 y 4 diferidas

**Contexto:**
OE C (Gobernanza Connected Teams) tiene 4 piezas según el diseño original en AISyncPlans.md:
1. Registro de conexión en Doc Mode del invitado
2. Fallback "Datos de trazabilidad ausentes"
3. Metadata package opcional del anfitrión al invitado
4. Send Checkpoint al invitado desde Doc Mode del anfitrión

El diagnóstico completo (2026-06-22) mostró que Piezas 3 y 4 requieren:
- Tabla nueva (`shared_checkpoints`)
- RLS cross-account modificada en `checkpoints` y `checkpoint_messages`
- Complejidad ALTA — mismo perfil de riesgo que el "panel espejo" ya diferido en la decisión del 2026-06-18

**Decisión:**
Implementar hoy solo:
- **Pieza 1:** Registro de conexión en `audit_log` del invitado al aceptar (complejidad BAJA, riesgo BAJO)
- **Pieza 2:** Fallback "Datos de trazabilidad ausentes" — Opción A: registro local en `audit_log` del invitado con mensaje informativo, SIN modificar RLS de checkpoints (complejidad MEDIA, riesgo BAJO)

Diferir para sesión dedicada futura:
- **Pieza 3:** Metadata package opcional (complejidad ALTA, requiere UI completa + RLS cross-account + tabla nueva)
- **Pieza 4:** Send Checkpoint individual (complejidad ALTA, requiere tabla `shared_checkpoints` + RLS nueva + UI en Doc Mode del host)

**Razón:**
Piezas 1 y 2 son quick wins con bajo riesgo que completan la visibilidad básica de trazabilidad para el invitado sin tocar RLS cross-account. Piezas 3 y 4 requieren diseño cuidadoso de RLS y tiempo para evaluar implicancias de seguridad — mismo patrón de decisión que llevó a diferir el panel espejo.

**Decisión arquitectural para cuando se implementen Piezas 3 y 4:**
**Opción B confirmada:** RLS cerrada + Send explícito (opt-in del host). El invitado NUNCA debe ver checkpoints del host sin que el host los comparta explícitamente. Esto preserva la soberanía del host y evita exposición accidental de datos cross-account.

**Alternativas descartadas:**
- **Opción A (RLS abierta):** El invitado ve todos los checkpoints del workspace compartido automáticamente — descartado porque viola el principio "opt-in" de gobernanza y puede exponer datos sensibles del host sin su consentimiento.
- Implementar las 4 piezas en una sola OE — descartado por alto riesgo de introducir bugs de seguridad (RLS cross-account mal configurada) bajo presión de tiempo.

**Implicancias técnicas de Piezas 1 y 2:**
- **Pieza 1:** INSERT en `audit_log` dentro del bloque `if (body.action === 'accept')` en `/api/connections/[id]/route.ts`. Evento: `connection_accepted`. Metadata: `connection_id`, `requester_email`, `requester_team_name`, `scope_isolated_team_id`.
- **Pieza 2:** Metadata del evento incluye mensaje: `"Detailed traceability data lives in [requester_email]'s account. This workspace shows only what's shared with you."` — visible en Audit View del invitado como recordatorio de que la trazabilidad completa está en la cuenta del host.

**Implicancias técnicas de Piezas 3 y 4 (diferidas):**
- Nueva tabla `shared_checkpoints` con FK a `checkpoint_id` + `connection_id`
- Policy nueva en `checkpoints`: permitir SELECT si el checkpoint está en `shared_checkpoints` con `shared_to = auth.uid()`
- UI en Doc Mode del host: botón "Send Checkpoint to [invitee]" en cada checkpoint de workspace compartido
- API route nueva: `/api/checkpoints/share` con ownership check estricto
- Audit log bidireccional: evento `checkpoint_shared` para host, evento `checkpoint_received` para invitee

**Riesgos conocidos:**
- Piezas 1 y 2 NO permiten al invitado ver checkpoints del host — solo le informan que existen datos en la cuenta del host
- Sin Piezas 3 y 4, el invitado depende 100% del host para recibir contexto documental del trabajo compartido
- Implementar Piezas 3 y 4 más adelante requerirá migración cuidadosa + test exhaustivo de RLS cross-account

**Estado:**
- Piezas 1 y 2: en implementación 2026-06-22
- Piezas 3 y 4: en backlog, requieren sesión dedicada con tiempo para diseño de RLS cuidadoso y testing de seguridad cross-account

**Patrón reutilizable:**
Este es el segundo diferimiento de features de Connected Teams por complejidad de RLS cross-account (primero fue panel espejo, ahora Piezas 3 y 4). El patrón emergente es: features cross-account con RLS modificada requieren sesión dedicada, no pueden implementarse como "un fix más" dentro de una OE amplia.

---

## 2026-06-22 — Welcome bilateral (host + invitee) con contenido diferenciado por rol

**Contexto:**
Welcome screen originalmente solo se mostraba al invitado (receiver) en su primera visita al workspace compartido. El host (requester) nunca veía una bienvenida contextual sobre el workspace que él mismo había creado al invitar al colaborador.

**Decisión:**
Implementar bienvenida bilateral con contenido diferenciado según el rol del viewer. Cada usuario (host o invitee) recibe su propia bienvenida explicando el workspace compartido desde su perspectiva.

**Por qué:**
- El host necesita su propia bienvenida que explique el modelo de workspace compartido desde su perspectiva: él invitó a alguien, controla la gobernanza del workspace, puede compartir checkpoints opcionalmente (Piezas 3 y 4 de OE C diferidas).
- El invitado mantiene su bienvenida existente con scope reminder sobre trazabilidad limitada.
- UX asimétrica confundía al host sobre qué era el workspace compartido — el host veía el workspace sin contexto explicativo.
- Cada rol tiene necesidades de información distintas: host → gobernanza y control; invitee → scope limitado y opt-in del host.

**Detalles técnicos:**
- Migration 039: nueva columna `team_connections.welcome_viewed_by_requester BOOLEAN DEFAULT false`
- Flags independientes: `welcome_viewed` (receiver, legacy) + `welcome_viewed_by_requester` (host, nuevo)
- API `/api/connections/mark-welcome-viewed` acepta `role: 'host' | 'invitee'` y actualiza el flag correspondiente
- `WelcomeScreen.tsx` acepta prop `isHost: boolean` y renderiza contenido diferenciado
- workspace/[id]/page.tsx detecta `isHost = connection.requester_account_id === user.id` y decide qué flag verificar

**Contenido diferenciado:**
- **Host:** Título "Welcome to your Shared Workspace", explicación de collaboration space, NO incluye scope reminder (el host ve toda su trazabilidad)
- **Invitee:** Título "Welcome to Shared Workspace", scope reminder sobre trazabilidad limitada (mantiene contenido existente de OE B.3)

**Alternativas descartadas:**
- Welcome screen única con contenido genérico — descartado porque cada rol necesita explicación contextual distinta
- Reutilizar `welcome_viewed` con lógica de "quien lo marca primero" — descartado porque genera race condition y no permite que ambos vean su bienvenida
- Skip welcome para host — descartado porque UX asimétrica confunde al host sobre qué es el workspace compartido

**Riesgos conocidos:**
- `welcome_viewed` (sin sufijo) ahora semánticamente es "welcome_viewed_by_receiver" pero el nombre de columna no cambió (breaking change de schema evitado)
- Si el host nunca acepta la modal, el flag queda en `false` indefinidamente (comportamiento intencional, respeta autonomía del usuario)

**Estado:** Implemented 2026-06-22 (commit e5177df), migration 039 pending manual application

**Lección clave:**
Bienvenidas contextuales en features cross-account deben ser bilaterales con contenido diferenciado por rol. Flags booleanos separados evitan race conditions y permiten UX independiente para cada parte. Nombres de columna legacy se mantienen para evitar breaking changes — documentar semántica implícita en comentarios SQL.

---

## 2026-06-22 — Audit log bilateral para eventos de desconexión (disconnect/cancel)

**Contexto:**
OE C identificó gaps de trazabilidad en Connected Teams: solo `connection_accepted` tenía registro en audit_log (y solo para el invitado). Los eventos de desconexión (`disconnect` de conexión activa y `cancel` de conexión pendiente) NO generaban eventos de audit.

**Decisión:**
Registrar eventos `connection_disconnected` y `connection_cancelled` en audit_log con criterio de bilateralidad determinado por el tipo de evento:
- **connection_disconnected:** bilateral (host + invitee ven el evento en sus propios audit logs)
- **connection_cancelled:** unilateral (solo host/requester ve el evento)

**Por qué bilateral para disconnect:**
- Ambas partes están afectadas por la desconexión — el workspace compartido que estaba activo se termina para ambos
- Accountability: ambos usuarios necesitan saber quién originó la desconexión (metadata `disconnected_by: 'requester' | 'receiver'`)
- Simetría con eventos bidireccionales existentes (ej: ambas partes ven cuando se crea el workspace compartido, deben ver cuando se termina)

**Por qué unilateral para cancel:**
- El receiver nunca aceptó la conexión — no tiene contexto del workspace compartido
- La solicitud pendiente solo es visible para el requester (quien la creó)
- No hay workspace activo que se termine — es simplemente el requester retractando una solicitud pendiente

**Detalles técnicos:**

**connection_disconnected (bilateral):**
- INSERT 1 (initiator): audit_log para `user.id` (quien ejecutó disconnect) con metadata:
  - `partner_email`, `partner_team_name`, `description`
  - `disconnected_by: 'requester' | 'receiver'` (indica quién originó)
  - `viewer_role: 'host' | 'invitee'` (indica el rol del viewer de este evento)
- INSERT 2 (other party): audit_log para la otra cuenta usando `createAdminClient()`
  - Metadata simétrico pero invertido (partner_email es el otro lado)
  - `disconnected_by`: mismo valor (ambos saben quién desconectó)
  - `viewer_role`: invertido del initiator
- Ambos INSERTs fail-open (try/catch independientes)

**connection_cancelled (unilateral):**
- Solo INSERT para requester (`user.id`)
- Metadata: `receiver_email`, `requester_team_name`, `description`
- `viewer_role: 'host'` (siempre requester)
- `traceability_note`: "Pending connection request cancelled before acceptance."

**Alternativas descartadas:**
- Audit log solo para initiator en disconnect — descartado porque la otra parte necesita saber quién desconectó (accountability)
- Registrar cancel también para receiver — descartado porque el receiver nunca aceptó (no tiene contexto del workspace compartido)
- Usar status `'disconnected'` nuevo — descartado porque requiere migration del CHECK constraint; `'cancelled'` semánticamente correcto y ya permitido

**Riesgos conocidos:**
- `status = 'cancelled'` usado tanto para disconnect (activo→cancelled) como para cancel (pending→deleted) — semántica overloaded pero aceptable
- Eventos `connection_cancelled` acumulan en DB — si crece la tabla, considerar filtro en GET `/api/connections` o cleanup job

**Estado:** Implemented 2026-06-22 (commit c038fab)

**Lección clave:**
Eventos de desconexión cross-account requieren audit bilateral con metadata que identifique al initiator — ambas partes necesitan accountability. Eventos de cancelación (pending→deleted) son unilaterales porque la otra parte nunca aceptó (no tiene contexto). Criterio de bilateralidad no es automático — depende del estado previo de la relación (activa vs pendiente).

## 2026-06-22 — Nodo worker sintético para isolated teams (Teams Map)

**Contexto:**
Isolated teams (Connected Teams) en Teams Map/Tree View mostraban solo el nodo GM superior sin cajas worker debajo. El diseño deseado era: 1 nodo GM grande superior + 1 caja worker debajo (igual que host team de 1 agente).

**Diagnóstico:**
- `agentsToShow = workspace.agent_sessions.slice(0, 1)` limitaba a 1 agente (manager)
- Manager con `teamParentId === null` se renderiza como `general_manager` (top node), NO como worker (caja)
- Resultado: 1 nodo GM + 0 cajas (en vez de 1 GM + 1 caja)

**Decisión:**
Implementar patrón de nodo worker sintético: para isolated teams donde `agent_role === 'manager'`, generar DOS `AgentNode` desde un solo `agent_session`:
1. Nodo normal (`role: 'manager'`) → renderiza como GM top node
2. Nodo sintético (`agentId: '${agent.id}-synthetic-worker'`, `role: 'worker1'`) → renderiza como worker box

Ambos nodos comparten mismo `workspaceId`, `teamId`, `provider`, `model` → clicking en cualquiera abre el mismo workspace.

**Por qué:**
- Sin modificar schema de DB ni semántica de datos (isolated team realmente tiene 1 solo agente)
- Sin romper lógica de navegación (workspaceId determina destino, no agentId)
- Solución visual pura — genera 2 nodos de presentación desde 1 agente real
- Mantiene consistencia visual con host teams de 1 agente (siempre 1 GM + 1 caja)

**Verificación de riesgo:**
- `grep -rn "agentId" src/` confirmó que `agentId` solo se usa para:
  1. React key en map (`key={node.agentId}`)
  2. Lookup en Map (`mapNodes.get(agentId)`)
  3. NO se usa para navegación (navegación usa `workspaceId`)
- ID sintético es seguro — no afecta data layer ni navegación

**Detalles técnicos:**
- `src/lib/db/agent-map.ts` líneas 68-88: bloque condicional que genera nodo sintético
- Condición: `team.type === 'isolated' && agent.agent_role === 'manager'`
- agentId sintético: `${agent.id}-synthetic-worker` (garantiza unicidad, no colisiona con IDs reales)
- role sintético: `'worker1'` (renderiza como caja debajo del GM)

**Alternativas descartadas:**
- Cambiar `teamParentId` del manager a team.id para forzar renderizado como worker — descartado porque rompe la semántica (manager NO es hijo de su propio team)
- Agregar worker real en DB para isolated teams — descartado porque isolated teams realmente tienen 1 solo agente (manager)
- Modificar lógica de `agentNodesToMapNodes()` para casos especiales — descartado porque agrega complejidad a la pipeline de renderizado

**Riesgos conocidos:**
- `agentId` sintético solo es seguro porque actualmente no se usa para navegación. Si en futuro se agrega navegación directa por agentId (ej: `/agent/[id]`), esta solución requerirá refactor.
- El nodo sintético no tiene `agent_session` correspondiente en DB — cualquier query que intente cargar el agente por ID sintético fallará. Debe manejarse con guard en caso de agregarse features que requieran cargar el agente por ID.

**Estado:** Implemented 2026-06-22 (commit 5718f32), deployed to production

**Lección clave:**
Soluciones visuales puras (generar múltiples nodos de presentación desde una entidad de datos) son válidas cuando:
1. No afectan data layer (DB schema intacto)
2. No afectan navegación/routing (workspaceId determina destino)
3. ID sintético solo se usa para rendering (React key, Map lookup)
Verificación exhaustiva de uso del campo (grep) es crítica antes de aprobar patrón de IDs sintéticos.

---

## 2026-06-22 — EditTeamModal adaptativo para isolated teams

**Contexto:**
Modal de edición de teams mostraba 3 columnas (Manager + Worker 1 + Worker 2) para isolated teams, cuando isolated teams solo tienen 1 agente (manager).

**Decisión:**
Adaptar modal según tipo de team:
- **Isolated teams:** Filtrar agents a solo manager + grid 1 columna
- **Normal teams (SAT/MAT):** Mostrar todos los agentes + grid 3 columnas

**Por qué:**
- Isolated teams no tienen workers reales — mostrar 3 columnas con 2 vacías es confuso
- Consistencia visual con realidad de datos (1 agente → 1 columna)
- Evita que usuario intente editar workers inexistentes
- Grid adaptativo preserva layout correcto para normal teams

**Detalles técnicos:**
- `src/components/teams/EditTeamModal.tsx` línea 70-76: filtrar agents en `useState`
  ```typescript
  const [agents, setAgents] = useState<AgentEdit[]>(
    team.type === 'isolated'
      ? rawAgents.slice(0, 1).map(toAgentEdit)  // Solo manager
      : rawAgents.map(toAgentEdit)              // Todos
  )
  ```
- Línea 220: grid adaptativo según tipo
  ```typescript
  <div className={`grid gap-3 mb-3 ${team.type === 'isolated' ? 'grid-cols-1' : 'grid-cols-3'}`}>
  ```

**Alternativas descartadas:**
- Ocultar workers con `display: none` — descartado porque agrega complejidad CSS innecesaria y mantiene elementos vacíos en DOM
- Deshabilitar edición de workers en isolated teams — descartado porque es mejor no mostrarlos directamente

**Riesgos conocidos:**
- Si en futuro se permite agregar workers a isolated teams (cambio de producto), el `.slice(0, 1)` deberá removerse
- Grid adaptativo asume que isolated teams siempre tienen exactamente 1 agente — si esto cambia, requiere ajuste

**Estado:** Implemented 2026-06-22 (commit 5718f32), deployed to production

**Lección clave:**
Componentes que renderizan estructuras variables (SAT/MAT/isolated) deben adaptar layout según tipo. Filtrado en state initialization es más limpio que condicionales en JSX. Grid adaptativo preserva UX consistente sin duplicar componentes.

---

## 2026-06-22 — Rutina de cierre duro obligatoria (handoff.md)

**Contexto:**
Auditoría de cierres detectó que faltaban 4 commits sin entrada en handoff.md (e5177df, 5b2203f, 9ffdffc, 7362c57, c038fab). Gap documental requirió backfill exhaustivo de ~300 líneas de contexto.

**Decisión:**
Establecer rutina de cierre duro obligatoria: actualizar handoff.md ANTES de declarar OE cerrada, sin excepciones. Una OE no está cerrada hasta que handoff.md está actualizado.

**Por qué:**
- Gap documental de 4 commits requirió sesión adicional de backfill (costo de tokens y tiempo)
- Sin trazabilidad de decisiones técnicas y alternativas descartadas, sesiones futuras requieren re-derivar contexto
- handoff.md es única fuente de verdad para "por qué se hizo así" — sin él, solo tenemos "qué se hizo" (git log)
- Ritual de cierre debe ser hard requirement, no "nice to have"

**Protocolo:**
1. Al finalizar OE/mini-OE/fix: actualizar handoff.md PRIMERO
2. Verificar que entrada incluye: commits, archivos modificados, decisión técnica, alternativas descartadas, riesgos conocidos
3. Solo después: build, commit, push
4. Reporte final debe confirmar "handoff.md updated" explícitamente

**Alternativas descartadas:**
- Actualizar handoff.md "cuando haya tiempo" — descartado porque genera gaps documentales
- Handoff opcional solo para OEs grandes — descartado porque mini-OEs y fixes también necesitan trazabilidad
- Usar git commit messages como única fuente de verdad — descartado porque commits no capturan alternativas descartadas ni riesgos conocidos

**Estado:** Establecido como regla obligatoria 2026-06-22

**Lección clave:**
La documentación es parte del entregable, no un "extra". Una OE sin handoff entry NO está completa. El costo de backfill (tiempo + tokens + re-derivar contexto) siempre supera el costo de documentar en el momento. Ritual de cierre debe ser hard gate, no soft reminder.

## 2026-06-23 — Use an explicit inactive-status allowlist for Connected Teams inactive banners

**Decision:**
Use an explicit inactive-status allowlist for Connected Teams inactive banners.

**Reason:**
The inactive connection banner must only appear for statuses deliberately approved for that behavior. AISync uses:

```typescript
['cancelled', 'disconnected'].includes(connectionStatus)
```

instead of:

```typescript
connectionStatus !== 'active'
```

because Connected Teams is close to cross-account access and RLS-sensitive behavior. A future status must not trigger the inactive banner, input disabling, or altered shared-workspace behavior by accident. Any new status requires an explicit product/security decision before being mapped to UI behavior.

**Status:**
Accepted / Implemented.

**Impact:**
- `cancelled` and `disconnected` show "This connection is no longer active."
- `active` preserves current behavior.
- `pending` is intentionally excluded.
- `undefined` connectionContext preserves local workspace behavior.
- future statuses do not change behavior automatically.

**Lección clave:**
En features cross-account cercanas a RLS, usar allowlist cerrada de estados en lugar de comparación negativa protege contra estados futuros no contemplados. Esto es especialmente importante cuando el comportamiento afecta permisos, acceso a datos, o interacción entre cuentas.

---

## 2026-06-26 — Connected Teams: Manager separado por usuario, sin panel espejo [ARQUITECTURA CORRECTA REVALIDADA]

**Fecha de decisión original:** 2026-06-18 (validada con esquema visual del Product Owner)
**Fecha de revalidación:** 2026-06-26 (confirmación antes de iniciar plan de corrección)
**Fecha de registro formal:** 2026-06-26 (Etapa 0 del plan de corrección)
**Estado:** Aprobado / En implementación progresiva
**Área:** Arquitectura + Producto

**Decisión:**
La arquitectura correcta de Connected Teams es: **dos edificios separados**, uno por usuario (Host e Invitado). Cada usuario tiene su propio Manager y Workers en su propio team/workspace/account. La conexión entre ambos es únicamente un "campo de juego" compartido — el chat humano (`human_messages`). **Nunca debe existir lectura cruzada entre el Manager de un usuario y el del otro**, ni siquiera en modo lectura.

**Diagrama conceptual:**
```
[Host Account]                    [Invitee Account]
  └── Host Team                     └── Invitee Team
      └── Host Workspace                └── Invitee Workspace
          ├── Manager (Host)                ├── Manager (Invitee)
          └── Workers (Host)                └── Workers (Invitee)

           ╔════════════════════════╗
           ║  Shared Human Chat     ║  ← ÚNICO punto de conexión
           ║  (human_messages)      ║
           ╚════════════════════════╝
```

**Por qué:**
1. **Separación de costos:** Cada cuenta paga sus propios tokens — el Manager del Host consume keys del Host, el Manager del Invitado consume keys del Invitado. No hay ambigüedad de atribución.
2. **Trazabilidad inequívoca:** Cada acción de IA queda atribuida a la cuenta que la generó. Audit log de cada cuenta registra solo sus propias interacciones de IA.
3. **Seguridad:** El "panel espejo" (lectura cross-account del Manager del otro usuario) fue evaluado explícitamente el 2026-06-18 y descartado por riesgo de exposición de datos cross-account y complejidad de RLS bidireccional.
4. **Soberanía de célula:** Coherente con el principio arquitectural de AISync: 1 Account = 1 Sovereign Cell. Cada usuario mantiene control completo de su lado de la conexión.

**Desviación detectada:**
La implementación actual (hasta 2026-06-26) se desvió de esta decisión: existe un único Manager compartido entre Host e Invitado por conexión, almacenado en `team_connections.scope_isolated_team_id`. Esto generó una cadena de bugs en los últimos 3 días:
1. **Bug de RLS cross-account:** Se requirieron parches en `messages` (commit 443e0e2, migración 040) y `checkpoints` (commit 15323f5, migración 041) para permitir acceso cross-account a la conversación del Manager compartido.
2. **Bug de `team.type` mutando:** El Manager compartido cambiaba su tipo de `'isolated'` a `'normal'` al editar metadata del team (fix aplicado en commit 54fa466).
3. **Bug de "Save Version" del chat humano:** Al intentar guardar checkpoint del chat humano, se capturó por error la conversación del Manager compartido (detectado 2026-06-26, no fixeado todavía).

**Decisión de migración:**
Se aprobó un plan de 8 etapas para corregir la desviación y alinear la implementación con la arquitectura correcta. Este plan genera los siguientes cambios:
- **Dos managers separados por conexión:** `team_connections.host_isolated_team_id` y `team_connections.invitee_isolated_team_id`
- **Eliminación del Manager compartido:** `team_connections.scope_isolated_team_id` se mantiene sin tocar durante Etapas 1-7, y se marca explícitamente como candidato a eliminación en la Etapa 8
- **RLS simplificado:** Una vez migrado, las políticas cross-account de `messages` y `checkpoints` ya no serán necesarias para el Manager — solo para `human_messages`

**Nomenclatura aprobada para nuevos campos (Etapas 1-8):**
- `team_connections.host_isolated_team_id` → team/workspace del Manager del Host
- `team_connections.invitee_isolated_team_id` → team/workspace del Manager del Invitado
- `team_connections.scope_isolated_team_id` → campo legacy, se mantiene sin tocar hasta Etapa 8

**Conexión de prueba existente:**
La conexión de prueba activa en producción es de testing interno, sin usuarios externos reales. Se acepta la **pérdida de su historial de IA** (mensajes y checkpoints del Manager compartido) al migrarla al nuevo modelo en la Etapa 7. El historial del chat humano (`human_messages`) se preserva.

**Alternativas descartadas (2026-06-18):**
1. **Panel espejo (lectura cross-account):** Descartado por riesgo de seguridad (exposición de datos cross-account) y complejidad de RLS bidireccional.
2. **Manager único compartido con RLS abierta:** Descartado por violación del principio "opt-in" de gobernanza y ambigüedad de costos.
3. **Control remoto real (un usuario opera el Manager del otro):** Descartado por implicancias de seguridad y de costos.

**Archivos y tablas afectados por el plan de corrección (identificados en diagnóstico del 2026-06-26):**

**Schema/DB:**
- `team_connections` (nuevas columnas en Etapa 1)
- RLS policies de `messages` (simplificación en Etapa 5)
- RLS policies de `checkpoints` + `checkpoint_messages` (simplificación en Etapa 5)

**API Routes:**
- `POST /api/connections` (creación de dos managers en Etapa 2)
- `PATCH /api/connections/[id]` (accept → crear invitee manager en Etapa 2)
- `GET /api/connections` (dual-read en Etapa 3)
- Rutas que leen `scope_isolated_team_id` (actualizar a dual-read en Etapa 3)

**Components:**
- `ConnectTeamModal.tsx` (POST usa nuevos campos en Etapa 4)
- `ConnectionsPanel.tsx` (renderiza managers separados en Etapa 4)
- `WorkspaceShell.tsx` (si renderiza workspace compartido, actualizar en Etapa 4)
- Cualquier componente que lea `scope_isolated_team_id` (actualizar a dual-read en Etapa 4)

**Libs:**
- `src/lib/db/connections.ts` (dual-read helper en Etapa 3)
- Cualquier helper que lea `scope_isolated_team_id` (actualizar en Etapa 3)

**Riesgos conocidos:**
1. **Complejidad de migración:** El plan de 8 etapas es extenso — cada etapa debe ejecutarse cuidadosamente para evitar romper la conexión de prueba activa en producción hasta la Etapa 7.
2. **Dual-read temporal:** Las Etapas 3-6 requieren lógica de dual-read (intentar nuevos campos, caer a `scope_isolated_team_id` legacy) — esto agrega complejidad temporal que se limpia en Etapa 8.
3. **RLS bidireccional temporal:** La RLS cross-account de `messages`/`checkpoints` debe mantenerse activa hasta completar la Etapa 7 (migración de datos) — eliminarla antes romperá la conexión de prueba.
4. **Testing en producción:** No hay entorno de staging — el plan se ejecuta directamente en producción con la conexión de prueba como caso de validación.

**Plan de 8 etapas aprobado:**
- **Etapa 0:** Documentación y registro de decisión (esta entrada en `DECISIONS.md`) — ✅ COMPLETADA (commits 95f71a5, 37516fa)
- **Etapa 1:** Schema — agregar `host_isolated_team_id` e `invitee_isolated_team_id` a `team_connections` (nullable) — ✅ COMPLETADA (commit 748d259, migración 042 aplicada manualmente)
- **Etapa 2:** Write path — PATCH accept crea dos managers separados (uno Host, uno Invitee) — ✅ COMPLETADA (commit cb48df8, validación manual pendiente)
- **Etapa 3:** Read path (backend) — helpers y API routes leen dual (nuevos campos → fallback a legacy)
- **Etapa 4:** Read path (frontend) — componentes leen dual
- **Etapa 5:** RLS — simplificar políticas de `messages`/`checkpoints` (ya no necesitan acceso cross-account al Manager)
- **Etapa 6:** Validación — confirmar que conexiones nuevas usan arquitectura correcta, conexión de prueba legacy sigue funcional
- **Etapa 7:** Migración de datos — migrar conexión de prueba al nuevo modelo (pérdida de historial de IA aceptada)
- **Etapa 8:** Cleanup — eliminar `scope_isolated_team_id`, eliminar dual-read, eliminar RLS legacy cross-account

**Estado:** Etapas 0, 1, 2 completadas y validadas (2026-06-27). Etapa 3 implementada (parcial). Etapas 4-8 pendientes.

**Validación Etapa 2 (2026-06-27 — SQL diagnostic query):**
- **Conexión de prueba:** agustinestefanell@gmail.com (Host) + agustin.viaje@gmail.com (Invitee)
- **Resultado:** ✅ Arquitectura correcta confirmada
  - `host_isolated_team_id` → team del Host con workspace propio
  - `invitee_isolated_team_id` → team del Invitee con workspace propio
  - `scope_isolated_team_id` → igual a `host_isolated_team_id` (esperado según Etapa 2)
  - **Workspaces separados confirmados** — cada team tiene su propio `workspace_id` distinto
  - **Agent sessions separados confirmados** — cada workspace tiene sus propios 3 agent_sessions (manager/worker1/worker2)
- **Conclusión:** La Etapa 2 está sana. Los datos están correctos. El problema reportado (Manager compartido) es de **consumo en frontend**, no de creación en backend.

**Detalles de Etapa 2 (commit cb48df8):**
- **Cambio:** Al aceptar conexión, se crean dos proyectos nuevos (uno por cuenta) y dos teams isolated separados (uno por usuario)
- **Proyectos creados:**
  - Host: `[host_email]+[invitee_email]`
  - Invitee: `[invitee_email]+[host_email]`
- **Teams creados:** Ambos con estructura idéntica (type: 'isolated', 3 agent_sessions: manager/worker1/worker2)
- **Provider/model:** Copiado del Host (temporal hasta Etapa 2.5)
- **Color:** Copiado de `team_connections.color` a ambos teams
- **Referencias guardadas:**
  - `scope_isolated_team_id` (legacy, sin cambios — apunta al team del Host)
  - `host_isolated_team_id` (nuevo — apunta al team del Host)
  - `invitee_isolated_team_id` (nuevo — apunta al team del Invitee)
- **Archivo modificado:** `src/app/api/connections/[id]/route.ts` (líneas 179-267)
- **Backward compatibility:** Conexiones creadas antes de cb48df8 conservan solo `scope_isolated_team_id` — no se rompen
- **Validación pendiente:** Crear conexión nueva, verificar que ambos teams existen en DB con referencias correctas

**Lección clave:**
Una desviación arquitectural no detectada temprano genera deuda técnica compuesta: cada fix parcial (RLS patch, fix de `team.type`, etc.) consolida la arquitectura incorrecta en lugar de corregirla. El costo de corregir crece exponencialmente con el tiempo. Validar arquitectura contra decisiones originales antes de implementar fixes es crítico — si el fix requiere parches complejos (RLS cross-account, mutación de tipo), es señal de que la arquitectura subyacente está desviada.

---

## 2026-06-27 — Diagnóstico Etapa 3: consumo frontend vs creación backend

**Contexto:**
Post-implementación de Etapas 1-3, el Product Owner reportó que el Manager seguía siendo el mismo para Host e Invitado — preguntas hechas por separado aparecían replicadas tras F5, y cambiar el provider desde EditTeamModal en cualquiera de las dos cuentas aplicaba al mismo team real (prevalecía el del Host). Además, Teams Map del Invitado mostraba dos teams aislados para la misma conexión.

**Diagnóstico ejecutado (2026-06-27):**
Se ejecutó análisis de solo lectura sobre el código (sin modificaciones) para identificar qué componentes ya usan la arquitectura nueva (dual-read) y cuáles todavía acceden directamente a `scope_isolated_team_id`.

**Hallazgos:**

| Componente | ¿Usa dual-read? | Estado |
|---|---|---|
| `teams/page.tsx` (Invitee) | ✅ Parcial | Correcto para Invitee, pero falta lógica para Host |
| `teams/page.tsx` (Host) | ❌ NO | **Bug:** `getProjectsWithHierarchy()` trae todos los teams del proyecto sin filtrar — Host ve ambos teams isolated |
| `workspace/[id]/page.tsx` | ✅ SÍ | Correcto (usa `getUserIsolatedTeamId`) |
| `MapView.tsx` / `TreeView.tsx` | ❌ NO | Usan `workspaceId` directo del team (no hay lógica de decisión) |
| `EditTeamModal.tsx` | ❌ NO | Actualiza `team.id` directo sin dual-read |
| `WorkspaceShell.tsx` / `AgentPanel.tsx` | ❌ NO | No acceden a arquitectura de conexiones (correcto — eso es Etapa 4+) |

**Raíz del problema:**
El Manager sigue siendo compartido porque:
1. **El Host ve ambos isolated teams** (del Host y del Invitee) porque `getProjectsWithHierarchy()` trae todos los teams de su proyecto sin filtrar por rol
2. **`MapView.tsx` / `TreeView.tsx` usan `workspaceId` directo** del team que venga en el array, sin aplicar lógica de dual-read
3. **`EditTeamModal.tsx` actualiza `team.id` directo** — si el team que recibe es el del Host, actualiza el del Host

**Validación de datos confirmó Etapa 2 sana:**
SQL diagnostic query confirmó que los workspaces están correctamente separados en DB. El problema es de **consumo en frontend** (Teams Map y modal de edición acceden al team equivocado), no de creación en backend.

**Plan de Etapa 4 (clarificado por diagnóstico):**
Actualizar los siguientes componentes para que usen dual-read correctamente:

1. **`teams/page.tsx` (lado Host):**
   - Filtrar teams isolated del Host en lugar de traer todos los del proyecto
   - O hacer query de conexiones donde `requester_account_id = user.id` y usar `getHostIsolatedTeamId()`

2. **`MapView.tsx` y `TreeView.tsx`:**
   - No requieren cambio directo (usan los teams que vienen de `teams/page.tsx`)
   - Una vez que `teams/page.tsx` esté corregido, estos componentes verán los teams correctos

3. **`EditTeamModal.tsx`:**
   - Validar que el `team.id` recibido corresponde al usuario actual antes de permitir edición
   - O asegurar que el team que llega al modal ya es el correcto (depende del fix de `teams/page.tsx`)

4. **Confirmar `WorkspaceShell.tsx` / `AgentPanel.tsx`:**
   - Ya confirmado que NO acceden a arquitectura de conexiones (correcto)
   - No requieren cambios en Etapa 4

**Estado:** Diagnóstico completado. Etapa 4 lista para implementación con scope preciso.

---

## 2026-06-27 — Connected Teams Etapa 4: Causa raíz era cache de Next.js, no lógica de queries

**Contexto:**
Diagnóstico de 2026-06-27 (matutino) concluyó que `getProjectsWithHierarchy()` traía "todos los teams del proyecto sin filtrar" causando que el Host viera ambos teams isolated. Esta hipótesis fue **descartada** con evidencia en la tarde del mismo día.

**Investigación con evidencia SQL:**
Query de verificación confirmó:
- `HOST_TEAM` → `project_account_id` = `requester_account_id` ✅
- `INVITEE_TEAM` → `project_account_id` = `receiver_account_id` ✅
- Ambos proyectos tienen `account_id` **distintos** (uno por cuenta)

**Análisis de código confirmó:**
```typescript
// Etapa 2, línea 193
account_id: fullConnection.requester_account_id  // Proyecto del Host

// Etapa 2, línea 204
account_id: user.id  // Proyecto del Invitee (cuenta distinta)
```

**Conclusión:**
`getProjectsWithHierarchy()` **SÍ respeta RLS correctamente**. La función usa `createClient()` (cliente autenticado), y RLS de `projects` exige `account_id = auth.uid()`. Por lo tanto:
- El Host solo ve proyectos con `account_id = Host`
- El Invitee solo ve proyectos con `account_id = Invitee`
- **Cada usuario solo ve su propio proyecto** (y su propio team isolated)

**Causa raíz real identificada:**
`src/app/teams/page.tsx` **NO tenía `export const dynamic = 'force-dynamic'`**.

Next.js estaba cacheando el resultado de `getProjectsWithHierarchy()` entre requests. Cuando el Invitee aceptaba una conexión (creando dos proyectos nuevos), el cache no se invalidaba. El Host navegaba a `/teams` y veía **datos cacheados desactualizados** (de antes de la aceptación, o parcialmente actualizados).

**Fix aplicado (commit 25f1460):**
```typescript
export const dynamic = 'force-dynamic'
```

Agregado en `teams/page.tsx` (misma directiva que ya existe en `workspace/[id]/page.tsx`).

**Consecuencia:**
- Cambio mínimo (1 línea)
- Bajo riesgo (patrón ya usado en otras rutas)
- Fuerza re-rendering server-side en cada request
- Elimina cache que causaba datos stale

**Plan original de Etapa 4 (filtros explícitos + verificación en EditTeamModal):**
**Diferido** a próxima sesión pendiente testing en vivo con F5 para confirmar si el fix de cache por sí solo resuelve el síntoma, o si todavía se necesitan los filtros adicionales.

**Lecciones:**
1. **Hipótesis basadas en síntomas pueden ser incorrectas** — verificar con evidencia SQL + código antes de implementar fixes complejos
2. **Cache de Next.js es causa común de bugs de "datos inconsistentes"** — siempre verificar `export const dynamic` en rutas que muestran datos de DB que cambian con frecuencia
3. **RLS funciona correctamente cuando está bien diseñado** — el problema nunca fue de seguridad, sino de UX (datos stale)

**Estado:** Fix de cache aplicado y documentado. Etapa 4 completa (filtros explícitos) pendiente de validación con testing en vivo.
