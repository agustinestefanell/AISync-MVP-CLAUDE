# Handoff — AISync MVP (activo desde 2026-08-21)

Archivo anterior: `handoff-2026-07-b.md` (cerrado 2026-08-21, ~394KB — ver
nota de continuidad al final de ese archivo).

---

## OE 2026-08-21 — User Library (reemplaza Structure View): base de Tags + integración con Save Selection

**Fecha:** 2026-08-21
**Estado:** Closed — build y lint confirmados sin errores nuevos. Pendiente: Agus debe aplicar la migración 058 en Supabase (CLI no vinculada, ver AISyncPlans.md 8.7) antes de que la feature funcione — sin eso, `tags`/`saved_selection_tags` no existen todavía en la base real.

**Contexto:** User Library reemplaza a Structure View como tab de Documentation Mode. Se basa ÚNICAMENTE en Save Selection — nada de Handoff, Checkpoint, Loaded Context ni Review & Forward. Organización por tags manuales libres (no carpetas anidadas), un Save Selection puede tener varios tags. La visión original de Structure View (árbol de carpetas tipo escritorio) no resultó ser el camino correcto — confirmado por Agus antes de implementar.

### Paso 0 (reportado y confirmado con Agus antes de escribir código)

- **Schema:** 2 tablas nuevas — `tags` (`id`, `account_id` → `accounts`, `name`, `UNIQUE account_id,name`) + `saved_selection_tags` (junction, `UNIQUE saved_selection_id,tag_id`) — en vez de reusar el patrón `TEXT[]` de `prompt_library.tags`. Motivo: tags necesitan identidad propia (contar por tag, "+ Create new tag" devuelve un `id` real, evitar duplicados por nombre) — un array plano no da nada de esto sin trabajo extra. `account_id` (no `user_id`) siguiendo la convención más reciente del proyecto (`investigation_snapshot`, migración 056), no la vieja de `saved_selections`/`prompt_library`.
- **Sin columna `in_user_library`:** "estar en la library" se deriva de tener ≥1 fila en `saved_selection_tags`. Como la vista se navega solo por tags, un flag separado no resolvería nada (un Save Selection con el flag tildado y 0 tags seguiría siendo invisible) — en cambio, el modal exige al menos 1 tag antes de guardar cuando el checkbox está tildado.
- **RLS:** `tags` con ownership directo (`account_id = auth.uid()`). `saved_selection_tags` vía `EXISTS` contra `saved_selections` (ownership indirecto, mismo patrón que `prompt_assignments`/`message_provenance`) + `EXISTS` contra `tags` en el INSERT.
- **Punto adicional resuelto en el Paso 0:** qué hacer con el código de Structure View, ya huérfano tras el reemplazo del tab. Agus confirmó borrarlo (Opción 1) — la visión de árbol de carpetas no era el camino correcto, User Library con tags resuelve mejor la necesidad real. Ver DECISIONS.md 2026-08-21.

Ver detalle completo de las 3 decisiones técnicas en `DECISIONS.md` 2026-08-21 ("User Library reemplaza Structure View: schema de tags normalizado, sin flag de membresía").

### 1. Migración 058 — `supabase/migrations/058_tags.sql`

`tags` (ownership directo) + `saved_selection_tags` (junction, RLS vía EXISTS contra `saved_selections`/`tags`). **Pendiente de aplicar en Supabase Dashboard → SQL Editor** — sin esto, `/api/tags` y el flujo de tags en el modal fallarán en runtime (tablas no existen).

### 2. `src/lib/db/documentation.ts`

- `DocSavedSelection` gana `tags: { id: string; name: string }[]` — `getSavedSelections()` extiende su query con `saved_selection_tags(tags(id, name))` y mapea el resultado.
- Nuevo `DocTag { id, name }` + `getTags()` (lista simple, ordenada por nombre, RLS-only sin `.eq` explícito — mismo patrón que `getDocCheckpoints()`/`getHandoffPackages()`).

### 3. `src/app/api/tags/route.ts` (nuevo)

`GET` — lista de tags de la cuenta. `POST` — crea un tag; si el nombre ya existe para la cuenta (`23505` unique_violation), devuelve el tag existente en vez de error (el usuario no puede saber de antemano si ya lo creó).

### 4. `src/app/api/save-selection/route.ts`

Acepta `tagIds?: string[]` opcional en el body. Tras crear la fila en `saved_selections`, si `tagIds` no está vacío, inserta en `saved_selection_tags`. Fail-open respecto al Save Selection ya creado — si la asociación de tags falla, devuelve `201` igual con `tagsError` en el body (no deshace el Save Selection).

### 5. `src/components/workspace/WorkspaceShell.tsx` — modal de Save Selection

Nuevo estado: `addToLibrary`, `availableTags` (carga lazy vía `GET /api/tags` la primera vez que se tilda el checkbox), `selectedTagIds`, `showNewTagInput`, `newTagName`, `creatingTag`. UI nueva entre el input de nombre y el bloque de error: checkbox "Add to User Library" → despliega selector multi-tag (chips toggle) + "+ Create new tag" inline (`POST /api/tags`, sin salir del modal, agrega el tag nuevo a `availableTags` y lo selecciona automáticamente). Validación: si `addToLibrary` está tildado y `selectedTagIds` está vacío, `handleSaveSelection()` bloquea el guardado con un mensaje de error explícito y el botón "Save Selection(s)" queda deshabilitado. `openSaveSelectionModal`/`finishSelectionAction` resetean todo el estado nuevo — mismo criterio que ya aplicaba a `saveSelectionName`/`pendingSelectionMessages`. Es el único modal de Save Selection de la app (el botón de `HumanChatPanel.tsx` dispara el mismo modal vía `openSaveSelectionModal`), así que esta es la única integración necesaria.

### 6. `src/components/documentation/UserLibraryView.tsx` (nuevo)

Master-detail simple: panel izquierdo con lista de tags + contador de Save Selections por tag (`useMemo` sobre `savedSelections[].tags`, sin query aparte — los tags ya vienen embebidos por `getSavedSelections()`); click en un tag filtra el panel derecho, que lista las Save Selections con ese tag (card con nombre, team/workspace/fecha, message count, preview, chips de sus tags, botón "Open Workspace →" — mismo patrón que el resto de las cards de anclas de Documentation Mode). Estado vacío (ningún Save Selection con al menos 1 tag todavía, no "no hay tags creados") — bloque de fondo gris centrado con el texto bilingüe exacto pedido (inglés primero, español después), exportado como `USER_LIBRARY_GUIDE` para reusarlo también en el ícono "i".

### 7. Actualizado lo que asumía "Structure View" como una de las vistas fijas

- **`src/components/documentation/DocClient.tsx`:** `Tab` type (`'structure'` → `'library'`), `TABS` array (entry reemplazado, `guide` = `USER_LIBRARY_GUIDE` importado de `UserLibraryView.tsx`), `VALID_TABS`, línea de render del tab, prop `tags: DocTag[]` nuevo en `DocClientProps`, import de `StructureView` reemplazado por `UserLibraryView`.
- **`src/app/documentation/page.tsx`:** agrega `getTags()` al `Promise.all()`, pasa `tags` a `DocClient`. Comentario del deep-link (`?tab=&team=`) actualizado — ya no es específico de Structure View, es un mecanismo genérico de query params que sigue funcionando igual (no se tocó su lógica).
- **`src/components/layout/TraceabilityGuideButton.tsx`:** el modal educativo "How Traceability Works" (separado de las guías de `DocClient.tsx`) listaba explícitamente "Structure" como una de las 5 vistas con su propia descripción — reemplazado por una descripción de User Library en el mismo tono/estilo. Encontrado por grep exhaustivo de "Structure"/"structure" en todo `src/`, no estaba en el pedido original pero quedaba desactualizado si no se tocaba.
- **`src/lib/documentation/anchors.ts` / routing del SM lateral:** confirmado sin cambios necesarios — Structure View nunca fue parte de `AnchorKind` (son 5 tipos de ancla documental, concepto distinto de los 5 tabs de Documentation Mode) ni del routing V1 del SM (`sm_documentation` ya excluía explícitamente Structure View del V1, ver DECISIONS.md 2026-08-20 — la exclusión simplemente queda sin objeto ahora, no requiere código nuevo).
- **AISyncPlans.md:** árbol de componentes (sección 3.5) actualizado, párrafos que documentaban Structure View reemplazados por uno de User Library, tabla de tablas (5.1) y endpoints (6.1) actualizadas, tabla de migraciones (10.1) completada hasta la 058 (estaba desactualizada desde la 055, se aprovechó para cerrar el gap).

### 8. Código de Structure View eliminado (confirmado por Agus, ver DECISIONS.md)

`src/components/documentation/StructureView.tsx`, `WorkspaceDetailPanel.tsx`, `DocumentationMirrorTree.tsx`, `src/lib/documentation/buildMirrorTree.ts`, `src/lib/documentation/types.ts` (exclusivo del mirror tree). Confirmado por grep exhaustivo antes de borrar que ninguno tenía otro consumidor fuera de sí mismos y del tab ya reemplazado.

### Verificación

Build y lint corridos, sin errores nuevos (solo warnings preexistentes en `CanvasViewport.tsx` x3, no tocados). **Sin verificación visual esta sesión** — sin Claude in Chrome disponible, y la feature depende de una migración (058) que todavía no está aplicada en Supabase, así que no hay datos reales posibles para probar el flujo completo (tag → Save Selection → User Library) hasta que Agus la aplique. Pendiente antes de dar por buena la feature en producción: aplicar migración 058 + probar el flujo real (modal con checkbox+tags, User Library vacío con el texto bilingüe, User Library con al menos 1 tag y su Save Selection, filtro funcionando).

### Alternativas descartadas

- **`TEXT[]` en `saved_selections` en vez de tablas normalizadas** — descartado, sin identidad de tag propia no se puede contar barato ni evitar duplicados por nombre sin lógica extra.
- **Columna `in_user_library` explícita** — descartado, sería un tercer estado fantasma sin utilidad real dado que la navegación es 100% por tags.
- **Dejar el código de Structure View sin usar "por si se reusa después"** — descartado explícitamente por Agus, la visión de árbol de carpetas ya no es el camino, prefiere no dejar código muerto de un enfoque descartado.
- **Fetch de conteos por tag desde el servidor (`GET /api/tags` con counts)** — descartado, los tags ya vienen embebidos en `getSavedSelections()` (que `DocClient.tsx` ya carga para las otras 4 vistas), así que el conteo es gratis en memoria (`useMemo`) sin query ni endpoint adicional.

### Riesgos conocidos / deuda técnica

- **Migración 058 sin aplicar todavía en Supabase** — bloqueante real hasta que Agus la corra. `/api/tags` y el checkbox del modal fallarán con error de tabla inexistente hasta entonces.
- **`getSavedSelections(userId)` sigue con firma inconsistente** respecto al resto de `getDocX()` de `documentation.ts` (recibe `userId` explícito en vez de resolverlo vía RLS/auth interno) — preexistente, no introducido ni corregido en esta OE, señalado por si se quiere unificar a futuro.
- **Tags huérfanos posibles:** si el usuario crea un tag nuevo desde el modal pero cancela el Save Selection (o el guardado falla después de crear el tag), el tag queda existiendo con 0 Save Selections asociados — aparece igual en el selector del próximo modal (correcto, para reuso) y en User Library con contador 0 (comportamiento intencional, no oculto — ver DECISIONS.md).
- **Sin edición/borrado de tags todavía** — `DELETE`/`UPDATE` en `tags` tienen policy RLS lista (`tags_update`/`tags_delete`) pero no hay UI que los use en esta OE — no pedido en el alcance, policies dejadas listas para cuando se pida.

**Archivos modificados/nuevos:** `supabase/migrations/058_tags.sql` (nuevo), `src/lib/db/documentation.ts`, `src/app/api/tags/route.ts` (nuevo), `src/app/api/save-selection/route.ts`, `src/components/workspace/WorkspaceShell.tsx`, `src/components/documentation/UserLibraryView.tsx` (nuevo), `src/components/documentation/DocClient.tsx`, `src/app/documentation/page.tsx`, `src/components/layout/TraceabilityGuideButton.tsx`, `AISyncPlans.md`, `DECISIONS.md`, `PRODUCT_STATUS.md`. **Eliminados:** `src/components/documentation/StructureView.tsx`, `WorkspaceDetailPanel.tsx`, `DocumentationMirrorTree.tsx`, `src/lib/documentation/buildMirrorTree.ts`, `src/lib/documentation/types.ts`.

---

## OE 2026-08-21 — User Library: ajustes de UX post-verificación funcional

**Fecha:** 2026-08-21
**Estado:** Closed — build y lint confirmados sin errores nuevos. Sin verificación visual esta sesión (sin Claude in Chrome disponible) — pendiente confirmación de Agus antes de commit/push.

**Contexto:** Agus verificó funcionalmente User Library (construida en la OE anterior, mismo día) y pidió 5 ajustes de UX antes de darla por cerrada. Nota de diagnóstico: la consigna describía el layout de resultados como "carrusel horizontal con flechas ← →" — al leer el código real (`UserLibraryView.tsx`) antes de tocar nada, no había ningún carrusel ni flechas; el grid ya era una lista vertical de una sola columna. No se investigó más a fondo el origen de la discrepancia (no bloqueaba el trabajo) — se implementaron los 5 puntos pedidos como estado final deseado, verificable independientemente de cuál haya sido el estado exacto que Agus probó.

### 1. Layout — grid vertical multi-columna

`UserLibraryView.tsx`: el contenedor de resultados pasa de `grid gap-3 content-start` (una columna) a `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 content-start` — varias cards por fila según ancho de pantalla, scroll vertical normal (`overflow-y-auto`, sin cambios ahí). Cards reordenadas internamente (título/metadata arriba, botón "Open Workspace →" al final con `mt-3 self-start`) para verse bien en formato card angosta en vez de fila ancha.

### 2. Checkbox "Add to User Library" — más peso visual

`WorkspaceShell.tsx`: reemplazado el `<label><input type="checkbox">...</label>` chico por un toggle estilo card completo (`<button>` full-width, borde de 2px, fondo tintado con `--color-accent` al 10% cuando está activo, casilla de 24×24px con check blanco sobre fondo accent, ícono 📚, subtítulo explicativo "Tag this selection so you can find it again by topic."). Mismo patrón visual que ya usa la app para toggles importantes (borde 2px + fondo tintado con el accent), no un componente nuevo.

### 3. Comportamiento por defecto — mostrar todo, tags acotan (AND)

Cambio de modelo: de single-select exclusivo (`selectedTagId: string | null`, "elegí un tag para ver algo") a multi-select acumulativo (`selectedTagIds: string[]`). Sin ningún tag marcado, `filteredSelections` devuelve TODOS los Save Selections con ≥1 tag (toda la library). Marcar tags aplica `every()` — el Save Selection debe tener TODOS los tags marcados, no alguno (AND, no OR) — "funciona como filtro que suma restricciones", tal como pidió Agus. Ver DECISIONS.md 2026-08-21 para el detalle de por qué AND y no OR.

### 4. Orden alfabético de tags

Ya estaba correctamente implementado desde la OE anterior (`sortedTags` con `.localeCompare()`) — confirmado, sin cambios necesarios acá.

### 5. Buscador de tags (client-side, "contains")

Nuevo `tagSearchQuery` + `visibleTags` (`useMemo` filtrando `sortedTags` por `.toLowerCase().includes(query)`). Sin query nueva — filtra sobre los tags que `DocClient.tsx` ya carga vía `getTags()`. Elegido "contains" sobre "starts with" — ver DECISIONS.md 2026-08-21 para el motivo. Input ubicado arriba de la lista de tags, con un link "Clear" que aparece solo cuando hay tags marcados (mismo patrón "Clear filters" que ya usan Repository/Audit/Investigate View).

### Verificación

Build y lint corridos, sin errores nuevos. **Sin verificación visual esta sesión** — sin Claude in Chrome disponible. Pendiente: los 4 screenshots pedidos en la consigna (grid vertical con varias cards, checkbox resaltado, comportamiento sin filtro vs. con tag marcado, lista alfabética con buscador filtrando en vivo).

### Alternativas descartadas

- **Investigar a fondo el origen del "carrusel" descripto en la consigna** — descartado, no bloqueaba implementar el estado final pedido (ver nota de Contexto arriba); señalado por si vuelve a aparecer una discrepancia similar.
- **Filtro OR entre tags marcados** — descartado, no es lo que Agus pidió (ver DECISIONS.md).
- **Búsqueda de tags "starts with"** — descartado, ver DECISIONS.md.

### Riesgos conocidos / deuda técnica

- **Sigue pendiente la migración 058 en Supabase** (heredado de la OE anterior) — sin aplicarla, nada de esto es probable en runtime real.
- **Sin verificación visual real todavía** — ver arriba.

**Archivos modificados:** `src/components/documentation/UserLibraryView.tsx`, `src/components/workspace/WorkspaceShell.tsx`, `AISyncPlans.md`, `DECISIONS.md`, `PRODUCT_STATUS.md`.

---
