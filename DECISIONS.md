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
