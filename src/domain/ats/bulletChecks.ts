import type { AppDatabase, RichTextDoc } from "../model/types.js";
import { resolveCV, type ResolvedField } from "../resolveCV.js";
import { isRichTextDoc } from "../fieldValueGuards.js";

/**
 * Verbos de acción fuertes, en pasado/1ª persona (ES) e -ed/-ing o base
 * (EN) — lista estática, sin IA (§20 del contexto). No pretende ser
 * exhaustiva: es una heurística de apoyo, no una validación estricta.
 */
const ACTION_VERBS = new Set(
  [
    // Español (participio/1ª persona pasado, formas más habituales en CVs)
    "lideré", "lidere", "desarrollé", "desarrolle", "diseñé", "disene", "diseñe", "implementé", "implemente",
    "gestioné", "gestione", "coordiné", "coordine", "optimicé", "optimice", "reduje", "aumenté", "aumente",
    "mejoré", "mejore", "creé", "cree", "construí", "construi", "automaticé", "automatice", "dirigí", "dirigi",
    "supervisé", "supervise", "analicé", "analice", "investigué", "investigue", "diseñado", "planifiqué",
    "planifique", "ejecuté", "ejecute", "impulsé", "impulse", "logré", "logre", "alcancé", "alcance",
    "resolví", "resolvi", "formé", "forme", "capacité", "capacite", "entregué", "entregue", "lancé", "lance",
    "migré", "migre", "refactoricé", "refactorice", "integré", "integre", "colaboré", "colabore", "negocié",
    "negocie", "presenté", "presente", "redacté", "redacte", "documenté", "documente", "definí", "defini",
    "diseñe", "escalé", "escale",
    // Inglés (pasado / gerundio, formas más habituales en CVs)
    "led", "developed", "designed", "implemented", "managed", "coordinated", "optimized", "reduced",
    "increased", "improved", "created", "built", "automated", "directed", "supervised", "analyzed",
    "researched", "planned", "executed", "drove", "achieved", "delivered", "resolved", "trained",
    "launched", "migrated", "refactored", "integrated", "collaborated", "negotiated", "presented",
    "wrote", "documented", "defined", "scaled", "architected", "spearheaded", "streamlined", "established",
    "mentored", "owned", "shipped", "boosted", "accelerated", "pioneered",
  ].map((v) => v.toLowerCase())
);

export interface BulletInfo {
  sectionKey: string;
  text: string;
  wordCount: number;
  startsWithActionVerb: boolean;
}

function normalizeFirstWord(text: string): string {
  const match = /^[\p{L}]+/u.exec(text.trim());
  if (!match) return "";
  return match[0]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // quita acentos para comparar contra la lista (que ya incluye ambas formas, pero esto cubre variantes no listadas)
}

/**
 * Recorre todas las secciones visibles del CV y extrae cada bullet
 * (viñeta) de sus campos de texto enriquecido, junto con métricas básicas
 * — base compartida para `checkActionVerbs` y `checkBulletLength`.
 */
export function extractBullets(db: AppDatabase, cvVersionId: string): BulletInfo[] {
  const resolved = resolveCV(db, cvVersionId);
  const bullets: BulletInfo[] = [];

  for (const section of resolved.sections) {
    for (const item of section.items) {
      if (item.broken) continue;
      for (const field of item.fields as ResolvedField[]) {
        if (field.type !== "richtext" || !isRichTextDoc(field.value)) continue;
        const doc = field.value as RichTextDoc;
        for (const block of doc.blocks) {
          if (block.kind !== "bullet") continue;
          const text = block.runs.map((r) => r.text).join("");
          if (!text.trim()) continue;
          const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
          const firstWord = normalizeFirstWord(text);
          bullets.push({
            sectionKey: section.key,
            text: text.trim(),
            wordCount,
            startsWithActionVerb: ACTION_VERBS.has(firstWord),
          });
        }
      }
    }
  }

  return bullets;
}

export interface ActionVerbCheckResult {
  totalBullets: number;
  bulletsWithActionVerb: number;
  ratio: number; // 0-1
  weakBullets: BulletInfo[]; // las que NO empiezan por un verbo de acción reconocido
}

/**
 * Petición: "verbos de acción al inicio de cada bullet" — informativo, no
 * un pass/fail estricto (no todas las viñetas tienen por qué empezar con
 * un verbo, p.ej. una lista de certificaciones), pero una ratio baja es
 * una señal útil de que conviene revisar la redacción.
 */
export function checkActionVerbs(db: AppDatabase, cvVersionId: string): ActionVerbCheckResult {
  const bullets = extractBullets(db, cvVersionId);
  const withVerb = bullets.filter((b) => b.startsWithActionVerb);
  return {
    totalBullets: bullets.length,
    bulletsWithActionVerb: withVerb.length,
    ratio: bullets.length > 0 ? withVerb.length / bullets.length : 1,
    weakBullets: bullets.filter((b) => !b.startsWithActionVerb),
  };
}

export interface BulletLengthCheckResult {
  tooShort: BulletInfo[];
  tooLong: BulletInfo[];
}

const MIN_BULLET_WORDS = 4;
const MAX_BULLET_WORDS = 30;

/**
 * Petición: "longitud de bullets (demasiado largos/cortos)". Umbrales
 * orientativos, no absolutos: por debajo de 4 palabras suele ser un
 * fragmento poco informativo; por encima de 30, cuesta escanear de un
 * vistazo (uno de los objetivos explícitos del §23 del contexto:
 * "fáciles de leer").
 */
export function checkBulletLength(db: AppDatabase, cvVersionId: string): BulletLengthCheckResult {
  const bullets = extractBullets(db, cvVersionId);
  return {
    tooShort: bullets.filter((b) => b.wordCount < MIN_BULLET_WORDS),
    tooLong: bullets.filter((b) => b.wordCount > MAX_BULLET_WORDS),
  };
}
