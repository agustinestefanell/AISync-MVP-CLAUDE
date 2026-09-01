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

## OE 2026-08-26 — Investigate View: 3 acciones sobre el ancla, fix de título "Loaded Context", Load as Context en las 5 vistas, panel siempre abierto, resaltado con relleno, selector de destino real

**Fecha:** 2026-08-26
**Estado:** Closed — **confirmación visual positiva de Agus** en las 4 vistas (preselección de origen, cambio de Project/Team, exclusión de Connected/Shared, toast con destino real). lint ✅, build ✅ en cada ronda. Commit + push ejecutados en este cierre.

**Contexto:** sesión con varias rondas de diagnóstico + implementación + corrección sobre Documentation Mode, encadenadas en el mismo hilo:
1. Diagnóstico de esfuerzo (solo lectura) de 3 botones propuestos sobre el ancla seleccionada en Investigate View: "Open Evidence", "Load as Context", "Audit This".
2. Implementación de los 3, confirmada por Agus.
3. Ajustes de UX pedidos sobre Documentation Mode en general (toast, panel siempre abierto, resaltado) — en el medio, malentendido sobre si hacía falta un botón nuevo de "Load as Context" o si el problema real era el título genérico de "Loaded Context"; se resolvió con un pedido consolidado que hacía ambas cosas.
4. Corrección: la primera versión de "Load as Context" resolvía Team/Project automáticamente sin preguntar — no era lo pedido. Se reescribió con un selector de destino real.

### 1. Diagnóstico de esfuerzo — 3 botones sobre el ancla (solo lectura, sin código)

Reportado antes de escribir nada: **"Open Evidence"** (chico) — reusa los 3 endpoints ya existentes (`GET /api/documentation/{checkpoint|handoff|selection}/[id]`), Review & Forward no lo necesita (contenido ya inline). **"Load as Context"** (mediano, en su versión original solo-Investigate) — el contenido se resuelve gratis, pero resolver "a qué Workspace/sesión" desde una vista sin Workspace abierto no es automático. **"Audit This"** (casi gratis) — Investigate View y Audit View son tabs del mismo `DocClient`, así que el mecanismo correcto es el que ya usa el SM lateral (`selectedAuditKey`), no el deep-link de query params de Structure View (pensado para abrir una página nueva, no para cambiar de tab en memoria).

### 2. Implementación inicial — los 3 botones en Investigate View

- **`src/lib/documentation/anchors.ts`:** nuevos helpers `anchorEvidenceUrl(item)` (URL del endpoint de contenido completo por tipo de ancla — Loaded Context resuelve en cascada contra `origin_type`/`origin_id`, Review & Forward vuelve `null`) y `anchorContextOrigin(item)` (par `originType`/`originId` para `POST /api/context`, mismo criterio de exclusión).
- **`src/components/documentation/ExpandContentModal.tsx` (nuevo):** modal "Expandir" genérico — mismo patrón visual que ya vivía duplicado en `UserLibraryView.tsx`/`EditTeamModal.tsx` (overlay + header/body scrolleable + footer). Recibe `fetchUrl` y lista mensajes `{role, content, agent_role}`.
- **`src/components/documentation/InvestigationScanPanel.tsx`:** 3 botones nuevos sobre el ancla — "Open Evidence" (abre `ExpandContentModal`), "Load as Context" (lógica inline en esta ronda, migrada a componente compartido en la ronda siguiente), "Audit This" (`onAuditThis(key)`).
- **`src/components/documentation/InvestigateView.tsx`/`DocClient.tsx`:** callback `onAuditThis` enhebrado `DocClient → InvestigateView → InvestigationScanPanel` — reusa el mismo `setTab('audit')`/`setSelectedAuditKey(key)` que ya usaba `handleOpenSearchResult` del SM, sin lógica nueva.

**Verificación:** lint ✅, build ✅ (se encontró y limpió una caché `.next` corrupta de una sesión anterior, incidente ya conocido, no relacionado al código).

### 3. Fix — título de "Loaded Context" mostraba texto genérico en vez del nombre real

**Diagnóstico confirmado:** `anchorTitle()` para `flavor: 'chat'` devolvía el literal `'Loaded into Chat'` en vez del nombre real del objeto origen — la rama hermana (`flavor: 'context_files'`) sí traía el nombre real porque `context_sources.title` ya lo guarda desde que se creó. Ver detalle completo en `CodingWorkshop.md` 2026-08-26.

**Fix:** `buildAnchors()` (`anchors.ts`) ya recibe `checkpoints`/`handoffPackages`/`savedSelections` completos — se agregaron 3 `Map<id, name>` y `resolveOriginName()`, sin query ni fetch nuevo. `anchorTitle()` simplificado a `return item.lc.title` en ambos flavors. El texto "Loaded into Chat"/"Loaded to Context Files" pasa a ser un badge aparte (`LOADED_CONTEXT_FLAVOR_LABEL`, exportado de `anchors.ts`), renderizado al lado del título — nunca el título en sí — en las listas de `AuditView.tsx` e `InvestigateView.tsx`.

### 4. Load as Context — extendido a las 5 vistas (Knowledge Map excluida)

**Paso 0 (diagnóstico, reportado antes de implementar):** Repository View, Audit View, Investigate View y User Library ya tienen paneles/cards de detalle por ítem — directo. **Knowledge Map confirmada NO viable:** grafo ReactFlow puro, sin `onNodeClick` ni ningún mecanismo de selección de nodo/panel de detalle (`KnowledgeMap.tsx`) — construirlo sería una OE aparte, mayor que las otras 4 vistas juntas. Frenado y reportado, no implementado.

**`src/components/documentation/LoadAsContextButton.tsx` (nuevo, componente compartido):** único lugar que resuelve fetch de contenido + `POST /api/context` + confirmación con destino real — evita repetir la lógica async en 4+ paneles. Usado en:
- `InvestigationScanPanel.tsx` (migrado de la lógica inline de la ronda 2)
- `AuditDetailPanel.tsx` (nuevo, recibe `projects`/`evidenceUrl`/`contextOrigin` de `AuditView.tsx`)
- `RepositoryView.tsx` — los 3 paneles de detalle (`CheckpointDetailPanel`/`HandoffDetailPanel`/`SavedSelectionDetailPanel`)
- `UserLibraryView.tsx` — cada card de Save Selection

Alcance: solo destino "→ Context Files", sin "→ Chat" (requeriría selector de Workspace/sesión aparte, no construido esta sesión).

### 5. Panel derecho siempre abierto — Audit View e Investigate View

Replican ahora el patrón exacto de Repository View: contenedor de lista `${selectedItem ? 'w-1/2' : 'flex-1'}` + `border-r` incondicional (antes condicional a `selectedItem`), y un bloque `!selectedItem && <div className="hidden md:flex flex-1 items-center justify-center ...">Select a document to view details</div>` — antes, sin selección, el panel derecho simplemente no existía.

### 6. Resaltado del ítem seleccionado — relleno de fondo, no solo borde

Diagnóstico confirmó que Repository View **tampoco** usaba relleno de fondo (solo `border-indigo-500 ring-1 ring-indigo-500`) — la premisa del pedido ("igualar a Repository View si ya usa relleno") no aplicaba tal cual. Se aplicó un tratamiento nuevo (`bg-indigo-50 border-indigo-400 ring-1 ring-indigo-200`) a las 3 vistas por igual (Repository, Audit, Investigate), reemplazando el borde-only en las 3.

### 7. Corrección — selector de destino real en "Load as Context" (reemplaza auto-resolución)

**Malentendido identificado por Agus:** la versión de los puntos 2 y 4 resolvía Team/Project automáticamente desde la meta del ancla, sin preguntar nada — no era lo pedido. El pedido real: un selector que arranca en el Project/Team de origen pero permite cambiar a cualquier otro Project/Team **100% propio del usuario**.

**`LoadAsContextButton.tsx` reescrito completo:** al hacer click abre un popover (mismo patrón visual que "+ Add tag" de `UserLibraryView.tsx` — `absolute top-full ... shadow-lg`, sin click-outside listener, igual que ese precedente) con:
- **Project:** dropdown con todos los `projects` del usuario, preseleccionado en `originProjectId`.
- **Team:** dropdown dependiente del Project elegido (`eligibleTeamsFor()`), preseleccionado en `originTeamId` si pertenece al Project elegido — **excluye siempre `type === 'isolated'`** (Connected/Shared Teams, riesgo de seguridad cross-cuenta) — si el Team de origen fuera uno de esos, cae al primer Team elegible del Project.
- Si el Project elegido no tiene ningún Team elegible, el dropdown lo indica y "Confirm" queda deshabilitado.
- Recién al apretar "Confirm" se ejecuta el fetch (`evidenceUrl`) + `POST /api/context` con `scope: 'team'` y el Team/Project realmente elegidos (ya no depende de si el origen tenía o no Team).
- Confirmación inline ("Loaded to Context Files — Team: X, Project: Y", auto-oculta a los 6s) con el destino REAL usado.

**Props nuevos enhebrados en los 4 call sites** (`projects`, `originProjectId`, `originTeamId` reemplazan a `teamId`/`teamName`/`projectId`/`projectName`): `InvestigationScanPanel`/`InvestigateView`, `AuditDetailPanel`/`AuditView`, los 3 paneles de `RepositoryView` (ya recibían `projects` a nivel de vista, solo hubo que threadearlo un nivel más), `UserLibraryView` (ya tenía `projects` en scope directo, sin threading).

### Verificación

lint ✅ y build ✅ en cada ronda de esta OE (mismos 3 warnings preexistentes de `CanvasViewport.tsx` ×3 archivos, no tocados). **Confirmación visual positiva de Agus:** título real + badge en un ítem Loaded Context (Audit e Investigate); "Load as Context" funcionando en las 4 vistas con selector de destino, preselección de origen, cambio de Project/Team, exclusión de Connected/Shared Teams confirmada, toast con destino real; panel derecho abierto por default en Audit e Investigate con el estado vacío; ítem seleccionado con el nuevo resaltado de fondo.

### Alternativas descartadas

- **Migrar `UserLibraryView.tsx`/`RepositoryView.tsx` a consumir el nuevo `ExpandContentModal`** — descartado en esta OE, no pedido tocar vistas que ya funcionaban; señalado como candidato a unificar a futuro (ver DECISIONS.md).
- **Endpoint dedicado `GET /api/context/[id]`** para leer contenido de `context_sources` — descartado, no existe (solo `DELETE`) y no hacía falta: el contenido de un ancla Loaded Context se resuelve igual de bien vía `origin_type`/`origin_id` contra los 3 endpoints ya existentes.
- **Toast global (portal/context provider)** — descartado a favor de confirmación inline por instancia de `LoadAsContextButton`, mismo criterio ya usado en el resto de la app para feedback puntual.
- **Auto-resolución de Team/Project sin selector** — descartado explícitamente por Agus tras la primera implementación, ver punto 7.
- **Implementar Load as Context en Knowledge Map** — descartado esta sesión, requiere infraestructura de selección de nodo que no existe (ver punto 4).

### Riesgos conocidos / deuda técnica

- **`ExpandContentModal` sin migrar en `UserLibraryView.tsx`/`RepositoryView.tsx`** — 3 implementaciones del mismo patrón visual siguen coexistiendo con la nueva versión compartida (ahora 4ta), señalado, no resuelto.
- **`LoadAsContextButton` sin click-outside listener** — mismo criterio que el popover "+ Add tag" de `UserLibraryView.tsx` (precedente ya existente en el proyecto), pero significa que el popover solo se cierra con "Cancel", "Confirm", o clickeando el botón de nuevo — no al clickear afuera.
- **`workspaceId` en `POST /api/context` sigue siendo el Workspace de origen del ancla**, incluso si el usuario elige un Team/Project de destino distinto — decisión implícita (no gatea visibilidad en runtime, confirmado contra `getContextSourcesForRuntime()` que solo filtra por `team_id`/`project_id`/`session_id`, nunca `workspace_id`), pero queda como dato "informativo" potencialmente inconsistente con el Team elegido. No señalado como bug — el campo nunca tuvo esa expectativa.
- **Load as Context "→ Chat" queda fuera de alcance** en las 5 vistas — decisión de producto explícita, no pendiente omitido (requeriría selector de Workspace/sesión aparte).

**Archivos modificados/nuevos:** `src/lib/documentation/anchors.ts`, `src/components/documentation/ExpandContentModal.tsx` (nuevo), `src/components/documentation/LoadAsContextButton.tsx` (nuevo), `src/components/documentation/InvestigationScanPanel.tsx`, `src/components/documentation/InvestigateView.tsx`, `src/components/documentation/AuditDetailPanel.tsx`, `src/components/documentation/AuditView.tsx`, `src/components/documentation/RepositoryView.tsx`, `src/components/documentation/UserLibraryView.tsx`, `src/components/documentation/DocClient.tsx`, `AISyncPlans.md`, `DECISIONS.md`, `CodingWorkshop.md`, `PRODUCT_STATUS.md`.

---

## OE 2026-08-26 — Teams Map: agrandar título de Team en las cards

**Fecha:** 2026-08-26
**Estado:** Closed — sin verificación visual directa esta sesión (sin Claude in Chrome disponible), confirmación pendiente de Agus tras reiniciar su servidor local (ver incidente abajo). lint ✅, build ✅.

**Contexto:** Agus pidió agrandar el título del Team en las cards de Teams Map (ej. "F-00 · ANN"), difícil de leer. 2 rondas: un ajuste chico inicial y, tras confirmar que no se notaba lo suficiente, un ajuste moderado.

### 1. Diagnóstico — componente equivocado la primera vez

Localicé primero `TreeWorkspaceCard` **dentro de `src/components/teams/map/TeamAgentCard.tsx`** (mismo patrón `${teamCode} · ${node.teamName}`) y edité ahí — pero un grep exhaustivo de `TeamAgentCard` en todo `src/` confirmó que **ese archivo no se importa desde ningún lado**: es código muerto. Revertido antes de seguir.

**Componente real:** `TeamsClient.tsx` → `MapView.tsx` (dynamic import) → `TreeWorkspaceCard` importado de `./v3/TreeWorkspaceCard` — confirmado por los 3 call sites reales en `MapView.tsx` (nodo raíz/GM, Worker, Team/Sub-team manager), todos pasando por el mismo bloque de título (línea ~169 del componente).

### 2. Ajuste chico (17px/14px) — insuficiente

Primer cambio en `src/components/teams/v3/TreeWorkspaceCard.tsx`: `text-[14px]`/`text-[12px]` (compact) → `text-[17px]`/`text-[14px]`. Confirmado con Agus que no se notaba lo suficiente.

**Diagnóstico pedido antes de la 2da ronda — confirmado `transform: scale()`:** el canvas de Teams Map (`v3/CanvasViewport.tsx`) aplica `contentRef.current.style.transform = translate3d(...) scale(${zoom})`, y el `zoom` inicial se auto-calcula para que todo el árbol entre en pantalla: `Math.min(initialZoom, availableWidth/contentWidth, availableHeight/contentHeight) * 0.92` — típicamente bien por debajo de 1x con varios teams/workers en pantalla. Esto explica por qué un salto de 3px en el CSS se sentía mucho más chico en pantalla real (escalado hacia abajo junto con el resto del canvas).

### 3. Ajuste moderado (19px/16px) — final

Con el diagnóstico del scale confirmado, segundo cambio en el mismo archivo/línea: `text-[17px]`/`text-[14px]` → **`text-[19px]`/`text-[16px]`** (compact) — punto intermedio entre el salto chico anterior y un extremo, pedido explícitamente así por Agus.

### Incidente — servidor local sirviendo build vieja (mismo patrón ya documentado 2026-08-24)

Al intentar verificar visualmente, encontré el puerto 3000 ocupado por un servidor de **producción** (`next start`, proceso `start-server.js`) arrancado antes de mis `npm run build` de esta sesión — la carpeta `.next` fue reescrita después de que ese servidor arrancara, así que estaba sirviendo código viejo (sin ninguno de los cambios de sesiones anteriores, no solo este). Contraprueba: levanté un `next dev` limpio en el puerto 3002 (sin tocar el server de Agus en 3000) — respondió `307` (redirect a login), confirmando que el código compila y sirve normal. Sin Claude in Chrome disponible para loguearme y ver la card real. Comuniqué a Agus que necesita reiniciar su servidor en 3000 para ver el cambio.

### Verificación

lint ✅, build ✅ en ambas rondas. **Sin verificación visual directa** (ver incidente arriba) — pendiente confirmación de Agus tras reiniciar su servidor.

### Alternativas descartadas

- **Editar `TeamAgentCard.tsx`** — descartado tras confirmar que es código muerto sin ningún import real.
- **Saltar directo a un tamaño extremo** — descartado, Agus pidió explícitamente un punto intermedio "claramente perceptible pero sin dominar la card", no el extremo.

### Riesgos conocidos / deuda técnica

- **`src/components/teams/map/TeamAgentCard.tsx` sigue existiendo como código muerto** (no se borró, no era parte del pedido) — mismo patrón visual de `TreeWorkspaceCard` duplicado sin uso real; candidato a limpieza futura si se confirma que no se planea reactivar.
- **Verificación visual pendiente** — depende de que Agus reinicie su servidor local (ver incidente).

**Archivo modificado:** `src/components/teams/v3/TreeWorkspaceCard.tsx` (único archivo con cambio efectivo — la edición en `TeamAgentCard.tsx` fue revertida en la misma sesión).

---

## OE 2026-08-26 — Fix: contenido guardado se mostraba en Markdown crudo (no renderizado) en Documentation Mode y Audit Log

**Fecha:** 2026-08-26
**Estado:** Closed — pendiente validación visual de Agus (screenshot del informe con tabla vía "Expandir" en User Library). lint ✅, build ✅.

**Contexto:** el chat en vivo (`AgentPanel.tsx`/`HumanChatPanel.tsx`) renderiza Markdown real (react-markdown + remark-gfm) — pero al guardar ese mismo contenido (Save Selection, Checkpoint, Handoff, Review & Forward) y volver a verlo en Documentation Mode o en el Audit Log global, se mostraba el texto crudo (`###`, `**`, `| tabla |` sin parsear).

### Diagnóstico

Confirmado que el chat en vivo usa `react-markdown` + `remark-gfm` con una config de `components` custom (`MARKDOWN_COMPONENTS`/`REMARK_PLUGINS`, definida localmente en `AgentPanel.tsx` y duplicada casi igual en `HumanChatPanel.tsx`). Grep exhaustivo de `ReactMarkdown`/patrones `{msg.content}`/`{...content}` confirmó **6 lugares** que mostraban contenido guardado completo como texto plano (no las previews cortas, que ya usan `stripMarkdown()`/`stripMarkdownPreserveParagraphs()` server-side y están bien):
1. `ExpandContentModal.tsx` (compartido — Investigate View "Open Evidence")
2. `UserLibraryView.tsx` — su propio modal "Expandir" inline (el que Agus probó y donde confirmó el bug)
3. `InvestigationScanPanel.tsx` — bloque "Forwarded content" (Review & Forward)
4. `AuditDetailPanel.tsx` — mismo bloque "Forwarded content" (Audit View, Documentation Mode)
5. `src/components/audit/AuditTimeline.tsx` — bloque "Forwarded content" del Audit Log **global** (`/audit`, distinto de Audit View de Documentation Mode)
6. `src/components/audit/AuditTimeline.tsx` — modal de detalle de Checkpoint (mensajes completos por agente)

**No es exclusivo de `ExpandContentModal`** — el mismo bug de fondo (texto plano en vez de Markdown) estaba repetido en 6 lugares distintos, 2 de ellos en el Audit Log global (`/audit`), fuera de Documentation Mode.

**Encontrado pero fuera de alcance, señalado:** `SMPanel.tsx` (`renderAssistantMessage`) tampoco renderiza Markdown — pero es el chat propio del SM (Sub-Manager), no contenido guardado reabierto; nunca tuvo el comportamiento correcto que se estaría "perdiendo" al guardar. No tocado en esta OE.

### Fix

**`src/lib/markdown/documentMarkdown.tsx` (nuevo)** — porta tal cual `MARKDOWN_COMPONENTS`/`REMARK_PLUGINS` de `AgentPanel.tsx` (el chat en vivo) a un módulo compartido (`DOCUMENT_MARKDOWN_COMPONENTS`/`DOCUMENT_MARKDOWN_REMARK_PLUGINS`), para no duplicar la config en cada uno de los 6 lugares. `AgentPanel.tsx`/`HumanChatPanel.tsx` **no se tocaron** — mantienen sus copias locales (ya funcionan bien, evita riesgo en el código de chat en vivo por un fix que no lo necesita).

Los 4 lugares de contenido completo/sin truncar pasan a envolver el contenido en `<ReactMarkdown remarkPlugins={DOCUMENT_MARKDOWN_REMARK_PLUGINS} components={DOCUMENT_MARKDOWN_COMPONENTS}>`: `ExpandContentModal.tsx`, `InvestigationScanPanel.tsx`, `AuditDetailPanel.tsx`, `AuditTimeline.tsx` (2 bloques: Forwarded content + modal de Checkpoint).

**`UserLibraryView.tsx` — migrado a `ExpandContentModal` en vez de parchear su copia inline:** su modal "Expandir" era prácticamente idéntico (byte a byte) al que ya se había extraído a `ExpandContentModal.tsx` en la OE anterior (que en ese momento se dejó sin migrar, señalado como candidato). En vez de aplicar el mismo fix 2 veces, se migró: `openExpanded()` pasa de hacer su propio fetch a solo `setExpandedId(selectionId)` (el fetch ahora vive dentro de `ExpandContentModal`), se eliminó el estado `expandedMessages`/`loadingExpanded` y el tipo `DetailMessage` (sin otro uso en el archivo), y el JSX del modal se reemplaza por `<ExpandContentModal title=... subtitle=... fetchUrl=... onClose=... />`. Resuelve de una sola vez el fix Y la deuda técnica señalada la OE anterior ("4ta copia del mismo patrón").

**`AuditDetailPanel.tsx` — timeline "How this was produced" (`row.detail`) tratado distinto, a propósito:** ese campo es un EXCERPT truncado a 140 caracteres de `m.content` (mezclado en una lista con descripciones de eventos de auditoría), no el contenido completo — envolverlo en `ReactMarkdown` podía renderizar sintaxis cortada a mitad (ej. un `**` sin cerrar) de forma rara. En vez de eso, se reemplazó el `slice(0, 140)` crudo por `stripMarkdown(m.content, 140)` — mismo criterio ya usado en los previews de Repository/User Library (limpia la sintaxis en vez de truncarla cruda), sin renderizar Markdown ahí.

### Verificación

lint ✅, build ✅. Grep exhaustivo confirmó los 6 lugares corregidos y los 2 lugares señalados-pero-no-tocados (SM Panel, timeline excerpt con `stripMarkdown` en vez de render). **Pendiente:** screenshot de Agus con el informe con tabla, vía "Expandir" en User Library, confirmando tabla y headers renderizados.

### Alternativas descartadas

- **Refactorizar `AgentPanel.tsx`/`HumanChatPanel.tsx` para consumir el módulo nuevo** — descartado, ya funcionan correctamente; tocar el código de chat en vivo en una OE de fix de contenido guardado es riesgo sin beneficio funcional.
- **Renderizar Markdown en el excerpt truncado de `AuditDetailPanel.tsx`** — descartado a favor de `stripMarkdown()`, ver razón arriba (sintaxis cortada a mitad).
- **Arreglar `SMPanel.tsx`** — descartado, no es parte del bug reportado (no es contenido guardado reabierto, es el chat propio del SM). Señalado para una OE aparte si se quiere.

### Riesgos conocidos / deuda técnica

- **`SMPanel.tsx` sigue sin renderizar Markdown** en sus propias respuestas — señalado, no es un bug de esta OE.
- **`AgentPanel.tsx`/`HumanChatPanel.tsx` mantienen su propia copia de `MARKDOWN_COMPONENTS`** en vez de importar del módulo compartido nuevo — 2 copias adicionales del mismo patrón coexisten con la fuente ahora compartida; decisión deliberada de no tocar código de chat en vivo funcionando, no deuda urgente.

**Archivos modificados/nuevos:** `src/lib/markdown/documentMarkdown.tsx` (nuevo), `src/components/documentation/ExpandContentModal.tsx`, `src/components/documentation/UserLibraryView.tsx`, `src/components/documentation/InvestigationScanPanel.tsx`, `src/components/documentation/AuditDetailPanel.tsx`, `src/components/audit/AuditTimeline.tsx`.

---

## OE 2026-08-26 — Ajuste: preview de tabla en cards colapsado a "[Table: N rows]"

**Fecha:** 2026-08-26
**Estado:** Closed — pendiente validación visual de Agus (card "Días de la semana" con `[Table: 7 rows]`). lint ✅, build ✅.

**Contexto:** confirmado el fix de renderizado de Markdown en el modal "Expandir" (OE anterior), Agus reportó que el PREVIEW corto de la card (antes de expandir) seguía viéndose mal — `stripMarkdown()` convierte cada fila de una tabla en el literal `"[table row]"`, repetido una vez por fila (7 repeticiones para una tabla de 7 días).

### Fix — `src/lib/text/stripMarkdown.ts`

Nuevas funciones `isPipeRow()`/`isTableSeparatorRow()`/`collapseMarkdownTables()`: detecta un bloque de tabla Markdown completo (fila header + fila separadora GFM `| --- | --- |` + N filas de datos) y lo colapsa a un único `"[Table: N rows]"` — el conteo excluye header y separador, solo cuenta filas de datos reales. Corre como paso previo (antes del resto de los `.replace()` en cadena) en ambas funciones (`stripMarkdown()` y `stripMarkdownPreserveParagraphs()`, que comparten la misma lógica de colapso). El viejo `.replace(/\|.*\|/g, '[table row]')` queda como fallback solo para filas sueltas sin separador detectado (tabla malformada) — no debería alcanzarse con una tabla real bien formada.

**Verificado con un caso real** (script de prueba, no solo lectura de código): tabla de 7 días con header+separador+7 filas → `"[Table: 7 rows]"`, una sola vez, conteo correcto.

### Verificación

lint ✅, build ✅. **Pendiente:** screenshot de Agus con la card "Días de la semana" mostrando el indicador colapsado.

**Archivo modificado:** `src/lib/text/stripMarkdown.ts` (único archivo tocado).

---

## OE 2026-08-26 — Diagnóstico + fix: User Library pasa a Markdown real en el preview corto (Repository View/LoadContextModal quedan sin cambios)

**Fecha:** 2026-08-26
**Estado:** Closed — pendiente validación visual de Agus. lint ✅, build ✅.

**Contexto:** Agus pidió reemplazar `stripMarkdown()` como mecanismo de preview visual por el mismo renderer de Markdown real (react-markdown + remark-gfm) en TODOS los lugares donde se usa, no solo para tablas. Diagnóstico solo-lectura primero, reportado antes de implementar.

### Diagnóstico

**Alcance real (grep exhaustivo):** solo 3 consumidores muestran `content_preview`/`content_preview_full` en pantalla — `RepositoryView.tsx` (los 3 tipos, con inconsistencia interna: Checkpoint/Handoff ya envueltos en `ReactMarkdown` + `line-clamp-3`, pero **inerte** porque el texto ya llega des-markdowneado; Saved Selection en `<p>` plano), `UserLibraryView.tsx` (Saved Selection vía `TruncatedPreview`/`content_preview_full`), y `LoadContextModal.tsx` (los 3 tipos, `content_preview`). Investigate View y Audit View no muestran preview de contenido — confirmado sin match de "preview" en ningún archivo, no afectados.

**Hallazgo clave:** los campos actuales YA fueron limpiados por `stripMarkdown()` (server-side) — no hay sintaxis Markdown que renderizar, por eso el `ReactMarkdown` que ya envuelve Checkpoint/Handoff en Repository View no hace nada visible hoy. Para Markdown real en pantalla, el servidor tiene que dejar de pre-limpiar y mandar contenido crudo — no es solo cambiar el componente que renderiza.

**`stripMarkdown()` tiene un segundo uso confirmado:** `LoadContextModal.tsx` usa `content_preview` también como corpus de búsqueda (`haystack` incluye `it.content_preview`) — la función no podía eliminarse, solo dejar de usarse para lo que se MUESTRA en pantalla donde correspondiera.

**Tensión reportada:** implementar el pedido tal cual (contenido crudo sin cortar, truncado solo por CSS/altura) revierte parte de la optimización de payload de la OE 2026-07-30 (`44f0315`, ~95% de reducción) para Repository View/LoadContextModal, que hoy mandan solo 200 caracteres ya limpios por ítem en el listado completo.

**Decisión de Agus tras el reporte:** acotar el cambio **solo a User Library** — es el único caso donde el campo ya mandaba casi todo el contenido (`content_preview_full`, sin cap chico real, solo un tope de seguridad de 4000 chars), así que no hay impacto de payload nuevo. Repository View y `LoadContextModal` quedan con `stripMarkdown()` tal como están, sin tocar.

### Fix

**`src/lib/db/documentation.ts`:** `DocSavedSelection.content_preview_full` (que aplicaba `stripMarkdownPreserveParagraphs()`) reemplazado por `content_raw` — mismo `content` de origen (último mensaje del Saved Selection), ahora SIN pasar por ninguna función de limpieza, con un cap de seguridad en 20000 caracteres (defensa ante input patológico, no un largo de preview diseñado — mismo criterio que tenía el campo anterior con su cap de 4000). Import de `stripMarkdownPreserveParagraphs` eliminado del archivo (ya no se usa ahí) — **la función en sí sigue existiendo sin cambios** en `stripMarkdown.ts`, exportada, solo sin caller activo por ahora.

**`src/components/documentation/UserLibraryView.tsx`:** `TruncatedPreview` reescrito para renderizar el `text` recibido vía `<ReactMarkdown remarkPlugins={DOCUMENT_MARKDOWN_REMARK_PLUGINS} components={DOCUMENT_MARKDOWN_COMPONENTS}>` (mismo módulo compartido de la OE anterior) en vez de `<p className="whitespace-pre-wrap">` — el mecanismo de truncado visual (medir `scrollHeight` vs `clientHeight` del contenedor vía `useLayoutEffect`, gradiente + botón "More content — Expand →") no cambió: es agnóstico a si el hijo es texto plano o HTML renderizado, sigue funcionando igual. `ref` pasa de `HTMLParagraphElement` a `HTMLDivElement` (ReactMarkdown no puede anidar `<p>` dentro de `<p>`, mismo criterio que `ExpandContentModal.tsx`). Uso actualizado: `ss.content_preview_full` → `ss.content_raw`.

### Verificación

lint ✅, build ✅. Grep exhaustivo confirmó que `content_preview_full` ya no tiene ningún consumidor (solo queda mencionado en un comentario explicando el reemplazo) y que `content_raw` se usa consistentemente en los 2 puntos esperados. **Pendiente:** screenshot de Agus de la card "Días de la semana" con la tabla renderizada (truncada por altura), y de otra card con texto simple confirmando que sigue viéndose bien.

### Alternativas descartadas

- **Aplicar Markdown real también en Repository View y `LoadContextModal`** — descartado por Agus tras el reporte de la tensión de payload; queda señalado para una decisión futura si se quiere revisitar.
- **Eliminar `stripMarkdownPreserveParagraphs()` del todo** — descartado, sigue existiendo sin cambios (pedido explícito de Agus) por si se necesita a futuro; solo se le quitó el único caller que tenía.

### Riesgos conocidos / deuda técnica

- **`stripMarkdownPreserveParagraphs()` queda sin ningún caller activo** — exportada pero no usada por ahora; no se borró porque Agus pidió explícitamente confirmar que sigue existiendo sin cambios.
- **Inconsistencia ya señalada en Repository View queda sin resolver** (Checkpoint/Handoff con `ReactMarkdown` inerte, Saved Selection en texto plano) — fuera de alcance de esta OE (acotada solo a User Library).
- **Cap de seguridad de `content_raw` en 20000 caracteres** — no debería afectar contenido real (Saved Selections típicas son mucho más chicas), pero un Saved Selection extremo se cortaría a mitad de Markdown en ese límite (mismo tipo de riesgo cosmético ya aceptado en otros cortes de esta sesión, no un crash).

**Archivos modificados:** `src/lib/db/documentation.ts`, `src/components/documentation/UserLibraryView.tsx`.

---

## OE 2026-08-26 — Review & Forward: modal "Instructions?" antes de reenviar (las 3 variantes)

**Fecha:** 2026-08-26
**Estado:** Closed — **confirmación visual positiva de Agus** en todos los casos probados (modal al hacer Review & Forward, instrucciones + contenido reenviado como un solo mensaje, vacío + Send sin cambios de comportamiento, Cancel sin reenviar nada). lint ✅, build ✅. Commit + push ejecutados en este cierre.

**Contexto:** al hacer Review & Forward, Agus pidió agregar un modal "Instructions?" antes de ejecutar el forward, que permite escribir contexto opcional para el destinatario. Vacío = comportamiento actual sin cambios. Precedido de diagnóstico solo-lectura del flujo exacto (reportado y confirmado antes de escribir código, ver turno anterior de esta conversación).

### Diagnóstico (resumen)

El click en "Review & Forward" vive en los componentes hijos, no en `WorkspaceShell.tsx`: `AgentPanel.tsx` (`handleForward()`) cubre **Agent→Agent** y **Agent→Human chat** con el mismo código (la bifurcación entre ambos pasa después, dentro de `handlePanelForward`); `HumanChatPanel.tsx` (`handleForward()`) cubre **Human chat→Agent**. Antes de este cambio, `handleForward()` llamaba a `onForward` de forma síncrona, sin ningún paso intermedio — el string final (`[Forwarded from X]\n\n...`) se arma recién en `WorkspaceShell.tsx`, junto con el insert `await`ado a `audit_log` (Fase 1.6) que genera el `message_provenance`.

### Implementación

**`src/components/workspace/ReviewForwardModal.tsx` (nuevo, compartido):** único componente de modal, mismo copy y comportamiento en las 3 variantes — título "Instructions?", subtítulo "Optional — add context for the recipient before forwarding.", textarea vacío por default (sin precargar nada del cuadro de envío normal), botones "Send" (siempre activo, texto o vacío) / "Cancel" (aborta sin reenviar). Mismo patrón visual que `LoadContextModal.tsx` (overlay + card blanca redondeada). Se extrajo como componente compartido en vez de duplicar — es 100% idéntico en las 2 variantes que lo usan (`AgentPanel.tsx`/`HumanChatPanel.tsx`), no una duplicación "parecida" que ameritara mantenerla separada.

**`AgentPanel.tsx`/`HumanChatPanel.tsx`:** `handleForward()` ahora solo abre el modal (`setShowForwardModal(true)`) en vez de llamar a `onForward` directo. Nuevo `handleForwardConfirm(instructions)` — hace lo que antes hacía `handleForward()` (arma `selected`, llama `onForward(selected, forwardTarget, instructions)`, limpia selección) y cierra el modal. `onForward` gana un 3er parámetro opcional `instructions?: string` en ambos `Props` interfaces. `HumanChatPanel.tsx` no tenía `Fragment` en su root (un solo `<div>`) — se envolvió en `Fragment` para poder renderizar el modal como hermano, mismo patrón que ya usaba `AgentPanel.tsx` para `LoadContextModal`.

**`WorkspaceShell.tsx`:** `handlePanelForward`/`handleHumanForward` ganan el mismo parámetro opcional `instructions?: string` (y el tipo `PanelBinding.onForward` correspondiente). En las 3 ramas (Agent→Agent, Agent→Human chat, Human chat→Agent) el string final pasa de armarse directo a: `const forwardedBlock = "[Forwarded from X]\n\n..."; const content = instructions?.trim() ? \`${instructions.trim()}\n\n${forwardedBlock}\` : forwardedBlock`. Vacío o solo espacios → mismo `content` que antes, sin ninguna línea agregada.

**Confirmado que no rompe `message_provenance`:** `provenance` (`{source_object_type: 'review_forward', source_object_id}`) se arma a partir del `id` del insert de `audit_log`, totalmente independiente del string de `content` — combinar instrucciones dentro de `content` es un cambio de texto puro, sin ningún efecto sobre el mecanismo de "downstream uses" de Fase 1.6.

### Verificación

lint ✅, build ✅ (un error de tipo encontrado y corregido en el camino: `PanelBinding.onForward` en `WorkspaceShell.tsx` no tenía el 3er parámetro tipado, TypeScript inferría `any` en el callsite — corregido agregando `instructions?: string` a la interfaz). **Confirmación visual positiva de Agus:** modal aparece al hacer Review & Forward en las variantes probadas, instrucciones + contenido reenviado llegan como un solo mensaje con el formato esperado, dejar vacío + Send reproduce el comportamiento anterior sin cambios, Cancel aborta sin reenviar nada.

### Alternativas descartadas

- **Modal separado por componente (duplicar en `AgentPanel.tsx` y `HumanChatPanel.tsx`)** — descartado, es exactamente el mismo copy/comportamiento en ambos, extraerlo a un componente compartido evita 2 copias idénticas del mismo modal.
- **Botón "Skip" separado de "Send"** — descartado por Agus en el diagnóstico previo: dejar el textarea vacío y tocar "Send" ya cubre ese caso, un botón aparte sería redundante.
- **Prellenar el textarea con algo del cuadro de envío normal del panel** — descartado explícitamente, el modal arranca siempre vacío, campo 100% independiente.

### Riesgos conocidos / deuda técnica

Ninguno nuevo identificado — cambio acotado a 4 archivos, sin tocar schema, endpoints ni el mecanismo de `message_provenance` existente.

**Archivos modificados/nuevos:** `src/components/workspace/ReviewForwardModal.tsx` (nuevo), `src/components/workspace/AgentPanel.tsx`, `src/components/workspace/HumanChatPanel.tsx`, `src/components/workspace/WorkspaceShell.tsx`, `PRODUCT_STATUS.md`.

---

## OE 2026-08-26 — Documentation Mode: User Library como tab por default + Load Saved Context en Human Chat (Connected Teams)

**Fecha:** 2026-08-26
**Estado:** Closed — Ajuste 1 sin verificación visual requerida (cambio de orden/default, bajo riesgo). Ajuste 2 **sin verificación visual en esta sesión, autorizado explícitamente por Agus** — se verificará en producción (mismo patrón ya usado antes cuando localhost no tiene datos reales de Connected Teams a mano). lint ✅, build ✅. Commit + push ejecutados en este cierre.

**Contexto:** 2 ajustes sobre Documentation Mode, el 2do precedido de diagnóstico solo-lectura confirmado con Agus antes de implementar (ver turno anterior de esta conversación).

### Ajuste 1 — User Library primero y por default

`src/components/documentation/DocClient.tsx`: entrada `library` movida a la primera posición del array `TABS` (antes era la 2da, después de `repository`). Default del tab activo (`useState<Tab>` inicial, cuando no hay `initialTab` válido en la URL) cambiado de `'repository'` a `'library'`. **Sin tocar** `handleOpenSearchResult()` (`setTab('repository')`, línea ~171) — es la navegación del buscador del SM hacia Checkpoint/Handoff/Saved Selection, un destino específico, no el tab de entrada por default.

### Ajuste 2 — Load Saved Context en Human Chat (Connected Teams)

**Diagnóstico (resumen, reportado y confirmado antes de implementar):** `HumanChatPanel.tsx` no tenía ningún mecanismo de Load Saved Context — solo `AgentPanel.tsx` lo tenía. Los datos necesarios (`workspaceId`/`teamId`/`projectId`) ya estaban resueltos en `WorkspaceShell.tsx` (`workspace.id`/`workspace.team_id`/`workspace.teams?.project_id`, mismos valores ya pasados a `AgentPanel` en 2 call sites) — solo faltaba threadearlos un nivel más. El destino "→ Chat" no tiene el problema de ambigüedad que sí tenía Investigate View (sin sesión resoluble): acá el chat humano ya está abierto y activo en el mismo panel. Verificado con evidencia de código que ningún dato cruza al team/account del otro lado de la conexión (ver `DECISIONS.md` 2026-08-26 para el detalle completo de los 4 puntos de evidencia).

**`LoadContextModal.tsx`:** nuevo prop opcional `chatOnly?: boolean` (default `false`). Cuando es `true`: oculta el bloque completo "Context Files scope" (session/team/project) y el botón "→ Context Files" por ítem — deja un único botón "→ Chat" por ítem, con estilo primario (`bg-indigo-600`) en vez de outline (ya no compite visualmente con un botón hermano). `AgentPanel.tsx` sigue usando el modal sin este prop (`chatOnly` default `false`) — comportamiento sin cambios ahí.

**`HumanChatPanel.tsx`:** 3 props nuevos opcionales (`workspaceId`, `teamId`, `projectId`). Nuevo botón "Load Saved Context" en una fila de herramientas agregada debajo del header (mismo patrón visual `ui-chat-prompt`/`ui-chat-tools-row` que ya usa `AgentPanel.tsx`). Nuevo `handleLoadToChat(content, provenance)` — mismo mecanismo que `handleSend()` ya existente (`POST /api/human-chat` con `{connectionId, content}` + `appendMessageWithDedupe(sentMessage)`), sin persistir `provenance` (mismo límite ya documentado para Review & Forward Agent→Human chat en Fase 1.6: destino `human_messages`, tabla distinta, sin FK posible hacia `message_provenance.message_id`). Modal renderizado con `chatOnly` fijo en `true`.

**`WorkspaceShell.tsx`:** `<HumanChatPanel>` gana `workspaceId={workspace.id}` `teamId={workspace.team_id}` `projectId={workspace.teams?.project_id ?? undefined}` — mismos valores ya calculados y usados en los 2 call sites de `AgentPanel`, sin ningún cálculo nuevo.

**Evidencia de seguridad (los 4 puntos verificados con código, no supuestos):**
1. `GET /api/documentation/browse` (listado) usa `createClient()` scoped al usuario + RLS sobre `checkpoints`/`handoff_packages`/`saved_selections` — solo puede devolver filas del `account_id` propio.
2. `GET /api/documentation/selection|checkpoint|handoff/[id]` (contenido completo) — mismo patrón, RLS a nivel tabla impide leer contenido cuyo `id` no pertenezca a la cuenta propia.
3. `POST /api/human-chat` resuelve `from_account_id: user.id` **server-side desde la sesión autenticada** (`src/app/api/human-chat/route.ts`) — nunca desde un valor que mande el cliente. `human_messages` no tiene ningún campo `team_id` que pudiera quedar mal asignado.
4. `workspace`/`team` que llegan a `WorkspaceShell` están garantizados como propios por `src/app/workspace/[id]/page.tsx:137` (`getUserIsolatedTeamId(connection, user.id) === team.id`) + RLS de `getWorkspaceWithAgents()` — nunca pueden resolver al lado opuesto de la conexión.

### Verificación

lint ✅, build ✅. **Ajuste 1:** sin verificación visual formal — cambio de bajo riesgo (orden de tabs + default), confirmable de un vistazo. **Ajuste 2:** sin verificación visual en localhost esta sesión (mismo patrón ya usado en otras OEs — localhost no tiene datos reales de Connected Teams a mano) — **Agus autorizó explícitamente proceder al cierre sin ella, verificación queda pendiente en producción.**

### Alternativas descartadas

- **Modal propio (fork completo) para Human Chat en vez de adaptar `LoadContextModal.tsx`** — descartado, la lógica de listar/filtrar/buscar/fetch de contenido es 100% reusable; solo el bloque de destino "Context Files" no aplica. Un prop `chatOnly` evita duplicar ~350 líneas de lógica de browse/filtros.
- **Persistir `message_provenance` para este flujo** — descartado, mismo límite estructural ya aceptado para Review & Forward Agent→Human chat (destino `human_messages`, sin columna `message_id` real a la que enganchar una FK).

### Riesgos conocidos / deuda técnica

- **Ajuste 2 sin verificación visual/funcional real todavía** — pendiente en producción por decisión explícita de Agus (autorizado el cierre igual).
- **`_provenance` recibido y descartado en `handleLoadToChat` (`HumanChatPanel.tsx`)** — parámetro requerido por la firma compartida de `onLoadToChat`, sin uso real acá (mismo límite de `human_messages` ya señalado). No es código muerto per se — la firma se mantiene igual a la de `AgentPanel.tsx` para no bifurcar el tipo `LoadToChatProvenance`/prop de `LoadContextModal.tsx`.

**Archivos modificados:** `src/components/documentation/DocClient.tsx`, `src/components/workspace/LoadContextModal.tsx`, `src/components/workspace/HumanChatPanel.tsx`, `src/components/workspace/WorkspaceShell.tsx`, `PRODUCT_STATUS.md`, `DECISIONS.md`.

---

## OE 2026-08-27 — Connect Team: investigación cerrada sin bug + fix de UX del selector "Your Project"

**Fecha:** 2026-08-27
**Estado:** Closed (código), commiteado y pusheado a `main` por decisión explícita de Agus — lint ✅, build ✅. **Verificación visual PENDIENTE**, sin Claude in Chrome disponible esta sesión: Agus solo va a poder probarlo cuando se contacte con Alejandro (necesita una cuenta con 2+ Projects y una solicitud de conexión pendiente real para ver el dropdown "Your Project"). Queda explícitamente marcado como no verificado hasta entonces — no asumir aprobado.

**Contexto:** Agus reportó que el Shared Team de una conexión nueva (aceptada el 2026-08-26) con `alejandro.balardini@gmail.com` "no respetaba el Team/Project de origen" — sospecha inicial de que el bug de julio (Projects creados automáticamente en el accept) seguía vivo pese al fix de `b803f1a`/`445f228` (2026-07-23). Se investigó en 2 sesiones encadenadas, con evidencia real de producción en cada paso (nunca solo lectura de código en `main`).

### 1. Investigación — sin bug de backend, causa raíz real

Se consultó directamente la base de producción (mismo proyecto Supabase que usa la app en Vercel, vía el service role key ya presente en `.env.local`, scripts de solo lectura descartados al terminar cada uno):

- La fila real de `team_connections` (id `270a0a61-4afc-4722-b0d1-c4d2a82633f7`, creada/aceptada 2026-08-26) tiene `requester_project_id`/`receiver_project_id`/`host_isolated_team_id`/`invitee_isolated_team_id` poblados, ninguno en NULL.
- Se cruzó cada `*_project_id` contra el `project_id` REAL de cada isolated team creado — **coinciden exactamente en ambos lados** (Agus: `AISync-HITR.io`; Alejandro: `hitr`). No hay divergencia entre lo persistido y lo real — descarta bug de persistencia y de visualización de una sola vez.
- `entity_name_history` reveló que el Project de Agus (`AISync-HITR.io`) fue **renombrado por él mismo** desde `"AISync"` el 2026-08-22 — 4 días antes de la conexión, evidentemente en relación a este mismo trabajo. El de Alejandro (`hitr`) nunca fue renombrado, existe con ese nombre desde su creación. Ningún Project llamado exactamente "Hitr.io" existe en ninguna de las 2 cuentas.
- Se revisó también la cadena de código que agrupa Teams Map por Project (`src/lib/db/projects.ts:4-23` → `src/app/teams/page.tsx:28,70,83` → `TeamsClient.tsx:149,264-271` → `MapView.tsx:277-297`, línea 282 `const pid = team.project_id`) — confirmado que usa el campo real `teams.project_id` de punta a punta, sin cache ni campo intermedio; y que `handleAccepted()` (`TeamsClient.tsx:250-254`) no inyecta el team nuevo con un `project_id` adivinado client-side — solo dispara `router.refresh()`, refetch real server-side.

**Causa raíz real (reconstruida vía `audit_log`, minuto a minuto):** Agus desconectó una conexión VIEJA y distinta con el mismo Alejandro a las 20:01:07 UTC del 26/08, y aceptó la conexión NUEVA 85 segundos después (20:02:32), sin cambiar de Project activo en el medio. `accounts.active_project_id` venía heredado de esa conexión vieja anterior. El selector "Your Project" del modal de aceptar preselecciona en silencio ese valor global — Agus no lo notó/cambió en ese flujo rápido. **No hay bug — el sistema hizo exactamente lo que el código dice, con el valor que la UI le pasó.**

**Conclusión confirmada por Agus:** investigación cerrada sin bug real. El team estaba correctamente ubicado en ambas cuentas desde el principio; la causa fue un nombre de Project mal recordado, no un error del sistema.

### 2. Fix de UX — el hallazgo real que sí ameritaba corrección

Aun sin bug de backend, la investigación encontró un gap de UX real y ya señalado en el propio código: `IncomingRequestsPanel.tsx` tenía un comentario en la prop `projectId` que decía *"optional default suggestion for the dropdown — never a hidden preselection"* — pero la implementación sí la usaba como preselección silenciosa (`useState(projectId ?? projects[0]?.id ?? '')`). El fix cumple ahora lo que ese comentario ya prometía.

**`src/components/teams/IncomingRequestsPanel.tsx`:**
- Prop `projectId` eliminada de la interfaz — ya no se usa como default. `selectedProjectId` arranca en `''` cuando `projects.length > 1` (fuerza elección consciente) y en `projects[0].id` cuando hay un solo Project (sin ambigüedad posible, auto-select se mantiene). Mismo criterio al reabrir "Accept" en cada card.
- Dropdown "Your Project" gana una opción placeholder `<option value="" disabled>Select a Project...</option>`, seleccionada por default cuando `selectedProjectId === ''`.
- Botón "Confirm" ahora `disabled={!!loading || !selectedProjectId}` — antes solo dependía de `loading`.

**`src/components/teams/TeamsClient.tsx`:** se dejó de pasar `projectId={projectId}` a `<IncomingRequestsPanel>` (prop eliminada) — confirmado que el `projectId` de nivel `TeamsClient` sigue usándose en otros 5 puntos del archivo (switch de Project activo, `AddTeamModal`, `ConnectTeamModal`), no queda huérfano.

Cambio 100% de UI — `handleAccept()` sigue mandando `receiver_project_id: selectedProjectId` igual que antes; el backend (`PATCH /api/connections/[id]`) sigue validando ownership sin tocar (ya confirmado en la sesión de diagnóstico).

### Verificación

lint ✅ (mismos 3 warnings preexistentes de `CanvasViewport.tsx` ×3 archivos, no tocados), build ✅. **Sin verificación visual esta sesión** — sin Claude in Chrome disponible. Pusheado igual por decisión explícita de Agus (no puede verificar hasta contactarse con Alejandro). Pendiente: screenshot de Agus del modal de aceptar con 2+ Projects mostrando el dropdown en "Select a Project..." y el botón Confirm deshabilitado hasta elegir.

### Alternativas descartadas

- **Proponer un UPDATE en producción para "corregir" el Project del Shared Team de Alejandro/Agus** — descartado, no hay evidencia de nada mal ubicado (ver investigación arriba). Ejecutar un UPDATE sin causa real hubiera sido la acción riesgosa, no el hallazgo.
- **Mantener `projectId` como sugerencia pero no preselección (ej. ordenarlo primero en la lista)** — descartado a favor de eliminarlo directamente: no había ningún pedido de "sugerirlo de otra forma", y mantenerlo sin usarlo como default hubiera sido código muerto a mitad de camino.

### Riesgos conocidos / deuda técnica

Ninguno nuevo — cambio acotado a 2 archivos, sin tocar backend, RLS, ni schema.

**Archivos modificados:** `src/components/teams/IncomingRequestsPanel.tsx`, `src/components/teams/TeamsClient.tsx`, `handoff-2026-07-c.md`, `PRODUCT_STATUS.md`.

---

## OE 2026-09-01 — Rebranding completo: AISync → Hitr.io

**Fecha:** 2026-09-01
**Estado:** Closed — **confirmación visual positiva de Agus** en las 4 verificaciones pedidas (Login, Dashboard, ribbon superior en 3 páginas, guía "How to use" en Audit Log) más 4 rondas de ajuste fino de layout en Login, todas con validación visual antes de avanzar a la siguiente. lint ✅, build ✅. Commit + push ejecutados en este cierre.

**Contexto:** rebranding visual completo del producto de "AISync" a "Hitr.io", con alcance explícitamente acotado por Agus al inicio: **solo lo que ve el usuario** — texto en pantalla, logo, tipografía del wordmark, título de pestaña. El código interno (nombre del repo `aisync-mvp-claude`, nombres de tablas/columnas de DB, variables internas, rutas de API, comentarios de código) queda intacto a propósito — no es una migración técnica.

### Paso 0 — Inventario (solo lectura, reportado y aprobado antes de tocar código)

Grep exhaustivo de "AISync" en `src/` clasificado en 2 categorías: **user-facing** (15 sitios en 12 archivos — títulos, guías "How to use...", modales, subtítulos, 2 mensajes de error de API) vs **interno** (comentarios de código en `system-prompts.ts`, `planes.ts`, `log-layers.ts`, `audit.ts`, un comentario en `connections/route.ts`, y el fallback hardcoded de `sm-doc-chat/route.ts:24`).

**Hallazgo clave del inventario:** no existe una "landing page" separada del login en el código — la ruta `/` es el Dashboard, requiere sesión y hace `redirect('/login')` si no hay usuario. Se resolvió con Agus: "Human in the Root" va en **Login y Dashboard** (no se crea ninguna página nueva).

**Segundo hallazgo:** el archivo de logo mencionado originalmente (`Logo_HITR.png`) no existe en `design-refs/logo/` — ahí hay 3 archivos reales (`Hitr_io_logo_INTER_dark_figma.svg`, `Hitr_io_logo_INTER_transparent_figma.svg`, `Hitr_io_logo_INTER_dark_highres.png`). Agus confirmó usar el **SVG transparent** (no el PNG con fondo negro sólido, que se vería como un rectángulo oscuro en fondos claros como el Dashboard).

### Decisión sobre los system prompts de IA (fallback vs. DB real)

Antes de tocar el fallback hardcoded de `sm-doc-chat/route.ts:24` ("AISync" en el system prompt del Sub-Manager), se verificó si el rol `sm_documentation` tenía fila real activa en `system_prompts` en producción — la app siempre prioriza `rolePrompt || fallback` (`sm-doc-chat/route.ts:64`), así que tocar solo el fallback sin verificar podía no tener ningún efecto real. Consulta de solo lectura contra producción (service role key de `.env.local`, script temporal borrado al terminar) confirmó que **sí existen filas reales activas** para `sm_documentation` y `sm_audit`, ambas con "AISync" en `base_layer`/`role_prompt`.

Reportado a Agus antes de tocar nada. Hubo un vaivén de decisión en la conversación (primero "sí, actualizar las 2 filas" → UPDATE aplicado y verificado → después un mensaje pidió explícitamente NO tocarlas → se le señaló la contradicción con el UPDATE ya aplicado → decisión final: **dejar como quedó, "Hitr" en las 2 filas**). El fallback del código (`sm-doc-chat/route.ts:24`) **no se tocó** — sigue diciendo "AISync", decisión explícita de Agus, consistente con que no tiene efecto real mientras las filas de DB estén activas.

**Post-cierre (mismo día):** Agus pidió una re-verificación de solo lectura contra producción para confirmar el estado real, señalando que la instrucción escrita decía "no tocar" y sospechando una desviación real del proceso. Se corrió una nueva consulta de solo lectura (mismo patrón, script temporal borrado al terminar) — confirmó que las 2 filas siguen diciendo "Hitr". Se reportó la evidencia exacta de los 2 intercambios de confirmación de esta misma conversación (las 2 respuestas explícitas "Sí, actualizar las 2 filas" y "Dejar como Hitr (ya aplicado)") que documentan cómo y cuándo se aplicó el UPDATE. **Causa identificada por Agus:** un click accidental en el prompt de confirmación de la terminal — no un error del proceso ni una ejecución fuera de instrucción. **Decisión final confirmada: Opción A — dejar "Hitr" en las 2 filas, sin revertir.** Sin cambios de código en este paso — solo verificación y documentación.

### Implementación

**Logo:** `Hitr_io_logo_INTER_transparent_figma.svg` copiado a `public/logo/` — recortado en `hitr-icon.svg` (solo el cuadrado teal + "H", viewBox `0 0 420 420`, reutilizable en cualquier fondo) y copiado completo como `hitr-logo.svg` (lockup íntegro, terminó sin uso final en código — ver nota de Login más abajo).

**`src/components/branding/HitrLogo.tsx` (nuevo, compartido):** ícono (`next/image`) + wordmark HTML "Hitr.io" (Inter, "Hitr." bold + "io" normal) + tagline opcional "Human in the Root". Props `size` (`sm`/`lg`/`xl`), `theme` (`dark`/`light` — controla el color del wordmark/tagline para fondos oscuros vs. claros), `tagline` (boolean). Usado en `TopRibbon.tsx` (`size="sm"`, sin tagline, reemplaza el div con gradiente + texto "AI" + span "AISync" que había antes) y en Dashboard (`src/app/page.tsx`, `size="lg"`, con tagline, agregado arriba del "Welcome...").

**Tipografía:** `Inter` sumada en `src/app/layout.tsx` vía `next/font/google` (`variable: '--font-inter'`), agregada al `className` del `<body>` junto a las fuentes existentes — aplicada únicamente al wordmark (`font-[family-name:var(--font-inter)]`, mismo patrón ya usado en el proyecto para IBM Plex Sans). El resto de la app no cambió de fuente.

**Textos "AISync"→"Hitr":** los 15 sitios user-facing del inventario, reemplazo directo (todos son prosa, ninguno es link/dominio, así que no aplicó el caso "Hitr.io" — ver `TeamsClient.tsx`, `HowConnectedTeamsModal.tsx`, `WorkspaceClient.tsx`, `AuditClient.tsx`, `ConnectTeamModal.tsx`, `SetupGuide.tsx`, `ApiKeyRequiredModal.tsx`, `ContextPageClient.tsx`, `ContextFilePanel.tsx`, `ChatFirstClient.tsx`, `connections/route.ts`). `title` de `layout.tsx` → `'Hitr.io'`. Grep exhaustivo post-cambio confirmó cero ocurrencias user-facing restantes — solo quedan las internas ya clasificadas.

### Login — 4 rondas de iteración visual con Agus

El layout de `/login` pasó por 4 ajustes sucesivos, cada uno con lint/build antes de pedir el siguiente screenshot:

1. **Centrado en mitad superior:** el bloque de marca completo pasó de centrarse en el 100% del viewport a centrarse solo en el `h-[50vh]` superior — la card de login + términos se centran en el `flex-1` restante (mitad inferior), balance visual entre ambos bloques.
2. **Tamaño del bloque de marca:** variante `size="xl"` agregada a `HitrLogo` (ícono 80px, wordmark `text-5xl`/48px, tagline `text-xl`/20px) — solo para Login, Dashboard se quedó en `size="lg"` sin tocar.
3. **Reestructuración en 3 renglones** (con foto anotada a mano de Agus como referencia): (a) logo (ícono+wordmark) en su propio renglón, (b) "Human in the Root" en su propio renglón debajo con más aire (`mt-6`), (c) "Tu workspace de agentes de IA" **movido** de debajo de la tagline a la mitad inferior, pegado como subtítulo introductorio arriba de la card de login (`space-y-3`, mismo contenedor `max-w-sm` que la card).
4. **Centrado del logo:** al implementar el punto 3 usando el SVG lockup plano (`hitr-logo.svg`, `w-full`) estirado a un contenedor `max-w-sm`, el logo se veía corrido a la izquierda — causa: el canvas del SVG es 2400×720 pero el ícono+wordmark real solo ocupa la mitad izquierda, dejando espacio transparente a la derecha que se estiraba junto con el resto. Fix: se abandonó el SVG plano para el renglón del logo y se volvió a una composición `flex justify-center` de `hitr-icon.svg` + wordmark HTML, con la misma proporción ícono:gap:fuente del asset original (420:150:270 escalado a 80px:28px:48px) — centra el contenido visual real, no una caja con relleno invisible.

En un paso intermedio (ronda 3→4) Agus reportó que un ajuste previo había "achicado" el bloque de marca — se verificó con `git diff` completo contra el original que ningún tamaño se había reducido en ningún momento (el `size="xl"` se mantuvo igual desde que se creó); se reportó la evidencia y se pidió hard refresh en vez de aplicar un cambio a ciegas sin problema real confirmado.

### Verificación

lint ✅ (mismos 3 warnings preexistentes de `CanvasViewport.tsx` ×3 archivos + 1 warning nuevo de `<img>` en la primera versión de `HitrLogo.tsx`, corregido migrando a `next/image`), build ✅ en cada ronda. **Confirmación visual positiva de Agus** en las 4 verificaciones originales (Login, Dashboard, ribbon superior en `/teams`/`/documentation`/`/context`, guía "How to use" en Audit Log) y en la ronda final de Login tras las 4 iteraciones de ajuste.

### Alternativas descartadas

- **Usar el SVG lockup plano (`hitr-logo.svg`) para el renglón del logo en Login** — descartado en la ronda 4 por el problema de centrado real explicado arriba; se prefirió la composición `flex` por ícono+texto, más robusta ante cualquier ancho de contenedor.
- **Revertir el UPDATE de `system_prompts` a "AISync"** — descartado, decisión final de Agus fue dejarlo en "Hitr" (ya aplicado), pese al vaivén de instrucciones sobre este punto.
- **Cambiar también el fallback hardcoded de `sm-doc-chat/route.ts`** — descartado, sin efecto real mientras la fila de DB esté activa, decisión explícita de Agus de no generar una inconsistencia código/DB sin motivo funcional.

### Riesgos conocidos / deuda técnica

- **Inconsistencia cosmética entre el fallback de código y la DB real:** `sm-doc-chat/route.ts:24` sigue diciendo "AISync" mientras la fila real de `system_prompts` para `sm_documentation` dice "Hitr" — sin efecto funcional (el fallback nunca se ejecuta mientras la fila de DB esté activa), pero si algún día esa fila se desactiva o se borra, el fallback resucitaría con la marca vieja. Decisión explícita de Agus de dejarlo así.
- **`hitr-logo.svg` (lockup plano) quedó copiado en `public/logo/` sin ningún consumidor en código** — se probó y se descartó en la ronda 4 de Login por el problema de centrado; no se borró por si sirve de referencia a futuro, pero es un asset sin uso real hoy.
- **`design-refs/logo/` queda sin commitear** (mismo criterio que el resto de `design-refs/` — carpeta de referencia visual, no servida en producción).

**Archivos modificados/nuevos:** `src/app/layout.tsx`, `src/app/login/page.tsx`, `src/app/page.tsx`, `src/components/layout/TopRibbon.tsx`, `src/components/branding/HitrLogo.tsx` (nuevo), `public/logo/hitr-icon.svg` (nuevo), `public/logo/hitr-logo.svg` (nuevo), `src/components/settings/SetupGuide.tsx`, `src/app/context/ContextPageClient.tsx`, `src/components/workspace/ContextFilePanel.tsx`, `src/components/onboarding/ChatFirstClient.tsx`, `src/components/onboarding/ApiKeyRequiredModal.tsx`, `src/components/teams/TeamsClient.tsx`, `src/components/teams/HowConnectedTeamsModal.tsx`, `src/components/audit/AuditClient.tsx`, `src/components/teams/ConnectTeamModal.tsx`, `src/app/api/connections/route.ts`, `src/components/workspace/WorkspaceClient.tsx`, `PRODUCT_STATUS.md`. Más el UPDATE directo en producción de `system_prompts` (roles `sm_documentation`, `sm_audit`) — no es un archivo de código, documentado acá por ser cambio de contenido productivo.

---
