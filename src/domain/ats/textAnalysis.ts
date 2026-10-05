/**
 * Lista de palabras vacías (inglés + español) a excluir del análisis de
 * keywords. Deliberadamente basada en reglas fijas, no en ningún modelo de
 * lenguaje (§20 del contexto: "no se debe utilizar IA para esta
 * funcionalidad").
 *
 * IMPORTANTE — bug real corregido aquí: todas las entradas deben ir SIN
 * tilde. `tokenize()` pasa cada palabra por `normalizeToken()`, que le
 * quita los acentos (vía NFD) antes de comparar contra este set — así que
 * una entrada como "más" (con tilde) NUNCA podía coincidir con el token ya
 * normalizado "mas", y se colaba como si fuera una keyword real. Se
 * comprobó exactamente este caso con un test de regresión antes de
 * corregirlo (ver textAnalysis.test.ts).
 *
 * Ampliada además con muchas más palabras vacías reales de las que había
 * (pronombres, determinantes, adverbios de cantidad/tiempo/lugar, formas
 * comunes de ser/estar/haber/tener) — la lista anterior dejaba pasar cosas
 * tan básicas como "no", "si", "tu" o "desde". Por último, un grupo aparte
 * y explícitamente documentado de "ruido genérico de ofertas de empleo":
 * palabras que SÍ son de contenido (no gramaticales) pero que aparecen en
 * prácticamente cualquier anuncio de trabajo sin aportar ninguna señal
 * discriminante sobre el puesto en sí (p.ej. "tareas", "vida", "largo" —
 * de "vida laboral", "largo plazo"...). Es una lista corta y deliberada,
 * no exhaustiva; si en el uso real aparece otra palabra igual de genérica
 * colándose como keyword, se añade aquí.
 */
const STOPWORDS = new Set([
  // inglés — función gramatical
  "the", "and", "for", "with", "that", "this", "these", "those", "from", "have", "has", "had",
  "are", "was", "were", "been", "being", "will", "would", "shall", "should", "may", "might",
  "must", "your", "yours", "you", "of", "in", "on", "to", "a", "an", "is", "it", "its", "as",
  "by", "or", "be", "at", "we", "our", "ours", "not", "but", "can", "could", "all", "any", "into",
  "than", "then", "their", "theirs", "them", "they", "he", "she", "his", "her", "hers", "him",
  "who", "whom", "which", "what", "when", "where", "why", "how", "if", "so", "up", "down", "out",
  "about", "above", "below", "over", "under", "again", "further", "once", "here", "there", "each",
  "few", "more", "most", "other", "some", "such", "no", "nor", "only", "own", "same", "too", "very",
  "just", "do", "does", "did", "doing", "having", "i", "me", "my", "myself", "yourself", "itself",
  "ourselves", "themselves", "am", "us", "one", "also", "etc",
  // español — función gramatical
  "el", "la", "los", "las", "de", "del", "y", "e", "en", "un", "una", "unos", "unas", "que", "con",
  "para", "por", "se", "su", "sus", "es", "al", "lo", "como", "o", "u", "este", "esta", "esto",
  "estos", "estas", "ese", "esa", "eso", "esos", "esas", "aquel", "aquella", "aquello", "mas",
  "sin", "sobre", "entre", "ya", "muy", "tambien", "no", "si", "tu", "tus", "te", "mi", "mis",
  "ella", "ellos", "ellas", "nos", "nosotros", "nosotras", "vosotros", "vosotras", "usted",
  "ustedes", "cual", "cuales", "quien", "quienes", "donde", "cuando", "porque", "pero", "aunque",
  "sino", "tanto", "cada", "otro", "otra", "otros", "otras", "mismo", "misma", "mismos", "mismas",
  "algo", "alguna", "algunas", "alguno", "algunos", "ninguna", "ningunas", "ninguno", "ningunos",
  "nada", "todo", "toda", "todos", "todas", "desde", "hasta", "durante", "mediante", "tras",
  "ante", "bajo", "contra", "hacia", "segun", "dentro", "fuera", "encima", "debajo", "cerca",
  "lejos", "ademas", "incluso", "excepto", "salvo", "menos", "aun", "todavia", "siempre", "nunca",
  "jamas", "quiza", "quizas", "tal", "vez", "solo", "solamente", "asimismo", "asi", "tan", "mucho",
  "mucha", "muchos", "muchas", "poco", "poca", "pocos", "pocas", "bastante", "demasiado", "yo",
  "les", "le", "soy", "eres", "somos", "sois", "son", "era", "eras", "eramos", "eran", "seremos",
  "sera", "seran", "estoy", "estamos", "estan", "estaba", "he", "has", "ha", "hemos",
  "han", "habia", "habian", "tengo", "tiene", "tenemos", "tienen", "tenia", "tenian",
  // español — ruido genérico de ofertas de empleo (contenido, no gramatical,
  // pero sin señal discriminante sobre el puesto — ver comentario arriba)
  "tareas", "funciones", "vida", "largo", "puesto", "oferta", "candidato", "candidata",
  "candidatos", "candidatas", "empresa", "equipo", "ambiente", "entorno",
]);

function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Trocea un texto en tokens. Se permiten `.`, `+`, `#` y `-` como
 * continuación (no como inicio) para no partir términos técnicos
 * habituales en ofertas de trabajo: "Node.js", "C++", "C#", "CI/CD"-like.
 */
export function tokenize(text: string): string[] {
  const matches = text.match(/[\p{L}\p{N}][\p{L}\p{N}+.#-]*/gu) ?? [];
  return matches
    .map((m) => m.replace(/[.-]+$/, "")) // quita puntuación de cierre de frase; conserva '+'/'#' finales (C++, C#)
    .map(normalizeToken)
    .filter((t) => t.length > 1);
}

export interface TermFrequency {
  term: string;
  count: number;
}

/**
 * Cuenta la frecuencia de cada término en un texto, excluyendo palabras
 * vacías por defecto, ordenado de más a menos frecuente.
 */
export function extractKeywordFrequencies(text: string, options: { excludeStopwords?: boolean } = {}): TermFrequency[] {
  const excludeStopwords = options.excludeStopwords ?? true;
  const tokens = tokenize(text).filter((t) => !excludeStopwords || !STOPWORDS.has(t));

  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);

  return [...counts.entries()].map(([term, count]) => ({ term, count })).sort((a, b) => b.count - a.count);
}

export interface KeywordStuffingFlag {
  term: string;
  count: number;
  /** Proporción sobre el total de palabras no vacías, en tanto por ciento (0-100), redondeada a 1 decimal. */
  percentOfWords: number;
}

const STUFFING_MIN_COUNT = 5;
const STUFFING_MIN_RATIO = 0.06; // 6% del total de palabras no vacías

/**
 * Petición: "densidad de keywords sospechosa (keyword stuffing: la misma
 * palabra repetida de forma antinatural)" — estadística simple sobre el
 * conteo de palabras que ya calcula `extractKeywordFrequencies`, sin IA.
 * Un término se marca si aparece muchas veces en términos absolutos
 * (`STUFFING_MIN_COUNT`) Y además supone una proporción alta del texto
 * total (`STUFFING_MIN_RATIO`) — las dos condiciones a la vez evitan
 * falsos positivos tanto en CVs muy cortos (donde una palabra repetida 5
 * veces puede ser un porcentaje alto sin ser sospechoso) como en CVs
 * largos con un término técnico legítimamente repetido unas pocas veces.
 */
export function detectKeywordStuffing(
  text: string,
  options: { minCount?: number; minRatio?: number } = {}
): KeywordStuffingFlag[] {
  const minCount = options.minCount ?? STUFFING_MIN_COUNT;
  const minRatio = options.minRatio ?? STUFFING_MIN_RATIO;

  const frequencies = extractKeywordFrequencies(text);
  const totalWords = frequencies.reduce((sum, f) => sum + f.count, 0);
  if (totalWords === 0) return [];

  return frequencies
    .filter((f) => f.count >= minCount && f.count / totalWords >= minRatio)
    .map((f) => ({ term: f.term, count: f.count, percentOfWords: Math.round((f.count / totalWords) * 1000) / 10 }));
}
