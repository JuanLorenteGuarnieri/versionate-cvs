import type { AppDatabase, DateRangeValue } from "../model/types.js";
import { resolveCV } from "../resolveCV.js";

export interface ExperienceStats {
  /** Años totales, redondeados a un decimal. `null` si no hay ningún rango de fecha aprovechable. */
  totalYears: number | null;
  rangeCount: number;
}

function parseIsoDate(iso: string | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Suma los rangos de fecha de la sección "Experience" para estimar los
 * años totales de experiencia — cálculo puro sobre datos ya
 * estructurados (§20 del contexto: sin IA). Los intervalos que se
 * solapan (p.ej. un trabajo y un proyecto freelance en paralelo) se
 * fusionan antes de sumar, para no contar el mismo periodo dos veces.
 */
export function calculateExperienceStats(db: AppDatabase, cvVersionId: string): ExperienceStats {
  const resolved = resolveCV(db, cvVersionId);
  const experienceSection = resolved.sections.find((s) => s.key === "experience");
  if (!experienceSection) return { totalYears: null, rangeCount: 0 };

  const intervals: Array<[number, number]> = [];
  for (const item of experienceSection.items) {
    if (item.broken) continue;
    const dateField = item.fields.find((f) => f.type === "daterange");
    const range = dateField?.value as DateRangeValue | null | undefined;
    if (!range) continue;
    const start = parseIsoDate(range.start);
    const end = range.current ? new Date() : parseIsoDate(range.end);
    if (!start || !end || end.getTime() < start.getTime()) continue;
    intervals.push([start.getTime(), end.getTime()]);
  }
  if (intervals.length === 0) return { totalYears: null, rangeCount: 0 };

  intervals.sort((a, b) => a[0] - b[0]);
  let totalMs = 0;
  let [curStart, curEnd] = intervals[0]!;
  for (let i = 1; i < intervals.length; i++) {
    const [s, e] = intervals[i]!;
    if (s <= curEnd) {
      curEnd = Math.max(curEnd, e);
    } else {
      totalMs += curEnd - curStart;
      [curStart, curEnd] = [s, e];
    }
  }
  totalMs += curEnd - curStart;

  const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;
  return { totalYears: Math.round((totalMs / MS_PER_YEAR) * 10) / 10, rangeCount: intervals.length };
}

export interface LengthRecommendation {
  estimatedPages: number;
  recommendedMaxPages: number;
  withinRecommendation: boolean;
  message: string;
}

/**
 * Caracteres aproximados que caben en una página A4 con la tipografía y
 * márgenes habituales de esta app. Es una ESTIMACIÓN deliberada, no una
 * medición real: el dominio no tiene acceso al DOM/layout real (eso solo
 * existe en pantalla, ver CVPreview.tsx/pagination.ts) — para un recuento
 * de páginas exacto haría falta que la capa de UI midiera el resultado
 * renderizado y se lo pasara a este análisis, algo que hoy no está
 * conectado. Esta cifra es orientativa, calibrada de forma conservadora
 * (mejor sobreestimar páginas que infravalorarlas).
 */
const CHARS_PER_PAGE_ESTIMATE = 3200;

export function estimatePageCount(cvPlainText: string): number {
  return Math.max(1, Math.ceil(cvPlainText.length / CHARS_PER_PAGE_ESTIMATE));
}

/**
 * Recomendación de longitud (§20 del contexto, mejora sugerida: "1 página
 * vs 2+, según nivel de experiencia") — regla general habitual en
 * consejos de CV: por debajo de 10 años de experiencia, una página;
 * 10 años o más, hasta dos son aceptables. Si no hay suficiente
 * información para estimar los años de experiencia, se aplica el criterio
 * más conservador (1 página).
 */
export function recommendLength(estimatedPages: number, totalYearsExperience: number | null): LengthRecommendation {
  const recommendedMaxPages = totalYearsExperience !== null && totalYearsExperience >= 10 ? 2 : 1;
  const withinRecommendation = estimatedPages <= recommendedMaxPages;
  const experienceNote =
    totalYearsExperience !== null
      ? `con ~${totalYearsExperience} años de experiencia detectados`
      : "sin suficientes fechas para estimar los años de experiencia";

  const message = withinRecommendation
    ? `Longitud estimada: ${estimatedPages} página(s) — dentro de lo recomendado (${experienceNote}).`
    : `Longitud estimada: ${estimatedPages} página(s) — por encima de lo recomendado (${recommendedMaxPages}) ${experienceNote}. Considera recortar contenido menos relevante.`;

  return { estimatedPages, recommendedMaxPages, withinRecommendation, message };
}
