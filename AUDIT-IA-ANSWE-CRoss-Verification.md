# AISync — Doctrina operativa de `AUDIT AI ANSWER` y `Cross Verification`

## 0. Propósito del documento

Este documento fija la definición doctrinal, funcional y operativa de `AUDIT AI ANSWER` y `Cross Verification` dentro de AISync.

Su objetivo es cerrar con precisión:

- qué es `AUDIT AI ANSWER`
- qué es `Cross Verification`
- cómo se relacionan entre sí
- cuál es el rol del `Sub-Manager`
- cuál es el rol de los `Workers`
- qué parte del flujo es automática
- qué parte sigue bajo control humano
- cómo se integra este módulo al resto del sistema sin contaminar la lógica general de AISync

Este documento no describe una idea abierta.  
Describe una **función especializada del sistema** que debe quedar semánticamente congelada.

---

## 1. Decisión marco

`AUDIT AI ANSWER` y `Cross Verification` no son lo mismo.

La relación correcta es esta:

- **`AUDIT AI ANSWER`** = acción visible que dispara el flujo
- **`Cross Verification`** = workspace especializado donde ocurre el contraste comparativo multiworker

Dicho simple:

**`AUDIT AI ANSWER` es el gatillo. `Cross Verification` es la sala de trabajo.**

---

## 2. Naturaleza del módulo

`Cross Verification` es un **workspace real** de AISync.  
No es un wizard.  
No es un inbox paralelo.  
No es una capa decorativa de revisión.

Su función es abrir una superficie especializada donde una respuesta puede ser contrastada por más de un worker antes de ser adoptada o reenviada.

---

## 3. Excepción institucional

`Cross Verification Workspace` es la **única parte de AISync donde los Workers funcionan de forma automatizada**.

Esta excepción debe quedar escrita de forma explícita.

### Regla general de AISync
En AISync, los Workers no operan como automatismos invisibles.  
Normalmente son agentes de ejecución dentro de una estructura dirigida por humano, Manager y, cuando existe, Sub-Manager.

### Excepción única
En `Cross Verification`, los Workers **no reciben instrucciones directas del usuario**, no se usan como chats separados y no se comportan como interfaces autónomas. Ahí funcionan como **motores automáticos de contraste** bajo la orquestación del `Sub-Manager`.

Esta excepción no rompe la doctrina general porque:

- el usuario sigue siendo la autoridad máxima
- el `Sub-Manager` sigue siendo la superficie principal
- el flujo sigue siendo visible
- el contraste no ocurre en silencio opaco
- el resultado sigue bajo control humano antes de consolidarse o avanzar

---

## 4. Estructura correcta del workspace

Dentro de `Cross Verification Workspace`, la estructura funcional correcta es esta:

### 4.1 Superficie principal
La única interfaz humana real es el **Sub-Manager de Cross Verification**.

El usuario escribe ahí.  
El usuario lee ahí.  
El usuario interpreta ahí.  
El usuario decide desde ahí.

### 4.2 Workers
Los Workers existen dentro del módulo, pero **no como agentes conversacionales accesibles**.

No deben tener:
- caja de input propia
- comando directo del usuario
- conversación libre separada
- rol de chat independiente dentro de este workspace

Su función es:
- recibir la misma entrada enviada por el `Sub-Manager`
- responder automáticamente
- devolver su salida al `Sub-Manager`
- servir como base del contraste

### 4.3 Botón visible
Dentro de este workspace, el botón correcto no es `Send`.

El botón visible es:

**`AUDIT`**

Eso deja claro que aquí no se está “hablando normalmente con un agente”, sino activando una auditoría comparativa especializada.

---

## 5. Flujo operativo correcto

El flujo de `Cross Verification` debe quedar congelado así:

### Paso 1
El usuario activa `AUDIT AI ANSWER` desde el workspace de origen.

### Paso 2
Se abre `Cross Verification` en **nueva ventana**.  
La ventana de origen permanece en su workspace original.

### Paso 3
El usuario interactúa solo con el `Sub-Manager` de `Cross Verification`.

### Paso 4
El usuario introduce la pregunta, contenido o respuesta a auditar.

### Paso 5
En lugar de `Send`, el usuario activa **`AUDIT`**.

### Paso 6
El `Sub-Manager` despacha automáticamente **la misma entrada** a ambos Workers.

### Paso 7
Ambos Workers responden automáticamente.

### Paso 8
Ambas respuestas vuelven al `Sub-Manager`.

### Paso 9
El `Sub-Manager` realiza automáticamente el contraste entre ambas respuestas.

Ese contraste debe producir, como mínimo:
- similitudes
- diferencias
- tensiones o contradicciones
- lectura comparativa general

### Paso 10
Desde ese punto, el usuario debe poder:

- leer ambas respuestas de los Workers
- leer la auditoría y síntesis comparativa producida por el `Sub-Manager`
- elegir una de las respuestas de los Workers como respuesta válida
- usar el botón visible **`CHOOSE THIS ANSWER`**, que aparece asociado a la respuesta elegible, como en la demo

Una vez elegida una respuesta mediante `CHOOSE THIS ANSWER`, esa salida puede seguir dos caminos válidos:

- **salir directamente al chat real de destino desde el Worker que posee la respuesta elegida**, o
- **quedar primero en el `Sub-Manager` de Cross Verification para iteración adicional**, y luego pasar al chat real de destino

### Nota
Esta doble salida es parte correcta del módulo y debe quedar reconocida como tal.

---

## 6. Función del Sub-Manager

El `Sub-Manager` de `Cross Verification` no es un simple visor.

Su función es:

- recibir el input del usuario
- disparar el contraste
- centralizar ambas respuestas
- compararlas
- sintetizar sus similitudes y diferencias
- actuar como superficie intermedia antes del eventual envío al destino

Dicho simple:

**el `Sub-Manager` es el operador lógico del contraste.**

No es un tercer worker más.  
No es un buzón.  
No es un adorno de UI.

Es la cabeza operativa del módulo.

---

## 7. Naturaleza del análisis

El análisis comparativo del `Sub-Manager` es **automático**.

Eso debe quedar definido sin ambigüedad.

El usuario no tiene que:
- copiar ambas respuestas a mano
- pedirle al `Sub-Manager` que las compare manualmente
- reconstruir por sí mismo la diferencia entre salidas

La comparación debe formar parte nativa del flujo.  
Ese es justamente el valor del módulo.

---

## 8. Rol del usuario

Aunque el contraste y el análisis sean automáticos, el principio de **human-in-the-loop** sigue vigente.

El usuario conserva:
- la decisión de auditar o no
- la lectura del contraste
- la lectura de ambas respuestas de los Workers
- la decisión de qué salida adopta
- la decisión de si quiere iterar más en el `Sub-Manager`
- la decisión de qué termina yendo al chat real de destino

Por lo tanto, `Cross Verification` no sustituye criterio humano.  
Lo fortalece.

---

## 9. Qué no debe ser este módulo

`Cross Verification` no debe interpretarse como ninguna de estas cosas:

- un handoff pesado
- una bandeja paralela
- una mensajería entre agentes
- un espacio donde el usuario conversa libremente con varios workers
- una simulación visual de “debate” sin valor operativo
- una auditoría forense documental
- una vista de Documentation Mode

Tampoco debe reintroducir:
- inbox separado
- routing ambiguo
- múltiples superficies principales
- navegación que saque a la ventana origen de su lugar

---

## 10. Relación con el workspace de origen

`Cross Verification` no reemplaza el workspace donde nació la respuesta.

La relación correcta es:

- el workspace de origen sigue existiendo
- la auditoría ocurre aparte
- el contraste no destruye el hilo original
- la salida validada puede volver al destino real correspondiente

Esto preserva continuidad y evita que la auditoría “secuestre” el flujo principal de trabajo.

---

## 11. Relación con `Review & Forward`

`Cross Verification` no debe confundirse con `Review & Forward`.

### `Review & Forward`
Es una acción controlada de revisión y reenvío dentro del flujo operativo general del sistema.

### `Cross Verification`
Es un workspace especializado de contraste comparativo multiworker.

La relación correcta es:

- `Review & Forward` mueve contenido bajo revisión humana
- `Cross Verification` somete una respuesta a contraste comparativo antes de consolidarla o reenviarla

Uno no reemplaza al otro.

---

## 12. Relación con Audit Log y Documentation Mode

`Cross Verification` no es `Audit Log` ni `Documentation Mode`.

### Audit Log
Responde:
**qué pasó y desde dónde puede retomarse**

### Documentation Mode
Responde:
**qué existe y cómo se consulta**

### Cross Verification
Responde:
**cómo se contrasta una respuesta antes de adoptarla o enviarla adelante**

Dicho simple:
- `Audit Log` = memoria cronológica
- `Documentation Mode` = capa documental
- `Cross Verification` = auditoría comparativa operativa

---

## 13. Naming visible y naming conceptual

### Nombre visible del botón
**`AUDIT AI ANSWER`**

### Nombre visible del workspace
**`Cross Verification`**

### Nombre visible de la acción dentro del workspace
**`AUDIT`**

### Acción visible de elección de respuesta
**`CHOOSE THIS ANSWER`**

### Definición funcional integrada
`AUDIT AI ANSWER` abre `Cross Verification`, donde el `Sub-Manager` audita comparativamente una respuesta usando dos Workers automatizados, produce un análisis de similitudes y diferencias, permite al usuario leer ambas respuestas, elegir una con `CHOOSE THIS ANSWER`, e iterarla o enviarla al destino correspondiente.

---

## 14. Regla de implementación semántica

Toda implementación de este módulo debe respetar estas reglas:

1. una sola superficie principal humana: el `Sub-Manager`
2. Workers automatizados y sin input manual
3. botón `AUDIT` en lugar de `Send`
4. misma entrada para ambos Workers
5. comparación automática obligatoria
6. síntesis automática del `Sub-Manager`
7. posibilidad de lectura directa de ambas respuestas por parte del usuario
8. acción visible `CHOOSE THIS ANSWER` asociada a la respuesta elegible
9. sin inbox paralelo
10. sin navegación destructiva de la ventana origen
11. salida posible al chat real de destino desde la respuesta elegida
12. salida posible a iteración previa en el `Sub-Manager` antes de pasar al destino

---

## 15. Fórmula doctrinal final

**`Cross Verification` es el único workspace de AISync donde los Workers están automatizados. El usuario no conversa con ellos; conversa solo con el `Sub-Manager`. La acción visible es `AUDIT`, no `Send`. El `Sub-Manager` envía la misma entrada a ambos Workers, recibe ambas respuestas, las contrasta automáticamente y produce una síntesis de similitudes y diferencias. El usuario puede leer ambas respuestas, revisar la auditoría del `Sub-Manager`, elegir una mediante `CHOOSE THIS ANSWER`, y desde ahí enviarla directamente al chat real de destino o mantenerla primero en el `Sub-Manager` para iteración adicional antes del envío.**
