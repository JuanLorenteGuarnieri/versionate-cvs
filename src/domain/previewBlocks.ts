import type { ResolvedItem, ResolvedSection } from "./resolveCV.js";

export type PreviewBlock =
  | { id: string; kind: "section-title"; sectionId: string; title: string }
  | { id: string; kind: "item"; sectionId: string; item: ResolvedItem }
  | {
      id: string;
      /** Fila de N columnas, una por idioma (petición explícita del
       * usuario: "si hay x idiomas que haya x columnas, centradas") — se
       * trata como un único bloque atómico de cara a la paginación (no se
       * parte entre items), igual que un "item" normal. Solo se genera
       * para la sección "languages" (detectada por `key`, no por id, para
       * que siga funcionando igual si el usuario duplica/renombra la
       * sección). */
      kind: "language-row";
      sectionId: string;
      items: ResolvedItem[];
    };

/**
 * Convierte las secciones ya resueltas y visibles (getVisibleSections) en
 * una lista plana de bloques, en el orden en que deben imprimirse. Es la
 * unidad mínima que mide/pagina la preview (ver pagination.ts).
 */
export function flattenSectionsToBlocks(sections: ResolvedSection[]): PreviewBlock[] {
  const blocks: PreviewBlock[] = [];
  for (const section of sections) {
    blocks.push({
      id: `title:${section.sectionDefinitionId}`,
      kind: "section-title",
      sectionId: section.sectionDefinitionId,
      title: section.title,
    });
    if (section.key === "languages") {
      // Todos los idiomas de la sección van en UNA sola fila de columnas,
      // no uno por item como el resto de secciones (ver PreviewBlock).
      blocks.push({
        id: `language-row:${section.sectionDefinitionId}`,
        kind: "language-row",
        sectionId: section.sectionDefinitionId,
        items: section.items,
      });
      continue;
    }
    for (const item of section.items) {
      blocks.push({
        id: `item:${item.elementId}:${item.variantId}`,
        kind: "item",
        sectionId: section.sectionDefinitionId,
        item,
      });
    }
  }
  return blocks;
}

/**
 * Calcula cuánto espacio debe ir DESPUÉS de cada bloque, dado en `blocks`.
 * Se usa como `padding-bottom` (no `margin-bottom`/`gap`) tanto al medir
 * como al renderizar, a propósito: los márgenes verticales entre hermanos
 * colapsan en CSS de formas poco predecibles, lo que haría la medición
 * (offsetTop) inconsistente con lo que realmente se ve. padding nunca
 * colapsa, así que lo medido es siempre exactamente lo mostrado.
 *
 * Reglas: espacio entre items de la misma sección = itemGap; espacio tras
 * el último item de una sección (antes del siguiente título) = sectionGap;
 * nada tras un título (el hueco título->primer item ya lo da el propio
 * título); nada tras el último bloque de todos.
 */
export function computeBlockSpacing(blocks: PreviewBlock[], itemGap: number, sectionGap: number): number[] {
  return blocks.map((block, i) => {
    const next = blocks[i + 1];
    if (!next) return 0;
    if (block.kind === "section-title") return 0;
    // block.kind === "item"
    return next.sectionId === block.sectionId ? itemGap : sectionGap;
  });
}
