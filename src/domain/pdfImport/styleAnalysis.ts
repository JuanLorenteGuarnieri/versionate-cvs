import type { ExtractedPdfDocument } from "./types.js";

const PT_TO_MM = 0.352778; // 1 punto PDF = 1/72 in = 0.352778 mm

export interface StyleProposal {
  baseFontSize: number;
  headingScale: number;
  margins: { top: number; right: number; bottom: number; left: number };
}

export function median(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/**
 * Percentil (0-1) de una lista de números, por interpolación al índice más
 * cercano. Con pocos items se comporta como min/max (p.ej. `p=0.05` con 5
 * items devuelve directamente el mínimo); con muchos, ignora un puñado de
 * outliers en el extremo en vez de que un solo item aislado (una nota al
 * pie, un glifo mal posicionado) descuadre la estimación.
 */
function percentile(numbers: number[], p: number): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[index]!;
}

const MARGIN_PERCENTILE = 0.02;
// Estimación aproximada del ancho medio de un carácter en un font
// proporcional, como fracción del tamaño de fuente — no tenemos el ancho
// real de cada glifo (pdf.js no lo expone vía getTextContent), así que esto
// es deliberadamente una aproximación para el margen derecho.
const AVG_CHAR_WIDTH_EM = 0.5;

/**
 * Propone parámetros visuales de template a partir de todo el texto
 * extraído del PDF (§19 del contexto: "el sistema puede utilizar estos
 * datos para generar una propuesta de template similar al PDF original").
 * Es una aproximación deliberada: no intenta detectar colores (pdf.js no
 * los expone de forma sencilla vía getTextContent) ni la familia de fuente
 * exacta (el nombre interno de pdf.js, p. ej. "g_d0_f1", no es un nombre de
 * fuente utilizable en CSS) — ver README para el detalle de esta limitación.
 */
export function analyzeStyle(doc: ExtractedPdfDocument): StyleProposal {
  if (doc.items.length === 0) {
    return { baseFontSize: 10.5, headingScale: 1.15, margins: { top: 24, right: 24, bottom: 24, left: 24 } };
  }

  // Tamaño de cuerpo = el más frecuente entre los tamaños "no grandes"
  // (por debajo del percentil 80), para no dejar que unos pocos títulos
  // en tamaño grande contaminen la estimación del texto normal.
  const sizes = doc.items.map((i) => Math.round(i.fontSize * 2) / 2); // redondeado a 0.5pt
  const sortedSizes = [...sizes].sort((a, b) => a - b);
  const p80 = sortedSizes[Math.floor(sortedSizes.length * 0.8)] ?? sortedSizes[sortedSizes.length - 1]!;
  const bodySizes = sizes.filter((s) => s <= p80);
  const bodyCounts = new Map<number, number>();
  for (const s of bodySizes.length > 0 ? bodySizes : sizes) bodyCounts.set(s, (bodyCounts.get(s) ?? 0) + 1);
  let baseFontSize = sizes[0]!;
  let bestCount = -1;
  for (const [size, count] of bodyCounts) {
    if (count > bestCount) {
      baseFontSize = size;
      bestCount = count;
    }
  }

  // Tamaño de "título de sección" = el más FRECUENTE entre los tamaños
  // mayores que el cuerpo, no el mayor de todos. El nombre del CV suele
  // pintarse en un tamaño mucho más grande que los títulos de sección, pero
  // aparece una sola vez; los títulos de sección (Experience, Education...)
  // se repiten varias veces al mismo tamaño. Usar directamente el tamaño
  // más grande del documento (como se hacía antes) dejaba que ese único
  // nombre "contaminara" headingScale, generando títulos de sección
  // desproporcionadamente grandes en la template propuesta.
  const largerSizes = sizes.filter((s) => s > baseFontSize);
  let headingSize = baseFontSize;
  if (largerSizes.length > 0) {
    const largerCounts = new Map<number, number>();
    for (const s of largerSizes) largerCounts.set(s, (largerCounts.get(s) ?? 0) + 1);
    let bestHeadingCount = -1;
    for (const [size, count] of largerCounts) {
      // en empate, preferimos el tamaño más pequeño: más probable que sea
      // un estilo de título repetido que un único énfasis puntual mayor.
      if (count > bestHeadingCount || (count === bestHeadingCount && size < headingSize)) {
        headingSize = size;
        bestHeadingCount = count;
      }
    }
  }
  const headingScale = baseFontSize > 0 ? Math.max(1, Math.min(2, headingSize / baseFontSize)) : 1.15;

  // Márgenes = distancia entre el texto más extremo y el borde de la
  // página, en cada lado — es decir, un percentil bajo/alto de la posición
  // de los items (el texto más pegado a ese borde), NO la mediana: la
  // mediana representa la posición "típica" del texto (dominada por el
  // cuerpo del documento, muy metido hacia el centro de la página), que
  // sistemáticamente sobreestima el margen real. Se usa un percentil en vez
  // del mínimo/máximo absoluto para no dejar que un único item descolocado
  // (un número de página suelto, una nota al pie) arruine la estimación.
  //
  // El ancho REAL de cada item (`TextItem.width` de pdf.js) ya se captura
  // en pdfTextExtraction.ts — se usa cuando está disponible; si no (p.ej.
  // fixtures de test que no lo rellenan), se cae de vuelta a la estimación
  // por longitud de texto y tamaño de fuente de siempre.
  const left = percentile(
    doc.items.map((i) => i.x),
    MARGIN_PERCENTILE
  );
  const right = percentile(
    doc.items.map((i) => doc.pageWidth - (i.x + (i.width ?? i.text.length * i.fontSize * AVG_CHAR_WIDTH_EM))),
    MARGIN_PERCENTILE
  );
  const top = percentile(
    doc.items.map((i) => doc.pageHeight - i.y),
    MARGIN_PERCENTILE
  );
  const bottom = percentile(
    doc.items.map((i) => i.y),
    MARGIN_PERCENTILE
  );

  return {
    baseFontSize,
    headingScale: Math.round(headingScale * 100) / 100,
    margins: {
      top: Math.max(5, Math.round(top * PT_TO_MM)),
      right: Math.max(5, Math.round(right * PT_TO_MM)),
      bottom: Math.max(5, Math.round(bottom * PT_TO_MM)),
      left: Math.max(5, Math.round(left * PT_TO_MM)),
    },
  };
}
