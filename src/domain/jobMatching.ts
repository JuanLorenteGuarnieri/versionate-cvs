import type { AppDatabase, Element, FieldType, FieldValue, SectionDefinition, Variant } from "./model/types.js";
import { extractKeywordFrequencies, tokenize } from "./ats/textAnalysis.js";
import { extractItemLayoutPlainText, extractCvPlainText } from "./ats/cvText.js";
import { isTechKeyword, TECH_KEYWORD_WEIGHT_MULTIPLIER } from "./ats/techDictionary.js";
import { isEducationKeyword } from "./ats/educationDictionary.js";
import { detectJobDescriptionLanguage, type DetectedLanguage } from "./ats/languageDetection.js";
import { buildItemLayout } from "./preview.js";
import { guessElementLabel } from "./labels.js";

/**
 * "Generar un CV a partir de una oferta de trabajo" (petición explícita):
 * comparar la oferta con la base de datos y elegir automáticamente qué
 * elementos/variantes/secciones incluir para maximizar la correspondencia,
 * SIN crear ninguna variante ni versión nueva de nada — solo eligiendo,
 * entre lo que YA existe, la variante de cada elemento que mejor encaje.
 *
 * Mismo principio que el resto del analizador ATS (§20 del contexto): puro
 * conteo de frecuencias sobre texto normalizado, sin IA ni llamadas
 * externas.
 */

/**
 * Secciones que no tiene sentido "seleccionar por relevancia": son
 * información de identidad/resumen general del candidato, no contenido
 * específico de un puesto — se incluyen siempre enteras (con la variante
 * por defecto de cada uno de sus elementos), igual que si el usuario las
 * hubiera añadido a mano. La inmensa mayoría de bases de datos tienen como
 * mucho un elemento en cada una de estas secciones.
 *
 * "languages" (idiomas hablados, no de programación) se incluye aquí por
 * petición explícita del usuario: casi ningún puesto especifica idiomas
 * como keyword de la oferta (así que casi nunca puntuarían lo bastante
 * para entrar solos), pero es información que casi siempre interesa
 * mostrar en cualquier CV, sea cual sea el puesto.
 */
const ALWAYS_INCLUDE_SECTION_KEYS = new Set(["personal-information", "profile", "skills", "languages"]);

/** Valores por defecto, ajustables por llamada (ver `MatchOptions`) — la
 * pantalla de revisión los expone como "opciones avanzadas". */
const DEFAULT_MAX_ITEMS_PER_CONTENT_SECTION = 6;
const DEFAULT_MIN_SCORE_TO_INCLUDE = 1;

/** Cuántas keywords distintas de la oferta se usan como referencia como
 * mucho — ver la sección "Precisión del matching" del estudio: sin este
 * límite, ofertas largas puntúan también contra secciones de
 * beneficios/legal/RSC que no aportan ninguna señal real sobre el puesto,
 * simplemente porque son largas y repiten ciertas palabras. Mismo orden de
 * magnitud que `ats/jobComparison.ts` (30), un poco más generoso porque
 * aquí también hace falta cubrir vocabulario técnico disperso. */
const DEFAULT_TOP_N_KEYWORDS = 40;

/**
 * Usado por las puntuaciones basadas en CLASIFICACIÓN por diccionario
 * (Educación/Tecnologías, ver `computeKeywordClassCoverageScore`) en vez
 * de `DEFAULT_TOP_N_KEYWORDS` — bug real encontrado y corregido: si se
 * aplica el recorte al top-40 general ANTES de filtrar por categoría, con
 * una oferta larga (mucho relleno típico: "sobre nosotros", beneficios,
 * proceso de selección...) términos genuinamente relevantes como "Máster"
 * o "Universidad" quedaban fuera del top-40 —aplastados por palabras
 * genéricas mencionadas con más frecuencia— y la categoría entera salía
 * en 0% aunque la oferta sí los mencionara. El diccionario de cada
 * categoría YA es un filtro fuerte por sí solo (dejar el 100% de sus
 * apariciones, no las 40 más frecuentes de TODA la oferta) —no hace falta
 * ni tiene sentido aplicar un segundo recorte encima.
 */
const UNLIMITED_KEYWORDS = Number.MAX_SAFE_INTEGER;

export interface MatchOptions {
  /** Como mucho estos elementos por sección de contenido. */
  maxItemsPerSection?: number;
  /** Con menos de esto no hay evidencia real de relación. */
  minScoreToInclude?: number;
  /** Cuántas keywords distintas de la oferta se usan como referencia. */
  topNKeywords?: number;
}

/**
 * Normalización ligera de plurales en inglés/español (§"Precisión del
 * matching" del estudio): "requirements" y "requirement", "proyectos" y
 * "proyecto" deben contar como la MISMA keyword. Deliberadamente
 * conservadora — no es un stemmer lingüístico completo (eso sería difícil
 * de razonar/mantener y arriesgaría falsos positivos entre palabras no
 * relacionadas), solo quita una "s"/"es" final cuando es razonablemente
 * seguro:
 *   - nunca en palabras de menos de 5 caracteres (protege siglas/palabras
 *     cortas como "aws", "css", "api", "sql" de acabar mutiladas).
 *   - nunca si acaba en "ss"/"us"/"is" (protege casos como
 *     "business"/"status"/"analysis", donde la "s" final NO es un plural).
 * Si dos palabras DISTINTAS coinciden por accidente tras este recorte, el
 * peor caso es una coincidencia de más — igual de inofensivo que un
 * sinónimo real, y mucho menos grave que perderse coincidencias
 * legítimas de singular/plural, que es el problema mucho más frecuente en
 * la práctica.
 */
export function stem(token: string): string {
  if (token.length < 5) return token;
  if (/(ss|us|is)$/.test(token)) return token;
  if (/[a-záéíóúñ]es$/.test(token)) return token.slice(0, -2);
  if (/[a-záéíóúñ]s$/.test(token)) return token.slice(0, -1);
  return token;
}

export interface WeightedJobKeyword {
  /** Forma normalizada (ver `stem`), usada internamente para comparar. */
  stem: string;
  /** La forma superficial más frecuente en la oferta, para mostrar en la UI. */
  display: string;
  /** Frecuencia real (sin ponderar) — para mostrar en la UI. */
  totalCount: number;
  /**
   * Peso usado para PUNTUAR: igual que `totalCount`, salvo que esta
   * keyword sea una tecnología/herramienta reconocida (ver
   * `ats/techDictionary.ts`), en cuyo caso se multiplica por
   * `TECH_KEYWORD_WEIGHT_MULTIPLIER` (petición explícita del usuario: dar
   * más importancia a las keywords técnicas/de requisitos concretos de la
   * oferta frente a palabras genéricas del anuncio).
   */
  weight: number;
  /** true si esta keyword es una tecnología/herramienta reconocida. */
  isTech: boolean;
}

/**
 * Extrae las keywords más relevantes de una oferta, agrupando singular y
 * plural bajo la misma entrada (`stem`) y limitando al top N por PESO
 * (no por frecuencia bruta — así una tecnología mencionada una sola vez no
 * se queda fuera del top N por culpa de palabras genéricas mucho más
 * repetidas). Ver `DEFAULT_TOP_N_KEYWORDS`.
 */
export function buildJobKeywordScores(jobDescriptionText: string, topN = DEFAULT_TOP_N_KEYWORDS): WeightedJobKeyword[] {
  const frequencies = extractKeywordFrequencies(jobDescriptionText);

  const byStem = new Map<string, { display: string; displayCount: number; totalCount: number; isTech: boolean }>();
  for (const f of frequencies) {
    const s = stem(f.term);
    // isTechKeyword se comprueba contra la forma SUPERFICIAL (sin stemmear)
    // a propósito: muchos nombres de tecnología acaban en "s" sin ser un
    // plural (Kubernetes, Redis, Postgres...) y el stemmer los recortaría
    // de forma que ya no coincidirían con el diccionario tal cual está
    // escrito ahí. Comparar contra la forma tal cual apareció evita ese
    // falso negativo.
    const matchesTech = isTechKeyword(f.term);
    const entry = byStem.get(s);
    if (!entry) {
      byStem.set(s, { display: f.term, displayCount: f.count, totalCount: f.count, isTech: matchesTech });
    } else {
      entry.totalCount += f.count;
      entry.isTech = entry.isTech || matchesTech;
      if (f.count > entry.displayCount) {
        entry.display = f.term;
        entry.displayCount = f.count;
      }
    }
  }

  return [...byStem.entries()]
    .map(([s, v]) => ({
      stem: s,
      display: v.display,
      totalCount: v.totalCount,
      weight: v.totalCount * (v.isTech ? TECH_KEYWORD_WEIGHT_MULTIPLIER : 1),
      isTech: v.isTech,
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, topN);
}

function scoreTextAgainstJobKeywords(text: string, jobKeywords: WeightedJobKeyword[]): { score: number; matchedKeywords: WeightedJobKeyword[] } {
  const tokens = new Set(tokenize(text).map(stem));
  let score = 0;
  const matchedKeywords: WeightedJobKeyword[] = [];
  for (const kw of jobKeywords) {
    if (tokens.has(kw.stem)) {
      score += kw.weight;
      matchedKeywords.push(kw);
    }
  }
  return { score, matchedKeywords };
}

export interface ElementJobMatch {
  elementId: string;
  /** La variante EXISTENTE (nunca una nueva) que mejor encaja con la oferta. */
  bestVariantId: string;
  /** Suma de las frecuencias (en la oferta) de cada keyword que aparece en esta variante. Ninguna unidad concreta — solo sirve para ORDENAR. */
  score: number;
  matchedKeywords: WeightedJobKeyword[];
}

/**
 * Reconstruye los mismos `ResolvedField[]` que usaría el renderer para una
 * variante concreta (mismo mapeo que `resolveCV.ts`, duplicado aquí
 * deliberadamente en vez de importado: es un mapeo de 5 líneas sin lógica
 * propia, y evita acoplar este módulo — que trabaja sobre elementos SUELTOS
 * de la base de datos, no sobre un CV ya compuesto — a la resolución de
 * CVs completos).
 */
function resolveVariantFields(section: SectionDefinition, variant: Variant): { key: string; label: string; type: FieldType; value: FieldValue }[] {
  return section.fieldSchema.map((fieldDef) => ({
    key: fieldDef.key,
    label: fieldDef.label,
    type: fieldDef.type,
    value: variant.fields[fieldDef.key] ?? null,
  }));
}

/**
 * Filtra las variantes de un elemento a las que llevan la etiqueta de
 * idioma detectada en el nombre ("vES"/"vEN"..., misma convención que ya
 * usa `cv.ts:setCvDisplayLanguage` — busca `v` + código de idioma como
 * palabra suelta dentro del nombre, sin distinguir mayúsculas). Si NINGUNA
 * variante del elemento lleva esa etiqueta, se devuelven TODAS sin
 * filtrar — nunca deja un elemento sin ninguna variante que puntuar solo
 * porque el usuario no ha adoptado la convención de nombres por idioma.
 */
export function filterVariantsByLanguageTag(variants: Variant[], langCode: DetectedLanguage | null): Variant[] {
  if (!langCode) return variants;
  const escaped = langCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\bv${escaped}\\b`, "i");
  const tagged = variants.filter((v) => pattern.test(v.name));
  return tagged.length > 0 ? tagged : variants;
}

export interface VariantJobMatch {
  variantId: string;
  variantName: string;
  score: number;
  matchedKeywords: WeightedJobKeyword[];
}

/**
 * Puntúa TODAS las variantes existentes de un elemento contra la oferta
 * (tras aplicar el filtro de idioma, si aplica) — la pieza que hace
 * posible tanto elegir automáticamente "la mejor" como ofrecer las demás
 * en la pantalla de revisión para que el usuario elija otra a mano (§
 * petición explícita: "debería ser posible modificar la versión").
 */
export function scoreAllVariantsForElement(
  element: Element,
  variants: Variant[],
  section: SectionDefinition,
  jobKeywords: WeightedJobKeyword[],
  languageTag: DetectedLanguage | null = null
): VariantJobMatch[] {
  const elementVariants = element.variantIds.map((id) => variants.find((v) => v.id === id)).filter((v): v is Variant => Boolean(v));
  const candidates = filterVariantsByLanguageTag(elementVariants, languageTag);

  return candidates.map((variant) => {
    const layout = buildItemLayout(resolveVariantFields(section, variant));
    const text = extractItemLayoutPlainText(layout);
    const { score, matchedKeywords } = scoreTextAgainstJobKeywords(text, jobKeywords);
    return { variantId: variant.id, variantName: variant.name, score, matchedKeywords };
  });
}

function bestVariantMatch(scored: VariantJobMatch[]): VariantJobMatch | null {
  if (scored.length === 0) return null;
  let best = scored[0]!;
  for (const s of scored) if (s.score > best.score) best = s;
  return best;
}

/**
 * Puntúa UN elemento contra la oferta, probando sus variantes existentes
 * (tras el filtro de idioma) y quedándose con la que mejor encaja — es la
 * única forma de "elegir la mejor variante" sin crear nada nuevo: se
 * elige entre lo que ya hay, nunca se genera una combinación de campos
 * inédita.
 */
export function scoreElementAgainstJobKeywords(
  element: Element,
  variants: Variant[],
  section: SectionDefinition,
  jobKeywords: WeightedJobKeyword[],
  languageTag: DetectedLanguage | null = null
): ElementJobMatch | null {
  const scored = scoreAllVariantsForElement(element, variants, section, jobKeywords, languageTag);
  const best = bestVariantMatch(scored);
  if (!best) return null;
  return { elementId: element.id, bestVariantId: best.variantId, score: best.score, matchedKeywords: best.matchedKeywords };
}

/**
 * Selección por COBERTURA MARGINAL (algoritmo voraz de "maximum coverage"),
 * en vez de un simple top-K por puntuación individual (§"Selección de
 * contenido" del estudio): la puntuación global del CV depende de qué
 * keywords aparecen en ALGÚN sitio del texto final, no de en cuál — así
 * que dos elementos que repiten las mismas 3 keywords aportan lo mismo que
 * uno solo. En cada paso se elige el candidato que añade más peso de
 * keywords TODAVÍA NO cubiertas por lo ya seleccionado (empate roto por
 * puntuación bruta); si ningún candidato restante aporta nada nuevo, se
 * sigue rellenando por puntuación bruta hasta el máximo — más contenido
 * relevante sigue siendo mejor que menos, aunque ya no sume a la
 * cobertura de keywords.
 */
export function selectByMarginalCoverage(candidates: ElementJobMatch[], maxItems: number): ElementJobMatch[] {
  const remaining = [...candidates];
  const selected: ElementJobMatch[] = [];
  const covered = new Set<string>();

  while (selected.length < maxItems && remaining.length > 0) {
    let bestIndex = -1;
    let bestGain = -1;
    let bestScore = -1;
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i]!;
      const gain = candidate.matchedKeywords.filter((k) => !covered.has(k.stem)).reduce((sum, k) => sum + k.weight, 0);
      if (gain > bestGain || (gain === bestGain && candidate.score > bestScore)) {
        bestIndex = i;
        bestGain = gain;
        bestScore = candidate.score;
      }
    }
    if (bestIndex === -1) break;
    const [chosen] = remaining.splice(bestIndex, 1);
    selected.push(chosen!);
    for (const k of chosen!.matchedKeywords) covered.add(k.stem);
  }

  return selected;
}

export interface AvailableVariantOption {
  variantId: string;
  variantName: string;
  /** Misma unidad que `JobMatchSectionItem.score` — para poder mostrar por qué una variante encaja mejor que otra en el desplegable de la revisión. */
  score: number;
  /** Las keywords que ESTA variante concreta cubre — para que el desplegable de la revisión pueda mostrar el motivo real de la variante actualmente elegida, no solo de la propuesta inicialmente. */
  matchedKeywords: string[];
}

export interface JobMatchSectionItem {
  elementId: string;
  variantId: string;
  /** Etiqueta legible del elemento (ver labels.ts:guessElementLabel). */
  label: string;
  /** Suma de frecuencias de las keywords coincidentes — 0 si ninguna variante coincidió con nada. */
  score: number;
  matchedKeywords: string[];
  /**
   * true si este item forma parte de la propuesta automática inicial.
   * false significa "existe en tu base de datos pero no se seleccionó
   * automáticamente" — la UI lo muestra como una opción adicional que el
   * usuario puede marcar a mano (§"UX de la revisión" del estudio: antes
   * no había forma de añadir algo que hubiera quedado fuera).
   *
   * En las secciones "siempre incluidas" (personal-information/profile/
   * skills/languages) esto es SIEMPRE true — ahí la puntuación no decide
   * si se incluye, solo qué VARIANTE se elige (petición explícita del
   * usuario).
   */
  defaultIncluded: boolean;
  /**
   * Todas las variantes existentes de este elemento (tras el filtro de
   * idioma, si aplica), con su propia puntuación — para poder elegir otra
   * distinta a mano en la revisión sin tener que ir al editor de CV
   * (petición explícita: "también debería ser posible modificar la
   * versión"). `variantId` de arriba es siempre una de estas.
   */
  availableVariants: AvailableVariantOption[];
}

export interface JobMatchSectionResult {
  sectionDefinitionId: string;
  /** true si esta sección se incluyó entera sin puntuar (identidad/resumen) — ver `ALWAYS_INCLUDE_SECTION_KEYS`. */
  alwaysIncluded: boolean;
  /** TODOS los elementos de la sección con contenido en la base de datos, propuestos primero, luego el resto por puntuación descendente. */
  items: JobMatchSectionItem[];
}

export interface JobMatchResult {
  /** Un nombre de CV sugerido a partir del texto de la oferta (ver `guessJobTitle`). */
  suggestedName: string;
  sections: JobMatchSectionResult[];
  /** Puntuación global de la selección propuesta POR DEFECTO (0-100). */
  matchScore: number;
  /** Desglose por categoría de esa misma selección — ver `computeScoreBreakdown`. */
  scoreBreakdown: ScoreBreakdown;
  /** Las keywords más relevantes detectadas en la oferta, para mostrarlas de forma independiente en la pantalla de revisión. */
  jobKeywords: Array<{ term: string; count: number; isTech: boolean }>;
  /**
   * Idioma detectado del texto de la oferta ("es"/"en"), o `null` si no
   * hay suficiente señal para decidir con confianza (ver
   * `ats/languageDetection.ts`). Se usa para 1) fijar el idioma de
   * visualización del CV generado, y 2) preferir variantes etiquetadas
   * "vES"/"vEN" al elegir la mejor de cada elemento (ver
   * `filterVariantsByLanguageTag`).
   */
  detectedLanguage: DetectedLanguage | null;
}

const MAX_SUGGESTED_NAME_LENGTH = 80;

export function guessJobTitle(jobDescriptionText: string): string {
  const firstLine = jobDescriptionText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!firstLine) return "CV para nueva oferta";
  return firstLine.length > MAX_SUGGESTED_NAME_LENGTH ? `${firstLine.slice(0, MAX_SUGGESTED_NAME_LENGTH).trim()}…` : firstLine;
}

/**
 * Nombre de una posible empresa dentro de una secuencia de palabras
 * capitalizadas: hasta 4 palabras (petición explícita: "de normal no
 * suele tener un nombre muy largo"), cada una empezando por mayúscula,
 * permitiendo conectores internos típicos de nombres de empresa
 * (&, ., ', -, dígitos).
 */
const CAPITALIZED_RUN = "[A-ZÁÉÍÓÚÑ][\\wÀ-ÿ&.'-]*(?:\\s+[A-ZÁÉÍÓÚÑ][\\wÀ-ÿ&.'-]*){0,3}";

/** Sufijos legales que casi con total seguridad marcan un nombre de empresa real. */
const COMPANY_SUFFIX_RE = new RegExp(
  `\\b(${CAPITALIZED_RUN}\\s+(?:S\\.?L\\.?U?\\.?|S\\.?A\\.?U?\\.?|Inc\\.?|Ltd\\.?|LLC|LLP|GmbH|Corp\\.?|Group|Technologies|Solutions|Studio|Studios|Labs?))(?=\\s|[,.;:!?]|$)`
);

/**
 * Marcadores que casi siempre introducen un nombre de empresa en concreto
 * — deliberadamente un conjunto PEQUEÑO y conservador: preposiciones
 * genéricas como "en"/"para"/"con"/"in"/"for" se descartan a propósito por
 * el riesgo real de capturar cualquier palabra capitalizada que las siga
 * (una tecnología, una ciudad...) y no una empresa. Ambas grafías
 * (mayúscula/minúscula) porque el marcador puede caer al principio de
 * frase ("Join Acme Robotics!") o en medio ("...at Acme Robotics").
 */
const COMPANY_MARKER_RE = new RegExp(`\\b(?:[Ee]mpresa|[Cc]ompa[nñ][íi]a|[Jj]oin|[Aa]t)\\s+(${CAPITALIZED_RUN})`);

function cleanCompanyName(raw: string): string {
  return raw.replace(/[,:;]+$/, "").trim();
}

/**
 * Intenta estimar el nombre de la empresa a partir del primer párrafo de
 * la oferta (petición explícita) — con dos heurísticas de precisión alta
 * pero cobertura necesariamente limitada (sin NER/IA no hay forma fiable
 * de reconocer nombres propios en general): sufijo legal reconocible
 * (S.L., Inc., GmbH...) o un marcador textual claro ("empresa X", "join
 * X", "at X"). Si ninguna encuentra nada, cae al heurístico de siempre
 * (primera línea no vacía) en vez de devolver algo vacío o inventado — la
 * pantalla de revisión deja el nombre siempre editable a mano.
 */
export function guessCompanyName(jobDescriptionText: string): string {
  const firstParagraph = jobDescriptionText.split(/\r?\n\s*\r?\n/)[0] ?? jobDescriptionText;
  const scopedText = firstParagraph.split(/\r?\n/).slice(0, 5).join(" ");

  const suffixMatch = scopedText.match(COMPANY_SUFFIX_RE);
  if (suffixMatch) return cleanCompanyName(suffixMatch[1]!);

  const markerMatch = scopedText.match(COMPANY_MARKER_RE);
  if (markerMatch) return cleanCompanyName(markerMatch[1]!);

  return guessJobTitle(jobDescriptionText);
}

/**
 * Reconstruye el texto plano que tendría un CV compuesto por esta
 * selección de elementos/variantes — sin necesitar un CVVersion real
 * persistido. Permite recalcular la puntuación EN VIVO mientras el usuario
 * activa/desactiva elementos en la pantalla de revisión, antes de crear
 * nada (ver JobMatchScreen.tsx).
 */
export function buildPlainTextForSelection(
  db: AppDatabase,
  selection: Array<{ sectionDefinitionId: string; items: Array<{ elementId: string; variantId: string }> }>
): string {
  const parts: string[] = [];
  for (const sectionSelection of selection) {
    const section = db.sections.find((s) => s.id === sectionSelection.sectionDefinitionId);
    if (!section) continue;
    parts.push(section.defaultTitle);
    for (const item of sectionSelection.items) {
      const variant = db.variants.find((v) => v.id === item.variantId);
      if (!variant) continue;
      const layout = buildItemLayout(resolveVariantFields(section, variant));
      const text = extractItemLayoutPlainText(layout);
      if (text) parts.push(text);
    }
  }
  return parts.join("\n");
}

/** Atajo: puntuación global (0-100) de una selección concreta contra una oferta, sin tener que importar también ats/jobComparison.ts desde la UI. */
export function computeMatchScoreForSelection(
  db: AppDatabase,
  selection: Array<{ sectionDefinitionId: string; items: Array<{ elementId: string; variantId: string }> }>,
  jobDescriptionText: string,
  options: Pick<MatchOptions, "topNKeywords"> = {}
): number {
  const jobKeywords = buildJobKeywordScores(jobDescriptionText, options.topNKeywords ?? DEFAULT_TOP_N_KEYWORDS);
  const totalMentions = jobKeywords.reduce((sum, k) => sum + k.weight, 0);
  if (totalMentions === 0) return 0;
  const text = buildPlainTextForSelection(db, selection);
  const tokens = new Set(tokenize(text).map(stem));
  const presentMentions = jobKeywords.filter((k) => tokens.has(k.stem)).reduce((sum, k) => sum + k.weight, 0);
  return Math.round((presentMentions / totalMentions) * 100);
}

/** A partir de un `JobMatchResult`, la selección "por defecto" (solo los items marcados `defaultIncluded`) en el formato que esperan `computeMatchScoreForSelection`/`appStore.createCvFromSelection` — única fuente de verdad, compartida entre el cálculo de `matchScore` aquí dentro y `appStore.createCvFromJobDescription`. */
export function defaultSelectionFromMatch(
  match: Pick<JobMatchResult, "sections">
): Array<{ sectionDefinitionId: string; items: Array<{ elementId: string; variantId: string }> }> {
  return match.sections.map((s) => ({
    sectionDefinitionId: s.sectionDefinitionId,
    items: s.items.filter((i) => i.defaultIncluded).map((i) => ({ elementId: i.elementId, variantId: i.variantId })),
  }));
}

/**
 * Convierte las secciones YA GUARDADAS de un CV real (`CVVersion.sections`)
 * al mismo formato de "selección" que usan todas las funciones de
 * puntuación de este módulo — permite reutilizarlas tal cual para analizar
 * un CV ya creado (ver AtsScreen.tsx) sin tener que reimplementar nada
 * específico para ese caso. `[]` si la versión no existe.
 */
export function selectionFromCvVersion(db: AppDatabase, cvVersionId: string): SelectionSections {
  const version = db.cvVersions.find((v) => v.id === cvVersionId);
  if (!version) return [];
  return version.sections.map((s) => ({
    sectionDefinitionId: s.sectionDefinitionId,
    items: s.items.map((i) => ({ elementId: i.elementId, variantId: i.variantId })),
  }));
}

/**
 * Compara la oferta de trabajo contra TODA la base de datos y decide, para
 * cada sección, qué elementos incluir por defecto (y con qué variante
 * EXISTENTE de cada uno) para maximizar la correspondencia — nunca crea ni
 * modifica ningún elemento/variante, solo selecciona entre lo que ya hay.
 * Todas las secciones de contenido con algún elemento en la base de datos
 * aparecen en el resultado, aunque nada haya puntuado (con
 * `defaultIncluded: false` en todos sus items) — para que la pantalla de
 * revisión pueda ofrecer añadirlos a mano incluso si el emparejamiento
 * automático no encontró ninguna relación.
 */
export function matchDatabaseToJobDescription(db: AppDatabase, jobDescriptionText: string, options: MatchOptions = {}): JobMatchResult {
  const maxItemsPerSection = options.maxItemsPerSection ?? DEFAULT_MAX_ITEMS_PER_CONTENT_SECTION;
  const minScoreToInclude = options.minScoreToInclude ?? DEFAULT_MIN_SCORE_TO_INCLUDE;
  const topNKeywords = options.topNKeywords ?? DEFAULT_TOP_N_KEYWORDS;

  const jobKeywords = buildJobKeywordScores(jobDescriptionText, topNKeywords);
  const detectedLanguage = detectJobDescriptionLanguage(jobDescriptionText);

  const sections: JobMatchSectionResult[] = [];

  for (const section of db.sections) {
    const elementsInSection = db.elements.filter((e) => e.sectionId === section.id);
    if (elementsInSection.length === 0) continue;

    if (ALWAYS_INCLUDE_SECTION_KEYS.has(section.key)) {
      // Petición explícita: personal-information/profile/skills/languages
      // se incluyen SIEMPRE — la puntuación aquí no decide si entran, solo
      // qué VARIANTE de cada una se elige (p.ej. la versión de "Summary"
      // que mejor encaje con esta oferta en concreto).
      sections.push({
        sectionDefinitionId: section.id,
        alwaysIncluded: true,
        items: elementsInSection.map((e) => {
          const variantScores = scoreAllVariantsForElement(e, db.variants, section, jobKeywords, detectedLanguage);
          const best = bestVariantMatch(variantScores);
          return {
            elementId: e.id,
            variantId: best?.variantId ?? e.defaultVariantId,
            label: guessElementLabel(e, db),
            score: best?.score ?? 0,
            matchedKeywords: best?.matchedKeywords.map((k) => k.display) ?? [],
            defaultIncluded: true,
            availableVariants: variantScores.map((v) => ({ variantId: v.variantId, variantName: v.variantName, score: v.score, matchedKeywords: v.matchedKeywords.map((k) => k.display) })),
          };
        }),
      });
      continue;
    }

    const scoredPerElement = elementsInSection
      .map((e) => {
        const variantScores = scoreAllVariantsForElement(e, db.variants, section, jobKeywords, detectedLanguage);
        const best = bestVariantMatch(variantScores);
        if (!best) return null;
        return {
          elementId: e.id,
          bestVariantId: best.variantId,
          score: best.score,
          matchedKeywords: best.matchedKeywords,
          availableVariants: variantScores,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
    if (scoredPerElement.length === 0) continue; // ningún elemento tiene ni una sola variante con contenido

    const qualifying = scoredPerElement.filter((m) => m.score >= minScoreToInclude);
    const selected = selectByMarginalCoverage(qualifying, maxItemsPerSection);
    const selectedIds = new Set(selected.map((m) => m.elementId));
    const rest = scoredPerElement.filter((m) => !selectedIds.has(m.elementId)).sort((a, b) => b.score - a.score);

    sections.push({
      sectionDefinitionId: section.id,
      alwaysIncluded: false,
      items: [...selected, ...rest].map((m) => ({
        elementId: m.elementId,
        variantId: m.bestVariantId,
        label: guessElementLabel(elementsInSection.find((e) => e.id === m.elementId)!, db),
        score: m.score,
        matchedKeywords: m.matchedKeywords.map((k) => k.display),
        defaultIncluded: selectedIds.has(m.elementId),
        availableVariants: m.availableVariants.map((v) => ({ variantId: v.variantId, variantName: v.variantName, score: v.score, matchedKeywords: v.matchedKeywords.map((k) => k.display) })),
      })),
    });
  }

  const result: JobMatchResult = {
    suggestedName: guessCompanyName(jobDescriptionText),
    sections,
    matchScore: 0,
    scoreBreakdown: { overall: 0, education: { score: 0, detail: "" }, technologies: { score: 0, detail: "" }, experience: { score: 0, detail: "" } },
    jobKeywords: jobKeywords.map((k) => ({ term: k.display, count: k.totalCount, isTech: k.isTech })),
    detectedLanguage,
  };
  const defaultSelection = defaultSelectionFromMatch(result);
  result.matchScore = computeMatchScoreForSelection(db, defaultSelection, jobDescriptionText, { topNKeywords });
  result.scoreBreakdown = computeScoreBreakdown(db, defaultSelection, jobDescriptionText, { topNKeywords, maxItemsPerSection, minScoreToInclude });

  return result;
}

// ---------------------------------------------------------------------------
// Puntuaciones por categoría (petición explícita: "varias puntuaciones, como
// education, experience, technologies/tools") — además de la puntuación
// general (cobertura de TODA la oferta en TODO el CV), tres puntuaciones más
// específicas, cada una respondiendo una pregunta distinta y más accionable
// que un único número:
//   - Educación: ¿mi formación menciona lo que pide la oferta?
//   - Tecnologías/Herramientas: ¿mis skills cubren el vocabulario técnico?
//   - Experiencia: ¿cumplo los años mínimos que pide la oferta? (si la
//     oferta no da un número concreto, cae a cobertura de keywords, igual
//     que las otras dos, con el detalle dejando claro cuál de los dos modos
//     se ha usado).
// ---------------------------------------------------------------------------

export interface CategoryScore {
  /** 0-100. */
  score: number;
  /** Explicación legible de por qué esta puntuación es la que es. */
  detail: string;
}

export interface ScoreBreakdown {
  /** La puntuación general de siempre — cobertura de toda la oferta en todo el CV. */
  overall: number;
  education: CategoryScore;
  technologies: CategoryScore;
  experience: CategoryScore;
}

export type SelectionSections = Array<{ sectionDefinitionId: string; items: Array<{ elementId: string; variantId: string }> }>;

/**
 * Puntuación de cobertura de keywords restringida a las secciones cuyo
 * `key` esté en `sectionKeys` — la misma idea que `computeMatchScoreForSelection`
 * pero mirando solo una parte del CV. Se usa hoy únicamente como fallback
 * de Experiencia cuando la oferta no da un número de años concreto (ver
 * `computeExperienceScore`) — Educación/Tecnologías usan
 * `computeKeywordClassCoverageScore`, que NO restringe por sección (ver
 * más abajo por qué).
 */
function computeSectionCoverageScore(
  db: AppDatabase,
  selection: SelectionSections,
  jobDescriptionText: string,
  sectionKeys: string[],
  options: MatchOptions = {}
): CategoryScore {
  const relevant = selection.filter((s) => {
    const sectionDef = db.sections.find((sd) => sd.id === s.sectionDefinitionId);
    return sectionDef && sectionKeys.includes(sectionDef.key);
  });

  if (relevant.every((s) => s.items.length === 0)) {
    return { score: 0, detail: "Todavía no has incluido nada en esta sección." };
  }

  const jobKeywords = buildJobKeywordScores(jobDescriptionText, options.topNKeywords ?? DEFAULT_TOP_N_KEYWORDS);
  const totalMentions = jobKeywords.reduce((sum, k) => sum + k.weight, 0);
  if (totalMentions === 0) {
    return { score: 0, detail: "La oferta no tiene suficientes keywords reconocibles para comparar." };
  }

  const text = buildPlainTextForSelection(db, relevant);
  const tokens = new Set(tokenize(text).map(stem));
  const matched = jobKeywords.filter((k) => tokens.has(k.stem));
  const presentMentions = matched.reduce((sum, k) => sum + k.weight, 0);
  const score = Math.round((presentMentions / totalMentions) * 100);

  const detail =
    matched.length > 0
      ? `Coincide con ${matched.length} keyword${matched.length === 1 ? "" : "s"} de la oferta: ${matched
          .slice(0, 8)
          .map((k) => k.display)
          .join(", ")}${matched.length > 8 ? "…" : ""}.`
      : "No se ha detectado ninguna keyword de la oferta en esta sección.";

  return { score, detail };
}

/**
 * Puntuación de cobertura restringida a las keywords de la oferta que
 * CLASIFICAN como pertenecientes a una categoría (Educación/Tecnologías) —
 * a diferencia de `computeSectionCoverageScore`, NO restringe por sección:
 * cualquier item de CUALQUIER apartado del CV cuenta, siempre que su
 * contenido mencione alguna de esas keywords (petición explícita del
 * usuario: "que pueda apoyar a los 3 a la vez... el cálculo se basará en
 * las keywords totales... que aportan a los 3"). Así, un Proyecto que
 * mencione "Python" contribuye a Tecnologías exactamente igual que si esa
 * mención estuviera en la sección Skills — tiene sentido: lo que importa
 * es si la oferta encuentra esa palabra EN TU CV, no en qué apartado
 * concreto la escribiste.
 */
function computeKeywordClassCoverageScore(
  db: AppDatabase,
  selection: SelectionSections,
  jobDescriptionText: string,
  classify: (normalizedDisplayTerm: string) => boolean,
  options: MatchOptions = {}
): CategoryScore {
  const jobKeywords = buildJobKeywordScores(jobDescriptionText, UNLIMITED_KEYWORDS).filter((k) => classify(k.display));
  const totalMentions = jobKeywords.reduce((sum, k) => sum + k.weight, 0);
  if (totalMentions === 0) {
    return { score: 0, detail: "La oferta no menciona nada de esta categoría (o no hay keywords reconocibles)." };
  }

  const text = buildPlainTextForSelection(db, selection);
  const tokens = new Set(tokenize(text).map(stem));
  const matched = jobKeywords.filter((k) => tokens.has(k.stem));
  const presentMentions = matched.reduce((sum, k) => sum + k.weight, 0);
  const score = Math.round((presentMentions / totalMentions) * 100);

  const detail =
    matched.length > 0
      ? `Coincide con ${matched.length} keyword${matched.length === 1 ? "" : "s"}: ${matched
          .slice(0, 8)
          .map((k) => k.display)
          .join(", ")}${matched.length > 8 ? "…" : ""}.`
      : "No se ha detectado ninguna keyword de esta categoría en tu selección.";

  return { score, detail };
}

/**
 * Busca un número de años requeridos en el texto de la oferta ("mínimo 5
 * años", "at least 3 years", "5+ years of experience"...). Deliberadamente
 * simple: cualquier número seguido de "año(s)"/"year(s)" cuenta, y si hay
 * varios (p.ej. un rango "3-5 años") se toma el MENOR — es el umbral real
 * que hay que superar. Descarta números fuera de un rango razonable
 * (0 < n < 50) para no confundir con años de calendario u otro ruido.
 */
function detectRequiredYears(jobDescriptionText: string): number | null {
  const matches = [...jobDescriptionText.matchAll(/(\d+)\s*\+?\s*(?:años?|years?)/gi)];
  const numbers = matches.map((m) => Number(m[1])).filter((n) => Number.isFinite(n) && n > 0 && n < 50);
  return numbers.length === 0 ? null : Math.min(...numbers);
}

/**
 * Estima los años de experiencia del candidato a partir de las fechas de
 * las experiencias SELECCIONADAS: desde el inicio más antiguo hasta el fin
 * más reciente (o hoy, si algún puesto sigue en curso). Es una
 * simplificación deliberada y documentada — no resta huecos entre
 * empleos, ni evita contar dos veces solapes entre puestos simultáneos —
 * pero es la misma forma en que la mayoría de reclutadores/ATS estiman
 * "años de experiencia" a simple vista, y mantiene la lógica simple y
 * explicable (sin IA, ver §20 del contexto).
 */
function estimateCandidateYearsOfExperience(db: AppDatabase, selection: SelectionSections): number | null {
  const experienceSection = db.sections.find((s) => s.key === "experience");
  if (!experienceSection) return null;
  const sectionSelection = selection.find((s) => s.sectionDefinitionId === experienceSection.id);
  if (!sectionSelection || sectionSelection.items.length === 0) return null;

  const dateRangeField = experienceSection.fieldSchema.find((f) => f.type === "daterange");
  if (!dateRangeField) return null;

  let earliestStart: number | null = null;
  let latestEnd: number | null = null;
  const now = Date.now();

  for (const item of sectionSelection.items) {
    const variant = db.variants.find((v) => v.id === item.variantId);
    if (!variant) continue;
    const value = variant.fields[dateRangeField.key];
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const range = value as { start?: string; end?: string; current?: boolean };

    if (range.start) {
      const start = Date.parse(range.start);
      if (!Number.isNaN(start) && (earliestStart === null || start < earliestStart)) earliestStart = start;
    }
    const end = range.current || !range.end ? now : Date.parse(range.end);
    if (!Number.isNaN(end) && (latestEnd === null || end > latestEnd)) latestEnd = end;
  }

  if (earliestStart === null || latestEnd === null) return null;
  const years = (latestEnd - earliestStart) / (1000 * 60 * 60 * 24 * 365.25);
  return Math.max(0, Math.round(years * 10) / 10);
}

function computeExperienceScore(
  db: AppDatabase,
  selection: SelectionSections,
  jobDescriptionText: string,
  options: MatchOptions = {}
): CategoryScore {
  const requiredYears = detectRequiredYears(jobDescriptionText);
  const candidateYears = estimateCandidateYearsOfExperience(db, selection);

  if (requiredYears !== null) {
    if (candidateYears === null) {
      return {
        score: 0,
        detail: `La oferta pide un mínimo de ${requiredYears} años de experiencia, pero no se ha podido calcular la tuya (revisa que tus experiencias tengan fechas).`,
      };
    }
    const score = Math.min(100, Math.round((candidateYears / requiredYears) * 100));
    const detail =
      candidateYears >= requiredYears
        ? `Tienes ${candidateYears} años de experiencia — cumples el mínimo de ${requiredYears} que pide la oferta.`
        : `Tienes ${candidateYears} años de experiencia — la oferta pide un mínimo de ${requiredYears}.`;
    return { score, detail };
  }

  const fallback = computeSectionCoverageScore(db, selection, jobDescriptionText, ["experience"], options);
  return { ...fallback, detail: `La oferta no especifica un número de años concreto. ${fallback.detail}` };
}

/**
 * Desglosa la puntuación general en varias más específicas y accionables
 * (petición explícita): Educación ("¿cumplo los requisitos formativos?"),
 * Tecnologías/Herramientas ("¿mis skills cubren el vocabulario técnico?")
 * y Experiencia (años, con fallback a cobertura de keywords si la oferta
 * no da un número concreto). Educación/Tecnologías cuentan CUALQUIER
 * sección que mencione sus keywords (ver `computeKeywordClassCoverageScore`)
 * — Experiencia sigue atada a la sección Experience porque es
 * estructuralmente distinta (fechas reales, no vocabulario). Funciona
 * sobre cualquier selección — se usa tanto para la propuesta inicial como
 * para recalcular en vivo en la pantalla de revisión.
 */
export function computeScoreBreakdown(
  db: AppDatabase,
  selection: SelectionSections,
  jobDescriptionText: string,
  options: MatchOptions = {}
): ScoreBreakdown {
  return {
    overall: computeMatchScoreForSelection(db, selection, jobDescriptionText, options),
    education: computeKeywordClassCoverageScore(db, selection, jobDescriptionText, isEducationKeyword, options),
    technologies: computeKeywordClassCoverageScore(db, selection, jobDescriptionText, isTechKeyword, options),
    experience: computeExperienceScore(db, selection, jobDescriptionText, options),
  };
}

export type ScoreCategory = "education" | "technologies" | "experience";

export interface CategoryImpactDetail {
  /** La puntuación de esta categoría SIN este item (con el resto de la selección igual). */
  withoutScore: number;
  /** La puntuación de esta categoría CON este item incluido con la variante indicada. */
  withScore: number;
  /** withScore - withoutScore — puede ser negativo si se está quitando un item que aportaba algo. */
  delta: number;
}

export interface ItemCategoryImpacts {
  /** Educación/Tecnologías se calculan SIEMPRE (cualquier item de cualquier sección puede aportar keywords de cualquiera de las dos, o de ambas a la vez). */
  education: CategoryImpactDetail;
  technologies: CategoryImpactDetail;
  /** `null` si este item no pertenece a la sección Experience — el cálculo de Experiencia depende de fechas reales de esa sección concreta, no de vocabulario, así que no tiene sentido atribuírselo a un item de otra sección. */
  experience: CategoryImpactDetail | null;
}

/**
 * Cuánto cambiaría CADA UNA de las tres puntuaciones (Educación,
 * Tecnologías Y Experiencia a la vez, no solo una) si este elemento (con
 * esta variante en concreto) estuviera incluido en la selección, frente a
 * si no lo estuviera — petición explícita: "que pueda apoyar a los 3 a la
 * vez... el cálculo se basará en las keywords totales no repetidas que
 * aportan a los 3". Funciona para CUALQUIER sección (un Proyecto puede
 * aportar a Tecnologías si menciona herramientas, y a Educación si
 * menciona un TFG universitario, por ejemplo) — Experiencia es la única
 * que se queda `null` fuera de la sección Experience, ver
 * `ItemCategoryImpacts`.
 */
export function computeItemCategoryImpacts(
  db: AppDatabase,
  selection: SelectionSections,
  jobDescriptionText: string,
  sectionDefinitionId: string,
  elementId: string,
  variantId: string,
  options: MatchOptions = {}
): ItemCategoryImpacts {
  const sectionDef = db.sections.find((s) => s.id === sectionDefinitionId);

  const withSelection = selection.map((s) => {
    if (s.sectionDefinitionId !== sectionDefinitionId) return s;
    const withoutThisElement = s.items.filter((i) => i.elementId !== elementId);
    return { ...s, items: [...withoutThisElement, { elementId, variantId }] };
  });
  const withoutSelection = selection.map((s) =>
    s.sectionDefinitionId === sectionDefinitionId ? { ...s, items: s.items.filter((i) => i.elementId !== elementId) } : s
  );

  const educationWith = computeKeywordClassCoverageScore(db, withSelection, jobDescriptionText, isEducationKeyword, options).score;
  const educationWithout = computeKeywordClassCoverageScore(db, withoutSelection, jobDescriptionText, isEducationKeyword, options).score;

  const techWith = computeKeywordClassCoverageScore(db, withSelection, jobDescriptionText, isTechKeyword, options).score;
  const techWithout = computeKeywordClassCoverageScore(db, withoutSelection, jobDescriptionText, isTechKeyword, options).score;

  const experience =
    sectionDef?.key === "experience"
      ? (() => {
          const withScore = computeExperienceScore(db, withSelection, jobDescriptionText, options).score;
          const withoutScore = computeExperienceScore(db, withoutSelection, jobDescriptionText, options).score;
          return { withScore, withoutScore, delta: withScore - withoutScore };
        })()
      : null;

  return {
    education: { withScore: educationWith, withoutScore: educationWithout, delta: educationWith - educationWithout },
    technologies: { withScore: techWith, withoutScore: techWithout, delta: techWith - techWithout },
    experience,
  };
}

export interface CategoryKeywordComparison {
  present: string[];
  missing: string[];
}

function computeSectionKeywordComparison(
  db: AppDatabase,
  selection: SelectionSections,
  jobDescriptionText: string,
  sectionKeys: string[],
  options: MatchOptions = {}
): CategoryKeywordComparison {
  const relevant = selection.filter((s) => {
    const sectionDef = db.sections.find((sd) => sd.id === s.sectionDefinitionId);
    return sectionDef && sectionKeys.includes(sectionDef.key);
  });

  const jobKeywords = buildJobKeywordScores(jobDescriptionText, options.topNKeywords ?? DEFAULT_TOP_N_KEYWORDS);
  const text = buildPlainTextForSelection(db, relevant);
  const tokens = new Set(tokenize(text).map(stem));

  const present: string[] = [];
  const missing: string[] = [];
  for (const k of jobKeywords) {
    (tokens.has(k.stem) ? present : missing).push(k.display);
  }
  return { present, missing };
}

function computeKeywordClassComparison(
  db: AppDatabase,
  selection: SelectionSections,
  jobDescriptionText: string,
  classify: (normalizedDisplayTerm: string) => boolean,
  options: MatchOptions = {}
): CategoryKeywordComparison {
  const jobKeywords = buildJobKeywordScores(jobDescriptionText, UNLIMITED_KEYWORDS).filter((k) => classify(k.display));
  const text = buildPlainTextForSelection(db, selection);
  const tokens = new Set(tokenize(text).map(stem));

  const present: string[] = [];
  const missing: string[] = [];
  for (const k of jobKeywords) {
    (tokens.has(k.stem) ? present : missing).push(k.display);
  }
  return { present, missing };
}

export interface CategorizedKeywordComparison {
  education: CategoryKeywordComparison;
  technologies: CategoryKeywordComparison;
  experience: CategoryKeywordComparison;
}

/**
 * Igual que las keywords presentes/ausentes de `ats/jobComparison.ts`, pero
 * repartidas por categoría (Educación/Tecnologías/Experiencia) en vez de
 * en un único totum revolutum — petición explícita: "para saber qué falta
 * en cada sitio". Educación/Tecnologías miran TODO el CV (cualquier
 * sección puede aportar); Experiencia sigue acotada a la sección
 * Experience (ver `computeScoreBreakdown`). Funciona sobre cualquier
 * selección; para un CV ya creado, combínese con `selectionFromCvVersion`.
 */
export function computeCategorizedKeywordComparison(
  db: AppDatabase,
  selection: SelectionSections,
  jobDescriptionText: string,
  options: MatchOptions = {}
): CategorizedKeywordComparison {
  return {
    education: computeKeywordClassComparison(db, selection, jobDescriptionText, isEducationKeyword, options),
    technologies: computeKeywordClassComparison(db, selection, jobDescriptionText, isTechKeyword, options),
    experience: computeSectionKeywordComparison(db, selection, jobDescriptionText, ["experience"], options),
  };
}


export interface ImprovementSuggestion {
  sectionDefinitionId: string;
  sectionTitle: string;
  /** "add": la sección tiene hueco de sobra, se puede añadir sin quitar nada. "swap": hay que sustituir el elemento peor puntuado de la sección por este. */
  type: "add" | "swap";
  removedElementId?: string;
  removedLabel?: string;
  suggestedElementId: string;
  suggestedVariantId: string;
  suggestedLabel: string;
  /** Keywords de la oferta que este cambio cubriría y que el CV actual no cubre en NINGUNA otra parte. */
  newKeywords: string[];
}

const MAX_SUGGESTIONS = 5;

/**
 * "Consejos de qué apartados/proyectos se podrían cambiar para obtener
 * mejor puntuación" (petición explícita, ver AtsScreen.tsx). Para cada
 * sección de contenido, compara los elementos YA seleccionados en el CV
 * contra el resto de elementos de la MISMA sección en la base de datos
 * (los que no están en este CV) y propone añadir/sustituir cuando un
 * candidato cubre keywords de la oferta que el CV, en su conjunto, todavía
 * no tiene por ningún lado — nunca sugiere un cambio que no aporte ninguna
 * keyword nueva, aunque puntúe alto en abstracto.
 */
export function suggestImprovements(
  db: AppDatabase,
  cvVersionId: string,
  jobDescriptionText: string,
  options: MatchOptions = {}
): ImprovementSuggestion[] {
  const version = db.cvVersions.find((v) => v.id === cvVersionId);
  if (!version) return [];

  const maxItemsPerSection = options.maxItemsPerSection ?? DEFAULT_MAX_ITEMS_PER_CONTENT_SECTION;
  const jobKeywords = buildJobKeywordScores(jobDescriptionText, options.topNKeywords ?? DEFAULT_TOP_N_KEYWORDS);
  if (jobKeywords.length === 0) return [];
  const detectedLanguage = detectJobDescriptionLanguage(jobDescriptionText);

  const coveredStems = new Set(tokenize(extractCvPlainText(db, cvVersionId)).map(stem));

  const suggestions: ImprovementSuggestion[] = [];

  for (const section of db.sections) {
    if (ALWAYS_INCLUDE_SECTION_KEYS.has(section.key)) continue;
    const elementsInSection = db.elements.filter((e) => e.sectionId === section.id);
    if (elementsInSection.length === 0) continue;

    const sectionInstance = version.sections.find((s) => s.sectionDefinitionId === section.id);
    const currentElementIds = new Set((sectionInstance?.items ?? []).map((i) => i.elementId));

    const scoredAll = elementsInSection
      .map((e) => scoreElementAgainstJobKeywords(e, db.variants, section, jobKeywords, detectedLanguage))
      .filter((m): m is ElementJobMatch => m !== null);

    const currentScored = scoredAll.filter((m) => currentElementIds.has(m.elementId));
    const candidates = scoredAll
      .filter((m) => !currentElementIds.has(m.elementId) && m.score > 0)
      .sort((a, b) => b.score - a.score);

    for (const candidate of candidates) {
      const newKeywords = candidate.matchedKeywords.filter((k) => !coveredStems.has(k.stem)).map((k) => k.display);
      if (newKeywords.length === 0) continue; // no aporta nada que el CV no tenga ya por otro lado

      const candidateElement = elementsInSection.find((e) => e.id === candidate.elementId)!;

      if (currentElementIds.size < maxItemsPerSection) {
        suggestions.push({
          sectionDefinitionId: section.id,
          sectionTitle: section.defaultTitle,
          type: "add",
          suggestedElementId: candidate.elementId,
          suggestedVariantId: candidate.bestVariantId,
          suggestedLabel: guessElementLabel(candidateElement, db),
          newKeywords,
        });
        continue;
      }

      const worstCurrent = [...currentScored].sort((a, b) => a.score - b.score)[0];
      if (worstCurrent && candidate.score > worstCurrent.score) {
        const removedElement = elementsInSection.find((e) => e.id === worstCurrent.elementId)!;
        suggestions.push({
          sectionDefinitionId: section.id,
          sectionTitle: section.defaultTitle,
          type: "swap",
          removedElementId: worstCurrent.elementId,
          removedLabel: guessElementLabel(removedElement, db),
          suggestedElementId: candidate.elementId,
          suggestedVariantId: candidate.bestVariantId,
          suggestedLabel: guessElementLabel(candidateElement, db),
          newKeywords,
        });
      }
    }
  }

  return suggestions.sort((a, b) => b.newKeywords.length - a.newKeywords.length).slice(0, MAX_SUGGESTIONS);
}

/** Marcador usado para guardar el texto de la oferta en `CVVersion.metadata.notes` (ver appStore.ts) y poder recuperarlo después (ver `extractStoredJobDescription`, usado por AtsScreen.tsx para pre-rellenar el comparador con la misma oferta que generó el CV). */
export const JOB_DESCRIPTION_NOTES_PREFIX = "Generado automáticamente a partir de esta oferta de trabajo:\n\n";

/**
 * Si esta versión de CV se generó con "Crear CV a partir de una oferta"
 * (§ enlace con el comparador ATS del estudio), recupera el texto original
 * de la oferta desde `metadata.notes` — para poder pre-rellenar el
 * comparador ATS con la misma oferta sin que el usuario tenga que volver a
 * pegarla. `null` si esta versión no se generó así (notes vacío, o con
 * cualquier otro contenido que el usuario haya escrito a mano).
 */
export function extractStoredJobDescription(notes: string | undefined): string | null {
  if (!notes || !notes.startsWith(JOB_DESCRIPTION_NOTES_PREFIX)) return null;
  const text = notes.slice(JOB_DESCRIPTION_NOTES_PREFIX.length);
  return text.trim() ? text : null;
}
