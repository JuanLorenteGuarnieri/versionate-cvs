import type { ExtractedTextItem } from "../types.js";

/**
 * En un PDF de varias páginas conviene detectar líneas que se repiten
 * aproximadamente en la misma posición de cada página (§7.2 del informe de
 * importación): un nombre de documento, un número de página, o un
 * encabezado/pie repetido no debería acabar dentro de Experience o
 * Education solo porque cae geométricamente en esa zona de la página.
 *
 * El criterio es deliberadamente conservador: solo se descarta un item si
 * su texto (normalizado) aparece en 2 o más páginas DISTINTAS con una
 * posición Y muy similar (relativa a la altura de página, para que
 * funcione igual con cualquier tamaño) — un texto que aparece una sola vez
 * nunca se toca, y un texto que se repite pero cambia de posición (p.ej.
 * "2020 - 2023" en dos experiencias distintas) tampoco cuenta, porque el
 * criterio de posición además de contenido reduce mucho los falsos
 * positivos. Con un solo documento de una página esto no hace nada — ver
 * test de regresión correspondiente.
 */
const Y_TOLERANCE_RATIO = 0.015; // como fracción de la altura de página

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

export function detectRepeatedHeaderFooterLines(
  items: ExtractedTextItem[],
  pageHeight: number,
  numPages: number
): Set<ExtractedTextItem> {
  const toRemove = new Set<ExtractedTextItem>();
  if (numPages < 2 || pageHeight <= 0) return toRemove;

  const yTolerance = pageHeight * Y_TOLERANCE_RATIO;

  // Agrupa por texto normalizado -> lista de (page, y, item).
  const byText = new Map<string, ExtractedTextItem[]>();
  for (const item of items) {
    const key = normalize(item.text);
    if (!key) continue;
    const list = byText.get(key);
    if (list) list.push(item);
    else byText.set(key, [item]);
  }

  for (const [, occurrences] of byText) {
    const distinctPages = new Set(occurrences.map((o) => o.page));
    if (distinctPages.size < 2) continue;

    // Agrupa las ocurrencias por posición Y similar (tolerante), y solo
    // cuenta como "repetido en la misma posición" si esas ocurrencias
    // cercanas en Y vienen de páginas DISTINTAS.
    const clusters: ExtractedTextItem[][] = [];
    for (const occ of occurrences) {
      const cluster = clusters.find((c) => Math.abs(c[0]!.y - occ.y) <= yTolerance);
      if (cluster) cluster.push(occ);
      else clusters.push([occ]);
    }

    for (const cluster of clusters) {
      const pagesInCluster = new Set(cluster.map((o) => o.page));
      if (pagesInCluster.size >= 2) {
        for (const occ of cluster) toRemove.add(occ);
      }
    }
  }

  return toRemove;
}

/** Atajo: aplica la detección y devuelve los items YA filtrados. */
export function stripRepeatedHeaderFooterLines(
  items: ExtractedTextItem[],
  pageHeight: number,
  numPages: number
): ExtractedTextItem[] {
  const toRemove = detectRepeatedHeaderFooterLines(items, pageHeight, numPages);
  if (toRemove.size === 0) return items;
  return items.filter((i) => !toRemove.has(i));
}
