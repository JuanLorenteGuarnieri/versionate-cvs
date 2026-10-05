import type { ExtractedTextItem } from "./types.js";
import { splitIntoColumnRegions } from "./classification/columnDetection.js";

/**
 * pdf.js devuelve los items de texto en el orden en que aparecen en el
 * content stream del PDF — que NO es necesariamente el orden de lectura
 * visual. Esto se comprobó de forma muy concreta con un PDF exportado por
 * esta misma app (`window.print()`): el motor de impresión de Chromium
 * intercala el contenido en distintas "pasadas" (p.ej. títulos y cuerpo
 * principal primero, después subtítulos/fechas/tags/meta de TODAS las
 * secciones seguidos), así que dos textos que están uno al lado del otro en
 * pantalla pueden estar a decenas de posiciones de distancia en
 * `doc.items`. Sin reordenar, `detectHeadings`/`splitIntoSections` asignan
 * casi todo ese contenido "de la segunda pasada" (fechas, tags, meta,
 * subtítulo del header, contacto) a la ÚLTIMA sección detectada en vez de a
 * la sección a la que pertenecen visualmente — la causa raíz de que
 * exportar un CV y reimportarlo no reprodujera la misma información.
 *
 * La solución estándar (y la que usan la mayoría de librerías de
 * extracción de texto de PDFs con diseño complejo) es reordenar por
 * posición: página, después de arriba a abajo (Y decreciente en
 * coordenadas PDF), agrupando en "líneas" por tolerancia de Y, y dentro de
 * cada línea de izquierda a derecha (X creciente).
 */
export function sortReadingOrder(items: ExtractedTextItem[], yTolerance = 2): ExtractedTextItem[] {
  const byPage = new Map<number, ExtractedTextItem[]>();
  for (const item of items) {
    const list = byPage.get(item.page);
    if (list) list.push(item);
    else byPage.set(item.page, [item]);
  }

  const result: ExtractedTextItem[] = [];
  const pages = [...byPage.keys()].sort((a, b) => a - b);

  for (const page of pages) {
    // Se ordena primero por Y descendente (arriba -> abajo). Al comparar
    // cada candidato con el PRIMER item de la línea actual (no con el
    // último añadido, que podría ir derivando) el agrupado se mantiene
    // estable aunque una línea tenga muchos items con Y ligeramente
    // distinto entre sí (superíndices, tamaños de fuente mixtos, etc).
    const sortedByY = [...byPage.get(page)!].sort((a, b) => b.y - a.y);

    const lines: ExtractedTextItem[][] = [];
    for (const item of sortedByY) {
      const currentLine = lines[lines.length - 1];
      const anchor = currentLine?.[0];
      if (anchor && Math.abs(anchor.y - item.y) <= yTolerance) {
        currentLine!.push(item);
      } else {
        lines.push([item]);
      }
    }

    for (const line of lines) {
      line.sort((a, b) => a.x - b.x);
      result.push(...line);
    }
  }

  return result;
}

/**
 * Igual que `sortReadingOrder`, pero consciente de columnas (§6 del
 * informe de importación de PDF): si una página tiene un layout de dos
 * columnas reales (un sidebar de contacto/skills y un cuerpo principal,
 * por ejemplo), un simple sort por Y global intercala línea a línea el
 * contenido de ambas columnas — con dos columnas de alturas distintas,
 * eso mezcla texto de secciones completamente distintas.
 *
 * Estrategia (deliberadamente simple, ver §6.2 del informe): se detecta el
 * gutter por página con `detectColumnSplit` y, si existe, cada región se
 * ordena de forma INDEPENDIENTE (arriba->abajo, izquierda->derecha dentro
 * de la región) y las regiones se concatenan de izquierda a derecha. No es
 * un orden de lectura "semánticamente óptimo" (un sidebar puede en teoría
 * ir después del cuerpo, no antes) pero es muchísimo mejor que mezclar
 * ambas columnas por Y global, y es exactamente reversible por el usuario
 * en la pantalla de revisión (cambiar la sección destino de cada bloque).
 * Para páginas de una sola columna (el caso inmensamente mayoritario, y el
 * único cubierto por los tests existentes de este pipeline) el resultado
 * es IDÉNTICO a `sortReadingOrder`, porque `detectColumnSplit` no encuentra
 * gutter y cada página se trata como una única región.
 */
export function sortReadingOrderWithColumns(
  items: ExtractedTextItem[],
  pageWidth: number,
  yTolerance = 2
): ExtractedTextItem[] {
  const byPage = new Map<number, ExtractedTextItem[]>();
  for (const item of items) {
    const list = byPage.get(item.page);
    if (list) list.push(item);
    else byPage.set(item.page, [item]);
  }

  const result: ExtractedTextItem[] = [];
  const pages = [...byPage.keys()].sort((a, b) => a - b);

  for (const page of pages) {
    const pageItems = byPage.get(page)!;
    const regions = splitIntoColumnRegions(pageItems, pageWidth);
    for (const region of regions) {
      result.push(...sortReadingOrder(region.items, yTolerance));
    }
  }

  return result;
}
