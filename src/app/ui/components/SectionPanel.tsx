import { useState } from "react";
import type { AppStore } from "../../state/appStore.js";
import type { AppDatabase, SectionDefinition } from "../../../domain/model/types.js";
import { ElementCard } from "./ElementCard.js";
import { NewElementForm } from "./NewElementForm.js";
import { useUILanguage } from "../UILanguageContext.js";
import { ScreenHeader } from "./ScreenHeader.js";

export function SectionPanel({
  appStore,
  db,
  section,
  onBack,
}: {
  appStore: AppStore;
  db: AppDatabase;
  section: SectionDefinition;
  onBack: () => void;
}) {
  const { t } = useUILanguage();
  const [showNewForm, setShowNewForm] = useState(false);
  const elements = db.elements.filter((e) => e.sectionId === section.id);

  return (
    <main className="section-panel">
      <ScreenHeader
        title={section.defaultTitle}
        onBack={onBack}
        backLabel={t("allSections")}
        className="section-panel__toolbar"
      />

      <div className="section-panel__body">
        {elements.length === 0 && !showNewForm && (
          <p className="empty-state">{t("noSectionItems")}</p>
        )}

        <ul className="element-list">
          {elements.map((element) => (
            <li key={element.id}>
              <ElementCard appStore={appStore} db={db} section={section} element={element} />
            </li>
          ))}
        </ul>

        {showNewForm ? (
          <NewElementForm
            appStore={appStore}
            section={section}
            onDone={() => setShowNewForm(false)}
            onCancel={() => setShowNewForm(false)}
          />
        ) : (
          <button className="primary-button" onClick={() => setShowNewForm(true)}>
            {t("addToSectionPrefix")}{section.defaultTitle}
          </button>
        )}
      </div>
    </main>
  );
}
