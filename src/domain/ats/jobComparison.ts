import { extractKeywordFrequencies, tokenize, type TermFrequency } from "./textAnalysis.js";
import { isTechKeyword, TECH_KEYWORD_WEIGHT_MULTIPLIER } from "./techDictionary.js";

export interface JobComparisonResult {
  /** Las keywords más frecuentes de la oferta (top N), de más a menos frecuente. */
  jobKeywords: TermFrequency[];
  /** Subconjunto de jobKeywords que sí aparece en el texto del CV. */
  presentInCv: TermFrequency[];
  /** Subconjunto de jobKeywords que NO aparece en el texto del CV. */
  missingFromCv: TermFrequency[];
  /**
   * Puntuación global de correspondencia, 0-100: qué proporción del PESO
   * de las keywords de la oferta está cubierta por el CV. El peso de cada
   * keyword es su frecuencia de mención, multiplicada por
   * `TECH_KEYWORD_WEIGHT_MULTIPLIER` si además es una tecnología/
   * herramienta reconocida (petición explícita del usuario: dar más
   * importancia a las keywords técnicas concretas de la oferta frente a
   * palabras genéricas del anuncio) — ver `techDictionary.ts`. Sigue
   * siendo puro cociente de frecuencias ponderadas, sin IA — 0 si la
   * oferta no tiene ninguna keyword reconocible.
   */
  matchScore: number;
}

function weightOf(k: TermFrequency): number {
  return k.count * (isTechKeyword(k.term) ? TECH_KEYWORD_WEIGHT_MULTIPLIER : 1);
}

/**
 * Compara el texto ya resuelto de un CV con el texto de una oferta de
 * trabajo pegada manualmente (§20 del contexto). Puro conteo de
 * frecuencias sobre texto normalizado — sin IA, sin llamadas externas.
 */
export function compareWithJobDescription(cvText: string, jobDescriptionText: string, topN = 30): JobComparisonResult {
  const jobKeywords = extractKeywordFrequencies(jobDescriptionText).slice(0, topN);
  const cvTokens = new Set(tokenize(cvText));

  const presentInCv = jobKeywords.filter((k) => cvTokens.has(k.term));
  const missingFromCv = jobKeywords.filter((k) => !cvTokens.has(k.term));

  const totalMentions = jobKeywords.reduce((sum, k) => sum + weightOf(k), 0);
  const presentMentions = presentInCv.reduce((sum, k) => sum + weightOf(k), 0);
  const matchScore = totalMentions === 0 ? 0 : Math.round((presentMentions / totalMentions) * 100);

  return { jobKeywords, presentInCv, missingFromCv, matchScore };
}
