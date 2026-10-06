import { useUILanguage } from "../UILanguageContext.js";
import { SUPPORTED_UI_LANGUAGES } from "../../../domain/ui-i18n.js";

export function LanguageSelector() {
  const { language, setLanguage, t, getLanguageDisplayName } = useUILanguage();

  return (
    <div className="language-selector">
      <label className="language-selector__label">{t("language")}</label>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="language-selector__select"
      >
        {SUPPORTED_UI_LANGUAGES.map((lang) => (
          <option key={lang} value={lang}>
            {getLanguageDisplayName(lang)}
          </option>
        ))}
      </select>
    </div>
  );
}