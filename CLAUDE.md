# AISync MVP — Claude Code Reference

## RUTINA DURA — Actualización de handoff

Al cerrar cada OE, ANTES de confirmar que está cerrada,
Claude Code DEBE actualizar el archivo de handoff activo con:

1. Fecha y título de la OE
2. Archivos modificados
3. Decisión técnica tomada y por qué
4. Alternativas descartadas y por qué se descartaron
5. Riesgos conocidos o deuda técnica generada

**Archivo activo:** `handoff-2026-07-b.md` (desde 2026-07-12)
**Archivos anteriores:** 
- `handoff-archive-2026-07-a.md` (cerrado 2026-07-12, 168KB)
- `handoff-archive-2026-06.md` (cerrado 2026-06-30, 576KB, histórico)

**Regla de rotación:** Cuando el archivo activo alcance ~400KB, crear
archivo nuevo con sufijo secuencial (`handoff-YYYY-MM-c.md`, etc.), 
cerrar el anterior con nota de continuidad, y actualizar esta referencia en CLAUDE.md.

Sin esta actualización, la OE NO está cerrada.

Esta regla tiene prioridad sobre cualquier otra instrucción
de cierre. No hay excepciones.

---

## REGLA CRÍTICA — Demo first

Si una funcionalidad existe en C:\proyectos\AISync\MVP (la demo):
1. LEER el código de la demo primero
2. PORTAR directamente — no recrear, no "mejorar", no usar
   librerías alternativas
3. Solo después de que funcione igual que en la demo, se refina

Ignorar esta regla genera rework, errores ya resueltos y
costo innecesario de tokens. Esta regla no tiene excepciones.

## Proyecto
AISync es una control layer para trabajo asistido por IA.
Repo activo: AISync-MVP-CLAUDE
Stack: Next.js 14 + TypeScript + Tailwind + Supabase + Vercel
URL producción: https://ai-sync-mvp-claude.vercel.app

## Reglas de trabajo
- Explicar todo en español simple. El developer es non-programmer.
- Confirmar antes de cualquier cambio destructivo.
- Verificar entorno antes de cada tarea: pwd, git branch, git status.
- Mostrar resultado por bloque y esperar aprobación antes de continuar.
- No tocar AISYNC-DEMO-V2 ni AISYNC-DEMO-MVP bajo ninguna circunstancia.
- Un bloque a la vez. No avanzar sin aprobación explícita.
- **Reportes largos:** Enviar en secciones cortas pegadas directamente en
  el chat, NO en un solo bloque comprimido — Claude Chat no puede leer
  bloques colapsados.

## Arquitectura core
- 1 Account = 1 User = 1 Sovereign Cell
- Jerarquía: Account > Project > Team > Workspace > AI Agent Session
- SAT = todos los agentes del team usan el mismo provider
- MAT = agentes con providers distintos (calculado automáticamente)
- Documentation Mode: five views over the same documentary base
- audit_log sin FK formal a checkpoints — tradeoff temporal pendiente
  de definición arquitectural, no una decisión de diseño cerrada

## Providers de IA
- Arquitectura model-agnostic y extensible
- API keys por usuario en Supabase (tabla user_api_keys)
- AISync no paga el uso de IA de sus clientes
- Providers: Anthropic, OpenAI, Google Gemini, IA Local, Custom

## Capas de prompts
- Capa 1: System prompts de rol — definidos por AISync, intocables por usuario
- Capa 2: Prompts Library del usuario — templates de su industria

## Arquitectura de planos — Bloque 13

CONTROL PLANE (AISync):
accounts, projects, teams, workspaces, agent_sessions,
audit_log, user_api_keys, user_custom_providers, team_connections

CONTENT PLANE (cliente, migrable):
checkpoints, checkpoint_messages, messages

Regla: todo objeto de content plane debe diseñarse como migrable.
Nunca tratarlo como base canónica de AISync.
Referencia: src/lib/db/planes.ts

## Migraciones ejecutadas en Supabase
001_hierarchy, 002_messages, 003_checkpoints,
004_checkpoint_purpose, 005_teams_rls_update,
006_api_keys, 007_custom_providers, 008_team_connections,
009_documentation_metadata, 010_content_plane,
011_system_prompts, 011b_system_prompts_seed,
012_admin_roles, 013_handoff_packages, 014_log_layers

## Estado de bloques
Completados: 1 al 20 (Bloque 19 = Day Markers, Bloque 20 = Tres capas de log)
Fase 3 (UI/UX): post-albañilería
Referencia visual: aisync-demo-mvp.vercel.app

## Idioma
100% inglés en la interfaz del producto.
Comunicación con el developer: español simple.

## Ritual de apertura de sesión
1. pwd → confirmar que estás en aisync-mvp-claude
2. git remote -v → confirmar repo correcto
3. git branch --show-current → confirmar rama main
4. git status --short → ver cambios pendientes
5. git log --oneline -5 → ver últimos commits

## Referencia doctrinal
Ver DOCTRINE.md en la raíz del proyecto para definiciones
normativas de objetos canónicos, eventos, capas de log y
reglas de prevalencia. Ese documento tiene autoridad sobre
cualquier decisión de arquitectura del sistema documental.

## Prompt de Cierre

PROMPT DE CIERRE DURO OBLIGATORIO

Al finalizar cada OE, mini-OE o fix directo, ejecutar en orden:

1. Diagnóstico: pwd, git branch, git status, git diff --stat
2. Actualizar archivo de handoff activo (handoff-2026-07-b.md) — SIEMPRE
3. Actualizar PRODUCT_STATUS.md — SIEMPRE
4. Evaluar AISyncPlans.md — responder estas preguntas antes de seguir:
   - ¿Cambié alguna tabla, columna o migración de DB? → actualizar schema
   - ¿Cambié o agregué alguna API route? → actualizar API routes
   - ¿Cambié algún patrón técnico o convención del proyecto? → actualizar patrones
   - ¿Creé o eliminé algún componente estructural? → actualizar árbol de componentes
   - ¿Cambié providers, servicios externos o configuración global? → actualizar providers
   Si la respuesta a cualquiera es SÍ → actualizar AISyncPlans.md antes del commit.
   Si todas son NO → escribir explícitamente: "AISyncPlans.md: sin cambios — [motivo]"
5. Actualizar DECISIONS.md — si hubo decisión técnica nueva
6. Actualizar CodingWorkshop.md — si hubo bug o lección técnica
7. Actualizar AUDIT_REPORT.md — si hubo hallazgo de seguridad
8. npm run lint && npm run build
9. git diff --stat && git status --short
10. git add [archivos autorizados] && git commit -m "[mensaje]" && git push
11. Reporte final con todos los campos del formato estándar

Una OE no está cerrada hasta que el handoff activo y PRODUCT_STATUS.md están actualizados.
Sin excepción. Sin shortcuts.

## Regla de búsqueda exhaustiva pre-cierre

Antes de declarar cualquier fix como completo, ejecutar:

grep -rn "[patrón o constante relevante]" src/

Esto aplica especialmente a:
- Constantes de configuración (providers, modelos, listas de opciones)
- Nombres de modelos de IA (verificar que no haya hardcoded en múltiples archivos)
- Textos/copy que deban ser consistentes
- Lógica de validación o defaults

Si el grep devuelve más de 1 archivo relevante, TODOS deben ser corregidos 
antes de hacer build y commit. Un fix que corrige solo el primer archivo 
encontrado no está completo — es un fix parcial que generará el mismo bug 
en otro punto de la app.

No declarar "build exitoso, listo para commit" sin haber confirmado que 
no quedan ocurrencias sin corregir del problema reportado.

## Prompts operativos del Manager

Prompt 1 — Verificación visual sistemática
REGLA — Verificación visual obligatoria

Antes de aprobar cualquier tarea como completa y antes de pasar
a la siguiente, el Manager debe verificar visualmente el resultado
en el browser.

Mi rol: después de cada cambio funcional o visual, debo preguntar:
"¿Podés abrir [ruta] y mandarme un screenshot?"

No avanzo a la siguiente tarea hasta recibir confirmación visual.
Si no hay screenshot, el resultado no está aprobado.

Si el Manager pide avanzar sin verificar, debo recordar:
"Antes de seguir, ¿verificamos visualmente el resultado?"

Prompt 2 — Problema antes que solución
REGLA — Diagnóstico antes de solución

Cuando el Manager llegue con una solución ya definida sin haber
descrito el problema, debo señalarlo antes de proceder.

La frase exacta es:
"Antes de avanzar con esa solución, ¿podés describirme
el problema que querés resolver? Puede haber un camino mejor."

No es cuestionamiento — es disciplina operativa.
El orden correcto siempre es:
Problema → Diagnóstico → Solución

Si el problema ya está claro, ignoro esta regla y avanzo.

Prompt 3 — Límite de sesión y descanso
REGLA — Detección de fatiga cognitiva

Debo monitorear señales de pérdida de rendimiento durante la
sesión. Las señales incluyen:

- respuestas más cortas o imprecisas del Manager
- decisiones tomadas apresuradamente
- loops repetidos sobre el mismo problema
- errores de tipeo frecuentes
- tono de frustración sostenido
- sesión de más de 4 horas continuas

Cuando detecte 2 o más señales simultáneas, debo decir
exactamente esta frase:

"Noto una pérdida marcada en tus capacidades cognitivas.
Sugiero un break."

No continuar con tareas nuevas hasta que el Manager confirme
que quiere seguir.
