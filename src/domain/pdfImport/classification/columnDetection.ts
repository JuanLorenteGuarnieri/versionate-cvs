import type { ExtractedTextItem } from "../types.js";

/**
 * Detección geométrica de columnas (§6.2 del informe de importación de
 * PDF). El reading order por defecto (`sortReadingOrder` en
 * readingOrder.ts) asume una sola columna: ordena TODO el texto de una
 * página por Y y luego por X, lo cual mezcla línea a línea el contenido de
 * dos columnas reales (p.ej. un sidebar de contacto/skills a la izquierda y
 * la experiencia a la derecha) en un orden sin sentido.
 *
 * El algoritmo no pregunta simplemente "¿hay dos grupos de X?": exige que
 * la separación (gutter) sea relativamente ESTABLE a través de una parte
 * sustancial de la altura de la página y que ambos lados tengan contenido
 * suficiente — para no confundir un simple margen lateral, una fecha
 * alineada a la derecha de una línea (p.ej. "2020 - 2023" al final de una
 * línea de Experience) o una tabla puntual con un layout real de columnas.
 */
export interface ColumnRegion {
  /** [xStart, xEnd] en puntos PDF, límites aproximados de la región. */
  xRange: [number, number];
  items: ExtractedTextItem[];
}

const MIN_GUTTER_WIDTH_RATIO = 0.04; // el hueco entre columnas, como fracción del ancho de página
const MIN_COLUMN_CONTENT_RATIO = 0.15; // cada columna necesita ocupar al menos esto del ancho de página
const MIN_LINES_PER_SIDE = 4; // evita disparar con un par de líneas sueltas
const MIN_VERTICAL_COVERAGE_RATIO = 0.35; // el gutter debe mantenerse estable en buena parte de la altura de la página

/** Agrupa items en líneas SOLO por Y, sin asumir nada sobre orden horizontal previo — usado únicamente para detectar la geometría de columnas. */
function groupByY(items: ExtractedTextItem[], yTolerance = 2): ExtractedTextItem[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const lines: ExtractedTextItem[][] = [];
  for (const item of sorted) {
    const current = lines[lines.length - 1];
    const anchor = current?.[0];
    if (anchor && Math.abs(anchor.y - item.y) <= yTolerance) {
      current!.push(item);
    } else {
      lines.push([item]);
    }
  }
  return lines;
}

/**
 * Detecta, para UNA página, si el contenido está organizado en dos
 * columnas verticales con un gutter estable. Devuelve `null` si no hay
 * evidencia suficiente (caso más común: CV de una sola columna), en cuyo
 * caso el llamador debe tratar la página entera como una única región.
 */
export function detectColumnSplit(items: ExtractedTextItem[], pageWidth: number): number | null {
  if (pageWidth <= 0 || items.length === 0) return null;

  const lines = groupByY(items);
  if (lines.length < MIN_LINES_PER_SIDE * 2) return null;

  // Candidatos de posición de gutter: los puntos medios entre el final de
  // un item y el principio del siguiente en la MISMA línea, cuando ese
  // hueco es notablemente ancho — un candidato real de columna produce el
  // mismo candidato de gutter una y otra vez a través de muchas líneas.
  const gutterVotes = new Map<number, number>();
  const bucketSize = pageWidth * 0.02; // agrupa candidatos cercanos en el mismo "cubo"

  for (const line of lines) {
    const sorted = [...line].sort((a, b) => a.x - b.x);
    for (let i = 0; i < sorted.length - 1; i++) {
      const left = sorted[i]!;
      const right = sorted[i + 1]!;
      const leftEnd = left.x + (left.width ?? left.text.length * left.fontSize * 0.5);
      const gap = right.x - leftEnd;
      if (gap < pageWidth * MIN_GUTTER_WIDTH_RATIO) continue;
      const mid = leftEnd + gap / 2;
      const bucket = Math.round(mid / bucketSize) * bucketSize;
      gutterVotes.set(bucket, (gutterVotes.get(bucket) ?? 0) + 1);
    }
  }

  if (gutterVotes.size === 0) return null;

  let bestGutter = 0;
  let bestVotes = 0;
  for (const [gutter, votes] of gutterVotes) {
    if (votes > bestVotes) {
      bestGutter = gutter;
      bestVotes = votes;
    }
  }

  const requiredVotes = Math.max(MIN_LINES_PER_SIDE, lines.length * MIN_VERTICAL_COVERAGE_RATIO);
  if (bestVotes < requiredVotes) return null;

  // Confirma que ambos lados tienen contenido sustancial (no un simple
  // membrete a la derecha de una única línea).
  const leftItems = items.filter((i) => i.x < bestGutter);
  const rightItems = items.filter((i) => i.x >= bestGutter);
  if (leftItems.length < MIN_LINES_PER_SIDE || rightItems.length < MIN_LINES_PER_SIDE) return null;

  // El "ancho de contenido" de un lado no es la variación de su X inicial
  // (texto alineado a la izquierda casi siempre empieza en el mismo X en
  // TODAS sus líneas — eso NO significa que no tenga contenido) sino hasta
  // dónde llega su texto: la distancia entre el X más a la izquierda y el
  // extremo derecho (x + width) más lejano.
  const contentSpan = (side: ExtractedTextItem[]) =>
    Math.max(...side.map((i) => i.x + (i.width ?? i.text.length * i.fontSize * 0.5))) - Math.min(...side.map((i) => i.x));
  const leftSpan = contentSpan(leftItems);
  const rightSpan = contentSpan(rightItems);
  if (leftSpan < pageWidth * MIN_COLUMN_CONTENT_RATIO && rightSpan < pageWidth * MIN_COLUMN_CONTENT_RATIO) {
    return null;
  }

  return bestGutter;
}

/**
 * Divide los items de una página en regiones (una sola si no se detectan
 * columnas, dos si sí). No decide todavía el orden final de lectura entre
 * regiones — eso lo hace `sortReadingOrderWithColumns` en readingOrder.ts.
 */
export function splitIntoColumnRegions(items: ExtractedTextItem[], pageWidth: number): ColumnRegion[] {
  const gutter = detectColumnSplit(items, pageWidth);
  if (gutter === null) {
    return [{ xRange: [0, pageWidth], items }];
  }
  const left = items.filter((i) => i.x < gutter);
  const right = items.filter((i) => i.x >= gutter);
  return [
    { xRange: [0, gutter], items: left },
    { xRange: [gutter, pageWidth], items: right },
  ];
}
