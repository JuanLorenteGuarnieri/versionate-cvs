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

const CATEGORY_LABELS: Record<ScoreCategory, string> = {
  education: "Educación",
  technologies: "Tecnologías / Herramientas",
  experience: "Experiencia",
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
      <button className="link-button" onClick={onBack}>
        ← Volver
      </button>
      <h1>Análisis ATS</h1>
      <p className="ats-screen__subtitle">
        Análisis completamente local y basado en reglas fijas, sin IA — nada de esto sale de tu
        navegador.
      </p>

      <section className="ats-section">
        <h2>Estructura</h2>
        {report.duplicateMessages.length === 0 ? (
          <p className="ats-check ats-check--ok">✓ Ningún elemento se repite entre secciones.</p>
        ) : (
          report.duplicateMessages.map((msg, i) => (
            <p key={i} className="ats-check ats-check--warning">
              ⚠ {msg}
            </p>
          ))
        )}
      </section>

      <section className="ats-section">
        <h2>Tipografía y contraste</h2>
        {report.templateMissing ? (
          <p className="ats-check ats-check--warning">⚠ Esta versión no tiene una template válida.</p>
        ) : (
          <>
            <p className={`ats-check ${report.contrast.passesAA ? "ats-check--ok" : "ats-check--warning"}`}>
              {report.contrast.passesAA ? "✓" : "⚠"} Contraste de texto: {report.contrast.ratio}:1
              {report.contrast.passesAA ? " (cumple WCAG AA)" : " (por debajo del mínimo recomendado, 4.5:1)"}
            </p>
            {report.fontSize.tooSmall ? (
              <p className="ats-check ats-check--warning">⚠ {report.fontSize.recommendation}</p>
            ) : (
              <p className="ats-check ats-check--ok">✓ Tamaño de letra razonable.</p>
            )}
          </>
        )}
      </section>

      <section className="ats-section">
        <h2>Diseño</h2>
        {report.columnLayoutRisk.atRisk ? (
          <p className="ats-check ats-check--warning">⚠ {report.columnLayoutRisk.message}</p>
        ) : (
          <p className="ats-check ats-check--ok">✓ No se ha detectado contenido dispuesto en columnas.</p>
        )}
        <p className="ats-check ats-check--ok">✓ {report.iconRisk.message}</p>
      </section>

      <section className="ats-section">
        <h2>Longitud</h2>
        <p className={`ats-check ${report.length.withinRecommendation ? "ats-check--ok" : "ats-check--warning"}`}>
          {report.length.withinRecommendation ? "✓" : "⚠"} {report.length.message}
        </p>
        <p className="ats-screen__hint">
          La estimación de páginas se basa en la cantidad de texto extraído, no en una medición real del
          documento paginado — orientativa, no exacta.
        </p>
      </section>

      <section className="ats-section">
        <h2>Fechas</h2>
        {report.dateFormatConsistency.consistent ? (
          <p className="ats-check ats-check--ok">✓ Formato de fecha consistente en todo el CV.</p>
        ) : (
          <p className="ats-check ats-check--warning">
            ⚠ Se mezclan varios formatos de fecha: {report.dateFormatConsistency.formatsUsed.map((f) => f.label).join(", ")}.
            Unifica el formato para que se vea más cuidado.
          </p>
        )}
      </section>

      <section className="ats-section">
        <h2>Redacción de viñetas</h2>
        {report.actionVerbs.totalBullets === 0 ? (
          <p className="ats-check ats-check--ok">✓ Este CV no usa viñetas todavía.</p>
        ) : (
          <p className={`ats-check ${report.actionVerbs.ratio >= 0.6 ? "ats-check--ok" : "ats-check--warning"}`}>
            {report.actionVerbs.ratio >= 0.6 ? "✓" : "⚠"} {report.actionVerbs.bulletsWithActionVerb} de{" "}
            {report.actionVerbs.totalBullets} viñetas empiezan por un verbo de acción reconocido (
            {Math.round(report.actionVerbs.ratio * 100)}%).
          </p>
        )}
        {report.bulletLength.tooShort.length > 0 && (
          <p className="ats-check ats-check--warning">
            ⚠ {report.bulletLength.tooShort.length} viñeta(s) parecen demasiado cortas (menos de 4 palabras).
          </p>
        )}
        {report.bulletLength.tooLong.length > 0 && (
          <p className="ats-check ats-check--warning">
            ⚠ {report.bulletLength.tooLong.length} viñeta(s) son muy largas (más de 30 palabras) — cuestan de leer de un vistazo.
          </p>
        )}
        {report.bulletLength.tooShort.length === 0 && report.bulletLength.tooLong.length === 0 && report.actionVerbs.totalBullets > 0 && (
          <p className="ats-check ats-check--ok">✓ Longitud de las viñetas razonable.</p>
        )}
      </section>

      <section className="ats-section">
        <h2>Cobertura de secciones</h2>
        {report.missingSections.length === 0 ? (
          <p className="ats-check ats-check--ok">✓ Experience, Education y Skills tienen contenido.</p>
        ) : (
          report.missingSections.map((m) => (
            <p key={m.key} className="ats-check ats-check--warning">
              ⚠ No hay contenido en "{m.label}" en este CV.
            </p>
          ))
        )}
      </section>

      <section className="ats-section">
        <h2>Densidad de palabras clave</h2>
        {report.keywordStuffing.length === 0 ? (
          <p className="ats-check ats-check--ok">✓ Ninguna palabra se repite de forma sospechosa.</p>
        ) : (
          report.keywordStuffing.map((f) => (
            <p key={f.term} className="ats-check ats-check--warning">
              ⚠ "{f.term}" aparece {f.count} veces ({f.percentOfWords}% del texto) — puede parecer repetición
              artificial de keywords.
            </p>
          ))
        )}
      </section>

      <section className="ats-section">
        <h2>Comprobaciones ortotipográficas</h2>
        <p className="ats-screen__hint">
          Esto detecta errores de formato (espacios dobles, palabras repetidas, puntuación pegada...)
          con reglas fijas, no gramática real — comprobar concordancia o tiempos verbales de verdad
          necesitaría un modelo de lenguaje, y el analizador ATS funciona sin IA a propósito.
        </p>
        {proofreadingIssues.length === 0 ? (
          <p className="ats-check ats-check--ok">✓ No se ha detectado ningún error tipográfico común.</p>
        ) : (
          proofreadingIssues.map((issue, i) => (
            <p key={i} className="ats-check ats-check--warning">
              ⚠ {issue.message} <span className="ats-screen__hint">"{issue.snippet}"</span>
            </p>
          ))
        )}
      </section>

      <section className="ats-section">
        <h2>Comparar con una oferta de trabajo</h2>
        {wasAutoFilled && (
          <p className="empty-state">
            Este CV se generó a partir de una oferta — se ha rellenado automáticamente con ese mismo
            texto. Puedes cambiarlo si quieres comparar con otra.
          </p>
        )}
        <textarea
          rows={8}
          placeholder="Pega aquí el texto de la oferta de trabajo…"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
        />

        {comparison && (
          <div className="ats-comparison">
            <div className="ats-match-score">
              <div className="ats-match-score__number">{comparison.matchScore}%</div>
              <div>
                <div className="ats-match-score__label">Correspondencia con la oferta</div>
                <div className="ats-match-score__hint">
                  Qué proporción de las menciones de keywords de la oferta cubre este CV.
                </div>
              </div>
            </div>
            <div>
              <h3>Presentes en tu CV ({comparison.presentInCv.length})</h3>
              <div className="ats-keyword-list">
                {comparison.presentInCv.length === 0 && <span className="empty-state">Ninguna todavía.</span>}
                {comparison.presentInCv.map((k) => (
                  <span key={k.term} className="ats-keyword ats-keyword--present">
                    {k.term} ({k.count})
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3>Ausentes de tu CV ({comparison.missingFromCv.length})</h3>
              <div className="ats-keyword-list">
                {comparison.missingFromCv.length === 0 && <span className="empty-state">Ninguna — buena señal.</span>}
                {comparison.missingFromCv.map((k) => (
                  <span key={k.term} className="ats-keyword ats-keyword--missing">
                    {k.term} ({k.count})
                  </span>
                ))}
              </div>
            </div>
            <div className="ats-comparison__full-width">
              <h3>Presentes/ausentes por categoría</h3>
              {categorizedKeywords &&
                (Object.keys(CATEGORY_LABELS) as ScoreCategory[]).map((category) => {
                  const cat = categorizedKeywords[category];
                  return (
                    <div key={category} className="ats-category-keywords">
                      <h4>{CATEGORY_LABELS[category]}</h4>
                      <div className="ats-keyword-list">
                        {cat.present.length === 0 && cat.missing.length === 0 && (
                          <span className="empty-state">No hay contenido en esta sección todavía.</span>
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
              <h3>Cómo mejorar la puntuación</h3>
              {improvements.length === 0 ? (
                <p className="empty-state">
                  No se ha encontrado ningún otro elemento de tu base de datos que cubra keywords que
                  te falten — puede que ya estés usando lo mejor que tienes para esta oferta, o que no
                  haya nada más en tu base de datos relacionado con ella.
                </p>
              ) : (
                <ul className="ats-improvement-list">
                  {improvements.map((s, i) => (
                    <li key={i} className="ats-improvement">
                      {s.type === "add" ? (
                        <>
                          Añade <strong>"{s.suggestedLabel}"</strong> a {s.sectionTitle}
                        </>
                      ) : (
                        <>
                          En {s.sectionTitle}, sustituye <strong>"{s.removedLabel}"</strong> por{" "}
                          <strong>"{s.suggestedLabel}"</strong>
                        </>
                      )}{" "}
                      — cubriría {s.newKeywords.length} keyword{s.newKeywords.length === 1 ? "" : "s"} que
                      ahora mismo no aparece{s.newKeywords.length === 1 ? "" : "n"} en tu CV: {s.newKeywords.join(", ")}.
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
