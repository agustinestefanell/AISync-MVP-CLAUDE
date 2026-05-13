# AISync — Audit Log y Documentation Mode

*Informe maestro para ejecución, criterio de decisión y evolución futura*

Versión: 1.0  
Fecha: 12/05/2026  
Estado: documento de referencia operativa

Propósito del documento. Dar al equipo de ejecución un marco completo para implementar la nueva versión de Audit Log y Documentation Mode entendiendo de dónde se partió, qué hallazgos externos sostienen las decisiones, cuáles son las conclusiones críticas y cómo debe quedar la versión final. El documento también sirve como base de consulta para futuras mejoras.

Contenido

- Capítulo 0 — Resumen ejecutivo operativo

- Capítulo 1 — De dónde partimos

- Capítulo 2 — Hallazgos de la investigación

- Capítulo 3 — Conclusiones

- Capítulo 4 — AISync Audit Log y Documentation Mode — Versión final

- Anexo A — Matriz canónica de implementación

- Anexo B — Glosario y reglas de prevalencia

- Fuentes y referencias

# Capítulo 0 — Resumen ejecutivo operativo

AISync ya había consolidado dos decisiones correctas antes de esta investigación: (1) Audit Log y Documentation Mode cumplen funciones distintas y complementarias; (2) metadata estructural debe ser la fuente de verdad y las tags una capa secundaria de acceso y operación.

La investigación externa no cambia esa dirección. La refuerza. Lo que sí hace es obligar a cerrar mejor varias capas que todavía estaban mezcladas: evento, objeto, backup técnico, ayudas de acceso, almacenamiento canónico y proveniencia.

Decisión central. A partir de este documento, la recomendación operativa es la siguiente:

- Audit Log se mantiene separado de Documentation Mode.

- Audit Log sigue respondiendo: qué pasó, cuándo pasó y desde dónde puede retomarse.

- Documentation Mode sigue respondiendo: qué existe, cómo está organizado y cómo se consulta.

- El almacenamiento canónico de objetos no debe depender del gusto del usuario.

- Los saves personales pueden generar copias de acceso donde el usuario quiera, pero el original canónico debe quedar donde AISync lo necesita.

- Debe existir una capa propia de ayudas de acceso (finding aids), separada de objetos documentales y de eventos operativos.

- Debe separarse el log operativo visible del log técnico/sistémico y del registro preservacional/provenancial.

- Checkpoint debe quedar congelado como ancla cognitiva nombrada, navegable y reanudable, con contrato fuerte.

- Saved Selection debe existir como objeto único, pero con doble representación: legible para humanos y estructurada para el sistema.

- Session Backup visible y Technical Backup invisible no deben confundirse nunca.

No romper. Qué no debe romperse:

- La secuencia Teams Map → Audit Log → Main Workspace.

- La secuencia Save Version → Audit Log → Saved Chat Detail → View History → Resume Work.

- La separación doctrinal: Audit Log = qué pasó; Documentation Mode = qué existe y cómo se consulta.

- La regla metadata estructural = source of truth; tags = capa secundaria.

- La condición de que Documentation Mode opere como múltiples vistas sobre una sola base documental.

Cambio estructural relevante. Qué cambia de manera estructural:

- Se redefine con más precisión la diferencia entre Chat, Checkpoint, Saved Selection, Session Backup, Handoff Package, Source Document Reference y Derived Document.

- Se introduce la distinción entre original canónico y copia de acceso del usuario.

- Se reconoce una nueva clase funcional: ayudas de acceso (finding aids).

- Se formaliza la necesidad de una capa más rigurosa de proveniencia y de integridad.

# Capítulo 1 — De dónde partimos

## 1.1 Identidad funcional de AISync

AISync no venía siendo pensado como un chat suelto ni como un PM tool con IA, sino como una combinación de multichat operativo y capa de control operativo. El multichat produce trabajo vivo. La capa de control lo ordena, lo preserva y lo vuelve recuperable, trazable y gobernable.

Dentro de esa lógica, la secuencia general ya aprobada era: Teams Map → Audit Log → Main Workspace. Es decir: primero orientación estructural, luego memoria y trazabilidad, después trabajo vivo.

## 1.2 Punto de partida de Audit Log

Audit Log ya había quedado definido como la puerta de entrada operativa a la trazabilidad y a la memoria de trabajo. No debía ser un repositorio documental, ni un log técnico, ni un calendario vacío. Su pregunta central era: qué pasó, cuándo pasó y desde dónde puede retomarse.

- Debía mantener el calendario mensual como vista principal.

- Debía mostrar eventos operativos comprensibles para un usuario normal.

- Debía permitir localizar checkpoints, abrir su detalle y volver a un punto anterior del trabajo.

- No debía convertirse en Documentation Mode disfrazado.

## 1.3 Punto de partida de Documentation Mode

Documentation Mode ya había quedado definido como el módulo documental serio del sistema. Su pregunta central era: qué existe y cómo se consulta. No debía ser un explorador de carpetas simple, ni un visor vistoso sin utilidad operativa.

- Una sola base documental.

- Múltiples vistas sobre esa misma base.

- Repository View como vista operativa principal.

- Structure View, Audit View, Investigate View y Knowledge Map como vistas complementarias.

- Metadata estructural como source of truth.

- Tags como capa secundaria.

- Regla MVP: no guardar menos verdad; mostrar menos potencia.

## 1.4 Punto de partida sobre saves, metadata y trazabilidad

Antes de la investigación ya estaban planteadas varias decisiones correctas: AISync no guarda cosas en abstracto; guarda objetos operativos trazables. La taxonomía base ya incluía Session Backup, Checkpoint, Saved Selection, Handoff Package, Source Document Reference, Derived Document y Activity/Lifecycle Event.

También estaba bastante avanzado el criterio de persistencia documental legible en archivo y metadata estructural separada, con la orientación .md + .meta.json y una organización por proyecto, tipo de objeto y mirror de teams.

## 1.5 Problemas no resueltos con suficiente precisión

Lo que seguía abierto no era la dirección general, sino la precisión del modelo. Había mezcla entre flujo conversacional, objetos guardables, eventos automáticos y ayudas de acceso. También faltaba resolver mejor la relación entre libertad del usuario, almacenamiento canónico, proveniencia, backup técnico y búsqueda futura.

# Capítulo 2 — Hallazgos de la investigación

## 2.1 Trazabilidad y proveniencia: el patrón común

Los marcos más sólidos coinciden en una idea simple: la trazabilidad no se sostiene solo con archivos guardados. Se sostiene registrando qué entidad existe, qué actividad la produjo o modificó y qué agente intervino. W3C PROV lo formula de manera explícita: la proveniencia describe entidades, actividades y personas/agentes involucrados en producir algo, para poder evaluar su calidad, confiabilidad o confianza.

Traducción a AISync. Ese patrón es extremadamente compatible con AISync. Si se traduce al sistema:

- Entidad = checkpoint, saved selection, handoff package, source document reference, derived document, backup.

- Actividad = save, refresh, review & forward, audit AI answer, move, extract, delete, restore.

- Agente = usuario, manager, worker, sistema.

PREMIS, desde preservación digital, refuerza la misma estructura general: los objetos se entienden mejor cuando están acompañados por eventos, agentes, derechos y detalles de preservación. La consecuencia para AISync es clara: no alcanza con tener objetos y pantallas; hace falta un modelo explícito de objeto + evento + agente + relación.

## 2.2 Logs: no todo debe ir al mismo log

NIST trata log management como una disciplina completa de generación, transmisión, almacenamiento, acceso y disposición de logs. Eso implica que no conviene mezclar en una sola superficie visual los eventos útiles para el usuario, los eventos técnicos del sistema y los eventos preservacionales o de integridad.

Consecuencia para AISync. De esta investigación surge una consecuencia directa:

- Audit Log no debe absorber el log técnico.

- Audit Log tampoco debe convertirse en el único registro cronológico del sistema.

- Debe existir, por detrás, una capa más rica y más granular para eventos técnicos, seguridad, indexing, fixity, backups y policy enforcement.

## 2.3 Backups y continuidad: el backup visible no reemplaza al backup técnico

Los marcos de continuidad y seguridad son unánimes: backup no es solo guardar algo por si acaso. Backup forma parte de una estrategia de resiliencia, recuperación y priorización. CISA y NIST insisten en copias offline o fuera de línea, cifradas y probadas regularmente.

Separación obligatoria. Para AISync, esto obliga a separar dos cosas que hasta ahora podían confundirse:

- Session Backup = objeto visible, humano, operativo, orientado a continuidad de trabajo.

- Technical Backup = mecanismo automático de resiliencia del sistema, no necesariamente visible ni consultable como un documento.

## 2.4 Metadata: el acierto más fuerte del modelo AISync

NARA y records management serio refuerzan uno de los mejores criterios ya definidos en AISync: la metadata describe contenido, contexto y estructura, y sostiene la gestión del registro durante todo su ciclo de vida. Eso valida directamente la decisión de que metadata estructural sea la fuente de verdad y que las tags queden en segundo plano.

La investigación externa no solo confirma ese criterio: lo vuelve más importante. Si esa regla se rompe, el sistema degrada rápido hacia tags libres, carpetas personales y búsquedas frágiles.

## 2.5 Archivística: proveniencia, orden original y descripción multinivel

La archivística aporta tres principios especialmente útiles para AISync.

- Provenance: no mezclar materiales de distinta procedencia.

- Original order: respetar, en lo posible, el orden establecido por el creador.

- Multilevel description: describir de lo general a lo específico, manteniendo relaciones parte-todo.

Esto tiene impacto directo sobre tu pregunta estructural más delicada: si el usuario puede decidir libremente la ubicación física final de todo lo que guarda, se debilita proveniencia y se complica la reconstrucción futura.

Mejora estructural sugerida. La mejora correcta no es quitar libertad del todo, sino separar:

- ubicación canónica interna del original, definida por AISync;

- copias de acceso, aliases o shortcuts personales definidos por el usuario.

## 2.6 File plans, disposición y vida útil

NARA vuelve a aportar una idea simple pero potente: un sistema serio no solo identifica y organiza documentos, también define cómo se disponen. El file plan no es solo estructura: es estructura más instrucciones de manejo y disposición.

Para AISync esto significa que, aunque en MVP no se implemente toda la complejidad, conviene que cada objeto pueda tener al menos potencialmente:

- retención,

- revisión,

- archivo,

- borrado lógico,

- borrado físico cuando corresponda,

- huella histórica si se elimina.

## 2.7 Bibliotecología y discovery: facetas, vocabularios controlados y ayudas de acceso

La bibliotecología y la literatura sobre discovery aportan otra pieza crítica: no alcanza con carpetas y búsqueda full text. Los sistemas complejos mejoran mucho cuando combinan estructura canónica con vocabularios controlados y navegación facetada.

OCLC FAST fue desarrollado precisamente para ofrecer un vocabulario facetado, fácil de aplicar, compatible con metadata existente y amigable para navegación facetada. La literatura de Berkeley y UNC, por su parte, refuerza que las facetas y las vistas exploratorias ayudan a explorar colecciones, siempre que no se presenten de forma caótica.

Implicancia. La implicancia para AISync es concreta:

- No basta con tags libres.

- Conviene tener facetas controladas para object type, state, project, team, actor role, sensitivity, relation type y save purpose.

- Las tags libres del usuario siguen existiendo, pero en una capa secundaria y acotada.

## 2.8 Finding aids: lo que faltaba nombrar

La investigación archivística y bibliotecológica también deja ver algo que en AISync ya estaba apareciendo intuitivamente, pero sin nombre propio: no todo lo útil para encontrar cosas es un documento ni un evento fuerte. Existen ayudas de acceso.

Nueva clase funcional. En AISync esto abre una clase funcional nueva, muy útil y muy limpia:

- marcadores de cambio de día,

- resúmenes de sesión,

- resúmenes temáticos,

- breadcrumbs,

- tarjetas de acceso rápido.

Esto resuelve elegantemente una necesidad real: ayudar a encontrar mensajes o bloques de trabajo de hace mucho tiempo sin inflar ni Audit Log ni Documentation Mode.

## 2.9 Integridad y fixity

La preservación digital insiste en que, para ciertos objetos, metadata sola no alcanza. Hace falta poder verificar que un objeto sigue siendo el mismo objeto. De ahí la importancia de checksums, fixity checks y eventos de integridad.

En AISync, esto todavía no estaba suficientemente desarrollado. No hace falta sobredimensionarlo en MVP, pero sí conviene dejar claro que los objetos más importantes deberían poder soportar, en el futuro, checksum y evento de verificación.

## 2.10 Lectura crítica de conjunto

La investigación externa no destruye el modelo de AISync. Lo fortalece. Pero también muestra dónde estaba el hueco: faltaba separar con más rigor evento, objeto, ayuda de acceso, backup técnico y ubicación canónica.

# Capítulo 3 — Conclusiones

## 3.1 Lo que AISync ya tenía bien

- La separación funcional entre Audit Log y Documentation Mode.

- La regla metadata estructural = source of truth; tags = capa secundaria.

- La noción de que AISync guarda objetos operativos trazables y no cosas sueltas.

- La idea de múltiples vistas sobre una sola base documental.

- La secuencia de memoria operativa basada en Save Version / Checkpoint / Resume Work.

## 3.2 Lo que debía corregirse

- La mezcla entre flujo conversacional, objetos guardables, eventos automáticos y ayudas de acceso.

- La posibilidad de que la libertad del usuario desordenara la ubicación canónica de los originales.

- La ausencia de una capa clara de proveniencia más estricta.

- La falta de separación entre log operativo visible y log técnico/preservacional.

- La falta de contrato fuerte para Checkpoint y de doble representación para Saved Selection.

- La ausencia de una clase formal de finding aids.

## 3.3 Decisiones críticas que surgen de la investigación

- Audit Log no debe convertirse en un botón interno de Documentation Mode.

- Audit Log debe seguir siendo una superficie separada y operativa.

- Documentation Mode debe seguir siendo una capa documental separada, con base única y vistas múltiples.

- El original canónico de los saves debe vivir donde AISync lo necesita; el usuario puede generar copias de acceso donde quiera.

- Los marcadores de cambio de día son útiles, pero deben tratarse como ayudas de acceso, no como documentos ni como eventos centrales.

- Audit AI Answer genera traza, no documento, salvo guardado humano posterior.

- Save this message y Saved Selection deben converger en un mismo objeto canónico: Saved Selection, con uno o varios mensajes seleccionados.

- Checkpoint debe quedar congelado como ancla cognitiva nombrada, navegable y reanudable.

- Session Backup visible y Technical Backup invisible deben separarse explícitamente.

## 3.4 Qué debe preservarse doctrinalmente

- Audit Log = qué pasó.

- Documentation Mode = qué existe y cómo se consulta.

- No duplicación documental por defecto.

- Una sola base documental.

- Múltiples vistas, no múltiples verdades.

- Metadata estructural manda.

- Tags ayudan, no gobiernan.

## 3.5 Qué debe mejorarse a futuro

- Facetas controladas más fuertes.

- Retención y disposición por objeto.

- Fixity/checksum para objetos críticos.

- Tres capas formales de log.

- Capa explícita de proveniencia tipo object + event + agent + relation.

- Política clara de backups técnicos y restore.

- Mayor precisión en el storage canónico por proyecto, proveniencia y tipo.

# Capítulo 4 — AISync Audit Log y Documentation Mode — Versión final

Este capítulo es normativo. Define cómo debe quedar el sistema. No explica fundamentos.

## 4.1 Principio rector

- Audit Log registra el hecho.

- Documentation Mode registra el objeto.

- El almacenamiento canónico del objeto no depende del gusto del usuario.

- Las vistas personales del usuario no modifican la ubicación canónica del original.

## 4.2 Separación funcional

- Audit Log = qué pasó, cuándo pasó y desde dónde puede retomarse.

- Documentation Mode = qué existe, cómo está organizado y cómo se consulta.

- Audit Log y Documentation Mode permanecen separados.

- Audit Log no se integra como botón interno de Documentation Mode.

## 4.3 Capa conversacional

- Chat = totalidad del diálogo y sus insumos dentro de una AI Agent Session concreta.

- El Chat no es un documento.

- El Chat no es un evento.

- El Chat no es automáticamente un objeto documental.

## 4.4 Objetos canónicos guardables

- Checkpoint

- Saved Selection

- Session Backup

- Handoff Package

- Source Document Reference

- Derived Document

- Prompt Package

## 4.5 Checkpoint

- Checkpoint = ancla cognitiva nombrada dentro del proceso de trabajo.

- El nombre del Checkpoint es obligatorio y lo define el usuario.

- No existe nombre por defecto.

- El label visible en UI puede seguir siendo Save Version.

- El objeto funcional oficial es Checkpoint.

- Checkpoint soporta Take me there.

- Take me there = navegar al punto del chat donde está ese checkpoint.

- Lleva al usuario al punto exacto del chat donde quedó fijado ese Checkpoint.

- Checkpoint soporta Resume Work.

- Resume Work = reabrir ese checkpoint como base activa de trabajo cuando el sistema lo permita sin ambigüedad.

- Checkpoint no equivale a Session Backup.

## 4.6 Saved Selection

- Saved Selection = uno o varios mensajes seleccionados guardados como un solo objeto.

- Save this message es un caso particular de Saved Selection con selección unitaria.

- Saved Selection tiene representación legible para humanos.

- Saved Selection tiene representación estructurada interna con referencias a mensajes fuente.

- El usuario puede generar una copia de acceso donde quiera.

- El original canónico queda en la ubicación definida por AISync.

## 4.7 Session Backup

- Session Backup = respaldo completo del histórico de un chat o hilo.

- Session Backup es un objeto visible y operativo.

- Session Backup no reemplaza al Technical Backup.

- Technical Backup es una capa automática de resiliencia del sistema.

## 4.8 Eventos automáticos

- Review & Forward genera evento automático de trazabilidad.

- Refresh Session genera evento automático de trazabilidad.

- Audit AI Answer genera evento automático de trazabilidad.

- Movimientos de archivos generan eventos automáticos de trazabilidad.

- Movimientos de prompts generan eventos automáticos de trazabilidad.

- Los cambios de estado documental generan eventos automáticos de trazabilidad.

## 4.9 Audit AI Answer

- Audit AI Answer no genera documento por defecto.

- Audit AI Answer genera traza.

- Si el usuario guarda un resultado, el documento nace por Saved Selection o por objeto derivado posterior.

## 4.10 Ayudas de acceso (Finding Aids)

- Los marcadores de cambio de día se tratan como ayudas de acceso.

- Las ayudas de acceso no son documentos canónicos.

- Las ayudas de acceso no reemplazan eventos operativos.

- Las ayudas de acceso pueden incluir day markers, summaries, breadcrumbs y tarjetas de acceso rápido.

## 4.11 Logs

- Operational Audit Log visible para el usuario.

- System/Security Log técnico, no necesariamente visible.

- Preservation/Provenance Event Store para integridad, indexing, fixity, migraciones y relaciones.

## 4.12 Metadata y tags

- Metadata estructural = source of truth.

- Tags = capa secundaria de acceso, búsqueda y operación.

- Las tags libres del usuario son opcionales y subordinadas.

- Deben existir facetas controladas para object type, state, project, team, actor role, sensitivity, relation type y save purpose.

## 4.13 Storage canónico

- Root canónico por Project.

- Subestructura por proveniencia y tipo de objeto.

- Mirror de teams cuando corresponda.

- No duplicación documental por defecto.

- El usuario puede tener copias de acceso o shortcuts personales sin alterar el original canónico.

## 4.14 Documentation Mode

- Una sola base documental.

- Repository View = vista operativa principal.

- Structure View = proveniencia y jerarquía.

- Audit View = documento + evento + traza.

- Investigate View = tema + cronología + evolución.

- Knowledge Map = relaciones + red + contexto.

- No deben existir verdades paralelas entre vistas.

## 4.15 Audit Log

- Mantiene calendario mensual como vista principal mientras no exista OE precisa que lo reemplace.

- Muestra eventos operativos relevantes y comprensibles.

- Debe permitir localizar objetos, abrir detalle y volver al trabajo.

- No se convierte en repositorio documental.

- No se convierte en log técnico.

# Anexo A — Matriz canónica de implementación

Matriz textual resumida para implementación.

| Acción visible | Evento en Audit Log | Objeto canónico | Nota |
| --- | --- | --- | --- |
| Save Version | checkpoint.created | Checkpoint | nombre humano obligatorio; Take me there; Resume Work |
| Save this message | selection.saved | Saved Selection | selección unitaria; puede generar copia de acceso |
| Save Selection | selection.saved | Saved Selection | uno o varios mensajes; un solo objeto |
| Session Backup | session_backup.created | Session Backup | histórico completo del hilo |
| Review & Forward | review_forward.executed | ninguno por defecto | si se formaliza transferencia, nace Handoff Package |
| Audit AI Answer | audit_ai_answer.started/completed | ninguno por defecto | documento solo si luego hay guardado humano |
| Refresh Session | session.refreshed | ninguno por defecto | continuidad visible preservada |
| File ingest/open/download/extract | file.ingested/opened/downloaded/extracted | depende del caso | referencia canónica si corresponde; derivado si nace objeto nuevo |
| Prompt apply/save/share | prompt.applied/saved/shared | Prompt Package si se formaliza | uso de prompt no equivale siempre a objeto |
| Cambio de día | session.day_boundary_crossed | Finding Aid | referencia al último y primer mensaje; opcional en MVP |
| Lock / Unlock | state.changed | ninguno por defecto | evento operativo + huella histórica |
| Move/Delete/Missing/Extracted | object.moved/deleted/missing/extracted | objeto existente + cambio de estado | huella histórica persistente |

# Anexo B — Glosario y reglas de prevalencia

Chat. Totalidad del diálogo y sus insumos dentro de una AI Agent Session concreta.

Checkpoint. Ancla cognitiva nombrada, navegable y reanudable dentro del proceso de trabajo.

Saved Selection. Objeto único creado a partir de uno o varios mensajes seleccionados.

Session Backup. Respaldo completo del histórico de un chat o hilo.

Source Document Reference. Referencia trazable a un documento fuente canónico.

Derived Document. Documento generado dentro del flujo de trabajo.

Handoff Package. Objeto formal de transferencia de trabajo, contexto y continuidad.

Finding Aid. Ayuda de acceso para orientar búsqueda o navegación futura sin convertirse en objeto documental canónico.

Audit Log. Superficie operativa de cronología y continuidad.

Documentation Mode. Superficie documental de consulta, relación y recuperación sobre base única.

Prevalencia. Regla de prevalencia.

- Si hay contradicción entre explicaciones narrativas y definiciones normativas, manda el Capítulo 4.

- Si hay contradicción entre libertad del usuario y almacenamiento canónico, manda el almacenamiento canónico.

- Si hay contradicción entre tags y metadata, manda la metadata estructural.

- Si hay contradicción entre objeto y evento, el evento registra el hecho y el objeto registra la pieza documental.

# Fuentes y referencias

1. W3C. PROV-Overview. https://www.w3.org/TR/prov-overview/

1. W3C. PROV-DM: The PROV Data Model. https://www.w3.org/TR/prov-dm/

1. Library of Congress. PREMIS Data Dictionary for Preservation Metadata, Version 3.0. https://www.loc.gov/standards/premis/v3/

1. NIST. Log Management guidance (SP 800-92 Rev.1 draft context) and NIST publication portal. https://csrc.nist.gov/ and https://www.nist.gov/

1. NIST. SP 800-34 Rev.1. Contingency Planning Guide for Federal Information Systems. https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final

1. CISA. StopRansomware Guide. https://www.cisa.gov/stopransomware/ransomware-guide

1. NARA. Metadata Requirements for Permanent Electronic Records. https://www.archives.gov/records-mgmt/policy/metadata-compiled

1. NARA. Implementing Schedules / File plans. https://www.archives.gov/records-mgmt/scheduling/implementation

1. NARA Records Express. Metadata in Electronic Records Management. https://records-express.blogs.archives.gov/2016/11/21/metadata-in-electronic-records-management/

1. SAA Dictionary. Provenance. https://dictionary.archivists.org/entry/provenance.html

1. SAA Dictionary. Original order. https://dictionary.archivists.org/entry/original-order.html

1. SAA Dictionary. Respect des fonds. https://dictionary.archivists.org/entry/respect-des-fonds.html

1. ICA. ISAD(G): General International Standard Archival Description, Second Edition. https://www.ica.org/resource/isadg-general-international-standard-archival-description-second-edition/

1. OCLC. FAST (Faceted Application of Subject Terminology). https://www.oclc.org/en/fast.html

1. OCLC Research. FAST details and facets. https://www.oclc.org/research/areas/data-science/fast.html

1. Hearst, Marti A. Design Recommendations for Hierarchical Faceted Search Interfaces. UC Berkeley. https://flamenco.berkeley.edu/papers/faceted-workshop06.pdf

1. Capra, Robert G.; Marchionini, Gary. Faceted Exploratory Search Using the Relation Browser. UNC Chapel Hill. https://ils.unc.edu/ISSS/papers/papers/rcapra-gmarch.pdf

1. AISync corpus interno: informes Audit Log / Documentation Mode / Workspace, Saves, Tags y Trazabilidad / Taxonomía de Eventos / Documentation Mode / resumen maestro del proyecto.
