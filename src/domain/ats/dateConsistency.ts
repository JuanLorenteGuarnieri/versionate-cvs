/**
 * Detecta si el mismo CV mezcla varios formatos de fecha distintos (p.ej.
 * "Jan 2020" junto con "01/2020") — puramente basado en expresiones
 * regulares sobre el texto ya extraído (§20 del contexto: sin IA). Mezclar
 * formatos no rompe la lectura por un ATS, pero es una señal de
 * inconsistencia que un revisor humano (o el propio ATS al normalizar
 * fechas) puede interpretar como descuido.
 */

interface DateFormatPattern {
  id: string;
  label: string;
  regex: RegExp;
}

const MONTH_NAMES =
  "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|ene|abr|ago|dic|" +
  "january|february|march|april|june|july|august|september|october|november|december|" +
  "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre";

const DATE_FORMAT_PATTERNS: DateFormatPattern[] = [
  { id: "month-name-year", label: "\"Mes AAAA\" (p.ej. \"Jan 2020\", \"enero 2020\")", regex: new RegExp(`\\b(?:${MONTH_NAMES})\\.?\\s+\\d{4}\\b`, "gi") },
  { id: "mm-slash-yyyy", label: "\"MM/AAAA\" (p.ej. \"01/2020\")", regex: /\b\d{1,2}\/\d{4}\b/g },
  { id: "yyyy-mm", label: "\"AAAA-MM\" (p.ej. \"2020-01\")", regex: /\b\d{4}-\d{1,2}\b/g },
  { id: "dd-mm-yyyy", label: "\"DD/MM/AAAA\" o \"DD-MM-AAAA\"", regex: /\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/g },
];

export interface DateFormatUsage {
  id: string;
  label: string;
  count: number;
}

export interface DateFormatConsistencyResult {
  consistent: boolean;
  formatsUsed: DateFormatUsage[];
}

/**
 * Examina el texto plano ya extraído del CV y cuenta cuántos formatos de
 * fecha DISTINTOS aparecen. Si aparece más de uno con al menos una
 * coincidencia cada uno, se considera inconsistente.
 */
export function checkDateFormatConsistency(cvPlainText: string): DateFormatConsistencyResult {
  const formatsUsed: DateFormatUsage[] = [];
  for (const pattern of DATE_FORMAT_PATTERNS) {
    const matches = cvPlainText.match(pattern.regex);
    if (matches && matches.length > 0) {
      formatsUsed.push({ id: pattern.id, label: pattern.label, count: matches.length });
    }
  }
  return { consistent: formatsUsed.length <= 1, formatsUsed };
}
