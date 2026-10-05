import type { DateRangeValue } from "../model/types.js";

const MONTHS: Record<string, string> = {
  jan: "01",
  ene: "01",
  enero: "01",
  january: "01",
  feb: "02",
  febrero: "02",
  february: "02",
  mar: "03",
  marzo: "03",
  march: "03",
  apr: "04",
  abr: "04",
  abril: "04",
  april: "04",
  may: "05",
  mayo: "05",
  jun: "06",
  junio: "06",
  june: "06",
  jul: "07",
  julio: "07",
  july: "07",
  aug: "08",
  ago: "08",
  agosto: "08",
  august: "08",
  sep: "09",
  sept: "09",
  septiembre: "09",
  september: "09",
  oct: "10",
  octubre: "10",
  october: "10",
  nov: "11",
  noviembre: "11",
  november: "11",
  dec: "12",
  dic: "12",
  diciembre: "12",
  december: "12",
};

const CURRENT_WORDS = ["present", "actualidad", "actual", "current", "hoy", "ongoing"];

// Un "extremo" de fecha: "2020", "Jan 2020", "01/2020", "enero de 2020"...
const DATE_TOKEN = `(?:${Object.keys(MONTHS).join("|")})\\.?\\s+(?:de\\s+)?\\d{4}|\\d{1,2}/\\d{4}|\\d{4}`;
// El separador entre los dos extremos de un rango es sorprendentemente
// variado en la práctica (comprobado extrayendo un PDF real exportado por
// esta misma app, reimportado después):
//  1. El guion habitual, con espacios opcionales: "2020-2023", "2020 - 2023".
//  2. Las palabras "to"/"a", que SIEMPRE necesitan espacio alrededor (si no,
//     "a" podría comerse letras de una palabra real).
//  3. Un único glifo "misterioso" rodeado de espacio obligatorio: cuando el
//     font del PDF no tiene mapeo ToUnicode para el guion largo, pdf.js no
//     devuelve una cadena vacía sino un carácter de la zona de uso privado
//     de Unicode (p.ej. U+E049) — sigue estando ahí, solo que no es "–"
//     literal. Como no podemos saber de antemano qué carácter será, se
//     acepta cualquier símbolo que NO sea letra/número, siempre que vaya
//     pegado a espacios por los dos lados (así "2020 <glifo> 2023" cuenta
//     pero un ID o teléfono sin espacios, no).
//  4. Solo espacio, sin ningún carácter entre medias (mismo caso anterior
//     pero cuando el glifo realmente se pierde del todo).
// En NINGÚN caso el separador puede ser de anchura cero: eso es lo que
// evita que un número largo pegado (un teléfono, un ID) se lea como dos
// DATE_TOKEN de 4 dígitos consecutivos (ver test de regresión).
const SEPARATOR = `(?:\\s*(?:-|–|—)\\s*|\\s+(?:to|a)\\s+|\\s+[^\\s\\p{L}\\p{N}]\\s+|\\s+)`;
const RANGE_RE = new RegExp(`(${DATE_TOKEN})${SEPARATOR}(${DATE_TOKEN}|${CURRENT_WORDS.join("|")})`, "iu");

function parseDateToken(token: string): string | null {
  const monthYear = token.match(/^([a-záéíóúñ]+)\.?\s+(?:de\s+)?(\d{4})$/i);
  if (monthYear) {
    const month = MONTHS[monthYear[1]!.toLowerCase()];
    if (month) return `${monthYear[2]}-${month}-01`;
  }
  const slash = token.match(/^(\d{1,2})\/(\d{4})$/);
  if (slash) {
    return `${slash[2]}-${slash[1]!.padStart(2, "0")}-01`;
  }
  const yearOnly = token.match(/^(\d{4})$/);
  if (yearOnly) return `${yearOnly[1]}-01-01`;
  return null;
}

export interface DateRangeMatch {
  /** El fragmento de texto exacto que se reconoció como rango de fechas. */
  matchedText: string;
  value: DateRangeValue;
}

/**
 * Busca un rango de fechas en un texto libre (normalmente una línea de un
 * CV). Es deliberadamente best-effort (§19 del contexto: la extracción
 * nunca es perfecta, por eso existe la pantalla de revisión): reconoce los
 * formatos más comunes, pero no pretende cubrir todos los posibles.
 * Devuelve null si no encuentra nada reconocible, en vez de adivinar.
 */
export function findDateRange(text: string): DateRangeMatch | null {
  const match = text.match(RANGE_RE);
  if (!match) return null;

  const [matchedText, startToken, endToken] = match;
  const start = parseDateToken(startToken!);
  const isCurrent = CURRENT_WORDS.includes(endToken!.toLowerCase());
  const end = isCurrent ? undefined : parseDateToken(endToken!);

  if (!start && !end && !isCurrent) return null;

  const value: DateRangeValue = {};
  if (start) value.start = start;
  if (isCurrent) value.current = true;
  else if (end) value.end = end;

  return { matchedText: matchedText!, value };
}
