# Protocolo de Inicio de Proyecto — V2

*Infraestructura Documental Mínima para proyectos con Claude Code*

Desarrollado en el proyecto AISync MVP — Mayo 2026
**V2 actualizada en el proyecto Hitr.io — Septiembre 2026, a partir de la experiencia acumulada de uso real.**

**Estado del documento:** referencia viva. V2 reconcilia el protocolo original con las prácticas que ya se venían aplicando de hecho, y agrega 2 reglas nuevas aprobadas explícitamente.

---

# Propósito

Establecer desde el día 1 una base documental mínima para trabajar con Claude Code de forma eficiente, trazable y sin pérdida de contexto entre sesiones.

El objetivo no es documentar por burocracia. El objetivo es que cualquier Worker pueda entender el estado real del proyecto, ejecutar una OE con bajo riesgo y continuar el trabajo sin depender de conversaciones anteriores.

# Por qué funciona

Claude Code no tiene memoria entre sesiones. Los planos reemplazan esa memoria con contexto estructurado. El resultado:

- Menos tokens gastados en ramp-up
- Menos errores repetidos
- Más coherencia entre OEs
- Workers nuevos pueden entrar al proyecto sin reconstruir todo desde cero

---

# Archivos Obligatorios

Siete archivos viven en la raíz del repositorio desde el día 1. Son ciudadanos de primera clase — se versionan, se pushean y se mantienen con cada OE.

*(V2: eran 5 en la versión original. Se suma `AUDIT_REPORT.md` como obligatorio y `UncommittedWork.md` como nuevo. Ver nota de nomenclatura en la sección 3.)*

## 1. AISyncPlans.md — Planos técnicos del sistema

Contiene la arquitectura real del proyecto. Es la radiografía técnica, no un plan de deseos.

Debe contener:

- Stack tecnológico
- Estructura de carpetas
- Árbol de componentes
- Flujo de datos y estado
- DB schema y relaciones
- API routes
- Providers y servicios externos
- Patrones y convenciones del proyecto
- Zonas sensibles — lo que no se toca sin diagnóstico previo

Actualizar cuando:

- Cambia arquitectura, routing, DB, providers, estado global
- Se agregan o modifican patrones técnicos
- Se crean o eliminan componentes estructurales

No actualizar por: copy, estilos, UI superficial.

**Regla:** *Si un Worker nuevo puede entender cómo está construido el sistema leyendo solo este archivo, está bien escrito. Si solo entiende qué queremos construir, está mal escrito.*

## 2. CodingWorkshop.md — Registro de problemas técnicos resueltos

Contiene problemas técnicos no triviales ya resueltos. Es la memoria de aprendizaje técnico del proyecto.

Formato obligatorio de cada entrada:

```
## YYYY-MM-DD — Título breve del problema
- Problema:
- Causa raíz:
- Consecuencia:
- Proceso de solución:
- Solución final:
- Commit:
- Lección:
```

Registrar cuando se resuelve:

- Bug no trivial o error de integración
- Problema de build, routing o estado
- Error de DB, schema o providers
- Cualquier falla técnica que pueda repetirse

**Regla:** *Si el mismo problema apareció dos veces, faltó documentarlo o faltó documentarlo bien.*

> **Nota V2:** este es el archivo con mayor margen de mejora real detectado en la práctica. Un mismo patrón de causa raíz (funciones que ignoran el `error` de una respuesta de Supabase y devuelven éxito igual) generó más de un diagnóstico largo en la misma etapa del proyecto. Antes de cerrar cualquier OE que involucre un bug no trivial, verificar explícitamente si el patrón de causa raíz ya tiene una entrada acá — y si no la tiene, escribirla, sin excepción.

## 3. CLAUDE.md — Protocolo operativo vigente

*(V2 — nota de nomenclatura: el documento original nombraba este archivo `PromtsOperativos.md`. En la práctica del proyecto Hitr.io, este archivo se llama `CLAUDE.md`. Cumple exactamente la misma función descrita abajo — es una diferencia de nombre, no de propósito. Cada proyecto nuevo puede usar el nombre que prefiera; lo que importa es que exista uno solo, sin ambigüedad sobre cuál es el vigente.)*

Contiene los prompts completos que gobiernan el trabajo. Es el documento constitucional del proyecto.

Debe contener:

- Prompt completo de Claude Code como ejecutor de OEs
- Prompt completo de GPT OE Maker (u otro redactor externo) como redactor, si el proyecto usa uno
- Formato oficial de OE
- Reglas Demo First
- Rutas oficiales del proyecto
- Reglas de validación y cierre (ver **Rutina Dura**, sección nueva V2 más abajo)
- Criterios de actualización documental
- **[V2] La regla "Mostrar antes de ejecutar"** (ver sección nueva más abajo)

Actualizar solo cuando el Director Técnico aprueba una modificación del proceso operativo.

**Regla:** *La versión vigente del proceso es este archivo. No existen versiones oficiales en conversaciones anteriores.*

## 4. handoff.md — Historial operativo de OEs

*(V2 — regla de rotación agregada, ver más abajo.)*

Contiene el registro cronológico de cada OE ejecutada. Es la memoria operativa del proyecto.

Cada entrada debe incluir:

- Fecha y título de la OE
- Diagnóstico
- Archivos tocados
- Cambios realizados
- Resultado del build
- Commit hash
- Riesgos y pendientes
- Estado final: Closed / Partial / Deferred

Actualizar: siempre, al cerrar cada OE.

**Regla:** *Si no está en handoff.md, no forma parte de la memoria operativa del proyecto. handoff.md no reemplaza Git — explica qué pasó y por qué.*

### [V2 — NUEVO] Rotación del handoff

El handoff no es un archivo único que crece indefinidamente. Se rota **proactivamente**, antes de llegar a un límite duro de tamaño (referencia usada en Hitr.io: 400KB), para que siga siendo legible y rápido de leer completo al inicio de cada sesión.

- Al rotar: el archivo activo se cierra con una nota de cierre breve, se renombra con un sufijo identificable (fecha y/o letra secuencial — ej. `handoff-2026-07-c.md`), y se abre un archivo nuevo.
- El archivo nuevo debe indicar en su primera línea cuál es el handoff anterior, para que quien lo lea pueda ir hacia atrás si necesita contexto de más largo plazo.
- Nunca hay dos handoffs "activos" a la vez — el protocolo asume uno solo vigente, siempre.

## 5. PRODUCT_STATUS.md — Estado real de features

Contiene el estado actual de cada feature. Previene el autoengaño de marcar como cerrado lo que solo existe visualmente.

Cada entry debe incluir: área, feature, estado, evidencia, pendiente y última OE relacionada.

Estados permitidos:

| Estado | Significado |
|---|---|
| Closed | Funcional, persistente, validado con evidencia verificable |
| Partial | Existe parcialmente — falta completar |
| UI-only | Existe visualmente, no es funcional ni persistente |
| Deferred | Decidido conscientemente para después |
| Broken | Existe pero no funciona |
| Needs Review | Requiere decisión humana antes de avanzar |

**Regla:** *Ninguna feature pasa a Closed sin evidencia verificable (commit hash, ruta, evento, tabla, comportamiento verificado).*

## 6. AUDIT_REPORT.md — Hallazgos de seguridad y riesgo *(nuevo en V2, antes no formalizado)*

Contiene hallazgos de seguridad, riesgo técnico latente, o deuda que puede convertirse en incidente si no se atiende — cosas distintas de un bug funcional (eso va en `CodingWorkshop.md`) y distintas de una decisión de producto (eso va en `DECISIONS.md`).

Formato de cada entrada:

```
## [ID] — Título del hallazgo
- Severidad: (crítica / alta / media / baja)
- Estado: OPEN / CLOSED
- Descripción del riesgo:
- Superficie afectada:
- Fecha de detección:
- Fecha de cierre (si aplica):
- Commit/OE que lo cerró (si aplica):
```

Registrar cuando:

- Se detecta una vulnerabilidad, una policy de seguridad mal diseñada, un patrón de acceso a datos riesgoso, o cualquier hallazgo que "podría explotar en el futuro" aunque hoy no esté causando un síntoma visible.
- Se cierra un hallazgo ya registrado — nunca se borra la entrada, se actualiza su estado a `CLOSED` con la referencia de qué lo resolvió.

**Regla:** *Un hallazgo de seguridad detectado y no registrado acá es un hallazgo que se puede volver a "descubrir" desde cero dentro de meses, en otra sesión, perdiendo todo el trabajo de diagnóstico ya hecho.*

## 7. UncommittedWork.md — Rastreo de trabajo pendiente de decisión *(nuevo en V2)*

Contiene una lista viva de archivos o carpetas que existen en el working tree **sin commitear**, para que ninguna sesión nueva tenga que re-descubrir y re-preguntar qué es cada residuo que aparece en `git status`.

Formato: una tabla simple.

| Archivo/Carpeta | Status | Descripción | Fecha detectado |
|---|---|---|---|
| `ejemplo/carpeta-nueva/` | Sin commitear | Preview standalone, sin uso en producción | YYYY-MM-DD |

Reglas de uso:

- **No es un registro de todos los commits** (eso ya lo tiene Git, y el resumen narrativo vive en `handoff.md`). Es exclusivamente para lo que **todavía no se decidió** — commitear, descartar, o mover a una rama de borrador.
- Cuando algo de la tabla se resuelve (se commitea o se borra), **se saca de la tabla** — no se marca como "resuelto" y se deja ahí, porque el archivo dejaría de cumplir su función (una lista corta y accionable) y volvería a crecer sin límite.
- Al inicio de cada sesión, si el `git status` muestra algo que no está en esta tabla, se agrega antes de seguir con cualquier otra tarea.

**Regla:** *Un archivo sin commitear que lleva más de una sesión sin decisión tomada, y no está en esta tabla, es trabajo que la próxima sesión va a tener que re-diagnosticar desde cero.*

---

# Archivo Opcional — Proyectos Complejos

## 8. DECISIONS.md — Decisiones de producto y arquitectura

Contiene decisiones conceptuales importantes que generan confusión o debate entre sesiones. No es obligatorio para todos los proyectos, pero es muy útil para proyectos con IA, múltiples agentes o decisiones arquitectónicas recurrentes.

Formato:

```
## YYYY-MM-DD — Título de la decisión
- Decisión:
- Motivo:
- Alternativas descartadas:
- Consecuencia:
```

Usar en proyectos:

- Con múltiples stakeholders o roles
- Con IA multi-agente o arquitectura compleja
- Donde las decisiones de producto/arquitectura son recurrentes

**Regla:** *handoff.md registra ejecución. DECISIONS.md registra criterio. Son cosas distintas.*

---

# [V2 — NUEVO] Reglas No Negociables de Ejecución

Estas dos reglas no dependen de ningún archivo en particular — gobiernan el comportamiento de Claude Code en cualquier momento, y se agregan como sección propia porque su incumplimiento no se soluciona con "documentar mejor" sino con "no ejecutar sin este paso".

## Mostrar antes de ejecutar

**Ninguna migración de base de datos, ni ninguna escritura masiva sobre datos reales (UPDATE/DELETE que afecte más de una fila, o cualquier cambio sobre cuentas de usuarios reales), se ejecuta sin que Claude Code muestre primero el SQL/query exacto y reciba confirmación explícita del Director Técnico o el Product Owner — incluso si la OE que la origina ya fue aprobada.**

Esto aplica sin excepción, aunque:

- El diagnóstico que llevó a la solución esté completo y validado con evidencia.
- La OE original ya haya sido aprobada en su forma general.
- El cambio parezca de bajo riesgo.

La aprobación de una OE aprueba el **plan**. No aprueba, por sí sola, la ejecución de una escritura irreversible sobre datos de producción — eso requiere su propia confirmación, en el momento.

## Migraciones aplicadas siempre de forma manual

Las migraciones de base de datos las aplica siempre una persona humana, manualmente, desde el panel de administración de la base de datos (ej. Supabase Dashboard → SQL Editor) — nunca las ejecuta Claude Code de forma automática, ni siquiera cuando técnicamente tiene las credenciales para hacerlo. Esta regla ya se venía cumpliendo de hecho; V2 la deja escrita para que no dependa de que cada sesión nueva la "recuerde" por costumbre.

---

# Regla de Actualización por OE

No todos los archivos requieren actualización en cada OE. La regla es:

| Archivo | Cuándo actualizar |
|---|---|
| handoff.md | SIEMPRE — al cerrar cada OE |
| PRODUCT_STATUS.md | Siempre que la OE afecte una feature, estado o comportamiento de producto |
| AISyncPlans.md | Cuando cambia arquitectura, DB, routing, providers, estado global o patrón técnico |
| CodingWorkshop.md | Cuando se resuelve un problema técnico no trivial que puede repetirse |
| CLAUDE.md | Solo cuando cambia el proceso operativo |
| DECISIONS.md | Cuando se toma una decisión de producto o arquitectura relevante |
| AUDIT_REPORT.md *(V2)* | Cuando se detecta o se cierra un hallazgo de seguridad/riesgo |
| UncommittedWork.md *(V2)* | Cuando aparece WIP nuevo sin commitear, o cuando algo de la tabla se resuelve |

**Una OE no está cerrada hasta que los archivos documentales aplicables reflejan el estado real.**

Todo cambio documental se commitea y se pushea junto con la OE correspondiente.

---

# [V2 — actualizada] Rutina Dura — protocolo de cierre obligatorio de cada OE

Secuencia fija, en este orden:

1. Lint
2. Build
3. Actualizar `handoff.md`
4. Actualizar `PRODUCT_STATUS.md` (si corresponde)
5. Actualizar el resto de los archivos aplicables según la tabla de arriba
6. Commit — **solo los archivos relevantes a la OE**, excluyendo explícitamente residuos ajenos (ver `UncommittedWork.md`)
7. Push
8. Verificación visual por el Product Owner, en producción — no en localhost (ver nota técnica: el login no es confiable en localhost por configuración de dominio de retorno de OAuth; esta limitación es del entorno actual, se reevalúa si cambia).

**Una OE no se da por cerrada sin la confirmación del paso 8.**

---

# OE Inicial Obligatoria

La primera OE de todo proyecto nuevo es:

***"Crear infraestructura documental mínima"***

Claude Code debe:

- Leer el repositorio completo antes de escribir — no inventar arquitectura
- Crear los 7 archivos obligatorios en la raíz (5 originales + `AUDIT_REPORT.md` + `UncommittedWork.md`)
- `AISyncPlans.md` refleja el repo real — stack, carpetas, componentes, flujo
- `CodingWorkshop.md` inicia vacío con la estructura de entradas lista
- `CLAUDE.md` contiene los prompts aprobados por el Director Técnico
- `handoff.md` registra la entrada inicial del proyecto
- `PRODUCT_STATUS.md` refleja el estado inicial real de features
- `AUDIT_REPORT.md` inicia vacío con la estructura de entradas lista
- `UncommittedWork.md` inicia con el estado real de `git status` en ese momento, si hay algo sin commitear
- Commit + push al finalizar

Si el proyecto ya tiene código, Claude Code debe leer el repo antes de generar los planos. No debe inventar componentes, rutas, dependencias ni features que no existan en el código real.

---

# Criterios de Uso por Tipo de Proyecto

| Tipo de proyecto | Archivos obligatorios | Archivos opcionales |
|---|---|---|
| MVP / Startup / App con IA | Los 7 | DECISIONS.md |
| Proyecto pequeño / script / tool | handoff.md + PRODUCT_STATUS.md | AISyncPlans.md, UncommittedWork.md |
| Producto enterprise / multi-equipo | Los 7 | DECISIONS.md (obligatorio) |

---

# Nota de campo

*Este protocolo fue desarrollado y probado en el proyecto AISync MVP durante múltiples semanas de sesiones de desarrollo intensivas con Claude Code, y refinado en V2 a partir de la experiencia acumulada en el proyecto Hitr.io.*

El ahorro real de tokens viene de estas fuentes:

- `AISyncPlans.md` elimina las preguntas de contexto técnico al inicio de cada sesión.
- `CLAUDE.md` hace que el ejecutor sepa exactamente cómo comportarse sin instrucciones redundantes.
- `CodingWorkshop.md` evita debuggear problemas ya resueltos — **este es el archivo con más margen de mejora detectado en la práctica; usarlo con más disciplina es la mejora de mayor impacto disponible hoy.**
- `UncommittedWork.md` *(V2)* evita que cada sesión nueva vuelva a preguntar "¿esto qué es?" sobre el mismo WIP acumulado.
- `AUDIT_REPORT.md` *(V2)* evita que un hallazgo de seguridad ya diagnosticado tenga que redescubrirse desde cero meses después.

**La inversión de una sesión en documentación estructural se paga sola en pocas semanas.**

---

## Registro de cambios V1 → V2

| Cambio | Motivo |
|---|---|
| `AUDIT_REPORT.md` formalizado como archivo obligatorio | Ya se usaba de hecho (caso SEC-002); no estaba reconocido en el protocolo |
| `UncommittedWork.md` agregado | Resolver la fricción repetida de WIP sin commitear que reaparecía sin resolverse sesión tras sesión |
| Regla "Mostrar antes de ejecutar" agregada como sección propia | Ya se practicaba de hecho en cambios de alto riesgo; se formaliza para que no dependa de la memoria de cada sesión |
| Regla de rotación de `handoff.md` agregada | Ya se practicaba de hecho (handoffs con sufijo de fecha/letra); no estaba documentada |
| Nomenclatura `PromtsOperativos.md` → `CLAUDE.md` aclarada | El nombre real usado en el proyecto difería del protocolo original; se documenta la equivalencia |
| Regla de branching ("rama separada, nunca sobre main") | **Evaluada y descartada por ahora** — no se incorpora a V2. Si en el futuro se retoma trabajo de alto riesgo estructural (ej. vía una software factory externa), se evaluará agregar una sección específica en ese momento, no antes |
| Limitación de verificación visual sin acceso a browser | **Evaluada y descartada** — es una limitación temporal del entorno actual, no una regla estructural del proyecto; no se codifica en el protocolo |
