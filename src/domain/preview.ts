import type { ResolvedField } from "./resolveCV.js";
import type { RichTextDoc } from "./model/types.js";
import { isDateRangeValue, isLinkListValue, isRichTextDoc } from "./fieldValueGuards.js";
import { guessLinkLabel } from "./linkLabel.js";
import { formatDateRangeForDisplay, formatIsoDateForDisplay, type DateDisplayFormat } from "./formatting.js";
import { currentLabelForDisplayLanguage, translateDefaultLabel } from "./i18n.js";
import { plainTextToRichText } from "./richtext.js";

export interface TagItem {
  text: string;
  /** URL a la que debería enlazar este "tag", o null si es texto suelto sin
   * enlace (p.ej. una tecnología en Experience). Ver buildItemLayout. */
  href: string | null;
}

export interface ItemLayout {
  title: string | null;
  /** URL a la que debería enlazar el título, si vino de un campo tipo "url". */
  titleHref: string | null;
  subtitle: string | null;
  dateRangeText: string | null;
  /** Campo tipo "Location"/"Ubicación", si el schema tiene uno — se pinta
   * aparte (debajo de la fecha) en vez de mezclado en "meta", ver
   * CVPreview.tsx. Detectado por nombre de campo, no por posición. */
  locationText: string | null;
  descriptions: RichTextDoc[];
  tags: TagItem[][];
  meta: Array<{ label: string; value: string; href: string | null }>;
}

export interface BuildItemLayoutOptions {
  dateFormat?: DateDisplayFormat;
  /** Locale BCP-47 para Intl (nombres de mes, etc.) — ver i18n.ts, viene de CVVersion.displayLanguage, NO de la template. */
  dateLocale?: string;
  /** Código corto de idioma ("es", "en"...) para traducir SOLO etiquetas de
   * fábrica sin modificar por el usuario (títulos de sección, "Location",
   * "Level"...) — ver i18n.ts. `undefined`/desconocido = sin traducir. */
  lang?: string;
}

/** Añade el esquema si falta, para que quede como href usable en un <a>. */
function normalizeHref(url: string): string {
  const trimmed = url.trim();
  return /^https?:\/\/|^mailto:|^tel:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const LOCATION_FIELD_RE = /location|ubicaci[oó]n|^ciudad$|^city$/i;
function isLocationField(field: ResolvedField): boolean {
  return LOCATION_FIELD_RE.test(field.key) || LOCATION_FIELD_RE.test(field.label);
}

/**
 * Convierte los campos ya resueltos de un item (en el orden de su
 * fieldSchema, ver resolveCV.ts) en una estructura de layout genérica, para
 * que el renderer de preview no necesite saber nada específico de cada tipo
 * de sección. Reglas, en orden de aplicación:
 *
 * - Un campo de texto que se llama/etiqueta como ubicación (cualquier
 *   posición) -> `locationText`, aparte del resto (ver CVPreview.tsx: se
 *   pinta debajo de la fecha, con la misma alineación que dateStyle.position).
 * - El primer campo de texto/url no vacío restante -> título.
 * - El segundo campo de texto (no url) no vacío restante -> subtítulo.
 * - Cualquier "date"/"daterange" -> se combinan en una única línea de fechas.
 * - "richtext"/"longtext" -> párrafos de descripción (uno por campo).
 * - "linklist"/"tags"/"list" -> filas de etiquetas.
 * - Cualquier otro texto/boolean(true)/select con valor -> línea de meta
 *   suelta ("Label: valor").
 *
 * Es una heurística deliberadamente genérica (no hay "layouts por tipo de
 * sección" todavía): funciona igual de bien para una sección custom que
 * para "Experience", porque solo mira el ORDEN/NOMBRE y el TIPO de los
 * campos, no una lista fija de secciones conocidas.
 */
export function buildItemLayout(fields: ResolvedField[], options: BuildItemLayoutOptions = {}): ItemLayout {
  const { dateFormat = "MMM YYYY", dateLocale = "es-ES", lang } = options;
  const currentLabel = currentLabelForDisplayLanguage(lang);
  const layout: ItemLayout = {
    title: null,
    titleHref: null,
    subtitle: null,
    dateRangeText: null,
    locationText: null,
    descriptions: [],
    tags: [],
    meta: [],
  };

  function appendDateText(text: string): void {
    if (!text) return;
    layout.dateRangeText = layout.dateRangeText ? `${layout.dateRangeText} · ${text}` : text;
  }

  for (const field of fields) {
    switch (field.type) {
      case "text":
      case "url": {
        if (!isNonEmptyString(field.value)) break;
        if (field.type === "text" && layout.locationText === null && isLocationField(field)) {
          layout.locationText = field.value;
          break;
        }
        const href = field.type === "url" ? normalizeHref(field.value) : null;
        if (layout.title === null) {
          layout.title = field.value;
          layout.titleHref = href;
        } else if (layout.subtitle === null && field.type === "text") {
          layout.subtitle = field.value;
        } else {
          layout.meta.push({ label: translateDefaultLabel(field.label, lang), value: field.value, href });
        }
        break;
      }

      case "date": {
        if (isNonEmptyString(field.value)) appendDateText(formatIsoDateForDisplay(field.value, dateLocale, dateFormat));
        break;
      }

      case "daterange": {
        if (isDateRangeValue(field.value)) {
          appendDateText(formatDateRangeForDisplay(field.value, dateLocale, dateFormat, currentLabel));
        }
        break;
      }

      case "richtext": {
        if (isRichTextDoc(field.value)) layout.descriptions.push(field.value);
        break;
      }

      case "longtext": {
        if (isNonEmptyString(field.value)) layout.descriptions.push(plainTextToRichText(field.value));
        break;
      }

      case "linklist": {
        if (isLinkListValue(field.value) && field.value.length > 0) {
          const entries = field.value
            .filter((entry) => entry.url || entry.label)
            .map((entry) => ({
              // Si no se ha puesto un nombre, se adivina uno a partir del
              // dominio en vez de mostrar la URL completa tal cual — el
              // pedido explícito era precisamente "que no se lea la URL",
              // así que dejar caer aquí en la URL entera sería reproducir
              // el mismo problema en el único caso (nombre vacío) donde
              // más importa evitarlo.
              text: entry.label || (entry.url ? guessLinkLabel(entry.url) : ""),
              href: entry.url ? normalizeHref(entry.url) : null,
            }));
          if (entries.length > 0) layout.tags.push(entries);
        }
        break;
      }

      case "tags":
      case "list": {
        if (Array.isArray(field.value) && field.value.length > 0) {
          // Solo se enlazan los valores si el propio CAMPO se llama/etiqueta
          // como algo de enlaces (p.ej. "Links", "Portfolio") — igual que
          // detecta el campo de links personalInfoMapping.ts al importar un
          // PDF. Un campo "list"/"tags" cualquiera (p.ej. "Technologies")
          // se deja SIEMPRE como texto plano sin enlazar: un valor como
          // "Node.js" tiene toda la pinta de dominio (palabra.palabra) sin
          // serlo, así que adivinar por la FORMA del valor en vez de por el
          // nombre del campo daría bastantes falsos positivos.
          const looksLikeLinksField = /link|url|web|portfolio|redes/i.test(`${field.key} ${field.label}`);
          layout.tags.push(
            (field.value as string[]).map((text) => ({
              text,
              href: looksLikeLinksField ? normalizeHref(text) : null,
            }))
          );
        }
        break;
      }

      case "boolean": {
        if (field.value === true) layout.meta.push({ label: translateDefaultLabel(field.label, lang), value: "Sí", href: null });
        break;
      }

      case "select": {
        if (isNonEmptyString(field.value)) {
          layout.meta.push({ label: translateDefaultLabel(field.label, lang), value: field.value, href: null });
        }
        break;
      }

      default:
        break;
    }
  }

  return layout;
}

export interface ProjectLayout {
  title: string | null;
  subtitle: string | null;
  /** Enlaces del proyecto (campo "linklist") — se muestran en texto plano
   * junto al subtítulo, NUNCA como píldora (a diferencia de
   * `technologyTags`). Ver CVPreview.tsx. */
  links: TagItem[];
  descriptions: RichTextDoc[];
  /** Tecnologías (campo "tags"/"list") — estas SÍ se siguen viendo como
   * píldora, sin cambios respecto al resto de secciones. */
  technologyTags: TagItem[];
}

/**
 * Layout específico para la sección "Projects" (pedido explícito del
 * usuario): sin fecha — Projects ya no tiene ningún campo de fecha — y con
 * los enlaces combinados en la misma línea que el subtítulo en vez de como
 * píldoras independientes. Deliberadamente genérico por TIPO de campo (no
 * por una key fija), igual que `buildItemLayout`: el primer campo de texto
 * no vacío es el título, el segundo el subtítulo, cualquier "linklist" son
 * enlaces, cualquier "tags"/"list" son tecnologías.
 */
export function buildProjectLayout(fields: ResolvedField[]): ProjectLayout {
  const layout: ProjectLayout = { title: null, subtitle: null, links: [], descriptions: [], technologyTags: [] };

  for (const field of fields) {
    switch (field.type) {
      case "text": {
        if (!isNonEmptyString(field.value)) break;
        if (layout.title === null) layout.title = field.value;
        else if (layout.subtitle === null) layout.subtitle = field.value;
        break;
      }

      case "richtext": {
        if (isRichTextDoc(field.value)) layout.descriptions.push(field.value);
        break;
      }

      case "longtext": {
        if (isNonEmptyString(field.value)) layout.descriptions.push(plainTextToRichText(field.value));
        break;
      }

      case "linklist": {
        if (isLinkListValue(field.value) && field.value.length > 0) {
          for (const entry of field.value) {
            if (!entry.url && !entry.label) continue;
            layout.links.push({
              text: entry.label || (entry.url ? guessLinkLabel(entry.url) : ""),
              href: entry.url ? normalizeHref(entry.url) : null,
            });
          }
        }
        break;
      }

      case "tags":
      case "list": {
        if (Array.isArray(field.value) && field.value.length > 0) {
          layout.technologyTags.push(...(field.value as string[]).map((text) => ({ text, href: null })));
        }
        break;
      }

      default:
        break;
    }
  }

  return layout;
}

export interface SkillsGroup {
  label: string;
  values: string[];
}

/**
 * Layout específico para la sección fusionada "Skills" (petición explícita
 * del usuario: Programming Languages / Technologies / Soft Skills en un
 * solo apartado): cada campo de tipo "tags" no vacío se convierte en un
 * grupo "Etiqueta: valores" — los valores se muestran como píldora, igual
 * que las tecnologías de Experience/Projects (petición explícita: "quiero
 * que las skills salgan con el redondeo de elementos"). Solo se incluyen
 * los campos que tienen contenido (petición explícita: "solo se mostraría
 * cada uno de esos 3 campos si tiene algún elemento dentro").
 */
export function buildSkillsLayout(fields: ResolvedField[], lang?: string): SkillsGroup[] {
  const groups: SkillsGroup[] = [];
  for (const field of fields) {
    if (field.type !== "tags" && field.type !== "list") continue;
    if (!Array.isArray(field.value) || field.value.length === 0) continue;
    groups.push({ label: translateDefaultLabel(field.label, lang), values: field.value as string[] });
  }
  return groups;
}
