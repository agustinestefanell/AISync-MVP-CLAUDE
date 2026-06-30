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
