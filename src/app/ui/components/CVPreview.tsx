import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { AppDatabase, Template } from "../../../domain/model/types.js";
import type { DateDisplayFormat } from "../../../domain/formatting.js";
import { getVisibleSections, resolveCV } from "../../../domain/resolveCV.js";
import { buildItemLayout, buildProjectLayout, buildSkillsLayout } from "../../../domain/preview.js";
import { localeForDisplayLanguage, translateDefaultLabel } from "../../../domain/i18n.js";
import { flattenSectionsToBlocks, computeBlockSpacing, type PreviewBlock } from "../../../domain/previewBlocks.js";
import { paginate, mmToPx, type PaginationBlock } from "../../../domain/pagination.js";
import { RichTextView } from "./RichTextView.js";

const A4_HEIGHT_MM = 297;

/**
 * Colchón de seguridad restado a la altura ÚTIL de página, solo para
 * decidir los saltos de página (no cambia el alto visual real de
 * `.cv-preview__page`, que sigue siendo 297mm en styles.css).
 *
 * Motivo (bug real reportado — "el último párrafo/item salta de página al
 * exportar, distinto de lo que mostraba la preview"): la paginación se
 * decide midiendo el DOM EN PANTALLA (`offsetHeight`), pero el PDF se saca
 * con el motor de impresión del navegador, que renderiza ese mismo texto a
 * otra resolución/con otro redondeo de subpíxel por línea — la diferencia
 * es de un par de píxeles por línea, pero se acumula a lo largo de una
 * página entera de texto y puede hacer que un bloque que "justo cabía" en
 * pantalla ya no quepa al imprimir. Como `.cv-preview__page` tiene
 * `min-height` (no `height` fija), ese bloque no se recorta: simplemente
 * desborda la página impresa y el navegador lo empuja a la siguiente,
 * desplazando también todo lo que viene después. Dejar unos milímetros de
 * margen de sobra evita que ese desajuste, si ocurre, llegue a cambiar de
 * página. No es una garantía absoluta para cualquier contenido posible,
 * pero cubre con holgura la diferencia real observada.
 *
 * Subido de 4mm a 7mm (bug real reportado: seguía apareciendo una página
 * extra casi en blanco en algunos CVs). Esto es solo una MITIGACIÓN, no una
 * solución estructural: mientras se combine "página con altura mínima" +
 * "salto de página forzado al final de cada página" con una medición hecha
 * en un motor de render distinto al que genera el PDF, seguirá existiendo
 * la posibilidad (cada vez más rara cuanto mayor sea el colchón) de que el
 * contenido desborde por más de lo que este colchón cubre y se repita el
 * bug. La única forma de eliminar la CLASE de bug (no solo reducir su
 * probabilidad) sería dejar que el motor de impresión pagine de forma
 * nativa en vez de pre-cortar en JS — cambio de arquitectura mayor,
 * pendiente de decidir con el usuario antes de tocarlo (afecta al objetivo
 * del §18: "Preview ≈ PDF visualmente idéntico").
 */
const PRINT_SAFETY_BUFFER_MM = 7;

const BULLET_MARKERS: Record<string, string> = {
  circle: "•",
  dash: "–",
  square: "▪",
  none: "",
};

const LINK_STYLES: Record<string, CSSProperties> = {
  accent_underline: { textDecoration: "underline", color: "var(--cv-accent)" },
  accent: { textDecoration: "none", color: "var(--cv-accent)" },
  underline: { textDecoration: "underline", color: "inherit" },
  plain: { textDecoration: "none", color: "inherit" },
};

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Fase 8 del plan: paginación A4 real (ARCHITECTURE.md §9). Estrategia:
 *
 * 1. Se renderiza cada bloque (título de sección / item) dentro de un div
 *    con su propio `paddingBottom` como espaciado (nunca `margin`, que
 *    colapsa entre hermanos de forma poco predecible — ver previewBlocks.ts).
 * 2. Tras cada commit, `useLayoutEffect` mide el `offsetHeight` real de
 *    cada bloque (ya incluye su padding) y se lo pasa a `paginate()`
 *    (pagination.ts, puro y testeado) para decidir en qué página cae cada
 *    bloque.
 * 3. Mientras no haya ninguna medición todavía (primer render), se muestra
 *    todo en una única página sin paginar — evita una pantalla en blanco y
 *    hace que, si algo en la medición fallara, el usuario siga viendo su
 *    CV en vez de una preview rota.
 *
 * Esta es la pieza de mayor riesgo de todo el proyecto (ver README): la
 * geometría (pagination.ts) está 100% testeada, pero la medición del DOM en
 * sí (temporización de efectos, `offsetHeight`) solo se puede verificar en
 * un navegador real.
 */
export function CVPreview({
  db,
  cvVersionId,
  templateOverride,
}: {
  db: AppDatabase;
  cvVersionId: string;
  /**
   * Si se da, se usa esta template en vez de la guardada en la versión —
   * para previsualizar en vivo cambios de una template que todavía no se
   * han guardado. Ver TemplateEditor.tsx.
   */
  templateOverride?: Template;
}) {
  const resolved = resolveCV(db, cvVersionId);
  const template = templateOverride ?? resolved.template;
  // El idioma vive en la VERSIÓN, no en la template (a propósito — ver
  // model/types.ts, CVVersion.displayLanguage): la misma plantilla visual
  // puede reutilizarse para versiones en distintos idiomas del mismo CV.
  const displayLanguage = db.cvVersions.find((v) => v.id === cvVersionId)?.displayLanguage;
  const dateLocale = localeForDisplayLanguage(displayLanguage);

  // IMPORTANTE: el "no hay template válida" se comprueba MÁS ABAJO, después
  // de declarar todos los hooks — nunca antes. Un `return` condicional
  // antes de un hook hace que ese hook se llame en unos renders sí y en
  // otros no para la MISMA instancia del componente (p.ej. al cambiar a una
  // versión de CV sin template válida y volver a una que sí la tiene), lo
  // cual viola las Rules of Hooks de React y puede dejar la pantalla en
  // blanco sin ningún error visible (ya pasó una vez con este mismo patrón
  // en SectionComposer.tsx). Por eso aquí los hooks usan `template?.` con
  // valores por defecto en vez de asumir que `template` existe.
  const sections = template ? getVisibleSections(resolved) : [];
  const blocks = useMemo(() => flattenSectionsToBlocks(sections), [sections]);
  const spacing = useMemo(
    () => computeBlockSpacing(blocks, template?.spacing.itemGap ?? 0, template?.spacing.sectionGap ?? 0),
    [blocks, template?.spacing.itemGap, template?.spacing.sectionGap]
  );
  const blocksKey = blocks.map((b) => b.id).join("|");
  const spacingKey = spacing.join(",");

  const pageContentHeightPx = useMemo(
    () =>
      mmToPx(
        A4_HEIGHT_MM -
          (template?.spacing.margins.top ?? 0) -
          (template?.spacing.margins.bottom ?? 0) -
          PRINT_SAFETY_BUFFER_MM
      ),
    [template?.spacing.margins.top, template?.spacing.margins.bottom]
  );

  const blockRefs = useRef(new Map<string, HTMLDivElement>());
  const previewRootRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<PaginationBlock[][] | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps intencionadamente basadas en claves de contenido, no en las referencias de array (ver comentario arriba)
  const remeasure = useCallback(() => {
    if (!template || blocks.length === 0) {
      setPages([]);
      return;
    }
    try {
      const measured: PaginationBlock[] = blocks.map((block) => ({
        id: block.id,
        kind: block.kind === "section-title" ? "section-title" : "item",
        sectionId: block.sectionId,
        height: blockRefs.current.get(block.id)?.offsetHeight ?? 0,
      }));
      const next = paginate(measured, pageContentHeightPx);
      setPages((prev) => (samePagination(prev, next) ? prev : next));
    } catch {
      // Si algo falla midiendo/paginando, nos quedamos con lo que hubiera
      // (o sin paginar) en vez de reventar toda la preview.
    }
  }, [
    blocksKey,
    spacingKey,
    pageContentHeightPx,
    template?.typography.fontFamily,
    template?.typography.baseFontSize,
    template?.typography.lineHeight,
  ]);

  useLayoutEffect(() => {
    remeasure();
  }, [remeasure]);

  // Bug real reportado: al entrar por primera vez (sin hacer ningún
  // cambio), la preview no paginaba — salía todo en una única página muy
  // larga. Causa raíz: esta medición depende del ANCHO real que tenga en
  // ese momento `.cv-preview__page` en el DOM, pero ese ancho lo decide un
  // elemento ANTEPASADO (el panel derecho de CVComposer/TemplateEditor,
  // ver useHeightDerivedWidth.ts) mediante su PROPIO efecto, que corre por
  // separado y no hace que este componente vuelva a renderizar — así que
  // si el ancho definitivo del panel se resuelve DESPUÉS de la primera
  // medición de aquí, esa medición queda obsoleta para siempre (nada
  // volvía a disparar una remedición). Este `ResizeObserver` cubre ese
  // caso — y de paso corrige otro real ya existente antes de esta sesión,
  // sin relación con el bug de arriba: la preview tampoco se
  // repaginaba nunca al simplemente redimensionar la ventana del
  // navegador, porque ningún dato de los que dependía este efecto cambia
  // con el ancho disponible.
  useEffect(() => {
    const el = previewRootRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => remeasure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [remeasure]);

  const blocksById = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);
  const blockIndexById = useMemo(() => new Map(blocks.map((b, i) => [b.id, i])), [blocks]);

  // La sección "Personal information" hace de encabezado del CV (§10 del
  // contexto: "Header ↓ Secciones verticales") — no es un bloque especial
  // a nivel de modelo, así que se detecta por la key estable de la sección
  // para poder aplicarle headerStyle.* sin acoplar el dominio a la UI.
  const headerSectionId = useMemo(
    () => db.sections.find((s) => s.key === "personal-information")?.id,
    [db.sections]
  );
  // Igual que headerSectionId: "skills" y "projects" tienen un layout
  // específico (fusión de 3 campos de etiquetas sin píldora / título +
  // subtítulo + enlaces sin fecha, peticiones explícitas del usuario) que
  // no encaja en el layout genérico de `buildItemLayout` — se detectan por
  // key, no por id, para que sigan funcionando si el usuario duplica la
  // base de datos.
  const skillsSectionId = useMemo(() => db.sections.find((s) => s.key === "skills")?.id, [db.sections]);
  const projectsSectionId = useMemo(() => db.sections.find((s) => s.key === "projects")?.id, [db.sections]);

  if (!template) {
    return (
      <p className="app-status app-status--error">
        Esta versión no tiene una template válida (puede que se haya enviado a la papelera).
        Restáurala desde la papelera o crea un CV nuevo.
      </p>
    );
  }

  const headingCase = asString(template.typography.headingCase, "uppercase");
  const dateFormat = asString(template.dateStyle.format, "MMM YYYY") as DateDisplayFormat;
  const datePosition = asString(template.dateStyle.position, "right");
  const bulletShape = asString(template.bulletStyle.shape, "circle");
  const dividerStyle = asString(template.separators.style, "line");

  const pageStyle: CSSProperties = {
    fontFamily: template.typography.fontFamily,
    fontSize: `${template.typography.baseFontSize}pt`,
    fontWeight: template.typography.fontWeight,
    lineHeight: template.typography.lineHeight,
    textAlign: template.typography.textAlignment,
    color: template.colors.text,
    backgroundColor: template.colors.background,
    paddingTop: `${template.spacing.margins.top}mm`,
    paddingRight: `${template.spacing.margins.right}mm`,
    paddingBottom: `${template.spacing.margins.bottom}mm`,
    paddingLeft: `${template.spacing.margins.left}mm`,
    // Custom properties: consumidas por elementos hijos (bullets, tags,
    // enlaces) que necesitan estos valores pero no reciben `template`
    // directamente (RichTextView es agnóstico de templates a propósito).
    //
    // El hueco entre la viñeta y el texto (bulletStyle.gap) se mete DENTRO
    // del propio `content` del `::marker` como espacios U+00A0, no como un
    // `width`/`padding` en CSS — `::marker` no admite propiedades de caja
    // (limitación real de la especificación, ver styles.css). Es una
    // aproximación (no un valor en px exacto): ~4px por espacio, con un
    // mínimo de uno para que siempre quede algo de separación.
    ["--cv-bullet-indent" as string]: `${asNumber(template.bulletStyle.indent, 10)}px`,
    ["--cv-bullet-marker" as string]: `"${BULLET_MARKERS[bulletShape] ?? BULLET_MARKERS.circle}${"\u00a0".repeat(
      Math.max(1, Math.round(asNumber(template.bulletStyle.gap, 3) / 4))
    )}"`,
    ["--cv-border-radius" as string]: `${asNumber(template.separators.borderRadius, 4)}px`,
    ["--cv-accent" as string]: template.colors.accent,
    // Texto "secundario" (fechas, ubicación, subtítulo, meta, tags, contacto
    // del banner) usa esta variable en vez de `opacity` — ver styles.css.
    // opacity<1 crea un nuevo "stacking context" en CSS, y Chromium separa
    // ese contenido en una capa de pintado aparte al exportar a PDF, lo que
    // desordena el texto extraíble (problema real de ATS, confirmado
    // reproduciendo el bug con Playwright + pdfjs-dist: el mismo texto con
    // opacity sale al final del documento en vez de en su sitio). Un color
    // sólido consigue el mismo aspecto visual sin ese efecto secundario.
    ["--cv-muted" as string]: template.colors.muted,
  } as CSSProperties;

  if (blocks.length === 0) {
    return (
      <div className="cv-preview">
        <div className="cv-preview__page" style={pageStyle}>
          <p className="empty-state">Todavía no hay contenido visible en este CV. Vuelve a "Contenido" y marca algo.</p>
        </div>
      </div>
    );
  }

  // Mientras no haya medición real, mostramos todo en una única página sin
  // paginar (fallback), en vez de nada.
  const pagesToRender: PaginationBlock[][] =
    pages ?? [
      blocks.map((b) => ({
        id: b.id,
        kind: b.kind === "section-title" ? "section-title" : "item",
        sectionId: b.sectionId,
        height: 0,
      })),
    ];

  return (
    <div className="cv-preview" ref={previewRootRef}>
      {pagesToRender.map((pageBlocks, pageIndex) => (
        <div key={pageIndex} className="cv-preview__page" style={pageStyle}>
          {pageBlocks.map((pb) => {
            const block = blocksById.get(pb.id);
            if (!block) return null;
            const isHeader = headerSectionId != null && block.sectionId === headerSectionId;
            const isBannerHeader = isHeader && asString(template.headerStyle.layout, "stacked") === "banner";
            const isSkills = skillsSectionId != null && block.sectionId === skillsSectionId;
            const isProjects = projectsSectionId != null && block.sectionId === projectsSectionId;
            // En modo banner, el nombre grande YA hace de "título" visual —
            // el título de sección ("Personal information") y su separador
            // quedan redundantes encima y se ocultan (pedido explícito).
            if (isBannerHeader && block.kind === "section-title") return null;
            const spacingValue = spacing[blockIndexById.get(pb.id) ?? -1] ?? 0;
            return (
              <div
                key={block.id}
                ref={(el) => {
                  if (el) blockRefs.current.set(block.id, el);
                  else blockRefs.current.delete(block.id);
                }}
                style={{
                  paddingBottom: `${spacingValue}px`,
                  ...(isHeader && block.kind === "item"
                    ? {
                        textAlign: asString(template.headerStyle.alignment, "left") as CSSProperties["textAlign"],
                        minHeight: `${asNumber(template.headerStyle.height, 90)}px`,
                        padding: `${asNumber(template.headerStyle.padding, 12)}px`,
                        boxSizing: "border-box",
                      }
                    : null),
                }}
              >
                <BlockContent
                  block={block}
                  template={template}
                  dateFormat={dateFormat}
                  dateLocale={dateLocale}
                  displayLanguage={displayLanguage}
                  datePosition={datePosition}
                  headingCase={headingCase}
                  dividerStyle={dividerStyle}
                  isHeaderBanner={isBannerHeader}
                  isSkills={isSkills}
                  isProjects={isProjects}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function samePagination(a: PaginationBlock[][] | null, b: PaginationBlock[][]): boolean {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const pa = a[i]!;
    const pb = b[i]!;
    if (pa.length !== pb.length) return false;
    for (let j = 0; j < pa.length; j++) {
      if (pa[j]!.id !== pb[j]!.id) return false;
    }
  }
  return true;
}

function BlockContent({
  block,
  template,
  dateFormat,
  dateLocale,
  displayLanguage,
  datePosition,
  headingCase,
  dividerStyle,
  isHeaderBanner,
  isSkills,
  isProjects,
}: {
  block: PreviewBlock;
  template: Template;
  dateFormat: DateDisplayFormat;
  dateLocale: string;
  displayLanguage: string | undefined;
  datePosition: string;
  headingCase: string;
  dividerStyle: string;
  isHeaderBanner: boolean;
  isSkills: boolean;
  isProjects: boolean;
}) {
  if (block.kind === "section-title") {
    const dividerWidth = asNumber(template.separators.thickness, 1);
    return (
      <h2
        className={`cv-preview__section-title cv-preview__section-title--divider-${dividerStyle}`}
        style={{
          color: template.colors.accent,
          borderColor: dividerStyle === "none" ? "transparent" : template.colors.border,
          borderBottomWidth: dividerStyle === "none" ? 0 : `${dividerWidth}px`,
          textAlign: asString(template.sectionTitleStyle.alignment, "left") as CSSProperties["textAlign"],
          fontWeight: template.typography.headingWeight,
          textTransform: headingCase as CSSProperties["textTransform"],
          letterSpacing: `${template.typography.headingLetterSpacing}px`,
          paddingBottom: `${asNumber(template.sectionTitleStyle.spacing, 6)}px`,
        }}
      >
        {translateDefaultLabel(block.title, displayLanguage)}
      </h2>
    );
  }

  if (block.kind === "language-row") {
    // Petición explícita: alineación y modo (fila/columnas/lista)
    // configurables desde la template (`template.languagesStyle`), no
    // fijos. Reutiliza buildItemLayout por item (da título=nombre del
    // idioma + meta[0]="Nivel: valor", igual que antes), solo cambia cómo
    // se COLOCAN/formatean esos items según el modo.
    const items = block.items
      .map((item) => buildItemLayout(item.fields, { dateFormat, dateLocale, lang: displayLanguage }))
      .filter((layout) => layout.title || layout.meta.length > 0);
    if (items.length === 0) return null;

    const alignment = asString(template.languagesStyle.alignment, "center") as CSSProperties["textAlign"];
    const mode = asString(template.languagesStyle.mode, "columns");

    if (mode === "list") {
      // "Español (Nativo), Inglés (B2 (Linguaskill)), Japonés (Básico)"
      const text = items
        .map((layout) => {
          const level = layout.meta[0]?.value;
          return level ? `${layout.title} (${level})` : layout.title;
        })
        .join(", ");
      return <div style={{ textAlign: alignment }}>{text}</div>;
    }

    // "row" (una línea por idioma, apilados) y "columns" (una columna por
    // idioma, en fila) comparten el mismo contenido por idioma — solo
    // cambia la clase que decide si se apilan o se ponen en fila.
    const justifyContent = alignment === "left" ? "flex-start" : alignment === "right" ? "flex-end" : "center";
    return (
      <div
        className={mode === "row" ? "cv-preview__language-column-list" : "cv-preview__language-row"}
        style={mode === "row" ? { textAlign: alignment } : { textAlign: alignment, justifyContent }}
      >
        {items.map((layout, i) => (
          <div key={i} className="cv-preview__language-column">
            {layout.title && <div className="cv-preview__language-name">{layout.title}</div>}
            {layout.meta.map((m) => (
              <div key={m.label} className="cv-preview__language-level">
                {m.label}: {m.value}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  const linkStyle = LINK_STYLES[asString(template.linkStyle.appearance, "accent_underline")] ?? LINK_STYLES.plain;

  if (isSkills) {
    // Petición explícita: sección "Skills" fusionada (Programming
    // Languages/Technologies/Soft Skills), cada campo en su propia línea
    // "Etiqueta: valores", con los valores en píldora (mismo estilo que
    // las tecnologías de Experience/Projects — petición explícita: "quiero
    // que las skills salgan con el redondeo de elementos"), y solo si el
    // campo tiene contenido.
    //
    // Bug real reportado: con muchas píldoras, "Etiqueta:" se quedaba solo
    // en su propia línea y TODAS las píldoras pasaban en bloque a la
    // siguiente — causa: envolver las píldoras en un `<span>` con
    // `display:inline-flex` crea una única caja de nivel en línea, y una
    // caja así, si no cabe entera en el hueco que queda tras "Etiqueta:",
    // se mueve COMPLETA a la línea siguiente (aunque por dentro sí
    // permitiera partirse con flex-wrap) — no se reparte palabra a
    // palabra como el texto normal. Fix: sin ningún contenedor flex de por
    // medio, cada píldora es su propio elemento en línea (igual que una
    // palabra dentro de una frase), así el navegador puede colocar tantas
    // como quepan justo después de "Etiqueta:" y partir el resto con total
    // normalidad, exactamente como envuelve cualquier párrafo largo.
    const groups = buildSkillsLayout(block.item.fields, displayLanguage);
    if (groups.length === 0) return null;
    return (
      <div className="cv-preview__skills">
        {groups.map((g) => (
          <div key={g.label} className="cv-preview__skills-line">
            <strong>{g.label}:</strong>{" "}
            {g.values.map((value, i) => (
              <span key={i} className="cv-preview__tag cv-preview__tag--inline-flow" style={{ color: template.colors.accent }}>
                {value}
              </span>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (isProjects) {
    // Petición explícita: Projects sin fecha, con subtítulo, y con los
    // enlaces en la misma línea que el subtítulo (separados por "•"), sin
    // el estilo de píldora que sí conservan las tecnologías.
    const layout = buildProjectLayout(block.item.fields);
    if (!layout.title && !layout.subtitle && layout.links.length === 0 && layout.descriptions.length === 0 && layout.technologyTags.length === 0) {
      return null;
    }
    const paragraphSpacing = asNumber(template.spacing.paragraphSpacing, 4);
    return (
      <article className="cv-preview__item">
        {layout.title && (
          <div className="cv-preview__item-header">
            <strong>{layout.title}</strong>
          </div>
        )}
        {(layout.subtitle || layout.links.length > 0) && (
          <div className="cv-preview__project-subtitle-line">
            {layout.subtitle && <span className="cv-preview__subtitle">{layout.subtitle}</span>}
            {layout.subtitle && layout.links.length > 0 && <span> | </span>}
            {layout.links.map((link, i) => (
              <span key={i}>
                {i > 0 && <span className="cv-preview__project-link-sep"> • </span>}
                {link.href ? (
                  <a href={link.href} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                    {link.text}
                  </a>
                ) : (
                  link.text
                )}
              </span>
            ))}
          </div>
        )}
        {layout.descriptions.map((doc, i) => (
          <div key={i} className="cv-preview__description" style={i > 0 ? { marginTop: `${paragraphSpacing}px` } : undefined}>
            <RichTextView doc={doc} linkStyle={linkStyle} />
          </div>
        ))}
        {layout.technologyTags.length > 0 && (
          <div className="cv-preview__tags">
            {layout.technologyTags.map((tag) => (
              <span key={tag.text} className="cv-preview__tag" style={{ color: template.colors.accent }}>
                {tag.text}
              </span>
            ))}
          </div>
        )}
      </article>
    );
  }

  const layout = buildItemLayout(block.item.fields, { dateFormat, dateLocale, lang: displayLanguage });

  if (isHeaderBanner) {
    // Diseño alternativo de "Datos personales" (§4 de la conversación:
    // como en la imagen de referencia) — nombre muy grande y centrado,
    // headline debajo, y TODO lo demás (email, teléfono, ubicación,
    // enlaces...) en una única línea separada por "•". A diferencia del
    // layout normal (campo a campo, uno debajo del otro), aquí se
    // reaprovecha el mismo `layout` genérico (título=nombre,
    // subtítulo=headline, meta=resto de campos de texto, tags=enlaces) pero
    // se combinan meta+tags en una sola línea en vez de mostrarlos en filas
    // separadas con su etiqueta ("Email: ...") — en la imagen de referencia
    // no se ven etiquetas, solo los valores.
    const contactItems: Array<{ text: string; href: string | null }> = [
      ...layout.meta.map((m) => ({ text: m.value, href: m.href })),
      ...layout.tags.flat(),
    ];
    return (
      <div className="cv-preview__header-banner">
        {layout.title && (
          <h1
            className="cv-preview__header-banner-name"
            style={{ fontSize: `${asNumber(template.headerStyle.nameFontSize, 28)}px`, color: template.colors.text }}
          >
            {layout.title}
          </h1>
        )}
        {layout.subtitle && <div className="cv-preview__header-banner-headline">{layout.subtitle}</div>}
        {contactItems.length > 0 && (
          <div className="cv-preview__header-banner-contact">
            {contactItems.map((item, i) => (
              <span key={i}>
                {i > 0 && <span className="cv-preview__header-banner-sep"> • </span>}
                {item.href ? (
                  <a href={item.href} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                    {item.text}
                  </a>
                ) : (
                  item.text
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  const paragraphSpacing = asNumber(template.spacing.paragraphSpacing, 4);
  return (
    <article className="cv-preview__item">
      {(layout.title || layout.dateRangeText) && (
        <div className={`cv-preview__item-header cv-preview__item-header--date-${datePosition}`}>
          {layout.title &&
            (layout.titleHref ? (
              <a href={layout.titleHref} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                <strong>{layout.title}</strong>
              </a>
            ) : (
              <strong>{layout.title}</strong>
            ))}
          {layout.dateRangeText && <span className="cv-preview__dates">{layout.dateRangeText}</span>}
        </div>
      )}
      {/* Subtítulo (p.ej. empresa) y ubicación van en la MISMA fila, igual
          que título+fecha arriba — petición explícita del usuario con el
          layout exacto título/fecha, subtítulo/ubicación, descripción,
          tecnologías. */}
      {(layout.subtitle || layout.locationText) && (
        <div className={`cv-preview__item-subheader cv-preview__item-subheader--date-${datePosition}`}>
          {layout.subtitle && <span className="cv-preview__subtitle">{layout.subtitle}</span>}
          {layout.locationText && <span className="cv-preview__location">{layout.locationText}</span>}
        </div>
      )}
      {layout.descriptions.map((doc, i) => (
        <div key={i} className="cv-preview__description" style={i > 0 ? { marginTop: `${paragraphSpacing}px` } : undefined}>
          <RichTextView doc={doc} linkStyle={linkStyle} />
        </div>
      ))}
      {layout.tags.map((tagList, i) => (
        <div key={i} className="cv-preview__tags">
          {tagList.map((tag) =>
            tag.href ? (
              <a
                key={tag.text}
                href={tag.href}
                target="_blank"
                rel="noopener noreferrer"
                className="cv-preview__tag"
                style={{ color: template.colors.accent }}
              >
                {tag.text}
              </a>
            ) : (
              <span key={tag.text} className="cv-preview__tag" style={{ color: template.colors.accent }}>
                {tag.text}
              </span>
            )
          )}
        </div>
      ))}
      {layout.meta.length > 0 && (
        <div className="cv-preview__meta">
          {layout.meta.map((m) => (
            <span key={m.label}>
              {m.label}:{" "}
              {m.href ? (
                <a href={m.href} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                  {m.value}
                </a>
              ) : (
                m.value
              )}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
