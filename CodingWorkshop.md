# AISync — Coding Workshop

## Propósito

Repositorio acumulativo de bugs resueltos, causas raíz, procesos de diagnóstico y lecciones técnicas del proyecto AISync MVP. Alimentado desde `handoff.md`. No reemplazar entradas anteriores — agregar al final.

Cada entrada documenta lo que fue difícil, por qué falló, cómo se resolvió y qué no volver a repetir. El objetivo es que un Worker nuevo pueda leer esto antes de tocar zonas sensibles del sistema.

---

## Formato de cada entrada

- **Problema:** qué falló o qué faltaba
- **Causa raíz:** por qué pasó
- **Consecuencia:** qué impacto tuvo
- **Proceso de solución:** qué se intentó, qué funcionó
- **Solución final:** fix exacto aplicado
- **Commit:** hash
- **Lección:** qué aprendimos para el futuro

---

## Entradas

### 1. Scroll chain roto en AppLayout

- **Problema:** Ninguna vista de altura fija (Documentation Mode, Workspace, Audit, Teams) tenía scroll funcional. Las listas de documentos y los paneles de chat no hacían scroll aunque el contenido excedía el viewport.

- **Causa raíz:** `<main>` en `AppLayout` con `scrollable={false}` era un elemento block. Tenía `flex-1 overflow-hidden min-h-0` pero le faltaba `display: flex`. Como `<main>` era block (no flex container), el `flex-1` aplicado a sus hijos directos (`DocClient`, `WorkspaceShell`, etc.) no tenía efecto — nunca resolvía la altura. Los hijos tomaban `height: auto` y crecían indefinidamente sin activar el scroll de sus descendientes.

- **Consecuencia:** Paneles de chat ocultos, Documentation Mode inutilizable, ninguna vista multi-documento funcional. Evidente en todas las sesiones de prueba pero invisible sin prueba end-to-end.

- **Proceso de solución:** Análisis del DOM con DevTools. Inspección de computed height en cada nivel del árbol de componentes. Comparación contra implementación funcional de la demo (layout flex estricto).

- **Solución final:** Agregar `display: flex` y `flex-direction: column` a `<main>` en `AppLayout.tsx` cuando `scrollable={false}`. Con `<main>` como flex container, los hijos con `flex-1` resuelven altura relativa y activan sus propios overflow-y.

- **Commit:** `e68f2c1`

- **Lección:** Flex layout no funciona si el padre no es `display: flex`. `flex-1` solo significa "toma espacio disponible" cuando el padre **distribuye** ese espacio. Verificar DevTools Computed antes de asumir que una clase Tailwind (`flex-1`) está funcionando. El scroll en cadena requiere altura conocida en cada nivel: `height: 100%` o `flex-1` con padre flex.

---

### 2. Workspace lock sin persistencia — RLS política faltante

- **Problema:** `workspace.lock_state` no persistía. UI mostraba estado locked, pero refresh revertía a `free`. Audit log registraba evento pero sin reflejo en DB.

- **Causa raíz:** RLS en tabla `workspaces` no tenía política `UPDATE`. Supabase bloqueaba silenciosamente toda escritura — no lanzaba error HTTP. El cliente retornaba éxito, audit_log se escribía (tabla aparte con RLS permisiva), pero el UPDATE de lock_state afectaba 0 filas.

- **Consecuencia:** Users veían confirmación visual falsa. Workspace concurrente no impedido. Audit log inconsistente con DB (evento registrado para operación no persistida).

- **Proceso de solución:** Inspección directa de tabla `workspaces` en Supabase SQL editor post-lock mostró `lock_state` sin cambio. Revisión de RLS policies reveló solo SELECT + INSERT, sin UPDATE.

- **Solución final:**
  - Migración 025: `CREATE POLICY workspaces_update_policy ON workspaces FOR UPDATE USING (owner_id() = (SELECT account_id FROM projects WHERE id = workspaces.project_id));`
  - Aplicada en Supabase 2026-06-11
  - Verificación con ownership check + conteo de filas afectadas en route handler

- **Commit:** `[migración 025]`

- **Lección:** RLS sin política explícita falla silent. Siempre verificar `.select()` post-UPDATE para confirmar persistencia real. Audit log separado de operación core puede enmascarar fallas — no asumir que "200 OK" significa escritura exitosa. Supabase no lanza 403/500 si RLS bloquea; simplemente retorna `{ data: [], error: null }` y afecta 0 filas.

---

### 3. BYOK fallback consumía cuenta de AISync

- **Problema:** Usuario sin API key propia consumía créditos de cuenta de AISync. Chat y Documentation Mode funcionaban sin que usuario configurara provider.

- **Causa raíz:** Fallback a `process.env.ANTHROPIC_API_KEY` y `process.env.OPENAI_API_KEY` sin condicional de entorno. Si `userKey` era null, routes automáticamente usaban ENV keys sin restricción.

- **Consecuencia:** Abuso potencial. Usuario podía usar producto sin proveer key. Business model quebrado (AISync no subsidia uso de IA).

- **Proceso de solución:** Auditoría de `chat/route.ts` y `sm-doc-chat/route.ts` reveló patrón `const apiKey = userKey ?? process.env.ANTHROPIC_API_KEY`. Decision: fail explícito en producción, mantener fallback solo en desarrollo local.

- **Solución final:**
  - Condicional `if (!apiKey && process.env.NODE_ENV === 'production') return 400` en ambos routes
  - Mensaje accionable: "API key required. Please configure your provider in Settings."
  - Fallback a ENV keys solo cuando `NODE_ENV === 'development'`

- **Commit:** `[ver DECISIONS.md 2026-06-11]`

- **Lección:** ENV keys son para desarrollo y emergencias, nunca para sustituir BYOK en producción. Validar lógica de fallback antes de deploy. Clear error + guía accionable > silent fallback que oculta configuración faltante. Business model debe reflejarse en código (hard fail si usuario no cumple requisito de cuenta).

---

### 4. Rate limiting sin fail-safe bloqueaba producción

- **Problema:** Implementación inicial de rate limiting causaba 500 en todos los requests si Redis estaba down o mal configurado. Producto inaccesible durante outage de Upstash.

- **Causa raíz:** Rate limiter sin try/catch. Si `limiter.check()` lanzaba error (timeout de Redis, falla de red), request completo fallaba sin ejecutar lógica de negocio. No había fail-open.

- **Consecuencia:** Dependencia crítica introducida sin graceful degradation. Outage de third-party service = outage completo de AISync.

- **Proceso de solución:** Envolver `rateLimiters.*.check()` en try/catch. En caso de error, loguear y retornar `{ success: true }` (fail-open). Rate limiting es protección, no core feature — mejor permitir request que bloquear usuario legítimo.

- **Solución final:**
  - Wrapper `safeCheck()` en cada rate limiter
  - Log de error a consola (para detectar degradación en monitoring)
  - Fail-open: `catch { console.error(); return { success: true } }`
  - Comentario explícito: "Rate limiting is protective, not blocking — fail open"

- **Commit:** `[ver DECISIONS.md 2026-06-11 — Rate limiting]`

- **Lección:** Nunca hacer hard dependency de servicio externo sin fail-safe. Rate limiting, analytics, logging = tier 2 features — core flow debe sobrevivir su falla. Fail-open > fail-closed para protecciones. Monitorear degradación silenciosa (error en log sin bloqueo visible).

---

### 5. Gap 1 de Connected Teams — validación de receiver_email sin admin client

- **Problema:** `POST /api/connections` validaba que `receiver_email` existiera en tabla `accounts`, pero el SELECT retornaba null aunque email existía. Validación fallaba, impedía crear conexión legítima.

- **Causa raíz:** RLS en `accounts` permite solo `SELECT WHERE id = auth.uid()`. Cliente de usuario no puede leer filas de otras cuentas. El SELECT de validación usaba cliente de usuario, RLS bloqueaba silenciosamente, retornaba null, validación interpretaba como "cuenta no existe".

- **Consecuencia:** Feature bloqueada para usuarios no-admin. Flujo de invitación roto en testing con cuentas reales. Validación de seguridad implementada con herramienta incorrecta.

- **Proceso de solución:** Revisión de RLS policies en `accounts`. Constatación de que validación cross-account requiere bypass de RLS. Creación de `createAdminClient()` con service role key. Migración de SELECT de validación a admin client (solo lectura, no escritura).

- **Solución final:**
  - `const { data: receiverAccount } = await createAdminClient().from('accounts').select('id').eq('email', receiver_email).single()`
  - Admin client solo para validación de existencia
  - INSERT de `team_connections` se mantiene en cliente de usuario (respeta RLS ownership)

- **Commit:** `[fix 2026-06-11]`

- **Lección:** RLS ownership model requiere admin client para validaciones cross-account. Cliente de usuario + RLS estricto = only-own-data. Si validación necesita leer datos de otra cuenta, usar admin client con scope limitado (SELECT específico, nunca UPDATE/DELETE wholesale). Admin client es escape hatch de seguridad — documentar por qué se usa y limitar superficie de uso. En flujos multi-cuenta, identificar qué operaciones cruzan ownership **antes** de implementar.

---

### 6. OE A — Isolated team creation con RLS cross-account

- **Problema:** Scope Isolated Team no se creaba al aceptar conexión. UI mostraba accept exitoso, pero workspace compartido no existía. `scope_isolated_team_id` quedaba null en `team_connections`.

- **Causa raíz:** Bloque try/catch fail-open ocultaba error de RLS. INSERT de `teams`, `workspaces`, `agent_sessions` intentaba escribir en proyecto del **requester** (otra cuenta), pero usaba cliente del **receiver** (cuenta que acepta). RLS bloqueaba silenciosamente — catch tragaba error, accept continuaba sin isolated team.

- **Consecuencia:** Feature no funcional en cross-account flow (caso real de uso). Solo funcionaba en same-account testing (RLS permitía escritura). Error invisible por fail-open — accept retornaba 200, isolated team quedaba sin crear.

- **Proceso de solución:**
  - Inspección de DB post-accept: `scope_isolated_team_id` null
  - Logs de servidor: error RLS dentro de catch silencioso
  - Constatación: INSERTs en proyecto ajeno requieren admin client
  - Cambio de patrón: admin client para toda creación de isolated team (teams, workspaces, agent_sessions, link a connection)

- **Solución final:**
Reemplazar cliente de usuario por `createAdminClient()` en bloque de creación de isolated team:
- INSERT teams → admin client
- INSERT workspaces → admin client
- INSERT agent_sessions → admin client
- UPDATE team_connections (link) → admin client

El cliente `supabase` del usuario se mantiene para todo lo demás (receiver verification, UPDATE a `active`, `receiver_team_id`).

### Commit
`022ca92` — fix: use admin client for scope isolated team creation (cross-account RLS)

### Lección
En flujos cross-account, identificar exactamente qué operaciones cruzan ownership boundaries **antes** de implementar. El fail-open es necesario para no bloquear el flujo principal, pero puede ocultar bugs críticos de RLS que no lanzan excepciones — solo afectan 0 filas y retornan éxito silencioso. Siempre verificar con SELECT en DB después de implementar features con try/catch. El patrón seguro para cross-account INSERTs ya existía en el mismo archivo — reutilizar patrones de seguridad existentes en lugar de inventar nuevos evita este tipo de bugs.

---

### 7. Badge isolated aplicado al componente equivocado

- **Problema:** El badge "Shared Session" con fondo negro no aparecía en Teams Map aunque el código parecía correcto.

- **Causa raíz:** Teams Map usa `TeamAgentCard.tsx`, no `AgentCard.tsx`. El fix se aplicó en `AgentCard.tsx` que no se renderiza en el mapa. Dos componentes con nombres similares para el mismo contexto visual causaron confusión.

- **Consecuencia:** Fix deployado pero sin efecto visual. Usuario no veía el cambio esperado. Build pasaba, commit correcto, pero componente equivocado modificado.

- **Proceso de solución:**
  - Inspección de código fuente: badge style correcto en `AgentCard.tsx`
  - Grep de componente padre: `MapView.tsx` usa `TeamAgentCard`, no `AgentCard`
  - Lectura de `TeamAgentCard.tsx` línea 227: `node.teamType` renderizado como texto plano sin estilo
  - Aplicación del mismo fix visual en componente correcto

- **Solución final:**
  - `TeamAgentCard.tsx` línea 227: aplicar `style` condicional para `isolated` (fondo negro, letras blancas, padding, borderRadius)
  - Línea 227: transformar display `'isolated'` → `'Shared Session'`
  - Línea 327: transformar tag array para mostrar `'Shared Session'` en lugar de `'isolated'`

- **Commit:** `d9c937e` — fix: apply shared session badge to correct TeamAgentCard component

- **Lección:** Antes de aplicar un fix visual, verificar cuál componente se renderiza realmente en producción. No asumir por nombre similar — usar grep del componente padre para confirmar import. Dos componentes con nombres similares en el mismo contexto (`AgentCard` vs `TeamAgentCard`) requieren verificación explícita de flujo de render. El fix "correcto" en el componente equivocado es invisible para el usuario.

---

### 8. scope_isolated_team join bloqueado por RLS para el invitado

- **Problema:** El invitado no podía navegar al workspace del isolated team. ProjectList.tsx resolvía el workspaceId via join a `scope_isolated_team`, pero el botón "Open →" redirigía a `/teams` en lugar del workspace compartido.

- **Causa raíz:** RLS en tabla `teams` solo permite `SELECT` a proyectos del propio account (`exists (select 1 from projects p where p.id = teams.project_id and p.account_id = auth.uid())`). El isolated team está en el proyecto del requester, no del receiver. Cuando el receiver hace GET /api/connections, el join a `scope_isolated_team:scope_isolated_team_id(workspaces(id))` es bloqueado por RLS — retorna `null` silenciosamente. El código asume que el join funciona para ambos lados.

- **Consecuencia:** Feature no funcional para el invitado. El anfitrión puede abrir el workspace (el team está en su cuenta), pero el invitado ve botón "Open →" que lleva a `/teams` sin workspace compartido. Arquitectura cross-account sin considerar RLS ownership model.

- **Proceso de solución:**
  - Diagnóstico: el invitado no tiene `scope_isolated_team` en su cuenta, solo existe en la cuenta del anfitrión
  - Inspección de RLS policies en `teams`: SELECT requiere ownership via projects
  - Evaluación de 3 opciones:
    - A: Admin client en GET (similar a OE A)
    - B: Nueva policy RLS para isolated teams via connections (complejo)
    - **C: Persistir workspace_id directamente en team_connections** (elegida)

- **Solución final:**
  - Migración 029: `ALTER TABLE team_connections ADD COLUMN scope_isolated_workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL`
  - Accept flow: UPDATE `scope_isolated_workspace_id` al crear isolated team
  - GET /api/connections: SELECT incluye `scope_isolated_workspace_id` directamente
  - Connection interface: agregar campo `scope_isolated_workspace_id?: string | null`
  - ProjectList.tsx: usar `scope_isolated_workspace_id` como fuente primaria, join como fallback para conexiones legacy

- **Commit:** `c210c78` — fix: add scope_isolated_workspace_id to team_connections for cross-account nav

- **Lección:** Cuando dos cuentas comparten una referencia, persistir los IDs necesarios directamente en la tabla de conexión. No asumir que joins cross-account funcionan bajo RLS de usuario — RLS ownership bloquea acceso a datos de otra cuenta incluso en queries de solo lectura. El patrón "desnormalizar para evitar RLS cross-account" es más robusto que admin client o policies complejas. Siempre considerar el lado receiver al diseñar features cross-account.

---

### 9. Connection description no se propagaba al isolated team card

**Contexto:**
- Handoff.md documentaba que la connection description (team_connections.description) no se mostraba en TeamAgentCard para Shared Sessions (isolated teams) en Teams Map
- Bug 2 reportado (Open Workspace navigation) ya funcionaba correctamente, no requería fix

**Diagnosis:**
- `agent-map.ts:deriveAgentNodesFromTeams()` solo leía `team.description`, no `team_connections.description`
- AgentNode interface no tenía campos para connection metadata
- MapAgentNode interface no tenía campos para connection metadata
- TeamAgentCard.tsx mostraba `node.teamDescription` para todos los tipos de team, sin distinguir isolated

**Primer intento — server-side fetch bloqueado por importación cruzada:**
- Convertí deriveAgentNodesFromTeams a async e importé createClient() from server.ts para JOIN connections
- Build error: "You're importing a component that needs next/headers"
- Cadena: server.ts → agent-map.ts → MapView.tsx (client component)
- Problema: No se puede importar server utilities en módulos que luego se usan en client components

**Solución final — client-side fetch:**
- Extendí AgentNode interface con `connectionDescription?: string | null; connectionColor?: string | null`
- Extendí MapAgentNode interface con los mismos campos
- Cambié deriveAgentNodesFromTeams a recibir `connectionMap?: Record<string, ConnectionMetadata>` como parámetro
- MapView.tsx y TreeView.tsx:
  - useState + useEffect para fetch('/api/connections') cuando hay isolated teams
  - Build connectionMap keyed por scope_isolated_team_id
  - useMemo(() => deriveAgentNodesFromTeams(teams, connectionMap), [teams, connectionMap])
- `buildAgentLayout.ts`: pass-through de connectionDescription/connectionColor en mapping
- `TeamAgentCard.tsx`: cambiar líneas 255-259 para mostrar connectionDescription en isolated teams, y línea 189 para usar connectionColor

**Cambios adicionales:**
- `types.ts`: agregar 'isolated' a TeamType union (estaba missing, causaba type error)
- MapView.tsx y TreeView.tsx: type annotation para connections array (eliminar `any[]`)

**Archivos modificados:**
- src/lib/db/types.ts — TeamType = 'SAT' | 'MAT' | 'isolated'
- src/lib/db/agent-map.ts — AgentNode interface, ConnectionMetadata interface, deriveAgentNodesFromTeams parámetro
- src/lib/map/buildAgentLayout.ts — MapAgentNode interface + pass-through
- src/components/teams/map/TeamAgentCard.tsx — mostrar connectionDescription para isolated teams, usar connectionColor
- src/components/teams/MapView.tsx — fetch connections client-side, build connectionMap
- src/components/teams/TreeView.tsx — mismo patrón

**Build:** ✅ Pasó sin errores (warnings pre-existentes en CanvasViewport.tsx no relacionados)

**Lección:** 
- Metadata de connection y metadata de team son entidades distintas que deben propagarse separadamente a través de la data flow
- Server/client boundary: no se puede importar server utilities (createClient) en módulos compartidos que luego son usados por client components
- Patrón correcto: fetch client-side en useEffect, build map, pass como parámetro a funciones sync
- Tipo TeamType debe estar sincronizado con valores reales en DB — 'isolated' estaba ausente del union type

---

### 10. Invitado no ve isolated teams en Teams Map

**Contexto:**
- Bug reportado: invitado ve labels correctos en isolated team card pero descripción y color antiguos
- Diagnóstico: múltiples conexiones en DB con mismo scope_isolated_team_id, connectionMap sobrescrito por conexión cancelled vieja
- Fix parcial aplicado: filtrar `status === 'active'` en MapView/TreeView
- Problema persistente: invitado no ve isolated teams en absoluto

**Diagnosis profunda:**
- teams/page.tsx trae teams via `getProjectsWithHierarchy()` que hace SELECT desde `projects` con nested join a `teams`
- RLS en projects: solo permite leer proyectos donde `account_id = auth.uid()`
- El invitado NO puede leer el proyecto del anfitrión → los isolated teams no aparecen en el resultado
- Las RLS policies de teams/workspaces/agent_sessions (migración 028) **solo aplican en SELECT directo**, no en nested joins desde projects
- **RLS en tabla padre bloquea joins aunque la tabla hija tenga policy permisiva**

**Solución:**
- Query adicional con admin client directo a team_connections para traer isolated teams del invitado
- Mergear isolated teams con allTeams existentes antes de pasar a TeamsClient
- No modificar getProjectsWithHierarchy() — mantener query paralela

**Implementación:**
- teams/page.tsx:
  - Import createAdminClient
  - Después de getProjectsWithHierarchy(), SELECT team_connections con nested join a teams/workspaces/agent_sessions
  - Filtros: `receiver_account_id = user.id`, `status = 'active'`, `scope_isolated_team_id IS NOT NULL`
  - Map resultado a TeamWithWorkspaces[], filter nulls
  - Merge: `allTeams = [...projects.flatMap(...), ...isolatedTeams]`
- Interface temporal IsolatedConnectionRow para type safety

**Archivos modificados:**
- src/app/teams/page.tsx — fetch isolated teams via admin client, merge con allTeams

**Build:** ✅ Pasó sin errores

**Lección:**
- RLS en tabla padre bloquea nested joins aunque la tabla hija tenga policy permisiva
- SELECT desde `projects` → `teams` falla si `projects.account_id != auth.uid()`, aunque `teams` tenga policy que permite SELECT directo
- Para cross-account data visible solo en tabla hija: usar query paralela directa a la tabla hija, no nested join desde padre
- Admin client necesario para leer team_connections de otro account (requester_account_id != auth.uid()) y hacer nested join a teams de ese account

---

### 11. Isolated team pierde description y color al desconectar

**Contexto:**
- Bug reportado: isolated team muestra description y color correctos mientras la conexión está active
- Al desconectar (status → cancelled), el team pierde description y color porque venían de team_connections
- MapView/TreeView leen connectionMap que filtra solo conexiones active → data desaparece

**Diagnóstico:**
- Description y color se guardaban solo en team_connections, no en teams
- Accept flow copiaba description genérica auto-generada al team (`"Shared workspace with {email}"`)
- No copiaba la description personalizada del usuario ni el color
- Al cancelar conexión, connectionMap queda vacío para ese team → fallback a null

**Solución:**
- Migración 031: agregar columna `color TEXT DEFAULT '#000000'` a teams
- Accept flow: copiar `description` y `color` de team_connections a teams en el INSERT del isolated team
- agent-map.ts: priorizar team.description/color, fallback a connectionMap para backward compatibility
- types.ts: agregar `color: string | null` a Team interface

**Implementación:**
- supabase/migrations/031_teams_color.sql — ALTER TABLE teams ADD COLUMN color
- src/app/api/connections/[id]/route.ts línea 69: agregar description y color al SELECT de fullConnection
- src/app/api/connections/[id]/route.ts líneas 96-97: cambiar INSERT de isolated team:
  ```typescript
  description: fullConnection.description ?? `Shared workspace with ${receiver_email}`,
  color: fullConnection.color ?? '#000000',
  ```
- src/lib/db/agent-map.ts líneas 55-56: priorizar team.description/color sobre connectionData
- src/lib/db/types.ts: agregar color a Team interface

**Archivos modificados:**
- supabase/migrations/031_teams_color.sql — nueva migración
- src/app/api/connections/[id]/route.ts — SELECT + INSERT con description y color
- src/lib/db/agent-map.ts — priorizar team metadata sobre connection metadata
- src/lib/db/types.ts — Team interface con color

**Build:** ✅ Pasó sin errores

**Lección:**
- Metadata de trazabilidad debe persistir en la entidad durable (el team), no solo en la relación (la conexión) que puede cambiar de estado
- Copiar data de la relación a la entidad en el momento de creación garantiza persistencia independiente del ciclo de vida de la relación
- Fallback a la relación permite backward compatibility para entidades creadas antes de la migración

---

### 12. Invitado ve color lavado — isolated team no pasa color/description desde teams/page

**Contexto:**
- Bug reportado: invitado ve isolated team pero con color lavado (negro #000000 en vez del violeta #3b0764)
- DB verificada: isolated team tiene color y description correctos
- Diagnóstico: teams/page.tsx extrae solo `isolated_team` del query result, descartando color/description de la conexión
- connectionMap en MapView vacío porque solo lee conexiones outgoing del usuario

**Diagnosis:**
- teams/page.tsx líneas 48-50: `map(c => c.isolated_team)` descarta campos `c.color` y `c.description` del query
- El team SÍ tiene color copiado en accept, pero el map no propaga correctamente
- MapView.tsx connectionMap se llena correctamente desde GET /api/connections (trae incoming y outgoing por RLS)
- El problema era subtle: isolated_team se extraía sin garantizar que color/description estuvieran presentes

**Solución:**
- teams/page.tsx: cambiar map para propagar explícitamente color y description con fallback
  ```typescript
  .map(c => {
    if (!c.isolated_team) return null
    const team = c.isolated_team
    return {
      ...team,
      color: team.color ?? c.color ?? null,  // team primero, connection fallback
      description: team.description ?? c.description ?? null,
    } as TeamWithWorkspaces
  })
  ```

**Bonus — Paleta expandida:**
- ConnectTeamModal.tsx: CONNECTION_COLORS expandido de 8 a 16 colores
- Agregados 4 rojos + 4 verdes además de los 8 neutros originales
- Layout cambiado de `flex gap-2.5` a `grid grid-cols-8 gap-2.5` para 2 filas de 8

**Archivos modificados:**
- src/app/teams/page.tsx — map isolated teams con fallback explícito
- src/components/teams/ConnectTeamModal.tsx — paleta 16 colores + grid layout

**Build:** ✅ Pasó sin errores

**Lección:**
- Cuando haces nested join con Supabase, el map debe propagar explícitamente todos los campos necesarios — no asumir que "ya están en el objeto"
- team.color puede ser null si fue creado antes de la migración, fallback a connection garantiza color presente
- La estructura del query result no es idéntica al tipo de destino — casting explícito necesario

---

### 13. Color lavado — inset box-shadow blanco al 80% lava isolated team colors

**Contexto:**
- Bug reportado: invitado ve color correcto (#3b0764 violeta) pero parece transparente/lavado
- Data pipeline verificada: color llega correctamente a TeamAgentCard
- Diagnóstico visual: el color se aplica pero se ve desaturado

**Diagnosis:**
- TeamAgentCard.tsx línea 208: `boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.80)'`
- Inset shadow blanco al 80% de opacidad pone capa blanca semitransparente sobre el background
- Efecto: lava cualquier color oscuro (violeta #3b0764 → gris lavado)
- boxShadow NO era condicional, se aplicaba igual a isolated y regular teams

**Solución:**
- Hacer boxShadow condicional por isIsolated
- Isolated teams: reducir opacidad del inset shadow de 0.80 → 0.20
- Regular teams: mantener 0.80 (funcionan con gradient, no color sólido)
  ```typescript
  boxShadow: isIsolated
    ? '0 18px 38px rgba(15,23,42,0.10), inset 0 1px 0 rgba(255,255,255,0.20)'
    : '0 18px 38px rgba(15,23,42,0.10), inset 0 1px 0 rgba(255,255,255,0.80)',
  ```

**Archivos modificados:**
- src/components/teams/map/TeamAgentCard.tsx — boxShadow condicional línea 208-210

**Build:** ✅ Pasó sin errores

**Lección:**
- Inset box-shadows blancos con alta opacidad lavan colores oscuros sólidos
- Lo que funciona para gradients (regular teams) no funciona para colores sólidos (isolated teams)
- CSS visual debe ser condicional cuando los estilos de background difieren radicalmente
- Debug logs fueron útiles para confirmar que el problema NO era data pipeline

---

### 14. Autostart con timing issues reemplazado por prefill más simple

- **Problema:** El autostart implementado para Chat-First Onboarding funcionaba pero tenía timing issues con delay empírico de 1500ms, console.logs de debug en producción, y UX subóptima — el usuario no veía su mensaje antes de que el Manager respondiera automáticamente.

- **Causa raíz:** Lógica de trigger automático via `useImperativeHandle` + `useEffect` con delay arbitrario + verificación de estado de streaming + logs de debug. Solución funcional pero innecesariamente compleja. El problema de fondo era que el mensaje se persistía en DB y luego se intentaba auto-enviar con timing frágil.

- **Consecuencia:** Timing race conditions (500ms insuficiente, 1500ms empírico), logs de debug contaminando consola de producción, UX sin control del usuario (mensaje disparado automáticamente sin que el usuario lo viera pre-fill), query param `?autostart` en URL que quedaba después del trigger.

- **Proceso de solución:** Usuario identificó que "Es más simple y más natural. El usuario llega al workspace, ve su texto ya escrito en el input del Manager, y presiona Send. No hay autostart, no hay timing issues, no hay debug." Cambio de enfoque completo: de "auto-send" a "pre-fill".

- **Solución final:**
  1. `/api/onboarding/start`: removido Step 7 (persistir initialIntent como mensaje), response solo `{workspaceId}`
  2. `ChatFirstClient`: navegación cambió a `?prefill=${encodeURIComponent(initialIntent)}`
  3. `workspace/[id]/page`: searchParams cambió a `prefill?: string`
  4. `WorkspaceClient` + `WorkspaceShell`: props cambió a `prefillMessage`, removido useEffect de autostart completo
  5. `AgentPanel`: agregado `initialInput?: string` prop + useEffect simple `if (initialInput) setInput(initialInput)`, removido triggerAutoSend completo
  
  **Impacto:** -81 líneas (autostart + debug), +31 líneas (prefill) = **-50 líneas netas**

- **Commit:** `e22ec23` — fix: use prefill input instead of autostart for onboarding initial message

- **Lección:** El usuario debe tener control sobre lo que envía. Autostart automático sacrificaba UX por "magia". El prefill da transparencia sin perder flujo. Una solución más simple casi siempre es mejor que una solución "inteligente" con timing issues. Cuando múltiples signals apuntan a complejidad innecesaria (debug logs, delay empírico, race conditions), reevaluar el enfoque completo — no parchear.

---

### 15. Lógica de onboarding mezclada con dashboard genera redirects innecesarios

- **Problema:** Dashboard en `/` tenía lógica condicional de onboarding. Logo AISync iba a `/start`, pero para usuarios con onboarding completado causaba redirect `/start` → `/` innecesario. Links sin destinos fijos claros.

- **Causa raíz:** Routing logic mezclado con UI logic en la root page. La página `/` intentaba ser dos cosas: router de onboarding Y dashboard de usuario existente. Logo apuntaba a `/start` (fix previo ff56050) pero eso generaba un bounce redirect para usuarios existentes.

- **Consecuencia:** Redirect innecesario (costo de performance menor pero arquitectura confusa). Links sin semántica clara — el usuario no sabía si iba al dashboard o al onboarding según su estado. Código difícil de mantener con lógica condicional embebida.

- **Proceso de solución:** Separar responsabilidades. Crear `/dashboard` como ruta dedicada sin lógica de onboarding. Convertir `/` en router inteligente puro que solo decide redirección. Logo → `/` (router decide). Link "Dashboard" → `/dashboard` (destino fijo).

- **Solución final:**
  1. Crear `src/app/dashboard/page.tsx` con contenido limpio del dashboard (sin lógica de onboarding)
  2. Convertir `src/app/page.tsx` en router puro:
     ```typescript
     const { data: account } = await supabase.from('accounts').select('onboarding_completed')...
     if (!account?.onboarding_completed) redirect('/start')
     redirect('/dashboard')
     ```
  3. Actualizar BottomRibbon: `href: '/dashboard'` (destino fijo)
  4. Actualizar TopRibbon logo: `href: '/'` (router inteligente)
  5. Actualizar `/start` redirect: `/dashboard` en vez de `/`

  **Arquitectura resultante:**
  - `/` → Router inteligente → `/start` o `/dashboard`
  - `/dashboard` → Dashboard limpio (usuarios existentes)
  - `/start` → Chat-First Onboarding (usuarios nuevos)

- **Commit:** `983bdc1` — refactor: separate dashboard route and intelligent root router

- **Lección ORIGINAL (INCORRECTA):** Separar routing logic de UI logic. Un router inteligente en root + rutas especializadas es más mantenible que lógica condicional mezclada.

- **LECCIÓN REAL (DESPUÉS DEL REVERT):** El "intelligent router" fue **sobreingeniería**. Rompió todos los links del ribbon y agregó complejidad sin beneficio. Dos rutas simples (`/` dashboard, `/start` onboarding) son mejores que tres rutas con lógica de routing intermedia. **KISS (Keep It Simple, Stupid)** — la simplicidad gana sobre la "elegancia arquitectónica" cuando no hay problema concreto que resolver. La solución fue revertida completamente en commit 6f30555.

---

### 16. DELETE silencioso — devuelve 200 pero no borra datos de DB

- **Problema:** DELETE de proyectos devuelve status 200 true desde el servidor pero NO borra los datos de Supabase. Archive funciona correctamente. Frontend muestra `[ProjectList] Delete response: 200 true` pero el proyecto sigue existiendo en DB.

- **Causa raíz:** PENDIENTE DE CONFIRMACIÓN. Hipótesis activas: (1) RLS bloqueando silenciosamente — policy existe pero quizá mal configurada; (2) CASCADE constraints bloqueando delete; (3) Transaction rollback silencioso sin error; (4) Cache de Supabase client.

- **Consecuencia:** Feature de Delete no funcional. 6 commits acumulados de debugging (65939e5 → 35994bd) sin resolución definitiva. Logs de producción activos. `window.location.reload()` forzado como workaround temporal que no resuelve el problema de fondo.

- **Proceso de diagnóstico:**
  1. Verificado que fetch se ejecuta (200 response confirmado en browser)
  2. Agregado stopPropagation a botones (04fd03f)
  3. Agregado console.logs frontend (4d62997) — handlers SÍ se ejecutan
  4. Agregado force reload (237deaf) — no resuelve
  5. Creada migración 034 RLS DELETE policy (a707769) — descubierto que policy YA existía
  6. Agregado logging server-side detallado (35994bd) — `beforeCount` y `deletedCount`

- **Solución pendiente:** Revisar logs de Vercel para confirmar:
  - Si DELETE handler se ejecuta en servidor
  - Cuántas rows reporta beforeCount (debe ser 1)
  - Cuántas rows reporta deletedCount (debe ser 1 si funciona, 0 si RLS bloquea)
  - Si hay error de CASCADE o constraint violation

- **Commits involucrados:**
  - 65939e5: feat inicial
  - 04fd03f: stopPropagation
  - 4d62997: logs frontend
  - 237deaf: force reload
  - a707769: RLS policy (redundante)
  - 35994bd: logs backend

- **Resolución:** DELETE funcionaba correctamente desde el inicio. El proyecto que se intentaba borrar desde la UI era uno diferente al que se verificaba en DB. Durante el diagnóstico se borró manualmente un proyecto en Supabase, lo que confundió la verificación del estado real. El código siempre devolvió 200 true correctamente porque el DELETE sí se ejecutaba.

- **Lección real:** Antes de asumir que el backend falla, verificar que se está probando exactamente el mismo ID desde UI y desde DB. El borrado manual durante diagnóstico puede confundir la verificación del estado real. Debuggear sin confirmación clara del ID exacto que se está probando genera círculos de diagnóstico innecesarios. Los logs del browser mostraban `200 true` desde el inicio — esa era la señal de que funcionaba, no un silent failure.

---

### 17. Color sigue lavado — body section tiene background blanco por defecto

**Contexto:**
- Debug logs confirmaron: color llega correcto (#15803d verde)
- Fix anterior (boxShadow opacity 0.20) no resolvió el lavado
- Diagnóstico: div raíz tiene background correcto, pero elementos internos lo tapan

**Diagnosis:**
- GMCard línea 233: body div sin background explícito → navegador aplica blanco por defecto
- Este background blanco tapa el color del div raíz (violeta #3b0764 o verde #15803d)
- Los elementos internos (header, description box, footer) con backgrounds semitransparentes se ven sobre blanco, no sobre el color

**Solución:**
- Agregar `background: 'transparent'` condicional al body div para isolated teams
  ```typescript
  <div
    className="flex flex-1 min-h-0 flex-col gap-1 px-5 py-1"
    style={{ background: isIsolated ? 'transparent' : undefined }}
  >
  ```
- Remover debug logs temporales (teams/page.tsx, agent-map.ts, TeamAgentCard.tsx)

**Archivos modificados:**
- src/components/teams/map/TeamAgentCard.tsx — body background transparent línea 233-236
- src/app/teams/page.tsx — removed debug logs
- src/lib/db/agent-map.ts — removed debug logs

**Build:** ✅ Pasó sin errores

**Lección:**
- Elementos sin background explícito heredan blanco por defecto del navegador, no transparent
- Cuando un div padre tiene color sólido, TODOS los hijos deben tener `background: transparent` explícito para que el color sea visible
- Los logs confirmaron que el problema era CSS puro, no data pipeline — color correcto llegaba pero quedaba oculto debajo de capas blancas

## 2026-06-23 — connectionContext: .single() falla con registros históricos de conexión

- Problema: Al eliminar el filtro .eq('status', 'active') de la query de
  team_connections (necesario para distinguir conexión inexistente de
  conexión inactiva), la query con .single() podía fallar con error de
  PostgreSQL en vez de retornar undefined.

- Causa raíz: scope_isolated_team_id no tiene constraint UNIQUE en
  team_connections. El status se actualiza in-place en accept/disconnect/
  reject, pero si un team se desconecta y luego se reconecta con el mismo
  partner, el accept reutiliza el scope_isolated_team_id existente,
  generando una segunda fila. Dos filas con el mismo scope_isolated_team_id
  → .single() rompe con error, no con undefined controlado.

- Consecuencia: Workspace con historial de reconexión podía crashear al
  cargar, en vez de mostrar el estado correcto. No detectado por los 15
  ítems de validación de la OE porque ninguno cubría "team con más de un
  registro histórico de conexión".

- Proceso de solución: Verificación de schema (sin UNIQUE constraint) +
  verificación de código de accept/disconnect/reject (confirmando
  actualización in-place pero sin prevenir duplicados) + reproducción del
  escenario de reconexión.

- Solución final: Reemplazar .single() por 
  .order('updated_at', { ascending: false }).limit(1).maybeSingle()
  — toma siempre la fila más reciente, nunca lanza error por duplicados.

- Commit: 7f185ef

- Lección: Cuando se elimina un filtro que garantizaba unicidad implícita
  (como status = 'active'), verificar el schema antes de asumir que
  .single() sigue siendo seguro. Si no hay UNIQUE constraint en los campos
  restantes, usar .maybeSingle() + ordenamiento explícito por defecto.

---

### 16. Human Chat Realtime: dos causas distintas bajo un mismo síntoma

- **Problema:** Los mensajes humanos en Connected Teams podían requerir F5 para verse del lado del receptor. El síntoma se reportó como un solo problema, pero el diagnóstico de esta sesión confirmó que corresponde a dos causas distintas en momentos distintos del proyecto.

- **Causa raíz 1 — CONFIRMADA Y RESUELTA:** Errores de hydration de React (#425, #418, #423) rompían el árbol de React en HumanChatPanel, impidiendo cualquier actualización de UI — ni optimistic update ni Realtime podían reflejarse en pantalla. Resuelto en commits 829abdd y 7a3a3f7 (2026-06-18) agregando estado `isMounted` y calculando `messagesByDay` solo en cliente. Este fix también resolvió un problema asociado de mensajes duplicados, vía deduplicación en el callback de Realtime.

- **Causa raíz 2 — PROBABLE, NO CONFIRMADA, PENDIENTE DE FIX:** Con el árbol de React ya estable, persiste una ventana de carrera entre la carga inicial de mensajes en servidor (SSR, timestamp T0) y el momento en que el canal de Realtime queda suscrito en el cliente (timestamp T1). Un mensaje insertado en esa ventana no llega al receptor por evento Realtime, y solo aparece tras F5 (que vuelve a traer todo el historial). El emisor no sufre este gap porque ve su propio mensaje vía optimistic update, independiente de Realtime.

- **Consecuencia:** El receptor puede no ver mensajes entrantes en tiempo real de forma consistente, específicamente cuando el envío ocurre muy cerca del momento en que el receptor abre o recarga el workspace.

- **Proceso de diagnóstico:** Mini OE de solo lectura: localización de las 3 suscripciones Realtime del proyecto, revisión de ciclo de vida del canal (useEffect, cleanup), scope del canal (filtro por connection_id, sin colisión entre usuarios/pestañas), revisión de políticas RLS de human_messages (SELECT policy simple, riesgo bajo), y reconstrucción temporal de la secuencia SSR → mount → subscribe.

- **Solución final:** Se implementó refetch incremental único al confirmar estado `SUBSCRIBED` del canal Realtime. Cuando el callback de suscripción detecta `status === 'SUBSCRIBED'`, ejecuta una consulta a `human_messages` filtrando por `connection_id`, usando el mismo Supabase client del componente. Los mensajes refetcheados se mergean con el estado local usando deduplicación por `message.id` (Map por ID + sort cronológico). Esto cierra la ventana de carrera T0→T1 entre SSR y mount del canal, sin agregar polling continuo. Se agregó guard `isMounted` para prevenir setState después de cleanup. Implementado en `HumanChatPanel.tsx` líneas 102-188 (modificación del callback de `.subscribe()`).

- **Commit:** (pendiente en esta sesión)

- **Lección:** Un mismo síntoma reportado ("hace falta F5") puede tener más de una causa raíz en momentos distintos del proyecto. Antes de diagnosticar de nuevo un síntoma ya investigado, revisar el historial de commits relacionados — puede que el problema original ya esté resuelto y lo que se observa ahora sea un caso residual distinto, no una recurrencia del mismo bug.

---

### 17. EditTeamModal: cambio de provider no se refleja en Workspace

- **Problema:** El usuario cambia el provider del Manager desde EditTeamModal (ej. Gemini → OpenAI), guarda el cambio, pero el Workspace sigue mostrando y usando el provider anterior hasta que se hace F5.

- **Causa raíz:** CONFIRMADA. El modal guarda correctamente en `agent_sessions.provider` (misma tabla y campo que lee el Workspace — no hay desconexión de fuente de verdad: payload completo, API actualiza correctamente). El problema es que WorkspaceShell/WorkspaceClient reciben `workspace` como prop inmutable cargada una sola vez por SSR al abrir la página. No existe ningún mecanismo (`router.refresh`, revalidación, refetch) que vuelva a pedir esos datos después de que el modal cierra. AgentPanel renderiza `session.provider` directamente desde esa prop congelada. El commit `5718f32` (fix de isolated teams) se descartó como causa — solo tocó layout visual y filtro de agentes, sin relación con guardado/lectura de provider.

- **Consecuencia:** La UI confirma una edición que no impacta el comportamiento real del Workspace hasta una recarga manual completa — riesgo de que el usuario piense que cambió el provider de una sesión en curso cuando en realidad sigue operando con el provider anterior.

- **Proceso de diagnóstico:** Mini OE de solo lectura: se trazó el flujo completo desde el `<select>` del modal hasta el render de AgentPanel, confirmando que escritura y lectura usan la misma tabla/campo (descartando hipótesis de team vs agent_session y de payload incompleto), y aislando la causa real en la ausencia de revalidación de las props SSR del Workspace.

- **Solución final:** Se implementó `router.refresh()` en el callback `handleUpdated` de `TeamsClient.tsx` (componente padre que renderiza EditTeamModal). El provider ya se persistía correctamente en `agent_sessions` mediante `PATCH /api/teams/[id]`. El problema era que el Workspace podía seguir usando datos SSR previamente cargados. `router.refresh()` fuerza a Next.js a revalidar el árbol server/client del lado del usuario que editó, permitiendo que al volver al Workspace se lea el provider actualizado sin F5 manual. Esta solución cubre el alcance MVP aprobado: edición desde Teams/Teams Map y posterior entrada al Workspace. No cubre workspaces ya abiertos en otra pestaña paralela.

- **Commit:** Mini OE 2026-06-23 — `fix: refresh teams route after provider update`

- **Lección:** En Next.js App Router, datos cargados por SSR y pasados como props son inmutables del lado del cliente. Un guardado exitoso en base de datos no implica que la UI lo refleje — falta siempre confirmar que existe un paso explícito de revalidación (`router.refresh`, refetch, o invalidación de cache) entre "se guardó" y "se ve actualizado". Patrón `router.refresh()` tras guardado exitoso ya establecido en el repo (AdminClient.tsx, ProjectList.tsx) — aplicado consistentemente a TeamsClient.

---

### 18. team.type muta de 'isolated' a 'SAT' al editar provider desde EditTeamModal

- **Problema:** Al editar el provider del Manager desde `EditTeamModal` en un team `isolated` asociado a Connected Teams, el team completo se transforma visual y funcionalmente en un team estándar. Síntomas: aparecen Worker 1 y Worker 2 (que ya existían en DB pero estaban ocultos por filtro visual), el chat humano deja de funcionar, Teams Map muestra estructura diferente, badge "Shared Session" desaparece.

- **Causa raíz:** CONFIRMADA. El modal envía payload PATCH a `/api/teams/[id]` que incluye `name`, `description`, `lead_role`, `parentId`, `agents`, **pero NO incluye `type`**. La API route (línea 25) calcula `teamType = computeType(agents)` desde los providers de los agents recibidos, y en línea 32 **SIEMPRE sobrescribe** `teams.type = teamType` sin condicional. Para teams `isolated`, el modal solo envía el manager (línea 72 de EditTeamModal.tsx filtra `rawAgents.slice(0, 1)`), entonces `computeType()` retorna `'SAT'` (1 solo provider = SAT), y la API sobrescribe `type = 'SAT'`, mutando silenciosamente el team de `'isolated'` a `'SAT'`.

- **Consecuencia:** El team `isolated` pierde su identidad de Connected Teams. El workspace page SSR (línea 90) verifica `if (team?.type === 'isolated')` para cargar `connectionContext` y human messages — si `type !== 'isolated'`, no carga `connectionContext`, por lo tanto `HumanChatPanel` no se renderiza (WorkspaceShell línea 425 renderiza solo si `connectionContext` existe). El filtro visual de `agent-map.ts` (línea 44) también falla, mostrando todos los agents en lugar de solo el manager. Badge "Shared Session" desaparece. Connection description/color no se aplican. El workspace conectado se convierte funcionalmente en un workspace estándar SAT.

- **Proceso de diagnóstico:** Mini OE de solo lectura. Se confirmó que el payload del modal no incluye `type` (líneas 132-144 de EditTeamModal.tsx), que la API sobrescribe `type` incondicionalmente (línea 32 de `/api/teams/[id]/route.ts`), que el bug es preexistente a commit `e0040c3` (router.refresh solo lo expuso visualmente), y que múltiples superficies dependen de `team.type === 'isolated'`: workspace page SSR, WorkspaceShell, HumanChatPanel, agent-map, MapView, TreeView, EditTeamModal.

- **Commits relacionados:** 
  - `e0040c3` NO introdujo el bug — solo agregó `router.refresh()` que hizo visible inmediatamente el cambio de `type`, antes solo visible tras F5 manual. El bug es preexistente desde la implementación original de `PATCH /api/teams/[id]`.
  - Fix aplicado en commit siguiente — preserva `type = 'isolated'` al editar teams de Connected Teams.

- **Solución final:** La API `PATCH /api/teams/[id]` fue ajustada para leer el `type` actual persistido del team antes de actualizar. Se agregó una consulta SELECT (líneas 16-20) que lee `teams.type WHERE id = params.id` antes del update. Si la lectura falla o no devuelve fila, la API retorna error 404 y no procede con el update (líneas 21-23). El cálculo del tipo final (línea 26) usa lógica condicional: si `currentTeam.type === 'isolated'`, preserva `'isolated'`; si no, recalcula con `computeType(agents)` como antes. Esto mantiene el comportamiento existente para teams SAT/MAT mientras protege la integridad de teams `isolated` de Connected Teams.

- **Recomendación OE futura 1 — Fix de código:** La API debe preservar `type` existente cuando `body.type` es `undefined`. Opciones: (A) Omitir campo `type` del objeto de update si no viene en el body; (B) Leer `type` actual del team antes de update y preservarlo si `body.type` es `undefined`; (C) Agregar `type` al payload del modal (riesgoso — usuario podría cambiar `isolated` a `SAT` manualmente). Opción A recomendada: agregar condicional en API route línea 29-35 para actualizar `type` solo si viene explícito en el body O si el team actual NO es `isolated`.

- **Recomendación OE futura 2 — Corrección de dato:** Identificar el team específico afectado en base de datos (actualmente `type = 'SAT'` pero debería ser `'isolated'` según `team_connections.scope_isolated_team_id`), validar ownership y estado de la conexión, y ejecutar `UPDATE teams SET type = 'isolated' WHERE id = '<team_id>'` con aprobación explícita del usuario. Requiere OE separada con backup previo.

- **Lección:** En APIs PATCH que actualizan múltiples campos, campos estructurales como `type` no deben recalcularse automáticamente desde campos derivados (`agents`) sin verificar primero el estado actual. Un `type` derivado de agents funciona para teams SAT/MAT, pero teams `isolated` tienen `type` asignado por sistema (al aceptar conexión), no por configuración de usuario — sobrescribirlo rompe invariantes de Connected Teams. Actualización parcial sin preservar campos críticos genera mutaciones silenciosas que rompen funcionalidad dependiente. Router.refresh() expuso bug preexistente que antes quedaba oculto por cache SSR. Solución: leer estado actual antes de update, aplicar lógica condicional para tipos especiales, fail-safe (retornar error si lectura falla en lugar de recalcular a ciegas).


---

### 19. Patrón arquitectónico — Derivación de identidad por posición en lugar de campo explícito

- **Problema general:** El sistema tiene múltiples puntos que derivan identidad de rol (quién es el Manager) y clasificación de team (SAT vs MAT) a partir de posición en array o recálculo local en runtime, en lugar de leer campos explícitos persistidos (`agent_role`, `teams.type`). Esto genera riesgo de mutación silenciosa cuando queries sin `ORDER BY` retornan filas en orden distinto después de UPDATE.

- **Incidentes observados (2026-06-23):**
  1. Badge SAT/MAT en header del Workspace cambió sin que usuario agregara/quitara agents
  2. Panel que debería mostrar "AI GENERAL MANAGER" mostró "WORKER 1" con provider distinto al editado
  3. (Relacionado) `team.type` mutaba de `'isolated'` a `'SAT'` al editar (ya corregido en commit 90b6de5)

- **Causa raíz arquitectónica:**

  **Múltiples fuentes de verdad para conceptos críticos:**

  1. **Manager identity:**
     - Fuente de verdad canónica: `agent_sessions.agent_role = 'manager'` (campo explícito en DB)
     - Implementación real en código: `workspace.agent_sessions[0]` (posición en array)
     - Desconexión confirmada

  2. **SAT/MAT classification:**
     - Fuente de verdad canónica: `teams.type` (campo persistido en DB, calculado al crear/actualizar team)
     - Implementación real en código: Recálculo local en runtime contando providers en `agent_sessions`
     - Desconexión confirmada

  **Queries sin ORDER BY explícito:**

  - `getWorkspaceWithAgents()`: `select('*, agent_sessions(*), teams(...)')` — sin ORDER BY
  - `getTeamsForProject()`: `select('*, workspaces(*, agent_sessions(*)))` — ORDER BY solo para teams, no para agent_sessions anidado
  - Postgres NO garantiza orden estable sin ORDER BY explícito
  - UPDATE de `agent_sessions` puede cambiar orden físico (`ctid`) de las filas
  - Próxima consulta sin ORDER BY puede retornar orden distinto

- **Mecánica del fallo:**

  1. Usuario edita provider del Manager desde EditTeamModal
  2. API ejecuta UPDATE a `agent_sessions` en loop (uno por agent)
  3. Postgres reorganiza físicamente las filas (cambio de `ctid` o reorganización de página)
  4. Usuario recarga workspace (o `router.refresh()` fuerza SSR)
  5. Query `getWorkspaceWithAgents()` sin ORDER BY retorna agents en orden distinto
  6. `workspace.agent_sessions[0]` ahora apunta a Worker1 en lugar de Manager
  7. WorkspaceShell renderiza Worker1 como primer panel (etiquetado "Manager Panel")
  8. Badge SAT/MAT recalculado desde orden distinto puede cambiar si conteo de providers cambia por coincidencia de posición

- **Superficies afectadas (mapeo exhaustivo):**

  **Riesgo ALTO (asumen posición = identidad):**

  1. `WorkspaceShell.tsx` líneas 446-465: `workspace.agent_sessions[0]` como Manager Panel
  2. `EditTeamModal.tsx` línea 72: `rawAgents.slice(0, 1)` para teams isolated
  3. `agent-map.ts` línea 45: `workspace.agent_sessions.slice(0, 1)` para Teams Map/Tree
  4. `WorkspaceShell.tsx` líneas 75-78: Recalcula SAT/MAT localmente contando providers
  5. `workspace/[id]/page.tsx` línea 53: Recalcula SAT/MAT localmente en SSR

  **Riesgo MEDIO:**

  6. `HandoffPackageModal.tsx` líneas 25-26: `sessions[0]` y `sessions[1]` como defaults

  **Queries sin ORDER BY (infraestructura):**

  7. `workspaces.ts` línea 8: `getWorkspaceWithAgents()`
  8. `teams.ts` línea 46: `getTeamsForProject()`

- **Consecuencias del patrón:**

  - Mutaciones silenciosas de identidad visual (Manager ↔ Worker)
  - Badge SAT/MAT inestable (cambia sin acción del usuario)
  - Teams isolated pueden mostrar/editar el agent equivocado
  - Review & Forward puede fallar si depende de orden (mitigado parcialmente — usa `.find(role)`)
  - Debugging extremadamente difícil (síntoma intermitente, depende de timing de UPDATE y queries posteriores)

- **Proceso de diagnóstico:**

  Mini OE de solo lectura. Se mapearon todas las superficies que determinan Manager identity y SAT/MAT classification. Se confirmó que múltiples puntos usan posición en lugar de campo explícito, y que queries críticas carecen de ORDER BY. Se verificó comportamiento conocido de Postgres: UPDATE puede cambiar orden físico de filas, queries sin ORDER BY no garantizan estabilidad. Se descartó que el patrón provenga de código heredado de demo — es implementación local del MVP que asumió orden estable.

- **Solución final:** Implementada 2026-06-24. Se aplicó Opción C+ (híbrida mejorada).

  **Opción C+ implementada:**
  1. ✅ Agregado `ORDER BY agent_role ASC` en `workspaces.ts` y `teams.ts` (infraestructura)
  2. ✅ Reemplazado recálculo local SAT/MAT por lectura directa de `teams.type` en `WorkspaceShell.tsx` y `workspace/[id]/page.tsx`
  3. ✅ Reemplazado `agent_sessions[0]` y `slice(0,1)` por `.find(s => s.agent_role === 'manager')` en las 3 superficies críticas: `WorkspaceShell.tsx`, `EditTeamModal.tsx`, `agent-map.ts`
  4. ✅ Agregado manejo de caso anómalo con warnings en consola (no fallback silencioso a `[0]`)
  5. ✅ Deuda técnica residual documentada: `HandoffPackageModal` fuera de alcance C+ autorizado

  **Razón de C+ sobre C:** Se reemplazó el patrón `[0]` en superficies críticas en lugar de solo documentarlo como deuda técnica. Alcance menor que Opción B completa (no refactoriza todo el sistema de roles), pero elimina el riesgo activo en los 3 puntos confirmados de fallo.

- **Archivos modificados:**
  - `src/lib/db/workspaces.ts` — ORDER BY en query
  - `src/lib/db/teams.ts` — ORDER BY en query
  - `src/components/workspace/WorkspaceShell.tsx` — Manager explícito + team.type source
  - `src/components/teams/EditTeamModal.tsx` — Manager explícito en isolated filter
  - `src/lib/db/agent-map.ts` — Manager explícito en Teams Map/Tree
  - `src/app/workspace/[id]/page.tsx` — team.type source en SSR

- **Commit:** Pendiente. Fix completo en código.

- **Lección arquitectónica (reutilizable):**

  **Identidad derivada requiere fuente de verdad única y explícita.**

  Cuando un sistema necesita distinguir roles o clasificaciones (Manager vs Worker, SAT vs MAT), debe haber UNA fuente canónica de esa información, y el código debe leerla directamente en lugar de derivarla. Derivar identidad de posición en array, orden de retorno de queries, o recálculo local en múltiples puntos genera riesgo de desincronización. Si existe un campo persistido (`agent_role`, `teams.type`), úsalo. Si no existe, créalo. No confíes en orden físico de base de datos sin ORDER BY explícito — Postgres no garantiza estabilidad, y UPDATE puede reorganizar filas.

  **Red flags a evitar:**
  - `array[0]` como proxy de identidad sin ORDER BY garantizado
  - Recálculo local de clasificación en lugar de lectura de campo persistido
  - Múltiples superficies calculando el mismo concepto de forma independiente
  - Queries sin ORDER BY para datos donde el orden importa
  - Comentarios que dicen "typically" o "usually" sobre posición → admiten que no es garantía

  **Patrón correcto:**
  - Campo explícito en DB (`agent_role`, `type`)
  - Query con ORDER BY si orden importa
  - Acceso por filtro explícito: `.find(s => s.agent_role === 'manager')` en lugar de `[0]`
  - Fuente de verdad única: si `teams.type` existe, no recalcular SAT/MAT en runtime


- **Nota de seguimiento — corrección del Anexo (2026-06-23):**

  Durante el cierre original de Estabilización C+ (commit `6b9cd0c`) se introdujo una desviación puntual del Anexo aprobado: dos superficies convertían `team.type` faltante en `SAT` de forma silenciosa, violando la regla de "no fallback silencioso" establecida en el Anexo.

  **Casos detectados:**
  - `src/app/workspace/[id]/page.tsx` línea 54: `team?.type ?? 'SAT'`
  - `src/components/workspace/WorkspaceShell.tsx` línea 87: `return 'SAT' as const // Defensive fallback`

  **Corrección aplicada (Mini OE de seguimiento):**
  - page.tsx: reemplazado `?? 'SAT'` por `?? undefined` con warning explícito si `rawTeamType` falta
  - WorkspaceShell.tsx: reemplazado `return 'SAT' as const` por `return null`
  - Propagado tipo `| null` en `AgentPanel.tsx` y `PromptLibrary.tsx`
  - Badge SAT/MAT solo se renderiza si existe (`{badge && (...)}`), estado unknown/faltante visualmente distinguible
  - Lógica de snapshot en AgentPanel ya manejaba correctamente: `teamType === 'SAT'` recibe snapshot, otros casos (MAT/null) reciben `[]`

  La estabilización C+ queda corregida para cumplir el Anexo aprobado: `teams.type` sigue siendo fuente canónica y, si falta, no se reemplaza por un valor inferido. Se elimina el fallback silencioso a `SAT` en `workspace/[id]/page.tsx` y `WorkspaceShell.tsx`.

  **Archivos adicionales modificados:**
  - `src/app/workspace/[id]/page.tsx`
  - `src/components/workspace/WorkspaceShell.tsx`
  - `src/components/workspace/AgentPanel.tsx`
  - `src/components/workspace/PromptLibrary.tsx`

  **Build:** ✅ Exitoso. Grep confirmó eliminación de fallbacks silenciosos.


- **Nota de auditoría — Riesgo residual mitigado por constraint de DB (2026-06-23):**

  Tras la corrección del fallback silencioso, se auditó el ensanchamiento de tipo `teamType` propagado a `AgentPanel.tsx` y `PromptLibrary.tsx`. Confirmado como seguro: toda la lógica consumidora usa `teamType === 'SAT'` (nunca `!== 'MAT'`), así que `null` cae en la misma rama conservadora que `MAT` (sin snapshot compartido), que es el comportamiento correcto para estado desconocido.

  **Riesgo residual identificado (no corregido, no requiere acción inmediata):**

  En Teams Map, `TeamAgentCard.tsx` (línea 247) y `AgentCard.tsx` (líneas 74, 169) renderizan `node.teamType` directamente como texto sin manejar caso `null`. Hoy esto está protegido porque `teams.type` tiene constraint `NOT NULL` en DB (migración 001) — la fila nunca puede llegar sin valor. Si ese constraint se relajara en el futuro, esos componentes mostrarían literalmente "null" como texto en UI.

  **Lección arquitectónica adicional:**

  **Protección de UI basada en constraint de DB debe documentarse explícitamente.**

  Cuando un componente asume que un valor nunca será `null` porque confía en un constraint de DB (en vez de manejar el caso defensivamente en código), esa dependencia debe quedar documentada. De lo contrario, un cambio de schema aparentemente inocuo puede reintroducir el patrón de "asunción silenciosa" que corregimos en Estabilización C+. La alternativa es que cada componente maneje `null` explícitamente con fallback visible ("Unknown", "—", etc.), pero eso duplica la protección cuando el constraint ya la garantiza. El trade-off es: duplicación defensiva vs. documentación de la dependencia. Elegimos documentar en este caso porque el constraint es parte del diseño arquitectural (teams siempre tiene tipo).

  **Archivos auditados:** `AgentPanel.tsx`, `PromptLibrary.tsx`, `/api/chat/route.ts`, `TeamAgentCard.tsx`, `AgentCard.tsx`, `TreeView.tsx`, migraciones 001 y 028.

  **Conclusión:** Ensanchamiento de tipo seguro. No requiere corrección.

---

## #20 — HumanChat optimistic update con `broadcast: { self: false }`

**Problema:**
El emisor de un Review & Forward Manager → humano no veía su propio mensaje en `HumanChatPanel` sin F5, pese a que el mensaje se guardaba correctamente en DB.

**Causa raíz:**
La suscripción Realtime del `HumanChatPanel` usa `broadcast: { self: false }` (línea 108), por lo que el emisor **no recibe su propio evento de INSERT** por diseño de Supabase Realtime. El envío manual ya hacía optimistic update local (líneas 236-245), pero el camino de forward agregado en commit `aaf0b6e` descartaba el mensaje devuelto por el endpoint y asumía incorrectamente que Realtime actualizaría la vista del emisor (comentario líneas 181-182: "will appear via Realtime subscription").

**Consecuencia:**
El forward se guardaba correctamente, pero la vista del emisor quedaba desactualizada hasta refresh manual. El destinatario tampoco veía el mensaje inmediatamente (gap Realtime conocido, independiente del forward).

**Proceso de solución:**
1. Diagnóstico confirmó que `/api/human-chat` devolvía el mensaje insertado con `id`, `created_at` y todos los campos necesarios.
2. Se comparó el envío manual (que SÍ funciona) con el camino de forward (que no).
3. Se identificó que el forward descartaba el mensaje devuelto (`await res.json()` sin usar el valor).
4. Se confirmó que `broadcast: { self: false }` es por diseño y NO debe cambiarse.
5. Se agregó método `appendMessage` al ref de `HumanChatPanel` con deduplicación por `message.id`.
6. Se extrajo helper local `appendMessageWithDedupe` para reutilizar lógica entre envío manual y nuevo método de ref.

**Solución final:**
- `HumanChatPanelHandle` expone `appendMessage(message: HumanMessage)` con dedupe por `message.id` y orden cronológico.
- `WorkspaceShell.tsx` usa el mensaje real devuelto por `/api/human-chat` y lo agrega localmente via `humanChatRef.current?.appendMessage(newMessage)`.
- El comentario incorrecto fue corregido para reflejar la realidad técnica de `broadcast: { self: false }`.
- El helper local elimina duplicación entre envío manual y método de ref, sin cambiar comportamiento.

**Lección:**
Toda funcionalidad que inserte mensajes humanos en `HumanChatPanel` debe considerar que **`broadcast: { self: false }` excluye al emisor del evento Realtime por diseño**. El emisor necesita actualización local explícita si debe ver su propio mensaje inmediatamente. No asumir que "el mensaje aparecerá via Realtime" — eso solo aplica al destinatario, no al emisor.

**Patrón reutilizable:**
```typescript
// 1. POST al endpoint y obtener mensaje insertado
const res = await fetch('/api/human-chat', { method: 'POST', body: ... })
const newMessage = await res.json() as HumanMessage

// 2. Actualizar vista local del emisor
humanChatRef.current?.appendMessage(newMessage)

// 3. El destinatario recibirá el mensaje via Realtime (si la suscripción está activa)
```

**Archivos modificados:**
- `src/components/workspace/HumanChatPanel.tsx` — interface, helper, método ref
- `src/components/workspace/WorkspaceShell.tsx` — uso de mensaje real + comentario corregido

**Commits:** `aaf0b6e` (forward original) + follow-up 2026-06-24 (optimistic update)

---

### 21. RLS gap — Connected Teams Invitee no puede persistir mensajes

**Problema:**
Invitado de Connected Teams (receiver en team_connections) puede ver el workspace compartido y el Manager panel, pero sus mensajes al AI Manager no persisten. Después de F5, todos los mensajes del Invitado desaparecen. Contador de mensajes en tabla `messages` sube para Host, no sube para Invitado. Error completamente silencioso — no hay alerta visual, solo `console.error` oculto.

**Causa raíz:**
Política RLS `messages_insert` solo valida `p.account_id = auth.uid()`, que es TRUE solo para el Host (dueño del project). Invitado tiene `auth.uid()` diferente, entonces la condición falla y Supabase bloquea el INSERT. Migración 028 (Connected Teams) agregó políticas de Invitado para `workspaces` y `agent_sessions`, pero NO actualizó `messages` ni otras 12 tablas con FK a `workspace_id`/`session_id`.

**Arquitectura del problema:**
Cuando migración 028 introdujo Connected Teams, extendió el modelo de "dueño único" (single-account ownership) a "dueño + invitado compartido" (shared multi-account access). Las políticas RLS de `workspaces` y `agent_sessions` fueron actualizadas para contemplar acceso del Invitado via `team_connections.receiver_account_id`. Pero el resto de tablas relacionadas (13 en total) NO fueron actualizadas en la misma migración.

RLS evalúa políticas tabla por tabla — no hereda acceso transitivamente. El hecho de que el Invitado pueda leer `agent_sessions` NO hace que automáticamente pueda insertar en `messages`. Cada tabla necesita su propia política explícita.

**Consecuencia:**
- **Data loss silencioso** en producción
- Invitado ve sus mensajes en UI (estado local React) pero nunca se guardan en DB
- Al recargar, conversación del Invitado desaparece completamente
- Feature core (chat con Manager) rota para 50% de los usuarios de Connected Teams
- No hay feedback visual — usuario no sabe que está perdiendo datos

**Por qué el error fue silencioso:**
`AgentPanel.tsx` línea 340 hace POST a `/api/messages` sin verificar `res.ok`. Cuando RLS bloquea, endpoint retorna 500, pero `fetch()` NO lanza excepción (HTTP 500 es respuesta válida, no error de red). El código solo hace `console.error` dentro del `catch`, que nunca se ejecuta porque no hay excepción. Usuario no ve nada.

**Proceso de diagnóstico:**
1. Product Owner reportó: "mensajes del Invitado desaparecen al recargar, mensajes del Host persisten"
2. Consulta SQL directa confirmó: tabla `messages` solo tiene mensajes del Host, ninguno del Invitado
3. Auditoría de políticas RLS comparó `messages` vs `workspaces` vs `agent_sessions` vs `human_messages`
4. `human_messages` (migración 037, posterior a Connected Teams) SÍ contempla Invitado correctamente
5. `messages` (migración 002, pre-Connected Teams) NO fue actualizado en migración 028
6. Búsqueda exhaustiva: 12 tablas adicionales con mismo problema

**Solución requerida (NO aplicada en esta OE):**
Agregar política RLS para Invitee access en 13 tablas:
- `messages` (CRÍTICO — data loss confirmado)
- `checkpoints`, `checkpoint_messages` (ALTO — feature core)
- `session_attachments`, `session_tool_calls` (MEDIO — features avanzadas)
- `token_usage` (MEDIO-ALTO — bloqueante para billing real, no urgente para operación actual)
- 7 tablas adicionales con menor impacto (ver auditoría completa en handoff.md)

Patrón a seguir (ejemplo para `messages`):
```sql
CREATE POLICY "Invitee can insert messages in isolated workspace"
  ON public.messages FOR INSERT WITH CHECK (
    session_id IN (
      SELECT ags.id
      FROM public.agent_sessions ags
      JOIN public.workspaces w ON w.id = ags.workspace_id
      JOIN public.team_connections tc 
        ON tc.scope_isolated_team_id = w.team_id
      WHERE tc.receiver_account_id = auth.uid()
        AND tc.status = 'active'
        AND tc.scope_isolated_team_id IS NOT NULL
    )
  );
```

**Lección arquitectónica:**
Al extender un modelo de "dueño único" a "acceso compartido multi-cuenta", **cada tabla relacionada debe auditarse explícitamente**. No asumir que "si la tabla padre tiene acceso, las hijas heredan". RLS no funciona así.

Checklist obligatorio para cualquier feature multi-account:
1. Identificar TODAS las tablas con FK a las entidades compartidas (usar grep de migraciones)
2. Auditar políticas existentes tabla por tabla
3. Extender políticas en la MISMA migración que introduce la feature
4. Validar que errores RLS sean visibles (agregar verificación de `res.ok` en fetch)
5. Testing end-to-end con ambos roles (owner + invitee/collaborator)

**Síntoma de alerta:**
Si una migración agrega políticas de acceso compartido para 2-3 tablas pero el feature involucra 10+ tablas relacionadas, hay RLS gaps.

**Patrón anti:** 
"Migración 028 arregló workspaces y agent_sessions, el resto debe funcionar por transitividad" ❌

**Patrón correcto:**
"Migración 028 debe actualizar TODAS las tablas con FK a workspace_id/session_id, o documentar explícitamente cuáles NO se comparten y por qué"

**Hallazgo:**
Auditoría completa encontró 13 tablas con políticas inseguras para Connected Teams:
- 3 críticas (data loss o feature core rota)
- 4 media-alta (billing/compliance/features avanzadas)
- 6 baja (administrativas/opcionales, requieren decisión arquitectónica)

Ver `handoff.md` entrada 2026-06-24 para tabla completa de auditoría con las 20 tablas evaluadas.

**Archivos involucrados:**
- `supabase/migrations/002_messages.sql` — políticas originales (pre-Connected Teams)
- `supabase/migrations/028_scope_isolated_team.sql` — introdujo Connected Teams, actualizó solo 2 tablas
- `supabase/migrations/037_human_messages.sql` — tabla nueva post-Connected Teams, políticas correctas desde el inicio
- `src/components/workspace/AgentPanel.tsx` — sendPrompt sin verificación de res.ok (oculta errores RLS)
- `src/app/api/messages/route.ts` — endpoint que retorna 500 cuando RLS falla

**Fecha descubrimiento:** 2026-06-24 (incidente reportado por Product Owner)
**Fecha auditoría:** 2026-06-24 (mapeo completo de 20 tablas)
**Estado:** Pendiente corrección (cada tabla requiere OE separada, testing exhaustivo, no tocar RLS sin revisión)

**Solución final — `messages`:**
Se preparó migración RLS 040 específica para `messages`.

La solución agrega policies adicionales de `SELECT` e `INSERT` para el Invitado de una conexión `active`, siguiendo el mismo patrón validado en `agent_sessions` (migración 028) y `human_messages` (migración 037): el acceso se permite únicamente cuando `messages.session_id` pertenece a una `agent_session` del workspace cuyo `team_id` coincide con `team_connections.scope_isolated_team_id`, y el usuario autenticado es `team_connections.receiver_account_id`.

Las policies existentes del Host no fueron modificadas ni eliminadas.

También se agregó manejo explícito de error en los tres POSTs de `AgentPanel.tsx` hacia `/api/messages`, para que un fallo de persistencia ya no quede silencioso. Ahora verifican `res.ok` y logean status + detalles del error.

**Aplicación:**
- Migración aplicada a base de datos real por Product Owner desde SQL Editor de Supabase
- Confirmación: "Success" sin errores
- Fecha: 2026-06-24

**Nota de validación:**
Claude Code validó la lógica SQL y el build exitoso. La validación real de RLS requiere prueba viva con cuentas autenticadas Host/Invitado/Tercero. Esas pruebas deben ser ejecutadas manualmente por el Product Owner y registradas cuando se completen.

**Alcance:**
- Tabla corregida: `messages` ✅
- Tablas no corregidas en esta OE: `checkpoints`, `checkpoint_messages`, `session_attachments`, `session_tool_calls`, `token_usage`, `audit_log` y cualquier otra tabla del listado de auditoría (requieren OEs separadas)

**Archivos:**
- `supabase/migrations/040_invitee_messages_access.sql`
- `src/components/workspace/AgentPanel.tsx` (res.ok check en 3 POSTs)
- Commit pendiente


---

## Google OAuth reutilizaba cuenta activa y SMPanel conservaba localStorage tras logout

### Problema
Después de hacer logout en AISync, el usuario intentaba iniciar sesión con Google pero Google reutilizaba automáticamente la última cuenta activa del navegador, sin mostrar selector de cuenta.

Además, las claves de localStorage usadas por SMPanel quedaban persistidas después del logout.

### Causa raíz
El flujo de `signInWithOAuth` para Google no enviaba `prompt: 'select_account'`. Sin ese parámetro, Google puede reutilizar su sesión OAuth activa y no mostrar pantalla de selección de cuenta.

La limpieza de sesión de AISync tampoco removía las claves locales de SMPanel:
- `sm-connection`
- `sm-messages`
- `sm-panel-open`

### Consecuencia
El usuario podía quedar atrapado en una cuenta Google previa aunque cerrara sesión dentro de AISync.

Borrar caché del navegador podía parecer una solución, pero solo enmascaraba el problema al limpiar también estado/sesión del navegador. No corregía la causa real en el flujo OAuth.

### Proceso de solución
- Se localizó el llamado real a `supabase.auth.signInWithOAuth` en `src/app/login/page.tsx`.
- Se confirmó que el provider Google no incluía `prompt: 'select_account'`.
- Se localizó el flujo real de logout en `src/components/LogoutButton.tsx`.
- Se confirmaron las claves exactas de localStorage usadas por SMPanel: `sm-connection`, `sm-messages`, `sm-panel-open`.
- Se agregó el query param OAuth mínimo preservando el `redirectTo` existente.
- Se agregó limpieza explícita de las claves SMPanel al logout con protección SSR.

### Solución final
El login con Google ahora incluye `queryParams: { prompt: 'select_account' }`, preservando el `redirectTo` existente.

El logout de AISync ahora elimina explícitamente:
- `sm-connection`
- `sm-messages`
- `sm-panel-open`

No se modificaron middleware, cookies SSR, scope de `signOut()` ni lógica interna de SMPanel.

### Lección
Cuando borrar caché "arregla" un síntoma de autenticación, no necesariamente confirma que el bug esté en la app local. Puede estar ocultando un problema de OAuth/session reuse. En flujos Google OAuth donde se necesita elegir cuenta, `prompt: 'select_account'` debe definirse explícitamente.

La limpieza de sesión debe ser exhaustiva: no solo el token de autenticación, sino también datos locales que dependen de la sesión (localStorage de features específicas).

---

### 22. RLS gap — Connected Teams Invitee no puede guardar ni leer checkpoints

**Problema:**
Invitado de Connected Teams (receiver en team_connections) no podía guardar checkpoints ni leer checkpoints existentes en workspaces compartidos. Síntoma similar al problema de `messages` (#21): error silencioso sin feedback visual. Confirmado tras resolver el RLS gap de `messages`.

**Causa raíz:**
Políticas RLS de `checkpoints` y `checkpoint_messages` (migración 003) solo validaban `p.account_id = auth.uid()` (ownership directo del project), sin contemplar acceso indirecto del Invitado vía `team_connections.status = 'connected'`. Arquitectura idéntica al problema de `messages`: migración 028 introdujo Connected Teams pero no actualizó estas dos tablas.

**Consecuencia:**
- **Feature de checkpoints completamente rota para Invitados**
- Botón "Save Version" ejecutaba sin error visible pero no persistía
- Invitado no podía ver checkpoints creados por Host
- Modal de checkpoints vacío para Invitado aunque existieran versiones guardadas
- Mismo patrón de data loss silencioso que `messages`

**Por qué el error fue silencioso:**
`WorkspaceShell.tsx` función `confirmSave()` NO verificaba `res.ok` antes de parsear JSON de `/api/checkpoint`. Cuando RLS bloqueaba el INSERT, el endpoint retornaba error pero el código asumía éxito y parseaba respuesta inválida. Mismo anti-patrón que `AgentPanel.tsx` antes del fix de `messages`.

**Proceso de diagnóstico:**
1. Después de resolver `messages` con migración 040, se identificó que `checkpoints` y `checkpoint_messages` requerían mismo fix
2. Auditoría de tablas del listado original (#21) confirmó prioridad: CRÍTICO para checkpoints, ALTO para checkpoint_messages
3. Revisión de políticas existentes (migración 003) confirmó pattern idéntico a `messages`
4. Comparación con `human_messages` (migración 037) reveló patrón correcto ya validado

**Solución final:**
Se preparó migración 041 específica para `checkpoints` + `checkpoint_messages`.

La solución agrega policies adicionales de `SELECT` e `INSERT` para el Invitado, siguiendo el patrón validado en migraciones 028, 037 y 040:
- `checkpoints` SELECT/INSERT: permite si `workspace_id` pertenece a workspace cuyo `team_id` coincide con `team_connections.scope_isolated_team_id` y usuario es `receiver_account_id` de conexión `active`
- `checkpoint_messages` SELECT/INSERT: permite si el checkpoint asociado es accesible por SELECT de checkpoints (acceso transitivo via FK)

Se agregó verificación de `res.ok` en `WorkspaceShell.tsx` función `confirmSave()` antes de parsear JSON, con logging explícito de status y error text si falla, siguiendo mismo patrón aplicado en `AgentPanel.tsx` para `messages`.

**Aplicación:**
- Migración aplicada a base de datos real por Product Owner desde SQL Editor de Supabase
- Confirmación: "Success" sin errores
- Fecha: 2026-06-26

**Patrón de la política:**
```sql
exists (
  select 1 from teams t
  join projects p on p.id = t.project_id
  where t.id = workspaces.team_id
    and (
      p.account_id = auth.uid()
      or exists (
        select 1 from team_connections tc
        where tc.status = 'connected'
          and (
            (tc.host_team_id = t.id and tc.invitee_user_id = auth.uid())
            or (tc.guest_team_id = t.id and tc.host_user_id = auth.uid())
          )
      )
    )
)
```

**Alcance:**
- Tablas corregidas: `checkpoints` ✅, `checkpoint_messages` ✅
- Código corregido: `WorkspaceShell.tsx` ✅ (res.ok check en confirmSave)
- Tablas no corregidas en esta OE: `session_attachments`, `session_tool_calls`, `token_usage`, `audit_log` y otras del listado (requieren OEs separadas)

**Archivos:**
- `supabase/migrations/041_invitee_checkpoints_access.sql` — nueva migración
- `src/components/workspace/WorkspaceShell.tsx` — res.ok check en confirmSave
- `handoff.md` — entrada completa con doble validación
- `CodingWorkshop.md` — esta entrada
- `PRODUCT_STATUS.md` — actualizado

**Nota de validación:**
Claude Code validó la lógica SQL y el build exitoso. La validación real de RLS requiere prueba viva con cuentas autenticadas Host/Invitado/Tercero. Esas pruebas deben ser ejecutadas manualmente por el Product Owner y registradas cuando se completen.

**Lección arquitectónica:**
Confirmación del patrón de #21: **cada tabla relacionada con workspaces compartidos debe auditarse y extenderse explícitamente**. No hay "herencia transitiva" de RLS. Si una feature toca 5 tablas pero la migración solo actualiza 2, hay gaps. El patrón correcto: identificar TODAS las tablas con FK a workspace_id/session_id en la MISMA migración que introduce la feature multi-account.

El anti-patrón de "no verificar res.ok" genera data loss silencioso. Toda operación de persistencia (POST/PATCH/DELETE) debe verificar res.ok antes de parsear JSON. Sin esa verificación, errores RLS (500) pasan inadvertidos y el usuario pierde datos sin feedback visual.

**Patrón reutilizable para RLS Invitee:**
1. Identificar tabla con FK a workspace_id
2. Copiar patrón de política de tabla similar ya corregida (messages, human_messages, checkpoints)
3. Ajustar nombre de tabla y campos según schema
4. Aplicar a SELECT + INSERT (o UPDATE/DELETE según necesidad)
5. Verificar res.ok en código frontend antes de parsear respuesta del endpoint

