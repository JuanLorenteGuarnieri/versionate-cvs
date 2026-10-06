import { useMemo, useState } from "react";
import type { AppStore } from "../../state/appStore.js";
import type { AppDatabase } from "../../../domain/model/types.js";
import {
  computeItemCategoryImpacts,
  computeScoreBreakdown,
  matchDatabaseToJobDescription,
  type CategoryImpactDetail,
  type ScoreCategory,
  type JobMatchResult,
} from "../../../domain/jobMatching.js";
import { useUILanguage } from "../UILanguageContext.js";
import { ScreenHeader } from "./ScreenHeader.js";

/**
 * "Crear CV a partir de una oferta de trabajo" (petición explícita), con
 * una pestaña intermedia de revisión: a diferencia de la importación de
 * PDF, aquí no se extrae ni se crea ningún dato nuevo — solo se SELECCIONA
 * contenido que ya existe — así que la revisión es "ver por qué se eligió
 * cada cosa, poder desactivarla, cambiar de VARIANTE, o añadir algo que
 * quedó fuera, viendo cómo cambia la puntuación en vivo" antes de
 * confirmar y crear el CV de verdad.
 */

type Step = { type: "paste" } | { type: "review"; jobDescriptionText: string; match: JobMatchResult };

interface SelectionEntry {
  included: boolean;
  /** La variante EXISTENTE elegida para este elemento — por defecto la que propuso el matching, pero el usuario puede cambiarla (petición explícita: "también debería ser posible modificar la versión"). */
  variantId: string;
}

/** sectionDefinitionId -> elementId -> selección actual. */
type Selection = Record<string, Record<string, SelectionEntry>>;

function buildInitialSelection(match: JobMatchResult): Selection {
  const selection: Selection = {};
  for (const section of match.sections) {
    const entries: Record<string, SelectionEntry> = {};
    for (const item of section.items) {
      entries[item.elementId] = { included: item.defaultIncluded, variantId: item.variantId };
    }
    selection[section.sectionDefinitionId] = entries;
  }
  return selection;
}

function selectionToSections(match: JobMatchResult, selection: Selection) {
  return match.sections.map((section) => ({
    sectionDefinitionId: section.sectionDefinitionId,
    items: section.items
      .filter((i) => selection[section.sectionDefinitionId]?.[i.elementId]?.included)
      .map((i) => ({ elementId: i.elementId, variantId: selection[section.sectionDefinitionId]![i.elementId]!.variantId })),
  }));
}

const DEFAULT_MAX_ITEMS = 6;
const DEFAULT_MIN_SCORE = 1;

const CATEGORY_KEYS: Record<ScoreCategory, string> = {
  education: "education",
  technologies: "technologiesTools",
  experience: "experience",
};

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

export function JobMatchScreen({
  appStore,
  db,
  onBack,
  onCreated,
}: {
  appStore: AppStore;
  db: AppDatabase;
  onBack: () => void;
  onCreated: (projectId: string) => void;
}) {
  const { t, getLanguageDisplayName, language } = useUILanguage();
  const [jobDescriptionText, setJobDescriptionText] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxItemsPerSection, setMaxItemsPerSection] = useState(DEFAULT_MAX_ITEMS);
  const [minScoreToInclude, setMinScoreToInclude] = useState(DEFAULT_MIN_SCORE);
  const [step, setStep] = useState<Step>({ type: "paste" });
  const [selection, setSelection] = useState<Selection>({});
  const [cvName, setCvName] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  function handleAnalyze() {
    const text = jobDescriptionText.trim();
    if (!text) return;
    const match = matchDatabaseToJobDescription(db, text, { maxItemsPerSection, minScoreToInclude });
    setStep({ type: "review", jobDescriptionText: text, match });
    setSelection(buildInitialSelection(match));
    setCvName(match.suggestedName);
    setExpandedSections(new Set());
  }

  const currentSections = useMemo(() => (step.type === "review" ? selectionToSections(step.match, selection) : []), [step, selection]);

  const liveBreakdown = useMemo(() => {
    if (step.type !== "review") return null;
    return computeScoreBreakdown(db, currentSections, step.jobDescriptionText);
  }, [db, step, currentSections]);

  function toggleItem(sectionDefinitionId: string, elementId: string) {
    setSelection((prev) => {
      const current = prev[sectionDefinitionId]?.[elementId];
      if (!current) return prev;
      return {
        ...prev,
        [sectionDefinitionId]: { ...prev[sectionDefinitionId], [elementId]: { ...current, included: !current.included } },
      };
    });
  }

  function changeVariant(sectionDefinitionId: string, elementId: string, variantId: string) {
    setSelection((prev) => {
      const current = prev[sectionDefinitionId]?.[elementId];
      if (!current) return prev;
      return { ...prev, [sectionDefinitionId]: { ...prev[sectionDefinitionId], [elementId]: { ...current, variantId } } };
    });
  }

  function toggleSection(sectionDefinitionId: string, allElementIds: string[], enable: boolean) {
    setSelection((prev) => {
      const entries = { ...prev[sectionDefinitionId] };
      for (const id of allElementIds) {
        entries[id] = { ...entries[id]!, included: enable };
      }
      return { ...prev, [sectionDefinitionId]: entries };
    });
  }

  function toggleExpanded(sectionDefinitionId: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionDefinitionId)) next.delete(sectionDefinitionId);
      else next.add(sectionDefinitionId);
      return next;
    });
  }

  function handleConfirm() {
    if (step.type !== "review") return;
    const { projectId } = appStore.createCvFromSelection({
      name: cvName.trim() || step.match.suggestedName,
      jobDescriptionText: step.jobDescriptionText,
      sections: currentSections,
      displayLanguage: step.match.detectedLanguage,
    });
    onCreated(projectId);
  }

  if (step.type === "paste") {
    return (
      <main className="job-match">
        <ScreenHeader title={t("jobMatchCreateFromOffer")} onBack={onBack} />
        <p className="job-match__subtitle">
          {t("jobMatchPasteInstructions")}
        </p>

        <textarea
          className="job-match__textarea"
          value={jobDescriptionText}
          onChange={(e) => setJobDescriptionText(e.target.value)}
          placeholder={t("jobMatchPastePlaceholder")}
          rows={16}
        />

        <button className="link-button job-match__advanced-toggle" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? "▾" : "▸"} {t("jobMatchAdvanced")}
        </button>
        {showAdvanced && (
          <div className="job-match__advanced">
            <label>
              {t("maxItemsPerSection")}
              <input
                type="number"
                min={1}
                max={20}
                value={maxItemsPerSection}
                onChange={(e) => setMaxItemsPerSection(Math.max(1, Number(e.target.value) || DEFAULT_MAX_ITEMS))}
              />
            </label>
            <label>
              {t("minimumMatchScore")}
              <input
                type="number"
                min={1}
                value={minScoreToInclude}
                onChange={(e) => setMinScoreToInclude(Math.max(1, Number(e.target.value) || DEFAULT_MIN_SCORE))}
              />
            </label>
          </div>
        )}

        <div className="entity-form__actions">
          <button className="primary-button" onClick={handleAnalyze} disabled={!jobDescriptionText.trim()}>
            {t("analyzeAndSuggest")}
          </button>
          <button className="link-button" onClick={onBack}>
            {t("cancel")}
          </button>
        </div>
      </main>
    );
  }

  const { match } = step;

  return (
    <main className="job-match">
      <ScreenHeader
        title={t("reviewSelectionTitle")}
        onBack={() => setStep({ type: "paste" })}
        backLabel={t("backToPasteJob")}
      />
      <p className="job-match__subtitle">
        {t("reviewSelectionDescription")}
      </p>

      {match.detectedLanguage && (
        <p className="job-match__language-hint">
          {t("detectedJobLanguagePrefix")}<strong>{getLanguageDisplayName(match.detectedLanguage) || match.detectedLanguage}</strong>
          {t("detectedJobLanguageSuffix")}{match.detectedLanguage.toUpperCase()}{t("detectedJobLanguageEnd")}
        </p>
      )}

      <div className="job-match__score">
        <div className="job-match__score-number">{liveBreakdown?.overall ?? 0}%</div>
        <div>
          <div className="job-match__score-label">{t("overallJobMatch")}</div>
          <div className="job-match__score-hint">
            {t("jobMatchScoreHint")}
          </div>
        </div>
      </div>

      {liveBreakdown && (
        <div className="job-match__category-scores">
          <div className="job-match__category-score">
            <div className="job-match__category-score-header">
              <span>{t("education")}</span>
              <span className="job-match__category-score-number">{liveBreakdown.education.score}%</span>
            </div>
            <p>{liveBreakdown.education.detail}</p>
          </div>
          <div className="job-match__category-score">
            <div className="job-match__category-score-header">
              <span>{t("technologiesTools")}</span>
              <span className="job-match__category-score-number">{liveBreakdown.technologies.score}%</span>
            </div>
            <p>{liveBreakdown.technologies.detail}</p>
          </div>
          <div className="job-match__category-score">
            <div className="job-match__category-score-header">
              <span>{t("experience")}</span>
              <span className="job-match__category-score-number">{liveBreakdown.experience.score}%</span>
            </div>
            <p>{liveBreakdown.experience.detail}</p>
          </div>
        </div>
      )}

      {match.jobKeywords.length > 0 && (
        <div className="job-match__keywords">
          <h3>{t("relevantJobKeywords")}</h3>
          <div className="job-match__keyword-list">
            {match.jobKeywords.map((k) => (
              <span key={k.term} className={`job-match__keyword-chip${k.isTech ? " job-match__keyword-chip--tech" : ""}`}>
                {k.term} ({k.count})
              </span>
            ))}
          </div>
          <p className="job-match__keywords-hint">
            {t("jobKeywordsHint")}
          </p>
        </div>
      )}

      <label className="job-match__name-field">
        {t("cvName")}
        <input type="text" value={cvName} onChange={(e) => setCvName(e.target.value)} />
      </label>

      {match.sections.map((section) => {
        const sectionDef = db.sections.find((s) => s.id === section.sectionDefinitionId);
        const sectionSelection = selection[section.sectionDefinitionId] ?? {};
        const allElementIds = section.items.map((i) => i.elementId);
        const allChecked = allElementIds.length > 0 && allElementIds.every((id) => sectionSelection[id]?.included);

        const proposed = section.items.filter((i) => i.defaultIncluded);
        const others = section.items.filter((i) => !i.defaultIncluded);
        const isExpanded = expandedSections.has(section.sectionDefinitionId);

        const renderItem = (item: (typeof section.items)[number]) => {
          const entry = sectionSelection[item.elementId];
          const currentVariantId = entry?.variantId ?? item.variantId;
          // FIX: el motivo mostrado debe reflejar la variante REALMENTE
          // seleccionada ahora mismo, no la de la propuesta inicial — antes
          // se quedaba fijo en `item.matchedKeywords` aunque se cambiara de
          // versión.
          const currentVariantData = item.availableVariants.find((v) => v.variantId === currentVariantId);
          const currentMatchedKeywords = currentVariantData?.matchedKeywords ?? item.matchedKeywords;

          const impacts =
            step.type === "review"
              ? computeItemCategoryImpacts(
                  db,
                  currentSections,
                  step.jobDescriptionText,
                  section.sectionDefinitionId,
                  item.elementId,
                  currentVariantId
                )
              : null;
          // Solo se muestran las categorías donde este item realmente
          // aporta algo (delta != 0) — un Proyecto sin ninguna keyword de
          // Educación no necesita una línea "0% en Educación" que no dice
          // nada. Petición explícita: puede aportar a más de una a la vez.
          const impactLines: Array<[ScoreCategory, CategoryImpactDetail]> = impacts
            ? (
                [
                  ["education", impacts.education],
                  ["technologies", impacts.technologies],
                  ["experience", impacts.experience],
                ] as Array<[ScoreCategory, CategoryImpactDetail | null]>
              ).filter((pair): pair is [ScoreCategory, CategoryImpactDetail] => pair[1] !== null && pair[1].delta !== 0)
            : [];

          // Para cada variante candidata, su propio impacto por categoría —
          // para poder mostrar "cómo cambiaría la puntuación" y marcar la
          // mejor opción en el desplegable (petición explícita).
          const variantOptions = item.availableVariants.map((v) => {
            const variantImpacts =
              step.type === "review"
                ? computeItemCategoryImpacts(db, currentSections, step.jobDescriptionText, section.sectionDefinitionId, item.elementId, v.variantId)
                : null;
            const labelParts: string[] = [];
            if (variantImpacts?.education.withScore) labelParts.push(`${t("education")} ${variantImpacts.education.withScore}%`);
            if (variantImpacts?.technologies.withScore) labelParts.push(`${t("technologiesTools")} ${variantImpacts.technologies.withScore}%`);
            if (variantImpacts?.experience?.withScore) labelParts.push(`${t("experience")} ${variantImpacts.experience.withScore}%`);
            return { ...v, scoreLabel: labelParts.length > 0 ? labelParts.join(" · ") : `${v.score} ${t("pointsAbbreviation")}` };
          });
          const bestVariantId = variantOptions.reduce((best, v) => (v.score > best.score ? v : best), variantOptions[0]!).variantId;

          return (
            <div key={item.elementId} className="job-match__item">
              <label className="job-match__item-checkbox">
                <input
                  type="checkbox"
                  checked={entry?.included ?? false}
                  onChange={() => toggleItem(section.sectionDefinitionId, item.elementId)}
                />
                <div>
                  <div className="job-match__item-label">{item.label}</div>
                  {section.alwaysIncluded ? (
                    currentMatchedKeywords.length > 0 ? (
                      <div className="job-match__item-reason">
                        {t("alwaysChosenPrefix")}{currentMatchedKeywords.length}{t(currentMatchedKeywords.length === 1 ? "keywordSingular" : "keywordPlural")}{currentMatchedKeywords.join(", ")}
                      </div>
                    ) : (
                      <div className="job-match__item-reason">{t("alwaysIncludedNoMatch")}</div>
                    )
                  ) : currentMatchedKeywords.length > 0 ? (
                    <div className="job-match__item-reason">
                      {t("matchesKeywordPrefix")}{currentMatchedKeywords.length}{t(currentMatchedKeywords.length === 1 ? "keywordSingular" : "keywordPlural")}{currentMatchedKeywords.join(", ")}
                    </div>
                  ) : (
                    <div className="job-match__item-reason">{t("noKeywordMatches")}</div>
                  )}
                  {impactLines.map(([category, detail]) => (
                    <div key={category} className="job-match__item-impact">
                      {entry?.included
                        ? `${formatDelta(detail.delta)}${t("scoreRemainsPrefix")}${t(CATEGORY_KEYS[category])}${t("scoreRemainsSuffix")}${detail.withScore}${t("scorePercentClose")}`
                        : `${t("ifAddedPrefix")}${formatDelta(detail.delta)}${t("scoreRemainsPrefix")}${t(CATEGORY_KEYS[category])}${t("scoreWouldBeSuffix")}${detail.withScore}${t("scorePercentClose")}`}
                    </div>
                  ))}
                </div>
              </label>
              {item.availableVariants.length > 1 && (
                <label className="job-match__variant-picker">
                  {t("versionLabelShort")}
                  <select
                    value={currentVariantId}
                    onChange={(e) => changeVariant(section.sectionDefinitionId, item.elementId, e.target.value)}
                  >
                    {variantOptions.map((v) => (
                      <option key={v.variantId} value={v.variantId}>
                        {v.variantId === bestVariantId ? "★ " : ""}
                        {v.variantName} — {v.scoreLabel}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          );
        };

        return (
          <section key={section.sectionDefinitionId} className="job-match__section">
            <div className="job-match__section-header">
              <h2>{sectionDef?.defaultTitle ?? t("sectionFallback")}</h2>
              {section.alwaysIncluded ? (
                <span className="job-match__badge">{t("alwaysIncluded")}</span>
              ) : (
                <label className="job-match__toggle-all">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => toggleSection(section.sectionDefinitionId, allElementIds, e.target.checked)}
                  />
                  {t("markAll")}
                </label>
              )}
            </div>

            {proposed.length === 0 && !section.alwaysIncluded && (
              <p className="empty-state">
                {t("noAutomaticMatchPrefix")}
              </p>
            )}

            {proposed.map(renderItem)}

            {others.length > 0 && (
              <div className="job-match__other-options">
                <button className="link-button" onClick={() => toggleExpanded(section.sectionDefinitionId)}>
                  {isExpanded ? "▾" : "▸"} {others.length}{t(others.length === 1 ? "otherOption" : "otherOptions")}{t(others.length === 1 ? "otherOptionTail" : "otherOptionsTail")}
                </button>
                {isExpanded && others.map(renderItem)}
              </div>
            )}
          </section>
        );
      })}

      <div className="entity-form__actions">
        <button className="primary-button" onClick={handleConfirm}>
          {t("createCvWithSelection")}
        </button>
        <button className="link-button" onClick={onBack}>
          {t("cancel")}
        </button>
      </div>
    </main>
  );
}
