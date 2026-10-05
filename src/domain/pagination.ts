const CSS_PX_PER_MM = 96 / 25.4;

/** Conversión mm -> px CSS. Es una constante fija de la especificación CSS
 * (1in = 96px = 25.4mm), no depende del DPI real del dispositivo. */
export function mmToPx(mm: number): number {
  return mm * CSS_PX_PER_MM;
}

export type PaginationBlockKind = "section-title" | "item";

export interface PaginationBlock {
  id: string;
  kind: PaginationBlockKind;
  sectionId: string;
  height: number;
}

/**
 * Agrupa una lista plana de bloques ya medidos (altura real en px) en
 * páginas de una altura fija, sin partir ningún bloque, y evitando dejar un
 * título de sección solo al final de una página sin que le siga su primer
 * item (título huérfano, §18 del contexto: "evitar títulos aislados al
 * final de una página").
 *
 * Es pura geometría: no sabe nada de CVs, templates, ni React. Recibe
 * alturas ya calculadas (ver previewBlocks.ts para cómo se obtienen) y
 * devuelve solo el agrupamiento — quien la use decide cómo renderizar cada
 * grupo como una página real.
 */
export function paginate(blocks: PaginationBlock[], pageHeight: number): PaginationBlock[][] {
  if (blocks.length === 0) return [];

  const pages: PaginationBlock[][] = [[]];
  let currentHeight = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const next = i + 1 < blocks.length ? blocks[i + 1]! : null;
    const currentPage = pages[pages.length - 1]!;

    let requiredHeight = block.height;
    if (block.kind === "section-title" && next && next.sectionId === block.sectionId) {
      // No basta con que quepa el título: tiene que caber también su
      // primer item, o el título se va entero a la página siguiente.
      requiredHeight += next.height;
    }

    // Solo forzamos salto de página si la página actual YA tiene contenido:
    // una página vacía siempre recibe al menos el bloque actual, aunque no
    // quepa entero (evita un bucle infinito con un bloque más alto que una
    // página completa).
    if (currentPage.length > 0 && currentHeight + requiredHeight > pageHeight) {
      pages.push([]);
      currentHeight = 0;
    }

    pages[pages.length - 1]!.push(block);
    currentHeight += block.height;
  }

  return pages;
}
