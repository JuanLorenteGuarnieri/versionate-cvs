import type { ExtractedTextItem } from "./types.js";
import { SECTION_KEYWORDS } from "./sections/sectionLexicon.js";

export { SECTION_KEYWORDS };

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[:.]+$/, "") // quita ":"/"." final, común en cabeceras
    .trim();
}

export interface DetectedHeading {
  text: string;
  /** Índice del item dentro de `items[]` que contiene la cabecera. */
  itemIndex: number;
  /** Clave de sección estándar reconocida, o null si no coincide con ninguna. */
  matchedSectionKey: string | null;
}

/**
 * Busca, entre todos los items de texto, cuáles parecen ser cabeceras de
 * sección: el texto (normalizado) coincide con alguna palabra clave
 * conocida. No se basa en el tamaño de fuente a propósito — muchos CVs
 * marcan las secciones con mayúsculas o negrita en vez de un tamaño mayor,
 * y el propio texto reconocible es una señal más fiable que la tipografía.
 */
export function detectHeadings(items: ExtractedTextItem[]): DetectedHeading[] {
  const headings: DetectedHeading[] = [];

  items.forEach((item, index) => {
    const normalized = normalize(item.text);
    if (!normalized) return;

    for (const [key, keywords] of Object.entries(SECTION_KEYWORDS)) {
      if (keywords.some((kw) => normalized === kw || normalized.startsWith(`${kw} `))) {
        headings.push({ text: item.text, itemIndex: index, matchedSectionKey: key });
        return;
      }
    }
  });

  return headings;
}

export interface RawSectionChunk {
  heading: DetectedHeading;
  /** Los items entre esta cabecera (exclusive) y la siguiente (exclusive). */
  items: ExtractedTextItem[];
}

/**
 * Trocea la lista completa de items en un chunk por cada cabecera
 * detectada. El texto ANTES de la primera cabecera detectada NO se incluye
 * aquí (normalmente es el nombre/contacto de la cabecera del CV) — se trata
 * aparte con `extractHeaderItems`, más abajo.
 */
export function splitIntoSections(items: ExtractedTextItem[], headings: DetectedHeading[]): RawSectionChunk[] {
  return headings.map((heading, i) => {
    const start = heading.itemIndex + 1;
    const end = i + 1 < headings.length ? headings[i + 1]!.itemIndex : items.length;
    return { heading, items: items.slice(start, end) };
  });
}

/**
 * Devuelve los items ANTES de la primera cabecera detectada: el bloque de
 * cabecera del CV (nombre, rol/headline, email, teléfono, ubicación,
 * links...), que casi nunca va bajo un heading propio ("Contact" o
 * similar) en un CV real — normalmente es simplemente lo primero que hay en
 * la página. Antes este texto se descartaba sin más (ver bug real: la
 * importación de PDF nunca rescataba los datos personales salvo que el PDF
 * tuviera literalmente una sección "Contact"), perdiendo silenciosamente
 * toda esa información.
 *
 * Si no se detectó ninguna cabecera en todo el documento, devuelve `[]` en
 * vez de asumir que TODO el texto es la cabecera — un documento sin ningún
 * heading reconocible ya se trata como "sin secciones" más arriba en el
 * pipeline (ver buildDraft.ts), y tratar todo su contenido como datos
 * personales daría un resultado sin sentido.
 */
export function extractHeaderItems(items: ExtractedTextItem[], headings: DetectedHeading[]): ExtractedTextItem[] {
  if (headings.length === 0) return [];
  return items.slice(0, headings[0]!.itemIndex);
}
