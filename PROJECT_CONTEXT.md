# Create Versionate CVs — Project Context

## 1. Project Overview

Create Versionate CVs es una aplicación web local-first, completamente client-side, diseñada exclusivamente para uso personal.

Su objetivo principal es permitir crear rápidamente diferentes CVs adaptados a diferentes ofertas de trabajo reutilizando una base de datos personal de contenido.

La aplicación debe permitir almacenar experiencias, proyectos, educación, skills y cualquier otro contenido relevante una sola vez y crear diferentes variantes de esos elementos para poder presentarlos de distintas formas.

El usuario debe poder combinar libremente esos elementos y sus variantes para crear diferentes CVs.

El resultado final de un CV es una configuración de contenido + plantilla + orden de secciones que puede renderizarse en tiempo real y exportarse a PDF.

---

# 2. Core Concept

La aplicación tiene cuatro conceptos principales:

1. Database
2. Elements and variants
3. CV versions
4. Templates

La base de datos contiene el contenido reutilizable.

Los elementos pertenecen a diferentes secciones.

Cada elemento puede tener múltiples variantes.

Un CV selecciona elementos concretos y una variante concreta de cada elemento.

Una plantilla determina cómo se representa visualmente el CV.

---

# 3. Database

La base de datos contiene todo el contenido reutilizable.

Inicialmente debe soportar:

- Personal information
- Profile / About me
- Experience
- Education
- Projects
- Skills
- Programming languages
- Software / Tools
- Languages
- Certifications
- Awards
- Publications
- Courses
- Volunteering
- References
- Custom sections

La arquitectura debe permitir añadir nuevos tipos de sección posteriormente.

Las secciones personalizadas deben permitir definir sus propios campos.

---

# 4. Elements

Cada sección contiene elementos.

Ejemplo:

Experience:

- Research Intern
- Software Engineer
- ...

Projects:

- Scanpath Prediction
- VR Viewer
- ...

Education:

- Master's Degree
- Bachelor's Degree

Cada elemento tiene una estructura de campos apropiada para su tipo.

Los tipos estándar pueden tener campos predefinidos.

También debe existir la posibilidad de añadir campos personalizados.

---

# 5. Variants

Las variantes pertenecen al elemento completo.

IMPORTANTE:

Las variantes NO pertenecen individualmente a cada campo.

Ejemplo:

Project:

Scanpath Prediction

Variants:

- Original
- Computer Vision
- Deep Learning
- Research
- Robotics

Cada variante contiene todos los campos del elemento:

Variant: Computer Vision

- Title
- Description
- Technologies
- Date
- URL
- Custom fields
- etc.

Una variante puede derivarse de otra variante.

La primera versión creada simplemente se considera la primera variante del elemento.

No debe existir un concepto arquitectónico especial de "original" que haga que se comporte de manera diferente.

---

# 6. Editing variants

Cuando el usuario edita una variante debe poder elegir:

- Save
- Save as variant

Save modifica la variante actual.

Save as variant crea una nueva variante y solicita un nombre.

El nombre debe ser descriptivo para facilitar su reutilización.

Ejemplo:

Current:

"Computer Vision"

Save as variant:

"Computer Vision - Robotics"

Las variantes deben poder compararse entre sí.

---

# 7. CVs

Un CV es una composición de:

- Template
- Selected sections
- Selected elements
- Selected variants
- Section order
- CV metadata

El CV no debe almacenar copias innecesarias del contenido.

Debe referenciar los elementos y variantes de la base de datos mediante identificadores estables.

Ejemplo conceptual:

CV:

Computer Vision Engineer

Template:

Minimal Dark

Sections:

1. Header
2. Profile
3. Experience
4. Projects
5. Education
6. Skills

Projects:

- Scanpath Prediction → Computer Vision variant
- VR Viewer → General variant

---

# 8. Dynamic sections

Las secciones del CV son completamente dinámicas.

Una sección solo debe aparecer si contiene contenido seleccionado.

Ejemplo:

Si el usuario no selecciona ningún elemento de Education:

Education NO debe aparecer en el CV.

No debe aparecer una sección vacía.

Lo mismo se aplica a:

- Projects
- Experience
- Education
- Certifications
- Publications
- etc.

Esto debe reflejarse tanto en la previsualización como en el PDF.

---

# 9. CV versioning

Los CVs también son versionables.

Un CV guardado representa una configuración concreta de:

- template
- selected elements
- selected variants
- section order
- customization

El usuario debe poder:

- modificar la versión actual
- guardar los cambios en la versión actual
- guardar los cambios como una nueva versión

Al crear una nueva versión se debe solicitar un nombre.

Puede sugerirse automáticamente un nombre como:

"CV Name_v2"

pero el usuario debe poder cambiarlo.

Las versiones anteriores deben conservarse.

El usuario debe poder seleccionar una versión anterior desde el dashboard y cargarla completamente para continuar editándola.

---

# 10. Templates

Una template define exclusivamente los parámetros visuales generales del CV.

El layout general es fijo.

No debe existir un editor de layouts arbitrarios.

La estructura general será:

Header

↓

Sections verticales

↓

Sections verticales

↓

...

No se utilizarán columnas.

Las templates pueden controlar parámetros como:

- Typography
- Font family
- Font sizes
- Colors
- Margins
- Line height
- Spacing
- Section title styling
- Header styling
- Date styling
- Bullet styling
- Separators
- Borders
- Other visual parameters

El usuario puede modificar estos parámetros.

Cuando una modificación de template se guarda como una nueva versión, debe poder crearse una nueva template en lugar de sobrescribir la actual.

---

# 11. CV Editor

El editor debe estar inspirado en el flujo de trabajo de Overleaf.

La interfaz principal del editor debe tener:

LEFT:

- forms
- content selection
- section management
- template settings
- editing controls

RIGHT:

- real-time A4 CV preview

La preview debe actualizarse inmediatamente cuando cambien los datos.

Los elementos deben poder editarse:

1. Desde el formulario.
2. Directamente desde la representación visual del CV.

El usuario debe poder añadir nuevos elementos manualmente.

Debe poder seleccionar qué elementos de la base de datos aparecen en cada sección.

Debe poder seleccionar la variante concreta que utilizará cada elemento.

Debe poder reordenar las secciones mediante drag and drop.

También debe poder reordenar los elementos dentro de las secciones cuando sea necesario.

---

# 12. Save behavior

El estado de la aplicación debe guardarse automáticamente después de las modificaciones.

No se debe depender del cierre de la pestaña para guardar los datos.

Si existen cambios no guardados que requieran una acción explícita del usuario, la aplicación debe utilizar el mecanismo estándar de beforeunload del navegador para advertir al usuario cuando intente cerrar la pestaña.

El navegador puede controlar el texto exacto del aviso.

---

# 13. Local persistence

Los datos deben permanecer exclusivamente en el dispositivo.

No debe existir:

- Backend
- Database server
- Authentication
- Cloud storage
- Synchronization
- Analytics
- Tracking

La aplicación debe utilizar almacenamiento local apropiado.

La base de datos debe poder exportarse como JSON.

Debe poder importarse posteriormente.

---

# 14. JSON database

Debe existir un archivo JSON que represente la base de datos completa.

Debe ser:

- legible por humanos
- razonablemente editable manualmente
- estructurado
- consistente
- fácil de depurar
- fácil de inspeccionar por Claude

No se debe utilizar una estructura deliberadamente ofuscada o excesivamente compacta.

Los IDs deben ser estables y permitir referencias entre entidades.

La aplicación debe poder:

- importar JSON
- exportar JSON
- realizar backups
- restaurar backups

El JSON debe contener suficiente información para reconstruir el estado necesario de la aplicación.

---

# 15. Trash

Los elementos eliminados deben poder enviarse a una papelera.

La papelera debe ser reversible.

El usuario debe poder restaurar elementos eliminados.

Si un elemento está siendo utilizado por un CV y se intenta eliminarlo:

Debe existir una advertencia.

El usuario debe poder:

- quitarlo únicamente del CV actual
- quitarlo del CV y enviarlo a Trash
- cancelar

Nunca eliminar silenciosamente contenido de la base de datos.

---

# 16. History

Debe existir un historial sencillo de cambios.

No es necesario implementar un sistema similar a Git.

El historial debe registrar eventos relevantes como:

- element created
- variant created
- variant modified
- CV created
- CV version created
- template modified
- element removed
- element restored

El objetivo es poder entender qué cambios se han realizado y facilitar recuperación/debugging.

---

# 17. Dashboard

La pantalla inicial debe ser un dashboard.

Debe proporcionar acceso a:

- Recent CVs
- CV versions
- Templates
- Database
- Projects
- Experience
- Education
- Skills
- Trash
- Import/export
- PDF import
- ATS analyzer
- Settings

Debe existir una acción clara para crear un nuevo CV.

Solo puede existir un CV activo simultáneamente en el editor.

---

# 18. PDF

El CV debe utilizar formato A4.

No existe un límite artificial de una página.

Los CVs pueden ocupar tantas páginas como sea necesario.

El contenido debe paginarse automáticamente.

Debe evitarse, cuando sea razonablemente posible:

- títulos aislados al final de una página
- elementos partidos de manera incorrecta
- secciones vacías
- layouts visualmente inconsistentes

La preview debe representar el mismo documento que se utilizará para generar el PDF.

Objetivo fundamental:

Preview ≈ PDF visualmente idéntico.

El usuario debe poder descargar el PDF.

No es necesario implementar impresión desde la aplicación.

---

# 19. PDF Import

Debe existir una función para importar un CV existente en PDF.

El proceso debe intentar extraer:

## Content

- personal information
- profile
- experience
- education
- projects
- skills
- languages
- certifications
- other sections

## Visual characteristics

- fonts
- font sizes
- colors
- margins
- spacing
- section styling
- header styling
- separators
- other relevant visual properties

El sistema puede utilizar estos datos para generar una propuesta de template similar al PDF original.

IMPORTANTE:

Los datos extraídos NO deben incorporarse automáticamente a la base de datos.

Debe existir una pantalla de revisión.

El usuario debe poder:

- aceptar
- modificar
- descartar

cada información antes de guardarla.

---

# 20. ATS Analyzer

Debe existir una herramienta independiente de análisis ATS.

Debe funcionar completamente local y sin IA generativa.

Debe poder analizar:

- machine readability
- headings
- document structure
- typography
- contrast
- problematic layout characteristics
- excessive graphics
- icons
- text extraction
- duplicated information
- section consistency
- potential ATS problems

También debe existir una función para pegar manualmente una oferta de trabajo.

El sistema debe comparar localmente:

CV

vs.

Job Description

Debe detectar:

- keywords presentes
- keywords ausentes
- tecnologías ausentes
- skills ausentes
- términos relevantes que no aparecen
- posibles oportunidades de modificación
- frecuencia de keywords
- posibles inconsistencias

No se debe utilizar IA para esta funcionalidad.

Si un mismo elemento aparece en varias secciones del CV, debe poder advertirse al usuario.

Ejemplo:

"Scanpath Prediction appears in Projects and Experience."

---

# 21. Language

No habrá traducción automática.

El contenido debe poder escribirse manualmente en diferentes idiomas.

Los títulos de sección inicialmente pueden tener valores predeterminados.

El usuario debe poder modificarlos.

No se debe implementar un servicio externo de traducción.

La arquitectura puede mantener la posibilidad de añadir traducción local en el futuro, pero no es un requisito actual.

---

# 22. Responsive design

El objetivo principal es desktop.

La edición está diseñada para pantallas grandes.

La aplicación debe ser responsive, pero no es necesario optimizarla específicamente como aplicación móvil.

Debe existir dark mode.

Dark mode será el modo predeterminado.

La aplicación debe tener un diseño minimalista.

---

# 23. Visual philosophy

Los CVs generados deben ser:

- minimalistas
- profesionales
- fáciles de leer
- ATS-friendly
- visualmente limpios
- apropiados para procesos de selección tecnológicos

No se pretende crear diseños artísticos o extremadamente visuales.

La legibilidad y la compatibilidad ATS tienen prioridad sobre la decoración.

---

# 24. Technology

La tecnología todavía no está fijada.

Claude debe evaluar las alternativas y elegir una arquitectura adecuada para cumplir estas restricciones:

- completamente client-side
- funcionamiento local
- posibilidad de utilizar frameworks
- fácil desarrollo y mantenimiento
- buen soporte para TypeScript
- generación de PDF
- renderizado HTML/CSS
- drag and drop
- testing
- posibilidad de deployment en GitHub Pages
- posibilidad de ejecución local

La aplicación debe poder utilizarse principalmente de forma local.

Si es técnicamente posible, debe evitarse la necesidad de levantar manualmente un backend.

Debe analizarse cuidadosamente la diferencia entre ejecutar la aplicación mediante `file://` y ejecutarla mediante un servidor local estático. La decisión debe documentarse antes de implementar una solución que contradiga el requisito de facilidad de ejecución.

---

# 25. Testing

El proyecto debe tener una estrategia de testing sólida.

Debe incluir tests automáticos para:

- data model
- variant management
- CV versioning
- template management
- persistence
- import/export
- dynamic sections
- content selection
- rendering logic
- ATS analysis
- trash/recovery
- relevant UI behavior

También deben existir tests de integración cuando sean necesarios.

Cuando una funcionalidad requiera validación visual/manual, debe documentarse claramente.

Claude debe ejecutar los tests después de realizar cambios relevantes.

Si aparece un bug:

1. reproducirlo
2. crear un test cuando sea razonable
3. corregirlo
4. ejecutar el test
5. comprobar regresiones

---

# 26. Architecture principles

La arquitectura debe separar claramente:

- domain/data model
- application state
- persistence
- business logic
- UI
- CV renderer
- PDF generation
- import pipeline
- ATS analyzer
- testing

Debe ser posible cambiar la interfaz sin reescribir el modelo de datos.

Debe ser posible cambiar una template sin modificar el contenido almacenado.

Debe ser posible reutilizar el mismo elemento en diferentes CVs.

Debe ser posible crear nuevas secciones y campos sin tener que reescribir toda la arquitectura.

Debe evitarse el acoplamiento entre el modelo de datos y la representación visual.

---

# 27. Important non-goals

No implementar:

- backend
- authentication
- cloud synchronization
- user accounts
- analytics
- tracking
- LinkedIn integration
- automatic AI CV generation
- automatic AI job matching
- automatic AI translation
- arbitrary visual layout editor
- multi-column CV layouts
- collaboration features
- online database

Estas funcionalidades quedan fuera del alcance salvo que se soliciten explícitamente en el futuro.

---

# 28. Development philosophy

Este proyecto debe desarrollarse de forma incremental.

No intentar implementar toda la aplicación de una vez.

Primero establecer:

1. architecture
2. data model
3. persistence
4. basic database management
5. CV composition
6. renderer
7. editor
8. templates
9. PDF export
10. versioning
11. import
12. ATS analyzer
13. polish

Antes de implementar funcionalidades complejas, comprobar que el modelo de datos puede soportarlas correctamente.

Las decisiones arquitectónicas importantes deben documentarse.

Si durante el desarrollo se descubre una contradicción entre esta especificación y una decisión técnica necesaria, detenerse y explicarla antes de realizar un cambio estructural importante.

---

# 29. Estado de la implementación (resumen para retomar en otro chat)

> Esta sección es un resumen vivo, no parte de la spec original (§1-28, inmutable). Se actualiza al final de cada sesión relevante. Para el detalle fase a fase, ver `README.md`; `ARCHITECTURE.md` **no está entre los archivos del proyecto actualmente** (se referencia desde el código y desde `README.md` pero su contenido no está disponible — si hace falta, reconstruir desde el propio código o pedírselo al usuario).

**Stack:** React + Vite + TypeScript + IndexedDB. PDF export vía `window.print()` (no librería). Import de PDF vía `pdfjs-dist`. Tests con el runner nativo de Node (`node --test` vía `tsx`), porque Vitest no está disponible en el sandbox de Claude (sin red). ~64 ficheros fuente en `src/`, 36 ficheros de test, **250 tests, todos en verde**.

**Las 13 fases del plan original (§28) están completas.** Dominio 100% puro y testeado (`src/domain/`), UI en React (`src/app/ui/`), estado+persistencia en `src/app/state/` y `src/persistence/`.

**Sesión más reciente (lista larga de pulido/bugs):** todo implementado y con los 250 tests en verde.
- Bug real, causa raíz confirmada con Playwright/Chromium headless: **página en blanco extra al exportar PDF** — el CSS de impresión ocultaba todo salvo `.cv-preview` con `visibility:hidden`, pero el hueco invisible seguía paginándose. Fix: colapsar `#root` a alto 0 en `@media print`.
- Bug real, causa raíz confirmada con el PDF real del usuario: **importar CV desde PDF no reproducía la info** — pdf.js no devuelve el texto en orden de lectura (el motor de impresión de Chromium lo escribe en "pasadas" distintas). Fix: `src/domain/pdfImport/readingOrder.ts` (`sortReadingOrder`), más un fix de regex de fechas para un glifo de guion sin mapeo Unicode.
- Bug real, encontrado por mí probando contra el backup real del usuario (no pedido): los 20 parámetros nuevos de template habrían **reventado al cargar backups existentes** (`template.linkStyle` no existía). Fix: migración real de formato v1→v2 en `src/persistence/migrations.ts` (`CURRENT_FORMAT_VERSION` ahora es `2`).
- "CVs" se veía "CVS" (era `text-transform:uppercase`, no un typo).
- Nuevo componente `PreviewViewport.tsx`: panel de preview estático (sticky, altura fija hasta el borde de la ventana) con zoom Ctrl+/Ctrl− y scroll propio, usado en `CVComposer` y `TemplateEditor`. Sustituye el sticky+overflow que antes tenía cada panel por separado.
- `TemplateEditor.tsx`: reescrito. Guardar/Guardar como nueva template/Eliminar movidos a la toolbar (igual que `CVComposer`). Nuevos 20 parámetros de `Template` expuestos como controles (tipografía, alineaciones, encabezado, fechas, viñetas, separadores, enlaces) + desplegable de familia de fuente (pilas de fuentes de sistema, sin carga externa).
- `Template` (`src/domain/model/types.ts`): typography ganó `fontWeight/headingWeight/headingCase/headingLetterSpacing/textAlignment`; spacing ganó `paragraphSpacing`; nuevo campo `linkStyle`. Los bags sueltos (`sectionTitleStyle/headerStyle/dateStyle/bulletStyle/separators`) documentan ahora en el JSDoc qué claves reconoce el renderer.
- `CVComposer.tsx`: botón "Guardar" explícito (flush del autosave), "Eliminar esta versión" ahora siempre visible (antes se ocultaba con 1 sola versión, por eso parecía no existir), nombre de descarga del PDF = nombre del CV (via `document.title` temporal), navegación "Editar template"/"Analizar ATS" ahora vuelve al CV de origen en vez de al dashboard (`View.returnTo` en `Dashboard.tsx`).
- `SectionComposer.tsx` + nuevo `CvItemEditPanel.tsx`: botón "Editar" por item del CV → panel inline con `FieldInputs` + Guardar/Guardar como variante (Guardar como variante cambia la selección SOLO en este CV, no el default global del elemento) + Eliminar (papelera del elemento, distinto de "Quitar" que solo lo saca de este CV). De paso corregido un bug preexistente de Rules-of-Hooks (hooks llamados después de un `return` condicional).
- `Dashboard.tsx`: header sticky (topbar no se mueve con el scroll), botón "Borrar historial" (`clearHistory` nuevo en `src/domain/history.ts` + `appStore`).

**Limitaciones conocidas del sandbox de Claude (sin red):** no hay `@dnd-kit` disponible, así que no se puede levantar la app completa (Vite) ni correr un `tsc` completo de la capa UI (falta `@types/react`); tampoco `@types/node` para un `tsc` estricto de dominio. Se compensa con: tests reales del dominio (`node --test`), chequeo de sintaxis con esbuild para toda la UI, y pruebas empíricas puntuales con Playwright+Chromium headless para los bugs de impresión/paginación. **La verificación visual final en un navegador real la sigue haciendo el usuario** — en particular: el zoom/pan de `PreviewViewport`, y el aspecto visual de los 20 parámetros nuevos de template.

**Nada pendiente de la última tanda de peticiones** a fecha de este resumen; a la espera de que el usuario pruebe en navegador y reporte lo que falle.
---

**Sesión 3 (esta sesión — ronda de correcciones sobre lo reportado en navegador real):**

- **Base de datos + editor de CV:** nuevo botón "Eliminar esta variante" (junto al ya existente
  de eliminar el elemento completo) en `ElementCard.tsx` y en `CvItemEditPanel.tsx` — antes solo
  se podía vaciar el elemento entero (todas sus variantes) de una vez. Usa
  `moveVariantToTrash`/`appStore.trashVariant`, que YA existían en el dominio (con cascada a
  borrado de elemento completo si era la última variante) pero no estaban conectados a ningún
  botón. Al borrar la variante que un item del CV tiene seleccionada, ese item pasa automáticamente
  a otra variante restante del mismo elemento (o queda con referencia rota, igual que "Eliminar
  elemento", si no quedaba ninguna).
- **Headers realmente fijos:** `CVComposer`/`TemplateEditor`/`Dashboard` pasan de "sticky con
  recorrido" (se movían un poco al iniciar el scroll antes de engancharse arriba) a un layout
  `height:100vh` + flex-column donde el toolbar tiene alto fijo y el resto se reparte el alto
  restante — el header queda fijo desde el primer píxel de scroll, sin necesitar medir nada por
  JS. Verificado con Playwright contra un DOM que replica la estructura real (ver más abajo).
- **Panel de preview:** ya no ocupa "100vh menos un offset fijo en rem" sino exactamente el alto
  que le deja el header (gratis, vía flexbox). El ancho se deriva del alto con
  `aspect-ratio: 2.3/2.97` (con `max-width:100%` como red de seguridad en ventanas estrechas-pero-
  altas) y queda centrado en su mitad de pantalla — para que el ancho no compitiera con el límite
  de ancho general de la página, `.cv-composer`/`.template-editor` perdieron su `max-width:1200px`
  y ese límite se movió solo al panel del formulario (`max-width:640px`, mismo criterio que ya
  usaba `.dashboard`). Solo el panel izquierdo (formulario) hace scroll; el derecho no.
- **Bug real de centrado corregido:** `.preview-viewport__stage` usaba `transform-origin: top
  center`, pero `.preview-viewport__sizer` reserva un ancho de `naturalWidth * zoom` asumiendo que
  el escalado ocurre desde la esquina superior IZQUIERDA del stage (que es donde el sizer empieza a
  contar) — con `center`, el resultado visual quedaba desplazado hacia la derecha salvo con
  zoom=1. Cambiado a `top left`; verificado por geometría con Playwright (huecos izquierdo/derecho
  iguales tras el fix, antes no).
- **Zoom por defecto en CVs de varias páginas:** antes se ajustaba para que TODAS las páginas
  apiladas cupieran enteras (zoom minúsculo e ilegible con 2+ páginas). Ahora `PreviewViewport`
  mide también la altura de la PRIMERA `.cv-preview__page` y ajusta el zoom a esa, no a la suma de
  todas.
- **Zoom con Ctrl/Cmd + rueda del ratón**, además de los ya existentes Ctrl+"+"/"-". Se engancha
  con `addEventListener("wheel", ..., {passive:false})` a mano (no con la prop `onWheel` de React)
  porque necesita poder cancelar el evento para que el navegador no haga su propio zoom de página a
  la vez.
- **Colchón de seguridad en la paginación para exportar PDF:** bug real reportado — el último
  párrafo/item de una página saltaba a la siguiente al exportar, aunque en la preview cupiera bien,
  desplazando también el resto de páginas siguientes. Causa: la paginación decide los saltos
  midiendo el DOM en pantalla (`offsetHeight`), pero el motor de impresión del navegador renderiza
  el mismo texto con otro redondeo de subpíxel por línea — la diferencia es de un par de px por
  línea pero se acumula a lo largo de una página. Mitigación: se resta un colchón de 4mm
  (`PRINT_SAFETY_BUFFER_MM` en `CVPreview.tsx`) a la altura útil de página SOLO para decidir los
  saltos, no al alto visual de la página en pantalla. Es una mitigación empírica razonable, no una
  garantía absoluta para cualquier contenido — si con contenido real muy denso se sigue viendo,
  el colchón puede subirse.
- **Reescritura de la importación de PDF** (bug real: la revisión no distinguía los campos de cada
  sección, y los datos personales se perdían por completo):
  - `extractHeaderItems` (`segmentation.ts`) captura el texto ANTES de la primera cabecera
    reconocida — antes se descartaba sin más, y en la inmensa mayoría de CVs reales ahí es donde
    vive el nombre y el contacto.
  - Ese bloque se modela como una `DraftSection` más, con `matchedSectionKey: "personal-information"`
    (`buildDraft.ts`), y fluye por el mismo pipeline que cualquier otra sección.
  - Nuevo `extractPersonalInfoFields` (`personalInfoMapping.ts`): a diferencia del heurístico
    genérico título+fecha+descripción (pensado para listas de entradas repetidas como Experience),
    reparte nombre/headline/email/teléfono/ubicación/links por contenido (regex) y por nombre de
    campo (key/label, con sinónimos ES/EN) — sigue siendo schema-driven, funciona aunque el usuario
    renombre los campos de la sección.
  - Nuevo despachador `mapEntryToFields` (`fieldMapping.ts`): usa `extractPersonalInfoFields` si la
    sección DESTINO es `personal-information`, si no cae al heurístico genérico de siempre — se
    recalcula cada vez que cambia la sección destino en la revisión.
  - `PdfImportScreen.tsx` reescrito: cada entrada de la revisión ahora muestra los campos REALES de
    la sección destino con `<FieldInputs>` (el mismo componente que usa el resto de la app para
    editar variantes), no un formulario fijo de título/rango de fechas/descripción. Cambiar la
    sección destino en el desplegable recalcula los campos mostrados al vuelo.
  - `analyzeStyle` (`styleAnalysis.ts`) corregido: los márgenes se calculaban con la MEDIANA de la
    posición de todo el texto (que refleja la indentación típica del cuerpo, no el borde de la
    página) — ahora usan un percentil bajo/alto de los extremos reales. `headingScale` usaba el
    tamaño de letra más GRANDE de todo el documento (normalmente el nombre, que aparece una vez) —
    ahora usa el tamaño más FRECUENTE entre los mayores que el cuerpo (los títulos de sección se
    repiten, el nombre no).
  - Alcance consciente: el heurístico título+fecha+descripción de Experience/Education/etc. NO se
    ha tocado (p.ej. no separa "Role" de "Company" en campos distintos) — no era parte de lo
    reportado y tiene tests que fijan ese comportamiento; si hace falta, es un cambio aparte.
- **Investigado y NO reproducido en código:** "los cambios se siguen autoguardando aunque hay
  botones de Guardar/Guardar como variante". Se trazó todo el flujo (`FieldInputs` → estado local
  `draft` en `CvItemEditPanel`/`ElementCard` → solo se llama a `appStore.saveVariant`/`forkVariant`
  en los handlers de esos dos botones) y no hay ningún `useEffect`/debounce/onChange que escriba en
  el store antes de eso. Lo que SÍ autoguarda, y es intencional (§12 del contexto): añadir/quitar/
  reordenar elementos y cambiar qué variante tiene seleccionada un item — eso no pasa por estos
  botones porque no es edición de campos, es composición del CV. Si lo que se veía autoguardarse
  era justo eso, es el comportamiento esperado; si era edición de texto dentro del panel, hace
  falta un paso a paso para reproducirlo (no se pudo lanzar la app completa en este sandbox por la
  limitación de `@dnd-kit` de siempre — ver abajo).
- **Verificación empírica con Playwright** (más allá del `node --test` de dominio, que sigue en
  264/264): se montó un arnés aparte que carga `styles.css` real contra un DOM que replica a mano
  la estructura de `PreviewViewport`/`CVPreview`/`CVComposer` (mismas clases, mismo anidado) para
  comprobar por geometría real de navegador — no solo a ojo — que: el header queda en `top:0` tras
  scrollear el panel izquierdo; el panel derecho no provoca scroll de página; el contenido del
  preview queda centrado (huecos izquierdo/derecho iguales); el `aspect-ratio` da el ancho esperado
  sin desbordar la columna en ventanas estrechas; y que exportar un CV de 2 páginas sigue dando
  exactamente 2 páginas en el PDF (contadas con `pdfjs-dist`, no a ojo) tanto con la estructura
  nueva de `.preview-viewport` como con el reseteo de impresión ya existente. Esto NO sustituye la
  verificación en un navegador real con la app completa (sigue habiendo cosas que este arnés no
  cubre: `@dnd-kit`, IndexedDB, el flujo de React completo).

**Limitaciones conocidas del sandbox de Claude (sin red), sin cambios respecto a la sesión
anterior:** sigue sin haber `@dnd-kit` ni `@types/react`/`@types/node` disponibles, así que la app
completa no se puede levantar con Vite en este entorno — la verificación de la UI combina tests de
dominio reales, chequeo de sintaxis con esbuild, el arnés de Playwright descrito arriba para
geometría/impresión, y revisión manual cuidadosa. **La verificación visual final en un navegador
real la sigue haciendo el usuario** — en particular todo lo de esta sesión: el aspecto del
`aspect-ratio` del preview con contenido real, el zoom con Ctrl+rueda, si el colchón de paginación
es suficiente con CVs reales densos, y el formulario de revisión de importación de PDF con un PDF
real (no los PDFs sintéticos de los tests).

---

**Sesión 4 (esta sesión — feedback tras probar la sesión 3 en navegador real, con un PDF real del usuario):**

- **Header compactado a una fila:** `.cv-composer__toolbar`/`.template-editor__toolbar` no tenían
  `display:flex` en el contenedor — el botón "volver", el `<h1>` y el bloque de controles caían
  cada uno en su propia fila por flujo normal de bloque (bug real reportado como "3 filas").
  Ahora el toolbar entero es una fila flex con wrap, y el `<h1>` tiene tamaño/margen reseteados
  para no imponer su alto de línea por defecto. Verificado con Playwright (todo el contenido cabe
  en ~37px de alto, una sola línea visual).
- **El preview vuelve a ocupar el 100% del ancho de su columna** (se revierte el `aspect-ratio`
  de la sesión anterior, que dejaba el marco más estrecho que la columna): ahora
  `PreviewViewport.recomputeFit` calcula el zoom como "contain" real —
  `min(ancho_disponible/ancho_natural, alto_disponible/alto_de_una_página)` — en vez de fiarse
  solo del alto (que solo era seguro cuando el ancho SIEMPRE sobraba por construcción, algo que
  dejó de cumplirse al quitar el aspect-ratio).
- **Todos los enlaces del CV ahora son clicables de verdad** (`<a href>`, se abren en pestaña
  nueva): antes tanto los campos "url" como la lista de "links" de datos personales se pintaban
  como texto plano. `buildItemLayout` (`preview.ts`) ahora calcula un `href` para el título (si el
  primer campo es "url"), para cada entrada de "meta", y para cada "tag" — con cuidado de NO
  adivinar por la forma del valor en campos "list"/"tags" genéricos (un valor como "Node.js" tiene
  pinta de dominio sin serlo): solo se enlazan campos "list"/"tags" cuyo nombre/etiqueta habla de
  enlaces, o el nuevo tipo "linklist" (ver abajo), donde no hace falta adivinar nada.
- **Nuevo `FieldType` "linklist"**: un array de `{label, url}` en vez de una lista de URLs sueltas
  — permite mostrar "LinkedIn" en vez de la URL completa. El campo "links" de Datos personales usa
  este tipo por defecto en bases de datos NUEVAS; las existentes seguirán con "list" (sigue
  funcionando exactamente igual, con compatibilidad hacia atrás explícita en `preview.ts` y
  `personalInfoMapping.ts` — no hay migración porque no hay ninguna pantalla que permita cambiar
  el tipo de un campo ya creado, así que forzar la migración no habría sido alcanzable por el
  usuario de todos modos). `FieldInputs.tsx` tiene un editor propio (fila de nombre+URL,
  añadir/quitar).
- **Nuevo diseño de "Datos personales" tipo banner** (`Template.headerStyle.layout: "stacked" |
  "banner"`, configurable desde TemplateEditor): nombre en grande (`headerStyle.nameFontSize`),
  headline en cursiva debajo, y el resto de campos (email/teléfono/ubicación/enlaces) en una única
  línea separada por "•", como en la imagen de referencia del usuario. Reutiliza el mismo
  `buildItemLayout` genérico (título=nombre, subtítulo=headline, meta+tags=resto) en vez de
  necesitar una función de extracción aparte — solo cambia cómo se PINTAN esos mismos datos.
  `bagString(...,"stacked")` como valor por defecto hace que las templates ya guardadas (sin esta
  clave todavía) se comporten como "stacked", sin necesidad de migración.
- **Depuración real de la importación de PDF contra el PDF del propio usuario** (no contra
  fixtures sintéticas) — esto encontró varios bugs que los tests anteriores no habían detectado:
  - El PDF de prueba tiene glifos SIN entrada ToUnicode para `(`, `)`, guion, guion largo, bullet
    y "+" — pdf.js los devuelve como caracteres de Zona de Uso Privado (U+E081, E082, E088, E089,
    E08C, E09D) en vez del carácter real. Se dedujo el significado de cada uno por el CONTEXTO en
    el que aparecían (p.ej. E09D siempre pegado a un número de teléfono o justo después de "C" en
    "C++") y se añadió una tabla de sustituciones conocidas (`glyphFixups.ts`), aplicada nada más
    extraer el texto. Es deliberadamente una lista cerrada y no una adivinanza general — un PDF
    distinto puede reutilizar el mismo código para otro símbolo, según qué fuente incruste.
  - Bug real en el agrupador de líneas en entradas (`entryGrouping.ts`): una lista de un ítem
    corto por línea (p.ej. "Python" / "MATLAB" / "C++", cada uno en su propia línea con el mismo
    interlineado normal, SIN ningún hueco extra) no tiene ninguna señal geométrica que la
    distinga de un párrafo envuelto — el heurístico de "hueco anómalamente grande" nunca se
    disparaba y los tres acababan pegados en una sola entrada, perdiendo dos de los tres skills al
    mapear los campos. Se añadió una detección de "lista simple" (3+ líneas cortas, sin fechas, sin
    ninguna del estilo "Etiqueta: valor") que las separa una por línea. Una línea "Etiqueta: valor"
    (p.ej. "Level : N5") nunca abre entrada nueva, tenga el hueco que tenga delante — evita que
    esto rompa el caso de "Japanese" + "Level : N5" como una sola entrada.
  - Bug real en `personalInfoMapping.ts`: "Email : x  Phone : y  Location : z" en una ÚNICA línea
    física (frecuente cuando el contacto va en una sola fila del PDF) hacía que TODO acabara en el
    último campo libre por orden (normalmente "location"). Ahora se detectan y separan etiquetas
    reconocidas ("Email", "Phone"/"Teléfono", "Location"/"Ubicación") ANTES del resto del
    procesado, y cada segmento se asigna directamente a su campo por el nombre de la etiqueta, no
    por orden de aparición.
  - Efecto colateral del split por glifos: "C++" llegaba de pdf.js como 3 items de texto sueltos
    ("C" + dos glifos "+"), y el join con espacio entre items dejaba "C + +"; limpieza puntual y
    acotada (colapsar "+" duplicados con espacio de por medio) en vez de un rejoin general basado
    en posición (que habría sido más arriesgado para otros heurísticos que asumen el espaciado
    actual, como la detección de "Etiqueta: valor").
  - Limitación real, NO resuelta a propósito: el PDF de prueba tiene lo que parece una capa de
    texto duplicada/optimizada para ATS bajo la sección Experience (dos descripciones distintas
    del mismo puesto, superpuestas) — pdf.js las extrae ambas sin distinción de "visible" o no.
    Separarlas de forma fiable necesitaría analizar el modo de renderizado del texto a nivel del
    stream de contenido del PDF, más allá de lo que expone `getTextContent()` — se documenta como
    limitación conocida en vez de forzar un heurístico frágil para un caso tan concreto.
- **Verificación de esta sesión:** 275/275 tests de dominio (`node --test`, ~20 tests nuevos:
  glifos, agrupación de listas simples, etiquetas embebidas en datos personales, guards de
  linklist, enlaces clicables en `buildItemLayout`), extraídos y verificados contra el PDF real
  adjuntado por el usuario (no solo contra fixtures sintéticas) con un arnés de depuración aparte
  que ejecuta el pipeline paso a paso; geometría de header-en-una-fila, ancho del marco de preview
  y estructura del banner verificadas con Playwright contra el DOM real. Seguimos sin poder
  levantar la app completa en este sandbox (sin `@dnd-kit`) — la comprobación visual final con el
  PDF real del usuario y el resultado final en pantalla la sigue haciendo el usuario.

---

**Sesión 5 (esta sesión — correcciones puntuales sobre feedback de la sesión 4):**

- **Alineación automática según el diseño del encabezado**: al cambiar "Diseño" en el editor de
  template (Lista/Banner), la alineación se actualiza sola a un valor por defecto razonable —
  izquierda para "Lista", centrada para "Banner" (como en la imagen de referencia) — el usuario
  puede cambiarla a mano después si quiere otra distinta.
- **En modo banner, el título de sección ("Personal information") y su separador ya no se
  pintan** — el nombre en grande ya hace de título visual, tenerlo repetido encima quedaba
  redundante. Se salta ese bloque entero en el render (`CVPreview.tsx`), no solo se le baja la
  opacidad ni nada por el estilo.
- **Nuevo `FieldType` "linklist" extendido a TODOS los campos de un solo link**, no solo al de
  Datos personales: "URL" en Projects, Certifications y Publications eran un campo "url" (una
  única URL suelta) — ahora son "linklist" (nombre + URL, con la posibilidad de añadir más de
  uno), igual que ya tenía "Links" de Datos personales. Así se puede poner "Demo en vivo" +
  "Repositorio" como dos enlaces con nombre en vez de una URL larga sin más. `FieldInputs.tsx` ya
  tenía el editor de linklist hecho de la sesión anterior — esto solo cambia el TIPO del campo en
  el schema por defecto, sin tocar el editor ni el renderer (ya eran genéricos por tipo de campo,
  no por sección).
- **El ancho del preview vuelve a depender de una fórmula, tras aclaración del usuario**: la
  sesión anterior interpretó mal "que ocupe el ancho del marco" y le quitó el ancho fijo por
  aspect-ratio (dejándolo ocupar el 100% de una columna que a su vez estaba repartida a medias con
  el formulario). Lo que pedía en realidad: si antes columna izquierda y derecha se repartían el
  ancho a medias, ahora la columna DERECHA (el panel del preview) debe tener el ancho exacto de la
  fórmula (`alto × 2.3/2.97`) y la IZQUIERDA (el formulario) se lleva todo el ancho que sobre —
  no al revés. El `aspect-ratio` vuelve, pero esta vez puesto directamente en
  `.cv-composer__panel-right`/`.template-editor__panel-right` (con `flex:0 0 auto`, ancho fijo,
  sin crecer) en vez de en `.preview-viewport` por dentro — y `.cv-composer__panel-left` pasa a
  `flex:1 1 auto` sin `max-width` propio, para llevarse exactamente "el resto". Verificado con
  Playwright: el ancho del panel derecho coincide con la fórmula al pixel, y no queda hueco muerto
  entre ambos paneles.
- **Verificación de esta sesión:** 275/275 tests de dominio sin cambios (esta ronda fue
  principalmente CSS/JSX, no lógica de dominio nueva); geometría del ancho de columnas y
  paginación de impresión re-verificadas con Playwright tras el cambio de layout.

---

**Sesión 6 (esta sesión — feedback puntual: scrollbars, overflow horizontal, nombre de CV, y una**
**aclaración importante sobre enlaces):**

- **Barras de scroll con tema oscuro** en toda la app (antes las pintaba el navegador con su tema
  por defecto, normalmente claro) — `scrollbar-color`/`scrollbar-width` para Firefox,
  `::-webkit-scrollbar*` para Chrome/Safari/Edge.
- **Scroll horizontal en el panel izquierdo de TemplateEditor corregido**, con causa raíz real:
  `minmax(180px, 1fr)` en el grid de parámetros nunca deja que una columna baje de 180px — con el
  panel izquierdo ahora de ancho variable (ver la sesión anterior), en ventanas donde le toca poco
  ancho el grid se desbordaba. Fix con el truco estándar `minmax(min(180px, 100%), 1fr)`. También
  se encontraron y corrigieron dos causas secundarias: un `<select>` se dimensiona por defecto a su
  opción más larga (el nuevo desplegable "Banner (nombre grande + contacto en una línea)" era
  justo el más largo de toda la pantalla) en vez de al ancho de su columna; y los grid items miden
  `min-width:auto` por defecto, no `0`, así que su contenido podía forzar el desbordamiento igual
  aunque el grid en sí ya no lo permitiera. De paso, se blindó el caso límite de ventana muy
  estrecha-y-alta: el panel derecho (ancho fijo por fórmula) ahora puede ceder ancho
  (`flex-shrink:1` en vez de `0`) si ni con el mínimo del panel izquierdo hay sitio para los dos,
  en vez de desbordar la fila entera.
- **Nombre del CV editable**: no había ninguna forma de cambiarlo tras crearlo. Nuevo
  `renameCVProject` en el dominio (`cv.ts`) + `appStore.renameCvProject` + botón "✎" junto al
  nombre en el toolbar del editor de CV (mismo patrón de `window.prompt` que el resto de la app,
  p.ej. "Guardar como nueva versión").
- **Corrección importante sobre los enlaces — causa raíz real encontrada**: el usuario reportó que
  seguía viendo la URL completa en vez de un texto corto, a pesar del tipo "linklist" añadido en
  la sesión anterior. La causa: `createEmptyDatabase()` solo afecta a bases de datos NUEVAS — la
  base de datos REAL y ya existente del usuario (con datos reales, como dice el propósito de este
  proyecto) seguía teniendo los campos de enlace en su tipo antiguo ("list"/"url"), porque cambiar
  el valor por defecto en el código nunca migra los datos YA guardados. Añadida la migración
  `formatVersion` 2→3 (`migrations.ts`) que actualiza el tipo de esos campos en el schema Y
  convierte los valores existentes (una URL suelta, o una lista de URLs sueltas) a
  `{label: "", url}[]`, sin perder ningún dato. Además, si el usuario deja el nombre vacío al
  añadir un enlace nuevo, ahora se adivina uno a partir del dominio (`linkLabel.ts`, compartido con
  `personalInfoMapping.ts`) en vez de caer de vuelta a mostrar la URL completa — para que el caso
  "me olvidé de ponerle nombre" no reproduzca el mismo problema que se pedía arreglar.
- En modo banner del encabezado, cambiar Lista/Banner ajusta la alineación por defecto sola
  (izquierda/centrada) y ya no se pinta el título de sección "Personal information" ni su
  separador — esto ya estaba de la sesión anterior, se deja documentado aquí para que quede junto
  al resto de contexto de "linklist" de esta sesión.
- **Verificación de esta sesión:** 281/281 tests de dominio (11 nuevos: migración v2→v3, rename de
  CV, fallback de nombre de enlace vacío); geometría del overflow horizontal y del caso límite de
  ventana estrecha-alta verificadas con Playwright.

---

**Sesión 14 (esta sesión — fix del auto-cambio de variante por idioma, bug de las píldoras de Skills, orden de versión en el Dashboard; mejoras del ATS en curso):**

- **Auto-cambio de variante por idioma — arreglado para el caso general** (bug real reportado: "funciona pero solo para algunos casos"): la versión anterior (sesión 10) solo reconocía el patrón `<prefijo> - v<CÓDIGO>` con un guion delante; si el nombre de la variante era SOLO `vES` (sin prefijo/guion) no lo detectaba. Reescrito (`cv.ts`): ahora `buildSiblingNameCandidate` busca la aparición de `v<código origen>` en CUALQUIER parte del nombre (con límites de palabra, para no disparar a mitad de otro texto) y la sustituye por `v<código destino>` — cubre tanto `"Base - vES"` → `"Base - vEN"` como `"vES"` → `"vEN"` a secas, en cualquiera de los dos sentidos (es→en, en→es). Cambio importante de comportamiento: el "idioma de origen" para la búsqueda ahora es el `displayLanguage` que tenía la versión ANTES del cambio (con `undefined` tratado como "en", igual que en el resto de la app) — antes se adivinaba directamente del nombre de la variante actual, lo que fallaba en más casos de los que cubría. 6 tests (2 nuevos: nombre "a secas", sentido inglés→español).
- **Bug real de ATS en Skills, encontrado y confirmado con Playwright antes de arreglarlo** ("Technologies:" se quedaba solo en su línea y todas las píldoras pasaban en bloque a la siguiente): causa — las píldoras estaban envueltas en un `<span>` con `display:inline-flex`, y una caja así, si no cabe entera en el hueco que queda tras la etiqueta, se mueve COMPLETA a la línea siguiente en vez of repartirse palabra a palabra como el resto del texto. Fix: sin ningún contenedor flex de por medio — cada píldora es ahora un elemento en línea suelto (con margen en vez de `gap` para el espaciado), exactamente como una palabra más dentro de la frase, así el navegador reparte líneas con total normalidad. Confirmado con capturas de pantalla antes/después.
- **Dashboard: la lista de CVs muestra siempre la primera versión (alfabética)** en vez de la versión activa (petición explícita) — son conceptos distintos: la versión ACTIVA sigue siendo la que se abre al pulsar en el CV (sin cambios), solo cambia qué etiqueta de versión se muestra en la fila de la lista.
- **Mejoras del analizador ATS** (las 9 de la lista que diste, todas implementadas con tests reales — sin APIs de terceros ni IA, como pedía la lista original):
  - **Longitud total con recomendación** (`experienceStats.ts`): estimación de páginas a partir de la cantidad de texto extraído (no una medición real del DOM — el dominio no tiene acceso a eso, documentado explícitamente como aproximación) + recomendación de 1 página o 2+ según los años de experiencia detectados.
  - **Años de experiencia** (`experienceStats.ts`): suma los rangos de fecha de Experience, fusionando los que se solapan (p.ej. un trabajo y un freelance en paralelo) para no contarlos dos veces — cálculo puro sobre datos ya estructurados.
  - **Consistencia de formato de fechas** (`dateConsistency.ts`): detecta si se mezclan formatos distintos ("Jan 2020" con "01/2020") sobre el texto ya extraído, en español e inglés.
  - **Verbos de acción al inicio de cada viñeta** (`bulletChecks.ts`): lista estática de verbos fuertes (ES+EN) comparada contra la primera palabra de cada bullet — informativo (ratio, no pass/fail estricto), porque no todo bullet tiene por qué empezar con un verbo.
  - **Longitud de viñetas** (`bulletChecks.ts`, mismo módulo): marca viñetas demasiado cortas (&lt;4 palabras) o largas (&gt;30 palabras).
  - **Secciones estándar ausentes** (`sectionCoverage.ts`): compara Experience/Education/Skills contra el contenido VISIBLE de este CV en concreto (no solo si la sección existe en la base de datos — §8 del contexto).
  - **Densidad de keywords sospechosa** (`textAnalysis.ts`, nueva función `detectKeywordStuffing`): sobre el conteo de palabras que ya calculaba `extractKeywordFrequencies` — un término se marca solo si supera un mínimo absoluto de repeticiones Y un porcentaje mínimo del texto total (evita falsos positivos en CVs muy cortos).
  - **Detección de columnas múltiples** (`styleChecks.ts`, nueva función `checkColumnLayoutRisk`) — **matiz importante**: la app en sí NO admite layouts de CV multi-columna (§10/§27 del contexto, no-goal explícito), así que una detección geométrica genérica no tiene nada real que detectar hoy. Se implementó centrada en la ÚNICA situación real donde sí existen columnas dentro de esta app: la sección "Languages" en modo "Columnas" (sesión 9) — si tiene 2+ idiomas, avisa de que algunos ATS no leen bien contenido en columnas.
  - **Detección de iconos/gráficos como portadores de información** (`styleChecks.ts`, nueva función `checkIconRisk`) — **mismo matiz**: el modelo de datos no tiene ningún `FieldType` de imagen/icono y el renderer no pinta ninguno, así que este riesgo es estructuralmente imposible en un CV generado por esta app hoy. Se deja implementado (siempre "sin riesgo") por completitud del informe y para el día en que se añada soporte de foto/iconos.
  - Todo esto se integra en `analyzeCv.ts` (nuevo `AtsReport` con 9 campos más) y se muestra en `AtsScreen.tsx` (6 secciones nuevas: Diseño, Longitud, Fechas, Redacción de viñetas, Cobertura de secciones, Densidad de palabras clave).
- **Verificación de esta sesión:** 374/374 tests de dominio (38 nuevos, uno por cada comprobación + varios casos límite de cada una); sintaxis y tipos de todos los ficheros nuevos/tocados verificados con esbuild/tsc (sin incidencias reales, solo el ruido ya conocido por falta de `@types/node`/`@types/react`).

---

**Sesión 13 (regresión real: el Dashboard se quedó sin scroll tras el cambio de la sesión anterior):**

- **Bug real, reportado inmediatamente tras la sesión 12** ("en el dashboard no se puede hacer scroll, no sé si se puede ver lo de Base de datos"): al añadir el header estático de `.section-panel` en la sesión anterior, el `str_replace` usado dejó por accidente `.dashboard` agrupado en el MISMO selector combinado (`.dashboard,\n.section-panel { ... }`), porque el bloque CSS original que se sustituyó era exactamente `.section-panel { max-width:640px; margin:0 auto; padding:... }` — pero ESE bloque estaba a su vez precedido por `.dashboard,` como parte de un selector combinado ya existente (`.dashboard` y `.section-panel` compartían la misma regla simple desde antes), y el reemplazo solo tocó el texto de `.section-panel` sin tocar la línea `.dashboard,` que quedaba justo delante. Resultado: `.dashboard` heredó `height:100vh; overflow:hidden` sin que su JSX tuviera ningún contenedor de scroll interno propio (su topbar es solo `position:sticky`, pensado para scroll de PÁGINA normal, no para este esquema) — todo el contenido más abajo del pliegue (incluida la sección "Base de datos") quedaba recortado e inalcanzable, sin ninguna barra de scroll posible.
- **Fix**: `.dashboard` y `.section-panel` separados en dos reglas independientes — `.dashboard` recupera su regla simple de siempre (scroll de página normal, topbar sticky sin cambios), `.section-panel` conserva el esquema de alto fijo de la sesión 12 (que sí es correcto, porque su JSX SÍ tiene el contenedor `.section-panel__body` con su propio scroll interno).
- **Comprobación añadida para evitar que se repita**: se revisó todo `styles.css` buscando cualquier otro selector combinado que pudiera haber quedado partido de forma similar por un `str_replace` anterior (patrón: una línea de selector terminada en coma seguida de un bloque de comentario y luego el resto de la regla) — no se encontró ningún otro caso.
- **Verificación de esta sesión:** fix puramente de CSS, 334/334 tests de dominio sin cambios (no aplica ningún test automático a esto — es un fallo de estructura de selector CSS, no de lógica; la única forma real de detectarlo habría sido renderizar la app completa en un navegador, algo que sigue sin ser posible en este sandbox). **Importante para el usuario**: por favor confirma en tu navegador real que el Dashboard vuelve a hacer scroll con normalidad y que "Base de datos" es visible y accesible — dado que este tipo de regresión (un `str_replace` textual que corta mal un selector CSS combinado) no lo detecta ningún test automático de los que tiene este proyecto, así que la verificación manual aquí es la única red de seguridad real.

---

**Sesión 12 (causa raíz definitiva del bug de ancho del preview, header estático en Base de Datos, elementos colapsados):**

- **Bug real de ancho del preview — causa raíz definitiva encontrada y confirmada empíricamente** (el fix de la sesión 10, aunque genuinamente mejor que el `aspect-ratio` de antes, no lo eliminaba del todo): reproduje con Playwright, comparando flexbox vs. grid con el MISMO ancho fijado (400px) y el MISMO contenido ancho sin partir en la columna izquierda (500 caracteres seguidos, simulando un texto largo sin espacios, una URL, o una opción de `<select>` larga) — con flexbox, el ancho de la columna derecha se desplomaba de 400px a ~72px; con grid, se mantiene exactamente en 400px pase lo que pase en la izquierda. Causa: con flexbox, aunque la columna derecha tenga un ancho ya calculado, `flex-basis:auto` sigue participando en el reparto de "encogimiento" cuando la suma de anchos pedidos por ambas columnas no cabe — y el contenido intrínseco de la izquierda (formularios) puede pedir más ancho del disponible sin que se note a simple vista, arrastrando a la derecha con él. Fix: `.cv-composer__split`/`.template-editor__split` pasan de `display:flex` a `display:grid` con `grid-template-columns: minmax(260px, 1fr) var(--panel-right-width, auto)` — con grid, la columna de ancho fijo se resuelve ANTES de repartir el resto, así que ninguna cantidad de contenido a la izquierda puede afectarla. La variable `--panel-right-width` (de `useHeightDerivedWidth.ts`, sin cambios) ahora se fija en el CONTENEDOR del grid, no en el panel derecho (las pistas de un grid solo se definen desde el contenedor).
- **Header estático en la pantalla de Base de Datos** (petición explícita, "como en los editores"): `SectionPanel.tsx` pasa del mismo esquema "página normal que hace scroll entera" al esquema "alto de ventana fijo + toolbar de alto fijo + cuerpo con su propio scroll" que ya usaban `CVComposer`/`TemplateEditor` — el botón "← Todas las secciones" y el título de la sección quedan siempre visibles, sin perderse al hacer scroll con una base de datos larga.
- **Elementos colapsados por defecto en Base de Datos** (petición explícita, "que no ocupen tanto"): `ElementCard.tsx` gana un estado `isEditing` (colapsado por defecto, igual que `CvItemEditPanel` en el editor de CV, salvo que aquí cada tarjeta se controla de forma independiente, no hace falta forzar que solo una esté abierta a la vez) — colapsado solo se ve el nombre del elemento y un botón "Editar"; al pulsarlo aparecen el selector de variante, los botones de renombrar/eliminar, todos los campos y las acciones de guardar, con un botón "Cerrar" para volver a colapsar.
- **Verificación de esta sesión:** cambios puramente de UI, sin lógica de dominio nueva — 334/334 tests de dominio sin cambios. La causa raíz del bug de ancho se reprodujo y confirmó empíricamente con un arnés de Playwright dedicado (comparación directa flexbox vs. grid con el mismo contenido) antes de aplicar el fix, no solo por inspección del CSS. Sintaxis y tipos de todos los ficheros tocados verificados con esbuild/tsc (mismo ruido ya conocido por falta de `@types/react`, ninguna incidencia nueva). **Pendiente de verificación en navegador real por el usuario**: confirmar que el ancho del preview ya no varía en NINGÚN caso al interactuar con formularios largos/anchos, y que el header estático y las tarjetas colapsadas de Base de Datos se sienten cómodos de usar.

---

**Sesión 11 (zoom del preview anclado al puntero del ratón):**

- **Zoom anclado a donde apunta el ratón, no a la esquina superior izquierda** (petición explícita, bug real reportado): antes, cualquier cambio de zoom (rueda con Ctrl/Cmd, botones +/−, o Ctrl+/Ctrl−) dejaba fija la esquina superior izquierda del contenido y todo lo demás se desplazaba desde ahí — consecuencia de que `transform:scale()` se aplica con `transform-origin: top left` sobre todo el `.preview-viewport__stage` (necesario por el fix de centrado de una sesión anterior, no se ha tocado). Ahora `PreviewViewport.tsx` calcula, antes de cambiar el zoom, el punto del contenido SIN escalar que hay justo bajo el punto de anclaje (el ratón para la rueda; el centro del visor para los botones/atajos de teclado, que no tienen una posición de puntero asociada), y justo después de que el DOM se repinte con el zoom nuevo (en un `useLayoutEffect`, antes de que el navegador pinte el frame — evita cualquier parpadeo visible) ajusta `scrollLeft`/`scrollTop` para que ese mismo punto quede exactamente donde estaba antes.
- **Verificación de esta sesión:** cambio puramente de UI (sin lógica de dominio nueva), verificado matemáticamente con un arnés de Playwright que reproduce la estructura real (scroll + sizer centrado + stage con `transform-origin:top left`) y confirma que un punto marcado dentro del contenido queda exactamente en el mismo píxel de pantalla antes y después de varios zooms consecutivos (in y out) apuntando siempre al mismo sitio — 0px de desviación. 334/334 tests de dominio sin cambios (no se ha tocado nada del dominio en esta sesión). **Pendiente de verificación en navegador real por el usuario**: la sensación al usar la rueda del ratón sobre distintas zonas del documento, y que los botones +/− centrados en el visor se sientan naturales.

---

**Sesión 10 (orden alfabético de versiones, auto-cambio de variante por idioma, ancho del preview, bugs de paginación/bullets en el PDF, y renombrar el nombre identificador de un elemento):**

- **Listas de versiones ordenadas alfabéticamente** (petición explícita): variantes (`ElementCard.tsx`, `SectionComposer.tsx`), versiones de CV (`CVComposer.tsx`) y el selector "Previsualizar con:" de `TemplateEditor.tsx` — antes en orden de inserción. Nuevo helper compartido `src/app/ui/sortAlpha.ts`.
- **Auto-cambio de variante al cambiar el idioma de visualización** (petición explícita): `setCvDisplayLanguage` (`cv.ts`) ahora, además de guardar el idioma, recorre los items de la versión buscando para cada uno una variante HERMANA (mismo elemento) cuyo nombre siga el patrón `<prefijo> - v<CÓDIGO>` con el código del idioma nuevo — p.ej. de "Base - vES" a "Base - vEN". Si no existe ninguna variante con ese nombre exacto, el item se queda tal cual (nunca rompe nada). 4 tests nuevos.
- **Ancho del preview ya no depende del ancho del panel izquierdo** (bug real reportado, persistía pese al `aspect-ratio` de la sesión 5): la interacción de `aspect-ratio` dentro de un flex row resultó no ser fiable en la práctica. Nuevo hook `src/app/ui/useHeightDerivedWidth.ts`: mide el ALTO ya renderizado (puramente estructural, nunca depende del ancho) y aplica el ancho resultante (`alto × 210/297`) vía una custom CSS property — no como estilo inline directo, para que el layout apilado en ventana estrecha (móvil) pueda seguir ganando por cascada normal. Conectado en `CVComposer.tsx` y `TemplateEditor.tsx`.
- **Bug real de ATS en los bullets, causa raíz confirmada empíricamente** (mismo método que con `opacity` en la sesión 8: reproducido con Playwright + pdfjs-dist ANTES de tocar el código): el marcador de viñeta se pintaba con un `::before` en `position:absolute` sobre un `li` en `position:relative` — igual que con `opacity`, esto crea una capa de pintado aparte en la exportación a PDF de Chromium y el texto de la viñeta se extrae fuera de su sitio ("como si se renderizaran en una segunda pasada", el síntoma exacto reportado). Fix: pseudo-elemento nativo `::marker` con `content` personalizado en vez de `::before` posicionado — verificado que el texto sale en orden perfecto y que el aspecto visual no cambia (captura de pantalla). Contrapartida real y documentada: `::marker` no admite `width`/`padding` (limitación de la especificación CSS), así que el hueco entre viñeta y texto (`bulletStyle.gap`) ahora es una aproximación con espacios U+00A0 dentro del propio `content`, no un valor en px exacto — sin impacto en el problema de ATS.
- **Bug real de "no pagina la primera vez que se entra", causa raíz encontrada — es una regresión de esta misma sesión** (el cambio de ancho del preview de arriba): al quitar el `aspect-ratio` CSS síncrono y sustituirlo por un ancho fijado vía un efecto de React en el panel ANTEPASADO, la primera medición de altura de bloques de `CVPreview.tsx` podía ocurrir antes de que ese ancho definitivo se hubiera aplicado — y nada volvía a disparar una remedición después, porque el cambio de ancho del ancestro no hace que `CVPreview` vuelva a renderizar. Fix: `CVPreview.tsx` añade un `ResizeObserver` sobre su propio contenedor que fuerza una remedición/repaginación cada vez que el ancho real cambia. Efecto colateral positivo (mismo mecanismo, bug independiente y preexistente): la preview tampoco se había repaginado nunca al simplemente redimensionar la ventana del navegador — esto lo corrige también.
- **Renombrar el nombre identificador de un elemento** (petición explícita: "el nombre que sale al añadir apartados al CV" se quedaba fijo en el primer valor dado): antes ese nombre se ADIVINABA siempre a partir del campcampo de título/nombre de la variante por defecto (`guessElementLabel`, dinámico, pero atado a esa única variante) — no había ninguna forma de fijarlo a mano. Nuevo campo opcional `Element.labelOverride` (sin migración necesaria — `undefined` se comporta exactamente como antes), nueva función de dominio `renameElement` (`variants.ts`, con historial) — a diferencia de `renameVariant`, aquí una cadena vacía es un valor VÁLIDO (quita el override y vuelve a la adivinanza automática, no es un error). Botón "Renombrar elemento" nuevo en `ElementCard.tsx`; `SectionComposer.tsx` no necesitó ningún cambio porque ya usaba `guessElementLabel` en todos los sitios donde se muestra el nombre (incluido el selector para añadir elementos al CV), así que se beneficia automáticamente.
- **Verificación de esta sesión:** 334/334 tests de dominio (~10 nuevos: auto-cambio de variante por idioma, `renameElement`, `labelOverride` en `guessElementLabel`); causa raíz del bug de bullets reproducida y confirmada empíricamente con Playwright + pdfjs-dist (igual que el de `opacity` de la sesión 8) antes de escribir el fix, con captura de pantalla para confirmar que el aspecto visual no cambia; sintaxis y tipos de todos los ficheros tocados verificados con esbuild/tsc (encontrado y corregido un error de tipos real en `cv.ts`, no solo los falsos positivos ya conocidos por falta de `@types/react`). **Pendiente de verificación en navegador real por el usuario**: que la paginación ahora sea correcta desde el primer render sin necesidad de tocar nada, que el ancho del preview ya no reaccione al panel izquierdo, y que el aspecto de los bullets siga viéndose igual que antes con contenido real.

---

**Sesión 9 (Languages configurable, pantalla completa del preview, fix definitivo del hueco en Experience, píldoras en Skills):**

- **Languages configurable por template**: nuevo bag `Template.languagesStyle` (`alignment`: left/center/right, `mode`: "row"/"columns"/"list") expuesto en `TemplateEditor.tsx`. "columns" es el comportamiento de la sesión anterior (una columna por idioma); "row" apila los idiomas como cualquier otra sección (título+"Nivel: valor" debajo, uno tras otro); "list" los pone en una sola línea ("Español (Nativo), Inglés (B2 (Linguaskill)), Japonés (Básico)"). El bloque `language-row` de `previewBlocks.ts` no cambió (sigue agrupando todos los idiomas en un único bloque atómico); solo cambia cómo se renderiza ese bloque en `CVPreview.tsx` según el modo. Migración `formatVersion` 7→8: backfill de `languagesStyle` con los valores por defecto (bag nuevo a nivel de template, no una clave dentro de un bag existente — sin backfill, `template.languagesStyle` sería `undefined` y reventaría al leer `.alignment`/`.mode`, mismo motivo que la migración v1→v2 original).
- **Pantalla completa en `PreviewViewport`**: nuevo botón a la izquierda de los controles de zoom (⛶ pantalla completa / ✕ para volver, además de Escape). Deliberadamente NO usa la Fullscreen API nativa del navegador (evita el permiso/gesto extra y el salto de ocultar la barra de direcciones) — es un overlay CSS `position:fixed; inset:0` que cubre toda la pestaña. El zoom se recalcula al entrar/salir (el contenedor cambia de tamaño sin que se dispare ningún evento `resize` de `window`). La regla de impresión ya reseteaba `.preview-viewport` a `position:static` incondicionalmente, así que exportar a PDF estando en pantalla completa no necesitó ningún cambio adicional (verificado leyendo el orden de las reglas CSS: la de impresión es posterior en el fichero y gana el empate de especificidad).
- **Fix definitivo del hueco en Experience/Education** (la sesión anterior lo redujo pero no lo eliminó del todo): subtítulo (empresa) y ubicación ahora van en la MISMA fila, con el mismo criterio izquierda/derecha/en línea que ya usaba título+fecha (`dateStyle.position`) — layout final exacto pedido por el usuario:
  ```
  título                                             fecha
  subtítulo (empresa)                              ubicación
  descripción
  tecnologías
  ```
  Nueva clase `.cv-preview__item-subheader` (mismo patrón flex que `.cv-preview__item-header`), sustituye a las dos líneas independientes de antes.
- **Skills con píldora**: `buildSkillsLayout` (`preview.ts`) devuelve ahora `values: string[]` en vez de un `text` ya unido por comas — cada valor se pinta como píldora (`.cv-preview__tag`, mismo estilo que Technologies en Experience/Projects) en vez de texto plano separado por comas, dentro de la misma línea que la etiqueta en negrita ("Programming Languages: (C++) (Python)"). Nueva clase `.cv-preview__tags--inline` (variante de `.cv-preview__tags` que no fuerza su propia línea, para que la lista de píldoras siga a "Etiqueta:" en el mismo renglón).
- **Verificación de esta sesión:** 326/326 tests de dominio (2 nuevos: migración v7→v8 con/sin `languagesStyle` previo); sintaxis y tipos de `CVPreview.tsx`/`PreviewViewport.tsx`/`TemplateEditor.tsx` verificados con esbuild/tsc (mismos falsos positivos ya conocidos por falta de `@types/react`, ninguno nuevo). **Pendiente de verificación en navegador real por el usuario**: aspecto visual de los 3 modos de Languages, comportamiento del botón de pantalla completa (incluyendo exportar a PDF estando en ese modo), y el layout final de Experience/Education.

---

**Sesión 8 (ATS/paginación del PDF + reestructuración de contenido: Summary, Skills fusionado, Projects sin fecha, Experience, Languages en columnas):**

- **Bug real de ATS en el PDF exportado — causa raíz encontrada y confirmada empíricamente** (Playwright headless_shell + pdfjs-dist, ANTES de tocar el código): cualquier texto con `opacity < 1` en `.cv-preview` (fechas, ubicación, subtítulo, meta, tags, contacto del banner) crea un nuevo *stacking context* en CSS; al exportar a PDF, Chromium pinta ese contenido en una capa de impresión aparte y el texto se extrae fuera de su posición real (se reprodujo con un HTML mínimo: el mismo texto con `opacity` sale al final del documento; con `color` sólido, en su sitio). Fix: todo el texto "secundario" de `styles.css` pasa de `opacity` a `color: var(--cv-muted)` (nueva CSS var en `CVPreview.tsx`, alimentada por `template.colors.muted`, que ya existía en el modelo pero no se usaba en ningún sitio). Los `opacity` que quedan en `styles.css` son todos de la UI de edición (nunca se imprimen), no del documento exportado.
- **Bug real de "página extra casi en blanco" al exportar — causa raíz confirmada empíricamente** (mismo método: reproducido con un HTML mínimo que fuerza el desajuste): cada `.cv-preview__page` tiene `min-height` (no `height` fija) + `break-after:page` forzado; si el contenido mide un poco más al imprimir que en pantalla (ya había un colchón de seguridad para esto), el desbordamiento natural se combina con el salto forzado y aparece una página adicional, casi vacía, justo después. Se subió el colchón de 4mm a 7mm como mitigación (sigue siendo una mitigación, no una garantía — ver comentario extenso en `CVPreview.tsx`). Se identificó la única forma de eliminar la CLASE de bug por completo (dejar que el motor de impresión pagine de forma nativa en un único flujo continuo con `@page margin`, en vez de pre-cortar en JS con divs por página) — es un cambio de arquitectura real que afecta al objetivo del §18 ("Preview ≈ PDF idéntico"), así que se dejó pendiente de decisión explícita del usuario en vez de aplicarse sin más.
- **"Profile" → "Summary"**: solo el título mostrado (`defaultTitle`); la key interna `profile` no se toca (ninguna referencia se rompe). Migración `formatVersion` 4→5: renombra el título SOLO si seguía siendo literalmente "Profile" (si el usuario ya lo había personalizado, se respeta).
- **Fusión de Skills**: "Skills"/"Programming languages"/"Software / Tools" (3 secciones con un elemento versionable por skill) se convierten en una única sección "Skills" con 3 campos de listas de etiquetas (Programming Languages / Technologies / Soft Skills), mostrando cada campo solo si tiene contenido, en texto plano ("Etiqueta: valores") sin el estilo de píldora de las tecnologías de Experience/Projects — `buildSkillsLayout` en `preview.ts`, rama específica en `CVPreview.tsx` (detectada por `section.key==="skills"`, mismo patrón que el banner de cabecera).
  - **Migración `formatVersion` 5→6 — la más "con pérdida" de esta app hasta ahora, documentada explícitamente**: los elementos/variantes de las 3 secciones antiguas se mueven a la papelera (recuperables, nunca se borran de verdad) y sus nombres se fusionan en un ÚNICO elemento nuevo con las 3 listas. Se pierde la posibilidad de versionar cada skill por separado y el campo "Nivel" (sin equivalente en el nuevo schema). Mapeo sección origen → campo nuevo: "programming-languages"→programmingLanguages y "software-tools"→technologies son claros; la antigua sección genérica "skills"→softSkills es una decisión editorial (era un cajón sin distinción semántica), señalada explícitamente en el código para que el usuario pueda recolocar manualmente si no encaja. Los CVs que ya mostraban contenido de alguna de las 3 secciones reciben un único item apuntando al elemento fusionado (no pierden visibilidad); los que no, se quedan igual.
  - Limitación conocida y asumida (no arreglada, fuera de alcance de lo pedido): el heurístico de importación de PDF para esta sección sigue siendo el genérico de título+fecha+descripción, no uno específico para repartir texto en las 3 listas de tags — el usuario puede seguir revisando/rellenando manualmente en la pantalla de importación.
- **Projects**: sin ningún campo de fecha (eliminado del schema), nuevo campo "Subtitle", enlaces en la misma línea que el subtítulo separados por "•" en texto plano (NO como píldora — a diferencia de Technologies, que sigue igual). Nuevo `buildProjectLayout` en `preview.ts` (mismo criterio genérico por TIPO de campo que `buildItemLayout`, no hardcodeado a los nombres de campo). Migración `formatVersion` 6→7: quita `dateRange` del schema (los valores ya guardados quedan huérfanos e inertes en el JSON, no se borran) e inserta "Subtitle" justo después de "Title".
- **Experience**: corregido un hueco visual entre el título y la empresa introducido en la sesión 7 al añadir la ubicación — causa: la ubicación se pintaba ANTES que el subtítulo (empresa), dejando una línea vacía bajo el título mientras la empresa quedaba una línea más abajo. Fix: subtítulo antes que ubicación (puro cambio de orden de render en `CVPreview.tsx`, sin migración).
- **Languages en columnas**: en vez de una fila por idioma (como el resto de secciones), ahora es una fila de N columnas centradas, una por idioma. Requirió un nuevo tipo de bloque a nivel de dominio: `PreviewBlock` gana la variante `"language-row"` (`previewBlocks.ts`), que agrupa TODOS los items de una sección en un único bloque atómico de cara a la paginación — detectado por `section.key==="languages"` (nuevo campo `key` en `ResolvedSection`, `resolveCV.ts`), no por id, para que siga funcionando si el usuario duplica la base de datos. `pagination.ts` no necesitó cambios (los bloques que no son "section-title" ya se tratan todos igual).
- **Verificación de esta sesión:** 324/324 tests de dominio (`node --test`; ~30 nuevos: migraciones v4→v7 incluida la fusión de Skills de extremo a extremo con papelera + CVs afectados, `buildProjectLayout`, `buildSkillsLayout`, agrupación de `language-row`); causas raíz del bug de ATS y del bug de página extra reproducidas y confirmadas empíricamente con Playwright (`chromium` de `/opt/pw-browsers`) + `pdfjs-dist` ANTES de escribir el fix, no solo razonadas sobre el papel; sintaxis y tipos de `CVPreview.tsx` y de todos los ficheros de dominio tocados verificados con `esbuild`/`tsc` (symlinkando paquetes globales a `node_modules` para poder resolverlos en este sandbox — mismo truco que ya se documentaba como posible, ahora confirmado que funciona). **Pendiente de decisión del usuario**: si además de la mitigación del colchón de seguridad quiere la reestructuración completa a paginación nativa del motor de impresión para el bug de "página extra" (ver arriba). **Pendiente de verificación en navegador real por el usuario**: aspecto visual final de las columnas de Languages, de la nueva línea de Projects, y confirmación de que el bug de ATS/selección de texto queda resuelto con un PDF real.

---

**Sesión 7 (tanda grande de funcionalidad nueva, no solo pulido):**

- **Regresión real encontrada y corregida** (no reportada por el usuario, encontrada al releer el
  código antes de tocarlo): `extractCvPlainText` (`ats/cvText.ts`) seguía tratando `layout.tags`
  como `string[][]`, pero desde la sesión de "enlaces clicables" es `TagItem[][]`
  (`{text,href}[][]`) — el texto usado para el análisis ATS incluía literalmente la cadena
  `"[object Object]"` por cada tecnología/enlace de cualquier CV. No tenía test propio; se le
  añadió uno (`cvText.test.ts`).
- **Ubicación pintada debajo de la fecha** (Experience, Education y cualquier sección con un campo
  de ubicación): `buildItemLayout` (`preview.ts`) ahora detecta un campo de texto llamado/
  etiquetado como ubicación (en cualquier posición del schema, no solo por orden) y lo saca aparte
  en `locationText`, en vez de mezclarlo en la línea de "meta". Se pinta justo debajo de la fecha,
  alineado al mismo lado que `dateStyle.position` (el mismo parámetro de template que ya
  controlaba las fechas). Education ganó un campo "Location" nuevo (con migración v3→v4 para
  bases de datos ya existentes, backfill igual que se hizo antes con los parámetros de template).
- **El panel de edición de un item del CV ya no se cierra al pulsar "Guardar"** (bug real
  reportado: obligaba a volver a pulsar "Editar" para seguir tocando el mismo item) — se queda
  abierto con un "✓ Guardado" transitorio. "Guardar como variante" también se queda abierto,
  continuando la edición sobre la variante recién creada.
- **Renombrar**: variantes ("versiones de los datos"), versiones de CV ("v1"/"v2"...), y el CV
  entero (de la sesión anterior) — nuevas funciones de dominio `renameVariant`/`renameCVVersion`
  con botón "Renombrar"/"✎" en `ElementCard.tsx`, `CvItemEditPanel.tsx` y `CVComposer.tsx`.
- **Idioma de visualización por CV** (`CVVersion.displayLanguage`, campo opcional — sin migración
  necesaria, `undefined` se trata como inglés): nuevo selector al principio de `CVContentPanel.tsx`
  ("Idioma de visualización"). Controla:
  - El idioma de las fechas (nombres de mes vía `Intl`, locale BCP-47 derivado del código corto).
  - La traducción de "Actualidad"/"Present" para rangos en curso.
  - La traducción de títulos de sección y etiquetas de campo, pero SOLO si siguen en su valor por
    defecto de fábrica (diccionario estático en `i18n.ts`, es/en por ahora, fácilmente ampliable).
  
  **Importante, contradicción con el contexto detectada y resuelta de forma acotada**: §21 del
  contexto prohíbe explícitamente "traducción automática" y "un servicio externo de traducción".
  Lo implementado NO es un traductor: es un diccionario ESTÁTICO y LOCAL de un puñado de textos
  fijos que la propia app pone por defecto — en cuanto el usuario edita un título de sección o el
  contenido de un campo, deja de coincidir con el diccionario y se queda tal cual, sin tocar nunca
  contenido propio del usuario (descripciones, nombres de proyectos...). Se consideró un
  overreach implementar traducción de CONTENIDO de usuario (violaría §21 directamente) y no se
  hizo — si se quiere eso, haría falta hablarlo primero, es un cambio de alcance mayor.
- **Formato \*negrita\*/\*\*cursiva\*\* y viñetas "· " en campos de texto enriquecido**: el
  editor seguía siendo un `<textarea>` de texto plano que solo generaba párrafos sin formato
  (`plainTextToRichText`), aunque el modelo de datos (`RichTextRun.bold/italic`, bloques tipo
  "bullet") y el renderer (`RichTextView.tsx`) YA soportaban esto por completo desde antes — la
  única pieza que faltaba era el PARSER. Ahora reconoce "· " al principio de línea como viñeta
  (con los parámetros de `bulletStyle` de la template) y \*texto\*/\*\*texto\*\* como negrita/
  cursiva dentro de una línea (al revés que en Markdown de verdad, tal y como lo pidió el
  usuario). `richTextToPlainText` (la conversión inversa, para poder reeditar un campo ya
  guardado) reproduce la MISMA sintaxis, así que el roundtrip editar→guardar→reeditar no pierde
  el formato. Añadido un hint junto al textarea explicando la sintaxis.
- **Informe de capacidades del analizador ATS**: entregado en el chat (no en un fichero), con dos
  listas separadas de mejoras posibles — sin APIs de terceros/IA, y las que sí dependerían de
  ellas — a petición del usuario, tras revisar los 6 ficheros de `src/domain/ats/` a fondo.
- **Verificación de esta sesión:** 311/311 tests de dominio (unos 30 nuevos: regresión de
  cvText, ubicación en el layout, migración v3→v4, rename de variante/versión, idioma de
  visualización, negrita/cursiva/viñetas con roundtrip); geometría de "ubicación debajo de la
  fecha, alineada al mismo lado" verificada con Playwright, además de repetir todas las
  comprobaciones de sesiones anteriores (centrado, header fijo, paginación de impresión, ancho de
  columnas) para descartar regresiones.

---

**Sesión 8 (esta sesión — mejora grande de la importación de PDF, a partir de un informe de
análisis externo aportado por el usuario; fases A–I del plan del informe, sin OCR ni modelos ML
(fases J/K), descartadas explícitamente por el usuario por ir contra el espíritu "sin IA" del
proyecto y añadir peso innecesario):**

- **Extracción enriquecida** (`pdfTextExtraction.ts`, `types.ts`): además del texto y su posición,
  ahora se captura el ANCHO real de cada `TextItem` de pdf.js (antes se estimaba por longitud de
  texto × tamaño de fuente — `styleAnalysis.ts` ya usa el valor real cuando está disponible, con el
  estimado como fallback para fixtures antiguos), una heurística `bold`/`italic` a partir del
  nombre de la fuente embebida, y las anotaciones de tipo enlace de cada página
  (`page.getAnnotations()`) — la base para resolver URLs reales en vez de adivinar por la forma del
  texto visible.
- **Detección de columnas** (`classification/columnDetection.ts`): detecta un gutter estable entre
  dos regiones verticales (p.ej. un sidebar de contacto/skills a la izquierda y el cuerpo principal
  a la derecha) exigiendo repetición del hueco a través de varias líneas y contenido sustancial a
  ambos lados — descarta huecos puntuales (una fecha alineada a la derecha en una sola línea, un
  número de página suelto). `sortReadingOrderWithColumns` (`readingOrder.ts`) usa esto para ordenar
  cada columna de forma independiente en vez de intercalarlas por Y global; en un CV de una sola
  columna (la inmensa mayoría) el resultado es idéntico al algoritmo anterior — se usa ya en
  `buildDraft.ts` en vez de `sortReadingOrder`.
- **Headers/footers repetidos entre páginas** (`classification/headerFooterDetection.ts`): en PDFs
  multi-página, descarta líneas que se repiten en la misma posición Y (con tolerancia relativa a la
  altura de página) en 2+ páginas distintas — nombre de documento, numeración... — ANTES de
  clasificar nada en secciones, para que no acaben coladas dentro de Experience o Education solo
  por caer geométricamente ahí. Conservador a propósito: exige mismo texto Y misma posición, no
  solo una de las dos.
- **Detección de cabeceras de sección por scoring** (`sections/sectionScoring.ts` +
  `sections/sectionLexicon.ts`, extraído de `segmentation.ts` sin cambiar su comportamiento):
  diccionario de sinónimos ES/EN ampliado (más formas de Experience/Skills/Certifications...), y
  nueva `detectHeadingCandidates`, usada ya en `buildDraft.ts` en vez de `detectHeadings` a secas.
  Deliberadamente conservadora: SOLO busca títulos de sección con redacción no estándar ("Professional
  Journey") cuando ya hay al menos una cabecera reconocida léxicamente en ESE documento, aprendiendo
  su tamaño/negrita exactos y buscando más líneas cortas (sin fechas, sin @, pocas palabras) en ese
  mismo estilo — sin ninguna cabecera léxica confirmada, no inventa nada (mismo resultado que
  `detectHeadings`). Se descartó explícitamente una heurística más agresiva (cualquier línea corta y
  grande/negrita) por el riesgo real de fragmentar Experience cada vez que un puesto en negrita se
  repite de estilo entre entradas — con la firma de estilo aprendida de cabeceras YA confirmadas,
  ese caso queda cubierto por un test de regresión propio.
- **Parser de rol/empresa y título/institución** (`entries/experienceEducation.ts`, con el cálculo
  de fecha compartido extraído a `entries/entryDateSplit.ts` para no duplicar lógica con
  `buildDraftEntry`): limitación conocida de sesiones anteriores (el heurístico genérico no separaba
  "Software Engineer" de "Acme Corp", los dejaba pegados o el segundo caía en la descripción).
  Ahora, cuando la sección destino tiene un segundo campo de texto/url distinto del título
  (`company`/`institution`/`subtitle`) Y la entrada tiene 3+ líneas además de la fecha Y la segunda
  línea tiene pinta de nombre propio corto (no termina en punto, pocas palabras), se reparte en dos
  campos — con solo 2 líneas (el caso que ya cubrían los tests existentes) se mantiene el
  comportamiento de siempre, verificado con un test de equivalencia explícito. Aplicado a
  Experience, Education y Projects.
- **Clasificador de Skills por categorías** (`entries/skillsParser.ts`): "Skills" no es una lista de
  entradas repetidas sino un único conjunto de listas de etiquetas (programmingLanguages/
  technologies/softSkills) — `buildDraft.ts` ahora agrupa TODO el chunk de esta sección en una única
  entrada (mismo patrón que ya existía para el bloque de datos personales) en vez de trocearlo por
  fecha/título como el heurístico genérico. `extractSkillsFields` reparte cada línea por etiqueta
  explícita reconocida ("Programming Languages:", "Tools:", "Soft Skills:", con sinónimos ES/EN) y,
  para el resto, por un pequeño diccionario cerrado de lenguajes de programación y soft-skills
  frecuentes — lo que no reconoce ningún diccionario cae en "technologies" en vez de perderse.
  Schema-driven: si la sección solo tiene un campo de tags (una sección custom simple), todo va
  junto ahí.
- **Resolución de enlaces vía anotaciones PDF** (`fields/linkExtraction.ts`): dado que ahora se
  extraen las anotaciones de tipo enlace de cada página, `resolveLinkForLine` comprueba si el
  rectángulo de alguna anotación solapa (misma página, solape real en X e Y) con una línea de texto
  — soluciona el caso real de un CV donde el texto visible dice solo "LinkedIn" o "GitHub" sin
  ninguna URL visible, con el enlace real solo como anotación clicable. Conectado a
  `personalInfoMapping.ts` (nuevo parámetro opcional `lineLinks`, alineado por índice con `lines`,
  con compatibilidad hacia atrás total cuando se omite) y desde ahí a `buildDraft.ts`
  (`buildHeaderSection` ahora calcula `lineLinks` a partir de `doc.links`). Si el texto visible de la
  línea tiene pinta de etiqueta corta ("LinkedIn"), se considera consumido por el enlace y no se
  cuela como nombre/headline por error.
- **Deduplicación contra la base de datos existente** (`mapping/dedup.ts`): antes de crear un
  elemento nuevo al importar, `findSimilarElements` compara (Levenshtein normalizado, sin acentos ni
  puntuación) el título detectado contra las etiquetas de los elementos YA existentes en la MISMA
  sección (`labels.ts:guessElementLabel`) y devuelve como mucho 3 candidatos por encima de un umbral
  de similitud — nunca fusiona nada automáticamente (§16 del contexto: "nunca eliminar/duplicar
  silenciosamente"), solo lo propone. `PdfImportScreen.tsx` muestra esta sugerencia por entrada (solo
  cuando hay candidatos) con un desplegable "¿Es lo mismo que algo que ya tienes?" — si el usuario
  elige un candidato, `handleImport` usa `appStore.forkVariant` sobre la variante por defecto de ese
  elemento en vez de `appStore.createElement`, añadiendo la entrada importada como una VARIANTE
  NUEVA del elemento existente en lugar de un elemento duplicado. Simplificación consciente: la
  sugerencia se calcula UNA vez al mapear la entrada (a partir del título detectado en ese momento),
  no en cada pulsación de tecla si el usuario edita el título a mano después.
- **Fuera de alcance de esta sesión, a propósito** (confirmado con el usuario antes de empezar):
  OCR local para PDFs escaneados y un modelo ONNX pequeño para desambiguar casos difíciles (fases
  J/K del informe) — quedan fuera por ahora, tanto por el espíritu "sin IA" del proyecto (§27 del
  contexto) como por el peso de dependencias nuevas que añadirían. Tampoco se ha tocado: extracción
  de ubicación dentro de una entrada de Experience/Education durante la importación (el campo queda
  sin rellenar automáticamente, igual que antes — la función ya existe para el RENDERER desde la
  sesión 7, pero no para el pipeline de importación); el heurístico de Certifications/Publications/
  Awards sigue siendo el genérico título+fecha+descripción, sin parser propio (no estaba entre los
  ejemplos más repetidos del informe y el heurístico genérico ya cubre razonablemente bien su forma,
  que es más simple que Experience/Education).
- **Verificación de esta sesión:** 419/419 tests de dominio (`node --test`, en torno a 45 nuevos:
  detección de columnas, headers/footers repetidos, scoring de cabeceras, parser de rol/empresa,
  clasificador de skills, resolución de enlaces vía anotaciones, deduplicación), todos ejecutados de
  verdad contra `pdfjs-dist`/`pdf-lib` reales (no mocks) — el sandbox de esta sesión sí tenía estos
  paquetes disponibles globalmente (síntoma de un `node_modules` del proyecto ausente puntualmente
  en este entorno, no de un cambio de dependencias; se symlinkearon desde el caché global de npm
  para poder ejecutar la suite). **Limitación sin cambios respecto a sesiones anteriores:** sigue sin
  haber `@dnd-kit`, `@types/react` ni `@types/node` en este sandbox, así que no se ha podido correr
  un `tsc --noEmit` completo del proyecto ni levantar la app completa con Vite — la integración en
  `PdfImportScreen.tsx` (nuevo desplegable de deduplicación) se ha revisado a mano con cuidado pero
  **no se ha podido verificar en un navegador real** — en particular: que el desplegable de
  deduplicación aparece y funciona correctamente, que `forkVariant` crea la variante en el elemento
  correcto, y el comportamiento del pipeline completo (columnas, scoring de cabeceras, skills,
  enlaces vía anotaciones) contra un PDF real de dos columnas o con enlaces sin URL visible — los
  PDFs de prueba de esta sesión son todos generados sintéticamente con `pdf-lib` dentro de los tests
  de dominio, no el PDF real de sesiones anteriores (no estaba disponible en el contexto de esta
  sesión). **Verificación pendiente del usuario**, con prioridad especial en: un CV real de dos
  columnas, un CV real con "LinkedIn"/"GitHub" como enlaces clicables sin URL visible en el texto, y
  el flujo de deduplicación de principio a fin (importar el mismo CV dos veces y comprobar que la
  segunda vez ofrece fusionar en vez de duplicar).

---

**Sesión 9 (esta sesión — nueva funcionalidad: crear un CV automáticamente a partir de una oferta
de trabajo pegada, petición explícita del usuario):**

- **`src/domain/jobMatching.ts`** (nuevo): núcleo de la funcionalidad. `matchDatabaseToJobDescription(db,
  jobDescriptionText)` recorre toda la base de datos y decide, para cada sección, qué incluir:
  - `personal-information`, `profile` y `skills` se incluyen SIEMPRE enteras (con la variante por
    defecto de cada uno de sus elementos) — son identidad/resumen del candidato, no contenido que
    tenga sentido puntuar contra una oferta concreta.
  - El resto de secciones (Experience, Education, Projects, Certifications, Awards, Publications,
    Courses, Volunteering, References, y cualquier sección custom) puntúan cada ELEMENTO contra las
    keywords de la oferta, reutilizando `extractKeywordFrequencies`/`tokenize` de
    `ats/textAnalysis.ts` (el mismo motor sin IA que ya usa el comparador CV-vs-oferta del análisis
    ATS) — mismo principio del §20 del contexto ("no se debe utilizar IA para esta funcionalidad").
    Para cada elemento se prueban TODAS sus variantes YA EXISTENTES y se elige la de mayor
    puntuación — nunca se crea ninguna variante nueva, tal y como pidió explícitamente el usuario
    ("sin crear versiones nuevas de las cosas de la bd"), verificado con un test que comprueba que
    el recuento de variantes de la base de datos no cambia. Los elementos sin ninguna keyword en
    común se descartan, y cada sección se limita a un máximo de 6 elementos (`MAX_ITEMS_PER_CONTENT_SECTION`)
    para que "la mejor correspondencia posible" no degenere en meter todo lo que haya con una
    coincidencia mínima.
  - `guessJobTitle(text)`: usa la primera línea no vacía del texto pegado como nombre del CV (según
    pidió el usuario: "el nombre del CV sería como el nombre de la oferta de trabajo") — es la
    convención casi universal de portales de empleo/anuncios/PDFs de oferta (el título del puesto
    va primero, antes de cualquier introducción sobre la empresa), recortado a una longitud
    razonable por si el texto pegado no tiene saltos de línea limpios.
  - Refactor seguro y verificado de `ats/cvText.ts`: se extrajo `extractItemLayoutPlainText` (antes
    era lógica inline dentro de `extractCvPlainText`) para poder reutilizar EXACTAMENTE la misma
    extracción de texto de un item (título/subtítulo/descripciones/tags/meta) al puntuar un
    elemento suelto de la base de datos, sin tener que resolver un CV completo — comportamiento
    idéntico confirmado con los tests ya existentes de `cvText.test.ts`.
- **`src/domain/cv.ts`**: nueva función `setCvMetadata` (mezcla sobre `metadata` sin reemplazar el
  objeto entero) — hasta ahora `CVVersion.metadata` se inicializaba vacío y no había ninguna forma
  de rellenarlo después. Se usa para dejar guardado el texto completo de la oferta original en
  `metadata.notes` de la versión generada, a modo de trazabilidad ("por qué se seleccionó esto").
- **`src/app/state/appStore.ts`**: nuevo método `createCvFromJobDescription(jobDescriptionText)` que
  encadena todo: `matchDatabaseToJobDescription` → `cvDomain.createCVProject` (nombrado con
  `guessJobTitle`) → `cvDomain.setSectionItems` por cada sección con contenido seleccionado →
  `cvDomain.setCvMetadata` con la oferta original. Reutiliza `ensureAtLeastOneTemplate` igual que
  `createCVProject`, así que el comportamiento de "crear un template por defecto si no hay ninguno"
  es idéntico al del flujo manual de creación de CV.
- **`src/app/ui/components/JobMatchScreen.tsx`** (nuevo) + botón "Crear CV a partir de una oferta"
  en el Dashboard (junto a "+ Nuevo CV" e "Importar CV desde PDF"): un textarea para pegar la oferta
  y un botón "Generar CV". A diferencia de la importación de PDF, aquí NO hay pantalla de revisión
  intermedia — decisión consciente: no se extrae ni se crea ningún dato nuevo, solo se SELECCIONA
  contenido que ya existe, así que en cuanto se genera se navega directo al editor del CV recién
  creado (`CVComposer`), donde el usuario ya ve en tiempo real qué se seleccionó y puede ajustarlo a
  mano exactamente igual que con cualquier otro CV (quitar/añadir elementos, cambiar variantes,
  reordenar secciones...) — no hace falta un flujo de revisión propio para eso, ya existe.
- **Fuera de alcance de esta sesión, a propósito**: no se ha tocado el editor de CV para mostrar de
  forma especial "esto se generó desde una oferta" (las notas quedan guardadas en
  `metadata.notes` pero no hay ninguna pantalla que las muestre todavía — no se pidió, y añadir una
  UI de solo lectura para un campo que de momento no se edita en ningún sitio no aportaba valor
  suficiente para el alcance de esta sesión); tampoco se ha afinado el umbral de puntuación mínima
  ni el máximo de elementos por sección más allá de valores por defecto razonables — son constantes
  (`MIN_SCORE_TO_INCLUDE`, `MAX_ITEMS_PER_CONTENT_SECTION`) fáciles de ajustar si en el uso real
  resultan demasiado laxas/estrictas.
- **Verificación de esta sesión:** 433/433 tests de dominio (`node --test`, 21 nuevos: matching
  puro en `jobMatching.test.ts`, integración completa en `appStore.test.ts` incluyendo la
  comprobación explícita de que no se crea ningún elemento/variante nuevo). **Limitación sin
  cambios respecto a sesiones anteriores:** sin `@dnd-kit`/`@types/react`/`@types/node` en este
  sandbox, no se ha podido compilar `tsc` completo ni levantar la app con Vite — `JobMatchScreen.tsx`
  y los cambios en `Dashboard.tsx` están revisados a mano con cuidado pero **necesitan verificación
  en un navegador real**, en particular: que el botón nuevo aparece y navega correctamente, que el
  textarea y el estado disabled del botón funcionan, y sobre todo probar el resultado con una base
  de datos real y una oferta de trabajo real para juzgar si la selección automática (qué se incluye,
  qué se descarta, el límite de 6 por sección) da resultados razonables en la práctica — esto es
  fundamentalmente una heurística nueva sin datos reales de referencia todavía.

---

**Sesión 10 (esta sesión — pantalla intermedia de revisión para "crear CV desde oferta" + puntuación
global y consejos de mejora en el comparador ATS, ambas peticiones explícitas de seguimiento a la
sesión 9):**

- **`src/domain/ats/jobComparison.ts`**: `JobComparisonResult` gana `matchScore` (0-100) — qué
  proporción de las MENCIONES (no de keywords distintas: una que la oferta repite 5 veces pesa 5
  veces más que una que aparece 1 sola vez, igual que el resto del módulo) de keywords de la oferta
  cubre el CV. 0 si la oferta no tiene ninguna keyword reconocible (evita NaN). Tests nuevos
  cubriendo el caso 100%, 0%, ponderación por frecuencia, y el caso borde de oferta sin keywords.
- **`src/domain/jobMatching.ts`**, ampliado sin romper nada de la sesión anterior (los 10 tests
  previos siguen en verde tal cual):
  - Cada item de `JobMatchSectionResult` ahora lleva también `label` (vía `labels.ts:guessElementLabel`),
    `score` y `matchedKeywords` — la base para poder explicar "por qué se eligió esto" en la UI sin
    que la pantalla tenga que recalcular nada.
  - `JobMatchSectionResult` gana `alwaysIncluded: boolean` (antes esto vivía solo como una lista de
    keys interna, `ALWAYS_INCLUDE_SECTION_KEYS`, invisible desde fuera).
  - `JobMatchResult` gana `matchScore`: la puntuación global (mismo cálculo que
    `ats/jobComparison.ts`) de la selección propuesta.
  - Nueva `buildPlainTextForSelection(db, selection)`: reconstruye el texto que tendría un CV
    compuesto por una selección de elementos/variantes SIN necesitar un `CVVersion` real
    persistido — la pieza que hace posible recalcular la puntuación en vivo mientras el usuario
    activa/desactiva elementos en la pantalla de revisión, antes de que exista ningún CV.
  - Nueva `computeMatchScoreForSelection(db, selection, jobText)`: atajo sobre lo anterior + el
    mismo cálculo de `matchScore`, para no tener que importar también `ats/jobComparison.ts` desde
    la UI.
  - Nueva `suggestImprovements(db, cvVersionId, jobDescriptionText)` (petición explícita: "consejos
    de qué apartados/proyectos se podrían cambiar"): para cada sección de contenido del CV (no las
    de identidad), compara los elementos YA seleccionados contra el resto de elementos de la MISMA
    sección en la base de datos que NO están en el CV, y propone añadir (si la sección tiene hueco
    por debajo del máximo de 6) o sustituir el peor puntuado (si no lo tiene) — pero SOLO cuando el
    candidato cubre alguna keyword que el CV, en su conjunto, no cubre ya por ningún otro lado
    (comprobado contra `extractCvPlainText` del CV real): un candidato que "puntúa alto" pero no
    aporta nada nuevo no se sugiere, para que los consejos sean siempre accionables de verdad, no
    ruido. Nunca toca la base de datos ni el CV — son solo sugerencias de texto.
  - `scoreElement` (antes función privada) pasa a exportarse como
    `scoreElementAgainstJobKeywords`, y se añade `buildJobKeywordScores` — ambas reutilizadas entre
    `matchDatabaseToJobDescription` y `suggestImprovements` sin duplicar lógica de puntuación.
- **`src/app/state/appStore.ts`**: refactor de `createCvFromJobDescription` — la lógica de "crear el
  proyecto + aplicar la selección a cada sección + guardar la oferta en las notas" se extrajo a una
  función interna (`createCvFromSelectionInternal`, closure normal, sin usar `this` para evitar
  cualquier problema de binding) reutilizada por el método nuevo `createCvFromSelection(params)` —
  como `createCvFromJobDescription` pero con una selección YA decidida de antemano (por el usuario,
  tras editarla en la pantalla de revisión) en vez de recalcularla desde cero. Las secciones con
  `items: []` se omiten (no crea una sección vacía en el CV). Comportamiento de
  `createCvFromJobDescription` sin cambios (mismos tests de la sesión 9 en verde).
- **`src/app/ui/components/JobMatchScreen.tsx`**, reescrito con un flujo de dos pasos en vez de
  "pegar → crear" directo:
  1. **Pegar**: igual que antes, un textarea + "Analizar y proponer selección" (ya no crea el CV
     directamente, solo llama a `matchDatabaseToJobDescription` — función de dominio pura, sin
     pasar por `appStore` porque no muta nada, mismo patrón que ya usa `PdfImportScreen.tsx`).
  2. **Revisión** (petición explícita): puntuación global grande arriba (recalculada en vivo con
     `useMemo` + `computeMatchScoreForSelection` cada vez que cambia la selección), nombre del CV
     editable (precargado con `guessJobTitle`), y una sección por cada sección propuesta con:
     checkbox "marcar/desmarcar todo" a nivel de sección, y un checkbox + motivo por cada item
     ("Elegido porque coinciden N keywords: X, Y, Z" — o "Sección de identidad, no se puntúa" para
     personal-information/profile/skills). Al desmarcar algo, la puntuación de arriba cambia al
     instante. "Crear CV con esta selección" llama a `appStore.createCvFromSelection` con
     exactamente lo que quedó marcado.
- **`src/app/ui/components/AtsScreen.tsx`** (comparador CV-vs-oferta ya existente, petición
  explícita de ampliarlo): además de las listas de keywords presentes/ausentes de siempre, ahora
  muestra la puntuación global (`comparison.matchScore`) con el mismo estilo visual que la pantalla
  de revisión de creación de CV (coherencia entre ambas pantallas), y una nueva caja "Cómo mejorar
  la puntuación" alimentada por `suggestImprovements(db, cvVersionId, jobDescription)` — para cada
  sugerencia, indica si es "añadir X a la sección Y" o "sustituir X por Y en la sección Z", y qué
  keywords concretas de la oferta pasarían a cubrirse. Si no hay ninguna sugerencia útil, lo dice
  explícitamente en vez de dejar la caja vacía sin explicación.
- **Fuera de alcance de esta sesión, a propósito**: no se ha tocado el editor de CV (`CVComposer`)
  para aplicar directamente una sugerencia de `suggestImprovements` con un clic (por ahora son solo
  texto informativo; aplicar el cambio se sigue haciendo a mano desde el editor, con
  `setSectionItems`/`forkVariant` ya existentes) — un botón "aplicar esta sugerencia" sería la
  extensión natural si se pide más adelante, pero no se pidió en esta ronda y añadía superficie de
  riesgo (mutar el CV desde dentro del análisis ATS, que hasta ahora es de solo lectura) sin
  necesidad clara todavía.
- **Verificación de esta sesión:** 445/445 tests de dominio (`node --test`; nuevos: `matchScore` en
  `jobComparison.test.ts`, `label`/`score`/`matchedKeywords`/`alwaysIncluded` y
  `computeMatchScoreForSelection`/`suggestImprovements` en `jobMatching.test.ts`,
  `createCvFromSelection` en `appStore.test.ts`). **Limitación sin cambios respecto a sesiones
  anteriores:** sin `@dnd-kit`/`@types/react`/`@types/node` en este sandbox, no se ha podido
  compilar `tsc` completo ni levantar la app con Vite — `JobMatchScreen.tsx` (el flujo de dos pasos
  completo, especialmente la interacción de marcar/desmarcar y ver la puntuación cambiar en vivo) y
  los cambios en `AtsScreen.tsx` están revisados a mano con cuidado pero **necesitan verificación en
  un navegador real**, y sobre todo un juicio de valor con datos reales: si la puntuación (0-100%
  por cobertura de menciones) se siente informativa o arbitraria en la práctica, y si los consejos
  de `suggestImprovements` son realmente accionables o demasiado obvios/raros con contenido real.

---

**Sesión 11 (esta sesión — reordenar "Skills" entre Summary y Experience, petición explícita; +
estudio de mejoras para "crear CV desde oferta" entregado en el chat, sin cambios de código):**

- **Reordenación de secciones estándar** (`src/domain/database.ts`): "Skills" pasa a ir justo
  después de "Summary" y antes de "Experience" — antes iba justo después de "Projects", casi al
  final. Nueva constante exportada `STANDARD_SECTION_KEY_ORDER` (única fuente de verdad del orden
  canónico, comprobada contra `createEmptyDatabase()` con un test que falla si algún día ambas
  listas divergen).
  - Importante, aclarado y confirmado por el código antes de tocar nada: el `order` de una
    `SectionDefinition` NO reordena los CVs YA creados (cada `CVVersion` tiene su propio orden de
    secciones, independiente y reordenable a mano por el usuario vía drag-and-drop) — solo afecta:
    el orden de la lista de secciones del Dashboard, el orden en que se ofrecen para añadir en el
    editor de CV (`CVContentPanel.tsx`), y el orden en que "Crear CV a partir de una oferta"
    (`jobMatching.ts`) añade cada sección a un CV NUEVO (que sí hereda este orden). Así que este
    cambio no reordena CVs existentes — solo el orden por defecto de ahora en adelante.
  - **Migración v8→v9** (`CURRENT_FORMAT_VERSION` ahora 9, `src/persistence/migrations.ts`):
    recalcula el `order` de las secciones ESTÁNDAR de bases de datos ya existentes según
    `STANDARD_SECTION_KEY_ORDER`; las secciones CUSTOM del usuario conservan su orden relativo
    entre sí, desplazadas después de todas las estándar (antes podían quedar intercaladas según
    cuándo se hubieran creado).
  - **Verificación:** 449/449 tests de dominio (4 nuevos: orden canónico en base de datos nueva,
    coincidencia entre `STANDARD_SECTION_KEY_ORDER` y las keys reales, migración v8→v9 reordenando
    estándar, migración v8→v9 preservando orden relativo de custom) + 6 tests existentes de
    `migrations.test.ts` actualizados (comprobaban `formatVersion === 8` como versión final, ahora
    9 — cambio mecánico, no de comportamiento). Sin cambios de UI: `Dashboard.tsx`,
    `CVContentPanel.tsx` y `JobMatchScreen.tsx` ya ordenaban dinámicamente por `section.order`, así
    que recogen el nuevo orden automáticamente sin tocar ni una línea de esos ficheros.
- **Estudio de mejoras para "crear CV desde oferta"**: entregado en el chat (no como fichero,
  petición de análisis, no de código) tras revisar a fondo `jobMatching.ts` y
  `ats/textAnalysis.ts`. Punto más importante encontrado: `matchDatabaseToJobDescription` puntúa
  contra el conjunto COMPLETO de keywords de la oferta (`extractKeywordFrequencies` sin límite
  `topN`), a diferencia del comparador ATS que sí lo limita a las 30 más frecuentes — con ofertas
  largas, esto puntúa también contra el texto repetitivo de beneficios/legal/RSC, no solo contra
  los requisitos técnicos reales. Ningún cambio de código hecho todavía para esto — queda para
  cuando el usuario decida qué mejoras priorizar.

---

**Sesión 12 (esta sesión — implementación de TODAS las mejoras del estudio de la sesión 11 para
"crear CV desde oferta", petición explícita "procede a implementar todas las mejoras"):**

Reescritura sustancial de `src/domain/jobMatching.ts` (los 10 tests previos de la sesión 9/10 se
sustituyeron por 32 nuevos que cubren el comportamiento actualizado; nada de esto rompe
`appStore.ts` ni `AtsScreen.tsx`, que siguen consumiendo las mismas funciones públicas):

- **Límite de keywords (`topNKeywords`, por defecto 40)**: antes `buildJobKeywordScores` usaba
  *todas* las palabras no vacías de la oferta sin límite — con ofertas largas, esto puntuaba
  también contra secciones de beneficios/legal/RSC. Ahora limitado, mismo espíritu que
  `ats/jobComparison.ts` (30), un poco más generoso.
- **Normalización ligera de plurales (`stem`)**: "requirements"/"requirement",
  "proyectos"/"proyecto" cuentan ahora como la misma keyword. Deliberadamente conservadora — no
  toca palabras de menos de 5 caracteres (protege siglas: "aws", "css", "sql") ni palabras acabadas
  en "ss"/"us"/"is" (protege "business", "status", "analysis"). No es un stemmer lingüístico
  completo a propósito: un stemmer más agresivo (sufijos "-ing"/"-ed", sinónimos técnicos tipo
  "JS"↔"JavaScript") se descartó por el riesgo de falsos positivos frente al beneficio, dado el
  principio "sin IA / reglas simples y explicables" del proyecto — documentado como decisión, no
  como limitación por descuido.
- **`buildJobKeywordScores` devuelve ahora `WeightedJobKeyword[]`** (stem + forma superficial más
  frecuente para mostrar + frecuencia total agregada) en vez de un `Map<string,number>` plano —
  necesario para poder agrupar singular/plural y aun así mostrar un texto legible al usuario.
- **Selección por COBERTURA MARGINAL, no por puntuación individual** (`selectByMarginalCoverage`,
  algoritmo voraz de "maximum coverage"): la puntuación global depende de qué keywords aparecen en
  ALGÚN sitio del CV final, no de en cuál elemento — antes, dos proyectos que repetían las mismas 3
  keywords "ganaban" a uno que cubría 2 keywords distintas sin solapar, aunque la segunda opción
  diera mejor puntuación conjunta. Ahora se elige en cada paso el candidato que más peso de
  keywords TODAVÍA NO cubiertas añade (empate roto por puntuación bruta), y una vez agotada la
  cobertura posible se sigue rellenando por puntuación bruta hasta el máximo — nunca deja huecos
  vacíos por quedarse corto de candidatos "novedosos".
- **Opciones configurables** (`MatchOptions`): `maxItemsPerSection` (antes fijo en 6),
  `minScoreToInclude` (antes fijo en 1) y `topNKeywords`, todas con el mismo valor por defecto de
  siempre si no se especifican — expuestas en la UI como "Opciones avanzadas" colapsadas en el
  primer paso de `JobMatchScreen.tsx`.
- **Las secciones sin ningún match automático YA NO desaparecen del resultado**: antes, una sección
  de contenido sin ningún elemento por encima del umbral simplemente no aparecía en
  `matchDatabaseToJobDescription`, así que no había forma de añadir nada de ahí a mano en la
  revisión. Ahora TODAS las secciones con contenido en la base de datos aparecen siempre, cada item
  con un nuevo flag `defaultIncluded` (true = propuesto automáticamente, false = "existe pero no se
  seleccionó"). `JobMatchScreen.tsx` muestra los `defaultIncluded` normalmente (marcados) y el resto
  bajo un desplegable colapsado "N opciones más de tu base de datos que no se propusieron
  automáticamente" por sección — así se puede añadir a mano cualquier cosa que se quedara fuera del
  match automático, viendo también por qué (sus keywords coincidentes, si tiene alguna).
- **`jobKeywords` expuesto en el resultado**: la pantalla de revisión ahora muestra, aparte de la
  razón por item, la lista independiente de las keywords más relevantes detectadas en la oferta
  (con su frecuencia) — antes solo se veían "colgando" de cada elemento.
- **Enlace con el comparador ATS**: `extractStoredJobDescription`/`JOB_DESCRIPTION_NOTES_PREFIX`
  (nuevo, en `jobMatching.ts`) permiten recuperar el texto de la oferta ya guardado en
  `metadata.notes` de una versión generada por esta funcionalidad. `AtsScreen.tsx` ahora
  pre-rellena automáticamente el textarea de "Comparar con una oferta de trabajo" con esa misma
  oferta si el CV abierto se generó así (con un aviso explicando de dónde salió el texto,
  editable/sustituible por el usuario en cualquier momento).
- **Deliberadamente NO implementado** (evaluado y descartado con motivo, no olvidado):
  - Puntuación normalizada por longitud de texto: el `score` ya es un conteo de keywords
    DISTINTAS presentes (no de repeticiones dentro del mismo item, que ya estaba libre de ese sesgo
    desde el principio) — el único sesgo real restante es que un texto más largo tiene más
    oportunidad orgánica de mencionar más términos distintos, lo cual refleja contenido
    genuinamente más rico, no es un artefacto a corregir. Forzar una normalización arriesgaba
    penalizar descripciones concisas y muy relevantes frente a otras más largas y solo
    parcialmente relacionadas, sin un beneficio claro.
  - Reconocimiento de estructura de la oferta (Requisitos vs Beneficios vs Sobre la empresa) para
    ponderar por sección: mucho más esfuerzo (requeriría heurísticas de segmentación de texto libre
    bastante más elaboradas que las ya usadas en pdfImport, y esta vez sobre texto plano sin
    ninguna señal tipográfica de la que apoyarse) para un beneficio incierto frente a limitar
    directamente el nº de keywords, que ya mitiga la mayor parte del problema práctico.
  - Botón "aplicar esta sugerencia" en el comparador ATS para que `suggestImprovements` mute el CV
    directamente: sigue siendo solo informativo, aplicar el cambio se hace a mano desde el editor —
    mismo motivo que en la sesión 10 (mantener el análisis ATS de solo lectura).
- **Verificación de esta sesión:** 464/464 tests de dominio (`node --test`; 32 en el
  `jobMatching.test.ts` reescrito, resto sin cambios). **Limitación sin cambios respecto a
  sesiones anteriores:** sin `@dnd-kit`/`@types/react`/`@types/node` en este sandbox, no se ha
  podido compilar `tsc` completo ni levantar la app con Vite — `JobMatchScreen.tsx` (opciones
  avanzadas, keywords de la oferta, desplegable de "otras opciones" por sección) y el auto-relleno
  en `AtsScreen.tsx` están revisados a mano con cuidado pero **necesitan verificación en un
  navegador real**, y sobre todo un juicio de valor con datos y ofertas reales: si el algoritmo de
  cobertura marginal produce selecciones que se "sienten" mejores en la práctica que el simple
  top-K anterior, y si el stemming de plurales genera algún falso positivo molesto que no se haya
  anticipado aquí.

---

**Sesión 13 (esta sesión — tres correcciones/mejoras puntuales sobre "crear CV desde oferta",
peticiones explícitas):**

- **Bug real corregido: la lista de palabras vacías (`ats/textAnalysis.ts`) tenía entradas CON
  tilde ("más", "también") que nunca podían coincidir**, porque `tokenize()` normaliza cada token
  quitándole los acentos ANTES de comparar contra el set de stopwords — "más" nunca era igual a
  "mas". Confirmado empíricamente antes de tocar nada (`extractKeywordFrequencies("más también")`
  devolvía literalmente "mas"/"tambien" como keywords). Corregido guardando todas las entradas SIN
  tilde, consistente con la normalización real.
  - Además, la lista era claramente insuficiente — el usuario reportó "no", "si", "tu", "tareas",
    "desde", "todo", "largo", "vida" colándose como keywords. Ampliada sustancialmente: muchos más
    pronombres/determinantes/preposiciones/conjunciones y formas de ser/estar/haber/tener en
    español, más equivalentes en inglés que faltaban (that, who, which, do/does/did...). Se separó
    además un grupo pequeño y explícitamente documentado de "ruido genérico de ofertas de empleo"
    (tareas, funciones, vida, largo, puesto, oferta, candidato/a, empresa, equipo, ambiente,
    entorno) — palabras de contenido real pero sin señal discriminante sobre el puesto en sí, a
    diferencia de las stopwords gramaticales de siempre. Documentado como lista corta y ajustable
    a mano si aparece otro caso similar en uso real, no como intento de cobertura exhaustiva.
  - Tests de regresión específicos para el bug de normalización y para cada palabra reportada por
    el usuario, más un test de "no-falso-positivo" comprobando que términos reales (Python,
    Kubernetes, Docker, liderazgo) no se ven afectados.
- **Los idiomas ahora se incluyen siempre por defecto** (petición explícita): `languages` se añadió
  a `ALWAYS_INCLUDE_SECTION_KEYS` en `jobMatching.ts`, junto a personal-information/profile/skills
  — mismo razonamiento: casi ninguna oferta menciona idiomas como keyword (así que raramente
  puntuarían lo bastante para entrar solos por relevancia), pero es información que casi siempre
  interesa mostrar en cualquier CV.
- **Puntuaciones múltiples por categoría** (petición explícita: "education, experience,
  technologies/tools, etc"), nuevo `computeScoreBreakdown` en `jobMatching.ts`:
  - **Educación**: cobertura de keywords de la oferta encontradas específicamente en la sección
    Educación seleccionada (mismo mecanismo de cobertura que la puntuación general, pero acotado a
    esa sección) — responde "¿mi formación menciona lo que pide la oferta?".
  - **Tecnologías/Herramientas**: igual pero acotado a la sección Skills — "¿mis skills cubren el
    vocabulario técnico de la oferta?". Verificado con un test explícito de que NO cuenta menciones
    de tecnología que aparezcan en Projects/Experience, solo en Skills.
  - **Experiencia**: la más distinta de las tres — busca primero un número de años requeridos en el
    texto de la oferta (`detectRequiredYears`: cualquier "N años"/"N years", tomando el MENOR si hay
    varios, como el umbral real a superar) y lo compara contra los años reales del candidato
    (`estimateCandidateYearsOfExperience`: desde el inicio más antiguo hasta el fin más reciente —o
    hoy, si algún puesto tiene `current: true`— de las experiencias SELECCIONADAS). Si la oferta no
    da ningún número de años, cae a cobertura de keywords de la sección Experience, igual que
    Educación/Tecnologías, dejándolo explícito en el detalle ("La oferta no especifica un número de
    años concreto..."). El cálculo de años es una simplificación deliberada y documentada como tal
    (no resta huecos entre empleos ni evita contar solapes de puestos simultáneos) — la misma forma
    en que la mayoría de reclutadores estiman "años de experiencia" a simple vista.
  - Las cuatro puntuaciones (general + 3 categorías) se recalculan EN VIVO en `JobMatchScreen.tsx`
    con cada cambio de selección, igual que ya hacía la general — mismo patrón, ahora como cuatro
    tarjetas en vez de un único número.
  - **Fuera de alcance de esta sesión, a propósito**: el desglose no se ha llevado al comparador
    ATS (`AtsScreen.tsx`), que sigue mostrando solo la puntuación general — no se pidió esta vez y
    habría requerido una función adicional para reconstruir la "selección" de un CV YA CREADO a
    partir de `CVVersion.sections` (formato ligeramente distinto al de la pantalla de revisión, que
    trabaja sobre una propuesta todavía no persistida). Queda como extensión natural si se pide.
- **Verificación de esta sesión:** 476/476 tests de dominio (`node --test`; 14 en
  `textAnalysis.test.ts` tras la reescritura de stopwords, 43 en `jobMatching.test.ts` tras añadir
  idiomas siempre incluidos y las 8 pruebas de `computeScoreBreakdown`/años de experiencia).
  **Limitación sin cambios respecto a sesiones anteriores:** sin `@dnd-kit`/`@types/react` en este
  sandbox, `JobMatchScreen.tsx` (las cuatro tarjetas de puntuación) está revisado a mano con
  cuidado pero necesita verificación en navegador — y sobre todo, con datos y ofertas reales, si el
  cálculo de años de experiencia (simplificado a "primer inicio → último fin/hoy") da un número que
  se sienta razonable frente a bases de datos reales con huecos entre empleos o solapes.

---

**Sesión 14 (esta sesión — cuatro mejoras grandes sobre "crear CV desde oferta", peticiones
explícitas, con impacto también en el comparador ATS donde aplicaba):**

- **Diccionario de tecnologías** (`src/domain/ats/techDictionary.ts`, nuevo): ~790 términos reales
  y deduplicados (no una cifra inflada artificialmente — "no hace falta complicarse la
  existencia", como dijo el usuario, así que se priorizó calidad sobre llegar a una cifra
  redonda), organizados por categorías: lenguajes de programación, frontend/backend/bases de
  datos/DevOps generales, y con foco explícito en IA/ML (frameworks como TensorFlow/PyTorch,
  arquitecturas como CNN/Transformer/YOLO), computer vision (OpenCV, SLAM, detección/segmentación),
  robótica (ROS, Gazebo, cinemática, control), y gráficos por computador (OpenGL/Vulkan, motores de
  render, Unity/Unreal/Blender). Limitación documentada y asumida: solo términos de UN token,
  porque el motor de keywords no reconoce frases (decisión ya tomada y documentada en el estudio de
  la sesión 11) — "computer vision" no se puede meter tal cual, pero sí sus componentes específicos
  ("cnn", "yolo", "opencv"...).
  - `TECH_KEYWORD_WEIGHT_MULTIPLIER = 3`: una keyword reconocida como tecnología pesa 3 veces más
    que una genérica de la misma frecuencia — aplicado en `jobMatching.ts` (`buildJobKeywordScores`,
    con `weight` ahora separado de `totalCount` para no inflar los números que ve el usuario) Y en
    `ats/jobComparison.ts` (`compareWithJobDescription`), afectando también al `matchScore` del
    comparador ATS — petición explícita de "que afecte al análisis de ATS donde sea necesario".
  - Detalle técnico importante: la comprobación contra el diccionario se hace sobre la forma
    SUPERFICIAL de la keyword, no sobre su `stem` — muchos nombres de tecnología acaban en "s" sin
    ser plural (Kubernetes, Redis, Postgres) y el stemmer de la sesión 12 los recortaría de forma
    que dejarían de coincidir con el diccionario tal cual está escrito.
- **Puntuaciones por categoría ahora reflejan mejor la importancia técnica** (efecto colateral
  correcto del cambio anterior, sin código adicional: `computeMatchScoreForSelection` y
  `computeSectionCoverageScore` ya sumaban `weight` desde la sesión 13, así que la ponderación se
  propaga sola a Educación/Tecnologías/Experiencia y a la puntuación general).
- **Optimización de VARIANTE en las secciones "siempre incluidas"** (petición explícita: "sí se
  debería puntuar el summary, skills... la puntuación sería simplemente para optimizar la
  versión"): `personal-information`/`profile`/`skills`/`languages` (`languages` ya se incluía
  siempre desde la sesión 13) ahora puntúan TODAS las variantes existentes de cada elemento y
  eligen la que mejor encaje con la oferta — pero se siguen incluyendo SIEMPRE,
  independientemente de la puntuación (verificado con un test que fuerza puntuación 0 en todas las
  variantes y comprueba que el elemento sigue apareciendo). Antes usaban sin más la variante por
  defecto del elemento.
- **Elegir otra versión a mano en la revisión** (petición explícita: "al poder seleccionar el
  apartado también debería ser posible modificar la versión"): cada item de `JobMatchSectionItem`
  expone ahora `availableVariants` (todas las variantes existentes del elemento, con su propia
  puntuación) — `JobMatchScreen.tsx` añade un desplegable "Versión" bajo cada item (solo cuando hay
  más de una variante entre las que elegir) que cambia la variante usada, con la puntuación
  recalculándose en vivo igual que al marcar/desmarcar.
- **Detección de idioma de la oferta** (`src/domain/ats/languageDetection.ts`, nuevo,
  `detectJobDescriptionLanguage`): heurística sin IA de siempre — cuenta coincidencias contra un
  pequeño diccionario de palabras funcionales EXCLUSIVAS de cada idioma y se queda con el que tenga
  más; con menos de 3 coincidencias totales devuelve `null` (ambigüedad, no arriesga una decisión
  sin evidencia). En empate se decanta por español (convención del resto del proyecto). Efectos:
  - El CV generado (`createCvFromJobDescription`/`createCvFromSelection`) fija automáticamente
    `CVVersion.displayLanguage` al idioma detectado, reutilizando `cv.ts:setCvDisplayLanguage`
    (ya existente desde antes de esta sesión — no había que inventar nada, solo conectar el dato).
  - **Filtro de variantes por etiqueta de idioma** (petición explícita: "solo teniendo en cuenta
    las versiones que contengan 'vXX'"): se descubrió que el proyecto YA tenía esta convención
    implementada (`cv.ts:findSiblingVariantForLanguage`, usada al cambiar el idioma de un CV ya
    creado) — `jobMatching.ts` añade `filterVariantsByLanguageTag`, reutilizando el mismo patrón
    `\bv{codigo}\b` (insensible a mayúsculas), aplicado en `scoreAllVariantsForElement`/
    `scoreElementAgainstJobKeywords` (ambos con un nuevo parámetro opcional `languageTag`, por
    defecto `null` = sin filtrar, compatible con todo el código/tests existentes). Si NINGUNA
    variante de un elemento lleva la etiqueta del idioma detectado, se consideran todas sin
    filtrar — nunca deja a un elemento sin nada que puntuar solo porque el usuario no ha adoptado
    la convención de nombres.
  - `suggestImprovements` (usado por el comparador ATS) también detecta el idioma de la oferta
    pegada ahí y aplica el mismo filtro al puntuar candidatos — petición explícita de propagar los
    cambios al análisis ATS donde aplicara.
- **Fuera de alcance de esta sesión, a propósito**: no se ha añadido ningún control en la UI para
  que el usuario fuerce manualmente el idioma detectado si la heurística se equivoca (p.ej. una
  oferta bilingüe o con nombres propios que confundan el conteo) — el desplegable de idioma que ya
  existe en `CVContentPanel.tsx` para cualquier CV sigue disponible para corregirlo a mano después
  de creado, así que no se consideró bloqueante para esta ronda.
- **Verificación de esta sesión:** 499/499 tests de dominio (`node --test`; 6 en
  `techDictionary.test.ts`, 1 nuevo en `jobComparison.test.ts` para el peso técnico, 4 en
  `languageDetection.test.ts`, ~14 nuevos en `jobMatching.test.ts` para filtro de idioma,
  optimización de variante en secciones siempre-incluidas, `availableVariants` y priorización de
  tecnologías reconocidas, 2 nuevos en `appStore.test.ts` para `displayLanguage`).
  **Limitación sin cambios respecto a sesiones anteriores:** sin `@dnd-kit`/`@types/react` en este
  sandbox, el desplegable de "Versión" nuevo en `JobMatchScreen.tsx` y el aviso de idioma detectado
  están revisados a mano con cuidado pero necesitan verificación en un navegador real — en
  particular con una base de datos real que use la convención de nombres "vES"/"vEN" en sus
  variantes, para comprobar que el filtro de idioma prefiere las correctas de verdad.

---

**Sesión 15 (esta sesión — siete peticiones puntuales sobre "crear CV desde oferta" y el
comparador ATS, todas implementadas):**

- **Impacto por categoría, por item, en la revisión** (petición explícita): nueva
  `computeItemCategoryImpact(db, selection, jobText, sectionDefinitionId, elementId, variantId)` en
  `jobMatching.ts` — compara la puntuación de Educación/Tecnologías/Experiencia CON y SIN ese
  elemento (con esa variante) en la selección actual, y devuelve la diferencia. `null` para
  secciones que no alimentan ninguna categoría (Projects, Certifications...), donde no hay nada que
  mostrar. `JobMatchScreen.tsx` lo muestra bajo cada item ("+15% en Educación (queda en 62%)" si ya
  está marcado, "Si se añade: +15% en Educación" si no lo está — para poder decidir con info real
  antes de marcarlo).
- **Recalculo al cambiar de versión** (petición explícita): `AvailableVariantOption` gana
  `matchedKeywords` (antes solo tenía `score`) — el motivo mostrado bajo cada item ahora refleja la
  variante REALMENTE seleccionada en cada momento (antes se quedaba fijo con el de la propuesta
  inicial aunque se cambiara de versión). La puntuación general y por categoría ya se recalculaban
  en vivo desde la sesión 14 (dependen de `selection`, que cambia al elegir otra variante) — se
  extrajo `currentSections` a su propio `useMemo` compartido para no repetir el cálculo.
- **El desplegable de versión muestra el impacto de CADA variante y marca la mejor** (petición
  explícita): cada `<option>` calcula su propio impacto de categoría (o su puntuación bruta si la
  sección no alimenta ninguna) y antepone "★ " a la que salga mejor — sin tener que cambiarla a
  mano para comprobarlo.
- **Nombre del CV = nombre de la empresa** (petición explícita, sustituye al criterio de "primera
  línea" de la sesión 9): nueva `guessCompanyName(text)` — dos heurísticas de precisión alta pero
  cobertura necesariamente limitada (sin NER no hay forma fiable de reconocer nombres propios en
  general): sufijo legal reconocible (S.L., Inc., GmbH...) o un marcador textual claro y
  DELIBERADAMENTE pequeño ("empresa X", "join X", "at X") — se evitó a propósito usar
  preposiciones genéricas ("en", "para", "con") como marcador por el riesgo real de capturar
  cualquier palabra capitalizada que las siga (una tecnología, una ciudad) en vez de una empresa.
  Si ninguna heurística encuentra nada, cae al criterio de siempre (primera línea) en vez de
  devolver algo vacío — el nombre sigue siendo editable a mano en la revisión de todas formas.
  `guessJobTitle` se mantiene tal cual (sigue exportada y testeada) como ese fallback.
- **Keywords del comparador ATS separadas por Educación/Tecnologías/Experiencia** (petición
  explícita): nueva `computeCategorizedKeywordComparison` + `selectionFromCvVersion` (convierte
  `CVVersion.sections`, ya persistidas, al mismo formato de "selección" que usan todas las
  funciones de puntuación de `jobMatching.ts` — permite reutilizarlas tal cual sobre un CV YA
  creado sin reimplementar nada específico). Esto también cierra un hueco que había quedado
  documentado como pendiente en la sesión 13 ("llevar el desglose por categoría al comparador
  ATS"). Se añade DEBAJO de la comparación general de siempre (no la sustituye — la vista de
  conjunto sigue siendo útil).
- **Comprobaciones ortotipográficas en el analizador ATS** (petición explícita de "fallos
  gramaticales", con una salvedad importante explicada tanto en el código como aquí): una
  comprobación GRAMATICAL de verdad (concordancia, tiempos verbales...) necesita entender la
  estructura de la frase, y eso es precisamente el tipo de tarea para la que hoy se usan modelos de
  lenguaje — choca de frente con el requisito explícito de que el analizador ATS funcione sin IA
  (§20 del contexto). Nuevo `ats/proofreading.ts` con comprobaciones de FORMATO con reglas fijas en
  su lugar (deliberadamente llamadas "ortotipográficas", no "gramaticales", para no prometer más de
  lo que hacen): espacios dobles, palabras repetidas consecutivas, falta de espacio tras puntuación,
  puntuación excesiva/informal (!!!, ....), espacio antes de puntuación — el tipo de fallo que sí
  aparece de verdad al copiar y pegar entre documentos, y que además puede confundir a un parser
  ATS real. Limitado a 8 avisos por tipo para no saturar la pantalla con un CV muy descuidado.
- **Nombre de la versión inicial = idioma detectado** (petición explícita: "vES" en vez de "v1"):
  `appStore.createCvFromSelectionInternal` llama a `cvDomain.renameCVVersion` (ya existía) justo
  después de fijar `displayLanguage`, solo cuando se detectó un idioma — el flujo manual de "+
  Nuevo CV" (`createCVProject`) sigue nombrando "v1" como siempre, verificado con test explícito.
- **Verificación de esta sesión:** 519/519 tests de dominio (`node --test`; 8 en
  `proofreading.test.ts`, ~14 nuevos en `jobMatching.test.ts` para `guessCompanyName`,
  `selectionFromCvVersion`, `computeItemCategoryImpact` y `computeCategorizedKeywordComparison`, 2
  nuevos en `appStore.test.ts` para el nombre de versión). **Limitación sin cambios respecto a
  sesiones anteriores:** sin `@dnd-kit`/`@types/react` en este sandbox, los cambios de
  `JobMatchScreen.tsx` (impacto por categoría por item, desplegable de versión con impacto y mejor
  opción marcada) y `AtsScreen.tsx` (keywords por categoría, comprobaciones ortotipográficas) están
  revisados a mano con cuidado pero necesitan verificación en un navegador real — y en particular,
  con ofertas y bases de datos reales, si `guessCompanyName` acierta con la frecuencia suficiente
  como para ser útil tal cual, o si conviene ampliar/ajustar sus dos heurísticas.

---

**Sesión 16 (esta sesión — corrección de un bug real reportado, y rediseño de las puntuaciones por
categoría para que cualquier apartado pueda contribuir a las 3 a la vez, peticiones explícitas):**

- **Bug real corregido: las keywords coincidentes mostradas bajo un item NUNCA se actualizaban al
  cambiar de versión.** El texto "versión elegida porque coincide con N keywords: ..." usaba
  `item.matchedKeywords` (la propuesta ORIGINAL, fija desde el análisis inicial) en vez de la
  variante REALMENTE seleccionada en cada momento. `JobMatchScreen.tsx` ahora busca en
  `item.availableVariants` la entrada que corresponde al `variantId` actual y usa SU
  `matchedKeywords` — confirmado como la causa real del "por mucho que cambie de versión no se
  cambia el texto" que reportó el usuario.
- **"La puntuación global no se recalcula" — investigado y confirmado que NO es un bug de código**:
  `liveBreakdown?.overall` en `JobMatchScreen.tsx` usa el mismo `useMemo` que las tarjetas de
  categoría, así que técnicamente se recalcula igual. Verificado además con un caso real
  construido a mano (`computeScoreBreakdown` con dos variantes de Skills distintas): la puntuación
  general SÍ cambia (68% → 0% en el caso extremo probado). Lo que ocurre es dilución matemática: la
  puntuación general se calcula sobre TODAS las keywords de la oferta repartidas por TODO el CV,
  mientras que antes "Tecnologías"/"Educación" solo miraban una sección concreta (un denominador
  mucho más pequeño) — el mismo cambio mueve mucho más una puntuación acotada que una repartida
  sobre todo el CV. El rediseño de esta sesión (ver abajo) iguala en parte esta dinámica, pero la
  dilución de "general" frente a cualquier categoría más específica seguirá siendo intrínseca al
  cálculo, no un fallo a corregir.
- **Rediseño: Educación/Tecnologías ya NO están atadas a una sección concreta** (petición
  explícita: "que pueda apoyar a los 3 a la vez... el cálculo se basará en las keywords totales...
  que aportan a los 3"). Antes, "Tecnologías" solo miraba el contenido de la sección Skills y
  "Educación" solo el de Education — un Proyecto que mencionara React nunca contaba para
  Tecnologías, por ejemplo. Ahora:
  - Nuevo diccionario `ats/educationDictionary.ts` (títulos, instituciones, vocabulario académico
    ES/EN — mismo espíritu y limitaciones que `techDictionary.ts`, un token por término).
  - Nueva `computeKeywordClassCoverageScore`: en vez de "¿esta sección cubre la oferta?", calcula
    "¿las keywords de la oferta que SON de esta categoría (tecnología/educación) aparecen en
    CUALQUIER PARTE del CV?" — así que CUALQUIER item de CUALQUIER sección (un Proyecto, el
    Summary, incluso Personal Information) puede contribuir a Tecnologías y/o Educación si su
    contenido menciona palabras de esos diccionarios, y un mismo item puede aportar a AMBAS a la
    vez (verificado con test explícito).
  - **Experiencia se queda deliberadamente FUERA de este rediseño** — decisión razonada, no
    descuido: el cálculo de Experiencia es sobre AÑOS reales (fechas de la sección Experience), no
    sobre vocabulario — no existe un "diccionario de palabras de experiencia" con el que clasificar
    keywords sueltas de forma coherente, y forzar esa idea habría producido una señal sin
    sentido. `computeItemCategoryImpacts` (antes `computeItemCategoryImpact`, ahora en PLURAL:
    devuelve las tres categorías a la vez) refleja esto — `experience` sale `null` para cualquier
    item que no esté en la sección Experience, mientras que `education`/`technologies` se calculan
    SIEMPRE, para cualquier sección.
  - **Cada proyecto ahora sí muestra su contribución** (petición explícita: "a cada proyecto le
    falta los porcentajes de contribución") — ya no depende de estar en Skills/Education.
  - La UI solo muestra las categorías donde el item realmente aporta algo (`delta !== 0`), para no
    llenar la pantalla de líneas "0%" sin información.
  - El desplegable de versión de cada item ahora calcula el impacto de CADA variante candidata en
    las 3 categorías (no solo una) y compone una etiqueta tipo "Educ +10% · Tec +15%", marcando con
    ★ la de mayor puntuación bruta.
  - Cambio de comportamiento DELIBERADO y documentado en los tests (rompe compatibilidad con el
    diseño anterior a propósito, por petición explícita): el test de la sesión 13/14 que comprobaba
    que Tecnologías "NO cuenta el resto del CV, solo Skills" se sustituyó por el comportamiento
    contrario, ahora esperado.
  - `computeCategorizedKeywordComparison` (usada por el comparador ATS) sigue el mismo criterio:
    Educación/Tecnologías miran todo el CV, Experiencia sigue acotada a su sección — sin cambios de
    código en `AtsScreen.tsx`, ya que la firma de la función no cambió.
- **Verificación de esta sesión:** 528/528 tests de dominio (`node --test`; nuevo
  `educationDictionary.test.ts`, y `jobMatching.test.ts` con los tests de impacto reescritos para
  el nuevo comportamiento multi-categoría, más varios nuevos que comprueban explícitamente que un
  mismo item puede aportar a Educación Y Tecnologías a la vez, y que Personal Information/Summary
  también pueden contribuir). **Limitación sin cambios respecto a sesiones anteriores:** sin
  `@dnd-kit`/`@types/react` en este sandbox, los cambios de `JobMatchScreen.tsx` están revisados a
  mano con cuidado pero necesitan verificación en un navegador real — en particular comprobar que
  el texto de keywords y el desplegable de versión se sienten coherentes con datos reales, y que la
  dilución de la puntuación general frente a las categorías no resulte confusa en la práctica (si
  lo es, la vía natural sería mostrar la puntuación general como un rango/gráfico en vez de un
  único número, pero no se ha implementado sin pedirlo explícitamente).

---

**Sesión 17 (esta sesión — bug real encontrado y corregido en las puntuaciones por categoría de
"crear CV desde oferta", reportado como "a veces no sale el porcentaje, o sale uno incorrecto"):**

- **Causa raíz confirmada empíricamente** (reproducida a propósito con una oferta larga y realista,
  con el relleno típico de "sobre nosotros"/beneficios/proceso de selección, antes de tocar
  código): `computeKeywordClassCoverageScore`/`computeKeywordClassComparison` (Educación/
  Tecnologías, nuevas de la sesión 16) recortaban PRIMERO la lista de keywords de la oferta a las
  40 más frecuentes en general, y DESPUÉS filtraban por categoría. Con una oferta larga, términos
  genuinamente relevantes pero mencionados pocas veces ("Máster", "Universidad") quedaban fuera de
  ese top-40 — aplastados por palabras de relleno genérico repetidas ("profesional", "proceso",
  "oficinas"...) — y la categoría entera salía en 0% aunque la oferta sí los mencionara. Verificado
  con un caso concreto: antes de corregirlo, `education.score` daba 0 con el mensaje "la oferta no
  menciona nada de esta categoría" pese a que la oferta pedía explícitamente "Máster en
  Inteligencia Artificial".
- **Corrección**: nueva constante `UNLIMITED_KEYWORDS`, usada SOLO por las dos funciones basadas en
  clasificación por diccionario — el diccionario de cada categoría (`techDictionary.ts`/
  `educationDictionary.ts`) YA es un filtro fuerte por sí solo (deja pasar el 100% de sus
  apariciones reales, no las 40 más frecuentes de TODA la oferta) — aplicar un segundo recorte
  encima no aportaba nada y sí perdía señal real. La puntuación general (`computeMatchScoreForSelection`)
  y el fallback de Experiencia sin diccionario de por medio siguen limitados al top-N de siempre,
  a propósito — ahí sí tiene sentido centrarse en los temas más destacados de la oferta en vez de
  en absolutamente todo.
- Como consecuencia directa, también quedó resuelto el efecto colateral reportado ("a veces sale un
  porcentaje que no es el correcto, o no sale ninguna línea") — al perderse silenciosamente la
  categoría entera (0%, sin ninguna keyword detectada), la pantalla de revisión no tenía nada que
  mostrar para ese item, o mostraba un número que no reflejaba la realidad de la oferta.
- **Verificación de esta sesión:** 530/530 tests de dominio (`node --test`; 2 nuevos tests de
  regresión que reproducen exactamente el escenario del bug — oferta larga con mucho relleno
  genérico, comprobando que Educación no se pierde, y que un mismo item sigue pudiendo aportar a
  Tecnologías Y Educación a la vez incluso con esa oferta larga). **Limitación sin cambios respecto
  a sesiones anteriores:** sin `@dnd-kit`/`@types/react` en este sandbox, no se ha podido verificar
  en un navegador real con la oferta y base de datos reales del usuario que reportó el bug — se
  reprodujo y corrigió con un caso sintético deliberadamente construido para ser realista (oferta
  larga con secciones de "sobre nosotros"/beneficios/proceso, como las que suelen tener las ofertas
  reales), pero el usuario debería confirmar que su caso concreto queda resuelto.
