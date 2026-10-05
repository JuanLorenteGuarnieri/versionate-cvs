/**
 * Diccionario de vocabulario académico/educativo (títulos, grados,
 * instituciones genéricas...), en el mismo espíritu que
 * `techDictionary.ts`: reglas fijas, sin IA, un término por token (la
 * misma limitación ya documentada de que el motor de keywords no
 * reconoce frases). Se usa para clasificar una keyword de la oferta como
 * "de Educación" INDEPENDIENTEMENTE de en qué sección del CV aparezca
 * finalmente cubierta — petición explícita del usuario: que cualquier
 * apartado (no solo la sección "Education") pueda contribuir a esta
 * puntuación si su contenido la menciona.
 */

const DEGREES_ES = [
  "grado", "licenciatura", "diplomatura", "ingenieria", "arquitectura", "master", "maestria",
  "posgrado", "postgrado", "doctorado", "especializacion", "diplomado", "bachillerato", "fp",
  "ciclo", "modulo",
];

const DEGREES_EN = [
  "degree", "bachelor", "bachelors", "master", "masters", "mba", "phd", "doctorate", "diploma",
  "associate", "undergraduate", "graduate", "postgraduate",
];

const INSTITUTIONS = [
  "universidad", "university", "facultad", "escuela", "college", "instituto", "institute",
  "academia", "academy", "campus", "politecnica", "politecnico",
];

const OTHER_ACADEMIC = [
  "tesis", "thesis", "tfg", "tfm", "expediente", "gpa", "matricula", "erasmus", "beca",
  "scholarship", "bootcamp", "curso", "course", "asignatura", "titulacion", "credito", "credits",
  "cumlaude",
];

export const EDUCATION_KEYWORDS: ReadonlySet<string> = new Set(
  [...DEGREES_ES, ...DEGREES_EN, ...INSTITUTIONS, ...OTHER_ACADEMIC].map((t) =>
    t
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
  )
);

/** El token ya debe venir normalizado igual que lo hace `tokenize()` (minúsculas, sin acentos). */
export function isEducationKeyword(normalizedToken: string): boolean {
  return EDUCATION_KEYWORDS.has(normalizedToken);
}
