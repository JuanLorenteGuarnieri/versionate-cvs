import type { AppDatabase } from "../model/types.js";
import { getVisibleSections, resolveCV } from "../resolveCV.js";
import { findDuplicateElements, describeDuplicate } from "./duplicateDetection.js";
import {
  checkColumnLayoutRisk,
  checkContrast,
  checkFontSize,
  checkIconRisk,
  type ColumnLayoutRisk,
  type ContrastCheckResult,
  type FontSizeCheckResult,
  type IconRisk,
} from "./styleChecks.js";
import { extractCvPlainText } from "./cvText.js";
import { detectKeywordStuffing, type KeywordStuffingFlag } from "./textAnalysis.js";
import { checkDateFormatConsistency, type DateFormatConsistencyResult } from "./dateConsistency.js";
import { checkActionVerbs, checkBulletLength, type ActionVerbCheckResult, type BulletLengthCheckResult } from "./bulletChecks.js";
import { findMissingStandardSections, type MissingSection } from "./sectionCoverage.js";
import {
  calculateExperienceStats,
  estimatePageCount,
  recommendLength,
  type ExperienceStats,
  type LengthRecommendation,
} from "./experienceStats.js";

export interface AtsReport {
  duplicateMessages: string[];
  contrast: ContrastCheckResult;
  fontSize: FontSizeCheckResult;
  /** Texto plano completo del CV, listo para compararlo con una oferta de trabajo. */
  cvPlainText: string;
  /** true si la versión no tiene una template válida — el resto de campos de estilo son valores por defecto en ese caso. */
  templateMissing: boolean;
  columnLayoutRisk: ColumnLayoutRisk;
  iconRisk: IconRisk;
  length: LengthRecommendation;
  experience: ExperienceStats;
  dateFormatConsistency: DateFormatConsistencyResult;
  actionVerbs: ActionVerbCheckResult;
  bulletLength: BulletLengthCheckResult;
  missingSections: MissingSection[];
  keywordStuffing: KeywordStuffingFlag[];
}

/**
 * Análisis ATS de una versión de CV (§20 del contexto): completamente
 * local, basado en reglas, sin IA. Orquesta las comprobaciones puras de
 * este módulo; no sabe nada de React ni de cómo se presenta el resultado.
 */
export function analyzeCv(db: AppDatabase, cvVersionId: string): AtsReport {
  const version = db.cvVersions.find((v) => v.id === cvVersionId);
  if (!version) {
    throw new Error(`CVVersion not found: ${cvVersionId}`);
  }
  const template = db.templates.find((t) => t.id === version.templateId);

  const duplicates = findDuplicateElements(version, db);
  const duplicateMessages = duplicates.map((d) => describeDuplicate(d, db));

  const contrast = template
    ? checkContrast(template.colors.text, template.colors.background)
    : { ratio: 0, passesAA: false, passesAALarge: false };
  const fontSize = template ? checkFontSize(template.typography.baseFontSize) : { tooSmall: false, recommendation: null };

  const cvPlainText = extractCvPlainText(db, cvVersionId);

  const resolved = resolveCV(db, cvVersionId);
  const languagesSection = getVisibleSections(resolved).find((s) => s.key === "languages");
  const languagesMode = template ? (template.languagesStyle.mode as string | undefined) : undefined;
  const columnLayoutRisk = checkColumnLayoutRisk(languagesMode, languagesSection?.items.length ?? 0);

  const experience = calculateExperienceStats(db, cvVersionId);
  const length = recommendLength(estimatePageCount(cvPlainText), experience.totalYears);

  return {
    duplicateMessages,
    contrast,
    fontSize,
    cvPlainText,
    templateMissing: !template,
    columnLayoutRisk,
    iconRisk: checkIconRisk(),
    length,
    experience,
    dateFormatConsistency: checkDateFormatConsistency(cvPlainText),
    actionVerbs: checkActionVerbs(db, cvVersionId),
    bulletLength: checkBulletLength(db, cvVersionId),
    missingSections: findMissingStandardSections(db, cvVersionId),
    keywordStuffing: detectKeywordStuffing(cvPlainText),
  };
}
