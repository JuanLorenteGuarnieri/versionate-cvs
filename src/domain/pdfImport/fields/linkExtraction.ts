import type { ExtractedLinkAnnotation, ExtractedTextItem } from "../types.js";
import type { Line } from "../entryGrouping.js";

/**
 * La mejor fuente para la URL de un enlace no es adivinar por la forma del
 * texto visible ("LinkedIn", "Ver proyecto", incluso "Node.js" que parece
 * casi un dominio sin serlo) sino la propia anotación de enlace del PDF,
 * cuando existe (§10.2 del informe de importación de PDF). Esta función
 * busca, para una línea de texto ya agrupada, si hay alguna anotación cuyo
 * rectángulo se solape con la posición de esa línea en la página.
 *
 * Tolerante pero no promiscuo: exige la MISMA página y un solape real en
 * el eje X (no basta con estar en la misma franja vertical aproximada) —
 * evita, por ejemplo, que un enlace de la fila de arriba "se cuele" en la
 * línea de justo debajo por un margen de tolerancia en Y demasiado ancho.
 */
const Y_OVERLAP_TOLERANCE = 3;

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export function resolveLinkForLine(line: Line, links: ExtractedLinkAnnotation[]): string | null {
  if (links.length === 0 || line.items.length === 0) return null;
  const page = line.items[0]!.page;
  const lineY = line.y;
  const lineXStart = Math.min(...line.items.map((i) => i.x));
  const lineXEnd = Math.max(...line.items.map((i) => i.x + (i.width ?? i.text.length * i.fontSize * 0.5)));

  for (const link of links) {
    if (link.page !== page) continue;
    const [x1, y1, x2, y2] = link.rect;
    if (lineY < y1 - Y_OVERLAP_TOLERANCE || lineY > y2 + Y_OVERLAP_TOLERANCE) continue;
    if (!rangesOverlap(lineXStart, lineXEnd, x1, x2)) continue;
    return link.url;
  }
  return null;
}

/** Variante directa sobre un único item de texto (útil cuando no hay un `Line` agrupado a mano). */
export function resolveLinkForItem(item: ExtractedTextItem, links: ExtractedLinkAnnotation[]): string | null {
  return resolveLinkForLine({ text: item.text, y: item.y, items: [item] }, links);
}
