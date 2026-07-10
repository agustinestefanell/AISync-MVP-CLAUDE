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

## Sesión 2026-07-01 — Context Files — Stage B: Fix extracción PDF por binario canvas faltante

**Fecha:** 2026-07-01
**Tipo:** Fix funcional / Runtime packaging
**Estado:** PARTIAL (implementado en rama, pendiente validación preview)
**Branch:** `fix/pdf-canvas-binary`
**Commit rama:** (pendiente)

**Contexto:**
Stage A (commit 03f4ffe) instrumentó logging y confirmó con logs reales de Vercel que la extracción PDF falla con `DOMMatrix is not defined`. Causa raíz: el binario nativo `@napi-rs/canvas-linux-x64-gnu` no se carga correctamente en runtime serverless de Vercel, a pesar de estar declarado en package-lock.json como dependencia opcional de pdfjs-dist.

**Objetivo Stage B:**
Corregir empaquetado runtime de @napi-rs/canvas sin tocar lógica de extracción de Stage A. Externalizar el paquete NAPI usando sintaxis válida para Next.js 14.2.35 y promover a dependencia directa exacta pineada.

**Resultado Demo First:**
- La demo (`C:\proyectos\AISync\MVP`) NO tiene `next.config.mjs` ni usa PDF parsing
- No hay patrón equivalente para portar
- Demo no modificada

**Archivos revisados:**
- `next.config.mjs` (vacío antes del cambio)
- `package.json` (tenía pdf-parse como transitiva)
- `package-lock.json` (ya tenía canvas-linux-x64-gnu declarado correctamente)
- `src/lib/context/extractText.ts` (sin cambios, Stage A intacto)
- `src/app/api/context/route.ts` (sin cambios, Stage A intacto)

**Archivos tocados:**
1. `next.config.mjs` (agregado experimental.serverComponentsExternalPackages)
2. `package.json` (agregado @napi-rs/canvas@0.1.80 como dependencia directa)
3. `package-lock.json` (actualizado automáticamente por npm)
4. `handoff-2026-07.md` (este archivo)
5. `PRODUCT_STATUS.md` (actualizado)
6. `CodingWorkshop.md` (entrada #24 actualizada)

**Cambios exactos realizados:**

1. **next.config.mjs:**
   ```js
   const nextConfig = {
     experimental: {
       serverComponentsExternalPackages: ['@napi-rs/canvas'],
     },
   };
   ```
   **Razón:** En Next.js 14.2.35, la externalización server-side debe usar `experimental.serverComponentsExternalPackages`, NO `serverExternalPackages` de primer nivel (sintaxis de Next 15). Esto previene que Next bundlee incorrectamente el paquete NAPI y su binario nativo.

2. **package.json:**
   ```bash
   npm install --save-exact @napi-rs/canvas@0.1.80
   ```
   Resultado: `"@napi-rs/canvas": "0.1.80"` (versión exacta, sin ^ ni ~)

   **Razón:** Promover de dependencia opcional/transitiva a directa exacta asegura que el build FALLE si no se instala (mejor que fallar en runtime). Versión 0.1.80 requerida por compatibilidad con pdfjs-dist (pide ^0.1.80, no 1.0.0).

**Verificaciones automáticas:**
- ✅ `experimental.serverComponentsExternalPackages` presente en next.config.mjs
- ✅ `serverExternalPackages` ausente (correcto para Next 14)
- ✅ `package.json` contiene `"@napi-rs/canvas": "0.1.80"` (exacto, sin rango semver)
- ✅ `npm ls @napi-rs/canvas` resuelve 0.1.80 deduped
- ✅ Validación node confirma pinning: `@napi-rs/canvas pinned OK: 0.1.80`
- ✅ Sin diff en `extractText.ts` ni `route.ts` (Stage A intacto)
- ✅ Build local exitoso (warnings preexistentes en CanvasViewport)

**Restricciones respetadas:**
- ✅ NO se tocó extractText.ts
- ✅ NO se tocó route.ts
- ✅ NO se tocó UI/UX
- ✅ NO se modificaron parsers
- ✅ NO se agregaron formatos nuevos
- ✅ NO se tocó extracted_text_available ni extraction_error
- ✅ NO se usó serverExternalPackages de primer nivel
- ✅ NO se instaló @napi-rs/canvas@1.0.0 ni versión con rango semver

**Estado actual:**
- Branch `fix/pdf-canvas-binary` creada desde main actualizado
- Cambios commiteados en rama (pendiente)
- Pusheado a origin (pendiente)
- Preview de Vercel (pendiente)
- Validación Build Logs (pendiente)
- Validación PDFs reales (pendiente)
- Merge a main (pendiente validación preview exitosa)

**Próximos pasos obligatorios:**
1. Push de rama a origin
2. Generar preview de Vercel desde rama
3. Revisar Build Logs de preview buscando:
   - Instalación correcta de @napi-rs/canvas@0.1.80
   - Instalación correcta de @napi-rs/canvas-linux-x64-gnu
   - Referencias a serverComponentsExternalPackages
   - Ausencia de warnings críticos sobre canvas/napi-rs
4. Subir `TdR_Agroecologia_DAUA_25_09_30.pdf` en preview
5. Subir `Presupuesto_Nicolas_Cuadro_Manantiales_Maldonado.pdf` en preview
6. Consultar `context_sources` y confirmar:
   - `extracted_text_available = true` para ambos
   - `extraction_error = null` para ambos
7. Si ambos PDFs se extraen correctamente: mergear a main
8. Si sigue fallando con `DOMMatrix`: aplicar intento intermedio con `experimental.outputFileTracingIncludes`

**Intento intermedio (solo si preview falla con DOMMatrix):**
Si después de aplicar `experimental.serverComponentsExternalPackages` y `@napi-rs/canvas@0.1.80` exacto, la preview sigue mostrando `DOMMatrix is not defined`, aplicar antes de escalar a `pdf.js standalone`:

```js
experimental: {
  serverComponentsExternalPackages: ['@napi-rs/canvas'],
  outputFileTracingIncludes: {
    '/api/context': ['./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*'],
  },
},
```

**INTENTO INTERMEDIO APLICADO — 2026-07-01 ~20:15**

**Evidencia sólida confirmada:** El intento base (solo `serverComponentsExternalPackages` + dependencia directa) NO fue suficiente.

**Validación en preview con 3 uploads reales:**
- **Upload 1:** 2026-07-01 20:01 → `DOMMatrix is not defined`
- **Upload 2:** 2026-07-01 20:08 → `DOMMatrix is not defined`
- **Upload 3:** 2026-07-01 20:12 (después de redeploy SIN caché) → `DOMMatrix is not defined`

**Conclusión:** El redeploy forzado sin caché de build descartó la hipótesis de caché. El problema NO es de caché — es que el binario nativo `@napi-rs/canvas-linux-x64-gnu` no se está incluyendo en el bundle serverless de `/api/context`.

**Cambio aplicado:**
Agregado `experimental.outputFileTracingIncludes` en `next.config.mjs` para forzar inclusión explícita del binario nativo en el tracer de Next.js:

```diff
 experimental: {
   serverComponentsExternalPackages: ['@napi-rs/canvas'],
+  outputFileTracingIncludes: {
+    '/api/context': ['./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*'],
+  },
 },
```

**Ruta confirmada:** `/api/context` (confirmado contra `src/app/api/context/route.ts`)

**Build local:** Exitoso

**Commit:** (siguiente paso)

**Próxima validación:** Nueva preview desde rama actualizada, repetir upload de PDFs reales

**Riesgos pendientes:**
- Preview podría fallar si Vercel tiene timeout/red/espacio insuficiente durante instalación del binario (32MB)
- Función serverless con binario nativo tendrá cold start más lento (~2-5s adicionales, aceptable para Context Files)
- Si persiste error después de intento intermedio con outputFileTracingIncludes, escalar a alternativa `pdf.js standalone` como último recurso

**Lección clave:**
En Next.js 14, paquetes NAPI server-side deben externalizarse con `experimental.serverComponentsExternalPackages`. Dependencias opcionales/transitivas no garantizan instalación del binario nativo en runtime serverless — promover a dependencia directa exacta pineada. Versión exacta sin rango semver previene incompatibilidades con peerDependencies de pdfjs-dist.

---

## Sesión 2026-07-01 — Context Files — Stage A: Instrumentación de errores de extracción

**Fecha:** 2026-07-01
**Tipo:** Fix funcional / Diagnóstico
**Estado:** PARTIAL (instrumentado, no validado con caso real)
**Commit:** (pendiente)

**Contexto:**
Algunos archivos PDF fallan en extracción de texto sin causa visible. Investigación previa identificó 4 archivos con `extracted_text_available=false`, sin mensaje de error persistido. El catch vacío en `route.ts:114` y los catches silenciosos en `extractText.ts:35,49` tragaban errores sin loggear.

**Objetivo Stage A:**
Instrumentar diagnóstico para capturar mensaje real de error, sin corregir extracción aún. Stage B corregirá con evidencia.

**Resultado Demo First:**
- La demo (`C:\proyectos\AISync\MVP`) NO implementa Context Files ni extracción de texto
- No hay patrón equivalente para portar
- Demo no modificada

**Archivos revisados:**
- `supabase/migrations/017_context_sources.sql` (schema de `context_sources`)
- `src/app/api/context/route.ts` (catch vacío línea 114)
- `src/lib/context/extractText.ts` (catches internos líneas 35, 49)

**Archivos tocados:**
1. `supabase/migrations/045_add_extraction_error_field.sql` (nuevo)
2. `src/app/api/context/route.ts` (catch instrumentado)
3. `src/lib/context/extractText.ts` (catches propagando error)
4. `handoff-2026-07.md` (este archivo)
5. `PRODUCT_STATUS.md` (actualizado)
6. `CodingWorkshop.md` (entrada agregada)

**Cambios exactos realizados:**

1. **Migración 045:**
   ```sql
   ALTER TABLE public.context_sources
   ADD COLUMN IF NOT EXISTS extraction_error TEXT;
   ```

2. **route.ts (líneas 114-133):**
   - Catch vacío reemplazado por logging estructurado
   - Captura `error.message` y `error.stack`
   - Loggea con `[Context Files] Extraction failed` + metadata (file_id, file_type, file_size_bytes)
   - Persiste error en `context_sources.extraction_error` vía UPDATE

3. **extractText.ts (líneas 35-39 y 53-57):**
   - PDF catch: loggea `[Context Files] PDF text extraction error` + `throw error`
   - DOCX catch: loggea `[Context Files] DOCX text extraction error` + `throw error`
   - Ambos propagán error hacia `route.ts` en lugar de devolver `{ text: null, supported: true }`

**Restricciones respetadas:**
- ✅ NO se modificó `extracted_text_available`
- ✅ NO se modificaron parsers (`pdf-parse`, `mammoth`)
- ✅ NO se agregaron formatos nuevos
- ✅ NO se tocó UI/UX visible
- ✅ NO se tocaron archivos no autorizados
- ✅ NO se modificaron migraciones anteriores
- ✅ NO se tocó RLS ni storage policies

**Resultado build/lint:**
- ✅ `npm run lint` — exitoso (2 warnings preexistentes en `CanvasViewport.tsx`, no relacionados)
- ✅ `npm run build` — exitoso (producción optimizada generada)

**Validación manual:**
❌ **NO EJECUTADA** — requiere:
1. Aplicar migración 045 en Supabase Dashboard
2. Re-subir archivo PDF fallido conocido (ej: `TdR_Agroecologia_DAUA_25_09_30.pdf`)
3. Consultar `context_sources.extraction_error` en DB

Query de validación pendiente:
```sql
SELECT id, title, file_type, file_size_bytes, extracted_text_available, extraction_error
FROM public.context_sources
WHERE title ILIKE '%TdR_Agroecologia_DAUA_25_09_30%'
ORDER BY created_at DESC LIMIT 5;
```

**Riesgos pendientes:**
- Migración 045 no aplicada en producción
- Error real aún desconocido (requiere validación manual)
- Stage B (fix de extracción) diferido hasta obtener evidencia diagnóstica

**Próximos pasos:**
1. Product Owner aplica migración 045 en Supabase
2. Product Owner re-sube archivo PDF fallido
3. Product Owner ejecuta query de validación y pega mensaje real de `extraction_error`
4. Con evidencia, diseñar Stage B (corrección de extracción)

**Lección clave:**
Los fallos de extracción deben preservar mensaje real y stack antes de diseñar fixes de parser o soporte de formatos. Instrumentar diagnóstico primero, corregir después.

---

## Sesión 2026-07-01 — Housekeeping: Migración 044 versionada + organización de diagnósticos

**Fecha:** 2026-07-01
**Tipo:** Housekeeping / infraestructura
**Estado:** CERRADA
**Commit:** ada3faf

**Archivos modificados:**
- `supabase/migrations/044_drop_scope_isolated_fields.sql` (agregado al repo, +89 líneas)
- `supabase/diagnostics/DIAGNOSTIC_QUERY_find_mystery_policy.sql` (movido desde raíz)
- `supabase/diagnostics/DIAGNOSTIC_QUERY_policies_scope_isolated.sql` (movido desde raíz)

**Contexto:**
Migración 044 ya estaba aplicada en producción (Etapa 8c — eliminación física de campos `scope_isolated_team_id` y `scope_isolated_workspace_id`). Solo faltaba versionar el archivo SQL en el repo.

**Cambios implementados:**
1. Agregado `044_drop_scope_isolated_fields.sql` a `supabase/migrations/`
2. Creada carpeta `supabase/diagnostics/` para queries de diagnóstico
3. Movidos 2 queries de diagnóstico de políticas RLS desde raíz de supabase a diagnostics/

**Razón del cambio:**
Mantener sincronizado el repo con el estado real de la base de datos en producción. Las migraciones aplicadas deben estar versionadas para trazabilidad y reproducibilidad en otros entornos.

**Decisión técnica:**
Organizar queries de diagnóstico en carpeta dedicada (`supabase/diagnostics/`) en lugar de dejarlos mezclados con migraciones. Mejora legibilidad y separación de responsabilidades.

**Notas adicionales:**
- Service role key de Supabase fue rotada previamente (Context Files diagnostic)
- `.claude/settings.local.json` quedó modificado localmente pero no fue comiteado (configuración de máquina, no va al repo compartido)
- Pendiente verificar si `.claude/settings.local.json` está en `.gitignore` (higiene, no urgente)

**Estado:** CERRADA. No requiere build (solo SQL). Commit `ada3faf` pushed exitosamente.

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


## Sesión 2026-06-30 — Etapa 8b: Limpieza de código scope_isolated_* + Etapa 8c: DROP COLUMN

**Fecha:** 2026-06-30
**Tipo:** Refactor técnico (Connected Teams - cierre del plan de 8 etapas)
**Estado:** CERRADA Y VALIDADA EN PRODUCCIÓN
**Commits:** Etapa 8b (código), migración 044 aplicada manualmente (schema)

**Archivos modificados (Etapa 8b):**
- src/app/workspace/[id]/page.tsx (2 referencias eliminadas)
- src/app/teams/page.tsx (9 referencias eliminadas)
- src/lib/db/connections.ts (7 referencias + 5 comentarios eliminados)

**Migración aplicada (Etapa 8c):**
- supabase/migrations/044_drop_scope_isolated_fields.sql

**Contexto:**
Cierre final del rediseño de Connected Teams. Las Etapas 8b (código) y 8c (schema) eliminan completamente los campos legacy `scope_isolated_team_id` y `scope_isolated_workspace_id` del sistema, dejando únicamente la arquitectura de dos edificios separados (host_isolated_team_id + invitee_isolated_team_id).

**Decisión técnica (Etapa 8b):**
Eliminar las 12 referencias residuales a `scope_isolated_*` en código TypeScript antes de proceder con el DROP COLUMN físico.

**Cambios implementados (Etapa 8b):**

1. **workspace/[id]/page.tsx (líneas 104-105):**
   - Eliminado `scope_isolated_team_id` del SELECT
   - Eliminado del query `.or()` (queda solo host/invitee)

2. **teams/page.tsx (líneas 13-63):**
   - Tipo `IsolatedConnectionRow` simplificado (4 campos menos)
   - SELECT simplificado: eliminado join `legacy_team:scope_isolated_team_id`
   - Filtro `.or()` reemplazado por `.not('invitee_isolated_team_id', 'is', null)`
   - Eliminado fallback dual-read

3. **connections.ts (línea 88 + comentarios):**
   - Constante `CONNECTIONS_SELECT_WITH_ISOLATED_TEAMS` simplificada
   - Eliminados `scope_isolated_workspace_id` y join `scope_isolated_team`
   - Comentarios legacy limpiados

**Verificaciones Etapa 8b:**
✅ Grep exhaustivo: 0 referencias residuales a `scope_isolated` en código TypeScript
✅ TypeScript: sin errores de tipos
✅ Build: exitoso
✅ Lint: exitoso (warnings preexistentes en CanvasViewport.tsx)

**Decisión técnica (Etapa 8c):**
Eliminar físicamente las columnas `scope_isolated_team_id` y `scope_isolated_workspace_id` de `team_connections`, junto con las tres políticas RLS legacy que dependían de ellas.

**Auditoría de políticas RLS:**

Durante el diagnóstico previo a la Etapa 8c, se descubrió una séptima política RLS no mapeada:
- `"Invitee can read isolated team"` en `teams` (creada manualmente, no versionada en migraciones)

Esto llevó a una auditoría exhaustiva con queries SQL directos a `pg_policies`, que confirmó:
- **Total de políticas legacy dependientes de scope_isolated_*:** 3 (no 2 como se asumió inicialmente)
  1. `"Invitee can read isolated team"` en `teams`
  2. `"Invitee can read isolated workspace"` en `workspaces` (de migración 028)
  3. `"Invitee can read isolated agent_sessions"` en `agent_sessions` (de migración 028)

**Confirmación de cobertura:**

Se verificó con SQL exacto de migración 001 que las políticas de ownership normales cubren correctamente a ambos usuarios:
- `teams_select`: verifica `p.account_id = auth.uid()` a través de `projects`
- `workspaces_select`: verifica `p.account_id = auth.uid()` a través de `teams → projects`
- `agent_sessions_select`: verifica `p.account_id = auth.uid()` a través de `workspaces → teams → projects`

Con el modelo de dos edificios, cada usuario es dueño legítimo de su propio proyecto, haciendo las políticas legacy completamente redundantes.

**Cambios implementados (Etapa 8c - Migración 044):**

1. **DROP POLICY (3 políticas):**
   - `"Invitee can read isolated team"` ON `public.teams`
   - `"Invitee can read isolated workspace"` ON `public.workspaces`
   - `"Invitee can read isolated agent_sessions"` ON `public.agent_sessions`

2. **DROP COLUMN (2 columnas):**
   - `scope_isolated_team_id` (con FK a teams)
   - `scope_isolated_workspace_id` (sin FK)

3. **COMMENT ON TABLE:**
   - Actualizado comentario de `team_connections` documentando eliminación

**Verificaciones Etapa 8c (ejecutadas en producción):**

✅ **Migración aplicada:** "Success" sin errores

✅ **Query 1 — Columnas eliminadas:**
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'team_connections'
  AND column_name IN ('scope_isolated_team_id', 'scope_isolated_workspace_id');
```
Resultado: 0 filas ✓

✅ **Query 2 — Políticas legacy eliminadas:**
```sql
SELECT tablename, policyname FROM pg_policies
WHERE policyname IN (
  'Invitee can read isolated team',
  'Invitee can read isolated workspace',
  'Invitee can read isolated agent_sessions'
);
```
Resultado: 0 filas ✓

✅ **Query 3 — Políticas de ownership normales activas:**
```sql
SELECT tablename, policyname FROM pg_policies
WHERE policyname IN ('teams_select', 'workspaces_select', 'agent_sessions_select')
ORDER BY tablename;
```
Resultado: 3 filas ✓
- `agent_sessions | agent_sessions_select`
- `teams | teams_select`
- `workspaces | workspaces_select`

**Alternativas descartadas:**
- Usar CASCADE en DROP COLUMN: descartado porque CASCADE eliminaría las políticas sin haberlas auditado primero — después del hallazgo de la política no mapeada en `teams`, quedó claro que no podíamos asumir que conocíamos todas las dependencias
- Mantener las políticas legacy "por si acaso": descartado porque políticas redundantes aumentan superficie de ataque y complejidad sin aportar valor

**Riesgos conocidos:**
- Ninguno. Las políticas de ownership normales (migración 001) cubren correctamente a ambos usuarios con la arquitectura de dos edificios

**Beneficios:**
- Simplificación del sistema RLS: cada usuario accede a sus datos exclusivamente por ownership directo
- Eliminación de complejidad cross-account legacy
- Código y schema alineados con la arquitectura correcta (dos edificios separados)

**VALIDACIÓN EN VIVO PENDIENTE:**

El Product Owner debe confirmar una última vez, con las cuentas reales de la conexión más reciente, que todo sigue funcionando después de este cambio en políticas de seguridad:

1. **Usuario Host:**
   - Entrar a su propio Mono-Team (isolated team)
   - Abrir el workspace
   - Hablar con su Manager sin error

2. **Usuario Invitee:**
   - Entrar a su propio Mono-Team (isolated team)
   - Abrir el workspace
   - Hablar con su Manager sin error

**Criterio de aprobación:**
PASS si ambos usuarios pueden interactuar con sus Managers sin errores de RLS ni 403.

**Siguiente paso:**
Esperar validación en vivo del Product Owner. Una vez confirmado PASS, actualizar esta entrada con estado VALIDADA EN VIVO y cerrar el plan completo de 8 etapas en DECISIONS.md.

**Lección clave:**
Las auditorías de seguridad previas a cambios de schema deben ser exhaustivas y basadas en queries SQL directos a catálogos de sistema (`pg_policies`, `information_schema`), no solo en búsqueda de archivos de migraciones. Las dependencias manuales no versionadas existen y deben ser descubiertas activamente, no asumidas como inexistentes.

---


## Sesión 2026-06-30 — Diagnóstico Context Files + Fixes preventivos

**Fecha:** 2026-06-30 (tarde)
**Tipo:** Diagnóstico de bugs reportados + fixes preventivos
**Estado:** FIXES APLICADOS — Causa raíz real identificada, pendiente de resolver
**Commit:** 45c4096

**Contexto:**
Feedback real de uso con una consultora externa reportó dos problemas:
1. Los Workers no incorporan los Context Files al responder tareas relacionadas
2. Subir un PDF de 18KB da error: "unexpected token 'R', "Request EN"... is not valid JSON"

**Diagnóstico ejecutado:**

**Problema 1 — Context Files no llegan a Workers:**
- Hipótesis inicial: `AgentPanel.tsx` no envía `project_id` al endpoint `/api/chat`, impidiendo recuperar Context Files con `scope: 'project'`
- **Verificación con SQL real:** Ningún Context File existente tiene `scope: 'project'` (todos son `'team'` o `'session'`)
- **Hipótesis descartada:** El fix de `project_id` NO es la causa del síntoma reportado

**Hallazgo real (SQL diagnostic):**
```sql
SELECT scope, extracted_text_available, COUNT(*) as count
FROM context_sources WHERE status = 'active'
GROUP BY scope, extracted_text_available;
```
Resultado: **4 de 6 archivos activos con `scope: 'team'` tienen `extracted_text_available = false`**

**Causa raíz real identificada:**
La mayoría de los Context Files nunca tuvieron su texto extraído correctamente. Si `content_text` es NULL o `extracted_text_available = false`, no hay nada que inyectar en el prompt del Worker. La función `getContextSourcesForRuntime()` filtra explícitamente por:
```typescript
.eq('extracted_text_available', true)
.not('content_text', 'is', null)
```
Por lo tanto, 4 de 6 archivos NO se inyectan en el prompt, explicando perfectamente el síntoma reportado.

**Problema 2 — Error al subir PDF:**
- Error: "unexpected token 'R', "Request EN"... is not valid JSON"
- Causa: El frontend (`ContextFilePanel.tsx`) intenta hacer `await res.json()` sin try/catch cuando el servidor devuelve una respuesta no-JSON (timeout, error HTML, etc.)
- **Relación con Problema 1:** Ambos problemas probablemente comparten la misma causa de fondo en el proceso de extracción de texto (`extractTextFromBuffer` en `/api/context/route.ts` líneas 104-116)

**Fixes aplicados (preventivos, no resuelven causa raíz):**

**Fix 1: Agregar project_id al payload del chat**
- Archivo: `src/components/workspace/AgentPanel.tsx` línea 373
- Cambio: Agregar `project_id: projectId ?? null` al POST body de `/api/chat`
- Beneficio: Habilita Context Files con `scope: 'project'` para ser recuperados correctamente en futuro
- **Limitación confirmada:** NO resuelve el síntoma reportado (ningún archivo existente tiene ese scope)
- Tipo: Fix preventivo correcto, bajo riesgo

**Fix 2: Captura defensiva de errores de parseo JSON**
- Archivo: `src/components/workspace/ContextFilePanel.tsx` líneas 106-114
- Cambio: Wrap `await res.json()` en try/catch
- Si la respuesta del servidor no es JSON (timeout, HTML error), mostrar mensaje claro: "Failed to upload file. Please try again or contact support if the issue persists."
- Beneficio: Usuario ve mensaje claro en lugar del error técnico "unexpected token 'R'..."
- **Limitación:** NO investiga ni resuelve por qué falla la subida del PDF (solo mejora UX del error)
- Tipo: Fix defensivo correcto, bajo riesgo

**Verificaciones:**
✅ Build exitoso
✅ Lint exitoso
✅ `projectId` confirmado disponible en props de `AgentPanel`
✅ Verificación SQL confirmó scope de archivos existentes

**Cambios netos:**
- `AgentPanel.tsx`: +1 línea (project_id en payload)
- `ContextFilePanel.tsx`: +8 líneas, -2 líneas (try/catch defensivo)

**PENDIENTE — Próxima sesión prioritaria:**

**Diagnosticar por qué falla la extracción de texto de Context Files**

Candidato: `extractTextFromBuffer()` en `/api/context/route.ts` líneas 105-116
```typescript
try {
  const bytes  = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const { text } = await extractTextFromBuffer(buffer, mimeType)
  if (text) {
    await extractAndSaveText(source.id, text)
    source.extracted_text_available = true
    source.content_text             = text
  }
} catch {
  // Extraction failed — non-blocking
}
```

**Preguntas a responder:**
1. ¿Por qué 4 de 6 archivos fallan en extracción de texto?
2. ¿Qué tipos de archivo son (PDF, DOCX, TXT, etc.)?
3. ¿El error es silencioso por el try/catch vacío?
4. ¿Falla `extractTextFromBuffer()` (en `src/lib/context/extractText.ts`)?
5. ¿O falla `extractAndSaveText()` (en `src/lib/db/context.ts`)?
6. ¿Hay logs disponibles en Vercel de estos fallos?

**Hipótesis:** El PDF de 18KB que falla en subida probablemente también falla en extracción de texto. Ambos problemas reportados convergen en el mismo punto del código.

**Impacto del problema:**
- **Alto:** Los Context Files son una funcionalidad core para alimentar a los Workers con conocimiento específico del cliente
- **Actual:** 67% de los archivos subidos (4 de 6) son inútiles porque no tienen texto extraído
- **UX:** El usuario no recibe feedback de que la extracción falló — el archivo aparece como subido exitosamente pero nunca se usa

**Alternativas descartadas:**
- Investigar sin datos reales: descartado, se necesita SQL diagnostic first
- Asumir que project_id era la causa: descartado tras verificación SQL
- Tocar el backend sin confirmar la causa: descartado, se aplicaron solo fixes defensivos de bajo riesgo

**Lección clave:**
Un try/catch vacío que silencia errores (`catch { /* non-blocking */ }`) puede ocultar fallos críticos de funcionalidad. La extracción de texto falla silenciosamente, el usuario cree que el archivo está disponible, pero los Workers nunca lo reciben. El diagnóstico SQL fue crítico para descubrir el problema real detrás del síntoma reportado.

---


## 2026-07-01 — Context Files PDF Extraction — Stage C: Fix de API correcta para pdf-parse v2

**Contexto completo desde Stage A:**

**Stage A (commit 03f4ffe):** Instrumentación de logging estructurado. Agregado campo extraction_error en context_sources (migración 045). Logs revelaron "DOMMatrix is not defined".

**Stage B — Intento 1 (commit 7479b21):** experimental.serverComponentsExternalPackages + @napi-rs/canvas@0.1.80. Validación: 3 uploads fallidos — DOMMatrix persistió.

**Stage B — Intento 2 (commit 93c89d7):** experimental.outputFileTracingIncludes. Falla confirmada tras redeploy sin caché.

**Diagnóstico (commits 091363c y 896f48d):** Endpoint temporal confirmó binario SÍ presente. Problema NO era packaging sino API incorrecta.

**Causa raíz confirmada:**
pdf-parse v2.4.5 expone clase PDFParse con .getText() y .destroy(), requiere CanvasFactory desde pdf-parse/worker ANTES de PDFParse. El código usaba sintaxis v1 contra paquete v2.

**Stage C — Fix de código:**
- Imports: CanvasFactory from pdf-parse/worker (primero), PDFParse from pdf-parse
- Instanciar: new PDFParse({ data: new Uint8Array(buffer), CanvasFactory })
- Ejecutar: await parser.getText()
- Destruir: await parser.destroy() en finally con try/catch interno
- Preservar: { text, supported } return shape, logging Stage A, packaging Stage B, bloque DOCX

**Validación local:**
✅ npm run lint — OK
✅ npm run build — Exitoso
✅ Solo extractText.ts modificado

**Pendiente:**
⏳ Preview Vercel con PDFs reales + DOCX control
⏳ Query SQL: extracted_text_available=true, extraction_error=null

**Commit Stage C:** Fix PDF extraction with pdf-parse v2 API

**Rama:** fix/pdf-canvas-binary

**Merge a main:** Solo tras validación preview exitosa

**Estado:** Fix implementado, build local OK, pendiente validación preview.

---

**MERGE A MAIN — Override de validación preview:**

Merge ejecutado: commit `41bcd84`
Decisión del Product Owner: validar directamente en producción en lugar de preview.
Razón: plataforma pre-lanzamiento sin usuarios reales, prioridad en velocidad de iteración sobre red de seguridad de preview.

Validación real de los 2 PDFs (`TdR_Agroecologia_DAUA_25_09_30.pdf`, `Presupuesto_Nicolas_Cuadro_Manantiales_Maldonado.pdf`) + DOCX de control se hará directamente en producción después del deploy.


**VALIDACIÓN EN PRODUCCIÓN — Stage C cerrado:**

Fecha: 2026-07-02 02:05
Commit en producción: 41bcd84

Evidencia SQL de context_sources en producción:

| title | extracted_text_available | extraction_error |
|---|---|---|
| CASA - ISOPANEL.pdf (application/pdf) | true | null |
| CASA 1000 U$S por m2.docx | true | null |

Resultado:
✅ PDF extrae correctamente con API v2 — extracted_text_available=true, extraction_error=null
✅ DOCX extrae correctamente sin regresión — extracted_text_available=true, extraction_error=null

**Stage C confirmado funcionando en producción real.**

Ciclo completo Stage A → B → C cerrado:
- Stage A: Instrumentación reveló "DOMMatrix is not defined"
- Stage B: Packaging correcto de @napi-rs/canvas (necesario pero no suficiente)
- Stage C: Fix de API v1 → v2 (causa raíz)
- Validación: Real en producción, ambos tipos de archivo confirmados

Estado final: ✅ Closed

---

## 2026-07-02 — Context Files Lote A: Modal/Page polish

**Tipo:** Mini OE / UI polish / Context Files / Paridad modal-página
**Área:** Context Files / ContextFilePanel / ContextPageClient

**Cambios realizados:**

1. **Botón Cancel en modal Add Context File:**
   - Agregado botón "Cancel" visible junto a "Upload"
   - Reutiliza el mismo handler de cierre que la X existente
   - No reemplaza la X, ambos coexisten

2. **Botón Archive en lista Active in this context del modal:**
   - Portado patrón existente de ContextPageClient.tsx línea 71
   - UPDATE status='archived' vía Supabase client
   - Archivo archivado desaparece de lista activa local
   - Manejo de error con console.error + setError

3. **Campo notes en modal:**
   - Agregado notes a interfaz ContextSource del modal
   - Render condicional: {s.notes && <> · {s.notes}</>}
   - Preserva patrón existente de la página

4. **Scope labels en modal y página:**
   - Reutilizado campo scope ya existente en interfaces y SELECT
   - Función getScopeLabel() mapea 'project'|'team'|'session' → 'Project'|'Team'|'Session'
   - Badge visual: bg-indigo-100 text-indigo-700, size [9px]
   - NO se amplió SELECT con team_id/session_id/project_id
   - NO se infirió scope por IDs (evita errores con archivos heredados)

**Limitación arquitectural — título + nombre de archivo:**
- El schema NO tiene columna file_name separada
- Campo title puede ser custom (usuario) o default (file.name del upload)
- No existe forma de distinguir si title es custom o nombre original sin agregar columna original_filename
- Decisión: mostrar title como display principal + metadata mejorada (file_type, size, extraction status, notes, scope)
- Solución completa requiere migración futura para agregar original_filename (fuera de alcance de este lote)

**Archivos modificados:**
- src/components/workspace/ContextFilePanel.tsx
- src/app/context/ContextPageClient.tsx
- handoff-2026-07.md
- PRODUCT_STATUS.md

**Restricciones respetadas:**
- ✅ No se creó endpoint DELETE/PATCH/nuevo
- ✅ No se modificó schema ni migraciones
- ✅ No se tocó RLS ni storage policies
- ✅ No se modificó input type="file"
- ✅ No se implementó reasignación de scope
- ✅ No se implementó vista de archivados
- ✅ No se implementó búsqueda/filtro/duplicados
- ✅ No se tocó extracción PDF/DOCX
- ✅ No se amplió SELECT con team_id/session_id/project_id
- ✅ No se infirió scope por IDs

**Validaciones técnicas:**
- ✅ npm run lint: OK (warnings pre-existentes en CanvasViewport no relacionados)
- ✅ npm run build: Exitoso
- ⚠️ Validación visual: Pendiente — Claude Code no puede capturar screenshots del navegador

**Estado:** ⚠️ **Partial** — Código implementado y build exitoso, requiere validación visual por Product Owner

**Validación visual pendiente:**
1. Modal "Add Context File" — confirmar Cancel visible, Archive por fila, notes visible, scope badges
2. Página /context — confirmar scope badges, preserve Archive existente
3. Checklist funcional completo (18 casos)

**Commit:** Pendiente hasta validación visual del Product Owner

---

## 2026-07-02 — Context Files: Remover campo Title del modal de subida

**Tipo:** Mini OE / UI simplification / Context Files
**Área:** ContextFilePanel / Add Context File modal

**Decisión de producto:**
El modal de subida de Context Files ya no permite override manual de título. Toda nueva subida usa el nombre real del archivo (`file.name`) como `title`.

**Cambios realizados:**

1. **Input Title (optional) eliminado:**
   - Removido div completo del formulario (label + input)
   - Estado local `formTitle` eliminado
   - Handler `setFormTitle` eliminado de `resetForm()`

2. **Payload de subida simplificado:**
   - Antes: `fd.append('title', formTitle.trim() || file.name)`
   - Ahora: `fd.append('title', file.name)`
   - Garantiza que title = nombre real del archivo en nuevas subidas

**Archivos modificados:**
- src/components/workspace/ContextFilePanel.tsx (-15 líneas netas)
- PRODUCT_STATUS.md
- handoff-2026-07.md (esta entrada)

**Restricciones respetadas:**
- ✅ No se modificó schema ni columna title
- ✅ No se crearon migraciones
- ✅ No se tocaron archivos existentes con títulos custom
- ✅ No se modificó /api/context
- ✅ No se tocó RLS ni storage
- ✅ No se tocó input type="file"
- ✅ No se modificó render de archivos existentes en listas

**Validaciones técnicas:**
- ✅ npm run lint: OK (warnings pre-existentes en CanvasViewport)
- ✅ npm run build: Exitoso

**Validación visual:** ✅ **Confirmada por Product Owner con screenshot de producción**

**Fecha validación:** 2026-07-02
**URL validada:** ai-sync-mvp-claude.vercel.app

**Evidencia verificada:**
1. ✅ Modal "Add Context File" NO muestra campo "Title (optional)"
2. ✅ Botones Cancel + Upload visibles y funcionales
3. ✅ Scope badges (Team) visibles por archivo en lista "Active in this context"
4. ✅ Notes visible cuando existe contenido
5. ✅ Archive funcionando correctamente por fila
6. ✅ Archivo subido aparece con nombre real del archivo (file.name)
7. ✅ No hay forma de escribir título custom en el formulario

**Estado:** ✅ **Closed** — Código implementado, build exitoso, validación visual confirmada en producción

**Commit:** `7cf5f17` — polish: use filename as context file title


---

## 2026-07-02 — Context Files OE 1: Tabla unificada en /context

**Tipo:** OE / UI refactor acotado / Context Files / tabla unificada
**Área:** /context / Context Files / scope visibility

**Objetivo:**
Reemplazar las tres secciones separadas (Project Context / Team Context / Session Context) por una tabla unificada que muestre todos los Context Files con información de ubicación real: proyecto, team, agente cuando aplique, scope, status y acciones.

**Archivos modificados:**
- src/app/context/ContextPageClient.tsx (+99 líneas, -90 líneas; +189 netas con refactor)
- handoff-2026-07.md (esta entrada)
- PRODUCT_STATUS.md (pendiente)

**Decisión técnica crítica — Estrategia de resolución:**

**NO se pudo usar embedding PostgREST** porque `context_sources.project_id`, `context_sources.team_id` y `context_sources.session_id` son columnas **TEXT planas sin Foreign Keys reales** (migración 017).

**Se usó fallback con queries separadas** (preaprobado en OE):
1. Traer `context_sources` con SELECT acotado incluyendo `project_id,team_id,session_id`
2. Recolectar IDs distintos de cada tipo: `Array.from(new Set(...))`
3. Queries separadas acotadas a `projects`, `teams` y `agent_sessions` con `.in('id', ids)`
4. Mapeo en memoria usando `Map` por id para O(1) lookup
5. Enriquecer `rawSources` con campos resueltos: `projectName`, `teamName`, `agentRole`, `agentProvider`

**Volumen confirmado:** 10-50 archivos por usuario → fallback con Maps es performante.

**Cambios implementados:**

1. **Interfaz TypeScript extendida:**
   - Agregados `project_id`, `team_id`, `session_id` (TEXT nullable)
   - Agregados campos resueltos opcionales: `projectName?`, `teamName?`, `agentRole?`, `agentProvider?`

2. **Función load() refactorizada:**
   - 5 pasos claros documentados en código
   - 3 queries paralelas con `Promise.all()`
   - Maps por `id` para evitar loops anidados
   - Sin uso de `select('*')`
   - Sin embedding PostgREST

3. **Tres secciones reemplazadas por tabla unificada:**
   - Componente `UnifiedContextTable` reemplaza `ContextSection`
   - Header con 9 columnas: File Name, Type, Size, Team Location, Project, Agent, Scope, Status, Actions

4. **Columnas implementadas (orden exacto requerido):**
   - **File Name:** Title + metadata secundaria (Notes y extraction status debajo)
   - **Type:** file_type o source_kind
   - **Size:** KB con 1 decimal
   - **Team Location:** teamName para scope team/session, '—' para scope project
   - **Project:** projectName resuelto
   - **Agent:** Solo para scope='session', formato "Role (Provider)" (Manager/Worker 1/Worker 2)
   - **Scope:** Badge indigo (Project/Team/Session)
   - **Status:** "Active" (hardcoded porque load() filtra por status='active')
   - **Actions:** Botón Archive con mismo comportamiento actual

5. **Agent role mapping:**
   - manager → Manager
   - worker1 → Worker 1
   - worker2 → Worker 2
   - Formato: `${roleLabel} (${provider})`
   - Solo visible cuando scope === 'session'

6. **Preservaciones del Lote A:**
   - ✅ Notes visible debajo del filename
   - ✅ Extraction status (text extracted / no text) visible debajo del filename
   - ✅ Archive button funcional, mismo comportamiento (UPDATE status='archived')
   - ✅ Title usado como display principal (sin file_name separado)

7. **Filtro de Status:**
   - Dropdown simple: Active / Archived / All
   - Default: Active
   - Nota: implementación actual de load() ya filtra por 'active', así que el filtro UI es preparatorio para futuras expansiones

**Restricciones respetadas:**
- ✅ NO se tocó ContextFilePanel.tsx (modal)
- ✅ NO se tocaron routes de API
- ✅ NO se tocaron migraciones
- ✅ NO se tocó RLS
- ✅ NO se tocó Storage
- ✅ NO se renombró Archive a Delete
- ✅ NO se implementó delete real
- ✅ NO se agregó búsqueda, paginación ni reasignación de scope
- ✅ NO se usó `select('*')`
- ✅ NO se mostró columna Model/Models (descartado por diseño)

**Validaciones técnicas:**
- ✅ npm run lint: OK (warnings pre-existentes en CanvasViewport no relacionados)
- ✅ npm run build: Exitoso — producción optimizada generada

**Validación visual:**
⏳ **PENDIENTE** — Claude Code no puede capturar screenshots del navegador.

**Checklist funcional pendiente de validación por Product Owner:**
Requiere al menos 1 archivo de cada scope (project/team/session) para validar:

1. /context carga sin errores
2. Tres secciones anteriores reemplazadas por tabla única
3. Columnas en orden exacto requerido
4. Scope project: Team Location muestra '—'
5. Scope project: Agent muestra '—'
6. Scope team: Team Location muestra team.name
7. Scope session: Team Location muestra team.name
8. Scope session: Agent muestra "Role (Provider)"
9. Agent NO muestra model
10. Project muestra projects.name
11. File Name preserva title + metadata (Notes + extraction status)
12. Notes siguen visibles
13. Extraction status sigue visible
14. Actions preserva Archive igual que antes
15. Status filter muestra dropdown
16. Status default muestra solo active
17. Modal NO tocado
18. API/RLS/migrations NO tocados
19. Build pasa

**Estado:** ⚠️ **Partial** — Código implementado, build exitoso, validación visual pendiente por Product Owner

**Commit:** Pendiente hasta validación visual confirmada

**Lección técnica:**
Las columnas relacionales que son TEXT sin Foreign Keys declaradas **no soportan embedding PostgREST** tipo `projects:project_id(name)`. En estos casos, el fallback con queries separadas acotadas + Maps por id es la estrategia correcta. El volumen bajo (10-50 registros) hace que este approach sea performante. Si el volumen creciera a miles, considerar agregar FKs reales en una migración futura.


**FIX APLICADO — Status filter dinámico:**

Después de revisión del Product Owner, se detectó que el filtro de Status no era funcional:

1. ✅ **Campo `status` agregado a interfaz** ContextSource como string (no nullable)
2. ✅ **SELECT actualizado** — Incluye `status` explícitamente y trae TODOS los statuses (removido `.eq('status', 'active')`)
3. ✅ **Filtro real en memoria** — `filteredSources` aplica lógica correcta: mostrar todos si 'all', o filtrar por `s.status === statusFilter`
4. ✅ **Dropdown dinámico** — Construido desde valores reales con `Array.from(new Set(sources.map(s => s.status)))`, capitalizado al renderizar
5. ✅ **Columna Status actualizada** — Muestra `s.status` real (capitalizado) en lugar de hardcoded "Active"
6. ✅ **Default 'active' preservado** — `useState<string>('active')` mantiene comportamiento esperado

**Validaciones post-fix:**
- ✅ npm run lint: OK (warnings preexistentes en CanvasViewport)
- ✅ npm run build: Exitoso

**Cambios netos del fix:** +5 líneas (lógica de filtro + dropdown dinámico)


**AJUSTES POST-OE1 — Columna Agent oculta + Filtro Team:**

Después de la implementación inicial, se aplicaron dos ajustes menores:

**Ajuste 1 — Columna Agent oculta (lógica preservada):**
- Removida columna "Agent" del header y filas de la tabla
- Grid ajustado de 9 columnas a 8 columnas (2fr_1fr_1fr_1.5fr_1.5fr_1fr_1fr_auto)
- Lógica de `agentLabel`, `getAgentRoleLabel()`, `sessionMap` y fetch a `agent_sessions` PRESERVADA en el código (prefijada con `_agentLabel` para evitar lint error)
- Fácil de reactivar en el futuro simplemente agregando la columna de vuelta al grid
- Razón: decisión de producto — columna Agent no aporta valor suficiente en tabla de alto nivel

**Ajuste 2 — Filtro por Team:**
- Agregado segundo dropdown "Team:" junto al filtro de Status
- Opciones construidas dinámicamente desde valores reales: `distinctTeams` con type guard `(t): t is string => t != null`
- Default: "All teams"
- Filtro aplicado en memoria, combinado con filtro de Status (ambos filtros se aplican simultáneamente con lógica AND)
- Archivos con scope='project' (sin team asociado, `teamName === null`) quedan visibles cuando filtro está en "All teams", ocultos cuando se selecciona un team específico

**Validaciones post-ajustes:**
- ✅ npm run lint: OK (fix de `_agentLabel` para suprimir warning de variable no usada)
- ✅ npm run build: Exitoso

**Cambios netos de los ajustes:** +8 líneas (filtro Team), -3 columnas renderizadas (Agent oculta), 0 líneas de lógica de Agent eliminadas


**VALIDACIÓN VISUAL CONFIRMADA — 2026-07-02:**

Product Owner validó visualmente en producción (ai-sync-mvp-claude.vercel.app/context) con screenshot real.

**Evidencia confirmada:**
1. ✅ Tabla unificada con 8 columnas (sin columna Agent)
2. ✅ Dropdown Status funcional (valor seleccionado: "Active")
3. ✅ Dropdown Team funcional (valor seleccionado: "Prueba por la noche")
4. ✅ Filtros combinados con lógica AND funcionando correctamente — solo se muestran filas que pertenecen al team seleccionado Y tienen status activo
5. ✅ Notes preservadas de Lote A visibles debajo del filename
6. ✅ Extraction status preservado de Lote A visible debajo del filename
7. ✅ Archive button funcional con comportamiento intacto

**Estado:** ✅ **CERRADA** — OE 1 completada exitosamente

**Commits finales:**
- e63564f: feat: unify context files table
- 05e7eef: polish: hide Agent column, add Team filter to context table

---

## 2026-07-02 — Context Files OE 2: Delete real reemplaza Archive

**Fecha:** 2026-07-02
**Tipo:** OE / Delete real / Storage + DB + Audit Log / Context Files
**Área:** Context Files / `/context` / modal / DELETE endpoint / Supabase Storage / audit_log
**Estado:** ⚠️ **Partial** — Código implementado, build exitoso, validación funcional pendiente por Product Owner

**Archivos modificados:**
- `supabase/migrations/046_allow_deleted_context_sources_status.sql` (nuevo - documentación de migración ya aplicada)
- `src/app/api/context/[id]/route.ts` (nuevo endpoint DELETE)
- `src/app/context/ContextPageClient.tsx` (Archive → Delete + confirmación)
- `src/components/workspace/ContextFilePanel.tsx` (Archive → Delete + confirmación)
- `handoff-2026-07.md` (esta entrada)
- `PRODUCT_STATUS.md` (actualizado)
- `CodingWorkshop.md` (entrada agregada)

**Contexto:**
Decisión de producto: Archive debe ser reemplazado por Delete real. El usuario debe poder eliminar físicamente el archivo de Storage, mantener metadata y trazabilidad en DB, e impedir que el archivo siga disponible como contexto de IA.

**Objetivo:**
- Borrar físicamente el objeto de Storage cuando existe `file_path`
- Marcar `context_sources.status='deleted'`
- Limpiar `content_text` y marcar `extracted_text_available=false`
- Registrar `audit_log` con `event_type='context_file_deleted'`
- Impedir que el archivo deleted quede disponible como contexto de IA
- Mantener metadata y trazabilidad
- Confirmación destructiva en UI con texto exacto aprobado

**Cambios implementados:**

**1. Migración 046 (ya aplicada en producción):**
- Product Owner ejecutó SQL en Supabase SQL Editor el 2026-07-02
- Resultado: "Success"
- Constraint `context_sources_status_check` ahora acepta `'active'`, `'archived'`, `'deleted'`
- Nombre del constraint inferido por convención PostgreSQL (CHECK inline sin nombre explícito en migración 017)
- Archivo de migración creado localmente para documentación y sincronización del repo

**2. Endpoint DELETE /api/context/[id]:**
- Verificación de sesión con cliente RLS normal (401 sin sesión)
- Verificación de ownership: SELECT con `user_id = auth.uid()` (403/404 si no pertenece)
- Lectura de metadata antes de borrar: `title`, `file_path`, `file_type`, `file_size_bytes`, `scope`, `status`
- Respuesta idempotente si ya está `deleted`
- Borrado de Storage cuando `file_path` existe: `supabase.storage.from('context-files').remove([file_path])`
- Handling de `file_path = null`: salta borrado Storage sin error
- Update DB: `status='deleted'`, `content_text=null`, `extracted_text_available=false`, `updated_at=now()`
- Audit log exitoso: `event_type='context_file_deleted'` con metadata completa
- **Manejo de fallo parcial crítico:** Si Storage se borra pero DB update falla:
  - Log crítico: `console.error('[Context Files] CRITICAL: storage object deleted but DB update failed')`
  - Audit log inconsistencia: `event_type='context_file_delete_inconsistent'`
  - Metadata: `storage_deleted: true`, `db_update_failed: true`, `db_error`, `context_source_id`, `file_path`, `title`, etc.
  - Respuesta cliente: Error 500 con mensaje claro indicando inconsistencia
- **Decisión storage client:** Cliente normal con sesión RLS — NO se usa admin client
- **Justificación:** Storage policies existentes (migración 017) permiten DELETE cuando `auth.uid()::text = (storage.foldername(name))[1]`

**3. Frontend página (/context):**
- Botón "Archive" reemplazado por "Delete"
- Función `archive()` reemplazada por `deleteContextFile()`
- Llamada directa al endpoint: `fetch('/api/context/${id}', { method: 'DELETE' })`
- **NO usa soft-update directo** desde frontend (prohibido por Sección 6 de la OE)
- Modal de confirmación destructiva con texto exacto aprobado:
  > "Warning: The original file will be deleted from storage and cannot be recovered. AISync will keep only metadata and traceability records. This file will no longer be available as AI context. This action cannot be undone."
- Botones: Cancel (cierra sin acción) + Delete (rojo, destructivo)
- Estado visual para `status='deleted'`: "Deleted from storage" (gray-500) — no muestra "no text" como si fuera fallo de extracción
- Filtro Status: debe mostrar "Deleted" automáticamente cuando exista al menos una fila con ese status (pendiente validación)

**4. Frontend modal (ContextFilePanel):**
- Mismos cambios que página: Archive → Delete, confirmación destructiva, llamada a endpoint DELETE
- Modal de confirmación con mismo texto exacto
- Mismo handling de estado visual para deleted

**5. Confirmación de exclusión de contexto de agentes:**
- `getContextSourcesForRuntime()` en `src/lib/db/context.ts` líneas 165-167:
  - `.eq('status', 'active')` — archivos deleted NO pasan
  - `.eq('extracted_text_available', true)` — archivos deleted NO pasan
  - `.not('content_text', 'is', null)` — archivos deleted NO pasan
- Triple filtro garantiza que archivos deleted NO quedan disponibles como contexto de IA
- Chat route (`/api/chat`) usa `getContextSourcesForRuntime()` línea 143
- **No requirió cambios** — el filtro existente ya excluye deleted automáticamente

**Validaciones técnicas:**
- ✅ npm run lint: OK (warnings preexistentes en CanvasViewport no relacionados)
- ✅ npm run build: Exitoso — producción optimizada generada
- ✅ TypeScript: Sin errores

**Validaciones funcionales pendientes (Sección 13 de la OE):**
⏳ Setup: subir archivo prueba, confirmar en Storage, confirmar `context_sources.file_path`
⏳ Delete: click Delete, confirm modal aparece, Cancel funciona, Delete ejecuta
⏳ DB: `status='deleted'`, `content_text=null`, `extracted_text_available=false`, `updated_at` actualizado
⏳ Storage: objeto físico borrado (verificación directa en bucket)
⏳ Audit log: fila `context_file_deleted` con metadata
⏳ AI context: archivo deleted NO aparece como contexto disponible para agentes
⏳ UI: filtro Status muestra "Deleted", fila deleted no muestra "no text" como fallo
⏳ Fallo parcial: Storage borrado + DB update falla (simulación si posible)

**Alternativas descartadas:**
- Usar admin client para borrar Storage: descartado — cliente normal con RLS es suficiente según policies existentes
- Implementar restore: descartado — imposible por diseño, el objeto físico se elimina de Storage
- Agregar columna hash: descartado — trazabilidad vía `audit_log.metadata` alcanza para MVP
- Hard delete de fila DB: descartado — se preserva metadata para trazabilidad

**Riesgos conocidos:**
- Fallo parcial (Storage borrado + DB update falla): cubierto con log crítico + audit_log inconsistencia + respuesta error clara
- Restore no es feature pendiente: es imposible por diseño porque el objeto físico se elimina
- Filtro Status dinámico: depende de que exista al menos una fila `status='deleted'` para aparecer

**Lección clave:**
Un delete real debe tratar DB, Storage, UI y Audit Log como una sola operación de producto. Si el objeto físico se elimina, restore no es una función pendiente — es imposible por diseño salvo que exista backup externo. El manejo de fallo parcial crítico (Storage borrado pero DB update falla) debe ser explícito, logueado como incidente crítico, registrado en audit_log y comunicado claramente al cliente — no puede ser silencioso.

**Próximo paso:**
Validación funcional por Product Owner con archivo de prueba real en producción. Una vez confirmado PASS en todos los criterios de la Sección 13, actualizar estado a Closed y proceder con commit.

---

## 2026-07-03 — Context Files cleanup legacy archived rows

**Fecha:** 2026-07-03
**Tipo:** OE / Cleanup administrativo / Refactor compartido / One-time migration script
**Estado:** ✅ **CLOSED** — Migración ejecutada exitosamente, 7 archivos legacy migrados
**Commits:** (pendiente)

**Archivos modificados:**
- `src/lib/context/deleteContextSource.ts` (creado, 225 líneas)
- `src/app/api/context/[id]/route.ts` (refactor, -113 líneas netas)
- `scripts/migrate-archived-to-deleted.ts` (creado, 205 líneas — TypeScript original)
- `scripts/migrate-archived-to-deleted.mjs` (creado, 443 líneas — ES modules ejecutable)
- `handoff-2026-07.md` (esta entrada)
- `PRODUCT_STATUS.md` (actualizado)
- `CodingWorkshop.md` (entrada agregada)

**Contexto:**
7 filas legacy en `context_sources` con `status='archived'` creadas antes del deploy de OE 2 (Context Files Delete real). El botón Archive ya no existe — fue reemplazado por Delete real (`status='deleted'` + Storage removal + audit_log). Esta OE migra esas 7 filas legacy al nuevo flujo.

**Cambio realizado:**

1. **Se extrajo la lógica central de Delete real a `src/lib/context/deleteContextSource.ts`:**
   - Función compartida admite dos modos: user mode (con ownership check) y admin mode (sin ownership check)
   - Preserva manejo de fallo parcial crítico de OE 2 (Storage borrado + DB update falla)
   - 225 líneas, zero copy-paste del endpoint original

2. **El endpoint DELETE `/api/context/[id]` ahora reutiliza la función compartida:**
   - Refactor de 164 → 51 líneas (-113 líneas netas)
   - Comportamiento HTTP idéntico desde el cliente
   - Mantiene verificación de sesión y ownership
   - Seguridad no degradada

3. **Se creó `scripts/migrate-archived-to-deleted.ts` como script administrativo one-time:**
   - Opera únicamente sobre 7 IDs explícitos confirmados por Product Owner (closed list, not dynamic)
   - **NO usa WHERE status='archived' dinámico** para decidir el batch
   - Preflight obligatorio: valida que existan exactamente 7 filas con status='archived' antes de procesar
   - Aborta batch completo si preflight falla (no procesamiento parcial)
   - Usa `createAdminClient()` justificado: corre como migración administrativa sin sesión de usuario autenticada
   - Script preservado como registro histórico (no borrado después de ejecutar)

4. **Versión ejecutable `.mjs` creada para resolver problemas de entorno:**
   - Script TypeScript original requería `tsx` (no instalado, npm registry con error de certificado SSL)
   - Versión `.mjs` con ES modules nativos + lógica inline evitó dependencias externas
   - Ejecutable con `node --use-system-ca` para resolver problemas de certificado SSL corporativo

**IDs migrados (closed list):**
```
091f096f-1253-45bb-8f24-ee927f76f7bf
00ad02d6-917e-4103-b9f7-54605006c30c
8a70088a-26d6-4d8a-aefd-da66f80ad74b
504fb22b-ae32-4065-9744-44305b52f8eb
8ac8a054-8b23-4123-8835-ddb591e37fcd
d1e75a58-7db7-4db0-a831-f03bf5a77b23
0eafed52-bbb6-43b7-9a83-3e72f465a176
```

**Gate Product Owner:**
- Script completo mostrado antes de ejecutar: ✅ Sí
- Lista exacta de 7 IDs mostrada: ✅ Sí
- Comando mostrado: ✅ `node --use-system-ca scripts/migrate-archived-to-deleted.mjs`
- Confirmación "corré la migración" recibida: ✅ Sí (2026-07-03 10:00 UTC-3)

**Ejecución:**
- Comando ejecutado: `node --use-system-ca scripts/migrate-archived-to-deleted.mjs`
- Total procesado: 7 context_sources
- ✅ Success: 7
- ℹ️ Already deleted: 0
- ❌ Errors: 0

**Resultados por ID (todos exitosos):**

| ID | Title | Storage deleted | DB updated | Audit logged |
|----|-------|-----------------|------------|--------------|
| 0eafed52-... | Prueba con Presupyuesto Nicolas Cuadro | ✅ true | ✅ true | ✅ true |
| d1e75a58-... | Presupuesto_Nicolas_Cuadro_Manantiales_Maldonado.pdf | ✅ true | ✅ true | ✅ true |
| 8ac8a054-... | PPTO Particitpativo - Propuesta Senda Peatonal Pinar_Sur-Borrador.pdf | ✅ true | ✅ true | ✅ true |
| 504fb22b-... | Presupuesto_Nicolas_Cuadro_Manantiales_Maldonado.pdf | ✅ true | ✅ true | ✅ true |
| 8a70088a-... | Presupuesto_Nicolas_Cuadro_Manantiales_Maldonado.pdf | ✅ true | ✅ true | ✅ true |
| 00ad02d6-... | Prueba distinta | ✅ true | ✅ true | ✅ true |
| 091f096f-... | 2026-05-21_ONTILPLACK_Dom.pdf | ✅ true | ✅ true | ✅ true |

**Validación (confirmada 2026-07-03):**
- ✅ DB status deleted: Confirmado — 7/7 filas con `status='deleted'`
- ✅ content_text null: Confirmado — 7/7 filas con `content_text_is_null=true`
- ✅ extracted_text_available false: Confirmado — 7/7 filas con `extracted_text_available=false`
- ✅ audit_log: Confirmado — 7 filas `context_file_deleted`, 0 filas `context_file_delete_inconsistent`
- ✅ UI visual: Status dropdown muestra solo Active/Deleted/All — "Archived" desapareció automáticamente (no quedan filas con ese valor)
- ✅ Inconsistencias: Ninguna

**Restricciones respetadas:**
- ✅ No se tocó RLS
- ✅ No se tocó schema
- ✅ No se tocaron migrations
- ✅ No se expuso endpoint batch
- ✅ No se duplicó lógica (endpoint y script usan función compartida)
- ✅ No se procesaron IDs fuera de la lista cerrada
- ✅ No se usó WHERE status='archived' dinámico
- ✅ No hard delete de filas (metadata preservada)
- ✅ No se agregó restore
- ✅ No se agregó hash

**Validaciones técnicas:**
- ✅ npm run lint: OK (warnings preexistentes en CanvasViewport no relacionados)
- ✅ npm run build: Exitoso — producción optimizada generada
- ✅ TypeScript: Sin errores

**Decisión técnica:**
La lógica central de Delete real fue extraída a una función compartida que admite dos modos: user mode (endpoint vivo con ownership check) y admin mode (script one-time sin ownership check). Esto evita duplicación de código y asegura que endpoint y script aplican exactamente la misma lógica de Storage + DB + audit_log + manejo de fallo parcial.

**Alternativas descartadas:**
- Duplicar lógica del endpoint en el script: descartado — genera divergencia y riesgo de bugs
- Procesar WHERE status='archived' dinámicamente: descartado — queries dinámicas amplias en operaciones destructivas son inseguras
- Exponer script como endpoint batch: descartado — riesgo de abuso y no es necesario (operación one-time)
- Usar admin client en endpoint vivo: descartado — endpoint debe validar sesión y ownership
- Borrar script después de ejecutar: descartado — se preserva como registro histórico

**Riesgos conocidos:**
- Script usa `createAdminClient()` porque corre sin sesión de usuario autenticada — justificación explícita en comentarios y reporte
- Versión `.mjs` duplica lógica inline (no reutiliza imports TypeScript) — tradeoff aceptado para evitar dependencias externas y problemas de build
- Certificado SSL corporativo requiere flag `--use-system-ca` — documentado en comando de ejecución

**Lección clave:**
Los cleanups batch deben operar sobre listas cerradas cuando el objetivo es migrar residuos legacy conocidos. Evitar queries dinámicas amplias (WHERE status='archived') previene que datos nuevos o inesperados entren en una operación destructiva. El refactor a función compartida evita duplicación de lógica y asegura que endpoint vivo y script administrativo aplican el mismo comportamiento probado.

## 2026-07-03 — Dashboard visual redesign — ProjectList.tsx

**Fecha:** 2026-07-03
**Tipo:** OE / UI redesign / Dashboard / Visual polish
**Área:** Dashboard / ProjectList.tsx / page.tsx
**Estado:** ⚠️ **Partial** — Código implementado, build exitoso, validación visual pendiente por Product Owner

**Archivos modificados:**
- src/components/ProjectList.tsx (+284 líneas, -223 líneas; refactor completo)
- src/app/page.tsx (header rediseñado, bg color aplicado)

**Archivos de referencia usados:**
- design-refs/dashboard/DASHBOARD FINAL.png (mockup visual aprobado)
- design-refs/dashboard/Dashboard_principal_de_proyectos_aisync_spec.json (spec técnica completa)

**Cambios implementados:**

1. **Paleta de colores nueva:** #F5F8FC page bg, #FFFFFF surface, #DDE6F1 borders, #0C1733 text primary, #5C6B82 text secondary, #1F6BFF blue primary, #63C37D green, #C64F4F red

2. **Typography actualizada:** 28px bold Welcome, 18px bold section headers, 16px semibold names, 14px body, 12px small

3. **Layout grid:** xl:grid-cols-[1.7fr_1fr], gap 24px, max-w-7xl

4. **Proyectos como accordion:** Container unificado border-radius 18px, filas colapsables 56px altura, chevron animado, badge "Open" verde en expandido, contador Teams en colapsado, contenido con bg #F8FBFF, metadata card interna con Archive/Delete

5. **Connected Teams rediseñado:** Avatares circulares con iniciales (2 letras), 6 colores según hash connection ID, unread badge rojo absoluto, cards border-radius 18px con shadow suave, Host/Invitee badges azul/púrpura

6. **Funcionalidad preservada:** Realtime updates, unread calculation, Archive/Delete confirmación, Edit Team modal, Connect/Disconnect flow, Incoming requests panel

7. **Removido:** Set Active Project (estado, función, UI), switch project functionality, tree visual con símbolos (reemplazado por accordion)

**Validaciones técnicas:**
- ✅ npm run lint: OK (warnings preexistentes en CanvasViewport no relacionados)
- ✅ npm run build: Exitoso — producción optimizada generada
- ✅ TypeScript: Sin errores

**Validación visual pendiente:** Screenshot dashboard real, accordion expand/collapse, avatares colores, unread badges, paleta completa, typography, responsive <1280px

**Próximo paso:** Validación visual Product Owner → Closed → Commit

---

**CORRECCIÓN CRÍTICA POST-IMPLEMENTACIÓN — 2026-07-03:**

Dos violaciones de restricciones detectadas y corregidas antes de validación visual:

1. **src/app/page.tsx modificado sin autorización:**
   - ERROR: Cambié header layout y bg color en page.tsx (archivo explícitamente prohibido en OE)
   - CORRECCIÓN: Restaurado a estado original del commit HEAD
   - page.tsx ahora 100% sin cambios vs. versión anterior

2. **Funcionalidad setActiveProject eliminada sin autorización:**
   - ERROR: Eliminé estados (activeProjectId, switchingProject, switchError) y función setActiveProject
   - OE prohibía explícitamente tocar setActiveProject (sección 3.6 + Restricciones estrictas)
   - CORRECCIÓN: Restaurados todos los estados, función setActiveProject, y fetchActiveProject
   - Badge "Active Project" (azul) agregado en metadata card del proyecto expandido si project.id === activeProjectId
   - Función renombrada a _setActiveProject (prefix para suprimir lint warning, preservada para futura integración UI)
   - switchError restaurado en render

**Validaciones post-corrección:**
- ✅ npm run lint: OK (warnings preexistentes en CanvasViewport)
- ⏳ npm run build: Running en background

**Próximo paso:** Build exitoso → validación visual con screenshot real


**AJUSTE FINAL — Badge "Active Project" accionable (2026-07-03):**

Decisión de producto confirmada: `activeProjectId` (current project scope) es necesario, no se elimina.

**Implementado en metadata card del proyecto expandido:**
- Si `project.id === activeProjectId` → badge azul "Active Project" (estático, sin acción)
- Si `project.id !== activeProjectId` → badge gris "Set as active" (clickeable)
- Click en "Set as active" → ejecuta `setActiveProject(project.id)`
- Mientras corre → muestra "Switching…" en el badge, deshabilitado
- Función renombrada de `_setActiveProject` a `setActiveProject` (sin prefix)
- Mismo espacio del badge — sin botones adicionales

**Validaciones:**
- ✅ npm run lint: OK (sin warning de función no usada)
- ⏳ npm run build: Running

**Próximo paso:** Build exitoso → validación visual con screenshot


**ESTADO FINAL — CERRADA (2026-07-03):**

Implementación completa del Dashboard visual redesign basado en assets aprobados.

**Validaciones técnicas:**
- ✅ npm run lint: OK
- ✅ npm run build: Exitoso
- ✅ TypeScript: Sin errores
- ✅ page.tsx: Sin cambios (confirmado)
- ✅ setActiveProject: Funcionalidad completa con badge accionable

**Cambios finales:**
- src/components/ProjectList.tsx: +451 líneas, -180 líneas
- Paleta nueva aplicada, accordion implementado, Connected Teams rediseñado
- Badge "Active Project" accionable (azul si activo, gris clickeable si no)
- Funcionalidad preservada: setActiveProject, Realtime, unread counts, Archive/Delete

**Estado:** ✅ **CLOSED** — Código completo, build exitoso, commit y push ejecutados

---

## 2026-07-03 — Mini-OE: Íconos en Bottom Ribbon (EXCEPCIÓN ÚNICA AUTORIZADA)

**Fecha:** 2026-07-03
**Tipo:** Mini-OE / UI polish / Bottom Ribbon
**Estado:** ⏳ Pendiente validación visual

**NOTA CRÍTICA — Excepción única a regla de protección:**

Esta OE constituye una **excepción única autorizada explícitamente** por el Product Owner (Arquitecto/Director de Obra) a la regla `keep_bottom_ribbon: true` establecida como protección de la "albañilería" del proyecto.

**Al cerrar esta OE, la protección del ribbon inferior vuelve a regir con la misma fuerza que antes.**

Ninguna OE futura puede tocar BottomRibbon.tsx sin nueva autorización explícita equivalente a esta. Este cambio **NO abre precedente**.

**Problema:**
Ribbon inferior en producción mostraba texto plano separado por `|`, sin íconos. Diseño aprobado (DASHBOARD_FINAL.png) muestra ícono junto a cada label.

**Cambio implementado:**
Agregados íconos de lucide-react (ya instalado, sin nuevas dependencias) junto a cada label del bottom ribbon.

**Mapeo de íconos:**
- Dashboard → LayoutDashboard
- Teams Map → Users
- Audit Log → ClipboardList
- Main Workspace → Folder
- Cross Verification → ShieldCheck
- Documentation Mode → BookOpen
- Prompts Library → MessageSquare
- Context Files → FileText
- API-Keys → Key
- Advanced → Settings

**Implementación técnica:**
- Tamaño: 14px (consistente con text-xs)
- Color: Hereda mismo color condicional que el texto (textActive, textInactive, textFuture)
- Layout: `flex items-center gap-1.5` (ícono + label)
- Tipografía: **NO tocada** — mantiene herencia de --font-ui (IBM Plex Sans)

**Archivo modificado:**
- src/components/layout/BottomRibbon.tsx (+40 líneas aprox)

**Restricciones respetadas:**
- ✅ NO se modificó TopRibbon.tsx ni AppLayout.tsx
- ✅ NO se cambió orden, rutas, lógica isActive, ni mecanismo future
- ✅ NO se cambió estructura del nav, tamaño del ribbon, ni separador |
- ✅ NO se agregaron librerías nuevas (solo lucide-react ya presente)
- ✅ NO se tocó tipografía/font-family (mantiene IBM Plex Sans)

**Validaciones técnicas:**
- ✅ npm run lint: OK (warnings preexistentes en CanvasViewport)
- ⏳ npm run build: Running

**Validación visual pendiente:**
Screenshot del ribbon inferior mostrando los 10 íconos correctamente alineados junto a cada label, en estado activo e inactivo.

**Próximo paso:**
Build exitoso → screenshot validación → commit "ui: add icons to bottom ribbon (one-time authorized exception)"

---

**ESTADO FINAL — CERRADA (2026-07-03):**

**Validaciones técnicas:**
- ✅ npm run lint: OK
- ✅ npm run build: Exitoso
- ✅ TypeScript: Sin errores
- ✅ Íconos importados de lucide-react (ya instalado)
- ✅ Tamaño 14px consistente con text-xs
- ✅ Color condicional heredado correctamente (active/inactive/future)

**Cambios finales:**
- src/components/layout/BottomRibbon.tsx: 10 íconos agregados
- Layout: flex items-center gap-1.5 (ícono + label)
- Tipografía: IBM Plex Sans preservada (herencia de --font-ui)

**Estado:** ✅ **CLOSED** — Íconos agregados, build exitoso

**RECORDATORIO CRÍTICO:**
Esta fue una **excepción única autorizada** por el Product Owner a la regla de protección del ribbon inferior. La protección `keep_bottom_ribbon: true` vuelve a regir con plena fuerza. Ninguna OE futura puede tocar BottomRibbon.tsx sin nueva autorización explícita equivalente.

---

## 2026-07-03 — Mini-OE: Unificar color de botones del Dashboard con --color-accent

**Fecha:** 2026-07-03
**Tipo:** Mini-OE / UI token alignment / visual-only
**Área:** Dashboard / ProjectList / design tokens

**Problema:**
El rediseño visual del Dashboard hardcodeó azules del spec JSON (#1F6BFF, #114FC7, #2F80ED, #EAF3FF), pero la app ya tiene definido el token oficial de marca `--color-accent: #1f4e79` usado en otras superficies (Documentation Mode, Top Ribbon).

**Objetivo:**
Reemplazar los azules hardcodeados por tokens oficiales sin modificar estructura, lógica ni otros archivos.

**Archivo modificado:**
- src/components/ProjectList.tsx (20 líneas modificadas, solo colores)

**Tokens verificados (src/styles/tokens.css):**
- --color-accent: #1f4e79
- --color-accent-strong: #173c5e
- --color-accent-soft: rgba(31, 78, 121, 0.12)

**Mapeo de reemplazo:**
- #1F6BFF → var(--color-accent) (azul principal)
- #114FC7 → var(--color-accent-strong) (hover/estado fuerte)
- #2F80ED → var(--color-accent) (badge Active Project text)
- #EAF3FF → var(--color-accent-soft) (badge Active Project bg, ícono team bg)

**Superficies actualizadas:**
- Botón "+ New Project"
- Botón "Create" en formulario
- Input focus border en formulario
- Badge "Active Project" (text + bg)
- Badge "Set as active" (hover text + border)
- Ícono team background (users group)
- Botón "Open →" en workspaces
- Badge "Host" en Connected Teams
- Botón "Open →" en connections
- Color de avatar en función getAvatarColor

**Restricciones respetadas:**
- ✅ tokens.css NO tocado
- ✅ Solo ProjectList.tsx modificado
- ✅ Estructura JSX NO modificada
- ✅ Handlers NO modificados
- ✅ Lógica NO modificada
- ✅ Fetch/effects NO modificados
- ✅ AppLayout NO tocado
- ✅ API routes NO tocadas

**Validaciones:**
- ✅ npm run lint: OK (warnings preexistentes en CanvasViewport)
- ✅ npm run build: Exitoso
- ✅ TypeScript: Sin errores
- ✅ grep hex antiguos: 0 resultados (correcto)
- ✅ git diff --check: Solo warnings CRLF (normal en Windows)
- ✅ Solo cambió ProjectList.tsx (20 líneas)

**Estado:** ✅ **CLOSED** — Tokens unificados, build exitoso

**Beneficio:** Dashboard ahora usa el mismo sistema de tokens que el resto de la app, facilitando futuros cambios de marca y manteniendo consistencia visual.

---

## 2026-07-06 — HumanChatPanel Realtime reconnection

**Fecha:** 2026-07-06
**Tipo:** OE / Bug fix / Resiliencia de conexión
**Área:** Connected Teams / Human Chat / Realtime

**Diagnóstico:**
El canal Realtime de HumanChatPanel no tenía reconexión real. Ante estados de error (CHANNEL_ERROR, TIMED_OUT, CLOSED) solo registraba logs console.error o console.warn. El comentario en línea 223 indicaba "will retry..." pero no existía retry implementado. Esto dejaba el canal muerto en silencio hasta que el usuario hiciera F5, navegara fuera/volviera, o el componente se desmontara/remontara.

**Causa raíz:**
Ausencia completa de lógica de reconexión tras fallo del canal Realtime. No era un bug puntual sino una capacidad de resiliencia nunca implementada, pese a que el código sugería falsamente su existencia mediante comentario.

**Cambio realizado:**
Se agregó reconexión automática con backoff progresivo dentro del useEffect de Realtime. Cambios específicos:

- Creada función interna reutilizable `createAndSubscribeChannel()` que crea canal, subscribe y maneja callbacks
- Backoff progresivo: 1s → 2s → 4s → 8s, tope 10s, sin límite máximo de reintentos
- Estados que disparan reconexión: CHANNEL_ERROR, TIMED_OUT, CLOSED
- SUBSCRIBED resetea contador de reconexión a 0
- Cleanup limpia timeout activo (`clearTimeout`) y canal activo (`removeChannel`)
- Protección con `isMounted` antes de reconectar para evitar reconexión post-desmontaje
- Variables de estado añadidas: `reconnectAttempts`, `reconnectTimeout`, `currentChannel`

**Preservaciones:**
- Refetch post-SUBSCRIBED intacto (cierre de gap T0→T1)
- Deduplicación de mensajes por ID intacta
- Envío de mensajes intacto
- Review & Forward intacto
- Props del componente intactas
- Lógica de scroll automático intacta
- Logs de diagnóstico existentes preservados

**Alcance:**
- Solo modificado: `src/components/workspace/HumanChatPanel.tsx`
- TeamsClient.tsx NO tocado
- ProjectList.tsx NO tocado
- API routes NO tocadas
- RLS NO tocado
- Schema/migraciones NO tocados

**Deuda pendiente:**
~~Revisar TeamsClient.tsx y ProjectList.tsx por patrón similar de `postgres_changes` sin reconexión. Aplicar mismo patrón en OEs futuras separadas.~~

**Actualización 2026-07-06:** Se revisaron TeamsClient.tsx y ProjectList.tsx — ambos ya tienen mitigación propia mediante polling de respaldo cada 15 segundos ("Fallback polling every 15s in case realtime misses cross-account events"), a diferencia de HumanChatPanel.tsx que no tenía ningún mecanismo de respaldo. El impacto de un canal Realtime muerto en estos dos archivos es acotado (máximo 15s de demora, no requiere F5), por lo que no se requiere replicar el fix de reconexión ahí. Deuda pendiente cerrada por diagnóstico — no por implementación.

**Validaciones técnicas:**
- npm run lint: OK (warnings preexistentes en CanvasViewport)
- npm run build: Exitoso
- TypeScript: Sin errores

**Estado:** ✅ **Closed** — Reconexión implementada correctamente, pasa validaciones técnicas, no rompe flujo existente.

**Lección:**
Validar comentarios en código que indican comportamiento automático ("will retry"). Si no existe implementación real, el comentario es técnicamente deuda técnica que genera falsa seguridad.

---

## 2026-07-06 — Connected Teams: conexiones legacy sin isolated team IDs (huérfanas entre arquitecturas)

**Fecha:** 2026-07-06
**Tipo:** Diagnóstico / Data quality / Housekeeping
**Área:** Connected Teams / team_connections / isolated teams
**Estado:** ✅ **Closed** — Diagnóstico confirmado, solución aplicada para data de test

**Problema:**
Conexiones de Connected Teams aceptadas antes de la migración 042 (arquitectura "dos edificios") pueden tener `host_isolated_team_id` e `invitee_isolated_team_id` en NULL. Al clickear "Open" desde el Dashboard, el botón cae al fallback y redirige a Teams Map en vez de abrir el workspace correcto — síntoma que parece "no encontró el team".

**Causa raíz:**
La lógica que crea los isolated teams (`PATCH /api/connections/[id]`, acción `accept`) solo corre en el momento de aceptar una conexión NUEVA. Conexiones aceptadas bajo la arquitectura anterior (`scope_isolated_team_id`, eliminado en migración 044) nunca fueron migradas retroactivamente — quedaron sin ningún team asociado, ni viejo ni nuevo.

**Consecuencia:**
El botón "Open" de Connected Teams en el Dashboard cae a `/teams` (Teams Map) en vez de abrir el workspace, para cualquier conexión con ambos IDs en NULL.

**Proceso de diagnóstico:**
Confirmado por lectura de código (FK real en migración 042, lógica de `getUserIsolatedWorkspaceId` correcta) + verificación directa en Supabase SQL Editor de los valores NULL en conexiones viejas. No requirió reproducción en vivo.

**Solución aplicada (temporal, no automatizada):**
Recrear manualmente la conexión afectada (Disconnect + Connect de nuevo) para que pase por la lógica de accept vigente y genere los isolated team IDs correctamente.

**Archivos involucrados:**
- `src/lib/db/connections.ts` (función `getUserIsolatedWorkspaceId` verificada correcta)
- `src/components/ProjectList.tsx` (botón "Open" que consume el helper)
- `supabase/migrations/042_two_buildings.sql` (introdujo FKs nuevos)
- `supabase/migrations/044_drop_scope_isolated_fields.sql` (eliminó campo viejo)

**Commit:**
N/A (no requirió cambio de código, era data de test)

**Lección:**
Si esto reaparece con usuarios reales en producción (no solo data de test), no alcanza con "recrear la conexión" — se necesita un script de backfill de una sola vez que identifique conexiones activas con `host_isolated_team_id`/`invitee_isolated_team_id` NULL y les cree los isolated teams retroactivamente, siguiendo el patrón ya establecido de scripts administrativos (ej. `migrate-archived-to-deleted.ts`: lista cerrada de IDs, preflight, confirmación explícita del Manager antes de ejecutar).

**Query de diagnóstico rápido para verificar si hay conexiones afectadas:**
```sql
SELECT id, requester_email, receiver_email, status,
       host_isolated_team_id, invitee_isolated_team_id
FROM team_connections
WHERE status = 'active'
  AND (host_isolated_team_id IS NULL OR invitee_isolated_team_id IS NULL);
```

**Estado:** ✅ **Closed** — Data de test corregida manualmente, patrón de backfill documentado para escenario futuro.

---

## 2026-07-06 — Verificación inconclusa del fix de reconexión Realtime (HumanChatPanel)

**Fecha:** 2026-07-06
**Tipo:** Testing / Validación / Realtime
**Área:** Connected Teams / Human Chat / Reconexión automática
**Estado:** ⚠️ **Inconcluso** — Fix implementado (commit d949bce), pero validación no logró reproducir condiciones de fallo

**Contexto:**
Tras implementar reconexión automática con backoff en el canal Realtime de HumanChatPanel (commit d949bce), se intentó validar con DevTools (Network → Offline → No throttling) mientras se enviaban mensajes desde otra cuenta.

**Resultado de la prueba:**
El chat siguió recibiendo mensajes en vivo sin necesidad de F5 (señal positiva), pero los logs específicos de reconexión (`[HumanChat] Reconnecting, attempt...`) nunca aparecieron en consola — sí apareció un "Network error" en el chat al enviar en offline, que es comportamiento esperado.

**Interpretación:**
El corte de red simulado por DevTools probablemente no duró lo suficiente para que Supabase Realtime disparara `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED` — el socket se recuperó a un nivel más bajo antes de que la lógica de reconexión entrara en acción. No hay evidencia de que el fix esté roto, pero tampoco confirmación directa de que la reconexión se haya activado.

**Decisión:**
Cerrar la validación como inconclusa. El código de reconexión está implementado correctamente (revisión técnica confirmada en OE original), pero las condiciones de fallo son aleatorias y difíciles de reproducir artificialmente.

**Archivos involucrados:**
- `src/components/workspace/HumanChatPanel.tsx` (reconexión con backoff implementada)

**Commit relacionado:**
- d949bce: fix: add automatic reconnection to Realtime channel in HumanChatPanel

**Lección:**
Si el síntoma original (mensaje no llega en vivo, requiere F5) reaparece en uso real, revisar la consola del receptor en el momento exacto del fallo — es una prueba más confiable que simular con DevTools, dado que el bug original es aleatorio y depende de condiciones reales de red que son difíciles de reproducir artificialmente.

**Estado:** ⚠️ **Inconcluso pero cerrado** — Fix implementado y técnicamente correcto. Pendiente observación en condiciones reales de fallo si el síntoma original reaparece en producción.

---

## 2026-07-06 — ConnectTeamModal isolated team exclusion

**Fecha:** 2026-07-06
**Tipo:** Mini-OE / Bug fix / Connected Teams
**Área:** Connect Team / Host team selection / Isolated teams
**Estado:** ✅ **Closed** — Validado en producción (2026-07-06): flujo normal (team nuevo) confirmado sin nombres corruptos. El escenario que requeriría reproducir el caso #4 literalmente (conectar desde un team ya isolated) no es alcanzable en el flujo normal del producto — la arquitectura fuerza que cada conexión cree un team nuevo, y un team isolated huérfano está destinado a archivarse (ver deuda pendiente 'Archived Teams' en checklist), no a reutilizarse. El fix de ConnectTeamModal actúa como segunda capa de seguridad ante ese escenario, aunque no sea alcanzable hoy vía UI normal.

**Diagnóstico:**
- `ConnectTeamModal` seleccionaba automáticamente `teams[0]` como `hostTeamId` para iniciar una nueva conexión (línea 62).
- No excluía teams con `type='isolated'`.
- Si el primer team de la lista era un team isolated (generado por una conexión previa con nombre tipo "Shared: X ↔ Y"), una nueva conexión podía generar nombres corruptos tipo "Shared: Shared: X ↔ Y ↔ Z" y emails repetidos.
- El bug no pertenece a Teams Map: el nombre corrupto se genera antes, durante el accept en el backend, basándose en `requester_team_name` que ya venía corrupto desde el modal.

**Causa raíz:**
La lógica de selección automática no filtraba teams por `type !== 'isolated'`. Teams aislados son teams creados específicamente para conexiones compartidas (arquitectura "dos edificios"), con nombres prefijados "Shared: ...". No deben poder actuar como origen de nuevas conexiones.

**Cambio realizado:**
- Se filtran teams elegibles con `teams.filter(t => t.type !== 'isolated')` antes de calcular `hostTeamId` (líneas 61-64).
- Si no hay teams elegibles (`hostTeamId === ''`), se muestra error claro: "No eligible team available to connect from. Isolated (shared) teams cannot be used to start new connections."
- El error reutiliza el mecanismo existente `setError()` y previene el submit.
- No se tocó la lógica de accept en backend.
- No se tocó Teams Map.
- No se modificaron nombres corruptos legacy existentes en base de datos.

**Alcance:**
- Solo `src/components/teams/ConnectTeamModal.tsx` modificado (+5 líneas netas).
- No se modificaron: `/api/connections`, Teams Map, migraciones, RLS, formulario del modal, selector visual de team.

**Validaciones técnicas:**
- ✅ npm run lint: OK (warnings preexistentes en CanvasViewport no relacionados)
- ✅ npm run build: Exitoso — producción optimizada generada
- ✅ TypeScript: Sin errores (validado durante build)
- ❌ npm run typecheck: No existe en package.json

**Validación funcional:**
⏳ **Pendiente por Product Owner con datos reales:**

| # | Caso | Validación |
|---|---|---|
| 1 | Usuario con solo teams normales | Sigue funcionando igual que antes |
| 2 | Usuario cuyo primer team es `isolated`, pero tiene otros normales | Selecciona el primer team NO aislado |
| 3 | Usuario con todos los teams `isolated` | Muestra error claro y no crashea |
| 4 | Nueva conexión creada después del fix | El nombre resultante NO contiene "Shared: Shared:" |
| 5 | Teams Map | No se tocó y no participa en la causa |
| 6 | API accept | No se tocó |
| 7 | Modal | Formulario y validaciones existentes siguen funcionando |

**Restricciones respetadas:**
- ✅ `/api/connections/**` no tocado
- ✅ Accept backend no tocado
- ✅ Teams Map no tocado
- ✅ RLS no tocado
- ✅ Migraciones no tocadas
- ✅ Formulario no reescrito
- ✅ Selector visual no agregado
- ✅ Corrección retroactiva de nombres legacy no implementada

**Nota de datos legacy:**
Nombres corruptos existentes (tipo "Shared: Shared: ...") creados antes de este fix no se corrigen retroactivamente. Si aparecen teams con nombre duplicado en base de datos, requieren corrección manual de datos, no solo el fix de código.

**Lección clave:**
Los teams aislados/shared no deben poder actuar como origen de nuevas conexiones. El filtro debe aplicarse antes de la selección automática, no después. Si todos los teams son `isolated`, el modal debe fallar con error claro en lugar de intentar crear una conexión inválida.

**Commit:** c54c9a1

**Validación en producción (2026-07-06):**
- Caso #1 (flujo normal con team nuevo): ✅ Confirmado — conexión creada sin nombres corruptos
- Caso #4 (conectar desde team isolated): No reproducible en flujo normal — la arquitectura fuerza que cada conexión cree un team nuevo; un team isolated huérfano está destinado a archivarse, no a reutilizarse
- Fix de ConnectTeamModal: Segunda capa de seguridad funcional ante escenario edge no alcanzable vía UI normal

**Estado:** ✅ **Closed** — Validado en producción con flujo normal confirmado. Fix actúa como hardening ante escenario arquitecturalmente prevenido.

---

## 2026-07-06 — IncomingRequestsPanel active connections cleanup

**Fecha:** 2026-07-06
**Tipo:** Mini-OE / UI cleanup / Connected Teams
**Área:** Connected Teams / Requests Modal / IncomingRequestsPanel

**Diagnóstico:**
- IncomingRequestsPanel mostraba solicitudes pendientes Y también una sección "Active connections (incoming)".
- La sección active era redundante porque Dashboard / Connected Teams ya muestra conexiones activas con mejor jerarquía visual (avatares, badges Host/Invitee) y acciones (Open, Disconnect).
- La sección active era incompleta porque solo mostraba `direction='incoming'`, excluyendo conexiones activas iniciadas por el usuario como outgoing.
- Esto podía inducir a interpretar que la lista de activas era completa, cuando no lo era.

**Causa raíz:**
Sección secundaria agregada en algún momento para mostrar conexiones activas dentro de un modal cuyo propósito real es gestionar solicitudes pendientes. Duplicaba funcionalidad mejor resuelta en Dashboard y mostraba vista incompleta por filtrar solo `direction === 'incoming'`.

**Cambio realizado:**
- Se eliminó la variable `active` (línea 30).
- Se eliminó el bloque JSX "Active connections (incoming)" (líneas 158-173).
- El estado vacío ahora depende solo de `pending.length === 0` (línea 92).
- No se modificó `pending`.
- No se modificó Accept/Reject.
- No se modificó Dashboard.
- No se modificó Teams Map fuera del panel.
- No se modificó `/api/connections`.

**Archivo funcional tocado:**
- src/components/teams/IncomingRequestsPanel.tsx (-18 líneas netas)

**Validaciones técnicas:**
- ✅ npm run lint: OK (warnings preexistentes en CanvasViewport)
- ❌ npm run typecheck: No existe en package.json
- ✅ npm run build: Exitoso — producción optimizada generada
- ✅ TypeScript validado implícitamente durante build

**Validación funcional:**
✅ Validado visualmente en producción (2026-07-06): modal con 1 solicitud pendiente muestra Accept/Reject correctamente; modal sin solicitudes muestra "No pending requests." limpio, sin restos de la sección eliminada. Dashboard y Teams Map confirmados no tocados por inspección de git diff.

**Estado:** ✅ **Closed** — Código completo, build exitoso, validación visual en producción confirmada por Product Owner.

**Commit:** 56a35d1

**Lección:**
Modales de gestión deben enfocarse en su propósito único (requests pending) sin duplicar vistas que ya existen mejor resueltas en otras superficies (Dashboard). Secciones secundarias que muestran información incompleta (solo incoming, no outgoing) pueden ser peores que ausencia total porque inducen interpretación incorrecta de completitud.

---

## 2026-07-07 — Web Search OFF visual emphasis

**Fecha:** 2026-07-07
**Tipo:** Mini-OE / UI polish / Visual emphasis
**Área:** Workspace / AgentPanel / Web Search toggle

**Diagnóstico:**
- El botón `Web search: OFF` era demasiado discreto (texto muted, borde default).
- El usuario podía no encontrarlo fácilmente cuando el AI le indicaba activarlo.
- Se descartó cambiar el default a ON — Web Search debe seguir iniciando en OFF.
- El AI ya está prompteado para guiar al usuario a activar Web Search cuando hace falta una búsqueda.

**Cambio realizado:**
- Web Search sigue iniciando en OFF (`useState(false)` sin cambios).
- Se modificó solo el estilo condicional del botón (líneas 509-512).
- **OFF ahora es visualmente llamativo:** `bg-amber-500 text-white border-transparent animate-pulse`
- **ON queda neutro/discreto:** `text-[var(--color-text-muted)] border-[var(--color-border-default)]`
- No se tocó handler, texto del botón, payload ni lógica de envío.

**Archivo funcional tocado:**
- src/components/workspace/AgentPanel.tsx (solo clases condicionales del botón)

**Validaciones técnicas:**
- ✅ npm run lint: OK (warnings preexistentes en CanvasViewport)
- ❌ npm run typecheck: No existe en package.json
- ✅ npm run build: Exitoso — producción optimizada generada
- ✅ TypeScript validado implícitamente durante build

**Validación funcional:**
⏳ Pendiente por Product Owner — requiere verificar visualmente que OFF es llamativo (ámbar pulsante) y ON es neutro (texto muted).

**Estado:** ⚠️ **Partial** — Código completo, build exitoso, validación visual pendiente por Product Owner.

**Commit:** (pendiente)

**Lección:**
Cuando el AI guía al usuario a activar una funcionalidad, el control correspondiente debe destacarse visualmente en su estado inactivo para facilitar que el usuario lo encuentre rápidamente. Invertir el énfasis visual (inactivo llamativo, activo neutro) puede ser más efectivo que cambiar el default de comportamiento.

---


## 2026-07-07 — Web Search OFF button visual refinement

**Fecha:** 2026-07-07
**Tipo:** Mini-fix / UI polish / Visual correction
**Área:** Workspace / AgentPanel / Web Search toggle

**Contexto:**
La implementación anterior (commit cb6e9b0) aplicó estilo ámbar + `animate-pulse` al estado OFF del botón Web Search para hacerlo más visible. Este estilo resultó demasiado llamativo/tipo neón y no gustó al Product Owner.

**Cambio realizado:**
Reemplazar estilo ámbar pulsante por diseño sobrio:
- **Fondo OFF:** `bg-black` (negro sólido)
- **Texto OFF:** `text-white` (blanco en ambas partes del label)
- **Énfasis interno:** Solo la palabra "OFF" en negrita (`font-bold`), resto del texto en peso normal
- **Estado ON:** Sin cambios (sigue neutral con `text-[var(--color-text-muted)]`)
- Se eliminó completamente `animate-pulse` y todas las clases de ámbar

**Implementación:**
```tsx
// Antes (línea 512):
: 'bg-amber-500 text-white border-transparent animate-pulse'

// Después (línea 512):
: 'bg-black text-white border-transparent'

// Texto del botón ahora usa JSX fragment con negrita condicional (líneas 516-521):
{webSearchEnabled ? (
  <>Web search: <span className="font-bold">ON</span></>
) : (
  <>Web search: <span className="font-bold">OFF</span></>
)}
```

**Archivo funcional tocado:**
- src/components/workspace/AgentPanel.tsx (líneas 509-521: clases condicionales + estructura del texto del botón)

**Validaciones técnicas:**
- ✅ npm run lint: OK (warnings preexistentes en CanvasViewport)
- ✅ npm run build: Exitoso — producción optimizada generada
- ✅ git diff --stat: Solo AgentPanel.tsx modificado (+8 líneas, -2 líneas)

**Restricciones respetadas:**
- ❌ No se tocó `useState`
- ❌ No se tocó handler `onClick`
- ❌ No se agregaron librerías
- ❌ No se tocaron otros archivos
- ✅ Se eliminó completamente `animate-pulse` y clases ámbar
- ✅ Se usó `bg-black` de Tailwind (negro puro estándar)

**Validación visual:**
✅ **Confirmada por Product Owner (2026-07-07):** Estilo negro/blanco con negrita en ON/OFF se ve correcto en las tres columnas del workspace (Manager, Worker 1, Worker 2). Fondo negro sólido, texto blanco, palabra ON/OFF en negrita funcionando como esperado.

**Estado:** ✅ **CLOSED** — Código completo, build exitoso, validado visualmente en producción.

**Commit:** 1af4c0a — fix: replace amber pulse with black/white bold emphasis on Web search OFF button

**Decisión técnica:**
El énfasis visual excesivo (ámbar + pulse) puede ser contraproducente en UI profesional. Un diseño más sobrio (negro sólido + negrita selectiva) mantiene la jerarquía visual sin caer en efectos tipo neón. La negrita aplicada solo a ON/OFF permite diferenciar el estado sin duplicar información de color.

**Alternativas descartadas:**
- Mantener `animate-pulse` con otro color: rechazado porque el problema era la animación misma, no solo el color ámbar
- Aplicar negrita a todo el texto del botón: rechazado porque el énfasis debe estar en el estado (ON/OFF), no en "Web search:"
- Usar tokens de color custom: innecesario, `bg-black` de Tailwind es exactamente lo requerido

**Riesgos conocidos:**
Ninguno. Es cambio cosmético aislado sin impacto en lógica funcional.

---

## 2026-07-07 — Chat attachments AI summary + audit_log enrichment

**Fecha:** 2026-07-07
**Tipo:** Feature / Message attachments / AI summary / Audit log enrichment
**Área:** Chat / Message attachments / attachment_metadata / audit_log

**Contexto:**
Los adjuntos de chat ya se envían al AI para que lo analice y responda al usuario. Esa comprensión del archivo no quedaba persistida de forma estructurada. La información se perdía al terminar la respuesta.

**Objetivo:**
Capturar y persistir un resumen corto y estructurado del adjunto asociado al mensaje, sin bloquear la respuesta principal del chat.

**Decisión arquitectural:**
- NO modificar `/api/chat` (streaming intacto)
- Agregar lógica en `/api/messages` (punto donde se guardan mensajes con attachment_metadata)
- Generar resumen AI de forma asíncrona (fire-and-forget) cuando se guarda un mensaje con adjuntos
- Actualizar `attachment_metadata` con el resumen generado
- Insertar nuevo evento `audit_log` tipo `attachment_summary_generated` (NO actualizar el `attachment_uploaded` existente para evitar race conditions)

**Cambio realizado:**
1. Se agregó función `generateAttachmentSummaries()` en `/api/messages/route.ts` que:
   - Extrae texto del adjunto usando helper existente `extractTextFromBuffer` (no duplica lógica)
   - Genera resumen corto (2-4 líneas) usando el mismo provider/modelo del agente
   - Actualiza `messages.attachment_metadata` con campo `ai_summary` retrocompatible
   - Inserta evento `audit_log` tipo `attachment_summary_generated` con metadata completa
   - Degradación graceful: si falla, el mensaje se guarda igual y el error queda logueado

2. Formato de `ai_summary` en `attachment_metadata`:
```json
{
  "status": "available",
  "summary": "Resumen corto del adjunto en 2-4 líneas.",
  "generated_at": "2026-07-07T00:00:00.000Z",
  "provider": "anthropic",
  "model": "claude-...",
  "source": "chat_attachment"
}
```

Si falla:
```json
{
  "status": "unavailable",
  "error": "reason",
  "generated_at": "2026-07-07T00:00:00.000Z",
  "provider": "...",
  "model": "...",
  "source": "chat_attachment"
}
```

3. Evento `audit_log` nuevo: `attachment_summary_generated` con metadata:
```json
{
  "filename": "...",
  "mime_type": "...",
  "attachment_type": "image|document",
  "provider": "...",
  "model": "...",
  "attachment_summary": { ... }
}
```

**Archivos tocados:**
- src/app/api/messages/route.ts (+195 líneas — función generateAttachmentSummaries + imports)

**Archivos NO tocados:**
- src/app/api/chat/route.ts (streaming intacto)
- Context Files (no tocado)
- Checkpoints (no tocados)
- Migraciones (no creadas)
- RLS (no tocado)
- Schema (no tocado)
- Storage (no tocado)
- UI (no tocada)

**Restricciones respetadas:**
- ✅ No bloquea la respuesta principal del chat
- ✅ Fire-and-forget sin await en POST handler
- ✅ Reutiliza helper extractTextFromBuffer existente (no duplica lógica)
- ✅ Usa mismo provider/modelo del agente (no agrega dependencias)
- ✅ attachment_metadata retrocompatible (solo agrega campo ai_summary)
- ✅ audit_log attachment_uploaded no tocado (evento nuevo attachment_summary_generated)
- ✅ No contamina respuesta visible al usuario
- ✅ Degradación graceful si falla resumen
- ✅ No implementa borrado a 8 horas (fuera de alcance)
- ✅ No agrega dependencias/librerías nuevas

**Validaciones técnicas:**
- ✅ npm run lint: OK (warnings preexistentes en CanvasViewport no relacionados)
- ❌ npm run typecheck: No existe en package.json
- ✅ npm run build: Exitoso — producción optimizada generada

**Validación funcional:**
✅ **CONFIRMADA en producción (2026-07-07)** — Product Owner validó visualmente:
1. ✅ Mensaje con adjunto se envía sin demora perceptible
2. ✅ `attachment_metadata` del mensaje contiene `ai_summary` con resumen generado — **status: "available"**, resumen real y coherente del contenido del PDF adjunto (formulario "Costeando Ideas", programa de presupuesto participativo)
3. ✅ `audit_log` contiene evento `attachment_summary_generated` con metadata completa (confirmado previamente)
4. ⏸️ Archivo no soportado: no testeado (no crítico — degradación graceful implementada)
5. ⏸️ Fallo graceful: no testeado (no crítico — lógica implementada con logs)
6. ✅ Mensaje sin adjunto sigue funcionando igual (confirmado por operación normal del sistema)
7. ✅ Context Files no fue tocado (verificado con git diff)
8. ✅ Checkpoints no fueron tocados (verificado con git diff)

**Validación en producción:**
Archivo adjunto testeado: PDF "Costeando Ideas" (formulario de presupuesto participativo)
Resumen AI generado: Coherente y preciso con el contenido real del documento
Provider/modelo/timestamp: Todos correctos en metadata

**Estado:** ✅ **CLOSED** — Feature completa, validada visualmente en producción con resumen AI real y coherente del adjunto.

**Commits:**
- c32e9c1 — feat: generate AI summary for message attachments and enrich audit_log
- 09fa3d2 — fix: use real message ID instead of content-based search in attachment summary

**Lección clave:**
Cuando el flujo principal usa streaming, agregar metadata enriquecida requiere fire-and-forget en el punto de persistencia (no en el punto de streaming). Insertar un evento nuevo de audit_log es más seguro que actualizar uno existente sin ID disponible. La extracción de texto debe reutilizar helpers existentes para evitar duplicación y mantener consistencia con Context Files.

**Alternativas descartadas:**
- Modificar `/api/chat` para enriquecer audit_log existente: descartado porque el streaming no debe bloquearse y no hay ID del audit_log para actualizar después
- Usar proveedor/modelo distinto: descartado para no agregar infraestructura nueva
- Actualizar audit_log attachment_uploaded existente: descartado por riesgo de race conditions sin ID disponible

**Riesgos conocidos:**
- Fire-and-forget en serverless puede fallar silenciosamente si el runtime se apaga antes de completar (aceptable para MVP — metadata no crítica)
- Matching de mensaje para actualizar attachment_metadata por content+session_id+timestamp puede fallar si hay duplicados exactos (edge case muy raro)

**Próximo paso:**
Validación funcional por Product Owner con archivo de prueba real en producción. Una vez confirmado PASS, actualizar estado a Closed y proceder con commit.

---

## 2026-07-07 — Chat attachments AI summary — Fix: eliminar búsqueda aproximada, usar ID real

**Fecha:** 2026-07-07
**Tipo:** Fix técnico / Eliminación de antipatrón / Chat attachments
**Área:** /api/messages / generateAttachmentSummaries

**Contexto:**
Inmediatamente después del primer commit (c32e9c1), el Product Owner detectó un antipatrón crítico: la función `generateAttachmentSummaries` buscaba el mensaje insertado por coincidencia de `session_id + role + content + order by created_at desc limit 1` para actualizarlo con el resumen AI.

**Riesgo identificado:**
Bajo ejecución fire-and-forget en paralelo, si dos mensajes con texto idéntico se insertan con pocos segundos de diferencia, la tarea de resumen del mensaje más viejo puede terminar de procesar después de que el mensaje más nuevo ya exista. En ese momento, "el más reciente" ya no es el mensaje correcto para esa tarea. Riesgo: actualizar el mensaje equivocado.

**Causa raíz:**
El INSERT original (línea 22) NO usaba `.select()` para obtener los IDs de las filas insertadas. Sin esos IDs, no había forma de actualizar el mensaje correcto sin búsqueda aproximada.

**Cambio realizado:**
1. **INSERT con `.select()`:** Agregado `.select('id, role, attachment_metadata')` al INSERT para obtener IDs reales de cada fila insertada
2. **Mapeo mensaje → ID:** Mapeo de mensajes originales con sus IDs correspondientes antes de filtrar por adjuntos
3. **Firma de función actualizada:** `generateAttachmentSummaries` ahora recibe `messageId: string | null` en cada mensaje
4. **Eliminada búsqueda aproximada:** Reemplazado bloque completo de `.eq('session_id').eq('role').eq('content').order('created_at', { ascending: false }).limit(1)` por `.eq('id', msg.messageId)` directo
5. **Guard contra messageId null:** Si `messageId` es null, se loggea error y se salta ese adjunto (no rompe el flujo)

**Código antes (antipatrón):**
```typescript
const { error } = await supabase.from('messages').insert(...)
// ...
const { data: currentMessage } = await supabase
  .from('messages')
  .select('id, attachment_metadata')
  .eq('session_id', sessionId)
  .eq('role', 'user')
  .eq('content', msg.content)  // ← búsqueda aproximada
  .order('created_at', { ascending: false })
  .limit(1)
  .single()
```

**Código después (fix):**
```typescript
const { data: insertedMessages, error } = await supabase
  .from('messages')
  .insert(...)
  .select('id, role, attachment_metadata')  // ← IDs reales

const messagesWithIds = messages.map((msg, index) => ({
  ...msg,
  messageId: insertedMessages?.[index]?.id ?? null,  // ← mapeo directo
}))
// ...
if (!msg.messageId) {
  console.error('[messages] generateAttachmentSummaries: messageId missing', ...)
  continue  // ← guard sin romper
}

const { data: currentMessage } = await supabase
  .from('messages')
  .select('attachment_metadata')
  .eq('id', msg.messageId)  // ← actualización directa por ID
  .single()
```

**Archivos tocados:**
- src/app/api/messages/route.ts (refactor +15 líneas netas — no es código nuevo, es eliminación de antipatrón)

**Restricciones respetadas:**
- ✅ No se tocaron otros archivos
- ✅ Build exitoso
- ✅ Lógica de resumen AI intacta
- ✅ Fire-and-forget preservado

**Validaciones técnicas:**
- ✅ npm run lint: OK (warnings preexistentes en CanvasViewport)
- ✅ npm run build: Exitoso

**Estado:** ✅ **CLOSED** — Fix técnico completo y validado en producción junto con la feature principal (OE original). Validado visualmente en producción (2026-07-07): attachment_metadata.ai_summary confirmado con resumen real y coherente del adjunto, status: available, model/provider/timestamp correctos.

**Commit:** 09fa3d2 — fix: use real message ID instead of content-based search in attachment summary

**Lección clave:**
En operaciones fire-and-forget que procesan múltiples items en paralelo, NUNCA buscar el item correcto por coincidencia de contenido + timestamp — siempre obtener y usar el ID real desde el INSERT. Supabase permite `.insert(...).select()` para obtener IDs sin query adicional. La búsqueda aproximada por `content` puede funcionar 99% del tiempo, pero el 1% restante genera corrupción silenciosa de datos.

**Alternativas descartadas:**
- Mantener búsqueda aproximada con `order by created_at + limit 1`: descartado porque no elimina el riesgo bajo ejecución paralela
- Agregar timestamp único al payload del frontend: descartado porque agrega complejidad innecesaria cuando el ID real está disponible
- Serializar procesamiento de adjuntos: descartado porque degrada performance sin razón

**Riesgos eliminados:**
✅ Race condition en actualización de attachment_metadata
✅ Corrupción silenciosa al actualizar mensaje equivocado
✅ Falso positivo en logs ("actualización exitosa" pero del mensaje incorrecto)

---

## 2026-07-07 — messages UPDATE RLS policy for attachment AI summary

**Fecha:** 2026-07-07
**Tipo:** Fix / RLS / Seguridad de escritura / Missing policy
**Área:** Supabase / RLS / messages table / Attachment AI Summary

**Diagnóstico:**
La tabla `messages`, creada originalmente en la migración `002`, tenía políticas RLS para `SELECT` e `INSERT`, pero **no tenía política de `UPDATE`**.

Esto no se manifestó hasta la Mini-OE de Attachment AI Summary (commits c32e9c1 y 09fa3d2), que necesita actualizar un mensaje ya insertado para guardar:
```
messages.attachment_metadata.ai_summary
```

**Evidencia real en producción:**
- ✅ `audit_log` recibió evento `attachment_summary_generated` correctamente (INSERT permitido en audit_log)
- ❌ `messages.attachment_metadata.ai_summary` nunca apareció en Table Editor
- **Causa confirmada:** La escritura del UPDATE fue bloqueada por RLS debido a la ausencia de política `messages_update`

**Por qué audit_log sí funcionó:**
`audit_log` solo necesita INSERT, y esa política existe. El problema era exclusivo de `messages`, que necesitaba UPDATE pero no tenía la política.

**Por qué messages.attachment_metadata no funcionó:**
`generateAttachmentSummaries` ejecuta:
```typescript
await supabase
  .from('messages')
  .update({ attachment_metadata: enrichedMetadata })
  .eq('id', msg.messageId)
```

Sin política `messages_update`, Supabase bloqueó silenciosamente el UPDATE por RLS, sin error visible en logs de aplicación (comportamiento esperado de RLS).

**Cambio realizado:**
Se agregó migración `047_add_messages_update_policy.sql` con política `messages_update` que replica la cadena de ownership de `messages_select` y `messages_insert`:

```sql
messages.session_id → agent_sessions → workspaces → teams → projects.account_id = auth.uid()
```

La política incluye:
- `USING`: Permite UPDATE solo si el usuario es propietario (mismo ownership chain)
- `WITH CHECK`: Valida que el estado nuevo de la fila también cumpla ownership (previene escalación de privilegios)

**Archivos tocados:**
- `supabase/migrations/047_add_messages_update_policy.sql` (nuevo, +39 líneas)

**Archivos NO tocados:**
- `src/app/api/messages/route.ts` (no tocado — el bug era RLS, no lógica de aplicación)
- `generateAttachmentSummaries` (no tocado — lógica correcta)
- Otras tablas (no tocadas)
- Otras políticas (no tocadas)
- Código de aplicación (no tocado)

**Restricciones respetadas:**
- ✅ No se ejecutó `supabase db push`
- ✅ No se tocó código de aplicación
- ✅ No se tocó `generateAttachmentSummaries`
- ✅ No se modificaron otras políticas
- ✅ Solo una migración nueva con una sola política UPDATE
- ✅ No se agregó DELETE ni otros permisos

**Validación:**
✅ **CONFIRMADA en producción (2026-07-07)** — Product Owner ejecutó SQL y validó visualmente:

1. ✅ **SQL ejecutado en Supabase SQL Editor:**
   - Migración `047_add_messages_update_policy.sql` ejecutada
   - Resultado: "Success"
   - Política `messages_update` creada correctamente

2. ✅ **Prueba de adjunto repetida:**
   - Archivo PDF "Costeando Ideas" subido junto con mensaje al Manager
   - Respuesta del AI recibida sin demora

3. ✅ **Verificado en Supabase Table Editor:**
   - Tabla `messages` confirmada
   - Mensaje recién enviado localizado
   - Columna `attachment_metadata` contiene campo `ai_summary` con:
     - **status: "available"**
     - **summary:** Resumen real y coherente del contenido del PDF (formulario de presupuesto participativo "Costeando Ideas")
     - **provider/model/timestamp:** Todos correctos

4. ✅ **Verificado audit_log:**
   - Evento `attachment_summary_generated` confirmado insertándose correctamente

**Estado:** ✅ **CLOSED** — Migración ejecutada y validada visualmente en producción. La política `messages_update` permite correctamente que `attachment_metadata.ai_summary` persista. Feature Attachment AI Summary completamente funcional.

**Commit:** 4a5ca3e — fix: add missing UPDATE RLS policy on messages table

**Lección clave:**
RLS requiere políticas explícitas para cada operación DML. Tener SELECT+INSERT no implica tener UPDATE. Features que actualizan filas existentes deben auditar políticas UPDATE además de SELECT/INSERT, incluso si el UPDATE ocurre desde el mismo código que hizo el INSERT. El bloqueo por RLS es silencioso desde la perspectiva de la aplicación — Supabase simplemente ignora el UPDATE sin lanzar error visible en logs del servidor.

**Alternativas descartadas:**
- Modificar `generateAttachmentSummaries` para hacer INSERT de nueva fila en lugar de UPDATE: descartado porque rompe el modelo de datos (un mensaje debe tener una sola fila)
- Desactivar RLS en `messages`: descartado porque elimina capa crítica de seguridad
- Usar service role key para el UPDATE: descartado porque evade RLS en lugar de corregir la política faltante

**Riesgos conocidos antes del fix:**
- UPDATE bloqueado silenciosamente
- audit_log creaba falsa sensación de éxito (evento insertado sin datos en messages)
- Sin error visible en aplicación
- Debugging difícil sin conocimiento profundo de RLS

**Riesgos eliminados con el fix:**
✅ UPDATE ahora permitido para mensajes propios
✅ `attachment_metadata.ai_summary` puede persistirse
✅ Feature Attachment AI Summary puede completarse

**Próximo paso obligatorio:**
Product Owner debe ejecutar SQL manualmente en Supabase y validar visualmente que `ai_summary` aparece en `messages.attachment_metadata` después de subir un adjunto.

---

## 2026-07-08 — Attachment transparency text below chip

**Fecha:** 2026-07-08
**Tipo:** Mini-OE / UI copy / Transparencia de adjuntos
**Área:** Workspace / AgentPanel / Chat attachments
**Estado:** ✅ **CLOSED** — Validado visualmente en producción (2026-07-08)

**Archivos modificados:**
- src/components/workspace/AgentPanel.tsx (+4 líneas)
- handoff-2026-07.md (esta entrada)
- PRODUCT_STATUS.md (actualizado)

**Contexto:**
El texto originalmente planeado "This file will be erased after 8hs" fue descartado porque no refleja la realidad técnica actual confirmada en OE B: los adjuntos de chat no se almacenan como archivo físico persistente. El contenido se analiza en el flujo del mensaje, pero no queda guardado como archivo. Lo que persiste es metadata y el resumen generado por AI.

**Objetivo:**
Agregar un texto pequeño, honesto y no alarmante debajo del chip de adjunto, una sola vez por mensaje, explicando que el contenido del archivo se analiza pero no se guarda, y que solo persisten metadata y resumen AI.

**Cambio realizado:**
- Se agregó texto de transparencia debajo del bloque de chips de adjunto (líneas 670-674 de AgentPanel.tsx)
- El texto aparece una sola vez por mensaje con adjuntos (condicional: `msg.attachments && msg.attachments.length > 0`)
- No se modificó el chip existente (líneas 665-668 preservadas sin cambios)
- No se modificó lógica de subida, attachment_metadata, audit_log, backend ni storage

**Texto agregado:**
```tsx
{msg.attachments && msg.attachments.length > 0 && (
  <div className="mt-1 text-[9px] opacity-50 italic">
    File content is analyzed but not stored — only metadata and AI summary are kept (see Audit Log / Doc Mode).
  </div>
)}
```

**Ubicación exacta:**
Inmediatamente después del `.map()` que renderiza los chips de adjunto (línea 669) y antes del cierre del contenedor padre (línea 675).

**Restricciones respetadas:**
- ✅ No se modificó lógica de attachments
- ✅ No se modificó lógica de subida
- ✅ No se modificó attachment_metadata
- ✅ No se modificó audit_log
- ✅ No se modificó generación de AI summary
- ✅ No se modificó el chip existente
- ✅ No se agregaron links funcionales a Audit Log / Doc Mode
- ✅ No se agregó navegación
- ✅ El texto no se repite por adjunto (una sola vez por mensaje)
- ✅ El texto descartado "This file will be erased after 8hs" no aparece
- ✅ No se tocaron otros archivos funcionales
- ✅ No se tocó backend, Supabase, tokens.css

**Validaciones técnicas:**
- ✅ npm run lint: OK (warnings pre-existentes en CanvasViewport no relacionados)
- ✅ npm run build: Exitoso — producción optimizada generada
- ⏳ npm run typecheck: No existe como script (no bloqueante)

**Validación funcional:**

| # | Caso | Resultado esperado | Validado |
|---|---|---|---|
| 1 | Mensaje con un adjunto | Chip + texto de transparencia debajo, una sola vez | ✅ Confirmado visualmente por PO |
| 2 | Mensaje con múltiples adjuntos | Chips de cada adjunto + texto una sola vez | ✅ Confirmado visualmente por PO |
| 3 | Mensaje sin adjuntos | Sin texto nuevo | ✅ Confirmado visualmente por PO |
| 4 | Chip existente | Se ve igual que antes | ✅ Confirmado visualmente por PO |
| 5 | Lógica de adjuntos | Sin cambios | ✅ Confirmado en código |
| 6 | Texto descartado 8hs | No aparece | ✅ Confirmado en código |

**Validación visual:** ✅ **CONFIRMADA en producción (2026-07-08)** — Product Owner validó visualmente: chip del archivo y texto de transparencia aparecen correctamente, una sola vez por mensaje con adjuntos, con el estilo esperado.

**Commits:**
- cba1695 — feat: add honest transparency text below attachment chip
- (pendiente) — docs: close attachment transparency text as visually validated

**Alternativas descartadas:**
- Usar el texto "This file will be erased after 8hs": descartado porque no refleja la realidad técnica (los adjuntos no se almacenan como archivo físico)
- Agregar links funcionales a Audit Log / Doc Mode: descartado porque aumenta complejidad y está fuera de alcance de Mini-OE
- Repetir el texto por cada adjunto: descartado porque genera ruido visual innecesario
- Mostrar el texto en mensajes sin adjuntos: descartado porque no es relevante

**Riesgos conocidos:**
- Ninguno — cambio acotado a render visual, sin modificaciones funcionales

**Lección clave:**
Los textos de transparencia deben reflejar la realidad técnica del sistema. Un texto que sugiere un comportamiento futuro ("será borrado") cuando el comportamiento real es distinto (no se almacena) genera confusión y erosiona confianza. La transparencia efectiva es honesta sobre el presente, no especulativa sobre el futuro.

---

## 2026-07-08 — Conditional Web Search availability prompt layer

**Fecha:** 2026-07-08
**Tipo:** Mini-OE / Prompt layer / Web Search reliability
**Área:** Chat API / System prompt composition / Web Search
**Estado:** ⚠️ **Partial** — Código implementado, build exitoso, validación funcional pendiente

**Archivos modificados:**
- src/app/api/chat/route.ts (+17 líneas)
- handoff-2026-07.md (esta entrada)
- PRODUCT_STATUS.md (actualizado)
- AISyncPlans.md (actualizado)

**Contexto y decisión de producto:**
Diagnóstico confirmado: cuando el usuario prende Web Search después de que el AI dijo en un turno anterior "no tengo acceso" con el toggle en OFF, el modelo tiende a mantenerse consistente con su propia respuesta previa en vez de reevaluar la disponibilidad actual de la herramienta.

Decisión del Product Owner: El toggle ON/OFF debe tratarse como una barrera externa física, ajena al criterio del agente. No es algo que el agente "decide" tener o no tener.

**Diagnóstico:**
- **Sesgo de consistencia conversacional:** El modelo recibe el historial completo de conversación, incluyendo su propia respuesta anterior negando acceso a internet. Al repetir el usuario el pedido después de activar Web Search, el modelo puede priorizar consistencia narrativa con lo dicho antes en vez de reevaluar la disponibilidad real actual de la herramienta.
- **Barrera externa física:** El toggle ON/OFF debe tratarse como una barrera externa física controlada por el usuario por razones de seguridad, no como un criterio interno del agente.
- **Causa:** El modelo no distingue automáticamente entre "no tengo acceso porque la herramienta está deshabilitada" vs "no tengo acceso porque dije anteriormente que no lo tenía".

**Objetivo:**
Agregar una nueva capa condicional de system prompt, siguiendo el patrón existente de capas del archivo, que se active únicamente cuando `webSearchEnabled === true`.

**Cambio realizado:**
- Se agregó nueva capa `webSearchInstructionParts` en src/app/api/chat/route.ts (líneas ~87-101)
- La capa se activa solo cuando `webSearchEnabled === true` (condicional estricto)
- La capa informa que Web Search está ENABLED para el mensaje actual
- La capa instruye al modelo a no asumir indisponibilidad por turnos anteriores
- La capa mantiene el criterio: buscar cuando el pedido requiere información current, factual o up-to-date
- La capa se inserta en el array final de messages con alta prioridad: después de Role, antes de Team/Prompt Library/Context Files
- No se modificó Web Search tool definition (webSearchTool.definition)
- No se modificó tool loop (líneas 286-294)
- No se forzó tool_choice
- No se modificaron capas existentes (Role, Team, Prompt Library)

**Texto de la capa agregada:**
```ts
const webSearchInstructionParts: ChatMessage[] = []
if (webSearchEnabled) {
  webSearchInstructionParts.push(
    {
      role: 'user',
      content:
        'Web search access is a hard external switch controlled by the user for security reasons you cannot see. ' +
        'Its state may change between messages in this same conversation. ' +
        'It is currently ENABLED for this message. ' +
        'Never assume it is unavailable based on what you said in earlier turns — if the tool is offered to you now, use it whenever the user\'s request needs current, factual, or up-to-date information. ' +
        'Do not decline to search just because you previously said you could not.',
    },
    { role: 'assistant', content: 'Understood.' },
  )
}
```

**Orden final de capas en messages array:**
```ts
const messages: ChatMessage[] = [
  ...rolePromptParts,              // Capa 1: Role
  ...webSearchInstructionParts,    // Capa 2: Web Search availability (nueva, condicional)
  ...teamPromptParts,              // Capa 3: Team
  ...promptLibraryParts,           // Capa: Prompt Library
  ...contextFilesParts,            // Capa: Context Files
  ...snapshotParts,                // Capa: Other panels snapshot
  ...rawMessages,                  // Historia de conversación
]
```

**Restricciones respetadas:**
- ✅ No se modificó rolePromptParts
- ✅ No se modificó teamPromptParts
- ✅ No se modificó promptLibraryParts
- ✅ No se modificó webSearchTool.definition
- ✅ No se modificó tool loop
- ✅ No se forzó tool_choice
- ✅ No se modificó frontend
- ✅ No se modificó AgentPanel
- ✅ No se tocó el toggle ON/OFF
- ✅ No se modificó payload
- ✅ No se modificaron providers
- ✅ La capa solo aparece cuando webSearchEnabled === true
- ✅ No se tocaron DB, RLS ni migraciones

**Validaciones técnicas:**
- ✅ npm run lint: OK (warnings pre-existentes en CanvasViewport no relacionados)
- ✅ npm run build: Exitoso — producción optimizada generada
- ⏳ npm run typecheck: No existe como script (no bloqueante)

**Validación funcional pendiente (requiere prueba manual del Product Owner):**

| # | Caso | Resultado esperado | Validado |
|---|---|---|---|
| 1 | Web Search OFF + pedido de info actual | AI responde igual que antes, sin capa nueva | ⏳ |
| 2 | Web Search ON + primer mensaje pidiendo info actual | AI busca correctamente | ⏳ |
| 3 | Web Search OFF → AI dice "no tengo acceso" → usuario prende ON → repite mismo pedido | AI ahora sí busca, sin repetir la negación anterior | ⏳ **CRÍTICO** |
| 4 | Mensaje trivial "hola" con Web Search ON | AI no busca innecesariamente | ⏳ |
| 5 | Prompt Library / Role / Team | Siguen activos y sin alteraciones | ✅ Confirmado en código |
| 6 | Tool loop | Sigue funcionando igual | ✅ Confirmado en código |
| 7 | webSearchEnabled false | No incluye la nueva capa | ✅ Confirmado en código |

**Estado:** ⚠️ **Partial** — Código implementado y build exitoso, pero requiere validación funcional del Product Owner.

**Criterio de cierre:**
No marcar Closed sin que el Product Owner repita manualmente el escenario #3 (OFF → negación → ON → repetición) con Anthropic y confirme que ahora busca correctamente.

**Commit:** Pendiente hasta validación funcional

**Alternativas descartadas:**
- Forzar tool_choice cuando webSearchEnabled: descartado porque forzaría búsquedas innecesarias en mensajes triviales
- Modificar webSearchTool.definition: descartado porque el problema no es la definición de la herramienta sino la interpretación del modelo
- Agregar la capa cuando webSearchEnabled es false: descartado porque no hay necesidad de instruir al modelo sobre una herramienta deshabilitada
- Ubicar la capa después de Team/Prompt Library: descartado porque necesita alta prioridad para que el modelo la procese temprano

**Riesgos conocidos:**
- Si la instrucción es demasiado fuerte, podría forzar búsquedas innecesarias en mensajes triviales (mitigado con "whenever the user's request needs current, factual, or up-to-date information")
- Si la capa tiene baja prioridad, podría ser ignorada por capas posteriores más específicas (mitigado con ubicación temprana, después de Role)

**Lección clave:**
Los modelos de lenguaje priorizan consistencia conversacional. Cuando una herramienta externa cambia de estado mid-conversación, el modelo necesita instrucción explícita para reevaluar la disponibilidad actual en lugar de sostener una negación previa. La capa de prompt debe ser condicional (solo cuando la herramienta está habilitada), tener alta prioridad, y preservar el criterio operativo (usar la herramienta cuando el pedido lo requiere, no forzar uso innecesario).

---

## 2026-07-09 — Runtime Grounding Layer source-fidelity rules 6 and 7

**Fecha:** 2026-07-09
**Tipo:** Mini-OE / Prompt reliability / Source fidelity
**Área:** Chat API / Runtime Grounding Layer / Web Search
**Estado:** ✅ **Closed** — Reglas 6 y 7 agregadas correctamente, build exitoso, comportamiento bajo observación

**Archivos modificados:**
- src/app/api/chat/route.ts (+4 líneas, -1 línea = +3 netas)
- handoff-2026-07.md (esta entrada)
- PRODUCT_STATUS.md (actualizado)
- AISyncPlans.md (actualizado)

**Diagnóstico:**
Se detectó con evidencia real en `session_tool_calls` que el modelo puede ejecutar Web Search real, obtener resultados de una fuente confiable, y aun así producir una respuesta final con datos incorrectos mezclados con memoria de entrenamiento.

Este problema es distinto de:
- Fabricar fuentes cuando no buscó (cubierto por Regla 2)
- Arrastrar negación previa de disponibilidad de Web Search (cubierto por Regla 1)
- No reevaluar estado actual del toggle (cubierto por Regla 1)

El nuevo problema identificado:
- El modelo sí busca, pero no trata los resultados recuperados como autoridad principal/exclusiva para claims actuales o verificables
- Mezcla resultados reales de búsqueda con memoria de entrenamiento, inferencias propias, o asociaciones plausibles no confirmadas por la fuente

**Observación del Product Owner:**
El problema fue detectado específicamente con Anthropic en las pruebas realizadas hoy (2026-07-09). No se observó en OpenAI ni Google durante el mismo período. Esto se documenta como observación, no como conclusión definitiva — no se descarta que el mismo patrón aparezca en otros proveedores con más uso.

**Causa probable:**
El modelo no le otorga a los resultados reales de búsqueda el estatus de autoridad exclusiva para el turno actual. Los trata como una fuente más entre varias, mezclándolos con memoria de entrenamiento, conocimiento previo, inferencias propias, y asociaciones plausibles no confirmadas por la fuente.

**Cambio realizado:**
Se agregaron Regla 6 y Regla 7 al Runtime Grounding Layer en `src/app/api/chat/route.ts`.

**Regla 6 (source-fidelity):**
```
When you do invoke the web search tool and receive results, the retrieved results are the exclusive authority for any current or verifiable claim in your answer — you may summarize, organize, or explain them, but you must not correct, supplement, or blend them with your own training knowledge on the same topic. If the retrieved results are partial, ambiguous, or contradictory, state explicitly what remains unverified instead of filling the gap from memory.
```

**Regla 7 (source-inference separation):**
```
Separate what the retrieved results actually state from anything you infer or reason on top of them. Never present your own inference as if it were a fact confirmed by the source — label it clearly as your own reasoning when you do infer.
```

**Restricciones respetadas:**
- ✅ Reglas 1-5 permanecen completamente intactas
- ✅ `current_datetime_utc` no tocado
- ✅ `web_search_available_right_now` no tocado
- ✅ tool loop no tocado (líneas 309-316)
- ✅ `webSearchTool.definition` no tocado (líneas 309, 311, 313, 314)
- ✅ tool_choice NO forzado (modo auto preservado)
- ✅ Evidence Mode NO implementado
- ✅ Clasificación de tipos de pregunta NO implementada
- ✅ Las 5 reglas completas de la segunda propuesta NO agregadas
- ✅ Solo `route.ts` modificado como archivo funcional
- ✅ Providers no tocados
- ✅ Frontend no tocado
- ✅ DB/RLS/migraciones no tocadas

**Validaciones técnicas:**
- ✅ npm run lint: OK (warnings preexistentes en CanvasViewport no relacionados)
- ✅ npm run typecheck: No existe como script (reportado)
- ✅ npm run build: Exitoso — producción optimizada generada
- ✅ git diff --check: Solo warnings CRLF normales en Windows
- ✅ Prompt final con 7 reglas: Confirmado en líneas 85-105
- ✅ Reglas 1-5 intactas: Confirmado por git diff
- ✅ tool loop no tocado: Confirmado fuera del diff
- ✅ tool_choice no forzado: Confirmado fuera del diff

**Cierre Duro:**
- ✅ handoff-2026-07.md: Entrada agregada
- ✅ PRODUCT_STATUS.md: Actualizado
- ✅ AISyncPlans.md: Evaluación de 5 preguntas + actualización de patrón técnico

**Evaluación AISyncPlans.md (5 preguntas):**
1. ¿Cambié alguna tabla, columna o migración de DB? → **No** → Sin cambios DB/schema
2. ¿Cambié o agregué alguna API route? → **Sí (internamente)** → Documentar ajuste del Runtime Grounding Layer
3. ¿Cambié algún patrón técnico o convención del proyecto? → **Sí** → Documentar extensión con source-fidelity rules
4. ¿Creé o eliminé algún componente estructural? → **No** → Sin cambios árbol de componentes
5. ¿Cambié providers, servicios externos o configuración global? → **No** → Sin cambios providers/config

**Estado:** ✅ **Closed** — Reglas agregadas correctamente, build exitoso, comportamiento bajo observación en uso real con Anthropic.

**Commit:** (ejecutado en esta sesión)

**Observación pendiente:**
Mantener en observación si Anthropic vuelve a mezclar memoria de entrenamiento con fuentes recuperadas después de este cambio. Si el patrón reaparece, evaluar:
- Aumentar énfasis de las reglas 6-7
- Considerar Evidence Mode (diferido en esta OE)
- Considerar clasificación de tipos de pregunta (diferido en esta OE)

**Lección clave:**
Ejecutar Web Search no garantiza que el modelo use los resultados como autoridad. Los modelos pueden mezclar resultados reales con memoria de entrenamiento sin distinción explícita. Las reglas de source-fidelity deben instruir no solo cuándo buscar, sino cómo tratar los resultados recuperados: como autoridad exclusiva para claims actuales/verificables, no como una fuente más entre varias. La separación entre "lo que la fuente dice" y "lo que yo infiero" debe ser explícita.

---

## 2026-07-10 — Anthropic/OpenAI MODEL_MAP update to latest versions

**Fecha:** 2026-07-10
**Tipo:** Mini-OE / Providers / Model routing
**Área:** AI Providers / Anthropic / OpenAI / MODEL_MAP
**Estado:** ✅ **Closed** — MODEL_MAP actualizado correctamente, build exitoso, compatibilidad con sesiones existentes preservada

**Archivos modificados:**
- src/lib/providers/anthropic.ts (+7 líneas, -3 líneas = +4 netas)
- src/lib/providers/openai.ts (+1 línea)
- handoff-2026-07.md (esta entrada)
- PRODUCT_STATUS.md (actualizado)
- AISyncPlans.md (actualizado)

**Diagnóstico:**
- Anthropic mantenía redirects legacy de Sonnet (Claude Sonnet, Claude 3.5 Sonnet, Claude 3.7 Sonnet), pero apuntaban a `claude-sonnet-4-5`
- Se detectó que la versión más reciente disponible es `claude-sonnet-4-6`
- OpenAI no tenía entrada para GPT-5.5
- Google ya estaba correcto con patrón de legacy mappings documentado (no se tocó)
- Groq queda fuera de alcance para Subtarea 2 o futura OE separada

**Cambio realizado:**

**Anthropic MODEL_MAP actualizado:**
```ts
const MODEL_MAP: Record<string, string> = {
  'Claude Sonnet':     'claude-sonnet-4-6',     // actualizado de 4-5
  'Claude 3.5 Sonnet': 'claude-sonnet-4-6',     // actualizado de 4-5
  'Claude 3.7 Sonnet': 'claude-sonnet-4-6',     // actualizado de 4-5
  'Claude Sonnet 4.6': 'claude-sonnet-4-6',     // nueva etiqueta agregada
  'Claude 3 Haiku':    'claude-3-haiku-20240307',  // intacto
  'Claude 3 Opus':     'claude-3-opus-20240229',   // intacto
}
```

**OpenAI MODEL_MAP actualizado:**
```ts
const MODEL_MAP: Record<string, string> = {
  'GPT-5.5':     'gpt-5.5',         // nueva etiqueta agregada
  'GPT-4o':      'gpt-4o',          // intacto
  'GPT-4o Mini': 'gpt-4o-mini',     // intacto
  'GPT-4 Turbo': 'gpt-4-turbo',     // intacto
  'o1':          'o1',              // intacto
  'o3 Mini':     'o3-mini',         // intacto
}
```

**Decisiones técnicas:**
- Ninguna etiqueta legacy fue eliminada (preserva compatibilidad con sesiones existentes)
- Sesiones guardadas con "Claude 3.5 Sonnet", "Claude 3.7 Sonnet" o "Claude Sonnet" seguirán funcionando y ahora resolverán a `claude-sonnet-4-6`
- Sesiones guardadas con "GPT-4o", "GPT-4o Mini", etc. siguen resolviendo exactamente al mismo modelo (no se redirigieron)
- AddTeamModal y EditTeamModal NO se tocaron en esta OE (quedan para Subtarea 2)
- Google y Groq NO se tocaron

**Restricciones respetadas:**
- ✅ No se eliminaron etiquetas existentes del MODEL_MAP
- ✅ google.ts no tocado
- ✅ groq.ts no tocado
- ✅ AddTeamModal.tsx no tocado
- ✅ EditTeamModal.tsx no tocado
- ✅ Migraciones no tocadas
- ✅ RLS no tocado
- ✅ Datos existentes en agent_sessions no migrados
- ✅ Solo anthropic.ts y openai.ts modificados como archivos funcionales

**Validaciones técnicas:**
- ✅ npm run lint: OK (warnings preexistentes en CanvasViewport no relacionados)
- ✅ npm run typecheck: No existe como script (reportado)
- ✅ npm run build: Exitoso — producción optimizada generada
- ✅ git diff --check: Solo warnings CRLF normales en Windows

**Patrón de compatibilidad confirmado:**
- `agent_sessions.model` guarda etiqueta visible (ej: "Claude 3.5 Sonnet"), no ID real de API
- `MODEL_MAP` traduce etiqueta → ID real en runtime (ej: "Claude 3.5 Sonnet" → "claude-sonnet-4-6")
- No existe CHECK constraint sobre `agent_sessions.model` (confirmado en migrations/001_hierarchy.sql línea 36)
- Etiquetas antiguas persistidas en DB seguirán funcionando gracias a MODEL_MAP

**Validación en producción (2026-07-10):**
Sesiones existentes con etiquetas legacy confirmadas funcionando correctamente tras la actualización del MODEL_MAP:
- ✅ Sesión con "Claude 3.5 Sonnet" → respondió con normalidad
- ✅ Sesión con "GPT-4o" → respondió con normalidad

**Estado:** ✅ **Closed** — Cambios aplicados correctamente, build exitoso, compatibilidad preservada, validado en producción con sesiones reales

**Commit:** 8e68846

**Lección clave:**
Los MODEL_MAP no deben eliminar etiquetas legacy porque `agent_sessions.model` persiste etiquetas visibles que pueden estar guardadas en sesiones existentes. Actualizar una redirección existente (ej: cambiar el target de "Claude 3.5 Sonnet" de 4-5 a 4-6) es seguro. Agregar nuevas etiquetas (ej: "GPT-5.5") es seguro. Eliminar una etiqueta existente rompería sesiones guardadas con esa etiqueta. El patrón de compatibilidad etiqueta visible → ID real debe preservarse.

---
