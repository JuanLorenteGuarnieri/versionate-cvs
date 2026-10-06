import { useMemo, useState } from "react";
import type { AppDatabase } from "../../../domain/model/types.js";
import { analyzeCv } from "../../../domain/ats/analyzeCv.js";
import { compareWithJobDescription } from "../../../domain/ats/jobComparison.js";
import { findProofreadingIssues } from "../../../domain/ats/proofreading.js";
import {
  computeCategorizedKeywordComparison,
  extractStoredJobDescription,
  selectionFromCvVersion,
  suggestImprovements,
  type ScoreCategory,
} from "../../../domain/jobMatching.js";
import { useUILanguage } from "../UILanguageContext.js";
import { ScreenHeader } from "./ScreenHeader.js";

const CATEGORY_KEYS: Record<ScoreCategory, string> = {
  education: "education",
  technologies: "technologiesTools",
  experience: "experience",
};

/**
 * Fase 12 del plan (§20 del contexto): analizador ATS, completamente local
 * y sin IA. Toda la lógica (duplicados, contraste, tamaño de letra,
 * comparación de keywords) vive en src/domain/ats/ y tiene tests reales —
 * este componente solo la muestra y gestiona el textarea de la oferta.
 */
export function AtsScreen({
  db,
  cvVersionId,
  onBack,
}: {
  db: AppDatabase;
  cvVersionId: string;
  onBack: () => void;
}) {
  const { t } = useUILanguage();
  const [jobDescription, setJobDescription] = useState(() => {
    const version = db.cvVersions.find((v) => v.id === cvVersionId);
    return extractStoredJobDescription(version?.metadata.notes) ?? "";
  });
  const [wasAutoFilled] = useState(() => {
    const version = db.cvVersions.find((v) => v.id === cvVersionId);
    return extractStoredJobDescription(version?.metadata.notes) !== null;
  });
  const report = useMemo(() => analyzeCv(db, cvVersionId), [db, cvVersionId]);
  const comparison = useMemo(
    () => (jobDescription.trim() ? compareWithJobDescription(report.cvPlainText, jobDescription) : null),
    [jobDescription, report.cvPlainText]
  );
  const improvements = useMemo(
    () => (jobDescription.trim() ? suggestImprovements(db, cvVersionId, jobDescription) : []),
    [jobDescription, db, cvVersionId]
  );
  const categorizedKeywords = useMemo(
    () => (jobDescription.trim() ? computeCategorizedKeywordComparison(db, selectionFromCvVersion(db, cvVersionId), jobDescription) : null),
    [jobDescription, db, cvVersionId]
  );
  const proofreadingIssues = useMemo(() => findProofreadingIssues(report.cvPlainText), [report.cvPlainText]);

  return (
    <main className="ats-screen">
      <ScreenHeader title={t("atsScreenTitle")} onBack={onBack} />
      <p className="ats-screen__subtitle">
        {t("atsScreenSubtitle")}
      </p>

      <section className="ats-section">
        <h2>{t("atsStructure")}</h2>
        {report.duplicateMessages.length === 0 ? (
          <p className="ats-check ats-check--ok">{t("atsDuplicateMessagesOk")}</p>
        ) : (
          report.duplicateMessages.map((msg, i) => (
            <p key={i} className="ats-check ats-check--warning">
              ⚠ {msg}
            </p>
          ))
        )}
      </section>

      <section className="ats-section">
        <h2>{t("atsTypographyContrast")}</h2>
        {report.templateMissing ? (
          <p className="ats-check ats-check--warning">{t("atsTypographyContrastNoTemplate")}</p>
        ) : (
          <>
            <p className={`ats-check ${report.contrast.passesAA ? "ats-check--ok" : "ats-check--warning"}`}>
              {report.contrast.passesAA ? "✓" : "⚠"} {t("atsTypographyContrastRatio")}: {report.contrast.ratio}:1
              {report.contrast.passesAA ? t("atsTypographyContrastPassesAA") : t("atsTypographyContrastFailsAA")}
            </p>
            {report.fontSize.tooSmall ? (
              <p className="ats-check ats-check--warning">⚠ {report.fontSize.recommendation}</p>
            ) : (
              <p className="ats-check ats-check--ok">{t("atsTypographyContrastFontSizeOk")}</p>
            )}
          </>
        )}
      </section>

      <section className="ats-section">
        <h2>{t("atsDesign")}</h2>
        {report.columnLayoutRisk.atRisk ? (
          <p className="ats-check ats-check--warning">⚠ {report.columnLayoutRisk.message}</p>
        ) : (
          <p className="ats-check ats-check--ok">{t("atsDesignColumnLayoutOk")}</p>
        )}
        <p className="ats-check ats-check--ok">✓ {report.iconRisk.message}</p>
      </section>

      <section className="ats-section">
        <h2>{t("atsLength")}</h2>
        <p className={`ats-check ${report.length.withinRecommendation ? "ats-check--ok" : "ats-check--warning"}`}>
          {report.length.withinRecommendation ? "✓" : "⚠"} {report.length.message}
        </p>
        <p className="ats-screen__hint">
          {t("atsLengthHint")}
        </p>
      </section>

      <section className="ats-section">
        <h2>{t("atsDates")}</h2>
        {report.dateFormatConsistency.consistent ? (
          <p className="ats-check ats-check--ok">{t("atsDatesConsistentOk")}</p>
        ) : (
          <p className="ats-check ats-check--warning">
            {t("atsDatesInconsistentWarningStart")}{report.dateFormatConsistency.formatsUsed.map((f) => f.label).join(", ")} {t("atsDatesInconsistentWarningEnd")}
          </p>
        )}
      </section>

      <section className="ats-section">
        <h2>{t("atsBullets")}</h2>
        {report.actionVerbs.totalBullets === 0 ? (
          <p className="ats-check ats-check--ok">{t("atsActionVerbsNone")}</p>
        ) : (
          <p className={`ats-check ${report.actionVerbs.ratio >= 0.6 ? "ats-check--ok" : "ats-check--warning"}`}>
            {report.actionVerbs.ratio >= 0.6 ? "✓" : "⚠"} {report.actionVerbs.bulletsWithActionVerb}/{" "}
            {report.actionVerbs.totalBullets} {t("atsActionVerbsDescription")} (
            {Math.round(report.actionVerbs.ratio * 100)}%).
          </p>
        )}
        {report.bulletLength.tooShort.length > 0 && (
          <p className="ats-check ats-check--warning">
            ⚠ {report.bulletLength.tooShort.length} {t("atsBulletLengthTooShortWarning")}
          </p>
        )}
        {report.bulletLength.tooLong.length > 0 && (
          <p className="ats-check ats-check--warning">
            ⚠ {report.bulletLength.tooLong.length} {t("atsBulletLengthTooLongWarning")}
          </p>
        )}
        {report.bulletLength.tooShort.length === 0 && report.bulletLength.tooLong.length === 0 && report.actionVerbs.totalBullets > 0 && (
          <p className="ats-check ats-check--ok">{t("atsBulletLengthOk")}</p>
        )}
      </section>

      <section className="ats-section">
        <h2>{t("atsSectionCoverage")}</h2>
        {report.missingSections.length === 0 ? (
          <p className="ats-check ats-check--ok">{t("atsSectionCoverageOk")}</p>
        ) : (
          report.missingSections.map((m) => (
            <p key={m.key} className="ats-check ats-check--warning">
              {t("atsSectionCoverageWarningStart")}{m.label}{t("atsSectionCoverageWarningEnd")}
            </p>
          ))
        )}
      </section>

      <section className="ats-section">
        <h2>{t("atsKeywordDensity")}</h2>
        {report.keywordStuffing.length === 0 ? (
          <p className="ats-check ats-check--ok">{t("atsKeywordDensityOk")}</p>
        ) : (
          report.keywordStuffing.map((f) => (
            <p key={f.term} className="ats-check ats-check--warning">
              ⚠ "{f.term}" {t("atsKeywordDensityWarningAppears")} {f.count}{t("atsKeywordDensityWarningTimesStart")} {f.percentOfWords} {t("atsKeywordDensityWarningTimesEnd")}
            </p>
          ))
        )}
      </section>

      <section className="ats-section">
        <h2>{t("atsOrthotypographic")}</h2>
        <p className="ats-screen__hint">
          {t("atsOrthotypographicHint")}
        </p>
        {proofreadingIssues.length === 0 ? (
          <p className="ats-check ats-check--ok">{t("atsOrthotypographicOk")}</p>
        ) : (
          proofreadingIssues.map((issue, i) => (
            <p key={i} className="ats-check ats-check--warning">
              ⚠ {issue.message} <span className="ats-screen__hint">"{issue.snippet}"</span>
            </p>
          ))
        )}
      </section>

      <section className="ats-section">
        <h2>{t("atsCompareOfferHeading")}</h2>
        {wasAutoFilled && (
          <p className="empty-state">
            {t("atsJobOfferAutoFilledNotice")}
          </p>
        )}
        <textarea
          rows={8}
          placeholder={t("atsJobOfferPlaceholder")}
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
        />

        {comparison && (
          <div className="ats-comparison">
            <div className="ats-match-score">
              <div className="ats-match-score__number">{comparison.matchScore}%</div>
              <div>
                <div className="ats-match-score__label">{t("atsMatchScoreLabel")}</div>
                <div className="ats-match-score__hint">
                  {t("atsMatchScoreHint")}
                </div>
              </div>
            </div>
            <div>
              <h3>{t("atsPresentInCv")} ({comparison.presentInCv.length})</h3>
              <div className="ats-keyword-list">
                {comparison.presentInCv.length === 0 && <span className="empty-state">{t("atsKeywordListNone")}</span>}
                {comparison.presentInCv.map((k) => (
                  <span key={k.term} className="ats-keyword ats-keyword--present">
                    {k.term} ({k.count})
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3>{t("atsMissingFromCv")} ({comparison.missingFromCv.length})</h3>
              <div className="ats-keyword-list">
                {comparison.missingFromCv.length === 0 && <span className="empty-state">{t("atsMissingKeywordListNone")}</span>}
                {comparison.missingFromCv.map((k) => (
                  <span key={k.term} className="ats-keyword ats-keyword--missing">
                    {k.term} ({k.count})
                  </span>
                ))}
              </div>
            </div>
            <div className="ats-comparison__full-width">
              <h3>{t("atsPresentMissingCategory")}</h3>
              {categorizedKeywords &&
                (Object.keys(CATEGORY_KEYS) as ScoreCategory[]).map((category) => {
                  const cat = categorizedKeywords[category];
                  return (
                    <div key={category} className="ats-category-keywords">
                      <h4>{t(CATEGORY_KEYS[category])}</h4>
                      <div className="ats-keyword-list">
                        {cat.present.length === 0 && cat.missing.length === 0 && (
                          <span className="empty-state">{t("atsCategoryKeywordListNone")}</span>
                        )}
                        {cat.present.map((k) => (
                          <span key={`present-${k}`} className="ats-keyword ats-keyword--present">
                            {k}
                          </span>
                        ))}
                        {cat.missing.map((k) => (
                          <span key={`missing-${k}`} className="ats-keyword ats-keyword--missing">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
            <div className="ats-comparison__full-width">
              <h3>{t("atsImproveScoreTitle")}</h3>
              {improvements.length === 0 ? (
                <p className="empty-state">
                  {t("atsNoSuggestions")}
                </p>
              ) : (
                <ul className="ats-improvement-list">
                  {improvements.map((s, i) => (
                    <li key={i} className="ats-improvement">
                      {s.type === "add" ? (
                        <>
                          {t("atsImprovementAddPrefix")}<strong>{s.suggestedLabel}</strong>{t("atsImprovementAddMiddle")}{s.sectionTitle}
                        </>
                      ) : (
                        <>
                          {t("atsImprovementReplacePrefix")}{s.sectionTitle}{t("atsImprovementReplaceMiddle")}<strong>{s.removedLabel}</strong>{t("atsImprovementReplaceWith")}<strong>{s.suggestedLabel}</strong>
                        </>
                      )}{" "}
                      {t("atsImprovementCovers")}{s.newKeywords.length}{t(s.newKeywords.length === 1 ? "atsMissingKeywordOne" : "atsMissingKeywordMany")}{s.newKeywords.join(", ")}.
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
