import type { ExtractedTextItem } from "./types.js";
import type { RawSectionChunk } from "./segmentation.js";
import { median } from "./styleAnalysis.js";
import { findDateRange } from "./dateParsing.js";

export interface Line {
  text: string;
  y: number;
  items: ExtractedTextItem[];
}

/**
 * Agrupa items de texto en líneas visuales: items cuya `y` difiere menos de
 * `yTolerance` puntos se consideran parte de la misma línea. Asume que
 * pdf.js ya los devuelve en orden de lectura (cierto para la inmensa
 * mayoría de CVs a una columna; layouts multi-columna pueden confundir
 * esto — limitación aceptada, ver README).
 */
export function groupIntoLines(items: ExtractedTextItem[], yTolerance = 2): Line[] {
  const lines: Line[] = [];
  for (const item of items) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - item.y) <= yTolerance) {
      last.items.push(item);
      last.text = joinLineText(last.items);
    } else {
      lines.push({ text: item.text, y: item.y, items: [item] });
    }
  }
  return lines;
}

/**
 * Limpieza puntual de un artefacto de unión: cuando pdf.js parte un
 * glifo sin ToUnicode en varios items (ver glyphFixups.ts — p.ej. "C++"
 * llega como 3 items sueltos: "C", y dos glifos que se traducen a "+"), el
 * join con espacio de más arriba deja "C + +" en vez de "C++". No hay
 * forma de saber el espaciado real sin el ancho de cada glifo (pdf.js no
 * lo da), así que esto es una limpieza específica y acotada del patrón
 * "+" duplicado, no un rejoin general basado en posición — eso sería un
 * cambio bastante más arriesgado que podría afectar a la detección de
 * "Etiqueta: valor" y otros heurísticos que asumen el espaciado actual.
 */
function joinLineText(items: ExtractedTextItem[]): string {
  const joined = items.map((i) => i.text).join(" ");
  return joined.replace(/\+\s+\+/g, "++").replace(/([A-Za-z])\s+\+\+/g, "$1++");
}

export interface LineGroup {
  lines: Line[];
}

/**
 * "Etiqueta: valor" al principio de una línea ("Level : N5", "Location :
 * Zaragoza", "Email: foo@bar.com") — típico patrón de una línea que
 * AMPLÍA la anterior, no que empieza una entrada nueva. Exige uno o más
 * espacios después de los ":" para no confundir con "https://..." (ahí no
 * hay espacio tras los dos puntos).
 */
const LABEL_CONTINUATION_RE = /^\p{L}[\p{L}\s]{0,20}:\s+\S/u;

/** Bastante corta como para ser un ítem suelto de una lista (un skill, un
 * idioma...), no una línea de párrafo envuelta. */
const SIMPLE_LIST_MAX_LINE_LENGTH = 40;

function isLabelContinuation(line: Line): boolean {
  return LABEL_CONTINUATION_RE.test(line.text.trim());
}

/**
 * Detecta el caso de una lista simple de un ítem por línea (p.ej.
 * "Python" / "MATLAB" / "C++" en Programming languages, cada uno en su
 * propia línea sin ningún hueco extra respecto al interlineado normal).
 *
 * Bug real: el heurístico de huecos de abajo asume que una entrada nueva
 * viene precedida de un hueco vertical NOTABLEMENTE mayor que el habitual
 * — pero en una lista de un ítem por línea, el espacio entre ítems es
 * exactamente el interlineado normal (el mismo que hay entre dos líneas
 * de un párrafo envuelto), así que no hay ninguna señal geométrica que
 * distinga "entrada nueva" de "misma entrada": con huecos todos iguales,
 * nunca se supera el umbral y todo el bloque se quedaba pegado en una
 * única entrada, perdiendo todos los ítems salvo el primero al mapear los
 * campos (ver mapDraftEntryToFields, que solo coge la primera línea como
 * título). La longitud de línea sí es una señal razonable en su lugar: un
 * párrafo envuelto tiene líneas largas (ocupan casi todo el ancho de
 * página); una lista de ítems sueltos, no. Se exige además que ninguna
 * línea sea una continuación tipo "Etiqueta: valor" (eso indicaría una
 * entrada con sub-campos, como "Japonés" + "Nivel: N5", no una lista de
 * ítems independientes) ni contenga una fecha (eso indicaría Experience/
 * Education, no una lista simple).
 */
function looksLikeSimpleList(lines: Line[]): boolean {
  return (
    // Al menos 3 líneas: una lista real de ítems sueltos (skills, idiomas,
    // herramientas...) casi siempre tiene varios; exigir 3 en vez de 2
    // evita que esto se dispare con el patrón, mucho más común, de una
    // entrada normal de 2 líneas cortas (p.ej. "Freelance work" +
    // "Various small projects.").
    lines.length >= 3 &&
    lines.every((l) => {
      const text = l.text.trim();
      return text.length > 0 && text.length <= SIMPLE_LIST_MAX_LINE_LENGTH && !isLabelContinuation(l);
    }) &&
    !lines.some((l) => findDateRange(l.text))
  );
}

/**
 * Agrupa líneas consecutivas en "entradas" (una experiencia, un proyecto...)
 * detectando huecos verticales notablemente mayores que el habitual entre
 * líneas normales — el espacio extra que suele haber entre una entrada y
 * la siguiente en un CV. Antes de eso, comprueba el caso de lista simple de
 * arriba (donde ese criterio de huecos no sirve de nada) y nunca deja que
 * una línea de continuación tipo "Etiqueta: valor" abra una entrada nueva,
 * aunque el hueco justo antes de ella sea grande.
 */
export function groupLinesIntoEntries(lines: Line[]): LineGroup[] {
  if (lines.length === 0) return [];

  if (looksLikeSimpleList(lines)) {
    return lines.map((line) => ({ lines: [line] }));
  }

  const gaps: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i - 1]!.y - lines[i]!.y; // y decrece hacia abajo en coordenadas PDF
    if (gap > 0) gaps.push(gap);
  }
  const typicalGap = median(gaps);
  const threshold = typicalGap > 0 ? typicalGap * 1.6 : Infinity;

  const groups: LineGroup[] = [{ lines: [lines[0]!] }];
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i - 1]!.y - lines[i]!.y;
    if (gap > threshold && !isLabelContinuation(lines[i]!)) {
      groups.push({ lines: [] });
    }
    groups[groups.length - 1]!.lines.push(lines[i]!);
  }
  return groups;
}

/** Atajo: de los items en bruto de una sección directamente a sus grupos de líneas. */
export function groupChunkIntoEntries(chunk: RawSectionChunk): LineGroup[] {
  return groupLinesIntoEntries(groupIntoLines(chunk.items));
}
