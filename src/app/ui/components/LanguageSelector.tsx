import { useUILanguage } from "../UILanguageContext.js";
import { SUPPORTED_UI_LANGUAGES } from "../../../domain/ui-i18n.js";

const LANGUAGE_FLAGS: Record<(typeof SUPPORTED_UI_LANGUAGES)[number], string> = {
  es: "🇪🇸",
  en: "🇬🇧",
  fr: "🇫🇷",
  de: "🇩🇪",
  pt: "🇵🇹",
  it: "🇮🇹",
  zh: "🇨🇳",
  ja: "🇯🇵",
  hi: "🇮🇳",
  ar: "🇸🇦",
};

export function LanguageSelector({ floating = false }: { floating?: boolean }) {
  const { language, setLanguage, t } = useUILanguage();

  return (
    <div className={`language-selector${floating ? " language-selector--floating" : ""}`}>
      <label className="language-selector__label" htmlFor="ui-language-select">
        {t("language")}
      </label>
      <select
        id="ui-language-select"
        aria-label={t("language")}
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="language-selector__select"
      >
        {SUPPORTED_UI_LANGUAGES.map((lang) => (
          <option key={lang} value={lang}>
            {LANGUAGE_FLAGS[lang]} {lang.toUpperCase()}
          </option>
        ))}
      </select>
    </div>
  );
}