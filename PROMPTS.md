# PROMPTS — Biblioteca reusable

Prompts probados y refinados en producción. Copiá y adaptá para otros proyectos.

---

## Categoría: Diagnóstico

### Diagnóstico previo sin tocar código

```
PROBLEMA DETECTADO: [descripción del bug/issue]

DIAGNÓSTICO REQUERIDO — No tocar código todavía:

1. Identificá la causa raíz del problema
2. Verificá:
   - ¿Dónde está el código responsable?
   - ¿Hay múltiples archivos afectados?
   - ¿Hay estado/cache que no se invalida?
   - ¿Hay conflictos de z-index/estilos/lógica?
3. Revisá el flujo completo:
   - Handler/callback que ejecuta la acción
   - Propagación de datos (props, estado, contexto)
   - Actualización de UI (re-render, refresh, invalidación)
4. Identificá dependencias:
   - Componentes padres/hijos involucrados
   - Fuentes de datos (API, estado local, server components)
   - Efectos secundarios esperados

REPORTÁ EL DIAGNÓSTICO COMPLETO antes de proponer el fix.
Incluí:
- Causa raíz identificada
- Archivos y líneas específicas involucradas
- Por qué el comportamiento actual falla
- Qué debe cambiar para corregirlo
```

---

## Categoría: Validación pre-cierre

### Regla de búsqueda exhaustiva pre-cierre

```
Antes de declarar cualquier fix como completo, ejecutar búsqueda exhaustiva:

grep -rn "[patrón o constante relevante]" src/

Aplica especialmente a:
- Constantes de configuración (providers, modelos, listas de opciones)
- Nombres de modelos/APIs (verificar que no haya hardcoded en múltiples archivos)
- Textos/copy que deban ser consistentes
- Lógica de validación o defaults
- Parámetros de comportamiento duplicados

REGLA CRÍTICA:
Si el grep devuelve más de 1 archivo relevante, TODOS deben ser corregidos 
antes de hacer build y commit.

Un fix que corrige solo el primer archivo encontrado NO está completo — 
es un fix parcial que generará el mismo bug en otro punto de la app.

CHECKLIST PRE-COMMIT:
□ grep ejecutado con patrón relevante
□ Todas las ocurrencias identificadas
□ Todas las ocurrencias corregidas (no solo la primera)
□ Build exitoso
□ Verificación manual si es UI/UX

No declarar "listo para commit" sin confirmar que no quedan ocurrencias 
sin corregir del problema reportado.
```

---

## Categoría: Cierre de sesión

### Reporte final de OE/Tarea

```
Al finalizar una OE (Orden Ejecutiva), tarea compleja o fix multi-archivo, 
generar reporte estructurado:

---

## REPORTE FINAL — [Título de la OE/Tarea]

### 1. Cambio realizado
[Descripción concisa del problema resuelto y la solución aplicada]

### 2. Archivos modificados
- archivo/path.tsx (líneas X-Y: descripción)
- archivo/path2.ts (líneas A-B: descripción)
- docs/handoff.md (entrada agregada)

### 3. Alcance técnico
- Qué se cambió: [frontend/backend/DB/config]
- Qué NO se tocó: [lista de restricciones respetadas]
- Componentes/módulos afectados: [lista]

### 4. Decisiones técnicas
- Decisión: [qué se decidió]
- Por qué: [razón técnica/de negocio]
- Alternativas descartadas: [qué NO se hizo y por qué]

### 5. Validaciones ejecutadas
- lint: [✅/❌ + detalles]
- typecheck: [✅/❌ + detalles]
- build: [✅/❌ + detalles]
- tests: [✅/❌/N/A + detalles]
- verificación manual: [qué se probó]

### 6. Riesgos y deuda técnica
- Riesgos conocidos: [lista o "Ninguno"]
- Deuda técnica generada: [lista o "Ninguna"]
- Migraciones/pasos manuales pendientes: [lista o "Ninguno"]

### 7. Documentación actualizada
- [✅/❌] handoff.md / CHANGELOG
- [✅/❌] README / docs técnicos
- [✅/❌] Comentarios en código (si aplica)

### 8. Commits
- Commits generados: [lista de hashes con mensajes]
- Branch: [nombre]
- PR: [URL o N/A]

### 9. Estado final
[✅ COMPLETADA / ⚠️ PARCIAL / ❌ BLOQUEADA]

[Descripción de 1-2 líneas del estado y próximos pasos si aplica]

---
```

---

## Categoría: Flujo de trabajo

### Commit y push automático post-build

```
Al finalizar cada tarea completada:

1. Verificar estado:
   git status --short
   git diff --stat

2. Build de validación:
   npm run lint
   npm run build
   # (o el comando de build que use tu stack)

3. Si build exitoso, commit automático:
   git add [archivos relevantes]
   git commit -m "[tipo]: [mensaje descriptivo]"
   git push

Tipos de commit:
- feat: nueva funcionalidad
- fix: corrección de bug
- docs: solo documentación
- style: formato, sin cambios de lógica
- refactor: reestructura sin cambio de comportamiento
- test: agregar/corregir tests
- chore: cambios de build, deps, config

NO preguntar "¿hago commit?" — hacerlo automáticamente tras build exitoso, 
salvo que la tarea explícitamente requiera aprobación previa.
```

---

## Categoría: Gestión de errores

### Debug de error sin contexto suficiente

```
SÍNTOMA: [descripción del error tal como lo reporta el usuario]

PROCEDIMIENTO DE DEBUG SISTEMÁTICO:

1. REPRODUCCIÓN:
   - ¿En qué pantalla/flujo ocurre?
   - ¿Pasos exactos para reproducir?
   - ¿Ocurre siempre o intermitente?

2. INSPECCIÓN DE LOGS:
   - Consola del navegador (si es frontend)
   - Logs del servidor (si es backend)
   - Network tab (si es API call)

3. ANÁLISIS DE CÓDIGO:
   grep -rn "[mensaje de error]" src/
   - Buscar el mensaje de error en el código
   - Identificar el archivo y línea exacta
   - Leer contexto (10-20 líneas arriba/abajo)

4. TRAZADO DE FLUJO:
   - ¿Qué función/handler se llama?
   - ¿Qué validaciones existen?
   - ¿Qué condiciones causan el error?
   - ¿Hay try/catch que ocultan el error real?

5. HIPÓTESIS:
   - Causa más probable: [...]
   - Causas alternativas: [...]
   - Cómo verificar cada hipótesis: [...]

6. PLAN DE FIX:
   [Solo después de identificar causa raíz con certeza]

IMPORTANTE: No hacer cambios especulativos. 
Primero entender, después corregir.
```

---

## Notas de uso

- Estos prompts son **plantillas**, no scripts rígidos
- Adaptá el lenguaje y nivel de detalle según el contexto
- Combiná múltiples prompts si la tarea lo requiere
- Mantené este archivo actualizado con nuevos patrones que funcionen

