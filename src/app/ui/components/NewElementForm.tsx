import { useState, type FormEvent } from "react";
import type { AppStore } from "../../state/appStore.js";
import type { FieldValue, SectionDefinition } from "../../../domain/model/types.js";
import { FieldInputs } from "./FieldInputs.js";
import { useUILanguage } from "../UILanguageContext.js";

export function NewElementForm({
  appStore,
  section,
  onDone,
  onCancel,
}: {
  appStore: AppStore;
  section: SectionDefinition;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t } = useUILanguage();
  const [variantName, setVariantName] = useState(() => t("originalVariant"));
  const [fields, setFields] = useState<Record<string, FieldValue>>({});

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    appStore.createElement({ sectionId: section.id, variantName, fields });
    onDone();
  }

  return (
    <form className="entity-form" onSubmit={handleSubmit}>
      <label className="entity-form__field">
        <span>{t("firstVariantName")}</span>
        <input value={variantName} onChange={(e) => setVariantName(e.target.value)} required />
      </label>

      <FieldInputs fieldSchema={section.fieldSchema} values={fields} onChange={setFields} />

      <div className="entity-form__actions">
        <button type="submit" className="primary-button">
          {t("create")}
        </button>
        <button type="button" className="link-button" onClick={onCancel}>
          {t("cancel")}
        </button>
      </div>
    </form>
  );
}
