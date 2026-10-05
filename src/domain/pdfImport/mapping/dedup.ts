import type { AppDatabase } from "../../model/types.js";
import { guessElementLabel } from "../../labels.js";

/**
 * Deduplicación contra la base de datos existente (§16 del informe de
 * importación de PDF, y §16 del contexto del proyecto: "nunca eliminar
 * silenciosamente contenido"). El objetivo NO es fusionar nada
 * automáticamente — solo avisar cuando lo que se está a punto de
 * importar se parece mucho a algo que ya existe, para que el usuario
 * pueda decidir con conocimiento de causa si quiere:
 *   - crear un elemento nuevo de todas formas (por defecto, no destructivo), o
 *   - añadirlo como una VARIANTE nueva del elemento ya existente
 *     (`appStore.forkVariant`, ver PdfImportScreen.tsx).
 *
 * La similitud se calcula sobre el texto normalizado (minúsculas, sin
 * acentos ni puntuación) con una distancia de edición (Levenshtein)
 * relativizada a la longitud — suficiente para detectar "Scanpath
 * Prediction" vs "Scanpath prediction." o pequeñas variaciones de
 * mayúsculas/tildes, sin ser tan laxa como para emparejar cosas
 * genuinamente distintas.
 */
export interface DedupCandidate {
  elementId: string;
  label: string;
  /** 0-1, cuanto más alto más parecido. */
  similarity: number;
}

const SIMILARITY_THRESHOLD = 0.6;
const MAX_CANDIDATES = 3;

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .toLowerCase();
}

/** Distancia de Levenshtein clásica, sin optimizar — las cadenas de un CV (títulos, nombres) son siempre cortas. */
function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) matrix[i]![0] = i;
  for (let j = 0; j < cols; j++) matrix[0]![j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(matrix[i - 1]![j]! + 1, matrix[i]![j - 1]! + 1, matrix[i - 1]![j - 1]! + cost);
    }
  }
  return matrix[rows - 1]![cols - 1]!;
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // Coincidencia de subcadena completa (p.ej. "MIT" dentro de "Massachusetts Institute of Technology (MIT)")
  // cuenta como fuerte pero no perfecta, para no perder el matiz de que no son literalmente el mismo texto.
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const distance = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return maxLen === 0 ? 0 : 1 - distance / maxLen;
}

/**
 * Busca, dentro de una sección concreta de la base de datos, elementos
 * cuya etiqueta (ver labels.ts:guessElementLabel) se parezca a
 * `titleGuess`. Devuelve como mucho `MAX_CANDIDATES`, ordenados de más a
 * menos parecido, y ninguno si no hay nada por encima del umbral — un
 * falso positivo aquí es mucho más costoso (el usuario podría fusionar
 * dos cosas que en realidad son distintas) que un falso negativo (como
 * mucho, se crea un elemento nuevo que el usuario puede fusionar a mano
 * más tarde).
 */
export function findSimilarElements(db: AppDatabase, sectionId: string, titleGuess: string): DedupCandidate[] {
  if (!titleGuess.trim()) return [];

  const candidates: DedupCandidate[] = [];
  for (const element of db.elements) {
    if (element.sectionId !== sectionId) continue;
    const label = guessElementLabel(element, db);
    const score = similarity(titleGuess, label);
    if (score >= SIMILARITY_THRESHOLD) {
      candidates.push({ elementId: element.id, label, similarity: score });
    }
  }

  return candidates.sort((a, b) => b.similarity - a.similarity).slice(0, MAX_CANDIDATES);
}
