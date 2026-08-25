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

## OE 2026-08-22 — User Library: edición inline (layout 4 columnas, Expandir, Delete/Add Tag/Remove tag, Edit Tag con color)

**Fecha:** 2026-08-22
**Estado:** Closed — build y lint confirmados sin errores nuevos en las 6 rondas de ajustes de esta OE. **Verificación visual confirmada por Agus (2026-08-24):** todos los ajustes de User Library aprobados (mosaico con columnas explícitas, tope de altura por columna, truncado real por altura, filtros Project/Team, tipografía serif en títulos, fondo blanco + sombra sutil) — sin pedir cambios adicionales a los valores propuestos (`COLUMN_MAX_HEIGHTS`, paleta de tags, etc.). Commit + push ejecutados en este cierre. Pendiente (no bloqueante para el commit): aplicar migraciones 058 y 059 en Supabase — sin eso, `/api/tags`, `PATCH /api/tags/[id]` y el color de tags fallan en runtime real.

**Contexto:** Ajustes de UX sobre User Library ya construida (layout, expandir, edición inline de tags por card y desde el panel de tags). Paso 0 reportado y confirmado con Agus antes de escribir código — ver DECISIONS.md 2026-08-22.

### 1. Migración 059 — `supabase/migrations/059_tags_color.sql`

`ALTER TABLE tags ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#1f4e79'` — nullable, default = mismo azul de `--color-accent` en `tokens.css`. **Pendiente de aplicar en Supabase** (igual que la 058) — sin esto, "Edit Tag" y los colores de tag no funcionan en runtime real.

### 2. `src/lib/db/documentation.ts`

`DocTag` gana `color: string | null`. `getTags()` selecciona `color`. `DocSavedSelection.tags[]` y `RawSavedSelection.saved_selection_tags[].tags` ganan `color` — `getSavedSelections()` extiende su select anidado a `saved_selection_tags(tags(id, name, color))`.

### 3. `src/app/api/tags/route.ts`

`GET`/`POST` seleccionan/devuelven `color` además de `id, name` (sin cambios de comportamiento, solo el campo nuevo viajando).

### 4. `src/app/api/tags/[id]/route.ts` (nuevo)

`PATCH` — "Edit Tag". Body `{ name?, color? }`, al menos uno de los dos. Filtra explícitamente por `account_id = user.id` además de RLS. `23505` (nombre duplicado para la cuenta) → `409` con mensaje claro en vez de error genérico.

### 5. `src/app/api/documentation/selection/[id]/tags/route.ts` (nuevo)

Único lugar que modifica `saved_selection_tags` para un Save Selection **ya existente** (hasta esta OE solo se insertaba una vez, al crear el Save Selection). Ownership check explícito (patrón SEC-008 de `save-selection/route.ts`) antes de mutar, no solo RLS.
- `POST { tagIds: string[] }` → `upsert` con `onConflict: 'saved_selection_id,tag_id'` + `ignoreDuplicates: true` ("Add Tag" — agrega uno o más, sin error si ya estaba agregado).
- `DELETE { tagId?: string }` → sin `tagId`, borra TODAS las filas de ese Save Selection ("Delete" de la card — lo saca de User Library, el Save Selection en sí no se toca). Con `tagId`, borra solo esa fila ("Remove tag").

### 6. `src/components/documentation/UserLibraryView.tsx` (reescrito)

- **Layout:** grid pasa de `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3` a `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` — 4 columnas en pantallas anchas.
- **Expandir:** botón "⤢" por card abre un modal (mismo patrón visual que `EditTeamModal.tsx` — overlay + header/body scrolleable con `max-h-[90vh]`/footer), trae el contenido completo vía `GET /api/documentation/selection/[id]` (ya existía, reusado sin cambios) de forma lazy al abrir.
- **Card — Delete:** botón con confirmación de 2 clicks (mismo patrón `confirming`/"Confirm deletion?" ya usado en `EditTeamModal.tsx` para "Erase Team") → `DELETE .../tags` sin `tagId`.
- **Card — Remove tag:** "×" en cada chip de tag → `DELETE .../tags` con `tagId` puntual.
- **Card — Add Tag:** botón "+ Add tag" abre un popover con los tags de la cuenta que todavía no están en esa card (chips clickeables, aplicación inmediata por click — no junta selección con un paso de "confirmar", ver DECISIONS.md por qué difiere del modal de creación) + "+ Create new tag" inline (crea vía `POST /api/tags` y lo agrega en la misma acción).
- **Panel de tags — Add a New Tag:** botón "+ New" junto al header "Tags (N)", abre un input inline (mismo flujo que ya existía en el modal de Save Selection) → `POST /api/tags`.
- **Panel de tags — Edit Tag:** ícono "✎" por fila abre un bloque inline con input de nombre + 8 swatches de color fijos (`TAG_COLORS`) → `PATCH /api/tags/[id]`.
- **Color de tags:** punto de color (`tag.color ?? DEFAULT_TAG_COLOR`) en las filas del panel izquierdo y en los chips de las cards.
- **Todas las mutaciones:** `fetch` → si falla, mensaje de error inline (no bloquea la vista); si OK, `router.refresh()` — sin estado local duplicado de `savedSelections`/`tags` (ver DECISIONS.md, mismo patrón que `TeamsClient.tsx`/`EditTeamModal.tsx`).

### Verificación

`npm run lint` y `npm run build` sin errores nuevos (mismos 3 warnings preexistentes de `CanvasViewport.tsx`, no tocados). Grep exhaustivo de `from('tags')`/`saved_selection_tags` confirmó que todos los selects que traen tags (`documentation.ts`, `api/tags/route.ts`, `api/tags/[id]/route.ts`) quedaron consistentes con la columna `color` nueva. Sin Claude in Chrome disponible esta sesión no se hizo verificación visual en el momento; **confirmado visualmente por Agus el 2026-08-24** (aprobado sin cambios, ver Estado de la OE arriba). No se intentó levantar el dev server para una prueba funcional real porque además la migración 059 todavía no está aplicada en Supabase — no habría datos reales con los que probar el flujo de color.

### Alternativas descartadas

Ver DECISIONS.md 2026-08-22 para el detalle completo (color nullable vs. NOT NULL, paleta fija vs. color picker libre, router.refresh() vs. estado local duplicado, aplicación inmediata vs. selección+confirmar en "Add Tag", endpoint separado vs. extender `/api/tags`).

### Riesgos conocidos / deuda técnica

- **Migración 059 sin aplicar todavía en Supabase** — heredado el mismo bloqueante que la 058 (tampoco aplicada). Hasta que Agus corra ambas, `/api/tags/[id]` y el color de tags fallan en runtime real.
- ~~Sin verificación visual real todavía~~ — **resuelto:** confirmado por Agus el 2026-08-24 (grid a 4 columnas, modal Expandir, Delete/Add Tag/Remove tag, Add a New Tag/Edit Tag con color, todos aprobados).
- ~~Commit/push pendientes~~ — **resuelto:** commit `1fc8d22` en `main`, pusheado el 2026-08-24.
- **`saved_selection_tags` ahora se muta desde 2 endpoints distintos** (`save-selection/route.ts` en creación, `selection/[id]/tags/route.ts` en edición post-creación) — ambos con el mismo chequeo de ownership pero código separado (no factorizado en un helper compartido). Señalado por si en el futuro se agrega una tercera vía de mutación y conviene extraer un helper común — no se hizo en esta OE porque solo 2 call sites todavía no justifica la abstracción.

**Archivos modificados/nuevos:** `supabase/migrations/059_tags_color.sql` (nuevo), `src/lib/db/documentation.ts`, `src/app/api/tags/route.ts`, `src/app/api/tags/[id]/route.ts` (nuevo), `src/app/api/documentation/selection/[id]/tags/route.ts` (nuevo), `src/components/documentation/UserLibraryView.tsx`, `AISyncPlans.md`, `DECISIONS.md`, `PRODUCT_STATUS.md`.

### Ajuste mismo día — chips de tag con fondo completo del color + contraste automático

**Pedido:** en las cards de Save Selection, los chips de tag pasan de "punto de color chico + fondo neutro" a fondo completo del chip pintado con el color del tag, con texto blanco/negro calculado automáticamente por luminancia (fórmula estándar `0.299R + 0.587G + 0.114B`, blanco si `< 128`, negro si `>= 128`) para que ninguna combinación de los 8 colores de la paleta quede ilegible.

**Implementado:** nueva función `tagTextColor(hex)` en `UserLibraryView.tsx` (parsea hex 3 o 6 dígitos, calcula luminancia, devuelve `#FFFFFF`/`#000000`). El chip de tag dentro de cada card (`ss.tags.map(...)`) pasa de `<span className="...bg-[var(--color-surface-subtle)]...">` + punto de color separado, a `style={{ backgroundColor: bg, color: fg }}` sobre el chip completo (sin punto, sin borde — el fondo ya es el color). El botón "×" de "Remove tag" hereda el mismo `color: fg` para mantenerse legible sobre cualquier fondo.

**Sin tocar (confirmar con Agus si se quiere unificar a futuro):** el punto de color en la lista de tags del panel izquierdo queda como estaba (punto chico + texto en color de la app) — pedido explícitamente así por Agus para esta OE ("puede quedar como está"). Mi recomendación es dejarlo así: es una lista angosta y densa (nombre + contador + ícono editar en la misma fila), un chip de fondo completo ahí competiría visualmente con esos otros elementos: el punto ya cumple su función de identificar el color sin ese ruido.

**Verificación:** build ✅. Sin Claude in Chrome disponible no se hizo verificación visual en el momento; **confirmado por Agus el 2026-08-24** (tags con colores distintos, contraste de texto correcto en todos los casos).

### Ajuste mismo día — botones, separador, tags sin color, altura libre y párrafos preservados

**7 puntos pedidos por Agus sobre las cards de `UserLibraryView.tsx`:**

1. **Rename:** botón "Delete" → "Delete From Library" (único lugar donde aparecía).
2. **"Open Workspace →"** pasa de relleno azul sólido a estilo secundario/outline: `bg-[var(--color-surface-subtle)]` + `text-black` en vez de `bg-[var(--color-accent)]` + `text-white`.
3. **Borde engrosado** en ambos botones (`Open Workspace →` y `Delete From Library`): `border` (1px) → `border-2` (2px) en los 3 estados (Open Workspace, Delete normal, Delete confirmando).
4. **Separador `<hr>`** entre el bloque de texto/tags y la fila de botones, dentro de cada card.
5. **Tags sin color (NULL):** ya no heredan `DEFAULT_TAG_COLOR` (el azul del acento) — nueva constante `NO_COLOR_TAG_BG = '#E5E7EB'` (gris claro) + texto negro fijo, a propósito distinto de `DEFAULT_TAG_COLOR` (que sigue siendo el color inicial que ofrece el selector de "Edit Tag", no un color "real" heredado). Solo los tags con `color` explícito en la base pintan con `tagTextColor()`.
6. **Altura libre, ancho fijo:** grid ganó `items-start` (evita que CSS Grid estire todas las cards de una fila a la altura de la más alta — comportamiento default de `align-items: stretch`); se sacó `line-clamp-2` del preview.
7. **Párrafos preservados:** nueva función `stripMarkdownPreserveParagraphs()` en `src/lib/text/stripMarkdown.ts` — mismo stripping de sintaxis Markdown que `stripMarkdown()`, pero SIN colapsar `\n+` a espacio (solo normaliza 3+ líneas vacías a 1) y sin truncado agresivo (cap de seguridad en 4000 chars, no un largo de preview diseñado). Nuevo campo `DocSavedSelection.content_preview_full` en `documentation.ts`, poblado en paralelo a `content_preview` (que queda intacto, sin tocar). **Decisión importante:** NO se modificó `stripMarkdown()` ni el `content_preview` existente — ese campo/función es compartido con Repository View (`RepositoryView.tsx` lo consume para Checkpoint/Saved Selection/Handoff Package), tocarlo hubiera cambiado el comportamiento de esa vista sin que Agus lo pidiera. `UserLibraryView.tsx` es el único consumidor de `content_preview_full`, renderizado con `whitespace-pre-wrap` (sin `line-clamp`).

**Verificación:** build ✅. Grep confirmó que `RepositoryView.tsx` sigue usando `content_preview` (no `content_preview_full`) sin cambios. **Confirmado visualmente por Agus el 2026-08-24** (separador, botones con el nuevo estilo, tags con y sin color).

### Ajuste mismo día — layout mosaico, tope de altura con "Partial summary", filtros Project/Team

**3 puntos pedidos por Agus:**

1. **Layout mosaico (masonry):** el grid `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` (que fuerza altura pareja por fila vía CSS Grid `align-items: stretch`) pasa a CSS Columns: `columns-1 sm:columns-2 lg:columns-4 gap-4` en el contenedor, y cada card gana `break-inside-avoid mb-4` (el `gap` de CSS Columns solo separa columnas entre sí, no items apilados dentro de la misma columna — de ahí el `mb-4` en cada card). Con esto las cards de altura variable se acomodan compactas, sin huecos grandes debajo de las más cortas.
2. **Tope de altura + "Partial summary":** nueva constante `PREVIEW_CHAR_LIMIT = 420` (≈ 6-8 líneas de texto-xs en el ancho de una columna de mosaico) + función `truncatePreview()` en `UserLibraryView.tsx`. Es un corte por cantidad de caracteres, NO una medición real del DOM — pragmático porque el layout es responsive (1 a 4 columnas) y la altura real en píxeles depende del ancho de cada viewport, que solo se conoce en el navegador. Si `content_preview_full` excede el límite, se corta en el último espacio/salto de línea antes del límite y se agrega "…"; debajo aparece un botón "Partial summary — Expand for full content →" que abre el mismo modal de Expandir ya existente (única vía para ver el contenido completo). Si no excede, se muestra completo tal cual (sin cambios respecto al ajuste anterior).
3. **Filtros Project/Team:** mismo patrón exacto ya usado en `RepositoryView.tsx`/`AuditView.tsx`/`InvestigateView.tsx` (no hay un componente compartido real en el proyecto — cada vista replica el mismo `<select>` + lógica `uniqueProjects`/`uniqueTeams` inline) — replicado en `UserLibraryView.tsx`: `uniqueProjects` desde el prop `projects` (ya lo recibían las otras 4 vistas, agregado ahora también acá vía `DocClient.tsx`), `uniqueTeams` derivado de `savedSelections` acotado por `filterProject` si hay uno elegido, con el mismo `useEffect` que resetea `filterTeam` si deja de pertenecer al Project recién elegido. Filtran sobre `project_id`/`team_id` de cada Save Selection (ya resueltos vía JOIN desde la OE del fix de `project_id`, ver `documentation.ts`). Conviven (AND) con el filtro de tags existente — un botón "Clear" aparece solo cuando alguno de los 2 está activo.

**Archivos:** `src/components/documentation/UserLibraryView.tsx`, `src/components/documentation/DocClient.tsx` (agrega prop `projects` a `<UserLibraryView>`, ya estaba disponible en el componente padre — no requirió tocar `page.tsx`).

**Verificación:** lint ✅, build ✅. **Nota:** el layout mosaico (CSS Columns) y el truncado por caracteres (`PREVIEW_CHAR_LIMIT`) de este punto fueron reemplazados en la ronda siguiente (columnas manuales + tope de altura real) antes de cualquier verificación visual — el punto 3 (filtros Project/Team) sí llegó sin cambios hasta la aprobación final de Agus el 2026-08-24.

### Riesgo nuevo — PREVIEW_CHAR_LIMIT es una aproximación, no una medición real

El corte a 420 caracteres es una estimación basada en ancho/fuente típicos de una columna de mosaico — en una pantalla muy angosta (1 columna) o muy ancha (4 columnas), la altura visual real de esos 420 caracteres puede variar bastante (menos o más de las "6-8 líneas" buscadas). No se resolvió con medición real del DOM (`ResizeObserver`/`scrollHeight`) porque hubiera requerido convertir cada card en un componente con estado propio de "measured/truncated" — complejidad no pedida para un ajuste de este tamaño. Si en la verificación visual el corte se ve claramente mal calibrado en algún breakpoint, es la primera constante a ajustar (`PREVIEW_CHAR_LIMIT` en `UserLibraryView.tsx`).

**Superado por el ajuste siguiente (mismo día) — ver abajo:** Agus detectó el bug anticipado arriba (listas de nombres con muchas líneas cortas y pocos caracteres no se cortaban) y pidió reemplazar el corte por caracteres por un tope de altura real en píxeles. `PREVIEW_CHAR_LIMIT`/`truncatePreview()` fueron eliminados del archivo, no quedan como código muerto.

### Ajuste mismo día — columnas manuales (round-robin) + tope de altura real en píxeles por columna

**2 cambios de técnica pedidos por Agus, sobre el layout mosaico de la ronda anterior:**

1. **CSS Columns → 4 columnas manuales:** el contenedor `columns-1 sm:columns-2 lg:columns-4` (que dejaba la distribución de cards en manos del navegador) se reemplaza por un array `columns: DocSavedSelection[][]` armado a mano — `filteredSelections.forEach((ss, i) => columns[i % columnCount].push(ss))` (round-robin: card 0 → columna 0, card 1 → columna 1, card 2 → columna 2, card 3 → columna 3, card 4 → columna 0 de nuevo...). Cada columna se renderiza como su propio `flex flex-col gap-4` dentro de un `flex` horizontal — control total de qué card cae en qué columna, a diferencia de CSS Columns que decide el orden de llenado por su cuenta. Nuevo hook `useColumnCount()` mantiene el colapso responsive que tenía CSS Columns (1 columna <640px, 2 entre 640-1024px, 4 desde 1024px) vía `window.innerWidth` + listener de `resize` — sin este hook, la distribución round-robin fija en 4 hubiera roto el colapso en pantallas chicas que ya se había pedido explícitamente en una ronda anterior.
2. **Corte por caracteres → tope de altura real en píxeles:** nuevo componente `TruncatedPreview` (usa hooks — `useLayoutEffect` + `useRef` + `useState` — por eso es su propio componente, no puede vivir inline dentro del `.map()` del componente padre sin violar reglas de hooks). Renderiza el texto completo dentro de un `<p style={{ maxHeight, overflow: 'hidden' }}>` y mide `scrollHeight` vs `clientHeight` después de montar para saber si el contenido REALMENTE excede el tope — a diferencia del corte por caracteres anterior, esto es correcto para cualquier forma de contenido (una lista larga de líneas cortas ocupa muchas líneas con pocos caracteres; ahora se detecta por altura real, no por longitud de string). Cuando hay overflow real: degradado (`linear-gradient` de transparente a `var(--color-surface)`, para blend con el fondo de la card) + botón "More content — Expand →" superpuestos sobre las últimas líneas visibles, que abren el mismo modal de Expandir.
3. **Valores iniciales por columna** (`COLUMN_MAX_HEIGHTS = [220, 260, 190, 220]`, en píxeles) — arbitrarios, pedidos así por Agus para variar el ritmo visual entre columnas. Con menos de 4 columnas activas (breakpoints chicos) se reusa por índice módulo 4 (columna 0 y 1 en vista de 2 columnas usan 220px/260px). **A reportar/ajustar tras la verificación visual** — son un punto de partida, no un valor final medido contra contenido real.

**Archivos:** `src/components/documentation/UserLibraryView.tsx` (único archivo tocado).

**Verificación:** lint ✅, build ✅. **Confirmado visualmente por Agus el 2026-08-24** — 4 columnas con topes distintos, cards largas (incluidas listas de nombres) cortándose correctamente con el indicador de "más contenido", Expandir mostrando el contenido completo; `COLUMN_MAX_HEIGHTS` aprobado sin pedir ajustes a los valores propuestos.

### Ajuste mismo día — borde de card más grueso, título con más jerarquía tipográfica

**2 puntos pedidos por Agus, ajuste fino sobre la card ya construida:**

1. **Borde de card engrosado:** `border border-[var(--color-border-subtle)]` → `border-2 border-[var(--color-border-default)]` — además de más grueso (1px → 2px), se usa el token de borde más marcado (`--color-border-default`, el mismo que ya usan los botones "Open Workspace →"/"Expand" dentro de la misma card) en vez del sutil, para que las cards se separen mejor entre sí en el mosaico.
2. **Título con más jerarquía editorial:** `text-[13px] font-semibold` → `text-[16px] font-bold tracking-tight leading-snug`. Sin agregar color nuevo ni elemento decorativo — solo tamaño, peso, tracking y line-height (pedido explícito de Agus: "solo tipografía"). Se mantiene `truncate` (una sola línea) para no desestabilizar el layout de columnas manuales de la ronda anterior.

**Archivo:** `src/components/documentation/UserLibraryView.tsx` (único archivo tocado).

**Verificación:** lint ✅, build ✅. **Nota:** el borde grueso de este punto fue reemplazado en la ronda siguiente (fondo blanco + sombra sutil) antes de la verificación visual final — el tamaño/tipografía del título se ajustó de nuevo también en esa ronda (serif + 18px).

### Ajuste mismo día — título serif clásico, separación visual vía blanco puro + sombra (reemplaza el borde grueso)

**2 puntos pedidos por Agus, sobre la card del ajuste anterior:**

1. **Título serif:** `text-[16px] font-bold tracking-tight leading-snug` → `text-[18px]` + `style={{ fontFamily: "Georgia, 'Book Antiqua', Palatino, serif" }}` (stack websafe pedido explícitamente, no el `font-serif` default de Tailwind — que en este proyecto no está customizado y usa `ui-serif, Georgia, Cambria, "Times New Roman", Times, serif`, distinto del stack pedido). Peso/tracking/line-height del ajuste anterior sin tocar — solo tamaño y tipografía, resto de la card intacto (pedido explícito).
2. **Separación visual — reemplaza el borde grueso del ajuste anterior, no lo suma:** `border-2 border-[var(--color-border-default)]` → `border border-[var(--color-border-subtle)]` (vuelve al grosor/color sutil original) + `bg-[var(--color-surface)]` → `bg-white` (verificado en `tokens.css`: `--color-surface` YA es `#ffffff` — no había ningún blanco grisáceo real, pero se usa `bg-white` explícito de todas formas para no depender de la resolución de la variable) + `shadow-sm` nuevo (sombra sutil de Tailwind, elevación mínima). Interpretación de "en vez de solo engrosar el borde": el pedido pide reemplazar la dependencia del borde grueso por estos 2 tratamientos nuevos, no sumar sombra+blanco ENCIMA del borde grueso — combinar borde grueso + sombra hubiera quedado "recargado" (justo lo que la verificación visual pide confirmar que NO pase).

**Archivo:** `src/components/documentation/UserLibraryView.tsx` (único archivo tocado).

**Verificación:** lint ✅, build ✅. **Confirmado visualmente por Agus el 2026-08-24** — título serif y fondo blanco + sombra sutil aprobados, cards bien diferenciadas sin sentirse recargadas.

---

## OE 2026-08-24 — Workspace: 4 ajustes de UX + corrección del ribbon (breadcrumb con Sub-Teams)

**Fecha:** 2026-08-24
**Estado:** Closed — **confirmación visual positiva de Agus de los 5 puntos** (ribbon con breadcrumb, logo → Teams Map, límite de conexiones a 10, provider default correcto, fix de Mac). lint ✅, build ✅. Commit + push ejecutados en este cierre.

**Contexto:** consigna original de 4 ajustes sobre Workspace (2 directos, 2 con diagnóstico previo obligatorio antes de implementar). Ya cerrado el bloque de los 4, Agus pidió extender el Ajuste 1 (ribbon superior) para reflejar la jerarquía completa de Sub-Teams — no solo Project/Team. En el medio, un incidente aparte (no de código) interrumpió la verificación: ver nota al final de esta entrada.

### 1. Ribbon superior — breadcrumb completo (Project/Team raíz/Sub-Team/…)

Pedido inicial: `[Project]/[Team]` en el centro del ribbon de Workspace. Agus lo extendió el mismo día a la jerarquía completa vía `parent_id` (mecanismo ya usado por Teams Map, Bloque 7).

`src/app/workspace/[id]/page.tsx`: nueva función `buildTeamAncestorChain(teamId, allTeams)` — sube por `parent_id` desde el team actual hasta la raíz, con un `Map` para lookup O(1) y un tope defensivo `MAX_ANCESTOR_DEPTH = 50` (agregado a pedido de Agus tras el diagnóstico del incidente de abajo — no ligado a ningún bug real encontrado, puramente preventivo ante un ciclo de datos hipotético). Reusa la misma query `projectTeams` que ya se hacía para el color del ribbon (`computePaletteIndexForTeam`) — se le agregó la columna `name` que faltaba, sin query nueva de más; las 2 queries del bloque (`projects.name` + `teams` del Project) ahora corren en paralelo vía `Promise.all`.

`TopRibbon.tsx`: nuevo prop opcional `pageNameSegments?: string[]`. Con 2+ elementos, cada segmento se renderiza separado por "/", todos en `font-light` excepto el último (el team donde está parado el usuario) en `font-bold`. Sin el prop (todas las demás vistas: Dashboard, Audit, Documentation, Context, Teams Map), cae al `pageName` plano de siempre — cero impacto fuera de Workspace. `WorkspaceClient.tsx` solo pasa el prop nuevo hacia abajo.

Caso sin Sub-Teams (el más común hoy): sigue siendo `Project/Team`, con Team en negrita — comportamiento sin cambios para ese caso.

### 2a. Fix — ribbon inferior desaparece en Mac (diagnosticado y confirmado antes de implementar)

**Causa:** `h-screen` (Tailwind → `height: 100vh`) como contenedor de layout + `BottomRibbon` en `position: sticky`. En Safari/macOS, `100vh` no se recalcula cuando la barra de herramientas del navegador cambia de tamaño — el contenedor queda más alto que el viewport visible real, empujando el ribbon sticky fuera de pantalla. No es exclusivo de Workspace (mismo patrón en Dashboard/Teams, Audit, Documentation, Context) — Workspace es donde más se nota por el foco/scroll constante del chat.

**Fix confirmado con Agus:** `h-screen` → `h-dvh` (dynamic viewport height, soportado nativamente desde Tailwind 3.4.1, ya la versión del proyecto) en **6 lugares**: `WorkspaceClient.tsx`, `TeamsClient.tsx`, `AuditClient.tsx`, `DocClient.tsx`, `ContextPageClient.tsx`, y un 6to hallado por grep exhaustivo que no estaba en la lista original — `AppLayout.tsx` (rama `scrollable={false}`, usada por `/admin`) — confirmado por Agus para incluirlo también.

Sin dispositivo Mac disponible para verificación directa esta sesión — es el fix estándar y documentado para este patrón. **Confirmado por Agus el 2026-08-24** tras probar en su Mac real.

### 2b. Logo → Teams Map

`TopRibbon.tsx`: el link del logo (arriba a la izquierda) pasó de `/start` (página de inicio en desuso) a `/teams` (Teams Map). `TopRibbon` es compartido por toda la app — aplica en las 6 vistas, no solo Workspace.

### 3. Connect Team — límite total 2 → 10

`src/lib/constants/connectionLimits.ts`: `MAX_ACTIVE_CONNECTIONS_PER_ACCOUNT` de 2 a 10. Grep exhaustivo confirmó un solo lugar de definición, usado en los 2 únicos call sites reales (`POST /api/connections`, `PATCH /api/connections/[id]` accept). `MAX_ACTIVE_CONNECTIONS_PER_PAIR` (1 conexión activa por par de cuentas) se mantiene sin cambios — regla separada, no pedida.

### 4. Provider default de SAT/Connect Team (diagnosticado y confirmado antes de implementar)

**Causa (2 lugares, mismo problema de fondo — ninguno consultaba `user_api_keys`):**
1. `AddTeamModal.tsx` — provider default de SAT hardcodeado en el estado inicial (`'Anthropic'`).
2. `PATCH /api/connections/[id]` (accept) — el team aislado del **Invitee** heredaba ciegamente el provider que el **Host** usaba en su propio team (`firstSession.provider`), sin mirar las keys del Invitee.

**Lógica aprobada por Agus:** 1 provider configurado → ese; 2+ → prioridad Anthropic > OpenAI > Google; 0 → comportamiento actual (`'Anthropic'` hardcoded).

**Implementación:** nuevo helper puro `src/lib/providers/pickDefaultProvider.ts` (`pickDefaultProvider()` + `pickDefaultModel()`, sin dependencias de React/Supabase — usable client y server-side), usado en ambos lugares:
- `AddTeamModal.tsx`: nuevo `useEffect` que consulta `GET /api/settings/keys` (mismo endpoint que ya usa Settings, sin endpoint nuevo) y aplica el default calculado — con un flag `satProviderTouched` para no pisar una elección manual del usuario si llega a tocar el selector antes de que resuelva el fetch.
- `PATCH /api/connections/[id]`: el bloque del **Host** queda sin cambios (`defaultProvider`/`defaultModel`, ya refleja su propia elección). El bloque del **Invitee** ahora consulta sus propias `user_api_keys` y calcula `inviteeDefaultProvider`/`inviteeDefaultModel` — corrige de paso un mismatch preexistente (el fallback hardcodeado de modelo era `'Claude 3.5 Sonnet'`, un nombre que no existe en ningún otro lugar del proyecto; `pickDefaultModel()` ahora mantiene provider/modelo sincronizados si el provider del Invitee difiere del Host).

**Fuera de alcance, confirmado con Agus:** MAT no se tocó (por diseño usa providers distintos por worker a propósito). El team del Host en el accept tampoco se tocó (ya reflejaba su propia elección).

### Incidente en el medio — "Internal Server Error" (no era código, ver CodingWorkshop.md 2026-08-24)

Entre el cierre del bloque de 4 ajustes y la corrección del breadcrumb, Agus reportó `Internal Server Error` global en localhost. Diagnóstico solo-lectura confirmó que la causa era un servidor Next ya corriendo en el puerto 3000 (arrancado antes de la sesión) sirviendo contra una carpeta `.next` reescrita 3 veces por los `npm run build` de cierre de cada bloque — mismatch de manifests en memoria vs. disco, no relacionado a ningún código de esta OE. Confirmado con un `next dev` limpio en otro puerto (respondió normal) antes de tocar nada. Fix: reinicio manual del servidor de Agus (no del lado del código). Detalle completo en `CodingWorkshop.md` 2026-08-24.

### Verificación

lint ✅ y build ✅ en cada ronda de esta OE, sin errores ni warnings nuevos (mismos 3 warnings preexistentes de `CanvasViewport.tsx`, no tocados). **Confirmación visual positiva de Agus (2026-08-24) de los 5 puntos:** ribbon con breadcrumb completo (Project/Team/Sub-Teams, último en negrita), logo → Teams Map, límite de conexiones a 10, provider default correcto, fix de Mac (h-dvh).

### Alternativas descartadas

Ver DECISIONS.md 2026-08-24 para el detalle completo (breadcrumb vs. solo Project/Team, alcance del fix de `h-dvh`, por qué MAT y el lado Host del accept no se tocaron).

### Riesgos conocidos / deuda técnica

- **`buildTeamAncestorChain()` corta a 50 niveles** ante un ciclo de `parent_id` — defensa preventiva, no hay forma conocida de crear ese ciclo desde la UI actual.
- **Grep exhaustivo de `h-screen` confirmó un 7mo lugar fuera de alcance:** `src/components/teams/preview/TeamsMapV3Preview.tsx` (componente de preview, no en producción, código sin trackear en git al momento de esta OE) — no corregido, señalado por si ese preview se promueve a producción en el futuro.
- **No verificar Mac real esta sesión de mi lado** — la confirmación de Agus fue posterior a un `npm run build` que rompió su servidor temporalmente (ver incidente arriba); quedó resuelto con su reinicio manual.

**Archivos modificados/nuevos:** `src/app/workspace/[id]/page.tsx`, `src/components/layout/TopRibbon.tsx`, `src/components/layout/AppLayout.tsx`, `src/components/workspace/WorkspaceClient.tsx`, `src/components/teams/TeamsClient.tsx`, `src/components/audit/AuditClient.tsx`, `src/components/documentation/DocClient.tsx`, `src/app/context/ContextPageClient.tsx`, `src/lib/constants/connectionLimits.ts`, `src/lib/providers/pickDefaultProvider.ts` (nuevo), `src/components/teams/AddTeamModal.tsx`, `src/app/api/connections/[id]/route.ts`, `AISyncPlans.md`, `DECISIONS.md`, `CodingWorkshop.md`, `PRODUCT_STATUS.md`.

### Continuación misma OE (2026-08-24) — Breadcrumb: 3 rondas más de refinamiento tras la primera confirmación visual

Después del cierre y push de la OE de arriba (commit `2f71448`), Agus pidió 3 ajustes más sobre el breadcrumb del ribbon, todos sobre `TopRibbon.tsx` únicamente. Se documentan juntos acá porque son continuación directa del mismo Ajuste 1, no una OE nueva.

**Ronda 1 — colapso a 4+ niveles:** nueva función `buildBreadcrumbItems(segments)` — con 3 o menos segmentos, cadena completa sin cambios (comportamiento de la OE original). Con 4+, colapsa a `Project / (...) / último Sub-Team`: el primer y el último segmento siempre visibles, todo lo intermedio detrás de un `(...)` con tooltip. El tooltip reusa el mismo patrón visual que ya existía en el proyecto para el badge "Coming soon" de `BottomRibbon.tsx` (`group`/`group-hover:opacity-100`, fondo gris oscuro) — pero abriendo hacia abajo (`top-full`) en vez de hacia arriba, porque este ribbon está arriba de la pantalla y no del bottom.

**Ronda 2 — sin mayúsculas forzadas:** se sacó la clase `uppercase` únicamente del `<span>` que envuelve el breadcrumb (`pageNameSegments`). El `pageName` plano de las demás vistas (Documentation Mode, Teams Map, etc., cuando no viene `pageNameSegments`) mantiene su `uppercase` intacto — cambio acotado a un solo `className`, confirmado con lint/build que no afectó otro texto. El subtítulo "How to work in Workspace" se revisó y **nunca tuvo `uppercase`** en ninguna de sus 3 variantes (link/botón/texto plano) — no había nada que cambiar ahí, se lo reportó así en vez de tocar código sin necesidad.

**Ronda 3 — tooltip con cadena completa (no solo lo colapsado):** el tooltip pasó de mostrar `middle.join(' / ')` (solo los niveles ocultos) a `segments.join(' / ')` (todos los segmentos reales, de punta a punta, incluyendo Project y el último Sub-Team que ya se ven fuera del colapso). El hover se mantuvo donde ya estaba armado — sobre el `(...)` — en vez de extenderlo a todo el breadcrumb, decisión tomada porque el pedido daba margen explícito ("donde tenga más sentido") y el `(...)` ya es el elemento que comunica visualmente "hay más para ver acá". Comportamiento de aparición/desaparición es CSS `group-hover` estándar — sin JS de estado, sin click, desaparece solo al retirar el mouse.

**Verificación:** lint ✅ y build ✅ en las 3 rondas. **Confirmación visual positiva de Agus (2026-08-24)** en cada ronda — colapso a 4+ niveles funcionando, capitalización normal confirmada, tooltip con cadena completa apareciendo/desapareciendo correctamente al hover.

**Archivo modificado:** `src/components/layout/TopRibbon.tsx` (único archivo tocado en las 3 rondas).

---
