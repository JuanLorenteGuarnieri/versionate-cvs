// Tipos del dominio de Create Versionate CVs.
// Puros: sin dependencias de React, IndexedDB ni ninguna librería de UI.
// Ver ARCHITECTURE.md §5 para el razonamiento detrás de cada decisión.

export type FieldType =
  | "text"
  | "longtext"
  | "richtext"
  | "date"
  | "daterange"
  | "url"
  | "list"
  | "linklist"
  | "select"
  | "boolean"
  | "tags";
// Nota: no existe FieldType "image" — sin soporte de foto de perfil en esta fase
// (decisión confirmada). Si se añade más adelante, se sumará aquí y una entidad
// Asset, sin tocar el resto del modelo.

export interface FieldDefinition {
  id: string;
  key: string; // 'title', 'company', 'startDate'...
  label: string;
  type: FieldType;
  required?: boolean;
  order: number;
}

export interface SectionDefinition {
  id: string; // 'experience', 'education', 'custom-<uuid>'
  key: string;
  isCustom: boolean;
  defaultTitle: string;
  fieldSchema: FieldDefinition[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

// ---------- Contenido reutilizable ----------

export interface Element {
  id: string;
  sectionId: string;
  variantIds: string[]; // orden de variantes para navegación/UI
  defaultVariantId: string; // solo conveniencia de UI, sin significado especial
  /**
   * Nombre explícito puesto por el usuario para IDENTIFICAR el elemento en
   * listas/selectores (p.ej. "Scanpath Prediction" como proyecto) —
   * petición explícita: poder renombrarlo sin depender de que el título/
   * nombre de la variante por defecto coincida con lo que se quiere ver
   * ahí. Si no está puesto (`undefined` o cadena vacía), se seguirá
   * adivinando automáticamente a partir de los campos de la variante por
   * defecto (ver labels.ts:guessElementLabel) — mismo comportamiento de
   * siempre, sin migración necesaria para bases de datos ya existentes.
   */
  labelOverride?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DateRangeValue {
  start?: string;
  end?: string;
  current?: boolean;
}

/** Un enlace con nombre propio ("LinkedIn" -> "https://linkedin.com/in/...")
 * en vez de una URL suelta — para el campo "links" de Datos personales y
 * cualquier otro campo tipo "linklist". Ver FieldType. */
export interface LinkListEntry {
  label: string;
  url: string;
}

// Rich text restringido (no HTML libre), para que preview y export
// recorran exactamente el mismo árbol. Ver ARCHITECTURE.md §5.
export interface RichTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  href?: string;
}

export interface RichTextBlock {
  kind: "paragraph" | "bullet";
  runs: RichTextRun[];
}

export interface RichTextDoc {
  type: "richtext";
  blocks: RichTextBlock[];
}

export type FieldValue =
  | string
  | string[]
  | boolean
  | null
  | DateRangeValue
  | RichTextDoc
  | LinkListEntry[];

export interface Variant {
  id: string;
  elementId: string;
  name: string; // nombre descriptivo, ej. "Computer Vision"
  derivedFromVariantId?: string | null;
  fields: Record<string, FieldValue>; // clave = FieldDefinition.key
  createdAt: string;
  updatedAt: string;
}

// ---------- Templates ----------

export type TextAlignment = "left" | "center" | "right" | "justify";
export type HeadingCase = "none" | "uppercase" | "capitalize";

export interface TemplateTypography {
  fontFamily: string;
  baseFontSize: number;
  lineHeight: number;
  headingScale: number;
  /** Grosor del texto base (400 = normal, 700 = negrita...). */
  fontWeight: number;
  /** Grosor de títulos y encabezados de sección. */
  headingWeight: number;
  /** Mayúsculas/minúsculas de los títulos de sección. */
  headingCase: HeadingCase;
  /** Espaciado entre letras de los títulos, en px. */
  headingLetterSpacing: number;
  /** Alineación general del contenido del CV. */
  textAlignment: TextAlignment;
}

export interface TemplateColors {
  text: string;
  background: string;
  accent: string;
  muted: string;
  border: string;
}

export interface TemplateSpacing {
  sectionGap: number;
  itemGap: number;
  margins: { top: number; right: number; bottom: number; left: number };
  /** Espacio entre párrafos/descripciones consecutivos dentro de un item, en px. */
  paragraphSpacing: number;
}

export interface Template {
  id: string;
  name: string;
  typography: TemplateTypography;
  colors: TemplateColors;
  spacing: TemplateSpacing;
  /**
   * Bolsas de estilo deliberadamente sueltas (Record<string, unknown>) en
   * vez de interfaces estrictas: son parámetros más específicos/opcionales
   * que se han ido añadiendo con el tiempo y así se pueden sumar más sin
   * migraciones de esquema. Claves reconocidas por el renderer/editor hoy:
   *
   * - sectionTitleStyle.alignment: TextAlignment — alineación del título de sección.
   * - sectionTitleStyle.spacing: number (px) — distancia entre el título y su contenido.
   * - headerStyle.alignment: TextAlignment — alineación del encabezado (Información personal).
   * - headerStyle.height: number (px) — altura mínima del bloque de encabezado (solo en layout "stacked").
   * - headerStyle.padding: number (px) — padding interno del encabezado.
   * - headerStyle.layout: "stacked" | "banner" — "stacked" (por defecto) trata Datos
   *   personales como cualquier otro item, campo a campo. "banner" es un diseño propio:
   *   el primer campo de texto (normalmente el nombre) se pinta muy grande y centrado,
   *   el siguiente que parezca un cargo/headline debajo en cursiva, y TODO lo demás
   *   (email, teléfono, ubicación, enlaces...) en una única línea separada por "•".
   * - headerStyle.nameFontSize: number (px) — tamaño del nombre en layout "banner".
   * - dateStyle.position: "left" | "right" | "inline" — posición de las fechas.
   * - dateStyle.format: "MM/YYYY" | "YYYY" | "MMM YYYY" — formato de las fechas.
   * - bulletStyle.shape: "circle" | "dash" | "square" | "none" — forma del bullet.
   * - bulletStyle.indent: number (px) — sangría de las listas.
   * - bulletStyle.gap: number (px) — distancia entre bullet y texto.
   * - separators.style: "line" | "none" | "dots" — forma de separar secciones.
   * - separators.thickness: number (px) — grosor de los separadores.
   * - separators.borderRadius: number (px) — redondeo de elementos visuales (tags, etc).
   * - linkStyle.appearance: "accent_underline" | "accent" | "underline" | "plain" — apariencia de enlaces.
   * - languagesStyle.alignment: "left" | "center" | "right" — alineación de la
   *   sección "Languages" (aplica a los 3 modos).
   * - languagesStyle.mode: "row" | "columns" | "list" — cómo se muestran los
   *   idiomas (petición explícita del usuario, ver preview.ts:LanguagesMode):
   *     "row" (una línea por idioma, como cualquier otra sección — nombre +
   *       "Nivel: valor" debajo, apilados);
   *     "columns" (por defecto — una columna por idioma, en fila);
   *     "list" (una sola línea: "Español (Nativo), Inglés (B2 (Linguaskill)), ...").
   */
  sectionTitleStyle: Record<string, unknown>;
  headerStyle: Record<string, unknown>;
  dateStyle: Record<string, unknown>;
  bulletStyle: Record<string, unknown>;
  separators: Record<string, unknown>;
  linkStyle: Record<string, unknown>;
  languagesStyle: Record<string, unknown>;
  derivedFromTemplateId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------- CVs y versiones ----------

export interface CVProject {
  id: string;
  name: string; // "Computer Vision Engineer"
  versionIds: string[]; // orden cronológico
  activeVersionId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface CVSectionItem {
  elementId: string;
  variantId: string;
  order: number;
}

export interface CVSectionInstance {
  sectionDefinitionId: string;
  titleOverride?: string;
  order: number;
  items: CVSectionItem[]; // vacío => la sección no se renderiza
}

export interface CVVersionMetadata {
  targetRole?: string;
  targetCompany?: string;
  notes?: string;
}

export interface CVVersion {
  id: string;
  projectId: string;
  label: string; // "v1", "v2", o nombre custom
  templateId: string;
  sections: CVSectionInstance[]; // el ORDEN de secciones vive aquí, no en el template
  metadata: CVVersionMetadata;
  /**
   * Idioma de visualización de ESTA versión (código corto: "es", "en"...) —
   * vive aquí, no en la template, porque el mismo diseño visual puede
   * usarse para versiones en distintos idiomas del mismo CV. Controla el
   * idioma de las fechas (nombres de mes) y traduce SOLO los títulos de
   * sección/etiquetas de campo que sigan en su valor por defecto de
   * fábrica — ver i18n.ts para el porqué de ese límite. `undefined` =
   * inglés (el idioma en el que están los valores por defecto).
   */
  displayLanguage?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Papelera e historial ----------

export type TrashableEntityType =
  | "element"
  | "variant"
  | "template"
  | "cvProject"
  | "cvVersion";

export interface TrashEntry {
  id: string;
  entityType: TrashableEntityType;
  entityId: string;
  snapshot: unknown; // copia completa de la entidad, autosuficiente para restaurar
  deletedAt: string;
}

export type HistoryEventType =
  | "section_created"
  | "field_added_to_section"
  | "element_created"
  | "variant_created"
  | "variant_modified"
  | "variant_forked"
  | "template_created"
  | "template_modified"
  | "template_forked"
  | "cv_created"
  | "cv_renamed"
  | "cv_version_created"
  | "cv_version_renamed"
  | "variant_renamed"
  | "element_renamed"
  | "cv_section_items_changed"
  | "cv_section_order_changed"
  | "cv_template_changed"
  | "cv_active_version_changed"
  | "trash_entry_purged"
  | "trash_emptied"
  | "database_imported"
  | "element_removed"
  | "variant_removed"
  | "template_removed"
  | "cv_project_removed"
  | "cv_version_removed"
  | "entity_restored";

export interface HistoryEntry {
  id: string;
  timestamp: string;
  type: HistoryEventType;
  entityType: string;
  entityId: string;
  summary: string; // texto legible para el historial en UI
}

// ---------- Raíz exportable ----------

export interface AppSettings {
  theme: "dark" | "light";
}

export interface AppDatabase {
  formatVersion: number; // para migraciones futuras del esquema
  sections: SectionDefinition[];
  elements: Element[];
  variants: Variant[];
  templates: Template[];
  cvProjects: CVProject[];
  cvVersions: CVVersion[];
  trash: TrashEntry[];
  history: HistoryEntry[];
  settings: AppSettings;
}

export const CURRENT_FORMAT_VERSION = 9;
