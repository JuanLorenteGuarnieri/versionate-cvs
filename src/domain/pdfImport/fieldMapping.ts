import type { DateRangeValue, FieldValue, SectionDefinition } from "../model/types.js";
import { plainTextToRichText } from "../richtext.js";
import { extractPersonalInfoFields } from "./personalInfoMapping.js";
import type { LineGroup } from "./entryGrouping.js";
import type { RawSectionChunk } from "./segmentation.js";
import { groupChunkIntoEntries } from "./entryGrouping.js";
import { findDateInEntryLines } from "./entries/entryDateSplit.js";
import { mapEntryWithSecondaryTitle } from "./entries/experienceEducation.js";
import { extractSkillsFields } from "./entries/skillsParser.js";

export interface DraftEntry {
  titleGuess: string;
  dateRange: DateRangeValue | null;
  descriptionGuess: string;
  /**
   * Las líneas de texto originales de esta entrada, sin procesar. No se usa
   * en el heurístico genérico de título/fecha/descripción de más abajo,
   * pero permite remapear la entrada con otra lógica si el usuario cambia
   * la sección destino en la pantalla de revisión (ver `mapEntryToFields`).
   */
  rawLines: string[];
  /**
   * Para cada línea de `rawLines` (mismo índice), la URL resuelta vía
   * anotación de enlace del PDF si la hay, o `null`/ausente si no. Permite
   * recuperar enlaces reales (p.ej. "LinkedIn" sin URL visible) — ver
   * fields/linkExtraction.ts. Opcional: la mayoría de llamadores no lo
   * rellenan (no todos los orígenes de una entrada tienen anotaciones que
   * comprobar), en cuyo caso se trata como si no hubiera ningún enlace.
   */
  lineLinks?: (string | null)[];
}

/**
 * Convierte un grupo de líneas (una entrada candidata) en título/fecha/
 * descripción adivinados. Busca la fecha en cualquiera de las líneas del
 * grupo; si la fecha ocupaba toda la primera línea ella sola, se asume que
 * el título es la línea siguiente (patrón común: fecha en su propia línea,
 * antes del puesto/proyecto).
 */
export function buildDraftEntry(group: LineGroup): DraftEntry {
  const texts = group.lines.map((l) => l.text);

  const { dateRange, dateLineIndex, strippedDateLineText } = findDateInEntryLines(texts);

  let titleLineIndex = 0;
  if (dateLineIndex === 0 && strippedDateLineText === "" && texts.length > 1) {
    titleLineIndex = 1;
  }

  const titleGuess = titleLineIndex === dateLineIndex ? strippedDateLineText : (texts[titleLineIndex] ?? "");
  const descriptionGuess = texts
    .filter((_, i) => i !== titleLineIndex && i !== dateLineIndex)
    .join(" ")
    .trim();

  return { titleGuess, dateRange, descriptionGuess, rawLines: texts };
}

/** Atajo: de los items en bruto de una sección directamente a sus DraftEntry. */
export function buildDraftEntriesFromChunk(chunk: RawSectionChunk): DraftEntry[] {
  return groupChunkIntoEntries(chunk).map(buildDraftEntry);
}

/**
 * Mapea un DraftEntry a los campos reales de una sección concreta,
 * mirando solo el TIPO de cada campo de su fieldSchema (mismo principio
 * que buildItemLayout en preview.ts, aplicado a la inversa): el primer
 * campo de texto/url -> título; el primer daterange/date -> fecha; el
 * primer richtext/longtext -> descripción. Así funciona igual para
 * cualquier sección estándar o custom, sin hardcodear nombres de campo.
 */
export function mapDraftEntryToFields(entry: DraftEntry, section: SectionDefinition): Record<string, FieldValue> {
  const fields: Record<string, FieldValue> = {};
  const orderedSchema = [...section.fieldSchema].sort((a, b) => a.order - b.order);

  const titleField = orderedSchema.find((f) => f.type === "text" || f.type === "url");
  if (titleField && entry.titleGuess) {
    fields[titleField.key] = entry.titleGuess;
  }

  const rangeField = orderedSchema.find((f) => f.type === "daterange");
  if (rangeField && entry.dateRange) {
    fields[rangeField.key] = entry.dateRange;
  } else {
    const singleDateField = orderedSchema.find((f) => f.type === "date");
    if (singleDateField && entry.dateRange?.start) {
      fields[singleDateField.key] = entry.dateRange.start;
    }
  }

  const descriptionField = orderedSchema.find((f) => f.type === "richtext" || f.type === "longtext");
  if (descriptionField && entry.descriptionGuess) {
    fields[descriptionField.key] =
      descriptionField.type === "richtext" ? plainTextToRichText(entry.descriptionGuess) : entry.descriptionGuess;
  }

  return fields;
}

/**
 * Punto de entrada único del mapeo de campos, usado por la pantalla de
 * revisión de importación de PDF: adapta la estrategia según la sección
 * DESTINO (§19 del contexto: "el sistema puede utilizar estos datos..." —
 * de forma que sirva para cómo sea cada CV, no solo para el caso genérico).
 *
 * "Personal information" no es una lista de entradas repetidas (título +
 * fecha + descripción) como Experience o Education — es un único conjunto
 * de datos sueltos (nombre, headline, contacto...), así que necesita su
 * propia lógica (`extractPersonalInfoFields`, sobre las líneas crudas).
 * Cualquier otra sección, estándar o custom, sigue usando el heurístico
 * genérico de siempre. Se recalcula cada vez que se llama, así que si el
 * usuario cambia la sección destino en la revisión, basta con volver a
 * llamar a esto con la nueva sección para adaptar los campos.
 */
export function mapEntryToFields(entry: DraftEntry, section: SectionDefinition): Record<string, FieldValue> {
  if (section.key === "personal-information") {
    return extractPersonalInfoFields(entry.rawLines, section, entry.lineLinks ?? []);
  }
  if (section.key === "skills") {
    return extractSkillsFields(entry.rawLines, section);
  }
  if (section.key === "experience" || section.key === "education" || section.key === "projects") {
    const structured = mapEntryWithSecondaryTitle(entry, section);
    if (structured) return structured;
  }
  return mapDraftEntryToFields(entry, section);
}
