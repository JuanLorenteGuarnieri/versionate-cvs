import type { ExtractedLinkAnnotation, ExtractedPdfDocument, ExtractedTextItem } from "./types.js";
import { extractHeaderItems, splitIntoSections, type RawSectionChunk } from "./segmentation.js";
import { detectHeadingCandidates } from "./sections/sectionScoring.js";
import { buildDraftEntriesFromChunk, type DraftEntry } from "./fieldMapping.js";
import { groupIntoLines } from "./entryGrouping.js";
import { analyzeStyle, type StyleProposal } from "./styleAnalysis.js";
import { sortReadingOrderWithColumns } from "./readingOrder.js";
import { stripRepeatedHeaderFooterLines } from "./classification/headerFooterDetection.js";
import { resolveLinkForLine } from "./fields/linkExtraction.js";

const PERSONAL_INFO_HEADING_TEXT = "Datos de contacto";

/**
 * El bloque de cabecera (nombre, headline, contacto...) casi nunca tiene un
 * heading propio en un CV real — normalmente es simplemente lo primero de
 * la página, antes de "Experience" o lo que sea la primera sección "de
 * verdad" (ver `extractHeaderItems`). Se modela como una DraftSection MÁS
 * (con una única entrada, todo el bloque junto) para que fluya por el
 * mismo pipeline de revisión que cualquier otra sección — sin necesitar
 * ningún caso especial en la pantalla de revisión: `mapEntryToFields` ya
 * sabe tratar una entrada de "personal-information" de forma distinta.
 */
function buildHeaderSection(items: ExtractedTextItem[], links: ExtractedLinkAnnotation[]): DraftEntry[] {
  const lineObjects = groupIntoLines(items);
  if (lineObjects.length === 0) return [];
  const lines = lineObjects.map((l) => l.text);
  const lineLinks = lineObjects.map((l) => resolveLinkForLine(l, links));
  return [{ titleGuess: "", dateRange: null, descriptionGuess: "", rawLines: lines, lineLinks }];
}

/**
 * "Skills" (igual que la cabecera de datos personales) no es una lista de
 * entradas repetidas — es un único conjunto de listas de etiquetas (ver
 * entries/skillsParser.ts). Cuando la cabecera de la sección coincide
 * léxicamente con "skills", todo el chunk se agrupa en UNA sola entrada
 * con todas sus líneas, en vez de trocearlo en entradas por fecha/título
 * como hace el heurístico genérico (que no tiene sentido aquí: una lista
 * de tecnologías no tiene fechas ni títulos).
 */
function buildSkillsChunkEntries(chunk: RawSectionChunk): DraftEntry[] {
  const lines = groupIntoLines(chunk.items).map((l) => l.text);
  if (lines.length === 0) return [];
  return [{ titleGuess: "", dateRange: null, descriptionGuess: "", rawLines: lines }];
}

export interface DraftSection {
  headingText: string;
  /** Clave de sección estándar reconocida, o null si no coincide con ninguna. */
  matchedSectionKey: string | null;
  entries: DraftEntry[];
}

export interface PdfImportDraft {
  sections: DraftSection[];
  styleProposal: StyleProposal;
}

/**
 * Punto de entrada del pipeline de importación de PDF (§19 del contexto):
 * de un documento ya extraído (ver pdfTextExtraction.ts) a un borrador
 * estructurado. NUNCA escribe nada en la base de datos — eso lo hace la UI
 * de revisión, campo por campo, tras la confirmación explícita del usuario.
 */
export function buildImportDraft(doc: ExtractedPdfDocument): PdfImportDraft {
  // 1) Descarta líneas de header/footer repetidas entre páginas (numeración,
  //    nombre de documento repetido...) ANTES de nada más — si no, un texto
  //    así puede acabar clasificado como una entrada más de una sección real.
  const cleanedItems = stripRepeatedHeaderFooterLines(doc.items, doc.pageHeight, doc.numPages);

  // 2) El orden en que pdf.js devuelve los items NO es fiable como orden de
  // lectura (ver readingOrder.ts) — hay que reordenarlos antes de detectar
  // encabezados o trocear en secciones, o el contenido acaba en la sección
  // equivocada. La variante consciente de columnas se degrada exactamente
  // al comportamiento de siempre en cualquier PDF de una sola columna.
  const items = sortReadingOrderWithColumns(cleanedItems, doc.pageWidth);

  // 3) Detección de cabeceras: primero léxica (diccionario ES/EN), y luego
  // ampliada con cualquier otra línea que comparta el estilo tipográfico ya
  // confirmado de esas cabeceras (ver sectionScoring.ts) — captura títulos
  // de sección con redacción no estándar sin arriesgarse a fragmentar
  // falsamente el contenido cuando no hay ninguna referencia de estilo.
  const headings = detectHeadingCandidates(items);
  const chunks = splitIntoSections(items, headings);

  const headerEntries = buildHeaderSection(extractHeaderItems(items, headings), doc.links ?? []);
  const headerSection: DraftSection[] = headerEntries.length
    ? [{ headingText: PERSONAL_INFO_HEADING_TEXT, matchedSectionKey: "personal-information", entries: headerEntries }]
    : [];

  const sections: DraftSection[] = [
    ...headerSection,
    ...chunks.map((chunk) => ({
      headingText: chunk.heading.text,
      matchedSectionKey: chunk.heading.matchedSectionKey,
      entries: chunk.heading.matchedSectionKey === "skills" ? buildSkillsChunkEntries(chunk) : buildDraftEntriesFromChunk(chunk),
    })),
  ];

  return { sections, styleProposal: analyzeStyle(doc) };
}
