/**
 * "Que el analizador ATS encuentre fallos gramaticales" (petición
 * explícita) — con una salvedad importante que hay que decir con
 * franqueza: una comprobación gramatical DE VERDAD (concordancia sujeto-
 * verbo, tiempos verbales, régimen preposicional...) requiere entender la
 * estructura de la frase, y eso es exactamente el tipo de tarea para la
 * que hoy en día se usan modelos de lenguaje — lo cual choca de frente con
 * el requisito explícito del proyecto de que el analizador ATS funcione
 * "completamente local y sin IA generativa" (§20 del contexto). No hay
 * una forma razonable de tener ambas cosas a la vez.
 *
 * Lo que SÍ se puede hacer con reglas fijas, y es lo que hace este módulo,
 * es detectar errores TIPOGRÁFICOS/de formato — el tipo de fallo que de
 * verdad aparece al copiar y pegar contenido entre documentos, y que
 * además es precisamente el tipo de cosa que puede confundir a un parser
 * ATS real (dos espacios pueden partir mal una keyword, una palabra
 * duplicada por un copia-pega mal hecho, puntuación pegada a la palabra
 * siguiente...). Se llama a esto "comprobaciones ortotipográficas" en vez
 * de "gramática" a propósito, para no prometer más de lo que hace.
 */

export type ProofreadingIssueType =
  | "double_space"
  | "repeated_word"
  | "missing_space_after_punctuation"
  | "excessive_punctuation"
  | "space_before_punctuation";

export interface ProofreadingIssue {
  type: ProofreadingIssueType;
  /** Fragmento de texto donde aparece, para poder localizarlo. */
  snippet: string;
  /** Explicación legible del problema. */
  message: string;
}

const MAX_ISSUES_PER_TYPE = 8;
const SNIPPET_CONTEXT_CHARS = 20;

function snippetAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - SNIPPET_CONTEXT_CHARS);
  const end = Math.min(text.length, index + length + SNIPPET_CONTEXT_CHARS);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
}

function collectMatches(
  text: string,
  pattern: RegExp,
  type: ProofreadingIssueType,
  message: (match: RegExpMatchArray) => string
): ProofreadingIssue[] {
  const issues: ProofreadingIssue[] = [];
  for (const match of text.matchAll(pattern)) {
    if (issues.length >= MAX_ISSUES_PER_TYPE) break;
    issues.push({ type, snippet: snippetAround(text, match.index ?? 0, match[0].length), message: message(match) });
  }
  return issues;
}

/**
 * Analiza el texto plano de un CV (ver `ats/cvText.ts:extractCvPlainText`)
 * en busca de errores tipográficos/de formato comunes. Cada tipo de
 * comprobación se limita a `MAX_ISSUES_PER_TYPE` apariciones — con un CV
 * muy descuidado, una lista interminable de "dos espacios aquí, dos
 * espacios allá" no ayuda más que las primeras ocho, y satura la pantalla.
 */
export function findProofreadingIssues(text: string): ProofreadingIssue[] {
  const issues: ProofreadingIssue[] = [];

  issues.push(...collectMatches(text, / {2,}/g, "double_space", () => "Dos o más espacios seguidos."));

  issues.push(
    ...collectMatches(text, /\b(\p{L}+)\s+\1\b/giu, "repeated_word", (m) => `La palabra "${m[1]}" aparece dos veces seguidas.`)
  );

  issues.push(
    ...collectMatches(
      text,
      /[,;:!?][\p{L}]/gu,
      "missing_space_after_punctuation",
      (m) => `Falta un espacio después de "${m[0][0]}".`
    )
  );

  issues.push(
    ...collectMatches(
      text,
      /[!?]{2,}|\.{4,}/g,
      "excessive_punctuation",
      (m) => `Puntuación repetida ("${m[0]}") — informal para un CV.`
    )
  );

  issues.push(
    ...collectMatches(
      text,
      / [,.;:!?]/g,
      "space_before_punctuation",
      (m) => `Espacio antes de "${m[0].trim()}" — probablemente un resto de copiar y pegar.`
    )
  );

  return issues;
}
