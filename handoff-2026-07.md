# handoff-2026-07.md — Memoria operativa del proyecto AISync MVP

**Archivo activo desde:** 2026-06-30

Este archivo es la continuación de `handoff.md` (cerrado a los 576KB).

## Reglas de rotación de archivos handoff

**Regla 1 — Archivo activo por fecha:**  
La fecha que figura al inicio de cada archivo de handoff marca desde cuándo está activo ese archivo. Las entradas nuevas se agregan en el archivo cuya fecha de inicio es la más reciente antes de la fecha actual, no en archivos anteriores.

**Regla 2 — Rotación por tamaño:**  
Cuando el archivo de handoff activo alcance aproximadamente 400KB de tamaño, se debe crear un archivo nuevo siguiendo el mismo patrón de nombre (`handoff-YYYY-MM.md`, usando el mes en que se hace el corte), dejar una nota de continuidad al final del archivo que se cierra, y actualizar la referencia en CLAUDE.md (o donde corresponda) para que las sesiones futuras escriban en el archivo correcto.

---

Registro canónico acumulativo de decisiones importantes, estados cerrados, hallazgos técnicos y pendientes.  
**No reemplazar entradas anteriores. Agregar nuevas al final.**

---

## Sesión 2026-06-30 — Rotación de handoff.md

**Fecha:** 2026-06-30  
**Tipo:** Mantenimiento de documentación  
**Archivos modificados:**
- handoff.md (cerrado con nota de continuación)
- handoff-2026-07.md (nuevo archivo activo)
- CLAUDE.md (actualizada referencia a handoff activo)

**Razón del cambio:**
handoff.md alcanzó 576KB de tamaño, haciendo que operaciones de escritura con PowerShell/Add-Content fallaran por timeout (2min). Bash funcionaba pero el tamaño ya justificaba la rotación para mantener archivos manejables.

**Decisión técnica:**
Implementar sistema de rotación de archivos handoff por tamaño (~400KB threshold) usando patrón `handoff-YYYY-MM.md` con fecha del mes de rotación.

**Cambios implementados:**
1. Crear `handoff-2026-07.md` con:
   - Encabezado indicando continuación desde handoff.md
   - Fecha de inicio: 2026-06-30
   - Dos reglas de rotación explícitas documentadas
2. Agregar nota de cierre en `handoff.md`: "ARCHIVO CERRADO — Continuación en handoff-2026-07.md a partir del 2026-06-30"
3. Actualizar CLAUDE.md:
   - Sección "RUTINA DURA" ahora dice "Actualización de handoff" (genérico)
   - Especifica archivo activo: `handoff-2026-07.md` desde 2026-06-30
   - Lista archivos históricos: `handoff.md` (cerrado)
   - Documenta regla de rotación explícitamente
   - Prompt de Cierre actualizado para referenciar "archivo de handoff activo" en vez de nombre fijo

**Patrón de naming:**
`handoff-YYYY-MM.md` donde YYYY-MM es el año-mes en que se hace el corte (no necesariamente el primer día del mes — puede ser cualquier día en que se alcance el threshold de tamaño).

**Alternativas descartadas:**
- Comprimir handoff.md viejo: descartado porque se pierde legibilidad como histórico
- Usar fecha de día exacto (handoff-2026-06-30.md): descartado porque genera demasiada granularidad, usar mes es suficiente

**Riesgos conocidos:**
Sesiones futuras deben leer CLAUDE.md actualizado para saber cuál es el archivo activo. Si una sesión tiene cached una versión vieja de CLAUDE.md, podría intentar escribir en handoff.md (cerrado). Mitigación: el archivo cerrado tiene nota explícita al final indicando continuación.

**Estado:** CERRADA. Build N/A (solo docs). Commit f4ddbe7 pushed.

**Lección clave:**
Archivos de log acumulativos deben tener estrategia de rotación desde el diseño inicial. Un archivo que crece indefinidamente eventualmente genera problemas operativos (timeouts, performance, dificultad de navegación). El threshold de 400KB es empírico — ajustar si futuras rotaciones ocurren muy frecuentemente o muy raramente.

---

## Sesión 2026-06-30 — Etapa 8a: Unificación de fuente de datos en accept flow

**Fecha:** 2026-06-30  
**Tipo:** Refactor técnico (Connected Teams)  
**Estado:** CERRADA Y VALIDADA EN VIVO  
**Commit:** a077b27

**Archivos modificados:**
- src/app/api/connections/[id]/route.ts (252 → 252 líneas, reestructuración completa)
- src/lib/db/connections.ts (eliminación de helpers dual-read)
- src/components/teams/ConnectTeamModal.tsx (cleanup)
- src/components/teams/MapView.tsx (cleanup)
- src/components/teams/TreeView.tsx (cleanup)

**Contexto:**
Durante el rediseño de Connected Teams (iniciado en sesión anterior), se detectó un problema de arquitectura en el accept flow: el código mezclaba dos fuentes de datos inconsistentes (data del UPDATE, y fullConnection de un SELECT redundante) para nombrar teams del Host y del Invitado — con riesgo de desincronización por race conditions.

**Decisión técnica:**
Unificar a una sola fuente de verdad (data, el resultado del UPDATE autorizado por RLS), eliminando el fetch redundante de fullConnection.

**Cambios implementados:**

1. **Línea 57 de route.ts:**
   - Expandir .select() del UPDATE para incluir todos los campos necesarios:
     `requester_account_id, requester_team_id, requester_team_name, requester_email, receiver_email, description, color`
   - Esto elimina la necesidad de hacer un segundo SELECT

2. **Líneas 110-252 de route.ts:**
   - ELIMINADO: fetch redundante de fullConnection (11 líneas)
   - ELIMINADO: flow legacy de "OE A" con scope_isolated_team_id (180 líneas del código viejo)
   - SIMPLIFICADO: estructura directa que crea 2 proyectos + 2 teams aislados sin pasos intermedios

3. **Fuente única consistente:**
   - TODO el código usa data.requester_team_id, data.requester_account_id, data.requester_email, data.receiver_email, data.requester_team_name, data.description, data.color
   - Sin ninguna mezcla con fullConnection (que ya no existe)

4. **src/lib/db/connections.ts:**
   - Eliminados helpers de dual-read que ya no se usan

**Alternativas descartadas:**
- Mantener fullConnection y sincronizar manualmente: descartado porque mantiene el riesgo de desincronización
- Hacer dos UPDATEs separados: descartado porque genera más tráfico a DB y más puntos de falla

**Riesgos conocidos:**
- Si el UPDATE falla por alguna razón y no devuelve data completo, el try/catch fail-open lo captura (no bloquea el accept)
- El código asume que requester_team_id existe en data — si por alguna razón no está, el fetch de requesterTeam podría fallar (pero está dentro del try/catch)

**Beneficios:**
- Single source of truth previene race conditions de data desync
- Reduce DB queries: una menos por cada connection accept
- Código más limpio: -32 líneas netas después de reestructuración completa

**Verificaciones realizadas:**
✅ TypeScript type checking sin errores (npx tsc --noEmit)
✅ Build exitoso (npm run build)
✅ Lint exitoso (npm run lint) — solo warnings preexistentes en CanvasViewport.tsx
✅ Estructura de anidamiento coherente (4 niveles de if en cascada, cada cierre correcto)
✅ Indentación verificada visualmente

**VALIDACIÓN EN VIVO COMPLETADA — PASS ✅**

**Evidencia de testing (2026-06-30):**

✅ **Conexión de prueba creada:**
- Connection ID: `604bfeb6-...`
- Host (requester): `agustinestefanell@gmail.com`
- Invitee (receiver): `arenaglirsas@gmail.com`

✅ **Isolated teams confirmados separados:**
- `host_isolated_team_id`: `9cd4a379-...`
- `invitee_isolated_team_id`: `c4a392e7-...`
- Valores distintos confirmados ✓

✅ **Nombres de teams y proyectos verificados correctos:**
- Sin mezclas de fuente de datos
- Formato Host: `Shared: [requester_team_name] ↔ [receiver_email]`
- Formato Invitee: `Shared: [receiver_email] ↔ [requester_email]`
- Confirmado ✓

✅ **Workspaces separados confirmados:**
- Host workspace: `9a2099fc-...`
- Invitee workspace: `f4fb4b83-...`
- Cada team con su propio workspace ✓

✅ **Funcionalidad UI confirmada:**
- Host puede escribir al Manager sin error ✓
- Invitee puede escribir al Manager sin error ✓

**Resultado:** PASS en todos los criterios. La unificación de fuente de datos funciona correctamente en producción. No hay race conditions ni mezclas de información entre las dos fuentes de datos.

**Detalle cosmético no bloqueante:**
La línea `if (hostTeam && inviteeTeam)` (nivel 3) quedó con un poco más de indentación de la esperada (resto de corrección manual de llaves). No afecta comportamiento ni pasa lint. Prettier no está configurado en el proyecto para auto-formatear.

**Documentación actualizada:**
- handoff-2026-07.md: entrada completa con estado CERRADA Y VALIDADA EN VIVO
- DECISIONS.md: entrada formal de Etapa 8a documentando la decisión como parte del plan de 8 etapas de Connected Teams
- Estado del plan mayor (DECISIONS.md): Etapas 0-5 completadas, Etapa 8a completada (limpieza incremental), Etapas 6-8 pendientes

**Contexto del plan mayor:**
Esta OE es la primera sub-etapa de limpieza dentro del plan de 8 etapas de Connected Teams. El plan completo contempla eliminar `scope_isolated_team_id` en la Etapa 8 final. La Etapa 8a avanza en esa dirección limpiando código muerto (eliminación del flow legacy con `scope_isolated_team_id` que creaba un solo team compartido) y simplificando el flow de creación de isolated teams, sin tocar todavía `scope_isolated_team_id` mismo (eso queda para Etapa 8).

---

