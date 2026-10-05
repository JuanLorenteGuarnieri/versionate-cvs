import type { ExtractedTextItem } from "../types.js";
import { detectHeadings, type DetectedHeading } from "../segmentation.js";
import { findDateRange } from "../dateParsing.js";

/**
 * Extensión conservadora de `detectHeadings` (§8 del informe de
 * importación de PDF: "pasar de regex a scoring"). Un heading no siempre
 * es exactamente "EXPERIENCE" o "EDUCACIÓN" — puede ser "Professional
 * journey", "Career history" (ya cubierto en el diccionario ampliado, ver
 * sectionLexicon.ts) o directamente un título no estándar que el
 * diccionario nunca podrá anticipar del todo.
 *
 * En vez de intentar adivinar "¿esto tiene pinta de heading?" en general
 * (arriesgado: un puesto en negrita dentro de Experience también es corto
 * y puede compartir tamaño/negrita con otros puestos, y clasificarlo como
 * heading fragmentaría la sección en falsos "custom sections"), este
 * detector solo añade candidatos cuando ya hay EVIDENCIA CONFIRMADA en el
 * propio documento de qué estilo usa para sus títulos de sección: primero
 * corre la detección léxica de siempre (`detectHeadings`) y, SOLO SI
 * encontró al menos una cabecera reconocida, aprende su estilo tipográfico
 * (tamaño + negrita más frecuente entre las cabeceras confirmadas) y busca
 * más líneas cortas en ESE MISMO estilo que el diccionario no reconoció.
 *
 * Si el documento no tiene ninguna cabecera léxica confirmada, esta
 * función no añade nada (mismo resultado que `detectHeadings`) — sin una
 * referencia de estilo fiable, inventar candidatos sería exactamente el
 * tipo de heurística frágil que el informe recomienda evitar (§13,
 * Apéndice B: "no convertiría una inferencia dudosa en dato definitivo").
 */
const MAX_CANDIDATE_HEADING_LENGTH = 45;
const MAX_CANDIDATE_HEADING_WORDS = 6;
const FONT_SIZE_TOLERANCE = 0.5;

function looksLikeHeadingText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > MAX_CANDIDATE_HEADING_LENGTH) return false;
  if (trimmed.split(/\s+/).length > MAX_CANDIDATE_HEADING_WORDS) return false;
  if (trimmed.includes("@")) return false; // email
  if (findDateRange(trimmed)) return false; // "2020 - 2023" no es un título de sección
  const digitCount = (trimmed.match(/\d/g) ?? []).length;
  if (digitCount > trimmed.length * 0.4) return false; // teléfonos, IDs...
  return true;
}

function mostCommon<T>(values: T[]): T | null {
  if (values.length === 0) return null;
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | null = null;
  let bestCount = -1;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

export function detectHeadingCandidates(items: ExtractedTextItem[]): DetectedHeading[] {
  const lexicalHeadings = detectHeadings(items);
  if (lexicalHeadings.length === 0) return lexicalHeadings;

  const matchedIndices = new Set(lexicalHeadings.map((h) => h.itemIndex));

  // Estilo de referencia: tamaño (redondeado a 0.5pt) y negrita más
  // frecuentes entre las cabeceras YA confirmadas por el diccionario.
  const referenceItems = lexicalHeadings.map((h) => items[h.itemIndex]!);
  const referenceSize = mostCommon(referenceItems.map((i) => Math.round(i.fontSize * 2) / 2));
  const referenceBold = mostCommon(referenceItems.map((i) => Boolean(i.bold)));
  if (referenceSize === null) return lexicalHeadings;

  const extra: DetectedHeading[] = [];
  items.forEach((item, index) => {
    if (matchedIndices.has(index)) return;
    const size = Math.round(item.fontSize * 2) / 2;
    if (Math.abs(size - referenceSize) > FONT_SIZE_TOLERANCE) return;
    if (referenceBold && !item.bold) return; // si las cabeceras confirmadas son negrita, exige negrita también
    if (!looksLikeHeadingText(item.text)) return;
    extra.push({ text: item.text, itemIndex: index, matchedSectionKey: null });
  });

  if (extra.length === 0) return lexicalHeadings;

  return [...lexicalHeadings, ...extra].sort((a, b) => a.itemIndex - b.itemIndex);
}
