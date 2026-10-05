# Create Versionate CVs

App local-first de gestión de CVs (React + TypeScript + Vite + IndexedDB, sin backend). Ver
`PROJECT_CONTEXT.md` para la spec completa (§1-28) y el estado de la implementación (§29).

> Este README sustituye a una versión anterior que documentaba el desarrollo fase a fase
> (13 fases, todas completas). Ese historial narrativo no se ha conservado literalmente para
> no cargar cada chat nuevo con ~60KB de contexto — lo que importa de cada fase (decisiones,
> bugs reales encontrados, limitaciones deliberadas) está resumido más abajo. `ARCHITECTURE.md`
> se referenciaba desde el código de fases anteriores pero **no está entre los archivos del
> proyecto actualmente**; si hace falta, reconstruir desde el propio código o pedírselo al usuario.

## Stack y por qué

- **React + Vite + TypeScript**: SPA client-side pura, sin build de servidor.
- **IndexedDB** como persistencia (`src/persistence/indexedDbStore.ts`), con export/import a
  JSON legible (`src/persistence/serialization.ts`) para backups manuales (§13-14 de la spec).
- **PDF export**: `window.print()` sobre el propio DOM de la preview (no una librería de
  generación de PDF) — así preview y PDF exportado son literalmente el mismo documento (§18).
- **PDF import**: `pdfjs-dist` para extraer texto/posición, pipeline propio de heurísticas en
  `src/domain/pdfImport/` para segmentar en secciones/campos (§19).
- **Drag-and-drop**: `@dnd-kit`.
- **Tests**: runner nativo de Node (`node --test`, vía `tsx`) en vez de Vitest, porque el
  sandbox de Claude no tiene acceso a red para `npm install` contra el registro de npm. El
  dominio no sabe ni le importa qué ejecuta sus tests — migrar a Vitest en una máquina con red
  es mecánico (cambiar los `import` de `node:test`/`node:assert` por los de `vitest`).

## Cómo ejecutarlo

```bash
npm install
npm run dev         # servidor de Vite
npm run typecheck   # tsc del dominio + de la app
npm test            # node --test sobre src/**/*.test.ts vía tsx
npm run build
```

## Estructura

```
src/domain/            Lógica de negocio pura, sin imports de React/IndexedDB/pdfjs directos
                        salvo donde el propio dominio del import de PDF lo requiere.
  model/types.ts        Todos los tipos: Section, Element, Variant, Template, CVProject,
                         CVVersion, Trash, History, AppDatabase, CURRENT_FORMAT_VERSION...
  database.ts, cv.ts, variants.ts, templates.ts, trash.ts, history.ts, resolveCV.ts
                         CRUD inmutable + reglas de negocio (fork de variantes/templates,
                         versionado de CVs, secciones dinámicas, cascadas de papelera...)
  preview.ts, previewBlocks.ts, pagination.ts, formatting.ts, richtext.ts
                         De una CVVersion resuelta a bloques paginados en A4 — lo que consumen
                         CVPreview.tsx y, por tanto, también el PDF exportado.
  pdfImport/             Extracción de texto (pdfjs) → sortReadingOrder → detección de
                         encabezados/secciones → agrupado en líneas/entries → parseo de
                         fechas → propuesta de estilo. Genera un "draft" para revisión manual,
                         NUNCA escribe directo a la base de datos (§19).
  ats/                   Analizador ATS 100% local (sin IA): legibilidad, estructura,
                         contraste, comparación con oferta de trabajo, detección de
                         duplicados entre secciones.

src/app/state/appStore.ts   Única fachada de estado: envuelve el dominio + autosave
                             (debounced) + persistencia. La UI nunca llama al dominio
                             directamente, siempre pasa por aquí.
src/persistence/             IndexedDB, serialización JSON, migraciones de formato
                             (`migrations.ts` — ver nota de compatibilidad abajo), autosave,
                             guard de `beforeunload`.
src/app/ui/components/       Dashboard, CVComposer (editor de CV), TemplateEditor,
                              SectionComposer + CvItemEditPanel (contenido del CV), CVPreview
                              + PreviewViewport (panel estático con zoom), AtsScreen,
                              PdfImportScreen, TrashScreen, HistoryScreen.
```

## Decisiones de arquitectura que conviene recordar

- **Todo el dominio es funciones puras inmutables**: reciben `AppDatabase`, devuelven
  `AppDatabase` nuevo o lanzan si el estado pedido es inválido. La capa de estado
  (`appStore.ts`) y la de persistencia son una envoltura fina alrededor, no donde vive la
  lógica — así es trivialmente testeable sin DOM ni IndexedDB.
- **Referencias por ID estable, nunca copias**: un CV referencia elementos/variantes por ID;
  cambiar una variante en la base de datos se refleja en todos los CVs que la usan, salvo que
  se haga fork explícito ("Guardar como variante"). Ver §5-7 de la spec.
- **`Template.sectionTitleStyle` / `headerStyle` / `dateStyle` / `bulletStyle` / `separators` /
  `linkStyle`** son `Record<string, unknown>` deliberadamente sueltos (no interfaces estrictas)
  para poder añadir parámetros de estilo sin migraciones de esquema constantes — las claves que
  reconoce hoy el renderer están documentadas en el JSDoc de `Template` en `model/types.ts`.
  `typography`/`spacing` sí son interfaces estrictas porque sus campos son "core" y estables.
- **Migraciones de formato** (`src/persistence/migrations.ts`, `CURRENT_FORMAT_VERSION`):
  cualquier cambio en la forma de `Template`/etc. que pueda romper backups/IndexedDB
  existentes necesita una entrada en `migrations` y subir `CURRENT_FORMAT_VERSION`. Ya pasó
  una vez (v1→v2, ver changelog) — probar la migración contra un backup JSON real antes de
  dar el cambio por hecho, no solo contra `createEmptyDatabase()`.
- **Preview ≈ PDF**: `CVPreview.tsx` es el único renderer; `window.print()` usa el mismo DOM.
  El CSS de `@media print` oculta todo salvo `.cv-preview` vía `visibility:hidden` + overlay
  absoluto — cualquier ancestro nuevo con `overflow`/altura fija (como `PreviewViewport`)
  necesita su propio reset explícito en `@media print`, o se comen páginas o aparecen en
  blanco (ya pasó, ver changelog — verificar con Playwright+Chromium headless si se toca esto).

## Testing

`node --test` sobre `src/**/*.test.ts` (44 ficheros de test, 311 tests). Todo el dominio y la
capa de estado tienen tests reales ejecutados, no solo revisados. La capa de UI (`.tsx`) no se
puede testear en el sandbox de Claude sin red — no hay `@types/react` ni `@dnd-kit`
descargables — así que ahí la verificación es: chequeo de sintaxis con esbuild (vía `tsx`, que
lo trae vendorizado) + revisión manual cuidadosa + pruebas empíricas puntuales con Playwright
(headless Chromium, sí disponible localmente) para lo que no se puede razonar a ojo, típicamente
paginación/impresión. **La verificación visual final en un navegador real la hace el usuario.**

Si aparece un bug: reproducirlo (con datos reales del usuario si están disponibles, no solo
sintéticos), test que lo capture, corregir, confirmar el test en verde, repasar toda la suite
por regresiones. Varios de los bugs reales de este proyecto solo se vieron probando contra
backups/PDFs reales del usuario, no contra datos de ejemplo — vale la pena seguir haciéndolo así.

## Changelog (resumen, no narrativo)

- **Decimocuarta sesión (fixes de idioma/Skills/Dashboard + mejoras ATS)**:
  ver `PROJECT_CONTEXT.md` §29. Auto-cambio de variante por idioma
  reescrito para cubrir cualquier posición de "v&lt;código&gt;" en el
  nombre (no solo con prefijo y guion) y en ambos sentidos es↔en; bug real
  de las píldoras de Skills que se saltaban de línea dejando la etiqueta
  sola, corregido quitando el contenedor flex intermedio; el Dashboard
  muestra la primera versión (alfabética) de cada CV en vez de la activa;
  **9 mejoras nuevas del analizador ATS** (longitud recomendada, años de
  experiencia, consistencia de fechas, verbos de acción, longitud de
  viñetas, secciones ausentes, densidad de keywords, y dos comprobaciones
  — columnas e iconos — adaptadas a lo que realmente puede ocurrir dentro
  de esta app, ya que ninguna de las dos es posible por construcción salvo
  el caso concreto de Languages en modo columnas), todas con tests reales,
  sin APIs de terceros ni IA.

- **Decimotercera sesión (regresión real: Dashboard sin scroll)**: ver
  `PROJECT_CONTEXT.md` §29. El header estático añadido a `.section-panel`
  en la sesión anterior dejó por accidente `.dashboard` agrupado en el
  mismo selector CSS combinado (un `str_replace` que cortó mal un
  selector de dos clases) — el Dashboard heredó `overflow:hidden` sin
  tener un contenedor de scroll interno propio, dejando todo el contenido
  bajo el pliegue (incluida "Base de datos") recortado e inalcanzable.
  Corregido separando ambas reglas. Este tipo de fallo no lo detecta
  ningún test automático del proyecto — verificación manual en navegador
  real especialmente importante esta vez.

- **Duodécima sesión (causa raíz definitiva del ancho del preview, header
  estático y colapso en Base de Datos)**: ver `PROJECT_CONTEXT.md` §29.
  El bug de "el ancho del preview a veces sigue el ancho del formulario"
  resultó tener una causa raíz distinta y más profunda que el fix de la
  sesión 10: `flex-basis:auto` sigue participando en el reparto de
  encogimiento de flexbox aunque una columna tenga ya un ancho fijado,
  así que contenido ancho en el panel izquierdo podía arrastrar al
  derecho — confirmado comparando flexbox vs. grid con Playwright (400px
  se desplomaba a ~72px con flexbox; con grid se mantiene exacto).
  `.cv-composer__split`/`.template-editor__split` pasan a `display:grid`.
  Además: header estático en la pantalla de Base de Datos (mismo esquema
  que los editores) y elementos colapsados por defecto con un botón
  "Editar" para ver todos los campos.

- **Undécima sesión (zoom anclado al ratón)**: ver `PROJECT_CONTEXT.md` §29.
  El zoom de `PreviewViewport` (rueda con Ctrl/Cmd, botones, atajos de
  teclado) ahora mantiene fijo el punto señalado (el ratón, o el centro del
  visor para botones/teclado) en vez de anclarse siempre a la esquina
  superior izquierda — verificado matemáticamente con Playwright (0px de
  desviación tras varios zooms consecutivos).

- **Décima sesión (orden alfabético, auto-cambio de variante por idioma,
  ancho del preview, bugs de paginación/bullets, renombrar elemento)**: ver
  `PROJECT_CONTEXT.md` §29. Resumen: listas de variantes/versiones
  ordenadas alfabéticamente en toda la app; al cambiar el idioma de
  visualización, cada item busca automáticamente su variante hermana con
  el mismo nombre pero código de idioma distinto ("Base - vES" →
  "Base - vEN"); el ancho del panel de preview ahora se deriva del alto
  medido en JS (`useHeightDerivedWidth.ts`) en vez de `aspect-ratio` CSS,
  que no era fiable dentro de un flex row; bug real de ATS en los bullets
  del PDF exportado (mismo mecanismo que el de `opacity` de la sesión
  anterior: `position:absolute` crea una capa de pintado aparte en
  Chromium) corregido pasando a `::marker` nativo; bug de "no pagina la
  primera vez" — una regresión introducida en esta misma sesión por el
  cambio de ancho — corregido con un `ResizeObserver` que repaginan cuando
  cambia el ancho real (efecto colateral: también corrige que la preview
  nunca se repaginaba al redimensionar la ventana); nuevo campo
  `Element.labelOverride` + botón "Renombrar elemento" para fijar a mano el
  nombre que identifica a un elemento en las listas, en vez de depender
  siempre de adivinarlo del campo de título de su variante por defecto.

- **Novena sesión (Languages configurable, pantalla completa, fix definitivo
  de Experience, píldoras en Skills)**: ver `PROJECT_CONTEXT.md` §29.
  Resumen: `Template.languagesStyle` (alineación + modo fila/columnas/
  lista) configurable desde `TemplateEditor`; botón de pantalla completa en
  `PreviewViewport` (overlay CSS de toda la pestaña, no la Fullscreen API
  nativa, con botón ✕/Escape para salir); subtítulo y ubicación en
  Experience/Education pasan a la MISMA fila (mismo criterio que título+
  fecha) en vez de líneas separadas, eliminando del todo el hueco visual
  que quedaba tras la sesión anterior; Skills fusionado ahora muestra cada
  valor como píldora en vez de texto separado por comas. `CURRENT_FORMAT_VERSION` 7 → 8.

- **Octava sesión (ATS/paginación del PDF + reestructuración de contenido)**: ver
  `PROJECT_CONTEXT.md` §29 para el detalle completo, incluyendo el método de
  reproducción empírica de los dos bugs de exportación a PDF. Resumen:
  `opacity` en texto secundario del preview causaba que ese texto se
  extrajera fuera de orden en el PDF (problema de ATS) — sustituido por
  `color: var(--cv-muted)` en toda `styles.css`; colchón de seguridad de
  paginación subido de 4mm a 7mm (mitigación, no solución estructural — la
  solución completa queda pendiente de decisión del usuario); "Profile" →
  "Summary"; fusión de "Skills"/"Programming languages"/"Software tools" en
  una única sección "Skills" de 3 campos de etiquetas (migración con
  pérdida documentada explícitamente — elementos antiguos van a la
  papelera, recuperables); "Projects" sin campo de fecha y con "Subtitle" +
  enlaces sin píldora; hueco visual corregido en Experience (orden
  subtítulo/ubicación); "Languages" ahora en columnas centradas (una por
  idioma) en vez de en filas — nuevo tipo de bloque `language-row` en
  `previewBlocks.ts`. `CURRENT_FORMAT_VERSION` 4 → 7 (3 migraciones nuevas).

- **Fases 1-13** (arquitectura → dominio → persistencia → dashboard → composición de CV →
  preview → editor con drag-and-drop → templates → paginación A4 + PDF → versionado →
  import de PDF → papelera/historial en UI → ATS analyzer): completas.
- **Sesión de pulido post-fase-13**: ver `PROJECT_CONTEXT.md` §29 para el detalle completo
  (botones guardar/eliminar reubicados, panel de preview estático con zoom, edición inline de
  items del CV, 20 parámetros nuevos de template, fix de bug real de PDF import con causa raíz
  en el orden de lectura de pdf.js, fix de bug real de página en blanco al exportar PDF, fix de
  migración v1→v2 que habría roto backups reales al cargar los templates nuevos).
- **Segunda sesión de pulido**: ver `PROJECT_CONTEXT.md` §29 — borrar variante suelta (sin tocar
  el resto del elemento) en base de datos y en el editor de CV; headers de CVComposer/
  TemplateEditor realmente fijos (antes solo "sticky", con recorrido antes de engancharse) y
  mismo fix aplicado al topbar del Dashboard; panel de preview con ancho derivado del alto
  (aspect-ratio 2.3/2.97), centrado en su mitad de pantalla, sin scroll de página propio; fix de
  bug real de centrado (`transform-origin` desalineado con el ancho reservado por el sizer);
  zoom por defecto ajustado a una sola página en CVs de varias páginas; zoom con Ctrl/Cmd+rueda;
  colchón de seguridad en la altura útil de página para reducir el desajuste de saltos de página
  entre pantalla e impresión; reescritura de la importación de PDF — el bloque de cabecera
  (nombre/contacto) ya no se descarta, tiene su propio mapeo de campos, la pantalla de revisión
  muestra los campos reales de cada sección (reutilizando `FieldInputs`) en vez de un formulario
  fijo de título/fecha/descripción, y el análisis de estilo del PDF corrige dos sesgos
  estadísticos reales (márgenes por mediana en vez de por percentil de extremo, escala de
  título por el tamaño de letra más grande del documento en vez del que más se repite).
- **Cuarta sesión de pulido**: ver `PROJECT_CONTEXT.md` §29 — header de CVComposer/TemplateEditor
  compactado en una sola fila (le faltaba `display:flex` al contenedor); el marco del preview
  ocupa el 100% del ancho de su columna (revertido en la sesión siguiente, ver más abajo); zoom
  "contain" real por ancho Y alto; depuración real contra un PDF de prueba del usuario que
  encontró y corrigió: glifos sin ToUnicode en el PDF (`(`, `)`, guiones, bullet, "+") que
  llegaban como caracteres invisibles — tabla de sustituciones conocidas en `glyphFixups.ts`; el
  heurístico de agrupar líneas en entradas no distinguía una lista de un ítem por línea (p.ej. 3
  skills sueltos) de un párrafo envuelto, perdiendo ítems; "Email : x Phone : y Location : z" en
  una sola línea ya no se pierde (split por etiqueta reconocida); todos los enlaces del CV (campos
  "url", el nuevo tipo "linklist", y campos "list"/"tags" con nombre de enlaces) se renderizan
  como `<a>` de verdad; nuevo `FieldType` "linklist" (nombre + URL por separado, p.ej. "LinkedIn"
  → su URL) con editor propio en `FieldInputs`, sin migración necesaria (los campos "list"
  existentes se siguen leyendo igual, compatibilidad hacia atrás); nuevo diseño de "Datos
  personales" tipo banner (`headerStyle.layout`) — nombre grande y centrado, headline debajo,
  resto de contacto en una línea separada por "•", configurable por template.
- **Quinta sesión de pulido**: ver `PROJECT_CONTEXT.md` §29 — al cambiar Lista/Banner en el
  encabezado, la alineación se ajusta sola (izquierda/centrada); en banner ya no se pinta el
  título de sección ni su separador; "linklist" (nombre + URL) aplicado también a los campos
  "URL" de Projects/Certifications/Publications, no solo a Datos personales; el ancho del preview
  vuelve a depender de una fórmula (`alto × 2.3/2.97`) tras aclaración del usuario, pero puesta
  esta vez en la COLUMNA derecha (no en el visor de dentro), con la columna izquierda llevándose
  el resto del ancho — antes ambas columnas se repartían el ancho a medias.
- **Sexta sesión de pulido**: ver `PROJECT_CONTEXT.md` §29 — barras de scroll con tema oscuro en
  toda la app; scroll horizontal en los parámetros de TemplateEditor corregido (`minmax` del grid,
  ancho de `<select>`, `min-width` de los grid items); nombre del CV ahora editable tras crearlo
  (antes no había forma); y sobre todo, **migración real formatVersion 2→3**: el tipo "linklist"
  de la sesión anterior solo afectaba a bases de datos NUEVAS — la base de datos real y ya
  existente del usuario seguía con el tipo antiguo, así que sus enlaces seguían mostrando la URL
  completa por más que el código ya soportara lo otro. Ahora se migra también el dato ya guardado.
- **Séptima sesión (funcionalidad nueva, no solo pulido)**: ver `PROJECT_CONTEXT.md` §29 —
  regresión real encontrada (no reportada) en `extractCvPlainText` (mostraba "[object Object]"
  para tags/enlaces desde la sesión de "enlaces clicables"), corregida con test propio; ubicación
  pintada debajo de la fecha (Experience/Education, alineada según `dateStyle.position`), con
  "location" nuevo en Education (migración v3→v4); el panel de edición de un item del CV ya no se
  cierra al guardar; renombrar variantes/versiones de CV; idioma de visualización por CV
  (`CVVersion.displayLanguage`, fechas + traducción ACOTADA de textos de fábrica sin modificar —
  ver la nota sobre §21 del contexto en PROJECT_CONTEXT.md, es importante); negrita/cursiva
  (`*texto*`/`**texto**`) y viñetas (`"· "`) en campos de texto enriquecido — el modelo de datos y
  el renderer ya lo soportaban desde antes, solo faltaba el parser del editor.