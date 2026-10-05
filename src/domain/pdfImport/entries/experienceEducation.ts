import type { FieldValue, SectionDefinition } from "../../model/types.js";
import { plainTextToRichText } from "../../richtext.js";
import type { DraftEntry } from "../fieldMapping.js";
import { findDateInEntryLines } from "./entryDateSplit.js";

const MAX_SECONDARY_TITLE_LENGTH = 70;
const MAX_SECONDARY_TITLE_WORDS = 8;

/**
 * Una entrada real de Experience o Education casi siempre tiene DOS líneas
 * de "título" antes de la descripción — puesto + empresa, o titulación +
 * institución — no una sola (§15.1 y Apéndice B del informe de importación
 * de PDF señalan esto como una limitación conocida del heurístico
 * genérico). Esta función intenta separarlas cuando hay evidencia clara;
 * si no la hay, devuelve `null` y el llamador (`mapEntryToFields`) cae de
 * vuelta al heurístico genérico de título único.
 *
 * Deliberadamente conservador: solo actúa cuando
 *   1) la sección DESTINO tiene al menos dos campos de tipo texto/url
 *      distintos en su fieldSchema (si no, no hay dónde poner una segunda
 *      línea de título — funciona igual para secciones custom que también
 *      tengan esta forma, sin hardcodear nombres de campo), y
 *   2) la entrada tiene al menos 3 líneas además de la fecha (título +
 *      segunda línea + descripción) — con solo 2 líneas no hay señal
 *      suficiente para distinguir "segunda línea de título" de "la
 *      descripción es de una sola frase corta", y
 *   3) esa segunda línea tiene pinta de nombre propio corto (empresa/
 *      institución), no de frase completa.
 * Con menos evidencia que esto, es mejor dejar que el usuario lo corrija a
 * mano en la revisión que arriesgarse a cortar mal una descripción.
 */
function looksLikeSecondaryTitle(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MAX_SECONDARY_TITLE_LENGTH) return false;
  if (trimmed.split(/\s+/).length > MAX_SECONDARY_TITLE_WORDS) return false;
  // Una frase de descripción real casi siempre termina en punto; una línea
  // de empresa/institución casi nunca lo hace.
  if (/[.!?]$/.test(trimmed)) return false;
  return true;
}

export function mapEntryWithSecondaryTitle(entry: DraftEntry, section: SectionDefinition): Record<string, FieldValue> | null {
  const orderedSchema = [...section.fieldSchema].sort((a, b) => a.order - b.order);
  const titleField = orderedSchema.find((f) => f.type === "text" || f.type === "url");
  if (!titleField) return null;
  const secondaryField = orderedSchema.find((f) => (f.type === "text" || f.type === "url") && f.key !== titleField.key);
  if (!secondaryField) return null;

  const { dateRange, dateLineIndex, strippedDateLineText } = findDateInEntryLines(entry.rawLines);

  const remaining = entry.rawLines
    .map((text, index) => ({ text, index }))
    .filter(({ index }) => index !== dateLineIndex)
    .map(({ text }, i, arr) => {
      // Si la fecha ocupaba toda la primera línea ella sola, esa línea ya
      // no aporta nada (mismo patrón que en buildDraftEntry).
      if (i === 0 && dateLineIndex === 0 && strippedDateLineText === "" && arr.length > 0) return null;
      return text;
    })
    .filter((t): t is string => t !== null);

  if (remaining.length < 3) return null;

  const [primaryTitle, secondaryTitle, ...rest] = remaining;
  if (!looksLikeSecondaryTitle(secondaryTitle!)) return null;

  const fields: Record<string, FieldValue> = {};
  fields[titleField.key] = primaryTitle!;
  fields[secondaryField.key] = secondaryTitle!;

  const rangeField = orderedSchema.find((f) => f.type === "daterange");
  if (rangeField && dateRange) {
    fields[rangeField.key] = dateRange;
  } else {
    const singleDateField = orderedSchema.find((f) => f.type === "date");
    if (singleDateField && dateRange?.start) {
      fields[singleDateField.key] = dateRange.start;
    }
  }

  const descriptionField = orderedSchema.find((f) => f.type === "richtext" || f.type === "longtext");
  const descriptionGuess = rest.join(" ").trim();
  if (descriptionField && descriptionGuess) {
    fields[descriptionField.key] =
      descriptionField.type === "richtext" ? plainTextToRichText(descriptionGuess) : descriptionGuess;
  }

  return fields;
}
