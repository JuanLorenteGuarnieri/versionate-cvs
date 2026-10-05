import { tokenize } from "./textAnalysis.js";

/**
 * Detección del idioma de una oferta de trabajo (petición explícita), para
 * poder: 1) fijar el idioma de visualización del CV generado
 * (`CVVersion.displayLanguage`, ver `i18n.ts`), y 2) preferir, al elegir
 * entre variantes existentes de un elemento, las etiquetadas para ese
 * idioma (convención "vES"/"vEN" ya usada en `cv.ts:setCvDisplayLanguage`
 * — ver `jobMatching.ts:filterVariantsByLanguageTag`).
 *
 * Deliberadamente simple y sin IA (§20 del contexto): cuenta cuántos
 * tokens del texto coinciden con un pequeño diccionario de palabras
 * funcionales EXCLUSIVAS de cada idioma (artículos, preposiciones,
 * pronombres muy comunes que NO existen en el otro idioma) y se queda con
 * el que tenga más coincidencias. No falla nunca — si no hay suficiente
 * señal (texto muy corto, o ningún marcador de ninguno de los dos
 * idiomas), devuelve `null` y el llamador decide qué hacer con la
 * ambigüedad (normalmente: no tocar nada).
 */
export type DetectedLanguage = "es" | "en";

const SPANISH_MARKERS = new Set([
  "de", "la", "el", "los", "las", "que", "para", "con", "una", "uno", "del", "por", "se", "su",
  "sus", "es", "un", "como", "mas", "sin", "sobre", "entre", "tambien", "no", "si", "tu", "desde",
  "hasta", "todo", "toda", "todos", "todas", "porque", "pero", "aunque", "cuando", "donde",
  "quien", "cual", "muy", "esta", "este", "estos", "estas", "seran", "seremos", "trabajo",
  "empresa", "experiencia", "conocimientos", "habilidades", "requisitos", "ofrecemos", "buscamos",
  "puesto", "candidato", "candidata", "equipo",
]);

const ENGLISH_MARKERS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "have", "has", "are", "was", "were",
  "will", "your", "you", "of", "in", "on", "to", "is", "it", "as", "by", "or", "be", "at", "we",
  "our", "not", "but", "can", "who", "which", "what", "when", "where", "why", "how", "if", "job",
  "company", "experience", "skills", "requirements", "looking", "team", "role", "candidate",
  "offer", "responsibilities",
]);

/** Con menos de esto no hay evidencia suficiente para decidir con confianza. */
const MIN_TOTAL_MARKERS = 3;

export function detectJobDescriptionLanguage(text: string): DetectedLanguage | null {
  const tokens = tokenize(text);
  let esCount = 0;
  let enCount = 0;
  for (const t of tokens) {
    if (SPANISH_MARKERS.has(t)) esCount++;
    if (ENGLISH_MARKERS.has(t)) enCount++;
  }
  if (esCount + enCount < MIN_TOTAL_MARKERS) return null;
  // En empate, se asume español — convención del resto de la app (comentarios,
  // UI y usuario del proyecto son hispanohablantes; ver también el valor por
  // defecto histórico de "en" para `CVVersion.displayLanguage` cuando NO hay
  // ninguna oferta de por medio, que es un caso distinto a este).
  return esCount >= enCount ? "es" : "en";
}
