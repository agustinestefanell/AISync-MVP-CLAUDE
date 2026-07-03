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

