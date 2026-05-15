# AISync — Operational Elasticity

## Qué es

Organizational Elasticity es la capacidad del sistema de
crecer, subdividirse y ganar capas de coordinación sin
perder orden, trazabilidad ni dirección humana.

Por eso Teams Map lleva el subtítulo "Operational Elasticity View".
No es decorativo: expresa la capacidad estructural del sistema.

## Estructura base

El punto de partida es siempre:

AI General Manager
  ├── Worker 1
  └── Worker 2

Manager ordena, divide, sintetiza y mantiene coherencia global.
Worker ejecuta tareas específicas en profundidad.
Esta separación es parte de la disciplina operativa del sistema.

## Promote Agent

Cuando un Worker acumula demasiada carga táctica, puede ser
promovido. Eso no es solo cambiarle el nombre: el Worker deja
de funcionar como ejecutor aislado y pasa a encabezar una nueva
unidad operativa como Senior Manager.

Resultado de la promoción:

AI General Manager
  ├── Worker 1 (sigue como worker)
  └── Senior Manager (era Worker 2, fue promovido)
        ├── Worker 1 del nuevo team
        └── Worker 2 del nuevo team

## SAT vs MAT post-promoción

SAT — Single Agent Team:
- Un solo agente backend con tres superficies visibles
- Senior Manager + Worker 1 + Worker 2
- Sirve para: continuidad, velocidad, bajo ruido, contexto compacto

MAT — Multiple Agent Team:
- Estructura verdaderamente multiagente
- Mayor contraste cognitivo, más profundidad
- Sirve para: investigación, auditoría, trabajo complejo

## Reglas del Senior Manager

- Coordina complejidad intermedia de su frente
- No redefine estrategia global
- No invade el rol del Manager superior
- El Manager original sigue arriba con visión global

## Trazabilidad en el repositorio al promover

Cuando un Worker es promovido a Senior Manager, el repositorio
documental preserva la trazabilidad completa:

- La carpeta del antiguo Worker NO se borra ni se pisa.
  Queda archivada como huella histórica de su etapa anterior.
  El sistema puede reconstruir qué hizo ese agente como Worker
  y desde cuándo pasó a ser Senior Manager.

- Al ser promovido, nace una nueva carpeta propia del SM.
  Esa carpeta representa su nuevo rol operativo y frente de
  coordinación.

- Debajo de esa nueva carpeta se ordena el nuevo subequipo
  (SAT o MAT).

La lógica es sumar una nueva rama, no reescribir destructivamente
la anterior:
  - carpeta vieja = pasado trazable (archivada)
  - nueva carpeta SM = presente operativo

Esto permite reconstruir con claridad:
  - qué hizo ese agente como Worker
  - desde cuándo pasó a ser Senior Manager
  - qué trabajo quedó bajo su nueva unidad

## Cómo se refleja en la base de datos

La jerarquía de agentes se deriva de la jerarquía de teams:

- Root team → Workspace → agent_sessions:
  Manager (= GM), Worker1, Worker2

- Child team (teams.parent_id → root) → Workspace → agent_sessions:
  Manager (= SM), Worker1, Worker2

- La profundidad puede crecer: child de child = SM de SM, etc.

## Cómo se refleja en el Teams Map

Nodos = agent_sessions individuales (no teams)
Tipos de nodo: general_manager / senior_manager / worker
Jerarquía: derivada de teams.parent_id + agent_sessions.role
Color: por equipo (paleta rotativa), no por rol

El Teams Map no muestra teams — muestra agentes organizados
según la estructura elástica del sistema.
