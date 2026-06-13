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
