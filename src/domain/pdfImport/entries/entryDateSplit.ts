import type { DateRangeValue } from "../../model/types.js";
import { findDateRange } from "../dateParsing.js";

export interface EntryDateSplit {
  dateRange: DateRangeValue | null;
  /** -1 si no se encontró ninguna fecha. */
  dateLineIndex: number;
  /** El texto de la línea de fecha SIN el fragmento de fecha (puede quedar vacío). */
  strippedDateLineText: string;
}

/**
 * Busca una fecha en cualquiera de las líneas de una entrada (una
 * experiencia, un proyecto...) y separa esa línea del resto. Extraído de
 * `buildDraftEntry` (fieldMapping.ts) para poder reutilizar EXACTAMENTE la
 * misma lógica en los parsers especializados por sección (experience/
 * education) sin duplicarla ni arriesgarse a que diverja con el tiempo.
 */
export function findDateInEntryLines(texts: string[]): EntryDateSplit {
  for (let i = 0; i < texts.length; i++) {
    const found = findDateRange(texts[i]!);
    if (found) {
      return {
        dateRange: found.value,
        dateLineIndex: i,
        strippedDateLineText: texts[i]!.replace(found.matchedText, "").trim(),
      };
    }
  }
  return { dateRange: null, dateLineIndex: -1, strippedDateLineText: "" };
}
