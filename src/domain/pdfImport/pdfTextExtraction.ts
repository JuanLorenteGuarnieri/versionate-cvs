import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ExtractedLinkAnnotation, ExtractedPdfDocument, ExtractedTextItem } from "./types.js";
import { fixKnownGlyphSubstitutions } from "./glyphFixups.js";

/**
 * Heurística best-effort de negrita/cursiva a partir del nombre interno de
 * la fuente embebida. pdf.js no expone el peso/estilo real de forma
 * estructurada vía `getTextContent()` (habría que inspeccionar los
 * recursos de fuente del PDF u operadores de render), pero la mayoría de
 * generadores (LaTeX, Word, Google Docs, Canva...) incrustan la fuente con
 * un nombre PostScript que SÍ lleva "Bold"/"Italic"/"Oblique" en el nombre
 * — suficiente señal para distinguir títulos de sección de cuerpo sin
 * necesitar renderizar la página.
 */
function inferFontStyle(fontName: string): { bold: boolean; italic: boolean } {
  const name = fontName.toLowerCase();
  return {
    bold: /bold|black|heavy|semibold/.test(name),
    italic: /italic|oblique/.test(name),
  };
}

/**
 * Extrae todo el texto de un PDF (bytes crudos) con su posición y tamaño de
 * fuente aproximado, usando pdfjs-dist. Es el ÚNICO fichero del dominio que
 * importa pdfjs-dist directamente — todo lo demás en pdfImport/ trabaja
 * sobre `ExtractedPdfDocument`, sin saber que existe pdf.js.
 *
 * El tamaño de fuente se deriva de la matriz de transformación del texto
 * (`Math.hypot(transform[2], transform[3])`), el mismo truco que usan otras
 * herramientas basadas en pdf.js: para texto sin rotación/inclinación esto
 * es simplemente el tamaño en puntos; con texto rotado sigue dando una
 * aproximación razonable.
 */

/**
 * Configura de dónde carga pdf.js su worker. En Node (los tests de este
 * fichero) no hace falta llamarla — pdf.js no lo exige fuera de un
 * navegador. En el navegador SÍ es obligatorio (lo confirmamos porque
 * falló en la práctica: "No GlobalWorkerOptions.workerSrc specified"), así
 * que la UI debe llamar a esto una vez al arrancar, ANTES de usar
 * `extractPdfText` — ver src/app/ui/components/PdfImportScreen.tsx.
 *
 * Se define aquí como un simple setter, en vez de importar el asset del
 * worker directamente en este fichero, a propósito: este módulo vive en
 * src/domain/ y debe seguir siendo agnóstico de bundler (no debe conocer
 * la convención `?url` de Vite). Esa importación específica de Vite vive
 * en la capa de UI, donde corresponde.
 */
export function setPdfWorkerSrc(url: string): void {
  pdfjsLib.GlobalWorkerOptions.workerSrc = url;
}

export async function extractPdfText(data: Uint8Array): Promise<ExtractedPdfDocument> {
  const loadingTask = pdfjsLib.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });
  const doc = await loadingTask.promise;

  const items: ExtractedTextItem[] = [];
  const links: ExtractedLinkAnnotation[] = [];
  let pageWidth = 0;
  let pageHeight = 0;

  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      pageWidth = viewport.width;
      pageHeight = viewport.height;

      const textContent = await page.getTextContent();
      for (const raw of textContent.items) {
        // pdf.js devuelve TextItem | TextMarkedContent; solo el primero tiene "str".
        if (!("str" in raw)) continue;
        const text = fixKnownGlyphSubstitutions(raw.str.trim());
        if (!text) continue;

        const transform = raw.transform as number[];
        const fontSize = Math.hypot(transform[2] ?? 0, transform[3] ?? 0);
        const fontName = raw.fontName ?? "unknown";
        const { bold, italic } = inferFontStyle(fontName);

        items.push({
          text,
          x: transform[4] ?? 0,
          y: transform[5] ?? 0,
          fontSize,
          fontName,
          page: pageNumber,
          width: typeof raw.width === "number" ? raw.width : undefined,
          bold,
          italic,
        });
      }

      // Anotaciones de tipo enlace (§10.2 del informe de importación): la
      // mejor fuente para una URL no es adivinar por la forma del texto
      // visible ("Node.js" parece casi una URL sin serlo) sino la propia
      // anotación de enlace del PDF, cuando existe. `getAnnotations()`
      // devuelve TODAS las anotaciones de la página; solo nos interesan
      // las de subtipo "Link" que además tengan una URL externa (`url`) —
      // los enlaces internos (`dest`, saltos a otra página del mismo PDF)
      // no aportan nada para un CV y se ignoran.
      const annotations = await page.getAnnotations();
      for (const annotation of annotations) {
        if (annotation.subtype !== "Link") continue;
        const url = typeof annotation.url === "string" ? annotation.url : undefined;
        if (!url) continue;
        const rect = annotation.rect as number[] | undefined;
        if (!rect || rect.length < 4) continue;
        links.push({
          url,
          page: pageNumber,
          rect: [rect[0]!, rect[1]!, rect[2]!, rect[3]!],
        });
      }
    }
  } finally {
    await doc.destroy();
  }

  return { pageWidth, pageHeight, numPages: doc.numPages, items, links };
}
